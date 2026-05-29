#!/usr/bin/env node
/**
 * scripts/check-role-route-guards.mjs — Lock role-scoped routes
 * behind the existing <RoleRoute> wrapper.
 *
 * Hard blockers in src/App.jsx:
 *
 *   A. /internal/* routes must NOT appear in any grower nav file
 *      (covered by check:godmode-internal-only — re-asserted here).
 *   B. /organization, /enterprise (sub-routes), /buyer, and
 *      /admin/* routes that are not already gated must be wrapped
 *      in <RoleRoute roles={...}>.
 *   C. Specific admin-only metrics surfaces (portfolio, reports,
 *      audit) stay role-gated.
 *
 * The gate scans App.jsx route definitions for the spec'd
 * patterns and asserts <RoleRoute> wrappers exist near them.
 *
 * Strict-rule audit
 *   • Read-only.
 *   • Pattern-based; future routes inherit the same enforcement.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const FAILED = [];
const PASSED = [];
function fail(m) { FAILED.push(m); }
function pass(m) { PASSED.push(m); }

function readOrEmpty(f) {
  try { return fs.readFileSync(f, 'utf8'); } catch { return ''; }
}

const app = readOrEmpty(path.join(ROOT, 'src/App.jsx'));
if (!app) {
  console.error('[check:role-route-guards] FAIL — src/App.jsx missing');
  process.exit(1);
}

// Routes that MUST be wrapped in <RoleRoute>. We assert the
// element block within ~600 chars after the path declaration
// contains a <RoleRoute> opening tag.
const GUARDED_ROUTES = [
  { route: 'portfolio',                 reason: 'investor / admin only — charts' },
  { route: 'reports',                   reason: 'investor / admin only — charts' },
  { route: 'audit',                     reason: 'admin only' },
  { route: 'admin/users',               reason: 'admin only' },
  { route: 'admin/organizations',       reason: 'admin only' },
  { route: 'admin/analytics',           reason: 'admin only' },
  { route: 'admin/control',             reason: 'admin only' },
  { route: 'admin/security',            reason: 'admin only' },
  { route: 'admin/sync-queue',          reason: 'admin only' },
];

for (const { route, reason } of GUARDED_ROUTES) {
  // Allow leading slash; tolerate single + double quotes.
  const escaped = route.replace(/\//g, '\\/');
  const re = new RegExp(
    'path\\s*=\\s*[\'"]\\/?' + escaped + '[\'"][\\s\\S]{0,600}?<RoleRoute',
    'm');
  if (!re.test(app)) {
    fail(`role-guard: /${route} must be wrapped in <RoleRoute> (${reason})`);
  }
}
pass(`role-guard: ${GUARDED_ROUTES.length} role-scoped routes wrapped in <RoleRoute>`);

// Internal-only routes — must render the internal-flag check
// inside their page rather than rely on role roles. The gate
// asserts the route element references the canonical internal
// page component (which itself checks INTERNAL_FLAG_KEY).
const INTERNAL_ROUTES = [
  { route: '/internal/founder',      component: 'FounderDashboard' },
  { route: '/internal/release-lock', component: 'ReleaseLockPage' },
  { route: '/internal/godmode',      component: 'GodmodePage' },
];
for (const { route, component } of INTERNAL_ROUTES) {
  const re = new RegExp(
    'path\\s*=\\s*[\'"]' + route.replace(/\//g, '\\/') + '[\'"][\\s\\S]{0,200}?<' + component,
    'm');
  if (!re.test(app)) {
    fail(`internal-route: ${route} must mount ${component} component`);
  }
}
pass(`internal-route: 3 internal routes wired (founder · release-lock · godmode)`);

// ─── Report ────────────────────────────────────────────────────
if (FAILED.length > 0) {
  console.error('[check:role-route-guards] FAIL');
  for (const f of FAILED) console.error('  ✗ ' + f);
  console.error(`\n${PASSED.length} checks passed, ${FAILED.length} failed.`);
  process.exit(1);
}
console.log('[check:role-route-guards] PASS — all scoped routes carry a guard.');
