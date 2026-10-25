/**
 * Transaction Repository - Barati Swimming Academy
 * Handles encrypted CRUD for financial transactions (ledger).
 * Encrypts: title, amount, author
 * Preserves unencrypted indexed queries on: date, type ('income' | 'expense' | 'coach_payout')
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

export class TransactionRepository {
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
      date: row.date,
      type: row.type,
      title: this.crypto.decryptField(row.title_encrypted),
      amount: Number(this.crypto.decryptField(row.amount_encrypted)) || 0,
      method: row.method,
      author: this.crypto.decryptField(row.author_encrypted),
      syncedAt: row.synced_at,
    };
  }

  create(schoolId, tx) {
    if (typeof schoolId !== 'string' || !schoolId.trim()) {
      throw new ValidationError('Invalid schoolId: must be a non-empty string');
    }
    if (!tx || typeof tx !== 'object' || Array.isArray(tx)) {
      throw new ValidationError('Invalid transaction: must be an object');
    }
    if (typeof tx.id !== 'string' || !tx.id.trim()) {
      throw new ValidationError('Transaction ID must be a non-empty string');
    }
    if (tx.date !== undefined && tx.date !== null && typeof tx.date !== 'string') {
      throw new ValidationError('Transaction date must be a valid string');
    }
    const date = (typeof tx.date === 'string' && tx.date.trim() !== '')
      ? tx.date.trim()
      : new Date().toISOString();

    let type = 'income';
    if (tx.type !== undefined) {
      if (tx.type === null) {
        type = null;
      } else if (typeof tx.type === 'string') {
        type = tx.type.trim();
      } else {
        throw new ValidationError('Transaction type must be a valid string');
      }
    }

    const stmt = this.db.prepare(`
      INSERT INTO transactions (
        school_id, id, date, type, title_encrypted, amount_encrypted, method, author_encrypted
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      schoolId.trim(),
      tx.id.trim(),
      date,
      type,
      this.crypto.encryptField(tx.title || ''),
      this.crypto.encryptField(Number(tx.amount) || 0),
      tx.method ? String(tx.method) : 'cash',
      this.crypto.encryptField(tx.author ? String(tx.author) : '')
    );

    return this.findById(schoolId.trim(), tx.id.trim());
  }

  upsert(schoolId, tx) {
    if (typeof schoolId !== 'string' || !schoolId.trim()) {
      throw new ValidationError('Invalid schoolId: must be a non-empty string');
    }
    if (!tx || typeof tx !== 'object' || Array.isArray(tx)) {
      throw new ValidationError('Invalid transaction: must be an object');
    }
    if (typeof tx.id !== 'string' || !tx.id.trim()) {
      throw new ValidationError('Transaction ID must be a non-empty string');
    }
    if (tx.date !== undefined && tx.date !== null && typeof tx.date !== 'string') {
      throw new ValidationError('Transaction date must be a valid string');
    }
    const date = (typeof tx.date === 'string' && tx.date.trim() !== '')
      ? tx.date.trim()
      : new Date().toISOString();

    let type = 'income';
    if (tx.type !== undefined) {
      if (tx.type === null) {
        type = null;
      } else if (typeof tx.type === 'string') {
        type = tx.type.trim();
      } else {
        throw new ValidationError('Transaction type must be a valid string');
      }
    }

    const stmt = this.db.prepare(`
      INSERT INTO transactions (
        school_id, id, date, type, title_encrypted, amount_encrypted, method, author_encrypted
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(school_id, id) DO UPDATE SET
        date = excluded.date,
        type = excluded.type,
        title_encrypted = excluded.title_encrypted,
        amount_encrypted = excluded.amount_encrypted,
        method = excluded.method,
        author_encrypted = excluded.author_encrypted,
        synced_at = CURRENT_TIMESTAMP
    `);

    stmt.run(
      schoolId.trim(),
      tx.id.trim(),
      date,
      type,
      this.crypto.encryptField(tx.title || ''),
      this.crypto.encryptField(Number(tx.amount) || 0),
      tx.method ? String(tx.method) : 'cash',
      this.crypto.encryptField(tx.author ? String(tx.author) : '')
    );

    return this.findById(schoolId.trim(), tx.id.trim());
  }

  findById(schoolId, id) {
    if (typeof schoolId !== 'string' || !schoolId.trim() || typeof id !== 'string' || !id.trim()) {
      return null;
    }
    const row = this.db.prepare(`
      SELECT * FROM transactions WHERE school_id = ? AND id = ?
    `).get(schoolId.trim(), id.trim());
    return this._mapRow(row);
  }

  findAllBySchoolId(schoolId, options = {}) {
    if (typeof schoolId !== 'string' || !schoolId.trim()) {
      return [];
    }
    const { type, startDate, endDate, syncedSince, limit = 500, offset = 0 } = options;
    let sql = 'SELECT * FROM transactions WHERE school_id = ?';
    const params = [schoolId.trim()];

    if (type && typeof type === 'string' && type.trim()) {
      sql += ' AND type = ?';
      params.push(type.trim());
    }
    if (startDate && typeof startDate === 'string' && startDate.trim()) {
      sql += ' AND date >= ?';
      params.push(startDate.trim());
    }
    if (endDate && typeof endDate === 'string' && endDate.trim()) {
      sql += ' AND date <= ?';
      params.push(endDate.trim());
    }
    if (syncedSince && typeof syncedSince === 'string' && syncedSince.trim()) {
      sql += ' AND synced_at >= ?';
      params.push(syncedSince.trim());
    }

    const safeLimit = !Number.isNaN(Number(limit)) ? Math.max(0, Number(limit)) : 500;
    const safeOffset = !Number.isNaN(Number(offset)) ? Math.max(0, Number(offset)) : 0;
    sql += ' ORDER BY date DESC LIMIT ? OFFSET ?';
    params.push(safeLimit, safeOffset);

    const rows = this.db.prepare(sql).all(...params);
    return rows.map(r => this._mapRow(r));
  }

  batchUpsert(schoolId, transactions) {
    if (typeof schoolId !== 'string' || !schoolId.trim()) {
      throw new ValidationError('Invalid schoolId: must be a non-empty string');
    }
    if (!Array.isArray(transactions)) {
      throw new ValidationError('Transactions payload must be an array');
    }
    if (transactions.length === 0) return 0;
    return withTransaction((db) => {
      const stmt = db.prepare(`
        INSERT INTO transactions (
          school_id, id, date, type, title_encrypted, amount_encrypted, method, author_encrypted
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(school_id, id) DO UPDATE SET
          date = excluded.date,
          type = excluded.type,
          title_encrypted = excluded.title_encrypted,
          amount_encrypted = excluded.amount_encrypted,
          method = excluded.method,
          author_encrypted = excluded.author_encrypted,
          synced_at = CURRENT_TIMESTAMP
      `);

      let count = 0;
      for (const item of transactions) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          throw new ValidationError('Each transaction entry must be a valid object');
        }
        if (typeof item.id !== 'string' || !item.id.trim()) {
          throw new ValidationError('Transaction ID must be a non-empty string');
        }
        if (item.date !== undefined && item.date !== null && typeof item.date !== 'string') {
          throw new ValidationError('Transaction date must be a valid string');
        }
        const date = (typeof item.date === 'string' && item.date.trim() !== '')
          ? item.date.trim()
          : new Date().toISOString();

        let type = 'income';
        if (item.type !== undefined) {
          if (item.type === null) {
            type = null;
          } else if (typeof item.type === 'string') {
            type = item.type.trim();
          } else {
            throw new ValidationError('Transaction type must be a valid string');
          }
        }

        stmt.run(
          schoolId.trim(),
          item.id.trim(),
          date,
          type,
          this.crypto.encryptField(item.title || ''),
          this.crypto.encryptField(Number(item.amount) || 0),
          item.method ? String(item.method) : 'cash',
          this.crypto.encryptField(item.author ? String(item.author) : '')
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
      DELETE FROM transactions WHERE school_id = ? AND id = ?
    `).run(schoolId.trim(), id.trim());
    return res.changes > 0;
  }
}

export const transactionRepo = new TransactionRepository();
