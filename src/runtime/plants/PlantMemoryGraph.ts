/**
 * src/runtime/plants/PlantMemoryGraph.ts — per-plant memory.
 *
 *   import {
 *     buildPlantMemory, PLANT_MEMORY_VERSION,
 *   } from 'src/runtime/plants/PlantMemoryGraph';
 *
 *   buildPlantMemory({ plant, events })
 *     → 6 timelines + counts
 *
 * What this is
 * ────────────
 *   Materialized view of "everything that ever happened to this
 *   plant." Replays the caller-supplied wave-5 event log + the
 *   plant's own history array into 6 timelines:
 *
 *     scans            — every scan attached to this plant
 *     tasks            — every task completed
 *     recommendations  — every recommendation surfaced
 *     treatments       — applied treatments (from event log)
 *     stages           — every lifecycle transition
 *     healthSnapshots  — every health score snapshot
 *
 *   Caller persists the source event log + plant history; this
 *   engine never writes.
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • Composition-only over the wave-5 event log + plant.history.
 *   • No persistence writes.
 *   • Frozen envelopes.
 */

import { EVENT_KIND }   from '../flywheel/eventEngine.js';
import { replayEvents } from '../flywheel/eventStore.js';
import {
  ManagedPlant,
} from './PlantRuntime';

export const PLANT_MEMORY_VERSION = 'plant-memory-v1';

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _arr   = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const _str   = (v: unknown): string => (typeof v === 'string' ? v : '');
const _safe  = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

const SCAN_KINDS = new Set<string>([
  (EVENT_KIND as any).SCAN_COMPLETED,
  (EVENT_KIND as any).SCAN_NEEDS_REVIEW,
]);
const TASK_KINDS = new Set<string>([
  (EVENT_KIND as any).TASK_COMPLETED,
]);
const REC_KINDS = new Set<string>([
  (EVENT_KIND as any).RECOMMENDATION_SHOWN,
  (EVENT_KIND as any).RECOMMENDATION_ACCEPTED,
  (EVENT_KIND as any).RECOMMENDATION_IGNORED,
  (EVENT_KIND as any).RECOMMENDATION_COMPLETED,
]);
const TREATMENT_KINDS = new Set<string>([
  (EVENT_KIND as any).TREATMENT_APPLIED,
]);

function _eventEntry(e: any) {
  return Object.freeze({
    eventId:   _str(e.eventId),
    timestamp: _str(e.timestamp),
    kind:      _str(e.eventType),
    metadata:  _isObj(e.metadata) ? e.metadata : Object.freeze({}),
  });
}

interface MemoryCtx {
  plant?:  ManagedPlant;
  events?: any[];
}

export function buildPlantMemory(ctx: MemoryCtx) {
  return _safe(() => {
    const c     = _isObj(ctx) ? ctx : {} as MemoryCtx;
    const plant = _isObj(c.plant) ? c.plant : null;
    const events = _arr(c.events);
    const plantId = plant ? plant.id : '';
    // Filter events to ONLY this plant's history. We accept both
    // events tagged with metadata.plantId AND legacy events tagged
    // by cropId so older crop-scoped logs replay correctly.
    const ownEvents = events.filter((e: any) => {
      if (!_isObj(e)) return false;
      const md = _isObj(e.metadata) ? e.metadata : null;
      if (!md) return false;
      return _str(md.plantId) === plantId
          || (plant && _str(md.cropId)
                === _str((plant as any).catalogId)
                && _str((plant as any).catalogId) !== '');
    });

    const initial = Object.freeze({
      scans:           [] as any[],
      tasks:           [] as any[],
      recommendations: [] as any[],
      treatments:      [] as any[],
    });

    const replayed = replayEvents(ownEvents, initial, (state: any, e: any) => {
      const kind = _str(e.eventType);
      const next = {
        scans:           state.scans.slice(),
        tasks:           state.tasks.slice(),
        recommendations: state.recommendations.slice(),
        treatments:      state.treatments.slice(),
      };
      if (SCAN_KINDS.has(kind))      next.scans.push(_eventEntry(e));
      if (TASK_KINDS.has(kind))      next.tasks.push(_eventEntry(e));
      if (REC_KINDS.has(kind))       next.recommendations.push(_eventEntry(e));
      if (TREATMENT_KINDS.has(kind)) next.treatments.push(_eventEntry(e));
      return next;
    });

    // Lifecycle + health timelines come from plant.history (the
    // PlantRuntime appends them — see appendPlantHistory).
    const history = plant ? _arr((plant as any).history) : [];
    const stages: any[] = [];
    const healthSnapshots: any[] = [];
    for (const h of history) {
      if (!_isObj(h)) continue;
      if (h.kind === 'stage_advanced'
       || h.kind === 'registered_from_scan'
       || h.kind === 'created_manually') {
        stages.push(Object.freeze({
          at: _str(h.at), kind: _str(h.kind),
          from: _str(h.from), to: _str(h.to),
        }));
      } else if (h.kind === 'health_snapshot') {
        healthSnapshots.push(Object.freeze({
          at:    _str(h.at),
          score: typeof h.score === 'number' ? h.score : null,
          risk:  typeof h.risk  === 'number' ? h.risk  : null,
          band:  _str(h.band),
        }));
      }
    }

    return Object.freeze({
      runtimeVersion: PLANT_MEMORY_VERSION,
      plantId,
      scans:           Object.freeze(replayed.scans),
      tasks:           Object.freeze(replayed.tasks),
      recommendations: Object.freeze(replayed.recommendations),
      treatments:      Object.freeze(replayed.treatments),
      stages:          Object.freeze(stages),
      healthSnapshots: Object.freeze(healthSnapshots),
      counts: Object.freeze({
        scans:           replayed.scans.length,
        tasks:           replayed.tasks.length,
        recommendations: replayed.recommendations.length,
        treatments:      replayed.treatments.length,
        stages:          stages.length,
        healthSnapshots: healthSnapshots.length,
      }),
    });
  }, Object.freeze({
    runtimeVersion: PLANT_MEMORY_VERSION,
    plantId: '',
    scans:           Object.freeze([]),
    tasks:           Object.freeze([]),
    recommendations: Object.freeze([]),
    treatments:      Object.freeze([]),
    stages:          Object.freeze([]),
    healthSnapshots: Object.freeze([]),
    counts: Object.freeze({
      scans: 0, tasks: 0, recommendations: 0,
      treatments: 0, stages: 0, healthSnapshots: 0,
    }),
  }));
}
