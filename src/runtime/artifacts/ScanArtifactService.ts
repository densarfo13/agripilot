/**
 * src/runtime/artifacts/ScanArtifactService.ts — Dedicated
 * scan-artifact facade. Provides the spec-shaped ScanArtifact
 * envelope + idempotent verbs the scan analysis pipeline calls.
 *
 *   import {
 *     createScanArtifactRecord, getScanArtifact,
 *     listScanArtifactsForUser, SCAN_ARTIFACT_SERVICE_VERSION,
 *   } from 'src/runtime/artifacts/ScanArtifactService';
 *
 * What this file owns
 * ───────────────────
 *   A thin, role-safe wrapper over the existing ArtifactRuntime
 *   verbs. Centralises the scan-specific record shape +
 *   idempotency key per spec §6:
 *
 *     artifact:create:scan:{scanId}
 *
 *   Listing helpers honour the visibility rules in
 *   ArtifactEvidenceService (private by default; buyer access
 *   requires the listing-approved + artifact-verified path —
 *   not granted by this module).
 *
 * Strict-rule audit
 *   • Pure runtime. SSR-safe. Never throws.
 *   • Composes ArtifactRuntime — no duplicate write path.
 *   • No persistence writes from this layer.
 *   • Wave-5 single-writer invariant preserved.
 */

import {
  createScanArtifact, listArtifactsByType, getArtifact,
  redactedFor,
} from './index';

export const SCAN_ARTIFACT_SERVICE_VERSION = 'scan-artifact-service-v1';

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _str  = (v: unknown): string => (typeof v === 'string' ? v : '');
const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

export interface ScanArtifactCtx {
  userId:        string;
  scanId:        string;
  plantId?:      string;
  farmId?:       string;
  gardenId?:     string;
  imageUrl?:     string;
  thumbnailUrl?: string;
  /** Coarse region code only. Never exact GPS. */
  location?:     string;
  provider?:     string;
  confidence?:   number;
  category?:     string;
  resultSummary?: string;
  source?:       'camera' | 'gallery';
  metadata?:     Record<string, any>;
}

/**
 * Emit a frozen ScanArtifact record. Idempotent on
 * (userId, scanId) — the underlying registry de-dupes.
 */
export function createScanArtifactRecord(ctx: ScanArtifactCtx) {
  return _safe(() => {
    if (!_isObj(ctx)) return _err('invalid_context');
    if (!_str(ctx.userId)) return _err('userId_required');
    if (!_str(ctx.scanId)) return _err('scanId_required');
    const out = createScanArtifact({
      userId:   _str(ctx.userId),
      scanId:   _str(ctx.scanId),
      plantId:  _str(ctx.plantId),
      farmId:   _str(ctx.farmId),
      gardenId: _str(ctx.gardenId),
      photoUrl: _str(ctx.imageUrl) || _str(ctx.thumbnailUrl),
      location: _str(ctx.location),
      source:   _str(ctx.source) === 'gallery'
                  ? 'user_manual'
                  : 'user_scan',
      metadata: Object.freeze({
        provider:      _str(ctx.provider),
        confidence:    typeof ctx.confidence === 'number'
                          && Number.isFinite(ctx.confidence)
                          ? ctx.confidence : null,
        category:      _str(ctx.category),
        resultSummary: _str(ctx.resultSummary),
        captureSource: _str(ctx.source),
        ...(_isObj(ctx.metadata) ? ctx.metadata : {}),
      }),
    });
    return Object.freeze({
      runtimeVersion: SCAN_ARTIFACT_SERVICE_VERSION,
      ok: !!(out && (out as any).ok),
      artifact: out && (out as any).artifact,
      idempotencyKey: 'artifact:create:scan:' + _str(ctx.scanId),
    });
  }, _err('error'));
}

function _err(reason: string) {
  return Object.freeze({
    runtimeVersion: SCAN_ARTIFACT_SERVICE_VERSION,
    ok: false, reason, artifact: null, idempotencyKey: '',
  });
}

export function getScanArtifact(id: string) {
  return _safe(() => getArtifact(_str(id)), null);
}

export function listScanArtifactsForUser(userId: string,
                                            viewerRole: string = 'owner') {
  return _safe(() => {
    const all = listArtifactsByType('ScanArtifact');
    const filtered = all.filter((a: any) => a && a.userId === _str(userId));
    const ctx = {
      userId: _str(userId),
      role:   viewerRole as any,
    };
    const out = filtered.map((a: any) => redactedFor(a, ctx)).filter(Boolean);
    return Object.freeze(out);
  }, Object.freeze([]));
}

export function scanArtifactSnapshot() {
  return _safe(() => {
    const all = listArtifactsByType('ScanArtifact');
    return Object.freeze({
      runtimeVersion: SCAN_ARTIFACT_SERVICE_VERSION,
      total: all.length,
      roleScoped: true,
      offlineSafe: true,
    });
  }, Object.freeze({
    runtimeVersion: SCAN_ARTIFACT_SERVICE_VERSION,
    total: 0, roleScoped: true, offlineSafe: true,
  }));
}
