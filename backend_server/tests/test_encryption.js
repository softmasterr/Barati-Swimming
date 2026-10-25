/**
 * Milestone 1 Comprehensive Verification Suite:
 * AES-256-GCM Encryption, Repositories, Raw DB Inspection & Physical Disk Leakage Shield
 *
 * Can be run via:
 * node --test tests/test_encryption.js
 * npm test
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import {
  initDatabase,
  getDatabase,
  withTransaction,
  closeDatabase
} from '../src/db/database.js';
import {
  encryptField,
  decryptField,
  encryptRaw,
  decryptRaw,
  deriveKey,
  getMasterKey,
  setMasterKey,
  isEncrypted,
  CryptoAuthError
} from '../src/security/crypto.js';
import { AthleteRepository } from '../src/db/repositories/athleteRepo.js';
import { TransactionRepository } from '../src/db/repositories/transactionRepo.js';
import { AttendanceRepository } from '../src/db/repositories/attendanceRepo.js';
import { LicenseRepository } from '../src/db/repositories/licenseRepo.js';

const CIPHER_REGEX = /^[0-9a-fA-F]{24}:[0-9a-fA-F]{32}:[0-9a-fA-F]+$/;

describe('Milestone 1: Core Database Engine & AES-256-GCM Encryption Subsystem', () => {
  const testDbPath = path.resolve(process.cwd(), 'data', 'test_barati_m1.db');
  let db;
  let athleteRepo;
  let transactionRepo;
  let attendanceRepo;
  let licenseRepo;

  before(() => {
    // Clean up any test database residue
    closeDatabase();
    try { fs.unlinkSync(testDbPath); } catch {}
    try { fs.unlinkSync(testDbPath + '-wal'); } catch {}
    try { fs.unlinkSync(testDbPath + '-shm'); } catch {}

    // Initialize using production initDatabase engine with automatic migrations
    db = initDatabase(testDbPath);

    athleteRepo = new AthleteRepository(db);
    transactionRepo = new TransactionRepository(db);
    attendanceRepo = new AttendanceRepository(db);
    licenseRepo = new LicenseRepository(db);
  });

  after(() => {
    closeDatabase();
    try { fs.unlinkSync(testDbPath); } catch {}
    try { fs.unlinkSync(testDbPath + '-wal'); } catch {}
    try { fs.unlinkSync(testDbPath + '-shm'); } catch {}
  });

  describe('0. Native SQLite Database Engine & Migration Lifecycle', () => {
    it('0.1 PRAGMAs are correctly applied (WAL mode, Foreign Keys ON)', () => {
      const jMode = db.prepare('PRAGMA journal_mode;').get();
      assert.strictEqual(jMode.journal_mode, 'wal');

      const fk = db.prepare('PRAGMA foreign_keys;').get();
      assert.strictEqual(fk.foreign_keys, 1);
    });

    it('0.2 automatic migration initializes all 9 tables and records migration entry', () => {
      const migrationRow = db.prepare('SELECT version FROM _schema_migrations WHERE version = ?').get('001_initial_schema');
      assert.ok(migrationRow, '001_initial_schema must be recorded in _schema_migrations');

      const expectedTables = [
        'licenses',
        'athletes',
        'coaches',
        'attendance_logs',
        'transactions',
        'definitions',
        'school_settings',
        'admin_users',
        'audit_logs'
      ];

      const rows = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all();
      const existingTables = rows.map(r => r.name);

      for (const table of expectedTables) {
        assert.ok(
          existingTables.includes(table),
          `Expected table '${table}' was not found in database! Existing: ${existingTables.join(', ')}`
        );
      }
    });

    it('0.3 withTransaction commits on successful execution', () => {
      withTransaction((txDb) => {
        txDb.prepare("INSERT INTO admin_users (username, password_hash) VALUES ('tx_admin', 'hash_123')").run();
      });

      const row = db.prepare("SELECT * FROM admin_users WHERE username = 'tx_admin'").get();
      assert.ok(row);
      assert.strictEqual(row.username, 'tx_admin');

      // Cleanup
      db.prepare("DELETE FROM admin_users WHERE username = 'tx_admin'").run();
    });

    it('0.4 withTransaction rolls back on error without partial commit', () => {
      assert.throws(() => {
        withTransaction((txDb) => {
          txDb.prepare("INSERT INTO admin_users (username, password_hash) VALUES ('tx_fail_admin', 'hash_fail')").run();
          throw new Error('Forced transaction failure');
        });
      }, /Forced transaction failure/);

      const row = db.prepare("SELECT * FROM admin_users WHERE username = 'tx_fail_admin'").get();
      assert.strictEqual(row, undefined, 'Rolled back record must not exist in table');
    });
  });

  describe('1. AES-256-GCM Cryptographic Primitives & Key Derivation', () => {
    it('1.1 Scrypt KDF derives deterministic 32-byte master key with salt isolation', () => {
      const k1 = deriveKey('my-secret-passphrase', 'salt-alpha');
      const k2 = deriveKey('my-secret-passphrase', 'salt-alpha');
      const k3 = deriveKey('my-secret-passphrase', 'salt-beta');

      assert.strictEqual(k1.length, 32, 'Derived key must be exactly 32 bytes (256 bits)');
      assert.ok(k1.equals(k2), 'Identical passphrase and salt must produce identical key');
      assert.ok(!k1.equals(k3), 'Different salt must produce completely distinct key');
      assert.throws(() => deriveKey(''), /Passphrase is required/);
    });

    it('1.2 produces serialized tokens matching /^[0-9a-fA-F]{24}:[0-9a-fA-F]{32}:[0-9a-fA-F]+$/', () => {
      const token = encryptField('آکادمی شنای براتی');
      assert.match(token, CIPHER_REGEX);
      const parts = token.split(':');
      assert.strictEqual(parts[0].length, 24, 'IV must be 24 hex characters (12 bytes = 96 bits)');
      assert.strictEqual(parts[1].length, 32, 'AuthTag must be 32 hex characters (16 bytes = 128 bits)');
      assert.ok(parts[2].length >= 2, 'Ciphertext must be at least 2 hex characters');
      assert.strictEqual(isEncrypted(token), true);
    });

    it('1.3 enforces non-determinism: identical plaintexts produce distinct IVs and ciphertexts', () => {
      const plain = '09123456789';
      const c1 = encryptField(plain);
      const c2 = encryptField(plain);

      assert.notStrictEqual(c1, c2, 'Repeated encryptions must never produce identical tokens');
      const [iv1] = c1.split(':');
      const [iv2] = c2.split(':');
      assert.notStrictEqual(iv1, iv2, 'IVs must be uniquely generated random nonces');
      assert.strictEqual(decryptField(c1), plain);
      assert.strictEqual(decryptField(c2), plain);
    });

    it('1.4 roundtrips Persian Unicode, numeric values, zero, negative numbers, floats, and empty strings', () => {
      assert.strictEqual(decryptField(encryptField('علی براتی')), 'علی براتی');
      assert.strictEqual(decryptField(encryptField('09123456789')), '09123456789', 'Leading zero in phone must be preserved');
      assert.strictEqual(decryptField(encryptField(1500000)), 1500000);
      assert.strictEqual(decryptField(encryptField(0)), 0);
      assert.strictEqual(decryptField(encryptField(-1)), -1);
      assert.strictEqual(decryptField(encryptField(99.95)), 99.95);
      assert.strictEqual(decryptField(encryptField('')), '');
    });

    it('1.5 handles JSON objects, arrays, and boolean types cleanly', () => {
      const sampleObj = { schoolId: 'barati-pool', maxDevices: 5, active: true };
      assert.deepStrictEqual(decryptField(encryptField(sampleObj)), sampleObj);

      const sampleArr = ['swimming', 123, { tag: 'vip' }];
      assert.deepStrictEqual(decryptField(encryptField(sampleArr)), sampleArr);

      assert.strictEqual(decryptField(encryptField(true)), true);
      assert.strictEqual(decryptField(encryptField(false)), false);
    });

    it('1.6 handles null and undefined safely without throwing', () => {
      assert.strictEqual(encryptField(null), null);
      assert.strictEqual(encryptField(undefined), null);
      assert.strictEqual(decryptField(null), null);
      assert.strictEqual(decryptField(undefined), null);
    });

    it('1.7 rejects tampered IV, AuthTag, and Ciphertext payload with CryptoAuthError (zero plaintext leakage)', () => {
      const token = encryptField('UltraSecretFinancialRecord');
      const [iv, tag, ct] = token.split(':');

      // 1. Bit flip in IV
      const tamperedIv = (iv[0] === 'a' ? 'b' : 'a') + iv.slice(1);
      assert.throws(
        () => decryptField(`${tamperedIv}:${tag}:${ct}`),
        (err) => err instanceof CryptoAuthError && err.code === 'ERR_CRYPTO_AUTH_FAILED'
      );

      // 2. Bit flip in AuthTag
      const tamperedTag = (tag[0] === 'a' ? 'b' : 'a') + tag.slice(1);
      assert.throws(
        () => decryptField(`${iv}:${tamperedTag}:${ct}`),
        (err) => err instanceof CryptoAuthError && err.code === 'ERR_CRYPTO_AUTH_FAILED'
      );

      // 3. Bit flip in Ciphertext payload
      const tamperedCt = (ct[0] === 'a' ? 'b' : 'a') + ct.slice(1);
      assert.throws(
        () => decryptField(`${iv}:${tag}:${tamperedCt}`),
        (err) => err instanceof CryptoAuthError && err.code === 'ERR_CRYPTO_AUTH_FAILED'
      );

      // 4. Decryption with incorrect secret key
      const wrongKey = crypto.randomBytes(32);
      assert.throws(
        () => decryptField(token, wrongKey),
        (err) => err instanceof CryptoAuthError
      );
    });

    it('1.8 rejects malformed tokens without attempting cipher operations', () => {
      assert.throws(() => decryptField('malformed_string'), CryptoAuthError);
      assert.throws(() => decryptField('short:tag:ct'), CryptoAuthError);
      assert.throws(() => decryptField(12345), CryptoAuthError);
    });

    it('1.9 raw string encryption interoperability', () => {
      const rawText = 'Raw Plaintext String';
      const rawCipher = encryptRaw(rawText);
      assert.match(rawCipher, CIPHER_REGEX);
      assert.strictEqual(decryptRaw(rawCipher), rawText);
      assert.strictEqual(decryptField(rawCipher), rawText);
    });

    it('1.10 high throughput benchmark achieves >2,000 ops/sec with cached key', () => {
      const t0 = performance.now();
      const count = 1000;
      for (let i = 0; i < count; i++) {
        const c = encryptField('Athlete ' + i);
        decryptField(c);
      }
      const elapsed = performance.now() - t0;
      assert.ok(elapsed < 1000, `1,000 encrypt/decrypt cycles should take <1000ms, took ${elapsed.toFixed(2)}ms`);
    });
  });

  describe('2. Repository Layer CRUD & Bidirectional Type Restoration', () => {
    const schoolId = 'school-barati-m1';

    it('2.1 LicenseRepository: create, validateSchoolLicense, device registration, and deactivation', () => {
      const created = licenseRepo.create({
        schoolId,
        academyName: 'آکادمی شنای براتی',
        licenseKey: 'LIC-BARATI-2026-VIP',
        contactPhone: '09121112233',
        expiryDate: '2028-12-31',
        maxDevices: 2
      });

      assert.ok(created);
      assert.strictEqual(created.schoolId, schoolId);
      assert.strictEqual(created.licenseKey, 'LIC-BARATI-2026-VIP');
      assert.strictEqual(created.status, 'active');

      // Valid license verification
      const validRes = licenseRepo.validateSchoolLicense(schoolId, 'LIC-BARATI-2026-VIP');
      assert.strictEqual(validRes.valid, true);
      assert.strictEqual(validRes.license.academyName, 'آکادمی شنای براتی');

      // Invalid key check
      const badKeyRes = licenseRepo.validateSchoolLicense(schoolId, 'WRONG-KEY');
      assert.strictEqual(badKeyRes.valid, false);
      assert.strictEqual(badKeyRes.code, 'INVALID_KEY');

      // Nonexistent school check
      const nonExistentRes = licenseRepo.validateSchoolLicense('school-unknown', 'LIC-BARATI-2026-VIP');
      assert.strictEqual(nonExistentRes.valid, false);
      assert.strictEqual(nonExistentRes.code, 'NOT_FOUND');

      // Device registration up to maxDevices
      const dev1 = licenseRepo.registerDevice(schoolId, { deviceId: 'dev-1', deviceModel: 'Pixel 8' });
      assert.strictEqual(dev1.success, true);
      assert.strictEqual(dev1.activeDevicesCount, 1);

      const dev2 = licenseRepo.registerDevice(schoolId, { deviceId: 'dev-2', deviceModel: 'Galaxy S24' });
      assert.strictEqual(dev2.success, true);
      assert.strictEqual(dev2.activeDevicesCount, 2);

      // 3rd device exceeds maxDevices = 2
      const dev3 = licenseRepo.registerDevice(schoolId, { deviceId: 'dev-3', deviceModel: 'iPhone 15' });
      assert.strictEqual(dev3.success, false);
      assert.strictEqual(dev3.reason, 'MAX_DEVICES_EXCEEDED');

      // Updating existing device should succeed
      const dev1Update = licenseRepo.registerDevice(schoolId, { deviceId: 'dev-1', deviceModel: 'Pixel 8 Pro' });
      assert.strictEqual(dev1Update.success, true);

      // Deactivation check
      licenseRepo.deactivate(schoolId);
      const deactRes = licenseRepo.validateSchoolLicense(schoolId, 'LIC-BARATI-2026-VIP');
      assert.strictEqual(deactRes.valid, false);
      assert.strictEqual(deactRes.code, 'LICENSE_DEACTIVATED');

      // Renewal resets status to active
      licenseRepo.renew(schoolId, '2029-12-31');
      const renewedRes = licenseRepo.validateSchoolLicense(schoolId, 'LIC-BARATI-2026-VIP');
      assert.strictEqual(renewedRes.valid, true);
      assert.strictEqual(renewedRes.license.status, 'active');
    });

    it('2.2 AthleteRepository: transparent encryption, numerical type restoration, and RFID search', () => {
      athleteRepo.create(schoolId, {
        id: 'ath-101',
        name: 'علی براتی',
        phone: '09123456789',
        coachId: 'coach-1',
        cardUid: 'NFC-A101',
        packageName: 'دوره ویژه نخبگان',
        totalSessions: 12,
        remainingSessions: 8,
        totalAttended: 4,
        tuitionFee: 2500000,
        paidAmount: 2000000,
        debt: 500000,
        expireDate: '1405/10/30'
      });

      const ath = athleteRepo.findById(schoolId, 'ath-101');
      assert.ok(ath);
      assert.strictEqual(ath.name, 'علی براتی');
      assert.strictEqual(ath.phone, '09123456789');
      assert.strictEqual(ath.cardUid, 'NFC-A101');
      assert.strictEqual(ath.tuitionFee, 2500000);
      assert.strictEqual(typeof ath.tuitionFee, 'number');
      assert.strictEqual(ath.paidAmount, 2000000);
      assert.strictEqual(typeof ath.paidAmount, 'number');
      assert.strictEqual(ath.debt, 500000);
      assert.strictEqual(typeof ath.debt, 'number');

      // findByCardUid case-insensitive
      const foundByCard = athleteRepo.findByCardUid(schoolId, 'nfc-a101');
      assert.ok(foundByCard);
      assert.strictEqual(foundByCard.id, 'ath-101');
      assert.strictEqual(foundByCard.name, 'علی براتی');

      // Batch upsert test
      const batchCount = athleteRepo.batchUpsert(schoolId, [
        {
          id: 'ath-102',
          name: 'سارا رضایی',
          phone: '09129876543',
          coachId: 'coach-1',
          cardUid: 'NFC-A102',
          packageName: 'مقدماتی',
          totalSessions: 10,
          remainingSessions: 9,
          totalAttended: 1,
          tuitionFee: 1800000,
          paidAmount: 1800000,
          debt: 0,
          expireDate: '1405/11/15'
        },
        {
          id: 'ath-101', // Update existing
          name: 'علی براتی (تمدید شده)',
          phone: '09123456789',
          coachId: 'coach-1',
          cardUid: 'NFC-A101',
          packageName: 'دوره ویژه نخبگان',
          totalSessions: 24,
          remainingSessions: 20,
          totalAttended: 4,
          tuitionFee: 5000000,
          paidAmount: 5000000,
          debt: 0,
          expireDate: '1406/04/30'
        }
      ]);
      assert.strictEqual(batchCount, 2);

      const updatedAth101 = athleteRepo.findById(schoolId, 'ath-101');
      assert.strictEqual(updatedAth101.name, 'علی براتی (تمدید شده)');
      assert.strictEqual(updatedAth101.totalSessions, 24);
      assert.strictEqual(updatedAth101.tuitionFee, 5000000);

      assert.strictEqual(athleteRepo.count(schoolId), 2);
    });

    it('2.3 TransactionRepository: encrypted financial ledger and indexed filters', () => {
      transactionRepo.create(schoolId, {
        id: 'tx-201',
        date: '1405/08/15',
        type: 'income',
        title: 'شهریه ثبت نام علی براتی',
        amount: 2000000,
        method: 'pos',
        author: 'حسابدار ارشد'
      });

      transactionRepo.create(schoolId, {
        id: 'tx-202',
        date: '1405/08/16',
        type: 'expense',
        title: 'خرید لوازم شنا',
        amount: 450000,
        method: 'card',
        author: 'مدیر داخلی'
      });

      const tx = transactionRepo.findById(schoolId, 'tx-201');
      assert.ok(tx);
      assert.strictEqual(tx.title, 'شهریه ثبت نام علی براتی');
      assert.strictEqual(tx.amount, 2000000);
      assert.strictEqual(typeof tx.amount, 'number');
      assert.strictEqual(tx.author, 'حسابدار ارشد');

      // Filter by type
      const incomes = transactionRepo.findAllBySchoolId(schoolId, { type: 'income' });
      assert.strictEqual(incomes.length, 1);
      assert.strictEqual(incomes[0].id, 'tx-201');

      const expenses = transactionRepo.findAllBySchoolId(schoolId, { type: 'expense' });
      assert.strictEqual(expenses.length, 1);
      assert.strictEqual(expenses[0].id, 'tx-202');
      assert.strictEqual(expenses[0].title, 'خرید لوازم شنا');
      assert.strictEqual(expenses[0].amount, 450000);
    });

    it('2.4 AttendanceRepository: encrypted athleteName, note, and query filters', () => {
      attendanceRepo.create(schoolId, {
        id: 'att-301',
        time: '1405/08/15 16:30',
        athleteName: 'علی براتی',
        coachName: 'مربی احمدی',
        status: 'approved',
        sessionsLeft: 8,
        note: 'ورود کارتخوان سالن ۱'
      });

      attendanceRepo.create(schoolId, {
        id: 'att-302',
        time: '1405/08/15 17:00',
        athleteName: 'سارا رضایی',
        coachName: 'مربی احمدی',
        status: 'warning',
        sessionsLeft: 1,
        note: 'جلسات رو به اتمام'
      });

      const log = attendanceRepo.findById(schoolId, 'att-301');
      assert.ok(log);
      assert.strictEqual(log.athleteName, 'علی براتی');
      assert.strictEqual(log.note, 'ورود کارتخوان سالن ۱');
      assert.strictEqual(log.sessionsLeft, 8);

      // Filter by status
      const warnings = attendanceRepo.findAllBySchoolId(schoolId, { status: 'warning' });
      assert.strictEqual(warnings.length, 1);
      assert.strictEqual(warnings[0].athleteName, 'سارا رضایی');
      assert.strictEqual(warnings[0].note, 'جلسات رو به اتمام');
    });

    it('2.5 Foreign Key Cascading: deleting license automatically deletes all child tenant rows', () => {
      // Create temporary tenant
      licenseRepo.create({
        schoolId: 'temp-tenant',
        academyName: 'مدرسه موقت',
        licenseKey: 'LIC-TEMP-1234',
        contactPhone: '09000000000',
        expiryDate: '2027-01-01'
      });

      athleteRepo.create('temp-tenant', {
        id: 'temp-ath-1',
        name: 'شناگر تستی',
        phone: '09100000000',
        coachId: '',
        cardUid: '',
        packageName: 'تست',
        totalSessions: 1,
        remainingSessions: 1,
        totalAttended: 0,
        tuitionFee: 100,
        paidAmount: 100,
        debt: 0,
        expireDate: '1405/01/01'
      });

      assert.strictEqual(athleteRepo.count('temp-tenant'), 1);

      // Delete license
      db.prepare('DELETE FROM licenses WHERE school_id = ?').run('temp-tenant');

      // Verify cascade deleted athletes
      assert.strictEqual(athleteRepo.count('temp-tenant'), 0);
    });
  });

  describe('3. Raw Database & Disk Leakage Shield Verification', () => {
    it('3.1 Raw SQL rows bypass repositories and confirm all sensitive columns match CIPHER_REGEX', () => {
      // 1. Athletes Table
      const rawAthletes = db.prepare('SELECT * FROM athletes WHERE school_id = ?').all('school-barati-m1');
      assert.ok(rawAthletes.length >= 2);
      for (const row of rawAthletes) {
        assert.match(row.name_encrypted, CIPHER_REGEX);
        assert.match(row.phone_encrypted, CIPHER_REGEX);
        assert.match(row.card_uid_encrypted, CIPHER_REGEX);
        assert.match(row.tuition_fee_encrypted, CIPHER_REGEX);
        assert.match(row.paid_amount_encrypted, CIPHER_REGEX);
        assert.match(row.debt_encrypted, CIPHER_REGEX);

        // Plaintexts must NOT appear in ciphertext string
        assert.ok(!row.name_encrypted.includes('علی براتی'));
        assert.ok(!row.phone_encrypted.includes('09123456789'));
        assert.ok(!row.card_uid_encrypted.includes('NFC-A101'));
      }

      // 2. Transactions Table
      const rawTx = db.prepare('SELECT * FROM transactions WHERE school_id = ?').all('school-barati-m1');
      assert.ok(rawTx.length >= 2);
      for (const row of rawTx) {
        assert.match(row.title_encrypted, CIPHER_REGEX);
        assert.match(row.amount_encrypted, CIPHER_REGEX);
        assert.match(row.author_encrypted, CIPHER_REGEX);

        assert.ok(!row.title_encrypted.includes('شهریه ثبت نام'));
        assert.ok(!row.author_encrypted.includes('حسابدار ارشد'));
      }

      // 3. Attendance Logs Table
      const rawAtt = db.prepare('SELECT * FROM attendance_logs WHERE school_id = ?').all('school-barati-m1');
      assert.ok(rawAtt.length >= 2);
      for (const row of rawAtt) {
        assert.match(row.athlete_name_encrypted, CIPHER_REGEX);
        assert.match(row.note_encrypted, CIPHER_REGEX);

        assert.ok(!row.athlete_name_encrypted.includes('علی براتی'));
        assert.ok(!row.note_encrypted.includes('کارتخوان سالن ۱'));
      }

      // 4. Licenses Table
      const rawLic = db.prepare('SELECT * FROM licenses WHERE school_id = ?').all('school-barati-m1');
      assert.strictEqual(rawLic.length, 1);
      assert.match(rawLic[0].license_key_encrypted, CIPHER_REGEX);
      assert.ok(!rawLic[0].license_key_encrypted.includes('LIC-BARATI-2026-VIP'));
    });

    it('3.2 Physical binary disk audit (fs.readFileSync) confirms zero sensitive UTF-8 plaintext bytes', () => {
      // Force WAL checkpoint to flush all in-memory and WAL buffer pages into main .db file
      db.exec('PRAGMA wal_checkpoint(TRUNCATE);');

      const rawDbBuffer = fs.readFileSync(testDbPath);
      assert.ok(rawDbBuffer.length > 0, 'Database file must exist and contain bytes');

      const forbiddenPlaintexts = [
        'علی براتی',
        '09123456789',
        'سارا رضایی',
        '09129876543',
        'NFC-A101',
        'NFC-A102',
        'شهریه ثبت نام علی براتی',
        'خرید لوازم شنا',
        'حسابدار ارشد',
        'مدیر داخلی',
        'ورود کارتخوان سالن ۱',
        'جلسات رو به اتمام',
        'LIC-BARATI-2026-VIP'
      ];

      for (const pt of forbiddenPlaintexts) {
        const needle = Buffer.from(pt, 'utf8');
        const found = rawDbBuffer.includes(needle);
        assert.strictEqual(
          found,
          false,
          `CRITICAL BREACH: Plaintext "${pt}" detected inside raw SQLite disk file (${testDbPath})!`
        );
      }
    });
  });
});
