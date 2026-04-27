/**
 * weightsStore.js — adaptive per-feature weight DELTAS that
 * nudge the cold-start / trained model weights based on
 * farmer-confirmed labels.
 *
 *   getWeights(task?)     -> { feature: delta }
 *   saveWeights(task, w)
 *   resetWeights(task?)
 *
 * Storage: localStorage `farroway_weights_<task>` per task,
 *          where task is 'pest' | 'drought'.
 *
 * Why deltas, not absolute weights
 * ────────────────────────────────
 * The cold-start model in src/ai/modelSpec.js has carefully
 * calibrated weights that match the v1.2 deterministic rules.
 * If the adaptive layer stored absolute weights, the first
 * label-driven nudge would BLOW AWAY that calibration. Instead
 * we store small additive deltas and apply them on top of the
 * cold-start (or trained) baseline at inference time. This way:
 *
 *   * The deterministic risk engine in src/outbreak/riskEngine.js
 *     stays untouched.
 *   * The ML predictor path picks up the deltas via
 *     applyAdaptiveOverrides() in src/ai/predictor.js.
 *   * Resetting an over-trained learner is a one-key delete.
 *
 * Strict-rule audit
 *   * works offline (localStorage only)
 *   * never throws (try/catch wrapped reads + writes)
 *   * lightweight: a tiny object per task
 *   * gradual learning: clamp ABS_DELTA_MAX (1.5) keeps a
 *     single feature's adaptation modest
 */

export const SCHEMA_VERSION = 1;

/** Tasks the adaptive layer knows about. */
export const TASK = Object.freeze({ PEST: 'pest', DROUGHT: 'drought' });

/**
 * Default DELTAS = all zeros. The baseline weights live in
 * modelSpec.PEST_DEFAULT_MODEL / DROUGHT_DEFAULT_MODEL; the
 * adaptive layer ships nothing on top until the farmer
 * confirms a label.
 *
 * Listed explicitly so a corrupted localStorage entry can be
 * fully repaired by a single resetWeights() call.
 */
export const DEFAULT_DELTAS = Object.freeze({
  temp_high:           0,
  rain_last_3_days:    0,
  humidity_high:       0,
  days_since_planting: 0,
  pest_reports:        0,
  inactivity_days:     0,
});

/** Clamp every delta into ±ABS_DELTA_MAX so a runaway label
 *  stream can't destabilise the model. */
export const ABS_DELTA_MAX = 1.5;

function _safeGet(key) {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  } catch { return null; }
}

function _safeSet(key, value) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, value);
  } catch { /* swallow */ }
}

function _safeRemove(key) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(key);
  } catch { /* swallow */ }
}

function _normaliseTask(t) {
  const s = String(t || '').toLowerCase();
  return s === TASK.PEST || s === TASK.DROUGHT ? s : TASK.PEST;
}

function _storageKey(task) { return `farroway_weights_${_normaliseTask(task)}`; }

function _coerce(input) {
  if (!input || typeof input !== 'object') return { ...DEFAULT_DELTAS };
  const out = { ...DEFAULT_DELTAS };
  for (const k of Object.keys(DEFAULT_DELTAS)) {
    const n = Number(input[k]);
    if (Number.isFinite(n)) {
      out[k] = Math.max(-ABS_DELTA_MAX, Math.min(ABS_DELTA_MAX, n));
    }
  }
  return out;
}

/* ─── Public ───────────────────────────────────────────────────── */

/**
 * getWeights(task?)
 *   -> object with the same keys as DEFAULT_DELTAS.
 *
 * Always returns a usable shape - corrupted localStorage entries
 * are silently reset to zeros.
 */
export function getWeights(task) {
  const raw = _safeGet(_storageKey(task));
  if (!raw) return { ...DEFAULT_DELTAS };
  try {
    const parsed = JSON.parse(raw);
    return _coerce(parsed);
  } catch {
    _safeRemove(_storageKey(task));
    return { ...DEFAULT_DELTAS };
  }
}

/**
 * saveWeights(task, deltas)
 *   Persist the adaptive deltas. Coerces every entry through
 *   the clamp so callers can't accidentally store an unbounded
 *   value.
 */
export function saveWeights(task, deltas) {
  const normalised = _coerce(deltas);
  try { _safeSet(_storageKey(task), JSON.stringify(normalised)); }
  catch { /* swallow */ }
  return normalised;
}

/** Reset deltas back to zero for a single task or all tasks. */
export function resetWeights(task) {
  if (task) {
    _safeRemove(_storageKey(task));
    return;
  }
  for (const t of Object.values(TASK)) _safeRemove(_storageKey(t));
}

export const _internal = Object.freeze({ _storageKey, _coerce });
