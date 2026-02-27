#!/usr/bin/env node
// Reservation Radar alert checker
// Runs at midnight and 10am EST — sends WhatsApp alerts for booking windows

const fs = require('fs');
const envPath = require('path').join(__dirname, '../.env');
fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
});

const RADAR_URL = process.env.RADAR_URL || 'https://reservation-radar.onrender.com';

async function check() {
  const r = await fetch(`${RADAR_URL}/api/alert-check`);
  if (!r.ok) throw new Error(`Radar API returned ${r.status}`);
  return r.json();
}

async function main() {
  const alerts = await check();

  if (alerts.length === 0) {
    console.log('No reservation alerts today.');
    return;
  }

  const lines = alerts.map(a => {
    const urgency = a.days_until_book === 0 ? '🚨 BOOK TODAY' : '⚡ Book Tomorrow';
    const target = new Date(a.target_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    return `${urgency}: *${a.name}*\nTarget: ${target} · Party of ${a.party_size}${a.booking_url ? `\n🔗 ${a.booking_url}` : ''}`;
  });

  const msg = `📡 *Reservation Radar*\n\n${lines.join('\n\n')}`;
  console.log('ALERT:', msg);

  // Output for OpenClaw to deliver via WhatsApp
  process.stdout.write('\n__WHATSAPP_ALERT__\n' + msg + '\n__END__\n');
}

main().catch(e => { console.error('Radar check failed:', e.message); process.exit(1); });
