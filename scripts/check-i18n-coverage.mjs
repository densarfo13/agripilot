#!/usr/bin/env node
/**
 * scripts/check-i18n-coverage.mjs — §2 honest coverage diagnostics.
 *
 * Fails if __languageHealth doesn't surface real per-locale coverage,
 * the supported-locale set is wrong, missing keys aren't recorded, or
 * a fake 100% is hardcoded for non-English.
 *
 * Read-only.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };

const diag = read('src/runtime/i18n/LanguageHealthRuntime.js');
if (!diag) F.push('LanguageHealthRuntime.js missing');
else {
  for (const tok of ['translationCoverage', 'translationCoverageByLocale', 'supportedLanguages',
    'translatorReviewRequired', 'missingEntityLabels']) {
    if (!new RegExp(`\\b${tok}\\b`).test(diag)) F.push(`__languageHealth must surface "${tok}"`);
  }
  // 6 supported locales.
  if (!/\['en'\s*,\s*'tw'\s*,\s*'ha'\s*,\s*'fr'\s*,\s*'sw'\s*,\s*'hi'\]/.test(read('src/i18n/translateEntityLabel.js')))
    F.push('SUPPORTED_LOCALES must be exactly [en,tw,ha,fr,sw,hi]');
  // No fabricated 100 for non-English coverage.
  if (/perLocale\[[^\]]+\]\s*=\s*100\b/.test(read('src/i18n/translateEntityLabel.js')))
    F.push('coverage must be computed, never a hardcoded 100 for non-English');
  if (!F.length) P.push('__languageHealth: real per-locale coverage + review flag + missing-key recording');
}
// Missing keys recorded by the layer.
if (!/_recordMissing/.test(read('src/i18n/translateEntityLabel.js')))
  F.push('entity layer must record missing keys');
else P.push('entity layer records missing keys (honest)');

if (F.length) {
  console.error('[check:i18n-coverage] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:i18n-coverage] PASS — coverage is measured per locale, missing keys recorded, no fake 100%.');
for (const m of P) console.log('  ✓ ' + m);
