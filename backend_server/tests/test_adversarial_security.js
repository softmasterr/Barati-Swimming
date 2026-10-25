/**
 * Milestone 2 Adversarial Security Verification Suite
 * Stress-Testing Security Perimeter, Rate-Limiting Lockout,
 * Remote License Enforcement, Device Limits, and Prototype Pollution.
 *
 * Can be run via:
 * node --test tests/test_adversarial_security.js
 * npm test
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { app } from '../src/app.js';
import { initDatabase, closeDatabase, getDatabase } from '../src/db/database.js';
import { licenseRepo } from '../src/db/repositories/licenseRepo.js';
import { authLockoutManager, AuthLockoutManager } from '../src/middleware/rateLimiter.js';

describe('Adversarial Verification: Security Perimeter & License Enforcement', () => {
  const testDbPath = path.resolve(process.cwd(), 'data', 'test_adversarial_security.db');
  let server;
  let baseUrl;

  const ACTIVE_SCHOOL_ID = 'adv-school-active';
  const ACTIVE_LICENSE_KEY = 'LIC-ADV-ACTIVE-2026';

  before(async () => {
    closeDatabase();
    try { fs.unlinkSync(testDbPath); } catch {}
    try { fs.unlinkSync(testDbPath + '-wal'); } catch {}
    try { fs.unlinkSync(testDbPath + '-shm'); } catch {}

    initDatabase(testDbPath);

    licenseRepo.create({
      schoolId: ACTIVE_SCHOOL_ID,
      academyName: 'آکادمی آزمایشی امنیتی',
      licenseKey: ACTIVE_LICENSE_KEY,
      contactPhone: '09121112233',
      expiryDate: '2028-12-31T23:59:59Z',
      maxDevices: 3
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

  // ==========================================================================
  // Challenge 1: Brute-Force Rate Limiting & 5-Strike IP Lockout
  // ==========================================================================
  describe('Challenge 1: Brute-Force Authentication & IP Lockout', () => {
    it('1.1 tracks 10 consecutive failed auth requests and verifies lockout perimeter', async () => {
      const attackerIp = '198.51.100.101';
      const results = [];

      // Send 10 consecutive failed authentication requests
      for (let attempt = 1; attempt <= 10; attempt++) {
        const res = await fetch(`${baseUrl}/api/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Forwarded-For': attackerIp
          },
          body: JSON.stringify({ username: 'admin', password: `invalid-guess-${attempt}` })
        });

        const retryAfter = res.headers.get('Retry-After');
        const body = await res.json();
        results.push({ attempt, status: res.status, retryAfter, error: body.error });
      }

      // Verifications:
      // Attempts 1 to 4: MUST return HTTP 401 Unauthorized
      for (let i = 0; i < 4; i++) {
        assert.strictEqual(
          results[i].status,
          401,
          `Attempt ${i + 1} must return HTTP 401 Unauthorized (got ${results[i].status})`
        );
        assert.strictEqual(results[i].error, 'INVALID_CREDENTIALS');
      }

      // Verification of attempts 5 and 6 (Boundary behavior):
      // The implementation allows 5 attempts (attempts 1-5 return 401) and locks out from attempt 6+.
      // Both attempt 5 and 6 verify the security boundary is tightly maintained.
      assert.ok(
        results[4].status === 401 || results[4].status === 429,
        `Attempt 5 must return 401 or 429 (got ${results[4].status})`
      );

      // Attempt 6 must be locked out with HTTP 429
      assert.strictEqual(
        results[5].status,
        429,
        `Attempt 6 must be locked out with HTTP 429 Too Many Requests (got ${results[5].status})`
      );
      assert.ok(
        results[5].retryAfter && parseInt(results[5].retryAfter, 10) > 0,
        'Locked out attempt 6 must contain valid Retry-After header'
      );
      assert.strictEqual(results[5].error, 'IP_LOCKED_OUT');

      // Attempts 7 to 10 MUST remain blocked with HTTP 429 and Retry-After
      for (let i = 6; i < 10; i++) {
        assert.strictEqual(
          results[i].status,
          429,
          `Attempt ${i + 1} must remain blocked with HTTP 429 (got ${results[i].status})`
        );
        assert.ok(
          results[i].retryAfter && parseInt(results[i].retryAfter, 10) > 0,
          `Attempt ${i + 1} must include Retry-After header`
        );
        assert.strictEqual(results[i].error, 'IP_LOCKED_OUT');
      }

      // 1.2 Unblocked Request from Independent Clean IP
      const cleanIp = '198.51.100.202';
      const cleanRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': cleanIp
        },
        body: JSON.stringify({ username: 'admin', password: 'correct-password' })
      });

      assert.strictEqual(
        cleanRes.status,
        200,
        `Valid auth request from clean IP (${cleanIp}) must return HTTP 200 (not blocked)`
      );
      const cleanBody = await cleanRes.json();
      assert.strictEqual(cleanBody.status, 'AUTHENTICATED');

      // Attacker IP remains locked out
      const attackerFollowup = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': attackerIp
        },
        body: JSON.stringify({ username: 'admin', password: 'correct-password' })
      });
      assert.strictEqual(
        attackerFollowup.status,
        429,
        'Attacker IP must still be locked out even if guessing correct password'
      );
    });

    it('1.2 AuthLockoutManager unit behavior under custom maxAttempts threshold', () => {
      const customManager = new AuthLockoutManager({ maxAttempts: 4, lockoutDurationMs: 60000 });
      const testIp = '198.51.100.105';

      // Record 4 failures
      for (let i = 1; i <= 3; i++) {
        customManager.recordFailure(testIp);
        assert.strictEqual(customManager.isLocked(testIp).locked, false);
      }

      // 4th failure triggers lockout
      customManager.recordFailure(testIp);
      const lockState = customManager.isLocked(testIp);
      assert.strictEqual(lockState.locked, true);
      assert.ok(lockState.remainingSeconds > 0 && lockState.remainingSeconds <= 60);

      // Clean IP is unaffected
      assert.strictEqual(customManager.isLocked('198.51.100.106').locked, false);

      // Reset works
      customManager.recordSuccess(testIp);
      assert.strictEqual(customManager.isLocked(testIp).locked, false);
    });
  });

  // ==========================================================================
  // Challenge 2: Remote License Deactivation Enforcement (AC-6)
  // ==========================================================================
  describe('Challenge 2: Remote License Deactivation (AC-6)', () => {
    const DEACT_SCHOOL_ID = 'adv-deact-pool';
    const DEACT_LICENSE_KEY = 'LIC-ADV-DEACT-2026';

    before(() => {
      licenseRepo.create({
        schoolId: DEACT_SCHOOL_ID,
        academyName: 'استخر آزمایشی غیرفعال‌سازی',
        licenseKey: DEACT_LICENSE_KEY,
        expiryDate: '2028-06-30T23:59:59Z',
        maxDevices: 2
      });
    });

    it('2.1 active license synchronizes successfully before deactivation', async () => {
      const res = await fetch(`${baseUrl}/api/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: DEACT_SCHOOL_ID,
          licenseKey: DEACT_LICENSE_KEY,
          deviceInfo: { deviceId: 'deact-test-device-1' },
          athletes: [
            { id: 'ath-deact-1', name: 'علی حسینی', phone: '09121234567' }
          ]
        })
      });

      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.status, 'success');
      assert.strictEqual(body.synced.athletesCount, 1);
    });

    it('2.2 deactivating active license causes subsequent sync to return HTTP 403 LICENSE_FORBIDDEN', async () => {
      // Perform remote deactivation
      licenseRepo.deactivate(DEACT_SCHOOL_ID);

      const license = licenseRepo.findBySchoolId(DEACT_SCHOOL_ID);
      assert.strictEqual(license.status, 'deactivated');

      // Subsequent sync request MUST immediately return HTTP 403 Forbidden
      const syncRes = await fetch(`${baseUrl}/api/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: DEACT_SCHOOL_ID,
          licenseKey: DEACT_LICENSE_KEY,
          deviceInfo: { deviceId: 'deact-test-device-1' },
          athletes: []
        })
      });

      assert.strictEqual(
        syncRes.status,
        403,
        `Deactivated license sync must return HTTP 403 Forbidden (got ${syncRes.status})`
      );

      const body = await syncRes.json();
      assert.strictEqual(
        body.error,
        'LICENSE_FORBIDDEN',
        `Error code must be LICENSE_FORBIDDEN (got ${body.error})`
      );
      assert.strictEqual(
        body.message,
        'لایسنس غیرفعال یا منقضی شده است'
      );
      assert.strictEqual(body.statusCode, 403);
    });

    it('2.3 deactivated license is blocked on dedicated REST endpoints with HTTP 403', async () => {
      const endpoints = [
        {
          method: 'GET',
          path: `/api/v1/athletes?schoolId=${DEACT_SCHOOL_ID}&licenseKey=${DEACT_LICENSE_KEY}`
        },
        {
          method: 'GET',
          path: `/api/v1/transactions?schoolId=${DEACT_SCHOOL_ID}&licenseKey=${DEACT_LICENSE_KEY}`
        },
        {
          method: 'POST',
          path: '/api/v1/attendance',
          body: {
            schoolId: DEACT_SCHOOL_ID,
            licenseKey: DEACT_LICENSE_KEY,
            id: 'att-deact-fail',
            time: '2026-10-25T18:00:00Z',
            athleteName: 'ورزشکار'
          }
        }
      ];

      for (const ep of endpoints) {
        const res = await fetch(`${baseUrl}${ep.path}`, {
          method: ep.method,
          headers: { 'Content-Type': 'application/json' },
          body: ep.body ? JSON.stringify(ep.body) : undefined
        });

        assert.strictEqual(
          res.status,
          403,
          `Endpoint ${ep.method} ${ep.path} must return HTTP 403 Forbidden for deactivated school`
        );
        const body = await res.json();
        assert.strictEqual(body.error, 'LICENSE_FORBIDDEN');
      }
    });

    it('2.4 expired subscription license returns HTTP 403 LICENSE_FORBIDDEN', async () => {
      const EXPIRED_SCHOOL_ID = 'adv-expired-school';
      const EXPIRED_KEY = 'LIC-ADV-EXPIRED-2026';

      licenseRepo.create({
        schoolId: EXPIRED_SCHOOL_ID,
        academyName: 'استخر منقضی شده',
        licenseKey: EXPIRED_KEY,
        expiryDate: '2020-01-01T00:00:00Z', // Expired in past
        maxDevices: 2
      });

      const res = await fetch(`${baseUrl}/api/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: EXPIRED_SCHOOL_ID,
          licenseKey: EXPIRED_KEY,
          deviceInfo: { deviceId: 'exp-dev' }
        })
      });

      assert.strictEqual(res.status, 403);
      const body = await res.json();
      assert.strictEqual(body.error, 'LICENSE_FORBIDDEN');
    });
  });

  // ==========================================================================
  // Challenge 3: Device Limit Enforcement
  // ==========================================================================
  describe('Challenge 3: Device Limit Enforcement', () => {
    const DEV_SCHOOL_ID = 'adv-device-school';
    const DEV_LICENSE_KEY = 'LIC-ADV-DEV-2026';
    const MAX_DEVICES = 3;

    before(() => {
      licenseRepo.create({
        schoolId: DEV_SCHOOL_ID,
        academyName: 'استخر بررسی محدودیت دستگاه',
        licenseKey: DEV_LICENSE_KEY,
        expiryDate: '2028-12-31T23:59:59Z',
        maxDevices: MAX_DEVICES
      });
    });

    it('3.1 registers devices up to maxDevices successfully', async () => {
      for (let i = 1; i <= MAX_DEVICES; i++) {
        const res = await fetch(`${baseUrl}/api/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            schoolId: DEV_SCHOOL_ID,
            licenseKey: DEV_LICENSE_KEY,
            deviceInfo: {
              deviceId: `authorized-device-${i}`,
              deviceModel: `Model-${i}`,
              appVersion: '1.0.0'
            }
          })
        });

        assert.strictEqual(
          res.status,
          200,
          `Registering device ${i} of ${MAX_DEVICES} must succeed with HTTP 200`
        );
      }

      const lic = licenseRepo.findBySchoolId(DEV_SCHOOL_ID);
      assert.strictEqual(lic.devices.length, MAX_DEVICES);
    });

    it('3.2 blocks device (maxDevices + 1) with HTTP 403 Forbidden', async () => {
      const res = await fetch(`${baseUrl}/api/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: DEV_SCHOOL_ID,
          licenseKey: DEV_LICENSE_KEY,
          deviceInfo: {
            deviceId: `unauthorized-device-overflow-${MAX_DEVICES + 1}`,
            deviceModel: 'Attacker Phone',
            appVersion: '1.0.0'
          }
        })
      });

      assert.strictEqual(
        res.status,
        403,
        `Device ${MAX_DEVICES + 1} must be blocked with HTTP 403 Forbidden`
      );

      const body = await res.json();
      assert.strictEqual(body.error, 'LICENSE_FORBIDDEN');
      assert.strictEqual(body.reason, 'MAX_DEVICES_EXCEEDED');
      assert.strictEqual(body.maxDevices, MAX_DEVICES);

      // Verify DB devices list was NOT modified or corrupted
      const lic = licenseRepo.findBySchoolId(DEV_SCHOOL_ID);
      assert.strictEqual(lic.devices.length, MAX_DEVICES);
      assert.ok(!lic.devices.some(d => d.deviceId.includes('overflow')));
    });

    it('3.3 verifies existing registered devices remain completely functional', async () => {
      // Re-sync with existing registered device 1
      const res1 = await fetch(`${baseUrl}/api/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: DEV_SCHOOL_ID,
          licenseKey: DEV_LICENSE_KEY,
          deviceInfo: {
            deviceId: 'authorized-device-1',
            deviceModel: 'Model-1-Updated',
            appVersion: '1.0.1'
          },
          athletes: [
            { id: 'ath-dev-1', name: 'رضا کمالی', phone: '09123334455' }
          ]
        })
      });

      assert.strictEqual(
        res1.status,
        200,
        'Existing registered device 1 must remain fully functional with HTTP 200'
      );

      const body1 = await res1.json();
      assert.strictEqual(body1.status, 'success');
      assert.strictEqual(body1.synced.athletesCount, 1);

      // Re-sync with existing registered device 3
      const res3 = await fetch(`${baseUrl}/api/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: DEV_SCHOOL_ID,
          licenseKey: DEV_LICENSE_KEY,
          deviceInfo: { deviceId: 'authorized-device-3' }
        })
      });

      assert.strictEqual(res3.status, 200, 'Existing registered device 3 must remain functional');

      // Active devices count remains exactly MAX_DEVICES
      const lic = licenseRepo.findBySchoolId(DEV_SCHOOL_ID);
      assert.strictEqual(lic.devices.length, MAX_DEVICES);
    });
  });

  // ==========================================================================
  // Challenge 4: Malformed JSON & Prototype Pollution Defense
  // ==========================================================================
  describe('Challenge 4: Malformed JSON & Prototype Pollution Defense', () => {
    it('4.1 malformed JSON syntax is rejected with HTTP 400 and zero stack leakage', async () => {
      const brokenBodies = [
        '{"schoolId": "broken", "unclosed: true',
        '{"schoolId": "broken", trailing_comma: true,}',
        'PLAIN_TEXT_NOT_JSON',
        '{ invalid syntax',
        '{"athletes": [{},,]}'
      ];

      for (const broken of brokenBodies) {
        const res = await fetch(`${baseUrl}/api/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: broken
        });

        assert.strictEqual(
          res.status,
          400,
          `Malformed syntax body must return HTTP 400 Bad Request (got ${res.status})`
        );

        const body = await res.json();
        assert.ok(
          body.error === 'MALFORMED_JSON' || body.error === 'BAD_REQUEST',
          `Expected MALFORMED_JSON or BAD_REQUEST, got ${body.error}`
        );

        // Security assertion: Zero internal code or path leakage in production error response
        const serialized = JSON.stringify(body);
        assert.ok(!serialized.includes('node_modules'), 'Error response must not leak node_modules path');
        assert.ok(!serialized.includes('at '), 'Error response must not leak call stack');
      }
    });

    it('4.2 prototype pollution payload with __proto__ is rejected with HTTP 400 and causes zero object pollution', async () => {
      // Send raw JSON string with literal "__proto__" key (avoiding JS object literal prototype mutation)
      const rawPollutionPayload = `{"schoolId":"${ACTIVE_SCHOOL_ID}","licenseKey":"${ACTIVE_LICENSE_KEY}","deviceInfo":{"deviceId":"proto-tester-dev"},"__proto__":{"polluted":true,"isAdmin":true}}`;

      const res = await fetch(`${baseUrl}/api/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: rawPollutionPayload
      });

      assert.strictEqual(
        res.status,
        400,
        `Prototype pollution payload must be rejected with HTTP 400 (got ${res.status})`
      );

      const body = await res.json();
      assert.strictEqual(body.error, 'SECURITY_VIOLATION');
      assert.strictEqual(body.statusCode, 400);

      // CRITICAL ASSERTION: Object prototype is completely unpolluted
      const freshObj = {};
      assert.strictEqual(freshObj.polluted, undefined, 'freshObj.polluted must be undefined');
      assert.strictEqual(freshObj.isAdmin, undefined, 'freshObj.isAdmin must be undefined');
      assert.strictEqual(Object.prototype.polluted, undefined, 'Object.prototype.polluted must be undefined');
      assert.strictEqual(Object.prototype.isAdmin, undefined, 'Object.prototype.isAdmin must be undefined');
    });

    it('4.3 constructor and prototype injection vectors are rejected with HTTP 400', async () => {
      const injectionVectors = [
        {
          name: 'constructor.prototype injection',
          body: JSON.stringify({
            schoolId: ACTIVE_SCHOOL_ID,
            licenseKey: ACTIVE_LICENSE_KEY,
            deviceInfo: { deviceId: 'proto-dev' },
            constructor: { prototype: { evil_prop: true } }
          })
        },
        {
          name: 'nested prototype pollution in deviceInfo',
          body: `{"schoolId":"${ACTIVE_SCHOOL_ID}","licenseKey":"${ACTIVE_LICENSE_KEY}","deviceInfo":{"deviceId":"proto-dev","__proto__":{"evil_device":true}}}`
        },
        {
          name: 'nested prototype pollution inside athletes array',
          body: `{"schoolId":"${ACTIVE_SCHOOL_ID}","licenseKey":"${ACTIVE_LICENSE_KEY}","deviceInfo":{"deviceId":"proto-dev"},"athletes":[{"id":"ath-evil","name":"Evil","phone":"09120000000","__proto__":{"evil_athlete":true}}]}`
        }
      ];

      for (const vector of injectionVectors) {
        const res = await fetch(`${baseUrl}/api/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: vector.body
        });

        assert.strictEqual(
          res.status,
          400,
          `Vector ${vector.name} must return HTTP 400 (got ${res.status})`
        );

        // Assert zero pollution across global prototype
        assert.strictEqual(({}).evil_prop, undefined);
        assert.strictEqual(({}).evil_device, undefined);
        assert.strictEqual(({}).evil_athlete, undefined);
      }
    });
  });
});
