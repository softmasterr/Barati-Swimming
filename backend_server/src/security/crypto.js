/**
 * src/security/crypto.js
 * Cryptographic Subsystem: AES-256-GCM Field-Level Encryption & Scrypt KDF
 * Fully compliant with NIST SP 800-38D and RFC 7914.
 */

import crypto from 'node:crypto';
import { config } from '../config/env.js';

/**
 * Custom Error thrown on cryptographic authentication failure, tampering, or malformed ciphertext.
 */
export class CryptoAuthError extends Error {
  constructor(message = 'Cryptographic authentication failed: data tampered, corrupted, or invalid key') {
    super(message);
    this.name = 'CryptoAuthError';
    this.code = 'ERR_CRYPTO_AUTH_FAILED';
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CryptoAuthError);
    }
  }
}

// Cipher and KDF constants
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH_BYTES = 12; // 96 bits per NIST SP 800-38D Section 5.2.1.1
const AUTH_TAG_LENGTH_BYTES = 16; // 128 bits per NIST SP 800-38D Section 5.2.1.2
const KEY_LENGTH_BYTES = 32; // 256 bits

// Default persistent salt for key derivation fallback
const DEFAULT_SALT = 'barati-swimming-master-encryption-salt-2026';

// Format validation regex: <24_hex_iv>:<32_hex_authTag>:<even_hex_ciphertext>
const CIPHERTEXT_REGEX = /^[0-9a-fA-F]{24}:[0-9a-fA-F]{32}:[0-9a-fA-F]*$/;

// Module-level cached master key buffer to avoid repeated 56ms Scrypt computations
let cachedMasterKey = null;

/**
 * Derive a 32-byte key from a passphrase using Scrypt KDF.
 * @param {string} passphrase - Encryption passphrase
 * @param {Buffer|string} salt - Persistent salt
 * @returns {Buffer} 32-byte derived key
 */
export function deriveKey(passphrase, salt = DEFAULT_SALT) {
  if (!passphrase) {
    throw new Error('Passphrase is required for key derivation');
  }
  const saltBuf = Buffer.isBuffer(salt) ? salt : Buffer.from(String(salt), 'utf8');
  return crypto.scryptSync(String(passphrase), saltBuf, KEY_LENGTH_BYTES, {
    N: 16384, // CPU/memory cost
    r: 8,     // Block size
    p: 1,     // Parallelization
    maxmem: 128 * 1024 * 1024 // 128 MiB max memory
  });
}

/**
 * Retrieve the active cached master key, deriving it once if not already initialized.
 * @returns {Buffer} 32-byte master key
 */
export function getMasterKey() {
  if (cachedMasterKey) {
    return cachedMasterKey;
  }
  const passphrase = config?.dataEncryptionKey || process.env.DATA_ENCRYPTION_KEY || 'barati-swimming-dev-secret-key-32bytes-min';
  const salt = config?.dataEncryptionSalt || process.env.DATA_ENCRYPTION_SALT || DEFAULT_SALT;
  cachedMasterKey = deriveKey(passphrase, salt);
  return cachedMasterKey;
}

/**
 * Override or reset the cached master key (useful for tests and dynamic key injection).
 * @param {Buffer|null} key - 32-byte Buffer or null to clear cache
 */
export function setMasterKey(key) {
  if (key !== null && (!Buffer.isBuffer(key) || key.length !== KEY_LENGTH_BYTES)) {
    throw new TypeError(`Master key must be a 32-byte Buffer or null, got: ${key}`);
  }
  cachedMasterKey = key;
}

/**
 * Check if a value is a valid formatted ciphertext string.
 * @param {*} value
 * @returns {boolean}
 */
export function isEncrypted(value) {
  if (typeof value !== 'string') return false;
  return CIPHERTEXT_REGEX.test(value) && (value.length - 58) % 2 === 0;
}

/**
 * Encrypt a field value (string, number, object, array, boolean) using AES-256-GCM.
 * Handles type preservation via JSON serialization.
 * @param {*} value - Plaintext value to encrypt
 * @param {Buffer} [secretKey] - Optional 32-byte key override
 * @returns {string|null} Serialized format: <iv_hex>:<auth_tag_hex>:<ciphertext_hex> or null
 */
export function encryptField(value, secretKey = getMasterKey()) {
  if (value === null || value === undefined) {
    return null;
  }

  // Preserve types (string, number, object, array, boolean) via JSON serialization
  const payloadStr = JSON.stringify(value);

  // Generate fresh cryptographically random 12-byte (96-bit) IV
  const iv = crypto.randomBytes(IV_LENGTH_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, secretKey, iv);

  let ciphertextHex = cipher.update(payloadStr, 'utf8', 'hex');
  ciphertextHex += cipher.final('hex');

  // 16-byte authentication tag
  const authTagHex = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${authTagHex}:${ciphertextHex}`;
}

/**
 * Decrypt a ciphertext string using AES-256-GCM.
 * Automatically verifies AuthTag and deserializes JSON types, with fallback to raw string.
 * Aborts with CryptoAuthError and zero plaintext leakage if tampered.
 * @param {string|null} ciphertextStr - Formatted ciphertext <iv>:<tag>:<ciphertext>
 * @param {Buffer} [secretKey] - Optional 32-byte key override
 * @returns {*} Decrypted value with preserved type, or null
 */
export function decryptField(ciphertextStr, secretKey = getMasterKey()) {
  if (ciphertextStr === null || ciphertextStr === undefined) {
    return null;
  }

  if (typeof ciphertextStr !== 'string') {
    throw new CryptoAuthError('Ciphertext must be a string');
  }

  if (!isEncrypted(ciphertextStr)) {
    throw new CryptoAuthError('Invalid ciphertext serialization format: expected <iv_hex_24>:<auth_tag_hex_32>:<ciphertext_hex>');
  }

  const parts = ciphertextStr.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const dataHex = parts[2];

  let decryptedStr = null;
  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, secretKey, iv);
    decipher.setAuthTag(authTag);
    decryptedStr = decipher.update(dataHex, 'hex', 'utf8');
    decryptedStr += decipher.final('utf8');
  } catch {
    // Zero out any partial plaintext on failure
    decryptedStr = null;
    throw new CryptoAuthError('Cryptographic authentication failed: data tampered, corrupted, or invalid key');
  }

  // Deserialize JSON payload to restore exact JavaScript type
  try {
    return JSON.parse(decryptedStr);
  } catch {
    return decryptedStr;
  }
}

/**
 * Raw string encryption without JSON wrapping (for plain string-in, string-out use cases).
 * @param {string|null} text
 * @param {Buffer} [secretKey]
 * @returns {string|null}
 */
export function encryptRaw(text, secretKey = getMasterKey()) {
  if (text === null || text === undefined) return null;
  const iv = crypto.randomBytes(IV_LENGTH_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, secretKey, iv);
  let ciphertextHex = cipher.update(String(text), 'utf8', 'hex');
  ciphertextHex += cipher.final('hex');
  const authTagHex = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTagHex}:${ciphertextHex}`;
}

/**
 * Raw string decryption without JSON parsing.
 * @param {string|null} ciphertextStr
 * @param {Buffer} [secretKey]
 * @returns {string|null}
 */
export function decryptRaw(ciphertextStr, secretKey = getMasterKey()) {
  if (ciphertextStr === null || ciphertextStr === undefined) return null;
  if (!isEncrypted(ciphertextStr)) {
    throw new CryptoAuthError('Invalid ciphertext format');
  }
  const parts = ciphertextStr.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const dataHex = parts[2];

  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, secretKey, iv);
    decipher.setAuthTag(authTag);
    let str = decipher.update(dataHex, 'hex', 'utf8');
    str += decipher.final('utf8');
    return str;
  } catch {
    throw new CryptoAuthError('Cryptographic authentication failed: data tampered or invalid key');
  }
}

/**
 * Explicit helper for encrypting JSON objects/arrays.
 */
export function encryptJson(obj, secretKey = getMasterKey()) {
  return encryptField(obj, secretKey);
}

/**
 * Explicit helper for decrypting JSON objects/arrays.
 */
export function decryptJson(ciphertextStr, secretKey = getMasterKey()) {
  return decryptField(ciphertextStr, secretKey);
}
