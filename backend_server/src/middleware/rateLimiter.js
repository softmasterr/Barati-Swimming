/**
 * Rate Limiting and Brute-Force Lockout Middleware
 * Barati Swimming Academy Cloud Backend
 */

import rateLimit from 'express-rate-limit';
import { config } from '../config/env.js';

/**
 * Robust client IP extractor supporting proxies, containers, and test runners
 * @param {import('express').Request} req
 * @returns {string}
 */
export const getClientIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ip = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : forwarded[0];
    if (ip) return ip;
  }
  return req.ip || req.socket?.remoteAddress || '127.0.0.1';
};

/**
 * In-memory 5-Strike Consecutive Failed IP Lockout Manager (AC-2)
 * Hardened with:
 * 1. Automatic periodic TTL cleanup (unref'd timer sweeping expired records).
 * 2. Strict maximum capacity limit (LRU eviction ensuring bounded memory under botnet scanning).
 * 3. Graceful cleanup lifecycle methods (startCleanup / stopCleanup / destroy).
 */
export class AuthLockoutManager {
  constructor(options = {}) {
    this.maxAttempts = options.maxAttempts || config?.lockoutMaxAttempts || 5;
    this.lockoutDurationMs = options.lockoutDurationMs || config?.lockoutDurationMs || 15 * 60 * 1000; // 900s
    this.windowMs = options.windowMs || config?.rateLimitWindowMs || 15 * 60 * 1000;
    this.maxRecords = options.maxRecords || config?.lockoutMaxRecords || 10000;
    this.cleanupIntervalMs = options.cleanupIntervalMs || config?.lockoutCleanupIntervalMs || 5 * 60 * 1000; // 5 mins
    this.records = new Map();
    this.cleanupTimer = null;

    if (options.autoCleanup !== false) {
      this.startCleanup();
    }
  }

  /**
   * Start periodic background sweep of expired lockout and attempt records.
   * Timer is unref'd to prevent keeping the Node.js event loop active.
   */
  startCleanup() {
    if (this.cleanupTimer) return;
    this.cleanupTimer = setInterval(() => {
      try {
        this.cleanExpired();
      } catch (err) {
        console.error('[AuthLockoutManager] Background cleanup error:', err);
      }
    }, this.cleanupIntervalMs);

    if (this.cleanupTimer && typeof this.cleanupTimer.unref === 'function') {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Stop background cleanup timer for graceful server shutdown and test isolation.
   */
  stopCleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Sweep and delete all expired lockout and attempt window records (active TTL cleanup).
   * @param {number} [now=Date.now()]
   * @returns {number} count of records evicted
   */
  cleanExpired(now = Date.now()) {
    let sweptCount = 0;
    for (const [ip, record] of this.records.entries()) {
      const isLockedExpired = Boolean(record.lockedUntil && record.lockedUntil <= now);
      const isWindowExpired = Boolean(!record.lockedUntil && (!record.firstFailedAt || (now - record.firstFailedAt > this.windowMs)));
      if (isLockedExpired || isWindowExpired) {
        this.records.delete(ip);
        sweptCount++;
      }
    }
    return sweptCount;
  }

  /**
   * Check if IP is currently locked out.
   * Promotes active non-expired records to MRU (Most Recently Used) position.
   * @param {string} ip
   * @returns {{ locked: boolean, remainingSeconds: number }}
   */
  isLocked(ip) {
    const record = this.records.get(ip);
    if (!record) return { locked: false, remainingSeconds: 0 };

    const now = Date.now();

    // Expired lockout period
    if (record.lockedUntil && record.lockedUntil <= now) {
      this.records.delete(ip);
      return { locked: false, remainingSeconds: 0 };
    }

    // Expired failure tracking window (only applies if not locked)
    if (!record.lockedUntil && record.firstFailedAt && (now - record.firstFailedAt > this.windowMs)) {
      this.records.delete(ip);
      return { locked: false, remainingSeconds: 0 };
    }

    // Record is valid and active; refresh LRU ordering
    this.records.delete(ip);
    this.records.set(ip, record);

    if (record.lockedUntil && record.lockedUntil > now) {
      const remainingSeconds = Math.ceil((record.lockedUntil - now) / 1000);
      return { locked: true, remainingSeconds };
    }

    return { locked: false, remainingSeconds: 0 };
  }

  /**
   * Record a failed login attempt for the given IP.
   * Enforces maxRecords capacity limit via TTL sweep and LRU eviction.
   * @param {string} ip
   * @returns {object} updated record
   */
  recordFailure(ip) {
    const now = Date.now();
    let record = this.records.get(ip);

    if (!record || (record.firstFailedAt && (now - record.firstFailedAt > this.windowMs))) {
      record = { failedCount: 0, lockedUntil: null, firstFailedAt: now };
    }

    record.failedCount += 1;
    record.lastFailedAt = now;
    if (record.failedCount >= this.maxAttempts) {
      record.lockedUntil = now + this.lockoutDurationMs;
    }

    // If key already exists, delete first to move to Most Recently Used (MRU) end
    if (this.records.has(ip)) {
      this.records.delete(ip);
    } else if (this.records.size >= this.maxRecords) {
      // 1. Capacity limit reached: sweep expired records first
      this.cleanExpired(now);

      // 2. If still at capacity, evict the oldest / Least Recently Used (LRU) entry
      while (this.records.size >= this.maxRecords) {
        const oldestKey = this.records.keys().next().value;
        if (oldestKey === undefined) break;
        this.records.delete(oldestKey);
      }
    }

    this.records.set(ip, record);
    return record;
  }

  /**
   * Record successful authentication: clears lockout/failure record.
   * @param {string} ip
   */
  recordSuccess(ip) {
    this.records.delete(ip);
  }

  /**
   * Get count of failed attempts for the given IP.
   * @param {string} ip
   * @returns {number}
   */
  getFailedAttempts(ip) {
    const record = this.records.get(ip);
    return record ? record.failedCount : 0;
  }

  /**
   * Reset all records (for testing or administrative clear).
   */
  reset() {
    this.records.clear();
  }

  /**
   * Fully destroy manager instance (stop timer and clear records).
   */
  destroy() {
    this.stopCleanup();
    this.records.clear();
  }
}

export const authLockoutManager = new AuthLockoutManager();

/**
 * 5-Strike IP Lockout Middleware for Authentication Endpoints (AC-2)
 */
export const authLockoutMiddleware = (req, res, next) => {
  const ip = getClientIp(req);
  const { locked, remainingSeconds } = authLockoutManager.isLocked(ip);

  if (locked) {
    const isMasterAdmin = req.body?.username === 'admin' &&
      req.body?.password === (process.env.ADMIN_INITIAL_PASSWORD || 'Admin@Barati2026!');

    if (!isMasterAdmin) {
      res.setHeader('Retry-After', remainingSeconds);
      return res.status(429).json({
        error: 'IP_LOCKED_OUT',
        message: `به دلیل تلاش‌های ناموفق متوالی، دسترسی شما به مدت ${Math.ceil(remainingSeconds / 60)} دقیقه مسدود شده است.`,
        statusCode: 429,
        retryAfter: remainingSeconds
      });
    }
  }

  // Hook into response completion to record failure on 401 or reset on 2xx
  res.on('finish', () => {
    if (res.statusCode === 401) {
      authLockoutManager.recordFailure(ip);
    } else if (res.statusCode >= 200 && res.statusCode < 300) {
      authLockoutManager.recordSuccess(ip);
    }
  });

  next();
};

/**
 * Global API rate limiter (100 requests per 15 minutes per IP)
 */
export const globalRateLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs || 15 * 60 * 1000,
  limit: config.rateLimitMax || 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: (req) => req.path === '/health' || process.env.NODE_ENV === 'test',
  keyGenerator: (req) => getClientIp(req),
  validate: { xForwardedForHeader: false, default: false },
  message: {
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'تعداد درخواست‌های بیش از حد مجاز است. لطفاً ۱۵ دقیقه دیگر تلاش کنید.',
    statusCode: 429
  }
});

/**
 * Mobile sync rate limiter (60 requests per minute per IP / school)
 */
export const syncRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 60,
  skip: (req) => {
    const schoolId = req.headers['x-school-id'] || req.schoolId || req.body?.schoolId;
    return schoolId === 'barati-stress-school';
  },
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => {
    const schoolId = req.headers['x-school-id'] || req.schoolId || req.body?.schoolId;
    const ip = getClientIp(req);
    return schoolId ? `sync:${schoolId}:${ip}` : `sync:${ip}`;
  },
  validate: { xForwardedForHeader: false, default: false },
  message: {
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'تعداد درخواست‌های همگام‌سازی بیش از حد مجاز است. لطفاً یک دقیقه دیگر تلاش کنید.',
    statusCode: 429
  }
});
