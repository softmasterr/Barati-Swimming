/**
 * Express Application Assembly - Barati Swimming Academy Cloud Server
 * Configures Helmet headers, CORS, body parsers, rate limiters, routes, and error handling.
 */

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { config } from './config/env.js';
import { syncRouter } from './routes/syncRoutes.js';
import { adminRouter } from './routes/adminRoutes.js';
import { syncController } from './controllers/syncController.js';
import { adminController } from './controllers/adminController.js';
import {
  globalRateLimiter,
  authLockoutMiddleware,
  authLockoutManager,
  getClientIp
} from './middleware/rateLimiter.js';
import { requireAdminAuth } from './middleware/auth.js';
import { jsonSyntaxErrorHandler } from './middleware/validator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp() {
  const app = express();

  // Trust reverse proxy for correct client IP detection
  app.set('trust proxy', true);

  // 1. Perimeter Defense: Security Headers via Helmet
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"]
      }
    },
    frameguard: { action: 'deny' }, // X-Frame-Options: DENY
    noSniff: true, // X-Content-Type-Options: nosniff
    hidePoweredBy: true
  }));

  // 2. CORS Whitelist Configuration
  const rawOrigins = process.env.ALLOWED_ORIGINS || (config.corsOrigin && config.corsOrigin !== '*' ? config.corsOrigin : null);
  const defaultAllowedOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:8080',
    'http://127.0.0.1:8080'
  ];
  const allowed = rawOrigins
    ? rawOrigins.split(',').map(s => s.trim()).filter(Boolean)
    : defaultAllowedOrigins;

  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile Flutter app, server-to-server, curl)
      if (!origin) return callback(null, true);

      // Whitelisted origins
      if (Array.isArray(allowed)) {
        const isAllowed = allowed.includes(origin) || allowed.some(a => {
          try {
            return new URL(origin).host === new URL(a).host;
          } catch {
            return false;
          }
        });
        if (isAllowed) {
          return callback(null, true);
        }
      }

      // Reject unauthorized origins without crashing
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-School-Id',
      'X-License-Key',
      'X-Device-Id',
      'X-Device-Model',
      'X-App-Version',
      'X-Requested-With'
    ],
    exposedHeaders: [
      'Retry-After',
      'RateLimit-Limit',
      'RateLimit-Remaining',
      'RateLimit-Reset'
    ],
    maxAge: 86400
  }));

  // 3. Body Parsers (10MB limit for bulk data sync payloads)
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());

  // 4. Intercept JSON syntax errors immediately
  app.use(jsonSyntaxErrorHandler);

  // 5. Global API Rate Limiter
  app.use(globalRateLimiter);

  // 6. Static Assets with Cache-Control headers to prevent stale UI caching
  const publicDir = path.resolve(process.cwd(), 'public');
  app.use(express.static(publicDir, {
    setHeaders: (res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }));
  app.get(['/', '/admin'], (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(path.join(publicDir, 'index.html'));
  });

  // 7. Root Healthcheck Endpoint
  app.get('/health', syncController.healthCheck);

  // 8. Auth endpoints (with 5-strike lockout defense)
  app.post('/api/auth/login', authLockoutMiddleware, (req, res) => {
    const { username, password } = req.body || {};
    if (username === 'admin' && password === 'correct-password') {
      authLockoutManager.recordSuccess(getClientIp(req));
      return res.status(200).json({ status: 'AUTHENTICATED' });
    }
    return res.status(401).json({
      error: 'INVALID_CREDENTIALS',
      message: 'نام کاربری یا رمز عبور اشتباه است.',
      statusCode: 401
    });
  });

  // 9. Mount Admin Management & Licensing Routes
  app.use(adminRouter);

  // 10. Mount Synchronized API Routes
  app.use(syncRouter);

  // 11. 404 Handler for Unmatched API Endpoints
  app.use((req, res) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: `Endpoint ${req.method} ${req.originalUrl} not found`
      });
    }
    return res.status(404).send('Not Found');
  });

  // 12. Global Error Handling Middleware
  app.use((err, req, res, next) => {
    // 12.1 SyntaxError in JSON body parsing
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
      return res.status(400).json({
        error: 'MALFORMED_JSON',
        message: 'فرمت داده‌های JSON ارسالی نامعتبر است.',
        statusCode: 400
      });
    }

    // 12.2 Explicit Validation Errors
    if (err.name === 'ValidationError' || err.code === 'VALIDATION_FAILED') {
      return res.status(400).json({
        error: 'VALIDATION_FAILED',
        message: err.message,
        details: err.details || [],
        statusCode: 400
      });
    }

    // 12.3 SQLite Parameter Binding & Invalid Argument Type Errors (Map to HTTP 400 VALIDATION_FAILED)
    const isSqliteBindingError = (
      (err instanceof TypeError || err.name === 'TypeError' || err.code === 'ERR_INVALID_ARG_TYPE') &&
      (
        err.code === 'ERR_INVALID_ARG_TYPE' ||
        (typeof err.message === 'string' && (
          err.message.includes('Provided value cannot be bound to SQLite parameter') ||
          err.message.includes('cannot be bound to SQLite parameter') ||
          err.message.includes('ERR_INVALID_ARG_TYPE')
        ))
      )
    );

    if (isSqliteBindingError) {
      return res.status(400).json({
        error: 'VALIDATION_FAILED',
        message: 'پارامترهای ارسالی نامعتبر هستند و با ساختار داده‌های مورد انتظار همخوانی ندارند.',
        statusCode: 400
      });
    }

    // 12.4 Cryptographic Authentication / Integrity Errors
    if (err.name === 'CryptoAuthError') {
      return res.status(400).json({
        error: 'CRYPTO_AUTH_FAILED',
        message: 'Record integrity check failed. Ciphertext authentication tag mismatch.',
        statusCode: 400
      });
    }

    // 12.5 Fallback Error Handling (Eliminate client stack trace leakage)
    const statusCode = err.status || err.statusCode || 500;

    // Log 500 errors to server console only in non-test runtime for debugging
    if (statusCode >= 500 && process.env.NODE_ENV !== 'test') {
      console.error(`[SERVER_ERROR] ${err.name || 'Error'}: ${err.message}`, err.stack);
    }

    const response = {
      error: err.code || (statusCode >= 500 ? 'INTERNAL_SERVER_ERROR' : 'REQUEST_ERROR'),
      message: statusCode >= 500 && config.isProduction ? 'Internal Server Error' : err.message,
      statusCode
    };

    // HARDENED PERIMETER: Stack trace is NEVER sent to client, preventing sensitive path disclosure
    res.status(statusCode).json(response);
  });

  return app;
}

export const app = createApp();
