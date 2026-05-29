/**
 * src/runtime/artifacts/ArtifactEvidenceService.ts —
 * Cross-role read API for artifacts.
 *
 *   import {
 *     redactedFor, evidenceForPlant, evidenceForIntervention,
 *     EVIDENCE_SERVICE_VERSION,
 *   } from 'src/runtime/artifacts/ArtifactEvidenceService';
 *
 * What this file owns
 * ───────────────────
 *   Single read API every role-aware UI calls. The service
 *   enforces the visibility rules declared in artifactContracts
 *   — Plant data stays private to its owner; only declared
 *   shared visibility classes leak summaries.
 *
 *   Output envelopes are READ-ONLY. The caller cannot mutate.
 *
 * Strict-rule audit
 *   • Pure read. SSR-safe. Never throws.
 *   • Returns redacted copies — original artifacts unchanged.
 *   • No PII surfaced across roles.
 */

import {
  Artifact, getArtifact, listArtifactsByPlant, listArtifactsByUser,
  listArtifactsByType,
} from './ArtifactRegistry';
import { ARTIFACT_VISIBILITY } from './artifactContracts';

export const EVIDENCE_SERVICE_VERSION = 'artifact-evidence-v1';

const _str   = (v: unknown): string => (typeof v === 'string' ? v : '');
const _arr   = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const _safe  = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

export type ViewerRole =
  | 'owner' | 'admin' | 'ngo_admin' | 'field_officer' | 'buyer' | 'unknown';

interface ViewerCtx {
  userId?:  string;
  role?:    ViewerRole;
  /** When the viewer is an NGO field staff, scope to a single
   *  intervention/program id. Out-of-scope artifacts hide. */
  programInterventionId?: string;
  /** When the viewer is a buyer, scope to a single buyer
   *  interest id. */
  buyerInterestId?:       string;
}

function _isOwner(a: Artifact, ctx: ViewerCtx): boolean {
  return _str(ctx.userId) && a.userId === ctx.userId
    ? true : false;
}

function _baseFields(a: Artifact) {
  return {
    id:        a.id,
    type:      a.type,
    timestamp: a.timestamp,
    verified:  a.verified,
  };
}

/**
 * Redact an artifact for a viewer per the visibility rules.
 * Returns a frozen envelope:
 *   - owner          → full record
 *   - admin          → full record minus metadata.* PII (already
 *                       scrubbed at write time)
 *   - ngo_admin /    → summary only when the artifact is
 *     field_officer    PROGRAM_SHARED and matches the program
 *                       intervention scope
 *   - buyer          → summary only when BUYER_SHARED and
 *                       matches the buyer interest scope
 *   - else           → null (no visibility)
 */
export function redactedFor(artifact: Artifact | null,
                              ctx: ViewerCtx): any | null {
  return _safe(() => {
    if (!artifact) return null;
    const role = (ctx.role || 'unknown') as ViewerRole;

    if (_isOwner(artifact, ctx)) {
      return Object.freeze({ ...artifact });
    }
    if (role === 'admin') {
      return Object.freeze({ ...artifact });
    }
    if (artifact.visibility === ARTIFACT_VISIBILITY.PROGRAM_SHARED
        && (role === 'ngo_admin' || role === 'field_officer')
        && _str(ctx.programInterventionId)
        && artifact.interventionId === ctx.programInterventionId) {
      return Object.freeze({
        ..._baseFields(artifact),
        interventionId: artifact.interventionId,
        plantId:        artifact.plantId,
        farmId:         artifact.farmId,
        photoUrl:       artifact.photoUrl,
        // No location, no metadata, no userId leak.
      });
    }
    if (artifact.visibility === ARTIFACT_VISIBILITY.BUYER_SHARED
        && role === 'buyer'
        && _str(ctx.buyerInterestId)
        && artifact.buyerInterestId === ctx.buyerInterestId) {
      return Object.freeze({
        ..._baseFields(artifact),
        buyerInterestId: artifact.buyerInterestId,
        photoUrl:        artifact.photoUrl,
        plantId:         artifact.plantId,
        // No location, no metadata, no userId leak.
      });
    }
    return null;
  }, null);
}

export function evidenceForPlant(plantId: string, ctx: ViewerCtx) {
  return _safe(() => {
    const all = listArtifactsByPlant(plantId);
    const out: any[] = [];
    for (const a of all) {
      const v = redactedFor(a, ctx);
      if (v) out.push(v);
    }
    return Object.freeze({
      runtimeVersion: EVIDENCE_SERVICE_VERSION,
      plantId, count: out.length,
      evidence: Object.freeze(out),
    });
  }, Object.freeze({
    runtimeVersion: EVIDENCE_SERVICE_VERSION,
    plantId, count: 0, evidence: Object.freeze([]),
  }));
}

export function evidenceForIntervention(interventionId: string,
                                          ctx: ViewerCtx) {
  return _safe(() => {
    const all = listArtifactsByType('InterventionArtifact');
    const matching = _arr(all).filter((a) =>
      a && a.interventionId === interventionId);
    const out: any[] = [];
    const scopedCtx = { ...ctx, programInterventionId: interventionId };
    for (const a of matching) {
      const v = redactedFor(a, scopedCtx);
      if (v) out.push(v);
    }
    return Object.freeze({
      runtimeVersion: EVIDENCE_SERVICE_VERSION,
      interventionId, count: out.length,
      evidence: Object.freeze(out),
    });
  }, Object.freeze({
    runtimeVersion: EVIDENCE_SERVICE_VERSION,
    interventionId, count: 0, evidence: Object.freeze([]),
  }));
}

export function evidenceForUser(userId: string, ctx: ViewerCtx) {
  return _safe(() => {
    const all = listArtifactsByUser(userId);
    const out: any[] = [];
    for (const a of all) {
      const v = redactedFor(a, ctx);
      if (v) out.push(v);
    }
    return Object.freeze({
      runtimeVersion: EVIDENCE_SERVICE_VERSION,
      userId, count: out.length,
      evidence: Object.freeze(out),
    });
  }, Object.freeze({
    runtimeVersion: EVIDENCE_SERVICE_VERSION,
    userId, count: 0, evidence: Object.freeze([]),
  }));
}
