/**
 * journeyHealthService.js — synthesizes the three health scores
 * the product team reasons about:
 *
 *   • frictionScore   — how hard is the app right now?
 *   • trustScore      — how much faith is the user putting in us?
 *   • hesitationScore — are they deciding, or stalling?
 *
 * Each ∈ [0, 1]. Built on the existing detectors from the
 * analytics layer so this service is the single public entry
 * point — no one else needs to know which sub-detector fired.
 *
 * Together they form a JourneyHealthSnapshot:
 *   {
 *     frictionScore, trustScore, hesitationScore,
 *     topDrivers:      string[],
 *     riskLevel:       'low' | 'elevated' | 'high',
 *     suggestedFocus:  'stability' | 'trust_recovery' |
 *                      'reduce_friction' | 'hold_steady',
 *     sources:         { friction, trust, hesitation }, // raw detector output
 *     createdAt:       number,
 *   }
 */

import { detectHesitation, _internal as hesInternal } from '../analytics/hesitationDetector.js';
import {
  detectTrustBreaks,
  TRUST_BREAK_PATTERNS,
} from '../analytics/trustBreakDetector.js';
import { DECISION_EVENT_TYPES } from '../analytics/decisionEventTypes.js';

// Weights used to combine detector outputs into the three scores.
// Kept in one place so the team can tune without hunting through
// the code. Every weight is bounded so scores stay in [0, 1].
const FRICTION_WEIGHTS = Object.freeze({
  longDwell:         0.20,
  multiRetry:        0.25,
  backNav:           0.20,
  repeatSkip:        0.30,
  anyTrustBreak:     0.30,
});

const TRUST_PATTERN_IMPACT = Object.freeze({
  [TRUST_BREAK_PATTERNS.LOW_CONF_ABANDONED]:         0.15,
  [TRUST_BREAK_PATTERNS.DETECT_OVERRIDDEN_BY_MANUAL]: 0.30,
  [TRUST_BREAK_PATTERNS.PERMISSION_DENIED_EXIT]:     0.25,
  [TRUST_BREAK_PATTERNS.HIGH_CONF_REC_REJECTED]:     0.35,
  [TRUST_BREAK_PATTERNS.ISSUE_AFTER_TASK_COMPLETED]: 0.40,
  [TRUST_BREAK_PATTERNS.REPEAT_SKIP_THEN_ABANDONED]: 0.25,
});

const HESITATION_WEIGHTS = Object.freeze({
  longDwell:  0.40,
  backNav:    0.30,
  multiRetry: 0.30,
});

/**
 * buildHesitationScore — pure derivation from hesitationDetector.
 * Returns { score, drivers, sources }.
 */
export function buildHesitationScore(events = [], opts = {}) {
  const info = detectHesitation(events, opts);
  const weights = HESITATION_WEIGHTS;

  let score = 0;
  const drivers = [];
  const seenKinds = new Set();

  for (const r of info.reasons || []) {
    if (seenKinds.has(r.kind)) continue;   // cap each kind's contribution
    seenKinds.add(r.kind);
    if (r.kind === 'long_dwell')   { score += weights.longDwell;  drivers.push('long_dwell'); }
    if (r.kind === 'back_nav')     { score += weights.backNav;    drivers.push('back_nav'); }
    if (r.kind === 'multi_retry')  { score += weights.multiRetry; drivers.push('multi_retry'); }
  }

  return {
    score: clamp01(score),
    drivers,
    sources: info,
  };
}

/**
 * buildTrustScore — high = trusting, low = trust broken.
 * Starts from 1.0 and subtracts per-pattern impact. Returns
 * `drivers` as the list of broken patterns.
 */
export function buildTrustScore(events = [], opts = {}) {
  const info = detectTrustBreaks(events, opts);
  let score = 1.0;
  const drivers = [];
  for (const b of info.breaks || []) {
    const impact = TRUST_PATTERN_IMPACT[b.type] ?? 0.10;
    score -= impact;
    drivers.push(b.type);
  }
  return {
    score: clamp01(score),
    drivers,
    sources: info,
  };
}

/**
 * buildUserFrictionScore — combines hesitation + trust breaks
 * + task friction into a single "how hard is the app right now"
 * metric.
 */
export function buildUserFrictionScore(events = [], opts = {}) {
  const hes = buildHesitationScore(events, opts);
  const tb  = detectTrustBreaks(events, opts);
  const w = FRICTION_WEIGHTS;
  const drivers = [];
  let score = 0;

  // Map hesitation kinds into friction buckets. Each kind
  // contributes at most once so stacking multiple hesitation
  // reasons on the same kind doesn't over-count.
  const hesKinds = new Set((hes.sources.reasons || []).map((r) => r.kind));
  if (hesKinds.has('long_dwell'))  { score += w.longDwell;   drivers.push('long_dwell'); }
  if (hesKinds.has('multi_retry')) { score += w.multiRetry;  drivers.push('location_retry'); }
  if (hesKinds.has('back_nav'))    { score += w.backNav;     drivers.push('back_nav'); }
  if (hesKinds.has('repeat_skip')) { score += w.repeatSkip;  drivers.push('task_repeat_skip'); }
  if (tb.count > 0)                { score += w.anyTrustBreak; drivers.push(...tb.breaks.map((b) => b.type)); }

  // Issue reports that happened after a task completion are
  // high-friction regardless of whether the trust-break detector
  // saw them (for example: issue on a different task but same day).
  const issueAfterTask = (events || []).some(
    (e) => e?.type === DECISION_EVENT_TYPES.ISSUE_REPORTED,
  );
  if (issueAfterTask) {
    score += 0.05;
    drivers.push('issue_reported');
  }

  return {
    score: clamp01(score),
    drivers: uniq(drivers),
    sources: { hesitation: hes.sources, trustBreaks: tb },
  };
}

/**
 * buildJourneyHealthSnapshot — one-call entry. Returns all three
 * scores plus a suggested focus area and a short list of top
 * drivers across all three.
 */
export function buildJourneyHealthSnapshot(events = [], opts = {}) {
  const friction = buildUserFrictionScore(events, opts);
  const trust    = buildTrustScore(events, opts);
  const hes      = buildHesitationScore(events, opts);

  // A top-driver list is the union, ordered by how much each one
  // cost across the three scores. For simplicity we use the
  // friction driver list as the spine and append trust drivers
  // that don't overlap.
  const topDrivers = uniq([
    ...friction.drivers,
    ...trust.drivers,
    ...hes.drivers,
  ]).slice(0, 5);

  const riskLevel = classifyRisk(friction.score, trust.score, hes.score);
  const suggestedFocus = suggestFocus(friction.score, trust.score, hes.score);

  return {
    frictionScore:   friction.score,
    trustScore:      trust.score,
    hesitationScore: hes.score,
    topDrivers,
    riskLevel,
    suggestedFocus,
    sources: {
      friction: friction.sources,
      trust:    trust.sources,
      hesitation: hes.sources,
    },
    createdAt: Date.now(),
  };
}

// ─── internals ─────────────────────────────────────────────
function clamp01(v) { return Math.max(0, Math.min(1, Number(v) || 0)); }

function uniq(arr) {
  const seen = new Set();
  const out = [];
  for (const x of arr || []) {
    if (x == null) continue;
    const s = String(x);
    if (seen.has(s)) continue;
    seen.add(s); out.push(s);
  }
  return out;
}

function classifyRisk(friction, trust, hes) {
  if (friction >= 0.6 || trust <= 0.4) return 'high';
  if (friction >= 0.35 || trust <= 0.7 || hes >= 0.5) return 'elevated';
  return 'low';
}

function suggestFocus(friction, trust, hes) {
  if (trust <= 0.5)    return 'trust_recovery';
  if (friction >= 0.5) return 'reduce_friction';
  if (hes >= 0.5)      return 'stability';
  return 'hold_steady';
}

export const _internal = {
  FRICTION_WEIGHTS, TRUST_PATTERN_IMPACT, HESITATION_WEIGHTS,
  classifyRisk, suggestFocus,
};
