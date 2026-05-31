#!/usr/bin/env node
/**
 * scripts/check-v7-no-fake-intelligence.mjs — V7 honest-data gate.
 *
 * The V7 intelligence platform must build only from real, stored data and
 * degrade honestly. Fails if any V7 engine:
 *   • fabricates data (Math.random)
 *   • makes a live network call from a health probe (fetch)
 *   • lacks explanation + limitations (§ explainability)
 *   • lacks an honest "Not enough data yet" fallback (data engines)
 *   • emits a numeric confidence instead of a 'low'|'medium'|'high' label
 *   • emits an exact yield/revenue forecast (numeric tons/bags/kg per
 *     acre/ha, or a currency-prefixed revenue figure)
 *   • is missing the "Decision support, not a guarantee." disclaimer
 *
 * Read-only static analyzer.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '');

const DIR = 'src/runtime/v7';
const ENGINES = {
  predictive:   'predictive/PredictiveRiskEngine.ts',
  ngo:          'ngo/NGOIntelligenceEngine.ts',
  marketplace:  'marketplace/MarketplaceIntelligenceEngine.ts',
  remote:       'remote/RemoteSensingEngine.ts',
  assistant:    'assistant/FarmAssistantEngine.ts',
  institutional:'institutional/InstitutionalReadinessEngine.ts',
};
// Engines that consume stored data → must carry an honest fallback.
const DATA_ENGINES = ['predictive', 'ngo', 'marketplace', 'remote', 'assistant'];
const ALL_FILES = [...Object.values(ENGINES), 'V7HealthRuntime.ts'];

// All engines must exist + carry explanation + limitations.
for (const [, rel] of Object.entries(ENGINES)) {
  const src = read(`${DIR}/${rel}`);
  if (!src) { F.push(`${rel}: missing V7 engine`); continue; }
  if (!/\bexplanation\b/.test(src) || !/\blimitations\b/.test(src))
    F.push(`${rel}: must surface explanation + limitations`);
}
if (!F.some((m) => m.includes('explanation') || m.includes('missing V7 engine')))
  P.push('all V7 engines surface explanation + limitations');

// No fabrication / no live network in any V7 file.
for (const rel of ALL_FILES) {
  const src = strip(read(`${DIR}/${rel}`));
  if (!src) continue;
  if (/Math\.random\s*\(/.test(src)) F.push(`${rel}: Math.random — no fabricated data`);
  if (/\bfetch\s*\(/.test(src)) F.push(`${rel}: fetch — a health probe must not call the network`);
  if (/confidence:\s*\d/.test(src)) F.push(`${rel}: numeric confidence — use a 'low'|'medium'|'high' label`);
  // Exact yield / revenue forecast.
  if (/\b\d+(?:\.\d+)?\s*(tons?|bags?|kg|kilograms?)\s*\/\s*(acre|ha|hectare)/i.test(src))
    F.push(`${rel}: numeric yield forecast — V7 predicts categories/readiness, not exact yield`);
  if (/(revenue|income|profit)\b[^.\n]{0,40}?[$₵€£]\s*\d|[$₵€£]\s*\d[\d,.]*\b[^.\n]{0,20}?(revenue|income|profit)/i.test(src))
    F.push(`${rel}: revenue forecast — not permitted in V7`);
}
if (!F.some((m) => m.includes('random') || m.includes('fetch') || m.includes('confidence') || m.includes('yield') || m.includes('revenue')))
  P.push('no fabrication, no network, label-confidence, no yield/revenue forecast');

// Honest fallback on the data engines.
for (const key of DATA_ENGINES) {
  const src = read(`${DIR}/${ENGINES[key]}`);
  if (!src) continue;
  if (!/not enough (data|remote data) yet/i.test(src))
    F.push(`${ENGINES[key]}: must carry an honest "Not enough data yet" fallback`);
}
if (!F.some((m) => m.includes('Not enough data')))
  P.push('all V7 data engines degrade honestly');

// Disclaimer present somewhere across V7.
if (!ALL_FILES.some((rel) => /Decision support, not a guarantee/.test(read(`${DIR}/${rel}`))))
  F.push('V7 layer must carry the "Decision support, not a guarantee." disclaimer');
else P.push('"Decision support, not a guarantee." disclaimer present');

if (F.length) {
  console.error('[check:v7-no-fake-intelligence] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:v7-no-fake-intelligence] PASS — real data only, explainable, honest fallbacks, no yield forecast.');
for (const m of P) console.log('  ✓ ' + m);
