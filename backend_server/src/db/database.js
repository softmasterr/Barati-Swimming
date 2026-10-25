/**
 * Barati Swimming Academy - SQLite Database Engine
 * Zero-dependency native SQLite driver via Node.js built-in 'node:sqlite' (DatabaseSync).
 */

import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let dbInstance = null;
let currentDbPath = null;

/**
 * Configure essential PRAGMA parameters for performance, concurrency, and integrity.
 * @param {DatabaseSync} db
 */
export function configurePragmas(db) {
  // WAL mode for concurrent reads while writes occur
  db.exec('PRAGMA journal_mode = WAL;');
  // Enforce referential integrity
  db.exec('PRAGMA foreign_keys = ON;');
  // Wait up to 5000ms if database is locked by another transaction
  db.exec('PRAGMA busy_timeout = 5000;');
  // NORMAL sync is crash-safe in WAL mode and faster than FULL
  db.exec('PRAGMA synchronous = NORMAL;');
  // Temp tables and indices stored in RAM
  db.exec('PRAGMA temp_store = MEMORY;');
  // 64MB memory page cache
  db.exec('PRAGMA cache_size = -64000;');
}

/**
 * Execute automatic schema migration using src/db/schema.sql.
 * @param {DatabaseSync} db
 */
export function runMigrations(db) {
  // Check if migrations table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS _schema_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    );
  `);

  const hasAppliedInitial = db
    .prepare('SELECT id FROM _schema_migrations WHERE version = ?')
    .get('001_initial_schema');

  if (!hasAppliedInitial) {
    const schemaFilePath = path.join(__dirname, 'schema.sql');
    if (fs.existsSync(schemaFilePath)) {
      const schemaSql = fs.readFileSync(schemaFilePath, 'utf8');
      db.exec(schemaSql);
      db.prepare('INSERT INTO _schema_migrations (version) VALUES (?)').run('001_initial_schema');
    } else {
      console.warn(`[DB] Schema file not found at ${schemaFilePath}; skipping initial migration.`);
    }
  }
}

/**
 * Initialize SQLite database connection, execute PRAGMAs, and run pending migrations.
 * @param {string} [dbPath] Custom path (e.g. ':memory:' for tests) or defaults to environment / data/barati.db
 * @returns {DatabaseSync}
 */
export function initDatabase(dbPath) {
  if (dbInstance) {
    if (!dbPath || dbPath === currentDbPath) {
      return dbInstance;
    }
    // If a different path was requested, close existing connection
    closeDatabase();
  }

  const resolvedPath = dbPath || config?.databasePath || process.env.DATABASE_PATH || path.resolve(process.cwd(), 'data', 'barati.db');
  currentDbPath = resolvedPath;

  if (resolvedPath !== ':memory:') {
    const dataDir = path.dirname(resolvedPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }

  try {
    const db = new DatabaseSync(resolvedPath, {
      open: true,
      enableForeignKeyConstraints: true
    });

    configurePragmas(db);
    dbInstance = db;

    // Run schema migrations
    runMigrations(db);

    return db;
  } catch (error) {
    console.error('[DB] Fatal initialization error:', error);
    throw new Error(`Database initialization failed: ${error.message}`);
  }
}

/**
 * Get the active database singleton instance.
 * @returns {DatabaseSync}
 */
export function getDatabase() {
  if (!dbInstance) {
    return initDatabase();
  }
  return dbInstance;
}

let transactionDepth = 0;

/**
 * Execute a callback within an immediate transaction or nested savepoint.
 * Automatically nests using SQLite SAVEPOINT when invoked inside an active transaction.
 * @template T
 * @param {(db: DatabaseSync) => T} callback
 * @returns {T}
 */
export function withTransaction(callback) {
  const db = getDatabase();
  const isOuter = transactionDepth === 0;
  const savepointName = `sp_${transactionDepth}`;
  transactionDepth++;

  if (isOuter) {
    db.exec('BEGIN IMMEDIATE;');
  } else {
    db.exec(`SAVEPOINT ${savepointName};`);
  }

  try {
    const result = callback(db);
    if (isOuter) {
      db.exec('COMMIT;');
    } else {
      db.exec(`RELEASE SAVEPOINT ${savepointName};`);
    }
    return result;
  } catch (error) {
    if (isOuter) {
      try {
        db.exec('ROLLBACK;');
      } catch (_) {}
    } else {
      try {
        db.exec(`ROLLBACK TO SAVEPOINT ${savepointName};`);
        db.exec(`RELEASE SAVEPOINT ${savepointName};`);
      } catch (_) {}
    }
    throw error;
  } finally {
    transactionDepth--;
  }
}

/**
 * Checkpoint WAL log and cleanly close database connection.
 */
export function closeDatabase() {
  transactionDepth = 0;
  if (dbInstance) {
    try {
      if (currentDbPath && currentDbPath !== ':memory:') {
        try {
          dbInstance.exec('PRAGMA wal_checkpoint(TRUNCATE);');
        } catch (_) {}
      }
      dbInstance.close();
    } finally {
      dbInstance = null;
      currentDbPath = null;
    }
  }
}

