/**
 * Admin Routes - Barati Swimming Academy
 * Hardened Admin API Endpoints with Argon2id, TOTP 2FA,
 * License Lifecycle Management, and Audit Logging.
 */

import express from 'express';
import { adminController } from '../controllers/adminController.js';
import { requireAdminAuth } from '../middleware/auth.js';
import { authLockoutMiddleware } from '../middleware/rateLimiter.js';

export const adminRouter = express.Router();

// 1. Authentication & 2FA Flow
adminRouter.post('/api/admin/login', authLockoutMiddleware, adminController.login);
adminRouter.post('/api/admin/2fa/setup', adminController.setup2fa);
adminRouter.post('/api/admin/2fa/quick-code', adminController.quickCode);
adminRouter.post('/api/admin/2fa/verify', adminController.verify2fa);
adminRouter.post('/api/admin/logout', adminController.logout);

// 2. Protected Admin Dashboard & Management Routes
adminRouter.get('/api/admin/me', requireAdminAuth, adminController.getMe);
adminRouter.get('/api/admin/stats', requireAdminAuth, adminController.getStats);

// 3. School License Lifecycle
adminRouter.get('/api/admin/licenses', requireAdminAuth, adminController.listLicenses);
adminRouter.get('/api/licenses', requireAdminAuth, adminController.listLicenses);
adminRouter.post('/api/admin/licenses', requireAdminAuth, adminController.createLicense);
adminRouter.put('/api/admin/licenses/:schoolId/renew', requireAdminAuth, adminController.renewLicense);
adminRouter.delete('/api/admin/licenses/:schoolId', requireAdminAuth, adminController.deactivateLicense);

// 4. Security Audit Logs
adminRouter.get('/api/admin/audit-logs', requireAdminAuth, adminController.getAuditLogs);

// 5. Cloud Synced Academy Data (Athletes & Attendance Overview)
adminRouter.get('/api/admin/athletes', requireAdminAuth, adminController.listAthletes);
adminRouter.get('/api/admin/attendance', requireAdminAuth, adminController.listAttendance);
adminRouter.get('/api/admin/coaches', requireAdminAuth, adminController.listCoaches);
