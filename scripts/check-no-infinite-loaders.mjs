#!/usr/bin/env node
/**
 * scripts/check-no-infinite-loaders.mjs — Global Startup + Routing
 * Deadlock Fix §2/§10 gate.
 *
 * Guarantees no full-screen loader can spin forever:
 *   • SafeLoader exists and self-times-out to a recovery panel
 *   • PageLoaderWithTimeout self-times-out (Suspense fallback)
 *   • SafeRouteShell has a route-level loading timeout
 *   • AuthLoadingGate (app-level) uses a timeout-bearing loader
 *     (SafeLoader), NOT a bare spinner
 *   • the lazy-chunk boundary has recovery UI
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

// ─── 1. SafeLoader exists + times out to recovery ─────────────
const safe = read('src/components/common/SafeLoader.jsx');
if (!safe) {
  fail('safe-loader: src/components/common/SafeLoader.jsx must exist');
} else {
  if (!/setTimeout/.test(safe)) {
    fail('safe-loader: must schedule a setTimeout to flip out of the spinner');
  }
  if (!/data-testid=["']safe-loader-recovery["']/.test(safe)) {
    fail('safe-loader: must render a recovery panel (safe-loader-recovery) on timeout');
  }
  if (!/data-testid=["']safe-loader-retry["']/.test(safe)
      || !/data-testid=["']safe-loader-home["']/.test(safe)) {
    fail('safe-loader: recovery must offer Try Again + Go Home');
  }
  if (FAILED.length === 0) {
    pass('safe-loader: SafeLoader self-times-out to a Try Again / Go Home recovery panel');
  }
}

// ─── 2. PageLoaderWithTimeout self-times-out ───────────────────
const pageLoader = read('src/components/system/PageLoaderWithTimeout.jsx');
if (!pageLoader) {
  fail('page-loader: PageLoaderWithTimeout.jsx must exist');
} else if (!/setTimeout/.test(pageLoader)
           || !/data-testid=["']page-loader-timeout["']/.test(pageLoader)) {
  fail('page-loader: PageLoaderWithTimeout must flip to a recovery panel on timeout');
} else {
  pass('page-loader: Suspense fallback self-times-out to recovery');
}

// ─── 3. SafeRouteShell has a route-level loading timeout ────────
const shell = read('src/components/system/SafeRouteShell.jsx');
if (!shell) {
  fail('route-shell: SafeRouteShell.jsx must exist');
} else if (!/setTimeout/.test(shell) || !/timedOut/.test(shell)) {
  fail('route-shell: SafeRouteShell must have a route-level loading timeout');
} else {
  pass('route-shell: SafeRouteShell has a route-level loading timeout');
}

// ─── 4. AuthLoadingGate uses a timeout-bearing loader ──────────
const app = read('src/App.jsx');
if (!/function AuthLoadingGate\b/.test(app)) {
  fail('auth-gate: AuthLoadingGate not found in App.jsx');
} else {
  // The app-level loading return must be a timeout-bearing loader
  // (SafeLoader or PageLoader), never a raw no-timeout spinner.
  if (!/authLoading\s*\)\s*return\s*<\s*(SafeLoader|PageLoader)/.test(app)) {
    fail('auth-gate: AuthLoadingGate must return SafeLoader/PageLoader when authLoading (timeout-bearing)');
  } else {
    pass('auth-gate: AuthLoadingGate returns a timeout-bearing loader when authLoading');
  }
}
if (!/import\s+SafeLoader\s+from/.test(app)) {
  fail('auth-gate: App.jsx must import SafeLoader');
}

// ─── 5. Lazy-chunk boundary has recovery UI ────────────────────
const lazy = read('src/components/system/LazyLoadErrorBoundary.jsx');
if (!/data-testid=["']lazy-load-error-retry["']/.test(lazy)
    || !/data-testid=["']lazy-load-error-home["']/.test(lazy)) {
  fail('chunk: LazyLoadErrorBoundary must render a recovery panel (Try Again / Go Home)');
} else {
  pass('chunk: lazy-chunk boundary has recovery UI');
}

// ─── Report ────────────────────────────────────────────────────
if (FAILED.length > 0) {
  console.error('[check:no-infinite-loaders] FAIL');
  for (const f of FAILED) console.error('  ✗ ' + f);
  console.error(`\n${PASSED.length} passed, ${FAILED.length} failed.`);
  process.exit(1);
}
console.log('[check:no-infinite-loaders] PASS — every full-screen loader self-times-out to recovery.');
for (const p of PASSED) console.log('  ✓ ' + p);
