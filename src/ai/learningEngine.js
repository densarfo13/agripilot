/**
 * learningEngine.js — gradual, explainable weight updates.
 *
 *   updateWeights(task, features, label)         primitive
 *   learnFromLabel(labelRecord)                  high-level adapter
 *
 * Strict rules
 *   * No heavy ML. Plain additive nudges with hard clamps.
 *   * Offline only. No network.
 *   * Gradual. ABS_DELTA_MAX in weightsStore + the LR / DR
 *     constants below cap any single label's effect.
 *   * Doesn't break current risk logic. The deterministic
 *     riskEngine is unchanged; the deltas only flow through
 *     the ML predictor path via applyAdaptiveOverrides().
 *
 * Update rule (per spec)
 *   pest=YES  + humidity_high  -> humidity     += LR_POS  (0.10)
 *   pest=YES  + pest_reports>0 -> pest_reports += LR_POS_REPORTS (0.20)
 *   pest=YES  + temperature_high -> temperature += LR_POS_HALF (0.05)
 *   pest=NO   -> humidity       -= DR (0.05)
 *                pest_reports   -= DR (0.05)
 *   drought=YES + temp_high     -> temperature += LR_POS
 *   drought=YES + !rain         -> rain        -= LR_POS  (rain
 *                                                 protects, so a
 *                                                 negative weight
 *                                                 grows even more
 *                                                 negative)
 *   drought=NO  -> temperature  -= DR
 *                  rain         += DR (less negative)
 *
 * Every weight is clamped per ABS_DELTA_MAX in weightsStore.
 */

import {
  getWeights, saveWeights, DEFAULT_DELTAS, ABS_DELTA_MAX, TASK,
} from './weightsStore.js';
import {
  LABEL_KIND, LABEL_VALUE, CONFIDENCE,
} from '../data/labels.js';

/** Learning rates. Small + asymmetric per the spec. */
export const LR_POS         = 0.10;   // generic "yes" nudge
export const LR_POS_REPORTS = 0.20;   // stronger when nearby reports drove it
export const LR_POS_HALF    = 0.05;   // weaker secondary signal
export const DR             = 0.05;   // decay on confirmed-no

const FEATURE_NAMES = Object.freeze(Object.keys(DEFAULT_DELTAS));

function _clamp(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(-ABS_DELTA_MAX, Math.min(ABS_DELTA_MAX, n));
}

function _readBool(features, key) {
  if (!features || typeof features !== 'object') return false;
  const v = features[key];
  if (typeof v === 'boolean') return v;
  const n = Number(v);
  return Number.isFinite(n) && n > 0;
}

function _readNum(features, key) {
  if (!features || typeof features !== 'object') return 0;
  const n = Number(features[key]);
  return Number.isFinite(n) ? n : 0;
}

/* ─── primitive: per-task update ──────────────────────────────── */

/**
 * updateWeights(task, features, label)
 *
 *   task:     'pest' | 'drought'
 *   features: object with the canonical FEATURE_ORDER keys
 *   label:    'pest' | 'drought' | 'none' | 'pest_yes' | 'pest_no' |
 *             'drought_yes' | 'drought_no'
 *
 * Returns the new clamped delta object.
 *
 * Unknown labels (or missing features) are no-ops. The strict
 * rule "must not break current risk logic" is honoured by
 * doing nothing rather than guessing.
 */
export function updateWeights(task, features, label) {
  const t = String(task || '').toLowerCase();
  if (t !== TASK.PEST && t !== TASK.DROUGHT) return getWeights(t);

  const labelStr = String(label || '').toLowerCase();
  // Map every label vocabulary into a binary positive/negative
  // for the active task.
  let positive = null;  // null = no-op
  if (t === TASK.PEST) {
    if (labelStr === 'pest' || labelStr === 'pest_yes')   positive = true;
    else if (labelStr === 'none' || labelStr === 'pest_no') positive = false;
  } else {
    if (labelStr === 'drought' || labelStr === 'drought_yes')   positive = true;
    else if (labelStr === 'none' || labelStr === 'drought_no')  positive = false;
  }
  if (positive === null) return getWeights(t);

  const w = { ...getWeights(t) };

  if (t === TASK.PEST) {
    if (positive) {
      if (_readBool(features, 'humidity_high'))   w.humidity_high  += LR_POS;
      if (_readBool(features, 'temp_high'))       w.temp_high      += LR_POS_HALF;
      if (_readNum(features, 'pest_reports') > 0) w.pest_reports   += LR_POS_REPORTS;
      if (_readNum(features, 'inactivity_days') > 0) w.inactivity_days += LR_POS_HALF;
    } else {
      // confirmed-no: gentle decay so a single false positive
      // doesn't lock the weights at zero.
      w.humidity_high -= DR;
      w.pest_reports  -= DR;
    }
  } else {
    // drought
    if (positive) {
      if (_readBool(features, 'temp_high'))           w.temp_high        += LR_POS;
      if (!_readBool(features, 'rain_last_3_days'))   w.rain_last_3_days -= LR_POS;
    } else {
      w.temp_high        -= DR;
      // less-negative rain => move rain delta UP toward 0
      w.rain_last_3_days += DR;
    }
  }

  // Final clamp pass.
  for (const k of FEATURE_NAMES) w[k] = _clamp(w[k]);

  return saveWeights(t, w);
}

/* ─── high-level adapter ──────────────────────────────────────── */

/**
 * learnFromLabel(labelRecord)
 *
 * Called from src/data/labels.js after a label is persisted.
 * Reads the record's snapshot.features and dispatches to the
 * right per-task update.
 *
 * Skips on:
 *   * low-confidence labels (passive negatives are too noisy
 *     to drive learning)
 *   * missing features snapshot
 *   * unknown / unsupported label values
 */
export function learnFromLabel(labelRecord) {
  if (!labelRecord || typeof labelRecord !== 'object') return null;
  if (labelRecord.confidence === CONFIDENCE.LOW)        return null;

  const features = labelRecord.snapshot
    && labelRecord.snapshot.features
    && labelRecord.snapshot.features.features
    ? labelRecord.snapshot.features.features  // featureStore-shape
    : labelRecord.snapshot && labelRecord.snapshot.features;
  // featureStore returns
  //   { tasksCompleted, pestReports, droughtAlerts, ... }
  // but the LR feature_order keys are
  //   { temp_high, rain_last_3_days, humidity_high, ... }
  // Project the cross-set names where we can.
  const projected = _projectFeatures(features, labelRecord);

  // Pest task: pest_yes / pest_no / none all touch pest.
  // Drought task: drought_yes / drought_no / none touch drought.
  if (labelRecord.kind === LABEL_KIND.PEST) {
    return updateWeights(TASK.PEST, projected, labelRecord.value);
  }
  if (labelRecord.kind === LABEL_KIND.DROUGHT) {
    return updateWeights(TASK.DROUGHT, projected, labelRecord.value);
  }
  return null;
}

/**
 * Pull the model-spec feature names out of whatever shape the
 * label snapshot carried. featureStore aggregates
 * ("pestReports": N) don't map 1:1 onto LR feature names
 * ("pest_reports": N) so we project here. Missing fields stay 0.
 */
function _projectFeatures(features, labelRecord) {
  const out = { ...DEFAULT_DELTAS };  // zeros - reused as a 0-init dict
  if (!features || typeof features !== 'object') return out;

  // featureStore aggregate -> LR feature
  if (Number.isFinite(Number(features.pestReports))) {
    out.pest_reports = Number(features.pestReports);
  }
  if (Number.isFinite(Number(features.inactivity))) {
    out.inactivity_days = Number(features.inactivity);
  }

  // LR-shape passthrough (e.g. when caller already projected).
  for (const k of FEATURE_NAMES) {
    if (features[k] !== undefined) {
      out[k] = features[k];
    }
  }

  // Pull weather signals out of the snapshot.weather block when
  // available - LabelPrompt / saveLabel pass them through.
  const weather = labelRecord && labelRecord.snapshot && labelRecord.snapshot.weather;
  if (weather && typeof weather === 'object') {
    if (typeof weather.temperatureHigh === 'boolean') out.temp_high       = weather.temperatureHigh ? 1 : 0;
    if (typeof weather.humidityHigh    === 'boolean') out.humidity_high   = weather.humidityHigh    ? 1 : 0;
    if (typeof weather.rainLast3Days   === 'boolean') out.rain_last_3_days = weather.rainLast3Days  ? 1 : 0;
  }
  return out;
}

export const _internal = Object.freeze({
  _projectFeatures, _clamp, FEATURE_NAMES,
});
