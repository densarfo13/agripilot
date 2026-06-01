#!/usr/bin/env node
/**
 * scripts/check-notification-ooda-artifacts.mjs — §12 OODA + artifacts.
 *
 * Fails if:
 *   - OODA composite is missing or blocks app UI;
 *   - artifact composite doesn't enumerate the 5 spec artifact kinds
 *     (NotificationScheduled / Sent / Failed / Skipped / Clicked);
 *   - artifact composite doesn't declare artifactRuntimeOnly + idempotent +
 *     offlineSafe + nonBlocking.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };

const KINDS = ['NotificationScheduled', 'NotificationSent', 'NotificationFailed',
  'NotificationSkipped', 'NotificationClicked'];

const rel = 'src/runtime/notifications/NotificationRuntime.ts';
const raw = read(rel);
if (!raw) F.push(`${rel}: missing`);
else {
  // OODA probe.
  if (!/__notificationOODAHealth/.test(raw)) F.push('must install __notificationOODAHealth');
  else P.push('__notificationOODAHealth installed');
  for (const k of ['observeReady', 'orientReady', 'decideReady', 'actReady']) {
    if (!raw.includes(k)) F.push(`OODA must surface ${k}`);
  }
  if (!F.some((m) => /OODA must surface/.test(m))) P.push('OODA observe/orient/decide/act present');
  if (!/nonBlocking:\s*true/.test(raw)) F.push('OODA must be nonBlocking:true');
  else P.push('OODA non-blocking');
  if (!/growerSafe:\s*true/.test(raw)) F.push('OODA must declare growerSafe:true (never blocks app UI)');
  else P.push('growerSafe declared');
  // Artifact probe.
  if (!/__notificationArtifactHealth/.test(raw)) F.push('must install __notificationArtifactHealth');
  else P.push('__notificationArtifactHealth installed');
  const missingKinds = KINDS.filter((k) => !raw.includes(k));
  if (missingKinds.length)
    F.push(`artifact kinds missing: ${missingKinds.join(', ')}`);
  else P.push('all 5 artifact kinds enumerated');
  for (const k of ['artifactRuntimeOnly', 'idempotent', 'offlineSafe', 'duplicateArtifactsPrevented']) {
    if (!raw.includes(k)) F.push(`artifact composite must surface ${k}`);
  }
  if (!F.some((m) => /artifact composite must surface/.test(m)))
    P.push('artifactRuntimeOnly + idempotent + offlineSafe + dedup declared');
  // Artifacts must NEVER call the network directly (they go through ArtifactRuntime).
  if (/\bfetch\s*\(|XMLHttpRequest/.test(raw.replace(/\/\*[\s\S]*?\*\//g, '')))
    F.push('artifact composite must not bypass ArtifactRuntime / call the network');
  else P.push('no direct network — ArtifactRuntime only');
}

if (F.length) {
  console.error('[check:notification-ooda-artifacts] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:notification-ooda-artifacts] PASS — OODA non-blocking, 5 artifact kinds, idempotent, offline-safe.');
for (const m of P) console.log('  ✓ ' + m);
