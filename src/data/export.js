/**
 * export.js — versioned bundle ready for the Python training
 * pipeline.
 *
 *   exportTrainingData(opts?)
 *     -> { schema, exportedAt, events, outcomes, features? }
 *
 *   downloadTrainingData(opts?)
 *     -> triggers a browser download of the bundle as
 *        farroway_training_<ts>.json (skipped on SSR).
 *
 * The bundle carries explicit `schema` metadata so the Python
 * ingestion job can fail fast on a version mismatch instead of
 * silently misaligning columns.
 *
 * Strict-rule audit:
 *   * works offline (pure read over localStorage)
 *   * never throws (every read try/catch wrapped at the
 *     source modules)
 *   * lightweight: emits the same in-memory array references
 *     - no double-copy beyond the JSON.stringify the consumer
 *     does
 *   * structured: schema + counts + per-farm features
 */

import {
  getEvents,
  EVENT_TYPES,
  SCHEMA_VERSION as EVENTS_SCHEMA_VERSION,
} from './eventLogger.js';
import {
  getOutcomes,
  OUTCOME_LABELS,
  SCHEMA_VERSION as OUTCOMES_SCHEMA_VERSION,
} from './outcomes.js';
import { buildFeaturesForFarms } from './featureStore.js';

export const BUNDLE_VERSION = 1;

/**
 * exportTrainingData(opts?)
 *
 * opts:
 *   includeFeatures   if true, run buildFeaturesForFarms for the
 *                     unique farmIds seen in events + outcomes.
 *                     Default false to keep the bundle tight; the
 *                     Python pipeline can compute features itself.
 *   windowDays        forwarded to buildFeaturesForFarms when
 *                     `includeFeatures` is true.
 */
export function exportTrainingData(opts = {}) {
  const { includeFeatures = false, windowDays = null } = opts || {};

  const events   = getEvents();
  const outcomes = getOutcomes();

  const out = {
    schema: {
      bundleVersion:    BUNDLE_VERSION,
      eventsVersion:    EVENTS_SCHEMA_VERSION,
      outcomesVersion:  OUTCOMES_SCHEMA_VERSION,
      eventTypes:       EVENT_TYPES,
      outcomeLabels:    OUTCOME_LABELS,
    },
    exportedAt: new Date().toISOString(),
    counts: {
      events:    events.length,
      outcomes:  outcomes.length,
    },
    events,
    outcomes,
  };

  if (includeFeatures) {
    const farmIds = new Set();
    for (const e of events)   { if (e && e.payload && e.payload.farmId != null) farmIds.add(String(e.payload.farmId)); }
    for (const o of outcomes) { if (o && o.farmId != null) farmIds.add(String(o.farmId)); }
    out.features = buildFeaturesForFarms(Array.from(farmIds), { windowDays });
  }

  return out;
}

/**
 * downloadTrainingData(opts?)
 *
 * Convenience for the NGO admin tool: kick off a browser
 * download of the JSON bundle. No-op on SSR / when the
 * download primitives are missing.
 */
export function downloadTrainingData(opts = {}) {
  if (typeof document === 'undefined' || typeof URL === 'undefined') return false;
  try {
    const bundle = exportTrainingData(opts);
    const json = JSON.stringify(bundle);
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const ts   = new Date().toISOString().replace(/[:.]/g, '-');
    a.href     = url;
    a.download = `farroway_training_${ts}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => { try { URL.revokeObjectURL(url); } catch { /* swallow */ } }, 1000);
    return true;
  } catch (err) {
    try { console.warn('[ml-export] download failed:', err && err.message); }
    catch { /* console missing */ }
    return false;
  }
}
