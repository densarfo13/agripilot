#!/usr/bin/env node
/**
 * scripts/check-v13-yield-safety.mjs — yield is READINESS ONLY.
 *
 * Fails if YieldPredictionReadinessRuntime:
 *   • emits an exact yield/revenue figure (tons/bags/kg per acre/ha, revenue)
 *   • does not surface readyForYieldModel (boolean readiness)
 *   • does not surface a missingData list
 *   • lacks the honest "Not enough data yet" fallback
 *
 * Read-only static analyzer.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '');

const rel = 'src/runtime/v13/yield/YieldPredictionReadinessRuntime.ts';
const raw = read(rel);
if (!raw) { F.push(`${rel}: missing`); }
else {
  const src = strip(raw);
  if (/\b\d+(?:\.\d+)?\s*(tons?|bags?|kg|kilograms?)\s*\/\s*(acre|ha|hectare)/i.test(src))
    F.push('YieldPredictionReadinessRuntime must NOT emit a numeric yield figure (readiness only)');
  else P.push('no numeric yield figure');
  if (/(revenue|income|profit)\b[^.\n]{0,40}?[$₵€£]\s*\d|[$₵€£]\s*\d[\d,.]*\b[^.\n]{0,20}?(revenue|income|profit)/i.test(src))
    F.push('YieldPredictionReadinessRuntime must NOT emit a revenue forecast');
  else P.push('no revenue forecast');
  if (!/readyForYieldModel/.test(src))
    F.push('YieldPredictionReadinessRuntime must surface readyForYieldModel (boolean readiness)');
  else P.push('readyForYieldModel surfaced');
  if (!/missingData/.test(src))
    F.push('YieldPredictionReadinessRuntime must surface a missingData list');
  else P.push('missingData list surfaced');
  if (!/not enough data yet/i.test(raw))
    F.push('YieldPredictionReadinessRuntime must carry the honest "Not enough data yet" fallback');
  else P.push('honest "Not enough data yet" fallback present');
}

if (F.length) {
  console.error('[check:v13-yield-safety] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:v13-yield-safety] PASS — readiness only, no yield/revenue figure, missingData surfaced.');
for (const m of P) console.log('  ✓ ' + m);
