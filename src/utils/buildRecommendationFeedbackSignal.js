/**
 * buildRecommendationFeedbackSignal.js — compresses a user's
 * crop-cycle journey into one rule-based feedback signal that
 * can bias future recommendations. This is the "learning loop"
 * without any ML:
 *
 *   INPUT:  crop, location, events-on-that-cycle, harvestOutcome
 *   OUTPUT: {
 *     crop, country, stateCode, cycleId,
 *     accepted, rejected, switched,
 *     taskCompletionRate, issueCount, outcomeClass,
 *     weight:    number 0..1   ← how strongly this should move the rec
 *     direction: 'positive' | 'negative' | 'neutral',
 *     reasons:   string[],
 *   }
 *
 * applyOutcomeSignalToRecommendationHistory merges a batch of these
 * signals into an in-memory history object so the recommendation
 * engine can bump or suppress specific (country, crop) pairs.
 *
 * Deliberately explainable. Every adjustment has a `reasons[]`
 * entry you could surface in a dashboard.
 */

import { DECISION_EVENT_TYPES } from './decisionEventTypes.js';
import { buildCropCycleSnapshot } from './buildUserJourneySnapshot.js';

export function buildRecommendationFeedbackSignal({
  crop,
  country,
  stateCode = null,
  cycleId = null,
  events = [],
  harvestOutcome = null, // 'good' | 'bad' | 'mixed'
  now = Date.now(),
} = {}) {
  const snap = buildCropCycleSnapshot(events, { crop, country, stateCode });
  const reasons = [];

  let weight = 0;
  let direction = 'neutral';

  // Acceptance side — lightly positive
  if (snap.accepted) { weight += 0.1; reasons.push('rec_accepted'); }
  if (snap.rejected) { weight += 0.15; direction = 'negative'; reasons.push('rec_rejected'); }
  if (snap.switched) { weight += 0.15; direction = 'negative'; reasons.push('rec_switched'); }

  // Task engagement — a cycle where the farmer actually did the tasks
  // is a stronger data point than one where they ignored everything.
  if (Number.isFinite(snap.taskCompletionRate)) {
    if (snap.taskCompletionRate >= 0.7) {
      weight += 0.25; reasons.push('high_task_engagement');
    } else if (snap.taskCompletionRate >= 0.3) {
      weight += 0.1; reasons.push('medium_task_engagement');
    } else {
      weight += 0.05; reasons.push('low_task_engagement');
    }
  }

  // Issue pressure
  const issueCount = Array.isArray(snap.issuesReported) ? snap.issuesReported.length : 0;
  if (issueCount >= 3)      { weight += 0.15; reasons.push('many_issues'); direction = 'negative'; }
  else if (issueCount >= 1) { weight += 0.05; reasons.push('some_issues'); }

  // Outcome is the most important signal — overrides direction.
  const outcome = normalizeOutcome(harvestOutcome ?? snap.outcomeClass);
  if (outcome === 'good') {
    direction = 'positive';
    weight   += 0.4;
    reasons.push('harvest_good');
  } else if (outcome === 'bad') {
    direction = 'negative';
    weight   += 0.4;
    reasons.push('harvest_bad');
  } else if (outcome === 'mixed') {
    weight += 0.15;
    reasons.push('harvest_mixed');
  }

  // Non-harvest cycles can still flip direction via rejection/switch
  if (direction === 'neutral' && (snap.rejected || snap.switched)) {
    direction = 'negative';
  }

  weight = Math.max(0, Math.min(1, Number(weight.toFixed(3))));

  return {
    crop: crop || null,
    country: country || null,
    stateCode,
    cycleId,
    accepted: !!snap.accepted,
    rejected: !!snap.rejected,
    switched: !!snap.switched,
    taskCompletionRate: snap.taskCompletionRate,
    issueCount,
    outcomeClass: outcome,
    weight,
    direction,
    reasons,
    generatedAt: now,
  };
}

/**
 * applyOutcomeSignalToRecommendationHistory — immutable merge.
 * `history` looks like:
 *   {
 *     "GH:maize": { score: +0.2, n: 3, reasons: [...] },
 *     ...
 *   }
 * The key is `${country}:${crop}`. Score moves toward ±1 asymptotically.
 */
export function applyOutcomeSignalToRecommendationHistory(history = {}, signal) {
  if (!signal || !signal.crop || !signal.country) return history;
  const key = `${signal.country}:${signal.crop}`.toLowerCase();
  const prev = history[key] || { score: 0, n: 0, reasons: [] };
  const deltaSign = signal.direction === 'positive' ? 1
                  : signal.direction === 'negative' ? -1
                  : 0;
  // Weighted running mean: keeps things explainable and bounded in [-1, 1].
  const sumScore = prev.score * prev.n + deltaSign * signal.weight;
  const n = prev.n + 1;
  const score = Math.max(-1, Math.min(1, +(sumScore / n).toFixed(4)));
  const reasons = [
    ...prev.reasons.slice(-9),          // keep at most last 10 samples' reasons
    { at: signal.generatedAt, direction: signal.direction, weight: signal.weight, tags: signal.reasons },
  ];
  return { ...history, [key]: { score, n, reasons } };
}

/**
 * Rule-based acceptance-rate helper. Given a flat list of
 * "recommendation_viewed" / "recommendation_selected" /
 * "recommendation_rejected" events across many cycles, return:
 *   { viewed, selected, rejected, acceptanceRate, rejectionRate }
 */
export function getRecommendationAcceptanceRate(events = []) {
  const viewed   = events.filter((e) => e?.type === DECISION_EVENT_TYPES.RECOMMENDATION_VIEWED).length;
  const selected = events.filter((e) => e?.type === DECISION_EVENT_TYPES.RECOMMENDATION_SELECTED).length;
  const rejected = events.filter((e) => e?.type === DECISION_EVENT_TYPES.RECOMMENDATION_REJECTED).length;
  return {
    viewed, selected, rejected,
    acceptanceRate: viewed > 0 ? +(selected / viewed).toFixed(3) : null,
    rejectionRate:  viewed > 0 ? +(rejected / viewed).toFixed(3) : null,
  };
}

/**
 * getCropSwitchRateAfterRecommendation — how often users swapped
 * the recommended crop for a different one. Useful to identify
 * shortlists that don't match real preference.
 */
export function getCropSwitchRateAfterRecommendation(events = []) {
  const selected = events.filter((e) => e?.type === DECISION_EVENT_TYPES.RECOMMENDATION_SELECTED).length;
  const switched = events.filter((e) => e?.type === DECISION_EVENT_TYPES.CROP_CHANGED_AFTER_RECOMMENDATION).length;
  return {
    selected, switched,
    switchRate: selected > 0 ? +(switched / selected).toFixed(3) : null,
  };
}

function normalizeOutcome(v) {
  const s = String(v || '').toLowerCase();
  if (s.startsWith('good'))  return 'good';
  if (s.startsWith('bad'))   return 'bad';
  if (s.startsWith('mixed')) return 'mixed';
  return null;
}
