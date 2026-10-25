/**
 * Sync & RESTful API Routes - Barati Swimming Academy
 */

import { Router } from 'express';
import { syncController } from '../controllers/syncController.js';
import { verifySchoolLicense } from '../middleware/auth.js';
import { syncRateLimiter } from '../middleware/rateLimiter.js';
import {
  validateSyncPayload,
  validateAthletePayload,
  validateTransactionPayload,
  validateAttendancePayload,
  validateDefinitionPayload
} from '../middleware/validator.js';

export const syncRouter = Router();

// Health Check
syncRouter.get('/health', syncController.healthCheck);

// Two-Way Mobile Sync Pipeline
syncRouter.post(
  '/api/sync',
  syncRateLimiter,
  verifySchoolLicense,
  validateSyncPayload,
  syncController.handleFullSync
);

// Dedicated RESTful v1 Endpoints (School License Protected)
syncRouter.get('/api/v1/athletes', verifySchoolLicense, syncController.getAthletes);
syncRouter.post('/api/v1/athletes', verifySchoolLicense, validateAthletePayload, syncController.upsertAthlete);

syncRouter.get('/api/v1/transactions', verifySchoolLicense, syncController.getTransactions);
syncRouter.post('/api/v1/transactions', verifySchoolLicense, validateTransactionPayload, syncController.createTransaction);

syncRouter.post('/api/v1/attendance', verifySchoolLicense, validateAttendancePayload, syncController.recordAttendance);

syncRouter.get('/api/v1/definitions', verifySchoolLicense, syncController.getDefinitions);
syncRouter.post('/api/v1/definitions', verifySchoolLicense, validateDefinitionPayload, syncController.upsertDefinition);
