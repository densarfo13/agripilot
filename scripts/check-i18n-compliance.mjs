#!/usr/bin/env node
/**
 * scripts/check-i18n-compliance.mjs — §6 i18n compliance composite.
 *
 * Asserts the i18n infrastructure that prevents dynamic-label mismatch:
 *   • the entity-label normalization layer exists (translateEntityLabel)
 *   • the 6-language crop registry is intact
 *   • __languageHealth / __languageState diagnostics are present
 *   • the scan + onboarding shells route copy through tSafe/tStrict
 *
 * Does NOT demand fabricated tw/ha/sw/hi agronomy terms (translator
 * review) — it enforces the STRUCTURE that makes coverage measurable
 * and the fallback honest.
 *
 * Read-only. Never mutates source.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };

const layer = read('src/i18n/translateEntityLabel.js');
if (!/export function translateEntityLabel\b/.test(layer))
  F.push('translateEntityLabel() normalization layer missing (§6 dynamic-label fix)');
else P.push('entity-label normalization layer present');

if (!/CROP_LABELS_BY_LANG/.test(read('src/config/crops.js')))
  F.push('6-language crop registry (CROP_LABELS_BY_LANG) missing');
else P.push('6-language crop registry intact');

const diag = read('src/runtime/i18n/LanguageHealthRuntime.js');
for (const g of ['__languageHealth', '__languageState']) {
  if (!new RegExp(g).test(diag)) F.push(`i18n diagnostic ${g} missing`);
}
if (!F.some((m) => m.includes('__language'))) P.push('__languageHealth/__languageState diagnostics present');

// Scan + onboarding shells must externalize copy.
for (const [rel, label] of [
  ['src/components/scan/ScanCameraLikeShell.jsx', 'scan camera-like shell'],
  ['src/components/scan/ScanHub.jsx', 'scan hub'],
  ['src/pages/onboarding/FastOnboarding.jsx', 'onboarding'],
]) {
  const src = read(rel);
  if (!/\b(tSafe|tStrict)\s*\(/.test(src))
    F.push(`${label}: must route copy through tSafe/tStrict`);
}
if (!F.some((m) => m.includes('route copy'))) P.push('scan + onboarding shells externalize copy via tSafe/tStrict');

if (F.length) {
  console.error('[check:i18n-compliance] FAIL');
  for (const m of F) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:i18n-compliance] PASS — entity layer + 6-lang registry + honest diagnostics + externalized shells.');
for (const m of P) console.log('  ✓ ' + m);
