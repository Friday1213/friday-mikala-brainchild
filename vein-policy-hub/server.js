const express = require('express');
const db = require('./database');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Payers ────────────────────────────────────────────────────────────────────
app.get('/api/payers', (req, res) => {
  const { q, state, plan_type, preauth } = req.query;
  let sql = 'SELECT * FROM payers WHERE 1=1';
  const params = [];
  if (q) { sql += ` AND (name LIKE ? OR notes LIKE ? OR documentation LIKE ? OR gotchas LIKE ? OR state LIKE ?)`; const t = `%${q}%`; params.push(t,t,t,t,t); }
  if (state) { sql += ' AND state LIKE ?'; params.push(`%${state}%`); }
  if (plan_type) { sql += ' AND plan_type = ?'; params.push(plan_type); }
  if (preauth === '1') { sql += ' AND preauth_required = 1'; }
  sql += ' ORDER BY name ASC, state ASC';
  res.json(db.prepare(sql).all(...params));
});

app.get('/api/payers/:id', (req, res) => {
  const p = db.prepare('SELECT * FROM payers WHERE id=?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Not found' });
  p.history = db.prepare('SELECT * FROM policy_history WHERE payer_id=? ORDER BY changed_at DESC LIMIT 20').all(p.id);
  res.json(p);
});

app.post('/api/payers', (req, res) => {
  const f = req.body;
  const r = db.prepare(`INSERT INTO payers (name,state,plan_type,conservative_weeks,conservative_notes,reflux_duration_sec,vessel_diameter_mm,ultrasound_notes,ceap_required,documentation,cpt_codes,icd10_codes,preauth_required,preauth_notes,gotchas,source_url,last_verified,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(f.name,f.state,f.plan_type,f.conservative_weeks||null,f.conservative_notes||null,f.reflux_duration_sec||null,f.vessel_diameter_mm||null,f.ultrasound_notes||null,f.ceap_required||null,f.documentation||null,f.cpt_codes||null,f.icd10_codes||null,f.preauth_required?1:0,f.preauth_notes||null,f.gotchas||null,f.source_url||null,f.last_verified||null,f.notes||null);
  res.json({ id: r.lastInsertRowid });
});

app.put('/api/payers/:id', (req, res) => {
  const f = req.body;
  const old = db.prepare('SELECT * FROM payers WHERE id=?').get(req.params.id);
  if (!old) return res.status(404).json({ error: 'Not found' });

  // Track changes
  const track = db.prepare('INSERT INTO policy_history (payer_id, changed_field, old_value, new_value) VALUES (?,?,?,?)');
  const fields = ['conservative_weeks','conservative_notes','reflux_duration_sec','vessel_diameter_mm','ultrasound_notes','ceap_required','documentation','cpt_codes','icd10_codes','preauth_required','preauth_notes','gotchas','source_url','notes'];
  fields.forEach(field => {
    if (String(old[field]||'') !== String(f[field]||'')) {
      track.run(req.params.id, field, String(old[field]||''), String(f[field]||''));
    }
  });

  db.prepare(`UPDATE payers SET name=?,state=?,plan_type=?,conservative_weeks=?,conservative_notes=?,reflux_duration_sec=?,vessel_diameter_mm=?,ultrasound_notes=?,ceap_required=?,documentation=?,cpt_codes=?,icd10_codes=?,preauth_required=?,preauth_notes=?,gotchas=?,source_url=?,last_verified=?,notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
    .run(f.name,f.state,f.plan_type,f.conservative_weeks||null,f.conservative_notes||null,f.reflux_duration_sec||null,f.vessel_diameter_mm||null,f.ultrasound_notes||null,f.ceap_required||null,f.documentation||null,f.cpt_codes||null,f.icd10_codes||null,f.preauth_required?1:0,f.preauth_notes||null,f.gotchas||null,f.source_url||null,f.last_verified||null,f.notes||null,req.params.id);
  res.json({ ok: true });
});

app.delete('/api/payers/:id', (req, res) => {
  db.prepare('DELETE FROM payers WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ── Auto-seed from spreadsheet JSON ──────────────────────────────────────────
try {
  const seedPath = path.join(__dirname, 'seed_from_spreadsheet.json');
  if (require('fs').existsSync(seedPath)) {
    const seeds = JSON.parse(require('fs').readFileSync(seedPath, 'utf8'));
    const ins = db.prepare(`INSERT OR IGNORE INTO payers
      (name,state,plan_type,conservative_weeks,conservative_notes,reflux_duration_sec,vessel_diameter_mm,
       ultrasound_notes,ceap_required,documentation,cpt_codes,icd10_codes,preauth_required,preauth_notes,
       gotchas,source_url,last_verified,notes)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    let seeded = 0;
    seeds.forEach(p => {
      try {
        ins.run(p.name,p.state,p.plan_type,p.conservative_weeks||null,p.conservative_notes||null,
          p.reflux_duration_sec||null,p.vessel_diameter_mm||null,p.ultrasound_notes||null,
          p.ceap_required||null,p.documentation||null,p.cpt_codes||null,p.icd10_codes||null,
          p.preauth_required||0,p.preauth_notes||null,p.gotchas||null,p.source_url||null,
          p.last_verified||null,p.notes||null);
        seeded++;
      } catch(e) {}
    });
    if (seeded > 0) console.log(`Seeded ${seeded} policies from spreadsheet`);
  }
} catch(e) { console.error('Seed error:', e.message); }

// ── AI Parse endpoint ─────────────────────────────────────────────────────────
app.post('/api/parse-policy', (req, res) => {
  // Returns structured extraction prompt for client-side display
  // (actual AI parsing done client-side or via future OpenAI integration)
  res.json({ message: 'AI parsing coming soon' });
});

// ── Policy Change Detection ───────────────────────────────────────────────────
const HASH_FILE = path.join(process.env.DB_PATH ? path.dirname(process.env.DB_PATH) : path.join(__dirname, 'data'), 'policy_hashes.json');

app.get('/api/policy-hashes', (req, res) => {
  try {
    if (require('fs').existsSync(HASH_FILE)) res.json(JSON.parse(require('fs').readFileSync(HASH_FILE, 'utf8')));
    else res.json({});
  } catch(e) { res.json({}); }
});

app.post('/api/policy-hashes', (req, res) => {
  try {
    require('fs').mkdirSync(path.dirname(HASH_FILE), { recursive: true });
    require('fs').writeFileSync(HASH_FILE, JSON.stringify(req.body, null, 2));
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/payers/:id/flag-review', (req, res) => {
  const { reason } = req.body;
  const note = `⚠️ NEEDS REVIEW: ${reason}`;
  const p = db.prepare('SELECT notes FROM payers WHERE id=?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Not found' });
  const existing = p.notes || '';
  const updated = existing.includes('NEEDS REVIEW') ? existing.replace(/⚠️ NEEDS REVIEW:[^\n]*/g, note) : `${note}\n\n${existing}`;
  db.prepare('UPDATE payers SET notes=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(updated.trim(), req.params.id);
  db.prepare('INSERT INTO policy_history (payer_id, changed_field, old_value, new_value) VALUES (?,?,?,?)').run(req.params.id, 'needs_review', '', reason);
  res.json({ ok: true });
});

// ── Doppler Cheat Sheet ───────────────────────────────────────────────────────
app.get('/api/cheatsheet', (req, res) => {
  try {
    const p = path.join(__dirname, 'doppler_cheat_sheet.json');
    if (require('fs').existsSync(p)) {
      res.json(JSON.parse(require('fs').readFileSync(p, 'utf8')));
    } else {
      res.json({});
    }
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Stats ─────────────────────────────────────────────────────────────────────
app.get('/api/stats', (req, res) => {
  const total = db.prepare('SELECT COUNT(*) as c FROM payers').get().c;
  const byType = db.prepare('SELECT plan_type, COUNT(*) as c FROM payers GROUP BY plan_type').all();
  const avgWeeks = db.prepare('SELECT AVG(conservative_weeks) as avg FROM payers WHERE conservative_weeks IS NOT NULL').get().avg;
  res.json({ total, byType, avgWeeks });
});

app.listen(PORT, () => console.log(`Vein Policy Hub on port ${PORT}`));
