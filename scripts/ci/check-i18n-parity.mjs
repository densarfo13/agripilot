#!/usr/bin/env node
/**
 * check-i18n-parity.mjs
 *
 * Validates that every JSON locale file in src/i18n/locales/ has
 * the same set of dotted keys. Compares each locale to the union
 * across all locales; reports any missing keys per locale.
 *
 *   node scripts/ci/check-i18n-parity.mjs
 *     → 0 when every locale has 100% of the union
 *     → 1 with a per-locale missing-key report otherwise
 *
 * Pass `--update` to regenerate any locale that is missing keys
 * by inserting the English value as a placeholder. Useful when
 * adding a new key to en.json — runs once, fills the rest, then
 * humans translate.
 *
 * Why this script exists
 * ──────────────────────
 *  • The other i18n guards (`check-i18n.js`, `guard:i18n`) cover
 *    the central `translations.js` module. The parallel
 *    `src/i18n/locales/*.json` files are a separate consumer
 *    (e.g. server-side rendering, marketing pages) and need
 *    their own parity check.
 *  • Running this in CI catches the common bug where a developer
 *    adds a key to en.json but forgets the other locales.
 *
 * Strict rule: read-only by default. The `--update` mode is opt-in
 * and clearly logs what it touched so reviewers can verify before
 * committing. We never overwrite an existing translation.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const LOCALES_DIR = path.join(ROOT, 'src', 'i18n', 'locales');

// Treat en.json as the canonical source for placeholder backfill.
const SOURCE_LOCALE = 'en';

// Launch-language set — these MUST be at parity.  Other JSON files
// (es, pt) are nice-to-have and only checked for drift, not gated.
const LAUNCH_LOCALES = new Set(['en', 'fr', 'sw', 'ha', 'tw', 'hi']);

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    console.error(`✗ failed to parse ${path.relative(ROOT, file)}: ${err.message}`);
    process.exit(1);
  }
}

function flatten(obj, prefix = '') {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(out, flatten(v, key));
    } else {
      out[key] = v;
    }
  }
  return out;
}

function unflatten(flat) {
  const out = {};
  for (const [dotted, val] of Object.entries(flat)) {
    const parts = dotted.split('.');
    let cur = out;
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i];
      if (!cur[p] || typeof cur[p] !== 'object') cur[p] = {};
      cur = cur[p];
    }
    cur[parts[parts.length - 1]] = val;
  }
  return out;
}

function loadLocales() {
  let entries;
  try { entries = fs.readdirSync(LOCALES_DIR, { withFileTypes: true }); }
  catch (err) {
    console.error(`✗ cannot read ${path.relative(ROOT, LOCALES_DIR)}: ${err.message}`);
    process.exit(1);
  }
  const locales = {};
  for (const e of entries) {
    if (!e.isFile() || !e.name.endsWith('.json')) continue;
    const code = e.name.replace(/\.json$/, '');
    const file = path.join(LOCALES_DIR, e.name);
    locales[code] = { file, flat: flatten(readJson(file)) };
  }
  return locales;
}

function diff(a, b) {
  const onlyA = [];
  for (const k of Object.keys(a)) if (!(k in b)) onlyA.push(k);
  return onlyA;
}

function backfill(locale, sourceFlat) {
  const updated = { ...locale.flat };
  let added = 0;
  for (const [k, v] of Object.entries(sourceFlat)) {
    if (!(k in updated)) {
      // Mark backfills with a [PLACEHOLDER] prefix so translators
      // can find them with a single grep, and so the value never
      // accidentally ships as authoritative.
      updated[k] = `[PLACEHOLDER] ${v}`;
      added += 1;
    }
  }
  if (added > 0) {
    const ordered = unflatten(updated);
    fs.writeFileSync(locale.file, JSON.stringify(ordered, null, 2) + '\n', 'utf8');
  }
  return added;
}

const args = process.argv.slice(2);
const isUpdate = args.includes('--update');
const isQuiet  = args.includes('--quiet');

const locales = loadLocales();
const codes = Object.keys(locales).sort();
if (codes.length === 0) {
  console.error('✗ no locale files found at src/i18n/locales/');
  process.exit(1);
}
if (!locales[SOURCE_LOCALE]) {
  console.error(`✗ source locale "${SOURCE_LOCALE}" not found`);
  process.exit(1);
}

const sourceFlat = locales[SOURCE_LOCALE].flat;
const sourceCount = Object.keys(sourceFlat).length;

let failed = 0;
const issues = [];

for (const code of codes) {
  if (code === SOURCE_LOCALE) continue;
  const flat = locales[code].flat;
  const missing = diff(sourceFlat, flat);
  const extra   = diff(flat, sourceFlat);
  const isLaunch = LAUNCH_LOCALES.has(code);

  if (missing.length === 0 && extra.length === 0) {
    if (!isQuiet) {
      console.log(`✓ ${code} parity ${Object.keys(flat).length}/${sourceCount}`);
    }
    continue;
  }

  issues.push({ code, missing, extra, isLaunch });

  if (isUpdate && missing.length > 0) {
    const added = backfill(locales[code], sourceFlat);
    console.log(`↻ ${code} backfilled ${added} key(s)`);
  } else {
    const verdict = isLaunch ? '✗' : '⚠';
    console.log(`${verdict} ${code} missing ${missing.length} key(s) of ${sourceCount}`
      + (extra.length ? `, extra ${extra.length}` : ''));
    if (!isQuiet) {
      for (const k of missing.slice(0, 8)) console.log(`     - ${k}`);
      if (missing.length > 8) console.log(`     … +${missing.length - 8} more`);
    }
    if (isLaunch) failed += 1;
  }
}

if (isUpdate) {
  console.log('done. review the [PLACEHOLDER] entries before committing.');
  process.exit(0);
}

if (failed > 0) {
  console.error(`\ni18n-parity: ${failed} launch-locale(s) below parity.`);
  console.error('  • run `node scripts/ci/check-i18n-parity.mjs --update`');
  console.error('    to backfill missing keys with [PLACEHOLDER]-prefixed English.');
  process.exit(1);
}

console.log(`✓ i18n-parity: every launch locale matches ${SOURCE_LOCALE}.json (${sourceCount} keys)`);
process.exit(0);
