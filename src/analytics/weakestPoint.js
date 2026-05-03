/**
 * weakestPoint.js — identifies the lowest-performing metric in
 * the funnel and emits the spec's matching remediation playbook.
 *
 *   findWeakestPoint({ analytics?, minSample? }) → {
 *     category:        'onboarding'|'activation'|'retention'|'viral',
 *     metric:          string,                       // e.g. 'onboardingCompletion'
 *     rate:            number,                       // 0..1
 *     recommendation:  { titleKey, titleFallback,
 *                        bodyKey,  bodyFallback },
 *     details:         { stage1Count, stage2Count }, // for tooltip
 *   } | null
 *
 * Returns `null` when the sample is too small to draw a
 * meaningful conclusion (default: < 5 events at the entry of
 * the lowest stage). Surfaces honest "insufficient data" rather
 * than recommending a fix on noise.
 *
 * Spec mapping (Data-Driven Product Decisions §3)
 *   onboarding low (rate ≤ 0.5)  → "Reduce friction"
 *   activation low (rate ≤ 0.5)  → "Improve action clarity"
 *   retention low (rate ≤ 0.2)   → "Improve habit loop"
 *   viral low      (rate ≤ 0.05) → "Improve share triggers"
 *
 * Strict-rule audit
 *   • Pure + sync; reads only from buildGrowthAnalytics() output
 *     (or a caller-supplied snapshot for tests).
 *   • Never throws — bad/missing fields collapse to null.
 *   • Honest: returns null when sample is insufficient; no
 *     fabricated rates from divide-by-zero.
 *   • Idempotent: identical input → identical output.
 */

import { buildGrowthAnalytics } from './growthAnalytics.js';

// Spec-aligned thresholds. A metric flagged as "weakest" means
// the team should focus this week. Values picked to match the
// spec's natural "low" framing (~50% drop on early funnel,
// ~20% on retention, ~5% on viral). Tunable in one place.
const THRESHOLDS = Object.freeze({
  onboarding: 0.5,
  activation: 0.5,
  retention:  0.2,
  viral:      0.05,
});

const DEFAULT_MIN_SAMPLE = 5;

const RECOMMENDATIONS = Object.freeze({
  onboarding: {
    titleKey:      'growth.weakestPoint.onboarding.title',
    titleFallback: 'Onboarding completion is low \u2014 reduce friction',
    bodyKey:       'growth.weakestPoint.onboarding.body',
    bodyFallback:  'Cut optional fields; auto-detect more; collapse the flow.',
  },
  activation: {
    titleKey:      'growth.weakestPoint.activation.title',
    titleFallback: 'Activation is low \u2014 improve action clarity',
    bodyKey:       'growth.weakestPoint.activation.body',
    bodyFallback:  'Sharpen the headline + Done CTA; remove competing UI above the fold.',
  },
  retention: {
    titleKey:      'growth.weakestPoint.retention.title',
    titleFallback: 'Retention is low \u2014 improve the habit loop',
    bodyKey:       'growth.weakestPoint.retention.body',
    bodyFallback:  'Strengthen the daily trigger \u2014 reminder copy, time anchor, streak reinforcement.',
  },
  viral: {
    titleKey:      'growth.weakestPoint.viral.title',
    titleFallback: 'Viral loop is weak \u2014 improve share triggers',
    bodyKey:       'growth.weakestPoint.viral.body',
    bodyFallback:  'Make the share moment more visible; align share copy to the value the user just felt.',
  },
});

function _ratio(numer, denom) {
  const n = Number(numer);
  const d = Number(denom);
  if (!Number.isFinite(n) || !Number.isFinite(d) || d <= 0) return null;
  return Math.max(0, Math.min(1, n / d));
}

function _stageCount(analytics, stage) {
  const row = (analytics?.funnel || []).find((r) => r && r.stage === stage);
  return row ? Number(row.count || 0) : 0;
}

/**
 * Read the four spec-defined metrics off the analytics payload.
 * Each entry returns `null` for `rate` when the denominator is
 * too small to be meaningful (caller-provided minSample).
 */
function _computeRates(analytics, minSample) {
  // Onboarding completion = onboarding_completed / onboarding_started
  const obStarted   = _stageCount(analytics, 'onboarding_started');
  const obCompleted = _stageCount(analytics, 'onboarding_completed');
  const onboarding = {
    rate:        obStarted >= minSample ? _ratio(obCompleted, obStarted) : null,
    stage1Count: obStarted,
    stage2Count: obCompleted,
    metric:      'onboardingCompletion',
  };

  // Activation = action_completed / action_shown
  const actShown     = _stageCount(analytics, 'action_shown');
  const actCompleted = _stageCount(analytics, 'action_completed');
  const activation = {
    rate:        actShown >= minSample ? _ratio(actCompleted, actShown) : null,
    stage1Count: actShown,
    stage2Count: actCompleted,
    metric:      'firstActionCompletion',
  };

  // Retention = day2_return / onboarding_completed (cohort
  // denominator). Falls back to app_opened when onboarding count
  // is < minSample but there's broader session data.
  const day2 = Number(analytics?.retention?.day2 || 0);
  const cohort = obCompleted >= minSample
    ? obCompleted
    : _stageCount(analytics, 'app_opened');
  const retention = {
    rate:        cohort >= minSample ? _ratio(day2, cohort) : null,
    stage1Count: cohort,
    stage2Count: day2,
    metric:      'day2Retention',
  };

  // Viral = sharesCompleted / users-who-could-share
  // (= action_completed). Loose proxy for "shares per user".
  const sharesCompleted = Number(analytics?.viral?.sharesCompleted || 0);
  const denom = actCompleted;
  const viral = {
    rate:        denom >= minSample ? _ratio(sharesCompleted, denom) : null,
    stage1Count: denom,
    stage2Count: sharesCompleted,
    metric:      'sharesPerUser',
  };

  return { onboarding, activation, retention, viral };
}

/**
 * findWeakestPoint — main entry. Returns null when no metric has
 * enough sample to meaningfully evaluate, OR when every metric
 * is above its threshold (no fix needed this week).
 */
export function findWeakestPoint({
  analytics,
  minSample = DEFAULT_MIN_SAMPLE,
} = {}) {
  let snap = analytics;
  if (!snap || typeof snap !== 'object') {
    try { snap = buildGrowthAnalytics(); }
    catch { snap = null; }
  }
  if (!snap) return null;

  const rates = _computeRates(snap, minSample);

  // Score each category: how far BELOW its threshold is the
  // measured rate? Larger gap = bigger problem. Skip categories
  // with null rate (insufficient data).
  const candidates = [];
  for (const cat of ['onboarding', 'activation', 'retention', 'viral']) {
    const r = rates[cat];
    if (r == null || r.rate == null) continue;
    const threshold = THRESHOLDS[cat];
    const gap = threshold - r.rate;          // positive when below threshold
    if (gap > 0) {
      candidates.push({ cat, gap, rate: r.rate, ...r });
    }
  }

  if (candidates.length === 0) return null;  // nothing to recommend

  // Pick the largest gap as the weakest point. Tie-break by
  // category order (onboarding wins ties — earliest in the funnel
  // always has the biggest downstream impact when fixed).
  const order = { onboarding: 0, activation: 1, retention: 2, viral: 3 };
  candidates.sort((a, b) => {
    if (b.gap !== a.gap) return b.gap - a.gap;
    return order[a.cat] - order[b.cat];
  });
  const winner = candidates[0];
  return Object.freeze({
    category:       winner.cat,
    metric:         winner.metric,
    rate:           winner.rate,
    threshold:      THRESHOLDS[winner.cat],
    gap:            winner.gap,
    recommendation: RECOMMENDATIONS[winner.cat],
    details: {
      stage1Count: winner.stage1Count,
      stage2Count: winner.stage2Count,
    },
  });
}

export const _internal = Object.freeze({
  THRESHOLDS, DEFAULT_MIN_SAMPLE, RECOMMENDATIONS,
  _ratio, _stageCount, _computeRates,
});

export default findWeakestPoint;
