/**
 * Challenger Adversarial Verification Suite - Milestone 2 Iteration 2
 *
 * Tests the four mandate areas:
 * 1. Non-string, malformed, and prototype pollution payloads to /api/sync and /api/v1/* (0 unhandled 500s)
 * 2. Atomic rollback: deliberate constraint failures in multi-table sync batches (0 partial commits)
 * 3. Large payload synchronization (1,000+ items) & decrypted fidelity verification
 * 4. Empirical verification of unhandled 500 crash bugs in Sync and REST endpoints
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { app } from '../src/app.js';
import { initDatabase, closeDatabase } from '../src/db/database.js';
import { licenseRepo } from '../src/db/repositories/licenseRepo.js';

const CIPHER_REGEX = /^[0-9a-fA-F]{24}:[0-9a-fA-F]{32}:[0-9a-fA-F]+$/;

describe('Challenger Adversarial Stress Suite (M2 R2)', () => {
  const testDbPath = path.resolve(process.cwd(), 'data', 'test_challenger_m2_r2.db');
  let server;
  let baseUrl;
  let db;

  const TEST_SCHOOL_ID = 'barati-challenger-school';
  const TEST_LICENSE_KEY = 'LIC-CHALLENGER-2026-KEY';

  before(async () => {
    closeDatabase();
    try { fs.unlinkSync(testDbPath); } catch {}
    try { fs.unlinkSync(testDbPath + '-wal'); } catch {}
    try { fs.unlinkSync(testDbPath + '-shm'); } catch {}

    db = initDatabase(testDbPath);

    licenseRepo.create({
      schoolId: TEST_SCHOOL_ID,
      academyName: 'آکادمی آزمایشی چلنجر',
      licenseKey: TEST_LICENSE_KEY,
      contactPhone: '09129990000',
      expiryDate: '2030-12-31T23:59:59Z',
      maxDevices: 100
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
  // Challenge Area 1: Malformed JSON and Non-String Credentials
  // =========================================================================
  describe('Area 1: Malformed JSON and Non-String Credentials Validation', () => {
    it('1.1 Malformed and truncated JSON to /api/sync and /api/v1/* returns HTTP 400 without 500', async () => {
      const endpoints = [
        { path: '/api/sync', method: 'POST' },
        { path: '/api/v1/athletes', method: 'POST' },
        { path: '/api/v1/transactions', method: 'POST' },
        { path: '/api/v1/attendance', method: 'POST' },
        { path: '/api/v1/definitions', method: 'POST' }
      ];

      for (const ep of endpoints) {
        const res = await fetch(`${baseUrl}${ep.path}`, {
          method: ep.method,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${TEST_SCHOOL_ID}:${TEST_LICENSE_KEY}`
          },
          body: '{"schoolId": "barati", "broken": ['
        });

        assert.strictEqual(
          res.status,
          400,
          `Malformed JSON to ${ep.path} must return 400 Bad Request, got ${res.status}`
        );
        const json = await res.json();
        assert.ok(json.error === 'MALFORMED_JSON' || json.error === 'VALIDATION_FAILED');
        assert.strictEqual(json.stack, undefined, 'No stack trace should leak');
      }
    });

    it('1.2 Non-string credentials in body, query, and headers return HTTP 400 or 401 (0 unhandled 500 crashes)', async () => {
      const testCases = [
        { schoolId: 12345, licenseKey: 'valid-str' },
        { schoolId: 'valid-str', licenseKey: { evil: 'obj' } },
        { schoolId: ['arr'], licenseKey: true },
        { schoolId: null, licenseKey: 999 }
      ];

      for (const tc of testCases) {
        const res = await fetch(`${baseUrl}/api/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(tc)
        });

        assert.ok(
          res.status === 400 || res.status === 401,
          `Non-string credentials ${JSON.stringify(tc)} must return 400 or 401, got ${res.status}`
        );
        assert.notStrictEqual(res.status, 500, 'Must NOT crash with HTTP 500');
      }
    });
  });

  // =========================================================================
  // Challenge Area 2: Atomic Rollback Under Deliberate Constraint Failures
  // =========================================================================
  describe('Area 2: Stress-test atomic rollback (zero partial commits in SQLite)', () => {
    it('2.1 Multi-table batch with CHECK constraint violation in definitions rolls back ALL tables', async () => {
      const ROLLBACK_ID = 'barati-atomic-chk';
      licenseRepo.create({
        schoolId: ROLLBACK_ID,
        academyName: 'استخر رول‌بک تست',
        licenseKey: 'LIC-ROLLBACK-TEST',
        expiryDate: '2030-01-01',
        maxDevices: 10
      });

      const athletes = Array.from({ length: 50 }, (_, i) => ({
        id: `ath-atomic-${i}`,
        name: `شناگر اتمیک ${i}`,
        phone: `0912000${String(i).padStart(4, '0')}`,
        packageName: 'پکیج اتمیک'
      }));

      const transactions = Array.from({ length: 50 }, (_, i) => ({
        id: `tx-atomic-${i}`,
        date: '2026-10-25T10:00:00Z',
        type: 'income',
        title: `شهریه ${i}`,
        amount: 1000000
      }));

      const attendanceLogs = Array.from({ length: 50 }, (_, i) => ({
        id: `att-atomic-${i}`,
        time: '2026-10-25T11:00:00Z',
        athleteName: `شناگر ${i}`
      }));

      // Deliberately invalid definition violating CHECK (type IN ('cost_center', 'goods_item', 'course_type'))
      const definitions = [
        {
          id: 'def-atomic-chk-fail',
          type: 'INVALID_CHECK_CONSTRAINT_TYPE',
          title: 'تعریف نامعتبر'
        }
      ];

      const res = await fetch(`${baseUrl}/api/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: ROLLBACK_ID,
          licenseKey: 'LIC-ROLLBACK-TEST',
          deviceInfo: { deviceId: 'atomic-dev' },
          athletes,
          transactions,
          attendanceLogs,
          definitions
        })
      });

      // Should fail
      assert.ok(res.status >= 400, `Expected error, got ${res.status}`);

      // Verify ZERO records committed in SQLite across all 4 tables
      const cAth = db.prepare('SELECT count(*) as c FROM athletes WHERE school_id = ?').get(ROLLBACK_ID).c;
      const cTx = db.prepare('SELECT count(*) as c FROM transactions WHERE school_id = ?').get(ROLLBACK_ID).c;
      const cAtt = db.prepare('SELECT count(*) as c FROM attendance_logs WHERE school_id = ?').get(ROLLBACK_ID).c;
      const cDef = db.prepare('SELECT count(*) as c FROM definitions WHERE school_id = ?').get(ROLLBACK_ID).c;

      assert.strictEqual(cAth, 0, 'Zero athletes must be committed');
      assert.strictEqual(cTx, 0, 'Zero transactions must be committed');
      assert.strictEqual(cAtt, 0, 'Zero attendance logs must be committed');
      assert.strictEqual(cDef, 0, 'Zero definitions must be committed');
    });

    it('2.2 Batch rollback when transaction violates NOT NULL constraint preserves 0 partial commits', async () => {
      const ROLLBACK_ID2 = 'barati-atomic-notnull';
      licenseRepo.create({
        schoolId: ROLLBACK_ID2,
        academyName: 'استخر رول‌بک ۲',
        licenseKey: 'LIC-ROLLBACK-TEST-2',
        expiryDate: '2030-01-01',
        maxDevices: 10
      });

      const athletes = Array.from({ length: 30 }, (_, i) => ({
        id: `ath-notnull-${i}`,
        name: `شناگر ${i}`,
        phone: '09123334455',
        packageName: 'پکیج'
      }));

      // Violate transactions.type NOT NULL constraint
      const transactions = [
        {
          id: 'tx-notnull-fail',
          date: '2026-10-25',
          type: null,
          title: 'تراکنش نامعتبر',
          amount: 500
        }
      ];

      const res = await fetch(`${baseUrl}/api/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: ROLLBACK_ID2,
          licenseKey: 'LIC-ROLLBACK-TEST-2',
          deviceInfo: { deviceId: 'atomic-dev-2' },
          athletes,
          transactions
        })
      });

      assert.ok(res.status >= 400);

      const cAth = db.prepare('SELECT count(*) as c FROM athletes WHERE school_id = ?').get(ROLLBACK_ID2).c;
      assert.strictEqual(cAth, 0, 'Zero athletes must be committed when subsequent table fails');
    });
  });

  // =========================================================================
  // Challenge Area 3: Large Payload Synchronization (1,000+ Items) & Fidelity
  // =========================================================================
  describe('Area 3: Large Payload Synchronization (1,000+ items) & Decrypted Fidelity', () => {
    const LARGE_SCHOOL_ID = 'barati-large-sync-school';
    const LARGE_LICENSE_KEY = 'LIC-LARGE-SYNC-KEY';

    before(() => {
      licenseRepo.create({
        schoolId: LARGE_SCHOOL_ID,
        academyName: 'استخر بارکاری بالا',
        licenseKey: LARGE_LICENSE_KEY,
        expiryDate: '2030-01-01',
        maxDevices: 10
      });
    });

    it('3.1 Synchronizes 1,200 items in single payload and verifies persistence and decrypted fidelity', async () => {
      const COUNT = 1200;
      const athletes = [];
      const transactions = [];

      for (let i = 1; i <= COUNT; i++) {
        athletes.push({
          id: `ath-large-${i}`,
          name: `شناگر رکورددار شماره ${i} — دوره پیشرفته 🏊`,
          phone: `0912${String(i).padStart(7, '0')}`,
          coachId: `coach-${i % 5}`,
          cardUid: `RFID-CARD-${i}`,
          packageName: 'دوره بین‌المللی',
          totalSessions: 30,
          remainingSessions: 25,
          totalAttended: 5,
          tuitionFee: 3000000.50 + i,
          paidAmount: 2500000,
          debt: 500000.50 + i,
          expireDate: '2028-12-31'
        });

        transactions.push({
          id: `tx-large-${i}`,
          date: '2026-10-25T14:00:00Z',
          type: i % 2 === 0 ? 'income' : 'expense',
          title: `تراکنش بزرگ بانکی ${i} (حسابداری)`,
          amount: 2500000 + i * 10,
          method: 'pos',
          author: 'مدیریت مالی'
        });
      }

      const startTime = Date.now();
      const res = await fetch(`${baseUrl}/api/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: LARGE_SCHOOL_ID,
          licenseKey: LARGE_LICENSE_KEY,
          deviceInfo: { deviceId: 'large-sync-dev' },
          athletes,
          transactions
        })
      });
      const durationMs = Date.now() - startTime;

      assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
      const body = await res.json();
      assert.strictEqual(body.status, 'success');
      assert.strictEqual(body.synced.athletesCount, COUNT);
      assert.strictEqual(body.synced.transactionsCount, COUNT);

      // Verify physical SQLite table counts
      const countAthDb = db.prepare('SELECT count(*) as c FROM athletes WHERE school_id = ?').get(LARGE_SCHOOL_ID).c;
      const countTxDb = db.prepare('SELECT count(*) as c FROM transactions WHERE school_id = ?').get(LARGE_SCHOOL_ID).c;
      assert.strictEqual(countAthDb, COUNT);
      assert.strictEqual(countTxDb, COUNT);

      // Verify decrypted fidelity via GET /api/v1/athletes
      const resGetAth = await fetch(`${baseUrl}/api/v1/athletes?schoolId=${LARGE_SCHOOL_ID}`, {
        headers: { 'Authorization': `Bearer ${LARGE_LICENSE_KEY}` }
      });
      assert.strictEqual(resGetAth.status, 200);
      const athList = await resGetAth.json();
      assert.strictEqual(athList.length, COUNT);

      const sampleAth = athList.find(a => a.id === 'ath-large-777');
      assert.ok(sampleAth);
      assert.strictEqual(sampleAth.name, 'شناگر رکورددار شماره 777 — دوره پیشرفته 🏊');
      assert.strictEqual(sampleAth.phone, '09120000777');
      assert.strictEqual(sampleAth.tuitionFee, 3000777.50);
      assert.strictEqual(typeof sampleAth.tuitionFee, 'number');
      assert.strictEqual(sampleAth.debt, 500777.50);
      assert.strictEqual(typeof sampleAth.debt, 'number');

      // Verify raw SQLite inspection: zero plaintext leaked
      const rawRow = db.prepare('SELECT * FROM athletes WHERE school_id = ? AND id = ?').get(LARGE_SCHOOL_ID, 'ath-large-777');
      assert.match(rawRow.name_encrypted, CIPHER_REGEX);
      assert.match(rawRow.phone_encrypted, CIPHER_REGEX);
      assert.ok(!rawRow.name_encrypted.includes('شناگر رکورددار'));
      assert.ok(!rawRow.phone_encrypted.includes('09120000777'));

      console.log(`Large payload synchronization (${COUNT * 2} entities) completed in ${durationMs}ms`);
    });
  });

  // =========================================================================
  // Challenge Area 4: Hardened Security Verification - HTTP 400 Rejections & Zero Stack Leakage
  // =========================================================================
  describe('Area 4: Hardened Security Verification - HTTP 400 Rejections & Zero Stack Leakage', () => {
    it('4.1 Non-string ID in sync item rejected with HTTP 400 VALIDATION_FAILED and zero stack leakage', async () => {
      const res = await fetch(`${baseUrl}/api/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${TEST_SCHOOL_ID}:${TEST_LICENSE_KEY}`
        },
        body: JSON.stringify({
          schoolId: TEST_SCHOOL_ID,
          licenseKey: TEST_LICENSE_KEY,
          deviceInfo: { deviceId: 'crash-dev-01' },
          athletes: [
            { id: { object_id: 'non-string' }, name: 'Ali', phone: '0912' }
          ]
        })
      });

      const text = await res.text();
      assert.strictEqual(res.status, 400, `Non-string ID must return 400 Bad Request, got ${res.status}`);
      assert.notStrictEqual(res.status, 500, 'Must NOT crash with HTTP 500');

      const json = JSON.parse(text);
      assert.strictEqual(json.error, 'VALIDATION_FAILED', 'Error code must be VALIDATION_FAILED');
      assert.strictEqual(json.stack, undefined, 'VULNERABILITY RESOLVED: Stack trace must not leak to client');
    });

    it('4.2 Non-string ID in POST /api/v1/athletes rejected with HTTP 400 VALIDATION_FAILED and zero stack leakage', async () => {
      const res = await fetch(`${baseUrl}/api/v1/athletes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${TEST_SCHOOL_ID}:${TEST_LICENSE_KEY}`
        },
        body: JSON.stringify({
          id: { nested: 'id' },
          name: 'Ali',
          phone: '0912'
        })
      });

      const text = await res.text();
      assert.strictEqual(res.status, 400, `Non-string ID to /api/v1/athletes must return 400 Bad Request, got ${res.status}`);
      assert.notStrictEqual(res.status, 500, 'Must NOT crash with HTTP 500');

      const json = JSON.parse(text);
      assert.strictEqual(json.error, 'VALIDATION_FAILED', 'Error code must be VALIDATION_FAILED');
      assert.strictEqual(json.stack, undefined, 'VULNERABILITY RESOLVED: Stack trace must not leak to client');
    });

    it('4.3 Missing date in POST /api/v1/transactions rejected with HTTP 400 VALIDATION_FAILED and zero stack leakage', async () => {
      const res = await fetch(`${baseUrl}/api/v1/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${TEST_SCHOOL_ID}:${TEST_LICENSE_KEY}`
        },
        body: JSON.stringify({
          id: 'tx-missing-date',
          // date is omitted
          title: 'شهریه بدون تاریخ',
          amount: 500000,
          type: 'income'
        })
      });

      const text = await res.text();
      assert.strictEqual(res.status, 400, `Missing date in /api/v1/transactions must return 400 Bad Request, got ${res.status}`);
      assert.notStrictEqual(res.status, 500, 'Must NOT crash with HTTP 500');

      const json = JSON.parse(text);
      assert.strictEqual(json.error, 'VALIDATION_FAILED', 'Error code must be VALIDATION_FAILED');
      assert.strictEqual(json.stack, undefined, 'VULNERABILITY RESOLVED: Stack trace must not leak to client');
    });

    it('4.4 /api/v1/* endpoints reject prototype pollution with HTTP 400 SECURITY_VIOLATION', async () => {
      const res = await fetch(`${baseUrl}/api/v1/athletes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${TEST_SCHOOL_ID}:${TEST_LICENSE_KEY}`
        },
        body: JSON.stringify({
          id: 'ath-proto-accept',
          name: 'ورزشکار پرولوشن',
          phone: '09123334455'
        }).replace('}', ',"__proto__":{"injected":true}}')
      });

      assert.strictEqual(res.status, 400, `Prototype pollution to /api/v1/athletes must return 400 Bad Request, got ${res.status}`);
      assert.notStrictEqual(res.status, 200, 'Must NOT accept prototype pollution with HTTP 200');

      const json = await res.json();
      assert.strictEqual(json.error, 'SECURITY_VIOLATION', 'Error code must be SECURITY_VIOLATION');
      assert.strictEqual(json.stack, undefined, 'VULNERABILITY RESOLVED: Stack trace must not leak to client');
    });
  });
});
