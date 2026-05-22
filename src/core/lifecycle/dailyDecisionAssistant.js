/**
 * dailyDecisionAssistant.js — picks ONE best action for today and
 * tailors the wording to the farmer's experience level.
 *
 *   import { computeDailyDecision, EXPERIENCE_LEVEL,
 *            CONFIDENCE_TONE }
 *     from 'src/core/lifecycle/dailyDecisionAssistant.js';
 *
 *   const decision = computeDailyDecision({
 *     snapshot,             // from getIntelligenceSnapshot()
 *     experienceLevel:'new',
 *   });
 *
 * What it is — and is NOT
 * ───────────────────────
 *   A PURE COMPOSITION layer. It calls into engines we already
 *   ship — `cropLifecycleEngine`, `weatherOperationalInterpreter`,
 *   `wateringEngine`, `recommendationRankingEngine` — folds their
 *   outputs into a single ranked-candidates list, and returns ONE
 *   answer to "what should I do today?". For a NEW farmer it
 *   wraps that answer with a calm explanation + micro-help; for
 *   an EXPERIENCED farmer it returns the same answer terser.
 *
 *   It does NOT generate any new task system. It does NOT redesign
 *   Home — surfaces consume one envelope and render one card.
 *
 * Strict-rule audit
 *   • Pure. Never throws. SSR-safe. Honest wording — hedged.
 *   • Every user-visible string ships as { key, fallback, params }.
 */

import { computeLifecycleSnapshot, LIFECYCLE_STAGE } from './cropLifecycleEngine.js';
import { interpretWeather, WEATHER_INSIGHT, SEVERITY } from '../weather/weatherOperationalInterpreter.js';
import { computeWateringRecommendation, WATERING_ACTION } from '../watering/wateringEngine.js';
import { pickPrimaryRecommendation } from '../recommendations/recommendationRankingEngine.js';

export const EXPERIENCE_LEVEL = Object.freeze({
  NEW:         'new',
  EXPERIENCED: 'experienced',
});

export const CONFIDENCE_TONE = Object.freeze({
  GENTLE:  'gentle',
  FIRM:    'firm',
  URGENT:  'urgent',
});

const _str = (v) => String(v == null ? '' : v).toLowerCase();

function _msg(template, params) {
  const p = (params && typeof params === 'object') ? params : {};
  return { key: template.key, fallback: template.fallback, params: { ...p } };
}

// ── Micro-help library (new-farmer mode only) ──────────────
//
// Short "why this matters" companions per decision type. Keep it
// to one calm sentence — long copy clutters Home.
const MICRO_HELP = Object.freeze({
  urgent_scan_followup: { key: 'daily.help.scan_followup', fallback: 'A recent scan saw possible signs — a quick re-check today catches a problem early.' },
  weather_risk:         { key: 'daily.help.weather_risk',  fallback: 'A weather change is coming — acting early reduces stress on your plants.' },
  watering:             { key: 'daily.help.watering',      fallback: 'Plants take in nutrients through water — steady watering helps healthy growth.' },
  watering_skip:        { key: 'daily.help.watering_skip', fallback: 'Too much water can be as harmful as too little. Skip today and check the soil tomorrow.' },
  crop_stage_task:      { key: 'daily.help.stage_task',    fallback: 'Each growth stage has one or two checks that pay off later. This is one of them.' },
  harvest_ready:        { key: 'daily.help.harvest',       fallback: 'Picking at the right moment makes a real difference to taste and storage life.' },
  routine_check:        { key: 'daily.help.routine',       fallback: 'A short, regular check catches small issues before they become big ones.' },
  no_action:            { key: 'daily.help.no_action',     fallback: 'Nothing urgent today — a good day to walk the plants and just observe.' },
});

const NO_ACTION = Object.freeze({
  key:      'daily.action.no_action',
  fallback: 'No urgent action today — keep watching how {crop} responds.',
});

const REASON_TEMPLATES = Object.freeze({
  urgent_scan_followup: { key: 'daily.reason.scan_followup', fallback: 'A recent scan flagged possible stress on {crop}.' },
  weather_risk:         { key: 'daily.reason.weather_risk',  fallback: 'Weather is changing — this matters today.' },
  watering:             { key: 'daily.reason.watering',      fallback: 'Soil and weather suggest {crop} needs water today.' },
  watering_skip:        { key: 'daily.reason.watering_skip', fallback: 'Rain or recent watering — skip today to avoid overwatering.' },
  crop_stage_task:      { key: 'daily.reason.stage_task',    fallback: '{crop} is at a stage where this check helps.' },
  harvest_ready:        { key: 'daily.reason.harvest',       fallback: '{crop} may be close to harvest — check colour and firmness.' },
  routine_check:        { key: 'daily.reason.routine',       fallback: 'Routine check — keep an eye on growth.' },
  no_action:            { key: 'daily.reason.no_action',     fallback: 'Nothing urgent in today\'s signals.' },
});

const ACTION_TITLES = Object.freeze({
  urgent_scan_followup: { key: 'daily.title.scan_followup', fallback: 'Re-check the recently scanned plant.' },
  weather_risk:         { key: 'daily.title.weather_risk',  fallback: 'Prepare for the weather change.' },
  watering:             { key: 'daily.title.watering',      fallback: 'Water {crop} today.' },
  watering_skip:        { key: 'daily.title.watering_skip', fallback: 'Skip watering today.' },
  crop_stage_task:      { key: 'daily.title.stage_task',    fallback: 'Do the next stage check on {crop}.' },
  harvest_ready:        { key: 'daily.title.harvest',       fallback: 'Check {crop} for harvest readiness.' },
  routine_check:        { key: 'daily.title.routine',       fallback: 'Walk the plants and observe.' },
});

function _toneFor(urgencyOrSeverity) {
  const v = _str(urgencyOrSeverity);
  if (v === 'high') return CONFIDENCE_TONE.URGENT;
  if (v === 'normal' || v === 'medium') return CONFIDENCE_TONE.FIRM;
  return CONFIDENCE_TONE.GENTLE;
}

/**
 * Build the candidate list from the four engines. Each candidate
 * carries a `type` matching `recommendationRankingEngine` priorities
 * so the ranker picks the right one.
 */
function _candidatesFrom({ snapshot, lifecycle, weatherInsight, wateringRec, scanHistory, crop }) {
  const candidates = [];
  const cropLabel = String(crop || (snapshot && snapshot.crop) || 'the plant');

  // 1. Urgent scan follow-up — most recent scan flagged stress.
  try {
    const recent = Array.isArray(scanHistory) && scanHistory.length
      ? scanHistory[scanHistory.length - 1]
      : null;
    const cat = _str(recent && (recent.issueCategory || recent.category));
    const isStress = cat && cat !== 'healthy' && cat !== 'unknown_needs_clearer_photo';
    if (isStress) {
      candidates.push({
        type: 'urgent_scan_followup',
        id:   `scan_${recent.scanId || cat}`,
        crop: cropLabel,
        urgency: 'high',
      });
    }
  } catch { /* swallow */ }

  // 2. Weather risk — frost / heat-stress / fungal-risk windows
  //    are operational.
  if (weatherInsight && weatherInsight.primary
      && weatherInsight.primary.type !== WEATHER_INSIGHT.CURRENT) {
    const sev = weatherInsight.primary.severity;
    candidates.push({
      type: 'weather_risk',
      id:   `weather_${weatherInsight.primary.type}`,
      crop: cropLabel,
      urgency: sev === SEVERITY.HIGH ? 'high' : 'normal',
      weatherInsight: weatherInsight.primary,
    });
  }

  // 3. Watering — water or skip.
  if (wateringRec) {
    if (wateringRec.recommendation === WATERING_ACTION.WATER) {
      candidates.push({
        type: 'watering',
        id:   'watering_today',
        crop: cropLabel,
        urgency: wateringRec.urgency || 'normal',
        time: wateringRec.idealTime,
      });
    } else if (wateringRec.recommendation === WATERING_ACTION.SKIP) {
      candidates.push({
        type: 'watering_skip',
        id:   'watering_skip',
        crop: cropLabel,
        urgency: 'low',
      });
    }
  }

  // 4. Crop-stage task — from the lifecycle snapshot.
  if (lifecycle && Array.isArray(lifecycle.stageTasks) && lifecycle.stageTasks.length > 0) {
    const t = lifecycle.stageTasks[0];
    const type = lifecycle.currentStage === LIFECYCLE_STAGE.HARVEST_READY
      || lifecycle.currentStage === LIFECYCLE_STAGE.HARVEST
        ? 'harvest_ready'
        : 'crop_stage_task';
    candidates.push({
      type,
      id:   `stage_${lifecycle.currentStage}`,
      crop: cropLabel,
      urgency: type === 'harvest_ready' ? 'high' : 'normal',
      stageTask: t,
    });
  }

  // 5. Routine check — the fallback when nothing else fires.
  candidates.push({
    type: 'routine_check',
    id:   'routine_observe',
    crop: cropLabel,
    urgency: 'low',
  });

  return candidates;
}

/**
 * Compute the daily decision.
 *
 * @param {object} args
 * @param {object} [args.snapshot]        from getIntelligenceSnapshot()
 * @param {string} [args.experienceLevel] 'new' | 'experienced'
 * @param {string} [args.crop]            override snapshot.crop
 * @param {object} [args.weather]         from snapshot.weather
 * @param {object} [args.lifecycle]       precomputed lifecycle snapshot
 * @param {object} [args.watering]        precomputed watering recommendation
 * @param {Array}  [args.scanHistory]
 * @param {number} [args.nowMs]
 * @returns {object}
 */
export function computeDailyDecision(args) {
  try {
    const a = (args && typeof args === 'object') ? args : {};
    const snapshot = (a.snapshot && typeof a.snapshot === 'object') ? a.snapshot : {};
    const experience = _str(a.experienceLevel) === EXPERIENCE_LEVEL.EXPERIENCED
      ? EXPERIENCE_LEVEL.EXPERIENCED
      : EXPERIENCE_LEVEL.NEW;
    const crop = a.crop || snapshot.crop || null;
    const weather = a.weather || snapshot.weather || {};
    const nowMs = Number.isFinite(a.nowMs) ? a.nowMs : Date.now();
    const cropLabel = String(crop || 'the plant');

    // Compose engines if precomputed values weren't passed.
    const lifecycle = a.lifecycle || computeLifecycleSnapshot({
      crop, mode: snapshot.mode || a.mode,
      plantingDate: snapshot.plantingDate || a.plantingDate,
      weather, scanHistory: a.scanHistory || snapshot.scanHistory,
      nowMs,
    });
    const weatherInsight = a.weatherInsight || interpretWeather({
      weather, mode: snapshot.mode || a.mode, crop,
      cropStage: lifecycle && lifecycle.currentStage,
    });
    const wateringRec = a.watering || computeWateringRecommendation({
      crop, mode: snapshot.mode || a.mode, weather,
      taskHistory: { lastWateredAt: snapshot.lastWateredAt || a.lastWateredAt },
      stress: snapshot.scanStress || a.scanStress,
      nowMs,
    });

    const candidates = _candidatesFrom({
      snapshot, lifecycle, weatherInsight, wateringRec,
      scanHistory: a.scanHistory || snapshot.scanHistory,
      crop: cropLabel,
    });
    const top = pickPrimaryRecommendation(candidates);

    // No genuine candidate at all → calm no-action state.
    if (!top) {
      return _noActionDecision(experience, cropLabel);
    }

    const titleTemplate = ACTION_TITLES[top.type] || ACTION_TITLES.routine_check;
    const reasonTemplate = REASON_TEMPLATES[top.type] || REASON_TEMPLATES.routine_check;
    const microHelpTemplate = MICRO_HELP[top.type] || MICRO_HELP.routine_check;

    const urgency = top.urgency || 'normal';
    const tone = _toneFor(urgency);

    // Best time hint: weather + watering carry an idealTime; the
    // rest default to "today".
    let bestTime = 'today';
    if (top.type === 'watering' && wateringRec && wateringRec.idealTime) {
      bestTime = wateringRec.idealTime;
    } else if (top.type === 'urgent_scan_followup' || top.type === 'harvest_ready') {
      bestTime = 'morning';
    }

    // Optional follow-up task — pulled from the lifecycle / watering
    // engine where present.
    let followUpTask = null;
    if (top.type === 'watering' || top.type === 'watering_skip') {
      if (wateringRec && wateringRec.next) {
        followUpTask = {
          titleKey:      `daily.followup.watering`,
          titleFallback: wateringRec.next,
          actionType:    'water',
        };
      }
    } else if (top.stageTask) {
      followUpTask = {
        titleKey:      top.stageTask.titleKey,
        titleFallback: top.stageTask.titleFallback,
        actionType:    top.stageTask.actionType,
      };
    }

    return Object.freeze({
      experienceLevel: experience,
      crop:            cropLabel,
      bestAction: {
        type:          top.type,
        titleKey:      titleTemplate.key,
        titleFallback: titleTemplate.fallback.replace('{crop}', cropLabel),
        title:         _msg(titleTemplate, { crop: cropLabel }),
      },
      reason:          _msg(reasonTemplate, { crop: cropLabel }),
      bestTime,
      urgency,
      confidenceTone:  tone,
      followUpTask,
      // Beginner companions: only show for the NEW level. The
      // EXPERIENCED tier returns null so the surface renders just
      // title + reason + urgency.
      microHelp:       experience === EXPERIENCE_LEVEL.NEW
        ? _msg(microHelpTemplate, { crop: cropLabel })
        : null,
      disclaimer:      'Today\'s guidance is based on recent signals — local conditions may shift it.',
    });
  } catch {
    return _noActionDecision(EXPERIENCE_LEVEL.NEW, 'the plant');
  }
}

function _noActionDecision(experience, cropLabel) {
  return Object.freeze({
    experienceLevel: experience,
    crop:            cropLabel,
    bestAction: {
      type:          'no_action',
      titleKey:      'daily.title.no_action',
      titleFallback: `Walk the plants and observe today.`,
      title:         _msg({ key: 'daily.title.no_action', fallback: 'Walk the plants and observe today.' }, { crop: cropLabel }),
    },
    reason:          _msg(REASON_TEMPLATES.no_action, { crop: cropLabel }),
    bestTime:        'today',
    urgency:         'low',
    confidenceTone:  CONFIDENCE_TONE.GENTLE,
    followUpTask:    null,
    microHelp:       experience === EXPERIENCE_LEVEL.NEW
      ? _msg(MICRO_HELP.no_action, { crop: cropLabel })
      : null,
    disclaimer:      'Today\'s guidance is based on recent signals — local conditions may shift it.',
  });
}

const _module = {
  EXPERIENCE_LEVEL, CONFIDENCE_TONE,
  computeDailyDecision,
};
export default _module;
