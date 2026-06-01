#!/usr/bin/env node
/**
 * scripts/check-scan-risk-scoring-safety.mjs — §4 scan risk scoring safety.
 *
 * Fails if the risk scorer emits an exact yield/revenue prediction, omits the
 * LOW/MEDIUM/HIGH/UNKNOWN + action-urgency vocabulary, or skips explanations.
 * Lives in src/runtime/scanRisk/ (NOT the protected src/runtime/scan/).
 *
 * Read-only static analyzer.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '');

const rel = 'src/runtime/scanRisk/ScanRiskScoringRuntime.ts';
const raw = read(rel);
if (!raw) { F.push(`${rel}: missing (must NOT be under the protected src/runtime/scan/)`); }
else {
  const src = strip(raw);
  const KEYS = ['severityRisk', 'spreadRisk', 'cropStageRisk', 'weatherRisk',
    'yieldReadinessRisk', 'actionUrgency', 'overallRisk'];
  const missing = KEYS.filter((k) => !raw.includes(k));
  if (missing.length) F.push(`risk scorer missing keys: ${missing.join(', ')}`);
  else P.push('all risk dimensions present');
  for (const v of ['LOW', 'MEDIUM', 'HIGH', 'UNKNOWN']) {
    if (!raw.includes(v)) F.push(`risk value vocabulary missing: ${v}`);
  }
  for (const u of ['TODAY', 'THIS_WEEK', 'MONITOR']) {
    if (!raw.includes(u)) F.push(`action-urgency vocabulary missing: ${u}`);
  }
  if (!F.some((m) => m.includes('vocabulary missing'))) P.push('LOW/MEDIUM/HIGH/UNKNOWN + TODAY/THIS_WEEK/MONITOR');
  if (!/noExactYieldPrediction/.test(raw)) F.push('must declare noExactYieldPrediction');
  else P.push('noExactYieldPrediction declared');
  // No exact yield/revenue figure.
  if (/\b\d+(?:\.\d+)?\s*(tons?|bags?|kg|kilograms?)\s*\/\s*(acre|ha|hectare)/i.test(src)
    || /(revenue|income|profit)\b[^.\n]{0,30}?[$₵€£]\s*\d/i.test(src))
    F.push('risk scorer must NOT emit an exact yield/revenue figure');
  else P.push('no exact yield/revenue figure');
  if (!/\bexplanation\b/.test(raw) || !/\blimitations\b/.test(raw))
    F.push('every risk score must carry explanation + limitations');
  else P.push('explanation + limitations present');
}

if (F.length) {
  console.error('[check:scan-risk-scoring-safety] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:scan-risk-scoring-safety] PASS — categorical risk + urgency, no exact yield, explained.');
for (const m of P) console.log('  ✓ ' + m);
