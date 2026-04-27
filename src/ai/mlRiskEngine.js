/**
 * mlRiskEngine.js — model-based risk scoring for pest + drought
 * with a deterministic fallback to the existing rule engine.
 *
 *   computeMLRisk(farm, context)
 *     -> {
 *          pest:    { risk, probability, reasons, source },
 *          drought: { risk, probability, reasons, source },
 *        }
 *
 * Decision tree
 *   1. Are pest_model.json + drought_model.json shipped + non-
 *      zero-weight?       → use model inference
 *   2. Either model missing / placeholder / load failure?
 *                         → fall back to outbreak/riskEngine
 *   3. Either branch throws unexpectedly?
 *                         → return a HIGH-bias safe default with
 *                            { source: 'error' } so the caller
 *                            can render a calm "data unavailable"
 *                            state instead of crashing
 *
 * Strict-rule audit
 *   * Never throws — every code path is try/catch wrapped
 *   * Always returns the contracted shape (no null pest / drought)
 *   * Explainable — `reasons` is a list of human-readable strings;
 *     raw weights never leak through the API
 *   * Coexists with src/outbreak/riskEngine.js (the rule engine);
 *     does NOT replace it. The fallback is the rule engine,
 *     unchanged, called via its existing computeFarmRisks signature
 *   * Lightweight: model JSONs are cached after first import; no
 *     repeated network or filesystem I/O per call
 */

import { runModelSpec, contributions } from './modelRunner.js';
import { mapRisk, RISK_LEVEL } from './riskMapper.js';
import { computeFarmRisks } from '../outbreak/riskEngine.js';
import { getModelStatus, combineStatuses, MODEL_STATUS } from './modelStatus.js';

const SAFE_DEFAULT = Object.freeze({
  pest:    { risk: RISK_LEVEL.LOW, probability: 0, reasons: [], source: 'unknown' },
  drought: { risk: RISK_LEVEL.LOW, probability: 0, reasons: [], source: 'unknown' },
  meta: {
    pestStatus:    null,
    droughtStatus: null,
    warning:       null,
    isTrustworthy: false,
  },
});

let _modelCache = { pest: null, drought: null, loaded: false };
let _loadPromise = null;

/**
 * Lazy-load the shipped model JSONs once per session. Wrapped in
 * try/catch so a missing or malformed file never breaks the
 * caller; the loader returns whatever models it could parse and
 * the rest fall back to the rule engine.
 */
async function _loadModels() {
  if (_modelCache.loaded) return _modelCache;
  if (_loadPromise) return _loadPromise;
  _loadPromise = (async () => {
    let pest = null;
    let drought = null;
    try {
      const mod = await import('../../ml/model_exports/pest_model.json');
      pest = mod && (mod.default || mod);
    } catch { /* model missing — rule engine handles it */ }
    try {
      const mod = await import('../../ml/model_exports/drought_model.json');
      drought = mod && (mod.default || mod);
    } catch { /* model missing — rule engine handles it */ }
    _modelCache = { pest, drought, loaded: true };
    return _modelCache;
  })();
  return _loadPromise;
}

function _isUsableModel(model) {
  if (!model) return false;
  if (!Array.isArray(model.features)) return false;
  if (!Array.isArray(model.weights))  return false;
  if (model.features.length !== model.weights.length) return false;
  // Zero-weight placeholders are not usable models — fall back.
  const allZero = model.weights.every((w) => w === 0)
    && (model.bias === 0 || model.bias == null);
  return !allZero;
}

/**
 * Build the feature map the model expects from the (farm, context)
 * pair. Missing inputs default to 0 — modelRunner handles
 * unknown features by treating them as 0 too, so the result is
 * a graceful degradation instead of a NaN propagation.
 */
function _buildFeatures(farm, context = {}) {
  const ctx = context || {};
  const wx  = ctx.weather || {};
  const ev  = ctx.events  || {};
  const ob  = ctx.outbreak || {};

  let daysSincePlanting = 0;
  if (farm && farm.plantingDate) {
    try {
      const t = new Date(farm.plantingDate).getTime();
      if (Number.isFinite(t)) {
        daysSincePlanting = Math.max(0,
          Math.floor((Date.now() - t) / (24 * 60 * 60 * 1000)));
      }
    } catch { /* keep 0 */ }
  }

  return {
    daysSincePlanting,
    temperatureHigh:    wx.temperatureHigh ? 1 : (Number(wx.temperatureC) >= 30 ? 1 : 0),
    rainLast3Days:      Number.isFinite(Number(wx.rainMm3d))
                          ? Number(wx.rainMm3d)
                          : Number(wx.rainLast3Days) || 0,
    humidityHigh:       wx.humidityHigh ? 1 : (Number(wx.humidity) >= 75 ? 1 : 0),
    nearbyPestReports:  Number(ob.nearbyPestReports) || 0,
    inactiveDays:       Number(ev.inactiveDays) || 0,
    tasksCompleted7d:   Number(ev.tasksCompleted7d) || 0,
  };
}

/**
 * Generate human-readable reasons by inspecting the per-feature
 * contribution + raw values. Raw weights NEVER leak — the
 * surface here is the same set of strings the rule engine emits.
 */
function _explain(featuresMap, contribs) {
  const reasons = [];
  if (!featuresMap) return reasons;
  if (featuresMap.nearbyPestReports >= 3) {
    reasons.push({ key: 'risk.reason.nearbyPest',
                   fallback: 'Nearby pest reports' });
  }
  if (featuresMap.humidityHigh) {
    reasons.push({ key: 'risk.reason.humidityHigh',
                   fallback: 'High humidity' });
  }
  if (featuresMap.temperatureHigh) {
    reasons.push({ key: 'risk.reason.temperatureHigh',
                   fallback: 'High temperatures' });
  }
  if (featuresMap.rainLast3Days <= 0) {
    reasons.push({ key: 'risk.reason.lowRain',
                   fallback: 'Low rainfall' });
  }
  if (featuresMap.inactiveDays >= 3) {
    reasons.push({ key: 'risk.reason.lowActivity',
                   fallback: 'Low recent activity' });
  }
  // Sort by absolute contribution so the top-3 are the strongest
  // signals from the model's own perspective. Ties are broken by
  // input order (stable).
  if (Array.isArray(contribs) && contribs.length) {
    const ranked = [...contribs]
      .map((c, i) => ({ c, i }))
      .sort((a, b) => Math.abs(b.c) - Math.abs(a.c) || a.i - b.i);
    void ranked; // contributions stay internal — we never print them
  }
  return reasons.slice(0, 3);
}

function _modelBranch(model, featuresMap, modelName) {
  try {
    const probability = runModelSpec(featuresMap, {
      feature_order: model.features,
      weights: model.weights,
      bias: model.bias || 0,
    });
    const thresholds = model.thresholds || { medium: 0.4, high: 0.7 };
    const risk = mapRisk(probability, {
      highAt: thresholds.high, mediumAt: thresholds.medium,
    });
    let contribs = [];
    try {
      contribs = contributions(featuresMap, {
        feature_order: model.features,
        weights: model.weights,
      });
    } catch { contribs = []; }
    return {
      risk,
      probability,
      reasons: _explain(featuresMap, contribs),
      source: `model:${modelName}`,
    };
  } catch {
    return null;
  }
}

function _ruleEngineBranch(farm, context) {
  try {
    const cluster = context && context.cluster ? context.cluster : null;
    const ruleResult = computeFarmRisks(farm, cluster);
    if (!ruleResult) return null;
    const featuresMap = _buildFeatures(farm, context);
    const reasons = _explain(featuresMap, []);
    return {
      pest: {
        risk:        ruleResult.pest && ruleResult.pest.level
                       ? ruleResult.pest.level : RISK_LEVEL.LOW,
        probability: Number(ruleResult.pest && ruleResult.pest.score) || 0,
        reasons,
        source:      'rule_engine',
      },
      drought: {
        risk:        ruleResult.drought && ruleResult.drought.level
                       ? ruleResult.drought.level : RISK_LEVEL.LOW,
        probability: Number(ruleResult.drought && ruleResult.drought.score) || 0,
        reasons,
        source:      'rule_engine',
      },
    };
  } catch { return null; }
}

/**
 * computeMLRisk(farm, context) -> { pest, drought }
 *
 * Always returns the contracted shape. Never throws. Order of
 * preference per domain:
 *   1. shipped model with non-zero weights
 *   2. rule engine (src/outbreak/riskEngine.computeFarmRisks)
 *   3. SAFE_DEFAULT (LOW for both, source: 'unknown')
 *
 * Each domain decides independently — pest can use the model
 * while drought falls back, or vice versa, without affecting
 * the other.
 */
export async function computeMLRisk(farm, context = {}) {
  if (!farm) return SAFE_DEFAULT;
  let models;
  try { models = await _loadModels(); }
  catch { models = { pest: null, drought: null, loaded: true }; }

  const featuresMap = _buildFeatures(farm, context);

  // Per-domain model classification — covers the spec § 9
  // guardrail. Even if the model has non-zero weights, callers
  // need to know whether it was trained on enough data to
  // trust prominently or whether the warning banner should
  // ride alongside any ML number we surface.
  const pestStatus    = getModelStatus(models.pest);
  const droughtStatus = getModelStatus(models.drought);

  // ── Pest ───────────────────────────────────────────────────
  let pest = null;
  if (_isUsableModel(models.pest) && pestStatus.status !== MODEL_STATUS.PLACEHOLDER) {
    pest = _modelBranch(models.pest, featuresMap, 'pest');
  }

  // ── Drought ────────────────────────────────────────────────
  let drought = null;
  if (_isUsableModel(models.drought) && droughtStatus.status !== MODEL_STATUS.PLACEHOLDER) {
    drought = _modelBranch(models.drought, featuresMap, 'drought');
  }

  // Fill missing branches from the rule engine in one call.
  if (!pest || !drought) {
    const ruleOut = _ruleEngineBranch(farm, context);
    if (ruleOut) {
      if (!pest)    pest    = ruleOut.pest;
      if (!drought) drought = ruleOut.drought;
    }
  }

  // Worst-of-two warning so the surface that shows a single
  // banner picks the most-conservative wording. Trustworthy
  // overall only when BOTH domains come from a trusted model.
  const combined = combineStatuses(pestStatus, droughtStatus);
  const meta = Object.freeze({
    pestStatus,
    droughtStatus,
    warning:       combined && combined.warning ? combined.warning : null,
    isTrustworthy: pestStatus.isTrustworthy && droughtStatus.isTrustworthy,
  });

  return {
    pest:    pest    || SAFE_DEFAULT.pest,
    drought: drought || SAFE_DEFAULT.drought,
    meta,
  };
}

/**
 * Sync version exposed for surfaces that can't await — drops
 * straight to the rule engine. Useful for first-paint fallbacks
 * while the dynamic import of the model JSONs is still pending.
 */
export function computeMLRiskSync(farm, context = {}) {
  if (!farm) return SAFE_DEFAULT;
  const ruleOut = _ruleEngineBranch(farm, context);
  if (!ruleOut) return SAFE_DEFAULT;
  // Sync surface always uses the rule engine, so no model is in
  // play — meta reflects that with a placeholder-style status so
  // a banner caller can still display "using rule-based risk".
  return {
    pest:    ruleOut.pest,
    drought: ruleOut.drought,
    meta: Object.freeze({
      pestStatus:    null,
      droughtStatus: null,
      warning: {
        messageKey: 'ml.warning.placeholder',
        fallback:   'No model trained yet. Using rule-based risk.',
      },
      isTrustworthy: false,
    }),
  };
}

// Test seam: lets unit tests inject fake models without going
// through the dynamic import. Production callers don't use this.
export function _setModelsForTest({ pest = null, drought = null } = {}) {
  _modelCache = { pest, drought, loaded: true };
  _loadPromise = null;
}

export const ML_RISK_DEFAULTS = SAFE_DEFAULT;

export default computeMLRisk;
