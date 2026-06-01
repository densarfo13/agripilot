#!/usr/bin/env node
/**
 * scripts/check-farmer-retention.mjs — §1/§7 farmer success + retention.
 *
 * Fails if the FarmerSuccessEngine does not surface a farmer health score +
 * risk tier + activity signals, or the RetentionRuntime does not track the
 * D1/D7/D30 cohorts. Honest only — no fabricated score.
 *
 * Read-only static analyzer.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '');

const fs1 = read('src/runtime/farmerSuccess/FarmerSuccessEngine.ts');
if (!fs1) { F.push('FarmerSuccessEngine.ts: missing'); }
else {
  if (!/__farmerSuccessHealth/.test(fs1)) F.push('FarmerSuccessEngine must install __farmerSuccessHealth');
  else P.push('__farmerSuccessHealth installed');
  for (const k of ['score', 'risk', 'followUpRate', 'taskCompletion']) {
    if (!new RegExp(`\\b${k}\\b`).test(fs1)) F.push(`__farmerSuccessHealth must surface ${k}`);
  }
  if (!F.some((m) => m.includes('must surface'))) P.push('farmer health score + risk tier + activity signals present');
  if (/Math\.random\s*\(/.test(strip(fs1))) F.push('FarmerSuccessEngine must not fabricate the score');
  else P.push('no fabricated score');
}

const ret = read('src/runtime/retention/RetentionRuntime.ts');
if (!ret) { F.push('RetentionRuntime.ts: missing'); }
else {
  const missing = ['D1', 'D7', 'D30'].filter((d) => !ret.includes(d));
  if (missing.length) F.push(`RetentionRuntime must track cohorts: ${missing.join(', ')}`);
  else P.push('retention tracks D1/D7/D30 cohorts');
}

if (F.length) {
  console.error('[check:farmer-retention] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:farmer-retention] PASS — farmer health score + risk tiers + D1/D7/D30 retention.');
for (const m of P) console.log('  ✓ ' + m);
