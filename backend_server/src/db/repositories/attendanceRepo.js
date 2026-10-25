/**
 * Attendance Repository - Barati Swimming Academy
 * Handles encrypted CRUD for gate access attendance logs.
 * Encrypts: athleteName, note
 * Preserves unencrypted indexed queries on: time, status ('approved' | 'warning' | 'denied' | 'grace_entry')
 */

import { getDatabase, withTransaction } from '../database.js';
import { encryptField, decryptField } from '../../security/crypto.js';

/**
 * Error thrown when repository method arguments or payload entities fail validation.
 * Preempts node:sqlite TypeError binding failures and surfaces as HTTP 400.
 */
export class ValidationError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = 'ValidationError';
    this.code = 'VALIDATION_FAILED';
    this.statusCode = 400;
    this.status = 400;
    this.details = details;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ValidationError);
    }
  }
}

export class AttendanceRepository {
  /**
   * @param {import('node:sqlite').DatabaseSync} [db]
   * @param {{ encryptField: Function, decryptField: Function }} [cryptoEngine]
   */
  constructor(db, cryptoEngine) {
    this._db = db || null;
    this.crypto = cryptoEngine || { encryptField, decryptField };
  }

  get db() {
    return this._db || getDatabase();
  }

  _mapRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      schoolId: row.school_id,
      time: row.time,
      athleteName: this.crypto.decryptField(row.athlete_name_encrypted),
      coachName: row.coach_name,
      status: row.status,
      sessionsLeft: row.sessions_left,
      note: row.note_encrypted ? this.crypto.decryptField(row.note_encrypted) : '',
      syncedAt: row.synced_at,
    };
  }

  create(schoolId, log) {
    if (typeof schoolId !== 'string' || !schoolId.trim()) {
      throw new ValidationError('Invalid schoolId: must be a non-empty string');
    }
    if (!log || typeof log !== 'object' || Array.isArray(log)) {
      throw new ValidationError('Invalid attendance log: must be an object');
    }
    if (typeof log.id !== 'string' || !log.id.trim()) {
      throw new ValidationError('Attendance log ID must be a non-empty string');
    }
    if (log.time !== undefined && log.time !== null && typeof log.time !== 'string') {
      throw new ValidationError('Attendance log time must be a valid string');
    }
    const time = (typeof log.time === 'string' && log.time.trim() !== '')
      ? log.time.trim()
      : new Date().toISOString();
    const athleteName = log.athleteName !== undefined ? log.athleteName : (log.athlete_name || '');
    const coachName = log.coachName || log.coach_name ? String(log.coachName || log.coach_name) : '';
    const status = (typeof log.status === 'string' && log.status.trim() !== '') ? log.status.trim() : 'approved';
    const sessionsLeft = Number(log.sessionsLeft !== undefined ? log.sessionsLeft : log.sessions_left) || 0;
    const note = log.note !== undefined && log.note !== null ? String(log.note) : '';

    const stmt = this.db.prepare(`
      INSERT INTO attendance_logs (
        school_id, id, time, athlete_name_encrypted, coach_name, status, sessions_left, note_encrypted
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      schoolId.trim(),
      log.id.trim(),
      time,
      this.crypto.encryptField(athleteName),
      coachName,
      status,
      sessionsLeft,
      this.crypto.encryptField(note)
    );

    return this.findById(schoolId.trim(), log.id.trim());
  }

  upsert(schoolId, log) {
    if (typeof schoolId !== 'string' || !schoolId.trim()) {
      throw new ValidationError('Invalid schoolId: must be a non-empty string');
    }
    if (!log || typeof log !== 'object' || Array.isArray(log)) {
      throw new ValidationError('Invalid attendance log: must be an object');
    }
    if (typeof log.id !== 'string' || !log.id.trim()) {
      throw new ValidationError('Attendance log ID must be a non-empty string');
    }
    if (log.time !== undefined && log.time !== null && typeof log.time !== 'string') {
      throw new ValidationError('Attendance log time must be a valid string');
    }
    const time = (typeof log.time === 'string' && log.time.trim() !== '')
      ? log.time.trim()
      : new Date().toISOString();
    const athleteName = log.athleteName !== undefined ? log.athleteName : (log.athlete_name || '');
    const coachName = log.coachName || log.coach_name ? String(log.coachName || log.coach_name) : '';
    const status = (typeof log.status === 'string' && log.status.trim() !== '') ? log.status.trim() : 'approved';
    const sessionsLeft = Number(log.sessionsLeft !== undefined ? log.sessionsLeft : log.sessions_left) || 0;
    const note = log.note !== undefined && log.note !== null ? String(log.note) : '';

    const stmt = this.db.prepare(`
      INSERT INTO attendance_logs (
        school_id, id, time, athlete_name_encrypted, coach_name, status, sessions_left, note_encrypted
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(school_id, id) DO UPDATE SET
        time = excluded.time,
        athlete_name_encrypted = excluded.athlete_name_encrypted,
        coach_name = excluded.coach_name,
        status = excluded.status,
        sessions_left = excluded.sessions_left,
        note_encrypted = excluded.note_encrypted,
        synced_at = CURRENT_TIMESTAMP
    `);

    stmt.run(
      schoolId.trim(),
      log.id.trim(),
      time,
      this.crypto.encryptField(athleteName),
      coachName,
      status,
      sessionsLeft,
      this.crypto.encryptField(note)
    );

    return this.findById(schoolId.trim(), log.id.trim());
  }

  findById(schoolId, id) {
    if (typeof schoolId !== 'string' || !schoolId.trim() || typeof id !== 'string' || !id.trim()) {
      return null;
    }
    const row = this.db.prepare(`
      SELECT * FROM attendance_logs WHERE school_id = ? AND id = ?
    `).get(schoolId.trim(), id.trim());
    return this._mapRow(row);
  }

  findAllBySchoolId(schoolId, options = {}) {
    if (typeof schoolId !== 'string' || !schoolId.trim()) {
      return [];
    }
    const { status, syncedSince, limit = 200, offset = 0 } = options;
    let sql = 'SELECT * FROM attendance_logs WHERE school_id = ?';
    const params = [schoolId.trim()];

    if (status && typeof status === 'string' && status.trim()) {
      sql += ' AND status = ?';
      params.push(status.trim());
    }
    if (syncedSince && typeof syncedSince === 'string' && syncedSince.trim()) {
      sql += ' AND synced_at >= ?';
      params.push(syncedSince.trim());
    }

    const safeLimit = !Number.isNaN(Number(limit)) ? Math.max(0, Number(limit)) : 200;
    const safeOffset = !Number.isNaN(Number(offset)) ? Math.max(0, Number(offset)) : 0;
    sql += ' ORDER BY time DESC LIMIT ? OFFSET ?';
    params.push(safeLimit, safeOffset);

    const rows = this.db.prepare(sql).all(...params);
    return rows.map(r => this._mapRow(r));
  }

  batchUpsert(schoolId, logs) {
    if (typeof schoolId !== 'string' || !schoolId.trim()) {
      throw new ValidationError('Invalid schoolId: must be a non-empty string');
    }
    if (!Array.isArray(logs)) {
      throw new ValidationError('Attendance logs payload must be an array');
    }
    if (logs.length === 0) return 0;
    return withTransaction((db) => {
      const stmt = db.prepare(`
        INSERT INTO attendance_logs (
          school_id, id, time, athlete_name_encrypted, coach_name, status, sessions_left, note_encrypted
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(school_id, id) DO UPDATE SET
          time = excluded.time,
          athlete_name_encrypted = excluded.athlete_name_encrypted,
          coach_name = excluded.coach_name,
          status = excluded.status,
          sessions_left = excluded.sessions_left,
          note_encrypted = excluded.note_encrypted,
          synced_at = CURRENT_TIMESTAMP
      `);

      let count = 0;
      for (const item of logs) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          throw new ValidationError('Each attendance entry must be a valid object');
        }
        if (typeof item.id !== 'string' || !item.id.trim()) {
          throw new ValidationError('Attendance log ID must be a non-empty string');
        }
        if (item.time !== undefined && item.time !== null && typeof item.time !== 'string') {
          throw new ValidationError('Attendance log time must be a valid string');
        }
        const time = (typeof item.time === 'string' && item.time.trim() !== '')
          ? item.time.trim()
          : new Date().toISOString();
        const athleteName = item.athleteName !== undefined ? item.athleteName : (item.athlete_name || '');
        const coachName = item.coachName || item.coach_name ? String(item.coachName || item.coach_name) : '';
        const status = (typeof item.status === 'string' && item.status.trim() !== '') ? item.status.trim() : 'approved';
        const sessionsLeft = Number(item.sessionsLeft !== undefined ? item.sessionsLeft : item.sessions_left) || 0;
        const note = item.note !== undefined && item.note !== null ? String(item.note) : '';

        stmt.run(
          schoolId.trim(),
          item.id.trim(),
          time,
          this.crypto.encryptField(athleteName),
          coachName,
          status,
          sessionsLeft,
          this.crypto.encryptField(note)
        );
        count++;
      }
      return count;
    });
  }

  delete(schoolId, id) {
    if (typeof schoolId !== 'string' || !schoolId.trim() || typeof id !== 'string' || !id.trim()) {
      return false;
    }
    const res = this.db.prepare(`
      DELETE FROM attendance_logs WHERE school_id = ? AND id = ?
    `).run(schoolId.trim(), id.trim());
    return res.changes > 0;
  }

  /**
   * Find all attendance records across all schools (for admin overview)
   */
  findAll(options = {}) {
    const { limit = 200, offset = 0 } = options;
    const safeLimit = !Number.isNaN(Number(limit)) ? Math.max(0, Number(limit)) : 200;
    const safeOffset = !Number.isNaN(Number(offset)) ? Math.max(0, Number(offset)) : 0;
    const rows = this.db.prepare(`
      SELECT * FROM attendance_logs ORDER BY time DESC LIMIT ? OFFSET ?
    `).all(safeLimit, safeOffset);
    return rows.map(r => this._mapRow(r));
  }
}

export const attendanceRepo = new AttendanceRepository();
