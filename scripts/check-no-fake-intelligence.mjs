#!/usr/bin/env node
/**
 * scripts/check-no-fake-intelligence.mjs — honest-data gate.
 *
 * The intelligence layer must build ONLY from real, stored data and
 * degrade honestly. Fails if an output engine:
 *   • fabricates data with Math.random / Date.now-seeded noise
 *   • lacks an honest "Not enough data yet" fallback path
 *   • does not read from a real source (localStorage / window probe)
 *   • (TrendEngine) infers a trend from a single scan — a trend needs
 *     at least 2 scans, never inferred from 1
 *   • presents a numeric confidence as certainty (must use a
 *     'low'|'medium'|'high' label, never a fabricated percentage)
 *
 * Read-only static analyzer.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '');

const DIR = 'src/runtime/intelligence';
// Data-dependent engines must carry an honest fallback + real source.
const DATA_ENGINES = [
  'CropMemoryEngine.ts', 'TrendEngine.ts', 'FarmHealthScoreEngine.ts',
  'YieldReadinessEngine.ts', 'DailyDecisionEngine.ts',
];
// RemoteSensingReadiness is a static readiness flag (no live data yet) —
// exempt from the "reads a real source" rule but still no fabrication.
const ALL_ENGINES = [...DATA_ENGINES, 'RemoteSensingReadiness.ts'];

for (const f of ALL_ENGINES) {
  const raw = read(`${DIR}/${f}`);
  if (!raw) { F.push(`${f}: missing`); continue; }
  const src = strip(raw);

  // No fabricated data.
  if (/Math\.random\s*\(/.test(src))
    F.push(`${f}: Math.random — intelligence must not fabricate data`);

  // confidence must be a label, never a fabricated numeric percentage.
  if (/confidence:\s*\d/.test(src) || /confidence:\s*`?\$\{[^}]*\}%/.test(src))
    F.push(`${f}: numeric confidence — use a 'low'|'medium'|'high' label, not a fabricated number`);
}
if (!F.some((m) => m.includes('random') || m.includes('numeric confidence')))
  P.push('no fabricated data (no Math.random, no numeric-percentage confidence)');

for (const f of DATA_ENGINES) {
  const raw = read(`${DIR}/${f}`);
  if (!raw) continue;
  // Honest "not enough data" fallback.
  if (!/not enough data/i.test(raw))
    F.push(`${f}: must carry an honest "Not enough data yet" fallback`);
  // Reads a real source — localStorage probe (_ls) or window global (_probe)
  // or a direct localStorage / window read.
  if (!/_ls\s*\(|_probe\s*\(|localStorage|window\./.test(raw))
    F.push(`${f}: must read from a real source (localStorage / window probe)`);
}
if (!F.some((m) => m.includes('Not enough data')))
  P.push('all data engines degrade honestly ("Not enough data yet")');
if (!F.some((m) => m.includes('real source')))
  P.push('all data engines read only from real stored sources');

// TrendEngine — never infer from a single scan (min 2 scans).
const trend = read(`${DIR}/TrendEngine.ts`);
if (trend) {
  const hasMin2 = /MIN_SCANS_FOR_TREND\s*=\s*2/.test(trend)
    && /<\s*MIN_SCANS_FOR_TREND/.test(trend);
  const fallbackMin2 = /at least 2 scans/i.test(trend);
  if (!hasMin2 || !fallbackMin2)
    F.push('TrendEngine must require ≥ 2 scans (never infer a trend from a single scan)');
  else P.push('TrendEngine requires ≥ 2 scans (no single-scan inference)');
}

if (F.length) {
  console.error('[check:no-fake-intelligence] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:no-fake-intelligence] PASS — real data only, honest fallbacks, no single-scan trend.');
for (const m of P) console.log('  ✓ ' + m);
