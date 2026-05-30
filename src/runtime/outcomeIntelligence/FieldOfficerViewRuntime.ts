/**
 * src/runtime/outcomeIntelligence/FieldOfficerViewRuntime.ts —
 * wave-36 read-only NGO follow-up surface.
 *
 * Composes:
 *   • OutcomeRuntime.listOutcomes()  (the only outcome source)
 *   • TenantIsolation.scopeRecordsToTenant() (org-scoping)
 *
 * Provides three lists for the field officer:
 *   • growersNeedingFollowUp — outcomes whose first scan is older
 *                              than the follow-up window AND no
 *                              follow-up scan has been recorded
 *   • worseningCrops         — outcomes with status === WORSENED
 *   • unresolvedDiagnoses    — outcomes with status === UNKNOWN
 *                              past the resolution window
 *
 * Strict-rule audit
 *   • Pure composition over existing engines. SSR-safe.
 *   • Never throws. Never writes.
 *   • Org-scoped fail-closed via TenantIsolation: an unknown
 *     viewer-org returns empty lists.
 */

import { listOutcomes } from '../outcomes/OutcomeRuntime';
import { OUTCOME_STATUS, type OutcomeRecord } from '../outcomes/outcomeContracts';
import { scopeRecordsToTenant } from '../enterprise/security/TenantIsolation';

export const FIELD_OFFICER_VIEW_RUNTIME_VERSION = 'field-officer-view-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

const _DAY_MS = 24 * 60 * 60 * 1000;
const FOLLOW_UP_WINDOW_DAYS = 7;
const RESOLUTION_WINDOW_DAYS = 14;

function _toMs(iso: string): number {
  return _safe(() => new Date(iso).getTime(), NaN);
}

interface FieldOfficerOutcomeRow {
  outcomeId:     string;
  plantId:       string;
  recordedAt:    string;
  ageDays:       number;
  scanCount:     number;
  outcomeStatus: string;
  organizationId?: string;
}

function _project(rec: OutcomeRecord, nowMs: number): FieldOfficerOutcomeRow | null {
  return _safe(() => {
    const recordedMs = _toMs(rec.timestamp);
    const ageDays = Number.isFinite(recordedMs)
      ? Math.max(0, Math.floor((nowMs - recordedMs) / _DAY_MS))
      : 0;
    return Object.freeze({
      outcomeId:     rec.outcomeId,
      plantId:       rec.plantId,
      recordedAt:    rec.timestamp,
      ageDays,
      scanCount:     Array.isArray(rec.scanIds) ? rec.scanIds.length : 0,
      outcomeStatus: rec.outcomeStatus || OUTCOME_STATUS.UNKNOWN,
      organizationId: (rec as any).organizationId || undefined,
    });
  }, null);
}

interface User {
  id?:             string;
  role?:           string;
  organizationId?: string;
}

export interface FieldOfficerView {
  runtimeVersion:           string;
  initialized:              boolean;
  viewerOrg:                string | null;
  totalOutcomesInScope:     number;
  growersNeedingFollowUp:   ReadonlyArray<FieldOfficerOutcomeRow>;
  worseningCrops:           ReadonlyArray<FieldOfficerOutcomeRow>;
  unresolvedDiagnoses:      ReadonlyArray<FieldOfficerOutcomeRow>;
  windowDays: Readonly<{
    followUp:     number;
    resolution:   number;
  }>;
}

const FROZEN_FALLBACK: Readonly<FieldOfficerView> = Object.freeze({
  runtimeVersion:           FIELD_OFFICER_VIEW_RUNTIME_VERSION,
  initialized:              false,
  viewerOrg:                null,
  totalOutcomesInScope:     0,
  growersNeedingFollowUp:   Object.freeze([]),
  worseningCrops:           Object.freeze([]),
  unresolvedDiagnoses:      Object.freeze([]),
  windowDays: Object.freeze({
    followUp:     FOLLOW_UP_WINDOW_DAYS,
    resolution:   RESOLUTION_WINDOW_DAYS,
  }),
});

export function fieldOfficerView(viewer: User | null, opts?: {
  nowIso?: string;
}): FieldOfficerView {
  return _safe(() => {
    const nowIso = (opts && opts.nowIso) || new Date().toISOString();
    const nowMs = _toMs(nowIso);
    if (!Number.isFinite(nowMs)) return FROZEN_FALLBACK;

    const all = listOutcomes();
    // scopeRecordsToTenant fails-closed when viewer/role missing.
    const scoped = scopeRecordsToTenant(viewer as any,
      Array.isArray(all) ? all as any : []);
    const records: OutcomeRecord[] = Array.from(scoped as any);

    const followUpCutoffDays    = FOLLOW_UP_WINDOW_DAYS;
    const resolutionCutoffDays  = RESOLUTION_WINDOW_DAYS;

    const followUps: FieldOfficerOutcomeRow[] = [];
    const worsening: FieldOfficerOutcomeRow[] = [];
    const unresolved: FieldOfficerOutcomeRow[] = [];

    for (const rec of records) {
      const row = _project(rec, nowMs);
      if (!row) continue;
      // Worsening
      if (row.outcomeStatus === OUTCOME_STATUS.WORSENED) {
        worsening.push(row);
      }
      // Unresolved past the resolution window
      if (row.outcomeStatus === OUTCOME_STATUS.UNKNOWN
          && row.ageDays >= resolutionCutoffDays) {
        unresolved.push(row);
      }
      // Needs follow-up: only one scan recorded AND old enough.
      if (row.scanCount < 2 && row.ageDays >= followUpCutoffDays) {
        followUps.push(row);
      }
    }

    return Object.freeze({
      runtimeVersion:         FIELD_OFFICER_VIEW_RUNTIME_VERSION,
      initialized:            true,
      viewerOrg:              (viewer && viewer.organizationId) || null,
      totalOutcomesInScope:   records.length,
      growersNeedingFollowUp: Object.freeze(followUps),
      worseningCrops:         Object.freeze(worsening),
      unresolvedDiagnoses:    Object.freeze(unresolved),
      windowDays: Object.freeze({
        followUp:   followUpCutoffDays,
        resolution: resolutionCutoffDays,
      }),
    });
  }, FROZEN_FALLBACK);
}

export function fieldOfficerReadyAttestation(): boolean {
  return _safe(() => {
    // The runtime is "ready" when both upstream sources are
    // observable — outcome listing returns an array AND the
    // tenant-isolation surface is reachable (its existence is
    // a static import, so this resolves true at module load).
    const list = listOutcomes();
    return Array.isArray(list);
  }, false);
}

export function installFieldOfficerViewGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__fieldOfficerView !== 'function') {
      w.__fieldOfficerView = function (viewer?: any, opts?: any) {
        const out = fieldOfficerView(viewer || null, opts);
        try { console.log('[Farroway · Field Officer]', out); }
        catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
