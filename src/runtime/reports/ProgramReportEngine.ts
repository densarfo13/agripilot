/**
 * src/runtime/reports/ProgramReportEngine.ts — NGO program
 * report composer. Real aggregates only — "Not enough data
 * yet" when samples are absent.
 */

import {
  REPORT_RUNTIME_VERSION, REPORT_EMPTY_STATE,
} from './reportContracts';

export const PROGRAM_REPORT_VERSION = 'program-report-engine-v1';

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _arr  = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const _str  = (v: unknown): string => (typeof v === 'string' ? v : '');
const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _now = () => _safe(() => new Date().toISOString(), '');

interface ProgramCtx {
  programId:      string;
  organizationId: string;
  farmers?:       ReadonlyArray<any>;
  scans?:         ReadonlyArray<any>;
  tasks?:         ReadonlyArray<any>;
  interventions?: ReadonlyArray<any>;
  artifacts?:     ReadonlyArray<any>;
  periodStart?:   string;
  periodEnd?:     string;
  generatedBy?:   string;
}

export function buildProgramReport(ctx: ProgramCtx) {
  return _safe(() => {
    if (!_isObj(ctx)) return _emptyProgramReport();
    const farmers       = _arr(ctx.farmers);
    const scans         = _arr(ctx.scans);
    const tasks         = _arr(ctx.tasks);
    const interventions = _arr(ctx.interventions);
    const artifacts     = _arr(ctx.artifacts);

    const farmersEnrolled = farmers.length;
    const activeFarmers   = farmers.filter((f) =>
      _isObj(f) && (f as any).active !== false).length;
    const tasksCompleted  = tasks.filter((t) =>
      _isObj(t) && (t as any).completed === true).length;
    const interventionsCompleted = interventions.filter((i) =>
      _isObj(i) && (i as any).completed === true).length;
    const evidenceCount   = artifacts.filter((a) =>
      _isObj(a) && _str((a as any).type) === 'InterventionArtifact')
      .length;

    const metrics = Object.freeze({
      farmersEnrolled,
      activeFarmers,
      tasksCompleted,
      interventionsCompleted,
      plantsCount: _safe(() => {
        const set = new Set<string>();
        for (const s of scans) {
          if (_isObj(s) && _str((s as any).plantId)) set.add(_str((s as any).plantId));
        }
        return set.size;
      }, 0),
      scansCount:  scans.length,
      evidenceCount,
    });

    // Honesty — if every metric is zero, surface the empty state.
    const total = farmersEnrolled + scans.length + tasks.length
      + interventions.length + artifacts.length;
    const emptyState = total === 0 ? REPORT_EMPTY_STATE : '';

    return Object.freeze({
      runtimeVersion: PROGRAM_REPORT_VERSION,
      reportId:       'report_' + _str(ctx.programId) + '_' + _now(),
      type:           'program_summary',
      organizationId: _str(ctx.organizationId),
      programId:      _str(ctx.programId),
      periodStart:    _str(ctx.periodStart),
      periodEnd:      _str(ctx.periodEnd),
      metrics,
      emptyState,
      generatedAt:    _now(),
      generatedBy:    _str(ctx.generatedBy),
      fakeData:       false,
    });
  }, _emptyProgramReport());
}

function _emptyProgramReport() {
  return Object.freeze({
    runtimeVersion: PROGRAM_REPORT_VERSION,
    reportId: '', type: 'program_summary',
    organizationId: '', programId: '',
    periodStart: '', periodEnd: '',
    metrics: Object.freeze({
      farmersEnrolled: 0, activeFarmers: 0,
      tasksCompleted: 0, interventionsCompleted: 0,
      plantsCount: 0, scansCount: 0, evidenceCount: 0,
    }),
    emptyState: REPORT_EMPTY_STATE,
    generatedAt: _now(),
    generatedBy: '',
    fakeData: false,
  });
}

export { REPORT_RUNTIME_VERSION };
