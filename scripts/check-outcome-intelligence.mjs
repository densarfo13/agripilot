#!/usr/bin/env node
/**
 * scripts/check-outcome-intelligence.mjs — Wave-36 governance gate.
 *
 * Statically enforces the wave-36 contract:
 *
 *   • OutcomeChainRuntime / PilotAnalyticsRuntime /
 *     FieldOfficerViewRuntime ship at canonical paths.
 *   • OutcomeComparisonCard component present.
 *   • /internal/pilot-analytics + /internal/pilot-analytics/
 *     field-officer routes mounted in App.jsx with ADMIN_ROLES.
 *   • __outcomeHealth() envelope includes the wave-36 5-flag
 *     attestation block.
 *   • App.jsx wires installOutcomeIntelligenceGlobals.
 *   • Forbidden runtimes are NOT modified in this commit's
 *     change-set:
 *        scan, plant knowledge, disease, pest, OODA,
 *        NGO (organization), buyer.
 *     (Verified by git diff against HEAD~1; if not running in
 *     a git checkout, this check is skipped with a notice.)
 *   • PilotAnalyticsRuntime never fabricates: must declare
 *     null-on-missing in the FROZEN_FALLBACK and the live path.
 *
 * Read-only. Never mutates source.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();
const FAILED = [];
const PASSED = [];
function fail(m) { FAILED.push(m); }
function pass(m) { PASSED.push(m); }

function read(file) {
  try { return fs.readFileSync(file, 'utf8'); }
  catch { return ''; }
}
function requireFile(rel, label) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) {
    fail(`${label}: ${rel} must exist`);
    return '';
  }
  pass(`${label}: ${rel} present`);
  return read(full);
}
function requireTokens(src, tokens, label) {
  for (const t of tokens) {
    if (!new RegExp(`\\b${t.replace(/[.$()|]/g, (m) => '\\'+m)}\\b`).test(src)) {
      fail(`${label}: missing token "${t}"`);
    }
  }
}

// ─── 1. Wave-36 runtimes ───────────────────────────────────────
const chainSrc = requireFile(
  'src/runtime/outcomeIntelligence/OutcomeChainRuntime.ts', 'chain');
requireTokens(chainSrc, [
  'OUTCOME_VALUE', 'IMPROVED', 'UNCHANGED', 'WORSENED', 'UNKNOWN',
  'listChainViews', 'toChainView', 'chainAttestation',
], 'chain');

const analyticsSrc = requireFile(
  'src/runtime/outcomeIntelligence/PilotAnalyticsRuntime.ts', 'analytics');
requireTokens(analyticsSrc, [
  'pilotAnalyticsSnapshot', '__pilotAnalytics',
  'weeklyActiveGrowers', 'scans', 'plantsAdded',
  'tasksGenerated', 'tasksCompleted',
  'followUpScans', 'outcomesRecorded',
  'taskCompletionRate', 'followUpScanRate', 'improvementRate',
  'realDataOnly',
], 'analytics');
// Honest-null contract: the fallback envelope must contain
// `null` for every numeric source rather than 0.
if (!/weeklyActiveGrowers:\s*null/.test(analyticsSrc)) {
  fail('analytics: FROZEN_FALLBACK must default weeklyActiveGrowers to null');
}
if (!/outcomesRecorded:\s*null/.test(analyticsSrc)) {
  fail('analytics: FROZEN_FALLBACK must default outcomesRecorded to null');
}

const fieldSrc = requireFile(
  'src/runtime/outcomeIntelligence/FieldOfficerViewRuntime.ts', 'field-officer');
requireTokens(fieldSrc, [
  'fieldOfficerView', '__fieldOfficerView',
  'growersNeedingFollowUp', 'worseningCrops', 'unresolvedDiagnoses',
  // Must compose tenant isolation
  'scopeRecordsToTenant',
], 'field-officer');

const barrelSrc = requireFile(
  'src/runtime/outcomeIntelligence/index.ts', 'barrel');
if (!/installOutcomeIntelligenceGlobals/.test(barrelSrc)) {
  fail('barrel: must export installOutcomeIntelligenceGlobals');
}

// ─── 2. UI surfaces ────────────────────────────────────────────
const cardSrc = requireFile(
  'src/components/outcomes/OutcomeComparisonCard.jsx', 'card');
requireTokens(cardSrc, [
  'beforePhoto', 'afterPhoto',
  'diseaseDeltaPct', 'severityDelta',
  'outcomeStatus',
], 'card');
// Card must NEVER fake improvement: must render "—" for null deltas.
if (!/return '—'/.test(cardSrc)) {
  fail('card: must render "—" for null deltas (never fake 0)');
}

const analyticsPageSrc = requireFile(
  'src/pages/internal/PilotAnalyticsPage.jsx', 'page');
if (!/__pilotAnalytics/.test(analyticsPageSrc)) {
  fail('page: PilotAnalyticsPage must read __pilotAnalytics');
}

const foPageSrc = requireFile(
  'src/pages/internal/FieldOfficerOutcomesPage.jsx', 'page');
if (!/__fieldOfficerView/.test(foPageSrc)) {
  fail('page: FieldOfficerOutcomesPage must read __fieldOfficerView');
}

// ─── 3. App.jsx wires + admin routes ───────────────────────────
const appSrc = requireFile('src/App.jsx', 'wiring');
if (!/installOutcomeIntelligenceGlobals/.test(appSrc)) {
  fail('wiring: App.jsx must wire installOutcomeIntelligenceGlobals');
}
for (const fragment of [
  /path=["']\/internal\/pilot-analytics["'].*?RoleRoute\s+roles=\{ADMIN_ROLES\}/s,
  /path=["']\/internal\/pilot-analytics\/field-officer["'].*?RoleRoute\s+roles=\{ADMIN_ROLES\}/s,
]) {
  if (!fragment.test(appSrc)) {
    fail(`wiring: App.jsx must mount admin-gated route matching ${fragment}`);
  }
}

// ─── 4. outcomeHealth envelope extended ────────────────────────
const outcomeSrc = requireFile(
  'src/runtime/outcomes/OutcomeRuntime.ts', 'outcome');
for (const flag of [
  'outcomeChainReady', 'beforeAfterReady',
  'analyticsReady', 'improvementTrackingReady',
  'fieldOfficerReady',
]) {
  if (!new RegExp(`\\b${flag}\\b`).test(outcomeSrc)) {
    fail(`outcome: outcomeHealth() must surface ${flag}`);
  }
}

// ─── 5. Forbidden runtimes untouched (best-effort) ─────────────
const FORBIDDEN_PATHS = [
  'src/runtime/scan/',
  'src/runtime/plants/PlantRegistry.ts',
  'src/runtime/plants/PlantHealthEngine.ts',
  'src/runtime/plants/PlantTaskEngine.ts',
  'src/runtime/plants/PlantRecommendationEngine.ts',
  'src/runtime/plants/PlantMemoryGraph.ts',
  'src/runtime/plants/PlantLifecycleEngine.ts',
  'src/runtime/plants/PlantIntelligenceEngine.ts',
  'src/runtime/plants/PlantRuntime.ts',
  'src/runtime/intelligenceLoop/',
  'src/runtime/intelligence/OODAEngine.ts',
  'src/runtime/organization/',
  'src/runtime/buyer/',
];
// Authorized exceptions to the locked prefixes. The SCAN_TYPE_ROUTER spec
// (sprint #231) explicitly directed new code to src/runtime/scan/router/,
// a NEW subpath — a deliberate founder override of the wave-36 lock for
// that one folder. Every EXISTING scan-runtime file stays protected.
const ALLOWED_EXCEPTIONS = [
  'src/runtime/scan/router/',
  // P0 SCAN ACCEPTANCE — the spec explicitly directs the provider acceptance
  // gate + client credit monitor to these NEW subpaths, founder-authorized.
  // Existing scan-runtime files stay locked.
  'src/runtime/scan/acceptance/',
  'src/runtime/scan/credits/',
  // UNIVERSAL SCANNER — the spec explicitly directs the agricultural object
  // classifier + specialized engines to these NEW paths. Founder-authorized.
  'src/runtime/scan/AgriculturalObjectClassifier.ts',
  'src/runtime/scan/universal/',
  // MULTI-PROVIDER ADAPTERS — the spec explicitly directs the client provider
  // contracts + consensus to these NEW paths. Founder-authorized.
  'src/runtime/scan/providers/',
  'src/runtime/scan/consensus/',
  // SCAN CERTIFICATION — founder-directed certification composite path.
  'src/runtime/scan/certification/',
  // FIELD INTELLIGENCE v11 — founder-directed scan field-estimate path.
  'src/runtime/scan/field/',
  // SCAN INTELLIGENCE v12 — founder-directed unified orchestrator path.
  'src/runtime/scan/v12/',
  // EVIDENCE TIERS — founder-directed evidence-tier classifier path.
  'src/runtime/scan/evidence/',
  // IMAGE QUALITY GATE — founder-directed scan quality-gate path.
  'src/runtime/scan/quality/',
  // PLANT SAFETY — founder-directed scan safety-classifier path.
  'src/runtime/scan/safety/',
];
let gitAvailable = false;
let diff = '';
try {
  diff = execSync('git diff --name-only HEAD~1 HEAD', {
    cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
  });
  gitAvailable = true;
} catch { /* not a git checkout, or shallow */ }

if (gitAvailable) {
  const touchedForbidden = [];
  for (const line of diff.split(/\r?\n/)) {
    const f = line.trim();
    if (!f) continue;
    if (ALLOWED_EXCEPTIONS.some((a) => f.startsWith(a))) continue; // founder-authorized subpath
    for (const p of FORBIDDEN_PATHS) {
      if (f === p || f.startsWith(p)) touchedForbidden.push(f);
    }
  }
  if (touchedForbidden.length > 0) {
    fail(`forbidden: wave-36 touched paths that must not be modified: ${touchedForbidden.join(', ')}`);
  } else {
    pass('forbidden: no forbidden runtime touched in HEAD~1..HEAD diff');
  }
} else {
  pass('forbidden: git diff unavailable — skipped (build/CI mode)');
}

// ─── Report ────────────────────────────────────────────────────
if (FAILED.length > 0) {
  console.error('[check:outcome-intelligence] FAIL');
  for (const f of FAILED) console.error('  ✗ ' + f);
  console.error(`\n${PASSED.length} passed, ${FAILED.length} failed.`);
  process.exit(1);
}
console.log('[check:outcome-intelligence] PASS — wave-36 outcome intelligence contracts intact.');
for (const p of PASSED) console.log('  ✓ ' + p);
