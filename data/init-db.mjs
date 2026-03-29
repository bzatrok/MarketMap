/**
 * Initialize the SQLite database and seed the initial admin user.
 *
 * Usage: node --env-file=.env data/init-db.mjs
 *
 * Env vars:
 *   ADMIN_EMAIL    - Admin email (default: admin@marketmap.nl)
 *   ADMIN_PASSWORD - Admin password (required on first run)
 */
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const DATA_DIR = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(DATA_DIR, 'marketmap.db');
const SALT_ROUNDS = 10;

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    passwordHash TEXT NOT NULL,
    name TEXT NOT NULL,
    roles TEXT NOT NULL DEFAULT 'admin',
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS descriptions (
    slug TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    generatedAt TEXT NOT NULL,
    model TEXT NOT NULL,
    editedAt TEXT,
    editedBy TEXT
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  );
`;

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(SCHEMA);

console.log('[init-db] Schema created.');

// Seed admin user
const email = process.env.ADMIN_EMAIL || 'admin@marketmap.nl';
const password = process.env.ADMIN_PASSWORD;

const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);

if (existing) {
  console.log(`[init-db] User '${email}' already exists — skipping.`);
} else {
  if (!password) {
    console.error('[init-db] ERROR: ADMIN_PASSWORD env var is required to create the initial user.');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  db.prepare('INSERT INTO users (email, passwordHash, name, roles) VALUES (?, ?, ?, ?)').run(
    email,
    passwordHash,
    'Admin',
    'admin'
  );
  console.log(`[init-db] Created admin user: ${email}`);
}

// Seed default settings
const defaults = {
  siteName: 'Weekmarkten Nederland',
  openaiModel: 'gpt-5-mini',
  analyticsEnabled: 'true',
  seoDefaultDescription: 'Vind weekmarkten in heel Nederland. Zoek op dag, provincie of stad.',
};

const upsert = db.prepare(`
  INSERT INTO settings (key, value) VALUES (?, ?)
  ON CONFLICT(key) DO NOTHING
`);

for (const [key, value] of Object.entries(defaults)) {
  upsert.run(key, value);
}

console.log('[init-db] Default settings seeded.');
db.close();
