#!/usr/bin/env node
/**
 * scripts/check-tsafe-non-empty-fallbacks.mjs — Wave-27 CI gate.
 *
 * Fails the build when a tSafe() call passes an empty string as
 * the fallback in any of the wave-27 audited surfaces. The
 * founder-readiness audit (Part 2 #10, Part 4 §10) flagged
 * blank renders on missing i18n keys as a launch-day confusion
 * driver.
 *
 * Surfaces under the gate:
 *   • src/pages/buyer/BrowseListingsPage.jsx
 *   • src/pages/buyer/ListingDetailPage.jsx
 *   • src/components/market/BuyerInterestForm.jsx
 *   • src/pages/ReportsPage.jsx
 *
 * Read-only. Never mutates source.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const FAILED = [];
const PASSED = [];
function fail(m) { FAILED.push(m); }
function pass(m) { PASSED.push(m); }

const SURFACES = [
  'src/pages/buyer/BrowseListingsPage.jsx',
  'src/pages/buyer/ListingDetailPage.jsx',
  'src/components/market/BuyerInterestForm.jsx',
  'src/pages/ReportsPage.jsx',
];

// Match tSafe('key', '') with single OR double quotes.
//   tSafe('x', '')   tSafe("x", "")   tSafe('x', "")   tSafe("x", '')
// Multiline-tolerant; captures empty-string fallback as second arg.
const EMPTY_FALLBACK_RE =
  /tSafe\(\s*['"][^'"]+['"]\s*,\s*(?:''|"")\s*\)/g;

for (const file of SURFACES) {
  let src = '';
  try { src = fs.readFileSync(path.join(ROOT, file), 'utf8'); }
  catch { fail(`tsafe-fallbacks: cannot read ${file}`); continue; }

  const matches = src.match(EMPTY_FALLBACK_RE) || [];
  if (matches.length > 0) {
    for (const m of matches) {
      fail(`tsafe-fallbacks: ${file} — empty-string fallback in "${m}"`);
    }
  } else {
    pass(`tsafe-fallbacks: ${file} clean`);
  }
}

// Defence-in-depth — ReportsPage.jsx must call tSafe() at least
// once (it had ZERO calls pre-wave-27 per founder audit Part 4 §10).
const reports = (() => {
  try { return fs.readFileSync(path.join(ROOT, 'src/pages/ReportsPage.jsx'), 'utf8'); }
  catch { return ''; }
})();
if (reports && !/tSafe\(/.test(reports)) {
  fail(`tsafe-fallbacks: src/pages/ReportsPage.jsx must wrap visible English in tSafe`);
}

if (FAILED.length > 0) {
  console.error('[check:tsafe-non-empty-fallbacks] FAIL');
  for (const f of FAILED) console.error('  ✗ ' + f);
  console.error(`\n${PASSED.length} checks passed, ${FAILED.length} failed.`);
  process.exit(1);
}
console.log('[check:tsafe-non-empty-fallbacks] PASS — wave-27 audited surfaces use English fallbacks.');
for (const p of PASSED) console.log('  ✓ ' + p);
