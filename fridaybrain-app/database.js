const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'data', 'onboarding.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS providers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    contact_number TEXT,
    personal_email TEXT,
    vip_emergency_line TEXT,
    work_email TEXT,
    npi TEXT,
    credentials TEXT,
    pt_ft TEXT,
    specialty TEXT,
    languages TEXT,
    biography TEXT,
    signature_link TEXT,
    drive_folder_link TEXT,
    contract_signed_date TEXT,
    expected_first_day TEXT,
    primary_location TEXT,
    independent_practice INTEGER DEFAULT 0,
    anticipated_start_date TEXT,
    state TEXT,
    entity_locations TEXT,
    training_plan TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider_id INTEGER NOT NULL,
    task_name TEXT NOT NULL,
    details TEXT,
    completed_by TEXT,
    status TEXT DEFAULT 'Not Started',
    deadline TEXT,
    location_tracking TEXT,
    notes TEXT,
    sort_order INTEGER DEFAULT 0,
    FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS team_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    initials TEXT NOT NULL UNIQUE,
    name TEXT
  );
`);

// Add archived column if it doesn't exist
try { db.exec('ALTER TABLE providers ADD COLUMN archived INTEGER DEFAULT 0'); } catch(e) {}
try { db.exec('ALTER TABLE providers ADD COLUMN free_notes TEXT'); } catch(e) {}
try { db.exec('ALTER TABLE providers ADD COLUMN malpractice_status TEXT DEFAULT "Not Started"'); } catch(e) {}
try { db.exec('ALTER TABLE providers ADD COLUMN malpractice_carrier TEXT'); } catch(e) {}
try { db.exec('ALTER TABLE providers ADD COLUMN malpractice_policy TEXT'); } catch(e) {}
try { db.exec('ALTER TABLE providers ADD COLUMN malpractice_start TEXT'); } catch(e) {}
try { db.exec('ALTER TABLE providers ADD COLUMN malpractice_end TEXT'); } catch(e) {}
try { db.exec('ALTER TABLE providers ADD COLUMN malpractice_amount TEXT'); } catch(e) {}
try { db.exec('ALTER TABLE providers ADD COLUMN malpractice_notes TEXT'); } catch(e) {}
try { db.exec('ALTER TABLE providers ADD COLUMN nextech_status TEXT'); } catch(e) {}
try { db.exec('ALTER TABLE providers ADD COLUMN ordering TEXT'); } catch(e) {}

db.exec(`
  CREATE TABLE IF NOT EXISTS credentialing_updates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider_id INTEGER NOT NULL,
    update_text TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE
  );
`);

// Seed default team members
const existingMembers = db.prepare('SELECT COUNT(*) as count FROM team_members').get();
if (existingMembers.count === 0) {
  const insert = db.prepare('INSERT OR IGNORE INTO team_members (initials, name) VALUES (?, ?)');
  [['HR', 'HR Team'], ['CS', 'CS'], ['TG', 'TG'], ['KL', 'KL'], ['KJ', 'KJ']].forEach(([i, n]) => insert.run(i, n));
}

module.exports = db;
