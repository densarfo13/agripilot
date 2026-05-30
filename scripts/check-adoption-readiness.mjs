#!/usr/bin/env node
/**
 * scripts/check-adoption-readiness.mjs — Wave-39 governance gate.
 *
 * Statically enforces the adoption-readiness contract:
 *
 *   • OnboardingHealthRuntime + globals wired
 *   • NGOOnboardingHealthRuntime + globals wired
 *   • BuyerOnboardingHealthRuntime + globals wired
 *   • KnowledgeCoverageHealthRuntime + globals wired
 *   • RetentionRuntime exposes the wave-39 contract fields
 *   • Extended InviteHealth contract surfaces activation/resend/
 *     expiration/inviteStatus flags
 *   • Extended PersistenceHealth contract surfaces
 *     criticalWritesPersisted
 *   • Extended OfflineValidationHealth contract surfaces
 *     offlineArtifactReady
 *   • GoLiveHealthRuntime composes all eight probes
 *   • /activate route component (src/pages/Activate.jsx) present
 *   • No payment/escrow/bidding code in src/runtime/buyer/
 *   • App.jsx wires the four wave-39 globals at boot
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

// ─── 1. Adoption runtime files exist ───────────────────────────
const onboardingSrc = requireFile(
  'src/runtime/adoption/OnboardingHealthRuntime.ts',
  'adoption');
const ngoSrc       = requireFile(
  'src/runtime/adoption/NGOOnboardingHealthRuntime.ts',
  'adoption');
const buyerSrc     = requireFile(
  'src/runtime/adoption/BuyerOnboardingHealthRuntime.ts',
  'adoption');
const knowledgeSrc = requireFile(
  'src/runtime/adoption/KnowledgeCoverageHealthRuntime.ts',
  'adoption');
const adoptionIdx  = requireFile(
  'src/runtime/adoption/index.ts',
  'adoption');

// ─── 2. Each runtime installs ONE window global ────────────────
if (!/__onboardingHealth/.test(onboardingSrc)) {
  fail('onboarding: must install window.__onboardingHealth');
}
if (!/__ngoOnboardingHealth/.test(ngoSrc)) {
  fail('ngo: must install window.__ngoOnboardingHealth');
}
if (!/__buyerOnboardingHealth/.test(buyerSrc)) {
  fail('buyer: must install window.__buyerOnboardingHealth');
}
if (!/__knowledgeCoverageHealth/.test(knowledgeSrc)) {
  fail('knowledge: must install window.__knowledgeCoverageHealth');
}

// ─── 3. Adoption-contract fields present on each envelope ──────
function requireFields(src, fields, label) {
  for (const f of fields) {
    const re = new RegExp(`\\b${f}\\b`);
    if (!re.test(src)) fail(`${label}: envelope missing field "${f}"`);
  }
}
requireFields(onboardingSrc, [
  'farmerOnboardingReady', 'gardenerOnboardingReady',
  'locationSkippable', 'demographicsOptional',
  'firstPlantPathReady', 'forcedEnterpriseSetup',
], 'onboarding');
requireFields(ngoSrc, [
  'organizationCreateReady', 'programCreateReady',
  'csvPreviewRequired', 'bulkImportReady', 'addFarmerReady',
  'fieldOfficerAssignmentReady', 'organizationScoped',
  'inviteStatusTracked',
], 'ngo');
requireFields(buyerSrc, [
  'buyerProfileReady', 'approvedListingsOnly',
  'sendInterestReady', 'interestStatusReady',
  'noPayments', 'privateFarmerDataHidden',
], 'buyer');
requireFields(knowledgeSrc, [
  'plants', 'flowers', 'diseases', 'pests',
  'targetPlants', 'targetFlowers',
  'targetDiseases', 'targetPests',
  'launchCoveragePercent',
], 'knowledge');

// ─── 4. Retention runtime exposes wave-39 contract fields ──────
const retentionSrc = requireFile(
  'src/runtime/retention/RetentionRuntime.ts', 'retention');
requireFields(retentionSrc, [
  'appOpenTracked', 'scanTracked',
  'plantCreatedTracked', 'taskCompletedTracked',
  'd1Ready', 'd7Ready', 'd30Ready',
], 'retention');

// ─── 5. Invite contract surfaces extended flags ─────────────────
const inviteContractsSrc = requireFile(
  'src/runtime/invites/inviteContracts.ts', 'invites');
requireFields(inviteContractsSrc, [
  'activationRouteReady', 'resendReady',
  'expirationReady', 'inviteStatusVisible',
], 'invites');

// ─── 6. /activate route component present ───────────────────────
const activateSrc = requireFile('src/pages/Activate.jsx', 'invites');
if (!/farrowayActivateRouteMounted/.test(activateSrc)) {
  fail('invites: Activate.jsx must attest mount via __farrowayActivateRouteMounted');
}
if (!/\/api\/invites\/accept/.test(activateSrc)) {
  fail('invites: Activate.jsx must POST to /api/invites/accept');
}

// ─── 7. Persistence contract surfaces criticalWritesPersisted ──
const persistenceContractsSrc = requireFile(
  'src/runtime/persistence/persistenceContracts.ts', 'persistence');
if (!/criticalWritesPersisted/.test(persistenceContractsSrc)) {
  fail('persistence: contract must surface criticalWritesPersisted');
}

// ─── 8. Offline validation surfaces offlineArtifactReady ───────
const offlineSrc = requireFile(
  'src/runtime/offline/OfflineValidationRuntime.ts', 'offline');
if (!/offlineArtifactReady/.test(offlineSrc)) {
  fail('offline: must surface offlineArtifactReady');
}

// ─── 9. GoLive runtime composes all eight probes ────────────────
const goLiveSrc = requireFile(
  'src/runtime/launchBlockers/GoLiveHealthRuntime.ts', 'go-live');
for (const probe of [
  '__onboardingHealth', '__ngoOnboardingHealth',
  '__buyerOnboardingHealth', '__knowledgeCoverageHealth',
  '__retentionHealth', '__persistenceHealth',
  '__inviteHealth', '__offlineValidationHealth',
]) {
  if (!new RegExp(probe).test(goLiveSrc)) {
    fail(`go-live: must compose ${probe}`);
  }
}

// ─── 10. No payment/escrow/bidding in buyer runtime ────────────
function scanDir(rel, pattern, label) {
  const dir = path.join(ROOT, rel);
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir).filter((f) => /\.(ts|tsx|js|jsx)$/.test(f));
  for (const entry of entries) {
    const full = path.join(dir, entry);
    const src = read(full);
    if (pattern.test(src)) {
      fail(`${label}: forbidden token "${pattern.source}" in ${rel}/${entry}`);
    }
  }
}
scanDir('src/runtime/buyer',
  /\b(stripe|paystack|paypal|escrow|payment(Method|Intent|Provider)|bidPlaced|placeBid)\b/i,
  'buyer');

// ─── 11. App.jsx wires the four wave-39 globals ────────────────
const appSrc = requireFile('src/App.jsx', 'wiring');
for (const fn of [
  'installOnboardingHealthGlobal',
  'installNGOOnboardingHealthGlobal',
  'installBuyerOnboardingHealthGlobal',
  'installKnowledgeCoverageHealthGlobal',
]) {
  if (!new RegExp(fn).test(appSrc)) {
    fail(`wiring: App.jsx must wire ${fn}`);
  }
}
// /activate route lazy-imported in App.jsx
if (!/Activate/.test(appSrc) || !/path=["']\/activate["']/.test(appSrc)) {
  fail('wiring: App.jsx must register the /activate route');
}

// ─── 12. Adoption barrel re-exports everything ─────────────────
for (const sym of [
  'installOnboardingHealthGlobal',
  'installNGOOnboardingHealthGlobal',
  'installBuyerOnboardingHealthGlobal',
  'installKnowledgeCoverageHealthGlobal',
]) {
  if (!new RegExp(sym).test(adoptionIdx)) {
    fail(`adoption: index.ts must re-export ${sym}`);
  }
}

// ─── Report ────────────────────────────────────────────────────
if (FAILED.length > 0) {
  console.error('[check:adoption-readiness] FAIL');
  for (const f of FAILED) console.error('  ✗ ' + f);
  console.error(`\n${PASSED.length} passed, ${FAILED.length} failed.`);
  process.exit(1);
}
console.log('[check:adoption-readiness] PASS — wave-39 adoption contracts intact.');
for (const p of PASSED) console.log('  ✓ ' + p);
