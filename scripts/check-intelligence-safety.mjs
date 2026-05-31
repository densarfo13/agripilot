#!/usr/bin/env node
/**
 * scripts/check-intelligence-safety.mjs — §10 explainability + safety.
 *
 * Fails if:
 *   • an intelligence engine output lacks explanation/limitations
 *   • the yield engine emits an exact yield forecast (tons/bags/acre/
 *     revenue) instead of a readiness LABEL
 *   • satellite/remote-sensing claims active prediction without a real API
 *   • a dangerous chemical dosage is hardcoded (must come from the
 *     vetted catalog, not an engine)
 *   • the "Decision support, not a guarantee." disclaimer is absent
 *
 * Read-only.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };

const DIR = 'src/runtime/intelligence';
// The farmer-facing OUTPUT engines added this wave — each must surface an
// explainable envelope (§10). NOT the OODA/artifact infrastructure files
// (DecisionEngine / OODAEngine / OutcomeEngine / oodaContracts / index) nor
// the composite health probe (IntelligenceHealthRuntime), which carry the
// "Decision support, not a guarantee." disclaimer instead of per-output keys.
const OUTPUT_ENGINES = [
  'CropMemoryEngine.ts', 'TrendEngine.ts', 'FarmHealthScoreEngine.ts',
  'YieldReadinessEngine.ts', 'DailyDecisionEngine.ts', 'RemoteSensingReadiness.ts',
];
const present = (() => { try { return fs.readdirSync(path.join(ROOT, DIR)).filter((f) => f.endsWith('.ts')); } catch { return []; } })();
if (!present.length) F.push('src/runtime/intelligence/*.ts engines must exist');

for (const f of OUTPUT_ENGINES) {
  if (!present.includes(f)) { F.push(`${f}: missing output engine`); continue; }
  const src = read(`${DIR}/${f}`);
  // Explainability — each output engine surfaces explanation + limitations.
  if (!/\bexplanation\b/.test(src) || !/\blimitations\b/.test(src))
    F.push(`${f}: must surface explanation + limitations (§10 explainability)`);
}
if (!F.some((m) => m.includes('explanation') || m.includes('output engine'))) P.push('all output engines surface explanation + limitations');

// Yield engine = readiness, NOT forecast. Flag only an ACTUAL numeric
// forecast (a number adjacent to a yield unit, or a currency-prefixed
// revenue figure). The bare words "tons/acre" or "revenue" inside a
// disclaimer ("NEVER outputs … revenue") are honest, not violations.
const yieldSrc = read(`${DIR}/YieldReadinessEngine.ts`).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '');
if (yieldSrc) {
  const numericYield = /\b\d+(?:\.\d+)?\s*(tons?|bags?|kg|kilograms?)\s*\/\s*(acre|ha|hectare)/i.test(yieldSrc);
  const numericRevenue = /(revenue|income|profit)\b[^.\n]{0,40}?[$₵€£]\s*\d|[$₵€£]\s*\d[\d,.]*\b[^.\n]{0,20}?(revenue|income|profit)/i.test(yieldSrc);
  if (numericYield || numericRevenue)
    F.push('YieldReadinessEngine must NOT emit an exact yield/revenue forecast (readiness label only)');
  else P.push('yield engine is readiness-only (no numeric tons/bags/acre/revenue forecast)');
  if (!/'LOW'|'MEDIUM'|'HIGH'|'UNKNOWN'/.test(read(`${DIR}/YieldReadinessEngine.ts`)))
    F.push('YieldReadinessEngine must output LOW/MEDIUM/HIGH/UNKNOWN labels');
  else P.push('yield engine emits LOW/MEDIUM/HIGH/UNKNOWN readiness labels');
}

// Remote sensing must not claim active prediction.
const rs = read(`${DIR}/RemoteSensingReadiness.ts`);
if (rs) {
  if (!/activePredictionEnabled:\s*false/.test(rs))
    F.push('RemoteSensingReadiness must keep activePredictionEnabled:false (no NDVI claim without a real API)');
  else P.push('remote-sensing makes no active-prediction claim');
}

// Disclaimer present somewhere in the intelligence layer.
const anyDisclaimer = present.some((f) => /Decision support, not a guarantee/.test(read(`${DIR}/${f}`)));
if (!anyDisclaimer) F.push('intelligence layer must carry the "Decision support, not a guarantee." disclaimer');
else P.push('"Decision support, not a guarantee." disclaimer present');

// No hardcoded chemical dosage in engines (must come from vetted catalog).
for (const f of present) {
  const src = read(`${DIR}/${f}`).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '');
  if (/\b\d+\s?(ml|l|g|kg)\s*\/\s*(l|litre|liter|acre|ha)\b/i.test(src))
    F.push(`${f}: hardcoded chemical dosage — treatment guidance must come from the vetted catalog`);
}
if (!F.some((m) => m.includes('dosage'))) P.push('no hardcoded chemical dosages in engines');

if (F.length) {
  console.error('[check:intelligence-safety] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:intelligence-safety] PASS — explainable, readiness-not-forecast, no fake satellite, no dangerous dosage.');
for (const m of P) console.log('  ✓ ' + m);
