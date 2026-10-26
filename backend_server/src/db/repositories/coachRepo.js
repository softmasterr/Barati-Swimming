/**
 * Coach Repository - Barati Swimming Academy
 * Handles encrypted CRUD for swimming academy coaches and instructors.
 * Encrypts: name, specialty, phone
 */

import { getDatabase, withTransaction } from '../database.js';
import { encryptField, decryptField } from '../../security/crypto.js';

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

export class CoachRepository {
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
      schoolId: row.school_id,
      id: row.id,
      name: this.crypto.decryptField(row.name_encrypted),
      specialty: row.specialty_encrypted ? this.crypto.decryptField(row.specialty_encrypted) : '',
      phone: row.phone_encrypted ? this.crypto.decryptField(row.phone_encrypted) : '',
      modelType: row.model_type || 'percentage',
      modelVal: row.model_val || 0,
      settledAmount: row.settled_amount || 0,
      syncedAt: row.synced_at
    };
  }

  upsert(schoolId, coach) {
    if (typeof schoolId !== 'string' || !schoolId.trim()) {
      throw new ValidationError('Invalid schoolId: must be a non-empty string');
    }
    if (!coach || typeof coach !== 'object' || Array.isArray(coach)) {
      throw new ValidationError('Invalid coach payload');
    }
    if (typeof coach.id !== 'string' || !coach.id.trim()) {
      throw new ValidationError('Coach ID must be a non-empty string');
    }

    const name = coach.name !== undefined ? String(coach.name) : '';
    const specialty = coach.specialty !== undefined ? String(coach.specialty) : '';
    const phone = coach.phone !== undefined ? String(coach.phone) : '';
    const modelType = coach.modelType || coach.model_type || 'percentage';
    const modelVal = Number(coach.modelVal !== undefined ? coach.modelVal : coach.model_val) || 0;
    const settledAmount = Number(coach.settledAmount !== undefined ? coach.settledAmount : coach.settled_amount) || 0;

    const stmt = this.db.prepare(`
      INSERT INTO coaches (
        school_id, id, name_encrypted, specialty_encrypted, phone_encrypted, model_type, model_val, settled_amount
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(school_id, id) DO UPDATE SET
        name_encrypted = excluded.name_encrypted,
        specialty_encrypted = excluded.specialty_encrypted,
        phone_encrypted = excluded.phone_encrypted,
        model_type = excluded.model_type,
        model_val = excluded.model_val,
        settled_amount = excluded.settled_amount,
        synced_at = CURRENT_TIMESTAMP
    `);

    stmt.run(
      schoolId.trim(),
      coach.id.trim(),
      this.crypto.encryptField(name),
      this.crypto.encryptField(specialty),
      this.crypto.encryptField(phone),
      modelType,
      modelVal,
      settledAmount
    );

    return this.findById(schoolId.trim(), coach.id.trim());
  }

  findById(schoolId, id) {
    if (!schoolId || !id) return null;
    const row = this.db.prepare('SELECT * FROM coaches WHERE school_id = ? AND id = ?').get(schoolId.trim(), id.trim());
    return this._mapRow(row);
  }

  findAllBySchoolId(schoolId) {
    if (!schoolId) return [];
    const rows = this.db.prepare('SELECT * FROM coaches WHERE school_id = ? ORDER BY synced_at DESC').all(schoolId.trim());
    return rows.map(r => this._mapRow(r));
  }

  findAll(options = {}) {
    const { limit = 200, offset = 0 } = options;
    const safeLimit = !Number.isNaN(Number(limit)) ? Math.max(0, Number(limit)) : 200;
    const safeOffset = !Number.isNaN(Number(offset)) ? Math.max(0, Number(offset)) : 0;
    const rows = this.db.prepare('SELECT * FROM coaches ORDER BY synced_at DESC LIMIT ? OFFSET ?').all(safeLimit, safeOffset);
    return rows.map(r => this._mapRow(r));
  }

  batchUpsert(schoolId, coaches) {
    if (!schoolId || !Array.isArray(coaches)) return 0;
    if (coaches.length === 0) return 0;
    return withTransaction(() => {
      let count = 0;
      for (const item of coaches) {
        this.upsert(schoolId, item);
        count++;
      }
      return count;
    });
  }

  delete(schoolId, id) {
    if (!schoolId || !id) return false;
    const res = this.db.prepare('DELETE FROM coaches WHERE school_id = ? AND id = ?').run(schoolId.trim(), id.trim());
    return res.changes > 0;
  }
}

export const coachRepo = new CoachRepository();
