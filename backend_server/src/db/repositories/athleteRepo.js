/**
 * Athlete Repository - Barati Swimming Academy
 * Handles encrypted CRUD and synchronization for athlete profiles.
 * Encrypts: name, phone, cardUid, tuitionFee, paidAmount, debt
 * Decrypts transparently on read; restores exact number primitives for financial fields.
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

export class AthleteRepository {
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

  /**
   * Map raw SQLite database row to domain Athlete entity.
   * Restores numerical types for tuitionFee, paidAmount, and debt.
   * @private
   */
  _mapRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      schoolId: row.school_id,
      name: this.crypto.decryptField(row.name_encrypted),
      phone: this.crypto.decryptField(row.phone_encrypted),
      coachId: row.coach_id,
      cardUid: row.card_uid_encrypted ? this.crypto.decryptField(row.card_uid_encrypted) : '',
      packageName: row.package_name,
      totalSessions: row.total_sessions,
      remainingSessions: row.remaining_sessions,
      totalAttended: row.total_attended,
      tuitionFee: Number(this.crypto.decryptField(row.tuition_fee_encrypted)) || 0,
      paidAmount: Number(this.crypto.decryptField(row.paid_amount_encrypted)) || 0,
      debt: Number(this.crypto.decryptField(row.debt_encrypted)) || 0,
      expireDate: row.expire_date,
      syncedAt: row.synced_at,
    };
  }

  /**
   * Create a new athlete record with transparent field-level encryption.
   */
  create(schoolId, athlete) {
    if (typeof schoolId !== 'string' || !schoolId.trim()) {
      throw new ValidationError('Invalid schoolId: must be a non-empty string');
    }
    if (!athlete || typeof athlete !== 'object' || Array.isArray(athlete)) {
      throw new ValidationError('Invalid athlete: must be an object');
    }
    if (typeof athlete.id !== 'string' || !athlete.id.trim()) {
      throw new ValidationError('Athlete ID must be a non-empty string');
    }

    const stmt = this.db.prepare(`
      INSERT INTO athletes (
        school_id, id, name_encrypted, phone_encrypted, coach_id, card_uid_encrypted,
        package_name, total_sessions, remaining_sessions, total_attended,
        tuition_fee_encrypted, paid_amount_encrypted, debt_encrypted, expire_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      schoolId.trim(),
      athlete.id.trim(),
      this.crypto.encryptField(athlete.name),
      this.crypto.encryptField(athlete.phone || ''),
      athlete.coachId ? String(athlete.coachId) : '',
      this.crypto.encryptField(athlete.cardUid || ''),
      athlete.packageName ? String(athlete.packageName) : '',
      Number(athlete.totalSessions) || 0,
      Number(athlete.remainingSessions) || 0,
      Number(athlete.totalAttended) || 0,
      this.crypto.encryptField(Number(athlete.tuitionFee) || 0),
      this.crypto.encryptField(Number(athlete.paidAmount) || 0),
      this.crypto.encryptField(Number(athlete.debt) || 0),
      athlete.expireDate ? String(athlete.expireDate) : ''
    );

    return this.findById(schoolId.trim(), athlete.id.trim());
  }

  /**
   * Upsert athlete record (insert or update on conflict of composite PK).
   */
  upsert(schoolId, athlete) {
    if (typeof schoolId !== 'string' || !schoolId.trim()) {
      throw new ValidationError('Invalid schoolId: must be a non-empty string');
    }
    if (!athlete || typeof athlete !== 'object' || Array.isArray(athlete)) {
      throw new ValidationError('Invalid athlete: must be an object');
    }
    if (typeof athlete.id !== 'string' || !athlete.id.trim()) {
      throw new ValidationError('Athlete ID must be a non-empty string');
    }

    const stmt = this.db.prepare(`
      INSERT INTO athletes (
        school_id, id, name_encrypted, phone_encrypted, coach_id, card_uid_encrypted,
        package_name, total_sessions, remaining_sessions, total_attended,
        tuition_fee_encrypted, paid_amount_encrypted, debt_encrypted, expire_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(school_id, id) DO UPDATE SET
        name_encrypted = excluded.name_encrypted,
        phone_encrypted = excluded.phone_encrypted,
        coach_id = excluded.coach_id,
        card_uid_encrypted = excluded.card_uid_encrypted,
        package_name = excluded.package_name,
        total_sessions = excluded.total_sessions,
        remaining_sessions = excluded.remaining_sessions,
        total_attended = excluded.total_attended,
        tuition_fee_encrypted = excluded.tuition_fee_encrypted,
        paid_amount_encrypted = excluded.paid_amount_encrypted,
        debt_encrypted = excluded.debt_encrypted,
        expire_date = excluded.expire_date,
        synced_at = CURRENT_TIMESTAMP
    `);

    stmt.run(
      schoolId.trim(),
      athlete.id.trim(),
      this.crypto.encryptField(athlete.name),
      this.crypto.encryptField(athlete.phone || ''),
      athlete.coachId ? String(athlete.coachId) : '',
      this.crypto.encryptField(athlete.cardUid || ''),
      athlete.packageName ? String(athlete.packageName) : '',
      Number(athlete.totalSessions) || 0,
      Number(athlete.remainingSessions) || 0,
      Number(athlete.totalAttended) || 0,
      this.crypto.encryptField(Number(athlete.tuitionFee) || 0),
      this.crypto.encryptField(Number(athlete.paidAmount) || 0),
      this.crypto.encryptField(Number(athlete.debt) || 0),
      athlete.expireDate ? String(athlete.expireDate) : ''
    );

    return this.findById(schoolId.trim(), athlete.id.trim());
  }

  /**
   * Find athlete by ID within a school.
   */
  findById(schoolId, id) {
    if (typeof schoolId !== 'string' || !schoolId.trim() || typeof id !== 'string' || !id.trim()) {
      return null;
    }
    const row = this.db.prepare(`
      SELECT * FROM athletes WHERE school_id = ? AND id = ?
    `).get(schoolId.trim(), id.trim());
    return this._mapRow(row);
  }

  /**
   * Retrieve all athletes for a school.
   */
  findAllBySchoolId(schoolId, options = {}) {
    if (typeof schoolId !== 'string' || !schoolId.trim()) {
      return [];
    }
    const { syncedSince, limit, offset } = options;
    let sql = 'SELECT * FROM athletes WHERE school_id = ?';
    const params = [schoolId.trim()];

    if (syncedSince && typeof syncedSince === 'string' && syncedSince.trim()) {
      sql += ' AND synced_at >= ?';
      params.push(syncedSince.trim());
    }

    sql += ' ORDER BY synced_at DESC';

    if (limit !== undefined && !Number.isNaN(Number(limit))) {
      sql += ' LIMIT ?';
      params.push(Number(limit));
      if (offset !== undefined && !Number.isNaN(Number(offset))) {
        sql += ' OFFSET ?';
        params.push(Number(offset));
      }
    }

    const rows = this.db.prepare(sql).all(...params);
    return rows.map(r => this._mapRow(r));
  }

  /**
   * Find athlete by RFID / NFC Card UID for a school.
   */
  findByCardUid(schoolId, cardUid) {
    if (typeof schoolId !== 'string' || !schoolId.trim() || !cardUid || typeof cardUid !== 'string') return null;
    const target = cardUid.trim().toUpperCase();
    const athletes = this.findAllBySchoolId(schoolId);
    return athletes.find(a => (a.cardUid || '').toUpperCase() === target) || null;
  }

  /**
   * Atomic batch upsert for mobile synchronization payloads.
   */
  batchUpsert(schoolId, athletes) {
    if (typeof schoolId !== 'string' || !schoolId.trim()) {
      throw new ValidationError('Invalid schoolId: must be a non-empty string');
    }
    if (!Array.isArray(athletes)) {
      throw new ValidationError('Athletes payload must be an array');
    }
    if (athletes.length === 0) return 0;
    return withTransaction((db) => {
      const stmt = db.prepare(`
        INSERT INTO athletes (
          school_id, id, name_encrypted, phone_encrypted, coach_id, card_uid_encrypted,
          package_name, total_sessions, remaining_sessions, total_attended,
          tuition_fee_encrypted, paid_amount_encrypted, debt_encrypted, expire_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(school_id, id) DO UPDATE SET
          name_encrypted = excluded.name_encrypted,
          phone_encrypted = excluded.phone_encrypted,
          coach_id = excluded.coach_id,
          card_uid_encrypted = excluded.card_uid_encrypted,
          package_name = excluded.package_name,
          total_sessions = excluded.total_sessions,
          remaining_sessions = excluded.remaining_sessions,
          total_attended = excluded.total_attended,
          tuition_fee_encrypted = excluded.tuition_fee_encrypted,
          paid_amount_encrypted = excluded.paid_amount_encrypted,
          debt_encrypted = excluded.debt_encrypted,
          expire_date = excluded.expire_date,
          synced_at = CURRENT_TIMESTAMP
      `);

      let count = 0;
      for (const a of athletes) {
        if (!a || typeof a !== 'object' || Array.isArray(a)) {
          throw new ValidationError('Each athlete entry must be a valid object');
        }
        if (typeof a.id !== 'string' || !a.id.trim()) {
          throw new ValidationError('Athlete ID must be a non-empty string');
        }
        stmt.run(
          schoolId.trim(),
          a.id.trim(),
          this.crypto.encryptField(a.name),
          this.crypto.encryptField(a.phone || ''),
          a.coachId ? String(a.coachId) : '',
          this.crypto.encryptField(a.cardUid || ''),
          a.packageName ? String(a.packageName) : '',
          Number(a.totalSessions) || 0,
          Number(a.remainingSessions) || 0,
          Number(a.totalAttended) || 0,
          this.crypto.encryptField(Number(a.tuitionFee) || 0),
          this.crypto.encryptField(Number(a.paidAmount) || 0),
          this.crypto.encryptField(Number(a.debt) || 0),
          a.expireDate ? String(a.expireDate) : ''
        );
        count++;
      }
      return count;
    });
  }

  /**
   * Delete athlete by ID within a school.
   */
  delete(schoolId, id) {
    if (typeof schoolId !== 'string' || !schoolId.trim() || typeof id !== 'string' || !id.trim()) {
      return false;
    }
    const res = this.db.prepare(`
      DELETE FROM athletes WHERE school_id = ? AND id = ?
    `).run(schoolId.trim(), id.trim());
    return res.changes > 0;
  }

  /**
   * Count athletes for a school.
   */
  count(schoolId) {
    if (typeof schoolId !== 'string' || !schoolId.trim()) {
      return 0;
    }
    const row = this.db.prepare(`
      SELECT count(*) as total FROM athletes WHERE school_id = ?
    `).get(schoolId.trim());
    return row ? row.total : 0;
  }

  /**
   * Find all athletes across all schools (for admin overview)
   */
  findAll(options = {}) {
    const { limit = 200, offset = 0 } = options;
    const safeLimit = !Number.isNaN(Number(limit)) ? Math.max(0, Number(limit)) : 200;
    const safeOffset = !Number.isNaN(Number(offset)) ? Math.max(0, Number(offset)) : 0;
    const rows = this.db.prepare(`
      SELECT * FROM athletes ORDER BY updated_at DESC LIMIT ? OFFSET ?
    `).all(safeLimit, safeOffset);
    return rows.map(r => this._mapRow(r));
  }
}

export const athleteRepo = new AthleteRepository();
