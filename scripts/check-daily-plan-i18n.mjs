#!/usr/bin/env node
/**
 * scripts/check-daily-plan-i18n.mjs — §13 localization.
 *
 * Fails if the 5 daily-plan namespaces are not defined, not registered into
 * the i18n dictionary, if the Home card hardcodes copy instead of going
 * through tSafe, or if the runtimes do not emit localizable keys. Non-English
 * locales must fall back to English (no fabricated agronomy terms) — so the
 * pack ships English only.
 *
 * Read-only static analyzer.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };

const NS = ['dailyPlan', 'lifecycle', 'postHarvest', 'taskActions', 'gardenCare'];

const pack = read('src/i18n/dailyPlanTranslations.js');
if (!pack) { F.push('src/i18n/dailyPlanTranslations.js: missing'); }
else {
  const missing = NS.filter((n) => !new RegExp(`'${n}\\.`).test(pack));
  if (missing.length) F.push(`namespaces missing keys: ${missing.join(', ')}`);
  else P.push('all 5 namespaces present (dailyPlan/lifecycle/postHarvest/taskActions/gardenCare)');
  if (!/DAILY_PLAN_TRANSLATIONS/.test(pack)) F.push('must export DAILY_PLAN_TRANSLATIONS overlay');
  else P.push('overlay exported');
  // English-only base — no invented tw/ha/sw/hi agronomy strings in the pack.
  if (/\b(tw|ha|sw|hi)\s*:/.test(pack))
    F.push('pack must ship English only (non-English locales fall back + translator-review)');
  else P.push('English-only base (fallback for other locales)');
}

// Must be registered into the i18n dictionary (import + merge loop).
const idx = read('src/i18n/index.js');
if (!idx) F.push('src/i18n/index.js: missing');
else if (!/DAILY_PLAN_TRANSLATIONS/.test(idx) || !/Object\.keys\(DAILY_PLAN_TRANSLATIONS\)/.test(idx))
  F.push('DAILY_PLAN_TRANSLATIONS must be imported AND merged in index.js');
else P.push('registered + merged into the i18n dictionary');

// Home card must localize via tSafe, not hardcode.
const card = read('src/components/home/DailyFarmPlanCard.jsx');
if (!card) F.push('DailyFarmPlanCard.jsx: missing');
else if (!/tSafe\(/.test(card)) F.push('card must localize copy via tSafe');
else P.push('card localizes via tSafe');

// Runtimes must emit localizable keys.
const runtime = read('src/runtime/dailyPlan/DailyFarmPlanRuntime.ts');
if (runtime && !/titleKey/.test(runtime)) F.push('runtime tasks must carry a titleKey');
else if (runtime) P.push('runtime tasks carry titleKey');

if (F.length) {
  console.error('[check:daily-plan-i18n] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:daily-plan-i18n] PASS — 5 namespaces defined + registered, card via tSafe, English-fallback only.');
for (const m of P) console.log('  ✓ ' + m);
