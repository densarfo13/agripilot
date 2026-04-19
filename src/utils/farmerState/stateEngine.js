/**
 * stateEngine.js — the top-level farmer state resolver.
 *
 *   resolveFarmerState(ctx) → FarmerState
 *
 * Pipeline (boring on purpose):
 *   1. classifyStateCandidates       → every candidate state
 *   2. pickByPriority                → single winner
 *   3. attach canonical wording keys → stateWording.js lookup
 *   4. scoreStateConfidence          → { level, score, reasons }
 *   5. validateResolvedState         → override / downgrade rules
 *   6. resolveDisplayMode            → state_first | task_first
 *   7. appendNextStepBridge          → attach nextKey / nextFallback
 *   8. applyStateToneByRegion        → attach toneKeys
 *   9. runDevAssertions              → warn-only, never throws
 *
 * FarmerState shape:
 *   {
 *     stateType, confidenceLevel, confidenceScore,
 *     urgency,                          // 'low' | 'medium' | 'high'
 *     titleKey, titleFallback,
 *     subtitleKey, subtitleFallback,
 *     whyKey, whyFallback,              // optional
 *     nextKey, nextFallback,            // optional
 *     displayMode,                      // 'state_first' | 'task_first'
 *     primaryTaskId,                    // optional passthrough
 *     sourceReasons: [...],             // internal only
 *     staleData: boolean,
 *     regionBucket: string,
 *     toneKeys: { title, subtitle, why, next },
 *     devIssues: string[],              // dev-only; empty in prod
 *   }
 */

import { pickByPriority, STATE_TYPES } from './statePriority.js';
import { classifyStateCandidates } from './classifyStateCandidates.js';
import { scoreStateConfidence } from './stateConfidence.js';
import { validateResolvedState } from './stateValidation.js';
import { resolveDisplayMode } from './stateDisplayMode.js';
import { appendNextStepBridge } from './nextStepBridge.js';
import { applyStateToneByRegion, resolveRegionBucket } from './stateTone.js';
import { getStateWording } from './stateWording.js';
import { runDevAssertions } from './devAssertions.js';

export function resolveFarmerState(ctx = {}) {
  const safe = ctx || {};

  // 1 + 2. pick the winning candidate
  const candidates = classifyStateCandidates(safe);
  const stateType  = pickByPriority(candidates);

  // 3. attach canonical wording keys from the table
  const wording = getStateWording(stateType);
  let state = {
    stateType,
    confidenceLevel: 'medium',
    confidenceScore: 50,
    urgency: deriveUrgency(stateType),
    titleKey: wording.titleKey, titleFallback: wording.titleFallback,
    subtitleKey: wording.subtitleKey, subtitleFallback: wording.subtitleFallback,
    whyKey: wording.whyKey || null, whyFallback: wording.whyFallback || null,
    nextKey: null, nextFallback: null,
    displayMode: null,
    primaryTaskId: safe.primaryTaskId || null,
    sourceReasons: [`candidate_${stateType}`, 'candidates_considered:' + candidates.join('|')],
    staleData: false,
    regionBucket: 'unknown',
    toneKeys: null,
    devIssues: [],
  };

  // 4. confidence scoring
  const confidence = scoreStateConfidence({ ...safe, stateType });
  state.confidenceLevel = confidence.level;
  state.confidenceScore = confidence.score;
  state.sourceReasons.push(...confidence.reasons.map((r) => `confidence:${r}`));

  // 5. validation — can replace stateType, downgrade level, or
  //    confirm. If anything changes, refresh the wording.
  const validatedPre = state.stateType;
  state = validateResolvedState(state, safe);
  if (state.stateType !== validatedPre) {
    const nw = getStateWording(state.stateType);
    state.titleKey = nw.titleKey; state.titleFallback = nw.titleFallback;
    state.subtitleKey = nw.subtitleKey; state.subtitleFallback = nw.subtitleFallback;
    state.whyKey = nw.whyKey || null;   state.whyFallback = nw.whyFallback || null;
  }
  // Signal that validation ran, so devAssertions is happy when no
  // override occurred.
  if (!state.sourceReasons.some((r) => String(r).startsWith('override_')
                                    || String(r).startsWith('downgrade_')
                                    || String(r).startsWith('soften_')
                                    || String(r).startsWith('fallback_'))) {
    state.sourceReasons.push('validation_confirmed');
  }

  // 6. display mode (state_first vs task_first)
  state.displayMode = resolveDisplayMode(state);

  // 7. next-step bridge
  state = appendNextStepBridge(state, safe);

  // 8. region tone
  const bucket = resolveRegionBucket(safe.regionBucket || safe.countryCode);
  state = applyStateToneByRegion(state, bucket);

  // 9. dev assertions
  state.devIssues = runDevAssertions(state, safe);

  return state;
}

/**
 * buildHomeExperience — turns (task, farmerState) into the
 * final Home payload the UI consumes.
 *
 *   {
 *     displayMode, title, subtitle?, why?, next?, cta,
 *     taskId?, confidenceLine?
 *   }
 *
 * Wording resolution order for every field:
 *   1. region-toned key:      t(state.toneKeys.<field>)
 *   2. confidence-tiered key: t(`${baseKey}.${level}`)
 *   3. base key:              t(baseKey)
 *   4. English fallback:      baseFallback
 *
 * confidenceLine is the ONLY place the app tells the farmer how
 * certain we are — and even there we never expose the numeric
 * score. We either prepend a soft "Based on your last update"
 * (stale offline) or omit it entirely.
 */
export function buildHomeExperience({ task = null, farmerState = null, t = null } = {}) {
  if (!farmerState) return null;
  const level = farmerState.confidenceLevel || 'medium';
  const displayMode = farmerState.displayMode || 'state_first';

  const pick = (baseKey, baseFallback, toneKey) => {
    return (
      tryT(t, toneKey)
      || tryT(t, baseKey ? `${baseKey}.${level}` : null)
      || tryT(t, baseKey)
      || baseFallback
      || null
    );
  };

  // Title + subtitle — state-first uses the state's own copy,
  // task-first prefers the task's own title so the action is
  // prominent. The state's copy slots in underneath as why/next.
  let title, subtitle;
  if (displayMode === 'task_first' && task) {
    title    = task.title || pick(farmerState.titleKey, farmerState.titleFallback, farmerState.toneKeys?.title);
    subtitle = task.subtitle || null;
  } else {
    title    = pick(farmerState.titleKey, farmerState.titleFallback, farmerState.toneKeys?.title);
    subtitle = pick(farmerState.subtitleKey, farmerState.subtitleFallback, farmerState.toneKeys?.subtitle);
  }

  const why  = pick(farmerState.whyKey,  farmerState.whyFallback,  farmerState.toneKeys?.why);
  const next = pick(farmerState.nextKey, farmerState.nextFallback, farmerState.toneKeys?.next);

  const cta = task?.cta || deriveCtaForState(farmerState.stateType, t);
  const taskId = task?.id || farmerState.primaryTaskId || null;

  let confidenceLine = null;
  if (farmerState.staleData) {
    confidenceLine = tryT(t, 'state.soft.based_on_last_update') || 'Based on your last update';
  }

  return {
    displayMode,
    title,
    subtitle: subtitle || null,
    why: why || null,
    next: next || null,
    cta: cta || null,
    taskId,
    confidenceLine,
    state: farmerState.stateType,
    level,
  };
}

// ─── internals ────────────────────────────────────────────
function tryT(t, key) {
  if (typeof t !== 'function' || !key) return null;
  const v = t(key);
  if (v && v !== key) return v;
  return null;
}

function deriveUrgency(stateType) {
  switch (stateType) {
    case STATE_TYPES.CAMERA_ISSUE:
    case STATE_TYPES.BLOCKED_BY_LAND:
    case STATE_TYPES.WEATHER_SENSITIVE:
      return 'high';
    case STATE_TYPES.FIELD_RESET:
    case STATE_TYPES.RETURNING_INACTIVE:
    case STATE_TYPES.HARVEST_COMPLETE:
      return 'medium';
    default:
      return 'low';
  }
}

function deriveCtaForState(stateType, t) {
  const fallbackCtas = {
    [STATE_TYPES.HARVEST_COMPLETE]:   { key: 'state.cta.start_next_cycle', fallback: 'Start next cycle' },
    [STATE_TYPES.POST_HARVEST]:       { key: 'state.cta.plan_next_crop',   fallback: 'Plan next crop' },
    [STATE_TYPES.FIELD_RESET]:        { key: 'state.cta.open_cleanup',     fallback: 'Open cleanup tasks' },
    [STATE_TYPES.BLOCKED_BY_LAND]:    { key: 'state.cta.review_field',     fallback: 'Review your field' },
    [STATE_TYPES.CAMERA_ISSUE]:       { key: 'state.cta.open_camera',      fallback: 'Open camera finding' },
    [STATE_TYPES.WEATHER_SENSITIVE]:  { key: 'state.cta.see_forecast',     fallback: 'See forecast' },
    [STATE_TYPES.RETURNING_INACTIVE]: { key: 'state.cta.see_today',        fallback: 'See today' },
    [STATE_TYPES.STALE_OFFLINE]:      { key: 'state.cta.reconnect',        fallback: 'Reconnect' },
    [STATE_TYPES.FIRST_USE]:          { key: 'state.cta.get_started',      fallback: 'Get started' },
    [STATE_TYPES.OFF_SEASON]:         { key: 'state.cta.plan_season',      fallback: 'Plan season' },
    [STATE_TYPES.SAFE_FALLBACK]:      { key: 'state.cta.open_guidance',    fallback: 'Open guidance' },
    [STATE_TYPES.ACTIVE_CYCLE]:       { key: 'state.cta.open_today',       fallback: 'Open today' },
  };
  const row = fallbackCtas[stateType] || fallbackCtas[STATE_TYPES.SAFE_FALLBACK];
  return tryT(t, row.key) || row.fallback;
}

export { STATE_TYPES };
