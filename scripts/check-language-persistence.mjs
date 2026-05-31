#!/usr/bin/env node
/**
 * scripts/check-language-persistence.mjs — §1 single-source + persistence.
 *
 * Fails if the selected language isn't persisted through one source
 * with the documented priority chain, or the hook/diagnostic is missing.
 *
 * Read-only.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };

const store = read('src/i18n/languageStore.js');
if (!store) F.push('src/i18n/languageStore.js (single source) must exist');
else {
  if (!/setLanguage\b/.test(store)) F.push('languageStore must write through the canonical setLanguage');
  if (!/user_profile|farroway_user/.test(store)) F.push('languageStore must mirror to the user profile (survives logout/login)');
  if (!/languageSource/.test(store)) F.push('languageStore must expose the resolved source (priority chain)');
  if (!F.some((m) => m.includes('languageStore'))) P.push('languageStore: single writer + profile mirror + source');
}
const hook = read('src/i18n/useLanguage.js');
if (!/export default function useLanguage|export function useLanguage/.test(hook))
  F.push('src/i18n/useLanguage.js must export the useLanguage hook');
else P.push('useLanguage hook present (single read source)');
if (!read('src/i18n/LanguageProvider.jsx')) F.push('src/i18n/LanguageProvider.jsx must exist');
else P.push('LanguageProvider present');

const diag = read('src/runtime/i18n/LanguageHealthRuntime.js');
for (const tok of ['__languageState', 'persistedLocal', 'persistedProfile', 'fallbackLanguage']) {
  if (!new RegExp(tok).test(diag)) F.push(`__languageState must surface "${tok}"`);
}
if (!F.some((m) => m.includes('__languageState'))) P.push('__languageState surfaces persistence chain');

if (F.length) {
  console.error('[check:language-persistence] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:language-persistence] PASS — single language source, persisted local+profile, priority chain exposed.');
for (const m of P) console.log('  ✓ ' + m);
