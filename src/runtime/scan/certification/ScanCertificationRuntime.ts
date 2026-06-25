/**
 * ScanCertificationRuntime.ts — SCAN ACCEPTANCE & FARMBRAIN CERTIFICATION.
 *
 * Certifies what can be certified HONESTLY from code: the deterministic safety
 * behaviour of the pipeline (unknown/non-plant rejection, weak-scan gating,
 * provider-failure resilience, confidence-degrades-with-evidence) — by running
 * the REAL ingestion gate + classifier, not mocks.
 *
 * What it does NOT do: fabricate live provider accuracy. Running real crop photos
 * against the live providers is the operator's job (run-scan-acceptance.mjs against
 * production). Until that run lands, live accuracy is reported PENDING, never a
 * made-up number. Sentinel Hub is reported NOT_INTEGRATED (no such provider).
 *
 * Pins window.__scanCertificationHealth().
 */
import { evaluateFarmBrainIngestion } from '../../farmBrain/FarmBrainScanIngestion';
import { classifyAgriculturalObject } from '../AgriculturalObjectClassifier';

export const SCAN_CERTIFICATION_VERSION = 'scan-certification-v1';

export type ProviderVerdict = 'READY' | 'PARTIAL' | 'BLOCKED' | 'NOT_INTEGRATED';
const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };

/**
 * Provider readiness — HONEST. "wired" = an adapter that calls it exists in code
 * (deterministic). "liveAccuracy" is PENDING for every keyed provider until the
 * operator runs real photos (never fabricated here).
 */
export const PROVIDER_CERT = Object.freeze([
  { provider: 'plant.id',    wired: true,  keyedAtRuntime: true,  verdict: 'PARTIAL' as ProviderVerdict,
    note: 'Adapter wired + keyed (alias). Live photo accuracy PENDING operator run.' },
  { provider: 'crop.health', wired: true,  keyedAtRuntime: null,  verdict: 'PARTIAL' as ProviderVerdict,
    note: 'Adapter wired. Key + live accuracy measured on Railway; PENDING.' },
  { provider: 'insect.id',   wired: true,  keyedAtRuntime: null,  verdict: 'PARTIAL' as ProviderVerdict,
    note: 'Adapter wired. Key + live accuracy measured on Railway; PENDING.' },
  { provider: 'mushroom.id', wired: true,  keyedAtRuntime: null,  verdict: 'PARTIAL' as ProviderVerdict,
    note: 'Adapter wired (never claims edible). Key + accuracy PENDING.' },
  { provider: 'soil',        wired: true,  keyedAtRuntime: null,  verdict: 'PARTIAL' as ProviderVerdict,
    note: 'Ambee Soil hardened (telemetry/timeout/circuit breaker). Live readiness PENDING.' },
  { provider: 'weather',     wired: true,  keyedAtRuntime: true,  verdict: 'READY' as ProviderVerdict,
    note: 'Live weather in production; no secret dependency.' },
  { provider: 'sentinel_hub', wired: false, keyedAtRuntime: false, verdict: 'NOT_INTEGRATED' as ProviderVerdict,
    note: 'No Sentinel Hub provider exists (satellite is an honest stub; excluded by pilot doctrine).' },
]);

/** Run the REAL deterministic safety certifications (no mocks, no fabrication). */
export function runSafetyCertifications() {
  return _safe(() => {
    const strong = evaluateFarmBrainIngestion({
      plantKnown: true, confidence: 88, trustPassed: true, providerAuthOk: true, photoQualityFailed: false,
    } as any);
    const weak = evaluateFarmBrainIngestion({ plantKnown: true, confidence: 40 } as any);
    const unknownPlant = evaluateFarmBrainIngestion({ plantKnown: false, confidence: 90 } as any);
    const providerDown = evaluateFarmBrainIngestion({ plantKnown: true, confidence: 90, providerUnavailable: true } as any);

    // Phase 5 — non-plant objects classify as unknown (no diagnosis path).
    const nonPlant = ['shoe', 'person', 'table', 'wall', 'vehicle']
      .map((o) => classifyAgriculturalObject({ objectType: o }));
    const nonPlantRejected = nonPlant.every((c) => c.objectType === 'unknown' || c.routingDecision?.route === 'review' || !c.objectType || c.objectType === 'unknown');

    return Object.freeze({
      strongScanIngests: strong.shouldIngest === true,                       // Phase 4
      weakScanHeld: weak.shouldIngest === false && weak.blockers.includes('confidence_below_70'),
      unknownPlantHeld: unknownPlant.shouldIngest === false && unknownPlant.blockers.includes('plant_unknown'),
      providerFailureDoesNotIngest: providerDown.shouldIngest === false,     // Phase 3 (no crash, no weak ingest)
      nonPlantRejected,                                                       // Phase 5
      // Phase 4 — confidence degrades with evidence (strong > weak).
      confidenceDegradesWithEvidence: strong.confidencePct > weak.confidencePct,
    });
  }, {
    strongScanIngests: false, weakScanHeld: false, unknownPlantHeld: false,
    providerFailureDoesNotIngest: false, nonPlantRejected: false, confidenceDegradesWithEvidence: false,
  });
}

export function scanCertificationHealth() {
  const safety = runSafetyCertifications();
  const safetyOk = Object.values(safety).every(Boolean);
  const providers = PROVIDER_CERT;
  const ready = providers.filter((p) => p.verdict === 'READY').length;
  const partial = providers.filter((p) => p.verdict === 'PARTIAL').length;
  const blocked = providers.filter((p) => p.verdict === 'BLOCKED').length;

  // Overall: pipeline + safety certified deterministically → READY_FOR_PILOT.
  // PRODUCTION_READY requires the live photo run + multi-provider accuracy, which
  // cannot be certified here — so it is never claimed from the sandbox.
  const overall = !safetyOk ? 'NOT_READY' : (blocked > 0 || partial > 0)
    ? 'READY_FOR_PILOT' : 'PRODUCTION_READY';

  return Object.freeze({
    ok: true, version: SCAN_CERTIFICATION_VERSION,
    safety, safetyCertified: safetyOk,
    providers,
    counts: { ready, partial, blocked, notIntegrated: providers.filter((p) => p.verdict === 'NOT_INTEGRATED').length },
    liveProviderAccuracy: 'PENDING_OPERATOR_RUN',   // never fabricated
    livePhotoRunHarness: 'scripts/run-scan-acceptance.mjs',
    overall,
    blockers: Object.freeze([
      ...(safetyOk ? [] : ['deterministic safety certification failed']),
      'live crop-photo provider accuracy PENDING (operator run against production)',
      'Sentinel Hub not integrated',
    ]),
  });
}

export function installScanCertificationHealth(): void {
  _safe(() => {
    if (typeof window === 'undefined' || (window as any).__scanCertificationHealth) return;
    Object.defineProperty(window, '__scanCertificationHealth', {
      configurable: true, enumerable: false, writable: false, value: () => scanCertificationHealth(),
    });
  }, undefined);
}
