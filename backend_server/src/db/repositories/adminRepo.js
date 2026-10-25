/**
 * Admin Repository - Barati Swimming Academy
 * Manages admin users, Argon2id password hashing, TOTP 2FA secrets,
 * account lockouts, and audit logs.
 */

import { hash, verify } from '@node-rs/argon2';
import { getDatabase } from '../database.js';
import { encryptField, decryptField } from '../../security/crypto.js';

export class AdminRepository {
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
      username: row.username,
      passwordHash: row.password_hash,
      totpEnabled: Boolean(row.totp_enabled),
      role: row.role,
      failedLoginAttempts: row.failed_login_attempts || 0,
      lockedUntil: row.locked_until || null,
      lastLoginAt: row.last_login_at || null,
      lastLoginIp: row.last_login_ip || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  findByUsername(username) {
    if (typeof username !== 'string' || !username.trim()) return null;
    const row = this.db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username.trim());
    return this._mapRow(row);
  }

  async createAdmin({ username, password, role = 'superadmin' }) {
    if (typeof username !== 'string' || !username.trim()) {
      throw new Error('Username is required');
    }
    if (typeof password !== 'string' || password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    const cleanUsername = username.trim();
    const existing = this.findByUsername(cleanUsername);
    if (existing) {
      throw new Error('Admin username already exists');
    }

    const passwordHash = await hash(password, {
      memoryCost: 19456, // 19 MiB
      timeCost: 2,
      outputLen: 32,
      parallelism: 1
    });

    this.db.prepare(`
      INSERT INTO admin_users (username, password_hash, role)
      VALUES (?, ?, ?)
    `).run(cleanUsername, passwordHash, role);

    return this.findByUsername(cleanUsername);
  }

  async verifyPassword(passwordHash, plainPassword) {
    if (!passwordHash || !plainPassword) return false;
    try {
      return await verify(passwordHash, plainPassword);
    } catch (err) {
      return false;
    }
  }

  updateTotpSecret(username, plainSecret) {
    if (!username || !plainSecret) return false;
    const encryptedSecret = this.crypto.encryptField(plainSecret);
    const res = this.db.prepare(`
      UPDATE admin_users
      SET totp_secret_encrypted = ?, updated_at = CURRENT_TIMESTAMP
      WHERE username = ?
    `).run(encryptedSecret, username.trim());
    return res.changes > 0;
  }

  getTotpSecret(username) {
    if (!username) return null;
    const row = this.db.prepare('SELECT totp_secret_encrypted FROM admin_users WHERE username = ?').get(username.trim());
    if (!row || !row.totp_secret_encrypted) return null;
    try {
      return this.crypto.decryptField(row.totp_secret_encrypted);
    } catch {
      return null;
    }
  }

  enableTotp(username) {
    if (!username) return false;
    const res = this.db.prepare(`
      UPDATE admin_users
      SET totp_enabled = 1, updated_at = CURRENT_TIMESTAMP
      WHERE username = ?
    `).run(username.trim());
    return res.changes > 0;
  }

  disableTotp(username) {
    if (!username) return false;
    const res = this.db.prepare(`
      UPDATE admin_users
      SET totp_enabled = 0, totp_secret_encrypted = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE username = ?
    `).run(username.trim());
    return res.changes > 0;
  }

  recordFailedLogin(username, maxAttempts = 5, lockoutDurationMs = 15 * 60 * 1000) {
    if (!username) return;
    const admin = this.findByUsername(username);
    if (!admin) return;

    const newAttempts = admin.failedLoginAttempts + 1;
    let lockedUntil = admin.lockedUntil;

    if (newAttempts >= maxAttempts) {
      lockedUntil = new Date(Date.now() + lockoutDurationMs).toISOString();
    }

    this.db.prepare(`
      UPDATE admin_users
      SET failed_login_attempts = ?, locked_until = ?, updated_at = CURRENT_TIMESTAMP
      WHERE username = ?
    `).run(newAttempts, lockedUntil, username.trim());

    return { locked: newAttempts >= maxAttempts, attempts: newAttempts, lockedUntil };
  }

  recordSuccessfulLogin(username, ip) {
    if (!username) return;
    this.db.prepare(`
      UPDATE admin_users
      SET failed_login_attempts = 0, locked_until = NULL, last_login_at = CURRENT_TIMESTAMP, last_login_ip = ?, updated_at = CURRENT_TIMESTAMP
      WHERE username = ?
    `).run(ip || 'unknown', username.trim());
  }

  isAccountLocked(username) {
    const admin = this.findByUsername(username);
    if (!admin || !admin.lockedUntil) return false;
    const lockTime = new Date(admin.lockedUntil);
    if (isNaN(lockTime.getTime())) return false;
    return lockTime > new Date();
  }

  recordAuditLog({ adminUsername, action, ipAddress = '127.0.0.1', userAgent = '', targetId = null, details = '', status = 'SUCCESS' }) {
    try {
      this.db.prepare(`
        INSERT INTO audit_logs (admin_username, action, ip_address, user_agent, target_id, details, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        adminUsername || 'system',
        action,
        ipAddress,
        userAgent || '',
        targetId || null,
        typeof details === 'object' ? JSON.stringify(details) : String(details),
        status
      );
    } catch (err) {
      console.error('[AdminRepository] Failed to record audit log:', err);
    }
  }

  getAuditLogs(limit = 100, offset = 0) {
    const rows = this.db.prepare(`
      SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT ? OFFSET ?
    `).all(limit, offset);
    return rows;
  }

  getDashboardStats() {
    const totalSchools = this.db.prepare('SELECT count(*) as count FROM licenses').get().count;
    const activeSchools = this.db.prepare("SELECT count(*) as count FROM licenses WHERE status = 'active'").get().count;
    const totalAthletes = this.db.prepare('SELECT count(*) as count FROM athletes').get().count;
    const totalAttendance = this.db.prepare('SELECT count(*) as count FROM attendance_logs').get().count;
    const totalTransactions = this.db.prepare('SELECT count(*) as count FROM transactions').get().count;
    const auditLogsCount = this.db.prepare('SELECT count(*) as count FROM audit_logs').get().count;

    return {
      totalSchools,
      activeSchools,
      totalAthletes,
      totalAttendance,
      totalTransactions,
      auditLogsCount
    };
  }
}

export const adminRepo = new AdminRepository();
