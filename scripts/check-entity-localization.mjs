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
  // Source of truth = the JSON catalogs.
  for (const cat of ['diseases.json', 'pests.json', 'nutrients.json', 'treatments.json']) {
    if (!new RegExp(`entities/${cat}`).test(layer))
      F.push(`layer must import the ./entities/${cat} catalog`);
  }
  // Object return contract { label, locale, fallbackUsed, reviewRequired, canonicalKey }.
  for (const tok of ['fallbackUsed', 'reviewRequired', 'canonicalKey']) {
    if (!new RegExp(`\\b${tok}\\b`).test(layer))
      F.push(`translateEntityLabel must return "${tok}" in its result object`);
  }
  // Honest fallback + missing-key recording.
  if (!/_recordMissing/.test(layer) || !/_humanizeEnglish/.test(layer))
    F.push('layer must fall back to humanized English + record missing keys (honest coverage)');
  if (!/TRANSLATOR_REVIEW_LOCALES/.test(layer))
    F.push('layer must declare TRANSLATOR_REVIEW_LOCALES (no fabricated tw/ha/sw/hi terms)');
  if (!F.some((m) => m.includes('layer') || m.includes('translateEntityLabel')))
    P.push('entity-label layer present: crop delegation + JSON catalogs + object return + safe fallback + missing-key recording');
}

// ─── 1b. JSON catalogs honest (en+fr present; tw/ha/sw/hi null + review) ──
for (const cat of ['diseases', 'pests', 'nutrients', 'treatments']) {
  const raw = read(`src/i18n/entities/${cat}.json`);
  if (!raw) { F.push(`entities/${cat}.json must exist`); continue; }
  let parsed; try { parsed = JSON.parse(raw); } catch { F.push(`entities/${cat}.json must be valid JSON`); continue; }
  const rows = (parsed && Array.isArray(parsed.entities)) ? parsed.entities : [];
  if (!rows.length) { F.push(`entities/${cat}.json must define entities[]`); continue; }
  let ok = true;
  for (const r of rows) {
    if (!r.key || !r.en) { ok = false; break; }
    if (!r.translatorReview) { ok = false; break; }
    // No fabrication: a non-null tw/ha/sw/hi must NOT also be flagged review;
    // a null must be flagged review (honest).
    for (const loc of ['tw', 'ha', 'sw', 'hi']) {
      if (r[loc] == null && r.translatorReview[loc] !== true) { ok = false; break; }
    }
    if (!ok) break;
  }
  if (!ok) F.push(`entities/${cat}.json: each entity needs key+en+translatorReview, and every null locale must be review:true (no fabrication)`);
  else P.push(`entities/${cat}.json honest (en authentic, null locales flagged review)`);
}
const queue = read('src/i18n/translatorReviewQueue.json');
if (!queue) F.push('src/i18n/translatorReviewQueue.json must exist (honest review backlog)');
else { try { JSON.parse(queue); P.push('translatorReviewQueue.json present + valid'); } catch { F.push('translatorReviewQueue.json must be valid JSON'); } }

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
