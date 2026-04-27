/**
 * performanceTracker.js — running record of "predicted vs.
 * actual" so an operator can answer "is this learner getting
 * better?" without re-running the trainer.
 *
 *   evaluatePrediction(predicted, actual)   pure helper
 *   recordEvaluation(task, evaluation)      append capped log
 *   getEvaluations(task)                    read
 *   getAccuracy(task, opts?)                summary metrics
 *   clearEvaluations(task?)
 *
 * Storage: localStorage `farroway_performance_<task>`. Capped
 * at MAX_EVALS = 500 rows per task (drop-oldest LRU).
 *
 * Strict-rule audit
 *   * works offline (localStorage only)
 *   * never throws (defensive everywhere)
 *   * lightweight: ~80 bytes per row x 500 = 40KB per task
 *   * explainable: getAccuracy returns precision / recall /
 *     accuracy in plain numbers
 */

export const SCHEMA_VERSION = 1;
export const MAX_EVALS      = 500;

const TASK = Object.freeze({ PEST: 'pest', DROUGHT: 'drought' });

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

function _key(task) { return `farroway_performance_${_normaliseTask(task)}`; }

function _read(task) {
  const raw = _safeGet(_key(task));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    _safeRemove(_key(task));
    return [];
  }
}

function _write(task, rows) {
  const trimmed = rows.length > MAX_EVALS
    ? rows.slice(rows.length - MAX_EVALS)
    : rows;
  try { _safeSet(_key(task), JSON.stringify(trimmed)); }
  catch { /* swallow */ }
}

/* ─── Pure evaluator ───────────────────────────────────────────── */

/**
 * evaluatePrediction(predicted, actual)
 *
 *   predicted  'HIGH' | 'MEDIUM' | 'LOW'
 *   actual     'pest' | 'drought' | 'none' | 'unknown'
 *
 * Returns:
 *   {
 *     correct:      boolean,
 *     truePositive: boolean,
 *     trueNegative: boolean,
 *     predicted, actual,
 *   }
 *
 * "Correct" rule
 *   * predicted HIGH + actual is the matching positive  -> correct
 *   * predicted LOW  + actual 'none'                    -> correct
 *   * MEDIUM never counts as correct OR wrong; it's the
 *     "I'm not sure" zone the calibration leaves room for
 *     (returned with truePositive=false + trueNegative=false)
 */
export function evaluatePrediction(predicted, actual, kind) {
  const p = String(predicted || '').toUpperCase();
  const a = String(actual || '').toLowerCase();
  const k = String(kind || 'pest').toLowerCase();

  const positiveLabel = k === 'drought' ? 'drought' : 'pest';

  const truePositive =
    p === 'HIGH' && a === positiveLabel;
  const trueNegative =
    p === 'LOW' && a === 'none';

  return Object.freeze({
    correct: truePositive || trueNegative,
    truePositive,
    trueNegative,
    predicted: p,
    actual:    a,
    kind:      k,
  });
}

/* ─── Persisted log ───────────────────────────────────────────── */

/**
 * recordEvaluation(task, evaluation)
 *   Append an evaluation row. Auto-trims to MAX_EVALS.
 *   Returns the persisted record.
 */
export function recordEvaluation(task, evaluation) {
  const e = (evaluation && typeof evaluation === 'object') ? evaluation : {};
  const record = Object.freeze({
    timestamp:    Date.now(),
    correct:      !!e.correct,
    truePositive: !!e.truePositive,
    trueNegative: !!e.trueNegative,
    predicted:    e.predicted ? String(e.predicted) : '',
    actual:       e.actual    ? String(e.actual)    : '',
    farmId:       e.farmId == null ? null : String(e.farmId),
    v:            SCHEMA_VERSION,
  });
  const rows = _read(task);
  rows.push(record);
  _write(task, rows);
  return record;
}

export function getEvaluations(task) { return _read(task); }
export function clearEvaluations(task) {
  if (task) { _safeRemove(_key(task)); return; }
  for (const t of Object.values(TASK)) _safeRemove(_key(t));
}

/* ─── Accuracy roll-up ────────────────────────────────────────── */

/**
 * getAccuracy(task, opts?)
 *   -> {
 *        n,              // total rows considered
 *        correct,        // count
 *        accuracy,       // 0..1
 *        truePositives, falsePositives,
 *        trueNegatives,  falseNegatives,
 *        precision, recall,
 *      }
 *
 * opts.windowMs: only consider rows with timestamp >= now - windowMs.
 */
export function getAccuracy(task, opts = {}) {
  const rows = _read(task);
  const now = Date.now();
  const since = (opts && Number.isFinite(Number(opts.windowMs))) ? now - Number(opts.windowMs) : 0;

  let n = 0, correct = 0;
  let tp = 0, fp = 0, tn = 0, fn = 0;
  for (const r of rows) {
    if (!r) continue;
    if (Number(r.timestamp) < since) continue;
    n += 1;
    if (r.correct) correct += 1;
    const isHigh = r.predicted === 'HIGH';
    const isLow  = r.predicted === 'LOW';
    if (r.truePositive)               tp += 1;
    else if (isHigh)                  fp += 1;
    if (r.trueNegative)               tn += 1;
    else if (isLow)                   fn += 1;
  }

  const accuracy  = n > 0 ? correct / n : 0;
  const precision = (tp + fp) > 0 ? tp / (tp + fp) : 0;
  const recall    = (tp + fn) > 0 ? tp / (tp + fn) : 0;

  return Object.freeze({
    n, correct, accuracy,
    truePositives: tp, falsePositives: fp,
    trueNegatives: tn, falseNegatives: fn,
    precision, recall,
  });
}

export const PERFORMANCE_TASK = TASK;
