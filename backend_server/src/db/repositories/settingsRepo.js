/**
 * Settings Repository - Barati Swimming Academy
 * Handles CRUD and synchronization for school configuration and tenant settings.
 * Encrypts sensitive fields: api_key, sms_api_key.
 */

import { getDatabase } from '../database.js';
import { encryptField, decryptField } from '../../security/crypto.js';

export class SettingsRepository {
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
      academyName: row.academy_name,
      apiKey: row.api_key_encrypted ? this.crypto.decryptField(row.api_key_encrypted) : '',
      smsProvider: row.sms_provider || 'directSim',
      smsApiKey: row.sms_api_key_encrypted ? this.crypto.decryptField(row.sms_api_key_encrypted) : '',
      smsSenderLine: row.sms_sender_line || '10008585',
      smsEntryTemplate: row.sms_entry_template || '',
      smsLowBalanceTemplate: row.sms_low_balance_template || '',
      smsRechargeTemplate: row.sms_recharge_template || '',
      graceSessionsLimit: row.grace_sessions_limit !== undefined ? Number(row.grace_sessions_limit) : 1,
      lowSessionsThreshold: row.low_sessions_threshold !== undefined ? Number(row.low_sessions_threshold) : 2,
      cooldownMinutes: row.cooldown_minutes !== undefined ? Number(row.cooldown_minutes) : 60,
      isDemoMode: Boolean(row.is_demo_mode),
      appVersion: row.app_version || '1.1.0',
      updatedAt: row.updated_at,
    };
  }

  findBySchoolId(schoolId) {
    const row = this.db.prepare(`
      SELECT * FROM school_settings WHERE school_id = ?
    `).get(schoolId);
    return this._mapRow(row);
  }

  upsert(schoolId, settings) {
    const stmt = this.db.prepare(`
      INSERT INTO school_settings (
        school_id, academy_name, api_key_encrypted, sms_provider, sms_api_key_encrypted,
        sms_sender_line, sms_entry_template, sms_low_balance_template, sms_recharge_template,
        grace_sessions_limit, low_sessions_threshold, cooldown_minutes, is_demo_mode, app_version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(school_id) DO UPDATE SET
        academy_name = excluded.academy_name,
        api_key_encrypted = excluded.api_key_encrypted,
        sms_provider = excluded.sms_provider,
        sms_api_key_encrypted = excluded.sms_api_key_encrypted,
        sms_sender_line = excluded.sms_sender_line,
        sms_entry_template = excluded.sms_entry_template,
        sms_low_balance_template = excluded.sms_low_balance_template,
        sms_recharge_template = excluded.sms_recharge_template,
        grace_sessions_limit = excluded.grace_sessions_limit,
        low_sessions_threshold = excluded.low_sessions_threshold,
        cooldown_minutes = excluded.cooldown_minutes,
        is_demo_mode = excluded.is_demo_mode,
        app_version = excluded.app_version,
        updated_at = CURRENT_TIMESTAMP
    `);

    stmt.run(
      schoolId,
      settings.academyName || 'آکادمی شنا',
      settings.apiKey ? this.crypto.encryptField(settings.apiKey) : null,
      settings.smsProvider || 'directSim',
      settings.smsApiKey ? this.crypto.encryptField(settings.smsApiKey) : null,
      settings.smsSenderLine || '10008585',
      settings.smsEntryTemplate || '',
      settings.smsLowBalanceTemplate || '',
      settings.smsRechargeTemplate || '',
      settings.graceSessionsLimit !== undefined ? Number(settings.graceSessionsLimit) : 1,
      settings.lowSessionsThreshold !== undefined ? Number(settings.lowSessionsThreshold) : 2,
      settings.cooldownMinutes !== undefined ? Number(settings.cooldownMinutes) : 60,
      settings.isDemoMode !== undefined ? (settings.isDemoMode ? 1 : 0) : 1,
      settings.appVersion || '1.1.0'
    );

    return this.findBySchoolId(schoolId);
  }

  delete(schoolId) {
    const res = this.db.prepare(`
      DELETE FROM school_settings WHERE school_id = ?
    `).run(schoolId);
    return res.changes > 0;
  }
}

export const settingsRepo = new SettingsRepository();
