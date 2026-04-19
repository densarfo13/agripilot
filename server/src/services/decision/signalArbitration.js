/**
 * signalArbitration.js — when multiple signals disagree about
 * the same decision, which one wins?
 *
 * Priority order — harder, more objective signals at the top.
 * Lower index = higher priority:
 *
 *   0. harvest_outcome          ← ground truth dominates
 *   1. repeated_issue_severity
 *   2. task_behavior_pattern
 *   3. recommendation_acceptance
 *   4. listing_conversion
 *   5. weak_engagement          ← only wins when nothing else speaks
 *
 * Arbitration rules:
 *   • Higher-priority signal wins even if lower-priority has more
 *     samples, UNLESS the higher signal's confidenceScore is very
 *     low (< HIGH_OVERRIDE_MIN) — in which case we fall through
 *     to the next tier.
 *   • Within a tier, the higher confidenceScore wins.
 *   • Direction matters: two signals of the same priority that
 *     AGREE do not conflict — they reinforce.
 *   • All "losing" signals whose direction disagrees with the
 *     winner are recorded as `overriddenSignals[]`.
 *
 * Output shape (ArbitrationResult):
 *   {
 *     contextKey: string,
 *     winningSignal:    string,    // signalType
 *     winningSignals:   string[],  // winner + reinforcers
 *     overriddenSignals: string[],
 *     finalDecisionWeight: number, // [0, 1]
 *     explanation: string,
 *     decisionReason: string,
 *     createdAt: number,
 *   }
 */

import {
  getSignalConfidenceScore,
} from './signalConfidence.js';

export const PRIORITY_ORDER = Object.freeze([
  'harvest_outcome',
  'repeated_issue_severity',
  'task_behavior_pattern',
  'recommendation_acceptance',
  'listing_conversion',
  'weak_engagement',
]);

const HIGH_OVERRIDE_MIN = 0.25;  // confidence floor for a top-priority signal to actually win

/**
 * getDecisionPriority — stable priority number for a signal
 * type. Unknown signal types fall to the "weak engagement" tier.
 */
export function getDecisionPriority(signalType) {
  const idx = PRIORITY_ORDER.indexOf(String(signalType || ''));
  return idx >= 0 ? idx : PRIORITY_ORDER.length;
}

function directionOf(signal) {
  if (!signal) return 0;
  if (typeof signal.direction === 'number') return Math.sign(signal.direction);
  if (signal.direction === 'positive') return +1;
  if (signal.direction === 'negative') return -1;
  return 0;
}

/**
 * resolveSignalConflict — single-context arbitration.
 *
 * @param {Array}  signals       [{ signalType, confidenceScore, direction, sourceCount? }]
 * @param {object} [opts]
 * @param {string} [opts.contextKey]
 */
export function resolveSignalConflict(signals = [], opts = {}) {
  const list = Array.isArray(signals) ? signals.filter(Boolean) : [];
  if (!list.length) {
    return buildArbitrationResult({
      contextKey: opts.contextKey || null,
      winner: null,
      winners: [],
      overridden: [],
      decisionReason: 'no_signals',
      explanation: 'No signals present; no decision.',
      finalDecisionWeight: 0,
    });
  }

  // Sort by (priority asc, confidence desc). Highest priority that
  // clears HIGH_OVERRIDE_MIN wins. Otherwise fall through.
  const sorted = [...list].sort((a, b) => {
    const pa = getDecisionPriority(a.signalType);
    const pb = getDecisionPriority(b.signalType);
    if (pa !== pb) return pa - pb;
    return (Number(b.confidenceScore) || 0) - (Number(a.confidenceScore) || 0);
  });

  const winner = sorted.find((s) => (Number(s.confidenceScore) || 0) >= HIGH_OVERRIDE_MIN) || sorted[0];
  const winnerDir = directionOf(winner);
  const winningSignals = [winner];
  const overridden = [];

  for (const s of sorted) {
    if (s === winner) continue;
    if (directionOf(s) === winnerDir && winnerDir !== 0) {
      winningSignals.push(s);
    } else {
      overridden.push(s);
    }
  }

  const finalDecisionWeight = clamp01(averageConfidence(winningSignals));

  const decisionReason = buildDecisionReason(winner, overridden);
  const explanation = buildExplanation(winner, winningSignals, overridden);

  return buildArbitrationResult({
    contextKey: opts.contextKey || null,
    winner,
    winners: winningSignals,
    overridden,
    decisionReason,
    explanation,
    finalDecisionWeight,
  });
}

/**
 * buildArbitrationResult — structural factory. Exposed so callers
 * can synthesize results by hand (e.g. for mocks / tests).
 */
export function buildArbitrationResult({
  contextKey = null,
  winner = null,
  winners = [],
  overridden = [],
  decisionReason = '',
  explanation = '',
  finalDecisionWeight = 0,
  createdAt = Date.now(),
} = {}) {
  return {
    contextKey,
    winningSignal: winner?.signalType ?? null,
    winningSignals: winners.map((s) => s?.signalType).filter(Boolean),
    overriddenSignals: overridden.map((s) => s?.signalType).filter(Boolean),
    winnerDirection: directionOf(winner),
    finalDecisionWeight: +Number(finalDecisionWeight).toFixed(4),
    explanation,
    decisionReason,
    createdAt,
  };
}

/**
 * scoreAllContexts — given a map of `contextKey → signals[]`,
 * run `resolveSignalConflict` for each context and return an
 * array of ArbitrationResult objects sorted by finalDecisionWeight.
 */
export function scoreAllContexts(signalsByContext = {}, opts = {}) {
  const out = [];
  for (const [contextKey, signals] of Object.entries(signalsByContext || {})) {
    out.push(resolveSignalConflict(signals, { ...opts, contextKey }));
  }
  return out.sort((a, b) => b.finalDecisionWeight - a.finalDecisionWeight);
}

/**
 * scoreSignalWithConfidence — convenience. Takes a signal
 * description that already includes `samples` and returns a
 * signal enriched with `confidenceScore`, ready to feed into
 * resolveSignalConflict.
 */
export function scoreSignalWithConfidence({ signalType, samples, direction, now, halfLifeDays } = {}) {
  const conf = getSignalConfidenceScore({ signalType, samples, now, halfLifeDays });
  return {
    signalType,
    direction: direction ?? 0,
    confidenceScore: conf.confidenceScore,
    sourceCount: conf.sourceCount,
  };
}

// ─── internals ─────────────────────────────────────────────
function clamp01(v) { return Math.max(0, Math.min(1, Number(v) || 0)); }

function averageConfidence(sigs) {
  const vals = (sigs || []).map((s) => Number(s?.confidenceScore) || 0);
  if (!vals.length) return 0;
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}

function buildDecisionReason(winner, overridden) {
  if (!winner) return 'no_winning_signal';
  const winnerType = winner.signalType;
  if (!overridden.length) return `${winnerType}_decided_with_no_conflicts`;
  const topOver = overridden
    .map((o) => o.signalType)
    .filter(Boolean);
  return `${winnerType}_overrides:${topOver.slice(0, 3).join(',')}`;
}

function buildExplanation(winner, winners, overridden) {
  if (!winner) return 'No signals present.';
  const parts = [
    `Winning signal: ${winner.signalType} (confidence=${(winner.confidenceScore ?? 0).toFixed(2)})`,
  ];
  if (winners.length > 1) {
    const agreed = winners.slice(1).map((s) => s.signalType).join(', ');
    parts.push(`Reinforced by: ${agreed}`);
  }
  if (overridden.length) {
    const ov = overridden.map((s) => `${s.signalType}(${(s.confidenceScore ?? 0).toFixed(2)})`).join(', ');
    parts.push(`Overrode: ${ov}`);
  }
  return parts.join('. ');
}

export const _internal = { HIGH_OVERRIDE_MIN, directionOf };
