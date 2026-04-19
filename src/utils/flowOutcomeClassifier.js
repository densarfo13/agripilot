/**
 * flowOutcomeClassifier.js (client) — tiny mirror of the server
 * classifier for use in the debug panel and for in-product
 * nudges (e.g. "you seem stuck on this step — need help?").
 *
 * The authoritative implementation lives on the server; we don't
 * replicate the hesitation + trust-break detectors here to keep
 * the bundle small. For the client we only need a coarse
 * classification:
 *   action / drop_off / idle / progressing
 */

import { DECISION_EVENT_TYPES, categorizeDecisionEvent } from './decisionEventTypes.js';
import { FUNNEL_EVENT_TYPES } from './funnelEventTypes.js';

const COMMITTING_ACTIONS = new Set([
  DECISION_EVENT_TYPES.TASK_COMPLETED,
  DECISION_EVENT_TYPES.HARVEST_SUBMITTED,
  DECISION_EVENT_TYPES.INTEREST_ACCEPTED,
  DECISION_EVENT_TYPES.LISTING_CREATED_FROM_HARVEST,
  DECISION_EVENT_TYPES.BUYER_INTEREST_SUBMITTED,
]);

export function classifyFlowOutcome(events = []) {
  const safe = Array.isArray(events) ? events.filter(Boolean) : [];
  if (safe.length < 2) return { outcome: 'idle', confidence: 1 };

  if (safe.some((e) => COMMITTING_ACTIONS.has(e?.type))) {
    return { outcome: 'action', confidence: 0.9 };
  }

  if (safe.some((e) => e?.type === FUNNEL_EVENT_TYPES.STEP_ABANDONED)) {
    return { outcome: 'drop_off', confidence: 0.75 };
  }

  const progressedCategories = new Set(
    safe.map((e) => categorizeDecisionEvent(e?.type)).filter(Boolean),
  );
  if (progressedCategories.size >= 2) {
    return { outcome: 'progressing', confidence: 0.6 };
  }

  return { outcome: 'drop_off', confidence: 0.5 };
}

export default classifyFlowOutcome;
