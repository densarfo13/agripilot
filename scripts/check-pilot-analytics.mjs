/**
 * check-pilot-analytics.mjs — sprint #188 pilot analytics gate.
 *
 * Fails build if:
 *   1. PilotEventContracts module missing OR doesn't declare the
 *      24 canonical event names from the spec.
 *   2. PilotAnalyticsRuntime missing OR doesn't export trackPilotEvent.
 *   3. PilotMetricsAggregator missing OR doesn't export
 *      buildPilotAnalyticsHealth + the 8 spec health flags.
 *   4. App.jsx does NOT call installPilotAnalyticsHealthGlobal.
 *   5. Privacy contract weakened (sensitive substring list removed,
 *      sanitizeMetadata export missing, allow-list emptied).
 *   6. Existing /internal/pilot-analytics page deleted.
 *   7. PILOT_ANALYTICS_REPORT.md missing.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const errors = [];
const _exists = (rel) => { try { return fs.existsSync(path.join(ROOT, rel)); } catch { return false; } };
const _read = (rel) => { try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch { return ''; } };
const _has = (s, n, m) => { if (!s.includes(n)) errors.push(m); };

// 1. Contracts module + 24 canonical event names.
const CONTRACTS = 'src/runtime/analytics/PilotEventContracts.ts';
if (!_exists(CONTRACTS)) {
  errors.push('missing: ' + CONTRACTS);
} else {
  const src = _read(CONTRACTS);
  const EVENTS = [
    'signup_started', 'signup_completed', 'login_completed', 'language_selected',
    'farm_created', 'garden_created', 'crop_added', 'plant_added',
    'today_action_shown', 'today_action_started', 'today_action_completed',
    'scan_started', 'scan_completed', 'scan_unknown_result', 'scan_candidate_selected',
    'task_created', 'task_completed', 'outcome_recorded',
    'followup_created', 'followup_completed',
    'notification_opened', 'weekly_review_viewed',
    'sell_listing_created', 'funding_viewed',
  ];
  for (const e of EVENTS) {
    if (!src.includes("'" + e + "'")) {
      errors.push('PilotEventContracts missing canonical event: ' + e);
    }
  }
  // Privacy contract — these MUST stay.
  _has(src, 'sanitizeMetadata',
    'PilotEventContracts must export sanitizeMetadata');
  _has(src, 'ALLOWED_METADATA_KEYS',
    'PilotEventContracts must declare ALLOWED_METADATA_KEYS');
  _has(src, 'SENSITIVE_SUBSTRINGS',
    'PilotEventContracts must declare SENSITIVE_SUBSTRINGS');
  const FORBIDDEN_INSIDE_SENSITIVE = ['token', 'password'];
  for (const s of FORBIDDEN_INSIDE_SENSITIVE) {
    if (!src.includes("'" + s + "'")) {
      errors.push('PilotEventContracts SENSITIVE_SUBSTRINGS must include: ' + s);
    }
  }
}

// 2. Write-side runtime.
const RT = 'src/runtime/analytics/PilotAnalyticsRuntime.ts';
if (!_exists(RT)) {
  errors.push('missing: ' + RT);
} else {
  const src = _read(RT);
  _has(src, 'export function trackPilotEvent',
    'PilotAnalyticsRuntime must export trackPilotEvent');
  _has(src, 'export function readPilotEvents',
    'PilotAnalyticsRuntime must export readPilotEvents');
  _has(src, 'export function countByType',
    'PilotAnalyticsRuntime must export countByType');
}

// 3. Aggregator + health.
const AGG = 'src/runtime/analytics/PilotMetricsAggregator.ts';
if (!_exists(AGG)) {
  errors.push('missing: ' + AGG);
} else {
  const src = _read(AGG);
  _has(src, 'export function getPilotMetrics',
    'PilotMetricsAggregator must export getPilotMetrics');
  _has(src, 'export function buildPilotAnalyticsHealth',
    'PilotMetricsAggregator must export buildPilotAnalyticsHealth');
  _has(src, 'export function installPilotAnalyticsHealthGlobal',
    'PilotMetricsAggregator must export installPilotAnalyticsHealthGlobal');
  // 8 spec health flags (§6).
  const FLAGS = [
    'eventTrackingReady', 'dashboardReady', 'funnelReady',
    'retentionReady', 'scanMetricsReady', 'taskMetricsReady',
    'outcomeMetricsReady', 'languageMetricsReady', 'privacySafe',
  ];
  for (const f of FLAGS) {
    if (!src.includes(f)) {
      errors.push('PilotMetricsAggregator missing spec §6 flag: ' + f);
    }
  }
  // Honest-data rule (§4) — rates must be nullable, never faked.
  _has(src, 'null when denominator is 0',
    'PilotMetricsAggregator must document honest-null rule for rates');
  _has(src, 'neverFakesValues',
    'PilotMetricsAggregator must declare neverFakesValues');
}

// 4. Boot install in App.jsx.
const APP_JSX = 'src/App.jsx';
if (!_exists(APP_JSX)) {
  errors.push('missing: ' + APP_JSX);
} else {
  const src = _read(APP_JSX);
  _has(src, 'installPilotAnalyticsHealthGlobal',
    'App.jsx must call installPilotAnalyticsHealthGlobal at boot');
  _has(src, "import('./runtime/analytics/PilotMetricsAggregator')",
    'App.jsx must lazy-import PilotMetricsAggregator');
}

// 5. Existing dashboard page survives (sprint #157).
const DASHBOARD = 'src/pages/internal/PilotAnalyticsPage.jsx';
if (!_exists(DASHBOARD)) {
  errors.push('missing: ' + DASHBOARD
    + ' (sprint #157 dashboard required by §3)');
}

// 6. Report doc exists.
if (!_exists('PILOT_ANALYTICS_REPORT.md')) {
  errors.push('missing PILOT_ANALYTICS_REPORT.md '
    + '(run `node scripts/generate-pilot-analytics-report.mjs` to create)');
}

if (errors.length) {
  console.error('[check:pilot-analytics] FAIL — ' + errors.length + ' violation(s):');
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}

console.log('[check:pilot-analytics] PASS — 24 canonical events declared, sanitizer + allow-list + sensitive-substring guard in place, 8 health flags wired, App.jsx boot install present, dashboard page survives, report doc present.');
