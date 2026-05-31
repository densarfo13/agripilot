#!/usr/bin/env node
/**
 * scripts/check-entity-localization.mjs — entity localization +
 * honest-diagnostics gate (Language Mismatch Fix §7/§10/§11).
 *
 * Asserts the durable i18n infrastructure exists and is wired —
 * WITHOUT demanding fabricated translations (a wrong agricultural
 * term is worse than an honest English fallback for low-literacy
 * users, so tw/ha/sw/hi entity labels are translator-review).
 *
 * Fails if:
 *   • the entity-label normalization layer is missing or doesn't
 *     compose the 6-language crop registry
 *   • crop / disease / pest / nutrient localization STRUCTURE is absent
 *   • the layer doesn't fall back safely + record missing keys
 *   • __languageHealth / __languageState / __messageTemplateHealth
 *     are missing or claim a fake 100% coverage
 *   • the diagnostics aren't wired at boot
 *
 * Read-only. Never mutates source.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };

// ─── 1. Entity-label normalization layer ───────────────────────
const layer = read('src/i18n/translateEntityLabel.js');
if (!layer) {
  F.push('src/i18n/translateEntityLabel.js must exist (the §7 normalization layer)');
} else {
  for (const tok of ['translateEntityLabel', 'toCanonicalKey',
    'entityLocalizationCoverage', 'getMissingEntityLabels']) {
    if (!new RegExp(`export function ${tok}\\b`).test(layer))
      F.push(`translateEntityLabel.js must export ${tok}()`);
  }
  if (!/getCropLabelSafe/.test(layer))
    F.push('layer must compose getCropLabelSafe (6-language crop registry) for crops');
  for (const tbl of ['DISEASE_LABELS', 'PEST_LABELS', 'NUTRIENT_LABELS']) {
    if (!new RegExp(`\\b${tbl}\\b`).test(layer))
      F.push(`layer must define ${tbl} (canonical-key localization table)`);
  }
  // Honest fallback + missing-key recording.
  if (!/_recordMissing/.test(layer) || !/_humanizeEnglish/.test(layer))
    F.push('layer must fall back to humanized English + record missing keys (honest coverage)');
  // No fabrication — translator-review locales declared.
  if (!/TRANSLATOR_REVIEW_LOCALES/.test(layer))
    F.push('layer must declare TRANSLATOR_REVIEW_LOCALES (no fabricated tw/ha/sw/hi terms)');
  // en + fr must be present in each table (high-confidence baseline).
  if (!/en:\s*'/.test(layer) || !/fr:\s*'/.test(layer))
    F.push('disease/pest/nutrient tables must carry en + fr labels');
  if (!F.some((m) => m.includes('layer') || m.includes('translateEntityLabel')))
    P.push('entity-label layer present: crop delegation + disease/pest/nutrient tables + safe fallback + missing-key recording');
}

// ─── 2. Crop registry is 6-language ────────────────────────────
const crops = read('src/config/crops.js');
if (!/CROP_LABELS_BY_LANG/.test(crops))
  F.push('config/crops.js must keep the CROP_LABELS_BY_LANG 6-language registry');
else P.push('crop registry is 6-language (CROP_LABELS_BY_LANG)');

// ─── 3. Honest diagnostics present + wired ─────────────────────
const diag = read('src/runtime/i18n/LanguageHealthRuntime.js');
if (!diag) {
  F.push('src/runtime/i18n/LanguageHealthRuntime.js must exist');
} else {
  for (const g of ['__languageState', '__languageHealth', '__messageTemplateHealth']) {
    if (!new RegExp(g).test(diag)) F.push(`diagnostics must install ${g}`);
  }
  for (const tok of ['selectedLanguage', 'supportedLanguages', 'translationCoverage',
    'missingEntityLabels', 'cropLocalizationReady', 'scanLocalizationReady',
    'fallbackLanguage']) {
    if (!new RegExp(`\\b${tok}\\b`).test(diag)) F.push(`__languageHealth/state must surface "${tok}"`);
  }
  // No fake 100% — coverage must be computed, not literal-100 hardcoded
  // for non-English. (We allow `en === 100` by construction.)
  if (/translationCoverage:\s*100\b/.test(diag))
    F.push('translationCoverage must be measured, not a fabricated 100');
  if (!F.some((m) => m.includes('diagnostics') || m.includes('__language')))
    P.push('__languageHealth/__languageState/__messageTemplateHealth present + honest coverage');
}
const app = read('src/App.jsx');
if (!/installLanguageHealthGlobals/.test(app))
  F.push('App.jsx must wire installLanguageHealthGlobals');
else P.push('language diagnostics wired at boot');

const uniqF = [...new Set(F)];
if (uniqF.length) {
  console.error('[check:entity-localization] FAIL');
  for (const m of uniqF) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:entity-localization] PASS — entity normalization layer + honest i18n diagnostics in place.');
for (const m of P) console.log('  ✓ ' + m);
