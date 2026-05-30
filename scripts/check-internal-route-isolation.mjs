#!/usr/bin/env node
/**
 * scripts/check-internal-route-isolation.mjs — Wave-27 CI gate.
 *
 * Statically enforces that admin-only / staff-only routes are
 * wrapped in <RoleRoute> with an explicit role list. The
 * founder-readiness audit (Part 3) caught two routes mounted
 * without any RoleRoute:
 *
 *   • /internal/production-certification
 *   • /program-dashboard
 *
 * This gate fails the build if either regresses or if any new
 * route under /internal/ is added without an explicit RoleRoute
 * wrapper.
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

const app = (() => {
  try { return fs.readFileSync(path.join(ROOT, 'src/App.jsx'), 'utf8'); }
  catch { return ''; }
})();

if (!app) {
  console.error('[check:internal-route-isolation] FAIL — src/App.jsx unreadable');
  process.exit(1);
}

// ─── 1. /internal/* routes must each include RoleRoute ─────────
// Look at each `<Route path="/internal/..."` declaration and scan
// up to 6 lines forward for the matching <RoleRoute>. Multi-line
// JSX (e.g. /internal/metrics + RC1RouteGate) is common, so a
// single-line regex would false-positive on a properly-gated route.
const lines = app.split('\n');
let internalCount = 0;
for (let i = 0; i < lines.length; i++) {
  if (!/path="\/internal\//.test(lines[i])) continue;
  internalCount++;
  const window = lines.slice(i, Math.min(lines.length, i + 7)).join('\n');
  if (!/RoleRoute\s+roles=/.test(window)) {
    fail(`internal-route: "${lines[i].trim()}" must wrap element in <RoleRoute roles={...}> within 6 lines`);
  }
}
if (internalCount > 0 && FAILED.length === 0) {
  pass(`internal-routes: ${internalCount} /internal/* routes all RoleRoute-gated`);
}

// ─── 2. Explicit critical routes must remain gated ─────────────
const CRITICAL_ROUTES = [
  { path: '/internal/production-certification', role: 'ADMIN_ROLES' },
  { path: '/program-dashboard',                 role: 'ADMIN_ROLES' },
];
for (const { path: routePath, role } of CRITICAL_ROUTES) {
  // The route line must include both the path AND RoleRoute on
  // the same line OR adjacent JSX. Use a regex tolerant to JSX
  // line breaks within the element.
  const escaped = routePath.replace(/\//g, '\\/');
  const re = new RegExp(`path="${escaped}"[^]*?<RoleRoute\\s+roles=\\{${role}\\}`);
  if (!re.test(app)) {
    fail(`critical-route: ${routePath} must wrap element in <RoleRoute roles={${role}}>`);
  }
}
if (FAILED.length === 0) {
  pass(`critical-routes: ${CRITICAL_ROUTES.length} wave-27 gates present`);
}

// ─── Report ────────────────────────────────────────────────────
if (FAILED.length > 0) {
  console.error('[check:internal-route-isolation] FAIL');
  for (const f of FAILED) console.error('  ✗ ' + f);
  console.error(`\n${PASSED.length} checks passed, ${FAILED.length} failed.`);
  process.exit(1);
}
console.log('[check:internal-route-isolation] PASS — admin / internal routes RoleRoute-gated.');
for (const p of PASSED) console.log('  ✓ ' + p);
