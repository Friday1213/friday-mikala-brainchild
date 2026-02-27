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

const bulkArticles = [
  [34,'Standing Orders — Step-by-Step','Orders & Results','MA / Clinical Staff','Standing Orders',
   'How to place a standing order during a patient encounter.',
   '1. Open the patient chart from the Appointment tab in the Inbox (status: Kept).\n2. Complete 4-Point Check: Location, Provider, Patient, Encounter Date/Time.\n3. Open the Intake → click the Standing Orders link.\n4. Select the appropriate test from the grid.\n5. Check if an assessment is attached — if not, click Add or Update Assessment.\n6. Enter test interpretation if necessary (directly or via Details for discrete data).\n7. Determine if billable: if yes, ensure Submit to Superbill is selected; if not, deselect it.\n8. Click Place Order.',
   'Always check the Superbill checkbox status before placing the order.|Use Details to enter discrete data when the test requires it.',
   'Placing a standing order without a linked diagnosis.|Forgetting to deselect Superbill for non-billable tests.'],
  [35,'Clinical Staff Intake — Step-by-Step','Clinical Documentation','MA / Clinical Staff','Intake',
   'Full clinical intake workflow for MAs and RNs in NextGen.',
   '1. Select patient from Appointment tab in Inbox → update tracking to Exam Room / with Nursing / with MA.\n2. 4-Point Check: Location, Provider, Patient, Encounter Date/Time.\n3. Open *SOAP template (confirm specialty: General Surgery/Vein or Neurosurgery/Pain). Select Visit Type. Apply Quick Note if appropriate. Open *Intake template.\n4. Confirm new vs. established.\n   - NEW: Add Past Medical/Surgical, Family, Social, Confidential histories\n   - ESTABLISHED: Review and update existing histories\n5. Select Chief Complaint and document HPI.\n6. Open Vital Signs panel — record/update vitals.\n7. Open Medications module — import med history, reconcile, check Medications Reconciled.\n8. Add/update Allergies — select Allergies Reviewed.\n9. Add POC orders as needed. Use Standing Orders link if applicable.\n10. Open Review of Systems panel — apply ROS Quick Save, adjust grid.\n11. Generate the Intake Note.\n12. Update Patient Tracking to "Ready for Provider."',
   'Apply ROS Quick Save first, then adjust the grid — faster than building from scratch.|Always confirm specialty in the SOAP template before proceeding.',
   'Forgetting to check Medications Reconciled.|Not updating Patient Tracking to "Ready for Provider" at the end.|Selecting the wrong specialty in the SOAP template.'],
  [36,'Provider Visit — Step-by-Step','Clinical Documentation','Provider','SOAP / Finalize',
   'Full provider visit workflow in NextGen from inbox to charges submitted.',
   '1. Open patient from Inbox when status shows "Ready for Provider" → update tracking to "With Provider".\n2. 4-Point Check: Location, Provider, Patient, Encounter Date/Time.\n3. Open SOAP Template — apply Quick Note if needed. Use Quick Save and MyPhrase for efficiency.\n4. Review Chief Complaint (entered by MA) and update if needed.\n5. Review History Summary — add new history, update History Review indicator.\n6. Add/update Review of Systems, Vital Signs, Physical Exam.\n7. Expand Assessment/Plan panel — select assessments, update A/P Details tab.\n8. Place orders: Labs tab (lab orders), Diagnostics tab (imaging), Referrals tab (referrals).\n9. Open Medication Module (Meds icon) — refill or add medications.\n10. Click EM Coding icon → Finalize template → choose MDM level → Submit Code.\n11. Master Document generates automatically — sign now or later via PAQ.',
   'Use Quick Save and MyPhrase throughout to save time.|Sign at end of day if not ready immediately — use PAQ to track unsigned notes.',
   'Choosing the wrong MDM level — review documentation before submitting.|Forgetting to place orders through the correct tabs (Labs/Diagnostics/Referrals) in the A/P panel.'],
  [37,'Chronic Conditions Visit — Step-by-Step','Clinical Documentation','Provider','Chronic Conditions',
   'How to document and manage chronic condition visits in NextGen.',
   '1. Open patient (status: Waiting for Provider) → update tracking to "With Provider".\n2. 4-Point Check: Location, Provider, Patient, Encounter Date/Time.\n3. Open Intake template → SOAP template tab → click Chronic Conditions button under Reason for Visit.\n4. Determine if the problem is listed:\n   - If NO: Click Add Problem → add and select it\n   - If YES: Select the problem, choose diagnosis code and assessment status\n5. Check for Screening Questions — document responses, Save & Close.\n6. Review Lab Results, Patient Histories, Vital Signs.\n7. Document Physical Exam and Patient Instructions.\n8. If multiple problems: select next problem and repeat.\n9. Assessment & Plan auto-populates — add additional assessments, Add/Update, Quick Save, Save & Close.\n10. EM Coding icon → MDM level → Submit Code → Master Document generates → sign via PAQ.',
   'All chronic condition assessments auto-populate in A&P — only add extras manually.|Use Quick Save frequently to avoid losing work.',
   'Forgetting to check for screening questions associated with a problem.|Not adding additional problems before closing the Chronic Conditions section.'],
  [38,'Chart Abstraction — Step-by-Step','Clinical Documentation','All Staff','Intake',
   'How to perform chart abstraction for a patient in NextGen.',
   '1. Use Patient Lookup button to find the correct patient and open their chart.\n2. 4-Point Check: Location, Provider, Patient, Encounter Date/Time.\n3. Create a new encounter.\n4. Open *Intake Template.\n5. Select appropriate Specialty (General Surgery or Neurosurgery).\n6. Select Visit Type → Chart Abstraction.\n7. Complete History Summary Panel: add Past Medical/Surgical, Family, Social, Confidential histories.\n8. Enter Diagnoses: click Quick Button for Diagnosis List → open Billing ICD/Problems Module → add/update ICD codes.\n9. Document Allergies: Allergies panel → Add → enter allergies.\n10. Document Medications: Add/Update → use medication history import or enter manually.',
   'Use the medication history import button when available — saves significant time.|Always select Visit Type "Chart Abstraction" to ensure proper coding.',
   'Creating the encounter without setting the correct visit type.|Missing the Confidential History section in the History Summary.'],
  [39,'Referral Processing — Step-by-Step','Referrals','Front Desk / MA','Referrals',
   'How to process and send referrals in NextGen — NG Share and non-NG Share workflows.',
   'NG SHARE ENABLED:\n1. Open referrals via Order template or Referral Management template.\n2. Locate and highlight the referral in the grid.\n3. Click Share — sends CCDA, attachments (PDF), and cover letter electronically.\n4. Confirm delivery in the Orders Panel.\n\nNG SHARE NOT ENABLED:\n1. Open Checkout template → click Add to open Referrals Order template.\n2. Highlight the referral → click Details to review required attachments.\n3. Use document buttons to generate: Referral Document and Referral Letter.\n4. File Menu → Custom Print/Send → choose Fax.\n5. General & Categories tabs → select all necessary documents → click Fax button.\n6. Enter recipient information → finalize sending.',
   'Always confirm in the Orders Panel that the referral was sent and delivered (NG Share).|Use Categories tab carefully to ensure all required documents are included before faxing.',
   'Sending via fax without checking which documents the provider indicated in Details.|Not confirming delivery after sending via NG Share.'],
  [40,'Referral Ordering — Step-by-Step','Referrals','Provider / MA','Referrals',
   'How to place a referral order in NextGen.',
   '1. Open the Referrals Order template.\n2. Check NG Share availability:\n   - If yes: click NG Share button → search by name, specialty, or location → click to select provider\n   - If no: proceed with manual entry\n3. Under "To:" select the referral type radio button.\n4. Add Diagnosis: use Description field picklist or Add Assessment/Add Common Assessment.\n5. Select Services Requested (radio buttons/checkboxes).\n6. Choose Clinical Indication from picklist or free-text.\n7. Add Timeframe (optional) and Clinical Information/Comments.\n8. Select Specialty from picklist.\n9. Add Tasks to staff if needed.\n10. Click Add to enter referral into the grid.\n11. Add Instructions (checkboxes or Instruction Details for free-text).\n12. Add Attachments (up to 8) via Details.\n13. Confirm provider address via Address Detail hyperlink.\n14. Complete Therapies & DME sections if applicable.',
   'Use Add Common Assessment for frequently used referral diagnoses — faster than searching every time.|Always confirm the provider address via the Address Detail hyperlink before sending.',
   'Forgetting to click Add before closing — referral won't be saved to the grid.|Not attaching required clinical documents before sending.'],
  [41,'Unified Intake + Provider Visit — Full SOP','Clinical Documentation','All Clinical Staff','SOAP / Intake / Finalize',
   'Combined step-by-step SOP covering the full clinical intake (MA/RN) and provider visit workflow with handoff checklist.',
   'PHASE A — CLINICAL INTAKE (MA/RN)\nA1. Select patient from Inbox > Appointment tab → update tracking to "with Nursing" or "with MA"\nA2. 4-Point Check: Location, Provider, Patient, Encounter Date/Time\nA3. Open *SOAP template (confirm specialty: General Surgery/Vein or Neurosurgery/Pain). Select Visit Type. Apply Quick Note if appropriate. Open *Intake template.\nA4. Confirm new vs. established:\n   NEW: Add Past Medical/Surgical, Family, Social, Confidential histories\n   ESTABLISHED: Review and update existing histories\nA5. Select Chief Complaint → document HPI\nA6. Open Vital Signs panel → record/update vitals\nA7. Open Medications module → import med history, reconcile, check Medications Reconciled\nA8. Add/update Allergies → select Allergies Reviewed\nA9. Add POC/Standing Orders as needed\nA10. Open Review of Systems → apply Quick Save → adjust grid\nA11. Generate Intake Note → update tracking to "Ready for Provider"\n\nPHASE B — PROVIDER VISIT\nB1. Open patient (status: Ready for Provider) → update tracking to "With Provider"\nB2. 4-Point Check\nB3. Open SOAP Template → apply Quick Note → use Quick Save and MyPhrase\nB4. Review Chief Complaint → update if needed\nB5. Review/update History Summary, ROS, Vital Signs, Physical Exam\nB6. Assessment & Plan → A/P Details tab → Labs / Diagnostics / Referrals tabs for orders\nB7. Open Medications Module → refill or add medications\nB8. EM Coding icon → choose MDM level → Submit Code → Master Document generates → sign via PAQ\nPatient Tracking auto-updates to "Charges Submitted"\n\nHANDOFF CHECKLIST:\n☐ Vitals entered and reviewed\n☐ Allergies reviewed/updated\n☐ Medications reconciled\n☐ Orders (POC/Standing) placed or deferred noted\n☐ Intake Note generated\n☐ Patient Tracking set to Ready for Provider',
   'Use this SOP as a training reference for new staff learning both roles.|The Handoff Checklist at the bottom ensures nothing is missed between intake and provider visit.',
   'Skipping the handoff checklist items before marking "Ready for Provider".|Not updating Patient Tracking at each phase transition.'],
];

bulkArticles.forEach(([id, title, category, role, module, summary, content, tips, mistakes]) => {
  try {
    db.prepare(`INSERT OR IGNORE INTO articles (id, title, category, role, module, summary, content, tips, common_mistakes)
      VALUES (?,?,?,?,?,?,?,?,?)`).run(id, title, category, role, module, summary, content, tips, mistakes);
  } catch(e) {}
});

module.exports = db;
