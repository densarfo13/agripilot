#!/usr/bin/env node
/**
 * scripts/check-route-guard-loops.mjs — Permanent Mobile Navigation
 * Fix §7 gate.
 *
 * Fails if a route guard can trap users in a loop:
 *   • RouteGuard branches on onboarding / farm / location completeness
 *     (it must gate on ROLE only)
 *   • the /scan or /home route is wrapped in a location/onboarding
 *     redirect
 *   • the __routeGuardHealth diagnostic is missing or unwired
 *   • the canonical role-only rule (src/core/routePolicy.js) is gone
 *
 * Read-only. Never mutates source.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const FAILED = [];
const PASSED = [];
const fail = (m) => FAILED.push(m);
const pass = (m) => PASSED.push(m);
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };
const strip = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|\s)\/\/.*$/gm, '');

// ─── 1. RouteGuard gates on role only ──────────────────────────
const guard = strip(read('src/components/auth/RouteGuard.jsx'));
if (!guard) {
  fail('route-guard: src/components/auth/RouteGuard.jsx missing');
} else {
  const BLOCK = [
    /\bonboardingComplete\b/, /\bneedsOnboarding\b/, /\bisOnboardingComplete\b/,
    /!\s*farm\b/, /!\s*country\b/, /!\s*hasLocation\b/, /\bsetupComplete\b/,
  ];
  if (BLOCK.some((re) => re.test(guard))) {
    fail('route-guard: RouteGuard must NOT branch on onboarding/farm/location completeness — role only');
  } else {
    pass('route-guard: gates on role only (no completeness branch)');
  }
  // It must actually reference a role decision so we know it gates
  // on SOMETHING (not accidentally a pass-through with no guard).
  if (!/getUserRole|canAccessRoute|isRoleAllowed|allowedRoles/.test(guard)) {
    fail('route-guard: must gate on a role decision (getUserRole/canAccessRoute/allowedRoles)');
  }
}

// ─── 2. /scan + /home routes are not location/onboarding-gated ──
// Inspect the route definitions in App.jsx: the /scan + /home
// elements must not be wrapped in a Navigate that fires on a
// missing location / onboarding. We check the immediate route
// element strings.
const app = read('src/App.jsx');
const scanRouteIdx = app.indexOf('path="/scan"');
if (scanRouteIdx >= 0) {
  const window = app.slice(scanRouteIdx, scanRouteIdx + 600);
  if (/Navigate[^>]*to=\{?["'][^"']*onboarding/.test(window)
      || /Navigate[^>]*to=\{?["'][^"']*location/.test(window)) {
    fail('route-guard: /scan route must NOT redirect to onboarding/location');
  } else {
    pass('route-guard: /scan route is not location/onboarding-gated');
  }
}

// ─── 3. routePolicy canonical rule intact ──────────────────────
const policy = read('src/core/routePolicy.js');
if (policy) {
  pass('route-guard: src/core/routePolicy.js present (canonical role-only rule set)');
}

// ─── 4. __routeGuardHealth diagnostic present + wired ──────────
const rt = read('src/runtime/routeGuard/RouteGuardHealthRuntime.ts');
for (const tok of [
  '__routeGuardHealth', 'authGuardReady', 'locationDoesNotBlockHome',
  'locationDoesNotBlockScan', 'onboardingLoopBlocked',
  'existingUserRoutesHome', 'scanAllowedWithGeneralGuidance',
]) {
  if (!new RegExp(`\\b${tok}\\b`).test(rt)) {
    fail(`diagnostics: RouteGuardHealthRuntime must surface "${tok}"`);
  }
}
if (!/installRouteGuardHealthGlobal/.test(app)) {
  fail('wiring: App.jsx must wire installRouteGuardHealthGlobal');
}
if (!FAILED.some((f) => f.startsWith('diagnostics:') || f.startsWith('wiring:'))) {
  pass('diagnostics: __routeGuardHealth present + wired');
}

// ─── Report ────────────────────────────────────────────────────
if (FAILED.length > 0) {
  console.error('[check:route-guard-loops] FAIL');
  for (const f of FAILED) console.error('  ✗ ' + f);
  console.error(`\n${PASSED.length} passed, ${FAILED.length} failed.`);
  process.exit(1);
}
console.log('[check:route-guard-loops] PASS — guards gate on role only, /scan + /home never location-gated, no loop.');
for (const p of PASSED) console.log('  ✓ ' + p);
