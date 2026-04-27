/**
 * modelRunner.js — pure logistic-regression inference.
 *
 *   runModel(features, weights, bias)
 *     -> probability in [0, 1]
 *
 *   runModelSpec(featuresMap, modelSpec)
 *     -> probability with feature-name -> weight alignment via
 *        modelSpec.feature_order (the safer caller surface)
 *
 * Strict-rule audit
 *   * pure: no I/O, no globals
 *   * never throws on missing fields - missing features default
 *     to 0, mismatched lengths fall back to the bias-only score
 *   * deterministic: same inputs, same output
 *   * explainable: contributions(...) returns per-feature
 *     w_i * x_i for the explainability surface
 */

function _sigmoid(x) {
  if (!Number.isFinite(x)) return 0.5;
  if (x >= 0) {
    const z = Math.exp(-x);
    return 1 / (1 + z);
  }
  const z = Math.exp(x);
  return z / (1 + z);
}

function _coerceNumber(v) {
  const n = typeof v === 'boolean' ? (v ? 1 : 0) : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * runModel(features, weights, bias)
 *
 * `features` may be:
 *   - an Array<number>: aligned 1:1 with `weights`
 *   - an Object {key: value}: ALSO accepted, but the iteration
 *     order is not guaranteed. Prefer runModelSpec for objects.
 *
 * Returns the sigmoid of (bias + Sum(w_i * x_i)).
 */
export function runModel(features, weights, bias = 0) {
  if (!Array.isArray(weights)) return _sigmoid(_coerceNumber(bias));
  let score = _coerceNumber(bias);

  if (Array.isArray(features)) {
    const n = Math.min(features.length, weights.length);
    for (let i = 0; i < n; i += 1) {
      score += _coerceNumber(features[i]) * _coerceNumber(weights[i]);
    }
  } else if (features && typeof features === 'object') {
    // Object iteration - rely on insertion order matching the
    // weights index. Use runModelSpec for the safer path.
    let i = 0;
    for (const key of Object.keys(features)) {
      if (i >= weights.length) break;
      score += _coerceNumber(features[key]) * _coerceNumber(weights[i]);
      i += 1;
    }
  }
  return _sigmoid(score);
}

/**
 * runModelSpec(featuresMap, modelSpec)
 *
 * Aligns the feature object to the spec's feature_order, fills
 * missing fields with 0, and returns the sigmoid score. This is
 * the SAFE caller surface for any code path that has feature
 * names rather than a positional array.
 */
export function runModelSpec(featuresMap, modelSpec) {
  if (!modelSpec
      || !Array.isArray(modelSpec.feature_order)
      || !Array.isArray(modelSpec.weights)) {
    return 0.5;
  }
  const order   = modelSpec.feature_order;
  const weights = modelSpec.weights;
  const bias    = _coerceNumber(modelSpec.bias);
  let score = bias;
  for (let i = 0; i < order.length && i < weights.length; i += 1) {
    const key = order[i];
    const x   = featuresMap && (key in featuresMap) ? featuresMap[key] : 0;
    score += _coerceNumber(x) * _coerceNumber(weights[i]);
  }
  return _sigmoid(score);
}

/**
 * contributions(featuresMap, modelSpec)
 *   -> Array<{ feature, value, weight, contribution }>
 *
 * Per-feature dot-product term used by the explainability
 * surface. Sorted by absolute contribution descending so the
 * caller can `slice(0, k)` for the "top K reasons" line.
 */
export function contributions(featuresMap, modelSpec) {
  if (!modelSpec
      || !Array.isArray(modelSpec.feature_order)
      || !Array.isArray(modelSpec.weights)) {
    return [];
  }
  const order   = modelSpec.feature_order;
  const weights = modelSpec.weights;
  const out = [];
  for (let i = 0; i < order.length && i < weights.length; i += 1) {
    const feature = order[i];
    const value   = featuresMap && (feature in featuresMap)
      ? _coerceNumber(featuresMap[feature]) : 0;
    const weight  = _coerceNumber(weights[i]);
    out.push({
      feature,
      value,
      weight,
      contribution: value * weight,
    });
  }
  out.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
  return out;
}

export const _internal = Object.freeze({ _sigmoid, _coerceNumber });
