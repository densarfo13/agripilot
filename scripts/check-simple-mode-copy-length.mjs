#!/usr/bin/env node
/**
 * scripts/check-simple-mode-copy-length.mjs — §9 LOW-LITERACY COPY RULES.
 *
 * For every English entry in the simple.* namespace, fails if the copy
 * exceeds the configured length:
 *   - simple.action.*    ≤ 12 words
 *   - simple.reason.*    ≤ 10 words
 *   - simple.when.*      ≤  4 words
 *   - simple.button.*    ≤  4 words
 *   - simple.priority.*  ≤  4 words
 *   - simple.label.*     ≤  4 words
 *   - simple.scan.*      ≤ 12 words (action-style)
 *   - simple.post.*      ≤ 12 words
 *   - others             ≤ 30 words (voice fallback)
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };

const pack = read('src/i18n/simpleModeActionTranslations.js');
if (!pack) { F.push('simpleModeActionTranslations.js: missing'); }
else {
  // Extract every `'key': en('value')` pair.
  const re = /'(simple\.[a-zA-Z0-9_.]+)':\s*en\('([^']*)'\)/g;
  const entries = [];
  let m;
  while ((m = re.exec(pack))) entries.push({ key: m[1], en: m[2] });
  if (entries.length === 0) F.push('no simple.* entries parsed — the overlay file may be malformed');

  const limitFor = (key) => {
    if (key.startsWith('simple.action.')) return 12;
    if (key.startsWith('simple.reason.')) return 10;
    if (key.startsWith('simple.when.')) return 4;
    if (key.startsWith('simple.button.')) return 4;
    if (key.startsWith('simple.priority.')) return 4;
    if (key.startsWith('simple.label.')) return 4;
    if (key.startsWith('simple.scan.')) return 12;
    if (key.startsWith('simple.post.')) return 12;
    if (key === 'simple.home.eyebrow') return 4;
    if (key === 'simple.home.secondaryEyebrow') return 4;
    return 30; // voice / help fallback
  };

  const violations = [];
  for (const { key, en } of entries) {
    const words = en.trim().split(/\s+/).filter(Boolean).length;
    const limit = limitFor(key);
    if (words > limit) violations.push(`${key}: ${words} words > limit ${limit} ("${en}")`);
  }
  if (violations.length) {
    for (const v of violations) F.push(v);
  } else {
    P.push(`${entries.length} entries all within length limits`);
  }

  // Forbidden phrases — never appear in Simple Mode copy.
  const FORBIDDEN = /\b(confirmed|guaranteed|100%|protocol|taxonomy|phenology|integrated disease management)\b/i;
  for (const { key, en } of entries) {
    if (FORBIDDEN.test(en)) F.push(`${key}: contains a forbidden phrase ("${en}")`);
  }
  if (!F.some((m) => /forbidden phrase/.test(m))) P.push('no forbidden phrases in any simple.* entry');
}

// Contracts file must declare the limits the gate enforces (so future
// drift is caught immediately).
const contracts = read('src/runtime/simpleMode/SimpleModeContracts.ts');
if (!contracts) F.push('SimpleModeContracts.ts: missing');
else {
  if (!/COPY_LIMITS/.test(contracts)) F.push('SimpleModeContracts must export COPY_LIMITS');
  else P.push('COPY_LIMITS exported');
  if (!/action:\s*12/.test(contracts)) F.push('action limit must be 12');
  if (!/reason:\s*10/.test(contracts)) F.push('reason limit must be 10');
  if (!/whenLabel:\s*4/.test(contracts)) F.push('whenLabel limit must be 4');
  if (!/buttonLabel:\s*4/.test(contracts)) F.push('buttonLabel limit must be 4');
  if (!/voicePrompt:\s*30/.test(contracts)) F.push('voicePrompt limit must be 30');
  if (!F.some((m) => /limit must be/.test(m))) P.push('all length limits declared');
}

if (F.length) {
  console.error('[check:simple-mode-copy-length] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:simple-mode-copy-length] PASS — all simple.* copy under limit, no forbidden phrases.');
for (const m of P) console.log('  ✓ ' + m);
