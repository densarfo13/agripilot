/**
 * progressScore.js — investor-grade per-farmer progress score.
 *
 * Distinct from `src/lib/farmScore.js` which scores PROFILE
 * COMPLETENESS (did the farmer fill out the required fields?).
 * This module scores ONGOING ACTIVITY — how is the farmer
 * actually doing once their farm is set up?
 *
 *   computeProgressScore({
 *     taskCompletionRate,     // 0..1 — % of tasks done in last 14d
 *     cropHealthScore,        // 0..1 — derived from intelligence engines
 *     consistencyScore,       // 0..1 — % of days the farmer logged something
 *     weatherAdaptationScore, // 0..1 — did they adapt tasks when alerts fired
 *   })  →  {
 *     score:      0..100,
 *     label:      'Low' | 'Medium' | 'High' | 'Excellent',
 *     reasons:    [{ key, weightPct, contributionPts, detail }],
 *     dataMissing: string[],   // names of inputs that fell back to default
 *   }
 *
 * Weights (sum = 100%):
 *   taskCompletion         40%
 *   cropHealth             30%
 *   consistency            20%
 *   weatherAdaptation      10%
 *
 * Label thresholds (NGO-monetisation aligned, 2026-04 sprint):
 *   < 40   High Risk
 *   < 60   Medium
 *   < 80   Good
 *   ≥ 80   Excellent
 *
 * Why "High Risk" instead of "Low"
 *   The score is also surfaced on NGO / investor dashboards where
 *   risk language is the canonical signal. "Low" was ambiguous —
 *   "low activity" vs "low risk" — so this sprint renames the band
 *   to match how the rest of the dashboard already speaks. The
 *   numeric ranges are unchanged, so any caller storing a snapshot
 *   number is compatible.
 *
 * Safety contract
 *   • Pure function. Never throws. Never reads localStorage / fetch.
 *   • Missing input → treated as 0 AND added to `dataMissing` so the
 *     caller can render a "data incomplete" badge.
 *   • Negative or out-of-range input → clamped to [0, 1].
 *   • All numeric outputs rounded to whole points so the UI never
 *     shows "73.4242" — the score is a display number, not a metric.
 */

const WEIGHTS = Object.freeze({
  taskCompletion:    0.40,
  cropHealth:        0.30,
  consistency:       0.20,
  weatherAdaptation: 0.10,
});

const REASON_KEYS = Object.freeze({
  taskCompletion:    'progressScore.reason.taskCompletion',
  cropHealth:        'progressScore.reason.cropHealth',
  consistency:       'progressScore.reason.consistency',
  weatherAdaptation: 'progressScore.reason.weatherAdaptation',
});

const REASON_DETAILS = Object.freeze({
  taskCompletion: {
    high:    'Task completion is strong this period.',
    medium:  'Task completion is moderate — finish a few more this week.',
    low:     'Many tasks were skipped; pick the highest-priority one to act on.',
    missing: 'No task data available yet.',
  },
  cropHealth: {
    high:    'Crop health signals look healthy.',
    medium:  'Crop health is mixed — review the latest alerts.',
    low:     'Crop health flags need attention.',
    missing: 'No crop-health signal yet (early in the cycle?).',
  },
  consistency: {
    high:    'Showing up consistently — almost daily activity.',
    medium:  'Logging activity on most days.',
    low:     'Few activity entries; consider a daily check-in.',
    missing: 'No activity logs to score consistency.',
  },
  weatherAdaptation: {
    high:    'Adapted tasks well to weather alerts.',
    medium:  'Some weather alerts were acted on; others missed.',
    low:     'Weather alerts mostly went unaddressed.',
    missing: 'No weather alerts triggered yet.',
  },
});

function clamp01(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;       // null = missing, not zero
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function bandFor(value01) {
  if (value01 == null) return 'missing';
  if (value01 >= 0.7)  return 'high';
  if (value01 >= 0.4)  return 'medium';
  return 'low';
}

function labelForScore(score) {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Medium';
  return 'High Risk';
}

/**
 * Pure compute. See header for input/output contract.
 */
export function computeProgressScore(input = {}) {
  const dataMissing = [];
  const reasons = [];

  // Normalise + flag-missing each weighted input.
  const norm = {};
  for (const key of Object.keys(WEIGHTS)) {
    const camel = key === 'taskCompletion' ? 'taskCompletionRate'
                : key === 'cropHealth' ? 'cropHealthScore'
                : key === 'consistency' ? 'consistencyScore'
                : 'weatherAdaptationScore';
    const raw = input[camel];
    const v = clamp01(raw);
    if (v == null) {
      norm[key] = 0;
      dataMissing.push(camel);
    } else {
      norm[key] = v;
    }
  }

  let score = 0;
  for (const [key, weight] of Object.entries(WEIGHTS)) {
    const v = norm[key];
    const contribution = v * weight * 100;          // 0..weight*100 pts
    score += contribution;
    const camel = key === 'taskCompletion' ? 'taskCompletionRate'
                : key === 'cropHealth' ? 'cropHealthScore'
                : key === 'consistency' ? 'consistencyScore'
                : 'weatherAdaptationScore';
    const isMissing = dataMissing.includes(camel);
    const band = isMissing ? 'missing' : bandFor(v);
    reasons.push(Object.freeze({
      key:             REASON_KEYS[key],
      weightPct:       Math.round(weight * 100),
      contributionPts: Math.round(contribution),
      band,
      detail:          REASON_DETAILS[key][band],
    }));
  }

  return Object.freeze({
    score:       Math.round(score),
    label:       labelForScore(Math.round(score)),
    reasons:     Object.freeze(reasons),
    dataMissing: Object.freeze(dataMissing),
  });
}

/**
 * getScoreLabel — public mapper from a numeric score to the
 * decision-layer band + display colour. Single source of truth
 * for the four label-bands so dashboards / chips / cards / SMS
 * voice all read the same thing.
 *
 *   getScoreLabel(72) → { score:72, label:'Good', color:'green',
 *                         band:'good' }
 *
 * `band` is the lowercase machine form ('high_risk' / 'medium' /
 * 'good' / 'excellent') — useful for translation keys + CSS
 * class names. `color` is one of 'red' / 'yellow' / 'green' /
 * 'purple' (per spec); UI components map it to their own design
 * tokens. `label` is the English display text.
 *
 * Pure / never throws. Out-of-range numbers clamp to [0..100].
 */
export function getScoreLabel(score) {
  let n = Number(score);
  if (!Number.isFinite(n)) n = 0;
  if (n < 0)   n = 0;
  if (n > 100) n = 100;
  if (n >= 80) return Object.freeze({ score: n, label: 'Excellent', color: 'purple', band: 'excellent' });
  if (n >= 60) return Object.freeze({ score: n, label: 'Good',      color: 'green',  band: 'good' });
  if (n >= 40) return Object.freeze({ score: n, label: 'Medium',    color: 'yellow', band: 'medium' });
  return         Object.freeze({ score: n, label: 'High Risk', color: 'red',    band: 'high_risk' });
}

export const _internal = Object.freeze({ WEIGHTS, REASON_KEYS, labelForScore, bandFor });
