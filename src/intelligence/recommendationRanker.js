/**
 * recommendationRanker.js — re-ranks a candidate-task list using
 * the intelligence layer's signals and clips to 1 primary + 2
 * secondary outputs.
 *
 * Strict contract
 * ───────────────
 *   • Input: an array of CANDIDATE tasks (the existing taskEngine
 *     output works as-is). Each candidate is `{ id, titleKey,
 *     priority?, stage?, ... }` — anything else passes through
 *     unchanged.
 *   • Output: `{ primary, secondaries[≤2], scored[] }`.
 *   • `primary` is the highest-scoring candidate; `secondaries`
 *     are the next two whose stage / topic differs from the
 *     primary so the farmer doesn't see three near-duplicates.
 *   • Pure function. No I/O. No translation.
 *   • Never throws — bad input degrades to `{ primary: null,
 *     secondaries: [], scored: [] }`.
 *
 * Score components (all 0-1)
 * ──────────────────────────
 *   urgencyBoost    +0.30 if priority === 'urgent', +0.15 if 'important'
 *   weatherMatch    +0.25 when task title key correlates with active
 *                    weather signal (e.g. 'task.protectHarvest' under
 *                    a heavy_rain signal)
 *   pestMatch       +0.20 when task tagged for pest action under
 *                    fungal/aphid pressure
 *   stageMatch      +0.15 when task.stage matches the resolved farm
 *                    stage exactly
 *   yieldDrag       -0.10 when yield band is 'low' AND task is a
 *                    routine / non-corrective entry (de-prioritises
 *                    nice-to-haves on stressed farms)
 *
 * Output is sorted descending by score. Ties broken by original
 * order (stable sort) so the existing engine's deliberate ordering
 * is preserved on a tie.
 */

const URGENCY_BOOST = Object.freeze({ urgent: 0.30, important: 0.15, normal: 0 });

// Heuristic tags pulled from existing prompt id stems. The ranker
// looks at the task's `titleKey` (or `id`) as a string and matches
// substrings — the existing taskEngine already uses these stems
// (`task.protectHarvest`, `task.skipWatering`, etc.).
const WEATHER_TASK_HINTS = Object.freeze({
  heavy_rain:   ['protectHarvest', 'protect_harvest', 'skipSpraying'],
  moderate_rain:['skipSpraying', 'skip_spraying'],
  high_wind:    ['protectHarvest'],
  hot:          ['water', 'irrigate', 'shade'],
  dry_spell:    ['water', 'irrigate'],
});

const PEST_TASK_HINTS = Object.freeze({
  fungal_pressure:     ['spray', 'scout', 'checkPests'],
  mite_aphid_pressure: ['spray', 'scout', 'checkPests'],
  weed_surge:          ['weed'],
  routine_scout:       ['scout', 'checkPests'],
});

const ROUTINE_TASK_HINTS = Object.freeze([
  'photo', 'log', 'note', 'finishSetup', 'setStage',
]);

/**
 * @param {object} input
 * @param {object[]} input.candidates              tasks from taskEngine.generateTasks()
 *                                                 (or any array with `id` + optional fields)
 * @param {object} [input.weatherRisk]             output of weatherRiskModel.deriveWeatherRisk
 * @param {object} [input.pestRisk]                output of pestDiseaseRisk.derivePestRisk
 * @param {object} [input.stageInfo]               output of cropStageModel.resolveStage
 * @param {object} [input.yieldInfo]               output of yieldForecast.forecastYield
 * @returns {{ primary: object|null, secondaries: object[], scored: object[] }}
 */
export function rankCandidates({
  candidates = [],
  weatherRisk = null,
  pestRisk    = null,
  stageInfo   = null,
  yieldInfo   = null,
} = {}) {
  try {
    if (!Array.isArray(candidates) || candidates.length === 0) {
      return { primary: null, secondaries: [], scored: [] };
    }
    const weatherSignals = (weatherRisk?.signals || []);
    const pestSignals    = (pestRisk?.signals || []);
    const stageName      = stageInfo?.stage || null;
    const yieldBand      = yieldInfo?.band  || null;

    const scored = candidates.map((task, idx) => {
      const score = _scoreOne(task, {
        weatherSignals, pestSignals, stageName, yieldBand,
      });
      return Object.freeze({ task, score, originalIndex: idx });
    });

    // Stable sort: descending score, ascending originalIndex on tie.
    const sorted = scored.slice().sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.originalIndex - b.originalIndex;
    });

    const primary = sorted[0]?.task || null;
    const secondaries = _pickSecondaries(sorted.slice(1), primary, 2);

    return Object.freeze({
      primary,
      secondaries: Object.freeze(secondaries.map(s => s.task)),
      scored: Object.freeze(sorted),
    });
  } catch {
    return { primary: null, secondaries: [], scored: [] };
  }
}

// ─── Internals ────────────────────────────────────────────────

function _scoreOne(task, ctx) {
  if (!task || typeof task !== 'object') return 0;
  let score = 0;
  const id = String(task.titleKey || task.id || '').toLowerCase();
  const priority = String(task.priority || task.urgency || 'normal').toLowerCase();

  // Urgency
  score += URGENCY_BOOST[priority] || 0;

  // Weather match
  for (const sig of ctx.weatherSignals) {
    const hints = WEATHER_TASK_HINTS[sig] || [];
    if (hints.some(h => id.includes(h.toLowerCase()))) {
      score += 0.25;
      break;
    }
  }

  // Pest match
  for (const sig of ctx.pestSignals) {
    const hints = PEST_TASK_HINTS[sig] || [];
    if (hints.some(h => id.includes(h.toLowerCase()))) {
      score += 0.20;
      break;
    }
  }

  // Stage match
  if (ctx.stageName && task.stage && String(task.stage).toLowerCase() === String(ctx.stageName).toLowerCase()) {
    score += 0.15;
  }

  // Yield drag — penalise routine tasks when the farm's yield band
  // is 'low' so corrective work bubbles up.
  if (ctx.yieldBand === 'low'
      && ROUTINE_TASK_HINTS.some(h => id.includes(h.toLowerCase()))) {
    score -= 0.10;
  }

  return score;
}

/**
 * Pick up to N secondary tasks that aren't redundant with the
 * primary. "Redundant" = same stage AND same first-token of the
 * title key (e.g. two `task.water...` entries collapse into one).
 */
function _pickSecondaries(rest, primary, n) {
  if (!Array.isArray(rest) || rest.length === 0) return [];
  const picked = [];
  const primaryKey = _topicKey(primary);
  const primaryStage = primary?.stage || null;
  for (const entry of rest) {
    if (picked.length >= n) break;
    const t = entry.task;
    const key = _topicKey(t);
    const stage = t?.stage || null;
    // Skip near-duplicates of the primary AND of already-picked
    // secondaries.
    if (primaryKey && key === primaryKey && stage === primaryStage) continue;
    if (picked.some(p => _topicKey(p.task) === key && (p.task?.stage || null) === stage)) continue;
    picked.push(entry);
  }
  return picked;
}

function _topicKey(task) {
  if (!task) return '';
  const raw = String(task.titleKey || task.id || '');
  // First two segments of dotted i18n key are the topic
  // ('task.water'), enough to dedupe `task.water` vs `task.spray`.
  return raw.split('.').slice(0, 2).join('.').toLowerCase();
}
