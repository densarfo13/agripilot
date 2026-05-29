/**
 * src/runtime/organization/onboarding/FarmerProvisioningRuntime.ts
 *
 *   Bridges a validated bulk-onboarding batch row into the
 *   canonical FarmerProfile registry (src/runtime/admin).
 *
 *   • When NO existing user is supplied, composes
 *     upsertFarmerProfile with a generated "pending_<hash>" userId
 *     and onboardingStatus = "profile_completed" — the eventual
 *     activation flow swaps that placeholder for the real user.
 *   • When an existing user IS supplied (e.g. matched by the
 *     DuplicateDetectionEngine), it returns a LINK envelope —
 *     no new profile is created, no audit-action with PII is
 *     emitted, the existing record is honoured.
 *   • NEVER sends a password by email. NEVER logs phone / email
 *     in audit metadata — the writer also scrubs, this is
 *     belt-and-braces.
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • Frozen envelopes. No persistence writes here — the admin
 *     FarmerProfile runtime owns its in-memory map until the
 *     pending Prisma migration deploys.
 *   • Organization-scoped: fails closed without organizationId.
 */

import { upsertFarmerProfile } from '../../admin';
import { writeAuditEvent } from '../../audit';

export const FARMER_PROVISIONING_VERSION =
  'farmer-provisioning-runtime-v1';

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _arr  = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const _str  = (v: unknown): string => (typeof v === 'string' ? v : '');
const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

const _stats = {
  created: 0,
  linked:  0,
  failed:  0,
};

function _hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export interface ProvisioningRow {
  rowNumber?:        number;
  firstName?:        string;
  lastName?:         string;
  phone?:            string;
  email?:            string;
  role?:             string;
  ageRange?:         string;
  gender?:           string;
  country?:          string;
  region?:           string;
  district?:         string;
  village?:          string;
  farmSize?:         string;
  primaryCrops?:     ReadonlyArray<string>;
  primaryCrop?:      string;
  consentForProgramReporting?: boolean;
  matchedUserId?:    string;
}

export interface ProvisionFromRowCtx {
  row:                 ProvisioningRow;
  batchId:             string;
  organizationId:      string;
  programId?:          string;
  cohortId?:           string;
  fieldOfficerUserId?: string;
}

function _failed(reason: string) {
  _stats.failed += 1;
  return Object.freeze({
    runtimeVersion: FARMER_PROVISIONING_VERSION,
    ok:             false,
    operation:      'none' as const,
    reason,
    matchedUserId:  '',
    profile:        null,
    auditAction:    '',
  });
}

/**
 * Compose a FarmerProfile for one batch row.
 *
 *   • If row.matchedUserId is non-empty → LINK path: emit a
 *     `bulk_onboarding_farmer_linked` audit event, NO profile
 *     write, return the matched id.
 *   • Otherwise → CREATE path: generate a stable pending userId,
 *     call upsertFarmerProfile, emit a
 *     `bulk_onboarding_farmer_created` audit event with
 *     PII-free metadata, return the frozen profile envelope.
 */
export function provisionFarmerFromRow(ctx: ProvisionFromRowCtx) {
  return _safe(() => {
    if (!_isObj(ctx)) return _failed('invalid_context');

    const batchId        = _str(ctx.batchId);
    const organizationId = _str(ctx.organizationId);
    if (!organizationId) return _failed('organization_required');
    if (!batchId)        return _failed('batch_required');

    const row = _isObj(ctx.row) ? ctx.row as ProvisioningRow : null;
    if (!row) return _failed('row_required');

    const programId          = _str(ctx.programId);
    const fieldOfficerUserId = _str(ctx.fieldOfficerUserId);

    // ── LINK path: an existing user was matched upstream.
    const matchedUserId = _str(row.matchedUserId);
    if (matchedUserId) {
      writeAuditEvent({
        actorUserId:    fieldOfficerUserId || 'system_bulk_onboarding',
        action:         'bulk_onboarding_farmer_linked',
        entityType:     'FarmerProfile',
        entityId:       matchedUserId,
        organizationId,
        metadata: {
          batchId,
          rowNumber: typeof row.rowNumber === 'number' ? row.rowNumber : 0,
          programId: programId || '',
          cohortId:  _str(ctx.cohortId),
          operation: 'link',
        },
      });
      _stats.linked += 1;
      return Object.freeze({
        runtimeVersion: FARMER_PROVISIONING_VERSION,
        ok:             true,
        operation:      'link' as const,
        reason:         '',
        matchedUserId,
        profile:        null,
        auditAction:    'bulk_onboarding_farmer_linked',
      });
    }

    // ── CREATE path: no match, generate a pending_<hash> userId.
    // The hash deliberately mixes the org + batch + row so the same
    // batch row resolves to the same pending id on retries
    // (idempotent under the wave-5 single-writer invariant).
    const rowNumber = typeof row.rowNumber === 'number' ? row.rowNumber : 0;
    const hashSeed  =
      organizationId + '|' + batchId + '|' + rowNumber + '|' +
      _str(row.firstName).trim().toLowerCase() + '|' +
      _str(row.lastName).trim().toLowerCase() + '|' +
      _str(row.village).trim().toLowerCase();
    const pendingUserId = 'pending_' + _hash(hashSeed);

    // Collect crops without leaking PII.
    const crops: string[] = [];
    for (const c of _arr(row.primaryCrops)) {
      const v = _str(c).trim();
      if (v) crops.push(v);
    }
    if (crops.length === 0 && _str(row.primaryCrop)) {
      crops.push(_str(row.primaryCrop).trim());
    }

    const upsertResult = upsertFarmerProfile({
      userId:           pendingUserId,
      role:             _str(row.role) || 'smallholder',
      ageRange:         _str(row.ageRange) || undefined,
      gender:           _str(row.gender)   || undefined,
      country:          _str(row.country)  || undefined,
      region:           _str(row.region)   || undefined,
      district:         _str(row.district) || undefined,
      village:          _str(row.village)  || undefined,
      farmSize:         _str(row.farmSize) || undefined,
      primaryCrops:     crops,
      organizationId,
      programId:        programId || undefined,
      onboardingStatus: 'profile_completed',
      consentForProgramReporting:
        row.consentForProgramReporting === true,
    });

    if (!_isObj(upsertResult) || (upsertResult as any).ok !== true) {
      return _failed(_str((upsertResult as any)?.reason) || 'upsert_failed');
    }
    const profile = (upsertResult as any).profile;

    writeAuditEvent({
      actorUserId:    fieldOfficerUserId || 'system_bulk_onboarding',
      action:         'bulk_onboarding_farmer_created',
      entityType:     'FarmerProfile',
      entityId:       pendingUserId,
      organizationId,
      // Metadata is deliberately PII-free. The audit writer also
      // scrubs phone/email — this is belt-and-braces.
      metadata: {
        batchId,
        rowNumber,
        programId: programId || '',
        cohortId:  _str(ctx.cohortId),
        role:      _str(row.role) || 'smallholder',
        region:    _str(row.region) || '',
        district:  _str(row.district) || '',
        cropCount: crops.length,
        pending:   true,
        operation: 'create',
      },
    });

    _stats.created += 1;
    return Object.freeze({
      runtimeVersion: FARMER_PROVISIONING_VERSION,
      ok:             true,
      operation:      'create' as const,
      reason:         '',
      matchedUserId:  '',
      profile,
      auditAction:    'bulk_onboarding_farmer_created',
    });
  }, _failed('error'));
}

/** Diagnostic snapshot — created vs linked vs failed counters. */
export function provisioningSnapshot() {
  return _safe(() => Object.freeze({
    runtimeVersion: FARMER_PROVISIONING_VERSION,
    scope:          "organizationId" as const,
    created:        _stats.created,
    linked:         _stats.linked,
    failed:         _stats.failed,
    total:          _stats.created + _stats.linked + _stats.failed,
    persistence:    'in_memory' as const,
  }), Object.freeze({
    runtimeVersion: FARMER_PROVISIONING_VERSION,
    created:        0,
    linked:         0,
    failed:         0,
    total:          0,
    persistence:    'in_memory' as const,
  }));
}

/** Test-only — wipe the counters. */
export function _resetProvisioningStats() {
  _stats.created = 0;
  _stats.linked  = 0;
  _stats.failed  = 0;
}
