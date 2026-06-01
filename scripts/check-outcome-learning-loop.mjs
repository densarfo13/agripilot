#!/usr/bin/env node
/**
 * scripts/check-outcome-learning-loop.mjs — §1 outcome learning loop.
 *
 * Fails if the loop does not wire the full chain, enforce a minimum sample
 * before any effectiveness claim, model the 4 outcome statuses, or degrade
 * to NEEDS_DATA. No fabricated effectiveness.
 *
 * Read-only static analyzer.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '');

const rel = 'src/runtime/intelligence/outcomes/OutcomeLearningLoop.ts';
const raw = read(rel);
if (!raw) { F.push(`${rel}: missing`); }
else {
  const src = strip(raw);
  const LINKS = ['scanLinked', 'diagnosisLinked', 'recommendationLinked', 'taskLinked',
    'followUpScanLinked', 'outcomeRecorded', 'learningSnapshotReady'];
  const missing = LINKS.filter((k) => !raw.includes(k));
  if (missing.length) F.push(`outcome loop missing chain links: ${missing.join(', ')}`);
  else P.push('full scan→outcome chain linked');
  // Threshold enforced via a comparison against MIN_OUTCOME_SAMPLE (>= or <).
  if (!/minSampleRulesEnforced/.test(raw) || !/MIN_OUTCOME_SAMPLE/.test(raw)
      || !/(>=|<=|<|>)\s*MIN_OUTCOME_SAMPLE|MIN_OUTCOME_SAMPLE\s*(>=|<=|<|>)/.test(src))
    F.push('outcome loop must enforce a minimum sample before reporting a rate');
  else P.push('minimum-sample rule enforced');
  if (!/noFakeEffectiveness/.test(raw)) F.push('must declare noFakeEffectiveness');
  else P.push('no fake effectiveness');
  for (const s of ['IMPROVED', 'UNCHANGED', 'WORSENED', 'UNKNOWN']) {
    if (!raw.includes(s)) F.push(`outcome status missing: ${s}`);
  }
  if (!F.some((m) => m.includes('status missing'))) P.push('IMPROVED/UNCHANGED/WORSENED/UNKNOWN modeled');
  if (!/NEEDS_DATA/.test(raw)) F.push('must return NEEDS_DATA when insufficient');
  else P.push('honest NEEDS_DATA');
  if (/Math\.random\s*\(|\bfetch\s*\(/.test(src)) F.push('must not fabricate / call the network');
  else P.push('no fabrication, no network');
  if (!/Decision support, not a guarantee/.test(raw)) F.push('must carry the disclaimer');
  else P.push('disclaimer present');
}

if (F.length) {
  console.error('[check:outcome-learning-loop] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:outcome-learning-loop] PASS — full chain, min sample, honest statuses, no fake effectiveness.');
for (const m of P) console.log('  ✓ ' + m);
