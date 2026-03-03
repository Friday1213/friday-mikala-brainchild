const express = require('express');
const path = require('path');
const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ── Auth ──────────────────────────────────────────────────────────────────────
const AUTH_PASS = '4141';
const COOKIE = '__pt';
const AUTH_LOGIN = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>VIP Provider Training Hub</title><style>*{box-sizing:border-box;margin:0;padding:0}body{min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#1e3a5f 0%,#065f46 100%);font-family:'Segoe UI',sans-serif}.card{background:white;border-radius:20px;padding:40px 36px;width:100%;max-width:380px;box-shadow:0 20px 60px rgba(0,0,0,0.3);text-align:center}.logo{font-size:36px;margin-bottom:12px}.title{font-size:20px;font-weight:900;color:#1e3a5f;margin-bottom:4px}.sub{font-size:13px;color:#64748b;margin-bottom:28px}input{width:100%;padding:12px 16px;border:2px solid #e2e8f0;border-radius:10px;font-size:16px;text-align:center;letter-spacing:4px;outline:none;margin-bottom:14px;transition:border 0.2s}input:focus{border-color:#059669}button{width:100%;padding:13px;background:linear-gradient(135deg,#065f46,#059669);color:white;border:none;border-radius:10px;font-size:15px;font-weight:800;cursor:pointer}.err{color:#dc2626;font-size:13px;margin-bottom:12px;min-height:18px}</style></head><body><div class="card"><div class="logo">🏥</div><div class="title">VIP Provider Training Hub</div><div class="sub">VIP Medical Group · Clinical Resources</div><div class="err">ERRTAG</div><form method="POST" action="/__login"><input type="password" name="p" placeholder="Enter password" autofocus /><button type="submit">Access Hub →</button></form></div></body></html>`;

function authMiddleware(req, res, next) {
  if (req.path === '/__login') return next();
  const cookies = (req.headers.cookie || '').split(';').map(c => c.trim());
  if (cookies.includes(`${COOKIE}=${AUTH_PASS}`)) return next();
  res.send(AUTH_LOGIN.replace('ERRTAG', ''));
}

app.post('/__login', (req, res) => {
  if (req.body.p === AUTH_PASS) {
    res.setHeader('Set-Cookie', `${COOKIE}=${AUTH_PASS}; Path=/; HttpOnly; Max-Age=2592000`);
    res.redirect('/');
  } else {
    res.send(AUTH_LOGIN.replace('ERRTAG', 'Incorrect password — try again.'));
  }
});

app.use(authMiddleware);
// ─────────────────────────────────────────────────────────────────────────────

app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Provider Training Hub running on port ${PORT}`));
