/**
 * Adversarial Verification Suite: Sync API Stress & Fault Tolerance
 * Barati Swimming Academy Cloud Backend
 *
 * Covers:
 * 1. Large Payload Synchronization (1,000+ athletes & transactions) - Performance & Memory Leaks
 * 2. Corrupted, Truncated & Malformed Payload Items - Atomic Transaction Rollback (Zero Partial Commits)
 * 3. Rapid Burst Synchronization (50 Concurrent Requests) - SQLite WAL Concurrency & Rate Limiting
 * 4. Decrypted Output Fidelity & Physical Disk Ciphertext Persistence
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { app } from '../src/app.js';
import { initDatabase, closeDatabase, getDatabase } from '../src/db/database.js';
import { licenseRepo } from '../src/db/repositories/licenseRepo.js';
import { athleteRepo } from '../src/db/repositories/athleteRepo.js';
import { transactionRepo } from '../src/db/repositories/transactionRepo.js';

const CIPHER_REGEX = /^[0-9a-fA-F]{24}:[0-9a-fA-F]{32}:[0-9a-fA-F]+$/;

describe('Adversarial Verification: Sync API Stress, Atomicity & Concurrency', () => {
  const testDbPath = path.resolve(process.cwd(), 'data', 'test_adversarial_sync.db');
  let server;
  let baseUrl;
  let db;

  const STRESS_SCHOOL_ID = 'barati-stress-pool';
  const STRESS_LICENSE_KEY = 'LIC-STRESS-2026-KEY';
  const ROLLBACK_SCHOOL_ID = 'barati-rollback-pool';
  const ROLLBACK_LICENSE_KEY = 'LIC-ROLLBACK-2026-KEY';
  const BURST_SCHOOL_ID = 'barati-burst-pool';
  const BURST_LICENSE_KEY = 'LIC-BURST-2026-KEY';
  const FIDELITY_SCHOOL_ID = 'barati-fidelity-pool';
  const FIDELITY_LICENSE_KEY = 'LIC-FIDELITY-2026-KEY';
  const RATELIMIT_SCHOOL_ID = 'barati-ratelimit-pool';
  const RATELIMIT_LICENSE_KEY = 'LIC-RATELIMIT-2026-KEY';

  before(async () => {
    // 1. Clean previous DB artifacts
    closeDatabase();
    try { fs.unlinkSync(testDbPath); } catch {}
    try { fs.unlinkSync(testDbPath + '-wal'); } catch {}
    try { fs.unlinkSync(testDbPath + '-shm'); } catch {}

    // 2. Initialize isolated test database
    db = initDatabase(testDbPath);

    // 3. Register test licenses with high device limits
    licenseRepo.create({
      schoolId: STRESS_SCHOOL_ID,
      academyName: 'استخر استرس و بار کاری بالا',
      licenseKey: STRESS_LICENSE_KEY,
      contactPhone: '09120000001',
      expiryDate: '2029-12-31T23:59:59Z',
      maxDevices: 100
    });

    licenseRepo.create({
      schoolId: ROLLBACK_SCHOOL_ID,
      academyName: 'استخر بررسی رول‌بک اتمیک',
      licenseKey: ROLLBACK_LICENSE_KEY,
      contactPhone: '09120000002',
      expiryDate: '2029-12-31T23:59:59Z',
      maxDevices: 100
    });

    licenseRepo.create({
      schoolId: BURST_SCHOOL_ID,
      academyName: 'استخر بررسی همزمانی شدید',
      licenseKey: BURST_LICENSE_KEY,
      contactPhone: '09120000003',
      expiryDate: '2029-12-31T23:59:59Z',
      maxDevices: 100
    });

    licenseRepo.create({
      schoolId: FIDELITY_SCHOOL_ID,
      academyName: 'استخر بررسی صحت یونی‌کد و رمزنگاری',
      licenseKey: FIDELITY_LICENSE_KEY,
      contactPhone: '09120000004',
      expiryDate: '2029-12-31T23:59:59Z',
      maxDevices: 100
    });

    licenseRepo.create({
      schoolId: RATELIMIT_SCHOOL_ID,
      academyName: 'استخر تست محدودیت نرخ',
      licenseKey: RATELIMIT_LICENSE_KEY,
      contactPhone: '09120000005',
      expiryDate: '2029-12-31T23:59:59Z',
      maxDevices: 100
    });

    // 4. Start HTTP test server on ephemeral port
    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    closeDatabase();
    try { fs.unlinkSync(testDbPath); } catch {}
    try { fs.unlinkSync(testDbPath + '-wal'); } catch {}
    try { fs.unlinkSync(testDbPath + '-shm'); } catch {}
  });

  // ==========================================================================
  // Suite 1: Large Payload Synchronization (1,000+ Items) & Memory Stability
  // ==========================================================================
  describe('1. Large Payload Synchronization (1,000+ Items) & Memory Leak Defense', () => {
    it('1.1 Synchronizes 1,000 athletes, 1,000 transactions, 1,000 attendance logs, and 200 definitions in a single atomic batch', async () => {
      const TOTAL_ITEMS = 1000;
      const athletes = [];
      const transactions = [];
      const attendanceLogs = [];
      const definitions = [];

      for (let i = 1; i <= TOTAL_ITEMS; i++) {
        athletes.push({
          id: `ath-bulk-${i}`,
          name: `شناگر رده قهرمانی شماره ${i}`,
          phone: `0912${String(i).padStart(7, '0')}`,
          coachId: `coach-${i % 10}`,
          cardUid: `RFID-BULK-${i}`,
          packageName: `پکیج پیشرفته ${i % 3 === 0 ? 'شنا' : 'واترپلو'}`,
          totalSessions: 24,
          remainingSessions: 20,
          totalAttended: 4,
          tuitionFee: 4500000 + i * 100,
          paidAmount: 4000000,
          debt: 500000 + i * 100,
          expireDate: '2027-06-30'
        });

        transactions.push({
          id: `tx-bulk-${i}`,
          date: '2026-10-25T10:00:00Z',
          type: i % 3 === 0 ? 'expense' : (i % 5 === 0 ? 'coach_payout' : 'income'),
          title: `تراکنش مالی آزمایشی شماره ${i}`,
          amount: 1500000 + i * 50,
          method: 'pos',
          author: 'حسابدار ارشد'
        });

        attendanceLogs.push({
          id: `att-bulk-${i}`,
          time: '2026-10-25T11:00:00Z',
          athleteName: `شناگر رده قهرمانی شماره ${i}`,
          coachName: 'استاد علی براتی',
          status: 'approved',
          sessionsLeft: 20,
          note: `تردد گیت هوشمند سالن اصلی ${i}`
        });

        if (i <= 200) {
          definitions.push({
            id: `def-bulk-${i}`,
            type: i % 2 === 0 ? 'cost_center' : 'goods_item',
            title: `مرکز هزینه / کالا شماره ${i}`,
            code: `CODE-${i}`,
            price: 50000 + i * 1000,
            sessions: 10
          });
        }
      }

      const memBefore = process.memoryUsage().heapUsed;
      const startTime = Date.now();

      const res = await fetch(`${baseUrl}/api/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': '10.10.1.1'
        },
        body: JSON.stringify({
          schoolId: STRESS_SCHOOL_ID,
          licenseKey: STRESS_LICENSE_KEY,
          deviceInfo: { deviceId: 'stress-device-01', deviceModel: 'Server Stress Harness' },
          athletes,
          transactions,
          attendanceLogs,
          definitions
        })
      });

      const durationMs = Date.now() - startTime;
      const memAfter = process.memoryUsage().heapUsed;
      const heapDeltaMb = (memAfter - memBefore) / (1024 * 1024);

      assert.strictEqual(res.status, 200, `Expected HTTP 200, got ${res.status}`);
      const body = await res.json();
      assert.strictEqual(body.status, 'success');
      assert.strictEqual(body.synced.athletesCount, 1000);
      assert.strictEqual(body.synced.transactionsCount, 1000);
      assert.strictEqual(body.synced.attendanceCount, 1000);
      assert.strictEqual(body.synced.definitionsCount, 200);

      // Verify physical SQLite table counts
      const athleteCount = db.prepare('SELECT count(*) as count FROM athletes WHERE school_id = ?').get(STRESS_SCHOOL_ID).count;
      const txCount = db.prepare('SELECT count(*) as count FROM transactions WHERE school_id = ?').get(STRESS_SCHOOL_ID).count;
      const attCount = db.prepare('SELECT count(*) as count FROM attendance_logs WHERE school_id = ?').get(STRESS_SCHOOL_ID).count;
      const defCount = db.prepare('SELECT count(*) as count FROM definitions WHERE school_id = ?').get(STRESS_SCHOOL_ID).count;

      assert.strictEqual(athleteCount, 1000, 'All 1,000 athletes must be persisted');
      assert.strictEqual(txCount, 1000, 'All 1,000 transactions must be persisted');
      assert.strictEqual(attCount, 1000, 'All 1,000 attendance records must be persisted');
      assert.strictEqual(defCount, 200, 'All 200 definitions must be persisted');

      // Performance assertion: 3,200 entities (with 11,000 AES encryptions) must complete in reasonable time (< 15,000ms)
      assert.ok(durationMs < 15000, `Execution time (${durationMs}ms) exceeded acceptable threshold`);
      // Memory assertion: Heap increase must be bounded (< 150MB)
      assert.ok(heapDeltaMb < 150, `Heap bloat (${heapDeltaMb.toFixed(2)}MB) too high`);
    });

    it('1.2 Querying large datasets via REST retrieves and transparently decrypts records correctly', async () => {
      // 1. Fetch athletes
      const resAthletes = await fetch(`${baseUrl}/api/v1/athletes?schoolId=${STRESS_SCHOOL_ID}`, {
        headers: {
          'Authorization': `Bearer ${STRESS_LICENSE_KEY}`,
          'X-Forwarded-For': '10.10.1.2'
        }
      });
      assert.strictEqual(resAthletes.status, 200);
      const athletes = await resAthletes.json();
      assert.strictEqual(athletes.length, 1000);

      // Verify arbitrary athlete decrypted correctly
      const sample = athletes.find(a => a.id === 'ath-bulk-500');
      assert.ok(sample);
      assert.strictEqual(sample.name, 'شناگر رده قهرمانی شماره 500');
      assert.strictEqual(sample.phone, '09120000500');
      assert.strictEqual(sample.tuitionFee, 4550000);
      assert.strictEqual(typeof sample.tuitionFee, 'number');
      assert.strictEqual(sample.paidAmount, 4000000);
      assert.strictEqual(typeof sample.paidAmount, 'number');

      // 2. Fetch transactions with pagination limit = 1000
      const resTx = await fetch(`${baseUrl}/api/v1/transactions?schoolId=${STRESS_SCHOOL_ID}&limit=1000`, {
        headers: {
          'Authorization': `Bearer ${STRESS_LICENSE_KEY}`,
          'X-Forwarded-For': '10.10.1.3'
        }
      });
      assert.strictEqual(resTx.status, 200);
      const txs = await resTx.json();
      assert.strictEqual(txs.length, 1000);
      const sampleTx = txs.find(t => t.id === 'tx-bulk-500');
      assert.ok(sampleTx);
      assert.strictEqual(sampleTx.title, 'تراکنش مالی آزمایشی شماره 500');
      assert.strictEqual(sampleTx.amount, 1525000);
      assert.strictEqual(typeof sampleTx.amount, 'number');
    });

    it('1.3 Memory stability across 3 consecutive large sync batches demonstrates no memory leaks', async () => {
      const heaps = [];

      for (let run = 1; run <= 3; run++) {
        const batch = [];
        for (let i = 1; i <= 300; i++) {
          batch.push({
            id: `ath-leak-test-${run}-${i}`,
            name: `ورزشکار تست حافظه ${run}-${i}`,
            phone: `0912999${String(i).padStart(4, '0')}`,
            coachId: 'coach-mem',
            cardUid: `RFID-MEM-${run}-${i}`,
            packageName: 'پکیج حافظه',
            totalSessions: 12,
            remainingSessions: 10,
            totalAttended: 2,
            tuitionFee: 1000000,
            paidAmount: 1000000,
            debt: 0,
            expireDate: '2027-01-01'
          });
        }

        const res = await fetch(`${baseUrl}/api/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Forwarded-For': `10.10.2.${run}`
          },
          body: JSON.stringify({
            schoolId: STRESS_SCHOOL_ID,
            licenseKey: STRESS_LICENSE_KEY,
            deviceInfo: { deviceId: `mem-dev-${run}` },
            athletes: batch
          })
        });

        assert.strictEqual(res.status, 200);
        heaps.push(process.memoryUsage().heapUsed);
      }

      // Ensure heap growth between run 1 and run 3 is not growing without bound
      const growthMb = (heaps[2] - heaps[0]) / (1024 * 1024);
      assert.ok(growthMb < 80, `Excessive heap retention (${growthMb.toFixed(2)}MB) indicates potential memory leak`);
    });
  });

  // ==========================================================================
  // Suite 2: Corrupted, Truncated & Malformed Payload Items - Atomic Rollback
  // ==========================================================================
  describe('2. Malformed Items, Truncated Payloads & Atomic Transaction Rollback', () => {
    it('2.1 Multi-table batch with downstream SQLite constraint failure rolls back ALL changes (ZERO partial commits)', async () => {
      // Setup payload with:
      // - 100 valid athletes
      // - 100 valid attendance logs
      // - 50 valid transactions
      // - 1 INVALID definition that violates SQLite CHECK constraint: type IN ('cost_center', 'goods_item', 'course_type')
      const athletes = [];
      const attendanceLogs = [];
      const transactions = [];

      for (let i = 1; i <= 100; i++) {
        athletes.push({
          id: `ath-atomic-${i}`,
          name: `ورزشکار اتمیک ${i}`,
          phone: `0912888${String(i).padStart(4, '0')}`,
          coachId: 'coach-atomic',
          packageName: 'دوره اتمیک',
          tuitionFee: 2000000,
          paidAmount: 2000000,
          debt: 0
        });

        attendanceLogs.push({
          id: `att-atomic-${i}`,
          time: '2026-10-25T09:00:00Z',
          athleteName: `ورزشکار اتمیک ${i}`,
          coachName: 'مربی اتمیک',
          status: 'present'
        });

        if (i <= 50) {
          transactions.push({
            id: `tx-atomic-${i}`,
            date: '2026-10-25T08:00:00Z',
            type: 'income',
            title: `تراکنش معتبر ${i}`,
            amount: 2000000,
            method: 'cash'
          });
        }
      }

      // Definition with invalid type (passes schema regex if string, but FAILS SQLite CHECK constraint)
      const definitions = [
        {
          id: 'def-atomic-invalid',
          type: 'UNAUTHORIZED_CHECK_TYPE', // Violates CHECK (type IN ('cost_center', 'goods_item', 'course_type'))
          title: 'تعریف با نوع نامعتبر دیتابیس',
          code: 'BAD-CODE'
        }
      ];

      // Dispatch request to sync endpoint
      const res = await fetch(`${baseUrl}/api/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': '10.20.1.1'
        },
        body: JSON.stringify({
          schoolId: ROLLBACK_SCHOOL_ID,
          licenseKey: ROLLBACK_LICENSE_KEY,
          deviceInfo: { deviceId: 'rollback-dev-01' },
          athletes,
          attendanceLogs,
          transactions,
          definitions
        })
      });

      // Request must fail (HTTP 500 / 400 from database constraint exception)
      assert.ok(res.status >= 400, `Expected HTTP 4xx/5xx error, got ${res.status}`);

      // EMPIRICAL ATOMICTY CHECK:
      // Verify that ZERO records were committed across ALL tables for this school!
      const committedAthletes = db.prepare('SELECT count(*) as c FROM athletes WHERE school_id = ?').get(ROLLBACK_SCHOOL_ID).c;
      const committedAttendance = db.prepare('SELECT count(*) as c FROM attendance_logs WHERE school_id = ?').get(ROLLBACK_SCHOOL_ID).c;
      const committedTransactions = db.prepare('SELECT count(*) as c FROM transactions WHERE school_id = ?').get(ROLLBACK_SCHOOL_ID).c;
      const committedDefinitions = db.prepare('SELECT count(*) as c FROM definitions WHERE school_id = ?').get(ROLLBACK_SCHOOL_ID).c;

      assert.strictEqual(committedAthletes, 0, 'ZERO athletes must be committed after rollback');
      assert.strictEqual(committedAttendance, 0, 'ZERO attendance logs must be committed after rollback');
      assert.strictEqual(committedTransactions, 0, 'ZERO transactions must be committed after rollback');
      assert.strictEqual(committedDefinitions, 0, 'ZERO definitions must be committed after rollback');
    });

    it('2.2 Batch rollback when transaction violates SQLite NOT NULL constraint preserves zero partial commits', async () => {
      // 50 valid athletes, 1 transaction with NULL type violating SQLite NOT NULL
      const athletes = [];
      for (let i = 1; i <= 50; i++) {
        athletes.push({
          id: `ath-tx-fail-${i}`,
          name: `ورزشکار ${i}`,
          phone: `0911000${String(i).padStart(4, '0')}`,
          packageName: 'شنا'
        });
      }

      // Valid structure for validator, but missing type or null type
      const transactions = [
        {
          id: 'tx-fail-01',
          date: '2026-10-25T12:00:00Z',
          // type is deliberately null, violating transactions.type NOT NULL
          type: null,
          title: 'تراکنش با نوع تهی',
          amount: 500000
        }
      ];

      const res = await fetch(`${baseUrl}/api/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': '10.20.1.2'
        },
        body: JSON.stringify({
          schoolId: ROLLBACK_SCHOOL_ID,
          licenseKey: ROLLBACK_LICENSE_KEY,
          deviceInfo: { deviceId: 'rollback-dev-02' },
          athletes,
          transactions
        })
      });

      assert.ok(res.status >= 400, `Expected error status, got ${res.status}`);

      // Verify zero athletes were committed
      const committedAthletes = db.prepare('SELECT count(*) as c FROM athletes WHERE school_id = ?').get(ROLLBACK_SCHOOL_ID).c;
      assert.strictEqual(committedAthletes, 0, 'ZERO athletes must be committed when subsequent transaction fails');
    });

    it('2.3 Truncated and malformed JSON body returns HTTP 400 with clean error JSON and 0 database writes', async () => {
      const truncatedJson = '{"schoolId":"' + ROLLBACK_SCHOOL_ID + '","licenseKey":"' + ROLLBACK_LICENSE_KEY + '","athletes":[{"id":"ath-trunc","name":"نام ناتمام';

      const res = await fetch(`${baseUrl}/api/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': '10.20.1.3'
        },
        body: truncatedJson
      });

      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.strictEqual(json.error, 'MALFORMED_JSON');
      assert.ok(!json.stack, 'Stack traces must not leak in error response');

      const count = db.prepare('SELECT count(*) as c FROM athletes WHERE school_id = ?').get(ROLLBACK_SCHOOL_ID).c;
      assert.strictEqual(count, 0);
    });

    it('2.4 Validation schema rejection on malformed item fields returns HTTP 400 and commits nothing', async () => {
      const res = await fetch(`${baseUrl}/api/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': '10.20.1.4'
        },
        body: JSON.stringify({
          schoolId: ROLLBACK_SCHOOL_ID,
          licenseKey: ROLLBACK_LICENSE_KEY,
          deviceInfo: { deviceId: 'rollback-dev-04' },
          athletes: [
            {
              id: 'ath-bad-01',
              // Missing required name and phone
              coachId: 'coach-01'
            }
          ]
        })
      });

      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.strictEqual(json.error, 'VALIDATION_FAILED');
      assert.ok(Array.isArray(json.details));
      assert.ok(json.details.some(d => d.field.includes('name')));

      const count = db.prepare('SELECT count(*) as c FROM athletes WHERE school_id = ?').get(ROLLBACK_SCHOOL_ID).c;
      assert.strictEqual(count, 0);
    });

    it('2.5 Prototype pollution payloads are blocked with HTTP 400 SECURITY_VIOLATION', async () => {
      const payload = JSON.parse('{"schoolId":"' + ROLLBACK_SCHOOL_ID + '","licenseKey":"' + ROLLBACK_LICENSE_KEY + '","deviceInfo":{"deviceId":"p-dev"},"__proto__":{"polluted":true}}');

      const res = await fetch(`${baseUrl}/api/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': '10.20.1.5'
        },
        body: JSON.stringify(payload)
      });

      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.strictEqual(json.error, 'SECURITY_VIOLATION');
      assert.strictEqual(({}).polluted, undefined, 'Object prototype must remain clean');
    });

    it('2.6 Tampered ciphertext in database row triggers CryptoAuthError (zero plaintext leakage)', async () => {
      // 1. Insert a legitimate athlete
      await fetch(`${baseUrl}/api/v1/athletes?schoolId=${ROLLBACK_SCHOOL_ID}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ROLLBACK_LICENSE_KEY}`,
          'X-Forwarded-For': '10.20.1.6'
        },
        body: JSON.stringify({
          id: 'ath-tamper-target',
          name: 'ورزشکار هدف تغییر',
          phone: '09121234567'
        })
      });

      // 2. Corrupt the ciphertext authentication tag directly in SQLite
      const rawRow = db.prepare('SELECT name_encrypted FROM athletes WHERE school_id = ? AND id = ?')
        .get(ROLLBACK_SCHOOL_ID, 'ath-tamper-target');
      assert.ok(rawRow);

      const parts = rawRow.name_encrypted.split(':');
      // Tamper ciphertext bytes
      const corruptedToken = `${parts[0]}:${parts[1]}:bad0cafe00` + parts[2].substring(10);
      db.prepare('UPDATE athletes SET name_encrypted = ? WHERE school_id = ? AND id = ?')
        .run(corruptedToken, ROLLBACK_SCHOOL_ID, 'ath-tamper-target');

      // 3. Querying through REST must reject with CRYPTO_AUTH_FAILED
      const res = await fetch(`${baseUrl}/api/v1/athletes?schoolId=${ROLLBACK_SCHOOL_ID}`, {
        headers: {
          'Authorization': `Bearer ${ROLLBACK_LICENSE_KEY}`,
          'X-Forwarded-For': '10.20.1.7'
        }
      });

      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.strictEqual(json.error, 'CRYPTO_AUTH_FAILED');
      assert.ok(!JSON.stringify(json).includes('ورزشکار هدف تغییر'), 'Plaintext must not leak');

      // Cleanup corrupted record
      db.prepare('DELETE FROM athletes WHERE school_id = ?').run(ROLLBACK_SCHOOL_ID);
    });
  });

  // ==========================================================================
  // Suite 3: Rapid Burst Synchronization (50 Concurrent Requests)
  // ==========================================================================
  describe('3. Rapid Burst Synchronization (50 Concurrent Requests) & Concurrency Defense', () => {
    it('3.1 Dispatches 50 concurrent mixed requests (25 sync writes + 25 reads) without SQLITE_BUSY or deadlock', async () => {
      const CONCURRENT_REQUESTS = 50;
      const promises = [];

      for (let i = 1; i <= CONCURRENT_REQUESTS; i++) {
        const isWrite = i % 2 === 1;

        if (isWrite) {
          // Write request: POST /api/sync with unique athlete & transaction
          const writePromise = fetch(`${baseUrl}/api/sync`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Forwarded-For': `10.30.1.${i}`
            },
            body: JSON.stringify({
              schoolId: BURST_SCHOOL_ID,
              licenseKey: BURST_LICENSE_KEY,
              deviceInfo: { deviceId: `burst-device-${i}` },
              athletes: [
                {
                  id: `ath-burst-${i}`,
                  name: `شناگر همزمان شماره ${i}`,
                  phone: `0913${String(i).padStart(7, '0')}`,
                  packageName: 'شنای همزمان'
                }
              ],
              transactions: [
                {
                  id: `tx-burst-${i}`,
                  date: '2026-10-25T15:00:00Z',
                  type: 'income',
                  title: `تراکنش همزمان ${i}`,
                  amount: 100000 * i,
                  method: 'pos'
                }
              ]
            })
          }).then(async (res) => ({
            id: i,
            type: 'write',
            status: res.status,
            body: await res.json()
          }));
          promises.push(writePromise);
        } else {
          // Read request: GET /api/v1/athletes
          const readPromise = fetch(`${baseUrl}/api/v1/athletes?schoolId=${BURST_SCHOOL_ID}`, {
            headers: {
              'Authorization': `Bearer ${BURST_LICENSE_KEY}`,
              'X-Forwarded-For': `10.30.1.${i}`
            }
          }).then(async (res) => ({
            id: i,
            type: 'read',
            status: res.status,
            body: await res.json()
          }));
          promises.push(readPromise);
        }
      }

      // Execute all 50 concurrent requests simultaneously
      const results = await Promise.all(promises);

      // Verify all 50 succeeded with HTTP 200
      assert.strictEqual(results.length, 50);
      for (const res of results) {
        assert.strictEqual(res.status, 200, `Request ${res.id} (${res.type}) failed with status ${res.status}: ${JSON.stringify(res.body)}`);
      }

      // Verify that all 25 writes were persisted in the database
      const writeAthletesCount = db.prepare('SELECT count(*) as count FROM athletes WHERE school_id = ?').get(BURST_SCHOOL_ID).count;
      assert.strictEqual(writeAthletesCount, 25, 'All 25 concurrent write operations must be committed');

      const writeTxCount = db.prepare('SELECT count(*) as count FROM transactions WHERE school_id = ?').get(BURST_SCHOOL_ID).count;
      assert.strictEqual(writeTxCount, 25, 'All 25 concurrent transactions must be committed');
    });

    it('3.2 Burst exceeding rate limit (70 requests from single client) triggers HTTP 429 after 60 requests', async () => {
      const TOTAL_BURST = 70;
      const responses = [];

      for (let i = 1; i <= TOTAL_BURST; i++) {
        // Send from identical client IP and identical school ID
        const res = await fetch(`${baseUrl}/api/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Forwarded-For': '198.51.100.42'
          },
          body: JSON.stringify({
            schoolId: RATELIMIT_SCHOOL_ID,
            licenseKey: RATELIMIT_LICENSE_KEY,
            deviceInfo: { deviceId: 'rate-limit-dev' },
            athletes: []
          })
        });

        responses.push({
          idx: i,
          status: res.status,
          retryAfter: res.headers.get('retry-after')
        });
      }

      const successCount = responses.filter(r => r.status === 200).length;
      const rateLimitedCount = responses.filter(r => r.status === 429).length;

      // syncRateLimiter limit is 60 requests per minute
      assert.strictEqual(successCount, 60, `Expected exactly 60 successful requests before rate limit, got ${successCount}`);
      assert.strictEqual(rateLimitedCount, 10, `Expected 10 rate-limited (HTTP 429) requests, got ${rateLimitedCount}`);

      // Verify 61st request had Retry-After header
      const firstLimited = responses[60]; // 0-indexed 60 is request 61
      assert.strictEqual(firstLimited.status, 429);
      assert.ok(firstLimited.retryAfter !== null, 'HTTP 429 response must provide Retry-After header');
    });
  });

  // ==========================================================================
  // Suite 4: Decrypted Output Fidelity & Ciphertext Persistence in Database
  // ==========================================================================
  describe('4. Decrypted Output Fidelity & Ciphertext Persistence', () => {
    it('4.1 Roundtrips complex Persian UTF-8, ZWNJ, diacritics, and extreme numbers with 100% fidelity', async () => {
      const complexAthlete = {
        id: 'ath-fidelity-01',
        name: 'علی‌رضا براتی‌پور (مربی ارشد) — شنا و واترپلو 🏊‍♂️', // Contains ZWNJ \u200C, em-dash, emoji
        phone: '+989123456789',
        coachId: 'coach-master-01',
        cardUid: 'MIFARE-DESFIRE-01-A2-F3',
        packageName: 'دوره بین‌المللی مربی‌گری درجه ۱',
        totalSessions: 36,
        remainingSessions: 30,
        totalAttended: 6,
        tuitionFee: 25000000.75, // Floating point financial tuition
        paidAmount: 20000000,
        debt: -5000000.75, // Negative debt
        expireDate: '2028-11-30'
      };

      const complexTx = {
        id: 'tx-fidelity-01',
        date: '2026-10-25T16:00:00Z',
        type: 'income',
        title: 'پرداخت نقدی شهریه — علی‌رضا براتی‌پور (کد رهگیری: #88492019)',
        amount: 20000000,
        method: 'pos',
        author: 'مسئول امور مالی و خزانه‌داری'
      };

      const syncRes = await fetch(`${baseUrl}/api/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': '10.40.1.1'
        },
        body: JSON.stringify({
          schoolId: FIDELITY_SCHOOL_ID,
          licenseKey: FIDELITY_LICENSE_KEY,
          deviceInfo: { deviceId: 'fidelity-dev-01' },
          athletes: [complexAthlete],
          transactions: [complexTx]
        })
      });

      assert.strictEqual(syncRes.status, 200);

      // Verify decrypted query fidelity via GET /api/v1/athletes
      const getAthRes = await fetch(`${baseUrl}/api/v1/athletes?schoolId=${FIDELITY_SCHOOL_ID}`, {
        headers: {
          'Authorization': `Bearer ${FIDELITY_LICENSE_KEY}`,
          'X-Forwarded-For': '10.40.1.2'
        }
      });
      assert.strictEqual(getAthRes.status, 200);
      const athletes = await getAthRes.json();
      const ath = athletes.find(a => a.id === 'ath-fidelity-01');

      assert.ok(ath);
      assert.strictEqual(ath.name, complexAthlete.name, 'Decrypted name must match exact Unicode characters');
      assert.strictEqual(ath.phone, complexAthlete.phone);
      assert.strictEqual(ath.cardUid, complexAthlete.cardUid);
      assert.strictEqual(ath.tuitionFee, 25000000.75);
      assert.strictEqual(typeof ath.tuitionFee, 'number', 'tuitionFee must be a JavaScript Number primitive');
      assert.strictEqual(ath.debt, -5000000.75);
      assert.strictEqual(typeof ath.debt, 'number', 'debt must be a JavaScript Number primitive');

      // Verify decrypted query fidelity via GET /api/v1/transactions
      const getTxRes = await fetch(`${baseUrl}/api/v1/transactions?schoolId=${FIDELITY_SCHOOL_ID}`, {
        headers: {
          'Authorization': `Bearer ${FIDELITY_LICENSE_KEY}`,
          'X-Forwarded-For': '10.40.1.3'
        }
      });
      assert.strictEqual(getTxRes.status, 200);
      const txs = await getTxRes.json();
      const tx = txs.find(t => t.id === 'tx-fidelity-01');

      assert.ok(tx);
      assert.strictEqual(tx.title, complexTx.title);
      assert.strictEqual(tx.amount, 20000000);
      assert.strictEqual(typeof tx.amount, 'number');
      assert.strictEqual(tx.author, complexTx.author);
    });

    it('4.2 Raw SQLite table inspection confirms ALL sensitive fields match AES-256-GCM token format and zero plaintext', () => {
      const rawAthlete = db.prepare('SELECT * FROM athletes WHERE school_id = ? AND id = ?')
        .get(FIDELITY_SCHOOL_ID, 'ath-fidelity-01');

      assert.ok(rawAthlete);
      // All sensitive columns must match CIPHER_REGEX
      assert.match(rawAthlete.name_encrypted, CIPHER_REGEX);
      assert.match(rawAthlete.phone_encrypted, CIPHER_REGEX);
      assert.match(rawAthlete.card_uid_encrypted, CIPHER_REGEX);
      assert.match(rawAthlete.tuition_fee_encrypted, CIPHER_REGEX);
      assert.match(rawAthlete.paid_amount_encrypted, CIPHER_REGEX);
      assert.match(rawAthlete.debt_encrypted, CIPHER_REGEX);

      // Verify zero plaintext substring leakage in columns
      assert.ok(!rawAthlete.name_encrypted.includes('علی‌رضا'));
      assert.ok(!rawAthlete.name_encrypted.includes('براتی‌پور'));
      assert.ok(!rawAthlete.phone_encrypted.includes('09123456789'));
      assert.ok(!rawAthlete.card_uid_encrypted.includes('MIFARE'));

      // Inspect transactions table
      const rawTx = db.prepare('SELECT * FROM transactions WHERE school_id = ? AND id = ?')
        .get(FIDELITY_SCHOOL_ID, 'tx-fidelity-01');
      assert.ok(rawTx);
      assert.match(rawTx.title_encrypted, CIPHER_REGEX);
      assert.match(rawTx.amount_encrypted, CIPHER_REGEX);
      assert.match(rawTx.author_encrypted, CIPHER_REGEX);
      assert.ok(!rawTx.title_encrypted.includes('پرداخت'));
      assert.ok(!rawTx.author_encrypted.includes('خزانه‌داری'));
    });

    it('4.3 Physical binary disk file audit confirms ZERO plaintext leaked to database storage', () => {
      // Checkpoint WAL contents into main DB file
      db.exec('PRAGMA wal_checkpoint(FULL);');

      const diskBytes = fs.readFileSync(testDbPath);

      // Assert that neither the main db file contains plaintext
      const forbiddenStrings = [
        'علی‌رضا براتی‌پور',
        '+989123456789',
        'MIFARE-DESFIRE',
        'پرداخت نقدی شهریه',
        'خزانه‌داری',
        'شناگر رده قهرمانی شماره 500'
      ];

      for (const str of forbiddenStrings) {
        assert.ok(
          !diskBytes.includes(Buffer.from(str, 'utf8')),
          `Physical storage leak detected! Database disk contains plaintext string "${str}"`
        );
      }
    });
  });
});
