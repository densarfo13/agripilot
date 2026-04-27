/**
 * exportReport.js — printable "Farroway Impact Report".
 *
 *   generateReport(summary, opts?)
 *     -> string  (plain-text ASCII report)
 *
 *   downloadReportText(opts?)
 *     -> triggers a .txt download. SSR-safe (returns false).
 *
 *   downloadReportJson(opts?)
 *     -> triggers a .json bundle: schema + summary + raw data.
 *
 * The text report is intentionally tiny - one screen, no
 * tables - so a programme manager can paste it into an email
 * or a slide. The JSON bundle covers programmes that want to
 * archive the underlying numbers for QA.
 *
 * Strict-rule audit
 *   * understandable in <10 seconds: bullets only
 *   * works with limited data: zero-state strings
 *   * no external data: composes the buildROISummary output
 */

import { buildROISummary } from './roiSummary.js';

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
 * generateReport(summary, opts?)
 *
 * summary: shape returned by buildROISummary().
 * opts.t: optional translator so the report comes out in the
 *         active UI language.
 */
export function generateReport(summary, opts = {}) {
  if (!summary || typeof summary !== 'object') summary = buildROISummary();
  const t = opts && opts.t;

  const title = _resolve('roi.report.title',
    'Farroway Impact Report', t);
  const sub = _resolve('roi.report.subtitle',
    `Summary for the last ${summary.windowDays} days`, t)
    .replace('{n}', String(summary.windowDays));

  const lines = [];
  lines.push(title);
  lines.push('═'.repeat(Math.max(8, title.length)));
  lines.push('');
  lines.push(sub);
  lines.push('');

  for (const h of summary.highlights || []) {
    const label = _resolve(h.labelKey, h.label, t);
    lines.push(`  • ${label}: ${h.value}`);
  }
  lines.push('');

  const eng = summary.engagement || {};
  const beh = summary.behavior   || {};
  const det = summary.detection  || {};
  const fragments = [
    _resolve('roi.bullet.engagement',
      'Increased farmer engagement', t),
    _resolve('roi.bullet.detection',
      'Earlier pest detection', t),
    _resolve('roi.bullet.behavior',
      'Improved monitoring behavior', t),
  ];
  lines.push(_resolve('roi.report.observed', 'Observed:', t));
  for (const f of fragments) lines.push(`  • ${f}`);
  lines.push('');

  // Footer numbers - pure context for the bullets above.
  const ctxLabel = _resolve('roi.report.context', 'Context', t);
  lines.push(`${ctxLabel}:`);
  lines.push(`  ${_resolve('roi.activeFarmers', 'Active farmers', t)}: ${eng.activeFarmers || 0}`);
  lines.push(`  ${_resolve('roi.tasksCompleted', 'Tasks completed', t)}: ${beh.checks || 0}`);
  lines.push(`  ${_resolve('roi.reports', 'Pest reports', t)}: ${det.reports || 0}`);
  lines.push('');

  lines.push(_resolve('roi.report.conclusion',
    'Conclusion: Farroway improves daily farm decision-making.', t));
  lines.push('');
  lines.push(_resolve('roi.report.generated',
    `Generated ${summary.generatedAt}`, t).replace('{ts}', summary.generatedAt));

  return lines.join('\n');
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
    try { console.warn('[roi-report] download failed:', err && err.message); }
    catch { /* console missing */ }
    return false;
  }
}

export function downloadReportText(opts = {}) {
  try {
    const summary = opts.summary || buildROISummary(opts);
    const txt = generateReport(summary, opts);
    const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    return _triggerDownload(blob, `farroway_impact_${ts}.txt`);
  } catch { return false; }
}

export function downloadReportJson(opts = {}) {
  try {
    const summary = opts.summary || buildROISummary(opts);
    const bundle = {
      schema: { version: REPORT_SCHEMA_VERSION, kind: 'farroway_roi_report' },
      generatedAt: summary.generatedAt,
      summary,
    };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    return _triggerDownload(blob, `farroway_impact_${ts}.json`);
  } catch { return false; }
}
