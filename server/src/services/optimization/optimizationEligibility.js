/**
 * optimizationEligibility.js — "should this context be allowed to
 * influence the output right now?" The answer is always the same
 * kind of check: is the sample size at or above the minimum for
 * this scope + family?
 *
 * Personal scope has LOWER thresholds — a single farmer's
 * behavior only needs a handful of samples to legitimately
 * adjust their own task urgency or wording tier.
 *
 * Regional scope has HIGHER thresholds — moving ranking for
 * everyone in a country/crop combination requires stronger
 * evidence, because one outlier can't distort the view for
 * thousands.
 *
 * Thresholds are configurable via `createEligibilityConfig`
 * because product teams tune these from dashboards; the defaults
 * match the spec.
 */

export const SCOPES = Object.freeze({
  PERSONAL: 'personal',
  REGIONAL: 'regional',
});

export const DEFAULT_PERSONAL_THRESHOLDS = Object.freeze({
  recommendation: 5,   // personal rec acceptance / rejection
  harvest:        3,   // personal harvest outcomes
  task:           5,   // personal task behavior events
  listing:        5,   // personal listing lifecycle
});

export const DEFAULT_REGIONAL_THRESHOLDS = Object.freeze({
  recommendation: 15,  // spec range: 10–20, middle pick
  harvest:        7,   // spec range: 5–10
  task:           10,
  listing:        15,
});

/**
 * createEligibilityConfig — let a caller override any thresholds.
 * Returns a frozen object; anything not provided falls back to
 * the spec defaults.
 */
export function createEligibilityConfig(overrides = {}) {
  const personal = Object.freeze({
    ...DEFAULT_PERSONAL_THRESHOLDS,
    ...(overrides.personal || {}),
  });
  const regional = Object.freeze({
    ...DEFAULT_REGIONAL_THRESHOLDS,
    ...(overrides.regional || {}),
  });
  return Object.freeze({ personal, regional });
}

function counts(bucket) {
  return (bucket && bucket.counts) || {};
}

function familyTotal(c, family) {
  switch (family) {
    case 'recommendation':
      return (c.rec_accepted || 0) + (c.rec_rejected || 0);
    case 'harvest':
      return (c.harvest_good || 0) + (c.harvest_bad || 0);
    case 'task':
      return (c.task_completed || 0) + (c.task_skipped || 0);
    case 'listing':
      return (c.listing_interest || 0)
           + (c.listing_sold || 0)
           + (c.listing_expired_unsold || 0);
    default:
      return 0;
  }
}

/**
 * hasSufficientSignal — single-family gate.
 *
 * @param {object} bucket   signal bucket (from signalExtractors)
 * @param {'recommendation'|'harvest'|'task'|'listing'} family
 * @param {'personal'|'regional'} [scope='regional']
 * @param {ReturnType<typeof createEligibilityConfig>} [config]
 */
export function hasSufficientSignal(bucket, family, scope = SCOPES.REGIONAL, config = createEligibilityConfig()) {
  const min = scope === SCOPES.PERSONAL
    ? (config.personal?.[family] ?? DEFAULT_PERSONAL_THRESHOLDS[family])
    : (config.regional?.[family] ?? DEFAULT_REGIONAL_THRESHOLDS[family]);
  return familyTotal(counts(bucket), family) >= min;
}

/**
 * getOptimizationEligibility — per-family eligibility object for
 * a single context. Callers use this to decide which deltas they
 * can compute AT ALL.
 */
export function getOptimizationEligibility(bucket, scope = SCOPES.REGIONAL, config = createEligibilityConfig()) {
  return Object.freeze({
    scope,
    recommendation: hasSufficientSignal(bucket, 'recommendation', scope, config),
    harvest:        hasSufficientSignal(bucket, 'harvest',        scope, config),
    task:           hasSufficientSignal(bucket, 'task',           scope, config),
    listing:        hasSufficientSignal(bucket, 'listing',        scope, config),
  });
}

/**
 * isLowSignalContext — true when NONE of the families meet
 * their threshold. The UI uses this to pick conservative wording
 * ("Suggested crops" instead of "Best crops").
 */
export function isLowSignalContext(bucketOrEligibility, scope = SCOPES.REGIONAL, config = createEligibilityConfig()) {
  if (bucketOrEligibility && typeof bucketOrEligibility === 'object'
      && ('recommendation' in bucketOrEligibility)) {
    const e = bucketOrEligibility;
    return !(e.recommendation || e.harvest || e.task || e.listing);
  }
  const e = getOptimizationEligibility(bucketOrEligibility, scope, config);
  return !(e.recommendation || e.harvest || e.task || e.listing);
}

/**
 * summarizeEligibility — dashboard-friendly rollup across many
 * contexts. Returns the count of contexts eligible per family
 * plus the count of low-signal contexts.
 */
export function summarizeEligibility(byContext = {}, scope = SCOPES.REGIONAL, config = createEligibilityConfig()) {
  const out = {
    total: 0, lowSignal: 0,
    eligibleByFamily: { recommendation: 0, harvest: 0, task: 0, listing: 0 },
  };
  for (const bucket of Object.values(byContext || {})) {
    out.total += 1;
    const e = getOptimizationEligibility(bucket, scope, config);
    for (const k of Object.keys(out.eligibleByFamily)) if (e[k]) out.eligibleByFamily[k] += 1;
    if (!(e.recommendation || e.harvest || e.task || e.listing)) out.lowSignal += 1;
  }
  return out;
}

export const _internal = {
  DEFAULT_PERSONAL_THRESHOLDS, DEFAULT_REGIONAL_THRESHOLDS,
  familyTotal, counts,
};
