const express = require('express');
const path = require('path');
const app = express();

// ── Auth ──────────────────────────────────────────────────────────────────────
const AUTH_LOGIN = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Login · Friday</title><style>*{box-sizing:border-box;margin:0;padding:0}body{background:#0f172a;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:-apple-system,sans-serif}form{background:#1e293b;border:1px solid rgba(255,255,255,.1);border-radius:18px;padding:36px 28px;width:90%;max-width:300px;text-align:center}h1{color:#f1f5f9;font-size:22px;margin-bottom:6px}p{color:#64748b;font-size:13px;margin-bottom:24px}input{width:100%;padding:13px;border-radius:10px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.07);color:#f1f5f9;font-size:18px;text-align:center;outline:none;letter-spacing:4px;margin-bottom:12px}button{width:100%;padding:12px;border-radius:10px;border:none;background:#6d28d9;color:white;font-size:15px;font-weight:700;cursor:pointer}.err{color:#f87171;font-size:12px;margin-top:10px;display:block}</style></head><body><form method="POST" action="/__login"><h1>🖤 Friday</h1><p>Enter password to continue</p><input type="password" name="p" placeholder="••••" autofocus autocomplete="current-password"><button type="submit">Enter</button>ERRTAG</form></body></html>`;
app.use(express.urlencoded({ extended: false }));
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

app.use(express.static(path.join(__dirname)));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Launchpad on ${PORT}`));
