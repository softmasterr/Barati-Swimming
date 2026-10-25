/**
 * Sync Controller - Barati Swimming Academy Cloud Backend
 * Handles service health, atomic multi-table synchronization, and dedicated RESTful endpoints.
 */

import { withTransaction } from '../db/database.js';
import { athleteRepo } from '../db/repositories/athleteRepo.js';
import { attendanceRepo } from '../db/repositories/attendanceRepo.js';
import { transactionRepo } from '../db/repositories/transactionRepo.js';
import { definitionRepo } from '../db/repositories/definitionRepo.js';
import { settingsRepo } from '../db/repositories/settingsRepo.js';

export class SyncController {
  /**
   * Health check endpoint
   */
  healthCheck(req, res) {
    return res.status(200).json({
      status: 'healthy',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      service: 'barati-swimming-cloud-server'
    });
  }

  /**
   * Atomic two-way mobile client data synchronization.
   */
  handleFullSync(req, res, next) {
    try {
      const schoolId = req.schoolId || req.school.schoolId;
      const {
        athletes = [],
        attendanceLogs = [],
        transactions = [],
        definitions = [],
        settings = null,
        lastSyncTimestamp = null,
      } = req.body;

      // 1. Atomic Multi-Table Ingestion (Upstream Push)
      const stats = withTransaction(() => {
        const athletesProcessed = athleteRepo.batchUpsert(schoolId, athletes);
        const attendanceLogsProcessed = attendanceRepo.batchUpsert(schoolId, attendanceLogs);
        const transactionsProcessed = transactionRepo.batchUpsert(schoolId, transactions);
        const definitionsProcessed = definitionRepo.batchUpsert(schoolId, definitions);

        let settingsProcessed = 0;
        if (settings) {
          settingsRepo.upsert(schoolId, settings);
          settingsProcessed = 1;
        }

        return {
          athletesProcessed,
          attendanceLogsProcessed,
          transactionsProcessed,
          definitionsProcessed,
          settingsProcessed
        };
      });

      // 2. Downstream Delta Extraction (Pull authoritative state)
      const serverTimestamp = new Date().toISOString();
      const deltaOptions = lastSyncTimestamp ? { syncedSince: lastSyncTimestamp } : {};

      const syncedAthletes = athleteRepo.findAllBySchoolId(schoolId, deltaOptions);
      const syncedAttendance = attendanceRepo.findAllBySchoolId(schoolId, { ...deltaOptions, limit: 500 });
      const syncedTransactions = transactionRepo.findAllBySchoolId(schoolId, { ...deltaOptions, limit: 500 });
      const syncedDefinitions = definitionRepo.findAllBySchoolId(schoolId, deltaOptions);
      const syncedSettings = settingsRepo.findBySchoolId(schoolId);

      return res.status(200).json({
        status: 'success',
        serverTimestamp,
        synced: {
          athletesCount: stats.athletesProcessed,
          attendanceCount: stats.attendanceLogsProcessed,
          transactionsCount: stats.transactionsProcessed,
          definitionsCount: stats.definitionsProcessed,
          athletes: syncedAthletes,
          attendanceLogs: syncedAttendance,
          transactions: syncedTransactions,
          definitions: syncedDefinitions,
          settings: syncedSettings
        },
        stats
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Dedicated RESTful v1 Athletes endpoints
   */
  getAthletes(req, res, next) {
    try {
      const schoolId = req.schoolId || req.school.schoolId;
      const { coachId, search } = req.query;
      let athletes = athleteRepo.findAllBySchoolId(schoolId);

      if (coachId) {
        athletes = athletes.filter(a => a.coachId === coachId);
      }
      if (search) {
        const q = search.trim().toLowerCase();
        athletes = athletes.filter(a =>
          (a.name && a.name.toLowerCase().includes(q)) ||
          (a.phone && a.phone.includes(q))
        );
      }

      return res.status(200).json(athletes);
    } catch (err) {
      next(err);
    }
  }

  upsertAthlete(req, res, next) {
    try {
      const schoolId = req.schoolId || req.school.schoolId;
      const athlete = athleteRepo.upsert(schoolId, req.body);
      return res.status(200).json({ status: 'success', athlete });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Dedicated RESTful v1 Transactions endpoints
   */
  getTransactions(req, res, next) {
    try {
      const schoolId = req.schoolId || req.school.schoolId;
      const { type, startDate, endDate, limit, offset } = req.query;
      const transactions = transactionRepo.findAllBySchoolId(schoolId, {
        type,
        startDate,
        endDate,
        limit: limit ? parseInt(limit, 10) : 500,
        offset: offset ? parseInt(offset, 10) : 0
      });

      return res.status(200).json(transactions);
    } catch (err) {
      next(err);
    }
  }

  createTransaction(req, res, next) {
    try {
      const schoolId = req.schoolId || req.school.schoolId;
      const transaction = transactionRepo.upsert(schoolId, req.body);
      return res.status(201).json({ status: 'success', transaction });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Dedicated RESTful v1 Attendance endpoints
   */
  recordAttendance(req, res, next) {
    try {
      const schoolId = req.schoolId || req.school.schoolId;
      const attendance = attendanceRepo.upsert(schoolId, req.body);
      return res.status(201).json({ status: 'success', attendance });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Dedicated RESTful v1 Definitions endpoints
   */
  getDefinitions(req, res, next) {
    try {
      const schoolId = req.schoolId || req.school.schoolId;
      const { type } = req.query;
      const definitions = definitionRepo.findAllBySchoolId(schoolId, { type });
      return res.status(200).json(definitions);
    } catch (err) {
      next(err);
    }
  }

  upsertDefinition(req, res, next) {
    try {
      const schoolId = req.schoolId || req.school.schoolId;
      const definition = definitionRepo.upsert(schoolId, req.body);
      return res.status(200).json({ status: 'success', definition });
    } catch (err) {
      next(err);
    }
  }
}

export const syncController = new SyncController();
