/**
 * NgoValueDashboard — single-page "show me the value" surface for
 * NGO sales conversations. Mounts at /ngo.
 *
 * Distinct from the existing `NgoDashboard.jsx` (which is the
 * server-fed multi-program admin view). This one is the
 * monetisation / metrics-engine layer: pure local read, no API
 * calls, demo-ready out of the box.
 *
 * Reads farms from `ProfileContext.farms` (already used everywhere
 * for the multi-farm picker). When called as a child with an
 * explicit `farms` prop we honour that; otherwise we resolve from
 * context. Either way the dashboard is a thin shell over
 * `aggregateNGO`, so the metric definitions live in one testable
 * place.
 *
 * Strict rules respected:
 *   * never crashes when farms is empty / missing - aggregator
 *     returns a zero-state object
 *   * additive: nothing else needs to mount this; the route is
 *     opt-in
 *   * inline styles to match the codebase; no Tailwind dependency
 */

import React from 'react';
import { useProfile } from '../context/ProfileContext.jsx';
import { aggregateNGO } from '../metrics/ngoMetrics.js';
import { calculateNGOCost } from '../utils/pricingCalculator.js';
import { CURRENCY } from '../config/pricing.js';
import { tSafe } from '../i18n/tSafe.js';
import PestClusterPanel from '../components/ngo/PestClusterPanel.jsx';
import OutbreakWatchPanel from '../components/ngo/OutbreakWatchPanel.jsx';

function StatTile({ label, value, accent }) {
  return (
    <div style={{ ...S.tile, ...(accent ? S.tileAccent : null) }}>
      <span style={S.tileLabel}>{label}</span>
      <strong style={S.tileValue}>{value}</strong>
    </div>
  );
}

export default function NgoValueDashboard({ farms: farmsProp = null }) {
  const profile = useProfile();
  const farms = farmsProp != null
    ? farmsProp
    : (profile && Array.isArray(profile.farms) ? profile.farms : []);

  const stats = aggregateNGO(farms);
  const monthlyCost = calculateNGOCost(stats.totalFarmers);

  const fmtCount = (n) => {
    try { return new Intl.NumberFormat().format(n || 0); }
    catch { return String(n || 0); }
  };
  const fmtMoney = (n) => `${CURRENCY.symbol}${fmtCount(n)}`;

  return (
    <main style={S.page} data-testid="ngo-value-dashboard">
      <div style={S.container}>
        <header style={S.header}>
          <h1 style={S.h1}>{tSafe('ngo.dashboard.title', 'NGO Dashboard')}</h1>
          <p style={S.subtitle}>
            {tSafe(
              'ngo.dashboard.subtitle',
              'Programme-level view of farmer activity and engagement.',
            )}
          </p>
        </header>

        <section style={S.grid} data-testid="ngo-stats-grid">
          <StatTile
            label={tSafe('ngo.metric.totalFarmers', 'Total farmers')}
            value={fmtCount(stats.totalFarmers)}
          />
          <StatTile
            label={tSafe('ngo.metric.activeFarmers', 'Active farmers')}
            value={fmtCount(stats.activeFarmers)}
            accent
          />
          <StatTile
            label={tSafe('ngo.metric.highRisk', 'High-risk farmers')}
            value={fmtCount(stats.highRiskFarmers)}
          />
          <StatTile
            label={tSafe('ngo.metric.engagementRate', 'Engagement rate')}
            value={`${stats.engagementRate}%`}
            accent
          />
          <StatTile
            label={tSafe('ngo.metric.avgEngagement', 'Avg engagement score')}
            value={`${stats.avgEngagementScore}%`}
          />
          <StatTile
            label={tSafe('ngo.metric.avgYield', 'Avg yield uplift')}
            value={`+${stats.avgEstimatedYieldImpact}%`}
          />
        </section>

        <section style={S.billing} data-testid="ngo-billing">
          <span style={S.billingLabel}>
            {tSafe('ngo.dashboard.billing', 'Programme cost at this size')}
          </span>
          <strong style={S.billingValue}>
            {fmtMoney(monthlyCost)}
            <span style={S.billingPeriod}>
              {' '}/ {tSafe('ngo.dashboard.month', 'month')}
            </span>
          </strong>
        </section>

        {/* Outbreak Watch panel - the v1 Outbreak Intelligence
            System surface. Reads the structured outbreak-report
            mirror + runs the pure cluster engine. Sits next to
            the simpler v0 PestClusterPanel during transition;
            both are demo-ready. */}
        <OutbreakWatchPanel farms={farms} />

        {/* Pest activity panel (v0). Kept until every consumer
            migrates onto the v1 outbreak surface. */}
        <PestClusterPanel />
      </div>
    </main>
  );
}

const S = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #0B1D34 0%, #081423 100%)',
    color: '#EAF2FF',
    padding: '1.5rem 0 6rem',
  },
  container: {
    maxWidth: '52rem',
    margin: '0 auto',
    padding: '0 1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  header: { display: 'flex', flexDirection: 'column', gap: '0.25rem' },
  h1: { fontSize: '1.625rem', fontWeight: 800, margin: 0, color: '#EAF2FF' },
  subtitle: {
    margin: 0,
    fontSize: '0.9375rem',
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 1.5,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '0.75rem',
  },
  tile: {
    background: 'rgba(15, 32, 52, 0.9)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '16px',
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
    minHeight: '88px',
    justifyContent: 'center',
  },
  tileAccent: {
    border: '1px solid rgba(34,197,94,0.35)',
    background: 'linear-gradient(135deg, rgba(34,197,94,0.10) 0%, rgba(15,32,52,0.9) 100%)',
  },
  tileLabel: {
    fontSize: '0.75rem',
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    fontWeight: 600,
  },
  tileValue: { fontSize: '1.625rem', fontWeight: 800, color: '#EAF2FF' },
  billing: {
    background: 'rgba(15, 32, 52, 0.9)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '20px',
    padding: '1.25rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '0.375rem',
  },
  billingLabel: {
    fontSize: '0.8125rem',
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    fontWeight: 600,
  },
  billingValue: { fontSize: '1.875rem', fontWeight: 800, color: '#22C55E' },
  billingPeriod: {
    fontSize: '0.9375rem',
    color: 'rgba(255,255,255,0.55)',
    fontWeight: 500,
  },
};
