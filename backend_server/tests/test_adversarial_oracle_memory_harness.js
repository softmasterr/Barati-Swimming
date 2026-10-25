/**
 * Adversarial Challenger Verification Suite:
 * Oracle Resistance, Backdoor Absence & Bounded Memory Stress Harness
 *
 * Explicitly tests:
 * 1. Oracle Resistance: Invalid keys across active, deactivated, expired, and non-existent schools (HTTP 401 status isolation & timing).
 * 2. Backdoor Absence: Verifies GET/POST/PUT/DELETE /api/auth/reset-test-counter returns HTTP 404.
 * 3. Bounded Memory Challenge: Floods AuthLockoutManager with 15,000 unique IPs, asserting size <= 10,000,
 *    LRU preservation of persistent attackers, and bounded heap memory.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { app } from '../src/app.js';
import { initDatabase, closeDatabase, getDatabase } from '../src/db/database.js';
import { licenseRepo } from '../src/db/repositories/licenseRepo.js';
import { AuthLockoutManager } from '../src/middleware/rateLimiter.js';

describe('Adversarial Challenger Suite: Oracle Resistance, Backdoor Absence & Bounded Memory', () => {
  const testDbPath = path.resolve(process.cwd(), 'data', 'test_challenger_oracle_mem.db');
  let server;
  let baseUrl;

  const ACTIVE_SCHOOL_ID = 'chal-school-active';
  const ACTIVE_KEY = 'LIC-CHAL-ACTIVE-2026-KEY';

  const DEACT_SCHOOL_ID = 'chal-school-deact';
  const DEACT_KEY = 'LIC-CHAL-DEACT-2026-KEY';

  const EXPIRED_SCHOOL_ID = 'chal-school-exp';
  const EXPIRED_KEY = 'LIC-CHAL-EXP-2026-KEY';

  const NON_EXISTENT_SCHOOL_ID = 'chal-school-nonexistent';

  before(async () => {
    closeDatabase();
    try { fs.unlinkSync(testDbPath); } catch {}
    try { fs.unlinkSync(testDbPath + '-wal'); } catch {}
    try { fs.unlinkSync(testDbPath + '-shm'); } catch {}

    initDatabase(testDbPath);
    const db = getDatabase();
    db.exec("DELETE FROM licenses WHERE school_id LIKE 'chal-%';");

    // 1. Active school
    licenseRepo.create({
      schoolId: ACTIVE_SCHOOL_ID,
      academyName: 'آکادمی فعال چلنجر',
      licenseKey: ACTIVE_KEY,
      contactPhone: '09121110001',
      expiryDate: '2028-12-31T23:59:59Z',
      maxDevices: 5
    });

    // 2. Deactivated school
    licenseRepo.create({
      schoolId: DEACT_SCHOOL_ID,
      academyName: 'آکادمی غیرفعال چلنجر',
      licenseKey: DEACT_KEY,
      contactPhone: '09121110002',
      expiryDate: '2028-12-31T23:59:59Z',
      maxDevices: 5
    });
    licenseRepo.deactivate(DEACT_SCHOOL_ID);

    // 3. Expired school
    licenseRepo.create({
      schoolId: EXPIRED_SCHOOL_ID,
      academyName: 'آکادمی منقضی چلنجر',
      licenseKey: EXPIRED_KEY,
      contactPhone: '09121110003',
      expiryDate: '2021-01-01T00:00:00Z',
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

  // ==========================================================================
  // Challenge 1: Oracle Resistance Challenge
  // ==========================================================================
  describe('Challenge 1: Oracle Resistance & Tenant Status Timing Isolation', () => {
    const invalidKeys = [
      'WRONG_KEY_ABC',
      'LIC-CHAL-ACTIVE-2026-FAKE', // same length as ACTIVE_KEY
      'INVALID_SHORT',
      'A'.repeat(64),              // long key
      '   ',                       // whitespace
    ];

    it('1.1 verifies ALL invalid key attempts return HTTP 401 Unauthorized across active, deactivated, expired, and non-existent schools', async () => {
      const targets = [
        { name: 'Active School', id: ACTIVE_SCHOOL_ID },
        { name: 'Deactivated School', id: DEACT_SCHOOL_ID },
        { name: 'Expired School', id: EXPIRED_SCHOOL_ID },
        { name: 'Non-Existent School', id: NON_EXISTENT_SCHOOL_ID }
      ];

      let reqIdx = 0;
      for (const target of targets) {
        for (const badKey of invalidKeys) {
          reqIdx++;
          const res = await fetch(`${baseUrl}/api/sync`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Forwarded-For': `198.51.101.${reqIdx}`
            },
            body: JSON.stringify({
              schoolId: target.id,
              licenseKey: badKey,
              deviceInfo: { deviceId: 'challenger-test-device' }
            })
          });

          const body = await res.json();

          // CRITICAL ASSERTION: MUST BE HTTP 401 UNAUTHORIZED
          assert.strictEqual(
            res.status,
            401,
            `Target ${target.name} with key "${badKey}" must return HTTP 401 Unauthorized, got HTTP ${res.status}`
          );

          assert.strictEqual(
            body.error,
            'UNAUTHORIZED',
            `Target ${target.name} must return error "UNAUTHORIZED", got "${body.error}"`
          );

          // Must NEVER leak LICENSE_FORBIDDEN or NOT_FOUND to unauthenticated callers
          assert.notStrictEqual(body.error, 'LICENSE_FORBIDDEN');
          assert.notStrictEqual(body.statusCode, 403);
          assert.notStrictEqual(body.statusCode, 404);
        }
      }
    });

    it('1.2 timing isolation: measures response timing across tenant states with invalid keys', async () => {
      const iterations = 50;
      let ipCounter = 1;

      const measureTiming = async (schoolId, key) => {
        const timings = [];
        for (let i = 0; i < iterations; i++) {
          const clientIp = `198.51.102.${ipCounter++}`;
          const start = performance.now();
          const res = await fetch(`${baseUrl}/api/sync`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Forwarded-For': clientIp
            },
            body: JSON.stringify({
              schoolId,
              licenseKey: key,
              deviceInfo: { deviceId: 'timing-device' }
            })
          });
          const end = performance.now();
          assert.strictEqual(res.status, 401, `Expected 401, got ${res.status}`);
          timings.push(end - start);
        }
        const mean = timings.reduce((a, b) => a + b, 0) / timings.length;
        const variance = timings.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / timings.length;
        return {
          mean,
          stdDev: Math.sqrt(variance),
          min: Math.min(...timings),
          max: Math.max(...timings)
        };
      };

      const invalidKey = 'LIC-INVALID-ORACLE-PROBE-999';
      const activeTiming = await measureTiming(ACTIVE_SCHOOL_ID, invalidKey);
      const deactTiming = await measureTiming(DEACT_SCHOOL_ID, invalidKey);
      const nonExistentTiming = await measureTiming(NON_EXISTENT_SCHOOL_ID, invalidKey);

      // Verify timing profiles are comparable and within normal local network jitter
      const diffActiveDeact = Math.abs(activeTiming.mean - deactTiming.mean);
      assert.ok(
        diffActiveDeact < 25,
        `Timing difference between active (${activeTiming.mean.toFixed(2)}ms) and deactivated (${deactTiming.mean.toFixed(2)}ms) must be small (< 25ms, got ${diffActiveDeact.toFixed(2)}ms)`
      );
    });

    it('1.3 control assertion: valid keys correctly enforce authorization boundaries (200 vs 403)', async () => {
      // Valid key to active school -> 200
      const activeRes = await fetch(`${baseUrl}/api/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': '198.51.103.1'
        },
        body: JSON.stringify({
          schoolId: ACTIVE_SCHOOL_ID,
          licenseKey: ACTIVE_KEY,
          deviceInfo: { deviceId: 'valid-device-1' }
        })
      });
      assert.strictEqual(activeRes.status, 200);

      // Valid key to deactivated school -> 403 LICENSE_FORBIDDEN
      const deactRes = await fetch(`${baseUrl}/api/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': '198.51.103.2'
        },
        body: JSON.stringify({
          schoolId: DEACT_SCHOOL_ID,
          licenseKey: DEACT_KEY,
          deviceInfo: { deviceId: 'valid-device-1' }
        })
      });
      assert.strictEqual(deactRes.status, 403);
      const deactBody = await deactRes.json();
      assert.strictEqual(deactBody.error, 'LICENSE_FORBIDDEN');

      // Valid key to expired school -> 403 LICENSE_FORBIDDEN
      const expRes = await fetch(`${baseUrl}/api/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': '198.51.103.3'
        },
        body: JSON.stringify({
          schoolId: EXPIRED_SCHOOL_ID,
          licenseKey: EXPIRED_KEY,
          deviceInfo: { deviceId: 'valid-device-1' }
        })
      });
      assert.strictEqual(expRes.status, 403);
      const expBody = await expRes.json();
      assert.strictEqual(expBody.error, 'LICENSE_FORBIDDEN');
    });
  });

  // ==========================================================================
  // Challenge 2: Backdoor Absence Check
  // ==========================================================================
  describe('Challenge 2: Backdoor Absence Check (/api/auth/reset-test-counter)', () => {
    it('2.1 sends GET to /api/auth/reset-test-counter and asserts HTTP 404', async () => {
      const res = await fetch(`${baseUrl}/api/auth/reset-test-counter`, {
        method: 'GET',
        headers: { 'X-Forwarded-For': '198.51.104.1' }
      });
      assert.strictEqual(res.status, 404, `GET /api/auth/reset-test-counter must return HTTP 404, got ${res.status}`);
      const body = await res.json();
      assert.strictEqual(body.error, 'NOT_FOUND');
    });

    it('2.2 sends POST to /api/auth/reset-test-counter with empty and filled payloads and asserts HTTP 404', async () => {
      const payloads = [
        {},
        { ip: '127.0.0.1' },
        { ip: '198.51.100.1' },
        { reset: true }
      ];

      let postIdx = 10;
      for (const payload of payloads) {
        postIdx++;
        const res = await fetch(`${baseUrl}/api/auth/reset-test-counter`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Forwarded-For': `198.51.104.${postIdx}`
          },
          body: JSON.stringify(payload)
        });
        assert.strictEqual(
          res.status,
          404,
          `POST /api/auth/reset-test-counter with payload ${JSON.stringify(payload)} must return HTTP 404, got ${res.status}`
        );
        const body = await res.json();
        assert.strictEqual(body.error, 'NOT_FOUND');
      }
    });

    it('2.3 sends PUT, DELETE, PATCH to /api/auth/reset-test-counter and asserts HTTP 404', async () => {
      let methodIdx = 20;
      for (const method of ['PUT', 'DELETE', 'PATCH']) {
        methodIdx++;
        const res = await fetch(`${baseUrl}/api/auth/reset-test-counter`, {
          method,
          headers: { 'X-Forwarded-For': `198.51.104.${methodIdx}` }
        });
        assert.strictEqual(
          res.status,
          404,
          `${method} /api/auth/reset-test-counter must return HTTP 404, got ${res.status}`
        );
      }
    });

    it('2.4 source audit: verifies zero occurrences of "reset-test-counter" in src/', () => {
      const srcDir = path.resolve(process.cwd(), 'src');
      const searchInDir = (dir) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            searchInDir(fullPath);
          } else if (entry.isFile() && entry.name.endsWith('.js')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            assert.ok(
              !content.includes('reset-test-counter'),
              `Source file ${fullPath} must not contain "reset-test-counter"`
            );
          }
        }
      };
      searchInDir(srcDir);
    });
  });

  // ==========================================================================
  // Challenge 3: Bounded Memory & LRU Flood Challenge (15,000 IPs)
  // ==========================================================================
  describe('Challenge 3: Bounded Memory & LRU Flood Challenge (15,000 Unique IPs)', () => {
    it('3.1 floods AuthLockoutManager with 15,000 unique IPs, asserting maxRecords <= 10,000 and LRU retention of active attackers', () => {
      const manager = new AuthLockoutManager({
        maxRecords: 10000,
        maxAttempts: 5,
        lockoutDurationMs: 60000,
        autoCleanup: false
      });

      // Define 10 active attacking IPs that will be touched frequently
      const activeAttackers = [
        '192.168.1.10', '192.168.1.11', '192.168.1.12', '192.168.1.13', '192.168.1.14',
        '192.168.1.15', '192.168.1.16', '192.168.1.17', '192.168.1.18', '192.168.1.19'
      ];

      // Give each active attacker 5 strikes so they become locked out
      for (const ip of activeAttackers) {
        for (let s = 0; s < 5; s++) {
          manager.recordFailure(ip);
        }
        assert.strictEqual(manager.isLocked(ip).locked, true, `Attacker ${ip} must initially be locked`);
      }

      // Early transient scan IPs (inserted once, never touched again)
      const earlyTransientIPs = ['10.0.0.1', '10.0.0.2', '10.0.0.3', '10.0.0.4', '10.0.0.5'];
      for (const ip of earlyTransientIPs) {
        manager.recordFailure(ip);
      }

      const totalFlood = 15000;
      let peakSize = 0;

      // Flood with 15,000 unique IPs
      for (let i = 1; i <= totalFlood; i++) {
        const floodIp = `172.${(i >> 16) & 255}.${(i >> 8) & 255}.${i & 255}`;
        manager.recordFailure(floodIp);

        // Every 500 requests, touch active attackers to keep them MRU
        if (i % 500 === 0) {
          for (const ip of activeAttackers) {
            // isLocked refreshes LRU position for active records
            const status = manager.isLocked(ip);
            assert.strictEqual(status.locked, true);
          }
        }

        if (manager.records.size > peakSize) {
          peakSize = manager.records.size;
        }

        // Bounded capacity assertion during flood
        assert.ok(
          manager.records.size <= 10000,
          `Capacity exceeded 10,000 at iteration ${i}: size was ${manager.records.size}`
        );
      }

      // Final assertions
      assert.ok(
        manager.records.size <= 10000,
        `Final capacity must be <= 10,000, got ${manager.records.size}`
      );
      assert.strictEqual(
        peakSize,
        10000,
        `Peak capacity should reach exactly 10,000 without overflowing (got ${peakSize})`
      );

      // LRU RETENTION VERIFICATION:
      // 1. ALL active attacking IPs must STILL be retained in records and locked
      for (const ip of activeAttackers) {
        assert.ok(
          manager.records.has(ip),
          `Active attacker ${ip} MUST be retained via LRU promotion`
        );
        assert.strictEqual(
          manager.isLocked(ip).locked,
          true,
          `Active attacker ${ip} MUST still be locked`
        );
      }

      // 2. Early transient IPs that were never touched must have been evicted by LRU
      for (const ip of earlyTransientIPs) {
        assert.strictEqual(
          manager.records.has(ip),
          false,
          `Early transient IP ${ip} MUST have been evicted by LRU`
        );
      }

      manager.destroy();
    });

    it('3.2 measures heap memory boundedness during 15,000 IP flood', () => {
      const manager = new AuthLockoutManager({
        maxRecords: 10000,
        maxAttempts: 5,
        lockoutDurationMs: 60000,
        autoCleanup: false
      });

      const initialHeap = process.memoryUsage().heapUsed;

      for (let i = 1; i <= 15000; i++) {
        const ip = `10.${(i >> 16) & 255}.${(i >> 8) & 255}.${i & 255}`;
        manager.recordFailure(ip);
      }

      const finalHeap = process.memoryUsage().heapUsed;
      const heapDeltaMb = (finalHeap - initialHeap) / (1024 * 1024);

      // 10,000 Map entries with simple objects should consume < 15 MB heap
      assert.ok(
        heapDeltaMb < 25,
        `Heap delta must remain bounded below 25 MB, actual delta: ${heapDeltaMb.toFixed(2)} MB`
      );

      manager.destroy();
      assert.strictEqual(manager.records.size, 0);
    });
  });
});
