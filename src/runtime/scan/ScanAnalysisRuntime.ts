/**
 * src/runtime/scan/ScanAnalysisRuntime.ts — Scan Analysis
 * pipeline composer.
 *
 *   capture/upload → compress → analyze → normalize → OODA →
 *   artifact → result
 *
 *   import {
 *     normalizeScanResult, runScanPipeline,
 *     scanAnalysisHealth, installScanAnalysisGlobal,
 *     SCAN_ANALYSIS_RUNTIME_VERSION,
 *   } from 'src/runtime/scan/ScanAnalysisRuntime';
 *
 *   window.__scanAnalysisHealth()
 *
 * What this file owns
 * ───────────────────
 *   The orchestration contract that the scan UI calls AFTER
 *   ScanRuntime (camera owner) has handed back a raw image +
 *   provider result. The pipeline:
 *
 *     1. Compress (caller-side; we declare the contract).
 *     2. Analyze via the existing scanService / Plant.id (the
 *        runtime DOES NOT call Plant.id itself — wave-5 single-
 *        writer invariant). 20s timeout + 1 retry on network
 *        failure are caller responsibilities; this module
 *        documents the expected contract via exported constants.
 *     3. Normalize raw provider output to the spec envelope.
 *     4. Run OODA via runOODA().
 *     5. Emit a ScanArtifact via createScanArtifactRecord().
 *     6. Emit a low-confidence review submission when needed.
 *     7. Return a single frozen envelope for the result screen.
 *
 *   This runtime is PURE — every fallible call is wrapped in
 *   _safe; engines never throw; persistence remains the wave-5
 *   single writer's job.
 *
 * Strict-rule audit
 *   • No React. No fetch. No localStorage writes.
 *   • Frozen envelopes only.
 *   • Composes existing runtimes — does NOT call Plant.id
 *     directly.
 *   • Grower-facing copy uses the spec wording only ("Likely" /
 *     "Possible" / "Needs review"); banned words never appear
 *     in this module's output.
 */

import { runOODA, OODA_ENGINE_VERSION } from '../intelligence/OODAEngine';
import {
  bandedConfidence, normalizedConfidenceLabel,
  SCAN_CATEGORIES, OODA_RUNTIME_VERSION,
} from '../intelligence/oodaContracts';
import {
  createScanArtifactRecord, SCAN_ARTIFACT_SERVICE_VERSION,
} from '../artifacts/ScanArtifactService';
import {
  submitForReview, PLANT_IMAGE_VERIFICATION_VERSION,
} from '../plants/media/PlantImageVerification';

export const SCAN_ANALYSIS_RUNTIME_VERSION = 'scan-analysis-runtime-v1';

/** Spec §3 timeouts + retry policy — exported as constants so
 *  the caller (ScanRuntime) reads the same values the gate
 *  verifies. */
export const SCAN_ANALYSIS_TIMEOUT_MS = 20000;
export const SCAN_ANALYSIS_RETRY_ONCE = true;

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _arr  = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const _str  = (v: unknown): string => (typeof v === 'string' ? v : '');
const _num  = (v: unknown): number | null =>
  (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _now = () => _safe(() => new Date().toISOString(), '');

const _validCategories = new Set<string>(SCAN_CATEGORIES as readonly string[]);

interface RawProviderResult {
  scanId?:        string;
  confidence?:    number;
  commonName?:    string;
  scientificName?: string;
  plantId?:       string;
  category?:      string;
  healthStatus?:  string;
  issues?:        ReadonlyArray<string>;
  provider?:      string;
  rawProviderId?: string;
}

/**
 * Spec §4 — normalize a raw provider result into the canonical
 * envelope. Confidence bands + needsReview computed via
 * bandedConfidence; category coerced to the SCAN_CATEGORIES
 * enum.
 */
export function normalizeScanResult(raw: RawProviderResult) {
  return _safe(() => {
    const r = _isObj(raw) ? raw : {} as RawProviderResult;
    const conf  = _num(r.confidence);
    const band  = bandedConfidence(conf as number);
    const category = _validCategories.has(_str(r.category))
      ? _str(r.category) : 'unknown';
    return Object.freeze({
      runtimeVersion: SCAN_ANALYSIS_RUNTIME_VERSION,
      scanId:         _str(r.scanId),
      category,
      commonName:     _str(r.commonName),
      scientificName: _str(r.scientificName),
      confidence:     (band as any).score,
      confidenceLabel: normalizedConfidenceLabel((band as any).band),
      confidenceBand: (band as any).band,
      healthStatus:   _str(r.healthStatus),
      issues:         Object.freeze(_arr(r.issues).map(_str)
                       .filter((s: string) => s.length > 0)),
      provider:       _str(r.provider) || 'plantid',
      rawProviderId:  _str(r.rawProviderId),
      needsReview:    !!(band as any).needsReview,
      createdAt:      _now(),
    });
  }, _emptyNormalized());
}

function _emptyNormalized() {
  return Object.freeze({
    runtimeVersion: SCAN_ANALYSIS_RUNTIME_VERSION,
    scanId: '', category: 'unknown',
    commonName: '', scientificName: '',
    confidence: null, confidenceLabel: 'Needs review',
    confidenceBand: 'unknown',
    healthStatus: '', issues: Object.freeze([]),
    provider: '', rawProviderId: '',
    needsReview: true, createdAt: _now(),
  });
}

interface PipelineCtx {
  raw:            RawProviderResult;
  userId:         string;
  farmId?:        string;
  gardenId?:      string;
  /** Coarse region code only. Never exact GPS. */
  location?:      string;
  imageUrl?:      string;
  thumbnailUrl?:  string;
  weather?:       Record<string, any>;
  history?:       ReadonlyArray<any>;
  timeline?:      ReadonlyArray<any>;
  source?:        'camera' | 'gallery';
}

/**
 * Run the full Scan → OODA → Artifact → (optional Review)
 * pipeline. Returns ONE frozen envelope the result screen
 * renders. Engines never throw.
 */
export function runScanPipeline(ctx: PipelineCtx) {
  return _safe(() => {
    if (!_isObj(ctx)) return _emptyPipeline();
    const normalized = normalizeScanResult(ctx.raw);

    // ─── OODA ────────────────────────────────────────────────
    const ooda = runOODA({
      scanResult: ctx.raw,
      plant: {
        id:        _str((ctx.raw as any) && (ctx.raw as any).plantId),
        plantId:   _str((ctx.raw as any) && (ctx.raw as any).plantId),
        commonName: _str(normalized.commonName),
      },
      weather:    ctx.weather,
      history:    ctx.history,
      timeline:   ctx.timeline,
    });

    // ─── ScanArtifact ────────────────────────────────────────
    const artifact = createScanArtifactRecord({
      userId:        _str(ctx.userId),
      scanId:        _str(normalized.scanId),
      plantId:       _str((ctx.raw as any) && (ctx.raw as any).plantId),
      farmId:        _str(ctx.farmId),
      gardenId:      _str(ctx.gardenId),
      imageUrl:      _str(ctx.imageUrl),
      thumbnailUrl:  _str(ctx.thumbnailUrl),
      location:      _str(ctx.location),
      provider:      _str(normalized.provider),
      confidence:    (normalized.confidence as number) ?? undefined,
      category:      _str(normalized.category),
      resultSummary: _str(normalized.commonName)
                     + (normalized.scientificName
                          ? ' (' + _str(normalized.scientificName) + ')'
                          : ''),
      source:        ctx.source === 'gallery' ? 'gallery' : 'camera',
    });

    // ─── Low-confidence review (best-effort; verification queue
    //      currently scoped to plant-image moderation — used as
    //      the placeholder review channel until a dedicated
    //      low-confidence-scan queue ships in HumanReviewRuntime). ─
    let reviewSubmission: any = null;
    if (normalized.needsReview && _str(normalized.scanId)) {
      reviewSubmission = _safe(() => submitForReview({
        plantId:    _str(normalized.commonName).toLowerCase().replace(/\s+/g, '-')
                     || 'unknown',
        type:       'plant',
        candidateUrl:  _str(ctx.imageUrl) || _str(ctx.thumbnailUrl),
        userId:        _str(ctx.userId),
        region:        _str(ctx.location),
      }), null);
    }

    // ─── Grower-safe summary message ─────────────────────────
    const growerMessage = _str(normalized.commonName)
      ? normalizedConfidenceLabel(normalized.confidenceBand as any)
          + ': ' + _str(normalized.commonName)
      : 'Needs review — upload another photo for a clearer match.';

    return Object.freeze({
      runtimeVersion: SCAN_ANALYSIS_RUNTIME_VERSION,
      ok:             true,
      normalized,
      ooda,
      artifact,
      reviewSubmission,
      growerMessage,
      needsReview:    normalized.needsReview,
      idempotencyKey: 'scan:analyze:' + _str(normalized.scanId),
    });
  }, _emptyPipeline());
}

function _emptyPipeline() {
  return Object.freeze({
    runtimeVersion: SCAN_ANALYSIS_RUNTIME_VERSION,
    ok: false,
    normalized: _emptyNormalized(),
    ooda: null, artifact: null, reviewSubmission: null,
    growerMessage: 'Needs review — please try again.',
    needsReview: true, idempotencyKey: '',
  });
}

/**
 * Diagnostic envelope per spec §12. The pipeline composes
 * existing runtimes; this snapshot reports their wiring.
 */
export function scanAnalysisHealth() {
  return _safe(() => Object.freeze({
    runtimeVersion:        SCAN_ANALYSIS_RUNTIME_VERSION,
    initialized:           true,
    compressionReady:      true,    // caller-side hint; documented contract
    timeoutMs:             SCAN_ANALYSIS_TIMEOUT_MS,
    retryOnce:             SCAN_ANALYSIS_RETRY_ONCE,
    providerReady:         true,    // ScanRuntime owns provider readiness
    normalizationReady:    true,
    oodaIntegrated:        true,
    artifactIntegrated:    true,
    offlineSafe:           true,    // pure pipeline; no fetch in this module
    versions: Object.freeze({
      analysis:  SCAN_ANALYSIS_RUNTIME_VERSION,
      ooda:      OODA_ENGINE_VERSION,
      contracts: OODA_RUNTIME_VERSION,
      artifact:  SCAN_ARTIFACT_SERVICE_VERSION,
      review:    PLANT_IMAGE_VERIFICATION_VERSION,
    }),
  }), Object.freeze({
    runtimeVersion: SCAN_ANALYSIS_RUNTIME_VERSION,
    initialized: false,
    compressionReady: false,
    timeoutMs:  SCAN_ANALYSIS_TIMEOUT_MS,
    retryOnce:  SCAN_ANALYSIS_RETRY_ONCE,
    providerReady: false, normalizationReady: false,
    oodaIntegrated: false, artifactIntegrated: false,
    offlineSafe: false,
  }));
}

export function installScanAnalysisGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__scanAnalysisHealth !== 'function') {
      w.__scanAnalysisHealth = function () {
        const out = scanAnalysisHealth();
        try { console.log('[Farroway · Scan Analysis]', out); }
        catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
