/**
 * stateValidation.js — runs field-reality checks on a resolved
 * state and either confirms it, downgrades its confidence, or
 * replaces it with a more honest state.
 *
 *   validateResolvedState(state, context) → state
 *
 * The validator is the only place that's allowed to change the
 * state AFTER priority picked a winner. It's also the only place
 * that knows about specific cross-signal contradictions, so
 * business logic stays explainable.
 *
 * Implemented overrides:
 *
 *   1. post_harvest + land NOT cleared
 *         → replace with field_reset
 *   2. harvest_complete + recent reopen/undo
 *         → keep stateType, drop confidence
 *   3. planting stage + wet land OR land blocker
 *         → replace with blocked_by_land
 *   4. weather says "plant now" + land too wet
 *         → replace with blocked_by_land
 *   5. camera finds unknown issue with LOW confidence
 *         → keep but soften (downgrade level to 'low')
 *   6. offline + stale data + HIGH-certainty state
 *         → keep but mark staleData + downgrade level
 *   7. missing crop profile when stateType requires crop context
 *         → fall back to safe_fallback
 *
 * Output is a NEW state object — never mutates the input.
 */

import { STATE_TYPES } from './statePriority.js';

const RECENT_CORRECTION_TYPES = new Set([
  'state_reopened', 'state_undone', 'harvest_reopened', 'task_reopened',
]);
const LAND_BLOCKERS = new Set([
  'uncleared_land', 'weeds_present', 'wet_soil', 'stones_present', 'unprepared_ridges',
]);

/**
 * @param {object} state    { stateType, confidenceLevel, confidenceScore, sourceReasons }
 * @param {object} context  the full ctx passed to resolveFarmerState
 * @returns {object} new state
 */
export function validateResolvedState(state = {}, context = {}) {
  if (!state || typeof state !== 'object') return state;
  const out = { ...state, sourceReasons: [...(state.sourceReasons || [])] };
  const land    = context.landProfile || null;
  const stage   = String(context.cropProfile?.stage || '').toLowerCase();
  const events  = Array.isArray(context.recentEvents) ? context.recentEvents : [];

  // 1. post_harvest + uncleared land → field_reset. This rule also
  //    catches the case where priority-picking surfaced
  //    BLOCKED_BY_LAND (higher-priority) but the underlying
  //    scenario is "post-harvest cleanup", which deserves the
  //    softer, more specific field_reset copy instead of a
  //    generic "wait before planting".
  const stageIsPostHarvest = stage === 'post_harvest'
    || String(context.cropProfile?.phase || '').toLowerCase() === 'post_harvest';
  const landNotCleared = land && (land.cleared === false
    || LAND_BLOCKERS.has(String(land.blocker || '').toLowerCase()));
  if ((out.stateType === STATE_TYPES.POST_HARVEST
       || (out.stateType === STATE_TYPES.BLOCKED_BY_LAND && stageIsPostHarvest))
      && landNotCleared) {
    out.stateType = STATE_TYPES.FIELD_RESET;
    out.confidenceLevel = downgrade(out.confidenceLevel);
    out.sourceReasons.push('override_post_harvest_to_field_reset');
  }

  // 2. harvest_complete + recent undo → keep state but drop confidence
  if (out.stateType === STATE_TYPES.HARVEST_COMPLETE) {
    const undone = events.some((e) => RECENT_CORRECTION_TYPES.has(String(e?.type || '')));
    if (undone) {
      out.confidenceLevel = downgrade(out.confidenceLevel);
      out.sourceReasons.push('downgrade_harvest_complete_recent_undo');
    }
  }

  // 3. planting stage + wet/blocker land → blocked_by_land
  if (stage === 'planting'
      && land
      && (land.moisture === 'wet'
          || LAND_BLOCKERS.has(String(land.blocker || '').toLowerCase()))) {
    if (out.stateType !== STATE_TYPES.BLOCKED_BY_LAND) {
      out.stateType = STATE_TYPES.BLOCKED_BY_LAND;
      out.sourceReasons.push('override_planting_to_blocked_by_land');
    }
  }

  // 4. weather says "plant now" + land too wet → blocked_by_land
  const weather = context.weatherNow || null;
  const weatherEncouragesPlant = weather
    && (weather.rainRisk === 'high' || Number(weather.rainMmNext24h) >= 25)
    && stage === 'planting';
  if (weatherEncouragesPlant && land?.moisture === 'wet') {
    if (out.stateType !== STATE_TYPES.BLOCKED_BY_LAND) {
      out.stateType = STATE_TYPES.BLOCKED_BY_LAND;
      out.sourceReasons.push('override_weather_plant_vs_wet_soil');
    }
  }

  // 5. camera unknown + already LOW confidence → ensure soft wording
  const camType = String(context.cameraTask?.type || '').toLowerCase();
  if (out.stateType === STATE_TYPES.CAMERA_ISSUE
      && (camType === 'unknown_issue' || camType === 'low_light' || camType === 'blurry')) {
    out.confidenceLevel = 'low';
    out.sourceReasons.push('soften_camera_uncertain');
  }

  // 6. offline + stale + HIGH level → drop + mark stale
  const isOffline = context.offlineState?.isOffline === true;
  const ageMsNow  = ageMs(context.lastUpdatedAt);
  if (isOffline && ageMsNow >= 6 * 60 * 60 * 1000) {
    out.staleData = true;
    if (out.confidenceLevel === 'high') {
      out.confidenceLevel = 'medium';
      out.sourceReasons.push('downgrade_stale_offline_high_confidence');
    }
  }

  // 7. crop-dependent state without a crop profile → safe_fallback
  const cropRequiringStates = new Set([
    STATE_TYPES.ACTIVE_CYCLE, STATE_TYPES.HARVEST_COMPLETE,
    STATE_TYPES.POST_HARVEST, STATE_TYPES.FIELD_RESET,
  ]);
  if (cropRequiringStates.has(out.stateType) && !context.cropProfile) {
    out.stateType = STATE_TYPES.SAFE_FALLBACK;
    out.confidenceLevel = 'low';
    out.sourceReasons.push('fallback_missing_crop_profile');
  }

  return out;
}

function downgrade(level) {
  if (level === 'high')   return 'medium';
  if (level === 'medium') return 'low';
  return 'low';
}

function ageMs(lastUpdatedAt) {
  if (lastUpdatedAt == null) return Infinity;
  const ts = typeof lastUpdatedAt === 'number'
    ? lastUpdatedAt
    : Date.parse(String(lastUpdatedAt));
  if (!Number.isFinite(ts)) return Infinity;
  return Date.now() - ts;
}

export const _internal = { RECENT_CORRECTION_TYPES, LAND_BLOCKERS, downgrade };
