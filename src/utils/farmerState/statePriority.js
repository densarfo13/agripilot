/**
 * statePriority.js — canonical priority order for farmer states.
 * The lower the index, the higher the priority when the classifier
 * finds multiple candidate states simultaneously.
 *
 * The order is explicit in code (not docs). Tests assert it so a
 * refactor can't silently reshuffle.
 *
 *   1. camera_issue         — hard evidence from the user's photo
 *   2. stale_offline        — we can't trust anything else
 *   3. blocked_by_land      — physical blocker
 *   4. field_reset          — validation override: post-harvest but
 *                              land still needs cleanup
 *   5. harvest_complete     — just finished
 *   6. post_harvest         — planning next cycle
 *   7. weather_sensitive    — weather dominates today's decision
 *   8. first_use            — new user, no cycle yet
 *   9. returning_inactive   — user came back after N+ days
 *  10. active_cycle         — normal operating state
 *  11. off_season           — nothing to do right now
 *  12. safe_fallback        — last resort
 */

export const STATE_TYPES = Object.freeze({
  CAMERA_ISSUE:        'camera_issue',
  STALE_OFFLINE:       'stale_offline',
  BLOCKED_BY_LAND:     'blocked_by_land',
  FIELD_RESET:         'field_reset',
  HARVEST_COMPLETE:    'harvest_complete',
  POST_HARVEST:        'post_harvest',
  WEATHER_SENSITIVE:   'weather_sensitive',
  FIRST_USE:           'first_use',
  RETURNING_INACTIVE:  'returning_inactive',
  ACTIVE_CYCLE:        'active_cycle',
  OFF_SEASON:          'off_season',
  SAFE_FALLBACK:       'safe_fallback',
});

export const STATE_PRIORITY = Object.freeze([
  STATE_TYPES.CAMERA_ISSUE,
  STATE_TYPES.STALE_OFFLINE,
  STATE_TYPES.BLOCKED_BY_LAND,
  STATE_TYPES.FIELD_RESET,
  STATE_TYPES.HARVEST_COMPLETE,
  STATE_TYPES.POST_HARVEST,
  STATE_TYPES.WEATHER_SENSITIVE,
  STATE_TYPES.FIRST_USE,
  STATE_TYPES.RETURNING_INACTIVE,
  STATE_TYPES.ACTIVE_CYCLE,
  STATE_TYPES.OFF_SEASON,
  STATE_TYPES.SAFE_FALLBACK,
]);

export function getStatePriorityIndex(stateType) {
  const i = STATE_PRIORITY.indexOf(String(stateType || ''));
  return i >= 0 ? i : STATE_PRIORITY.length;
}

/** Pick the highest-priority candidate from a set of stateType strings. */
export function pickByPriority(candidates = []) {
  if (!candidates || !candidates.length) return STATE_TYPES.SAFE_FALLBACK;
  let winner = null;
  let winnerIdx = STATE_PRIORITY.length + 1;
  for (const c of candidates) {
    const idx = getStatePriorityIndex(c);
    if (idx < winnerIdx) { winner = c; winnerIdx = idx; }
  }
  return winner || STATE_TYPES.SAFE_FALLBACK;
}
