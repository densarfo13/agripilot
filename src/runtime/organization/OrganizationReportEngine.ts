/**
 * src/runtime/organization/OrganizationReportEngine.ts — Builds
 * NGO ReportRecord envelopes by composing the org analytics
 * aggregator + program / intervention snapshots.
 *
 * Strict-rule audit
 *   • Pure runtime. Frozen ReportRecord envelopes. Never throws.
 *   • organizationScoped: every report requires organizationId.
 *   • Reports use real aggregates only. fakeData: false.
 *   • Empty inputs surface ORG_EMPTY_STATE.
 */

import {
  REPORT_KINDS, ORG_EMPTY_STATE,
  ORGANIZATION_DASHBOARD_VERSION,
} from './organizationContracts';
import { aggregateForOrganization } from './OrganizationAnalytics';
import {
  listProgramsForOrganization, programSnapshot,
} from './ProgramRuntime';
import { interventionSnapshot } from './InterventionRuntime';

export const ORG_REPORT_ENGINE_VERSION =
  'org-report-engine-runtime-v1';

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _arr  = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const _str  = (v: unknown): string => (typeof v === 'string' ? v : '');
const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _now = () => _safe(() => new Date().toISOString(), '');

const _validKinds = new Set<string>(REPORT_KINDS as readonly string[]);

export interface OrgReportRecord {
  id:             string;
  organizationId: string;
  type:           string;
  metrics:        Record<string, any>;
  generatedBy:    string;
  generatedAt:    string;
  fakeData:       false;
  emptyState:     string;
  organizationScoped: true;
}

const _records: OrgReportRecord[] = [];

function _hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function _envelope(ok: boolean, record: OrgReportRecord | null, reason = '') {
  return Object.freeze({
    runtimeVersion: ORG_REPORT_ENGINE_VERSION,
    ok, reason,
    record: record ? Object.freeze({ ...record }) : null,
  });
}

interface GenerateCtx {
  organizationId: string;
  type:           string;
  generatedBy:    string;
}

export function generateOrganizationReport(ctx: GenerateCtx) {
  return _safe(() => {
    if (!_isObj(ctx)) return _envelope(false, null, 'invalid_context');
    const organizationId = _str(ctx.organizationId);
    const type           = _str(ctx.type);
    const generatedBy    = _str(ctx.generatedBy);
    if (!organizationId) return _envelope(false, null, 'organizationId_required');
    if (!_validKinds.has(type)) return _envelope(false, null, 'invalid_type');

    const metrics = _composeMetrics(type, organizationId);
    const isEmpty = metrics._isEmpty === true;
    const generatedAt = _now();
    const id = 'org_report_' + _hash(type + '|' + organizationId
      + '|' + generatedAt);

    // Strip the internal _isEmpty flag from the surfaced metrics.
    const surfaced: Record<string, any> = {};
    for (const k of Object.keys(metrics)) {
      if (k === '_isEmpty') continue;
      surfaced[k] = (metrics as any)[k];
    }

    const record: OrgReportRecord = Object.freeze({
      id,
      organizationId,
      type,
      metrics:       Object.freeze(surfaced),
      generatedBy,
      generatedAt,
      fakeData:      false,
      emptyState:    isEmpty ? ORG_EMPTY_STATE : '',
      organizationScoped: true,
    });
    _records.push(record);
    return _envelope(true, record);
  }, _envelope(false, null, 'error'));
}

function _composeMetrics(type: string, organizationId: string)
    : Record<string, any> {
  const agg = aggregateForOrganization(organizationId) as any;
  const aggIsEmpty = !!agg && _str(agg.emptyState) === ORG_EMPTY_STATE;

  switch (type) {
    case 'program_summary': {
      const programs = _arr(listProgramsForOrganization(organizationId));
      const snapshots = programs.map((p) => {
        if (!_isObj(p)) return null;
        const pid = _str((p as any).id);
        return Object.freeze({
          programId: pid,
          name:      _str((p as any).name),
          snapshot:  programSnapshot(pid),
        });
      }).filter((x) => x !== null);
      return {
        aggregate:    agg,
        programsCount: programs.length,
        programs:     Object.freeze(snapshots),
        _isEmpty:     programs.length === 0 && aggIsEmpty,
      };
    }
    case 'intervention_summary': {
      const snap = interventionSnapshot(organizationId) as any;
      const total = (snap && typeof snap.total === 'number') ? snap.total : 0;
      return {
        aggregate:             agg,
        interventionSnapshot:  snap,
        completedInterventions: agg.completedInterventions || 0,
        _isEmpty: total === 0 && aggIsEmpty,
      };
    }
    case 'farmer_activity': {
      return {
        aggregate:       agg,
        farmersEnrolled: agg.farmersEnrolled || 0,
        activeFarmers:   agg.activeFarmers   || 0,
        scansCount:      agg.scansCount      || 0,
        tasksCompleted:  agg.tasksCompleted  || 0,
        plantsTracked:   agg.plantsTracked   || 0,
        _isEmpty: (agg.farmersEnrolled || 0) === 0 && aggIsEmpty,
      };
    }
    case 'evidence_summary': {
      return {
        aggregate:              agg,
        evidenceArtifactsCount: agg.evidenceArtifactsCount || 0,
        completedInterventions: agg.completedInterventions || 0,
        _isEmpty: (agg.evidenceArtifactsCount || 0) === 0 && aggIsEmpty,
      };
    }
    default:
      return { aggregate: agg, _isEmpty: true };
  }
}

/**
 * 2-column CSV exporter. First column = key, second = value.
 * Returns an empty-state CSV when the report has no data.
 */
export function exportOrganizationReportCSV(report: any): string {
  return _safe(() => {
    if (!_isObj(report)) return 'key,value\n';
    const rows: Array<[string, string]> = [];
    rows.push(['id',             _str((report as any).id)]);
    rows.push(['organizationId', _str((report as any).organizationId)]);
    rows.push(['type',           _str((report as any).type)]);
    rows.push(['generatedBy',    _str((report as any).generatedBy)]);
    rows.push(['generatedAt',    _str((report as any).generatedAt)]);
    rows.push(['fakeData',       'false']);
    rows.push(['emptyState',     _str((report as any).emptyState)]);

    const metrics = (report as any).metrics;
    if (_isObj(metrics)) {
      _flatten('metrics', metrics, rows);
    }

    const escape = (s: string) => {
      const v = _str(s);
      if (v.indexOf(',') >= 0 || v.indexOf('"') >= 0 || v.indexOf('\n') >= 0) {
        return '"' + v.replace(/"/g, '""') + '"';
      }
      return v;
    };
    let out = 'key,value\n';
    for (const [k, v] of rows) {
      out += escape(k) + ',' + escape(v) + '\n';
    }
    return out;
  }, 'key,value\n');
}

function _flatten(prefix: string, obj: any, out: Array<[string, string]>) {
  if (!_isObj(obj)) {
    out.push([prefix, _stringify(obj)]);
    return;
  }
  for (const k of Object.keys(obj)) {
    const v = (obj as any)[k];
    const key = prefix + '.' + k;
    if (_isObj(v) && !Array.isArray(v)) {
      _flatten(key, v, out);
    } else {
      out.push([key, _stringify(v)]);
    }
  }
}

function _stringify(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string')  return v;
  if (typeof v === 'number')  return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return _safe(() => JSON.stringify(v), '');
}

export function listOrgReports(organizationId: string)
    : ReadonlyArray<OrgReportRecord> {
  return _safe(() => {
    const orgId = _str(organizationId);
    if (!orgId) return Object.freeze([] as OrgReportRecord[]);
    const pool = _records.filter((r) => r.organizationId === orgId);
    return Object.freeze(pool.map((r) => Object.freeze({ ...r })));
  }, Object.freeze([] as OrgReportRecord[]));
}

export { ORGANIZATION_DASHBOARD_VERSION };

/** Test-only — wipe. */
export function _resetOrgReports() {
  _records.length = 0;
}
