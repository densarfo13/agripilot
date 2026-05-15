/**
 * check-translations.mjs — Global Language Consistency gate.
 *
 * A mixed-language screen has exactly one mechanical cause: a
 * translation key that has a real value in some languages but not
 * the active one. The legacy engine then falls back to English, so
 * a French screen shows one English string. This gate fails the
 * build before that can ship.
 *
 * THREE checks:
 *
 *   1. translations.js value parity — every "active" key (a key
 *      whose `en` value is a non-blank string) MUST have a non-blank
 *      value in all five launch-complete languages:
 *         en, fr, sw, ha, tw
 *      Any gap is a hard FAIL. Keys whose `en` is blank (intentional
 *      placeholders like `helpers.generic`) are skipped — a key
 *      blank in every language cannot cause a mixed screen.
 *
 *   2. Hindi (hi) coverage ratchet — Hindi is mid-translation.
 *      Rather than block the build on ~2.9k un-authored keys (real
 *      Hindi translation is human work — fabricating it would show
 *      wrong text to farmers), the gate ratchets: Hindi active-key
 *      coverage must never drop below HI_BASELINE. It prints the
 *      live number so the baseline can be raised as Hindi fills in.
 *
 *   3. locales/*.json key parity — the react-i18next JSON system.
 *      All eight files must carry the exact same key set as en.json.
 *
 * Pure source inspection. Exit 1 on any failure with a readable
 * reason; exit 0 prints a one-line PASS.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Five languages that are launch-complete today. en/fr/sw/ha/tw
// must be 100% — any regression fails the build.
const REQUIRED_LANGS = ['en', 'fr', 'sw', 'ha', 'tw'];

// Hindi no-regression baseline. Raise this as Hindi gets translated.
// Current measured coverage at the time this gate landed: 3486.
const HI_BASELINE = 3486;

// The eight react-i18next locale files that must stay key-identical.
const LOCALE_LANGS = ['en', 'fr', 'tw', 'ha', 'sw', 'hi', 'es', 'pt'];

function fail(msg) {
  console.error('[check:translations] FAIL — ' + msg);
  process.exit(1);
}

const _blank = (v) => typeof v !== 'string' || v.trim() === '';

// ── 1 + 2. translations.js value parity ──────────────────────
const transPath = resolve(ROOT, 'src/i18n/translations.js');
if (!existsSync(transPath)) fail('missing src/i18n/translations.js');

const mod = await import(pathToFileURL(transPath).href);
const T = mod.default || mod.T || mod;
if (!T || typeof T !== 'object') fail('translations.js has no usable export');

const keys = Object.keys(T);
const requiredGaps = [];   // [{ key, lang }]
let activeKeys = 0;
let hiCovered  = 0;

for (const k of keys) {
  const v = T[k];
  if (!v || typeof v !== 'object') {
    requiredGaps.push({ key: k, lang: '(bad shape — not an object)' });
    continue;
  }
  // A key is "active" only when English carries a real string.
  if (_blank(v.en)) continue;
  activeKeys += 1;

  for (const lang of REQUIRED_LANGS) {
    if (_blank(v[lang])) requiredGaps.push({ key: k, lang });
  }
  if (!_blank(v.hi)) hiCovered += 1;
}

if (requiredGaps.length > 0) {
  const lines = requiredGaps.slice(0, 25)
    .map((g) => `  • ${g.key}  →  missing "${g.lang}"`);
  const more = requiredGaps.length > 25
    ? `\n  …and ${requiredGaps.length - 25} more` : '';
  fail(
    `${requiredGaps.length} translation gap(s) in launch-complete `
    + `languages (${REQUIRED_LANGS.join('/')}).\n`
    + 'Every active key MUST have a non-blank value in all five.\n'
    + lines.join('\n') + more,
  );
}

if (hiCovered < HI_BASELINE) {
  fail(
    `Hindi (hi) coverage regressed: ${hiCovered} active keys translated, `
    + `baseline is ${HI_BASELINE}. A key was removed from hi or blanked.\n`
    + 'Restore the missing Hindi value(s), or lower HI_BASELINE only '
    + 'with an explicit reason.',
  );
}

// ── 3. locales/*.json key-set parity ─────────────────────────
function leafKeys(obj, prefix = '') {
  let out = [];
  for (const k of Object.keys(obj)) {
    const kp = prefix ? prefix + '.' + k : k;
    const val = obj[k];
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      out = out.concat(leafKeys(val, kp));
    } else {
      out.push(kp);
    }
  }
  return out;
}

const localeDir = resolve(ROOT, 'src/i18n/locales');
const enLocalePath = resolve(localeDir, 'en.json');
if (!existsSync(enLocalePath)) fail('missing src/i18n/locales/en.json');

const enLocaleKeys = leafKeys(JSON.parse(readFileSync(enLocalePath, 'utf8'))).sort();
const enSet = new Set(enLocaleKeys);
const localeProblems = [];

for (const lang of LOCALE_LANGS) {
  if (lang === 'en') continue;
  const p = resolve(localeDir, lang + '.json');
  if (!existsSync(p)) { localeProblems.push(`${lang}.json missing`); continue; }
  const k = leafKeys(JSON.parse(readFileSync(p, 'utf8')));
  const kSet = new Set(k);
  const missing = enLocaleKeys.filter((x) => !kSet.has(x));
  const extra   = k.filter((x) => !enSet.has(x));
  if (missing.length || extra.length) {
    localeProblems.push(
      `${lang}.json — missing ${missing.length}, extra ${extra.length}`
      + (missing.length ? `  (e.g. ${missing.slice(0, 3).join(', ')})` : ''),
    );
  }
}

if (localeProblems.length > 0) {
  fail('locales/*.json key-set drift:\n  • ' + localeProblems.join('\n  • '));
}

const hiPct = ((hiCovered / activeKeys) * 100).toFixed(1);
console.log(
  '[check:translations] PASS — '
  + `${activeKeys} active keys, ${REQUIRED_LANGS.join('/')} at 100%; `
  + `hi ${hiCovered}/${activeKeys} (${hiPct}%, baseline ${HI_BASELINE}); `
  + `${LOCALE_LANGS.length} locale JSON files key-identical.`,
);
