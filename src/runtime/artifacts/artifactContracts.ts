/**
 * src/runtime/artifacts/artifactContracts.ts — Frozen contracts
 * for the Artifacts Evidence Layer.
 *
 *   import {
 *     ARTIFACT_RUNTIME_VERSION, ARTIFACT_TYPES,
 *     ARTIFACT_VISIBILITY, ARTIFACT_SOURCES,
 *   } from 'src/runtime/artifacts/artifactContracts';
 *
 * What this file owns
 * ───────────────────
 *   Pure constants + type unions. Engines read these to know
 *   what artifact types exist and what cross-role visibility
 *   rules apply.
 *
 * Strict-rule audit
 *   • Pure data, no side effects, no engine imports.
 *   • SSR-safe. Never throws.
 */

export const ARTIFACT_RUNTIME_VERSION = 'farroway-artifact-runtime-v1';

/** Frozen list of every artifact type the platform supports. */
export const ARTIFACT_TYPES = Object.freeze([
  'ScanArtifact',
  'PlantArtifact',
  'TaskArtifact',
  'TreatmentArtifact',
  'HarvestArtifact',
  'InterventionArtifact',
  'BuyerInterestArtifact',
] as const);
export type ArtifactType = (typeof ARTIFACT_TYPES)[number];

/**
 * Visibility classes — who can see this artifact's full
 * payload. Engines filter cross-role reads against this.
 */
export const ARTIFACT_VISIBILITY = Object.freeze({
  /** Only the artifact's owner (the farmer/gardener) sees the
   *  full record. Other roles see a redacted summary. */
  PRIVATE:        'private',
  /** Owner + NGO field staff scoped to the same program. */
  PROGRAM_SHARED: 'program_shared',
  /** Owner + approved buyer for a single transaction. */
  BUYER_SHARED:   'buyer_shared',
  /** Owner + admin (founder ops only — no NGO/buyer). */
  ADMIN_ONLY:     'admin_only',
});

/** Default visibility per artifact type — engines fall back
 *  here when the caller doesn't specify. */
export const DEFAULT_VISIBILITY: Record<string, string> = Object.freeze({
  ScanArtifact:          ARTIFACT_VISIBILITY.PRIVATE,
  PlantArtifact:         ARTIFACT_VISIBILITY.PRIVATE,
  TaskArtifact:          ARTIFACT_VISIBILITY.PRIVATE,
  TreatmentArtifact:     ARTIFACT_VISIBILITY.PRIVATE,
  HarvestArtifact:       ARTIFACT_VISIBILITY.PRIVATE,
  InterventionArtifact:  ARTIFACT_VISIBILITY.PROGRAM_SHARED,
  BuyerInterestArtifact: ARTIFACT_VISIBILITY.BUYER_SHARED,
});

/** Source — where the artifact originated. */
export const ARTIFACT_SOURCES = Object.freeze({
  USER_SCAN:           'user_scan',
  USER_MANUAL:         'user_manual',
  PLANT_RUNTIME:       'plant_runtime',
  TASK_ENGINE:         'task_engine',
  OODA_ENGINE:         'ooda_engine',
  NGO_INTERVENTION:    'ngo_intervention',
  BUYER_FLOW:          'buyer_flow',
});

/** PII drop-list — fields engines must NEVER persist on an
 *  artifact (the wave-5 single-writer enforces this on its
 *  write side; we surface the list here for static gates). */
export const ARTIFACT_PII_DROP_LIST = Object.freeze([
  'phone', 'email', 'fullName', 'deviceId',
  'ipAddress', 'gpsExact', 'fileName',
]);

/** Idempotency-key shape — keep in lockstep with the
 *  offline-queue contract per spec §14. */
export function artifactIdempotencyKey(type: string,
                                         entityId: string,
                                         hash: string): string {
  return 'artifact:create:' + type + ':' + entityId + ':' + hash;
}
