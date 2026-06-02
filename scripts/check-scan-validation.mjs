/**
 * check-scan-validation.mjs — locks the pilot validation contract.
 *
 * Fails build when:
 *   1. Prisma migration 20260602_scan_validation/migration.sql missing
 *      OR doesn't create all 3 tables.
 *   2. Prisma schema doesn't declare ScanValidation / ScanFeedback /
 *      ScanAccuracy models.
 *   3. server/src/ml/scanValidationMetrics.js missing OR doesn't
 *      export the 4 functions.
 *   4. app.js doesn't expose all 7 admin endpoints.
 *   5. src/pages/admin/ScanLabPage.jsx missing OR not admin-only.
 *   6. App.jsx doesn't lazy-import ScanLabPage AND wire
 *      /admin/scan-lab under RoleRoute.
 *   7. scripts/generate-scan-validation-report.mjs missing OR
 *      doesn't write SCAN_VALIDATION_REPORT.md.
 *   8. Honesty: metrics module returns null for unlabelled data
 *      (never fakes 0% accuracy).
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const errors = [];

function _exists(rel) {
  try { return fs.existsSync(path.join(ROOT, rel)); } catch { return false; }
}
function _read(rel) {
  try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch { return ''; }
}
function _has(haystack, needle, label) {
  if (!haystack.includes(needle)) errors.push(label);
}

// ─── 1. Migration ─────────────────────────────────────────────
const MIGRATION = 'server/prisma/migrations/20260602_scan_validation/migration.sql';
if (!_exists(MIGRATION)) {
  errors.push('missing migration: ' + MIGRATION);
} else {
  const src = _read(MIGRATION);
  const TABLES = ['scan_validations', 'scan_feedbacks', 'scan_accuracies'];
  for (const t of TABLES) {
    if (!src.includes('"' + t + '"')) {
      errors.push('migration missing CREATE TABLE for ' + t);
    }
  }
}

// ─── 2. Prisma schema ─────────────────────────────────────────
const SCHEMA = 'server/prisma/schema.prisma';
if (!_exists(SCHEMA)) {
  errors.push('missing: ' + SCHEMA);
} else {
  const src = _read(SCHEMA);
  const MODELS = ['model ScanValidation', 'model ScanFeedback', 'model ScanAccuracy'];
  for (const m of MODELS) {
    if (!src.includes(m)) {
      errors.push('Prisma schema missing ' + m);
    }
  }
}

// ─── 3. Metrics aggregator ────────────────────────────────────
const METRICS = 'server/src/ml/scanValidationMetrics.js';
if (!_exists(METRICS)) {
  errors.push('missing: ' + METRICS);
} else {
  const src = _read(METRICS);
  _has(src, 'export async function computeMetrics',
    'scanValidationMetrics must export computeMetrics');
  _has(src, 'export async function computeTopFailures',
    'scanValidationMetrics must export computeTopFailures');
  _has(src, 'export async function computeCalibration',
    'scanValidationMetrics must export computeCalibration');
  _has(src, 'export async function snapshotMetrics',
    'scanValidationMetrics must export snapshotMetrics');
  // Honesty: must return null when no labelled data (never fake 0%).
  _has(src, 'if (d === 0) return null',
    'scanValidationMetrics must return null when denominator is 0 (no fake 0%)');
}

// ─── 4. Admin routes ──────────────────────────────────────────
const APP = 'server/src/app.js';
if (!_exists(APP)) {
  errors.push('missing: ' + APP);
} else {
  const src = _read(APP);
  const ROUTES = [
    "app.post('/api/admin/scan-validation'",
    "app.patch('/api/admin/scan-validation/:id'",
    "app.get('/api/admin/scan-validation'",
    "app.post('/api/admin/scan-validation/feedback'",
    "app.get('/api/admin/scan-validation/metrics'",
    "app.get('/api/admin/scan-validation/top-failures'",
    "app.get('/api/admin/scan-validation/calibration'",
    "app.post('/api/admin/scan-validation/snapshot'",
  ];
  for (const r of ROUTES) {
    if (!src.includes(r)) {
      errors.push('app.js missing route: ' + r);
    }
  }
  // Admin guard helper.
  _has(src, "_requireAdmin",
    'app.js must define _requireAdmin guard');
}

// ─── 5. Scan Lab page ─────────────────────────────────────────
const LAB = 'src/pages/admin/ScanLabPage.jsx';
if (!_exists(LAB)) {
  errors.push('missing: ' + LAB);
} else {
  const src = _read(LAB);
  _has(src, "ALLOWED_ROLES = new Set(['admin', 'super_admin'])",
    'ScanLabPage must role-gate with ALLOWED_ROLES set');
  _has(src, 'data-testid="scan-lab-page"',
    'ScanLabPage must expose data-testid="scan-lab-page"');
  _has(src, 'data-consumes="scanValidation"',
    'ScanLabPage must declare data-consumes="scanValidation"');
  const SECTIONS = ['scan-lab-upload', 'scan-lab-metrics',
    'scan-lab-top-failures', 'scan-lab-calibration'];
  for (const s of SECTIONS) {
    if (!src.includes(s)) {
      errors.push('ScanLabPage missing section data-testid: ' + s);
    }
  }
  _has(src, 'data-testid="scan-lab-correct"',
    'ScanLabPage must expose ✓ Correct button');
  _has(src, 'data-testid="scan-lab-incorrect"',
    'ScanLabPage must expose ✗ Incorrect button');
}

// ─── 6. App.jsx wiring ────────────────────────────────────────
const APP_JSX = 'src/App.jsx';
if (!_exists(APP_JSX)) {
  errors.push('missing: ' + APP_JSX);
} else {
  const src = _read(APP_JSX);
  _has(src, "import('./pages/admin/ScanLabPage.jsx')",
    'App.jsx must lazy-import ScanLabPage');
  _has(src, '/admin/scan-lab',
    'App.jsx must route /admin/scan-lab');
  if (!/path="\/admin\/scan-lab"\s+element=\{<RoleRoute roles=\{ADMIN_ROLES\}>/.test(src)) {
    errors.push('App.jsx /admin/scan-lab route must wrap in <RoleRoute roles={ADMIN_ROLES}>');
  }
}

// ─── 7. Report generator ──────────────────────────────────────
const REPORT_SCRIPT = 'scripts/generate-scan-validation-report.mjs';
if (!_exists(REPORT_SCRIPT)) {
  errors.push('missing: ' + REPORT_SCRIPT);
} else {
  const src = _read(REPORT_SCRIPT);
  _has(src, 'SCAN_VALIDATION_REPORT.md',
    'report generator must write SCAN_VALIDATION_REPORT.md');
  _has(src, 'computeMetrics',
    'report generator must call computeMetrics');
  _has(src, 'computeTopFailures',
    'report generator must call computeTopFailures');
  _has(src, 'computeCalibration',
    'report generator must call computeCalibration');
}

if (errors.length) {
  console.error('[check:scan-validation] FAIL — ' + errors.length + ' violation(s):');
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}

console.log('[check:scan-validation] PASS — 3 Prisma models, 8 admin routes, scan-lab page, metrics module, report generator wired.');
