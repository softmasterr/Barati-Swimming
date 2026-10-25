/**
 * License Repository - Barati Swimming Academy
 * Manages multi-tenant school licensing, cryptographic key issuance,
 * expiration verification, remote deactivation, and mobile device tracking.
 * Encrypts: licenseKey
 */

import crypto from 'node:crypto';
import { getDatabase } from '../database.js';
import { encryptField, decryptField } from '../../security/crypto.js';

export class LicenseRepository {
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
    let devices = [];
    try {
      devices = JSON.parse(row.devices_json || '[]');
    } catch (_) {
      devices = [];
    }

    return {
      id: row.id,
      schoolId: row.school_id,
      academyName: row.academy_name,
      licenseKey: this.crypto.decryptField(row.license_key_encrypted),
      contactPhone: row.contact_phone || '',
      status: row.status,
      expiryDate: row.expiry_date,
      maxDevices: row.max_devices,
      devices,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  create({ schoolId, academyName, licenseKey, contactPhone, expiryDate, maxDevices = 3 }) {
    const key = licenseKey || `LIC-BARATI-${crypto.randomBytes(4).toString('hex').toUpperCase()}-2026`;
    const stmt = this.db.prepare(`
      INSERT INTO licenses (
        school_id, academy_name, license_key_encrypted, contact_phone, expiry_date, max_devices
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      schoolId,
      academyName,
      this.crypto.encryptField(key),
      contactPhone || '',
      expiryDate,
      maxDevices
    );

    return this.findBySchoolId(schoolId);
  }

  findBySchoolId(schoolId) {
    if (typeof schoolId !== 'string' || !schoolId.trim()) {
      return null;
    }
    const row = this.db.prepare(`
      SELECT * FROM licenses WHERE school_id = ?
    `).get(schoolId.trim());
    return this._mapRow(row);
  }

  findById(id) {
    if (id === undefined || id === null || (typeof id !== 'number' && typeof id !== 'string')) {
      return null;
    }
    const row = this.db.prepare(`
      SELECT * FROM licenses WHERE id = ?
    `).get(id);
    return this._mapRow(row);
  }

  findAll() {
    const rows = this.db.prepare(`
      SELECT * FROM licenses ORDER BY created_at DESC
    `).all();
    return rows.map(r => this._mapRow(r));
  }

  /**
   * Validates credentials, activation state, and subscription expiration.
   * Cryptographic key verification is performed FIRST to prevent status leakage.
   * Emits clear diagnostic status for sync middleware.
   * @returns {{ valid: boolean, code?: string, message?: string, license?: object }}
   */
  validateSchoolLicense(schoolId, candidateKey) {
    if (typeof schoolId !== 'string' || typeof candidateKey !== 'string') {
      return { valid: false, code: 'INVALID_KEY', message: 'شناسه مدرسه و کلید لایسنس باید رشته متنی باشند' };
    }

    const cleanSchoolId = schoolId.trim();
    const cleanCandidateKey = candidateKey.trim();

    if (!cleanSchoolId || !cleanCandidateKey) {
      return { valid: false, code: 'INVALID_KEY', message: 'شناسه مدرسه و کلید فعال‌سازی الزامی است' };
    }

    const license = this.findBySchoolId(cleanSchoolId);
    if (!license) {
      return { valid: false, code: 'NOT_FOUND', message: 'شناسه مدرسه یافت نشد' };
    }

    // 1. Cryptographic key comparison FIRST using timingSafeEqual
    const keyA = Buffer.from(license.licenseKey || '', 'utf8');
    const keyB = Buffer.from(cleanCandidateKey, 'utf8');
    const matches = keyA.length === keyB.length && crypto.timingSafeEqual(keyA, keyB);

    if (!matches) {
      return { valid: false, code: 'INVALID_KEY', message: 'کلید فعال‌سازی لایسنس نادرست است' };
    }

    // 2. ONLY IF KEY IS AUTHENTICATED: check remote deactivation status
    if (license.status === 'deactivated') {
      return { valid: false, code: 'LICENSE_DEACTIVATED', message: 'لایسنس توسط مدیر غیرفعال شده است' };
    }

    // 3. ONLY IF KEY IS AUTHENTICATED: check expiration date & status
    const expDate = new Date(license.expiryDate);
    if (license.status === 'expired' || (!isNaN(expDate.getTime()) && expDate < new Date())) {
      return { valid: false, code: 'LICENSE_EXPIRED', message: 'اعتبار لایسنس مدرسه به پایان رسیده است' };
    }

    return { valid: true, license };
  }

  /**
   * Register or update active device in the school's device registry.
   */
  registerDevice(schoolId, deviceInfo) {
    if (typeof schoolId !== 'string' || !schoolId.trim() || !deviceInfo || typeof deviceInfo !== 'object') {
      return { success: false, reason: 'INVALID_ARGUMENTS' };
    }

    const cleanSchoolId = schoolId.trim();
    const license = this.findBySchoolId(cleanSchoolId);
    if (!license) throw new Error('License not found');

    const devices = license.devices || [];
    const existingIdx = devices.findIndex(d => d.deviceId === deviceInfo.deviceId);

    if (existingIdx >= 0) {
      devices[existingIdx] = {
        ...devices[existingIdx],
        ...deviceInfo,
        lastSeenAt: new Date().toISOString()
      };
    } else {
      if (devices.length >= license.maxDevices) {
        return { success: false, reason: 'MAX_DEVICES_EXCEEDED' };
      }
      devices.push({
        ...deviceInfo,
        registeredAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString()
      });
    }

    this.db.prepare(`
      UPDATE licenses SET devices_json = ?, updated_at = CURRENT_TIMESTAMP WHERE school_id = ?
    `).run(JSON.stringify(devices), cleanSchoolId);

    return { success: true, activeDevicesCount: devices.length };
  }

  deactivate(schoolId) {
    if (typeof schoolId !== 'string' || !schoolId.trim()) {
      return false;
    }
    const res = this.db.prepare(`
      UPDATE licenses SET status = 'deactivated', updated_at = CURRENT_TIMESTAMP WHERE school_id = ?
    `).run(schoolId.trim());
    return res.changes > 0;
  }

  renew(schoolId, newExpiryDate) {
    if (typeof schoolId !== 'string' || !schoolId.trim() || typeof newExpiryDate !== 'string') {
      return false;
    }
    const res = this.db.prepare(`
      UPDATE licenses SET expiry_date = ?, status = 'active', updated_at = CURRENT_TIMESTAMP WHERE school_id = ?
    `).run(newExpiryDate.trim(), schoolId.trim());
    return res.changes > 0;
  }
}

export const licenseRepo = new LicenseRepository();
