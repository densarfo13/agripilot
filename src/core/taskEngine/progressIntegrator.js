/**
 * progressIntegrator.js — §15 Progress integration. Pure helper
 * that turns the task-engine output into progress stats that
 * Home's progress strip AND the Progress page can render
 * consistently.
 *
 *   buildProgressFromTasks({ primary, supporting, all }, { events })
 *     → {
 *         todayTotal:     number   // tasks visible on Home today
 *         todayDone:      number   // of those, completed
 *         todayPercent:   0..100
 *         stageGatesDone: number   // completed stage-gate tasks
 *         stageGatesTotal:number
 *         stageReady:     boolean  // every gate complete → stage can advance
 *         primaryDone:    boolean
 *         label:          string   // e.g. "2 of 4 done today" — UI-ready
 *       }
 *
 * Optional `events` array is scanned for task_completed entries
 * so historical completions bump the counters even when the
 * task list was rebuilt after the fact.
 *
 * Pure. Fully testable without React.
 */

const STAGE_GATE_CODES = new Set([
  'clear_land', 'prepare_ridges', 'source_planting_materials', // land_prep
  'plant_crop',                                                  // planting
  'harvest_crop',                                                // harvest
  'store_crop',                                                  // post_harvest
]);

function isEventCompleted(e) {
  if (!e || typeof e !== 'object') return false;
  return e.eventType === 'task_completed';
}

export function buildProgressFromTasks(taskResult = {}, { events = [] } = {}) {
  const all = Array.isArray(taskResult.all) ? taskResult.all : [];
  const primary = taskResult.primary || null;

  // Count today's visible tasks (primary + supporting). Use `all`
  // when supporting isn't capped — otherwise prefer primary+supporting
  // so the counter matches what Home actually renders.
  const todayVisible = primary
    ? [primary, ...(Array.isArray(taskResult.supporting) ? taskResult.supporting : [])]
    : all;

  // Derive doneSet from the task-engine's own `completed` flag
  // AND from the event log (so a task that was just marked done
  // still counts even if the regenerated list has a new id).
  const doneCodes = new Set();
  for (const t of all) {
    if (t && t.completed && t.code) doneCodes.add(t.code);
  }
  if (Array.isArray(events)) {
    for (const e of events) {
      if (isEventCompleted(e) && e.code) doneCodes.add(e.code);
      // payload.code shape from logFarmEvent
      if (isEventCompleted(e) && e.payload && e.payload.code) doneCodes.add(e.payload.code);
    }
  }

  const todayTotal = todayVisible.length;
  const todayDone  = todayVisible.filter((t) => t && doneCodes.has(t.code)).length;
  const todayPercent = todayTotal === 0
    ? 0
    : Math.round((todayDone / todayTotal) * 100);

  // Stage-gate progress — uses the catalog-wide gate set, not
  // just what's currently visible, so completing a gate task
  // earlier in the session still shows up.
  let stageGatesDone = 0;
  for (const code of STAGE_GATE_CODES) {
    if (doneCodes.has(code)) stageGatesDone++;
  }
  const gatesInStage = all.filter((t) => t && STAGE_GATE_CODES.has(t.code));
  const stageGatesTotal = Math.max(stageGatesDone, gatesInStage.length || 0);
  const stageReady = stageGatesTotal > 0 && stageGatesDone >= stageGatesTotal;

  const primaryDone = !!(primary && primary.code && doneCodes.has(primary.code));

  const label = todayTotal > 0
    ? `${todayDone} of ${todayTotal} done today`
    : '';

  return Object.freeze({
    todayTotal, todayDone, todayPercent,
    stageGatesDone, stageGatesTotal, stageReady,
    primaryDone, label,
  });
}

/**
 * progressDiffersFromPayload — dev assertion helper (§16
 * "Home + Progress stay in sync"). True when two progress
 * snapshots disagree on any of the visible numbers. Caller
 * emits a dev warning when this returns true.
 */
export function progressDiffersFromPayload(homeProgress, progressPagePayload) {
  if (!homeProgress || !progressPagePayload) return false;
  const keys = ['todayTotal', 'todayDone', 'todayPercent', 'stageGatesDone', 'stageGatesTotal'];
  return keys.some((k) => homeProgress[k] !== progressPagePayload[k]);
}

export const _internal = { STAGE_GATE_CODES };
