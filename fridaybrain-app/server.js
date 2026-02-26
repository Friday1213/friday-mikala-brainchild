const express = require('express');
const session = require('express-session');
const { OAuth2Client } = require('google-auth-library');
const db = require('./database');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production', maxAge: 24 * 60 * 60 * 1000 }
}));
app.use(express.static(path.join(__dirname, 'public')));

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const googleConfigured = GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET;

// Auth middleware
function requireAuth(req, res, next) {
  if (!googleConfigured || req.session.user) return next();
  res.status(401).json({ error: 'Not authenticated' });
}

// Google OAuth
app.get('/auth/google', (req, res) => {
  if (!googleConfigured) return res.redirect('/?error=oauth_not_configured');
  const client = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, `${req.protocol}://${req.get('host')}/auth/google/callback`);
  const url = client.generateAuthUrl({ access_type: 'offline', scope: ['profile', 'email'] });
  res.redirect(url);
});

app.get('/auth/google/callback', async (req, res) => {
  try {
    const client = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, `${req.protocol}://${req.get('host')}/auth/google/callback`);
    const { tokens } = await client.getToken(req.query.code);
    client.setCredentials(tokens);
    const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    req.session.user = { name: payload.name, email: payload.email, picture: payload.picture };
    res.redirect('/');
  } catch (e) {
    res.redirect('/?error=auth_failed');
  }
});

app.get('/auth/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

app.get('/api/me', (req, res) => {
  res.json({
    user: req.session.user || null,
    googleConfigured,
    authenticated: !googleConfigured || !!req.session.user
  });
});

// Default tasks template
const DEFAULT_TASKS = [
  { task_name: 'Set up Rippling Account/Onboarding Email', details: 'Assign delivery location for computer and scrubs', completed_by: 'HR', sort_order: 1 },
  { task_name: 'Multi team email', details: 'Email announcing new provider, requests from each team, training plan, locations, malpractice needs', completed_by: 'CS', sort_order: 2 },
  { task_name: 'Onboarding Intro Email', details: 'Schedule orientation meetings', completed_by: 'CS', sort_order: 3 },
  { task_name: 'Credentialing Intro Email - soon to be automated', details: 'Collect all documents', completed_by: 'TG', sort_order: 4 },
  { task_name: 'Supply Preferences Email (add to rippling)', details: 'Coordinate scrub delivery, collect bio, glove size', completed_by: 'KL', sort_order: 5 },
  { task_name: 'Discuss at Credentialing Meeting', details: 'Confirm malpractice needs, confirm locations', completed_by: 'KJ/CS', sort_order: 6 },
  { task_name: 'Discuss at Strategic Growth Meeting', details: '', completed_by: 'CS', sort_order: 7 },
  { task_name: 'Confirm rippling has been accessed', details: '', completed_by: 'CS', sort_order: 8 },
  { task_name: 'Confirm email has been accessed', details: '', completed_by: 'CS', sort_order: 9 },
  { task_name: 'Create provider folder', details: 'LINK TO TEMPLATE HERE & SCRUBS INFO', completed_by: 'CS', sort_order: 10 },
  { task_name: 'Share provider folder', details: '', completed_by: 'CS', sort_order: 11 },
];

// Providers
app.get('/api/providers', requireAuth, (req, res) => {
  const showArchived = req.query.archived === 'true';
  const providers = db.prepare(`SELECT * FROM providers WHERE archived = ? ORDER BY COALESCE(anticipated_start_date, expected_first_day, '0000') DESC`).all(showArchived ? 1 : 0);
  const tasksCount = db.prepare(`SELECT provider_id, COUNT(*) as total, SUM(CASE WHEN status='Complete' THEN 1 ELSE 0 END) as done, SUM(CASE WHEN notes IS NOT NULL AND notes != '' THEN 1 ELSE 0 END) as has_notes FROM tasks GROUP BY provider_id`).all();
  const taskMap = {};
  tasksCount.forEach(t => taskMap[t.provider_id] = { total: t.total, done: t.done });
  res.json(providers.map(p => ({ ...p, taskStats: taskMap[p.id] || { total: 0, done: 0 } })));
});

app.post('/api/providers', requireAuth, (req, res) => {
  const { name, contact_number, personal_email, vip_emergency_line, work_email, npi, credentials, pt_ft, specialty, languages, biography, signature_link, drive_folder_link, contract_signed_date, expected_first_day, primary_location, independent_practice, anticipated_start_date, state, entity_locations, training_plan } = req.body;
  const result = db.prepare(`INSERT INTO providers (name, contact_number, personal_email, vip_emergency_line, work_email, npi, credentials, pt_ft, specialty, languages, biography, signature_link, drive_folder_link, contract_signed_date, expected_first_day, primary_location, independent_practice, anticipated_start_date, state, entity_locations, training_plan) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(name, contact_number, personal_email, vip_emergency_line, work_email, npi, credentials, pt_ft, specialty, languages, biography, signature_link, drive_folder_link, contract_signed_date, expected_first_day, primary_location, independent_practice ? 1 : 0, anticipated_start_date, state, entity_locations, training_plan ? JSON.stringify(training_plan) : null);
  // Add default tasks
  const insertTask = db.prepare('INSERT INTO tasks (provider_id, task_name, details, completed_by, sort_order) VALUES (?,?,?,?,?)');
  DEFAULT_TASKS.forEach(t => insertTask.run(result.lastInsertRowid, t.task_name, t.details, t.completed_by, t.sort_order));
  res.json({ id: result.lastInsertRowid });
});

app.get('/api/providers/:id', requireAuth, (req, res) => {
  const provider = db.prepare('SELECT * FROM providers WHERE id = ?').get(req.params.id);
  if (!provider) return res.status(404).json({ error: 'Not found' });
  const tasks = db.prepare('SELECT * FROM tasks WHERE provider_id = ? ORDER BY sort_order').all(req.params.id);
  res.json({ ...provider, tasks });
});

app.put('/api/providers/:id', requireAuth, (req, res) => {
  const { name, contact_number, personal_email, vip_emergency_line, work_email, npi, credentials, pt_ft, specialty, languages, biography, signature_link, drive_folder_link, contract_signed_date, expected_first_day, primary_location, independent_practice, anticipated_start_date, state, entity_locations, training_plan } = req.body;
  db.prepare(`UPDATE providers SET name=?, contact_number=?, personal_email=?, vip_emergency_line=?, work_email=?, npi=?, credentials=?, pt_ft=?, specialty=?, languages=?, biography=?, signature_link=?, drive_folder_link=?, contract_signed_date=?, expected_first_day=?, primary_location=?, independent_practice=?, anticipated_start_date=?, state=?, entity_locations=?, training_plan=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(name, contact_number, personal_email, vip_emergency_line, work_email, npi, credentials, pt_ft, specialty, languages, biography, signature_link, drive_folder_link, contract_signed_date, expected_first_day, primary_location, independent_practice ? 1 : 0, anticipated_start_date, state, entity_locations, training_plan ? JSON.stringify(training_plan) : null, req.params.id);
  res.json({ ok: true });
});

app.put('/api/providers/:id/archive', requireAuth, (req, res) => {
  const { archived } = req.body;
  db.prepare('UPDATE providers SET archived = ? WHERE id = ?').run(archived ? 1 : 0, req.params.id);
  res.json({ ok: true });
});

app.delete('/api/providers/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM providers WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Tasks
app.put('/api/tasks/:id', requireAuth, (req, res) => {
  const { task_name, details, completed_by, status, deadline, location_tracking, notes } = req.body;
  db.prepare('UPDATE tasks SET task_name=?, details=?, completed_by=?, status=?, deadline=?, location_tracking=?, notes=? WHERE id=?').run(task_name, details, completed_by, status, deadline, location_tracking, notes, req.params.id);
  res.json({ ok: true });
});

app.post('/api/providers/:id/tasks', requireAuth, (req, res) => {
  const { task_name, details, completed_by, status, deadline, location_tracking, notes } = req.body;
  const maxOrder = db.prepare('SELECT MAX(sort_order) as m FROM tasks WHERE provider_id=?').get(req.params.id);
  const result = db.prepare('INSERT INTO tasks (provider_id, task_name, details, completed_by, status, deadline, location_tracking, notes, sort_order) VALUES (?,?,?,?,?,?,?,?,?)').run(req.params.id, task_name, details, completed_by, status || 'Not Started', deadline, location_tracking, notes, (maxOrder.m || 0) + 1);
  res.json({ id: result.lastInsertRowid });
});

app.delete('/api/tasks/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM tasks WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// Team members
app.get('/api/team', requireAuth, (req, res) => res.json(db.prepare('SELECT * FROM team_members ORDER BY initials').all()));
app.post('/api/team', requireAuth, (req, res) => {
  const { initials, name } = req.body;
  const result = db.prepare('INSERT OR IGNORE INTO team_members (initials, name) VALUES (?,?)').run(initials, name);
  res.json({ id: result.lastInsertRowid });
});
app.delete('/api/team/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM team_members WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

app.listen(PORT, () => console.log(`FridayBrain running on port ${PORT}`));
