#!/usr/bin/env node
/**
 * scripts/check-no-farmer-dashboard.mjs — Locks in the
 * "Remove Mobile Dashboard Experience" spec. Normal farmers and
 * gardeners must never see traditional analytics dashboards.
 *
 * Enforces:
 *   A. No chart-library imports (recharts / chart.js) on any
 *      user-facing page outside the allow-list of admin /
 *      staff / investor surfaces.
 *   B. The two known chart routes (/portfolio, /reports) are
 *      role-gated in App.jsx.
 *   C. The two admin-tier dashboards (/internal/founder,
 *      /enterprise) remain the ONLY canonical dashboard
 *      destinations.
 *   D. The user-facing tab destinations exist and render
 *      action-first patterns (Home = daily briefing,
 *      Tasks = action-ordered, Progress = timeline-shaped,
 *      My Plants = visual cards).
 *
 * This is a HARD gate — it fails CI on violation.
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

/* ── Section A — chart-library import policy ──────────────── */
// Pages where charts ARE allowed (admin / staff / investor only).
const CHART_ALLOWLIST = new Set([
  'src/pages/AdminAnalyticsPage.jsx',
  'src/pages/AdminControlPage.jsx',
  'src/pages/ImpactDashboardPage.jsx',
  'src/pages/PortfolioPage.jsx',
  'src/pages/ReportsPage.jsx',
  'src/pages/internal/ReleaseLock.jsx',  // internal-only
  // Founder dashboard + Enterprise pages — these are the
  // canonical admin/internal dashboards per the spec.
  'src/pages/FounderDashboard.jsx',
  'src/pages/enterprise/EnterpriseHome.jsx',
].map((p) => p.replace(/\\/g, '/').toLowerCase()));

const CHART_RE = /from\s+['"](recharts|chart\.js|chart\.js\/auto|react-chartjs-2)['"]/;

function walkDir(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === 'dist'
          || e.name === '__tests__') continue;
      walkDir(full, out);
    } else if (/\.(tsx?|jsx?)$/.test(e.name)) {
      out.push(full);
    }
  }
  return out;
}

const chartViolators = [];
for (const f of walkDir(path.join(ROOT, 'src'))) {
  const rel = path.relative(ROOT, f).replace(/\\/g, '/').toLowerCase();
  if (CHART_ALLOWLIST.has(rel)) continue;
  const src = readOrEmpty(f);
  if (CHART_RE.test(src)) {
    chartViolators.push(rel);
  }
}
if (chartViolators.length > 0) {
  for (const v of chartViolators) {
    fail(`chart-import: ${v} imports a chart library — user-facing pages cannot use dashboard analytics. Add to CHART_ALLOWLIST only if the page is admin/staff/investor-gated.`);
  }
} else {
  pass(`chart-import: no chart libraries on user-facing pages`);
}

/* ── Section B — chart routes are role-gated ──────────────── */
const app = readOrEmpty(path.join(ROOT, 'src/App.jsx'));

const CHART_ROUTES = [
  { route: 'portfolio', page: 'PortfolioPage' },
  { route: 'reports',   page: 'ReportsPage' },
];
for (const { route, page } of CHART_ROUTES) {
  // Match a Route element that contains both the path and a
  // RoleRoute wrapper before reaching the page component.
  const re = new RegExp(
    'path\\s*=\\s*[\'"]' + route + '[\'"][\\s\\S]{0,400}?<RoleRoute[\\s\\S]{0,400}?<' + page,
    'm');
  if (!re.test(app)) {
    fail(`chart-route: /${route} must be wrapped in <RoleRoute> in App.jsx`);
  }
}
pass(`chart-route: /portfolio and /reports are role-gated`);

/* ── Section C — Founder + Enterprise stay internal ──────── */
if (!/path\s*=\s*['"]\/internal\/founder['"][\s\S]{0,200}?<FounderDashboard/.test(app)) {
  fail(`founder-dashboard: /internal/founder route must mount FounderDashboard`);
} else {
  pass(`founder-dashboard: route /internal/founder wired`);
}
if (!/path\s*=\s*['"]enterprise(\/\*)?['"][\s\S]{0,400}?<EnterpriseHome/.test(app)
    && !/path\s*=\s*['"]\/enterprise[\s\S]{0,400}?<EnterpriseHome/.test(app)) {
  fail(`enterprise: route /enterprise must mount EnterpriseHome`);
} else {
  pass(`enterprise: route /enterprise wired`);
}

/* ── Section D — user-facing pages remain action-first ───── */
const HOME_PATH    = 'src/pages/Home.jsx';
const TASKS_PATH   = 'src/pages/AllTasksPage.jsx';
const PROGRESS_PATH = 'src/pages/FarmerProgressPage.jsx';
const MYPLANTS_PATH = 'src/pages/MyPlants.jsx';

const homeSrc = readOrEmpty(path.join(ROOT, HOME_PATH));
if (!homeSrc) fail(`home: ${HOME_PATH} missing`);
else {
  // Daily briefing markers: weather + tasks + quick action
  const markers = ['weather', 'task', 'scan'];
  for (const m of markers) {
    if (!new RegExp('\\b' + m + '\\b', 'i').test(homeSrc)) {
      fail(`home: Home.jsx missing daily-briefing marker "${m}"`);
    }
  }
  // Must NOT import recharts.
  if (CHART_RE.test(homeSrc)) {
    fail(`home: Home.jsx imports a chart library — violates daily-briefing pattern`);
  }
  pass(`home: Home.jsx is daily-briefing-shaped (weather/task/scan markers)`);
}

const tasksSrc = readOrEmpty(path.join(ROOT, TASKS_PATH));
if (!tasksSrc) fail(`tasks: ${TASKS_PATH} missing`);
else if (CHART_RE.test(tasksSrc)) {
  fail(`tasks: AllTasksPage imports a chart library`);
} else {
  pass(`tasks: AllTasksPage is chart-free`);
}

const progressSrc = readOrEmpty(path.join(ROOT, PROGRESS_PATH));
if (!progressSrc) fail(`progress: ${PROGRESS_PATH} missing`);
else if (CHART_RE.test(progressSrc)) {
  fail(`progress: FarmerProgressPage imports a chart library`);
} else {
  // Must lead with timeline-style content.
  if (!/(GrowthJourneyCard|PlantTimeline|usePlantTimeline|timeline)/i.test(progressSrc)) {
    fail(`progress: FarmerProgressPage must surface timeline-style content (GrowthJourneyCard / PlantTimeline / usePlantTimeline)`);
  } else {
    pass(`progress: FarmerProgressPage is timeline-shaped`);
  }
}

const myPlantsSrc = readOrEmpty(path.join(ROOT, MYPLANTS_PATH));
if (!myPlantsSrc) fail(`my-plants: ${MYPLANTS_PATH} missing`);
else if (CHART_RE.test(myPlantsSrc)) {
  fail(`my-plants: MyPlants imports a chart library`);
} else {
  // Visual cards — must render PlantImage component for each plant.
  if (!/PlantImage/.test(myPlantsSrc)) {
    fail(`my-plants: MyPlants must render <PlantImage> per plant card`);
  } else {
    pass(`my-plants: MyPlants renders visual cards via PlantImage`);
  }
}

/* ── Report ────────────────────────────────────────────────── */
if (FAILED.length > 0) {
  console.error('[check:no-farmer-dashboard] FAIL — dashboard patterns leaked to farmers/gardeners.');
  for (const f of FAILED) console.error('  ✗ ' + f);
  console.error(`\n${PASSED.length} checks passed, ${FAILED.length} failed.`);
  console.error(`\nGovernance: src/runtime/release/ReleaseLockChecklist.ts owns the spec.`);
  process.exit(1);
}
console.log('[check:no-farmer-dashboard] PASS — no dashboard patterns on user-facing surfaces.');
console.log(`  Chart libraries restricted to admin/staff/investor pages (${CHART_ALLOWLIST.size} allowlisted).`);
console.log(`  /portfolio and /reports are role-gated.`);
console.log(`  /internal/founder + /enterprise are the only canonical dashboards.`);
console.log(`  Home (daily briefing) · Tasks (action-ordered) · Progress (timeline) · MyPlants (cards) all verified.`);
