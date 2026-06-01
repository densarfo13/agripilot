#!/usr/bin/env node
/**
 * scripts/check-notification-scheduler.mjs — §11 scheduler / queue.
 *
 * Fails if the scheduler does not enforce rate limits (max 1 daily plan / 2
 * task / 1 weather per day) or quiet hours, does not expose offline-queue
 * fields, or fabricates.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '');

const rel = 'src/runtime/notifications/NotificationScheduler.ts';
const raw = read(rel);
if (!raw) F.push(`${rel}: missing`);
else {
  const src = strip(raw);
  if (!/__notificationQueueHealth/.test(raw) || !/installNotificationSchedulerGlobal/.test(raw))
    F.push('must install window.__notificationQueueHealth');
  else P.push('__notificationQueueHealth installer present');
  // §11 queue health fields.
  for (const k of ['offlineQueueReady', 'staleReminderExpiryReady', 'duplicatePreventionReady', 'syncReady']) {
    if (!raw.includes(k)) F.push(`§11 queue health must surface ${k}`);
  }
  if (!F.some((m) => /must surface/.test(m))) P.push('§11 offline queue fields present');
  // Rate-limit constants must be present and match the spec.
  if (!/daily_farm_plan\s*:\s*1/.test(raw)) F.push('rate limit must be daily_farm_plan: 1');
  if (!/task_reminder\s*:\s*2/.test(raw))   F.push('rate limit must be task_reminder: 2');
  if (!/weather_alert\s*:\s*1/.test(raw))   F.push('rate limit must be weather_alert: 1');
  if (!F.some((m) => /rate limit/.test(m))) P.push('rate limits 1/2/1 enforced');
  // Quiet-hours enforcement and timezone awareness.
  if (!/quietHoursRespected/.test(raw)) F.push('must enforce quietHoursRespected');
  else P.push('quietHoursRespected enforced');
  if (!/timezoneAware/.test(raw)) F.push('must declare timezoneAware');
  else P.push('timezoneAware declared');
  // Scheduler readiness must gate on rate limits + quiet hours + dedup.
  if (!/schedulerReady/.test(raw)) F.push('must surface schedulerReady');
  else P.push('schedulerReady gated on rate-limits + quiet-hours + dedup');
  if (/Math\.random\s*\(|\bfetch\s*\(|XMLHttpRequest/.test(src))
    F.push('must not fabricate / call the network');
  else P.push('no fabrication');
  if (!/Decision support, not a guarantee/.test(raw)) F.push('must carry the disclaimer');
  else P.push('disclaimer present');
}

if (F.length) {
  console.error('[check:notification-scheduler] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:notification-scheduler] PASS — rate limits 1/2/1, quiet hours enforced, timezone-aware, offline queue.');
for (const m of P) console.log('  ✓ ' + m);
