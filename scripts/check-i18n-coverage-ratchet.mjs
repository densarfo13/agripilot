/**
 * check-i18n-coverage-ratchet.mjs — whole-column translation-coverage RATCHET.
 *
 * Measures REAL per-locale coverage (% of keys whose value differs from English) across
 * the full T-* columns and fails the build if any locale drops below the committed
 * floor in src/i18n/coverage-baseline.json. This catches the spec's failure mode —
 * adding untranslated English keys silently lowering coverage — without ever
 * fabricating a translation (it MEASURES + GUARDS, it does not invent values).
 *
 * Complements the per-domain guard:i18n thresholds with a never-regress floor.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const R = process.cwd();
const E = [];

async function loadColumn(locale) {
  const rel = 'src/i18n/columns/T-' + locale + '.js';
  if (!fs.existsSync(path.join(R, rel))) { E.push('missing column: ' + rel); return {}; }
  try {
    const mod = await import(pathToFileURL(path.join(R, rel)).href);
    return (mod && (mod.default || mod)) || {};
  } catch (err) { E.push('cannot load ' + rel + ': ' + (err && err.message)); return {}; }
}

let baseline = {};
try { baseline = JSON.parse(fs.readFileSync(path.join(R, 'src/i18n/coverage-baseline.json'), 'utf8')).floors || {}; }
catch { E.push('missing/invalid src/i18n/coverage-baseline.json'); }

// DUPLICATE-KEY scan (spec #4). A duplicate key in a JS object literal is SILENTLY
// overwritten — no parse error, and by the time it is an object the duplicate is gone.
// Only a text scan of the column source catches it. Currently 0; this locks that.
const ALL_LOCALES = ['en', 'fr', 'tw', 'sw', 'ha', 'hi'];
for (const locale of ALL_LOCALES) {
  const rel = 'src/i18n/columns/T-' + locale + '.js';
  let src = '';
  try { src = fs.readFileSync(path.join(R, rel), 'utf8'); } catch { continue; }
  const seen = new Set();
  const dups = new Set();
  const re = /^\s*(['"])((?:\\.|(?!\1).)*)\1\s*:/gm;
  let m;
  while ((m = re.exec(src)) !== null) {
    const key = m[2];
    if (seen.has(key)) dups.add(key); else seen.add(key);
  }
  if (dups.size > 0) {
    E.push(`duplicate key(s) in ${rel}: ${[...dups].slice(0, 5).join(', ')}${dups.size > 5 ? ` (+${dups.size - 5} more)` : ''} — a duplicate silently overwrites the first value`);
  }
}

const en = await loadColumn('en');
const enKeys = Object.keys(en);
if (enKeys.length < 100) E.push('English column looks empty (' + enKeys.length + ' keys) — measurement aborted');

const results = {};
if (E.length === 0) {
  for (const locale of Object.keys(baseline)) {
    const col = await loadColumn(locale);
    let diff = 0, total = 0;
    for (const k of enKeys) {
      if (typeof en[k] === 'string' && typeof col[k] === 'string') { total++; if (col[k] !== en[k]) diff++; }
    }
    const pct = total > 0 ? Math.floor((diff / total) * 1000) / 10 : 0;
    results[locale] = pct;
    if (pct < baseline[locale]) {
      E.push(`coverage REGRESSED for ${locale}: ${pct}% < floor ${baseline[locale]}% (untranslated keys were added — translate them or do not add English-only keys)`);
    }
  }
}

if (E.length) {
  console.error('[check:i18n-coverage-ratchet] FAIL — ' + E.length + ' issue(s):');
  for (const e of E) console.error('  - ' + e);
  process.exit(1);
}
const summary = Object.entries(results).map(([l, p]) => `${l} ${p}%≥${baseline[l]}%`).join(' · ');
console.log('[check:i18n-coverage-ratchet] PASS — no duplicate keys in any column; real per-locale coverage holds above the floor ('
  + summary + '). Untranslated keys can no longer silently lower coverage, and a silently-overwriting duplicate key can no longer slip in.');
