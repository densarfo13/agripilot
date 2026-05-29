/**
 * src/runtime/enterprise/ImpactReportEngine.ts — impact report
 * composer + CSV builder.
 *
 *   import {
 *     composeImpactReport, reportToCsv,
 *     IMPACT_REPORT_VERSION,
 *   } from 'src/runtime/enterprise/ImpactReportEngine';
 *
 * What this is
 * ────────────
 *   Builds a flat report envelope from real data (organization
 *   summary + program summaries + intervention completion) and
 *   exposes CSV serialization. PDF export deferred — adding a
 *   PDF dependency is outside this sprint's scope.
 *
 *   The report metrics map 1:1 to Phase 8 spec:
 *     farmers reached · active farmers · farms/gardens enrolled
 *     · plants tracked · scans completed · tasks completed
 *     · intervention completion · average health change
 *     · high risk count · top crops/plants · region summary
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • Composition-only.
 *   • Honest "—" when no signals.
 */

import {
  organizationSummary, programSummary,
} from './EnterpriseAnalyticsEngine';
import { REPORT_STATUSES, INTERVENTION_STATUSES } from './enterpriseContracts';

export const IMPACT_REPORT_VERSION = 'impact-report-v1';

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _arr   = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const _str   = (v: unknown): string => (typeof v === 'string' ? v : '');
const _num   = (v: unknown): number | null =>
  (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _safe  = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _now = () => _safe(() => new Date().toISOString(), '');

interface ReportCtx {
  organizationId?: string;
  programId?:      string;
  title?:          string;
  periodStart?:    string;
  periodEnd?:      string;
  farms?:          any[];
  gardens?:        any[];
  plants?:         any[];
  events?:         any[];
  programs?:       any[];
  participants?:   any[];
  interventions?:  any[];
}

function _topPlants(plants: any[]): any[] {
  const counts: Record<string, number> = {};
  for (const p of _arr(plants)) {
    if (!_isObj(p)) continue;
    const key = _str(p.commonName) || _str(p.category);
    if (!key) continue;
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.keys(counts)
    .map((k) => ({ name: k, count: counts[k] }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((e) => Object.freeze(e));
}

function _regionsSummary(farms: any[], gardens: any[]): any[] {
  const counts: Record<string, number> = {};
  for (const f of _arr(farms).concat(_arr(gardens))) {
    if (!_isObj(f)) continue;
    const r = _str(f.region);
    if (!r) continue;
    counts[r] = (counts[r] || 0) + 1;
  }
  return Object.keys(counts)
    .map((k) => ({ region: k, count: counts[k] }))
    .sort((a, b) => b.count - a.count)
    .map((e) => Object.freeze(e));
}

export function composeImpactReport(ctx: ReportCtx) {
  return _safe(() => {
    const c   = _isObj(ctx) ? ctx : {} as ReportCtx;
    const org = organizationSummary(c as any);
    const programs = _arr(c.programs);
    const perProgram = programs
      .filter((p) => _isObj(p)
        && (!c.organizationId || p.organizationId === c.organizationId))
      .map((p) => programSummary({
        ...c, programId: _str(p.id),
      } as any))
      .filter((s) => _isObj(s) && (s as any).hasAnySignal);

    const completed = _arr(c.interventions).filter((i) =>
      _isObj(i) && i.status === INTERVENTION_STATUSES.COMPLETED).length;
    const total     = _arr(c.interventions).length;
    const completionRate = total === 0 ? null
      : Math.round((completed / total) * 100);

    const metrics = Object.freeze({
      farmersReached:          (org as any).totals.farmers || 0,
      activeFarmers:           (org as any).totals.activeFarmers || 0,
      farmsEnrolled:           (org as any).totals.farms || 0,
      gardensEnrolled:         (org as any).totals.gardens || 0,
      plantsTracked:           (org as any).totals.plants || 0,
      scansCompleted:          (org as any).totals.scansCompleted || 0,
      tasksCompleted:          (org as any).totals.tasksCompleted || 0,
      interventionsCompleted:  completed,
      interventionsTotal:      total,
      interventionCompletionRatePct: completionRate,
      averagePlantHealth:      _num((org as any).averages.plantHealth),
      averageHealthChange:     null, // delta needs historical snapshots — deferred
      highRiskCount:           (org as any).totals.highRiskCount || 0,
      topPlants:               _topPlants(_arr(c.plants)),
      regions:                 _regionsSummary(_arr(c.farms),
                                                _arr(c.gardens)),
    });

    const status = (org as any).hasAnySignal
      ? REPORT_STATUSES.GENERATED
      : REPORT_STATUSES.DRAFT;

    return Object.freeze({
      runtimeVersion: IMPACT_REPORT_VERSION,
      title:          _str(c.title) || 'Impact Report',
      organizationId: _str(c.organizationId),
      programId:      _str(c.programId),
      periodStart:    _str(c.periodStart),
      periodEnd:      _str(c.periodEnd),
      status,
      metrics,
      perProgram,
      generatedAt:    _now(),
      deferred: Object.freeze({
        averageHealthChange:
          'requires per-period historical snapshots; ships when '
          + 'PlantTimelineEvent is in the database',
        pdfExport:
          'CSV only this sprint; PDF requires a PDF utility',
      }),
    });
  }, Object.freeze({
    runtimeVersion: IMPACT_REPORT_VERSION,
    title: '', organizationId: '', programId: '',
    periodStart: '', periodEnd: '',
    status: REPORT_STATUSES.DRAFT,
    metrics: Object.freeze({}),
    perProgram: Object.freeze([]),
    generatedAt: '',
  }));
}

/**
 * Flatten the report envelope into CSV rows. UI / route layer
 * handles the file download — this engine just builds the string.
 * Safe against quotes, commas, newlines.
 */
export function reportToCsv(report: any): string {
  return _safe(() => {
    if (!_isObj(report) || !_isObj(report.metrics)) return '';
    const rows: string[][] = [['metric', 'value']];
    const m = report.metrics;
    for (const k of Object.keys(m)) {
      const v = m[k];
      let cell: string;
      if (v == null) cell = '';
      else if (typeof v === 'number') cell = String(v);
      else if (Array.isArray(v)) {
        cell = v.map((entry) =>
          _isObj(entry) ? Object.values(entry).join(':') : String(entry)
        ).join('; ');
      } else cell = String(v);
      rows.push([k, cell]);
    }
    return rows.map((row) =>
      row.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(',')
    ).join('\n');
  }, '');
}
