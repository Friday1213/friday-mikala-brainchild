const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'data', 'brain.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT NOT NULL,
    category TEXT DEFAULT 'Inbox',
    status TEXT DEFAULT 'Todo',
    priority TEXT DEFAULT 'Normal',
    notes TEXT,
    due_date TEXT,
    provider_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    color TEXT DEFAULT '#6b7280',
    sort_order INTEGER DEFAULT 0
  );
`);

// Add new columns if they don't exist (safe migration)
try { db.exec('ALTER TABLE items ADD COLUMN due_date TEXT'); } catch(e) {}
try { db.exec('ALTER TABLE items ADD COLUMN provider_name TEXT'); } catch(e) {}

// Seed default categories
const existing = db.prepare('SELECT COUNT(*) as count FROM categories').get();
if (existing.count === 0) {
  const insert = db.prepare('INSERT OR IGNORE INTO categories (name, color, sort_order) VALUES (?,?,?)');
  [
    ['Inbox',      '#94a3b8', 0],
    ['To Do',      '#a78bfa', 1],
    ['Onboarding', '#818cf8', 2],
    ['NextGen',    '#60a5fa', 3],
    ['Audits',     '#f472b6', 4],
    ['Side Projects', '#34d399', 5],
    ['Personal',      '#f472b6', 6],
  ].forEach(([n,c,s]) => insert.run(n, c, s));
}

module.exports = db;
