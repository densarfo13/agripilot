#!/usr/bin/env node
/**
 * scripts/check-gap-closure-pack.mjs — Final Gap Closure Pack CI gate.
 *
 * Statically enforces the six pilot-launch composition runtimes:
 *   1. src/runtime/outcomes/         — outcome tracking
 *   2. src/runtime/feedback/         — feedback intelligence
 *   3. src/runtime/retention/        — D1/D7/D30 retention analytics
 *   4. src/runtime/fieldOfficer/     — offline field-officer workflow
 *   5. src/runtime/buyerTrust/       — buyer trust signals
 *   6. src/runtime/knowledgeContent/ — knowledge coverage tracker
 *
 * For each: barrel exists, installer is exported, App.jsx boot
 * wires the installer.
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

const SUITE = [
  { dir: 'outcomes',         installer: 'installOutcomeRuntimeGlobal',     global: '__outcomeHealth',        readyKey: 'outcomeTrackingReady' },
  { dir: 'feedback',         installer: 'installFeedbackRuntimeGlobal',    global: '__feedbackHealth',       readyKey: 'feedbackReady' },
  { dir: 'retention',        installer: 'installRetentionRuntimeGlobal',   global: '__retentionHealth',      readyKey: 'retentionReady' },
  { dir: 'fieldOfficer',     installer: 'installFieldOfficerGlobal',       global: '__fieldOfficerHealth',   readyKey: 'fieldOfficerReady' },
  { dir: 'buyerTrust',       installer: 'installBuyerTrustGlobal',         global: '__buyerTrustHealth',     readyKey: 'buyerTrustReady' },
  { dir: 'knowledgeContent', installer: 'installKnowledgeContentGlobal',   global: '__knowledgeHealth',      readyKey: 'knowledgeCoverageReady' },
];

// ─── 1. Per-runtime barrel + installer ─────────────────────────
for (const { dir, installer, global, readyKey } of SUITE) {
  const barrelPath = path.join(ROOT, `src/runtime/${dir}/index.ts`);
  const barrel = read(barrelPath);
  if (!barrel) {
    fail(`gap-closure: missing barrel src/runtime/${dir}/index.ts`);
    continue;
  }
  if (!barrel.includes(installer)) {
    fail(`gap-closure: ${dir}/index.ts must re-export ${installer}`);
  }
  // Walk all .ts files in the subtree for the global pin + readyKey
  const subtree = fs.readdirSync(path.join(ROOT, `src/runtime/${dir}`))
    .filter((f) => f.endsWith('.ts'))
    .map((f) => read(path.join(ROOT, `src/runtime/${dir}`, f)))
    .join('\n');
  if (!subtree.includes(global)) {
    fail(`gap-closure: ${dir} runtime must pin window.${global}`);
  }
  if (!subtree.includes(readyKey)) {
    fail(`gap-closure: ${dir} health envelope must include ${readyKey}: true`);
  }
}
if (FAILED.length === 0) {
  pass(`gap-closure: 6 runtimes — barrel + installer + global + ready flag all present`);
}

// ─── 2. App.jsx boot wires every installer ─────────────────────
const app = read(path.join(ROOT, 'src/App.jsx'));
for (const { installer } of SUITE) {
  if (!app.includes(installer)) {
    fail(`gap-closure: App.jsx must call ${installer}() during boot`);
  }
}
if (FAILED.length === 0) {
  pass(`gap-closure: App.jsx wires all 6 install*Global calls`);
}

// ─── 3. Release-lock extension surfaces the 6 ready flags ──────
const lockBarrel = read(path.join(ROOT, 'src/runtime/launchBlockers/index.ts'));
for (const { readyKey } of SUITE) {
  if (!lockBarrel.includes(readyKey)) {
    fail(`gap-closure: launchBlockers/index.ts must surface ${readyKey} on __releaseLock()`);
  }
}
if (FAILED.length === 0) {
  pass(`gap-closure: __releaseLock() extended with 6 pilot-readiness flags`);
}

// ─── Report ────────────────────────────────────────────────────
if (FAILED.length > 0) {
  console.error('[check:gap-closure-pack] FAIL');
  for (const f of FAILED) console.error('  ✗ ' + f);
  console.error(`\n${PASSED.length} checks passed, ${FAILED.length} failed.`);
  process.exit(1);
}
console.log('[check:gap-closure-pack] PASS — Final Gap Closure Pack wired.');
console.log(`  Outcome tracking        — installOutcomeRuntimeGlobal       / __outcomeHealth`);
console.log(`  Feedback intelligence   — installFeedbackRuntimeGlobal      / __feedbackHealth`);
console.log(`  Retention analytics     — installRetentionRuntimeGlobal     / __retentionHealth`);
console.log(`  Field officer workflow  — installFieldOfficerGlobal         / __fieldOfficerHealth`);
console.log(`  Buyer trust signals     — installBuyerTrustGlobal           / __buyerTrustHealth`);
console.log(`  Knowledge coverage      — installKnowledgeContentGlobal     / __knowledgeHealth`);
console.log(`  Release lock surfaces all 6 ready flags + go-live verdict.`);
