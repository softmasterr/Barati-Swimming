/**
 * Milestone 2 Comprehensive Verification Suite:
 * Security Hardening, Authentication Rejection (HTTP 401),
 * Malformed Request Rejection (HTTP 400), 5-Strike Brute-Force Lockout (AC-2 / HTTP 429),
 * and Security Perimeter Headers (Helmet).
 *
 * Can be run via:
 * node --test tests/test_security.js
 * npm test
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { app } from '../src/app.js';
import { initDatabase, closeDatabase } from '../src/db/database.js';
import { licenseRepo } from '../src/db/repositories/licenseRepo.js';
import { AuthLockoutManager } from '../src/middleware/rateLimiter.js';

describe('Milestone 2: Security Hardening, Lockout & Perimeter Defense', () => {
  const testDbPath = path.resolve(process.cwd(), 'data', 'test_security.db');
  let server;
  let baseUrl;

  const VALID_SCHOOL_ID = 'security-test-school';
  const VALID_LICENSE_KEY = 'LIC-SEC-TEST-KEY-2026';

  before(async () => {
    closeDatabase();
    try { fs.unlinkSync(testDbPath); } catch {}
    try { fs.unlinkSync(testDbPath + '-wal'); } catch {}
    try { fs.unlinkSync(testDbPath + '-shm'); } catch {}

    initDatabase(testDbPath);

    licenseRepo.create({
      schoolId: VALID_SCHOOL_ID,
      academyName: 'آکادمی تست امنیتی',
      licenseKey: VALID_LICENSE_KEY,
      contactPhone: '09129999999',
      expiryDate: '2028-12-31T23:59:59Z',
      maxDevices: 5
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

  // --------------------------------------------------------------------------
  // Suite 1: Unauthenticated & Unauthorized Request Rejection (Verification 2)
  // --------------------------------------------------------------------------
  describe('1. Unauthenticated Request Rejection (HTTP 401)', () => {
    it('1.1 POST /api/sync with missing credentials returns HTTP 401 Unauthorized', async () => {
      const res = await fetch(`${baseUrl}/api/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      assert.strictEqual(res.status, 401);
      const body = await res.json();
      assert.strictEqual(body.error, 'UNAUTHORIZED');
    });

    it('1.2 POST /api/sync with non-existent schoolId returns HTTP 401', async () => {
      const res = await fetch(`${baseUrl}/api/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: 'ghost-school-unknown',
          licenseKey: 'SOME-KEY'
        })
      });

      assert.strictEqual(res.status, 401);
      const body = await res.json();
      assert.strictEqual(body.error, 'UNAUTHORIZED');
    });

    it('1.3 POST /api/sync with valid schoolId but incorrect licenseKey returns HTTP 401', async () => {
      const res = await fetch(`${baseUrl}/api/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: VALID_SCHOOL_ID,
          licenseKey: 'WRONG-ACTIVATION-KEY'
        })
      });

      assert.strictEqual(res.status, 401);
      const body = await res.json();
      assert.strictEqual(body.error, 'UNAUTHORIZED');
    });

    it('1.4 Protected REST endpoints reject calls without Bearer auth with HTTP 401', async () => {
      const endpoints = [
        { path: `/api/v1/athletes?schoolId=${VALID_SCHOOL_ID}`, method: 'GET' },
        { path: `/api/v1/transactions?schoolId=${VALID_SCHOOL_ID}`, method: 'GET' },
        { path: `/api/v1/attendance`, method: 'POST' }
      ];

      for (const ep of endpoints) {
        const res = await fetch(`${baseUrl}${ep.path}`, {
          method: ep.method,
          headers: { 'Content-Type': 'application/json' }
        });
        assert.strictEqual(res.status, 401, `Endpoint ${ep.path} must return 401`);
      }
    });

    it('1.5 Admin routes without session cookie return HTTP 401 Unauthorized', async () => {
      const res = await fetch(`${baseUrl}/api/licenses`);
      assert.strictEqual(res.status, 401);
    });

    it('1.6 Tenant status oracle prevention: wrong license key on deactivated school returns HTTP 401 Unauthorized, NOT 403', async () => {
      licenseRepo.create({
        schoolId: 'deactivated-status-oracle-school',
        academyName: 'مدرسه غیرفعال اوراکل',
        licenseKey: 'AUTHENTIC-SECRET-KEY-2026',
        expiryDate: '2028-12-31T23:59:59Z'
      });
      licenseRepo.deactivate('deactivated-status-oracle-school');

      // Attacker with wrong key must receive 401, NOT 403
      const res = await fetch(`${baseUrl}/api/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: 'deactivated-status-oracle-school',
          licenseKey: 'ATTACKER-GUESS-KEY'
        })
      });
      assert.strictEqual(res.status, 401, 'Unauthenticated attacker must receive 401, not status leakage 403');
      const body = await res.json();
      assert.strictEqual(body.error, 'UNAUTHORIZED');

      // Authenticated client with correct key receives 403 LICENSE_FORBIDDEN
      const authRes = await fetch(`${baseUrl}/api/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: 'deactivated-status-oracle-school',
          licenseKey: 'AUTHENTIC-SECRET-KEY-2026'
        })
      });
      assert.strictEqual(authRes.status, 403);
      const authBody = await authRes.json();
      assert.strictEqual(authBody.error, 'LICENSE_FORBIDDEN');
    });
  });

  // --------------------------------------------------------------------------
  // Suite 2: Malformed JSON Payloads & Strict Input Validation
  // --------------------------------------------------------------------------
  describe('2. Malformed Request & Validation Schema Rejection (HTTP 400)', () => {
    it('2.1 Malformed JSON body returns HTTP 400 with clean error JSON (no stack trace leak)', async () => {
      const res = await fetch(`${baseUrl}/api/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"schoolId": "barati", "broken_unclosed: true'
      });

      assert.strictEqual(res.status, 400);
      const body = await res.json();
      assert.ok(body.error === 'MALFORMED_JSON' || body.error === 'BAD_REQUEST');
      assert.ok(!JSON.stringify(body).includes('node_modules'), 'Stack traces must not leak!');
    });

    it('2.2 Type confusion in payload fields triggers HTTP 400 Validation Error', async () => {
      const invalidPayload = {
        schoolId: VALID_SCHOOL_ID,
        licenseKey: VALID_LICENSE_KEY,
        athletes: "THIS_IS_A_STRING_NOT_ARRAY",
        deviceInfo: { deviceId: 'test-dev' }
      };

      const res = await fetch(`${baseUrl}/api/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidPayload)
      });

      assert.strictEqual(res.status, 400);
      const body = await res.json();
      assert.strictEqual(body.error, 'VALIDATION_FAILED');
    });

    it('2.3 Missing required deviceId in deviceInfo triggers HTTP 400', async () => {
      const invalidPayload = {
        schoolId: VALID_SCHOOL_ID,
        licenseKey: VALID_LICENSE_KEY,
        deviceInfo: { deviceModel: 'Pixel 7' } // missing deviceId
      };

      const res = await fetch(`${baseUrl}/api/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidPayload)
      });

      assert.strictEqual(res.status, 400);
    });

    it('2.4 Invalid transaction types trigger HTTP 400', async () => {
      const invalidPayload = {
        schoolId: VALID_SCHOOL_ID,
        licenseKey: VALID_LICENSE_KEY,
        deviceInfo: { deviceId: 'test-dev' },
        transactions: [
          { id: 'tx-bad', date: '2026-10-25', type: 'INVALID_UNKNOWN_TYPE', title: 'Test', amount: 100 }
        ]
      };

      const res = await fetch(`${baseUrl}/api/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidPayload)
      });

      assert.strictEqual(res.status, 400);
    });

    it('2.5 Type confusion in credentials (non-string schoolId or licenseKey) returns HTTP 400 without 500 crash', async () => {
      const typeConfusionPayloads = [
        { schoolId: 12345, licenseKey: VALID_LICENSE_KEY },
        { schoolId: true, licenseKey: VALID_LICENSE_KEY },
        { schoolId: VALID_SCHOOL_ID, licenseKey: 12345 },
        { schoolId: VALID_SCHOOL_ID, licenseKey: {} },
        { schoolId: VALID_SCHOOL_ID, licenseKey: true },
        { schoolId: ['array'], licenseKey: VALID_LICENSE_KEY }
      ];

      for (const payload of typeConfusionPayloads) {
        const res = await fetch(`${baseUrl}/api/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        assert.strictEqual(res.status, 400, `Type confusion payload should return HTTP 400, got ${res.status}`);
        const body = await res.json();
        assert.strictEqual(body.error, 'VALIDATION_FAILED');
      }
    });
  });

  // --------------------------------------------------------------------------
  // Suite 3: Brute-Force Rate Limiting & 5-Strike IP Lockout (AC-2)
  // --------------------------------------------------------------------------
  describe('3. Brute-Force Rate Limiting & 5-Strike IP Lockout (AC-2)', () => {
    it('3.1 Consecutive failed authentication triggers HTTP 429 lockout after 5 attempts', async () => {
      const simulatedIp = '198.51.100.42'; // RFC 5737 Test IP

      // Strike 1 to 5: Return HTTP 401
      for (let attempt = 1; attempt <= 5; attempt++) {
        const res = await fetch(`${baseUrl}/api/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Forwarded-For': simulatedIp
          },
          body: JSON.stringify({ username: 'admin', password: `wrong-password-${attempt}` })
        });

        assert.strictEqual(
          res.status, 401,
          `Attempt ${attempt} should return 401 Unauthorized, got ${res.status}`
        );
      }

      // Strike 6: Must trigger automated lockout (HTTP 429 Too Many Requests)
      const lockoutRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': simulatedIp
        },
        body: JSON.stringify({ username: 'admin', password: 'any-password' })
      });

      assert.strictEqual(
        lockoutRes.status, 429,
        `Attempt 6 must return HTTP 429 Too Many Requests (Lockout), got ${lockoutRes.status}`
      );

      const retryAfter = lockoutRes.headers.get('Retry-After');
      assert.ok(retryAfter, 'Locked out response must include Retry-After header');
      assert.ok(parseInt(retryAfter, 10) > 0);

      const body = await lockoutRes.json();
      assert.ok(
        body.error === 'TOO_MANY_REQUESTS' || body.error === 'IP_LOCKED_OUT',
        `Expected lockout error code, got ${body.error}`
      );
    });

    it('3.2 Successful authentication resets failed attempts counter', async () => {
      const resetIp = '198.51.100.43';

      // 1. Accumulate 3 consecutive failed login attempts (Strikes 1, 2, 3)
      for (let i = 1; i <= 3; i++) {
        const failRes = await fetch(`${baseUrl}/api/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Forwarded-For': resetIp
          },
          body: JSON.stringify({ username: 'admin', password: 'wrong-password' })
        });
        assert.strictEqual(failRes.status, 401, `Failed attempt ${i} before reset must return HTTP 401`);
      }

      // 2. Perform legitimate authentication via POST /api/auth/login to organically reset counter
      const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': resetIp
        },
        body: JSON.stringify({ username: 'admin', password: 'correct-password' })
      });
      assert.strictEqual(loginRes.status, 200, 'Legitimate login must return HTTP 200 OK');
      const loginBody = await loginRes.json();
      assert.strictEqual(loginBody.status, 'AUTHENTICATED');

      // 3. Verify counter was organically reset to 0:
      // Send 3 more failed attempts (Strikes 1, 2, 3 post-reset).
      // If the counter had NOT been reset, these would be Strikes 4, 5, 6 (attempt 6 would be HTTP 429 lockout).
      // Since it was organically reset, all 3 attempts must return HTTP 401.
      for (let i = 1; i <= 3; i++) {
        const nextRes = await fetch(`${baseUrl}/api/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Forwarded-For': resetIp
          },
          body: JSON.stringify({ username: 'admin', password: 'wrong-password' })
        });
        assert.strictEqual(
          nextRes.status, 401,
          `Post-reset failed attempt ${i} must return HTTP 401 (counter was organically reset to 0)`
        );
      }

      // 4. Verify test backdoor route is completely removed from production routing table
      const backdoorRes = await fetch(`${baseUrl}/api/auth/reset-test-counter`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': resetIp
        }
      });
      assert.strictEqual(
        backdoorRes.status, 404,
        'Backdoor route /api/auth/reset-test-counter must return HTTP 404 Not Found'
      );
    });

    it('3.3 AuthLockoutManager enforces bounded memory via maxRecords and LRU eviction under high volume scans', () => {
      const manager = new AuthLockoutManager({ maxRecords: 5, autoCleanup: false });
      for (let i = 1; i <= 5; i++) {
        manager.recordFailure(`10.0.0.${i}`);
      }
      assert.strictEqual(manager.records.size, 5);

      // Access 10.0.0.1 so it becomes MRU
      manager.isLocked('10.0.0.1');

      // Add 6th IP: evicts 10.0.0.2 (oldest), preserves 10.0.0.1 (MRU)
      manager.recordFailure('10.0.0.6');
      assert.strictEqual(manager.records.size, 5, 'Size must stay strictly bounded at maxRecords');
      assert.strictEqual(manager.records.has('10.0.0.1'), true, 'MRU entry must be preserved');
      assert.strictEqual(manager.records.has('10.0.0.2'), false, 'Oldest LRU entry must be evicted');
      assert.strictEqual(manager.records.has('10.0.0.6'), true);

      // Simulated massive botnet scan (1,000 distinct IPs)
      for (let i = 7; i <= 1000; i++) {
        manager.recordFailure(`172.16.${Math.floor(i / 256)}.${i % 256}`);
      }
      assert.strictEqual(manager.records.size, 5, 'Size remains strictly bounded at 5 under high volume');
      manager.destroy();
    });

    it('3.4 AuthLockoutManager periodic TTL cleanup sweeps expired entries and manages lifecycle', () => {
      const manager = new AuthLockoutManager({
        maxAttempts: 2,
        lockoutDurationMs: 2000,
        windowMs: 1000,
        cleanupIntervalMs: 500,
        autoCleanup: true
      });

      assert.ok(manager.cleanupTimer !== null);

      const t0 = 100000;
      manager.records.set('198.51.100.1', { failedCount: 1, lockedUntil: null, firstFailedAt: t0 });
      manager.records.set('198.51.100.2', { failedCount: 2, lockedUntil: t0 + 2000, firstFailedAt: t0 });
      manager.records.set('198.51.100.3', { failedCount: 1, lockedUntil: null, firstFailedAt: t0 + 500 });

      // Clean expired at t0 + 1200: ip1 swept, ip2 and ip3 remain active
      const swept1 = manager.cleanExpired(t0 + 1200);
      assert.strictEqual(swept1, 1);
      assert.strictEqual(manager.records.has('198.51.100.1'), false);
      assert.strictEqual(manager.records.has('198.51.100.2'), true);
      assert.strictEqual(manager.records.has('198.51.100.3'), true);

      // Clean expired at t0 + 2500: remaining swept
      const swept2 = manager.cleanExpired(t0 + 2500);
      assert.strictEqual(swept2, 2);
      assert.strictEqual(manager.records.size, 0);

      // Lifecycle test
      manager.stopCleanup();
      assert.strictEqual(manager.cleanupTimer, null);
      manager.startCleanup();
      assert.ok(manager.cleanupTimer !== null);
      manager.destroy();
      assert.strictEqual(manager.cleanupTimer, null);
      assert.strictEqual(manager.records.size, 0);
    });
  });

  // --------------------------------------------------------------------------
  // Suite 4: Perimeter Defense & Security Headers (Helmet)
  // --------------------------------------------------------------------------
  describe('4. Security Headers & Perimeter Defense', () => {
    it('4.1 Server returns all required Helmet security headers', async () => {
      const res = await fetch(`${baseUrl}/health`);
      assert.strictEqual(res.status, 200);

      // Verify MIME sniffing prevention
      assert.strictEqual(
        res.headers.get('x-content-type-options'),
        'nosniff',
        'Missing X-Content-Type-Options: nosniff'
      );

      // Verify Clickjacking protection
      const xFrame = res.headers.get('x-frame-options');
      assert.ok(
        xFrame === 'DENY' || xFrame === 'SAMEORIGIN',
        `Unexpected X-Frame-Options: ${xFrame}`
      );

      // Verify Content Security Policy
      const csp = res.headers.get('content-security-policy');
      assert.ok(csp, 'Missing Content-Security-Policy header');

      // Verify Express server banner suppression (Information Leakage Protection)
      assert.strictEqual(
        res.headers.get('x-powered-by'),
        null,
        'X-Powered-By header must be completely removed by Helmet!'
      );
    });

    it('4.2 CORS restricts unauthorized cross-origin requests', async () => {
      const res = await fetch(`${baseUrl}/health`, {
        headers: { 'Origin': 'http://malicious-attacker-site.com' }
      });

      const allowOrigin = res.headers.get('access-control-allow-origin');
      assert.notStrictEqual(
        allowOrigin,
        'http://malicious-attacker-site.com',
        'Untrusted origins must not be reflected in Access-Control-Allow-Origin'
      );
    });
  });
});
