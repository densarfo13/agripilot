/**
 * flowOutcomeClassifier.js — one label per user session that
 * answers the product question "what did this person do?".
 *
 * Labels (mutually exclusive, most-specific wins):
 *
 *   'action'        — user reached a committing action
 *                     (task_completed / harvest_submitted /
 *                     interest_accepted / listing_created)
 *   'hesitation'    — user took a committing action but only
 *                     after detectable hesitation
 *   'confused'      — multiple retries, crop switches, rejections,
 *                     or trust breaks without a completing action
 *   'drop_off'      — user abandoned a step without completing it
 *                     and no committing action
 *   'idle'          — empty or near-empty event stream
 *
 * The classifier is deterministic and only reads derived signals
 * from hesitationDetector + trustBreakDetector + the raw decision
 * events. It never reads PII.
 */

import { DECISION_EVENT_TYPES, FUNNEL_EVENT_TYPES } from './decisionEventTypes.js';
import { detectHesitation } from './hesitationDetector.js';
import { detectTrustBreaks } from './trustBreakDetector.js';

const COMMITTING_ACTIONS = new Set([
  DECISION_EVENT_TYPES.TASK_COMPLETED,
  DECISION_EVENT_TYPES.HARVEST_SUBMITTED,
  DECISION_EVENT_TYPES.INTEREST_ACCEPTED,
  DECISION_EVENT_TYPES.LISTING_CREATED_FROM_HARVEST,
  DECISION_EVENT_TYPES.BUYER_INTEREST_SUBMITTED,
]);

const IDLE_THRESHOLD = 2;

function count(events, type) { return events.filter((e) => e?.type === type).length; }

export function classifyFlowOutcome(events = [], opts = {}) {
  const safe = Array.isArray(events) ? events.filter(Boolean) : [];
  if (safe.length < IDLE_THRESHOLD) {
    return { outcome: 'idle', confidence: 1, reasons: ['empty_event_stream'] };
  }

  const hes = detectHesitation(safe, opts);
  const tb  = detectTrustBreaks(safe, opts);

  const committed = safe.some((e) => COMMITTING_ACTIONS.has(e?.type));
  const abandoned = safe.some((e) => e?.type === FUNNEL_EVENT_TYPES.STEP_ABANDONED);

  const rejected = count(safe, DECISION_EVENT_TYPES.RECOMMENDATION_REJECTED);
  const switched = count(safe, DECISION_EVENT_TYPES.CROP_CHANGED_AFTER_RECOMMENDATION);
  const retries  = count(safe, DECISION_EVENT_TYPES.LOCATION_RETRY_CLICKED);
  const trustBreakCount = tb.count;

  const reasons = [];

  // Most-specific first.
  if (committed) {
    if (hes.hesitated) {
      reasons.push('committed_after_hesitation');
      reasons.push(...hes.reasons.slice(0, 3).map((r) => `${r.kind}:${r.stage}`));
      return { outcome: 'hesitation', confidence: 0.8, reasons, hesitation: hes, trustBreaks: tb };
    }
    reasons.push('committed_directly');
    return { outcome: 'action', confidence: 0.95, reasons, hesitation: hes, trustBreaks: tb };
  }

  // No commit — now classify *why*.
  const confusionSignals = rejected + switched + retries + trustBreakCount;
  if (confusionSignals >= 2) {
    if (rejected > 0)        reasons.push('rec_rejected');
    if (switched > 0)        reasons.push('crop_switched');
    if (retries >= 2)        reasons.push('multiple_retries');
    if (trustBreakCount > 0) reasons.push(`trust_breaks:${trustBreakCount}`);
    return { outcome: 'confused', confidence: 0.75, reasons, hesitation: hes, trustBreaks: tb };
  }

  if (abandoned) {
    reasons.push('explicit_abandonment');
    return { outcome: 'drop_off', confidence: 0.8, reasons, hesitation: hes, trustBreaks: tb };
  }

  // Entered something but didn't finish and didn't explicitly abandon.
  reasons.push('entered_without_completion');
  return { outcome: 'drop_off', confidence: 0.55, reasons, hesitation: hes, trustBreaks: tb };
}

/**
 * aggregateFlowOutcomes — rollup across users.
 *
 *   {
 *     totalUsers,
 *     byOutcome: { action, hesitation, confused, drop_off, idle },
 *     rates:     { actionRate, hesitationRate, confusedRate, dropOffRate },
 *   }
 */
export function aggregateFlowOutcomes(users = []) {
  const by = { action: 0, hesitation: 0, confused: 0, drop_off: 0, idle: 0 };
  let total = 0;
  if (!Array.isArray(users)) return { totalUsers: 0, byOutcome: by, rates: emptyRates() };
  for (const u of users) {
    total += 1;
    const res = classifyFlowOutcome(u?.events || []);
    by[res.outcome] = (by[res.outcome] || 0) + 1;
  }
  const safeRate = (n) => total > 0 ? +(n / total).toFixed(3) : null;
  return {
    totalUsers: total,
    byOutcome: by,
    rates: {
      actionRate:     safeRate(by.action + by.hesitation),
      hesitationRate: safeRate(by.hesitation),
      confusedRate:   safeRate(by.confused),
      dropOffRate:    safeRate(by.drop_off),
    },
  };
}

function emptyRates() {
  return { actionRate: null, hesitationRate: null, confusedRate: null, dropOffRate: null };
}

export const _internal = { COMMITTING_ACTIONS };
