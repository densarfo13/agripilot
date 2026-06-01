#!/usr/bin/env node
/**
 * scripts/check-outcome-capture.mjs — §5 outcome engine.
 *
 * Fails if:
 *   • the outcome statuses (improved/unchanged/worsened/unknown) are not
 *     modeled
 *   • an outcome success / improvement rate is not computed
 *   • the outcome capture chain (__outcomeCaptureHealth) is not surfaced
 *
 * Read-only static analyzer.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };

// Outcome statuses modeled.
const learning = read('src/runtime/v13/outcomeLearning/OutcomeLearningRuntime.ts');
const missing = ['IMPROVED', 'UNCHANGED', 'WORSENED', 'UNKNOWN'].filter((s) => !learning.includes(s));
if (!learning || missing.length) F.push(`outcome statuses missing: ${missing.join(', ') || 'OutcomeLearningRuntime absent'}`);
else P.push('outcome statuses modeled (improved/unchanged/worsened/unknown)');

// Outcome success / improvement rate computed.
const analytics = read('src/runtime/outcomeIntelligence/PilotAnalyticsRuntime.ts');
if (!/improvementRate|successRate|improvedRate|outcomeSuccess/.test(analytics + learning))
  F.push('an outcome success / improvement rate must be computed (per crop/region/NGO)');
else P.push('outcome success / improvement rate computed');

// Outcome capture chain surfaced.
const cap = read('src/runtime/pilot/PilotHealthRuntime.ts');
for (const k of ['scanCaptured', 'recommendationCaptured', 'taskCaptured', 'followUpScanCaptured', 'outcomeStatusCaptured']) {
  if (!cap.includes(k)) F.push(`__outcomeCaptureHealth must surface ${k}`);
}
if (!F.some((m) => m.includes('must surface'))) P.push('outcome capture chain surfaced');

if (F.length) {
  console.error('[check:outcome-capture] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:outcome-capture] PASS — statuses modeled, success rate computed, capture chain wired.');
for (const m of P) console.log('  ✓ ' + m);
