const express = require('express');
const session = require('express-session');
const db = require('./database');
const path = require('path');
const fs = require('fs');
const { google } = require('googleapis');
const { parse } = require('csv-parse/sync');

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

// Books - Goodreads CSV
let booksCache = null;
app.get('/api/books', (req, res) => {
  if (booksCache) return res.json(booksCache);
  try {
    const csvPath = path.join(__dirname, 'goodreads.csv');
    const content = fs.readFileSync(csvPath, 'utf8');
    const records = parse(content, { columns: true, skip_empty_lines: true, relax_column_count: true });
    const cleanIsbn = (raw) => {
      if (!raw) return '';
      // CSV-parsed value may be: ="0593873440" or =""0593873440"" after outer quote removal
      return raw.replace(/^=?"*/, '').replace(/"*$/, '').trim();
    };
    const books = records.map(r => ({
      id: r['Book Id'],
      title: r['Title'],
      author: r['Author'],
      isbn: cleanIsbn(r['ISBN']),
      isbn13: cleanIsbn(r['ISBN13']),
      my_rating: parseInt(r['My Rating']) || 0,
      avg_rating: parseFloat(r['Average Rating']) || 0,
      shelf: r['Exclusive Shelf'],
      date_read: r['Date Read'],
      date_added: r['Date Added'],
      pages: parseInt(r['Number of Pages']) || 0,
      year_published: r['Year Published'],
      binding: r['Binding'],
      bookshelves: r['Bookshelves'],
      publisher: r['Publisher'],
    }));
    booksCache = books;
    res.json(books);
  } catch (e) {
    console.error('Books error:', e.message);
    res.status(500).json({ error: e.message });
  }
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
