/**
 * productIntelligenceEventTypes.js (client) — mirror of the
 * server file of the same name. Components that derive PI events
 * (e.g. useHesitationTimer) import the constants from here so the
 * string literals never drift.
 */

export const PRODUCT_INTELLIGENCE_EVENT_TYPES = Object.freeze({
  HESITATION_TICK:          'hesitation_tick',
  SESSION_OUTCOME_COMPUTED: 'session_outcome_computed',
  TRUST_BREAK_DETECTED:     'trust_break_detected',
  RECOMMENDATION_FEEDBACK:  'recommendation_feedback',
});

export const PRODUCT_INTELLIGENCE_EVENT_VALUES = Object.freeze(
  new Set(Object.values(PRODUCT_INTELLIGENCE_EVENT_TYPES)),
);
