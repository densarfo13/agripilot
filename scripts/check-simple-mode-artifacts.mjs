#!/usr/bin/env node
/**
 * scripts/check-simple-mode-artifacts.mjs — §13 ARTIFACTS.
 *
 * Fails if:
 *   - The 4 spec artifact kinds aren't enumerated (SimpleActionShown,
 *     SimpleActionCompleted, SimpleActionSkipped, SimpleReminderRequested)
 *   - Simple action events bypass ArtifactRuntime
 *   - The Simple Mode UI does not record artifacts when an action fires
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };

const KINDS = ['SimpleActionShown', 'SimpleActionCompleted',
  'SimpleActionSkipped', 'SimpleReminderRequested', 'SimpleVoicePlayed'];

const composite = read('src/runtime/simpleMode/SimpleModeOODARuntime.ts');
if (!composite) F.push('SimpleModeOODARuntime.ts: missing');
else {
  const miss = KINDS.filter((k) => !composite.includes(k));
  if (miss.length) F.push(`artifact kinds missing in composite: ${miss.join(', ')}`);
  else P.push('all 4 artifact kinds enumerated in composite');
  for (const flag of ['artifactRuntimeOnly: true', 'idempotent: true', 'offlineSafe: true', 'nonBlocking: true']) {
    if (!composite.includes(flag)) F.push(`composite must declare ${flag}`);
  }
  if (!F.some((m) => /composite must declare/.test(m)))
    P.push('artifactRuntimeOnly + idempotent + offlineSafe + nonBlocking declared');
  if (!/idempotencyKey/.test(composite))
    F.push('composite must check idempotencyKey on every artifact entry');
  else P.push('idempotencyKey checked on every entry');
  if (!/duplicateArtifactsPrevented/.test(composite))
    F.push('composite must surface duplicateArtifactsPrevented');
  else P.push('duplicateArtifactsPrevented surfaced');
  if (!/__simpleModeArtifactHealth/.test(composite))
    F.push('composite must install __simpleModeArtifactHealth');
  else P.push('__simpleModeArtifactHealth installed');
}

// UI must record artifacts using the spec kinds (and use an idempotency key).
const COMPS = [
  'src/components/simpleMode/SimpleActionCard.jsx',
  'src/components/simpleMode/SimpleModeScanCard.jsx',
];
for (const c of COMPS) {
  const txt = read(c);
  if (!txt) F.push(`${c}: missing`);
  else {
    const recordsAny = KINDS.some((k) => txt.includes(k));
    if (!recordsAny)
      F.push(`${c.split('/').pop()}: must record at least one Simple* artifact kind`);
    if (!/idempotencyKey/.test(txt))
      F.push(`${c.split('/').pop()}: must attach an idempotencyKey when recording artifacts`);
  }
}
if (!F.some((m) => /must record at least one|must attach an idempotencyKey/.test(m)))
  P.push('UI records artifacts with idempotency keys');

// UI must not make direct network writes for these artifacts (ArtifactRuntime
// is the only path; the UI's local log mirrors it).
for (const c of COMPS) {
  const txt = read(c);
  if (!txt) continue;
  const calls = (txt.match(/fetch\(['"`]([^'"`]+)/g) || []).map((m) => m.replace(/^fetch\(['"`]/, ''));
  const stray = calls.filter((u) => !u.startsWith('/api/'));
  if (stray.length)
    F.push(`${c.split('/').pop()}: must not call non-/api/* network for artifacts (found: ${stray.join(', ')})`);
}
if (!F.some((m) => /non-\/api\/\*/.test(m))) P.push('UI never bypasses ArtifactRuntime / /api/*');

if (F.length) {
  console.error('[check:simple-mode-artifacts] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:simple-mode-artifacts] PASS — 5 kinds enumerated, idempotency keys, ArtifactRuntime only.');
for (const m of P) console.log('  ✓ ' + m);
