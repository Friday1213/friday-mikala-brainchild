#!/usr/bin/env node
// Weekly Monday summary email for Carly
// Pulls from FridayBrain, Carly Hub, Carly Brain

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const nodemailer = require('nodemailer');

const FRIDAYBRAIN   = 'https://fridaybrain.onrender.com';
const CARLY_HUB     = 'https://travel-8gnr.onrender.com';
const CARLY_BRAIN   = 'https://carly-brain.onrender.com';
const INTERNAL_TOKEN = process.env.INTERNAL_TOKEN || 'friday-internal';

async function fetchJson(url) {
  const r = await fetch(url);
  return r.json();
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' });
}

function daysSince(dateStr) {
  if (!dateStr) return 999;
  return Math.floor((Date.now() - new Date(dateStr)) / 86400000);
}

function section(emoji, title, html) {
  return `
    <div style="margin-bottom:28px;">
      <div style="font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;color:#a78bfa;margin-bottom:12px;">${emoji} ${title}</div>
      ${html}
    </div>`;
}

function providerRow(p, detail = '') {
  return `<div style="padding:10px 14px;background:#faf7ff;border-radius:10px;border-left:3px solid #a78bfa;margin-bottom:6px;font-size:14px;color:#2d2244;">
    <strong>${p.name}</strong>${p.expected_first_day ? ` <span style="color:#a78bfa;font-size:12px;">· ${fmtDate(p.expected_first_day)}</span>` : ''}
    ${detail ? `<div style="font-size:12px;color:#7c5fa0;margin-top:3px;">${detail}</div>` : ''}
  </div>`;
}

function emptyRow(msg) {
  return `<div style="font-size:13px;color:#c4b5e8;font-style:italic;padding:8px 0;">${msg}</div>`;
}

async function buildEmail() {
  const year = new Date().getFullYear();
  const [brain, overtime, ptoSettings, ptoDays] = await Promise.all([
    fetchJson(`${FRIDAYBRAIN}/api/internal/summary?token=${INTERNAL_TOKEN}`),
    fetchJson(`${CARLY_HUB}/api/overtime`),
    fetchJson(`${CARLY_HUB}/api/pto/settings`),
    fetchJson(`${CARLY_HUB}/api/pto?year=${year}`),
  ]);

  // Carly Brain stalled items
  const brainItems = await fetchJson(`${CARLY_BRAIN}/api/items`);
  const stalledBrain = brainItems.filter(i => {
    if (i.status === 'Done') return false;
    return daysSince(i.updated_at) >= 5;
  }).slice(0, 6);

  // OT last week
  const oneWeekAgo = new Date(); oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const recentOT = overtime.filter(o => new Date(o.date) >= oneWeekAgo);
  const otLastWeek = recentOT.reduce((s, o) => s + o.hours, 0);
  const otByCategory = {};
  recentOT.forEach(o => { otByCategory[o.category] = (otByCategory[o.category] || 0) + o.hours; });

  // OT total YTD
  const thisYear = new Date().getFullYear();
  const otYTD = overtime.filter(o => o.date?.startsWith(thisYear)).reduce((s,o) => s+o.hours, 0);

  // PTO
  const settings = Array.isArray(ptoSettings) ? ptoSettings[0] : ptoSettings;
  const ptoUsed = Array.isArray(ptoDays) ? ptoDays.filter(d => d.type === 'PTO').reduce((s,d) => s + d.hours, 0) : 0;
  const ptoTotal = settings?.annual_hours || 160;
  const ptoRemaining = ptoTotal - ptoUsed;

  // Upcoming holidays (hardcoded 2026)
  const HOLIDAYS = [
    { label: 'Memorial Day',       date: '2026-05-25' },
    { label: 'July 3rd (Company)', date: '2026-07-03' },
    { label: 'Labor Day',          date: '2026-09-07' },
    { label: 'Thanksgiving Eve ½', date: '2026-11-25' },
    { label: 'Thanksgiving',       date: '2026-11-26' },
    { label: 'Black Friday',       date: '2026-11-27' },
    { label: 'Christmas Eve',      date: '2026-12-24' },
    { label: 'Christmas Day',      date: '2026-12-25' },
    { label: "New Year's Eve",     date: '2026-12-31' },
  ];
  const today = new Date(); today.setHours(0,0,0,0);
  const twoWeeks = new Date(today); twoWeeks.setDate(today.getDate() + 14);
  const upcomingHolidays = HOLIDAYS.filter(h => {
    const d = new Date(h.date + 'T00:00:00');
    return d >= today && d <= twoWeeks;
  });

  // Build HTML
  let html = `
  <div style="font-family:'Nunito',Arial,sans-serif;max-width:620px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(100,60,180,0.08);">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#a78bfa,#818cf8);padding:28px 32px;">
      <div style="font-size:22px;font-weight:900;color:white;letter-spacing:-0.5px;">🖤 Weekly Summary</div>
      <div style="font-size:13px;color:rgba(255,255,255,0.8);margin-top:4px;">${new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'})}</div>
    </div>

    <!-- Body -->
    <div style="padding:28px 32px;">
  `;

  // Providers starting this week
  html += section('🎉', 'Starting This Week',
    brain.startingThisWeek?.length
      ? brain.startingThisWeek.map(p => providerRow(p, 'First day this week!')).join('')
      : emptyRow('No providers starting this week.')
  );

  // Providers starting next week
  html += section('📅', 'Starting Next Week',
    brain.startingNextWeek?.length
      ? brain.startingNextWeek.map(p => providerRow(p, 'Coming up next week — time to prep!')).join('')
      : emptyRow('No providers starting next week.')
  );

  // Behind on tasks
  html += section('📋', 'Furthest Behind on Onboarding',
    brain.behindOnTasks?.length
      ? brain.behindOnTasks.map(p => providerRow(p, `${p.taskDone}/${p.taskTotal} tasks · ${p.pct}% complete`)).join('')
      : emptyRow('Everyone is on track!')
  );

  // No activity
  html += section('📦', 'No Recent Activity (7+ Days)',
    brain.noActivity?.length
      ? brain.noActivity.map(p => providerRow(p, 'No task updates in over a week')).join('')
      : emptyRow('All providers have recent activity.')
  );

  // Flagged
  html += section('🚩', 'Flagged Providers',
    brain.flagged?.length
      ? brain.flagged.map(p => providerRow(p)).join('')
      : emptyRow('No flagged providers.')
  );

  // Stalled brain items
  html += section('🧩', 'Stalled Carly Brain Items (5+ Days)',
    stalledBrain.length
      ? stalledBrain.map(i => `
        <div style="padding:10px 14px;background:#faf7ff;border-radius:10px;border-left:3px solid #f472b6;margin-bottom:6px;font-size:14px;color:#2d2244;">
          <strong>${i.text}</strong>
          <div style="font-size:12px;color:#7c5fa0;margin-top:3px;">${i.category} · ${i.status} · last updated ${daysSince(i.updated_at)}d ago</div>
        </div>`).join('')
      : emptyRow('No stalled items — you\'re on top of it!')
  );

  // OT + PTO stats
  html += section('⏱', 'Your Time This Week', `
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
      <div style="background:#faf7ff;border-radius:10px;padding:14px;text-align:center;">
        <div style="font-size:26px;font-weight:900;color:#a78bfa;">${otLastWeek}h</div>
        <div style="font-size:11px;color:#b0a0cc;text-transform:uppercase;letter-spacing:0.5px;margin-top:4px;">OT Last Week</div>
      </div>
      <div style="background:#faf7ff;border-radius:10px;padding:14px;text-align:center;">
        <div style="font-size:26px;font-weight:900;color:#818cf8;">${otYTD}h</div>
        <div style="font-size:11px;color:#b0a0cc;text-transform:uppercase;letter-spacing:0.5px;margin-top:4px;">OT YTD</div>
      </div>
      <div style="background:#faf7ff;border-radius:10px;padding:14px;text-align:center;">
        <div style="font-size:26px;font-weight:900;color:#34d399;">${ptoRemaining}h</div>
        <div style="font-size:11px;color:#b0a0cc;text-transform:uppercase;letter-spacing:0.5px;margin-top:4px;">PTO Remaining</div>
      </div>
    </div>
    ${Object.keys(otByCategory).length ? `
    <div style="margin-top:10px;font-size:12px;color:#7c5fa0;">
      ${Object.entries(otByCategory).map(([cat,h]) => `<span style="margin-right:12px;">· ${cat}: ${h}h</span>`).join('')}
    </div>` : ''}
  `);

  // Upcoming holidays
  if (upcomingHolidays.length) {
    html += section('🎉', 'Upcoming Holidays (Next 2 Weeks)',
      upcomingHolidays.map(h => `
        <div style="padding:8px 14px;background:#faf7ff;border-radius:10px;border-left:3px solid #34d399;margin-bottom:6px;font-size:14px;color:#2d2244;">
          <strong>${h.label}</strong> <span style="color:#a78bfa;font-size:12px;">· ${fmtDate(h.date)}</span>
        </div>`).join('')
    );
  }

  html += `
      <div style="margin-top:24px;padding-top:20px;border-top:1px solid rgba(167,139,250,0.15);font-size:12px;color:#c4b5e8;text-align:center;">
        Built with 🖤 by Friday · <a href="https://friday-launchpad.onrender.com" style="color:#a78bfa;">Open Launchpad</a>
      </div>
    </div>
  </div>`;

  return html;
}

async function send() {
  console.log('Building weekly summary...');
  const html = await buildEmail();

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD }
  });

  await transporter.sendMail({
    from: `"Friday 🖤" <${process.env.GMAIL_USER}>`,
    to: 'carly.sarch@vipmedicalgroup.com',
    subject: `✦ Weekly Summary — ${new Date().toLocaleDateString('en-US',{month:'short',day:'numeric'})}`,
    html
  });

  console.log('✅ Weekly summary sent!');
}

send().catch(e => { console.error('❌', e.message); process.exit(1); });
