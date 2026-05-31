#!/usr/bin/env node
/**
 * scripts/check-v8-no-fake-regional-intelligence.mjs
 *
 * Regional risk must be earned from real data — no fake numbers, no fake
 * outbreaks. Fails if RegionalIntelligenceEngine:
 *   • has no minimum-data-points guard before showing risk
 *   • fabricates data (random) or calls the network (fetch)
 *   • emits a numeric confidence instead of a label
 *   • lacks the honest "Not enough regional data yet" fallback
 *   • lacks explanation + limitations / the disclaimer
 *
 * Read-only static analyzer.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '');

const rel = 'src/runtime/v8/regional/RegionalIntelligenceEngine.ts';
const raw = read(rel);
if (!raw) { F.push(`${rel}: missing`); }
else {
  const src = strip(raw);
  if (!/MIN_REGIONAL_DATA_POINTS|minDataPoints|MIN_DATA_POINTS/.test(src) || !/<\s*(MIN_REGIONAL_DATA_POINTS|minDataPoints|MIN_DATA_POINTS)/.test(src))
    F.push('RegionalIntelligenceEngine must require a minimum number of data points before showing risk');
  else P.push('minimum-data-points guard present');
  if (/\b(?:Math\.random|fetch)\s*\(/.test(src)) F.push('RegionalIntelligenceEngine must not fabricate data or call the network');
  else P.push('no fabricated data, no network call');
  if (/confidence:\s*\d/.test(src)) F.push('confidence must be a label, not a number');
  else P.push('label confidence');
  if (!/not enough regional data yet/i.test(raw))
    F.push('RegionalIntelligenceEngine must carry the honest "Not enough regional data yet" fallback');
  else P.push('honest "Not enough regional data yet" fallback present');
  if (!/\bexplanation\b/.test(raw) || !/\blimitations\b/.test(raw))
    F.push('RegionalIntelligenceEngine must surface explanation + limitations');
  else P.push('explanation + limitations present');
  if (!/Decision support, not a guarantee/.test(raw))
    F.push('RegionalIntelligenceEngine must carry the disclaimer');
  else P.push('disclaimer present');
}

if (F.length) {
  console.error('[check:v8-no-fake-regional-intelligence] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:v8-no-fake-regional-intelligence] PASS — min data points, no fake outbreaks, honest fallback.');
for (const m of P) console.log('  ✓ ' + m);
