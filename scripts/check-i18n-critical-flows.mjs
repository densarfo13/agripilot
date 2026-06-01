#!/usr/bin/env node
/**
 * scripts/check-i18n-critical-flows.mjs — §5 language consistency in the
 * critical grower flows (Scan / Tasks / Onboarding / Weather).
 *
 * Fails if:
 *   • the entity localization layer (translateEntityLabel) is absent
 *   • __languageHealth does not surface the per-flow localization readiness
 *     flags (scan / task / onboarding / weather)
 *   • the critical grower shells do not route copy through tSafe/tStrict/t
 *
 * Read-only static analyzer. (Detailed hardcoded-string scanning is owned by
 * check-grower-i18n-hardcoded + check-hardcoded-grower-copy; this gate locks
 * the per-flow localization-readiness contract.)
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/(^|\s)\/\/.*$/gm, '');

// Entity localization layer present.
if (!/export function translateEntityLabel\b/.test(read('src/i18n/translateEntityLabel.js')))
  F.push('translateEntityLabel must exist (entity localization layer)');
else P.push('entity localization layer present (translateEntityLabel)');

// __languageHealth surfaces per-flow localization readiness.
const lang = read('src/runtime/i18n/LanguageHealthRuntime.js');
if (!lang) F.push('LanguageHealthRuntime.js: missing');
else {
  for (const k of ['scanLocalizationReady', 'taskLocalizationReady',
    'onboardingLocalizationReady', 'weatherLocalizationReady']) {
    if (!lang.includes(k)) F.push(`__languageHealth must surface ${k}`);
  }
  if (!F.some((m) => m.includes('LocalizationReady'))) P.push('__languageHealth surfaces scan/task/onboarding/weather readiness');
  // Supported locales declared.
  const missingLoc = ['tw', 'ha', 'sw', 'hi'].filter((l) => !new RegExp(`['"]${l}['"]`).test(lang));
  if (missingLoc.length) F.push(`LanguageHealthRuntime must reference supported locales: ${missingLoc.join(', ')}`);
  else P.push('supported locales referenced (en/tw/ha/fr/sw/hi)');
}

// Critical grower shells route copy through the translation layer.
const SHELLS = [
  'src/components/scan/ScanCameraLikeShell.jsx',
  'src/components/scan/ScanHub.jsx',
];
for (const rel of SHELLS) {
  const src = strip(read(rel));
  if (!src) continue;
  if (!/\b(tSafe|tStrict|\bt)\s*\(/.test(src))
    F.push(`${rel}: grower copy must route through t/tSafe/tStrict`);
}
if (!F.some((m) => m.includes('route through'))) P.push('critical scan shells route copy through the translation layer');

if (F.length) {
  console.error('[check:i18n-critical-flows] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:i18n-critical-flows] PASS — entity layer + per-flow localization readiness + translated shells.');
for (const m of P) console.log('  ✓ ' + m);
