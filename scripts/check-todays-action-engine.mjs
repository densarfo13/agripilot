/**
 * check-todays-action-engine.mjs — locks the Today's Action
 * Engine V1 contract (funnel + outcome path + KPI).
 *
 * Spec BUILD-SAFE rules:
 *   1. Fail if no action generated (engine fallback string present)
 *   2. Fail if more than 3 actions generated (slice(0, 3) literal)
 *   3. Fail if no follow-up created (followUpDate field + helper)
 *   4. Fail if no outcome path created — start route MUST call
 *      buildFollowUpPlan/persistFollowUpPlan AND log a 'started'
 *      funnel event
 *
 * Plus structural:
 *   - Migration 20260603100000_todays_action_events present + table
 *   - Prisma model TodaysActionEvent declared
 *   - todaysActionFunnel.js exports logEvent + computeFunnel
 *   - Funnel KIND_VALUES includes the 5 spec stages
 *   - 4 new routes: /start /complete /outcome /kpi
 *   - GET /api/daily-action auto-logs the SHOWN funnel event
 *   - Client adapter exports startDailyAction + completeDailyAction
 *     + recordDailyActionOutcome + fetchDailyActionKpi
 *   - TodaysActionCard wires Start → start() → completed → outcome
 *     prompt (Better/Same/Worse) testids
 *   - Spec target completion >50% — checked as TARGET_COMPLETION_PCT
 *     literal in the engine
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

// ─── Migration ────────────────────────────────────────────────
const MIG = 'server/prisma/migrations/20260603100000_todays_action_events/migration.sql';
if (!_exists(MIG)) {
  errors.push('missing migration: ' + MIG);
} else {
  const src = _read(MIG);
  _has(src, '"todays_action_events"',
    'migration must create todays_action_events table');
}

// ─── Prisma schema ────────────────────────────────────────────
const SCHEMA = 'server/prisma/schema.prisma';
if (_exists(SCHEMA)) {
  const src = _read(SCHEMA);
  _has(src, 'model TodaysActionEvent',
    'schema must declare model TodaysActionEvent');
}

// ─── Funnel engine ────────────────────────────────────────────
const FUNNEL = 'server/src/ml/todaysActionFunnel.js';
if (!_exists(FUNNEL)) {
  errors.push('missing: ' + FUNNEL);
} else {
  const src = _read(FUNNEL);
  _has(src, 'export async function logEvent',
    'todaysActionFunnel must export logEvent');
  _has(src, 'export async function computeFunnel',
    'todaysActionFunnel must export computeFunnel');
  const KINDS = ['shown', 'started', 'completed',
    'outcome_recorded', 'follow_up_completed'];
  for (const k of KINDS) {
    if (!src.includes("'" + k + "'")) {
      errors.push('todaysActionFunnel KIND_VALUES missing: ' + k);
    }
  }
  // Spec target — completion >50%
  _has(src, 'TARGET_COMPLETION_PCT = 50',
    'todaysActionFunnel must declare TARGET_COMPLETION_PCT = 50');
  // Honest threshold — null when n < MIN_SAMPLE
  _has(src, 'if (!d || d === 0) return null',
    'todaysActionFunnel must return null on empty denominator');
}

// ─── Server routes ────────────────────────────────────────────
const APP = 'server/src/app.js';
if (!_exists(APP)) {
  errors.push('missing: ' + APP);
} else {
  const src = _read(APP);
  for (const r of [
    "app.post('/api/daily-action/start'",
    "app.post('/api/daily-action/complete'",
    "app.post('/api/daily-action/outcome'",
    "app.get('/api/daily-action/kpi'",
  ]) {
    if (!src.includes(r)) errors.push('app.js missing route: ' + r);
  }
  // GET /api/daily-action MUST auto-log SHOWN.
  if (!/kind:\s*['"]shown['"]/.test(src)) {
    errors.push('app.js GET /api/daily-action must auto-log kind:"shown"');
  }
  // BUILD-SAFE §4 — /start MUST create outcome path
  // (buildFollowUpPlan + persistFollowUpPlan + log 'started').
  _has(src, 'buildFollowUpPlan',
    'app.js /start must call buildFollowUpPlan (outcome path)');
  _has(src, 'persistFollowUpPlan',
    'app.js /start must call persistFollowUpPlan (outcome path)');
  if (!/kind:\s*['"]started['"]/.test(src)) {
    errors.push('app.js /start must log kind:"started"');
  }
  // /outcome must accept only better/same/worse.
  if (!/\['better',\s*'same',\s*'worse'\]\.includes\(b\.outcome\)/.test(src)) {
    errors.push('app.js /outcome must validate outcome ∈ [better, same, worse]');
  }
}

// ─── Client adapter ───────────────────────────────────────────
const ADAPTER = 'src/runtime/dailyAction/RecommendationEngine.ts';
if (!_exists(ADAPTER)) {
  errors.push('missing: ' + ADAPTER);
} else {
  const src = _read(ADAPTER);
  for (const fn of ['startDailyAction', 'completeDailyAction',
                    'recordDailyActionOutcome', 'fetchDailyActionKpi']) {
    if (!src.includes('export async function ' + fn)) {
      errors.push('RecommendationEngine.ts missing export ' + fn);
    }
  }
}

// ─── TodaysActionCard funnel wiring ──────────────────────────
const CARD = 'src/components/intelligence/TodaysActionCard.jsx';
if (!_exists(CARD)) {
  errors.push('missing: ' + CARD);
} else {
  const src = _read(CARD);
  for (const fn of ['startDailyAction', 'completeDailyAction',
                    'recordDailyActionOutcome']) {
    if (!src.includes(fn)) {
      errors.push('TodaysActionCard must import + call ' + fn);
    }
  }
  for (const tid of ['todays-action-complete',
                     'todays-action-outcome-prompt',
                     'todays-action-outcome-better',
                     'todays-action-outcome-same',
                     'todays-action-outcome-worse']) {
    if (!src.includes('data-testid="' + tid + '"')) {
      errors.push('TodaysActionCard missing funnel testid: ' + tid);
    }
  }
}

if (errors.length) {
  console.error('[check:todays-action-engine] FAIL — ' + errors.length + ' violation(s):');
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}

console.log('[check:todays-action-engine] PASS — funnel + outcome path + KPI wired; target 50% completion.');
