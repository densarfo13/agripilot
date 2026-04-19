/**
 * stateDisplayMode.js — chooses whether the Home screen should
 * lead with the STATE (reassurance / celebration / onboarding
 * cue) or with the TASK (act now).
 *
 *   'state_first'  → show state title + next-step bridge up top,
 *                    task card sits below
 *   'task_first'   → show primary task card prominently, state
 *                    info slots underneath as a small line
 *
 * Mapping (per spec):
 *
 *   STATE-FIRST: harvest_complete, post_harvest, field_reset,
 *                stale_offline, returning_inactive, first_use
 *   TASK-FIRST:  blocked_by_land, weather_sensitive, camera_issue,
 *                active_cycle
 *   generic:     off_season, safe_fallback → state_first
 *
 * Low-confidence state should never be rendered in a way that
 * feels assertive, so even a TASK-FIRST state flips to state_first
 * when confidence is 'low' (the state card will carry the softer
 * "check first" wording instead of the imperative task copy).
 */

import { STATE_TYPES } from './statePriority.js';

const STATE_FIRST = new Set([
  STATE_TYPES.HARVEST_COMPLETE,
  STATE_TYPES.POST_HARVEST,
  STATE_TYPES.FIELD_RESET,
  STATE_TYPES.STALE_OFFLINE,
  STATE_TYPES.RETURNING_INACTIVE,
  STATE_TYPES.FIRST_USE,
  STATE_TYPES.OFF_SEASON,
  STATE_TYPES.SAFE_FALLBACK,
]);

const TASK_FIRST = new Set([
  STATE_TYPES.BLOCKED_BY_LAND,
  STATE_TYPES.WEATHER_SENSITIVE,
  STATE_TYPES.CAMERA_ISSUE,
  STATE_TYPES.ACTIVE_CYCLE,
]);

export function resolveDisplayMode(state = {}) {
  const stateType = String(state?.stateType || '').toLowerCase();
  const level = String(state?.confidenceLevel || '').toLowerCase();

  // Low confidence always flips to state_first so we render a
  // softer "check first" card rather than an imperative task.
  if (level === 'low') return 'state_first';

  if (STATE_FIRST.has(stateType)) return 'state_first';
  if (TASK_FIRST.has(stateType))  return 'task_first';
  return 'state_first';
}

export const _internal = { STATE_FIRST, TASK_FIRST };
