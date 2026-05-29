/**
 * farmHealthScore.js — Phase 10 farm health composite.
 *
 *   import { computeFarmHealthScore } from
 *     'src/runtime/farmIntelligence/farmHealthScore.js';
 *
 * What this is
 * ────────────
 *   Pure deterministic composite that maps the existing farm
 *   signals to a 0-100 score with a farmer-friendly band label.
 *
 *   Inputs (each weighted; missing inputs reduce coverage but
 *   never produce a fake number):
 *     - recentScanConfidence       0.18  (avg confidence of last 5 scans)
 *     - recentScanIssueLoad        0.18  (severity of issues found)
 *     - taskCompletionRate         0.18  (last 14 days)
 *     - weatherRiskScore           0.14  (lower risk = higher score)
 *     - soilSuitabilityScore       0.10  (when soil data present)
 *     - pestPressure               0.12  (recent pest scan signals)
 *     - growthProgress             0.10  (crop stage vs expected)
 *
 *   Output:
 *     {
 *       runtimeVersion: 'farm-health-score-v1',
 *       score:    number 0-100 (null when insufficient signal),
 *       band:     'excellent' | 'good' | 'needs_attention' | 'critical' | 'insufficient',
 *       coverage: number 0-1 (which inputs were available),
 *       contributions: { <signal>: { weight, score, contribution } },
 *       headline:    farmer-language summary string,
 *       suggestion:  next-action hint (caller localizes via tSafe),
 *     }
 *
 * Strict-rule audit
 *   • Pure function. Never throws. SSR-safe.
 *   • No localStorage, no network, no time-of-day jitter.
 *   • Returns frozen envelope.
 *   • No PII; only numbers and labels.
 */

const RUNTIME_VERSION = 'farm-health-score-v1';

const _isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const _clamp01 = (v) => Math.max(0, Math.min(1, _isNum(v) ? v : 0));
const _clamp100 = (v) => Math.max(0, Math.min(100, _isNum(v) ? v : 0));

// Public so a CI gate / dashboard can introspect the formula.
export const HEALTH_WEIGHTS = Object.freeze({
  recentScanConfidence: 0.18,
  recentScanIssueLoad:  0.18,
  taskCompletionRate:   0.18,
  weatherRiskScore:     0.14,
  soilSuitabilityScore: 0.10,
  pestPressure:         0.12,
  growthProgress:       0.10,
});

// Band thresholds.
export const HEALTH_BAND_THRESHOLDS = Object.freeze({
  excellent:        85,
  good:             65,
  needs_attention:  40,
  // < 40 → critical
});

const BAND_HEADLINE_KEY = Object.freeze({
  excellent:       'farm.health.headline.excellent',
  good:            'farm.health.headline.good',
  needs_attention: 'farm.health.headline.needs_attention',
  critical:        'farm.health.headline.critical',
  insufficient:    'farm.health.headline.insufficient',
});

const BAND_HEADLINE_DEFAULT = Object.freeze({
  excellent:       'Your farm is in excellent shape.',
  good:            'Your farm is doing well.',
  needs_attention: 'A few items need your attention today.',
  critical:        'Action is needed on your farm.',
  insufficient:    'Add a few more scans to see your farm health.',
});

const BAND_SUGGESTION_DEFAULT = Object.freeze({
  excellent:       'Keep up the routine you’ve been following.',
  good:            'Stay consistent with daily checks and watering.',
  needs_attention: 'Open Tasks and complete the highest-priority actions.',
  critical:        'Scan affected leaves now and follow the suggested treatment.',
  insufficient:    'Take a scan of your most important crop to begin.',
});

function _bandFor(score) {
  if (!_isNum(score)) return 'insufficient';
  if (score >= HEALTH_BAND_THRESHOLDS.excellent) return 'excellent';
  if (score >= HEALTH_BAND_THRESHOLDS.good) return 'good';
  if (score >= HEALTH_BAND_THRESHOLDS.needs_attention) return 'needs_attention';
  return 'critical';
}

/**
 * @param {{
 *   recentScanConfidence?: number,   // 0-1
 *   recentScanIssueLoad?:  number,   // 0-1 (higher = more severe issues)
 *   taskCompletionRate?:   number,   // 0-1
 *   weatherRiskScore?:     number,   // 0-1 (higher = more risky)
 *   soilSuitabilityScore?: number,   // 0-1
 *   pestPressure?:         number,   // 0-1 (higher = more pests)
 *   growthProgress?:       number,   // 0-1
 * }} signals
 */
export function computeFarmHealthScore(signals) {
  const s = signals && typeof signals === 'object' ? signals : {};
  // Each input normalizes to 0-100 (so its contribution is
  // weight * normalizedScore). "Risk" inputs are inverted so that
  // higher risk reduces score.
  const inputs = {
    recentScanConfidence: _isNum(s.recentScanConfidence) ? _clamp01(s.recentScanConfidence) * 100 : null,
    recentScanIssueLoad:  _isNum(s.recentScanIssueLoad)  ? (1 - _clamp01(s.recentScanIssueLoad))  * 100 : null,
    taskCompletionRate:   _isNum(s.taskCompletionRate)   ? _clamp01(s.taskCompletionRate)   * 100 : null,
    weatherRiskScore:     _isNum(s.weatherRiskScore)     ? (1 - _clamp01(s.weatherRiskScore)) * 100 : null,
    soilSuitabilityScore: _isNum(s.soilSuitabilityScore) ? _clamp01(s.soilSuitabilityScore) * 100 : null,
    pestPressure:         _isNum(s.pestPressure)         ? (1 - _clamp01(s.pestPressure))    * 100 : null,
    growthProgress:       _isNum(s.growthProgress)       ? _clamp01(s.growthProgress)       * 100 : null,
  };

  let weightSum = 0;
  let weighted  = 0;
  const contributions = {};
  for (const [key, weight] of Object.entries(HEALTH_WEIGHTS)) {
    const v = inputs[key];
    if (v == null) {
      contributions[key] = Object.freeze({ weight, score: null, contribution: 0 });
      continue;
    }
    const contribution = v * weight;
    contributions[key] = Object.freeze({
      weight, score: Math.round(v), contribution: Math.round(contribution * 10) / 10,
    });
    weightSum += weight;
    weighted += contribution;
  }
  const coverage = Math.round(weightSum * 100) / 100;
  // Need at least 30% of the weight covered to produce a number.
  // Below that the score is unreliable — return null + 'insufficient'.
  const score = weightSum >= 0.30
    ? Math.round(_clamp100(weighted / weightSum))
    : null;
  const band = _bandFor(score);
  return Object.freeze({
    runtimeVersion: RUNTIME_VERSION,
    score,
    band,
    coverage,
    contributions: Object.freeze(contributions),
    headlineKey:    BAND_HEADLINE_KEY[band],
    headlineDefault: BAND_HEADLINE_DEFAULT[band],
    suggestionDefault: BAND_SUGGESTION_DEFAULT[band],
  });
}

export const _internal = Object.freeze({
  _bandFor, HEALTH_WEIGHTS, HEALTH_BAND_THRESHOLDS,
});
