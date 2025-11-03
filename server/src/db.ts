import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DEFAULT_DB_FILE = path.resolve(process.cwd(), 'server/data/coupons.db');

const databaseFile = process.env.DB_FILE ? path.resolve(process.cwd(), process.env.DB_FILE) : DEFAULT_DB_FILE;

fs.mkdirSync(path.dirname(databaseFile), { recursive: true });

export const db = new Database(databaseFile);

db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS coupons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  promo_id TEXT NOT NULL,
  promo_name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  type TEXT NOT NULL,
  value REAL NOT NULL,
  begins_at TEXT NOT NULL,
  expires_at TEXT,
  generation_case_id TEXT,
  generation_user_id TEXT,
  generation_agent_id TEXT,
  generation_agent_name TEXT,
  generation_order_number TEXT,
  generation_reason TEXT,
  generation_generated_at TEXT
);

CREATE TABLE IF NOT EXISTS approval_requests (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  requested_at TEXT NOT NULL,
  case_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  order_number TEXT,
  reason TEXT NOT NULL,
  coupon_type TEXT NOT NULL,
  promo_name TEXT NOT NULL,
  resolved_by TEXT,
  resolved_at TEXT
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  work_id TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  accessible_coupon_types TEXT NOT NULL DEFAULT '[]',
  manager_ids TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  user_role TEXT NOT NULL,
  action TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS coupon_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);
`);

export type Transaction = ReturnType<typeof db.transaction>;

export const withTransaction = <T>(fn: () => T): T => {
  const wrapped = db.transaction(fn);
  return wrapped();
};
