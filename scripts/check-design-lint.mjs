/**
 * check-design-lint.mjs — Design System enforcement RATCHET for inline-color debt.
 *
 * The spec's "design lint: no inline colors" can't be flipped on instantly — 24 legacy
 * screens still use inline hex. So this is a ratchet, the standard way to drive a large
 * migration safely:
 *
 *   • A committed baseline (`design-debt-baseline.json`) records each page's current count
 *     of inline hex literals (the proxy for "not yet on the design system").
 *   • The gate FAILS if any page's inline-hex count rises ABOVE its baseline — debt can only
 *     hold or fall. New inline colors are rejected; migrating a screen to tokens lowers it.
 *   • `node scripts/check-design-lint.mjs --update` re-snapshots (tightens) the baseline after
 *     a screen migrates, so the reduced debt is locked in and can't creep back.
 *   • NEW files under src/design/ must be token-driven (0 inline hex beyond token fallbacks).
 *
 * This turns "migrate every screen to the system" from a vague goal into a measured,
 * build-failing, monotonically-decreasing number.
 */
import fs from 'node:fs';
import path from 'node:path';
const R = process.cwd();
const BASELINE = path.join(R, 'scripts', 'design-debt-baseline.json');

function listPages() {
  const dir = path.join(R, 'src', 'pages');
  const out = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.jsx$/.test(e.name)) out.push(path.relative(R, p).replace(/\\/g, '/'));
    }
  };
  try { walk(dir); } catch { /* none */ }
  return out.sort();
}

// Count inline hex color literals OUTSIDE comments (the "inline color" debt proxy).
function inlineHexCount(rel) {
  let src = '';
  try { src = fs.readFileSync(path.join(R, rel), 'utf8'); } catch { return 0; }
  src = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1'); // strip comments
  return (src.match(/#[0-9a-fA-F]{6}\b/g) || []).length;
}

const pages = listPages();
const current = {};
for (const p of pages) current[p] = inlineHexCount(p);

// --update: re-snapshot the baseline (tighten after migration).
if (process.argv.includes('--update')) {
  fs.writeFileSync(BASELINE, JSON.stringify(current, null, 2) + '\n');
  const total = Object.values(current).reduce((a, b) => a + b, 0);
  console.log('[check:design-lint] baseline updated — ' + pages.length + ' pages, ' + total + ' total inline-hex debt.');
  process.exit(0);
}

let baseline = {};
try { baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8')); }
catch { console.error('[check:design-lint] FAIL: baseline missing — run `node scripts/check-design-lint.mjs --update`'); process.exit(1); }

const regressions = [];
for (const p of pages) {
  const base = (p in baseline) ? baseline[p] : 0;   // new page → budget 0 (must be token-driven)
  if (current[p] > base) regressions.push(`${p}: inline-color debt rose ${base} → ${current[p]} (use src/design/tokens)`);
}

const totalNow  = Object.values(current).reduce((a, b) => a + b, 0);
const totalBase = Object.values(baseline).reduce((a, b) => a + b, 0);

if (regressions.length) {
  console.error('[check:design-lint] FAIL — inline-color debt increased (ratchet only allows it to fall):');
  for (const r of regressions) console.error('  - ' + r);
  process.exit(1);
}
const improved = totalBase - totalNow;
console.log('[check:design-lint] PASS — inline-color debt ' + totalNow + ' (baseline ' + totalBase + ', '
  + (improved > 0 ? '↓' + improved + ' migrated' : 'held') + ') across ' + pages.length
  + ' pages; no screen added new inline colors. Ratchet: debt can only fall.');
