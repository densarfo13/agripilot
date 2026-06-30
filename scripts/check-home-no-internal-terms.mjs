/**
 * check-home-no-internal-terms.mjs — Home world-class polish §4: internal/backend terms
 * must NEVER appear as farmer-facing text. The bug: FarmBrainBelowFold rendered the literal
 * "FarmBrain Confidence" + "Farm data quality" as visible titles (in every locale column),
 * which reads as unfinished/internal. This locks them out permanently.
 *
 * Scans: (1) the Home-rendered components' visible string literals, and (2) the i18n locale
 * column VALUES (keys may contain "farmBrain." — only the rendered VALUE is checked).
 */
import fs from 'node:fs';
import path from 'node:path';
const R = process.cwd();
const E = [];
const rd = (r) => { try { return fs.readFileSync(path.join(R, r), 'utf8'); } catch { return ''; } };

// Backend terms a farmer must never see. (Brand-internal / engineering jargon.)
const FORBIDDEN = ['FarmBrain', 'Farm data quality', 'Farm Data Quality', 'evidence tier',
  'confidence engine', 'Better data means better advice'];

// 1. Home-rendered component string literals (tSafe fallbacks / JSX text).
const COMPONENTS = [
  'src/components/farmBrain/FarmBrainBelowFold.jsx',
  'src/components/home/DecisionHero.jsx',
  'src/components/FarmReadinessCard.jsx',
];
for (const f of COMPONENTS) {
  const src = rd(f);
  if (!src) continue;
  for (const line of src.split(/\r?\n/)) {
    if (/^\s*(\*|\/\/|\/\*)/.test(line)) continue;           // skip comments
    if (/^\s*(import|export)\b/.test(line)) continue;        // skip module import/export lines
    // Only inspect quoted string literals (visible copy), not identifiers/keys/paths.
    const quoted = line.match(/(['"`])(?:\\.|(?!\1).)*\1/g) || [];
    for (const q of quoted) {
      const text = q.slice(1, -1);
      if (/^[a-zA-Z0-9_.]+$/.test(text)) continue;           // i18n key / testid / ident → skip
      if (/[/\\]/.test(text)) continue;                       // module path (e.g. ../runtime/farmBrain/…) → skip
      for (const term of FORBIDDEN)
        if (text.includes(term)) E.push(`${f}: farmer-facing string shows internal term "${term}": ${q}`);
    }
  }
}

// 2. i18n locale column VALUES — the actual rendered text.
const dir = 'src/i18n/columns';
let cols = [];
try { cols = fs.readdirSync(path.join(R, dir)).filter((f) => /^T-[a-z]{2}\.js$/.test(f)); } catch { /* none */ }
for (const c of cols) {
  const src = rd(path.join(dir, c));
  // Match "key": "value" — check only the value.
  const re = /"[^"]+"\s*:\s*"((?:\\.|[^"\\])*)"/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const value = m[1];
    for (const term of FORBIDDEN)
      if (value.includes(term)) E.push(`${dir}/${c}: locale VALUE shows internal term "${term}": "${value}"`);
  }
}

// §2 smart greeting — Home headline must be the action-oriented line, not the generic title.
const homeSrc = rd('src/pages/Home.jsx');
if (homeSrc) {
  if (!homeSrc.includes('home.headline.attention'))
    E.push('Home must render the action-oriented headline (home.headline.attention)');
  if (homeSrc.includes("'Today on Farroway'") || homeSrc.includes('"Today on Farroway"'))
    E.push('Home must NOT use the generic "Today on Farroway" headline (§2)');
}

if (E.length) { console.error('[check:home-no-internal-terms] FAIL:'); for (const e of E) console.error('  - ' + e); process.exit(1); }
console.log('[check:home-no-internal-terms] PASS — no internal/backend term (FarmBrain / data quality / '
  + 'evidence tier / confidence engine) appears as farmer-facing text in Home components or any locale value.');
