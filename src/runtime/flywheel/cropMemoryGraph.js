/**
 * runtime/flywheel/cropMemoryGraph.js — Phase 14 per-crop memory.
 *
 *   import { buildCropMemory }
 *     from 'src/runtime/flywheel/cropMemoryGraph.js';
 *
 *   const cropMem = buildCropMemory({ events, cropId });
 *
 * What this is
 * ────────────
 *   Materialized 4-timeline view for one crop:
 *
 *     {
 *       cropId,
 *       lifecycleTimeline: [...],  // planting → growth → harvest
 *       healthTimeline:    [...],  // scans + health-score changes
 *       treatmentTimeline: [...],  // applied treatments
 *       yieldTimeline:     [...],  // yield forecasts over time
 *       runtimeVersion,
 *     }
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • Composition-only — reads events, no mutation.
 *   • Empty crop returns frozen empty envelope (not null).
 */

import { EVENT_KIND } from './eventEngine.js';
import { replayEvents } from './eventStore.js';

export const CROP_MEMORY_VERSION = 'crop-memory-v1';

const _isObj = (v) => v != null && typeof v === 'object';
const _arr   = (v) => (Array.isArray(v) ? v : []);
const _str   = (v) => (typeof v === 'string' ? v : '');
const _num   = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };

const LIFECYCLE_KINDS = new Set([
  EVENT_KIND.PLANTING_LOGGED,
  EVENT_KIND.CROP_ADDED,
  EVENT_KIND.HARVEST_LOGGED,
  EVENT_KIND.READY_TO_SELL_MARKED,
]);
const HEALTH_KINDS = new Set([
  EVENT_KIND.SCAN_COMPLETED,
  EVENT_KIND.SCAN_NEEDS_REVIEW,
  EVENT_KIND.HEALTH_SCORE_CHANGED,
]);
const TREATMENT_KINDS = new Set([EVENT_KIND.TREATMENT_APPLIED]);
const YIELD_KINDS     = new Set([EVENT_KIND.YIELD_FORECAST_GENERATED]);

function _phase(eventType) {
  if (eventType === EVENT_KIND.PLANTING_LOGGED
   || eventType === EVENT_KIND.CROP_ADDED)         return 'planting';
  if (eventType === EVENT_KIND.HARVEST_LOGGED)     return 'harvest';
  if (eventType === EVENT_KIND.READY_TO_SELL_MARKED) return 'ready_to_sell';
  return 'growth';
}

export function buildCropMemory(ctx) {
  return _safe(() => {
    const c      = _isObj(ctx) ? ctx : {};
    const events = _arr(c.events);
    const cropId = _str(c.cropId);

    const initial = Object.freeze({
      lifecycleTimeline: [],
      healthTimeline:    [],
      treatmentTimeline: [],
      yieldTimeline:     [],
    });

    const acc = replayEvents(events, initial, (state, e) => {
      if (cropId && _str(e.cropId) !== cropId) return state;
      const kind = _str(e.eventType);
      const stamp = {
        eventId:   e.eventId,
        timestamp: e.timestamp,
        kind,
        metadata:  e.metadata || Object.freeze({}),
      };
      const next = {
        lifecycleTimeline: state.lifecycleTimeline.slice(),
        healthTimeline:    state.healthTimeline.slice(),
        treatmentTimeline: state.treatmentTimeline.slice(),
        yieldTimeline:     state.yieldTimeline.slice(),
      };
      if (LIFECYCLE_KINDS.has(kind)) {
        next.lifecycleTimeline.push(Object.freeze({
          ...stamp, phase: _phase(kind),
        }));
      }
      if (HEALTH_KINDS.has(kind)) {
        const score = _num(e.metadata && e.metadata.healthScore);
        next.healthTimeline.push(Object.freeze({
          ...stamp,
          healthScore: score,
          confidence:  _num(e.metadata && e.metadata.confidence),
        }));
      }
      if (TREATMENT_KINDS.has(kind)) {
        next.treatmentTimeline.push(Object.freeze({
          ...stamp,
          treatmentKind: _str(e.metadata && e.metadata.treatmentKind),
        }));
      }
      if (YIELD_KINDS.has(kind)) {
        next.yieldTimeline.push(Object.freeze({
          ...stamp,
          forecast: _num(e.metadata && e.metadata.forecast),
        }));
      }
      return next;
    });

    return Object.freeze({
      runtimeVersion:    CROP_MEMORY_VERSION,
      cropId,
      lifecycleTimeline: Object.freeze(acc.lifecycleTimeline),
      healthTimeline:    Object.freeze(acc.healthTimeline),
      treatmentTimeline: Object.freeze(acc.treatmentTimeline),
      yieldTimeline:     Object.freeze(acc.yieldTimeline),
    });
  }, Object.freeze({
    runtimeVersion: CROP_MEMORY_VERSION,
    cropId: '',
    lifecycleTimeline: Object.freeze([]),
    healthTimeline:    Object.freeze([]),
    treatmentTimeline: Object.freeze([]),
    yieldTimeline:     Object.freeze([]),
  }));
}
