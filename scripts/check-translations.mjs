/**
 * check-translations.mjs — Global Language Consistency gate.
 *
 * A mixed-language screen has exactly one mechanical cause: a
 * translation key that has a real value in some languages but not
 * the active one. The legacy engine then falls back to English, so
 * a French screen shows one English string. This gate fails the
 * build before that can ship.
 *
 * Post column-split refactor: the canonical translation data lives
 * one file per locale under src/i18n/columns/T-{locale}.js. This
 * gate reads those column files directly (NOT translations.js,
 * which is/becomes a thin shim that eagerly imports only T-en.js).
 *
 * FOUR checks:
 *
 *   1. Column parity — every key present in T-en.js with a
 *      non-blank value (the "active" key set) MUST also have a
 *      non-blank value in every required language column:
 *         en, fr, sw, ha, tw
 *      Any gap is a hard FAIL. Keys whose en value is blank
 *      (intentional placeholders like helpers.generic = ' ') are
 *      skipped — a key blank in every language cannot cause a
 *      mixed screen.
 *
 *   2. Hindi (hi) coverage ratchet — Hindi is mid-translation.
 *      Rather than block the build on un-authored keys, the gate
 *      ratchets: Hindi coverage must never drop below HI_BASELINE.
 *
 *   3. locales/*.json key parity — the parallel react-i18next JSON
 *      overlay system. All eight files must share en.json's key set.
 *
 *   4. Orphan-key detection — every key in a non-en column MUST
 *      also appear in T-en.js (the full key set, blanks included).
 *      An orphan means English coverage regressed under us; the
 *      build fails before that ships.
 *
 * Pure source inspection. Exit 1 on any failure with a readable
 * reason; exit 0 prints a one-line PASS.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Five languages that are launch-complete today. en/fr/sw/ha/tw
// must be 100% — any regression fails the build.
const REQUIRED_LANGS = ['en', 'fr', 'sw', 'ha', 'tw'];

// Hindi no-regression baseline. Raise this as Hindi gets translated.
// Current measured coverage at the time the column-split landed: 3486.
const HI_BASELINE = 3486;

// The eight react-i18next locale files that must stay key-identical.
const LOCALE_LANGS = ['en', 'fr', 'tw', 'ha', 'sw', 'hi', 'es', 'pt'];

function fail(msg) {
  console.error('[check:translations] FAIL — ' + msg);
  process.exit(1);
}

const _blank = (v) => typeof v !== 'string' || v.trim() === '';

// ── 1. + 2. + 4. Column-file parity ──────────────────────────
const COL_DIR = resolve(ROOT, 'src/i18n/columns');
const columns = {};
for (const lang of [...REQUIRED_LANGS, 'hi']) {
  const p = resolve(COL_DIR, `T-${lang}.js`);
  if (!existsSync(p)) fail(`missing column file ${p}`);
  const mod = await import(pathToFileURL(p).href);
  const dict = mod.default || mod;
  if (!dict || typeof dict !== 'object') fail(`column T-${lang}.js has no usable default export`);
  columns[lang] = dict;
}

// "Active" keys = those with a non-blank English value. Keys whose
// en value is empty / whitespace (e.g. helpers.generic = ' ') are
// intentional placeholders that exist to keep the key registered;
// they cannot cause a mixed-language screen because every locale
// resolves to the same blank string. Skip them in parity checks.
const enKeysAll = Object.keys(columns.en);
if (enKeysAll.length < 100) fail(`T-en.js only carries ${enKeysAll.length} keys — column file looks empty/corrupt`);
const enKeys = enKeysAll.filter((k) => !_blank(columns.en[k]));
const activeKeys = enKeys.length;

const requiredGaps = [];
for (const lang of REQUIRED_LANGS) {
  if (lang === 'en') continue;
  const c = columns[lang];
  for (const k of enKeys) {
    if (_blank(c[k])) requiredGaps.push({ key: k, lang });
  }
}

if (requiredGaps.length > 0) {
  const lines = requiredGaps.slice(0, 25)
    .map((g) => `  • ${g.key}  →  missing "${g.lang}"`);
  const more = requiredGaps.length > 25
    ? `\n  …and ${requiredGaps.length - 25} more` : '';
  fail(
    `${requiredGaps.length} translation gap(s) in launch-complete `
    + `languages (${REQUIRED_LANGS.join('/')}).\n`
    + 'Every active key MUST have a non-blank value in all five columns.\n'
    + lines.join('\n') + more,
  );
}

let hiCovered = 0;
for (const k of enKeys) if (!_blank(columns.hi[k])) hiCovered += 1;

if (hiCovered < HI_BASELINE) {
  fail(
    `Hindi (hi) coverage regressed: ${hiCovered} active keys translated, `
    + `baseline is ${HI_BASELINE}. A key was removed from T-hi.js or blanked.\n`
    + 'Restore the missing Hindi value(s), or lower HI_BASELINE only '
    + 'with an explicit reason.',
  );
}

// Orphan-key detection: a key present in a non-en column but
// missing from T-en.js means the English column lost a key the
// other columns still reference. Treat as a hard fail so the
// regression surfaces immediately rather than as a runtime gap.
// Use the FULL en key set here — keys with blank en values are
// still "defined" in en, just intentionally empty.
const enSet = new Set(enKeysAll);
const orphans = [];
for (const lang of [...REQUIRED_LANGS, 'hi']) {
  if (lang === 'en') continue;
  for (const k of Object.keys(columns[lang])) {
    if (!enSet.has(k)) orphans.push({ key: k, lang });
  }
}
if (orphans.length > 0) {
  const lines = orphans.slice(0, 25).map((o) => `  • ${o.lang}: ${o.key}`);
  const more = orphans.length > 25 ? `\n  …and ${orphans.length - 25} more` : '';
  fail(
    `${orphans.length} orphan key(s) in non-en columns — every key in a `
    + `locale column MUST also be defined in T-en.js (the canonical key set).\n`
    + 'Either add the missing English value, or remove the orphan key.\n'
    + lines.join('\n') + more,
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
const enJsonSet = new Set(enLocaleKeys);
const localeProblems = [];

for (const lang of LOCALE_LANGS) {
  if (lang === 'en') continue;
  const p = resolve(localeDir, lang + '.json');
  if (!existsSync(p)) { localeProblems.push(`${lang}.json missing`); continue; }
  const k = leafKeys(JSON.parse(readFileSync(p, 'utf8')));
  const kSet = new Set(k);
  const missing = enLocaleKeys.filter((x) => !kSet.has(x));
  const extra   = k.filter((x) => !enJsonSet.has(x));
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
  + `${LOCALE_LANGS.length} locale JSON files key-identical; `
  + 'no orphan keys.',
);
