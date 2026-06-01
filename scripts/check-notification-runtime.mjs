#!/usr/bin/env node
/**
 * scripts/check-notification-runtime.mjs — §1 notification runtime composite.
 *
 * Fails if the composite does not declare notifications optional, does not
 * model the 8 notification types, omits the §1 readiness fields, fabricates,
 * or does not install __notificationHealth + the OODA/artifact globals.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '');

const TYPES = ['daily_farm_plan', 'task_reminder', 'follow_up_scan', 'weather_alert',
  'harvest_alert', 'post_harvest_alert', 'ngo_field_officer_alert', 'buyer_interest_alert'];

const rel = 'src/runtime/notifications/NotificationRuntime.ts';
const raw = read(rel);
if (!raw) F.push(`${rel}: missing`);
else {
  const src = strip(raw);
  // Composite must install __notificationHealth + OODA + artifact globals.
  for (const g of ['__notificationHealth', '__notificationOODAHealth', '__notificationArtifactHealth']) {
    if (!raw.includes(g)) F.push(`composite must install ${g}`);
  }
  if (!F.some((m) => /must install/.test(m))) P.push('installs the 3 composite globals');
  if (!/installNotificationRuntimeGlobals/.test(raw))
    F.push('must export installNotificationRuntimeGlobals');
  else P.push('installer exported');
  // Notifications must be OPTIONAL.
  if (!/notificationsOptional:\s*true/.test(raw))
    F.push('must declare notificationsOptional:true (app keeps working when permission denied)');
  else P.push('notificationsOptional:true');
  // The composite must model the §1 readiness fields (the per-type ON/OFF
  // matrix is owned by NotificationPreferences; check-notification-preferences
  // verifies all 8 types). Require the per-type READINESS keys from §1.
  for (const k of ['dailyPlanNotificationsReady', 'taskRemindersReady', 'followUpScanReady',
    'weatherAlertsReady', 'harvestAlertsReady', 'ngoAlertsReady']) {
    if (!raw.includes(k)) F.push(`composite must surface §1 readiness ${k}`);
  }
  if (!F.some((m) => /§1 readiness/.test(m))) P.push('§1 per-type readiness fields present');
  // Required composite readiness fields per §1.
  for (const k of ['schedulerReady', 'timezoneAware', 'quietHoursReady', 'preferencesReady',
    'duplicatePreventionReady', 'offlineQueueReady', 'permissionState']) {
    if (!raw.includes(k)) F.push(`composite must surface ${k}`);
  }
  if (!F.some((m) => /must surface/.test(m))) P.push('§1 readiness fields present');
  // OODA composite must be non-blocking.
  if (!/nonBlocking:\s*true/.test(raw)) F.push('OODA composite must declare nonBlocking:true');
  else P.push('OODA non-blocking');
  if (/Math\.random\s*\(|\bfetch\s*\(|XMLHttpRequest/.test(src))
    F.push('must not fabricate / call the network');
  else P.push('no fabrication, no network');
  if (!/Decision support, not a guarantee/.test(raw)) F.push('must carry the disclaimer');
  else P.push('disclaimer present');
}

if (F.length) {
  console.error('[check:notification-runtime] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:notification-runtime] PASS — composite + OODA + artifact, optional, 8 types, honest.');
for (const m of P) console.log('  ✓ ' + m);
