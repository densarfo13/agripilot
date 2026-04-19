/**
 * devAssertions.js — development-only warnings. Called from
 * resolveFarmerState() before returning. In production the
 * dev check is a no-op (Vite tree-shakes by DEV flag).
 *
 * Warns (via console.warn) when:
 *   • strong state emitted without validation override check
 *   • low-confidence state produced with high-confidence wording
 *   • stale_offline rendered with direct certainty
 *   • strong state emitted without a next-step bridge
 *   • region tone adapter not applied
 */

import { STATE_TYPES } from './statePriority.js';

const STRONG_STATES = new Set([
  STATE_TYPES.HARVEST_COMPLETE,
  STATE_TYPES.POST_HARVEST,
  STATE_TYPES.FIELD_RESET,
  STATE_TYPES.BLOCKED_BY_LAND,
  STATE_TYPES.CAMERA_ISSUE,
]);

const BRIDGE_REQUIRED = new Set([
  STATE_TYPES.HARVEST_COMPLETE,
  STATE_TYPES.POST_HARVEST,
  STATE_TYPES.FIELD_RESET,
  STATE_TYPES.RETURNING_INACTIVE,
  STATE_TYPES.STALE_OFFLINE,
  STATE_TYPES.FIRST_USE,
]);

function isDev() {
  try {
    if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development') return true;
  } catch { /* noop */ }
  try {
    return typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV === true;
  } catch { return false; }
}

function warn(msg, detail) {
  if (typeof console !== 'undefined' && console.warn) {
    console.warn('[farmerState] ' + msg, detail || '');
  }
}

/**
 * runDevAssertions — non-throwing warnings. Returns an array of
 * issues that tests can inspect without needing to mock console.
 */
export function runDevAssertions(state, context = {}) {
  const issues = [];
  if (!state || typeof state !== 'object') return issues;

  // 1. Strong state without validation check
  if (STRONG_STATES.has(state.stateType)
      && !(state.sourceReasons || []).some((r) => String(r).startsWith('override_')
                                               || String(r).startsWith('downgrade_')
                                               || String(r).startsWith('soften_')
                                               || String(r) === 'validation_confirmed')) {
    issues.push('strong_state_without_validation_check');
  }

  // 2. Low confidence + imperative display mode
  if (state.confidenceLevel === 'low' && state.displayMode === 'task_first') {
    issues.push('low_confidence_with_task_first_display');
  }

  // 3. Stale offline + high confidence copy
  if (state.stateType === STATE_TYPES.STALE_OFFLINE && state.confidenceLevel === 'high') {
    issues.push('stale_offline_with_high_confidence_wording');
  }

  // 4. Strong state missing a next-step bridge
  if (BRIDGE_REQUIRED.has(state.stateType) && !state.nextKey) {
    issues.push('strong_state_missing_bridge');
  }

  // 5. Region tone adapter not applied
  if (!state.toneKeys) {
    issues.push('region_tone_adapter_not_applied');
  }

  if (isDev() && issues.length) {
    warn('decision engine emitted a state with issues', { state, issues });
  }
  return issues;
}

export const _internal = { STRONG_STATES, BRIDGE_REQUIRED, isDev };
