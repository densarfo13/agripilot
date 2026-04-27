/**
 * reportExport.js — "Download Report" for NGO operators.
 *
 *   buildReport(farms?, opts?)
 *     -> { schema, generatedAt, totals, regions: [...] }
 *
 *   downloadReport(opts?)
 *     -> triggers a JSON file download of the report.
 *
 *   downloadReportCsv(opts?)
 *     -> triggers a CSV download for spreadsheet workflows.
 *
 * The report is intentionally NGO-friendly: total farmers,
 * per-region risk counts, recommended actions. NO model
 * weights, NO probabilities, NO labels - this is the surface
 * a programme manager forwards to a board.
 *
 * Strict-rule audit
 *   * doesn't expose ML internals
 *   * works offline (composes the local stores)
 *   * never throws (download path try/catch wrapped)
 *   * lightweight: a single JSON or CSV blob
 */

import { computeAllRegionInsights } from './insightsEngine.js';
import { generateActions }           from './actionEngine.js';
import { getTrendDelta }             from './trendStore.js';

export const REPORT_SCHEMA_VERSION = 1;

function _resolve(messageKey, fallback, t) {
  if (typeof t === 'function' && messageKey) {
    try {
      const v = t(messageKey);
      if (v && v !== messageKey) return v;
    } catch { /* fall through */ }
  }
  return fallback || messageKey;
}

/**
 * buildReport(farms, opts?)
 *   farms: array; falls back to [] when omitted (the report
 *          is still emitted with totals = 0 so a sales demo
 *          can show the empty-state shape).
 *
 * opts:
 *   t          translator function (i18n) so the action lines
 *              come out in the active UI language.
 *   exporter   { name, email } stamped on the report header.
 */
export function buildReport(farms = [], opts = {}) {
  const insights = computeAllRegionInsights(Array.isArray(farms) ? farms : []);
  const trendByKey = new Map();
  for (const t of getTrendDelta(insights)) {
    trendByKey.set(`${t.country}|${t.region}`, t);
  }

  // Roll up totals once across regions.
  let totalFarms = 0, totalHighPest = 0, totalHighDrought = 0;
  for (const r of insights) {
    totalFarms       += Number(r.farms)       || 0;
    totalHighPest    += Number(r.pestHigh)    || 0;
    totalHighDrought += Number(r.droughtHigh) || 0;
  }

  // Per-region rows with resolved action lines.
  const regions = insights.map((r) => {
    const trend = trendByKey.get(`${r.country}|${r.region}`) || null;
    const actions = generateActions(r).map((a) => _resolve(a.messageKey, a.fallback, opts.t));
    return Object.freeze({
      country:        r.country,
      region:         r.region,
      farms:          r.farms,
      pestHigh:       r.pestHigh,
      droughtHigh:    r.droughtHigh,
      pestMedium:     r.pestMedium,
      droughtMedium:  r.droughtMedium,
      confidence:     r.confidence,
      severity:       r.severity,
      actions,
      trend:          trend ? Object.freeze({
        pestDelta:    trend.pestDelta,
        droughtDelta: trend.droughtDelta,
        direction:    trend.direction,
        sinceDate:    trend.sinceDate,
      }) : null,
    });
  });

  return {
    schema: {
      version:        REPORT_SCHEMA_VERSION,
      kind:           'farroway_ngo_report',
    },
    generatedAt:      new Date().toISOString(),
    exporter:         (opts.exporter && typeof opts.exporter === 'object') ? opts.exporter : null,
    totals: {
      farms:        totalFarms,
      regions:      regions.length,
      highPest:     totalHighPest,
      highDrought:  totalHighDrought,
    },
    regions,
  };
}

/* ─── Browser-side downloads ─────────────────────────────────── */

function _triggerDownload(blob, filename) {
  if (typeof document === 'undefined' || typeof URL === 'undefined') return false;
  try {
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => { try { URL.revokeObjectURL(url); } catch { /* swallow */ } }, 1000);
    return true;
  } catch (err) {
    try { console.warn('[ngo-report] download failed:', err && err.message); }
    catch { /* console missing */ }
    return false;
  }
}

function _csvEscape(v) {
  const s = v == null ? '' : String(v);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function _toCsv(report) {
  const rows = [];
  rows.push([
    'country', 'region', 'farms',
    'high_pest', 'medium_pest',
    'high_drought', 'medium_drought',
    'severity', 'confidence',
    'pest_delta_vs_yesterday', 'drought_delta_vs_yesterday',
    'actions',
  ].map(_csvEscape).join(','));

  for (const r of report.regions) {
    rows.push([
      r.country,
      r.region,
      r.farms,
      r.pestHigh,
      r.pestMedium,
      r.droughtHigh,
      r.droughtMedium,
      r.severity,
      r.confidence,
      r.trend ? r.trend.pestDelta    : '',
      r.trend ? r.trend.droughtDelta : '',
      (r.actions || []).join(' | '),
    ].map(_csvEscape).join(','));
  }
  return rows.join('\r\n') + '\r\n';
}

/**
 * downloadReport(opts?)
 *   Triggers a JSON download of buildReport(). No-op on SSR.
 */
export function downloadReport(farms = [], opts = {}) {
  try {
    const report = buildReport(farms, opts);
    const blob = new Blob(
      [JSON.stringify(report, null, 2)],
      { type: 'application/json' },
    );
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    return _triggerDownload(blob, `farroway_ngo_report_${ts}.json`);
  } catch { return false; }
}

/**
 * downloadReportCsv(opts?)
 *   Triggers a CSV download. Easier to drop into Google Sheets.
 */
export function downloadReportCsv(farms = [], opts = {}) {
  try {
    const report = buildReport(farms, opts);
    const csv = _toCsv(report);
    const blob = new Blob([csv], { type: 'text/csv' });
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    return _triggerDownload(blob, `farroway_ngo_report_${ts}.csv`);
  } catch { return false; }
}
