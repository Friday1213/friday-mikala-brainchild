#!/usr/bin/env node
/**
 * policy-check.js
 * Monthly policy change detector for Vein Policy Hub.
 * Fetches each payer's source_url, hashes the content,
 * compares to last known hash. Sends WhatsApp alert if changed.
 *
 * Called by cron: POST https://vein-policy-hub.onrender.com/api/policy-check
 */

const https = require('https');
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// ── Config ────────────────────────────────────────────────────────────────────
// Load .env manually (dotenvx workaround)
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  });
}

const HUB_URL = process.env.VEIN_HUB_URL || 'https://vein-policy-hub.onrender.com';
const OPENCLAW_WA_URL = process.env.OPENCLAW_WA_URL || 'http://localhost:3000';
const BRAVE_API_KEY = process.env.BRAVE_API_KEY || '';

function fetch(url, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 VeinPolicyBot/1.0' } }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error('timeout')); });
    req.on('error', reject);
  });
}

function hash(text) {
  // Hash only the first 50KB to avoid noise from dynamic page elements
  return crypto.createHash('md5').update(text.slice(0, 50000)).digest('hex');
}

async function apiGet(path) {
  const res = await fetch(`${HUB_URL}${path}`);
  return JSON.parse(res.body);
}

async function apiPost(path, data) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const url = new URL(`${HUB_URL}${path}`);
    const mod = url.protocol === 'https:' ? https : http;
    const req = mod.request({
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function braveSearch(query) {
  if (!BRAVE_API_KEY) return null;
  return new Promise((resolve) => {
    const q = encodeURIComponent(query);
    const req = https.get(`https://api.search.brave.com/res/v1/web/search?q=${q}&count=3`, {
      headers: { 'Accept': 'application/json', 'X-Subscription-Token': BRAVE_API_KEY }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json.web?.results || []);
        } catch(e) { resolve([]); }
      });
    });
    req.on('error', () => resolve([]));
    req.setTimeout(10000, () => { req.destroy(); resolve([]); });
  });
}

async function findPolicyUrl(payerName, state) {
  // Build a targeted search query
  const query = `"${payerName}" varicose vein treatment medical policy provider site:${
    payerName.toLowerCase().includes('medicare') ? 'cms.gov OR novitas-solutions.com OR cgsmedicare.com OR palmettogba.com OR ngsmedicare.com' :
    payerName.toLowerCase().includes('aetna') ? 'aetna.com' :
    payerName.toLowerCase().includes('cigna') ? 'cigna.com' :
    payerName.toLowerCase().includes('united') || payerName.toLowerCase().includes('uhc') ? 'uhcprovider.com' :
    payerName.toLowerCase().includes('humana') ? 'humana.com' :
    'provider policy'
  } 2024 OR 2025`;

  console.log(`  🔍 Searching for updated URL: ${payerName}`);
  const results = await braveSearch(`${payerName} varicose vein treatment medical necessity policy provider 2025`);

  // Filter to likely policy pages
  const policyKeywords = ['policy', 'medical-policy', 'clinical', 'necessity', 'coverage', 'lcd', 'varicose'];
  for (const r of results) {
    const url = r.url || '';
    const title = (r.title || '').toLowerCase();
    const desc = (r.description || '').toLowerCase();
    if (policyKeywords.some(k => url.toLowerCase().includes(k) || title.includes(k) || desc.includes(k))) {
      return { url: r.url, title: r.title };
    }
  }
  // Return first result as fallback
  return results[0] ? { url: results[0].url, title: results[0].title } : null;
}

async function main() {
  console.log(`[policy-check] Starting at ${new Date().toISOString()}`);

  // Get all payers with a source_url
  const payers = await apiGet('/api/payers?limit=200');
  const withUrls = payers.filter(p => p.source_url && p.source_url.startsWith('http'));
  console.log(`[policy-check] ${payers.length} total payers, ${withUrls.length} have URLs to check`);

  if (withUrls.length === 0) {
    console.log('[policy-check] No URLs to check. Done.');
    return;
  }

  // Get stored hashes
  let stored = {};
  try {
    const res = await apiGet('/api/policy-hashes');
    stored = res || {};
  } catch(e) {
    console.log('[policy-check] No stored hashes yet (first run)');
  }

  const changed = [];
  const errors = [];
  const newHashes = { ...stored };

  for (const payer of withUrls) {
    try {
      console.log(`  Checking: ${payer.name} (${payer.state}) → ${payer.source_url}`);
      const res = await fetch(payer.source_url, 12000);

      if (res.status >= 400) {
        errors.push({ name: payer.name, state: payer.state, error: `HTTP ${res.status}` });
        continue;
      }

      const h = hash(res.body);
      const key = `${payer.id}`;
      const prev = stored[key];

      newHashes[key] = { hash: h, url: payer.source_url, checked: new Date().toISOString() };

      if (prev && prev.hash && prev.hash !== h) {
        console.log(`  ⚠️  CHANGED: ${payer.name}`);
        changed.push({ id: payer.id, name: payer.name, state: payer.state, url: payer.source_url });

        // Flag the payer as needing review
        await apiPost(`/api/payers/${payer.id}/flag-review`, {
          reason: `Policy page content changed (detected ${new Date().toLocaleDateString()})`
        });
      } else if (!prev) {
        console.log(`  ✓  Baseline saved: ${payer.name}`);
      } else {
        console.log(`  ✓  No change: ${payer.name}`);
      }

      // Small delay to be polite
      await new Promise(r => setTimeout(r, 1500));

    } catch(e) {
      console.log(`  ❌ Error checking ${payer.name}: ${e.message}`);

      // Try to find a working URL via Brave search
      if (BRAVE_API_KEY) {
        const found = await findPolicyUrl(payer.name, payer.state);
        if (found && found.url && found.url !== payer.source_url) {
          console.log(`  🔍 Found possible replacement: ${found.url}`);
          errors.push({ name: payer.name, state: payer.state, error: e.message, suggested_url: found.url, suggested_title: found.title });
          // Auto-update the URL in the hub
          try {
            const updatePayload = JSON.stringify({ ...payer, source_url: found.url, source_url_note: `URL auto-updated ${new Date().toLocaleDateString()} (previous failed: ${e.message})` });
            const urlObj = new URL(`${HUB_URL}/api/payers/${payer.id}`);
            await new Promise((res, rej) => {
              const mod = urlObj.protocol === 'https:' ? https : http;
              const req = mod.request({ hostname: urlObj.hostname, port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80), path: urlObj.pathname, method: 'PUT', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(updatePayload) } }, r => { r.on('data',()=>{}); r.on('end', res); });
              req.on('error', rej); req.write(updatePayload); req.end();
            });
            console.log(`  ✅ URL auto-updated in hub`);
          } catch(ue) { console.log(`  ⚠️ Could not auto-update: ${ue.message}`); }
        } else {
          errors.push({ name: payer.name, state: payer.state, error: e.message });
        }
      } else {
        errors.push({ name: payer.name, state: payer.state, error: e.message });
      }
    }
  }

  // Save updated hashes
  await apiPost('/api/policy-hashes', newHashes);

  // Build WhatsApp message
  const checkedCount = withUrls.length - errors.length;
  let msg = `🩸 *Vein Policy Hub — Monthly Check*\n📅 ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}\n\n`;
  msg += `✅ Checked ${checkedCount} policy URLs\n`;

  if (changed.length > 0) {
    msg += `\n⚠️ *${changed.length} polic${changed.length === 1 ? 'y' : 'ies'} may have changed:*\n`;
    changed.forEach(p => {
      msg += `• ${p.name} (${p.state})\n  ${p.url}\n`;
    });
    msg += `\nThese have been flagged in the hub for review → ${HUB_URL}`;
  } else {
    msg += `\n✅ No changes detected — all policies look stable.`;
  }

  const autoFixed = errors.filter(e => e.suggested_url);
  const stillBroken = errors.filter(e => !e.suggested_url);

  if (autoFixed.length > 0) {
    msg += `\n\n🔍 *${autoFixed.length} broken URL${autoFixed.length > 1 ? 's' : ''} auto-fixed via search:*\n`;
    autoFixed.forEach(e => msg += `• ${e.name} → ${e.suggested_url}\n`);
  }
  if (stillBroken.length > 0) {
    msg += `\n\n⚠️ ${stillBroken.length} URL${stillBroken.length > 1 ? 's' : ''} couldn't be reached or found (login-required or rare plan).`;
  }

  // Send WhatsApp via OpenClaw
  try {
    const waPayload = JSON.stringify({ message: msg, target: '+19145652958', channel: 'whatsapp' });
    await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: 'localhost', port: 3000,
        path: '/api/message/send', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(waPayload) }
      }, res => { res.on('data', () => {}); res.on('end', resolve); });
      req.on('error', reject);
      req.write(waPayload);
      req.end();
    });
    console.log('[policy-check] WhatsApp alert sent');
  } catch(e) {
    console.log('[policy-check] WhatsApp send failed (ok if running on Render):', e.message);
  }

  console.log(`[policy-check] Done. Changed: ${changed.length}, Errors: ${errors.length}`);

  // Output summary for cron logging
  if (changed.length > 0) {
    console.log('CHANGED POLICIES:');
    changed.forEach(p => console.log(`  - ${p.name} (${p.state})`));
  }
}

main().catch(e => { console.error('[policy-check] Fatal:', e); process.exit(1); });
