#!/usr/bin/env node
/**
 * scripts/check-gardener-copy.mjs — §12 gardener support.
 *
 * Fails if the daily plan does not support gardeners (flowers / vegetables /
 * herbs / houseplants / containers), or if gardener mode is forced into
 * farm-only wording. The plan must branch on growerType, carry a garden
 * title + garden-care namespace, and the Home card must switch wording.
 *
 * Read-only static analyzer.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };

const runtime = read('src/runtime/dailyPlan/DailyFarmPlanRuntime.ts');
if (!runtime) F.push('DailyFarmPlanRuntime.ts: missing');
else {
  if (!/'gardener'|"gardener"/.test(runtime)) F.push('runtime must model a gardener grower type');
  else P.push('gardener grower type modeled');
  if (!/growerType/.test(runtime)) F.push('runtime must branch on growerType');
  else P.push('branches on growerType');
  // Gardener-conditional copy must exist (not one farm-only string for all).
  if (!/grower\s*===\s*'gardener'|isGarden/.test(runtime))
    F.push('runtime must produce gardener-specific copy (grower === \'gardener\')');
  else P.push('gardener-specific copy present');
}

const card = read('src/components/home/DailyFarmPlanCard.jsx');
if (!card) F.push('DailyFarmPlanCard.jsx: missing');
else {
  if (!/gardener/.test(card)) F.push('card must handle gardener mode');
  else P.push('card handles gardener mode');
  if (!/titleGarden|Garden Plan/.test(card))
    F.push('card must switch to garden wording in gardener mode (not farm-only)');
  else P.push('card switches to garden wording');
}

// i18n must carry a garden title + a garden-care namespace.
const i18n = read('src/i18n/dailyPlanTranslations.js');
if (!i18n) F.push('dailyPlanTranslations.js: missing');
else {
  if (!/dailyPlan\.titleGarden/.test(i18n)) F.push('i18n must include a garden title (dailyPlan.titleGarden)');
  else P.push('garden title key present');
  if (!/gardenCare\./.test(i18n)) F.push('i18n must include the gardenCare namespace');
  else P.push('gardenCare namespace present');
}

if (F.length) {
  console.error('[check:gardener-copy] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:gardener-copy] PASS — gardener flow supported, garden wording (not farm-only), gardenCare namespace.');
for (const m of P) console.log('  ✓ ' + m);
