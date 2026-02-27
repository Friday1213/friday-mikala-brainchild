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

// Article: Lab Ordering
try {
  db.prepare(`INSERT OR IGNORE INTO articles (id, title, category, role, module, summary, content, tips, common_mistakes)
    VALUES (31, 'Lab Ordering — Step-by-Step', 'Orders & Results', 'All Staff', 'Orders',
    'How to place a lab order in NextGen using the Orders module.',
    '1. Open the patient chart — use Patient Search or open from the Appointment tab in your inbox.\n2. Complete the 4-Point Check: verify Location, Provider, Patient, and Encounter Date/Time. Do this before every order.\n3. Navigate to the Orders Module.\n4. Begin a new lab order: click the dropdown next to New → select Lab Order.\n5. Indicate test priority if needed (Stat / Hold / Ordered Elsewhere).\n6. Select ordering diagnosis code(s) from Select Diagnosis. Use Search All if the list is blank or your code is missing.\n7. Select applicable tests — choose from Favorites, By Category, or Search All.\n8. Review assigned tests and diagnosis codes in Assign Diagnosis to Selected Tests.\n9. Add additional details if applicable:\n   - General tab: clinical info, comments, Copy To physicians\n   - Test Details tab: AOE questions, specimen details\n10. Enter tracking information (optional) — add internal comments or actions under the Tracking tab.\n11. Review the order in the Orders Summary grid.\n12. Print if needed: right-click → Print or Print Preview.',
    'Always complete the 4-Point Check before placing any order.|Use Search All if your diagnosis code does not appear in the default list.|Check the Favorites list first — your most common labs may already be saved there.',
    'Forgetting to verify the encounter date/time before ordering.|Not linking diagnosis codes to all selected tests.|Skipping the Orders Summary review before submitting.'
  )`).run();
} catch(e) {}

// Article: Radiology/Diagnostic Ordering
try {
  db.prepare(`INSERT OR IGNORE INTO articles (id, title, category, role, module, summary, content, tips, common_mistakes)
    VALUES (32, 'Radiology/Diagnostic Ordering — Step-by-Step', 'Orders & Results', 'All Staff', 'Orders',
    'How to place a radiology or diagnostic imaging order in NextGen using the Orders module.',
    '1. Open the patient chart — use Patient Search or open from the Appointment tab in your inbox.\n2. Complete the 4-Point Check: verify Location, Provider, Patient, and Encounter Date/Time.\n3. Navigate to the Orders Module.\n4. Begin a new radiology/diagnostic order: click the dropdown next to New → select Radiology Order.\n5. Indicate test priority if needed (Stat / Hold / Ordered Elsewhere).\n6. Select ordering diagnosis code(s) from Select Diagnosis. Use Search All if the list is blank or your code is missing.\n7. Select applicable tests — choose from Favorites, By Category, or Search All.\n8. Review assigned tests and diagnosis codes in Assign Diagnosis to Selected Tests.\n9. Add additional details if applicable — General tab: clinical info, comments, Copy To physicians.\n10. Enter tracking information (optional) — add internal comments or actions under the Tracking tab.\n11. Review the order in the Orders Summary grid.\n12. Print if needed: right-click → Print or Print Preview.',
    'Always complete the 4-Point Check before placing any order.|Use Search All if your diagnosis code does not appear in the default list.|Check Favorites first — common radiology orders may already be saved.',
    'Forgetting to verify the encounter date/time.|Not linking diagnosis codes to all selected tests.|Skipping the Orders Summary review before submitting.'
  )`).run();
} catch(e) {}

// Article: MIPS QID 130
try {
  db.prepare(`INSERT OR IGNORE INTO articles (id, title, category, role, module, summary, content, tips, common_mistakes)
    VALUES (33, 'MIPS QID 130 — Documentation of Current Medications', 'Quality & Compliance', 'MA / Provider', 'Medications',
    'How to satisfy MIPS Quality ID 130 — Documentation of Current Medications — during a patient encounter in NextGen.',
    '1. Go to the Appointment Tab within the Inbox and select the patient.\n2. Complete the 4-Point Check: verify Location, Provider, Patient, and Encounter Date/Time.\n3. Open the Intake Template or the Medication Module.\n4. Determine whether the patient is taking any medications (ask the patient or review available info).\n\nIf NO medications:\n- Document "No Active Medications"\n- Check the Medications Reconciled checkbox\n\nIf taking medications:\n- Document all medications in the Medication Module\n- Check the Medications Reconciled checkbox',
    'The Medications Reconciled checkbox must be checked in BOTH scenarios — with or without medications.|This measure applies to every eligible encounter — build it into your intake routine.',
    'Leaving the Medications Reconciled checkbox unchecked.|Documenting medications without checking reconciliation.|Skipping this step entirely on follow-up visits.'
  )`).run();
} catch(e) {}

module.exports = db;
