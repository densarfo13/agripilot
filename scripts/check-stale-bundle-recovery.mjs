#!/usr/bin/env node
/**
 * scripts/check-stale-bundle-recovery.mjs — Permanent Mobile
 * Navigation Fix §1 gate.
 *
 * Fails if the forced stale-bundle / service-worker kill switch
 * regresses. The kill switch is the layered defence that runs BEFORE
 * the React bundle so a wedged shell still recovers:
 *   • public/cache-bust.js — synchronous build-SHA compare + drop
 *     every cache + unregister every SW + reload ONCE (session-guarded)
 *   • index.html — wires window.__FARROWAY_BUILD_SHA + /cache-bust.js
 *   • src/lib/forceUiReset.js — killServiceWorkerAndCaches + ensureUiVersion
 *   • __cacheRecoveryHealth / __appVersionHealth diagnostics
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

// ─── 1. cache-bust.js: SHA compare + clear + reload-once ───────
const bust = read('public/cache-bust.js');
if (!bust) {
  fail('cache-bust: public/cache-bust.js must exist (the synchronous kill switch)');
} else {
  if (!/__FARROWAY_BUILD_SHA/.test(bust)) {
    fail('cache-bust: must read window.__FARROWAY_BUILD_SHA (the pinned build SHA)');
  }
  if (!/caches\.delete|caches\.keys/.test(bust)) {
    fail('cache-bust: must clear CacheStorage on a SHA mismatch');
  }
  if (!/getRegistrations|unregister/.test(bust)) {
    fail('cache-bust: must unregister service workers on a SHA mismatch');
  }
  // Reload-once guard: a sessionStorage attempt flag prevents loops.
  if (!/sessionStorage/.test(bust) || !/attempt/i.test(bust)) {
    fail('cache-bust: must guard the reload with a session attempt flag (no infinite reload)');
  } else {
    pass('cache-bust: reload-once is session-guarded (no infinite reload)');
  }
  if (!/location\.replace|location\.reload/.test(bust)) {
    fail('cache-bust: must hard-reload once on a SHA mismatch');
  } else {
    pass('cache-bust: SHA compare → clear caches/SW → reload once');
  }
}

// ─── 2. index.html wires the build SHA + the buster ────────────
const html = read('index.html');
if (!html) {
  fail('index-html: index.html missing');
} else {
  if (!/__FARROWAY_BUILD_SHA\s*=\s*['"]%FARROWAY_BUILD_SHA%['"]/.test(html)) {
    fail('index-html: must pin window.__FARROWAY_BUILD_SHA from the %FARROWAY_BUILD_SHA% placeholder');
  }
  if (!/cache-bust\.js/.test(html)) {
    fail('index-html: must load /cache-bust.js synchronously in <head>');
  } else {
    pass('index-html: pins build SHA + loads /cache-bust.js');
  }
}

// ─── 3. vite injects the placeholders at build time ────────────
const vite = read('vite.config.js');
if (!/FARROWAY_BUILD_SHA/.test(vite) || !/VITE_BUILD_SHA/.test(vite)) {
  fail('vite: must substitute %FARROWAY_BUILD_SHA% from VITE_BUILD_SHA at build time');
} else {
  pass('vite: substitutes the build-SHA placeholder at build time');
}

// ─── 4. forceUiReset still ships the every-boot SW/cache purge ─
const force = read('src/lib/forceUiReset.js');
if (!/killServiceWorkerAndCaches/.test(force)) {
  fail('force-reset: killServiceWorkerAndCaches must exist (every-boot SW unregister + cache purge)');
} else {
  pass('force-reset: killServiceWorkerAndCaches present');
}
const main = read('src/main.jsx');
if (!/killServiceWorkerAndCaches\s*\(/.test(main)) {
  fail('force-reset: main.jsx must call killServiceWorkerAndCaches() on boot');
} else {
  pass('force-reset: main.jsx calls killServiceWorkerAndCaches() on every boot');
}

// ─── 5. Diagnostics present + wired ────────────────────────────
const cacheRt = read('src/runtime/cache/CacheRecoveryRuntime.ts');
for (const tok of [
  '__cacheRecoveryHealth', 'buildSha', 'previousBuildSha',
  'staleBundleDetected', 'serviceWorkersCleared', 'cachesCleared',
  'reloadAttempted', 'reloadSafe',
]) {
  if (!new RegExp(`\\b${tok}\\b`).test(cacheRt)) {
    fail(`diagnostics: CacheRecoveryRuntime must surface "${tok}"`);
  }
}
const appVer = read('src/runtime/appVersion/AppVersionRuntime.ts');
if (!/__appVersionHealth/.test(appVer)) {
  fail('diagnostics: __appVersionHealth runtime missing');
}
const appSrc = read('src/App.jsx');
if (!/installCacheRecoveryHealthGlobal/.test(appSrc)) {
  fail('wiring: App.jsx must wire installCacheRecoveryHealthGlobal');
}
if (!/installAppVersionHealthGlobal/.test(appSrc)) {
  fail('wiring: App.jsx must wire installAppVersionHealthGlobal');
}
if (!FAILED.some((f) => f.startsWith('diagnostics:') || f.startsWith('wiring:'))) {
  pass('diagnostics: cache-recovery + app-version probes present + wired');
}

// ─── Report ────────────────────────────────────────────────────
if (FAILED.length > 0) {
  console.error('[check:stale-bundle-recovery] FAIL');
  for (const f of FAILED) console.error('  ✗ ' + f);
  console.error(`\n${PASSED.length} passed, ${FAILED.length} failed.`);
  process.exit(1);
}
console.log('[check:stale-bundle-recovery] PASS — stale-bundle kill switch intact, reload-once, diagnostics wired.');
for (const p of PASSED) console.log('  ✓ ' + p);
