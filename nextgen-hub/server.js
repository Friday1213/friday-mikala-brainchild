const express = require('express');
const db = require('./database');
const path = require('path');

const app = express();
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

// ── Stats ─────────────────────────────────────────────────────────────────────
app.get('/api/stats', (req, res) => {
  const total = db.prepare('SELECT COUNT(*) as c FROM articles').get().c;
  const byCategory = db.prepare('SELECT category, COUNT(*) as c FROM articles GROUP BY category ORDER BY c DESC').all();
  const byRole = db.prepare('SELECT role, COUNT(*) as c FROM articles WHERE role IS NOT NULL GROUP BY role ORDER BY c DESC').all();
  res.json({ total, byCategory, byRole });
});

app.listen(PORT, () => console.log(`NextGen Hub on port ${PORT}`));
