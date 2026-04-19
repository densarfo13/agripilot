/**
 * signalConfidence.js — "not every signal counts the same".
 *
 * Signal confidence is a function of five factors, each ∈ [0,1]:
 *
 *   1. sampleSize  — saturating curve; diminishing returns
 *                    so 5 samples ≫ 1, but 50 ≉ 500.
 *   2. recency     — exponential decay from the latest sample
 *                    (half-life configurable, default 14d).
 *   3. consistency — |mean(directions)| — how aligned the
 *                    samples are (0 = fully mixed).
 *   4. reliability — per signal type (see SIGNAL_RELIABILITY).
 *   5. type boost  — harvest_outcome outranks behavioral signals
 *                    so even a small harvest set outweighs a
 *                    large acceptance set.
 *
 * Final score is the geometric-mean of the five (so any one
 * being near-zero drags the whole signal down). Bounded in [0, 1].
 */

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_HALF_LIFE_DAYS = 14;

export const SIGNAL_RELIABILITY = Object.freeze({
  // Ground-truth, objective outcomes
  harvest_outcome:           1.00,

  // Specific, user-initiated reports
  issue_report:              0.85,
  repeated_issue_severity:   0.90,

  // Behavioral patterns (multi-sample behavioral evidence)
  task_behavior_pattern:     0.80,
  task_completion:           0.70,
  task_skip:                 0.75,
  task_repeat_skipped:       0.85,

  // Trust & hesitation
  detect_overridden_by_manual: 0.80,
  permission_denied_exit:    0.70,
  high_conf_rec_rejected:    0.75,
  issue_after_task_completed: 0.85,
  location_retry:            0.60,
  step_abandonment:          0.65,

  // Acceptance-only signals (not outcomes)
  recommendation_acceptance: 0.50,
  recommendation_rejection:  0.55,
  crop_switched:             0.60,

  // Listing / marketplace
  listing_conversion:        0.75,
  listing_expired_unsold:    0.65,
  buyer_interest:            0.60,

  // Weak / ambiguous
  weak_engagement:           0.30,
  unknown:                   0.40,
});

export const TYPE_BOOST = Object.freeze({
  harvest_outcome:            1.00,
  repeated_issue_severity:    0.95,
  task_behavior_pattern:      0.90,
  recommendation_acceptance:  0.70,
  listing_conversion:         0.75,
  weak_engagement:            0.40,
});

/**
 * getSignalReliability — per-type reliability factor.
 * Unknown types fall back to `unknown` reliability (0.4).
 */
export function getSignalReliability(signalType) {
  const k = String(signalType || 'unknown');
  return SIGNAL_RELIABILITY[k] ?? SIGNAL_RELIABILITY.unknown;
}

/**
 * getSignalConfidenceScore — core scorer.
 *
 * Input:
 *   {
 *     signalType: string,
 *     samples:    [{ timestamp, direction, weight? }],
 *                 direction ∈ [-1, 1]
 *     now?, halfLifeDays?
 *   }
 *
 * Output: { signalType, confidenceScore, sourceCount,
 *           recencyWeight, consistencyScore, reliability }
 */
export function getSignalConfidenceScore({
  signalType = 'unknown',
  samples = [],
  now = Date.now(),
  halfLifeDays = DEFAULT_HALF_LIFE_DAYS,
} = {}) {
  const safe = Array.isArray(samples) ? samples.filter(Boolean) : [];
  const sourceCount = safe.length;

  if (sourceCount === 0) {
    return {
      signalType,
      confidenceScore: 0,
      sourceCount: 0,
      recencyWeight: 0,
      consistencyScore: 0,
      reliability: getSignalReliability(signalType),
    };
  }

  // Factor 1: sample size — 1 - e^(-n/5). 5 samples = 0.63; 15 = 0.95.
  const sampleSizeFactor = 1 - Math.exp(-sourceCount / 5);

  // Factor 2: recency — half-life decay from the most recent sample.
  const mostRecentTs = Math.max(...safe.map((s) => Number(s.timestamp) || 0));
  const ageDays = Math.max(0, (now - mostRecentTs) / ONE_DAY_MS);
  const recencyWeight = Math.pow(0.5, ageDays / halfLifeDays);

  // Factor 3: consistency — |weighted mean of directions|.
  let sumDir = 0, sumW = 0;
  for (const s of safe) {
    const dir = clamp(-1, 1, Number(s.direction ?? 0));
    const w   = Number(s.weight ?? 1);
    sumDir += dir * w;
    sumW   += Math.abs(w) || 1;
  }
  const meanDir = sumW > 0 ? sumDir / sumW : 0;
  const consistencyScore = Math.min(1, Math.abs(meanDir));

  // Factor 4: reliability — per-type constant.
  const reliability = getSignalReliability(signalType);

  // Factor 5: type boost — multiplicative nudge by signal family.
  const typeBoost = TYPE_BOOST[signalType] ?? 0.6;

  // Combine — geometric mean of the structural factors, then GATE by
  // recency. Recency as a multiplier (rather than just another factor
  // in the mean) ensures old signals decay aggressively regardless of
  // how strong the other factors are. "Old outlier behavior must not
  // dominate current recommendations."
  const geomFactors = [sampleSizeFactor, consistencyScore, reliability, typeBoost]
    .map((v) => Math.max(0.0001, v));
  const logSum = geomFactors.reduce((s, v) => s + Math.log(v), 0);
  const baseScore = Math.exp(logSum / geomFactors.length);
  const confidenceScore = clamp(0, 1, baseScore * recencyWeight);

  return {
    signalType,
    confidenceScore: +confidenceScore.toFixed(4),
    sourceCount,
    recencyWeight: +recencyWeight.toFixed(4),
    consistencyScore: +consistencyScore.toFixed(4),
    reliability,
  };
}

/**
 * buildSignalConfidenceSummary — run getSignalConfidenceScore
 * over many signals and return a sorted summary plus aggregates.
 *
 * Input: { signals: { [signalType]: samples[] }, now?, halfLifeDays? }
 */
export function buildSignalConfidenceSummary({ signals = {}, now, halfLifeDays } = {}) {
  const rows = [];
  for (const [signalType, samples] of Object.entries(signals)) {
    rows.push(getSignalConfidenceScore({ signalType, samples, now, halfLifeDays }));
  }
  rows.sort((a, b) => b.confidenceScore - a.confidenceScore);
  const total = rows.reduce((s, r) => s + r.confidenceScore, 0);
  return {
    rows,
    strongest: rows[0] || null,
    weakest:   rows[rows.length - 1] || null,
    aggregateScore: rows.length ? +(total / rows.length).toFixed(4) : 0,
  };
}

function clamp(min, max, v) { return Math.max(min, Math.min(max, v)); }

export const _internal = { ONE_DAY_MS, DEFAULT_HALF_LIFE_DAYS };
