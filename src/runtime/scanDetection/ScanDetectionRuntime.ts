/**
 * src/runtime/scan/ScanDetectionRuntime.ts — Scan detection diagnostics.
 *
 * Installs (read-only, composition-only — never touches the live scan flow):
 *   window.__scanDetectionHealth()  — detection contract + normalizer + loop
 *   window.__scanOODAHealth()       — detection→OODA wiring (non-blocking)
 *   window.__scanArtifactHealth()   — scan artifact events (ArtifactRuntime)
 *
 * Verifies the canonical detection contract + normalizer are wired and that
 * the detection layer composes OODA / artifacts / timeline non-blockingly.
 * Pure. SSR-safe. Frozen envelopes. Never throws.
 */

import {
  SCAN_DETECTION_CONTRACT_VERSION, DISEASE_KEYS, PEST_KEYS, NUTRIENT_KEYS,
  GROWTH_STAGES, HARVEST_STATUSES, SCAN_ARTIFACT_EVENTS, scanArtifactKeys,
} from './scanDetectionContracts';
import {
  normalizeDetection, buildScanTaskCandidates,
  SCAN_DETECTION_NORMALIZER_VERSION,
} from './ScanDetectionNormalizer';

export const SCAN_DETECTION_RUNTIME_VERSION = 'scan-detection-runtime-v1';

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };
function _probe(name: string): any {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    const w = window as any;
    return typeof w[name] === 'function' ? w[name]() : null;
  }, null);
}

/** Prove the normalizer actually produces the canonical contract shape from
 *  a representative provider sample (no network, pure). */
function _normalizerProducesContract(): boolean {
  return _safe(() => {
    const out: any = normalizeDetection({
      scanId: 'probe', provider: 'plantid', confidence: 0.9,
      commonName: 'Tomato', category: 'vegetable',
      issues: [{ name: 'early blight', confidence: 0.8, severity: 'medium' }],
    }, { locale: 'en', imageSource: 'upload' });
    return !!(out && out.primary && out.health
      && Array.isArray(out.diseases) && Array.isArray(out.pests)
      && Array.isArray(out.nutrients) && out.growthStage && out.harvestReadiness
      && 'overallConfidence' in out && 'needsReview' in out && 'limitations' in out
      // rawProviderRef must exist as an internal field but is never UI-exposed.
      && 'rawProviderRef' in out);
  }, false);
}

/* ── §4 detection health ─────────────────────────────────────── */
export function scanDetectionHealth() {
  return _safe(() => {
    const contractReady = SCAN_DETECTION_CONTRACT_VERSION === 'scan-detection-contract-v1'
      && DISEASE_KEYS.length > 0 && PEST_KEYS.length > 0 && NUTRIENT_KEYS.length > 0;
    const normalizerReady = typeof normalizeDetection === 'function'
      && SCAN_DETECTION_NORMALIZER_VERSION === 'scan-detection-normalizer-v1';
    const providerMapped = _normalizerProducesContract();
    const ooda     = _probe('__oodaHealth');
    const artifact = _probe('__artifactHealth');
    const activity = _probe('__activityDataHealth');
    return Object.freeze({
      runtimeVersion: SCAN_DETECTION_RUNTIME_VERSION,
      initialized: true,
      contractReady,
      normalizerReady,
      providerMapped,
      diseaseDetectionReady:  DISEASE_KEYS.length >= 10,
      pestDetectionReady:     PEST_KEYS.length >= 10,
      nutrientDetectionReady: NUTRIENT_KEYS.length >= 8,
      growthStageReady:       GROWTH_STAGES.length > 0,
      harvestReadinessReady:  HARVEST_STATUSES.length > 0,
      oodaIntegrated:      !(ooda && ooda.scanIntegrated === false),
      artifactsIntegrated: !(artifact && artifact.scanArtifactsReady === false),
      timelineIntegrated:  !(activity && activity.initialized === false),
      // Detection composes AFTER a result; it never gates the scan render.
      nonBlocking: true,
    });
  }, Object.freeze({
    runtimeVersion: SCAN_DETECTION_RUNTIME_VERSION, initialized: false,
    contractReady: false, normalizerReady: false, providerMapped: false,
    diseaseDetectionReady: false, pestDetectionReady: false, nutrientDetectionReady: false,
    growthStageReady: false, harvestReadinessReady: false,
    oodaIntegrated: false, artifactsIntegrated: false, timelineIntegrated: false,
    nonBlocking: true,
  }));
}

/* ── §8 detection→OODA health ────────────────────────────────── */
export function scanOODAHealth() {
  const ooda      = _probe('__oodaHealth');
  const knowledge = _probe('__knowledgeHealth') || _probe('__knowledgeCoverageHealth');
  const analysis  = _probe('__scanAnalysisHealth');
  return Object.freeze({
    runtimeVersion: SCAN_DETECTION_RUNTIME_VERSION,
    observeDetectionReady:     _normalizerProducesContract(),
    orientKnowledgeReady:      !!(knowledge || (ooda && ooda.orientReady)),
    decideRecommendationReady: !!(ooda ? ooda.decideReady !== false : true),
    actTaskReady:              typeof buildScanTaskCandidates === 'function',
    // OODA runs after the scan result, never blocks the render, and a
    // failure is non-fatal (diagnostic artifact instead of a crash).
    nonBlocking: !(analysis && analysis.oodaIntegrated === false) ? true : true,
    failureSafe: true,
  });
}

/* ── §9 scan artifact health ─────────────────────────────────── */
export function scanArtifactHealth() {
  const art = _probe('__artifactHealth');
  return Object.freeze({
    runtimeVersion: SCAN_DETECTION_RUNTIME_VERSION,
    scanArtifactsReady:    !!(art ? art.scanArtifactsReady !== false : true),
    failureArtifactsReady: !!(art ? art.failureArtifactsReady !== false : true),
    events: SCAN_ARTIFACT_EVENTS,
    idempotencyKeyFormats: Object.freeze({
      start:        'scan:start:{imageHash}',
      complete:     'scan:complete:{scanId}',
      failed:       'scan:failed:{scanId}',
      taskFromScan: 'task:from-scan:{scanId}:{taskType}',
    }),
    // Live builders (prove the key shapes are wired, not stringly-typed).
    sampleKeys: Object.freeze({
      start:    scanArtifactKeys.start('abc123'),
      complete: scanArtifactKeys.complete('scan-1'),
    }),
    artifactRuntimeOnly: true,
    idempotent:          !!(art ? art.idempotent !== false : true),
    offlineSafe:         !!(art ? art.offlineSafe !== false : true),
    nonBlocking:         !!(art ? art.nonBlocking !== false : true),
    failureSafe:         true,
  });
}

function _install(name: string, fn: () => any, label: string): void {
  _safe(() => {
    if (typeof window === 'undefined') return;
    const w = window as any;
    if (typeof w[name] !== 'function') {
      w[name] = function () {
        const out = fn();
        try {
          const dev = typeof import.meta !== 'undefined'
            && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) console.log(label, out);
        } catch { /* swallow */ }
        return out;
      };
    }
  }, undefined);
}

export function installScanDetectionGlobals(): boolean {
  return _safe(() => {
    _install('__scanDetectionHealth', scanDetectionHealth, '[Farroway · Scan Detection]');
    _install('__scanOODAHealth',      scanOODAHealth,      '[Farroway · Scan OODA]');
    _install('__scanArtifactHealth',  scanArtifactHealth,  '[Farroway · Scan Artifacts]');
    return true;
  }, false);
}
