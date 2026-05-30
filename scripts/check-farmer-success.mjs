#!/usr/bin/env node
/**
 * scripts/check-farmer-success.mjs — wave-37.5 governance gate.
 *
 * Statically enforces:
 *   • FarmerSuccessEngine ships at canonical path with all 8
 *     installer globals + 6 composite-health flags.
 *   • Honest contract: no fake scores, no hardcoded risks, no
 *     invented weather, no invented outcomes.
 *   • Engine imports REAL data sources (listOutcomes,
 *     readStoredEvents) — not hardcoded constants.
 *   • All recommendations originate from: weather, tasks,
 *     scan results, crop stage, outcomes. The engine MUST
 *     compose against at least one of __taskStoreHealth,
 *     __diseaseLeaderboard, __pestLeaderboard,
 *     __farmHealthScore, __yieldReadiness, __farrowayWeather.
 *   • App.jsx wires installFarmerSuccessGlobals.
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

// ─── 1. Contracts ──────────────────────────────────────────────
const contractsSrc = requireFile(
  'src/runtime/farmerSuccess/farmerSuccessContracts.ts', 'contracts');
requireTokens(contractsSrc, [
  'FARMER_SUCCESS_RUNTIME_VERSION',
  'URGENCY', 'NOW', 'THIS_WEEK', 'WATCH',
  'RISK_SEVERITY', 'HIGH', 'MEDIUM', 'LOW',
  'SUCCESS_LEVEL', 'EXCELLENT', 'GOOD', 'NEEDS_ATTENTION',
  'EMPTY_FRIENDLY', 'OVERDUE_COPY',
], 'contracts');

// ─── 2. Engine ─────────────────────────────────────────────────
const engineSrc = requireFile(
  'src/runtime/farmerSuccess/FarmerSuccessEngine.ts', 'engine');

// Real-data composition imports.
requireTokens(engineSrc, [
  'listOutcomes', 'readStoredEvents',
  // 8 globals
  '__todayPriority', '__dailyActions',
  '__farmRisk', '__missedActions',
  '__farmSuccessScore', '__weeklyFarmSummary',
  '__farmerVoiceLines', '__farmerSuccessHealth',
  // 6 composite-health flags
  'priorityEngineReady', 'dailyActionsReady',
  'farmRiskReady', 'successScoreReady',
  'summaryReady', 'voiceReady',
  // installer
  'installFarmerSuccessGlobals',
], 'engine');

// Honest contract — gate forbids hardcoded "risk" names that
// would invent rather than compose. The engine MUST surface
// names from real leaderboards or outcome records, NOT from
// string literals embedded here. Allowed risk literals: the
// generic category labels enumerated in the spec.
const ALLOWED_GENERIC_RISK_NAMES = new Set([
  'Disease worsening',
  'High pest pressure',
  'Missed action',
  'Missed irrigation',
  'Harvest delay',
]);
// Forbid specific disease/pest hardcoded names — these MUST
// come from __diseaseLeaderboard / __pestLeaderboard entries
// (which themselves derive from real outcome data).
const FORBIDDEN_SPECIFIC_NAMES = [
  "'Fall Armyworm'", "'Tomato Leaf Spot'", "'Late Blight'",
  "'Early Blight'", "'Powdery Mildew'", "'Aphids'",
  "'Whitefly'", "'Spider Mite'",
];
for (const tok of FORBIDDEN_SPECIFIC_NAMES) {
  if (engineSrc.includes(tok)) {
    fail(`engine: forbidden hardcoded risk literal ${tok} — must come from real leaderboard data`);
  }
}

// Honest contract — no hardcoded score literal in return envelopes.
if (/return Object\.freeze\(\{[^}]*\bscore:\s*\d+\b[^}]*\}\)/m.test(engineSrc)) {
  fail('engine: hardcoded score literal in return — must derive from real data');
}

// Honest contract — must compose at least ONE of the canonical
// data-source probes. We accept any of the wave-37 / task-store /
// weather globals to prove composition (rather than fabrication).
const REQUIRED_COMPOSE_HITS = [
  '__taskStoreHealth',
  '__diseaseLeaderboard',
  '__pestLeaderboard',
  '__farmHealthScore',
  '__yieldReadiness',
  '__farrowayWeather',
];
let composeHits = 0;
for (const probe of REQUIRED_COMPOSE_HITS) {
  if (engineSrc.includes(probe)) composeHits++;
}
if (composeHits < 3) {
  fail(`engine: must compose against at least 3 canonical probes (weather/tasks/scan/crop-stage/outcomes); found ${composeHits}`);
}

// Honest contract — invented-weather check. The engine MUST gate
// its weather block behind a real probe read.
if (!/_weatherSnapshot|__farrowayWeather/.test(engineSrc)) {
  fail('engine: must read weather from a real probe (no invented weather)');
}

// Honest contract — invented-outcome check. The engine MUST gate
// outcome lookups behind listOutcomes().
if (!/listOutcomes\(\)/.test(engineSrc)) {
  fail('engine: must read outcomes from listOutcomes() (no invented outcomes)');
}

// ─── 3. App.jsx wires ──────────────────────────────────────────
const appSrc = requireFile('src/App.jsx', 'wiring');
if (!/installFarmerSuccessGlobals/.test(appSrc)) {
  fail('wiring: App.jsx must wire installFarmerSuccessGlobals');
}

// ─── Report ────────────────────────────────────────────────────
if (FAILED.length > 0) {
  console.error('[check:farmer-success] FAIL');
  for (const f of FAILED) console.error('  ✗ ' + f);
  console.error(`\n${PASSED.length} passed, ${FAILED.length} failed.`);
  process.exit(1);
}
console.log('[check:farmer-success] PASS — wave-37.5 farmer success contracts intact.');
for (const p of PASSED) console.log('  ✓ ' + p);
