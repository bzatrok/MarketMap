import { getDb } from './db';

export function getSetting(key) {
  const db = getDb();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row?.value ?? null;
}

export function getAllSettings() {
  const db = getDb();
  const rows = db.prepare('SELECT key, value, updatedAt FROM settings ORDER BY key').all();
  const result = {};
  for (const row of rows) {
    result[row.key] = row.value;
  }
  return result;
}

export function setSetting(key, value) {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO settings (key, value, updatedAt) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = ?, updatedAt = ?
  `).run(key, value, now, value, now);
}

export function setSettings(entries) {
  const db = getDb();
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO settings (key, value, updatedAt) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = ?, updatedAt = ?
  `);
  const tx = db.transaction((entries) => {
    for (const [key, value] of Object.entries(entries)) {
      stmt.run(key, value, now, value, now);
    }
  });
  tx(entries);
}
