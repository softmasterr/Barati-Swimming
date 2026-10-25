-- ====================================================================
-- Barati Swimming Cloud Backend - Complete SQLite Schema
-- Target: Node.js node:sqlite (DatabaseSync)
-- Engine Mode: WAL (Write-Ahead Logging) + Foreign Keys Enabled
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. LICENSES TABLE (Multi-Tenant School Registry)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS licenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id TEXT NOT NULL UNIQUE,
  academy_name TEXT NOT NULL,
  license_key_encrypted TEXT NOT NULL,
  contact_phone TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'deactivated')),
  expiry_date TEXT NOT NULL,
  max_devices INTEGER NOT NULL DEFAULT 3,
  devices_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_licenses_school_id ON licenses(school_id);
CREATE INDEX IF NOT EXISTS idx_licenses_status ON licenses(status);

-- --------------------------------------------------------------------
-- 2. ATHLETES TABLE (Field-Level AES-256-GCM Encrypted)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS athletes (
  school_id TEXT NOT NULL,
  id TEXT NOT NULL,
  name_encrypted TEXT NOT NULL,
  phone_encrypted TEXT NOT NULL,
  coach_id TEXT NOT NULL,
  card_uid_encrypted TEXT,
  package_name TEXT NOT NULL,
  total_sessions INTEGER NOT NULL DEFAULT 0,
  remaining_sessions INTEGER NOT NULL DEFAULT 0,
  total_attended INTEGER NOT NULL DEFAULT 0,
  tuition_fee_encrypted TEXT NOT NULL,
  paid_amount_encrypted TEXT NOT NULL,
  debt_encrypted TEXT NOT NULL,
  expire_date TEXT NOT NULL,
  synced_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  PRIMARY KEY (school_id, id),
  FOREIGN KEY (school_id) REFERENCES licenses(school_id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_athletes_coach ON athletes(school_id, coach_id);
CREATE INDEX IF NOT EXISTS idx_athletes_synced ON athletes(school_id, synced_at);

-- --------------------------------------------------------------------
-- 3. COACHES TABLE (Encrypted Contact & Settled Financials)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS coaches (
  school_id TEXT NOT NULL,
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  specialty TEXT NOT NULL,
  model_type TEXT NOT NULL CHECK (model_type IN ('percentage', 'per_session', 'monthly_fixed')),
  model_val INTEGER NOT NULL DEFAULT 0,
  model_label TEXT NOT NULL,
  phone_encrypted TEXT NOT NULL,
  settled_amount_encrypted TEXT NOT NULL,
  synced_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  PRIMARY KEY (school_id, id),
  FOREIGN KEY (school_id) REFERENCES licenses(school_id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_coaches_school ON coaches(school_id);

-- --------------------------------------------------------------------
-- 4. ATTENDANCE LOGS TABLE (Encrypted Gate Access Records)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attendance_logs (
  school_id TEXT NOT NULL,
  id TEXT NOT NULL,
  time TEXT NOT NULL,
  athlete_name_encrypted TEXT NOT NULL,
  coach_name TEXT NOT NULL,
  status TEXT NOT NULL,
  sessions_left INTEGER NOT NULL DEFAULT 0,
  note_encrypted TEXT NOT NULL,
  synced_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  PRIMARY KEY (school_id, id),
  FOREIGN KEY (school_id) REFERENCES licenses(school_id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_attendance_time ON attendance_logs(school_id, time);

-- --------------------------------------------------------------------
-- 5. TRANSACTIONS TABLE (Encrypted Financial Ledger)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS transactions (
  school_id TEXT NOT NULL,
  id TEXT NOT NULL,
  date TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'coach_payout')),
  title_encrypted TEXT NOT NULL,
  amount_encrypted TEXT NOT NULL,
  method TEXT NOT NULL,
  author_encrypted TEXT NOT NULL,
  synced_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  PRIMARY KEY (school_id, id),
  FOREIGN KEY (school_id) REFERENCES licenses(school_id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(school_id, type);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(school_id, date);

-- --------------------------------------------------------------------
-- 6. DEFINITIONS TABLE (Cost Centers, Goods, Packages)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS definitions (
  school_id TEXT NOT NULL,
  id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('cost_center', 'goods_item', 'course_type')),
  title TEXT NOT NULL,
  code TEXT NOT NULL,
  description TEXT,
  price INTEGER DEFAULT 0,
  sessions INTEGER DEFAULT 0,
  synced_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  PRIMARY KEY (school_id, id),
  FOREIGN KEY (school_id) REFERENCES licenses(school_id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_definitions_type ON definitions(school_id, type);

-- --------------------------------------------------------------------
-- 7. SCHOOL SETTINGS TABLE (Tenant Preferences & Encrypted Tokens)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS school_settings (
  school_id TEXT PRIMARY KEY,
  academy_name TEXT NOT NULL,
  api_key_encrypted TEXT,
  sms_provider TEXT DEFAULT 'directSim',
  sms_api_key_encrypted TEXT,
  sms_sender_line TEXT DEFAULT '10008585',
  sms_entry_template TEXT,
  sms_low_balance_template TEXT,
  sms_recharge_template TEXT,
  grace_sessions_limit INTEGER DEFAULT 1,
  low_sessions_threshold INTEGER DEFAULT 2,
  cooldown_minutes INTEGER DEFAULT 60,
  is_demo_mode INTEGER DEFAULT 1,
  app_version TEXT DEFAULT '1.1.0',
  updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  FOREIGN KEY (school_id) REFERENCES licenses(school_id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- --------------------------------------------------------------------
-- 8. ADMIN USERS TABLE (Argon2id + TOTP 2FA + Lockout Defense)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  totp_secret_encrypted TEXT,
  totp_enabled INTEGER NOT NULL DEFAULT 0,
  role TEXT NOT NULL DEFAULT 'superadmin',
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  last_login_at TEXT,
  last_login_ip TEXT,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_admin_username ON admin_users(username);

-- --------------------------------------------------------------------
-- 9. AUDIT LOGS TABLE (Administrative Actions & Security Events)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  admin_username TEXT NOT NULL,
  action TEXT NOT NULL,
  ip_address TEXT NOT NULL,
  user_agent TEXT,
  target_id TEXT,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'SUCCESS' CHECK (status IN ('SUCCESS', 'FAILURE', 'WARNING'))
);

CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_username ON audit_logs(admin_username);
