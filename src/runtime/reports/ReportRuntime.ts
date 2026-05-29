/**
 * src/runtime/reports/ReportRuntime.ts — Composite + health.
 */

import {
  REPORT_RUNTIME_VERSION, REPORT_TYPES,
} from './reportContracts';
import {
  buildProgramReport, PROGRAM_REPORT_VERSION,
} from './ProgramReportEngine';
import {
  buildImpactReport, IMPACT_REPORT_VERSION,
} from './ImpactReportEngine';
import {
  exportReportCSV, EXPORT_SERVICE_VERSION,
} from './ExportService';

export {
  buildProgramReport, buildImpactReport, exportReportCSV,
  REPORT_RUNTIME_VERSION, REPORT_TYPES,
};

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

export function reportHealth() {
  return _safe(() => Object.freeze({
    runtimeVersion:        REPORT_RUNTIME_VERSION,
    initialized:           true,
    programReportsReady:   true,
    impactReportsReady:    true,
    csvExportReady:        true,
    fakeData:              false,
    versions: Object.freeze({
      program: PROGRAM_REPORT_VERSION,
      impact:  IMPACT_REPORT_VERSION,
      export:  EXPORT_SERVICE_VERSION,
    }),
  }), Object.freeze({
    runtimeVersion: REPORT_RUNTIME_VERSION,
    initialized: false,
    programReportsReady: false,
    impactReportsReady: false,
    csvExportReady: false,
    fakeData: false,
  }));
}

export function installReportRuntimeGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__reportHealth !== 'function') {
      w.__reportHealth = function () {
        const out = reportHealth();
        try { console.log('[Farroway · Reports]', out); }
        catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
