/**
 * negativeSignalInterpreter.js — "is this negative signal strong
 * enough to justify a downgrade, or is it just noise?"
 *
 * Rejection alone is NEVER enough. A farmer might reject a
 * crop because they:
 *   • didn't recognize the name (localization lag)
 *   • misread the recommendation as a command
 *   • disagreed with the TIMING, not the crop
 *   • already know this crop doesn't fit — a real miss
 *
 * Only the last one should actually move the ranking. We
 * distinguish by requiring combined evidence before any
 * negative adjustment fires.
 *
 * Strength tiers:
 *   'none'     — zero or trivial negative signal
 *   'weak'     — ONE pattern present (never triggers downgrade)
 *   'moderate' — TWO patterns present (allow small downgrade)
 *   'strong'   — THREE+ patterns present (full downgrade allowed)
 *
 * Patterns checked:
 *   • rejection_pattern        — 3+ rec_rejected on same context
 *   • repeated_skip            — 2+ task_repeat_skipped
 *   • harvest_bad              — 2+ bad harvest outcomes
 *   • listing_expiry_pattern   — 5+ listing_expired_unsold
 *   • low_completion           — task_completion_ratio <= 0.3
 */

const DEFAULT_MIN_STRENGTH_FOR_DOWNGRADE = 'moderate';

const STRENGTH_RANK = Object.freeze({
  none: 0, weak: 1, moderate: 2, strong: 3,
});

/**
 * interpretNegativeSignals — return which patterns are active
 * and the overall strength of the combined evidence.
 */
export function interpretNegativeSignals(counts = {}, opts = {}) {
  const patterns = [];

  const rejections = Number(counts.rec_rejected || 0);
  if (rejections >= 3) patterns.push({
    id: 'rejection_pattern',
    detail: `${rejections} rejections`,
  });

  const repeatSkips = Number(counts.task_repeat_skipped || 0);
  if (repeatSkips >= 2) patterns.push({
    id: 'repeated_skip',
    detail: `${repeatSkips} repeat-skipped tasks`,
  });

  const badHarvests = Number(counts.harvest_bad || 0);
  if (badHarvests >= 2) patterns.push({
    id: 'harvest_bad',
    detail: `${badHarvests} bad harvests`,
  });

  const expired = Number(counts.listing_expired_unsold || 0);
  if (expired >= 5) patterns.push({
    id: 'listing_expiry_pattern',
    detail: `${expired} expired listings`,
  });

  const completed = Number(counts.task_completed || 0);
  const skipped   = Number(counts.task_skipped || 0);
  const total     = completed + skipped;
  if (total >= 8 && completed / total <= 0.3) {
    patterns.push({
      id: 'low_completion',
      detail: `${Math.round((completed / total) * 100)}% completion`,
    });
  }

  const strength = patterns.length === 0 ? 'none'
                 : patterns.length === 1 ? 'weak'
                 : patterns.length === 2 ? 'moderate'
                 : 'strong';

  return Object.freeze({
    patterns,
    patternIds: patterns.map((p) => p.id),
    strength,
    rank: STRENGTH_RANK[strength],
  });
}

/**
 * getNegativeAdjustmentEligibility — turns the interpretation
 * into a boolean gate + a safe multiplier the engine can apply
 * to its raw delta.
 *
 * Multiplier ranges:
 *   none:     0.0   (kills any negative delta)
 *   weak:     0.0   (kills any negative delta)
 *   moderate: 0.5   (half-force downgrade)
 *   strong:   1.0   (full force)
 */
export function getNegativeAdjustmentEligibility(counts = {}, opts = {}) {
  const interp = interpretNegativeSignals(counts, opts);
  const minStrength = opts.minStrength || DEFAULT_MIN_STRENGTH_FOR_DOWNGRADE;
  const threshold = STRENGTH_RANK[minStrength] ?? STRENGTH_RANK.moderate;
  const multiplier = interp.strength === 'strong'   ? 1.0
                    : interp.strength === 'moderate' ? 0.5
                    : 0.0;
  return Object.freeze({
    ...interp,
    eligible: interp.rank >= threshold,
    allowNegativeDelta: interp.rank >= threshold,
    multiplier,
    minStrengthRequired: minStrength,
  });
}

/**
 * applyNegativeEligibilityToDelta — if the raw delta is
 * negative, scale it by the eligibility multiplier. Positive
 * deltas pass through unchanged (this file does NOT gate
 * positive signals).
 */
export function applyNegativeEligibilityToDelta(rawDelta, eligibility) {
  const delta = Number(rawDelta);
  if (!Number.isFinite(delta)) return 0;
  if (delta >= 0) return delta;
  const mult = Number(eligibility?.multiplier ?? 0);
  return +(delta * mult).toFixed(4);
}

export const _internal = {
  STRENGTH_RANK,
  DEFAULT_MIN_STRENGTH_FOR_DOWNGRADE,
};
