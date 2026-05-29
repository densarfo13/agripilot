/**
 * src/runtime/intelligenceLoop/ActionEngine.ts — Phase 4.
 *
 * Emits frozen DESCRIPTORS for tasks / timeline events /
 * artifacts / briefing items / notification candidates that
 * the calling runtime (Plant Runtime + Artifact Runtime +
 * Offline Runtime) PERSISTS. This engine never writes
 * directly — wave-5 single-writer invariant.
 */

import { LOOP_PRIORITY } from './intelligenceLoopContracts';

export const LOOP_ACTION_ENGINE_VERSION = 'loop-action-v1';

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _arr  = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const _str  = (v: unknown): string => (typeof v === 'string' ? v : '');
const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

/**
 * Convert a decision envelope into the action descriptors a
 * caller can persist. Pure function — no side effects.
 */
export function actOnDecision(decision: any,
                                orientation: any,
                                observation: any) {
  return _safe(() => {
    if (!_isObj(decision)) return _emptyAction();
    const d = decision as any;
    const o = _isObj(orientation) ? orientation as any : {};
    const obs = _isObj(observation) ? observation as any : {};
    const plantId = _str(d.plantId);
    const scanId  = _str(obs.scanId);
    const issue   = o.likelyIssue || null;

    // ─── Tasks ───────────────────────────────────────────
    const tasks: any[] = [];
    if (d.recommendationTitle) {
      tasks.push(Object.freeze({
        labelKey:     'loop.task.' + (d.reason || 'baseline'),
        labelDefault: _str(d.recommendationTitle),
        priority:     _str(d.priority) || LOOP_PRIORITY.CAN_WAIT,
        source:       'intelligence_loop',
      }));
    }

    // ─── Timeline events ─────────────────────────────────
    const timelineEvents: any[] = [];
    if (scanId) {
      timelineEvents.push(Object.freeze({
        kind:    'ScanCompleted',
        plantId,
        scanId,
        summary: 'Scan completed and analysed via intelligence loop',
        source:  'intelligence_loop',
      }));
    }
    if (issue && _str(issue.kind) === 'disease') {
      timelineEvents.push(Object.freeze({
        kind:    'DiseaseDetected',
        plantId,
        diseaseId: _str(issue.id),
        summary: 'Likely ' + _str(issue.name) + ' (intelligence loop)',
        source:  'intelligence_loop',
      }));
    }
    if (issue && _str(issue.kind) === 'pest') {
      timelineEvents.push(Object.freeze({
        kind:    'PestDetected',
        plantId,
        pestId:  _str(issue.id),
        summary: 'Likely ' + _str(issue.name) + ' (intelligence loop)',
        source:  'intelligence_loop',
      }));
    }

    // ─── Artifact descriptors ────────────────────────────
    // The Plant Runtime + Artifact Runtime do the actual
    // emission via createScanArtifact / createPlantArtifact;
    // we describe what should be created.
    const artifacts: any[] = [];
    if (scanId) {
      artifacts.push(Object.freeze({
        type: 'ScanArtifact', scanId, plantId,
        source: 'intelligence_loop',
      }));
    }
    if (plantId && d.reason === 'plant_identified') {
      artifacts.push(Object.freeze({
        type: 'PlantArtifact', plantId, scanId,
        source: 'intelligence_loop',
      }));
    }

    // ─── Briefing item ───────────────────────────────────
    const briefingItem = d.recommendationTitle ? Object.freeze({
      titleKey:     'loop.briefing.' + (d.reason || 'baseline'),
      titleDefault: _str(d.recommendationTitle),
      bodyKey:      'loop.briefing.' + (d.reason || 'baseline') + '.body',
      bodyDefault:  _str(d.recommendationBody),
      priority:     _str(d.priority),
      plantId,
      source:       'intelligence_loop',
    }) : null;

    // ─── Notification candidate ──────────────────────────
    // We never schedule directly — we DESCRIBE candidates the
    // notification runtime can opt into.
    const notification = _str(d.priority) === LOOP_PRIORITY.DO_NOW
      ? Object.freeze({
          kind: 'priority_recommendation',
          titleKey:     'loop.notification.doNow',
          titleDefault: _str(d.recommendationTitle),
          bodyKey:      'loop.notification.doNow.body',
          bodyDefault:  _str(d.recommendationBody),
          plantId,
          source:       'intelligence_loop',
        })
      : null;

    return Object.freeze({
      runtimeVersion: LOOP_ACTION_ENGINE_VERSION,
      phase: 'act',
      plantId,
      tasks:          Object.freeze(tasks),
      timelineEvents: Object.freeze(timelineEvents),
      artifacts:      Object.freeze(artifacts),
      briefingItem,
      notification,
    });
  }, _emptyAction());
}

function _emptyAction() {
  return Object.freeze({
    runtimeVersion: LOOP_ACTION_ENGINE_VERSION,
    phase: 'act',
    plantId: '',
    tasks: Object.freeze([]),
    timelineEvents: Object.freeze([]),
    artifacts: Object.freeze([]),
    briefingItem: null as any,
    notification: null as any,
  });
}
