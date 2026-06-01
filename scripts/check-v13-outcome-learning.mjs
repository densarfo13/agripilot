#!/usr/bin/env node
/**
 * scripts/check-v13-outcome-learning.mjs — outcome learning must require a
 * minimum sample and never overclaim.
 *
 * Fails if OutcomeLearningRuntime:
 *   • has no minimum-sample guard before reporting a rate
 *   • does not use the IMPROVED/UNCHANGED/WORSENED/UNKNOWN vocabulary
 *   • lacks the honest "Not enough outcome data yet" fallback
 *   • lacks explanation + limitations / disclaimer
 *
 * Read-only static analyzer.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '');

const rel = 'src/runtime/v13/outcomeLearning/OutcomeLearningRuntime.ts';
const raw = read(rel);
if (!raw) { F.push(`${rel}: missing`); }
else {
  const src = strip(raw);
  if (!/MIN_OUTCOME_SAMPLE|minSample|MIN_SAMPLE/.test(src) || !/<\s*(MIN_OUTCOME_SAMPLE|minSample|MIN_SAMPLE)/.test(src))
    F.push('OutcomeLearningRuntime must require a minimum sample size before reporting a rate');
  else P.push('minimum-sample guard present');
  for (const v of ['IMPROVED', 'UNCHANGED', 'WORSENED', 'UNKNOWN']) {
    if (!raw.includes(v)) F.push(`OutcomeLearningRuntime must use the '${v}' outcome value`);
  }
  if (!F.some((m) => m.includes('outcome value'))) P.push('uses IMPROVED/UNCHANGED/WORSENED/UNKNOWN vocabulary');
  if (!/not enough outcome data yet/i.test(raw))
    F.push('OutcomeLearningRuntime must carry the honest "Not enough outcome data yet" fallback');
  else P.push('honest "Not enough outcome data yet" fallback present');
  if (!/\bexplanation\b/.test(raw) || !/\blimitations\b/.test(raw))
    F.push('OutcomeLearningRuntime must surface explanation + limitations');
  else P.push('explanation + limitations present');
  if (!/Decision support, not a guarantee/.test(raw))
    F.push('OutcomeLearningRuntime must carry the disclaimer');
  else P.push('disclaimer present');
}

if (F.length) {
  console.error('[check:v13-outcome-learning] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:v13-outcome-learning] PASS — min sample, honest vocabulary, no overclaim.');
for (const m of P) console.log('  ✓ ' + m);
