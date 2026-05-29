/**
 * runtime/flywheel/farmMemoryGraph.js — Phase 14 farm memory.
 *
 *   import { buildFarmMemory }
 *     from 'src/runtime/flywheel/farmMemoryGraph.js';
 *
 *   const memory = buildFarmMemory({ events, farmId });
 *
 * What this is
 * ────────────
 *   Materialized view of "everything that ever happened on this
 *   farm" by replaying the wave-5 event log. Returns a frozen
 *   envelope:
 *
 *     {
 *       farmId,
 *       plantings:     [...],
 *       scans:         [...],
 *       treatments:    [...],
 *       tasks:         [...],
 *       weatherEvents: [...],
 *       harvests:      [...],
 *       yields:        [...],
 *       counts:        { plantings, scans, treatments, ... },
 *       runtimeVersion,
 *     }
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • No persistence writes. No fetch.
 *   • Composition-only — reads events; never mutates them.
 */

import { EVENT_KIND } from './eventEngine.js';
import { replayEvents } from './eventStore.js';

export const FARM_MEMORY_VERSION = 'farm-memory-v1';

const _isObj = (v) => v != null && typeof v === 'object';
const _arr   = (v) => (Array.isArray(v) ? v : []);
const _str   = (v) => (typeof v === 'string' ? v : '');
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };

const PLANTING_KINDS  = new Set([EVENT_KIND.PLANTING_LOGGED, EVENT_KIND.CROP_ADDED]);
const SCAN_KINDS      = new Set([EVENT_KIND.SCAN_COMPLETED, EVENT_KIND.SCAN_NEEDS_REVIEW]);
const TREATMENT_KINDS = new Set([EVENT_KIND.TREATMENT_APPLIED]);
const TASK_KINDS      = new Set([EVENT_KIND.TASK_COMPLETED]);
const WEATHER_KINDS   = new Set([EVENT_KIND.WEATHER_EVENT_RECORDED,
                                  EVENT_KIND.WEATHER_ALERT_VIEWED]);
const HARVEST_KINDS   = new Set([EVENT_KIND.HARVEST_LOGGED]);
const YIELD_KINDS     = new Set([EVENT_KIND.YIELD_FORECAST_GENERATED]);

function _entry(e, extra) {
  return Object.freeze({
    eventId:   e.eventId,
    timestamp: e.timestamp,
    cropId:    _str(e.cropId),
    metadata:  e.metadata || Object.freeze({}),
    ...(extra || {}),
  });
}

export function buildFarmMemory(ctx) {
  return _safe(() => {
    const c = _isObj(ctx) ? ctx : {};
    const events = _arr(c.events);
    const farmId = _str(c.farmId);

    const initial = Object.freeze({
      plantings:     [],
      scans:         [],
      treatments:    [],
      tasks:         [],
      weatherEvents: [],
      harvests:      [],
      yields:        [],
    });

    const acc = replayEvents(events, initial, (state, e) => {
      if (farmId && _str(e.farmId) && e.farmId !== farmId) return state;
      const kind = _str(e.eventType);
      const next = {
        plantings:     state.plantings.slice(),
        scans:         state.scans.slice(),
        treatments:    state.treatments.slice(),
        tasks:         state.tasks.slice(),
        weatherEvents: state.weatherEvents.slice(),
        harvests:      state.harvests.slice(),
        yields:        state.yields.slice(),
      };
      if (PLANTING_KINDS.has(kind))  next.plantings.push(_entry(e));
      if (SCAN_KINDS.has(kind))      next.scans.push(_entry(e,
        { needsReview: kind === EVENT_KIND.SCAN_NEEDS_REVIEW }));
      if (TREATMENT_KINDS.has(kind)) next.treatments.push(_entry(e));
      if (TASK_KINDS.has(kind))      next.tasks.push(_entry(e));
      if (WEATHER_KINDS.has(kind))   next.weatherEvents.push(_entry(e));
      if (HARVEST_KINDS.has(kind))   next.harvests.push(_entry(e));
      if (YIELD_KINDS.has(kind))     next.yields.push(_entry(e));
      return next;
    });

    return Object.freeze({
      runtimeVersion: FARM_MEMORY_VERSION,
      farmId,
      plantings:     Object.freeze(acc.plantings),
      scans:         Object.freeze(acc.scans),
      treatments:    Object.freeze(acc.treatments),
      tasks:         Object.freeze(acc.tasks),
      weatherEvents: Object.freeze(acc.weatherEvents),
      harvests:      Object.freeze(acc.harvests),
      yields:        Object.freeze(acc.yields),
      counts: Object.freeze({
        plantings:     acc.plantings.length,
        scans:         acc.scans.length,
        treatments:    acc.treatments.length,
        tasks:         acc.tasks.length,
        weatherEvents: acc.weatherEvents.length,
        harvests:      acc.harvests.length,
        yields:        acc.yields.length,
      }),
    });
  }, Object.freeze({
    runtimeVersion: FARM_MEMORY_VERSION,
    farmId: '',
    plantings: Object.freeze([]),
    scans: Object.freeze([]),
    treatments: Object.freeze([]),
    tasks: Object.freeze([]),
    weatherEvents: Object.freeze([]),
    harvests: Object.freeze([]),
    yields: Object.freeze([]),
    counts: Object.freeze({
      plantings: 0, scans: 0, treatments: 0, tasks: 0,
      weatherEvents: 0, harvests: 0, yields: 0,
    }),
  }));
}
