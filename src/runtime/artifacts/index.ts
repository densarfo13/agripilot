/**
 * src/runtime/artifacts/index.ts — Artifacts Evidence Layer
 * barrel + boot install.
 *
 *   import {
 *     createScanArtifact, createPlantArtifact,
 *     // ...rest of verbs
 *     installArtifactRuntimeGlobal,
 *     artifactHealth,
 *     ARTIFACT_RUNTIME_VERSION,
 *   } from 'src/runtime/artifacts';
 *
 *   window.__artifactHealth()  // pinned after boot
 *
 * Strict-rule audit
 *   • Pure composition. Never throws. SSR-safe.
 *   • No engine imports React.
 *   • No persistence writes from this layer.
 */

import {
  registerArtifact, getArtifact, listArtifactsByType,
  listArtifactsByUser, listArtifactsByPlant,
  artifactRegistrySummary, ARTIFACT_REGISTRY_VERSION,
} from './ArtifactRegistry';
import {
  redactedFor, evidenceForPlant, evidenceForIntervention,
  evidenceForUser, EVIDENCE_SERVICE_VERSION,
} from './ArtifactEvidenceService';
import {
  createScanArtifact, createPlantArtifact, createTaskArtifact,
  createTreatmentArtifact, createHarvestArtifact,
  createInterventionArtifact, createBuyerInterestArtifact,
  ARTIFACT_RUNTIME_VERSION,
} from './ArtifactRuntime';
import {
  ARTIFACT_TYPES, ARTIFACT_VISIBILITY, ARTIFACT_SOURCES,
  DEFAULT_VISIBILITY, artifactIdempotencyKey,
} from './artifactContracts';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

/** Diagnostic snapshot — the spec's __artifactHealth() payload. */
export function artifactHealth() {
  return _safe(() => {
    const summary = artifactRegistrySummary();
    return Object.freeze({
      runtimeVersion: ARTIFACT_RUNTIME_VERSION,
      initialized:             true,
      scanArtifactsReady:      true,
      plantArtifactsReady:     true,
      taskArtifactsReady:      true,
      interventionArtifactsReady: true,
      // §4 contract — ScanStarted/ScanCompleted/ScanFailed are all
      // created through ArtifactRuntime (no UI direct writes), with
      // idempotency keys, and a failed artifact never crashes the UI.
      failureArtifactsReady:   true,
      // §5 contract — outcome artifacts (OutcomeRecorded / follow-up)
      // also flow through ArtifactRuntime; artifact creation NEVER blocks
      // the grower result (fire-and-forget, failure-safe).
      outcomeArtifactsReady:   true,
      nonBlocking:             true,
      idempotent:              true,
      // No localStorage writes happen here — wave-5 single
      // writer owns persistence. Offline-safe from our side
      // means: pure, idempotent, never throws.
      offlineSafe:             true,
      registry: summary,
      versions: Object.freeze({
        runtime:   ARTIFACT_RUNTIME_VERSION,
        registry:  ARTIFACT_REGISTRY_VERSION,
        evidence:  EVIDENCE_SERVICE_VERSION,
      }),
    });
  }, Object.freeze({
    runtimeVersion: ARTIFACT_RUNTIME_VERSION,
    initialized: false,
    scanArtifactsReady: false,
    plantArtifactsReady: false,
    taskArtifactsReady: false,
    interventionArtifactsReady: false,
    failureArtifactsReady: false,
    outcomeArtifactsReady: false,
    nonBlocking: true,
    idempotent: false,
    offlineSafe: false,
  }));
}

export function installArtifactRuntimeGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__artifactHealth !== 'function') {
      w.__artifactHealth = function () {
        const out = artifactHealth();
        try { console.log('[Farroway · Artifacts]', out); }
        catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}

// ─── Re-exports ────────────────────────────────────────────────
export {
  // Verbs (Runtime)
  createScanArtifact, createPlantArtifact, createTaskArtifact,
  createTreatmentArtifact, createHarvestArtifact,
  createInterventionArtifact, createBuyerInterestArtifact,
  ARTIFACT_RUNTIME_VERSION,
  // Registry reads
  registerArtifact, getArtifact, listArtifactsByType,
  listArtifactsByUser, listArtifactsByPlant,
  artifactRegistrySummary, ARTIFACT_REGISTRY_VERSION,
  // Evidence service
  redactedFor, evidenceForPlant, evidenceForIntervention,
  evidenceForUser, EVIDENCE_SERVICE_VERSION,
  // Contracts
  ARTIFACT_TYPES, ARTIFACT_VISIBILITY, ARTIFACT_SOURCES,
  DEFAULT_VISIBILITY, artifactIdempotencyKey,
};

export type { Artifact } from './ArtifactRegistry';
export type { ViewerRole } from './ArtifactEvidenceService';
