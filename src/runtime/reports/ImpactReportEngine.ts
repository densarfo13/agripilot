/**
 * src/runtime/reports/ImpactReportEngine.ts — Aggregated
 * impact summary. Composition over the existing enterprise
 * ImpactReportEngine + Outcome Tracker.
 */

import { REPORT_EMPTY_STATE } from './reportContracts';

export const IMPACT_REPORT_VERSION = 'impact-report-engine-v1';

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _arr  = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const _str  = (v: unknown): string => (typeof v === 'string' ? v : '');
const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _now = () => _safe(() => new Date().toISOString(), '');

interface ImpactCtx {
  organizationId?: string;
  programs?:       ReadonlyArray<any>;
  outcomes?:       ReadonlyArray<any>;
  plantHealth?:    ReadonlyArray<any>;
  generatedBy?:    string;
}

export function buildImpactReport(ctx: ImpactCtx) {
  return _safe(() => {
    if (!_isObj(ctx)) return _emptyImpactReport();
    const programs    = _arr(ctx.programs);
    const outcomes    = _arr(ctx.outcomes);
    const plantHealth = _arr(ctx.plantHealth);

    let improved = 0, declined = 0, stable = 0;
    for (const o of outcomes) {
      if (!_isObj(o)) continue;
      const s = _str((o as any).outcomeSignal || (o as any).verdict);
      if      (s === 'improved' || s === 'plant_health_improved') improved++;
      else if (s === 'declined' || s === 'plant_health_declined') declined++;
      else if (s === 'stable')                                     stable++;
    }
    const total = programs.length + outcomes.length + plantHealth.length;
    const emptyState = total === 0 ? REPORT_EMPTY_STATE : '';

    return Object.freeze({
      runtimeVersion: IMPACT_REPORT_VERSION,
      reportId:       'impact_' + _str(ctx.organizationId) + '_' + _now(),
      type:           'plant_health',
      organizationId: _str(ctx.organizationId),
      metrics: Object.freeze({
        programCount:   programs.length,
        outcomeCount:   outcomes.length,
        improvedCount:  improved,
        stableCount:    stable,
        declinedCount:  declined,
      }),
      emptyState,
      generatedAt: _now(),
      generatedBy: _str(ctx.generatedBy),
      fakeData:    false,
    });
  }, _emptyImpactReport());
}

function _emptyImpactReport() {
  return Object.freeze({
    runtimeVersion: IMPACT_REPORT_VERSION,
    reportId: '', type: 'plant_health',
    organizationId: '',
    metrics: Object.freeze({
      programCount: 0, outcomeCount: 0,
      improvedCount: 0, stableCount: 0, declinedCount: 0,
    }),
    emptyState: REPORT_EMPTY_STATE,
    generatedAt: _now(),
    generatedBy: '',
    fakeData: false,
  });
}
