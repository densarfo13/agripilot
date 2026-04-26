#!/usr/bin/env node
/**
 * check-i18n-coverage.mjs
 *
 * CI guard — verifies translation coverage for Farroway's
 * **active launch languages**: English, Twi (tw), Hindi (hi).
 *
 *   node scripts/ci/check-i18n-coverage.mjs
 *     → 0 when every required domain passes the threshold; 1 otherwise.
 *
 * Two passes:
 *   A. Hindi pack coverage (src/i18n/hi.js) — flat key→string map
 *      merged into the main table at runtime.
 *   B. Twi slot coverage inside src/i18n/translations.js — checks
 *      each multilingual entry for a present `tw:` value.
 *
 * Active launch languages are listed in LAUNCH_LANGUAGES below.
 * Adding a new language to that list automatically extends the
 * guard — no other call sites change.
 *
 * English (the source language) is always present, so it isn't
 * gated separately — every key that exists at all has an `en` slot
 * by construction.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');

const EN_FILE = path.join(ROOT, 'src/i18n/translations.js');
const HI_FILE = path.join(ROOT, 'src/i18n/hi.js');

// Active launch languages (per i18n upgrade spec). Adding a code
// here extends the guard automatically; no other change required.
const LAUNCH_LANGUAGES = ['en', 'tw', 'hi'];

// Fix 3 — production-stability hardening: enforce 95% across every
// high-risk domain. The build fails when any target language drops
// below the floor, blocking deploys with mixed-language regressions.
const DOMAINS = [
  { name: 'insight.',   threshold: 0.95 },
  { name: 'econ.',      threshold: 0.95 },
  { name: 'rainfall.',  threshold: 0.95 },
  { name: 'seasonal.',  threshold: 0.95 },
  { name: 'topCrops.',  threshold: 0.95 },
];

function extractKeys(text) {
  // Matches lines like:   'foo.bar.baz': { ... }
  //                or:    'foo.bar.baz': '...'
  const keys = new Set();
  const re = /^\s*'([a-zA-Z][\w.]+)'\s*:/gm;
  let m;
  while ((m = re.exec(text))) keys.add(m[1]);
  return keys;
}

/**
 * Extract keys from translations.js whose entry includes a non-empty
 * value for the given language slot (e.g. tw: 'Tii'). Used to count
 * Twi coverage without building a separate file.
 *
 * Implementation note: a naïve `\{([^}]*)\}` regex breaks on entries
 * whose values contain `{placeholder}` interpolation (e.g.
 * `'Heavy rain ({totalMm}mm total)'`) because the inner `}` ends the
 * outer match early. We instead lex character-by-character with a
 * brace-depth counter so the slot scan covers the full entry.
 */
function extractKeysWithLangSlot(text, lang) {
  const keys = new Set();
  const keyRe = /^\s*'([a-zA-Z][\w.]+)'\s*:\s*\{/gm;
  const slotRe = new RegExp(`\\b${lang}\\s*:\\s*['\`"]([^'\`"]+)['\`"]`);
  let m;
  while ((m = keyRe.exec(text))) {
    const startIdx = m.index + m[0].length;
    let depth = 1;
    let i = startIdx;
    while (i < text.length && depth > 0) {
      const ch = text[i];
      if (ch === '{') depth += 1;
      else if (ch === '}') depth -= 1;
      i += 1;
    }
    const block = text.slice(startIdx, i - 1);
    if (slotRe.test(block)) keys.add(m[1]);
  }
  return keys;
}

function main() {
  if (!fs.existsSync(EN_FILE) || !fs.existsSync(HI_FILE)) {
    console.error('\u2717 i18n-coverage: could not locate translation files');
    process.exit(1);
  }
  const enText = fs.readFileSync(EN_FILE, 'utf8');
  const hiText = fs.readFileSync(HI_FILE, 'utf8');
  const en = extractKeys(enText);
  const hi = extractKeys(hiText);
  // Twi is carried inside translations.js per-entry slot.
  const tw = extractKeysWithLangSlot(enText, 'tw');

  const langSets = { en, hi, tw };
  let failed = false;

  for (const lang of LAUNCH_LANGUAGES) {
    if (lang === 'en') {
      console.log(`(en — source language; coverage trivially 100%)`);
      continue;
    }
    const set = langSets[lang];
    if (!set) {
      console.error(`\u2717 i18n-coverage: no extractor wired for "${lang}"`);
      failed = true;
      continue;
    }
    for (const d of DOMAINS) {
      let enCount = 0, langCount = 0;
      for (const k of en) if (k.startsWith(d.name)) enCount += 1;
      for (const k of set) if (k.startsWith(d.name)) langCount += 1;
      const ratio = enCount > 0 ? langCount / enCount : 1;
      const ok = enCount === 0 || ratio >= d.threshold;
      const mark = ok ? '\u2713' : '\u2717';
      const pct = (ratio * 100).toFixed(0);
      console.log(`${mark} ${d.name}*  ${lang}/en = ${langCount}/${enCount}  (${pct}%, required ${(d.threshold * 100).toFixed(0)}%)`);
      if (!ok) failed = true;
    }
  }

  if (failed) {
    console.error('');
    console.error('Fix: add missing keys for the failing language × domain combos.');
    console.error('  • Hindi gaps  → src/i18n/hi.js');
    console.error('  • Twi gaps    → tw: slot inside src/i18n/translations.js');
    console.error('Launch-language farmers currently see English for these screens.');
    process.exit(1);
  }
  console.log('\u2713 i18n-coverage: all launch languages pass every domain');
}
main();
