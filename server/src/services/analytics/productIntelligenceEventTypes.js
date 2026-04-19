/**
 * productIntelligenceEventTypes.js — product-intelligence events
 * emitted by the PI layer (hesitation timer, derived signals).
 * Kept separate from DECISION_EVENT_TYPES so the raw decision
 * taxonomy doesn't grow when we add inference-layer events.
 *
 * Usage in ingest endpoints:
 *
 *   import { PRODUCT_INTELLIGENCE_EVENT_VALUES } from
 *     '../services/analytics/productIntelligenceEventTypes.js';
 *   const { accepted, rejected } = validateBatch(req.body.events, {
 *     allowlist: PRODUCT_INTELLIGENCE_EVENT_VALUES,
 *   });
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

/** Merge a caller's allowlist with the PI set. Returns a new Set. */
export function withProductIntelligenceAllowlist(extra = null) {
  if (extra == null) return new Set(PRODUCT_INTELLIGENCE_EVENT_VALUES);
  return new Set([...PRODUCT_INTELLIGENCE_EVENT_VALUES, ...extra]);
}
