const express = require('express');
const db = require('./database');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/items', (req, res) => {
  const { category, status } = req.query;
  let q = 'SELECT * FROM items WHERE 1=1';
  const params = [];
  if (category) { q += ' AND category=?'; params.push(category); }
  if (status)   { q += ' AND status=?';   params.push(status); }
  q += " ORDER BY CASE priority WHEN 'High' THEN 0 WHEN 'Normal' THEN 1 WHEN 'Low' THEN 2 END, updated_at DESC";
  res.json(db.prepare(q).all(...params));
});

app.post('/api/items', (req, res) => {
  const { text, category, status, priority, notes, due_date, provider_name } = req.body;
  const result = db.prepare(
    'INSERT INTO items (text, category, status, priority, notes, due_date, provider_name) VALUES (?,?,?,?,?,?,?)'
  ).run(text, category||'Inbox', status||'Todo', priority||'Normal', notes||null, due_date||null, provider_name||null);
  res.json(db.prepare('SELECT * FROM items WHERE id=?').get(result.lastInsertRowid));
});

app.put('/api/items/:id', (req, res) => {
  const { text, category, status, priority, notes, due_date, provider_name } = req.body;
  db.prepare(
    'UPDATE items SET text=?, category=?, status=?, priority=?, notes=?, due_date=?, provider_name=?, updated_at=CURRENT_TIMESTAMP WHERE id=?'
  ).run(text, category, status, priority, notes||null, due_date||null, provider_name||null, req.params.id);
  res.json(db.prepare('SELECT * FROM items WHERE id=?').get(req.params.id));
});

app.delete('/api/items/:id', (req, res) => {
  db.prepare('DELETE FROM items WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

app.get('/api/categories', (req, res) => res.json(db.prepare('SELECT * FROM categories ORDER BY sort_order').all()));

app.post('/api/categories', (req, res) => {
  const { name, color } = req.body;
  const maxOrder = db.prepare('SELECT MAX(sort_order) as m FROM categories').get();
  const result = db.prepare('INSERT OR IGNORE INTO categories (name, color, sort_order) VALUES (?,?,?)').run(name, color||'#6b7280', (maxOrder.m||0)+1);
  res.json({ id: result.lastInsertRowid });
});

app.delete('/api/categories/:id', (req, res) => {
  const cat = db.prepare('SELECT name FROM categories WHERE id=?').get(req.params.id);
  if (cat) db.prepare('UPDATE items SET category="Inbox" WHERE category=?').run(cat.name);
  db.prepare('DELETE FROM categories WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

app.listen(PORT, () => console.log(`Carly Brain running on port ${PORT}`));
