/**
 * homeDevAssertions.js — dev-only warnings that catch Home
 * payload violations BEFORE the screen renders them. In prod,
 * the returned issues array is still populated (cheap to compute)
 * so dashboards can surface a "Home emitted X issue today" tally
 * even without hitting console.warn.
 *
 * Checks (matching the spec):
 *   • more than one dominant card (variant/field duplication)
 *   • Home rendering without a why line
 *   • strong state without a next-step bridge
 *   • greeting/header bypassing state logic (empty line2)
 *   • stale/offline state using high-confidence wording
 *   • raw English key leakage in localized copy
 */

import { STATE_TYPES } from '../farmerState/statePriority.js';

const STATES_REQUIRING_BRIDGE = new Set([
  STATE_TYPES.HARVEST_COMPLETE,
  STATE_TYPES.POST_HARVEST,
  STATE_TYPES.RETURNING_INACTIVE,
  STATE_TYPES.STALE_OFFLINE,
  STATE_TYPES.FIELD_RESET,
  STATE_TYPES.FIRST_USE,
]);

function looksLikeRawKey(v) {
  if (typeof v !== 'string' || !v) return false;
  // Raw keys look like "home.welcome.x" or "state.harvest_complete.title".
  return /^[a-z][a-z0-9_]*(?:\.[a-z0-9_]+){1,}$/i.test(v) && !v.includes(' ');
}

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
    console.warn('[home] ' + msg, detail || '');
  }
}

/**
 * runHomeDevAssertions — non-throwing validator. Returns an
 * array of issue strings that tests can introspect without
 * stubbing console.
 */
export function runHomeDevAssertions(payload = null) {
  const issues = [];
  if (!payload || typeof payload !== 'object') {
    issues.push('home_payload_missing');
    return issues;
  }

  const card    = payload.card || null;
  const welcome = payload.welcome || null;
  const state   = payload.state || null;

  // Single dominant card — variant must be one of the three we
  // defined, and the card must have a title.
  if (!card) {
    issues.push('home_missing_dominant_card');
  } else {
    if (!card.title) issues.push('home_card_missing_title');
    if (!['task', 'state', 'stale_safe'].includes(card.variant)) {
      issues.push('home_card_invalid_variant');
    }
    if (!card.why || !String(card.why).trim()) {
      issues.push('home_card_missing_why');
    }
    if (card.cta && looksLikeRawKey(card.cta)) {
      issues.push('home_card_cta_raw_key');
    }
    if (card.title && looksLikeRawKey(card.title)) {
      issues.push('home_card_title_raw_key');
    }
  }

  // Welcome must have BOTH lines — never just "Hello {name}".
  if (!welcome) {
    issues.push('home_missing_welcome');
  } else {
    if (!welcome.line1 || !String(welcome.line1).trim()) {
      issues.push('home_welcome_empty_line1');
    }
    if (!welcome.line2 || !String(welcome.line2).trim()) {
      issues.push('home_welcome_empty_line2');
    }
    if (welcome.line1 && looksLikeRawKey(welcome.line1)) {
      issues.push('home_welcome_line1_raw_key');
    }
    if (welcome.line2 && looksLikeRawKey(welcome.line2)) {
      issues.push('home_welcome_line2_raw_key');
    }
  }

  // Strong states must expose a next-step bridge.
  if (state && STATES_REQUIRING_BRIDGE.has(state.stateType)) {
    if (!card?.nextStep || !String(card.nextStep).trim()) {
      issues.push('home_strong_state_missing_bridge');
    }
  }

  // Stale/offline never renders high-confidence wording.
  const stateType = state?.stateType;
  const isStale = stateType === STATE_TYPES.STALE_OFFLINE
               || payload.state?.staleData === true
               || card?.variant === 'stale_safe';
  if (isStale && card?.level === 'high') {
    issues.push('home_stale_with_high_confidence');
  }

  if (isDev() && issues.length) {
    warn('home payload violations detected', { issues, payload });
  }
  return issues;
}

export const _internal = {
  STATES_REQUIRING_BRIDGE, looksLikeRawKey, isDev,
};
