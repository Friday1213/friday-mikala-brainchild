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
      errors.push({ name: payer.name, state: payer.state, error: e.message });
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

  if (errors.length > 0) {
    msg += `\n\n⚠️ ${errors.length} URL${errors.length > 1 ? 's' : ''} couldn't be checked (login required or site down).`;
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
