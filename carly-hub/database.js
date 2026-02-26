const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'data', 'carly.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS pto_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    date TEXT NOT NULL,
    hours REAL NOT NULL,
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS pto_settings (
    id INTEGER PRIMARY KEY,
    annual_hours REAL DEFAULT 160,
    hours_per_day REAL DEFAULT 10,
    year INTEGER DEFAULT 2026
  );

  CREATE TABLE IF NOT EXISTS trips (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    destination TEXT NOT NULL,
    purpose TEXT,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    hotel TEXT,
    hotel_address TEXT,
    confirmation_number TEXT,
    flight_info TEXT,
    notes TEXT,
    status TEXT DEFAULT 'upcoming',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Seed default PTO settings
const settings = db.prepare('SELECT COUNT(*) as count FROM pto_settings').get();
if (settings.count === 0) {
  db.prepare('INSERT INTO pto_settings (id, annual_hours, hours_per_day, year) VALUES (1, 160, 10, 2026)').run();
}

module.exports = db;
