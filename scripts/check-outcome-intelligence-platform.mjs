/**
 * check-outcome-intelligence-platform.mjs — locks the Outcome
 * Intelligence Platform contract.
 *
 * Fails build when:
 *   1. Migration 20260602b_outcome_intelligence missing OR doesn't
 *      create all 4 tables.
 *   2. Prisma schema missing TaskOutcome / RecommendationOutcome /
 *      PhotoComparison / FarmHealthScore models.
 *   3. server/src/ml/outcomeIntelligenceEngine.js missing OR
 *      doesn't export the 5 functions.
 *   4. app.js missing any of the 8 outcome routes.
 *   5. OutcomeIntelligencePlatformRuntime missing OR doesn't pin
 *      __outcomeIntelligencePlatformHealth.
 *   6. OutcomeIntelligencePlatformTracker missing OR doesn't export
 *      the 7 client helpers.
 *   7. Components: TaskOutcomePrompt, FollowUpPrompt,
 *      PhotoComparisonCard missing OR missing the spec buttons.
 *   8. Pages: FarmerOutcomesPage at /outcomes,
 *      OrganizationOutcomesPage at /admin/organization-outcomes.
 *   9. App.jsx boot calls installOutcomeIntelligencePlatformGlobal.
 *  10. Honesty rule: engine returns null when sample size below
 *      MIN_SAMPLE_SIZE (never fakes 0%).
 *
 * Spec-mandated rules (BUILD SAFE):
 *   11. Task path: TaskOutcomePrompt must include Yes/Partially/No.
 *   12. Recommendation path: FollowUpPrompt must include
 *       Improved/No Change/Worse buttons AND server route /api/outcomes/follow-up
 *       must enforce dayOffset ∈ [3, 7, 14].
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
const MIGRATION = 'server/prisma/migrations/20260602120000_outcome_intelligence/migration.sql';
if (!_exists(MIGRATION)) {
  errors.push('missing migration: ' + MIGRATION);
} else {
  const src = _read(MIGRATION);
  for (const t of ['task_outcomes', 'recommendation_outcomes',
                   'photo_comparisons', 'farm_health_scores']) {
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
  for (const m of ['model TaskOutcome', 'model RecommendationOutcome',
                   'model PhotoComparison', 'model FarmHealthScore']) {
    if (!src.includes(m)) errors.push('schema missing ' + m);
  }
}

// ─── 3. Engine ────────────────────────────────────────────────
const ENGINE = 'server/src/ml/outcomeIntelligenceEngine.js';
if (!_exists(ENGINE)) {
  errors.push('missing: ' + ENGINE);
} else {
  const src = _read(ENGINE);
  for (const fn of ['computeRecommendationSuccess', 'rankRecommendations',
                    'computeFarmerDashboard', 'computeOrgDashboard',
                    'computeCommandCenterMetrics', 'snapshotFarmHealth']) {
    if (!src.includes('export async function ' + fn)
        && !src.includes('export function ' + fn)) {
      errors.push('outcomeIntelligenceEngine missing export ' + fn);
    }
  }
  // Honesty: null when sample size insufficient.
  _has(src, 'if (!d || d === 0) return null',
    'outcomeIntelligenceEngine must return null when denominator is 0 (no fake 0%)');
}

// ─── 4. Routes ────────────────────────────────────────────────
const APP = 'server/src/app.js';
if (!_exists(APP)) {
  errors.push('missing: ' + APP);
} else {
  const src = _read(APP);
  for (const r of [
    "app.post('/api/outcomes/task'",
    "app.post('/api/outcomes/follow-up'",
    "app.post('/api/outcomes/photo-pair'",
    "app.get('/api/outcomes/recommendation-ranking'",
    "app.get('/api/outcomes/farmer-dashboard'",
    "app.get('/api/outcomes/organization'",
    "app.get('/api/outcomes/command-center'",
    "app.post('/api/outcomes/snapshot'",
  ]) {
    if (!src.includes(r)) errors.push('app.js missing route: ' + r);
  }
  // Spec rule: follow-up route must enforce dayOffset ∈ {3, 7, 14}.
  if (!/\[3,\s*7,\s*14\]\.includes\(Number\(b\.dayOffset\)\)/.test(src)) {
    errors.push('app.js /api/outcomes/follow-up must validate dayOffset ∈ [3, 7, 14]');
  }
}

// ─── 5. Platform runtime ──────────────────────────────────────
const RT = 'src/runtime/outcomeIntelligence/OutcomeIntelligencePlatformRuntime.ts';
if (!_exists(RT)) {
  errors.push('missing: ' + RT);
} else {
  const src = _read(RT);
  _has(src, 'export function installOutcomeIntelligencePlatformGlobal',
    'OutcomeIntelligencePlatformRuntime must export installOutcomeIntelligencePlatformGlobal');
  _has(src, '__outcomeIntelligencePlatformHealth',
    'OutcomeIntelligencePlatformRuntime must pin window.__outcomeIntelligencePlatformHealth');
  for (const k of ['taskOutcomePromptReady', 'followUpPromptReady',
                   'photoComparisonReady', 'farmerDashboardReady',
                   'orgDashboardReady', 'commandCenterMetricsReady',
                   'rankingEngineReady', 'regionalLearningReady']) {
    if (!src.includes(k + ':')) {
      errors.push('OutcomeIntelligencePlatformRuntime missing health flag ' + k);
    }
  }
}

// ─── 6. Tracker ───────────────────────────────────────────────
const TR = 'src/runtime/outcomeIntelligence/OutcomeIntelligencePlatformTracker.ts';
if (!_exists(TR)) {
  errors.push('missing: ' + TR);
} else {
  const src = _read(TR);
  for (const fn of ['recordTaskOutcome', 'recordFollowUpOutcome',
                    'recordPhotoPair', 'fetchRecommendationRanking',
                    'fetchFarmerDashboard', 'fetchOrgDashboard',
                    'fetchCommandCenterMetrics']) {
    if (!src.includes('export async function ' + fn)) {
      errors.push('OutcomeIntelligencePlatformTracker missing export ' + fn);
    }
  }
}

// ─── 7. UI components ─────────────────────────────────────────
const TASK_PROMPT = 'src/components/outcomes/TaskOutcomePrompt.jsx';
if (!_exists(TASK_PROMPT)) {
  errors.push('missing: ' + TASK_PROMPT);
} else {
  const src = _read(TASK_PROMPT);
  for (const tid of ['task-outcome-yes', 'task-outcome-partial', 'task-outcome-no']) {
    if (!src.includes('data-testid="' + tid + '"')) {
      errors.push('TaskOutcomePrompt missing button: ' + tid);
    }
  }
}

const FU_PROMPT = 'src/components/outcomes/FollowUpPrompt.jsx';
if (!_exists(FU_PROMPT)) {
  errors.push('missing: ' + FU_PROMPT);
} else {
  const src = _read(FU_PROMPT);
  for (const tid of ['follow-up-improved', 'follow-up-same', 'follow-up-worse']) {
    if (!src.includes('data-testid="' + tid + '"')) {
      errors.push('FollowUpPrompt missing button: ' + tid);
    }
  }
}

const PHOTO_CARD = 'src/components/outcomes/PhotoComparisonCard.jsx';
if (!_exists(PHOTO_CARD)) {
  errors.push('missing: ' + PHOTO_CARD);
} else {
  const src = _read(PHOTO_CARD);
  _has(src, 'data-testid="photo-comparison-card"',
    'PhotoComparisonCard must expose data-testid="photo-comparison-card"');
  _has(src, 'data-testid="photo-comparison-before-input"',
    'PhotoComparisonCard must expose before input');
  _has(src, 'data-testid="photo-comparison-after-input"',
    'PhotoComparisonCard must expose after input');
}

// ─── 8. Pages ─────────────────────────────────────────────────
const FARMER_PAGE = 'src/pages/FarmerOutcomesPage.jsx';
if (!_exists(FARMER_PAGE)) {
  errors.push('missing: ' + FARMER_PAGE);
} else {
  const src = _read(FARMER_PAGE);
  _has(src, 'data-testid="farmer-outcomes-page"',
    'FarmerOutcomesPage must expose data-testid="farmer-outcomes-page"');
  _has(src, 'data-consumes="outcomeIntelligence"',
    'FarmerOutcomesPage must declare data-consumes="outcomeIntelligence"');
  _has(src, 'fetchFarmerDashboard',
    'FarmerOutcomesPage must call fetchFarmerDashboard');
}

const ORG_PAGE = 'src/pages/admin/OrganizationOutcomesPage.jsx';
if (!_exists(ORG_PAGE)) {
  errors.push('missing: ' + ORG_PAGE);
} else {
  const src = _read(ORG_PAGE);
  _has(src, "ALLOWED_ROLES = new Set(['admin', 'super_admin', 'ngo', 'field_officer'])",
    'OrganizationOutcomesPage must role-gate ALLOWED_ROLES');
  _has(src, 'data-testid="org-outcomes-page"',
    'OrganizationOutcomesPage must expose data-testid="org-outcomes-page"');
  _has(src, 'fetchOrgDashboard',
    'OrganizationOutcomesPage must call fetchOrgDashboard');
  _has(src, 'fetchCommandCenterMetrics',
    'OrganizationOutcomesPage must call fetchCommandCenterMetrics');
}

// ─── 9. App.jsx wiring ────────────────────────────────────────
const APP_JSX = 'src/App.jsx';
if (!_exists(APP_JSX)) {
  errors.push('missing: ' + APP_JSX);
} else {
  const src = _read(APP_JSX);
  _has(src, "import('./pages/FarmerOutcomesPage.jsx')",
    'App.jsx must lazy-import FarmerOutcomesPage');
  _has(src, "import('./pages/admin/OrganizationOutcomesPage.jsx')",
    'App.jsx must lazy-import OrganizationOutcomesPage');
  _has(src, 'path="/outcomes"',
    'App.jsx must route /outcomes');
  _has(src, 'path="/admin/organization-outcomes"',
    'App.jsx must route /admin/organization-outcomes');
  if (!/path="\/admin\/organization-outcomes"\s+element=\{<RoleRoute roles=\{ADMIN_ROLES\}>/.test(src)) {
    errors.push('App.jsx /admin/organization-outcomes route must wrap in <RoleRoute roles={ADMIN_ROLES}>');
  }
  _has(src, 'installOutcomeIntelligencePlatformGlobal',
    'App.jsx must call installOutcomeIntelligencePlatformGlobal in boot');
}

if (errors.length) {
  console.error('[check:outcome-intelligence-platform] FAIL — ' + errors.length + ' violation(s):');
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}

console.log('[check:outcome-intelligence-platform] PASS — 4 tables, engine, 8 routes, runtime + tracker, 3 components, 2 pages, boot install all wired.');
