import Database from 'better-sqlite3';
import path from 'path';

let db;

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

export function getDb() {
  if (!db) {
    const dbPath = path.join(process.cwd(), 'data', 'marketmap.db');
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.exec(SCHEMA);
  }
  return db;
}
