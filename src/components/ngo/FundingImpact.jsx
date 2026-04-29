/**
 * FundingImpact — NGO/funder dashboard card with the v3
 * impact summary + CSV export.
 *
 *   <FundingImpact summary={impactSummary} />
 *
 * Spec contract (Buyer + Funding/Impact merge, § 9):
 *   * Cards: Total Farmers, Active Farmers (7d),
 *     Task Completion Rate, Avg Tasks/Farmer,
 *     High Risk Farms, Risk Reports (7d)
 *   * "Use this data to support donor reporting…" note
 *   * "Export Impact Summary" → CSV download
 *
 * Wording rule (spec § 8 — never claim guaranteed yield):
 *   Copy stays on monitoring + activity outcomes. The CSV
 *   itself carries a trailing note row reinforcing this.
 *
 * Strict-rule audit
 *   * Pure read — accepts the summary as a prop OR lazily
 *     computes one from the optional `events`/`farms`/`risks`
 *     arrays. No I/O, no hooks beyond useMemo.
 *   * Empty-safe — zeros are valid and render as "0".
 *   * CSV export uses a Blob URL + auto-revoke; never throws
 *     if the browser blocks downloads.
 */

import React, { useMemo } from 'react';
import {
  computeImpactSummary, impactSummaryToCsv,
} from '../../metrics/impactMetrics.js';
import { safeTrackEvent } from '../../lib/analytics.js';
import { tSafe } from '../../i18n/tSafe.js';
import { FARROWAY_BRAND } from '../../brand/farrowayBrand.js';

const C = FARROWAY_BRAND.colors;

export default function FundingImpact({
  // Pre-computed summary (preferred when the host already
  // has API data). If absent, we derive one from the
  // optional events/farms/risks props so the component still
  // renders something sensible in demos.
  summary,
  events, farms, risks,
  testId = 'ngo-funding-impact',
}) {
  const view = useMemo(() => {
    if (summary && typeof summary === 'object') return summary;
    return computeImpactSummary({ events, farms, risks });
  }, [summary, events, farms, risks]);

  React.useEffect(() => {
    try { safeTrackEvent('IMPACT_SUMMARY_VIEWED', {}); }
    catch { /* ignore */ }
  }, []);

  function handleExport() {
    try { safeTrackEvent('IMPACT_EXPORT_CLICKED', {}); }
    catch { /* ignore */ }

    try {
      const csv = impactSummaryToCsv(view);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `farroway-impact-${stamp}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Revoke on the next tick so the browser has time to
      // start the download.
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch {
      // If Blob/createObjectURL is unavailable (e.g. some
      // embedded webviews), silently no-op. The cards still
      // show the data on screen.
    }
  }

  const ratePct = Math.round(((view.taskCompletionRate ?? 0) * 100));

  return (
    <section style={S.section} data-testid={testId}>
      <header style={S.header}>
        <div>
          <p style={S.label}>
            {tSafe('ngo.fundingImpact', 'Funding & impact')}
          </p>
          <h2 style={S.title}>
            {tSafe('impact.title', 'Funding & Impact')}
          </h2>
          <p style={S.lead}>
            {tSafe('impact.subtitle',
              'Real-time program performance and donor-ready reporting.')}
          </p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          style={S.cta}
          data-testid={`${testId}-export`}
        >
          {tSafe('impact.exportSummary', 'Export Impact Summary')}
        </button>
      </header>

      <div style={S.metricsGrid}>
        <Metric icon="👥"
                label={tSafe('impact.totalFarmers', 'Total Farmers')}
                value={view.totalFarmers} />
        <Metric icon="📈"
                label={tSafe('impact.activeFarmers7d', 'Active Farmers (7d)')}
                value={view.activeFarmers7d}
                tone="good" />
        <Metric icon="✅"
                label={tSafe('impact.taskCompletionRate', 'Task Completion Rate')}
                value={`${ratePct}%`}
                tone="good" />
        <Metric icon="🗓️"
                label={tSafe('impact.avgTasksPerFarmer', 'Avg Tasks / Farmer')}
                value={view.avgTasksPerFarmer} />
        <Metric icon="⚠️"
                label={tSafe('impact.highRiskFarms', 'High Risk Farms')}
                value={view.highRiskFarms}
                tone={view.highRiskFarms > 0 ? 'warn' : 'neutral'} />
        <Metric icon="📡"
                label={tSafe('impact.riskReports7d', 'Risk Reports (7d)')}
                value={
                  (view.pestReports7d || 0)
                  + (view.droughtReports7d || 0)
                }
                tone="accent" />
      </div>

      <p style={S.donorNote}>
        {tSafe('impact.donorNote',
          'Use this data to support donor reporting, grant applications, and program monitoring.')}
      </p>
      <p style={S.honestyNote}>
        {tSafe('impact.honestyNote',
          'These are monitoring + activity metrics. Not a guarantee of yield.')}
      </p>
    </section>
  );
}

function Metric({ icon, label, value, tone = 'neutral' }) {
  const valueColour =
      tone === 'good'   ? C.lightGreen
    : tone === 'warn'   ? '#FCD34D'
    : tone === 'accent' ? '#86EFAC'
    :                     C.white;
  return (
    <div style={S.metric}>
      <div style={S.metricRow}>
        <span aria-hidden="true" style={S.metricIcon}>{icon}</span>
        <div style={{ ...S.metricValue, color: valueColour }}>
          {typeof value === 'string'
            ? value
            : Number(value || 0).toLocaleString()}
        </div>
      </div>
      <div style={S.metricLabel}>{label}</div>
    </div>
  );
}

const S = {
  section: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '16px',
    padding: '1.25rem',
    display: 'flex', flexDirection: 'column', gap: '1rem',
  },
  header: {
    display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap',
    justifyContent: 'space-between', gap: '0.75rem',
  },
  label: {
    margin: 0, color: C.lightGreen, fontSize: '0.6875rem',
    fontWeight: 800, textTransform: 'uppercase',
    letterSpacing: '0.10em',
  },
  title: {
    margin: '0.15rem 0 0', fontSize: '1.25rem',
    fontWeight: 800, color: C.white, letterSpacing: '-0.01em',
  },
  lead: {
    margin: '0.35rem 0 0',
    color: 'rgba(255,255,255,0.7)',
    fontSize: '0.9375rem', lineHeight: 1.5,
    maxWidth: '38rem',
  },
  cta: {
    display: 'inline-flex', alignItems: 'center',
    padding: '0.6rem 1rem', borderRadius: '10px',
    background: C.green, color: C.white,
    fontSize: '0.875rem', fontWeight: 800,
    border: 'none', cursor: 'pointer',
    boxShadow: '0 6px 18px rgba(34,197,94,0.25)',
    flexShrink: 0,
  },
  metricsGrid: {
    display: 'grid', gap: '0.75rem',
    gridTemplateColumns: 'repeat(auto-fit, minmax(10rem, 1fr))',
  },
  metric: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '12px',
    padding: '0.85rem',
    display: 'flex', flexDirection: 'column', gap: '0.25rem',
  },
  metricRow: { display: 'flex', alignItems: 'center', gap: '0.5rem' },
  metricIcon: { fontSize: '1.25rem' },
  metricValue: {
    fontSize: '1.5rem', fontWeight: 800, lineHeight: 1.05,
  },
  metricLabel: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: '0.8125rem',
    textTransform: 'uppercase',
    letterSpacing: '0.06em', fontWeight: 700,
  },

  donorNote: {
    margin: 0, color: 'rgba(255,255,255,0.7)',
    fontSize: '0.875rem', lineHeight: 1.55,
  },
  honestyNote: {
    margin: 0, color: 'rgba(255,255,255,0.5)',
    fontSize: '0.8125rem', fontStyle: 'italic',
  },
};
