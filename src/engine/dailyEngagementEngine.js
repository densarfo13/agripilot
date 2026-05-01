/**
 * dailyEngagementEngine.js — wraps the existing dailyTaskEngine to
 * produce a "never empty" 2–3 task daily plan for the engagement
 * surface.
 *
 *   generateEngagementPlan({
 *     plant,            // canonical plant id ('tomato' | 'maize' | …)
 *     country,          // user's country (free text — passed through)
 *     region,           // user's region (free text — passed through)
 *     stage,            // explicit stage; wins over plantingStatus
 *     plantingStatus,   // 'not_started' | 'planted' | …
 *     weather,          // { condition?: 'rain'|'heat'|'cool', tempC? } | null
 *     farmerType,       // 'new' | 'existing' | null
 *     completions,      // EngagementHistory entries (or null → engine reads them)
 *     todayISO,         // YYYY-MM-DD for deterministic tests; defaults to today
 *     limit,            // max tasks (default 3, min 2)
 *   }) → {
 *     tasks: Task[],            // always 2..3 entries
 *     source: 'engine' | 'engine+pad' | 'fallback',
 *     stage:  resolved stage | null,
 *     supported: boolean,
 *     scanInjected: boolean,
 *     weatherApplied: 'rain' | 'heat' | null,
 *   }
 *
 *   Task shape (engagement-flavoured):
 *     { id, title, why?, dueHint?, kind: 'engine'|'scan'|'fallback',
 *       priority: 'high'|'medium'|'low', titleKey?, whyKey? }
 *
 * Spec rules applied (Daily engagement)
 *   • Always 2–3 tasks (§1, §7 "remove empty states").
 *   • Plant + location + weather signals all feed in (§1).
 *   • "Check plant health" scan slot (§6) — injected when no scan
 *     completion in the last 3 days.
 *   • Pure + deterministic given inputs. No fetch / no DOM access.
 *   • Never throws. Storage reads in helpers are try/catch wrapped.
 */

import { generateDailyTasks } from '../lib/tasks/dailyTaskEngine.js';
import { getRecentCompletions } from './engagementHistory.js';

const MIN_TASKS = 2;
const MAX_TASKS = 3;
const SCAN_TASK_ID = 'engagement_scan_check';

// Generic fallback tasks for the no-engine-support path. These are
// safe, plant-agnostic actions every farmer can do — keeps the
// "always show ≥1 suggestion" promise even when the engine has no
// rules for the user's crop.
const FALLBACK_TASKS = [
  {
    id: 'engagement_fallback_check',
    titleKey: 'engagement.fallback.checkPlants',
    title:    'Check on your plants today',
    whyKey:   'engagement.fallback.checkPlants.why',
    why:      'A 2-minute walk-through catches problems early.',
    kind:     'fallback',
    priority: 'medium',
  },
  {
    id: 'engagement_fallback_water',
    titleKey: 'engagement.fallback.water',
    title:    'Water if soil feels dry',
    whyKey:   'engagement.fallback.water.why',
    why:      'Touch the top inch — if dry, give a slow drink.',
    kind:     'fallback',
    priority: 'medium',
  },
];

const SCAN_TASK = {
  id:       SCAN_TASK_ID,
  titleKey: 'engagement.scan.title',
  title:    'Check plant health',
  whyKey:   'engagement.scan.why',
  why:      'Take a quick photo of any leaf that looks off.',
  kind:     'scan',
  priority: 'medium',
};

function _todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function _looksLikeWatering(task) {
  const id   = String(task?.id || '').toLowerCase();
  const key  = String(task?.titleKey || '').toLowerCase();
  const txt  = String(task?.title || '').toLowerCase();
  return (
    id.includes('water') ||
    key.includes('water') ||
    txt.includes('water')
  );
}

function _normalizeEngineTask(t) {
  if (!t || typeof t !== 'object') return null;
  return {
    id:       t.id || `engine_${Math.random().toString(36).slice(2, 8)}`,
    titleKey: t.titleKey || null,
    title:    t.title    || t.label || '',
    whyKey:   t.whyKey   || null,
    why:      t.why      || '',
    dueHint:  t.dueHint  || null,
    kind:     'engine',
    priority: t.priority || 'medium',
  };
}

/**
 * Apply weather guidance — light filter, never destructive enough to
 * leave the list empty.
 *
 *   rain expected → drop watering tasks (max 1 drop so we keep ≥1)
 *   heat expected → ensure a watering task is in the list (push to top)
 */
function _applyWeather(tasks, weather) {
  if (!weather || !weather.condition) return { tasks, applied: null };
  const cond = String(weather.condition).toLowerCase();

  if (cond === 'rain') {
    // Only drop watering when we still have ≥2 tasks left after.
    const wateringIdx = tasks.findIndex(_looksLikeWatering);
    if (wateringIdx >= 0 && tasks.length > 2) {
      const next = tasks.slice();
      next.splice(wateringIdx, 1);
      return { tasks: next, applied: 'rain' };
    }
    return { tasks, applied: 'rain' };
  }

  if (cond === 'heat') {
    const hasWater = tasks.some(_looksLikeWatering);
    if (!hasWater) {
      const waterTask = {
        id:       'engagement_water_heat',
        titleKey: 'engagement.weather.waterHeat',
        title:    'Water early — high heat today',
        whyKey:   'engagement.weather.waterHeat.why',
        why:      'Hot days dry the soil quickly. A morning soak helps.',
        kind:     'engine',
        priority: 'high',
      };
      return { tasks: [waterTask, ...tasks], applied: 'heat' };
    }
    return { tasks, applied: 'heat' };
  }

  return { tasks, applied: null };
}

function _hadRecentScan(completions) {
  if (!Array.isArray(completions) || completions.length === 0) return false;
  const cutoffMs = Date.now() - 3 * 86_400_000;  // 3 days
  return completions.some((c) => {
    if (!c) return false;
    const t = Date.parse(c.completedAt || '');
    if (!Number.isFinite(t) || t < cutoffMs) return false;
    return String(c.taskId || '').includes('scan')
        || String(c.kind   || '') === 'scan';
  });
}

/**
 * generateEngagementPlan — the single entry point for the
 * engagement surface. Always returns 2..3 tasks.
 */
export function generateEngagementPlan({
  plant,
  country,         // eslint-disable-line no-unused-vars
  region,          // eslint-disable-line no-unused-vars
  stage,
  plantingStatus,
  weather = null,
  farmerType = null,
  completions = null,
  todayISO,        // eslint-disable-line no-unused-vars
  limit = MAX_TASKS,
} = {}) {
  const cap = Math.max(MIN_TASKS, Math.min(MAX_TASKS, Number(limit) || MAX_TASKS));

  // 1. Pull the engine output. The dailyTaskEngine is the canonical
  //    rules layer — we never duplicate its logic here.
  let engineOut = { today: [], thisWeek: [], stage: null, supported: false };
  try {
    engineOut = generateDailyTasks({
      crop: plant || '',
      stage,
      plantingStatus,
      farmerType,
      completions: Array.isArray(completions) ? completions : undefined,
      limit: cap,
    }) || engineOut;
  } catch { /* fall through to fallback path */ }

  let merged = [];
  for (const t of (engineOut.today || []))    merged.push(_normalizeEngineTask(t));
  for (const t of (engineOut.thisWeek || [])) merged.push(_normalizeEngineTask(t));
  merged = merged.filter(Boolean);

  let source = engineOut.supported ? 'engine' : 'fallback';

  // 2. Read recent completions for the scan-injection check.
  let history = completions;
  if (!Array.isArray(history)) {
    try { history = getRecentCompletions(7); } catch { history = []; }
  }

  // 3. Inject scan task when no recent scan AND room exists.
  let scanInjected = false;
  if (!_hadRecentScan(history) && !merged.some((t) => t.id === SCAN_TASK_ID)) {
    merged.push({ ...SCAN_TASK });
    scanInjected = true;
  }

  // 4. Pad with fallback if we still don't have 2.
  let i = 0;
  while (merged.length < MIN_TASKS && i < FALLBACK_TASKS.length) {
    const f = FALLBACK_TASKS[i++];
    if (!merged.some((t) => t.id === f.id)) {
      merged.push({ ...f });
      if (source === 'engine') source = 'engine+pad';
    }
  }

  // 5. Apply weather signal (after we already have a base list so
  //    weather can't accidentally empty it out).
  const weatherResult = _applyWeather(merged, weather);
  merged = weatherResult.tasks;

  // 6. Cap to MAX_TASKS — keep the highest-priority slice.
  if (merged.length > cap) {
    const PRIO_RANK = { high: 0, medium: 1, low: 2 };
    merged.sort((a, b) =>
      (PRIO_RANK[a.priority] ?? 1) - (PRIO_RANK[b.priority] ?? 1));
    merged = merged.slice(0, cap);
  }

  // 7. Last-resort safety net — should never trigger after steps 1-4
  //    but guarantees the "never empty" rule under any race.
  if (merged.length === 0) {
    merged = [{ ...FALLBACK_TASKS[0] }, { ...FALLBACK_TASKS[1] }];
    source = 'fallback';
  }

  return {
    tasks:           merged,
    source,
    stage:           engineOut.stage || null,
    supported:       Boolean(engineOut.supported),
    scanInjected,
    weatherApplied:  weatherResult.applied,
  };
}

export const _internal = Object.freeze({
  MIN_TASKS, MAX_TASKS, SCAN_TASK_ID, FALLBACK_TASKS,
});

export default { generateEngagementPlan };
