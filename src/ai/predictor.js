/**
 * predictor.js — high-level "predict pest / drought" entry
 * point. Composes modelStore + modelRunner + riskMapper +
 * explainability into a single call site.
 *
 *   predict(task, featuresMap)         sync, cache-first
 *   predictAsync(task, featuresMap)    async, may refresh model
 *
 * Output shape (stable):
 *   {
 *     task,                  'pest' | 'drought'
 *     prob,                  0..1
 *     risk,                  'HIGH' | 'MEDIUM' | 'LOW'
 *     reasons,               { lines, contributors, summary }
 *     model: { source, trainedAt, schemaVersion },
 *   }
 *
 * Strict-rule audit
 *   * works offline: getCachedModel falls back to cold-start
 *     defaults without a network call
 *   * never throws: every helper inside is defensive
 *   * lightweight: one call per feature row; pure dot-product
 *   * explainable: returns the top-K positive contributors
 *     with i18n'd labels
 */

import { getCachedModel, loadModel, MODEL_TASK } from './modelStore.js';
import { runModelSpec } from './modelRunner.js';
import { mapRisk } from './riskMapper.js';
import { topReasons } from './explainability.js';

function _shape(task, featuresMap, modelSpec) {
  const prob   = runModelSpec(featuresMap, modelSpec);
  const risk   = mapRisk(prob);
  const reasons = topReasons(featuresMap, modelSpec, { limit: 2, onlyPositive: true });
  return Object.freeze({
    task,
    prob,
    risk,
    reasons,
    model: Object.freeze({
      source:        modelSpec.source        || null,
      trainedAt:     modelSpec.trainedAt     || null,
      schemaVersion: modelSpec.schemaVersion || null,
    }),
  });
}

/**
 * predict(task, featuresMap)
 *
 * Synchronous fast path. Reads the cached model (cold-start
 * default when no trained model is wired) and runs inference.
 * Use this anywhere a render component can't await.
 */
export function predict(task, featuresMap) {
  const t = String(task || '').toLowerCase();
  const safeTask = (t === MODEL_TASK.PEST || t === MODEL_TASK.DROUGHT) ? t : MODEL_TASK.PEST;
  const modelSpec = getCachedModel(safeTask);
  return _shape(safeTask, featuresMap || {}, modelSpec);
}

/**
 * predictAsync(task, featuresMap, opts?)
 *
 * Same as predict() but kicks off a model refresh first - the
 * caller awaits if it wants the freshest weights. Use at app
 * boot or in a useEffect to keep the cached model up to date.
 */
export async function predictAsync(task, featuresMap, opts = {}) {
  const t = String(task || '').toLowerCase();
  const safeTask = (t === MODEL_TASK.PEST || t === MODEL_TASK.DROUGHT) ? t : MODEL_TASK.PEST;
  const modelSpec = await loadModel(safeTask, opts);
  return _shape(safeTask, featuresMap || {}, modelSpec);
}

/**
 * predictBoth(featuresMap)
 *   Convenience for surfaces (RiskAlertBanner, RiskSummaryPanel)
 *   that want both pest + drought predictions in one call.
 */
export function predictBoth(featuresMap) {
  return Object.freeze({
    pest:    predict(MODEL_TASK.PEST,    featuresMap),
    drought: predict(MODEL_TASK.DROUGHT, featuresMap),
  });
}

export { MODEL_TASK };
