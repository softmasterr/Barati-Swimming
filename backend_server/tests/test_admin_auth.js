/**
 * Test Suite: Admin Authentication, TOTP 2FA, and School License Management
 * Tests Argon2id password hashing, mandatory Google Authenticator TOTP 2FA,
 * IP lockout defenses, license issuance, renewal, and remote revocation.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { authenticator } from 'otplib';
import { app } from '../src/app.js';
import { initDatabase, closeDatabase } from '../src/db/database.js';
import { adminRepo } from '../src/db/repositories/adminRepo.js';
import { licenseRepo } from '../src/db/repositories/licenseRepo.js';

describe('Admin Authentication & License Management with TOTP 2FA', () => {
  const testDbPath = path.resolve(process.cwd(), 'data', 'test_admin_auth.db');
  let server;
  let baseUrl;
  let db;

  const ADMIN_USER = 'superadmin_test';
  const ADMIN_PASS = 'P@sswordSecure2026!';
  let totpSecret;
  let sessionToken;
  let sessionCookie;

  before(async () => {
    closeDatabase();
    try { fs.unlinkSync(testDbPath); } catch {}
    try { fs.unlinkSync(testDbPath + '-wal'); } catch {}
    try { fs.unlinkSync(testDbPath + '-shm'); } catch {}

    db = initDatabase(testDbPath);

    // Create test admin
    await adminRepo.createAdmin({
      username: ADMIN_USER,
      password: ADMIN_PASS,
      role: 'superadmin'
    });

    server = app.listen(0);
    const addr = server.address();
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  after(() => {
    if (server) server.close();
    closeDatabase();
    try { fs.unlinkSync(testDbPath); } catch {}
    try { fs.unlinkSync(testDbPath + '-wal'); } catch {}
    try { fs.unlinkSync(testDbPath + '-shm'); } catch {}
  });

  it('1. Rejects invalid credentials with HTTP 401', async () => {
    const res = await fetch(`${baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: ADMIN_USER, password: 'WrongPassword123!' })
    });

    assert.strictEqual(res.status, 401);
    const body = await res.json();
    assert.strictEqual(body.error, 'INVALID_CREDENTIALS');
  });

  it('2. Enforces account lockout after 5 consecutive failed logins', async () => {
    const LOCK_USER = 'lockout_test_admin';
    const LOCKOUT_IP = '198.51.100.99';
    await adminRepo.createAdmin({
      username: LOCK_USER,
      password: 'InitialPassword123!',
      role: 'superadmin'
    });

    // 4 failed attempts from LOCKOUT_IP
    for (let i = 0; i < 4; i++) {
      const res = await fetch(`${baseUrl}/api/admin/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': LOCKOUT_IP
        },
        body: JSON.stringify({ username: LOCK_USER, password: 'bad-password' })
      });
      assert.strictEqual(res.status, 401);
    }

    // 5th attempt locks the IP / account
    const res5 = await fetch(`${baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': LOCKOUT_IP
      },
      body: JSON.stringify({ username: LOCK_USER, password: 'bad-password' })
    });
    assert.strictEqual(res5.status, 429);
    const body5 = await res5.json();
    assert.ok(body5.error === 'IP_LOCKED_OUT' || body5.error === 'ACCOUNT_LOCKED');

    // 6th attempt is blocked even with correct password from locked IP
    const res6 = await fetch(`${baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': LOCKOUT_IP
      },
      body: JSON.stringify({ username: LOCK_USER, password: 'InitialPassword123!' })
    });
    assert.strictEqual(res6.status, 429);
  });

  it('3. Successful password verification on new admin requires 2FA Setup', async () => {
    const res = await fetch(`${baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: ADMIN_USER, password: ADMIN_PASS })
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.status, '2FA_SETUP_REQUIRED');
    assert.ok(body.tempToken, 'Must issue temporary token for 2FA setup');

    // Setup 2FA
    const setupRes = await fetch(`${baseUrl}/api/admin/2fa/setup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${body.tempToken}`
      }
    });

    assert.strictEqual(setupRes.status, 200);
    const setupBody = await setupRes.json();
    assert.strictEqual(setupBody.status, 'SUCCESS');
    assert.ok(setupBody.secret, 'Must return TOTP secret');
    assert.ok(setupBody.qrCodeUrl.startsWith('data:image/png;base64,'), 'Must return QR code data URL');

    totpSecret = setupBody.secret;

    // Verify with invalid 6-digit code
    const badCodeRes = await fetch(`${baseUrl}/api/admin/2fa/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${body.tempToken}`
      },
      body: JSON.stringify({ code: '000000' })
    });
    assert.strictEqual(badCodeRes.status, 401);

    // Verify with valid TOTP code
    const validCode = authenticator.generate(totpSecret);
    const verifyRes = await fetch(`${baseUrl}/api/admin/2fa/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${body.tempToken}`
      },
      body: JSON.stringify({ code: validCode })
    });

    assert.strictEqual(verifyRes.status, 200);
    const verifyBody = await verifyRes.json();
    assert.strictEqual(verifyBody.status, 'AUTHENTICATED');
    assert.ok(verifyBody.token, 'Must return authenticated session token');

    sessionToken = verifyBody.token;
    sessionCookie = verifyRes.headers.get('set-cookie');
    assert.ok(sessionCookie, 'Must set session cookie');
  });

  it('4. Protected admin routes accept session token and return system statistics', async () => {
    const res = await fetch(`${baseUrl}/api/admin/stats`, {
      headers: {
        Authorization: `Bearer ${sessionToken}`
      }
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.status, 'success');
    assert.ok(body.stats !== undefined);
  });

  it('5. Admin issues new school license and syncs successfully', async () => {
    const schoolData = {
      schoolId: 'shiraz-swimming-club',
      academyName: 'باشگاه شنا شیراز',
      contactPhone: '09171112233',
      expiryDate: '2028-12-31T23:59:59Z',
      maxDevices: 5
    };

    const createRes = await fetch(`${baseUrl}/api/admin/licenses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionToken}`
      },
      body: JSON.stringify(schoolData)
    });

    assert.strictEqual(createRes.status, 201);
    const createBody = await createRes.json();
    assert.strictEqual(createBody.status, 'SUCCESS');
    assert.strictEqual(createBody.license.schoolId, schoolData.schoolId);
    assert.ok(createBody.license.licenseKey, 'Must generate and return unencrypted key for school setup');

    const licenseKey = createBody.license.licenseKey;

    // Mobile sync works for newly created school
    const syncRes = await fetch(`${baseUrl}/api/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-School-Id': schoolData.schoolId,
        'X-License-Key': licenseKey
      },
      body: JSON.stringify({
        schoolId: schoolData.schoolId,
        licenseKey,
        deviceInfo: { deviceId: 'shiraz-tablet-01' },
        athletes: [
          {
            id: 'ath-shiraz-01',
            name: 'سهراب مرادی',
            phone: '09170001122',
            coachId: 'coach-01',
            packageName: 'دوره طلایی',
            totalSessions: 12,
            remainingSessions: 10,
            totalAttended: 2,
            tuitionFee: 2500000,
            paidAmount: 2500000,
            debt: 0,
            expireDate: '2027-01-01'
          }
        ]
      })
    });

    assert.strictEqual(syncRes.status, 200);

    // Admin renews license
    const renewRes = await fetch(`${baseUrl}/api/admin/licenses/${schoolData.schoolId}/renew`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionToken}`
      },
      body: JSON.stringify({ newExpiryDate: '2030-01-01T00:00:00Z' })
    });
    assert.strictEqual(renewRes.status, 200);

    // Admin remotely deactivates license
    const deactivateRes = await fetch(`${baseUrl}/api/admin/licenses/${schoolData.schoolId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${sessionToken}`
      }
    });
    assert.strictEqual(deactivateRes.status, 200);

    // Subsequent sync request from deactivated school is immediately blocked with HTTP 403 Forbidden
    const blockedSyncRes = await fetch(`${baseUrl}/api/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-School-Id': schoolData.schoolId,
        'X-License-Key': licenseKey
      },
      body: JSON.stringify({
        schoolId: schoolData.schoolId,
        licenseKey,
        athletes: []
      })
    });
    assert.strictEqual(blockedSyncRes.status, 403);
    const blockedBody = await blockedSyncRes.json();
    assert.strictEqual(blockedBody.error, 'LICENSE_FORBIDDEN');
  });

  it('6. Audit logs record all administrative operations', async () => {
    const res = await fetch(`${baseUrl}/api/admin/audit-logs`, {
      headers: {
        Authorization: `Bearer ${sessionToken}`
      }
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.status, 'success');
    assert.ok(body.logs.length >= 3, 'Audit logs must capture login, license creation, and revocation');

    const actions = body.logs.map(l => l.action);
    assert.ok(actions.includes('CREATE_LICENSE'));
    assert.ok(actions.includes('DEACTIVATE_LICENSE'));
  });
});
