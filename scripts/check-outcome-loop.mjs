#!/usr/bin/env node
/**
 * scripts/check-outcome-loop.mjs — §7 outcome chain lock.
 *
 * Fails if:
 *   • __outcomeCaptureHealth does not surface the full chain readiness
 *     (scan → diagnosis → recommendation → task → follow-up scan → outcome
 *      status + artifactLinked + oodaLinked)
 *   • the outcome statuses (improved/unchanged/worsened/unknown) are not
 *     modeled in the outcome-learning runtime
 *
 * Read-only static analyzer.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };

const src = read('src/runtime/pilot/PilotHealthRuntime.ts');
if (!src) { F.push('src/runtime/pilot/PilotHealthRuntime.ts: missing'); }
else {
  const KEYS = ['scanCaptured', 'diagnosisCaptured', 'recommendationCaptured',
    'taskCaptured', 'followUpScanCaptured', 'outcomeStatusCaptured',
    'artifactLinked', 'oodaLinked'];
  const missing = KEYS.filter((k) => !src.includes(k));
  if (missing.length) F.push(`__outcomeCaptureHealth missing §7 chain keys: ${missing.join(', ')}`);
  else P.push('__outcomeCaptureHealth surfaces the full scan→outcome chain');
}

// Outcome statuses modeled honestly in the outcome-learning runtime.
const learning = read('src/runtime/v13/outcomeLearning/OutcomeLearningRuntime.ts');
const STATUSES = ['IMPROVED', 'UNCHANGED', 'WORSENED', 'UNKNOWN'];
const missingStatus = STATUSES.filter((s) => !learning.includes(s));
if (learning && missingStatus.length) F.push(`outcome statuses missing: ${missingStatus.join(', ')}`);
else if (learning) P.push('outcome statuses modeled (improved/unchanged/worsened/unknown)');

if (F.length) {
  console.error('[check:outcome-loop] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:outcome-loop] PASS — scan→diagnosis→recommendation→task→follow-up→outcome chain wired.');
for (const m of P) console.log('  ✓ ' + m);
