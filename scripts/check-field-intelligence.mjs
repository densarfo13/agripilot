#!/usr/bin/env node
/**
 * scripts/check-field-intelligence.mjs — wave-37 governance gate.
 *
 * Statically enforces:
 *   • FieldIntelligenceRuntime ships at canonical path with
 *     all 9 installer globals + 5 composite-health flags.
 *   • /internal/intelligence route is mounted ADMIN-only.
 *   • GoLiveHealthRuntime composes the 5 wave-37 flags.
 *   • Honest contract: no fabricated metrics, no hardcoded
 *     scores, no fabricated regions, no estimated treatment
 *     success.
 *   • App.jsx wires installFieldIntelligenceGlobals.
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

// ─── 1. Contracts file ─────────────────────────────────────────
const contractsSrc = requireFile(
  'src/runtime/fieldIntelligence/fieldIntelligenceContracts.ts',
  'contracts');
requireTokens(contractsSrc, [
  'FIELD_INTELLIGENCE_RUNTIME_VERSION',
  'TREND', 'UP', 'DOWN', 'STABLE',
  'YIELD_READINESS', 'LOW', 'MEDIUM', 'HIGH',
  'FARM_HEALTH_BAND', 'GOOD', 'WATCH', 'CRITICAL',
  'EMPTY_STATE',
], 'contracts');

// ─── 2. FieldIntelligenceRuntime ───────────────────────────────
const runtimeSrc = requireFile(
  'src/runtime/fieldIntelligence/FieldIntelligenceRuntime.ts',
  'runtime');

// Real-data composition: must import listOutcomes + readStoredEvents.
requireTokens(runtimeSrc, [
  'listOutcomes', 'readStoredEvents',
  // 9 globals + composite
  '__fieldIntelligenceHealth',
  '__diseaseLeaderboard', '__pestLeaderboard',
  '__treatmentEffectiveness', '__regionalRisk',
  '__farmHealthScore', '__ngoImpactHealth',
  '__buyerTrustHealth', '__yieldReadiness',
  // 5 composite-health flags
  'diagnosisTrackingReady', 'taskTrackingReady',
  'outcomeTrackingReady', 'trendTrackingReady',
  'intelligenceReady',
  // exported functions
  'diseaseLeaderboard', 'pestLeaderboard',
  'treatmentEffectiveness', 'regionalRisk',
  'farmHealthScore', 'ngoImpactHealth',
  'buyerTrustHealth', 'yieldReadiness',
  'installFieldIntelligenceGlobals',
], 'runtime');

// Honest-data gate: no fabricated regions allowed.
// "fabricated" = hardcoded region literal strings in the runtime.
// We expect regions to come from outcome record fields (region /
// organizationId). Permitted literals: 'STABLE', 'UP', 'DOWN',
// 'LOW', 'MEDIUM', 'HIGH', 'GOOD', 'WATCH', 'CRITICAL',
// EMPTY_STATE message, and contract enum keys.
const FORBIDDEN_REGION_LITERALS = [
  "'Ashanti'", "'Eastern'", "'Volta'", "'Greater Accra'",
  "'Lagos'", "'Nairobi'", "'Central'", "'Kano'",
];
for (const tok of FORBIDDEN_REGION_LITERALS) {
  if (runtimeSrc.includes(tok)) {
    fail(`runtime: forbidden hardcoded region literal "${tok}" — regions must come from real outcome data`);
  }
}

// Honest-data gate: hardcoded success-rate numbers in return env
// would indicate fabrication. Disallow `successRate: <number>`
// literal returns; only `successRate` reads / null / computed
// expressions allowed.
if (/return Object\.freeze\(\{[^}]*\bsuccessRate:\s*\d+\b[^}]*\}\)/m.test(runtimeSrc)) {
  fail('runtime: hardcoded successRate literal in return — must compute from outcome counts');
}
if (/return Object\.freeze\(\{[^}]*\bscore:\s*\d+\b[^}]*\}\)/m.test(runtimeSrc)) {
  fail('runtime: hardcoded score literal in return — must derive from real data');
}

// ─── 3. Dashboard page ─────────────────────────────────────────
const pageSrc = requireFile(
  'src/pages/internal/FieldIntelligencePage.jsx', 'page');
for (const probe of [
  '__fieldIntelligenceHealth', '__diseaseLeaderboard',
  '__pestLeaderboard', '__treatmentEffectiveness',
  '__regionalRisk', '__farmHealthScore',
  '__ngoImpactHealth', '__buyerTrustHealth',
  '__yieldReadiness',
]) {
  if (!new RegExp(probe).test(pageSrc)) {
    fail(`page: must read ${probe}`);
  }
}
if (!/Not enough field data yet/.test(pageSrc)) {
  fail('page: must use canonical empty-state copy "Not enough field data yet"');
}

// ─── 4. App.jsx wires + admin gating ───────────────────────────
const appSrc = requireFile('src/App.jsx', 'wiring');
if (!/installFieldIntelligenceGlobals/.test(appSrc)) {
  fail('wiring: App.jsx must wire installFieldIntelligenceGlobals');
}
if (!/path=["']\/internal\/intelligence["'][\s\S]*?RoleRoute\s+roles=\{ADMIN_ROLES\}/.test(appSrc)) {
  fail('wiring: App.jsx must mount /internal/intelligence with ADMIN_ROLES');
}

// ─── 5. GoLive composes wave-37 flags ──────────────────────────
const goLiveSrc = requireFile(
  'src/runtime/launchBlockers/GoLiveHealthRuntime.ts', 'go-live');
for (const flag of [
  'fieldIntelligenceReady', 'farmHealthReady',
  'regionalRiskReady', 'treatmentAnalyticsReady', 'ngoImpactReady',
  '__fieldIntelligenceHealth', '__farmHealthScore',
  '__regionalRisk', '__treatmentEffectiveness',
  '__ngoImpactHealth',
]) {
  if (!new RegExp(flag).test(goLiveSrc)) {
    fail(`go-live: must surface "${flag}"`);
  }
}

// ─── Report ────────────────────────────────────────────────────
if (FAILED.length > 0) {
  console.error('[check:field-intelligence] FAIL');
  for (const f of FAILED) console.error('  ✗ ' + f);
  console.error(`\n${PASSED.length} passed, ${FAILED.length} failed.`);
  process.exit(1);
}
console.log('[check:field-intelligence] PASS — wave-37 field intelligence contracts intact.');
for (const p of PASSED) console.log('  ✓ ' + p);
