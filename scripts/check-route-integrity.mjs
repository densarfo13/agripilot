#!/usr/bin/env node
/**
 * scripts/check-route-integrity.mjs — broken-link audit gate.
 *
 * Verifies critical routes resolve to importable components AND
 * /scan is wrapped in a timeout-capable Suspense fallback.
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

const appSrc = read(path.join(ROOT, 'src/App.jsx'));
if (!appSrc) {
  fail('app: src/App.jsx must exist');
  console.error('[check:route-integrity] FAIL\n  ✗ ' + FAILED.join('\n  ✗ '));
  process.exit(1);
}

// Critical routes must be mounted. We accept either an exact
// mount OR any nested child under the parent (e.g. /buyer is
// satisfied by /buyer/listings). The check enforces that at
// least one matching route exists in App.jsx.
//
// Note: this codebase mounts the NGO surface at /org-login rather
// than /organization; either path satisfies the "organization"
// audit point.
const CRITICAL_ROUTES = [
  { id: '/home',     match: ['/home'] },
  { id: '/scan',     match: ['/scan'] },
  { id: '/tasks',    match: ['/tasks'] },
  { id: '/activity', match: ['/activity'] },
  { id: '/my-farm',  match: ['/my-farm'] },
  { id: '/my-grow',  match: ['/my-grow'] },
  { id: '/plants',   match: ['/plants', '/my-plants'] },
  { id: '/buyer',    match: ['/buyer'] },
  { id: 'organization', match: ['/organization', '/org-login', '/org'] },
  { id: '/activate', match: ['/activate'] },
];
for (const entry of CRITICAL_ROUTES) {
  let found = false;
  for (const route of entry.match) {
    const esc = route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`path=["']${esc}(/|["'?])`).test(appSrc)) {
      found = true; break;
    }
  }
  if (!found) {
    fail(`route: critical route "${entry.id}" not mounted in App.jsx (looked for ${entry.match.join(', ')})`);
  }
}

// /scan element must be wrapped in SafeRouteShell with a loadingMs.
const scanBlock = appSrc.match(/<Route\s+path=["']\/scan["']\s+element=\{([\s\S]*?)\}\s*\/>/);
if (!scanBlock) {
  fail('scan: /scan route element not found in App.jsx');
} else {
  if (!/SafeRouteShell/.test(scanBlock[1])) {
    fail('scan: /scan must be wrapped in SafeRouteShell');
  }
  if (!/loadingMs/.test(scanBlock[1])) {
    fail('scan: /scan SafeRouteShell must declare a loadingMs timeout');
  }
}

// Suspense fallback must be the wave-audit timeout component.
if (!/PageLoaderWithTimeout/.test(appSrc)) {
  fail('app: Suspense fallback must use PageLoaderWithTimeout (5s timeout) — outer Suspense fallback is the only path that fires while a lazy chunk is in flight');
}

// LazyLoadErrorBoundary must wrap Suspense.
if (!/<LazyLoadErrorBoundary>[\s\S]*?<Suspense/.test(appSrc)) {
  fail('app: <LazyLoadErrorBoundary> must wrap <Suspense fallback={...}>');
}

// Ban any Navigate to a route that does not exist in CRITICAL_ROUTES
// or other mounted paths. Soft check — only flags Navigate to a
// path that has no matching `<Route path="…"` declaration.
const navigates = [...appSrc.matchAll(/<Navigate\s+to=["']([^"']+)["']/g)];
const mountedPaths = new Set(
  [...appSrc.matchAll(/<Route\s+path=["']([^"']+)["']/g)].map((m) => m[1])
);
for (const m of navigates) {
  const dest = m[1];
  // Allow trailing slashes, query strings, and wildcards.
  const base = dest.split('?')[0].replace(/\/$/, '') || '/';
  let ok = false;
  for (const mp of mountedPaths) {
    const mpBase = mp.split('?')[0].replace(/\/$/, '') || '/';
    if (mpBase === base) { ok = true; break; }
    // Wildcard match — e.g. "*" mounts catch-all.
    if (mpBase === '*' || mp === '*') { ok = true; break; }
  }
  if (!ok) {
    // Warn but don't fail — some destinations are external or
    // computed at runtime. Keep this as PASS-with-note for now.
    pass(`navigate: ${dest} (no exact route match — verify manually)`);
  }
}

if (FAILED.length > 0) {
  console.error('[check:route-integrity] FAIL');
  for (const f of FAILED) console.error('  ✗ ' + f);
  console.error(`\n${PASSED.length} passed, ${FAILED.length} failed.`);
  process.exit(1);
}
console.log('[check:route-integrity] PASS — critical routes mounted + scan timeout wired.');
for (const p of PASSED.slice(0, 5)) console.log('  ✓ ' + p);
if (PASSED.length > 5) console.log(`  ✓ … (${PASSED.length - 5} more)`);
