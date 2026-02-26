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

// Seed default categories
const existing = db.prepare('SELECT COUNT(*) as count FROM categories').get();
if (existing.count === 0) {
  const insert = db.prepare('INSERT OR IGNORE INTO categories (name, color, sort_order) VALUES (?,?,?)');
  [
    ['Inbox', '#6b7280', 0],
    ['Provider Onboarding', '#7c3aed', 1],
    ['EHR Migration', '#2563eb', 2],
    ['Team / HR', '#059669', 3],
    ['Admin', '#d97706', 4],
  ].forEach(([n,c,s]) => insert.run(n, c, s));
}

module.exports = db;
