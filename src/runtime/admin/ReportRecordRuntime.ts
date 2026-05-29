/**
 * src/runtime/admin/ReportRecordRuntime.ts — Persistent report
 * record store. The Report Runtime composes the impact ledger
 * + farmer profiles + organization records and produces
 * ReportRecord envelopes the admin / NGO dashboards consume.
 *
 *   Reports use REAL DATA ONLY. Empty inputs surface the
 *   "Not enough data yet" honesty string.
 */

import {
  ADMIN_IMPACT_VERSION, REPORT_RECORD_TYPES, ADMIN_EMPTY_STATE,
} from './adminImpactContracts';
import {
  impactLedgerSnapshot, listImpactRecords,
} from './ImpactLedgerRuntime';
import {
  farmerProfileSnapshot, demographicDistribution, listFarmerProfiles,
} from './FarmerProfileRuntime';
import {
  organizationRecordSnapshot, listOrganizations,
  listPrograms, listInterventions,
} from './OrganizationRecordRuntime';

export const REPORT_RECORD_VERSION = 'report-record-runtime-v1';

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _str  = (v: unknown): string => (typeof v === 'string' ? v : '');
const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _now = () => _safe(() => new Date().toISOString(), '');

const _validTypes = new Set<string>(REPORT_RECORD_TYPES as readonly string[]);

export interface ReportRecord {
  id:              string;
  organizationId?: string;
  programId?:      string;
  type:            string;
  metrics:         Record<string, any>;
  generatedBy:     string;
  generatedAt:     string;
  exportFormat?:   string;
  fakeData:        false;
  emptyState:      string;
}

const _records: ReportRecord[] = [];

function _hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

interface ReportCtx {
  type:            string;
  organizationId?: string;
  programId?:      string;
  generatedBy?:    string;
  exportFormat?:   string;
}

export function generateReportRecord(ctx: ReportCtx) {
  return _safe(() => {
    if (!_isObj(ctx)) {
      return Object.freeze({
        runtimeVersion: REPORT_RECORD_VERSION,
        ok: false, reason: 'invalid_context', record: null,
      });
    }
    const type = _str(ctx.type);
    if (!_validTypes.has(type)) {
      return Object.freeze({
        runtimeVersion: REPORT_RECORD_VERSION,
        ok: false, reason: 'invalid_type', record: null,
      });
    }
    const organizationId = _str(ctx.organizationId);
    const programId      = _str(ctx.programId);

    // Compose metrics — real aggregates only.
    const metrics = _composeMetrics(type, organizationId, programId);

    const generatedAt = _now();
    const id = 'report_' + _hash(type + '|' + organizationId
      + '|' + programId + '|' + generatedAt);
    const record: ReportRecord = Object.freeze({
      id, type,
      organizationId: organizationId || undefined,
      programId:      programId      || undefined,
      metrics:        Object.freeze(metrics),
      generatedBy:    _str(ctx.generatedBy),
      generatedAt,
      exportFormat:   _str(ctx.exportFormat) || undefined,
      fakeData:       false,
      emptyState:     metrics._isEmpty ? ADMIN_EMPTY_STATE : '',
    });
    _records.push(record);
    return Object.freeze({
      runtimeVersion: REPORT_RECORD_VERSION,
      ok: true, reason: '', record,
    });
  }, Object.freeze({
    runtimeVersion: REPORT_RECORD_VERSION,
    ok: false, reason: 'error', record: null,
  }));
}

function _composeMetrics(type: string, orgId: string, programId: string) {
  switch (type) {
    case 'founder_summary': {
      const farmers = farmerProfileSnapshot();
      const orgs    = organizationRecordSnapshot();
      const impact  = impactLedgerSnapshot();
      const total = (farmers as any).total + (orgs as any).organizations
        + (impact as any).total;
      return {
        farmers: { ...farmers }, orgs: { ...orgs }, impact: { ...impact },
        _isEmpty: total === 0,
      };
    }
    case 'organization_summary': {
      const orgFarmers = listFarmerProfiles({
        organizationId: orgId || undefined,
      });
      const orgImpact  = impactLedgerSnapshot({
        organizationId: orgId || undefined,
      });
      const orgPrograms = listPrograms({
        organizationId: orgId || undefined,
      });
      const total = orgFarmers.length + orgPrograms.length
        + (orgImpact as any).total;
      return {
        farmersEnrolled:       orgFarmers.length,
        programsCount:         orgPrograms.length,
        impactRecords:         (orgImpact as any).total,
        impactByType:          (orgImpact as any).counts,
        _isEmpty: total === 0,
      };
    }
    case 'program_impact': {
      const programFarmers = listFarmerProfiles({
        programId: programId || undefined,
      });
      const programImpact = impactLedgerSnapshot({
        programId: programId || undefined,
      });
      const total = programFarmers.length + (programImpact as any).total;
      return {
        farmersEnrolled: programFarmers.length,
        impactRecords:   (programImpact as any).total,
        impactByType:    (programImpact as any).counts,
        _isEmpty: total === 0,
      };
    }
    case 'intervention_summary': {
      const interventions = listInterventions({
        organizationId: orgId || undefined,
      });
      const completed = interventions.filter((i) =>
        i.status === 'completed').length;
      const total = interventions.length;
      return {
        interventionsCount: total,
        completedCount:     completed,
        _isEmpty: total === 0,
      };
    }
    default:
      return { _isEmpty: true };
  }
}

export function listReportRecords(opts?: { organizationId?: string }):
    ReadonlyArray<ReportRecord> {
  return _safe(() => {
    const o = _isObj(opts) ? opts as any : {};
    let pool = _records;
    if (_str(o.organizationId)) {
      pool = pool.filter((r) => _str(r.organizationId) === _str(o.organizationId));
    }
    return Object.freeze(pool.map((r) => Object.freeze({ ...r })));
  }, Object.freeze([] as ReportRecord[]));
}

export function reportRecordSnapshot() {
  return _safe(() => Object.freeze({
    runtimeVersion: REPORT_RECORD_VERSION,
    total:    _records.length,
    fakeData: false,
  }), Object.freeze({
    runtimeVersion: REPORT_RECORD_VERSION,
    total: 0, fakeData: false,
  }));
}

export { ADMIN_IMPACT_VERSION };

export function _resetReportRecords() {
  _records.length = 0;
}
