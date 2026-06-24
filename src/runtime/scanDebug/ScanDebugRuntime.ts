/**
 * ScanDebugRuntime.ts — sprint #219.
 *
 * Captures the last scan's end-to-end pipeline state so a "Scan
 * unclear" can be root-caused with REAL data instead of guessed at.
 * The detection engine calls recordScanDebug(...) after every scan;
 * window.__scanDebug() returns the captured trace.
 *
 * The single most useful field is `failureReason`: when candidates are
 * empty it distinguishes "provider returned nothing / not configured"
 * (the prime cause of a clear photo reading unclear) from a genuine
 * unidentifiable image — so the operator knows whether to check the
 * PLANT_ID_API_KEY env or the photo.
 *
 * Read-only capture. No PII (no raw filename / coords). Never throws.
 */

export const SCAN_DEBUG_VERSION = 'scan-debug-runtime-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _arr = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const _str = (v: unknown): string => (typeof v === 'string' ? v : '');
const _num = (v: unknown): number | null =>
  (typeof v === 'number' && Number.isFinite(v) ? v : null);

interface ScanDebugTrace {
  runtimeVersion: string;
  capturedAt: string | null;
  imageId: string | null;
  imageQuality: any;
  photoQuality: any;
  providerStatus: 'ok' | 'no_result' | 'unavailable' | 'unknown';
  providerLatency: number | null;        // ms when the server reports it; else null
  providerResponse: Readonly<{
    plantName: string;
    candidateCount: number;
    confidencePct: number | null;
    objectType: string;
    classifierAvailable: boolean | null;   // null = unknown
    serverReason: string | null;
  }>;
  candidates: ReadonlyArray<any>;
  topCandidate: any;
  confidence: number | null;
  mythosDecision: any;
  trustGate: any;
  reviewQueueDecision: 'review' | 'skip' | 'blocked';
  uiDecision: Readonly<{ plantShown: string; createTaskVisible: boolean; coachCardShown: boolean }>;
  failureReason: string | null;
}

let _last: ScanDebugTrace | null = null;

/** Derive WHY a scan read unclear (or null when it was fine). */
function _failureReason(env: any, candidateCount: number, plantName: string): string | null {
  const clear = (plantName && plantName !== 'Scan unclear' && plantName !== 'Needs confirmation');
  if (clear || candidateCount > 0) return null;
  // No candidates + no name. Distinguish the causes.
  const classifierAvailable = _classifierAvailable(env);
  if (classifierAvailable === false) return 'provider_unconfigured_or_unavailable';
  if (env && env.error) return 'provider_error:' + _str(env.error).slice(0, 60);
  if (env && (env.consensus && env.consensus.ok === false)) return 'both_providers_returned_no_identification';
  return 'no_candidates_from_providers';
}

function _classifierAvailable(env: any): boolean | null {
  return _safe(() => {
    if (env && typeof env.realClassifierAvailable === 'boolean') return env.realClassifierAvailable;
    if (env && env.classifierAvailability && typeof env.classifierAvailability.available === 'boolean') {
      return env.classifierAvailability.available;
    }
    // Probe the v8 runtime health if present.
    const fn = (typeof window !== 'undefined') && (window as any).__scanRuntimeHealthV8;
    if (typeof fn === 'function') {
      const v = fn();
      if (v && v.classifierAvailability && typeof v.classifierAvailability.available === 'boolean') {
        return v.classifierAvailability.available;
      }
    }
    return null;
  }, null);
}

export function recordScanDebug(input: {
  env?: any;                 // the apiResult / result envelope
  photoQuality?: any;
  trustGate?: any;
  capturedAt?: string;
}): void {
  _safe(() => {
    const env = input.env || {};
    const candidates = _arr(env.topCandidates);
    const plantName = _str(env.plantName)
      || _str(candidates[0] && (candidates[0].commonName || candidates[0].name))
      || (candidates.length > 0 ? 'Needs confirmation' : 'Scan unclear');
    const confidencePct = _num(env.confidencePct) ?? _num(env.confidence);
    const tg = input.trustGate || {};
    const plantUnknown = plantName === 'Scan unclear' || plantName === 'Needs confirmation' || !plantName;

    const classifierAvailable = _classifierAvailable(env);
    const providerStatus: ScanDebugTrace['providerStatus'] =
      classifierAvailable === false ? 'unavailable'
      : candidates.length > 0 ? 'ok'
      : (_str(env.plantName) ? 'ok' : 'no_result');
    const gateStatus = _str(tg.gateStatus);
    const reviewQueueDecision: ScanDebugTrace['reviewQueueDecision'] =
      gateStatus === 'review' ? 'review' : gateStatus === 'blocked' ? 'blocked' : 'skip';

    _last = Object.freeze({
      runtimeVersion: SCAN_DEBUG_VERSION,
      capturedAt: _str(input.capturedAt) || null,
      imageId: _str(env.scanId || env.imageId || env.id) || null,
      imageQuality: env.imageQuality || null,
      photoQuality: input.photoQuality || null,
      providerStatus,
      providerLatency: _num(env.providerLatencyMs ?? env.latencyMs),
      providerResponse: Object.freeze({
        plantName: _str(env.plantName),
        candidateCount: candidates.length,
        confidencePct,
        objectType: _str(env.objectType),
        classifierAvailable,
        serverReason: _str(env.reason || (env.consensus && env.consensus.symptom)) || null,
      }),
      candidates: Object.freeze(candidates.slice(0, 5)),
      topCandidate: candidates[0] ? Object.freeze(candidates[0]) : null,
      confidence: confidencePct,
      mythosDecision: env.mythosDecision || null,
      trustGate: tg,
      reviewQueueDecision,
      uiDecision: Object.freeze({
        plantShown: plantName,
        // Create Task is visible ONLY when the trust gate allows it.
        createTaskVisible: !!tg.allowTaskCreation,
        // The coach card shows when plant creation is blocked.
        coachCardShown: !tg.allowPlantCreation,
      }),
      failureReason: _failureReason(env, candidates.length, _str(env.plantName)),
    });
  }, undefined);
}

export function buildScanDebug(): Readonly<ScanDebugTrace> | null { return _last; }

let _installed = false;
export function installScanDebugGlobal(): void {
  if (_installed) return;
  if (_safe(() => typeof window === 'undefined', true)) return;
  _safe(() => {
    Object.defineProperty(window as any, '__scanDebug', {
      configurable: true, enumerable: false, writable: false,
      value: () => buildScanDebug(),
    });
    // recordScanDebug callable from the core .js engine without an import cycle.
    Object.defineProperty(window as any, '__farrowayRecordScanDebug', {
      configurable: true, enumerable: false, writable: false,
      value: (i: any) => recordScanDebug(i),
    });
    _installed = true;
  }, undefined);
}

export const _internal = Object.freeze({ recordScanDebug, buildScanDebug, installScanDebugGlobal });
export default installScanDebugGlobal;
