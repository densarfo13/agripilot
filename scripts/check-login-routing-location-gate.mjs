#!/usr/bin/env node
/**
 * scripts/check-login-routing-location-gate.mjs — login-routing +
 * optional-location governance gate.
 *
 * Fails if:
 *   • The onboarding-complete readers do NOT accept BOTH 'true'
 *     and '1' (the writer/reader mismatch that trapped completed
 *     users on the location screen).
 *   • RouteGuard blocks on location / onboarding completeness.
 *   • The FastOnboarding location screen disables Continue.
 *   • "Use general guidance" does not navigate to /home.
 *   • The __loginRoutingHealth diagnostic is missing.
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
  if (!fs.existsSync(full)) { fail(`${label}: ${rel} must exist`); return ''; }
  pass(`${label}: ${rel} present`);
  return read(full);
}

// ─── 1. Completion-flag readers accept BOTH 'true' and '1' ─────
// The reader files must not match ONLY === 'true' for the
// completion flag. We assert each carries a "'1'" acceptance.
const READERS = [
  'src/utils/onboarding.js',
  'src/core/activeContext.js',
  'src/pages/OnboardingEntry.jsx',
  'src/runtime/launchBlockers/OnboardingGuardRuntime.ts',
];
for (const rel of READERS) {
  const src = requireFile(rel, 'reader');
  if (!src) continue;
  // Must reference the completion key AND accept '1'.
  if (!/farroway_onboarding_complete/.test(src)) {
    fail(`reader: ${rel} must read a farroway_onboarding_complete* key`);
  }
  if (!/===\s*['"]1['"]|=== ?'1'|'1'/.test(src)) {
    fail(`reader: ${rel} must accept the '1' completion value (writer/reader mismatch fix)`);
  }
}

// ─── 2. RouteGuard does not block on location/onboarding ───────
// Strip comments first (the canonical "PERMANENT ROUTING RULE"
// docblock legitimately NAMES these tokens). `useLocation` /
// `location.pathname` are legit react-router usage, so we flag
// only onboarding/farm/country COMPLETENESS branches — never the
// bare word "location".
const routeGuard = requireFile('src/components/auth/RouteGuard.jsx', 'route-guard')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|\s)\/\/.*$/gm, '');
const BLOCK_PATTERNS = [
  /\bonboardingComplete\b/,
  /\bneedsOnboarding\b/,
  /\bisOnboardingComplete\b/,
  /!\s*farm\b/,
  /!\s*country\b/,
  /!\s*hasLocation\b/,
];
if (BLOCK_PATTERNS.some((re) => re.test(routeGuard))) {
  fail('route-guard: RouteGuard must NOT branch on onboarding / farm / location completeness');
} else {
  pass('route-guard: gates on role only (no onboarding/farm/location block)');
}

// ─── 3. FastOnboarding location screen never traps ─────────────
const fastOnb = requireFile('src/pages/onboarding/FastOnboarding.jsx', 'fast-onboarding');
// Continue button must exist and must NOT be disabled.
if (!/data-testid=["']fast-onboarding-location-continue["']/.test(fastOnb)) {
  fail('fast-onboarding: Continue button (fast-onboarding-location-continue) missing');
}
// The continue button must not carry a disabled={...gps...} attr.
if (/data-testid=["']fast-onboarding-location-continue["'][^>]*disabled/.test(fastOnb)) {
  fail('fast-onboarding: Continue button must never be disabled (GPS failure must not block)');
}
// "Use general guidance" must navigate to /home.
const skipBlock = fastOnb.match(/data-testid=["']fast-onboarding-skip["']/);
if (!skipBlock) {
  fail('fast-onboarding: "Use general guidance" button (fast-onboarding-skip) missing');
}
// The skip handler must navigate('/home') and persist the safe fallback.
if (!/locationMode['"]?\s*,\s*['"]general_guidance['"]/.test(fastOnb)) {
  fail('fast-onboarding: must persist locationMode="general_guidance" safe fallback (spec §5)');
}
if (!/locationStatus['"]?\s*,\s*['"]unavailable['"]/.test(fastOnb)) {
  fail('fast-onboarding: must persist locationStatus="unavailable" safe fallback (spec §5)');
}
if (!/navigate\(['"]\/home['"]/.test(fastOnb)) {
  fail('fast-onboarding: Continue / general-guidance must navigate to /home');
}

// ─── 4. __loginRoutingHealth diagnostic present + installed ────
const runtime = requireFile(
  'src/runtime/loginRouting/LoginRoutingHealthRuntime.ts', 'runtime');
for (const tok of [
  '__loginRoutingHealth', 'postLoginRoutesHome', 'locationOptional',
  'gpsFailureDoesNotBlock', 'continueButtonWorks',
  'generalGuidanceWorks', 'onboardingLoopBlocked',
]) {
  if (!new RegExp(`\\b${tok}\\b`).test(runtime)) {
    fail(`runtime: must surface "${tok}"`);
  }
}
const appSrc = requireFile('src/App.jsx', 'wiring');
if (!/installLoginRoutingHealthGlobal/.test(appSrc)) {
  fail('wiring: App.jsx must wire installLoginRoutingHealthGlobal');
}

// ─── Report ────────────────────────────────────────────────────
if (FAILED.length > 0) {
  console.error('[check:login-routing-location-gate] FAIL');
  for (const f of FAILED) console.error('  ✗ ' + f);
  console.error(`\n${PASSED.length} passed, ${FAILED.length} failed.`);
  process.exit(1);
}
console.log('[check:login-routing-location-gate] PASS — login routes home, location optional, no onboarding loop.');
for (const p of PASSED) console.log('  ✓ ' + p);
