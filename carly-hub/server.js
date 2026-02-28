const express = require('express');
const session = require('express-session');
const db = require('./database');
const path = require('path');
const { google } = require('googleapis');

const SPREADSHEET_ID = '119RAKc6-RWEpbvlyXAMkR9rWJRRqXvG7368JT08Tfkw';
const SHEET_YEARS = ['2026', '2025', '2024', '2023', '2022'];

async function getConcertData() {
  const auth = new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, 'google-service-account.json'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
  });
  const sheets = google.sheets({ version: 'v4', auth });
  const results = {};
  for (const year of SHEET_YEARS) {
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: year });
    const rows = res.data.values || [];
    const concerts = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || !r[0] || !r[1]) continue;
      const date = r[0] || '';
      const band = r[1] || '';
      const location = r[2] || '';
      const price = r[3] || '';
      const bought = r[4] || '';
      const notes = r[5] || '';
      // skip totals/consideration rows
      if (band.toLowerCase().includes('total') || date.toUpperCase() === date && date.length > 8) continue;
      if (!date.match(/\d/) && !band.match(/[A-Za-z]/)) continue;
      concerts.push({ date, band, location, price, bought, notes });
    }
    results[year] = concerts;
  }
  return results;
}

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

// Concerts - Google Sheets
app.get('/api/concerts', async (req, res) => {
  try {
    const data = await getConcertData();
    res.json(data);
  } catch (e) {
    console.error('Concerts error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => console.log(`Carly Hub running on port ${PORT}`));
