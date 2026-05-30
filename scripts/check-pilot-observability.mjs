#!/usr/bin/env node
/**
 * scripts/check-pilot-observability.mjs — wave-38 governance gate.
 *
 * Statically enforces:
 *   • PilotObservabilityRuntime ships at canonical path with all
 *     6 installer globals + 5-flag composite-health envelope.
 *   • Runtime composes REAL data sources (listOutcomes +
 *     readStoredEvents) — gate fails if either import is missing.
 *   • Empty-state copy is the canonical "Not enough data yet".
 *   • No hardcoded adoption counts in return envelopes.
 *   • /internal/ngo-health route admin-gated in App.jsx.
 *   • App.jsx wires installPilotObservabilityGlobals.
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

// ─── 1. Runtime ────────────────────────────────────────────────
const runtimeSrc = requireFile(
  'src/runtime/pilotObservability/PilotObservabilityRuntime.ts',
  'runtime');

requireTokens(runtimeSrc, [
  // Real data imports
  'listOutcomes', 'readStoredEvents',
  // 6 globals
  '__activationHealth', '__adoptionFunnel',
  '__scanSuccessMetrics', '__pilotAlerts',
  '__ngoCommandHealth', '__pilotHealth',
  // composite-health envelope keys
  'adoptionReady', 'retentionReady',
  'ngoReady', 'scanReady', 'observabilityReady',
  // activation envelope keys
  'accountsCreated', 'profilesCompleted', 'farmsCreated',
  'plantsAdded', 'firstScanCompleted', 'firstTaskCompleted',
  // funnel
  'dropoffPercent', 'stages',
  // scan success keys
  'totalScans', 'successfulScans', 'failedScans',
  'timeouts', 'unknownPlants', 'lowConfidenceDetections',
  // installer
  'installPilotObservabilityGlobals',
  // canonical empty-state copy
  'Not enough data yet',
], 'runtime');

// Honest contract — no hardcoded adoption-count literal in return.
const HARDCODED_COUNT_PATTERNS = [
  /return Object\.freeze\(\{[^}]*\baccountsCreated:\s*\d+\b[^}]*\}\)/m,
  /return Object\.freeze\(\{[^}]*\bplantsAdded:\s*\d+\b[^}]*\}\)/m,
  /return Object\.freeze\(\{[^}]*\bfarmsCreated:\s*\d+\b[^}]*\}\)/m,
  /return Object\.freeze\(\{[^}]*\binvitesSent:\s*\d+\b[^}]*\}\)/m,
];
for (const re of HARDCODED_COUNT_PATTERNS) {
  if (re.test(runtimeSrc)) {
    fail(`runtime: hardcoded count literal in return envelope — must derive from real data (matched ${re})`);
  }
}

// ─── 2. NGO Health page ────────────────────────────────────────
const ngoPageSrc = requireFile(
  'src/pages/internal/NGOHealthPage.jsx', 'page');
requireTokens(ngoPageSrc, [
  '__ngoCommandHealth', '__inviteHealth', '__pilotAlerts',
  'Not enough data yet',
], 'page');

// ─── 3. App.jsx wires + admin gating ───────────────────────────
const appSrc = requireFile('src/App.jsx', 'wiring');
if (!/installPilotObservabilityGlobals/.test(appSrc)) {
  fail('wiring: App.jsx must wire installPilotObservabilityGlobals');
}
if (!/path=["']\/internal\/ngo-health["'][\s\S]*?RoleRoute\s+roles=\{ADMIN_ROLES\}/.test(appSrc)) {
  fail('wiring: App.jsx must mount /internal/ngo-health with ADMIN_ROLES');
}

// ─── Report ────────────────────────────────────────────────────
if (FAILED.length > 0) {
  console.error('[check:pilot-observability] FAIL');
  for (const f of FAILED) console.error('  ✗ ' + f);
  console.error(`\n${PASSED.length} passed, ${FAILED.length} failed.`);
  process.exit(1);
}
console.log('[check:pilot-observability] PASS — wave-38 pilot observability contracts intact.');
for (const p of PASSED) console.log('  ✓ ' + p);
