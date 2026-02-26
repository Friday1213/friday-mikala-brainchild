const express = require('express');
const session = require('express-session');
const db = require('./database');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// PTO Settings
app.get('/api/pto/settings', (req, res) => res.json(db.prepare('SELECT * FROM pto_settings WHERE id=1').get()));
app.put('/api/pto/settings', (req, res) => {
  const { annual_hours, hours_per_day, year, sick_hours } = req.body;
  db.prepare('UPDATE pto_settings SET annual_hours=?, hours_per_day=?, year=?, sick_hours=? WHERE id=1').run(annual_hours, hours_per_day, year, sick_hours ?? 40);
  res.json({ ok: true });
});

// PTO Entries
app.get('/api/pto', (req, res) => {
  const year = req.query.year || new Date().getFullYear();
  res.json(db.prepare(`SELECT * FROM pto_entries WHERE date LIKE ? ORDER BY date DESC`).all(`${year}%`));
});
app.post('/api/pto', (req, res) => {
  const { type, date, hours, note } = req.body;
  const result = db.prepare('INSERT INTO pto_entries (type, date, hours, note) VALUES (?,?,?,?)').run(type, date, hours, note);
  res.json({ id: result.lastInsertRowid });
});
app.put('/api/pto/:id', (req, res) => {
  const { type, date, hours, note } = req.body;
  db.prepare('UPDATE pto_entries SET type=?, date=?, hours=?, note=? WHERE id=?').run(type, date, hours, note, req.params.id);
  res.json({ ok: true });
});
app.delete('/api/pto/:id', (req, res) => {
  db.prepare('DELETE FROM pto_entries WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// Overtime
app.get('/api/overtime', (req, res) => {
  const year = req.query.year || new Date().getFullYear();
  res.json(db.prepare(`SELECT * FROM overtime WHERE date LIKE ? ORDER BY date DESC`).all(`${year}%`));
});
app.post('/api/overtime', (req, res) => {
  const { date, hours, category, note } = req.body;
  const result = db.prepare('INSERT INTO overtime (date, hours, category, note) VALUES (?,?,?,?)').run(date, hours, category || 'General', note);
  res.json({ id: result.lastInsertRowid });
});
app.put('/api/overtime/:id', (req, res) => {
  const { date, hours, category, note } = req.body;
  db.prepare('UPDATE overtime SET date=?, hours=?, category=?, note=? WHERE id=?').run(date, hours, category || 'General', note, req.params.id);
  res.json({ ok: true });
});
app.delete('/api/overtime/:id', (req, res) => {
  db.prepare('DELETE FROM overtime WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// Trips
app.get('/api/trips', (req, res) => res.json(db.prepare('SELECT * FROM trips ORDER BY start_date DESC').all()));
app.post('/api/trips', (req, res) => {
  const { destination, purpose, start_date, end_date, hotel, hotel_address, confirmation_number, flight_info, notes, status } = req.body;
  const result = db.prepare('INSERT INTO trips (destination, purpose, start_date, end_date, hotel, hotel_address, confirmation_number, flight_info, notes, status) VALUES (?,?,?,?,?,?,?,?,?,?)').run(destination, purpose, start_date, end_date, hotel, hotel_address, confirmation_number, flight_info, notes, status || 'upcoming');
  res.json({ id: result.lastInsertRowid });
});
app.put('/api/trips/:id', (req, res) => {
  const { destination, purpose, start_date, end_date, hotel, hotel_address, confirmation_number, flight_info, notes, status } = req.body;
  db.prepare('UPDATE trips SET destination=?, purpose=?, start_date=?, end_date=?, hotel=?, hotel_address=?, confirmation_number=?, flight_info=?, notes=?, status=? WHERE id=?').run(destination, purpose, start_date, end_date, hotel, hotel_address, confirmation_number, flight_info, notes, status, req.params.id);
  res.json({ ok: true });
});
app.delete('/api/trips/:id', (req, res) => {
  db.prepare('DELETE FROM trips WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

app.listen(PORT, () => console.log(`Carly Hub running on port ${PORT}`));
