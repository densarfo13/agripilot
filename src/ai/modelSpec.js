/**
 * modelSpec.js — feature-set + cold-start logistic-regression
 * weights for the pest + drought predictors.
 *
 * Why cold-start defaults
 * ───────────────────────
 * The app must produce sensible risk scores from day one - long
 * before the Python pipeline (scripts/ml/train_pest_drought.py)
 * has trained against any real labels. The defaults below are
 * derived directly from the deterministic v1.2 risk-engine rules,
 * translated into LR weights so the inference engine + the
 * trained-model engine share one runtime path:
 *
 *   pest score = +1 humidity_high
 *                +1 temperature_high
 *                +2 (pest_reports >= 3)        // step function
 *                +0.05 / inactivity day
 *                +0.005 / day_since_planting
 *                -2.0 bias
 *
 *   drought    = +1 temperature_high
 *                -2 rain_last_3_days
 *                -1.0 bias
 *
 * `mapRisk()` thresholds are calibrated to match the v1.2
 * boolean rules at the listed feature combinations:
 *
 *     score 0  -> prob 0.12  (LOW)
 *     score 2  -> prob 0.50  (MEDIUM)
 *     score 3  -> prob 0.73  (HIGH)
 *
 * Strict-rule audit
 *   * simple - flat dot-product LR
 *   * explainable - per-feature contribution = w_i * x_i
 *   * supports small data - 6 features, robust at low N
 *   * app-friendly export - { feature_order, weights, bias }
 */

export const SCHEMA_VERSION = 1;

/**
 * Canonical feature order. Both the trainer and the runtime use
 * THIS ORDER - the weights array index corresponds 1:1.
 */
export const FEATURE_ORDER = Object.freeze([
  'temp_high',
  'rain_last_3_days',
  'humidity_high',
  'days_since_planting',
  'pest_reports',
  'inactivity_days',
]);

/**
 * Display labels for the feature names. Each maps to a tSafe key
 * so the explainability surface stays i18n-aware. Translators
 * fill these once; the model trains on the stable IDs above.
 */
export const FEATURE_LABEL_KEYS = Object.freeze({
  temp_high:           'ai.feature.tempHigh',
  rain_last_3_days:    'ai.feature.rainLast3Days',
  humidity_high:       'ai.feature.humidityHigh',
  days_since_planting: 'ai.feature.daysSincePlanting',
  pest_reports:        'ai.feature.pestReports',
  inactivity_days:     'ai.feature.inactivityDays',
});

export const FEATURE_LABEL_FALLBACKS = Object.freeze({
  temp_high:           'High temperature',
  rain_last_3_days:    'Recent rain',
  humidity_high:       'High humidity',
  days_since_planting: 'Days since planting',
  pest_reports:        'Nearby pest reports',
  inactivity_days:     'Days inactive',
});

/* ─── Cold-start models ────────────────────────────────────────── */

export const PEST_DEFAULT_MODEL = Object.freeze({
  schemaVersion: SCHEMA_VERSION,
  task:          'pest',
  trainedAt:     null,        // null = cold-start (no real training yet)
  source:        'cold_start_v12',
  feature_order: FEATURE_ORDER,
  weights: Object.freeze([
    1.0,    // temp_high
    0.0,    // rain_last_3_days       (no direct effect on pest)
    1.0,    // humidity_high
    0.005,  // days_since_planting
    0.6,    // pest_reports           (3 reports => +1.8)
    0.05,   // inactivity_days
  ]),
  bias: -2.0,
});

export const DROUGHT_DEFAULT_MODEL = Object.freeze({
  schemaVersion: SCHEMA_VERSION,
  task:          'drought',
  trainedAt:     null,
  source:        'cold_start_v12',
  feature_order: FEATURE_ORDER,
  weights: Object.freeze([
    1.0,    // temp_high
   -2.0,    // rain_last_3_days       (recent rain protects)
    0.0,    // humidity_high
    0.0,    // days_since_planting
    0.0,    // pest_reports
    0.0,    // inactivity_days
  ]),
  bias: -1.0,
});

/* ─── Validation helper ────────────────────────────────────────── */

/**
 * isValidModelSpec(model)
 *   true when the JSON has the expected shape so the runtime can
 *   be sure the trained model (loaded from /models/pest.json or
 *   localStorage) is safe to feed into modelRunner.runModel.
 */
export function isValidModelSpec(model) {
  if (!model || typeof model !== 'object') return false;
  if (!Array.isArray(model.feature_order))  return false;
  if (!Array.isArray(model.weights))        return false;
  if (model.feature_order.length !== model.weights.length) return false;
  if (typeof model.bias !== 'number' || !Number.isFinite(model.bias)) return false;
  for (const w of model.weights) {
    if (typeof w !== 'number' || !Number.isFinite(w)) return false;
  }
  return true;
}

export const _internal = Object.freeze({
  SCHEMA_VERSION, FEATURE_ORDER,
});
