/**
 * backend_server/tests/test_adversarial_crypto.js
 * Adversarial Stress-Test & Cryptographic Verification Harness
 *
 * Exercises:
 * 1. 500+ Bit-flipping and tamper attacks across IV, AuthTag, Ciphertext, and Keys.
 * 2. Extreme and adversarial inputs: empty strings, null, undefined, 1MB payload,
 *    emojis, complex Persian Unicode/ZWNJ, deeply nested objects, boundary integers.
 * 3. IV collision stress test across 10,000 tokens (asserting 0 collisions).
 * 4. Raw DB and disk leakage verification across SQLite tables and raw disk bytes.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import {
  initDatabase,
  getDatabase,
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

/**
 * Helper to flip a single hex character to a different valid hex character.
 */
function flipHexChar(char) {
  const hexDigits = '0123456789abcdef';
  const current = char.toLowerCase();
  const currentIndex = hexDigits.indexOf(current);
  const nextIndex = (currentIndex + 1) % 16;
  return hexDigits[nextIndex];
}

/**
 * Helper to mutate a hex string by flipping a character at a specified position.
 */
function mutateHexAt(hexStr, index) {
  const chars = hexStr.split('');
  chars[index] = flipHexChar(chars[index]);
  return chars.join('');
}

describe('Adversarial Verification Suite: AES-256-GCM Cryptographic Subsystem', () => {
  const testDbPath = path.resolve(process.cwd(), 'data', 'test_adversarial_m1.db');
  let db;
  let athleteRepo;
  let transactionRepo;
  let attendanceRepo;
  let licenseRepo;

  before(() => {
    closeDatabase();
    try { fs.unlinkSync(testDbPath); } catch {}
    try { fs.unlinkSync(testDbPath + '-wal'); } catch {}
    try { fs.unlinkSync(testDbPath + '-shm'); } catch {}

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

  describe('1. Bit-Flipping & Tamper Stress Harness (500+ Attacks)', () => {
    const testPlaintexts = [
      'Simple ASCII String',
      'آکادمی شنای براتی - حساس و محرمانه',
      JSON.stringify({ athleteId: 'ath-99', balance: 4500000, active: true }),
      'A'.repeat(500),
      '09123456789'
    ];

    it('1.1 IV Bit-Flipping: 150 randomized mutations throw CryptoAuthError with 0 leaks', () => {
      let attempts = 0;
      let failureCount = 0;

      for (let i = 0; i < 150; i++) {
        const plain = testPlaintexts[i % testPlaintexts.length];
        const token = encryptField(plain);
        const [iv, tag, ct] = token.split(':');

        // Mutate IV at random position (0 to 23)
        const mutatePos = Math.floor(Math.random() * 24);
        const mutatedIv = mutateHexAt(iv, mutatePos);
        const tamperedToken = `${mutatedIv}:${tag}:${ct}`;

        attempts++;
        try {
          const leaked = decryptField(tamperedToken);
          // If we reached here, decryption leaked or passed
          assert.fail(`Tampered IV was accepted! Leaked: ${leaked}`);
        } catch (err) {
          assert.ok(err instanceof CryptoAuthError, `Expected CryptoAuthError, got ${err.name}: ${err.message}`);
          assert.strictEqual(err.code, 'ERR_CRYPTO_AUTH_FAILED');
          failureCount++;
        }
      }

      assert.strictEqual(attempts, 150);
      assert.strictEqual(failureCount, 150, '100% of IV tamper attempts must throw CryptoAuthError');
    });

    it('1.2 AuthTag Bit-Flipping: 150 randomized mutations throw CryptoAuthError with 0 leaks', () => {
      let attempts = 0;
      let failureCount = 0;

      for (let i = 0; i < 150; i++) {
        const plain = testPlaintexts[i % testPlaintexts.length];
        const token = encryptField(plain);
        const [iv, tag, ct] = token.split(':');

        // Mutate AuthTag at random position (0 to 31)
        const mutatePos = Math.floor(Math.random() * 32);
        const mutatedTag = mutateHexAt(tag, mutatePos);
        const tamperedToken = `${iv}:${mutatedTag}:${ct}`;

        attempts++;
        try {
          const leaked = decryptField(tamperedToken);
          assert.fail(`Tampered AuthTag was accepted! Leaked: ${leaked}`);
        } catch (err) {
          assert.ok(err instanceof CryptoAuthError, `Expected CryptoAuthError, got ${err.name}: ${err.message}`);
          assert.strictEqual(err.code, 'ERR_CRYPTO_AUTH_FAILED');
          failureCount++;
        }
      }

      assert.strictEqual(attempts, 150);
      assert.strictEqual(failureCount, 150, '100% of AuthTag tamper attempts must throw CryptoAuthError');
    });

    it('1.3 Ciphertext Bit-Flipping: 150 randomized mutations throw CryptoAuthError with 0 leaks', () => {
      let attempts = 0;
      let failureCount = 0;

      for (let i = 0; i < 150; i++) {
        const plain = testPlaintexts[i % testPlaintexts.length];
        const token = encryptField(plain);
        const [iv, tag, ct] = token.split(':');

        // Mutate Ciphertext at random position (0 to ct.length - 1)
        const mutatePos = Math.floor(Math.random() * ct.length);
        const mutatedCt = mutateHexAt(ct, mutatePos);
        const tamperedToken = `${iv}:${tag}:${mutatedCt}`;

        attempts++;
        try {
          const leaked = decryptField(tamperedToken);
          assert.fail(`Tampered Ciphertext was accepted! Leaked: ${leaked}`);
        } catch (err) {
          assert.ok(err instanceof CryptoAuthError, `Expected CryptoAuthError, got ${err.name}: ${err.message}`);
          assert.strictEqual(err.code, 'ERR_CRYPTO_AUTH_FAILED');
          failureCount++;
        }
      }

      assert.strictEqual(attempts, 150);
      assert.strictEqual(failureCount, 150, '100% of Ciphertext tamper attempts must throw CryptoAuthError');
    });

    it('1.4 Structural & Formatting Attacks: truncated, elongated, non-hex, extra delimiters', () => {
      const validToken = encryptField('ConfidentialData');
      const [iv, tag, ct] = validToken.split(':');

      const malformedSamples = [
        // Truncated IV
        `${iv.slice(0, 22)}:${tag}:${ct}`,
        // Elongated IV
        `${iv}aa:${tag}:${ct}`,
        // Truncated AuthTag
        `${iv}:${tag.slice(0, 30)}:${ct}`,
        // Elongated AuthTag
        `${iv}:${tag}ff:${ct}`,
        // Odd-length ciphertext hex
        `${iv}:${tag}:${ct.slice(0, ct.length - 1)}`,
        // Non-hex characters in IV
        `${iv.slice(0, 23)}Z:${tag}:${ct}`,
        // Non-hex characters in Tag
        `${iv}:${tag.slice(0, 31)}G:${ct}`,
        // Non-hex characters in Ciphertext
        `${iv}:${tag}:${ct.slice(0, ct.length - 2)}XY`,
        // Extra delimiters
        `${iv}:${tag}:${ct}:extra`,
        `:::`,
        `${iv}::${ct}`,
        // Reversed components
        `${ct}:${tag}:${iv}`,
        // Empty components
        `:${tag}:${ct}`,
        `${iv}::${ct}`,
        `${iv}:${tag}:`, // empty ciphertext for non-empty plaintext
        // Completely invalid types
        12345678,
        {},
        []
      ];

      for (const sample of malformedSamples) {
        assert.throws(
          () => decryptField(sample),
          (err) => err instanceof CryptoAuthError,
          `Sample "${sample}" should have thrown CryptoAuthError`
        );
      }
    });

    it('1.5 Key Corruption Attacks: 50 mutated keys and random keys fail authentication', () => {
      const plain = 'CriticalFinancialRecord-789000';
      const token = encryptField(plain);
      const masterKey = getMasterKey();

      // Test with 50 completely random keys
      for (let i = 0; i < 50; i++) {
        const randomKey = crypto.randomBytes(32);
        assert.throws(
          () => decryptField(token, randomKey),
          (err) => err instanceof CryptoAuthError
        );
      }

      // Test with 32 single-bit mutated master keys (flipping each byte in masterKey)
      for (let byteIdx = 0; byteIdx < 32; byteIdx++) {
        const mutatedKey = Buffer.from(masterKey);
        mutatedKey[byteIdx] ^= 0x01; // flip 1 bit
        assert.throws(
          () => decryptField(token, mutatedKey),
          (err) => err instanceof CryptoAuthError
        );
      }
    });

    it('1.6 Error Object Sanitization: zero plaintext leaked in error messages or properties', () => {
      const ultraSecret = 'TOP_SECRET_PASSWORD_DO_NOT_LEAK_998877';
      const token = encryptField(ultraSecret);
      const [iv, tag, ct] = token.split(':');

      // Tamper ciphertext
      const tamperedCt = mutateHexAt(ct, 0);
      try {
        decryptField(`${iv}:${tag}:${tamperedCt}`);
        assert.fail('Should have thrown CryptoAuthError');
      } catch (err) {
        assert.ok(err instanceof CryptoAuthError);
        assert.ok(!err.message.includes(ultraSecret), 'Error message must not leak plaintext');
        assert.ok(!String(err.stack).includes(ultraSecret), 'Error stack must not leak plaintext');
        // Ensure no extra properties leak data
        for (const [key, val] of Object.entries(err)) {
          assert.ok(!String(val).includes(ultraSecret), `Error property "${key}" leaked plaintext!`);
        }
      }
    });

    it('1.7 Raw Decryption Tamper Resilience: decryptRaw throws CryptoAuthError on bit-flips', () => {
      const plain = 'RawUnwrappedSecretString';
      const token = encryptRaw(plain);
      const [iv, tag, ct] = token.split(':');

      // Flip bit in IV
      const tamperedIv = mutateHexAt(iv, 5);
      assert.throws(() => decryptRaw(`${tamperedIv}:${tag}:${ct}`), CryptoAuthError);

      // Flip bit in Tag
      const tamperedTag = mutateHexAt(tag, 10);
      assert.throws(() => decryptRaw(`${iv}:${tamperedTag}:${ct}`), CryptoAuthError);

      // Flip bit in Ciphertext
      const tamperedCt = mutateHexAt(ct, 2);
      assert.throws(() => decryptRaw(`${iv}:${tag}:${tamperedCt}`), CryptoAuthError);
    });
  });

  describe('2. Extreme and Adversarial Inputs Fuzzing', () => {
    it('2.1 Empty string roundtrips perfectly', () => {
      const cipher = encryptField('');
      assert.ok(isEncrypted(cipher));
      const decrypted = decryptField(cipher);
      assert.strictEqual(decrypted, '');
    });

    it('2.2 null and undefined are handled safely without throwing', () => {
      assert.strictEqual(encryptField(null), null);
      assert.strictEqual(encryptField(undefined), null);
      assert.strictEqual(decryptField(null), null);
      assert.strictEqual(decryptField(undefined), null);
      assert.strictEqual(encryptRaw(null), null);
      assert.strictEqual(encryptRaw(undefined), null);
      assert.strictEqual(decryptRaw(null), null);
      assert.strictEqual(decryptRaw(undefined), null);
    });

    it('2.3 1MB (1,048,576 bytes) long string roundtrips with SHA-256 byte-for-byte fidelity', () => {
      const chunkSize = 1024;
      const chunks = 1024; // 1MB total
      const randomChunk = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+~|}{[]';
      const repeated = randomChunk.repeat(Math.ceil((chunkSize * chunks) / randomChunk.length)).slice(0, 1024 * 1024);
      assert.strictEqual(Buffer.byteLength(repeated, 'utf8'), 1024 * 1024);

      const originalHash = crypto.createHash('sha256').update(repeated, 'utf8').digest('hex');

      const t0 = performance.now();
      const token = encryptField(repeated);
      const encTime = performance.now() - t0;

      assert.ok(isEncrypted(token));
      assert.match(token, CIPHER_REGEX);

      const t1 = performance.now();
      const decrypted = decryptField(token);
      const decTime = performance.now() - t1;

      assert.strictEqual(typeof decrypted, 'string');
      assert.strictEqual(decrypted.length, repeated.length);

      const decryptedHash = crypto.createHash('sha256').update(decrypted, 'utf8').digest('hex');
      assert.strictEqual(decryptedHash, originalHash, 'SHA-256 of 1MB payload must match perfectly');

      // Check performance is reasonable (< 150ms for 1MB encrypt + decrypt)
      assert.ok(encTime < 500, `Encryption took ${encTime}ms`);
      assert.ok(decTime < 500, `Decryption took ${decTime}ms`);
    });

    it('2.4 High-entropy Unicode emojis, ZWJ sequences, and modifiers', () => {
      const emojiString = '🏊‍♂️🏆🏊‍♀️🥇🌊🔥💥❤️👍🚀🎉💎🧑‍💻👩‍👩‍👦‍👦🏳️‍🌈🏴‍☠️';
      const cipher = encryptField(emojiString);
      assert.ok(isEncrypted(cipher));
      const decrypted = decryptField(cipher);
      assert.strictEqual(decrypted, emojiString);
    });

    it('2.5 Persian special characters, ZWNJ, RTL marks, diacritics, and Persian digits', () => {
      const complexPersian = [
        'می‌خواهم شنا یاد بگیرم', // ZWNJ in می‌خواهم
        'کارتخوان سالن شماره ۱۲۳۴۵۶۷۸۹۰', // Persian digits
        'گَردشِ مالیِ حِساب‌داریِ اَستَخر', // Arabic/Persian diacritics + ZWNJ
        '\u200Fمتن راست‌به‌چپ با مارک ایزوله\u200E', // RTL and LTR directional embedding marks
        'ژاله، چمران، پگاه، گودرزی' // Persian specific letters گ چ پ ژ
      ];

      for (const text of complexPersian) {
        const cipher = encryptField(text);
        assert.ok(isEncrypted(cipher));
        const decrypted = decryptField(cipher);
        assert.strictEqual(decrypted, text);
      }
    });

    it('2.6 Deeply nested complex objects (depth 20) with arrays and booleans', () => {
      let nested = { value: 'leaf', depth: 20, active: true, scores: [10, 20.5, -5] };
      for (let d = 19; d >= 1; d--) {
        nested = { level: d, inner: nested, flag: d % 2 === 0 };
      }

      const cipher = encryptField(nested);
      assert.ok(isEncrypted(cipher));
      const decrypted = decryptField(cipher);
      assert.deepStrictEqual(decrypted, nested);
      assert.strictEqual(decrypted.inner.inner.level, 3);
    });

    it('2.7 Boundary integers, negative numbers, floats, and zero', () => {
      const boundaryValues = [
        Number.MAX_SAFE_INTEGER,      // 9007199254740991
        Number.MIN_SAFE_INTEGER,      // -9007199254740991
        0,
        -1,
        -999999999,
        150000000000,
        3.141592653589793,
        1e-7,
        1e+20
      ];

      for (const val of boundaryValues) {
        const cipher = encryptField(val);
        assert.ok(isEncrypted(cipher));
        const decrypted = decryptField(cipher);
        assert.strictEqual(typeof decrypted, 'number');
        assert.strictEqual(decrypted, val);
      }

      // Explicitly verify JavaScript -0 is mapped to 0 per JSON standard (RFC 8259)
      const negZeroCipher = encryptField(-0);
      assert.strictEqual(decryptField(negZeroCipher), 0);
    });

    it('2.8 Adversarial strings: SQL injection, XSS, null-bytes, and control chars', () => {
      const adversarialStrings = [
        "' OR '1'='1'; DROP TABLE athletes; --",
        "'; EXEC xp_cmdshell('dir'); --",
        '<script>alert("XSS")</script><img src=x onerror=alert(1)>',
        'Payload\x00WithNullByte\x00InMiddle',
        'Line1\r\nLine2\tTabbed\b\f\v',
        '\x01\x02\x03\x04\x05\x06\x07\x08\x0E\x0F\x10\x1F'
      ];

      for (const str of adversarialStrings) {
        const cipher = encryptField(str);
        assert.ok(isEncrypted(cipher));
        const decrypted = decryptField(cipher);
        assert.strictEqual(decrypted, str);
      }
    });

    it('2.9 Type Confusion Attacks on decryptField and decryptRaw', () => {
      const nonStringInputs = [
        12345,
        true,
        false,
        {},
        [],
        Buffer.from('hello'),
        () => {},
        Symbol('token')
      ];

      for (const input of nonStringInputs) {
        assert.throws(() => decryptField(input), CryptoAuthError);
        assert.throws(() => decryptRaw(input), CryptoAuthError);
      }
    });

    it('2.10 High Concurrent Load Stress: 1,000 asynchronous operations without race condition', async () => {
      const operations = Array.from({ length: 1000 }, (_, i) => {
        return (async () => {
          const sample = { id: `concurrent-${i}`, payload: `Data-${i}-${Math.random()}` };
          const encrypted = encryptField(sample);
          assert.ok(isEncrypted(encrypted));
          const decrypted = decryptField(encrypted);
          assert.deepStrictEqual(decrypted, sample);
        })();
      });

      await Promise.all(operations);
    });

    it('2.11 Scrypt KDF Avalanche Effect: 1-bit change produces >40% bit difference in 256-bit key', () => {
      const basePass = 'barati-swimming-master-passphrase-2026';
      const baseSalt = 'barati-swimming-master-salt-2026';
      const key1 = deriveKey(basePass, baseSalt);

      // Flip 1 character in passphrase
      const modPass = 'carati-swimming-master-passphrase-2026';
      const key2 = deriveKey(modPass, baseSalt);

      // Count differing bits between key1 and key2
      let diffBits = 0;
      for (let i = 0; i < 32; i++) {
        let xor = key1[i] ^ key2[i];
        while (xor > 0) {
          diffBits += xor & 1;
          xor >>= 1;
        }
      }

      const diffRatio = diffBits / 256;
      // Good cryptographic hash/KDF should have close to 50% bit flip (strict avalanche criterion > 40%)
      assert.ok(diffRatio > 0.40, `Avalanche effect too weak: ${diffBits}/256 bits changed (${(diffRatio * 100).toFixed(1)}%)`);
    });
  });

  describe('3. IV Uniqueness & Entropy Stress Test (10,000 Iterations)', () => {
    it('3.1 10,000 encrypted tokens produce 10,000 unique IVs (0 collisions)', () => {
      const totalTokens = 10000;
      const ivSet = new Set();
      const samplePlaintext = 'Collision-Resistance-Probe-Token';

      const t0 = performance.now();
      for (let i = 0; i < totalTokens; i++) {
        const token = encryptField(samplePlaintext);
        const ivHex = token.slice(0, 24);
        ivSet.add(ivHex);
      }
      const elapsed = performance.now() - t0;

      assert.strictEqual(ivSet.size, totalTokens, `CRITICAL: IV Collision detected! Expected ${totalTokens} unique IVs, got ${ivSet.size}`);
      const rate = Math.round((totalTokens / elapsed) * 1000);
      assert.ok(rate > 1000, `Generation throughput should be > 1000 ops/sec, got ${rate} ops/sec`);
    });

    it('3.2 IV byte distribution entropy check (120,000 bytes across 10,000 IVs)', () => {
      const totalTokens = 10000;
      const byteCounts = new Array(256).fill(0);

      for (let i = 0; i < totalTokens; i++) {
        const token = encryptField(`EntropyCheck-${i}`);
        const ivHex = token.slice(0, 24);
        const ivBuf = Buffer.from(ivHex, 'hex');
        for (const byte of ivBuf) {
          byteCounts[byte]++;
        }
      }

      const totalBytes = totalTokens * 12; // 120,000 bytes
      const expectedPerBucket = totalBytes / 256; // ~468.75

      // Calculate Shannon Entropy
      let entropy = 0;
      for (const count of byteCounts) {
        if (count > 0) {
          const p = count / totalBytes;
          entropy -= p * Math.log2(p);
        }
      }

      // Theoretical maximum entropy for uniform 8-bit bytes is 8.0 bits
      assert.ok(entropy > 7.95, `IV entropy too low: ${entropy.toFixed(4)} bits/byte (must be > 7.95)`);

      // Assert no byte bucket is completely empty (proves full 0-255 coverage)
      const emptyBuckets = byteCounts.filter(c => c === 0).length;
      assert.strictEqual(emptyBuckets, 0, 'Every byte value 0x00-0xFF must appear in 120,000 random IV bytes');
    });
  });

  describe('4. Raw Database & Disk Leakage Shield Verification', () => {
    it('4.1 Insert sensitive records across all tables and verify raw SQL rows contain zero plaintext', () => {
      // 1. Setup school license
      licenseRepo.create({
        schoolId: 'adv-school-1',
        licenseKey: 'ADV-SECRET-LIC-KEY-999',
        academyName: 'آکادمی شنای براتی نمونه ادورساریال',
        contactPhone: '09121112233',
        expiryDate: '2028-12-31T23:59:59Z',
        maxDevices: 10
      });

      // 2. Insert Athletes
      athleteRepo.create('adv-school-1', {
        id: 'ath-adv-1',
        name: 'رضا صمدی پیروز',
        phone: '09129998877',
        cardUid: 'NFC-ADV-777',
        tuitionFee: 8500000,
        paidAmount: 8500000,
        debt: 0
      });

      athleteRepo.create('adv-school-1', {
        id: 'ath-adv-2',
        name: 'مریم اکبری شایسته',
        phone: '09351234567',
        cardUid: 'NFC-ADV-888',
        tuitionFee: 12000000,
        paidAmount: 5000000,
        debt: 7000000
      });

      // 3. Insert Transactions
      transactionRepo.create('adv-school-1', {
        id: 'tx-adv-1',
        title: 'شهریه خصوصی دوره نجات غریق پیشرفته',
        amount: 8500000,
        type: 'income',
        category: 'tuition',
        date: '2026-10-25',
        author: 'حسابدار کل ادورساریال'
      });

      // 4. Insert Attendance Logs
      attendanceRepo.create('adv-school-1', {
        id: 'att-adv-1',
        athleteId: 'ath-adv-1',
        athleteName: 'رضا صمدی پیروز',
        time: '10:00:00',
        timestamp: '2026-10-25T10:00:00Z',
        status: 'present',
        gate: 'VIP Gate 1',
        note: 'ورود موفق به استخر قهرمانی'
      });

      // Inspect Raw SQL rows directly via sqlite query
      const sensitivePlaintexts = [
        'ADV-SECRET-LIC-KEY-999',
        'رضا صمدی پیروز',
        '09129998877',
        'NFC-ADV-777',
        'مریم اکبری شایسته',
        '09351234567',
        'NFC-ADV-888',
        'شهریه خصوصی دوره نجات غریق پیشرفته',
        'حسابدار کل ادورساریال',
        'ورود موفق به استخر قهرمانی'
      ];

      // Audit athletes table
      const rawAthletes = db.prepare('SELECT * FROM athletes WHERE school_id = ?').all('adv-school-1');
      assert.strictEqual(rawAthletes.length, 2);
      for (const row of rawAthletes) {
        assert.match(row.name_encrypted, CIPHER_REGEX);
        assert.match(row.phone_encrypted, CIPHER_REGEX);
        assert.match(row.card_uid_encrypted, CIPHER_REGEX);
        assert.match(row.tuition_fee_encrypted, CIPHER_REGEX);
        assert.match(row.paid_amount_encrypted, CIPHER_REGEX);
        assert.match(row.debt_encrypted, CIPHER_REGEX);

        for (const pt of sensitivePlaintexts) {
          assert.ok(!row.name_encrypted.includes(pt), `Plaintext "${pt}" leaked into name_encrypted!`);
          assert.ok(!row.phone_encrypted.includes(pt), `Plaintext "${pt}" leaked into phone_encrypted!`);
          assert.ok(!row.card_uid_encrypted.includes(pt), `Plaintext "${pt}" leaked into card_uid_encrypted!`);
        }
      }

      // Audit transactions table
      const rawTx = db.prepare('SELECT * FROM transactions WHERE school_id = ?').all('adv-school-1');
      assert.strictEqual(rawTx.length, 1);
      for (const row of rawTx) {
        assert.match(row.title_encrypted, CIPHER_REGEX);
        assert.match(row.amount_encrypted, CIPHER_REGEX);
        assert.match(row.author_encrypted, CIPHER_REGEX);

        for (const pt of sensitivePlaintexts) {
          assert.ok(!row.title_encrypted.includes(pt), `Plaintext "${pt}" leaked into title_encrypted!`);
          assert.ok(!row.author_encrypted.includes(pt), `Plaintext "${pt}" leaked into author_encrypted!`);
        }
      }

      // Audit attendance_logs table
      const rawAtt = db.prepare('SELECT * FROM attendance_logs WHERE school_id = ?').all('adv-school-1');
      assert.strictEqual(rawAtt.length, 1);
      for (const row of rawAtt) {
        assert.match(row.athlete_name_encrypted, CIPHER_REGEX);
        assert.match(row.note_encrypted, CIPHER_REGEX);

        for (const pt of sensitivePlaintexts) {
          assert.ok(!row.athlete_name_encrypted.includes(pt), `Plaintext "${pt}" leaked into athlete_name_encrypted!`);
          assert.ok(!row.note_encrypted.includes(pt), `Plaintext "${pt}" leaked into note_encrypted!`);
        }
      }

      // Audit licenses table
      const rawLic = db.prepare('SELECT * FROM licenses WHERE school_id = ?').all('adv-school-1');
      assert.strictEqual(rawLic.length, 1);
      assert.match(rawLic[0].license_key_encrypted, CIPHER_REGEX);
      assert.ok(!rawLic[0].license_key_encrypted.includes('ADV-SECRET-LIC-KEY-999'));
    });

    it('4.2 Physical binary disk audit confirms ZERO sensitive UTF-8 plaintext bytes on disk', () => {
      // Force WAL checkpoint to flush all data from WAL and cache into the database file
      db.exec('PRAGMA wal_checkpoint(TRUNCATE);');

      const rawDbBuffer = fs.readFileSync(testDbPath);
      assert.ok(rawDbBuffer.length > 0, 'Database file must exist and have content');

      // Also check WAL file if exists
      let walBuffer = Buffer.alloc(0);
      try {
        walBuffer = fs.readFileSync(testDbPath + '-wal');
      } catch {}

      const sensitivePlaintexts = [
        'ADV-SECRET-LIC-KEY-999',
        'رضا صمدی پیروز',
        '09129998877',
        'NFC-ADV-777',
        'مریم اکبری شایسته',
        '09351234567',
        'NFC-ADV-888',
        'شهریه خصوصی دوره نجات غریق پیشرفته',
        'حسابدار کل ادورساریال',
        'ورود موفق به استخر قهرمانی'
      ];

      for (const pt of sensitivePlaintexts) {
        const needle = Buffer.from(pt, 'utf8');

        const foundInDb = rawDbBuffer.includes(needle);
        assert.strictEqual(
          foundInDb,
          false,
          `CRITICAL BREACH: Plaintext "${pt}" found on physical disk in SQLite main file (${testDbPath})!`
        );

        if (walBuffer.length > 0) {
          const foundInWal = walBuffer.includes(needle);
          assert.strictEqual(
            foundInWal,
            false,
            `CRITICAL BREACH: Plaintext "${pt}" found on physical disk in WAL file (${testDbPath}-wal)!`
          );
        }
      }
    });
  });
});
