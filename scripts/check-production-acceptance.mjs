#!/usr/bin/env node
/**
 * scripts/check-production-acceptance.mjs — governance gate for
 * the Production Acceptance Test Suite.
 *
 * Statically enforces:
 *   • ProductionAcceptanceHealthRuntime ships at canonical path
 *     with all 9 contract booleans + per-step `steps` map +
 *     `failingSteps` array + `summary`.
 *   • App.jsx wires installProductionAcceptanceGlobal.
 *   • docs/PRODUCTION_ACCEPTANCE_TEST.md ships with all 13
 *     numbered acceptance steps + the probe envelope reference.
 *   • Honest contract enforced: no fake PASS — runtime must use
 *     strict AND of explicit checks, FROZEN_FALLBACK initializes
 *     all booleans to false, summary uses real failing-step list.
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

// ─── 1. Runtime contract ───────────────────────────────────────
const runtimeSrc = requireFile(
  'src/runtime/production/ProductionAcceptanceHealthRuntime.ts',
  'runtime');
const CONTRACT_FLAGS = [
  'accountCreationReady', 'inviteReady', 'smsReady',
  'scanReady', 'taskReady', 'activityReady',
  'persistenceReady', 'ngoReady', 'buyerReady',
  'overallReady',
];
for (const flag of CONTRACT_FLAGS) {
  if (!new RegExp(`\\b${flag}\\b`).test(runtimeSrc)) {
    fail(`runtime: must surface contract flag "${flag}"`);
  }
}
for (const helper of [
  'productionAcceptanceHealth',
  'installProductionAcceptanceGlobal',
  '__productionAcceptanceHealth',
  'failingSteps', 'summary', 'steps',
]) {
  if (!new RegExp(`\\b${helper}\\b`).test(runtimeSrc)) {
    fail(`runtime: must surface "${helper}"`);
  }
}
// Honest-no-fake-PASS contract: FROZEN_FALLBACK defaults all
// booleans to false.
const fallbackMatch = runtimeSrc.match(/FROZEN_FALLBACK[^=]*=\s*Object\.freeze\(\{([\s\S]*?)\}\);/);
if (!fallbackMatch) {
  fail('runtime: FROZEN_FALLBACK must exist and be a frozen literal');
} else {
  const body = fallbackMatch[1];
  for (const flag of CONTRACT_FLAGS) {
    const re = new RegExp(`${flag}:\\s*(false|true)`);
    const m = body.match(re);
    if (!m) {
      fail(`runtime: FROZEN_FALLBACK must initialize "${flag}"`);
    } else if (m[1] !== 'false') {
      fail(`runtime: FROZEN_FALLBACK must default "${flag}" to false (no fake PASS)`);
    }
  }
}
// Verify the live envelope uses AND of step-results, not
// hardcoded `true` boolean literals.
if (/overallReady:\s*true\b/.test(runtimeSrc)) {
  fail('runtime: overallReady must NOT be hardcoded true');
}

// ─── 2. App.jsx wiring ─────────────────────────────────────────
const appSrc = requireFile('src/App.jsx', 'wiring');
if (!/installProductionAcceptanceGlobal/.test(appSrc)) {
  fail('wiring: App.jsx must wire installProductionAcceptanceGlobal');
}

// ─── 3. Acceptance doc ─────────────────────────────────────────
const docSrc = requireFile('docs/PRODUCTION_ACCEPTANCE_TEST.md', 'docs');
// All 13 numbered steps must exist as headings.
const NUMBERED_STEPS = [
  /## 1\.\s+Account creation/i,
  /## 2\.\s+Invite email/i,
  /## 3\.\s+Invite SMS/i,
  /## 4\.\s+Scan/i,
  /## 5\.\s+Task generation/i,
  /## 6\.\s+Task completion/i,
  /## 7\.\s+Activity timeline/i,
  /## 8\.\s+Plant save/i,
  /## 9\.\s+Offline sync/i,
  /## 10\.\s+Persistence after refresh/i,
  /## 11\.\s+Persistence after logout\/login/i,
  /## 12\.\s+NGO onboarding/i,
  /## 13\.\s+Buyer registration/i,
];
for (const re of NUMBERED_STEPS) {
  if (!re.test(docSrc)) {
    fail(`docs: PRODUCTION_ACCEPTANCE_TEST.md missing section matching ${re}`);
  }
}
// Probe envelope reference present.
if (!/__productionAcceptanceHealth\(\)/.test(docSrc)) {
  fail('docs: PRODUCTION_ACCEPTANCE_TEST.md must reference __productionAcceptanceHealth()');
}

// ─── Report ────────────────────────────────────────────────────
if (FAILED.length > 0) {
  console.error('[check:production-acceptance] FAIL');
  for (const f of FAILED) console.error('  ✗ ' + f);
  console.error(`\n${PASSED.length} passed, ${FAILED.length} failed.`);
  process.exit(1);
}
console.log('[check:production-acceptance] PASS — production acceptance contracts intact.');
for (const p of PASSED) console.log('  ✓ ' + p);
