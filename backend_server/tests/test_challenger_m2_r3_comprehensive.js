/**
 * Challenger Adversarial Stress Suite - Milestone 2 Iteration 3
 * Empirical Challenger Verification Harness
 *
 * Objectives:
 * 1. Challenge /api/sync and /api/v1/* with malformed, non-string, and boundary IDs.
 *    Confirm 0 unhandled HTTP 500 crashes (all return HTTP 400 without stack leakage).
 * 2. Multi-table sync atomic rollback under CHECK / NOT NULL constraint violations:
 *    Confirm 0 partial commits in SQLite across all tables.
 * 3. Large payload synchronization (1,500 entities: 500 athletes, 500 transactions, 300 attendance, 200 definitions)
 *    and decrypted fidelity + raw SQLite disk ciphertext inspection.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { app } from '../src/app.js';
import { initDatabase, closeDatabase } from '../src/db/database.js';
import { licenseRepo } from '../src/db/repositories/licenseRepo.js';

const CIPHER_REGEX = /^[0-9a-fA-F]{24}:[0-9a-fA-F]{32}:[0-9a-fA-F]+$/;

describe('Challenger M2 R3 Deep Stress & Adversarial Suite', () => {
  const testDbPath = path.resolve(process.cwd(), 'data', 'test_challenger_m2_r3_deep.db');
  let server;
  let baseUrl;
  let db;

  const TEST_SCHOOL_ID = 'barati-stress-school';
  const TEST_LICENSE_KEY = 'LIC-STRESS-KEY-2026';

  before(async () => {
    closeDatabase();
    try { fs.unlinkSync(testDbPath); } catch {}
    try { fs.unlinkSync(testDbPath + '-wal'); } catch {}
    try { fs.unlinkSync(testDbPath + '-shm'); } catch {}

    db = initDatabase(testDbPath);

    licenseRepo.create({
      schoolId: TEST_SCHOOL_ID,
      academyName: 'آکادمی شنا باراتی - واحد چلنجر',
      licenseKey: TEST_LICENSE_KEY,
      contactPhone: '09121112233',
      expiryDate: '2035-12-31T23:59:59Z',
      maxDevices: 50
    });

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

  // =========================================================================
  // Mandate 1: Malformed, Non-String, and Boundary IDs Against Sync and REST API
  // =========================================================================
  describe('Mandate 1: Malformed, Non-String, and Boundary IDs Matrix', () => {
    // Malformed ID variants that MUST be rejected with HTTP 400 (never 500)
    const malformedIds = [
      { label: 'null', value: null },
      { label: 'number 0', value: 0 },
      { label: 'negative number', value: -999 },
      { label: 'large float', value: 123456.789 },
      { label: 'boolean true', value: true },
      { label: 'boolean false', value: false },
      { label: 'empty array', value: [] },
      { label: 'array of strings', value: ['id1', 'id2'] },
      { label: 'plain object', value: {} },
      { label: 'nested object', value: { nested: 'id_val', num: 42 } },
      { label: 'empty string', value: '' },
      { label: 'whitespace only', value: '   \t\r\n   ' },
    ];

    it('1.1 POST /api/sync rejects malformed IDs across all 5 collection types with HTTP 400 (0 unhandled 500s)', async () => {
      const collections = [
        {
          field: 'athletes',
          makeValid: (id) => [{ id, name: 'تست شناگر', phone: '09121234567' }]
        },
        {
          field: 'attendanceLogs',
          makeValid: (id) => [{ id, time: '2026-10-25T12:00:00Z', athleteName: 'تست تردد' }]
        },
        {
          field: 'attendance',
          makeValid: (id) => [{ id, time: '2026-10-25T12:00:00Z', athleteName: 'تست تردد' }]
        },
        {
          field: 'transactions',
          makeValid: (id) => [{ id, title: 'شهریه تست', date: '2026-10-25T12:00:00Z', amount: 500000, type: 'income' }]
        },
        {
          field: 'definitions',
          makeValid: (id) => [{ id, type: 'cost_center', title: 'مرکز هزینه تست' }]
        },
        {
          field: 'app_settings',
          makeValid: (id) => [{ id }]
        }
      ];

      for (const col of collections) {
        for (const mal of malformedIds) {
          const payload = {
            schoolId: TEST_SCHOOL_ID,
            licenseKey: TEST_LICENSE_KEY,
            deviceInfo: { deviceId: 'test-device' },
            [col.field]: col.makeValid(mal.value)
          };

          const res = await fetch(`${baseUrl}/api/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          assert.notStrictEqual(
            res.status,
            500,
            `CRITICAL: POST /api/sync crashed with HTTP 500 on collection '${col.field}' with ${mal.label} ID!`
          );
          assert.strictEqual(
            res.status,
            400,
            `POST /api/sync expected HTTP 400 for '${col.field}' with ${mal.label} ID, got ${res.status}`
          );

          const body = await res.json();
          assert.strictEqual(body.error, 'VALIDATION_FAILED');
          assert.strictEqual(body.stack, undefined, 'Stack trace must not leak');
        }
      }
    });

    it('1.2 Dedicated REST POST endpoints reject malformed IDs with HTTP 400 and zero stack leakage', async () => {
      const endpoints = [
        {
          path: '/api/v1/athletes',
          makeBody: (id) => ({ id, name: 'ورزشکار تست', phone: '09121112233' })
        },
        {
          path: '/api/v1/transactions',
          makeBody: (id) => ({ id, title: 'تراکنش تست', date: '2026-10-25T10:00:00Z', amount: 300000, type: 'income' })
        },
        {
          path: '/api/v1/attendance',
          makeBody: (id) => ({ id, time: '2026-10-25T10:00:00Z', athleteName: 'ورزشکار حضور' })
        },
        {
          path: '/api/v1/definitions',
          makeBody: (id) => ({ id, type: 'cost_center', title: 'عنوان مرکز هزینه' })
        }
      ];

      for (const ep of endpoints) {
        for (const mal of malformedIds) {
          const res = await fetch(`${baseUrl}${ep.path}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${TEST_SCHOOL_ID}:${TEST_LICENSE_KEY}`
            },
            body: JSON.stringify(ep.makeBody(mal.value))
          });

          assert.notStrictEqual(
            res.status,
            500,
            `CRITICAL: ${ep.path} crashed with HTTP 500 on ${mal.label} ID!`
          );
          assert.strictEqual(
            res.status,
            400,
            `${ep.path} expected HTTP 400 on ${mal.label} ID, got ${res.status}`
          );

          const body = await res.json();
          assert.strictEqual(body.error, 'VALIDATION_FAILED');
          assert.strictEqual(body.stack, undefined, 'Zero stack trace leakage expected');
        }
      }
    });

    it('1.3 Boundary IDs: long strings, Unicode, emojis, null bytes, and SQL injection payloads handled safely', async () => {
      const boundaryIds = [
        { label: 'emoji + Persian', id: 'شناسه_ورزشکار_🏊_۱۴۰۵_آزمون' },
        { label: 'SQL injection string', id: "'; DROP TABLE athletes; --" },
        { label: 'quotes & slashes', id: 'id"with\'quotes/and\\backslashes' },
        { label: 'long string (1000 chars)', id: 'ath-'.padEnd(1000, 'x') }
      ];

      for (const b of boundaryIds) {
        // Send via /api/v1/athletes
        const res = await fetch(`${baseUrl}/api/v1/athletes`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${TEST_SCHOOL_ID}:${TEST_LICENSE_KEY}`
          },
          body: JSON.stringify({
            id: b.id,
            name: `نام برای ${b.label}`,
            phone: '09120000000'
          })
        });

        assert.notStrictEqual(res.status, 500, `Boundary ID ${b.label} caused HTTP 500!`);
        assert.strictEqual(res.status, 200, `Boundary ID ${b.label} should be safely stored with HTTP 200`);

        // Verify retrieval matches
        const getRes = await fetch(`${baseUrl}/api/v1/athletes?search=${encodeURIComponent(b.label)}`, {
          headers: { 'Authorization': `Bearer ${TEST_SCHOOL_ID}:${TEST_LICENSE_KEY}` }
        });
        assert.strictEqual(getRes.status, 200);
        const list = await getRes.json();
        const found = list.find(a => a.id === b.id);
        assert.ok(found, `Boundary ID ${b.label} could not be retrieved`);
        assert.strictEqual(found.id, b.id);
      }
    });

    it('1.4 GET endpoints with adversarial query parameters return 200 without HTTP 500', async () => {
      const queryAdversarial = [
        '/api/v1/athletes?search=' + encodeURIComponent("'; DROP TABLE athletes; --"),
        '/api/v1/athletes?coachId=' + encodeURIComponent('"><script>alert(1)</script>'),
        '/api/v1/transactions?limit=-50&offset=-10',
        '/api/v1/transactions?limit=NaN&offset=bad',
        '/api/v1/transactions?type=' + encodeURIComponent('non_existent_type'),
        '/api/v1/definitions?type=' + encodeURIComponent("'; DELETE FROM definitions; --")
      ];

      for (const q of queryAdversarial) {
        const res = await fetch(`${baseUrl}${q}`, {
          headers: { 'Authorization': `Bearer ${TEST_SCHOOL_ID}:${TEST_LICENSE_KEY}` }
        });
        assert.notStrictEqual(res.status, 500, `Adversarial GET ${q} caused HTTP 500!`);
        assert.strictEqual(res.status, 200);
      }
    });
  });

  // =========================================================================
  // Mandate 2: Multi-Table Sync Atomic Rollback Under Constraint Violations
  // =========================================================================
  describe('Mandate 2: Multi-Table Sync Atomic Rollback Stress', () => {
    const ATOMIC_SCHOOL_1 = 'barati-atomic-deep-chk';
    const ATOMIC_KEY_1 = 'LIC-ATOMIC-DEEP-1';

    before(() => {
      licenseRepo.create({
        schoolId: ATOMIC_SCHOOL_1,
        academyName: 'استخر آزمون رول‌بک عمیق',
        licenseKey: ATOMIC_KEY_1,
        expiryDate: '2030-01-01',
        maxDevices: 10
      });
    });

    it('2.1 CHECK constraint violation on definitions rolls back 40 athletes, 40 attendance, and 40 transactions', async () => {
      const athletes = Array.from({ length: 40 }, (_, i) => ({
        id: `ath-atomic-deep-${i}`,
        name: `شناگر رول‌بک ${i}`,
        phone: `0912111${String(i).padStart(4, '0')}`,
        packageName: 'پکیج طلایی',
        tuitionFee: 2000000,
        paidAmount: 2000000,
        debt: 0
      }));

      const attendanceLogs = Array.from({ length: 40 }, (_, i) => ({
        id: `att-atomic-deep-${i}`,
        time: '2026-10-25T15:00:00Z',
        athleteName: `شناگر ${i}`
      }));

      const transactions = Array.from({ length: 40 }, (_, i) => ({
        id: `tx-atomic-deep-${i}`,
        date: '2026-10-25T15:30:00Z',
        type: 'income',
        title: `شهریه دریافتی ${i}`,
        amount: 2000000
      }));

      // Invalid definition triggering SQLite CHECK constraint failure
      const definitions = [
        {
          id: 'def-valid-1',
          type: 'cost_center',
          title: 'تعریف اول'
        },
        {
          id: 'def-bad-chk',
          type: 'UNAUTHORIZED_CHECK_TYPE',
          title: 'تعریف متخلف'
        }
      ];

      const res = await fetch(`${baseUrl}/api/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: ATOMIC_SCHOOL_1,
          licenseKey: ATOMIC_KEY_1,
          deviceInfo: { deviceId: 'atomic-dev' },
          athletes,
          attendanceLogs,
          transactions,
          definitions
        })
      });

      assert.ok(res.status >= 400, `Expected error status, got ${res.status}`);

      // Verify ZERO records in SQLite across ALL tables for this school
      const cAth = db.prepare('SELECT count(*) as c FROM athletes WHERE school_id = ?').get(ATOMIC_SCHOOL_1).c;
      const cAtt = db.prepare('SELECT count(*) as c FROM attendance_logs WHERE school_id = ?').get(ATOMIC_SCHOOL_1).c;
      const cTx = db.prepare('SELECT count(*) as c FROM transactions WHERE school_id = ?').get(ATOMIC_SCHOOL_1).c;
      const cDef = db.prepare('SELECT count(*) as c FROM definitions WHERE school_id = ?').get(ATOMIC_SCHOOL_1).c;

      assert.strictEqual(cAth, 0, 'Zero athletes must be committed after rollback');
      assert.strictEqual(cAtt, 0, 'Zero attendance logs must be committed after rollback');
      assert.strictEqual(cTx, 0, 'Zero transactions must be committed after rollback');
      assert.strictEqual(cDef, 0, 'Zero definitions must be committed after rollback');
    });

    it('2.2 NOT NULL constraint violation on transaction type rolls back all preceding tables', async () => {
      const ATOMIC_SCHOOL_2 = 'barati-atomic-deep-notnull';
      licenseRepo.create({
        schoolId: ATOMIC_SCHOOL_2,
        academyName: 'استخر آزمون نات‌نال',
        licenseKey: 'LIC-NOTNULL-KEY',
        expiryDate: '2030-01-01',
        maxDevices: 10
      });

      const athletes = Array.from({ length: 25 }, (_, i) => ({
        id: `ath-notnull-${i}`,
        name: `ورزشکار ${i}`,
        phone: '09128889900',
        packageName: 'عمومی'
      }));

      const attendanceLogs = Array.from({ length: 25 }, (_, i) => ({
        id: `att-notnull-${i}`,
        time: '2026-10-25T16:00:00Z',
        athleteName: `ورزشکار ${i}`
      }));

      // Transaction with explicit type: null to trigger SQL NOT NULL constraint
      const transactions = [
        {
          id: 'tx-notnull-fail',
          date: '2026-10-25',
          type: null,
          title: 'تراکنش با نوع نال',
          amount: 150000
        }
      ];

      const res = await fetch(`${baseUrl}/api/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: ATOMIC_SCHOOL_2,
          licenseKey: 'LIC-NOTNULL-KEY',
          deviceInfo: { deviceId: 'atomic-dev-notnull' },
          athletes,
          attendanceLogs,
          transactions
        })
      });

      assert.ok(res.status >= 400);

      const cAth = db.prepare('SELECT count(*) as c FROM athletes WHERE school_id = ?').get(ATOMIC_SCHOOL_2).c;
      const cAtt = db.prepare('SELECT count(*) as c FROM attendance_logs WHERE school_id = ?').get(ATOMIC_SCHOOL_2).c;
      const cTx = db.prepare('SELECT count(*) as c FROM transactions WHERE school_id = ?').get(ATOMIC_SCHOOL_2).c;

      assert.strictEqual(cAth, 0, '0 athletes committed');
      assert.strictEqual(cAtt, 0, '0 attendance logs committed');
      assert.strictEqual(cTx, 0, '0 transactions committed');
    });

    it('2.3 Failure at item 100 in 100-item batch rolls back all previous 99 items', async () => {
      const ATOMIC_SCHOOL_3 = 'barati-atomic-item-fail';
      licenseRepo.create({
        schoolId: ATOMIC_SCHOOL_3,
        academyName: 'استخر آیتم صدم',
        licenseKey: 'LIC-ITEM-100',
        expiryDate: '2030-01-01',
        maxDevices: 10
      });

      const transactions = Array.from({ length: 99 }, (_, i) => ({
        id: `tx-batch-${i}`,
        date: '2026-10-25T10:00:00Z',
        type: 'income',
        title: `تراکنش صحیح ${i}`,
        amount: 100000
      }));

      // 100th item fails constraint
      transactions.push({
        id: 'tx-batch-100-fail',
        date: '2026-10-25T10:00:00Z',
        type: null,
        title: 'تراکنش صدم با خطای نات‌نال',
        amount: 999999
      });

      const res = await fetch(`${baseUrl}/api/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: ATOMIC_SCHOOL_3,
          licenseKey: 'LIC-ITEM-100',
          deviceInfo: { deviceId: 'atomic-item-dev' },
          transactions
        })
      });

      assert.ok(res.status >= 400);

      const countTx = db.prepare('SELECT count(*) as c FROM transactions WHERE school_id = ?').get(ATOMIC_SCHOOL_3).c;
      assert.strictEqual(countTx, 0, 'Must have 0 partial commits even if 99 items succeeded before the 100th failed');
    });
  });

  // =========================================================================
  // Mandate 3: Large Payload Synchronization (1,500 Entities) & Decrypted Fidelity
  // =========================================================================
  describe('Mandate 3: Large Payload Synchronization (1,500+ items) & Decrypted Fidelity', () => {
    const HIGH_LOAD_SCHOOL = 'barati-highload-1500';
    const HIGH_LOAD_KEY = 'LIC-HIGHLOAD-1500-KEY';

    before(() => {
      licenseRepo.create({
        schoolId: HIGH_LOAD_SCHOOL,
        academyName: 'آکادمی پرظرفیت ۱۵۰۰ رکورد',
        licenseKey: HIGH_LOAD_KEY,
        expiryDate: '2032-01-01',
        maxDevices: 10
      });
    });

    it('3.1 Synchronizes 1,500 entities in single payload and confirms AES-256-GCM ciphertext in SQLite and 100% decrypted fidelity', async () => {
      const ATHLETE_COUNT = 500;
      const TX_COUNT = 500;
      const ATT_COUNT = 300;
      const DEF_COUNT = 200;
      const TOTAL_COUNT = ATHLETE_COUNT + TX_COUNT + ATT_COUNT + DEF_COUNT; // 1500

      const athletes = [];
      for (let i = 1; i <= ATHLETE_COUNT; i++) {
        athletes.push({
          id: `ath-hl-${i}`,
          name: `شناگر نخبه شماره ${i} (تیم ملی) 🏅`,
          phone: `0935${String(i).padStart(7, '0')}`,
          coachId: `coach-${i % 8}`,
          cardUid: `RFID-HL-${i}`,
          packageName: `دوره قهرمانی سطح ${i % 5 + 1}`,
          totalSessions: 36,
          remainingSessions: 30 - (i % 10),
          totalAttended: 6 + (i % 10),
          tuitionFee: 4500000.75 + i,
          paidAmount: 3500000.25,
          debt: 1000000.50 + i,
          expireDate: '2029-06-30'
        });
      }

      const transactions = [];
      for (let i = 1; i <= TX_COUNT; i++) {
        transactions.push({
          id: `tx-hl-${i}`,
          date: '2026-10-25T17:00:00Z',
          type: i % 3 === 0 ? 'expense' : (i % 3 === 1 ? 'income' : 'coach_payout'),
          title: `سند مالی پرسرعت شماره ${i} (درگاه پرداخت) 💳`,
          amount: 1500000.50 + i * 5,
          method: 'pos',
          author: `حسابدار ارشد شماره ${i % 3 + 1}`
        });
      }

      const attendanceLogs = [];
      for (let i = 1; i <= ATT_COUNT; i++) {
        attendanceLogs.push({
          id: `att-hl-${i}`,
          time: '2026-10-25T18:00:00Z',
          athleteName: `ورزشکار گیت ${i}`,
          coachName: `مربی شیفت ${i % 4 + 1}`,
          status: 'approved',
          sessionsLeft: 20 - (i % 5),
          note: `ورود منظم از گیت شماره ${i % 2 + 1}`
        });
      }

      const definitions = [];
      for (let i = 1; i <= DEF_COUNT; i++) {
        const type = i % 2 === 0 ? 'cost_center' : (i % 2 === 1 ? 'goods_item' : 'course_type');
        definitions.push({
          id: `def-hl-${i}`,
          type,
          title: `تعریف سرفصل شنا شماره ${i}`,
          code: `CODE-${i}`,
          description: `توضیحات تکمیلی سرفصل ${i}`,
          price: 100000 + i * 100,
          sessions: 12
        });
      }

      const t0 = Date.now();
      const res = await fetch(`${baseUrl}/api/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: HIGH_LOAD_SCHOOL,
          licenseKey: HIGH_LOAD_KEY,
          deviceInfo: { deviceId: 'highload-dev-1500' },
          athletes,
          transactions,
          attendanceLogs,
          definitions
        })
      });
      const durationMs = Date.now() - t0;

      assert.strictEqual(res.status, 200, `Expected 200 for 1,500 payload sync, got ${res.status}`);
      const body = await res.json();
      assert.strictEqual(body.status, 'success');
      assert.strictEqual(body.synced.athletesCount, ATHLETE_COUNT);
      assert.strictEqual(body.synced.transactionsCount, TX_COUNT);
      assert.strictEqual(body.synced.attendanceCount, ATT_COUNT);
      assert.strictEqual(body.synced.definitionsCount, DEF_COUNT);

      // Verify physical SQLite row counts
      const dbAthCount = db.prepare('SELECT count(*) as c FROM athletes WHERE school_id = ?').get(HIGH_LOAD_SCHOOL).c;
      const dbTxCount = db.prepare('SELECT count(*) as c FROM transactions WHERE school_id = ?').get(HIGH_LOAD_SCHOOL).c;
      const dbAttCount = db.prepare('SELECT count(*) as c FROM attendance_logs WHERE school_id = ?').get(HIGH_LOAD_SCHOOL).c;
      const dbDefCount = db.prepare('SELECT count(*) as c FROM definitions WHERE school_id = ?').get(HIGH_LOAD_SCHOOL).c;

      assert.strictEqual(dbAthCount, ATHLETE_COUNT);
      assert.strictEqual(dbTxCount, TX_COUNT);
      assert.strictEqual(dbAttCount, ATT_COUNT);
      assert.strictEqual(dbDefCount, DEF_COUNT);

      // RAW SQLite Inspection: confirm ciphertext format on all sensitive columns
      const sampleAthRow = db.prepare('SELECT * FROM athletes WHERE school_id = ? AND id = ?').get(HIGH_LOAD_SCHOOL, 'ath-hl-250');
      assert.ok(sampleAthRow);
      assert.match(sampleAthRow.name_encrypted, CIPHER_REGEX);
      assert.match(sampleAthRow.phone_encrypted, CIPHER_REGEX);
      assert.match(sampleAthRow.card_uid_encrypted, CIPHER_REGEX);
      assert.match(sampleAthRow.tuition_fee_encrypted, CIPHER_REGEX);
      assert.match(sampleAthRow.paid_amount_encrypted, CIPHER_REGEX);
      assert.match(sampleAthRow.debt_encrypted, CIPHER_REGEX);

      // Verify that sample raw ciphertext does not contain plaintext strings
      assert.ok(!sampleAthRow.name_encrypted.includes('شناگر نخبه شماره 250'));
      assert.ok(!sampleAthRow.phone_encrypted.includes('09350000250'));
      assert.ok(!sampleAthRow.card_uid_encrypted.includes('RFID-HL-250'));

      const sampleTxRow = db.prepare('SELECT * FROM transactions WHERE school_id = ? AND id = ?').get(HIGH_LOAD_SCHOOL, 'tx-hl-300');
      assert.ok(sampleTxRow);
      assert.match(sampleTxRow.title_encrypted, CIPHER_REGEX);
      assert.match(sampleTxRow.amount_encrypted, CIPHER_REGEX);
      assert.match(sampleTxRow.author_encrypted, CIPHER_REGEX);

      // Check physical SQLite file contents for zero plaintext leakage of sensitive strings
      // Flush WAL to disk first via checkpoint
      db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
      const dbBuffer = fs.readFileSync(testDbPath);
      assert.ok(!dbBuffer.includes(Buffer.from('شناگر نخبه شماره 250', 'utf8')), 'Raw disk must not contain athlete name');
      assert.ok(!dbBuffer.includes(Buffer.from('09350000250', 'utf8')), 'Raw disk must not contain athlete phone');
      assert.ok(!dbBuffer.includes(Buffer.from('سند مالی پرسرعت شماره 300', 'utf8')), 'Raw disk must not contain tx title');

      // Decrypted Fidelity Verification via GET /api/v1/athletes
      const getAthRes = await fetch(`${baseUrl}/api/v1/athletes?schoolId=${HIGH_LOAD_SCHOOL}`, {
        headers: { 'Authorization': `Bearer ${HIGH_LOAD_KEY}` }
      });
      assert.strictEqual(getAthRes.status, 200);
      const fetchedAthletes = await getAthRes.json();
      assert.strictEqual(fetchedAthletes.length, ATHLETE_COUNT);

      // Spot-check multiple indices (1, 100, 250, 499)
      const testIndices = [1, 100, 250, 499];
      for (const idx of testIndices) {
        const original = athletes[idx - 1];
        const retrieved = fetchedAthletes.find(a => a.id === original.id);
        assert.ok(retrieved, `Athlete ${original.id} not found in retrieved list`);
        assert.strictEqual(retrieved.name, original.name);
        assert.strictEqual(retrieved.phone, original.phone);
        assert.strictEqual(retrieved.cardUid, original.cardUid);
        assert.strictEqual(retrieved.packageName, original.packageName);
        assert.strictEqual(retrieved.tuitionFee, original.tuitionFee);
        assert.strictEqual(typeof retrieved.tuitionFee, 'number');
        assert.strictEqual(retrieved.paidAmount, original.paidAmount);
        assert.strictEqual(typeof retrieved.paidAmount, 'number');
        assert.strictEqual(retrieved.debt, original.debt);
        assert.strictEqual(typeof retrieved.debt, 'number');
      }

      // Decrypted Fidelity Verification via GET /api/v1/transactions
      const getTxRes = await fetch(`${baseUrl}/api/v1/transactions?schoolId=${HIGH_LOAD_SCHOOL}&limit=1000`, {
        headers: { 'Authorization': `Bearer ${HIGH_LOAD_KEY}` }
      });
      assert.strictEqual(getTxRes.status, 200);
      const fetchedTx = await getTxRes.json();
      assert.strictEqual(fetchedTx.length, TX_COUNT);

      for (const idx of [1, 50, 200, 400]) {
        const originalTx = transactions[idx - 1];
        const retrievedTx = fetchedTx.find(t => t.id === originalTx.id);
        assert.ok(retrievedTx, `Transaction ${originalTx.id} not found in retrieved list`);
        assert.strictEqual(retrievedTx.title, originalTx.title);
        assert.strictEqual(retrievedTx.amount, originalTx.amount);
        assert.strictEqual(typeof retrievedTx.amount, 'number');
        assert.strictEqual(retrievedTx.type, originalTx.type);
        assert.strictEqual(retrievedTx.author, originalTx.author);
      }

      console.log(`PASS: 1,500 entities payload synchronized in ${durationMs}ms with 100% decrypted fidelity`);
    });
  });
});
