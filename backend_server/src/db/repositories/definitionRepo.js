/**
 * Definition Repository - Barati Swimming Academy
 * Handles CRUD and synchronization for definitions (cost centers, goods items, course types/packages).
 */

import { getDatabase, withTransaction } from '../database.js';

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

export class DefinitionRepository {
  /**
   * @param {import('node:sqlite').DatabaseSync} [db]
   */
  constructor(db) {
    this._db = db || null;
  }

  get db() {
    return this._db || getDatabase();
  }

  _mapRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      schoolId: row.school_id,
      type: row.type,
      title: row.title,
      code: row.code,
      description: row.description || '',
      price: Number(row.price) || 0,
      sessions: Number(row.sessions) || 0,
      syncedAt: row.synced_at,
    };
  }

  create(schoolId, definition) {
    if (typeof schoolId !== 'string' || !schoolId.trim()) {
      throw new ValidationError('Invalid schoolId: must be a non-empty string');
    }
    if (!definition || typeof definition !== 'object' || Array.isArray(definition)) {
      throw new ValidationError('Invalid definition: must be an object');
    }
    if (typeof definition.id !== 'string' || !definition.id.trim()) {
      throw new ValidationError('Definition ID must be a non-empty string');
    }
    if (typeof definition.type !== 'string' || !definition.type.trim()) {
      throw new ValidationError('Definition type must be a non-empty string');
    }
    const title = typeof definition.title === 'string' ? definition.title : (definition.title ? String(definition.title) : '');

    const stmt = this.db.prepare(`
      INSERT INTO definitions (
        school_id, id, type, title, code, description, price, sessions
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      schoolId.trim(),
      definition.id.trim(),
      definition.type.trim(),
      title,
      definition.code ? String(definition.code) : '',
      definition.description ? String(definition.description) : '',
      Number(definition.price) || 0,
      Number(definition.sessions) || 0
    );

    return this.findById(schoolId.trim(), definition.id.trim());
  }

  upsert(schoolId, definition) {
    if (typeof schoolId !== 'string' || !schoolId.trim()) {
      throw new ValidationError('Invalid schoolId: must be a non-empty string');
    }
    if (!definition || typeof definition !== 'object' || Array.isArray(definition)) {
      throw new ValidationError('Invalid definition: must be an object');
    }
    if (typeof definition.id !== 'string' || !definition.id.trim()) {
      throw new ValidationError('Definition ID must be a non-empty string');
    }
    if (typeof definition.type !== 'string' || !definition.type.trim()) {
      throw new ValidationError('Definition type must be a non-empty string');
    }
    const title = typeof definition.title === 'string' ? definition.title : (definition.title ? String(definition.title) : '');

    const stmt = this.db.prepare(`
      INSERT INTO definitions (
        school_id, id, type, title, code, description, price, sessions
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(school_id, id) DO UPDATE SET
        type = excluded.type,
        title = excluded.title,
        code = excluded.code,
        description = excluded.description,
        price = excluded.price,
        sessions = excluded.sessions,
        synced_at = CURRENT_TIMESTAMP
    `);

    stmt.run(
      schoolId.trim(),
      definition.id.trim(),
      definition.type.trim(),
      title,
      definition.code ? String(definition.code) : '',
      definition.description ? String(definition.description) : '',
      Number(definition.price) || 0,
      Number(definition.sessions) || 0
    );

    return this.findById(schoolId.trim(), definition.id.trim());
  }

  findById(schoolId, id) {
    if (typeof schoolId !== 'string' || !schoolId.trim() || typeof id !== 'string' || !id.trim()) {
      return null;
    }
    const row = this.db.prepare(`
      SELECT * FROM definitions WHERE school_id = ? AND id = ?
    `).get(schoolId.trim(), id.trim());
    return this._mapRow(row);
  }

  findAllBySchoolId(schoolId, options = {}) {
    if (typeof schoolId !== 'string' || !schoolId.trim()) {
      return [];
    }
    const { type, syncedSince, limit = 500, offset = 0 } = options;
    let sql = 'SELECT * FROM definitions WHERE school_id = ?';
    const params = [schoolId.trim()];

    if (type && typeof type === 'string' && type.trim()) {
      sql += ' AND type = ?';
      params.push(type.trim());
    }
    if (syncedSince && typeof syncedSince === 'string' && syncedSince.trim()) {
      sql += ' AND synced_at >= ?';
      params.push(syncedSince.trim());
    }

    const safeLimit = !Number.isNaN(Number(limit)) ? Math.max(0, Number(limit)) : 500;
    const safeOffset = !Number.isNaN(Number(offset)) ? Math.max(0, Number(offset)) : 0;
    sql += ' ORDER BY synced_at DESC LIMIT ? OFFSET ?';
    params.push(safeLimit, safeOffset);

    const rows = this.db.prepare(sql).all(...params);
    return rows.map(r => this._mapRow(r));
  }

  batchUpsert(schoolId, definitions) {
    if (typeof schoolId !== 'string' || !schoolId.trim()) {
      throw new ValidationError('Invalid schoolId: must be a non-empty string');
    }
    if (!Array.isArray(definitions)) {
      throw new ValidationError('Definitions payload must be an array');
    }
    if (definitions.length === 0) return 0;
    return withTransaction((db) => {
      const stmt = db.prepare(`
        INSERT INTO definitions (
          school_id, id, type, title, code, description, price, sessions
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(school_id, id) DO UPDATE SET
          type = excluded.type,
          title = excluded.title,
          code = excluded.code,
          description = excluded.description,
          price = excluded.price,
          sessions = excluded.sessions,
          synced_at = CURRENT_TIMESTAMP
      `);

      let count = 0;
      for (const d of definitions) {
        if (!d || typeof d !== 'object' || Array.isArray(d)) {
          throw new ValidationError('Each definition entry must be a valid object');
        }
        if (typeof d.id !== 'string' || !d.id.trim()) {
          throw new ValidationError('Definition ID must be a non-empty string');
        }
        if (typeof d.type !== 'string' || !d.type.trim()) {
          throw new ValidationError('Definition type must be a non-empty string');
        }
        const title = typeof d.title === 'string' ? d.title : (d.title ? String(d.title) : '');

        stmt.run(
          schoolId.trim(),
          d.id.trim(),
          d.type.trim(),
          title,
          d.code ? String(d.code) : '',
          d.description ? String(d.description) : '',
          Number(d.price) || 0,
          Number(d.sessions) || 0
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
      DELETE FROM definitions WHERE school_id = ? AND id = ?
    `).run(schoolId.trim(), id.trim());
    return res.changes > 0;
  }

  count(schoolId, type) {
    if (typeof schoolId !== 'string' || !schoolId.trim()) {
      return 0;
    }
    let sql = 'SELECT count(*) as total FROM definitions WHERE school_id = ?';
    const params = [schoolId.trim()];
    if (type && typeof type === 'string' && type.trim()) {
      sql += ' AND type = ?';
      params.push(type.trim());
    }
    const row = this.db.prepare(sql).get(...params);
    return row ? row.total : 0;
  }
}

export const definitionRepo = new DefinitionRepository();
