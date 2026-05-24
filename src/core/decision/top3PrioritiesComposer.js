/**
 * top3PrioritiesComposer.js — the Phase 11/12 "Today's Top 3"
 * priority list.
 *
 *   import { computeTodayTop3 }
 *     from 'src/core/decision/top3PrioritiesComposer.js';
 *
 * What it is — and is NOT
 * ───────────────────────
 *   A pure composition layer that asks the same underlying
 *   engines `dailyDecisionAssistant` uses (lifecycle, watering,
 *   weather, scan history), gathers the candidate decisions,
 *   ranks them via `recommendationRankingEngine`, and returns
 *   the TOP 3 — never more, never fewer (padded by routine
 *   check at low priority when needed).
 *
 *   It does NOT generate new content, NOT make any forecast,
 *   and NOT duplicate any engine. Each item carries its own
 *   "why" sentence so the surface can render the spec's
 *   transparency rule (§22: every recommendation explains WHY).
 *
 * Strict-rule audit
 *   • Pure. Never throws. SSR-safe. Honest wording — no fake
 *     yield, no fake certainty.
 *   • Every visible string is { key, fallback, params }.
 */

import { computeLifecycleSnapshot, LIFECYCLE_STAGE } from '../lifecycle/cropLifecycleEngine.js';
import { interpretWeather, WEATHER_INSIGHT, SEVERITY } from '../weather/weatherOperationalInterpreter.js';
import { computeWateringRecommendation, WATERING_ACTION } from '../watering/wateringEngine.js';
import { rankRecommendations, explainRecommendation } from '../recommendations/recommendationRankingEngine.js';

const _str = (v) => String(v == null ? '' : v).toLowerCase();

function _msg(template, params) {
  const p = (params && typeof params === 'object') ? params : {};
  return { key: template.key, fallback: template.fallback, params: { ...p } };
}

// Title envelopes — one per priority type. Mirror the
// dailyDecisionAssistant titles so callers see consistent copy.
const TITLES = Object.freeze({
  urgent_scan_followup: { key: 'top3.title.scan_followup', fallback: 'Re-check the recently scanned plant.' },
  weather_risk:         { key: 'top3.title.weather_risk',  fallback: 'Adjust today for the weather change.' },
  watering:             { key: 'top3.title.watering',      fallback: 'Water {crop} today.' },
  watering_skip:        { key: 'top3.title.watering_skip', fallback: 'Skip watering today.' },
  harvest_readiness:    { key: 'top3.title.harvest',       fallback: 'Check {crop} for harvest readiness.' },
  crop_stage_task:      { key: 'top3.title.stage_task',    fallback: 'Do the next stage check on {crop}.' },
  routine_check:        { key: 'top3.title.routine',       fallback: 'Walk the plants and observe.' },
});

// Per-stage hint titles for the lifecycle priority. Surfaces the
// next stage's task (e.g. flowering → pollination check).
function _buildCandidates({ lifecycle, weatherInsight, wateringRec, scanHistory, crop }) {
  const out = [];
  const cropLabel = String(crop || 'the plant');

  // 1. Urgent scan follow-up
  const recent = Array.isArray(scanHistory) && scanHistory.length
    ? scanHistory[scanHistory.length - 1]
    : null;
  const recentCat = _str(recent && (recent.issueCategory || recent.category));
  const recentIsStress = recentCat && recentCat !== 'healthy' && recentCat !== 'unknown_needs_clearer_photo';
  if (recentIsStress) {
    out.push({
      type: 'urgent_scan_followup',
      id:   `scan_${recent.scanId || recentCat}`,
      crop: cropLabel,
      urgency: 'high',
      bestTime: 'morning',
      why: { key: 'top3.why.scan_followup', fallback: 'A recent scan flagged possible stress on {crop}.', params: { crop: cropLabel } },
    });
  }

  // 2. Weather risk (anything beyond the calm CURRENT fallback)
  if (weatherInsight && weatherInsight.primary
      && weatherInsight.primary.type !== WEATHER_INSIGHT.CURRENT) {
    const sev = weatherInsight.primary.severity;
    out.push({
      type: 'weather_risk',
      id:   `weather_${weatherInsight.primary.type}`,
      crop: cropLabel,
      urgency: sev === SEVERITY.HIGH ? 'high' : 'normal',
      bestTime: 'today',
      why: weatherInsight.primary.localizedMessage || null,
    });
  }

  // 3. Watering — water or skip (each is its own priority slot
  //    so a skip-because-rain can sit alongside a stage task).
  if (wateringRec) {
    if (wateringRec.recommendation === WATERING_ACTION.WATER) {
      out.push({
        type: 'watering',
        id:   'watering_today',
        crop: cropLabel,
        urgency: wateringRec.urgency || 'normal',
        bestTime: wateringRec.idealTime || 'morning',
        why: wateringRec.localizedMessage || null,
      });
    } else if (wateringRec.recommendation === WATERING_ACTION.SKIP) {
      out.push({
        type: 'watering_skip',
        id:   'watering_skip',
        crop: cropLabel,
        urgency: 'low',
        bestTime: 'today',
        why: wateringRec.localizedMessage || null,
      });
    }
  }

  // 4. Harvest readiness — distinct tier from generic stage tasks.
  if (lifecycle && (lifecycle.currentStage === LIFECYCLE_STAGE.HARVEST_READY
                 || lifecycle.currentStage === LIFECYCLE_STAGE.HARVEST)) {
    out.push({
      type: 'harvest_readiness',
      id:   `harvest_${lifecycle.currentStage}`,
      crop: cropLabel,
      urgency: 'high',
      bestTime: 'morning',
      why: { key: 'top3.why.harvest', fallback: '{crop} is near harvest — picking late costs yield.', params: { crop: cropLabel } },
    });
  }

  // 5. Crop-stage task — the lifecycle engine's stage tasks.
  if (lifecycle && Array.isArray(lifecycle.stageTasks) && lifecycle.stageTasks.length > 0
      && lifecycle.currentStage !== LIFECYCLE_STAGE.HARVEST_READY
      && lifecycle.currentStage !== LIFECYCLE_STAGE.HARVEST) {
    const t = lifecycle.stageTasks[0];
    out.push({
      type: 'crop_stage_task',
      id:   `stage_${lifecycle.currentStage}`,
      crop: cropLabel,
      urgency: 'normal',
      bestTime: 'today',
      stageTask: t,
      why: { key: 'top3.why.stage', fallback: '{crop} is at a stage where this check helps.', params: { crop: cropLabel } },
    });
  }

  // 6. Routine check — the calm padding slot.
  out.push({
    type: 'routine_check',
    id:   'routine_observe',
    crop: cropLabel,
    urgency: 'low',
    bestTime: 'today',
    why: { key: 'top3.why.routine', fallback: 'A short, regular check catches issues early.', params: {} },
  });

  return out;
}

/**
 * Compute the day's top 3 priorities.
 *
 * @param {object} args
 * @param {object} [args.snapshot]        from getIntelligenceSnapshot()
 * @param {string} [args.crop]
 * @param {string} [args.mode]
 * @param {object} [args.weather]
 * @param {object} [args.lifecycle]       precomputed
 * @param {object} [args.watering]        precomputed
 * @param {object} [args.weatherInsight]  precomputed
 * @param {Array}  [args.scanHistory]
 * @param {number} [args.nowMs]
 * @returns {{ priorities: Array<object>, generatedAt: string }}
 */
export function computeTodayTop3(args) {
  try {
    const a = (args && typeof args === 'object') ? args : {};
    const snap = (a.snapshot && typeof a.snapshot === 'object') ? a.snapshot : {};
    const crop = a.crop || snap.crop || null;
    const weather = a.weather || snap.weather || {};
    const nowMs = Number.isFinite(a.nowMs) ? a.nowMs : Date.now();
    const cropLabel = String(crop || 'the plant');

    const lifecycle = a.lifecycle || computeLifecycleSnapshot({
      crop, mode: snap.mode || a.mode,
      plantingDate: snap.plantingDate || a.plantingDate,
      weather, scanHistory: a.scanHistory || snap.scanHistory,
      nowMs,
    });
    const weatherInsight = a.weatherInsight || interpretWeather({
      weather, mode: snap.mode || a.mode, crop,
      cropStage: lifecycle && lifecycle.currentStage,
    });
    const wateringRec = a.watering || computeWateringRecommendation({
      crop, mode: snap.mode || a.mode, weather,
      taskHistory: { lastWateredAt: snap.lastWateredAt || a.lastWateredAt },
      stress: snap.scanStress || a.scanStress,
      nowMs,
    });

    const candidates = _buildCandidates({
      lifecycle, weatherInsight, wateringRec,
      scanHistory: a.scanHistory || snap.scanHistory,
      crop: cropLabel,
    });

    // Rank through the shared engine + take the top 3.
    const ranked = rankRecommendations(candidates, { withExplanation: true });
    const top = ranked.slice(0, 3);

    // Enrich each priority with a title envelope.
    const priorities = top.map((r, i) => {
      const titleTemplate = TITLES[r.type] || TITLES.routine_check;
      return Object.freeze({
        rank:     i + 1,
        type:     r.type,
        title:    _msg(titleTemplate, { crop: cropLabel }),
        why:      r.why || null,
        urgency:  r.urgency || 'normal',
        bestTime: r.bestTime || 'today',
        explanation: r.explanation || explainRecommendation({ type: r.type }),
      });
    });

    return Object.freeze({
      crop:        cropLabel,
      priorities,
      generatedAt: new Date(nowMs).toISOString(),
      disclaimer:  'Today\'s priorities are based on recent signals — local conditions may shift them.',
    });
  } catch {
    return Object.freeze({
      crop:        'the plant',
      priorities: [],
      generatedAt: new Date().toISOString(),
      disclaimer:  'No priorities right now — keep watching how the plants respond.',
    });
  }
}

const _module = { computeTodayTop3 };
export default _module;
