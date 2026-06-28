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
console.log('[check:i18n-coverage-ratchet] PASS — real per-locale coverage holds above the floor (' + summary
  + '). Adding untranslated English keys can no longer silently lower coverage.');
