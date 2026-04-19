/**
 * recommendationFeedbackService.js — server-side twin of
 * src/utils/buildRecommendationFeedbackSignal.js. The client
 * helper exists because some feedback signals are computed on
 * the device before upload (dev-panel / offline). The server
 * version is the *authoritative* one — it runs every time an
 * analytics batch lands, walks each crop cycle, and moves the
 * recommendation history bias.
 *
 * Rule-based, bounded, explainable:
 *
 *   • every (country, crop) pair has a score in [-1, 1]
 *   • each new cycle moves the score using a running mean
 *     weighted by how strong the signal was
 *   • the explanation trail is persistable — we keep the last
 *     10 reasons per pair so a dashboard can show WHY a crop
 *     got downranked
 *
 * `buildRecommendationFeedbackSignal` matches the client shape
 * exactly — tests assert this to prevent drift.
 */

import {
  DECISION_EVENT_TYPES,
} from '../analytics/decisionEventTypes.js';

const MAX_REASONS_PER_PAIR = 10;

function byType(events, type)  { return events.filter((e) => e?.type === type); }
function firstOf(events, type) { return byType(events, type)[0] || null; }

function cycleSnapshot(events, opts) {
  const recPick    = firstOf(events, DECISION_EVENT_TYPES.RECOMMENDATION_SELECTED);
  const recReject  = firstOf(events, DECISION_EVENT_TYPES.RECOMMENDATION_REJECTED);
  const switched   = firstOf(events, DECISION_EVENT_TYPES.CROP_CHANGED_AFTER_RECOMMENDATION);
  const taskViews  = byType(events, DECISION_EVENT_TYPES.TODAY_PRIMARY_TASK_VIEWED).length;
  const taskDone   = byType(events, DECISION_EVENT_TYPES.TASK_COMPLETED).length;
  const issues     = byType(events, DECISION_EVENT_TYPES.ISSUE_REPORTED).map((e) => e.meta?.type).filter(Boolean);
  const harvest    = firstOf(events, DECISION_EVENT_TYPES.HARVEST_SUBMITTED);

  return {
    crop: opts.crop ?? recPick?.meta?.crop ?? null,
    country: opts.country ?? null,
    stateCode: opts.stateCode ?? null,
    accepted: !!recPick,
    rejected: !!recReject,
    switched: !!switched,
    taskCompletionRate: taskViews > 0 ? +(taskDone / taskViews).toFixed(3) : null,
    issueCount: issues.length,
    outcomeClass: normalizeOutcome(harvest?.meta?.outcomeClass ?? harvest?.meta?.outcome),
  };
}

export function buildRecommendationFeedbackSignal({
  crop,
  country,
  stateCode = null,
  cycleId = null,
  events = [],
  harvestOutcome = null,
  now = Date.now(),
} = {}) {
  const snap = cycleSnapshot(events, { crop, country, stateCode });
  const reasons = [];
  let weight = 0;
  let direction = 'neutral';

  if (snap.accepted) { weight += 0.1;  reasons.push('rec_accepted'); }
  if (snap.rejected) { weight += 0.15; direction = 'negative'; reasons.push('rec_rejected'); }
  if (snap.switched) { weight += 0.15; direction = 'negative'; reasons.push('rec_switched'); }

  if (Number.isFinite(snap.taskCompletionRate)) {
    if (snap.taskCompletionRate >= 0.7) { weight += 0.25; reasons.push('high_task_engagement'); }
    else if (snap.taskCompletionRate >= 0.3) { weight += 0.1; reasons.push('medium_task_engagement'); }
    else { weight += 0.05; reasons.push('low_task_engagement'); }
  }

  if (snap.issueCount >= 3)      { weight += 0.15; direction = 'negative'; reasons.push('many_issues'); }
  else if (snap.issueCount >= 1) { weight += 0.05; reasons.push('some_issues'); }

  const outcome = normalizeOutcome(harvestOutcome ?? snap.outcomeClass);
  if (outcome === 'good')  { direction = 'positive'; weight += 0.4; reasons.push('harvest_good'); }
  else if (outcome === 'bad') { direction = 'negative'; weight += 0.4; reasons.push('harvest_bad'); }
  else if (outcome === 'mixed') { weight += 0.15; reasons.push('harvest_mixed'); }

  if (direction === 'neutral' && (snap.rejected || snap.switched)) {
    direction = 'negative';
  }

  weight = Math.max(0, Math.min(1, Number(weight.toFixed(3))));

  return {
    crop: crop || null,
    country: country || null,
    stateCode,
    cycleId,
    accepted: snap.accepted,
    rejected: snap.rejected,
    switched: snap.switched,
    taskCompletionRate: snap.taskCompletionRate,
    issueCount: snap.issueCount,
    outcomeClass: outcome,
    weight,
    direction,
    reasons,
    generatedAt: now,
  };
}

/**
 * applyOutcomeSignalToRecommendationHistory — immutable merge
 * that updates the running per-pair score. `history` shape:
 *   {
 *     "GH:maize": { score: -0.2, n: 3, reasons: [{at,tags,...},...] },
 *     ...
 *   }
 */
export function applyOutcomeSignalToRecommendationHistory(history = {}, signal) {
  if (!signal || !signal.crop || !signal.country) return history;
  const key = `${signal.country}:${signal.crop}`.toLowerCase();
  const prev = history[key] || { score: 0, n: 0, reasons: [] };
  const deltaSign = signal.direction === 'positive' ? 1
                  : signal.direction === 'negative' ? -1
                  : 0;
  const sumScore = prev.score * prev.n + deltaSign * signal.weight;
  const n = prev.n + 1;
  const score = Math.max(-1, Math.min(1, +(sumScore / n).toFixed(4)));
  const reasons = [
    ...prev.reasons.slice(-(MAX_REASONS_PER_PAIR - 1)),
    { at: signal.generatedAt, direction: signal.direction, weight: signal.weight, tags: signal.reasons },
  ];
  return { ...history, [key]: { score, n, reasons } };
}

/**
 * applyManyOutcomeSignals — batch apply. Returns the merged history.
 */
export function applyManyOutcomeSignals(history = {}, signals = []) {
  let next = history;
  for (const s of Array.isArray(signals) ? signals : []) {
    next = applyOutcomeSignalToRecommendationHistory(next, s);
  }
  return next;
}

/**
 * getRecommendationAcceptanceRate — ratios across a stream.
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

export function getCropSwitchRateAfterRecommendation(events = []) {
  const selected = events.filter((e) => e?.type === DECISION_EVENT_TYPES.RECOMMENDATION_SELECTED).length;
  const switched = events.filter((e) => e?.type === DECISION_EVENT_TYPES.CROP_CHANGED_AFTER_RECOMMENDATION).length;
  return {
    selected, switched,
    switchRate: selected > 0 ? +(switched / selected).toFixed(3) : null,
  };
}

/**
 * biasRecommendationScores — given a base score map
 *   { [crop]: score } for a country/region, apply the feedback
 *   history to nudge individual crops. Each crop's score is
 *   multiplied by (1 + 0.3 * history.score) and clamped back
 *   into [0, 1]. The multiplier is small so the engine stays
 *   stable even when a few users have strong opinions.
 */
export function biasRecommendationScores(baseScores = {}, history = {}, { country = null, influence = 0.3 } = {}) {
  if (!baseScores || typeof baseScores !== 'object') return {};
  const out = {};
  for (const [crop, score] of Object.entries(baseScores)) {
    const key = `${country || ''}:${crop}`.toLowerCase();
    const bias = history[key]?.score ?? 0;
    const next = Number(score) * (1 + influence * bias);
    out[crop] = Math.max(0, Math.min(1, +next.toFixed(4)));
  }
  return out;
}

function normalizeOutcome(v) {
  const s = String(v || '').toLowerCase();
  if (!s) return null;
  if (s.startsWith('good'))  return 'good';
  if (s.startsWith('bad'))   return 'bad';
  if (s.startsWith('mixed')) return 'mixed';
  return null;
}

export const _internal = { MAX_REASONS_PER_PAIR, normalizeOutcome, cycleSnapshot };
