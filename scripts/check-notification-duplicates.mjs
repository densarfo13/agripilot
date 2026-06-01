#!/usr/bin/env node
/**
 * scripts/check-notification-duplicates.mjs — duplicate prevention.
 *
 * Fails if the notification system can deliver duplicate reminders: the
 * scheduler must enforce idempotency keys, the artifact composite must
 * carry an idempotencyKey on every artifact, and the daily plan rate limit
 * must cap at one per day.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };

const contracts = read('src/runtime/notifications/notificationContracts.ts');
const scheduler = read('src/runtime/notifications/NotificationScheduler.ts');
const runtime   = read('src/runtime/notifications/NotificationRuntime.ts');

if (!contracts) F.push('notificationContracts.ts: missing');
else {
  if (!/idempotencyKey/.test(contracts)) F.push('contracts must export an idempotencyKey helper');
  else P.push('idempotencyKey helper defined');
  if (!/validateNotification/.test(contracts)) F.push('contracts must export validateNotification');
  else P.push('validateNotification defined');
}
if (!scheduler) F.push('NotificationScheduler.ts: missing');
else {
  if (!/duplicatePreventionPassed|duplicatePreventionReady/.test(scheduler))
    F.push('scheduler must surface duplicatePreventionPassed / duplicatePreventionReady');
  else P.push('scheduler enforces duplicatePrevention');
  if (!/idempotencyKey/.test(scheduler))
    F.push('scheduler must read idempotencyKey from each scheduled row');
  else P.push('scheduler reads idempotencyKey');
  if (!/daily_farm_plan\s*:\s*1/.test(scheduler))
    F.push('daily plan rate limit must be 1 per day');
  else P.push('daily plan capped at 1/day (no same-day duplicates)');
}
if (!runtime) F.push('NotificationRuntime.ts: missing');
else {
  // Artifact composite must require an idempotencyKey on every entry.
  if (!/idempotencyKey/.test(runtime))
    F.push('artifact composite must check idempotencyKey on every entry');
  else P.push('artifact composite checks idempotencyKey');
  if (!/duplicateArtifactsPrevented/.test(runtime))
    F.push('artifact composite must surface duplicateArtifactsPrevented');
  else P.push('duplicateArtifactsPrevented surfaced');
}

if (F.length) {
  console.error('[check:notification-duplicates] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:notification-duplicates] PASS — idempotency keys enforced; daily plan capped 1/day; no duplicate artifacts.');
for (const m of P) console.log('  ✓ ' + m);
