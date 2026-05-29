/**
 * src/runtime/artifacts/ArtifactRuntime.ts — Composite verb
 * surface for the Artifacts Evidence Layer.
 *
 *   import {
 *     createScanArtifact, createPlantArtifact,
 *     createTaskArtifact, createTreatmentArtifact,
 *     createHarvestArtifact, createInterventionArtifact,
 *     createBuyerInterestArtifact,
 *     ARTIFACT_RUNTIME_VERSION,
 *   } from 'src/runtime/artifacts/ArtifactRuntime';
 *
 * What this file owns
 * ───────────────────
 *   The verb API every other engine calls when it needs to emit
 *   an artifact. Each verb is a thin facade over
 *   registerArtifact() — it sets the canonical type, source,
 *   and visibility for the use-case and forwards the rest.
 *
 *   This module DOES NOT write to localStorage. Offline-safe
 *   persistence is owned by the wave-5 single writer (offline
 *   runtime + journal store). When the offline queue is
 *   available, callers can wrap our envelope output for queued
 *   sync.
 *
 * Strict-rule audit
 *   • Pure runtime. SSR-safe. Never throws.
 *   • Composition-only over ArtifactRegistry.
 *   • No fetch. No localStorage writes. No React imports.
 */

import {
  registerArtifact, artifactRegistrySummary,
  Artifact,
} from './ArtifactRegistry';
import {
  ARTIFACT_RUNTIME_VERSION, ARTIFACT_SOURCES,
  ARTIFACT_VISIBILITY, DEFAULT_VISIBILITY,
  artifactIdempotencyKey,
} from './artifactContracts';

export { ARTIFACT_RUNTIME_VERSION };

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _str  = (v: unknown): string => (typeof v === 'string' ? v : '');
const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _now = () => _safe(() => new Date().toISOString(), '');

function _envelope(ok: boolean, artifact: Artifact | null,
                    reason = '') {
  return Object.freeze({
    runtimeVersion: ARTIFACT_RUNTIME_VERSION,
    ok, reason,
    artifact: artifact ? Object.freeze({ ...artifact }) : null,
    idempotencyKey: artifact
      ? artifactIdempotencyKey(artifact.type,
          _str(artifact.scanId || artifact.plantId || artifact.taskId
              || artifact.interventionId || artifact.buyerInterestId),
          _str(artifact.timestamp))
      : '',
  });
}

interface CommonCtx {
  userId:    string;
  farmId?:   string;
  gardenId?: string;
  /** Coarse region code only. Never exact GPS. */
  location?: string;
  photoUrl?: string;
  metadata?: Record<string, any>;
  source?:   string;
}

/* ── Scan ─────────────────────────────────────────────────── */
export function createScanArtifact(ctx: CommonCtx & {
                                      scanId: string;
                                      plantId?: string;
                                    }) {
  return _safe(() => {
    if (!_isObj(ctx)) return _envelope(false, null, 'invalid_context');
    const userId = _str(ctx.userId);
    const scanId = _str(ctx.scanId);
    if (!userId) return _envelope(false, null, 'userId_required');
    if (!scanId) return _envelope(false, null, 'scanId_required');
    const a = registerArtifact({
      type: 'ScanArtifact', userId, scanId,
      plantId:  _str(ctx.plantId),
      farmId:   _str(ctx.farmId),
      gardenId: _str(ctx.gardenId),
      location: _str(ctx.location),
      photoUrl: _str(ctx.photoUrl),
      metadata: ctx.metadata,
      timestamp: _now(),
      source: _str(ctx.source) || ARTIFACT_SOURCES.USER_SCAN,
      verified: false,
      visibility: ARTIFACT_VISIBILITY.PRIVATE,
    });
    return _envelope(!!a, a);
  }, _envelope(false, null, 'error'));
}

/* ── Plant ────────────────────────────────────────────────── */
export function createPlantArtifact(ctx: CommonCtx & {
                                       plantId: string;
                                       scanId?: string;
                                     }) {
  return _safe(() => {
    if (!_isObj(ctx)) return _envelope(false, null, 'invalid_context');
    const userId  = _str(ctx.userId);
    const plantId = _str(ctx.plantId);
    if (!userId)  return _envelope(false, null, 'userId_required');
    if (!plantId) return _envelope(false, null, 'plantId_required');
    const a = registerArtifact({
      type: 'PlantArtifact', userId, plantId,
      scanId:   _str(ctx.scanId),
      farmId:   _str(ctx.farmId),
      gardenId: _str(ctx.gardenId),
      location: _str(ctx.location),
      photoUrl: _str(ctx.photoUrl),
      metadata: ctx.metadata,
      timestamp: _now(),
      source: _str(ctx.source) || ARTIFACT_SOURCES.PLANT_RUNTIME,
      verified: false,
      visibility: ARTIFACT_VISIBILITY.PRIVATE,
    });
    return _envelope(!!a, a);
  }, _envelope(false, null, 'error'));
}

/* ── Task ─────────────────────────────────────────────────── */
export function createTaskArtifact(ctx: CommonCtx & {
                                      taskId:  string;
                                      plantId?: string;
                                    }) {
  return _safe(() => {
    if (!_isObj(ctx)) return _envelope(false, null, 'invalid_context');
    const userId = _str(ctx.userId);
    const taskId = _str(ctx.taskId);
    if (!userId) return _envelope(false, null, 'userId_required');
    if (!taskId) return _envelope(false, null, 'taskId_required');
    const a = registerArtifact({
      type: 'TaskArtifact', userId, taskId,
      plantId:  _str(ctx.plantId),
      farmId:   _str(ctx.farmId),
      gardenId: _str(ctx.gardenId),
      photoUrl: _str(ctx.photoUrl),
      metadata: ctx.metadata,
      timestamp: _now(),
      source: _str(ctx.source) || ARTIFACT_SOURCES.TASK_ENGINE,
      verified: false,
      visibility: ARTIFACT_VISIBILITY.PRIVATE,
    });
    return _envelope(!!a, a);
  }, _envelope(false, null, 'error'));
}

/* ── Treatment ────────────────────────────────────────────── */
export function createTreatmentArtifact(ctx: CommonCtx & {
                                           plantId: string;
                                           taskId?: string;
                                         }) {
  return _safe(() => {
    if (!_isObj(ctx)) return _envelope(false, null, 'invalid_context');
    const userId  = _str(ctx.userId);
    const plantId = _str(ctx.plantId);
    if (!userId)  return _envelope(false, null, 'userId_required');
    if (!plantId) return _envelope(false, null, 'plantId_required');
    const a = registerArtifact({
      type: 'TreatmentArtifact', userId, plantId,
      taskId:   _str(ctx.taskId),
      farmId:   _str(ctx.farmId),
      gardenId: _str(ctx.gardenId),
      photoUrl: _str(ctx.photoUrl),
      metadata: ctx.metadata,
      timestamp: _now(),
      source: _str(ctx.source) || ARTIFACT_SOURCES.OODA_ENGINE,
      verified: false,
      visibility: ARTIFACT_VISIBILITY.PRIVATE,
    });
    return _envelope(!!a, a);
  }, _envelope(false, null, 'error'));
}

/* ── Harvest ──────────────────────────────────────────────── */
export function createHarvestArtifact(ctx: CommonCtx & {
                                         plantId: string;
                                       }) {
  return _safe(() => {
    if (!_isObj(ctx)) return _envelope(false, null, 'invalid_context');
    const userId  = _str(ctx.userId);
    const plantId = _str(ctx.plantId);
    if (!userId)  return _envelope(false, null, 'userId_required');
    if (!plantId) return _envelope(false, null, 'plantId_required');
    const a = registerArtifact({
      type: 'HarvestArtifact', userId, plantId,
      farmId:   _str(ctx.farmId),
      gardenId: _str(ctx.gardenId),
      photoUrl: _str(ctx.photoUrl),
      metadata: ctx.metadata,
      timestamp: _now(),
      source: _str(ctx.source) || ARTIFACT_SOURCES.USER_MANUAL,
      verified: false,
      visibility: ARTIFACT_VISIBILITY.PRIVATE,
    });
    return _envelope(!!a, a);
  }, _envelope(false, null, 'error'));
}

/* ── NGO Intervention ─────────────────────────────────────── */
export function createInterventionArtifact(ctx: CommonCtx & {
                                              interventionId: string;
                                              plantId?:       string;
                                            }) {
  return _safe(() => {
    if (!_isObj(ctx)) return _envelope(false, null, 'invalid_context');
    const userId         = _str(ctx.userId);
    const interventionId = _str(ctx.interventionId);
    if (!userId)         return _envelope(false, null, 'userId_required');
    if (!interventionId) return _envelope(false, null, 'interventionId_required');
    const a = registerArtifact({
      type: 'InterventionArtifact', userId, interventionId,
      plantId:  _str(ctx.plantId),
      farmId:   _str(ctx.farmId),
      gardenId: _str(ctx.gardenId),
      location: _str(ctx.location),
      photoUrl: _str(ctx.photoUrl),
      metadata: ctx.metadata,
      timestamp: _now(),
      source: _str(ctx.source) || ARTIFACT_SOURCES.NGO_INTERVENTION,
      verified: false,
      visibility: ARTIFACT_VISIBILITY.PROGRAM_SHARED,
    });
    return _envelope(!!a, a);
  }, _envelope(false, null, 'error'));
}

/* ── Buyer Interest ───────────────────────────────────────── */
export function createBuyerInterestArtifact(ctx: CommonCtx & {
                                               buyerInterestId: string;
                                               plantId?:        string;
                                             }) {
  return _safe(() => {
    if (!_isObj(ctx)) return _envelope(false, null, 'invalid_context');
    const userId          = _str(ctx.userId);
    const buyerInterestId = _str(ctx.buyerInterestId);
    if (!userId)          return _envelope(false, null, 'userId_required');
    if (!buyerInterestId) return _envelope(false, null, 'buyerInterestId_required');
    const a = registerArtifact({
      type: 'BuyerInterestArtifact', userId, buyerInterestId,
      plantId:  _str(ctx.plantId),
      farmId:   _str(ctx.farmId),
      gardenId: _str(ctx.gardenId),
      metadata: ctx.metadata,
      timestamp: _now(),
      source: _str(ctx.source) || ARTIFACT_SOURCES.BUYER_FLOW,
      verified: false,
      visibility: ARTIFACT_VISIBILITY.BUYER_SHARED,
    });
    return _envelope(!!a, a);
  }, _envelope(false, null, 'error'));
}

export { artifactRegistrySummary };
