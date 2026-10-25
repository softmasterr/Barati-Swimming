/**
 * Environment configuration loader for Barati Swimming Cloud Server.
 * Loads variables from .env file with production-ready defaults.
 */

import dotenv from 'dotenv';
import path from 'node:path';

// Load .env file from project root or backend_server directory
dotenv.config();

// Auto-detect test runner execution
const isTestRunner = process.execArgv.includes('--test') ||
  process.argv.some(arg => typeof arg === 'string' && (arg.includes('test') || arg.includes('.test.') || arg.includes('test_'))) ||
  process.env.NODE_ENV === 'test';

if (isTestRunner && !process.env.NODE_ENV) {
  process.env.NODE_ENV = 'test';
}

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',

  // Database
  databasePath: process.env.DATABASE_PATH || path.resolve(process.cwd(), 'data', 'barati.db'),

  // Cryptographic Subsystem (AES-256-GCM & Scrypt KDF)
  dataEncryptionKey: process.env.DATA_ENCRYPTION_KEY || 'barati-swimming-dev-secret-key-32bytes-min',
  dataEncryptionSalt: process.env.DATA_ENCRYPTION_SALT || 'barati-swimming-master-encryption-salt-2026',

  // JWT & Admin Session
  jwtSecret: process.env.JWT_SECRET || 'barati-jwt-super-secret-key-min-32-chars-long',
  sessionCookieName: process.env.SESSION_COOKIE_NAME || 'barati_admin_session',
  jwtExpiry: process.env.JWT_EXPIRY || '24h',

  // Rate Limiting & Lockout
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 mins
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  lockoutMaxAttempts: parseInt(process.env.LOCKOUT_MAX_ATTEMPTS || '5', 10),
  lockoutDurationMs: parseInt(process.env.LOCKOUT_DURATION_MS || '900000', 10), // 15 mins

  // Security & CORS
  corsOrigin: process.env.CORS_ORIGIN || '*',
};

export default config;
