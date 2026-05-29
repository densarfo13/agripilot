/**
 * src/runtime/intelligenceLoop/IntelligenceLoopRuntime.ts —
 * Composite that wires every phase together.
 *
 *   import {
 *     runIntelligenceLoop, fromScan,
 *     INTELLIGENCE_LOOP_RUNTIME_VERSION,
 *   } from 'src/runtime/intelligenceLoop/IntelligenceLoopRuntime';
 *
 *   const loop = fromScan({
 *     scanResult, userId, farmId, gardenId, plant,
 *     weather, region, history, timeline, taskStatus, offline,
 *   });
 *   // → { loopId, source, observation, orientation, decision,
 *   //     actions, artifacts, timelineEvents, outcome,
 *   //     createdAt, idempotencyKey }
 *
 * Strict-rule audit
 *   • Pure runtime. Composition over the 5 phase engines.
 *   • Never throws. SSR-safe.
 *   • No camera. No fetch. No persistence.
 */

import {
  INTELLIGENCE_LOOP_VERSION, LOOP_SOURCES,
  loopIdempotencyKey,
} from './intelligenceLoopContracts';
import { observeLoopInputs } from './ObservationEngine';
import { orientLoopObservation } from './OrientationEngine';
import { decideRecommendation } from './DecisionEngine';
import { actOnDecision } from './ActionEngine';

export const INTELLIGENCE_LOOP_RUNTIME_VERSION = INTELLIGENCE_LOOP_VERSION;

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _arr  = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const _str  = (v: unknown): string => (typeof v === 'string' ? v : '');
const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _now = () => _safe(() => new Date().toISOString(), '');

function _hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

const _validSources = new Set<string>(LOOP_SOURCES as readonly string[]);

interface LoopCtx {
  source:      string;
  userId:      string;
  farmId?:     string;
  gardenId?:   string;
  scanResult?: any;
  plant?:      any;
  weather?:    any;
  region?:     string;
  history?:    ReadonlyArray<any>;
  timeline?:   ReadonlyArray<any>;
  taskStatus?: ReadonlyArray<any>;
  offline?:    boolean;
}

/**
 * Run the full Observe → Orient → Decide → Act loop and emit
 * the canonical envelope. Caller persists via Plant Runtime +
 * Artifact Runtime + Offline Runtime.
 */
export function runIntelligenceLoop(ctx: LoopCtx) {
  return _safe(() => {
    if (!_isObj(ctx)) return _emptyLoop();
    const source = _str(ctx.source);
    if (!_validSources.has(source)) return _emptyLoop();

    const observation = observeLoopInputs({
      scanResult: ctx.scanResult, plant: ctx.plant,
      weather:    ctx.weather,    region: ctx.region,
      history:    ctx.history,    timeline: ctx.timeline,
      taskStatus: ctx.taskStatus, offline: ctx.offline,
    });
    const orientation = orientLoopObservation(observation);
    const decision    = decideRecommendation(orientation);
    const actions     = actOnDecision(decision, orientation, observation);

    const createdAt = _now();
    const scanId    = _str((observation as any).scanId);
    const plantId   = _str((decision as any).plantId);
    const entityId  = scanId || plantId || _str(ctx.userId);
    const dedupHash = _hash(source + '|' + entityId + '|' + createdAt);
    const loopId    = 'loop_' + dedupHash;
    const idempotencyKey = loopIdempotencyKey(source, entityId, dedupHash);

    return Object.freeze({
      runtimeVersion: INTELLIGENCE_LOOP_RUNTIME_VERSION,
      loopId,
      userId:    _str(ctx.userId),
      farmId:    _str(ctx.farmId),
      gardenId:  _str(ctx.gardenId),
      plantId,
      scanId,
      source,
      observation,
      orientation,
      decision,
      actions:        (actions as any).tasks,
      artifacts:      (actions as any).artifacts,
      timelineEvents: (actions as any).timelineEvents,
      briefingItem:   (actions as any).briefingItem,
      notification:   (actions as any).notification,
      outcome:        null,        // populated once the user acts
      createdAt,
      idempotencyKey,
    });
  }, _emptyLoop());
}

/**
 * Convenience entry point for the spec's
 * IntelligenceLoopRuntime.fromScan(scanResult).
 */
export function fromScan(ctx: Omit<LoopCtx, 'source'> & {
                              scanResult: any }) {
  return runIntelligenceLoop({ ...ctx, source: 'scan' });
}

function _emptyLoop() {
  const createdAt = _now();
  return Object.freeze({
    runtimeVersion: INTELLIGENCE_LOOP_RUNTIME_VERSION,
    loopId:    '',
    userId:    '', farmId: '', gardenId: '',
    plantId:   '', scanId: '',
    source:    '',
    observation: null,  orientation: null,
    decision:    null,  actions:     Object.freeze([]),
    artifacts:   Object.freeze([]),
    timelineEvents: Object.freeze([]),
    briefingItem: null, notification: null,
    outcome:     null,
    createdAt,
    idempotencyKey: '',
  });
}
