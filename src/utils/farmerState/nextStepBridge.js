/**
 * nextStepBridge.js — attaches a "next step" hint to a resolved
 * state so the product never feels dead-ended.
 *
 *   appendNextStepBridge(state, context) → state
 *
 * Each state type has a canonical bridge:
 *
 *   harvest_complete   → prepare_field_for_next_cycle
 *   post_harvest       → review_next_crop
 *   field_reset        → finish_field_cleanup
 *   returning_inactive → check_today_task
 *   stale_offline      → reconnect_to_refresh_guidance
 *   first_use          → start_setup
 *   blocked_by_land    → fix_blocker (parameterised by blocker type)
 *   weather_sensitive  → wait_for_conditions
 *   camera_issue       → review_camera_finding
 *   active_cycle       → (no bridge — the task card already directs action)
 *   off_season         → plan_next_season
 *   safe_fallback      → open_guidance
 *
 * The bridge is a { nextKey, nextFallback } pair — the
 * buildHomeExperience layer resolves it through t() with
 * region-tone fallback just like every other key in this module.
 */

import { STATE_TYPES } from './statePriority.js';

const CANONICAL_BRIDGES = Object.freeze({
  [STATE_TYPES.HARVEST_COMPLETE]:   {
    nextKey: 'state.next.prepare_field_for_next_cycle',
    nextFallback: 'Prepare your field for the next cycle',
  },
  [STATE_TYPES.POST_HARVEST]:       {
    nextKey: 'state.next.review_next_crop',
    nextFallback: 'Review your next crop',
  },
  [STATE_TYPES.FIELD_RESET]:        {
    nextKey: 'state.next.finish_field_cleanup',
    nextFallback: 'Finish clearing your field before planting',
  },
  [STATE_TYPES.RETURNING_INACTIVE]: {
    nextKey: 'state.next.check_today_task',
    nextFallback: 'Check today\u2019s task to get back on track',
  },
  [STATE_TYPES.STALE_OFFLINE]:      {
    nextKey: 'state.next.reconnect_to_refresh',
    nextFallback: 'Reconnect to refresh your guidance',
  },
  [STATE_TYPES.FIRST_USE]:          {
    nextKey: 'state.next.start_setup',
    nextFallback: 'Let\u2019s set up your first crop',
  },
  [STATE_TYPES.WEATHER_SENSITIVE]:  {
    nextKey: 'state.next.wait_for_conditions',
    nextFallback: 'Wait until conditions are better',
  },
  [STATE_TYPES.CAMERA_ISSUE]:       {
    nextKey: 'state.next.review_camera_finding',
    nextFallback: 'Open the camera finding for details',
  },
  [STATE_TYPES.OFF_SEASON]:         {
    nextKey: 'state.next.plan_next_season',
    nextFallback: 'Start planning your next season',
  },
  [STATE_TYPES.SAFE_FALLBACK]:      {
    nextKey: 'state.next.open_guidance',
    nextFallback: 'Open guidance for what to do next',
  },
});

/**
 * BLOCKED_BY_LAND has blocker-specific variants because the
 * farmer's next step depends on whether the land is wet, stony,
 * weedy, etc. This function returns a richer bridge for that one.
 */
function bridgeForBlockedLand(ctx) {
  const blocker = String(ctx?.landProfile?.blocker || '').toLowerCase();
  switch (blocker) {
    case 'wet_soil':
      return {
        nextKey: 'state.next.fix_blocker.wet_soil',
        nextFallback: 'Wait for the soil to dry before planting',
      };
    case 'weeds_present':
      return {
        nextKey: 'state.next.fix_blocker.weeds',
        nextFallback: 'Clear the weeds before planting',
      };
    case 'uncleared_land':
      return {
        nextKey: 'state.next.fix_blocker.uncleared',
        nextFallback: 'Clear your field first',
      };
    case 'stones_present':
      return {
        nextKey: 'state.next.fix_blocker.stones',
        nextFallback: 'Remove stones before planting',
      };
    case 'unprepared_ridges':
      return {
        nextKey: 'state.next.fix_blocker.ridges',
        nextFallback: 'Prepare your ridges first',
      };
    default:
      return {
        nextKey: 'state.next.fix_blocker.generic',
        nextFallback: 'Your field may need more preparation',
      };
  }
}

/**
 * appendNextStepBridge — attach the bridge to the state. Returns
 * a new object; the input is not mutated.
 */
export function appendNextStepBridge(state = {}, context = {}) {
  if (!state || typeof state !== 'object') return state;
  const stateType = String(state.stateType || '').toLowerCase();

  // active_cycle deliberately has no bridge — the task card itself
  // is the next step. Attach null so downstream code knows.
  if (stateType === STATE_TYPES.ACTIVE_CYCLE) {
    return { ...state, nextKey: null, nextFallback: null };
  }

  if (stateType === STATE_TYPES.BLOCKED_BY_LAND) {
    const b = bridgeForBlockedLand(context);
    return { ...state, ...b };
  }

  const canonical = CANONICAL_BRIDGES[stateType];
  if (!canonical) return { ...state, nextKey: null, nextFallback: null };
  return { ...state, ...canonical };
}

export const _internal = { CANONICAL_BRIDGES, bridgeForBlockedLand };
