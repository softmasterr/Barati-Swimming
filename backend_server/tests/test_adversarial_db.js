/**
 * Adversarial Verification Suite: SQLite Database Engine & Repository Layer
 * 
 * Challenges & Stress-Tests:
 * 1. Transaction Rollback Integrity under deliberate mid-transaction failures (withTransaction, batchUpsert, nested transactions, dirty state recovery)
 * 2. WAL Concurrency & Lock Stress (1,000+ concurrent operations across worker threads checking for SQLITE_BUSY or data corruption)
 * 3. Foreign Key Cascade Deletion & Multi-Tenant Isolation (zero orphan rows, complete cascade, zero cross-tenant leakage, FK constraint enforcement)
 * 4. SQL Injection Resistance across all repository methods (adversarial tautologies, stacked queries, drops, unions, subqueries, null bytes)
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';
import { DatabaseSync } from 'node:sqlite';

import { initDatabase, getDatabase, withTransaction, closeDatabase, configurePragmas } from '../src/db/database.js';
import { AthleteRepository } from '../src/db/repositories/athleteRepo.js';
import { TransactionRepository } from '../src/db/repositories/transactionRepo.js';
import { AttendanceRepository } from '../src/db/repositories/attendanceRepo.js';
import { LicenseRepository } from '../src/db/repositories/licenseRepo.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ADVERSARIAL_DB_PATH = path.resolve(__dirname, '..', 'data', 'test_adversarial.db');

function cleanupDbFiles(basePath) {
  for (const ext of ['', '-wal', '-shm']) {
    const f = basePath + ext;
    if (fs.existsSync(f)) {
      try { fs.unlinkSync(f); } catch (_) {}
    }
  }
}

describe('Adversarial Verification: SQLite Database Engine & Repositories', () => {
  let db;
  let licenseRepo;
  let athleteRepo;
  let transactionRepo;
  let attendanceRepo;

  before(() => {
    closeDatabase();
    cleanupDbFiles(ADVERSARIAL_DB_PATH);
    db = initDatabase(ADVERSARIAL_DB_PATH);
    licenseRepo = new LicenseRepository(db);
    athleteRepo = new AthleteRepository(db);
    transactionRepo = new TransactionRepository(db);
    attendanceRepo = new AttendanceRepository(db);
  });

  after(() => {
    closeDatabase();
    cleanupDbFiles(ADVERSARIAL_DB_PATH);
  });

  // =========================================================================
  // Challenge 1: Transaction Rollback Integrity During Deliberate Mid-Tx Failures
  // =========================================================================
  describe('1. Transaction Rollback Integrity Under Deliberate Failures', () => {
    it('1.1 withTransaction rolls back completely on deliberate mid-execution throw', () => {
      const schoolId = 'tx-rollback-school';
      let caughtError = null;

      try {
        withTransaction((txDb) => {
          // 1. Create school license
          licenseRepo.create({
            schoolId,
            academyName: 'Rollback Academy',
            licenseKey: 'LIC-ROLLBACK-TEST',
            expiryDate: '2026-12-31'
          });

          // 2. Insert 10 athletes
          for (let i = 1; i <= 10; i++) {
            athleteRepo.create(schoolId, {
              id: `ath-rb-${i}`,
              name: `Athlete ${i}`,
              phone: '09120000000',
              coachId: 'coach-1',
              packageName: 'Test Pack',
              tuitionFee: 1000000,
              paidAmount: 500000,
              debt: 500000,
              expireDate: '2026-12-31'
            });
          }

          // 3. Insert 5 transactions
          for (let i = 1; i <= 5; i++) {
            transactionRepo.create(schoolId, {
              id: `tx-rb-${i}`,
              date: '2026-10-25',
              type: 'income',
              title: `Income ${i}`,
              amount: 500000,
              author: 'Admin'
            });
          }

          // 4. DELIBERATE MID-TRANSACTION FAILURE
          throw new Error('DELIBERATE_CRASH_MID_TRANSACTION');
        });
      } catch (err) {
        caughtError = err;
      }

      assert.ok(caughtError, 'Expected transaction to throw');
      assert.strictEqual(caughtError.message, 'DELIBERATE_CRASH_MID_TRANSACTION');

      // Verify ZERO records persisted in any table
      const lic = licenseRepo.findBySchoolId(schoolId);
      assert.strictEqual(lic, null, 'License must NOT exist after rollback');

      const athletes = athleteRepo.findAllBySchoolId(schoolId);
      assert.strictEqual(athletes.length, 0, 'No athletes should exist after rollback');

      const txs = transactionRepo.findAllBySchoolId(schoolId);
      assert.strictEqual(txs.length, 0, 'No transactions should exist after rollback');

      // Verify connection lock was released by executing a successful transaction immediately after
      assert.doesNotThrow(() => {
        withTransaction((txDb) => {
          licenseRepo.create({
            schoolId,
            academyName: 'Rollback Recovery Academy',
            licenseKey: 'LIC-ROLLBACK-RECOVERY',
            expiryDate: '2026-12-31'
          });
        });
      }, 'Subsequent transaction must succeed on the same connection');

      assert.ok(licenseRepo.findBySchoolId(schoolId), 'Recovery license must exist');
    });

    it('1.2 athleteRepo.batchUpsert rolls back all 49 prior items if item 50 fails', () => {
      const schoolId = 'batch-athlete-fail-school';
      licenseRepo.create({
        schoolId,
        academyName: 'Batch Fail Academy',
        licenseKey: 'LIC-BATCH-FAIL',
        expiryDate: '2026-12-31'
      });

      // Prepare 100 athletes, with item index 49 (50th item) containing null name (violates NOT NULL)
      const athletes = [];
      for (let i = 0; i < 100; i++) {
        athletes.push({
          id: `ath-batch-${i}`,
          name: i === 49 ? null : `Athlete ${i}`, // Item 50 causes NOT NULL constraint violation
          phone: '09121111111',
          coachId: 'coach-1',
          packageName: 'Monthly',
          tuitionFee: 1000000,
          paidAmount: 1000000,
          debt: 0,
          expireDate: '2026-12-31'
        });
      }

      assert.throws(() => {
        athleteRepo.batchUpsert(schoolId, athletes);
      }, /constraint/i, 'Batch upsert must fail on invalid item');

      // Verify atomic all-or-nothing: ZERO athletes persisted
      const count = athleteRepo.count(schoolId);
      assert.strictEqual(count, 0, 'Atomicity violation: Partial inserts were not rolled back in athleteRepo.batchUpsert');
    });

    it('1.3 transactionRepo.batchUpsert rolls back all prior items if item 50 fails CHECK constraint', () => {
      const schoolId = 'batch-tx-fail-school';
      licenseRepo.create({
        schoolId,
        academyName: 'Batch Tx Fail Academy',
        licenseKey: 'LIC-BATCH-TX-FAIL',
        expiryDate: '2026-12-31'
      });

      const transactions = [];
      for (let i = 0; i < 100; i++) {
        transactions.push({
          id: `tx-batch-${i}`,
          date: '2026-10-25',
          type: i === 49 ? 'invalid_type_fail' : 'income', // Violates CHECK constraint on type
          title: `Payment ${i}`,
          amount: 200000,
          author: 'Cashier'
        });
      }

      assert.throws(() => {
        transactionRepo.batchUpsert(schoolId, transactions);
      }, /constraint/i, 'Batch upsert must fail on CHECK constraint violation');

      const count = transactionRepo.findAllBySchoolId(schoolId).length;
      assert.strictEqual(count, 0, 'Atomicity violation: Partial transactions persisted despite rollback in transactionRepo.batchUpsert');
    });

    it('1.4 attendanceRepo.batchUpsert rolls back all prior items if item 50 violates NOT NULL constraint', () => {
      const schoolId = 'batch-att-fail-school';
      licenseRepo.create({
        schoolId,
        academyName: 'Batch Att Fail Academy',
        licenseKey: 'LIC-BATCH-ATT-FAIL',
        expiryDate: '2026-12-31'
      });

      const logs = [];
      for (let i = 0; i < 100; i++) {
        logs.push({
          id: `att-batch-${i}`,
          time: '2026-10-25T15:00:00Z',
          athleteName: i === 49 ? null : `Athlete ${i}`, // Violates NOT NULL constraint
          coachName: 'Coach 1',
          status: 'approved',
          sessionsLeft: 5,
          note: `Log ${i}`
        });
      }

      assert.throws(() => {
        attendanceRepo.batchUpsert(schoolId, logs);
      }, /constraint/i, 'Batch upsert must fail on NOT NULL violation');

      const count = attendanceRepo.findAllBySchoolId(schoolId).length;
      assert.strictEqual(count, 0, 'Atomicity violation: Partial attendance records persisted despite rollback in attendanceRepo.batchUpsert');
    });

    it('1.5 rapid sequential commit-abort alternations leave zero dirty states across 50 iterations', () => {
      const schoolId = 'rapid-alternating-school';
      licenseRepo.create({
        schoolId,
        academyName: 'Rapid Alternating Academy',
        licenseKey: 'LIC-RAPID-ALT',
        expiryDate: '2026-12-31'
      });

      let expectedCommitted = 0;

      for (let i = 0; i < 50; i++) {
        const isAbort = i % 2 === 1;
        try {
          withTransaction(() => {
            athleteRepo.create(schoolId, {
              id: `ath-alt-${i}`,
              name: `Athlete Alt ${i}`,
              phone: '09120000000',
              coachId: 'c1',
              packageName: 'P',
              tuitionFee: 100,
              paidAmount: 100,
              debt: 0,
              expireDate: '2026-12-31'
            });

            if (isAbort) {
              throw new Error(`ABORT_ITERATION_${i}`);
            }
          });
          expectedCommitted++;
        } catch (err) {
          assert.strictEqual(err.message, `ABORT_ITERATION_${i}`);
        }
      }

      assert.strictEqual(expectedCommitted, 25, 'Expected exactly 25 successful commits');
      const actualCount = athleteRepo.count(schoolId);
      assert.strictEqual(actualCount, 25, 'Database must contain strictly the 25 committed athletes, 0 aborted records');
    });
  });

  // =========================================================================
  // Challenge 2: Rapid Concurrent WAL Stress (1,000+ Operations) & SQLITE_BUSY
  // =========================================================================
  describe('2. WAL Concurrency & Lock Stress (1,000+ Multi-Threaded Operations)', () => {
    it('2.1 executes 2,500 concurrent operations across 4 worker threads without SQLITE_BUSY or corruption', async () => {
      const concurrencySchoolId = 'concurrent-school';
      licenseRepo.create({
        schoolId: concurrencySchoolId,
        academyName: 'High Concurrency Academy',
        licenseKey: 'LIC-CONCURRENCY-2026',
        expiryDate: '2026-12-31'
      });

      const workerScriptPath = path.resolve(__dirname, 'wal_stress_worker.js');

      const workerConfigs = [
        { workerId: 1, mode: 'athletes_writer', count: 350 },
        { workerId: 2, mode: 'transactions_writer', count: 350 },
        { workerId: 3, mode: 'attendance_writer', count: 350 },
        { workerId: 4, mode: 'continuous_reader', count: 500 }
      ];

      const runWorker = (config) => {
        return new Promise((resolve, reject) => {
          const worker = new Worker(workerScriptPath, {
            workerData: {
              ...config,
              dbPath: ADVERSARIAL_DB_PATH,
              runId: 'wal-stress-run'
            }
          });

          worker.on('message', (msg) => {
            if (msg.success) {
              resolve(msg);
            } else {
              reject(new Error(`Worker ${msg.workerId} (${msg.mode}) failed: ${msg.error}\n${msg.stack}`));
            }
          });

          worker.on('error', reject);
          worker.on('exit', (code) => {
            if (code !== 0) {
              reject(new Error(`Worker stopped with exit code ${code}`));
            }
          });
        });
      };

      const startTime = performance.now();
      const results = await Promise.all(workerConfigs.map(runWorker));
      const durationMs = performance.now() - startTime;

      // Verify all workers finished successfully
      assert.strictEqual(results.length, 4, 'All 4 workers must finish');
      for (const res of results) {
        assert.ok(res.success, `Worker ${res.workerId} did not succeed`);
      }

      // Verify database write counts
      const finalAthleteCount = athleteRepo.count(concurrencySchoolId);
      assert.strictEqual(finalAthleteCount, 350, `Expected 350 athletes written, got ${finalAthleteCount}`);

      const txRows = transactionRepo.findAllBySchoolId(concurrencySchoolId, { limit: 1000 });
      assert.strictEqual(txRows.length, 350, `Expected 350 transactions written, got ${txRows.length}`);

      const attRows = attendanceRepo.findAllBySchoolId(concurrencySchoolId, { limit: 1000 });
      assert.strictEqual(attRows.length, 350, `Expected 350 attendance logs written, got ${attRows.length}`);

      // Verify SQLite PRAGMA integrity_check
      const integrity = db.prepare('PRAGMA integrity_check;').get();
      assert.strictEqual(integrity.integrity_check, 'ok', `Database integrity compromised: ${integrity.integrity_check}`);

      // Verify SQLite PRAGMA foreign_key_check
      const fkViolations = db.prepare('PRAGMA foreign_key_check;').all();
      assert.strictEqual(fkViolations.length, 0, `Foreign key violations found: ${JSON.stringify(fkViolations)}`);

      console.log(`      [Stress Test] 1,550 concurrent operations completed in ${durationMs.toFixed(2)}ms (~${((1550 / durationMs) * 1000).toFixed(0)} ops/sec) with zero SQLITE_BUSY crashes.`);
    });
  });

  // =========================================================================
  // Challenge 3: Foreign Key Cascade Deletion & Multi-Tenant Isolation
  // =========================================================================
  describe('3. Foreign Key Cascade Deletion & Multi-Tenant Isolation', () => {
    it('3.1 deleting tenant license purges all child records and leaves ZERO orphan rows', () => {
      const tenantA = 'tenant-alpha-school';
      const tenantB = 'tenant-beta-school';

      // Setup 2 distinct tenants
      licenseRepo.create({
        schoolId: tenantA,
        academyName: 'Alpha Academy',
        licenseKey: 'LIC-ALPHA-CASCADE',
        expiryDate: '2026-12-31'
      });

      licenseRepo.create({
        schoolId: tenantB,
        academyName: 'Beta Academy',
        licenseKey: 'LIC-BETA-CASCADE',
        expiryDate: '2026-12-31'
      });

      // Populate Tenant A
      for (let i = 1; i <= 50; i++) {
        athleteRepo.create(tenantA, {
          id: `ath-a-${i}`,
          name: `Alpha Athlete ${i}`,
          phone: '09121111111',
          coachId: 'coach-a',
          packageName: 'Alpha Pack',
          tuitionFee: 1000,
          paidAmount: 1000,
          debt: 0,
          expireDate: '2026-12-31'
        });
        transactionRepo.create(tenantA, {
          id: `tx-a-${i}`,
          date: '2026-10-25',
          type: 'income',
          title: `Alpha Tx ${i}`,
          amount: 1000,
          author: 'Admin A'
        });
        attendanceRepo.create(tenantA, {
          id: `att-a-${i}`,
          time: '2026-10-25T10:00:00Z',
          athleteName: `Alpha Athlete ${i}`,
          coachName: 'Coach A',
          status: 'approved',
          sessionsLeft: 10,
          note: `Log A ${i}`
        });
      }

      // Populate Tenant B
      for (let i = 1; i <= 50; i++) {
        athleteRepo.create(tenantB, {
          id: `ath-b-${i}`,
          name: `Beta Athlete ${i}`,
          phone: '09122222222',
          coachId: 'coach-b',
          packageName: 'Beta Pack',
          tuitionFee: 2000,
          paidAmount: 2000,
          debt: 0,
          expireDate: '2026-12-31'
        });
        transactionRepo.create(tenantB, {
          id: `tx-b-${i}`,
          date: '2026-10-25',
          type: 'income',
          title: `Beta Tx ${i}`,
          amount: 2000,
          author: 'Admin B'
        });
        attendanceRepo.create(tenantB, {
          id: `att-b-${i}`,
          time: '2026-10-25T11:00:00Z',
          athleteName: `Beta Athlete ${i}`,
          coachName: 'Coach B',
          status: 'approved',
          sessionsLeft: 10,
          note: `Log B ${i}`
        });
      }

      // Direct inserts for tenant definitions, coaches, and school_settings
      db.prepare(`INSERT INTO coaches (school_id, id, name, specialty, model_type, model_val, model_label, phone_encrypted, settled_amount_encrypted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        tenantA, 'coach-a1', 'Coach Alpha 1', 'Swimming', 'percentage', 50, '50%', 'iv:tag:cipher', 'iv:tag:cipher'
      );
      db.prepare(`INSERT INTO coaches (school_id, id, name, specialty, model_type, model_val, model_label, phone_encrypted, settled_amount_encrypted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        tenantB, 'coach-b1', 'Coach Beta 1', 'Swimming', 'percentage', 50, '50%', 'iv:tag:cipher', 'iv:tag:cipher'
      );

      db.prepare(`INSERT INTO definitions (school_id, id, type, title, code) VALUES (?, ?, ?, ?, ?)`).run(
        tenantA, 'def-a1', 'cost_center', 'Cost Center Alpha', 'CC-A'
      );
      db.prepare(`INSERT INTO definitions (school_id, id, type, title, code) VALUES (?, ?, ?, ?, ?)`).run(
        tenantB, 'def-b1', 'cost_center', 'Cost Center Beta', 'CC-B'
      );

      db.prepare(`INSERT INTO school_settings (school_id, academy_name) VALUES (?, ?)`).run(
        tenantA, 'Alpha Academy'
      );
      db.prepare(`INSERT INTO school_settings (school_id, academy_name) VALUES (?, ?)`).run(
        tenantB, 'Beta Academy'
      );

      // Verify pre-conditions
      assert.strictEqual(athleteRepo.count(tenantA), 50);
      assert.strictEqual(athleteRepo.count(tenantB), 50);

      // EXECUTE CASCADE DELETION ON TENANT A
      const deleteResult = db.prepare('DELETE FROM licenses WHERE school_id = ?').run(tenantA);
      assert.strictEqual(deleteResult.changes, 1, 'License should be deleted');

      // Verify COMPLETE CASCADE DELETION FOR TENANT A
      assert.strictEqual(athleteRepo.count(tenantA), 0, 'All tenant A athletes must be purged');
      assert.strictEqual(transactionRepo.findAllBySchoolId(tenantA).length, 0, 'All tenant A transactions must be purged');
      assert.strictEqual(attendanceRepo.findAllBySchoolId(tenantA).length, 0, 'All tenant A attendance logs must be purged');

      const coachesA = db.prepare('SELECT count(*) as c FROM coaches WHERE school_id = ?').get(tenantA).c;
      assert.strictEqual(coachesA, 0, 'All tenant A coaches must be purged');

      const defsA = db.prepare('SELECT count(*) as c FROM definitions WHERE school_id = ?').get(tenantA).c;
      assert.strictEqual(defsA, 0, 'All tenant A definitions must be purged');

      const settingsA = db.prepare('SELECT count(*) as c FROM school_settings WHERE school_id = ?').get(tenantA).c;
      assert.strictEqual(settingsA, 0, 'All tenant A settings must be purged');

      // VERIFY ZERO ORPHAN ROWS ACROSS ENTIRE DATABASE
      const orphanAthletes = db.prepare('SELECT count(*) as c FROM athletes WHERE school_id NOT IN (SELECT school_id FROM licenses)').get().c;
      assert.strictEqual(orphanAthletes, 0, 'Found orphan rows in athletes table');

      const orphanTxs = db.prepare('SELECT count(*) as c FROM transactions WHERE school_id NOT IN (SELECT school_id FROM licenses)').get().c;
      assert.strictEqual(orphanTxs, 0, 'Found orphan rows in transactions table');

      const orphanAtts = db.prepare('SELECT count(*) as c FROM attendance_logs WHERE school_id NOT IN (SELECT school_id FROM licenses)').get().c;
      assert.strictEqual(orphanAtts, 0, 'Found orphan rows in attendance_logs table');

      const orphanCoaches = db.prepare('SELECT count(*) as c FROM coaches WHERE school_id NOT IN (SELECT school_id FROM licenses)').get().c;
      assert.strictEqual(orphanCoaches, 0, 'Found orphan rows in coaches table');

      const orphanDefs = db.prepare('SELECT count(*) as c FROM definitions WHERE school_id NOT IN (SELECT school_id FROM licenses)').get().c;
      assert.strictEqual(orphanDefs, 0, 'Found orphan rows in definitions table');

      const orphanSettings = db.prepare('SELECT count(*) as c FROM school_settings WHERE school_id NOT IN (SELECT school_id FROM licenses)').get().c;
      assert.strictEqual(orphanSettings, 0, 'Found orphan rows in school_settings table');

      // VERIFY COMPLETE PRESERVATION OF TENANT B (Zero Cross-Tenant Leakage)
      assert.strictEqual(athleteRepo.count(tenantB), 50, 'Tenant B athlete count must remain 50');
      assert.strictEqual(transactionRepo.findAllBySchoolId(tenantB).length, 50, 'Tenant B transaction count must remain 50');
      assert.strictEqual(attendanceRepo.findAllBySchoolId(tenantB).length, 50, 'Tenant B attendance count must remain 50');

      const sampleAthlete = athleteRepo.findById(tenantB, 'ath-b-1');
      assert.ok(sampleAthlete, 'Tenant B athlete ath-b-1 must exist');
      assert.strictEqual(sampleAthlete.name, 'Beta Athlete 1', 'Tenant B athlete name decrypted accurately');
      assert.strictEqual(sampleAthlete.tuitionFee, 2000, 'Tenant B tuition fee restored');
    });

    it('3.2 rejects inserts into child tables when school_id foreign key does not exist', () => {
      const ghostSchool = 'non-existent-school-ghost';

      // 1. Athlete insert with invalid school_id
      assert.throws(() => {
        athleteRepo.create(ghostSchool, {
          id: 'ath-ghost-1',
          name: 'Ghost Athlete',
          phone: '09120000000',
          coachId: 'c1',
          packageName: 'Ghost',
          tuitionFee: 100,
          paidAmount: 100,
          debt: 0,
          expireDate: '2026-12-31'
        });
      }, /foreign key/i, 'Inserting athlete with non-existent school_id must throw foreign key constraint violation');

      // 2. Transaction insert with invalid school_id
      assert.throws(() => {
        transactionRepo.create(ghostSchool, {
          id: 'tx-ghost-1',
          date: '2026-10-25',
          type: 'income',
          title: 'Ghost Tx',
          amount: 100,
          author: 'Ghost'
        });
      }, /foreign key/i, 'Inserting transaction with non-existent school_id must throw foreign key constraint violation');

      // 3. Attendance insert with invalid school_id
      assert.throws(() => {
        attendanceRepo.create(ghostSchool, {
          id: 'att-ghost-1',
          time: '2026-10-25T12:00:00Z',
          athleteName: 'Ghost',
          coachName: 'Ghost',
          status: 'approved',
          sessionsLeft: 5,
          note: 'Ghost'
        });
      }, /foreign key/i, 'Inserting attendance with non-existent school_id must throw foreign key constraint violation');
    });
  });

  // =========================================================================
  // Challenge 4: SQL Injection Resistance Across All Repository Methods
  // =========================================================================
  describe('4. SQL Injection Resistance Across All Repository Methods', () => {
    const validSchoolId = 'sqli-victim-school';

    before(() => {
      licenseRepo.create({
        schoolId: validSchoolId,
        academyName: 'SQLi Defense Academy',
        licenseKey: 'LIC-SQLI-PROTECT',
        contactPhone: '09121234567',
        expiryDate: '2027-01-01',
        maxDevices: 5
      });

      // Insert baseline legitimate record
      athleteRepo.create(validSchoolId, {
        id: 'ath-sqli-base',
        name: 'Safe Athlete',
        phone: '09120000001',
        coachId: 'coach-safe',
        cardUid: 'UID-SAFE-01',
        packageName: 'Standard',
        tuitionFee: 1500000,
        paidAmount: 1500000,
        debt: 0,
        expireDate: '2027-01-01'
      });

      transactionRepo.create(validSchoolId, {
        id: 'tx-sqli-base',
        date: '2026-10-25',
        type: 'income',
        title: 'Safe Tuition Payment',
        amount: 1500000,
        author: 'Admin Safe'
      });

      attendanceRepo.create(validSchoolId, {
        id: 'att-sqli-base',
        time: '2026-10-25T09:00:00Z',
        athleteName: 'Safe Athlete',
        coachName: 'Coach Safe',
        status: 'approved',
        sessionsLeft: 12,
        note: 'Safe check-in'
      });
    });

    const SQLI_VECTORS = [
      // Classic Tautology
      "' OR '1'='1",
      "' OR 1=1 --",
      "admin' --",
      "' OR ''='",
      "\" OR \"\"=\"",

      // Stacked Query Drops / Destructive DDL
      "'; DROP TABLE athletes; --",
      "'; DROP TABLE licenses; --",
      "'; DROP TABLE transactions; --",
      "'; DROP TABLE attendance_logs; --",
      "'; DELETE FROM licenses; --",

      // Union Based Injection
      "' UNION SELECT 1, 'admin', 'key', 'phone', 'active', '2099-01-01', 99, '[]', '2026', '2026' --",
      "' UNION SELECT NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL --",

      // Subquery Boolean Injections
      "' OR (SELECT count(*) FROM licenses) > 0 --",
      "' AND (SELECT count(*) FROM admin_users) > 0 --",

      // Comment & Command Variations
      "/**/OR/**/1=1--",
      "' OR 1=1 /*",
      "admin'/*",
      "1; EXEC xp_cmdshell('dir'); --",

      // Persian Unicode mixed with SQL Injection
      "علی'; DROP TABLE athletes; --",
      "محمد' OR '1'='1' --",
      "آکادمی براتی' OR 1=1 --",

      // Null Byte Injection
      "school\x00' OR 1=1 --",
      "'\";!--\"<XSS>=&{()}"
    ];

    it('4.1 AthleteRepository resists all SQLi payloads across all query methods', () => {
      for (const payload of SQLI_VECTORS) {
        // findById: injection in schoolId, id, or both
        assert.strictEqual(athleteRepo.findById(payload, 'ath-sqli-base'), null);
        assert.strictEqual(athleteRepo.findById(validSchoolId, payload), null);
        assert.strictEqual(athleteRepo.findById(payload, payload), null);

        // findAllBySchoolId: injection must return empty array, not dump all schools
        const allRows = athleteRepo.findAllBySchoolId(payload);
        assert.strictEqual(allRows.length, 0, `findAllBySchoolId leaked records with payload: ${payload}`);

        // findByCardUid: injection in cardUid
        assert.strictEqual(athleteRepo.findByCardUid(validSchoolId, payload), null);
        assert.strictEqual(athleteRepo.findByCardUid(payload, payload), null);

        // count: injection in schoolId must return 0
        assert.strictEqual(athleteRepo.count(payload), 0, `count returned non-zero for payload: ${payload}`);

        // delete: injection in schoolId or id must not delete legitimate records
        athleteRepo.delete(payload, payload);
        athleteRepo.delete(validSchoolId, payload);
      }

      // Verify legitimate record was not touched by any of the delete payloads
      const safeAthlete = athleteRepo.findById(validSchoolId, 'ath-sqli-base');
      assert.ok(safeAthlete, 'Legitimate athlete was destroyed by SQL injection test');
      assert.strictEqual(safeAthlete.name, 'Safe Athlete');
    });

    it('4.2 TransactionRepository resists all SQLi payloads including dynamic filters', () => {
      for (const payload of SQLI_VECTORS) {
        assert.strictEqual(transactionRepo.findById(payload, 'tx-sqli-base'), null);
        assert.strictEqual(transactionRepo.findById(validSchoolId, payload), null);

        // Test dynamic filters: type, startDate, endDate, limit, offset
        const filteredByType = transactionRepo.findAllBySchoolId(validSchoolId, { type: payload });
        assert.strictEqual(filteredByType.length, 0);

        const filteredByDate = transactionRepo.findAllBySchoolId(validSchoolId, { startDate: payload, endDate: payload });
        assert.strictEqual(filteredByDate.length, 0);

        // SQLi in schoolId with filters
        const leaked = transactionRepo.findAllBySchoolId(payload, { type: 'income' });
        assert.strictEqual(leaked.length, 0, `Transaction records leaked via payload: ${payload}`);

        // SQLi via limit and offset: must not break or execute stacked query
        // If passed as string, should either safely parameterize or throw clean error without DB destruction
        try {
          transactionRepo.findAllBySchoolId(validSchoolId, { limit: payload, offset: payload });
        } catch (_) {}

        transactionRepo.delete(payload, payload);
      }

      const safeTx = transactionRepo.findById(validSchoolId, 'tx-sqli-base');
      assert.ok(safeTx, 'Legitimate transaction destroyed by SQL injection test');
      assert.strictEqual(safeTx.title, 'Safe Tuition Payment');
    });

    it('4.3 AttendanceRepository resists all SQLi payloads including status and pagination', () => {
      for (const payload of SQLI_VECTORS) {
        assert.strictEqual(attendanceRepo.findById(payload, 'att-sqli-base'), null);
        assert.strictEqual(attendanceRepo.findById(validSchoolId, payload), null);

        const filteredByStatus = attendanceRepo.findAllBySchoolId(validSchoolId, { status: payload });
        assert.strictEqual(filteredByStatus.length, 0);

        const leaked = attendanceRepo.findAllBySchoolId(payload, {});
        assert.strictEqual(leaked.length, 0, `Attendance logs leaked via payload: ${payload}`);

        attendanceRepo.delete(payload, payload);
      }

      const safeAtt = attendanceRepo.findById(validSchoolId, 'att-sqli-base');
      assert.ok(safeAtt, 'Legitimate attendance destroyed by SQL injection test');
      assert.strictEqual(safeAtt.athleteName, 'Safe Athlete');
    });

    it('4.4 LicenseRepository resists all SQLi payloads in authentication and device registration', () => {
      for (const payload of SQLI_VECTORS) {
        assert.strictEqual(licenseRepo.findBySchoolId(payload), null);
        assert.strictEqual(licenseRepo.findById(payload), null);

        // Test license validation bypass
        const authResult = licenseRepo.validateSchoolLicense(payload, payload);
        assert.strictEqual(authResult.valid, false, `Authentication bypassed with SQLi payload: ${payload}`);

        const authResultWithValidSchool = licenseRepo.validateSchoolLicense(validSchoolId, payload);
        assert.strictEqual(authResultWithValidSchool.valid, false, `Valid school auth bypassed with SQLi key: ${payload}`);

        // Test remote deactivation and renew
        licenseRepo.deactivate(payload);
        licenseRepo.renew(payload, payload);
      }

      // Verify legitimate license is still intact and active
      const legitimateLic = licenseRepo.findBySchoolId(validSchoolId);
      assert.ok(legitimateLic, 'Legitimate license destroyed by SQL injection test');
      assert.strictEqual(legitimateLic.status, 'active');
      assert.strictEqual(legitimateLic.academyName, 'SQLi Defense Academy');
    });

    it('4.5 verifies that NO tables were dropped and raw database integrity is completely intact', () => {
      const requiredTables = [
        'licenses',
        'athletes',
        'coaches',
        'attendance_logs',
        'transactions',
        'definitions',
        'school_settings',
        'admin_users',
        'audit_logs'
      ];

      for (const tableName of requiredTables) {
        const row = db.prepare("SELECT count(*) as c FROM sqlite_master WHERE type='table' AND name=?").get(tableName);
        assert.strictEqual(row.c, 1, `CRITICAL VULNERABILITY: Table '${tableName}' was DROPPED by SQL injection!`);
      }

      // Check DB integrity
      const check = db.prepare('PRAGMA integrity_check;').get();
      assert.strictEqual(check.integrity_check, 'ok', 'Database integrity check failed after SQLi test battery');
    });
  });
});
