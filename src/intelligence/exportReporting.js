/**
 * exportReporting.js — Phase 4 stub.
 *
 * STATUS: STUB BACKLOG. NOT imported anywhere. Designed entrypoint
 * for "produce a printable / downloadable report" — the artefact
 * NGOs hand to donors / governments / partners. Future wire reads
 * from ngoAnalytics / programDashboard / farmerActivityMetrics /
 * cropRiskHotspots and shapes the data for export.
 *
 * Stays format-agnostic at this layer — the consumer chooses
 * CSV / PDF / XLSX rendering. This module returns structured data
 * the renderer transforms.
 *
 * Output shape:
 *
 *   {
 *     reportId:        string | null,
 *     generatedAtISO:  string | null,
 *     coveragePeriod:  { startISO, endISO } | null,
 *     sections:        ReportSection[],
 *     totals:          { key, value, label }[],   // label uses i18n key
 *   }
 *
 * @typedef {object} ReportSection
 * @property {string} titleKey      i18n key
 * @property {string} kind          'table' | 'kpi' | 'chart' | 'narrative'
 * @property {object} payload       shape depends on `kind`
 */

export function buildExportReport(input = {}) {
  return Object.freeze({
    reportId:        null,
    generatedAtISO:  null,
    coveragePeriod:  null,
    sections:        [],
    totals:          [],
    _input:          input,
    _version:        EXPORT_REPORTING_VERSION,
  });
}

export const EXPORT_REPORTING_VERSION = '0.1.0-stub';
