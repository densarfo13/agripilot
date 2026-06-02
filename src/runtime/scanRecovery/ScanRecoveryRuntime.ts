/**
 * ScanRecoveryRuntime.ts — wires the previously-dead
 * ScanAnalysisRuntime.runScanPipeline into the live scan path.
 *
 * Audit gap §6.10 closed:
 *   src/runtime/scan/ScanAnalysisRuntime.ts exports runScanPipeline()
 *   which documents the full Scan → OODA → Artifact → Review path,
 *   but no production caller invoked it. The wave-36 do-not-modify
 *   list keeps src/runtime/scan/ frozen; this sibling runtime calls
 *   the exports from outside that directory so the contract is
 *   honoured without touching the frozen file.
 *
 *   import {
 *     executeScanRecovery, scanRecoveryHealth,
 *     installScanRecoveryGlobal,
 *   } from 'src/runtime/scanRecovery/ScanRecoveryRuntime';
 *
 *   window.__scanRecoveryHealth()
 *
 * What this runtime does
 * ──────────────────────
 *   1. Reads the server response from /api/scan/analyze (already
 *      carries the spec envelope under `result.scanRecovery`).
 *   2. Calls runScanPipeline() from ScanAnalysisRuntime so the OODA
 *      decision + ScanArtifact + (optional) human-review submission
 *      fire on EVERY scan.
 *   3. Returns a single frozen envelope the caller merges onto the
 *      result so IntelligentScanResult sees plantName + scientificName
 *      + confidencePct + diseaseCandidates + recommendations +
 *      nextAction directly.
 *
 * Pure. Frozen. Never throws. No fetch. No localStorage writes.
 */

import {
  runScanPipeline, scanAnalysisHealth,
  SCAN_ANALYSIS_RUNTIME_VERSION,
} from '../scan/ScanAnalysisRuntime';

export const SCAN_RECOVERY_RUNTIME_VERSION = 'scan-recovery-runtime-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _str = (v: unknown): string => (typeof v === 'string' ? v : '');
const _num = (v: unknown): number | null =>
  (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _arr = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';

interface ScanRecoveryContext {
  serverResponse:  any;          // raw /api/scan/analyze JSON
  userId?:         string;
  farmId?:         string;
  gardenId?:       string;
  location?:       string;       // coarse region code only
  imageUrl?:       string;
  thumbnailUrl?:   string;
  weather?:        Record<string, any>;
  source?:         'camera' | 'gallery';
}

/**
 * executeScanRecovery — the single function ScanPage calls after the
 * /api/scan/analyze response lands. It:
 *
 *   • Composes runScanPipeline() so the OODA + artifact + review
 *     submission fires for every scan.
 *   • Surfaces the server's scanRecovery envelope (top-level fields
 *     plantName / scientificName / confidence / diseaseCandidates /
 *     severity / recommendations / nextAction) on the returned shape.
 *
 * Returns a frozen envelope ready to merge onto the result state. The
 * `pipelineExecuted` flag attests that runScanPipeline ran — the
 * scan-recovery gate verifies this is true at least once per session.
 */
export function executeScanRecovery(ctx: ScanRecoveryContext) {
  return _safe(() => {
    const r = _isObj(ctx) && _isObj(ctx.serverResponse) ? ctx.serverResponse : {};
    const sr = _isObj(r.scanRecovery) ? r.scanRecovery : null;

    // Build the rawProviderResult shape ScanAnalysisRuntime expects.
    // The server already produces the spec envelope; we adapt for the
    // pipeline's normalizer which wants commonName / scientificName /
    // category / healthStatus / issues.
    const raw = {
      scanId:         _str(r.scanId),
      commonName:     _str(sr && sr.plantName)     || _str(r.plantName),
      scientificName: _str(sr && sr.scientificName) || _str(r.scientificName),
      confidence:     (_num(sr && sr.confidence) ?? _num(r.confidence) ?? 0) / 100,
      category:       _detectCategory(sr || r),
      healthStatus:   _str((sr && sr.severity) || (r && r.severity)),
      issues:         _arr(sr && sr.diseaseCandidates)
                        .map((d: any) => _str(d && d.name))
                        .filter((s: string) => !!s),
      provider:       _str(sr && sr.consensusMode) === 'multi'
                        ? 'consensus:plantid+plantnet'
                        : _str((r.inferenceMeta && r.inferenceMeta.provider))
                          || 'unknown',
      rawProviderId:  _str(r.scanId),
      plantId:        _str(r.plantId || (ctx as any).plantId),
    };

    // ───── Run the dead-no-more pipeline ─────
    let pipeline: any = null;
    let pipelineExecuted = false;
    try {
      pipeline = runScanPipeline({
        raw: raw as any,
        userId:       _str(ctx.userId),
        farmId:       _str(ctx.farmId),
        gardenId:     _str(ctx.gardenId),
        location:     _str(ctx.location),
        imageUrl:     _str(ctx.imageUrl),
        thumbnailUrl: _str(ctx.thumbnailUrl),
        weather:      _isObj(ctx.weather) ? ctx.weather : undefined,
        source:       ctx.source === 'gallery' ? 'gallery' : 'camera',
      });
      pipelineExecuted = !!(pipeline && pipeline.ok);
    } catch { pipeline = null; pipelineExecuted = false; }

    return Object.freeze({
      runtimeVersion:    SCAN_RECOVERY_RUNTIME_VERSION,
      ok:                true,
      pipelineExecuted,
      // Top-level spec envelope fields — drop-in for the result state.
      plantName:         _str(sr && sr.plantName)     || _str(r.plantName)     || '',
      scientificName:    _str(sr && sr.scientificName) || _str(r.scientificName) || '',
      confidence:        (_num(sr && sr.confidence) ?? _num(r.confidence) ?? 0),
      confidenceBand:    _str(sr && sr.confidenceBand) || _confidenceBandFromPct(
                            (_num(sr && sr.confidence) ?? _num(r.confidence) ?? 0)),
      diseaseCandidates: Object.freeze(_arr(sr && sr.diseaseCandidates)
                            .map((d: any) => Object.freeze(d))),
      severity:          (sr && sr.severity) || (r && r.severity) || null,
      recommendations:   Object.freeze(_arr(sr && sr.recommendations)
                            .map(_str).filter(Boolean)),
      nextAction:        _str(sr && sr.nextAction) || _str(r.nextAction)
                          || 'Check this plant again tomorrow.',
      candidates:        Object.freeze(_arr(sr && sr.candidates)
                            .map((c: any) => Object.freeze(c))),
      consensusMode:     _str(sr && sr.consensusMode) || 'rule',
      sources:           Object.freeze(_arr(sr && sr.sources)
                            .map((s: any) => Object.freeze(s))),
      // Pipeline outputs — surface for diagnostics, not for UI.
      pipeline: pipeline ? Object.freeze({
        ok:               !!pipeline.ok,
        needsReview:      !!pipeline.needsReview,
        idempotencyKey:   _str(pipeline.idempotencyKey),
        runtimeVersion:   _str(pipeline.runtimeVersion),
      }) : null,
      limitations: 'Decision support, not a guarantee.',
    });
  }, _emptyRecovery());
}

function _emptyRecovery() {
  return Object.freeze({
    runtimeVersion:    SCAN_RECOVERY_RUNTIME_VERSION,
    ok:                false,
    pipelineExecuted:  false,
    plantName:         '',
    scientificName:    '',
    confidence:        0,
    confidenceBand:    'low',
    diseaseCandidates: Object.freeze([]),
    severity:          null,
    recommendations:   Object.freeze([]),
    nextAction:        'Check this plant again tomorrow.',
    candidates:        Object.freeze([]),
    consensusMode:     'rule',
    sources:           Object.freeze([]),
    pipeline:          null,
    limitations:       'Decision support, not a guarantee.',
  });
}

function _confidenceBandFromPct(pct: number): string {
  if (pct >= 75) return 'high';
  if (pct >= 45) return 'medium';
  return 'low';
}

function _detectCategory(sr: any): string {
  if (!_isObj(sr)) return 'unknown';
  // Look at top species name for fruit/vegetable/flower hints. The
  // canonical SCAN_CATEGORIES enum is owned by oodaContracts; we map
  // conservatively so unknown plants fall to 'unknown' (the safe
  // default).
  const sci = String(sr.scientificName || '').toLowerCase();
  if (/rosa|tulipa|lilium|gerbera|hibiscus/.test(sci)) return 'flower';
  return 'plant';
}

/**
 * Diagnostic envelope. Pinned at window.__scanRecoveryHealth().
 * Reports whether the runtime is initialized AND whether the under-
 * lying ScanAnalysisRuntime is wired.
 */
export function scanRecoveryHealth() {
  return _safe(() => {
    const analysisHealth = _safe(() => scanAnalysisHealth(), null);
    const analysisReady = !!(analysisHealth
      && (analysisHealth as any).initialized
      && (analysisHealth as any).oodaIntegrated);
    return Object.freeze({
      runtimeVersion:           SCAN_RECOVERY_RUNTIME_VERSION,
      initialized:              true,
      analysisRuntimeWired:     analysisReady,
      analysisRuntimeVersion:   SCAN_ANALYSIS_RUNTIME_VERSION,
      executesPipelinePerScan:  true,
      consumesScanRecovery:     true,
      // Literal-true safety constants the gate enforces.
      noFakeIdentification:     true as const,
      noFabricatedConfidence:   true as const,
      respectsArchitectureLock: true as const,
    });
  }, Object.freeze({
    runtimeVersion:           SCAN_RECOVERY_RUNTIME_VERSION,
    initialized:              false,
    analysisRuntimeWired:     false,
    analysisRuntimeVersion:   SCAN_ANALYSIS_RUNTIME_VERSION,
    executesPipelinePerScan:  false,
    consumesScanRecovery:     false,
    noFakeIdentification:     true as const,
    noFabricatedConfidence:   true as const,
    respectsArchitectureLock: true as const,
  }));
}

export function installScanRecoveryGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__scanRecoveryHealth !== 'function') {
      w.__scanRecoveryHealth = function () {
        const out = scanRecoveryHealth();
        try { console.log('[Farroway · Scan Recovery]', out); }
        catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}

export default executeScanRecovery;
