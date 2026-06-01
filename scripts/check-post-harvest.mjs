#!/usr/bin/env node
/**
 * scripts/check-post-harvest.mjs — §6 post-harvest engine.
 *
 * Fails if the engine drops the harvest checklist / sorting / drying /
 * storage / spoilage / selling guidance, invents a market price, gives an
 * unsafe storage chemical, fabricates, or omits the disclaimer.
 *
 * Read-only static analyzer.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '');

const rel = 'src/runtime/dailyPlan/PostHarvestEngine.ts';
const raw = read(rel);
if (!raw) { F.push(`${rel}: missing`); }
else {
  const src = strip(raw);
  for (const k of ['harvestChecklist', 'sortingGrading', 'dryingCuring', 'storageGuidance',
    'spoilageRisk', 'sellingReadiness']) {
    if (!raw.includes(k)) F.push(`must surface ${k}`);
  }
  if (!F.some((m) => m.includes('must surface'))) P.push('checklist / sorting / drying / storage / spoilage / selling present');
  for (const k of ['noFakeMarketPrice', 'noUnsafeChemical']) {
    if (!raw.includes(k)) F.push(`must declare ${k}`);
  }
  if (!F.some((m) => /noFakeMarketPrice|noUnsafeChemical/.test(m))) P.push('no fake price + no unsafe chemical declared');
  // No invented currency price (token names like noFakeMarketPrice are fine —
  // we forbid an actual currency-amount or "sell for <n>").
  if (/(\$|₵|GHS|USD|NGN|KES|GH₵)\s?\d|price of\s+\d|sell(s|ing)?\s+(it\s+)?for\s+\d/i.test(src))
    F.push('must NOT invent a market price / currency amount');
  else P.push('no invented market price');
  // No unsafe chemical dosage in storage advice.
  if (/\b\d+(\.\d+)?\s*(ml|mg|g|kg|l)\s*(per|\/)\s*(l|litre|liter|kg|ton|tonne|bag|crate|m2|m²|plant)/i.test(src))
    F.push('must NOT give a chemical / storage dosage');
  else P.push('no chemical/storage dosage');
  if (/Math\.random\s*\(|\bfetch\s*\(/.test(src)) F.push('must not fabricate / call the network');
  else P.push('no fabrication, no network');
  if (!/installPostHarvestHealthGlobal/.test(raw) || !/__postHarvestHealth/.test(raw))
    F.push('must install window.__postHarvestHealth');
  else P.push('__postHarvestHealth installer present');
  if (!/Decision support, not a guarantee/.test(raw)) F.push('must carry the disclaimer');
  else P.push('disclaimer present');
}

if (F.length) {
  console.error('[check:post-harvest] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:post-harvest] PASS — full post-harvest guidance, no fake price, no unsafe chemical, honest.');
for (const m of P) console.log('  ✓ ' + m);
