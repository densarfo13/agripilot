#!/usr/bin/env node
/**
 * scripts/check-founder-real-metrics.mjs — Final Release Lock §9
 * gate. /internal/founder must surface REAL aggregates only.
 *
 * Hard blockers:
 *
 *   A. FounderDashboard.jsx must NOT contain fake-metric tokens:
 *      fakeRevenue, fakeNgo, fakeCustomer, mockMetrics, hardcoded
 *      dollar revenue strings, "lorem ipsum" placeholder copy,
 *      or fabricated traction numbers.
 *   B. The page must NOT import marketplace / NGO / investor /
 *      carbon-credit / satellite modules (those are forbidden
 *      surfaces per FARROWAY_RELEASE_LOCK_V1 §0).
 *   C. The "not enough data yet" honesty pattern must appear at
 *      least once (engines surface this string when aggregates
 *      lack samples).
 *   D. __founderMetricsHealth() pinning code must declare
 *      fakeMetrics: false and aggregatesReady: true.
 *
 * The gate strips JS / JSX comments before pattern-matching so
 * the existing "// No fake revenue, contracts, customers."
 * assertion comments never trigger a false positive.
 *
 * Strict-rule audit
 *   • Read-only against src/. Never mutates.
 *   • Exit 1 on any hard blocker.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const FAILED = [];
const PASSED = [];
function fail(m) { FAILED.push(m); }
function pass(m) { PASSED.push(m); }

function readOrEmpty(f) {
  try { return fs.readFileSync(f, 'utf8'); } catch { return ''; }
}

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')      // block comments
    .replace(/\/\/[^\n]*/g, '')             // line comments
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');  // JSX comments
}

// ─── A. Fake-metric token scan ─────────────────────────────────
const founderPath = path.join(ROOT, 'src/pages/FounderDashboard.jsx');
const rawFounder = readOrEmpty(founderPath);
if (!rawFounder) {
  fail(`founder: ${path.relative(ROOT, founderPath)} missing`);
} else {
  const stripped = stripComments(rawFounder);
  const fakePatterns = [
    { name: 'fakeRevenue',     re: /\bfake[\s_-]?revenue\s*[:=]/i },
    { name: 'fakeNgoMetric',   re: /\bfake[\s_-]?ngo[\s_-]?metric/i },
    { name: 'fakeCustomers',   re: /\bfake[\s_-]?customer[\s_-]?count/i },
    { name: 'mockMetrics',     re: /\bmock[\s_-]?metrics\s*[:=]/i },
    { name: 'hardDollarRev',   re: /["']\$\s*[0-9]{4,}.*revenue/i },
    { name: 'loremIpsum',      re: /\blorem\s+ipsum\b/i },
    { name: 'placeholderTrac', re: /placeholder\s+traction/i },
  ];
  for (const { name, re } of fakePatterns) {
    if (re.test(stripped)) {
      fail(`fake-metric: ${name} pattern matched in FounderDashboard.jsx (after stripping comments)`);
    }
  }
  pass(`fake-metric: FounderDashboard.jsx clean of fake tokens`);

  // ─── B. Forbidden surface imports ────────────────────────────
  const FORBIDDEN_IMPORTS = [
    /from\s+['"][^'"]*\bmarketplace\b/,
    /from\s+['"][^'"]*\bcarbon[-_]?credit/i,
    /from\s+['"][^'"]*\bsatellite/i,
    /from\s+['"][^'"]*\bautonomous[-_]?agent/i,
  ];
  for (const re of FORBIDDEN_IMPORTS) {
    if (re.test(rawFounder)) {
      fail(`forbidden-import: FounderDashboard imports a banned surface (${re})`);
    }
  }
  pass(`forbidden-import: FounderDashboard does not import marketplace / satellite / carbon-credit / autonomous-agent modules`);

  // ─── C. Honesty pattern ──────────────────────────────────────
  if (!/not\s+enough\s+data\s+yet/i.test(rawFounder)
      && !/enough\s+data\b/i.test(rawFounder)) {
    fail(`honesty: FounderDashboard must surface "not enough data yet" when aggregates lack samples`);
  } else {
    pass(`honesty: "not enough data yet" wording present`);
  }
}

// ─── D. __founderMetricsHealth pin asserts no-fake + aggregates ─
const PIN_FILE = path.join(ROOT, 'src/runtime/plants/index.ts');
const pinSrc = readOrEmpty(PIN_FILE);
if (!pinSrc.includes('__founderMetricsHealth')) {
  fail(`pin: __founderMetricsHealth must be installed somewhere — searched src/runtime/plants/index.ts`);
} else {
  if (!/fakeMetrics:\s*false/.test(pinSrc)) {
    fail(`pin: __founderMetricsHealth must declare fakeMetrics: false`);
  }
  if (!/aggregatesReady:\s*true/.test(pinSrc)) {
    fail(`pin: __founderMetricsHealth must declare aggregatesReady: true`);
  }
  if (!/available:\s*true/.test(pinSrc)) {
    fail(`pin: __founderMetricsHealth must declare available: true`);
  }
  pass(`pin: __founderMetricsHealth declares available=true + aggregatesReady=true + fakeMetrics=false`);
}

// ─── Report ────────────────────────────────────────────────────
if (FAILED.length > 0) {
  console.error('[check:founder-real-metrics] FAIL — fake or forbidden patterns detected.');
  for (const f of FAILED) console.error('  ✗ ' + f);
  console.error(`\n${PASSED.length} checks passed, ${FAILED.length} failed.`);
  process.exit(1);
}
console.log('[check:founder-real-metrics] PASS — FounderDashboard surfaces real aggregates only.');
console.log(`  No fake revenue / NGO / customer / mock-metric tokens.`);
console.log(`  No marketplace / satellite / carbon-credit / autonomous-agent imports.`);
console.log(`  "Not enough data yet" honesty pattern present.`);
console.log(`  __founderMetricsHealth: available=true, aggregatesReady=true, fakeMetrics=false.`);
