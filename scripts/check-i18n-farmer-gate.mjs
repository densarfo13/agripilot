// check-i18n-farmer-gate.mjs — the permanent fix for the English-fallback leak class.
// RATCHET: the count of farmer-facing keys used in code but unregistered in the
// canonical column set may only FALL (baseline committed; --update re-snapshots after
// a translation batch). Also enforces per-locale nav-label uniqueness — the exact
// Hausa "Ayyuka/Ayyuka" collision caught from a production screenshot on 2026-07-01.
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const BASELINE = 'scripts/i18n-farmer-baseline.json';
const out = execSync('node scripts/i18n-scan.mjs --json', { encoding: 'utf8' });
const scan = JSON.parse(out.trim().split('\n').pop());

if (process.argv.includes('--update')) {
  fs.writeFileSync(BASELINE, JSON.stringify({ farmerMissing: scan.farmerMissing }, null, 2) + '\n');
  console.log('[check:i18n-farmer-gate] baseline updated — farmer-facing unregistered: ' + scan.farmerMissing);
  process.exit(0);
}

const E = [];
let base;
try { base = JSON.parse(fs.readFileSync(BASELINE, 'utf8')); }
catch { console.error('[check:i18n-farmer-gate] FAIL: baseline missing — run with --update'); process.exit(1); }
if (scan.farmerMissing > base.farmerMissing) {
  E.push('farmer-facing unregistered keys rose ' + base.farmerMissing + ' → ' + scan.farmerMissing
    + ' — register new keys in ALL locale columns (see scripts/fix-leaks-batch3.mjs pattern), never ship a bare English fallback');
}

// Nav-collision check: within each launch locale, nav.* values must be unique.
for (const col of ['T-en', 'T-fr', 'T-sw', 'T-ha', 'T-tw']) {
  const src = fs.readFileSync('src/i18n/columns/' + col + '.js', 'utf8');
  const seen = {};
  for (const m of src.matchAll(/"(nav\.[a-zA-Z]+)":\s*"([^"]+)"/g)) {
    const v = m[2].toLowerCase();
    if (seen[v]) E.push(col + ': nav label collision — ' + seen[v] + ' and ' + m[1] + ' both render "' + m[2] + '"');
    else seen[v] = m[1];
  }
}

if (E.length) { console.error('[check:i18n-farmer-gate] FAIL:'); for (const e of E) console.error('  - ' + e); process.exit(1); }
console.log('[check:i18n-farmer-gate] PASS — farmer-facing unregistered keys: ' + scan.farmerMissing
  + ' (baseline ' + base.farmerMissing + ', ratchet: can only fall); nav labels unique per locale.');
