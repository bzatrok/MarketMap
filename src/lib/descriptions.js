import { getDb } from './db';

export function getDescription(slug) {
  const db = getDb();
  return db.prepare('SELECT slug, content, generatedAt, model, editedAt, editedBy FROM descriptions WHERE slug = ?').get(slug) || null;
}

export function getAllDescriptions() {
  const db = getDb();
  return db.prepare('SELECT slug, generatedAt, model, editedAt, editedBy FROM descriptions ORDER BY slug').all();
}

export function upsertDescription(slug, content, model, editedBy = null) {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO descriptions (slug, content, generatedAt, model)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(slug) DO UPDATE SET content = ?, generatedAt = ?, model = ?
  `).run(slug, content, now, model, content, now, model);
}

export function updateDescriptionContent(slug, content, editedBy) {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare('UPDATE descriptions SET content = ?, editedAt = ?, editedBy = ? WHERE slug = ?').run(content, now, editedBy, slug);
}

export function deleteDescription(slug) {
  const db = getDb();
  db.prepare('DELETE FROM descriptions WHERE slug = ?').run(slug);
}
