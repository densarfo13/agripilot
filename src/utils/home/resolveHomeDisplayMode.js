/**
 * resolveHomeDisplayMode.js — Home-specific thin wrapper over
 * the farmer state engine's resolveDisplayMode. Present for two
 * reasons:
 *
 *   • a single, Home-scoped symbol callers import so the
 *     dependency direction is obvious (Home → farmerState).
 *   • a stable contract for the Home rules even if the
 *     underlying display-mode table evolves.
 *
 * The contract:
 *
 *   'task_first'   — blocked_by_land, weather_sensitive,
 *                     camera_issue, active_cycle
 *   'state_first'  — harvest_complete, post_harvest,
 *                     field_reset, stale_offline,
 *                     returning_inactive, first_use,
 *                     off_season, safe_fallback
 *
 * Low-confidence on ANY state still flips to state_first — so
 * Home never renders imperative task copy when we're not sure.
 */

import { resolveDisplayMode as coreResolve } from '../farmerState/stateDisplayMode.js';

/**
 * resolveHomeDisplayMode — deterministic resolver. Returns a
 * string from { 'task_first', 'state_first' }.
 */
export function resolveHomeDisplayMode(farmerState = null) {
  // Delegate to the core resolver; the table already encodes
  // the correct policy. If callers pass null, we default to
  // state_first (the safer, less-imperative choice).
  if (!farmerState) return 'state_first';
  return coreResolve(farmerState);
}

export default resolveHomeDisplayMode;
