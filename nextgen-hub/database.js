const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'data', 'nextgen.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    role TEXT,
    module TEXT,
    summary TEXT,
    content TEXT,
    tips TEXT,
    common_mistakes TEXT,
    video_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Migrations
['role TEXT', 'module TEXT', 'tips TEXT', 'common_mistakes TEXT', 'video_url TEXT'].forEach(col => {
  try { db.exec(`ALTER TABLE articles ADD COLUMN ${col}`); } catch(e) {}
});

// Seed with a starter article
try {
  db.prepare(`INSERT OR IGNORE INTO articles (id, title, category, role, module, summary, content, tips, common_mistakes)
    VALUES (1, 'Getting Started with NextGen', 'General', 'All Staff', 'General',
    'Overview of the NextGen EHR system and how to log in for the first time.',
    'NextGen EHR is the new electronic health record system replacing Nextech at VIP Medical Group. Go-live is May 12, 2026.\n\nTo log in:\n1. Go to the NextGen login portal\n2. Enter your VIP credentials\n3. Select your location from the dropdown\n4. You are now on the home dashboard',
    'Bookmark the login page on day one.\nIf you get locked out, contact your superuser first before calling IT.',
    'Using Nextech shortcuts that do not exist in NextGen — take your time to learn the new workflows.'
  )`).run();
} catch(e) {}

module.exports = db;
