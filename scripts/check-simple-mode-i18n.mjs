#!/usr/bin/env node
/**
 * scripts/check-simple-mode-i18n.mjs — §10 LOCALIZATION.
 *
 * Fails if:
 *   - The simple.* namespace is missing entries
 *   - The overlay is not registered + merged in i18n/index.js
 *   - Simple Mode UI components hard-code visible English copy (must go
 *     through tSafe with a key)
 *   - Non-English locales (tw/ha/fr/sw/hi) are baked into the new
 *     overlay (English-only base; translator-review for the rest)
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };

const pack = read('src/i18n/simpleModeActionTranslations.js');
if (!pack) F.push('simpleModeActionTranslations.js: missing');
else {
  if (!/SIMPLE_MODE_ACTION_TRANSLATIONS/.test(pack))
    F.push('overlay must export SIMPLE_MODE_ACTION_TRANSLATIONS');
  else P.push('overlay exported');
  // Required namespace keys.
  for (const k of ['simple.button.done', 'simple.label.doThisNow', 'simple.label.why',
    'simple.label.when', 'simple.when.today', 'simple.scan.plant',
    'simple.scan.problem', 'simple.scan.doThis', 'simple.scan.next']) {
    if (!new RegExp(`'${k.replace(/\./g, '\\.')}'`).test(pack))
      F.push(`overlay must include key ${k}`);
  }
  if (!F.some((m) => /overlay must include/.test(m)))
    P.push('all required simple.* keys present');
  // English-only base — other locales fall back at render time.
  if (/\b(tw|ha|fr|sw|hi)\s*:/.test(pack))
    F.push('overlay must ship English only (other locales fall back — translator-review)');
  else P.push('English-only base');
}

const idx = read('src/i18n/index.js');
if (!idx) F.push('src/i18n/index.js: missing');
else if (!/SIMPLE_MODE_ACTION_TRANSLATIONS/.test(idx)
    || !/Object\.keys\(SIMPLE_MODE_ACTION_TRANSLATIONS\)/.test(idx))
  F.push('overlay must be imported AND merged in i18n/index.js');
else P.push('overlay merged into the dictionary');

// Components must localize via tSafe — never hard-code English visible text.
const COMPS = [
  'src/components/simpleMode/SimpleActionCard.jsx',
  'src/components/simpleMode/SimpleModeHomeSection.jsx',
  'src/components/simpleMode/SimpleModeScanCard.jsx',
];
for (const rel of COMPS) {
  const raw = read(rel);
  if (!raw) F.push(`${rel}: missing`);
  else if (!/tSafe\(/.test(raw))
    F.push(`${rel.split('/').pop()}: must localize via tSafe`);
}
if (!F.some((m) => /must localize via tSafe/.test(m)))
  P.push('all 3 Simple Mode components localize via tSafe');

if (F.length) {
  console.error('[check:simple-mode-i18n] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:simple-mode-i18n] PASS — overlay registered, English fallback, all components via tSafe.');
for (const m of P) console.log('  ✓ ' + m);
