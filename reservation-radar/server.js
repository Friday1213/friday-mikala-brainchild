const express = require('express');
const db = require('./database');
const path = require('path');

const app = express();
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
