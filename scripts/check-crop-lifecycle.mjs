#!/usr/bin/env node
/**
 * scripts/check-crop-lifecycle.mjs — §4 crop lifecycle engine.
 *
 * Fails if the engine does not model the 12 stages, does not mark its
 * estimates approximate + user-correctable, promises an exact harvest date,
 * fabricates, or omits the disclaimer.
 *
 * Read-only static analyzer.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '');

const STAGES = ['pre_planting', 'planting', 'germination', 'seedling', 'vegetative',
  'flowering', 'fruiting', 'maturity', 'harvest_ready', 'post_harvest', 'storage', 'selling_ready'];

const rel = 'src/runtime/dailyPlan/CropLifecycleEngine.ts';
const raw = read(rel);
if (!raw) { F.push(`${rel}: missing`); }
else {
  const src = strip(raw);
  const missing = STAGES.filter((s) => !raw.includes(s));
  if (missing.length) F.push(`lifecycle stages missing: ${missing.join(', ')}`);
  else P.push('all 12 lifecycle stages modeled');
  for (const k of ['approximateOnly', 'userCorrectable', 'stagesReady']) {
    if (!raw.includes(k)) F.push(`must declare ${k}`);
  }
  if (!F.some((m) => /approximateOnly|userCorrectable|stagesReady/.test(m)))
    P.push('approximate-only + user-correctable + stagesReady');
  if (!/weeksSincePlanting/.test(raw)) F.push('must compute weeksSincePlanting (relative date arithmetic)');
  else P.push('weeksSincePlanting computed');
  if (!/NEEDS_DATA|Not enough data/.test(raw)) F.push('must degrade honestly without a planting date');
  else P.push('honest without a planting date');
  // No exact harvest-date promise — forbid an ACTUAL calendar date (the files
  // legitimately DISCLAIM "never an exact harvest date" in prose, so match a
  // concrete date pattern, not the phrase).
  if (/harvest\s+(date\s+)?(on|by)\s+\d{1,2}[-/.]\d|harvest date\s*[:=]?\s*\d{4}-\d{2}|will harvest on\s+\d/i.test(src))
    F.push('must NOT promise an exact harvest date');
  else P.push('no exact harvest date promised');
  if (/Math\.random\s*\(|\bfetch\s*\(/.test(src)) F.push('must not fabricate / call the network');
  else P.push('no fabrication, no network');
  if (!/installCropLifecycleHealthGlobal/.test(raw) || !/__cropLifecycleHealth/.test(raw))
    F.push('must install window.__cropLifecycleHealth');
  else P.push('__cropLifecycleHealth installer present');
  if (!/Decision support, not a guarantee/.test(raw)) F.push('must carry the disclaimer');
  else P.push('disclaimer present');
}

if (F.length) {
  console.error('[check:crop-lifecycle] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:crop-lifecycle] PASS — 12 stages, approximate + user-correctable, no exact harvest date, honest.');
for (const m of P) console.log('  ✓ ' + m);
