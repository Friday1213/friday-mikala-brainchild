const express = require('express');
const db = require('./database');
const path = require('path');

const app = express();

// ── Auth ──────────────────────────────────────────────────────────────────────
const AUTH_LOGIN = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Login · Friday</title><style>*{box-sizing:border-box;margin:0;padding:0}body{background:#0f172a;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:-apple-system,sans-serif}form{background:#1e293b;border:1px solid rgba(255,255,255,.1);border-radius:18px;padding:36px 28px;width:90%;max-width:300px;text-align:center}h1{color:#f1f5f9;font-size:22px;margin-bottom:6px}p{color:#64748b;font-size:13px;margin-bottom:24px}input{width:100%;padding:13px;border-radius:10px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.07);color:#f1f5f9;font-size:18px;text-align:center;outline:none;letter-spacing:4px;margin-bottom:12px}button{width:100%;padding:12px;border-radius:10px;border:none;background:#6d28d9;color:white;font-size:15px;font-weight:700;cursor:pointer}.err{color:#f87171;font-size:12px;margin-top:10px;display:block}</style></head><body><form method="POST" action="/__login"><h1>🖤 Friday</h1><p>Enter password to continue</p><input type="password" name="p" placeholder="••••" autofocus autocomplete="current-password"><button type="submit">Enter</button>ERRTAG</form></body></html>`;
app.use(require('express').urlencoded({ extended: false }));
app.post('/__login', (req, res) => {
  if (req.body.p === '1213') {
    res.setHeader('Set-Cookie', '__oc=1213; Path=/; HttpOnly; Max-Age=2592000');
    res.redirect('/');
  } else {
    res.send(AUTH_LOGIN.replace('ERRTAG', '<span class="err">Wrong password</span>'));
  }
});
app.use((req, res, next) => {
  if (req.path === '/__login') return next();
  const c = (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith('__oc='));
  if (c && c.split('=')[1] === '1213') return next();
  res.send(AUTH_LOGIN.replace('ERRTAG', ''));
});
// ─────────────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Articles ──────────────────────────────────────────────────────────────────
app.get('/api/articles', (req, res) => {
  const { q, category, role, module: mod } = req.query;
  let sql = 'SELECT * FROM articles WHERE 1=1';
  const params = [];
  if (q) {
    sql += ` AND (title LIKE ? OR summary LIKE ? OR content LIKE ? OR tips LIKE ? OR category LIKE ? OR role LIKE ?)`;
    const t = `%${q}%`; params.push(t,t,t,t,t,t);
  }
  if (category) { sql += ' AND category = ?'; params.push(category); }
  if (role) { sql += ' AND role = ?'; params.push(role); }
  if (mod) { sql += ' AND module = ?'; params.push(mod); }
  sql += ' ORDER BY category ASC, title ASC';
  res.json(db.prepare(sql).all(...params));
});

app.get('/api/articles/:id', (req, res) => {
  const a = db.prepare('SELECT * FROM articles WHERE id=?').get(req.params.id);
  if (!a) return res.status(404).json({ error: 'Not found' });
  res.json(a);
});

app.post('/api/articles', (req, res) => {
  const f = req.body;
  const r = db.prepare(`INSERT INTO articles (title,category,role,module,summary,content,tips,common_mistakes,video_url)
    VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(f.title,f.category||'General',f.role||null,f.module||null,f.summary||null,f.content||null,f.tips||null,f.common_mistakes||null,f.video_url||null);
  res.json({ id: r.lastInsertRowid });
});

app.put('/api/articles/:id', (req, res) => {
  const f = req.body;
  db.prepare(`UPDATE articles SET title=?,category=?,role=?,module=?,summary=?,content=?,tips=?,common_mistakes=?,video_url=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
    .run(f.title,f.category||'General',f.role||null,f.module||null,f.summary||null,f.content||null,f.tips||null,f.common_mistakes||null,f.video_url||null,req.params.id);
  res.json({ ok: true });
});

app.delete('/api/articles/:id', (req, res) => {
  db.prepare('DELETE FROM articles WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ── Templates ─────────────────────────────────────────────────────────────────
app.get('/api/templates', (req, res) => {
  res.json(db.prepare('SELECT id,name,category,description,created_at,updated_at FROM ng_templates ORDER BY updated_at DESC').all());
});
app.get('/api/templates/:id', (req, res) => {
  const t = db.prepare('SELECT * FROM ng_templates WHERE id=?').get(req.params.id);
  if (!t) return res.status(404).json({ error: 'Not found' });
  t.sections = JSON.parse(t.sections || '[]');
  res.json(t);
});
app.post('/api/templates', (req, res) => {
  const { name, category, description, sections } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const r = db.prepare('INSERT INTO ng_templates (name,category,description,sections) VALUES (?,?,?,?)')
    .run(name, category||'Procedure', description||'', JSON.stringify(sections||[]));
  res.json({ id: r.lastInsertRowid, ok: true });
});
app.put('/api/templates/:id', (req, res) => {
  const { name, category, description, sections } = req.body;
  db.prepare('UPDATE ng_templates SET name=?,category=?,description=?,sections=?,updated_at=CURRENT_TIMESTAMP WHERE id=?')
    .run(name, category||'Procedure', description||'', JSON.stringify(sections||[]), req.params.id);
  res.json({ ok: true });
});
app.delete('/api/templates/:id', (req, res) => {
  db.prepare('DELETE FROM ng_templates WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ── Stats ─────────────────────────────────────────────────────────────────────
app.get('/api/stats', (req, res) => {
  const total = db.prepare('SELECT COUNT(*) as c FROM articles').get().c;
  const byCategory = db.prepare('SELECT category, COUNT(*) as c FROM articles GROUP BY category ORDER BY c DESC').all();
  const byRole = db.prepare('SELECT role, COUNT(*) as c FROM articles WHERE role IS NOT NULL GROUP BY role ORDER BY c DESC').all();
  res.json({ total, byCategory, byRole });
});

app.listen(PORT, () => console.log(`NextGen Hub on port ${PORT}`));
