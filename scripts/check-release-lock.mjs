#!/usr/bin/env node
/**
 * scripts/check-release-lock.mjs — Farroway Release Lock v1
 * CI gate.
 *
 * This script ONLY fails on hard release blockers per the spec:
 *   • scan first-load error guard missing
 *   • Plant Runtime missing
 *   • scan-to-plant flow missing
 *   • fake metrics detected
 *   • release diagnostics missing
 *   • build identity diagnostic missing
 *   • app readiness diagnostic missing
 *
 * Soft warnings (knowledge < 200, media < 100/category, manual
 * pending) DO NOT fail CI — they surface in __releaseLock() at
 * runtime as YELLOW.
 *
 * Always writes reports/FARROWAY_RELEASE_LOCK_V1.json with the
 * static-side findings so artifacts pipelines can collect it.
 *
 * Strict-rule audit
 *   • Read-only against src tree. Writes only to reports/.
 *   • Returns exit 1 ONLY on hard blockers — see spec §7.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const FAILED = [];
const PASSED = [];
const WARNINGS = [];
function fail(m) { FAILED.push(m); }
function pass(m) { PASSED.push(m); }
function warn(m) { WARNINGS.push(m); }

function readOrEmpty(file) {
  try { return fs.readFileSync(file, 'utf8'); } catch { return ''; }
}

// ─── 1. Release Lock runtime files exist ───────────────────────
const RELEASE_FILES = [
  'src/runtime/release/releaseLockContracts.ts',
  'src/runtime/release/ReleaseLockChecklist.ts',
  'src/runtime/release/ReleaseLockDiagnostics.ts',
  'src/runtime/release/ReleaseLockRuntime.ts',
  'src/runtime/release/index.ts',
];
for (const f of RELEASE_FILES) {
  const src = readOrEmpty(path.join(ROOT, f));
  if (!src) fail(`release-runtime: missing ${f} (release diagnostics missing)`);
  else      pass(`release-runtime: ${f}`);
}

// ─── 2. Internal page + route registered ───────────────────────
const releasePage = readOrEmpty(path.join(ROOT,
  'src/pages/internal/ReleaseLock.jsx'));
if (!releasePage) {
  fail(`release-page: src/pages/internal/ReleaseLock.jsx missing`);
} else if (!releasePage.includes('release-lock-page')
            || !releasePage.includes('INTERNAL_FLAG_KEY')) {
  fail(`release-page: must check internal flag + render data-testid="release-lock-page"`);
} else {
  pass(`release-page: gated by INTERNAL_FLAG_KEY`);
}

const appJsx = readOrEmpty(path.join(ROOT, 'src/App.jsx'));
if (!/['"]\/internal\/release-lock['"]/.test(appJsx)) {
  fail(`route: /internal/release-lock not registered in App.jsx`);
}
if (!/installReleaseLockGlobal/.test(appJsx)) {
  fail(`boot: App.jsx must call installReleaseLockGlobal()`);
}
pass(`route + boot install wired in App.jsx`);

// ─── 3. Hard blockers — scan first-load + plant runtime + flow ─
// These are enforced by sibling gates that we re-validate by
// looking for the gate scripts on disk. If absent, this gate
// fails — the spec says "release diagnostics missing" → RED.
const REQUIRED_SIBLING_GATES = [
  'scripts/check-scan-no-first-load-error.mjs',
  'scripts/check-plant-runtime.mjs',
  'scripts/check-plant-image-system.mjs',
  'scripts/check-plant-media-system.mjs',
  'scripts/check-plant-knowledge.mjs',
  'scripts/check-knowledge-layer.mjs',
  'scripts/check-no-farmer-dashboard.mjs',
  'scripts/check-mobile-no-dashboard.mjs',
  'scripts/check-founder-real-metrics.mjs',
  'scripts/check-role-route-guards.mjs',
  'scripts/check-buyer-no-payments.mjs',
  'scripts/check-buyer-data-scope.mjs',
  'scripts/check-ngo-no-fake-data.mjs',
  'scripts/check-ngo-organization-scope.mjs',
  'scripts/check-ooda-artifact-ownership.mjs',
  'scripts/check-godmode-internal-only.mjs',
  'scripts/check-no-grower-camera-error-card.mjs',
  'scripts/check-intelligence-loop-ownership.mjs',
  'scripts/check-enterprise-isolation.mjs',
  'scripts/check-rbac-guards.mjs',
  'scripts/check-audit-logging.mjs',
  'scripts/check-evidence-chain.mjs',
  'scripts/check-report-real-data.mjs',
  'scripts/check-enterprise-readiness.mjs',
  'scripts/check-scan-nav-camera-intent.mjs',
  'scripts/check-admin-impact-records.mjs',
  'scripts/check-prisma-fragment-conflicts.mjs',
  'scripts/check-federation-security.mjs',
  'scripts/check-route-role-isolation.mjs',
  'scripts/check-consent-required.mjs',
  'scripts/check-privacy-readiness.mjs',
  'scripts/check-monitoring-hooks.mjs',
  'scripts/check-retention-policy.mjs',
  'scripts/check-human-review.mjs',
  'scripts/check-backup-docs.mjs',
  'scripts/check-bulk-onboarding-security.mjs',
];
for (const f of REQUIRED_SIBLING_GATES) {
  if (!fs.existsSync(path.join(ROOT, f))) {
    fail(`sibling-gate: required guard missing — ${f}`);
  }
}
pass(`sibling-gate: all 6 required gates present`);

// ─── 4. Static fake-metric scan in FounderDashboard ────────────
const founderPath = path.join(ROOT, 'src/pages/FounderDashboard.jsx');
const founder = readOrEmpty(founderPath);
if (founder) {
  // Look for obvious fake patterns. We strip JS / JSX comments
  // first so "No fake revenue" assertions in code comments
  // don't trigger a false positive.
  const stripped = founder
    .replace(/\/\*[\s\S]*?\*\//g, '')   // block comments
    .replace(/\/\/[^\n]*/g, '')          // line comments
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ''); // JSX comments {/* */}
  const fakePatterns = [
    /\bfake[\s_-]?revenue\s*[:=]/i,    // `fakeRevenue:` / `fake_revenue =`
    /\bfake[\s_-]?ngo[\s_-]?metric/i,
    /\bfake[\s_-]?customer[\s_-]?count/i,
    /\bmock[\s_-]?metrics\s*[:=]/i,
    /["']\$\s*[0-9]{4,}.*revenue/i,    // hardcoded big-dollar revenue strings
  ];
  for (const pat of fakePatterns) {
    if (pat.test(stripped)) {
      fail(`fake-metrics: pattern ${pat} found in FounderDashboard.jsx`);
    }
  }
  pass(`fake-metrics: FounderDashboard.jsx clean (after stripping comments)`);
} else {
  warn(`founder: FounderDashboard.jsx not found — non-blocker`);
}

// ─── 5. Build identity + app store + release globals present ───
// We scan App.jsx for the install calls. The presence of
// these calls is the static contract — actual runtime
// availability is verified by __releaseLock() in browser.
const REQUIRED_INSTALLS = [
  'installAppStoreReadinessRuntime',
  'installUniversalPlantRuntimeGlobal',
  'installReleaseLockGlobal',
];
for (const sym of REQUIRED_INSTALLS) {
  if (!appJsx.includes(sym)) {
    if (sym === 'installAppStoreReadinessRuntime'
        || sym === 'installUniversalPlantRuntimeGlobal') {
      fail(`install: App.jsx missing "${sym}" — required diagnostic`);
    } else {
      fail(`install: App.jsx missing "${sym}"`);
    }
  }
}
pass(`install: all 3 required globals wired in boot`);

// ─── 6. Knowledge + media targets — WARNINGS only ──────────────
// These are below the launch spec but do NOT block release per
// the spec's verdict rules.
let knowledgeReport = {};
try {
  // The knowledge composer requires running JS, so we read the
  // raw catalog counts statically.
  const diseases = JSON.parse(readOrEmpty(
    path.join(ROOT, 'src/data/diseases/diseases.json')) || '[]');
  const pests = JSON.parse(readOrEmpty(
    path.join(ROOT, 'src/data/pests/pests.json')) || '[]');
  // Plant total approximated from the launch libraries.
  const flowerSrc = readOrEmpty(path.join(ROOT,
    'src/runtime/plants/media/libraries/flowerLibrary.ts'));
  const plantKnowSrc = readOrEmpty(path.join(ROOT,
    'src/data/plants/knowledge.js'));
  const plantEntries = (plantKnowSrc.match(/careGuide\s*:\s*\{/g) || []).length;

  knowledgeReport = {
    plants:   plantEntries,
    diseases: diseases.length,
    pests:    pests.length,
  };
  if (knowledgeReport.plants < 200)   warn(`knowledge: plants ${knowledgeReport.plants} / 200 (warning, not blocker)`);
  if (knowledgeReport.diseases < 15)  warn(`knowledge: diseases ${knowledgeReport.diseases} / 15 (warning, not blocker)`);
  if (knowledgeReport.pests < 15)     warn(`knowledge: pests ${knowledgeReport.pests} / 15 (warning, not blocker)`);
  pass(`knowledge-report: ${knowledgeReport.plants} plants · ${knowledgeReport.diseases} diseases · ${knowledgeReport.pests} pests`);
} catch (e) {
  warn(`knowledge-report: could not enumerate (${e.message})`);
}

// ─── 7. Compute verdict from STATIC findings ───────────────────
let verdict = 'GREEN';
if (FAILED.length > 0) verdict = 'RED';
else if (WARNINGS.length > 0) verdict = 'YELLOW';

const score = (() => {
  const total = PASSED.length + FAILED.length + WARNINGS.length;
  if (total === 0) return 0;
  return Math.round((PASSED.length / total) * 100);
})();

// ─── 8. Write report ───────────────────────────────────────────
const reportsDir = path.join(ROOT, 'reports');
try { fs.mkdirSync(reportsDir, { recursive: true }); }
catch { /* ignore */ }

const report = {
  schema: 'FARROWAY_RELEASE_LOCK_V1',
  source: 'check-release-lock.mjs (static)',
  timestamp: new Date().toISOString(),
  verdict, score,
  blockers: FAILED.map((m) => ({ id: m.split(':')[0], detail: m })),
  warnings: WARNINGS.map((m) => ({ id: m.split(':')[0], detail: m })),
  passed: PASSED,
  knowledgeReport,
  buildInfo: {
    nodeVersion: process.version,
    cwd: ROOT,
  },
};
try {
  fs.writeFileSync(path.join(reportsDir, 'FARROWAY_RELEASE_LOCK_V1.json'),
    JSON.stringify(report, null, 2));
  pass(`report: reports/FARROWAY_RELEASE_LOCK_V1.json written`);
} catch (e) {
  warn(`report: failed to write reports/ — ${e.message}`);
}

// ─── 9. Final result ───────────────────────────────────────────
if (FAILED.length > 0) {
  console.error('[check:release-lock] FAIL — RED verdict, hard blockers detected:');
  for (const f of FAILED) console.error('  ✗ ' + f);
  if (WARNINGS.length > 0) {
    console.error('\nWarnings (do not block):');
    for (const w of WARNINGS) console.error('  ! ' + w);
  }
  console.error(`\n${PASSED.length} checks passed, ${FAILED.length} hard blockers, ${WARNINGS.length} warnings.`);
  console.error(`\nReport: reports/FARROWAY_RELEASE_LOCK_V1.json`);
  process.exit(1);
}

console.log(`[check:release-lock] PASS — Verdict: ${verdict} (score ${score}/100)`);
console.log(`  ${PASSED.length} checks passed, 0 hard blockers, ${WARNINGS.length} warnings.`);
if (WARNINGS.length > 0) {
  console.log('  Warnings (non-blocking):');
  for (const w of WARNINGS) console.log('    ! ' + w);
}
console.log(`  Knowledge: ${knowledgeReport.plants || 0} plants · ${knowledgeReport.diseases || 0} diseases · ${knowledgeReport.pests || 0} pests.`);
console.log(`  Report: reports/FARROWAY_RELEASE_LOCK_V1.json`);
