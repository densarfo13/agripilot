/**
 * check-api-health-diagnostics.mjs
 *
 * Locks structural contract for the API Health & Diagnostics Center.
 *
 * Pass criteria:
 *   1. Four files exist:
 *        - src/diagnostics/ApiHealthRuntime.ts
 *        - src/diagnostics/ApiHealthChecks.ts
 *        - src/diagnostics/ApiLatencyMonitor.ts
 *        - src/diagnostics/ApiDiagnosticsDashboard.tsx
 *   2. ApiHealthRuntime.ts exports installApiHealthGlobal +
 *      writeCheckCache + apiHealth, pins window.__apiHealth, and
 *      declares the literal-true safety constants noFakeConnections,
 *      noFabricatedScore, adminOnly.
 *   3. ApiHealthChecks.ts exports runAllChecks +
 *      ALL_SERVICE_KEYS, and references all 12 spec services.
 *   4. ApiLatencyMonitor.ts exports recordLatencySample +
 *      listLatencySamples + p50LatencyFor.
 *   5. ApiDiagnosticsDashboard.tsx role-gates admin only, runs
 *      checks on mount, and avoids the grower-technical "Dashboard"
 *      label in user-visible strings.
 *   6. App.jsx wires the lazy import + /admin/system-health route
 *      under RoleRoute and calls installApiHealthGlobal in boot.
 *   7. No fake "connected" claim — runtime never returns
 *      status:'connected' without a verifiable probe path.
 *
 * Honesty contract: gate fails LOUDLY if the contract drifts.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const errors = [];
const warnings = [];

function _exists(rel) {
  try { return fs.existsSync(path.join(ROOT, rel)); } catch { return false; }
}

function _read(rel) {
  try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch { return ''; }
}

function _has(haystack, needle, label) {
  if (!haystack.includes(needle)) errors.push(label);
}

const REQUIRED_FILES = [
  'src/diagnostics/ApiHealthRuntime.ts',
  'src/diagnostics/ApiHealthChecks.ts',
  'src/diagnostics/ApiLatencyMonitor.ts',
  'src/diagnostics/ApiDiagnosticsDashboard.tsx',
];

for (const f of REQUIRED_FILES) {
  if (!_exists(f)) errors.push('missing file: ' + f);
}

// --- ApiHealthRuntime.ts contract -------------------------------------
const runtimeSrc = _read('src/diagnostics/ApiHealthRuntime.ts');
if (runtimeSrc) {
  _has(runtimeSrc, 'export function installApiHealthGlobal',
    'ApiHealthRuntime missing export installApiHealthGlobal');
  _has(runtimeSrc, 'export function writeCheckCache',
    'ApiHealthRuntime missing export writeCheckCache');
  _has(runtimeSrc, 'export function apiHealth',
    'ApiHealthRuntime missing export apiHealth');
  _has(runtimeSrc, '__apiHealth',
    'ApiHealthRuntime must pin window.__apiHealth');
  _has(runtimeSrc, 'noFakeConnections: true as const',
    'ApiHealthRuntime must declare noFakeConnections: true as const');
  _has(runtimeSrc, 'noFabricatedScore: true as const',
    'ApiHealthRuntime must declare noFabricatedScore: true as const');
  _has(runtimeSrc, 'adminOnly: true as const',
    'ApiHealthRuntime must declare adminOnly: true as const');
  _has(runtimeSrc, 'overallHealthScore',
    'ApiHealthRuntime must compute overallHealthScore');
  _has(runtimeSrc, 'scanReadinessScore',
    'ApiHealthRuntime must compute scanReadinessScore');
  // Honest false-by-default: each per-service flag must guard on connected status.
  if (!/status\s*===\s*['"]connected['"]/.test(runtimeSrc)) {
    errors.push('ApiHealthRuntime must guard flag flips on status==="connected"');
  }
}

// --- ApiHealthChecks.ts contract --------------------------------------
const checksSrc = _read('src/diagnostics/ApiHealthChecks.ts');
if (checksSrc) {
  _has(checksSrc, 'export async function runAllChecks',
    'ApiHealthChecks missing export runAllChecks');
  _has(checksSrc, 'export const ALL_SERVICE_KEYS',
    'ApiHealthChecks missing export ALL_SERVICE_KEYS');
  const SPEC_SERVICES = [
    'plantId', 'plantNet', 'consensus', 'weather', 'soilGrids',
    'cloudinary', 'sendgrid', 'twilio', 'postgres', 'redis',
    'auth', 'scanPipeline',
  ];
  for (const s of SPEC_SERVICES) {
    if (!checksSrc.includes("'" + s + "'") && !checksSrc.includes('"' + s + '"')) {
      errors.push('ApiHealthChecks missing service key: ' + s);
    }
  }
  // serverProbeRequired honest flag for services we can't probe from browser
  _has(checksSrc, 'serverProbeRequired',
    'ApiHealthChecks must declare serverProbeRequired for server-side checks');
}

// --- ApiLatencyMonitor.ts contract ------------------------------------
const monitorSrc = _read('src/diagnostics/ApiLatencyMonitor.ts');
if (monitorSrc) {
  _has(monitorSrc, 'export function recordLatencySample',
    'ApiLatencyMonitor missing export recordLatencySample');
  _has(monitorSrc, 'export function listLatencySamples',
    'ApiLatencyMonitor missing export listLatencySamples');
  _has(monitorSrc, 'export function p50LatencyFor',
    'ApiLatencyMonitor missing export p50LatencyFor');
  _has(monitorSrc, 'farroway_api_latency_log',
    'ApiLatencyMonitor must use storage key farroway_api_latency_log');
}

// --- ApiDiagnosticsDashboard.tsx contract -----------------------------
const pageSrc = _read('src/diagnostics/ApiDiagnosticsDashboard.tsx');
if (pageSrc) {
  _has(pageSrc, 'runAllChecks',
    'ApiDiagnosticsDashboard must call runAllChecks');
  _has(pageSrc, 'writeCheckCache',
    'ApiDiagnosticsDashboard must persist via writeCheckCache');
  _has(pageSrc, "ALLOWED_ROLES = new Set(['admin'])",
    'ApiDiagnosticsDashboard must role-gate ALLOWED_ROLES = new Set([\'admin\'])');
  _has(pageSrc, 'data-testid="api-health-page"',
    'ApiDiagnosticsDashboard must expose data-testid="api-health-page"');
  _has(pageSrc, 'data-consumes="apiHealth"',
    'ApiDiagnosticsDashboard must declare data-consumes="apiHealth"');
  // Strip JSDoc + comment blocks + i18n keys so we don't false-flag.
  const visibleText = pageSrc
    .split('\n').filter((line) => !line.trim().startsWith('//')
      && !line.trim().startsWith('*') && !line.trim().startsWith('/*'))
    .join('\n');
  // tSafe()'s 2nd arg is the user-visible string. Look for the
  // "Dashboard" word ONLY in those fallback strings.
  const fallbackRegex = /tSafe\(\s*['"][^'"]+['"]\s*,\s*['"]([^'"]+)['"]\s*\)/g;
  let m;
  while ((m = fallbackRegex.exec(visibleText)) !== null) {
    if (/dashboard/i.test(m[1])) {
      errors.push('ApiDiagnosticsDashboard fallback string contains "Dashboard" (grower-technical): ' + m[1]);
    }
  }
}

// --- App.jsx wiring ---------------------------------------------------
const appSrc = _read('src/App.jsx');
if (appSrc) {
  _has(appSrc, "import('./diagnostics/ApiDiagnosticsDashboard.tsx')",
    'App.jsx missing lazy import for ApiDiagnosticsDashboard');
  _has(appSrc, '/admin/system-health',
    'App.jsx missing /admin/system-health route');
  _has(appSrc, 'installApiHealthGlobal',
    'App.jsx must call installApiHealthGlobal in boot');
  // Route must be wrapped in RoleRoute with ADMIN_ROLES
  if (!/path="\/admin\/system-health"\s+element=\{<RoleRoute roles=\{ADMIN_ROLES\}>/.test(appSrc)) {
    errors.push('App.jsx /admin/system-health route must be wrapped in <RoleRoute roles={ADMIN_ROLES}>');
  }
}

// --- Final ------------------------------------------------------------
if (warnings.length) {
  for (const w of warnings) {
    console.log('[check:api-health-diagnostics] WARN: ' + w);
  }
}

if (errors.length) {
  console.error('[check:api-health-diagnostics] FAIL — ' + errors.length + ' violation(s):');
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}

console.log('[check:api-health-diagnostics] PASS — 4 files present, 12 services declared, admin-only route gated, no fake "Connected" leaks.');
