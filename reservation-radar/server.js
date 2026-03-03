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

// ── Restaurants ──────────────────────────────────────────────────────────────
app.get('/api/restaurants', (req, res) => {
  const rows = db.prepare('SELECT * FROM restaurants WHERE archived=0 ORDER BY hot_level DESC, name ASC').all();
  res.json(rows);
});

app.post('/api/restaurants', (req, res) => {
  const { name, neighborhood, cuisine, platform, booking_url, days_advance, advance_notes, gluten_free, gf_notes, my_notes, price_range, hot_level } = req.body;
  const r = db.prepare(`INSERT INTO restaurants (name,neighborhood,cuisine,platform,booking_url,days_advance,advance_notes,gluten_free,gf_notes,my_notes,price_range,hot_level) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(name,neighborhood,cuisine,platform,booking_url||null,days_advance||null,advance_notes||null,gluten_free?1:0,gf_notes||null,my_notes||null,price_range||null,hot_level||2);
  res.json({ id: r.lastInsertRowid });
});

app.put('/api/restaurants/:id', (req, res) => {
  const { name, neighborhood, cuisine, platform, booking_url, days_advance, advance_notes, gluten_free, gf_notes, my_notes, price_range, hot_level } = req.body;
  db.prepare(`UPDATE restaurants SET name=?,neighborhood=?,cuisine=?,platform=?,booking_url=?,days_advance=?,advance_notes=?,gluten_free=?,gf_notes=?,my_notes=?,price_range=?,hot_level=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(name,neighborhood,cuisine,platform,booking_url||null,days_advance||null,advance_notes||null,gluten_free?1:0,gf_notes||null,my_notes||null,price_range||null,hot_level||2,req.params.id);
  res.json({ ok: true });
});

app.put('/api/restaurants/:id/archive', (req, res) => {
  db.prepare('UPDATE restaurants SET archived=? WHERE id=?').run(req.body.archived?1:0, req.params.id);
  res.json({ ok: true });
});

// ── Watchlist ─────────────────────────────────────────────────────────────────
app.get('/api/watchlist', (req, res) => {
  const rows = db.prepare(`
    SELECT w.*, r.name, r.neighborhood, r.platform, r.booking_url, r.days_advance, r.advance_notes, r.gluten_free, r.price_range
    FROM watchlist w JOIN restaurants r ON w.restaurant_id = r.id
    WHERE w.status != 'got_it' OR date(w.target_date) >= date('now', '-7 days')
    ORDER BY w.target_date ASC
  `).all();
  res.json(rows);
});

app.post('/api/watchlist', (req, res) => {
  const { restaurant_id, target_date, party_size, notes } = req.body;
  const r = db.prepare('INSERT INTO watchlist (restaurant_id, target_date, party_size, notes) VALUES (?,?,?,?)').run(restaurant_id, target_date, party_size||2, notes||null);
  res.json({ id: r.lastInsertRowid });
});

app.put('/api/watchlist/:id', (req, res) => {
  const { target_date, party_size, notes, status } = req.body;
  db.prepare('UPDATE watchlist SET target_date=?, party_size=?, notes=?, status=? WHERE id=?').run(target_date, party_size, notes, status, req.params.id);
  res.json({ ok: true });
});

app.delete('/api/watchlist/:id', (req, res) => {
  db.prepare('DELETE FROM watchlist WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ── Summary for alerts ────────────────────────────────────────────────────────
app.get('/api/alert-check', (req, res) => {
  const today = new Date(); today.setHours(0,0,0,0);
  const rows = db.prepare(`
    SELECT w.*, r.name, r.days_advance, r.advance_notes, r.platform, r.booking_url
    FROM watchlist w JOIN restaurants r ON w.restaurant_id = r.id
    WHERE w.status = 'watching'
  `).all();

  const alerts = rows.filter(w => {
    if (!w.days_advance || !w.target_date) return false;
    const target = new Date(w.target_date + 'T00:00:00');
    const bookDay = new Date(target);
    bookDay.setDate(bookDay.getDate() - w.days_advance);
    bookDay.setHours(0,0,0,0);
    const diff = Math.floor((bookDay - today) / 86400000);
    return diff >= 0 && diff <= 2; // alert today + 2 days ahead
  }).map(w => {
    const target = new Date(w.target_date + 'T00:00:00');
    const bookDay = new Date(target);
    bookDay.setDate(bookDay.getDate() - w.days_advance);
    bookDay.setHours(0,0,0,0);
    const diff = Math.floor((bookDay - today) / 86400000);
    return { ...w, book_day: bookDay.toISOString().split('T')[0], days_until_book: diff };
  });

  res.json(alerts);
});

app.listen(PORT, () => console.log(`Reservation Radar on port ${PORT}`));
