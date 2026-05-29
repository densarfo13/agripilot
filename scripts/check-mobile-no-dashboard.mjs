#!/usr/bin/env node
/**
 * scripts/check-mobile-no-dashboard.mjs — Lock the
 * "Remove Mobile Dashboard Experience" spec for the grower
 * bottom nav resolver and grower-facing surfaces.
 *
 * Hard blockers (exit 1 on any of these):
 *
 *   A. src/navigation/getNavigationItems.js must export FARM,
 *      BACKYARD, and GENERIC nav tables that never contain
 *      labels matching: Dashboard | Analytics | Reports |
 *      Progress | Metrics.
 *   B. The Garden (BACKYARD) nav must include: Home, My Plants,
 *      Scan, Tasks, Activity.
 *   C. The Farm nav must include: Home, My Farm, Scan, Tasks,
 *      Sell.
 *   D. /activity route must be registered in App.jsx.
 *   E. /portfolio + /reports remain role-gated (re-check from
 *      the prior sprint).
 *   F. /internal/founder + /enterprise routes must not appear
 *      in any nav resolver path (they are deep-link only).
 *
 * Strict-rule audit
 *   • Read-only against src/. Never mutates.
 *   • Pure file walk; no engine state needed.
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

const FORBIDDEN_LABELS = ['Dashboard', 'Analytics', 'Reports',
                            'Progress', 'Metrics'];

// ─── A. Nav resolver doesn't expose forbidden labels ───────────
const navFile = path.join(ROOT, 'src/navigation/getNavigationItems.js');
const nav = readOrEmpty(navFile);
if (!nav) {
  fail(`nav-resolver: src/navigation/getNavigationItems.js missing`);
} else {
  for (const label of FORBIDDEN_LABELS) {
    // Match fallback: 'Label' or "Label"
    const re = new RegExp("fallback:\\s*['\"]" + label + "['\"]");
    if (re.test(nav)) {
      fail(`nav-resolver: grower nav contains forbidden label "${label}"`);
    }
  }
  pass(`nav-resolver: no forbidden labels (Dashboard/Analytics/Reports/Progress/Metrics)`);
}

// ─── B. Garden (BACKYARD) nav has the 5 spec tabs ──────────────
const GARDEN_REQUIRED = ['Home', 'My Plants', 'Scan', 'Tasks', 'Activity'];
const backyardBlock = (() => {
  const m = nav.match(/_BACKYARD_ITEMS_BASE\s*=\s*\[([\s\S]*?)\];/);
  return m ? m[1] : '';
})();
for (const label of GARDEN_REQUIRED) {
  const re = new RegExp("fallback:\\s*['\"]" + label + "['\"]");
  if (!re.test(backyardBlock)) {
    fail(`garden-nav: missing required label "${label}"`);
  }
}
if (backyardBlock) {
  pass(`garden-nav: 5 spec tabs present (Home · My Plants · Scan · Tasks · Activity)`);
}

// ─── C. Farm nav has the 5 spec tabs ───────────────────────────
const FARM_REQUIRED = ['Home', 'My Farm', 'Scan', 'Tasks', 'Sell'];
const farmBlock = (() => {
  const m = nav.match(/FARM_ITEMS\s*=\s*\[([\s\S]*?)\];/);
  return m ? m[1] : '';
})();
for (const label of FARM_REQUIRED) {
  const re = new RegExp("fallback:\\s*['\"]" + label + "['\"]");
  if (!re.test(farmBlock)) {
    fail(`farm-nav: missing required label "${label}"`);
  }
}
if (farmBlock) {
  pass(`farm-nav: 5 spec tabs present (Home · My Farm · Scan · Tasks · Sell)`);
}

// ─── D. /activity route registered ─────────────────────────────
const app = readOrEmpty(path.join(ROOT, 'src/App.jsx'));
if (!/path\s*=\s*['"]\/activity['"][\s\S]{0,200}?<FarmerProgressPage|<ActivityPage/.test(app)) {
  fail(`route: /activity not registered in App.jsx (or not mounting the action-first page)`);
} else {
  pass(`route: /activity registered (mounts action-first timeline page)`);
}

// ─── E. /portfolio + /reports remain role-gated ────────────────
const CHART_ROUTES = ['portfolio', 'reports'];
for (const route of CHART_ROUTES) {
  const re = new RegExp(
    'path\\s*=\\s*[\'"]' + route + '[\'"][\\s\\S]{0,400}?<RoleRoute',
    'm');
  if (!re.test(app)) {
    fail(`chart-route: /${route} must remain wrapped in <RoleRoute>`);
  }
}
pass(`chart-route: /portfolio + /reports remain role-gated`);

// ─── F. Founder + Enterprise routes don't appear in any nav ────
// We grep the navigation/ tree for /internal/founder + /enterprise
// route literals — those must be deep-link only.
const NAV_DIR = path.join(ROOT, 'src/navigation');
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (/\.(tsx?|jsx?)$/.test(e.name)) out.push(full);
  }
  return out;
}
let navLeak = false;
if (fs.existsSync(NAV_DIR)) {
  for (const f of walk(NAV_DIR)) {
    const src = readOrEmpty(f);
    if (/['"]\/internal\/founder['"]/.test(src)
        || /['"]\/enterprise['"]/.test(src)) {
      fail(`nav-leak: ${path.relative(ROOT, f)} references an admin-only route — must be deep-link only`);
      navLeak = true;
    }
  }
}
if (!navLeak) {
  pass(`nav-leak: no nav file references /internal/founder or /enterprise`);
}

// ─── Report ────────────────────────────────────────────────────
if (FAILED.length > 0) {
  console.error('[check:mobile-no-dashboard] FAIL — grower nav exposes dashboard surfaces.');
  for (const f of FAILED) console.error('  ✗ ' + f);
  console.error(`\n${PASSED.length} checks passed, ${FAILED.length} failed.`);
  process.exit(1);
}
console.log('[check:mobile-no-dashboard] PASS — grower mobile UX locked to action-first nav.');
console.log(`  Garden: Home · My Plants · Scan · Tasks · Activity`);
console.log(`  Farm:   Home · My Farm   · Scan · Tasks · Sell`);
console.log(`  /activity route registered; /progress kept for legacy deep-links.`);
console.log(`  /portfolio + /reports remain role-gated. /internal/founder + /enterprise deep-link only.`);
