/**
 * Milestone 2 Comprehensive Verification Suite:
 * Mobile Sync Roundtrip, Encrypted Persistence, Transparent Decryption,
 * Remote License Deactivation (AC-6), Expiration, and Device Tracking.
 *
 * Can be run via:
 * node --test tests/test_sync.js
 * npm test
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { app } from '../src/app.js';
import { initDatabase, closeDatabase } from '../src/db/database.js';
import { licenseRepo } from '../src/db/repositories/licenseRepo.js';
import { athleteRepo } from '../src/db/repositories/athleteRepo.js';
import { attendanceRepo } from '../src/db/repositories/attendanceRepo.js';
import { transactionRepo } from '../src/db/repositories/transactionRepo.js';

const CIPHER_REGEX = /^[0-9a-fA-F]{24}:[0-9a-fA-F]{32}:[0-9a-fA-F]+$/;

describe('Milestone 2: Mobile Sync API & Remote License Enforcement', () => {
  const testDbPath = path.resolve(process.cwd(), 'data', 'test_sync.db');
  let server;
  let baseUrl;
  let db;

  const ACTIVE_SCHOOL_ID = 'barati-active-pool';
  const ACTIVE_LICENSE_KEY = 'LIC-ACTIVE-2026-KEY';
  const DEACT_SCHOOL_ID = 'barati-deact-pool';
  const DEACT_LICENSE_KEY = 'LIC-DEACT-2026-KEY';
  const EXPIRED_SCHOOL_ID = 'barati-expired-pool';
  const EXPIRED_LICENSE_KEY = 'LIC-EXPIRED-2026-KEY';
  const LIMITED_SCHOOL_ID = 'barati-limited-pool';
  const LIMITED_LICENSE_KEY = 'LIC-LIMITED-2026-KEY';

  before(async () => {
    // 1. Clean test DB
    closeDatabase();
    try { fs.unlinkSync(testDbPath); } catch {}
    try { fs.unlinkSync(testDbPath + '-wal'); } catch {}
    try { fs.unlinkSync(testDbPath + '-shm'); } catch {}

    // 2. Initialize isolated test database
    db = initDatabase(testDbPath);

    // 3. Seed test licenses
    licenseRepo.create({
      schoolId: ACTIVE_SCHOOL_ID,
      academyName: 'آکادمی فعال براتی',
      licenseKey: ACTIVE_LICENSE_KEY,
      contactPhone: '09121111111',
      expiryDate: '2028-12-31T23:59:59Z',
      maxDevices: 3
    });

    licenseRepo.create({
      schoolId: DEACT_SCHOOL_ID,
      academyName: 'آکادمی غیرفعال',
      licenseKey: DEACT_LICENSE_KEY,
      contactPhone: '09122222222',
      expiryDate: '2028-12-31T23:59:59Z',
      maxDevices: 2
    });
    licenseRepo.deactivate(DEACT_SCHOOL_ID);

    licenseRepo.create({
      schoolId: EXPIRED_SCHOOL_ID,
      academyName: 'آکادمی منقضی شده',
      licenseKey: EXPIRED_LICENSE_KEY,
      contactPhone: '09123333333',
      expiryDate: '2020-01-01T00:00:00Z',
      maxDevices: 2
    });

    licenseRepo.create({
      schoolId: LIMITED_SCHOOL_ID,
      academyName: 'آکادمی تک‌دستگاه',
      licenseKey: LIMITED_LICENSE_KEY,
      contactPhone: '09124444444',
      expiryDate: '2028-12-31T23:59:59Z',
      maxDevices: 1
    });

    // 4. Start HTTP test server on ephemeral port (port 0)
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

  // --------------------------------------------------------------------------
  // Suite 1: Healthcheck & Service Status
  // --------------------------------------------------------------------------
  describe('1. Service Health Endpoint', () => {
    it('1.1 GET /health returns HTTP 200 with uptime and healthy status', async () => {
      const res = await fetch(`${baseUrl}/health`);
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.status, 'healthy');
      assert.ok(typeof body.uptime === 'number');
      assert.ok(body.timestamp);
    });
  });

  // --------------------------------------------------------------------------
  // Suite 2: Mobile Sync Payload Roundtrip & Encrypted Persistence (Verif 4)
  // --------------------------------------------------------------------------
  describe('2. Mobile Sync Payload Roundtrip & Field-Level Encryption (Verification 4)', () => {
    const syncPayload = {
      schoolId: ACTIVE_SCHOOL_ID,
      licenseKey: ACTIVE_LICENSE_KEY,
      timestamp: '2026-10-25T16:00:00Z',
      deviceInfo: {
        deviceId: 'device-mobile-01',
        deviceModel: 'Samsung Galaxy S23',
        appVersion: '1.2.0'
      },
      athletes: [
        {
          id: 'ath-test-101',
          name: 'محمد رضایی',
          phone: '09123456789',
          coachId: 'coach-01',
          cardUid: 'C4D3E2F1',
          packageName: 'شنای پیشرفته ۱۲ جلسه',
          totalSessions: 12,
          remainingSessions: 10,
          totalAttended: 2,
          tuitionFee: 3000000,
          paidAmount: 2500000,
          debt: 500000,
          expireDate: '2026-12-30'
        }
      ],
      attendanceLogs: [
        {
          id: 'att-test-201',
          time: '2026-10-25T15:30:00Z',
          athleteName: 'محمد رضایی',
          coachName: 'استاد علی براتی',
          status: 'approved',
          sessionsLeft: 10,
          note: 'ورود مجاز با کارت هوشمند'
        }
      ],
      transactions: [
        {
          id: 'tx-test-301',
          date: '2026-10-25T14:00:00Z',
          type: 'income',
          title: 'شهریه دوره پیشرفته - محمد رضایی',
          amount: 2500000,
          method: 'pos',
          author: 'مسئول ثبت‌نام'
        }
      ]
    };

    it('2.1 POST /api/sync accepts valid payload and returns HTTP 200 with synced stats', async () => {
      const res = await fetch(`${baseUrl}/api/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(syncPayload)
      });

      assert.strictEqual(res.status, 200, `Expected 200 OK, got ${res.status}`);
      const json = await res.json();
      assert.strictEqual(json.status, 'success');
      assert.ok(json.serverTimestamp);
      assert.strictEqual(json.synced.athletesCount, 1);
      assert.strictEqual(json.synced.attendanceCount, 1);
      assert.strictEqual(json.synced.transactionsCount, 1);
    });

    it('2.2 Database Inspection: sensitive fields are stored strictly as ciphertext tokens', () => {
      // Query raw database row bypassing domain repositories
      const rawAthlete = db.prepare('SELECT * FROM athletes WHERE school_id = ? AND id = ?')
        .get(ACTIVE_SCHOOL_ID, 'ath-test-101');
      assert.ok(rawAthlete, 'Raw athlete record must exist in SQLite database');

      assert.match(rawAthlete.name_encrypted, CIPHER_REGEX, 'Athlete name must be AES-256-GCM token');
      assert.match(rawAthlete.phone_encrypted, CIPHER_REGEX, 'Athlete phone must be AES-256-GCM token');
      assert.match(rawAthlete.card_uid_encrypted, CIPHER_REGEX, 'Card UID must be AES-256-GCM token');
      assert.match(rawAthlete.tuition_fee_encrypted, CIPHER_REGEX, 'Tuition fee must be AES-256-GCM token');
      assert.match(rawAthlete.paid_amount_encrypted, CIPHER_REGEX, 'Paid amount must be AES-256-GCM token');
      assert.match(rawAthlete.debt_encrypted, CIPHER_REGEX, 'Debt must be AES-256-GCM token');

      // Verify no plaintext leakage in table columns
      assert.ok(!rawAthlete.name_encrypted.includes('محمد'));
      assert.ok(!rawAthlete.phone_encrypted.includes('09123456789'));

      // Check attendance raw row
      const rawAtt = db.prepare('SELECT * FROM attendance_logs WHERE school_id = ? AND id = ?')
        .get(ACTIVE_SCHOOL_ID, 'att-test-201');
      assert.match(rawAtt.athlete_name_encrypted, CIPHER_REGEX);
      assert.match(rawAtt.note_encrypted, CIPHER_REGEX);

      // Check transaction raw row
      const rawTx = db.prepare('SELECT * FROM transactions WHERE school_id = ? AND id = ?')
        .get(ACTIVE_SCHOOL_ID, 'tx-test-301');
      assert.match(rawTx.title_encrypted, CIPHER_REGEX);
      assert.match(rawTx.amount_encrypted, CIPHER_REGEX);
      assert.match(rawTx.author_encrypted, CIPHER_REGEX);
    });

    it('2.3 Physical Disk Audit: database binary contains zero UTF-8 plaintext bytes', () => {
      db.exec('PRAGMA wal_checkpoint(FULL);');
      const diskBytes = fs.readFileSync(testDbPath);

      assert.ok(!diskBytes.includes(Buffer.from('محمد رضایی', 'utf8')), 'Plaintext name leaked to disk!');
      assert.ok(!diskBytes.includes(Buffer.from('09123456789', 'utf8')), 'Plaintext phone leaked to disk!');
      assert.ok(!diskBytes.includes(Buffer.from('شهریه دوره پیشرفته', 'utf8')), 'Plaintext title leaked to disk!');
    });

    it('2.4 GET /api/v1/athletes transparently decrypts fields and restores numerical primitives', async () => {
      const res = await fetch(`${baseUrl}/api/v1/athletes?schoolId=${ACTIVE_SCHOOL_ID}`, {
        headers: { 'Authorization': `Bearer ${ACTIVE_LICENSE_KEY}` }
      });

      assert.strictEqual(res.status, 200);
      const athletes = await res.json();
      assert.ok(Array.isArray(athletes));
      const ath = athletes.find(a => a.id === 'ath-test-101');
      assert.ok(ath);
      assert.strictEqual(ath.name, 'محمد رضایی');
      assert.strictEqual(ath.phone, '09123456789');
      assert.strictEqual(ath.tuitionFee, 3000000);
      assert.strictEqual(typeof ath.tuitionFee, 'number');
      assert.strictEqual(ath.paidAmount, 2500000);
      assert.strictEqual(ath.debt, 500000);
    });

    it('2.5 GET /api/v1/transactions returns transparently decrypted financial records', async () => {
      const res = await fetch(`${baseUrl}/api/v1/transactions?schoolId=${ACTIVE_SCHOOL_ID}`, {
        headers: { 'Authorization': `Bearer ${ACTIVE_LICENSE_KEY}` }
      });

      assert.strictEqual(res.status, 200);
      const txs = await res.json();
      const tx = txs.find(t => t.id === 'tx-test-301');
      assert.ok(tx);
      assert.strictEqual(tx.title, 'شهریه دوره پیشرفته - محمد رضایی');
      assert.strictEqual(tx.amount, 2500000);
      assert.strictEqual(typeof tx.amount, 'number');
      assert.strictEqual(tx.author, 'مسئول ثبت‌نام');
    });

    it('2.6 Idempotent Upsert & Delta Sync updates existing records correctly', async () => {
      const updatedPayload = {
        ...syncPayload,
        athletes: [
          {
            ...syncPayload.athletes[0],
            paidAmount: 3000000,
            debt: 0
          }
        ]
      };

      const res = await fetch(`${baseUrl}/api/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedPayload)
      });
      assert.strictEqual(res.status, 200);

      const ath = athleteRepo.findById(ACTIVE_SCHOOL_ID, 'ath-test-101');
      assert.strictEqual(ath.paidAmount, 3000000);
      assert.strictEqual(ath.debt, 0);
    });
  });

  // --------------------------------------------------------------------------
  // Suite 3: Remote License Deactivation Rejection (Verification 5 / AC-6)
  // --------------------------------------------------------------------------
  describe('3. Remote License Deactivation Enforcement (AC-6 / Verification 5)', () => {
    it('3.1 Deactivating active license rejects subsequent sync with HTTP 403 Forbidden', async () => {
      // 1. Initial sync works
      const initialRes = await fetch(`${baseUrl}/api/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: ACTIVE_SCHOOL_ID,
          licenseKey: ACTIVE_LICENSE_KEY,
          deviceInfo: { deviceId: 'dev-01' }
        })
      });
      assert.strictEqual(initialRes.status, 200);

      // 2. Deactivate school license remotely via repository
      const deactivated = licenseRepo.deactivate(ACTIVE_SCHOOL_ID);
      assert.strictEqual(deactivated, true);

      // 3. Subsequent sync must be rejected with HTTP 403
      const blockedRes = await fetch(`${baseUrl}/api/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: ACTIVE_SCHOOL_ID,
          licenseKey: ACTIVE_LICENSE_KEY,
          deviceInfo: { deviceId: 'dev-01' }
        })
      });

      assert.strictEqual(blockedRes.status, 403);
      const errorBody = await blockedRes.json();
      assert.strictEqual(errorBody.error, 'LICENSE_FORBIDDEN');
      assert.ok(errorBody.message.includes('غیرفعال') || errorBody.message.includes('منقضی'));

      // 4. Restore active status for remaining tests
      licenseRepo.renew(ACTIVE_SCHOOL_ID, '2028-12-31T23:59:59Z');
    });

    it('3.2 Pre-deactivated school license is rejected immediately with HTTP 403', async () => {
      const res = await fetch(`${baseUrl}/api/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: DEACT_SCHOOL_ID,
          licenseKey: DEACT_LICENSE_KEY,
          deviceInfo: { deviceId: 'dev-deact' }
        })
      });

      assert.strictEqual(res.status, 403);
      const body = await res.json();
      assert.strictEqual(body.error, 'LICENSE_FORBIDDEN');
    });

    it('3.3 Deactivated license is rejected on dedicated REST endpoints with HTTP 403', async () => {
      const res = await fetch(`${baseUrl}/api/v1/athletes?schoolId=${DEACT_SCHOOL_ID}`, {
        headers: { 'Authorization': `Bearer ${DEACT_LICENSE_KEY}` }
      });
      assert.strictEqual(res.status, 403);
    });
  });

  // --------------------------------------------------------------------------
  // Suite 4: Expired License Rejection
  // --------------------------------------------------------------------------
  describe('4. Expired Subscription License Rejection', () => {
    it('4.1 Expired license returns HTTP 403 Forbidden with LICENSE_FORBIDDEN error', async () => {
      const res = await fetch(`${baseUrl}/api/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: EXPIRED_SCHOOL_ID,
          licenseKey: EXPIRED_LICENSE_KEY,
          deviceInfo: { deviceId: 'dev-expired' }
        })
      });

      assert.strictEqual(res.status, 403);
      const body = await res.json();
      assert.strictEqual(body.error, 'LICENSE_FORBIDDEN');
    });

    it('4.2 Expired license blocked on dedicated GET/POST endpoints', async () => {
      const res = await fetch(`${baseUrl}/api/v1/transactions?schoolId=${EXPIRED_SCHOOL_ID}`, {
        headers: { 'Authorization': `Bearer ${EXPIRED_LICENSE_KEY}` }
      });
      assert.strictEqual(res.status, 403);
    });
  });

  // --------------------------------------------------------------------------
  // Suite 5: School Device Tracking & Max Device Limits
  // --------------------------------------------------------------------------
  describe('5. Mobile Device Tracking & Limit Enforcement', () => {
    it('5.1 First sync successfully registers device in license devices_json', async () => {
      const res = await fetch(`${baseUrl}/api/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: LIMITED_SCHOOL_ID,
          licenseKey: LIMITED_LICENSE_KEY,
          deviceInfo: {
            deviceId: 'dev-tablet-primary',
            deviceModel: 'iPad Pro 11',
            appVersion: '1.2.0'
          }
        })
      });

      assert.strictEqual(res.status, 200);
      const lic = licenseRepo.findBySchoolId(LIMITED_SCHOOL_ID);
      assert.strictEqual(lic.devices.length, 1);
      assert.strictEqual(lic.devices[0].deviceId, 'dev-tablet-primary');
      assert.ok(lic.devices[0].registeredAt);
      assert.ok(lic.devices[0].lastSeenAt);
    });

    it('5.2 Re-syncing from existing registered device updates lastSeenAt without count increase', async () => {
      const res = await fetch(`${baseUrl}/api/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: LIMITED_SCHOOL_ID,
          licenseKey: LIMITED_LICENSE_KEY,
          deviceInfo: {
            deviceId: 'dev-tablet-primary',
            deviceModel: 'iPad Pro 11 Updated',
            appVersion: '1.2.1'
          }
        })
      });

      assert.strictEqual(res.status, 200);
      const lic = licenseRepo.findBySchoolId(LIMITED_SCHOOL_ID);
      assert.strictEqual(lic.devices.length, 1, 'Device count must remain 1');
    });

    it('5.3 Registering new device exceeding maxDevices returns HTTP 403 Forbidden', async () => {
      const res = await fetch(`${baseUrl}/api/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: LIMITED_SCHOOL_ID,
          licenseKey: LIMITED_LICENSE_KEY,
          deviceInfo: {
            deviceId: 'dev-phone-unauthorized-second',
            deviceModel: 'Xiaomi Redmi',
            appVersion: '1.2.1'
          }
        })
      });

      assert.strictEqual(res.status, 403);
      const body = await res.json();
      assert.strictEqual(body.error, 'LICENSE_FORBIDDEN');
      assert.strictEqual(body.reason, 'MAX_DEVICES_EXCEEDED');

      // Ensure unauthorized device was NOT registered
      const lic = licenseRepo.findBySchoolId(LIMITED_SCHOOL_ID);
      assert.strictEqual(lic.devices.length, 1);
    });
  });
});
