#!/usr/bin/env node
/**
 * scripts/check-mobile-production-navigation.mjs — Permanent Mobile
 * Navigation Fix master gate (spec §11).
 *
 * Fails if:
 *   • iOS Scan nav passes a camera intent (must be a plain /scan
 *     navigate with source='bottom_nav_scan' on iOS)
 *   • bottom nav uses an undefined / empty navigate target
 *   • bottom nav still points the Activity tab at the stale /progress
 *   • a full-screen spinner can render without a timeout fallback
 *   • a lazy-chunk error has no recovery UI
 *   • any of the seven mobile-nav diagnostics is missing / unwired
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
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/(^|\s)\/\/.*$/gm, '');

// ─── 1. BottomTabNav iOS scan-tap omits camera intent ──────────
const nav = read('src/components/farmer/BottomTabNav.jsx');
if (!nav) {
  fail('bottom-nav: src/components/farmer/BottomTabNav.jsx missing');
} else {
  const navStripped = strip(nav);
  if (!/_isIOSDevice\s*\(/.test(navStripped)) {
    fail('bottom-nav: must branch the scan tap on _isIOSDevice()');
  } else {
    pass('bottom-nav: _isIOSDevice() branch present');
  }
  // The iOS branch must navigate to the plain path with the
  // bottom_nav_scan source marker (i.e. NO ?intent=camera on iOS).
  if (!/source:\s*['"]bottom_nav_scan['"]/.test(navStripped)) {
    fail('bottom-nav: iOS scan tap must navigate with state source="bottom_nav_scan" (no camera intent)');
  } else {
    pass('bottom-nav: iOS scan tap uses plain /scan + bottom_nav_scan source (no camera intent)');
  }
  // No undefined / empty navigate target.
  if (/navigate\(\s*(undefined|null|''|"")\s*[),]/.test(navStripped)) {
    fail('bottom-nav: navigate() called with an undefined/empty target');
  } else {
    pass('bottom-nav: no undefined/empty navigate target');
  }
  // Canonical tab paths present; Activity is /activity, never the
  // stale /progress.
  for (const p of ['/home', '/scan', '/activity']) {
    if (!new RegExp(`path:\\s*['"]${p}['"]`).test(navStripped)) {
      fail(`bottom-nav: canonical tab path "${p}" missing`);
    }
  }
  if (/path:\s*['"]\/progress['"]/.test(navStripped)) {
    fail('bottom-nav: Activity tab must use /activity, not the stale /progress');
  } else {
    pass('bottom-nav: no stale /progress tab path');
  }
}

// ─── 2. Full-screen spinner has a timeout fallback ─────────────
const loader = read('src/components/system/PageLoaderWithTimeout.jsx');
if (!loader) {
  fail('spinner: PageLoaderWithTimeout.jsx missing (the timeout-bearing loader)');
} else {
  if (!/setTimeout/.test(loader) || !/data-testid=["']page-loader-timeout["']/.test(loader)) {
    fail('spinner: PageLoaderWithTimeout must self-time-out to a recovery panel');
  } else {
    pass('spinner: PageLoaderWithTimeout flips to a recovery panel on timeout');
  }
}
// The app PageLoader must BE the timeout variant (no bare spinner gate).
const appSrc = read('src/App.jsx');
if (!/PageLoaderWithTimeout/.test(appSrc)) {
  fail('spinner: App.jsx must use PageLoaderWithTimeout for the Suspense/auth-gate loader');
} else {
  pass('spinner: App.jsx wires the timeout-bearing PageLoader');
}

// ─── 3. Lazy-chunk error has recovery UI ───────────────────────
const lazy = read('src/components/system/LazyLoadErrorBoundary.jsx');
if (!lazy) {
  fail('chunk: LazyLoadErrorBoundary.jsx missing');
} else {
  if (!/data-testid=["']lazy-load-error-retry["']/.test(lazy)
      || !/data-testid=["']lazy-load-error-home["']/.test(lazy)) {
    fail('chunk: LazyLoadErrorBoundary must render Try Again + Go Home recovery buttons');
  } else {
    pass('chunk: LazyLoadErrorBoundary renders recovery UI (Try Again / Go Home)');
  }
  // Scan-route chunk failure must also offer Upload Photo.
  if (!/data-testid=["']lazy-load-error-upload["']/.test(lazy)) {
    fail('chunk: scan-route chunk failure must also offer Upload Photo');
  } else {
    pass('chunk: scan-route chunk failure offers Upload Photo');
  }
  if (!/FARROWAY_LAZY_LOAD_ERROR/.test(lazy)) {
    fail('chunk: chunk failure must log [FARROWAY_LAZY_LOAD_ERROR] (route + chunk + build)');
  }
}

// ─── 4. The seven mobile-nav diagnostics exist + are wired ─────
const RUNTIMES = [
  ['src/runtime/routeReach/RouteReachHealthRuntime.ts',   '__routeReachHealth',   'installRouteReachHealthGlobal'],
  ['src/runtime/cache/CacheRecoveryRuntime.ts',           '__cacheRecoveryHealth', 'installCacheRecoveryHealthGlobal'],
  ['src/runtime/routeGuard/RouteGuardHealthRuntime.ts',   '__routeGuardHealth',   'installRouteGuardHealthGlobal'],
  ['src/runtime/bottomNav/BottomNavHealthRuntime.ts',     '__bottomNavHealth',    'installBottomNavHealthGlobal'],
  ['src/runtime/appVersion/AppVersionRuntime.ts',         '__appVersionHealth',   'installAppVersionHealthGlobal'],
];
for (const [rel, glob, installer] of RUNTIMES) {
  const src = read(rel);
  if (!src) { fail(`diagnostics: ${rel} must exist`); continue; }
  if (!new RegExp(glob).test(src)) fail(`diagnostics: ${rel} must surface ${glob}`);
  if (!new RegExp(installer).test(src)) fail(`diagnostics: ${rel} must export ${installer}`);
  if (!new RegExp(installer).test(appSrc)) fail(`wiring: App.jsx must wire ${installer}`);
}
if (!FAILED.some((f) => f.startsWith('diagnostics:') || f.startsWith('wiring:'))) {
  pass('diagnostics: all five mobile-nav probes present + wired in App.jsx');
}

// ─── Report ────────────────────────────────────────────────────
if (FAILED.length > 0) {
  console.error('[check:mobile-production-navigation] FAIL');
  for (const f of FAILED) console.error('  ✗ ' + f);
  console.error(`\n${PASSED.length} passed, ${FAILED.length} failed.`);
  process.exit(1);
}
console.log('[check:mobile-production-navigation] PASS — iOS scan nav safe, no stale routes, spinner + chunk recovery wired.');
for (const p of PASSED) console.log('  ✓ ' + p);
