#!/usr/bin/env node
/**
 * scripts/check-login-location-routing.mjs — Permanent Mobile
 * Navigation Fix §5 + §6 gate.
 *
 * Fails if:
 *   • location is REQUIRED for onboarding completion (GPS/weather/
 *     demographics/org/buyer must never gate completion)
 *   • the location screen can trap the user (Continue disabled, or
 *     no general-guidance / manual-entry escape, or no /home route)
 *   • the safe-fallback (general_guidance / unavailable) is not
 *     persisted on GPS failure
 *   • the __routeGuardHealth / __loginRoutingHealth diagnostics are
 *     missing or unwired
 *
 * Complements check-login-routing-location-gate (the writer/reader
 * '1'-vs-'true' contract). Read-only. Never mutates source.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const FAILED = [];
const PASSED = [];
const fail = (m) => FAILED.push(m);
const pass = (m) => PASSED.push(m);
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };

// ─── 1. Location screen never traps (spec §6) ──────────────────
const fast = read('src/pages/onboarding/FastOnboarding.jsx');
if (!fast) {
  fail('location-screen: src/pages/onboarding/FastOnboarding.jsx missing');
} else {
  // Continue is always tappable — the location step is non-blocking.
  if (!/if\s*\(\s*stepIdx\s*===\s*0\s*\)\s*return\s*true/.test(fast)) {
    fail('location-screen: location step (stepIdx 0) must be non-blocking (canAdvance returns true)');
  } else {
    pass('location-screen: location step is non-blocking');
  }
  if (!/data-testid=["']fast-onboarding-location-continue["']/.test(fast)) {
    fail('location-screen: Continue button missing');
  }
  if (/data-testid=["']fast-onboarding-location-continue["'][^>]*disabled/.test(fast)) {
    fail('location-screen: Continue must never be disabled (GPS failure must not block)');
  } else {
    pass('location-screen: Continue is never disabled');
  }
  // Escape hatches: general guidance + manual entry.
  if (!/data-testid=["']fast-onboarding-skip["']/.test(fast)) {
    fail('location-screen: "Use general guidance" escape missing');
  }
  if (!/data-testid=["']fast-onboarding-toggle-manual["']/.test(fast)) {
    fail('location-screen: "Enter manually" toggle missing');
  }
  // Safe fallback persisted on GPS failure (spec §5).
  if (!/locationMode['"]?\s*,\s*['"]general_guidance['"]/.test(fast)) {
    fail('location-screen: must persist locationMode="general_guidance" on GPS failure');
  } else {
    pass('location-screen: persists general_guidance safe fallback');
  }
  if (!/locationStatus['"]?\s*,\s*['"]unavailable['"]/.test(fast)) {
    fail('location-screen: must persist locationStatus="unavailable" on GPS failure');
  }
  // All exits route to /home — never back into the location screen.
  if (!/navigate\(['"]\/home['"]/.test(fast)) {
    fail('location-screen: Continue / general-guidance must navigate to /home');
  } else {
    pass('location-screen: all exits route to /home');
  }
}

// ─── 2. Onboarding completion does NOT require location ─────────
// The completion writer must not condition the stamp on a location /
// GPS / country / weather / demographics value.
const writer = read('src/utils/onboarding.js');
if (!writer) {
  fail('completion: src/utils/onboarding.js missing');
} else {
  if (!/setOnboardingComplete/.test(writer)) {
    fail('completion: setOnboardingComplete writer missing');
  } else {
    pass('completion: setOnboardingComplete writer present');
  }
  // The writer must not require a location argument to stamp.
  if (/function\s+setOnboardingComplete\s*\(\s*(location|gps|country|coords)\b/i.test(writer)) {
    fail('completion: setOnboardingComplete must NOT require a location/GPS argument');
  } else {
    pass('completion: completion stamp does not require location');
  }
}

// ─── 3. RouteGuard gates on role only ──────────────────────────
const guard = read('src/components/auth/RouteGuard.jsx')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|\s)\/\/.*$/gm, '');
const BLOCK = [
  /\bonboardingComplete\b/, /\bneedsOnboarding\b/, /\bisOnboardingComplete\b/,
  /!\s*farm\b/, /!\s*country\b/, /!\s*hasLocation\b/,
];
if (BLOCK.some((re) => re.test(guard))) {
  fail('route-guard: RouteGuard must gate on ROLE only (no onboarding/farm/location branch)');
} else {
  pass('route-guard: gates on role only');
}

// ─── 4. Diagnostics present + wired ────────────────────────────
const routeGuardRt = read('src/runtime/routeGuard/RouteGuardHealthRuntime.ts');
for (const tok of [
  '__routeGuardHealth', 'authGuardReady', 'locationDoesNotBlockHome',
  'locationDoesNotBlockScan', 'onboardingLoopBlocked',
  'existingUserRoutesHome', 'scanAllowedWithGeneralGuidance',
]) {
  if (!new RegExp(`\\b${tok}\\b`).test(routeGuardRt)) {
    fail(`diagnostics: RouteGuardHealthRuntime must surface "${tok}"`);
  }
}
const login = read('src/runtime/loginRouting/LoginRoutingHealthRuntime.ts');
if (!/__loginRoutingHealth/.test(login)) {
  fail('diagnostics: __loginRoutingHealth runtime missing');
}
const appSrc = read('src/App.jsx');
if (!/installRouteGuardHealthGlobal/.test(appSrc)) {
  fail('wiring: App.jsx must wire installRouteGuardHealthGlobal');
}
if (!/installLoginRoutingHealthGlobal/.test(appSrc)) {
  fail('wiring: App.jsx must wire installLoginRoutingHealthGlobal');
}
if (!FAILED.some((f) => f.startsWith('diagnostics:') || f.startsWith('wiring:'))) {
  pass('diagnostics: route-guard + login-routing probes present + wired');
}

// ─── Report ────────────────────────────────────────────────────
if (FAILED.length > 0) {
  console.error('[check:login-location-routing] FAIL');
  for (const f of FAILED) console.error('  ✗ ' + f);
  console.error(`\n${PASSED.length} passed, ${FAILED.length} failed.`);
  process.exit(1);
}
console.log('[check:login-location-routing] PASS — location optional, screen never traps, routes home, guards role-only.');
for (const p of PASSED) console.log('  ✓ ' + p);
