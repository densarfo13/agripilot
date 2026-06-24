/**
 * FarmBrainIngestionGuard.ts — sprint #214 §7/§8.
 *
 * Decides whether a completed scan may be written into FarmBrain /
 * journal / timeline. Composes the trust gate; a blocked scan returns
 * a FarmBrainIngestionSkipped envelope with the reason so the caller
 * can route it to the review queue instead of polluting farm history.
 *
 * Pure. Never throws. Pins window.__farmBrainIngestionHealth().
 */

import { evaluateScanTrust } from './ScanTrustGate';

export const FARMBRAIN_INGESTION_GUARD_VERSION = 'farmbrain-ingestion-guard-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

export interface IngestionDecision {
  ingest:    boolean;
  skipped:   boolean;
  skipReason: string | null;       // 'FarmBrainIngestionSkipped:<reason>'
  memoryRejectedReason: string | null;  // sprint #215 §4
  toReviewQueue: boolean;
}

// Sprint #215 §4 — memory quality floor: confidence >= 70 (trust gate)
// AND photo quality >= 75 when measured.
const MEMORY_QUALITY_FLOOR = 75;

export function shouldIngestScan(result: any): Readonly<IngestionDecision> {
  return _safe(() => {
    const gate = evaluateScanTrust({
      confidencePct: result && result.confidencePct,
      confidence: result && result.confidence,
      topCandidates: result && result.topCandidates,
      plantName: result && result.plantName,
      issueType: result && result.issueType,
      status: result && result.status,
      nextAction: result && result.nextAction,
      hasPhoto: !!(result && (result.imageUrl || result.scanId)),
      photoQuality: result && result.photoQuality,
    });
    // §4 — quality floor (only when a real quality score exists).
    const q = result && result.photoQuality;
    const qScore = (q && typeof q.qualityScore === 'number') ? q.qualityScore : null;
    const qualityTooLow = qScore != null && qScore < MEMORY_QUALITY_FLOOR;

    if (gate.allowFarmBrainIngestion && !qualityTooLow) {
      return Object.freeze({
        ingest: true, skipped: false, skipReason: null,
        memoryRejectedReason: null, toReviewQueue: false,
      });
    }
    const reason = qualityTooLow ? 'quality_below_75' : (gate.gateReasons[0] || 'low_confidence');
    return Object.freeze({
      ingest: false, skipped: true,
      skipReason: 'FarmBrainIngestionSkipped:' + reason,
      memoryRejectedReason: reason,
      toReviewQueue: !!(result && (result.imageUrl || result.scanId)),
    });
  }, Object.freeze({
    ingest: false, skipped: true,
    skipReason: 'FarmBrainIngestionSkipped:guard_error',
    memoryRejectedReason: 'guard_error', toReviewQueue: false,
  }));
}

export function buildFarmBrainIngestionHealth(): Readonly<{
  ok: boolean; runtimeVersion: string;
  farmBrainProtected: true; lowConfidenceBlocked: true;
}> {
  return Object.freeze({
    ok: true, runtimeVersion: FARMBRAIN_INGESTION_GUARD_VERSION,
    farmBrainProtected: true as const,
    lowConfidenceBlocked: true as const,
  });
}

let _installed = false;
export function installFarmBrainIngestionHealthGlobal(): void {
  if (_installed) return;
  if (_safe(() => typeof window === 'undefined', true)) return;
  _safe(() => {
    Object.defineProperty(window as any, '__farmBrainIngestionHealth', {
      configurable: true, enumerable: false, writable: false,
      value: () => buildFarmBrainIngestionHealth(),
    });
    // Callable global so core .js (scanPersistenceBridge) can consult
    // the guard without an import cycle into the runtime layer.
    Object.defineProperty(window as any, '__farrowayShouldIngestScan', {
      configurable: true, enumerable: false, writable: false,
      value: (result: any) => shouldIngestScan(result),
    });
    _installed = true;
  }, undefined);
}

export const _internal = Object.freeze({
  shouldIngestScan, buildFarmBrainIngestionHealth, installFarmBrainIngestionHealthGlobal,
});
export default shouldIngestScan;
