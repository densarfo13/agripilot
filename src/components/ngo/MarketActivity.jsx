/**
 * MarketActivity — NGO dashboard card showing local market
 * activity (listings + buyer interests).
 *
 *   <MarketActivity />
 *
 * Reads from `marketStore.marketSummary()` so it works
 * without a backend. When server-side market endpoints exist
 * the host can replace `summary` with the API payload — the
 * shape is the same.
 *
 * Spec contract (Buyer + Funding/Impact merge, § 7):
 *   * Total / Active / Sold listings
 *   * Buyer interests count
 *   * Top crops (active)
 *   * Regions with active produce
 *   * CTA: View Marketplace
 *
 * Strict-rule audit
 *   * Read-only — never mutates the store
 *   * Empty-safe — renders calm "No market activity yet"
 *     copy with a hint, not an error
 *   * No farmer PII surfaced — counts only
 */

import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { marketSummary } from '../../market/marketStore.js';
import { tSafe } from '../../i18n/tSafe.js';
import { FARROWAY_BRAND } from '../../brand/farrowayBrand.js';

const C = FARROWAY_BRAND.colors;

export default function MarketActivity({
  // Optional override — when the host has server data it
  // can pass it in directly. Default: derive from local
  // marketStore.
  summary,
  testId = 'ngo-market-activity',
}) {
  const view = useMemo(
    () => summary || marketSummary(),
    [summary],
  );

  const empty =
       (view.totalListings  || 0) === 0
    && (view.activeListings || 0) === 0
    && (view.soldListings   || 0) === 0;

  return (
    <section style={S.section} data-testid={testId}>
      <header style={S.header}>
        <div>
          <p style={S.label}>
            {tSafe('ngo.marketActivity', 'Market activity')}
          </p>
          <h2 style={S.title}>
            {tSafe('ngo.marketActivityTitle',
              'What farmers are listing this week')}
          </h2>
        </div>
        <Link to="/marketplace" style={S.cta}
              data-testid={`${testId}-view-marketplace`}>
          {tSafe('ngo.viewMarketplace', 'View Marketplace')} →
        </Link>
      </header>

      {empty ? (
        <div style={S.empty}>
          <span style={S.emptyIcon} aria-hidden="true">📦</span>
          <p style={S.emptyText}>
            {tSafe('ngo.market.noActivity',
              'No market activity yet.')}
          </p>
          <p style={S.emptyHint}>
            {tSafe('ngo.market.noActivityHint',
              'Once farmers mark their crops ready for sale, the listings will appear here.')}
          </p>
        </div>
      ) : (
        <>
          <div style={S.metricsGrid}>
            <Metric label={tSafe('ngo.market.total', 'Total listings')}
                    value={view.totalListings} />
            <Metric label={tSafe('ngo.market.active', 'Active')}
                    value={view.activeListings} tone="good" />
            <Metric label={tSafe('ngo.market.sold', 'Sold')}
                    value={view.soldListings} tone="muted" />
            <Metric label={tSafe('ngo.market.interests', 'Buyer interests')}
                    value={view.interestCount} tone="accent" />
          </div>

          {/* Top crops */}
          {Array.isArray(view.topCrops) && view.topCrops.length > 0 && (
            <div style={S.subsection} data-testid={`${testId}-top-crops`}>
              <p style={S.subLabel}>
                {tSafe('ngo.market.topCrops', 'Top crops listed')}
              </p>
              <div style={S.chipRow}>
                {view.topCrops.slice(0, 5).map((c) => (
                  <span key={c.crop} style={S.chip}>
                    {c.crop}
                    <span style={S.chipCount}>{c.count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Regions */}
          {Array.isArray(view.regionsActive) && view.regionsActive.length > 0 && (
            <div style={S.subsection} data-testid={`${testId}-regions`}>
              <p style={S.subLabel}>
                {tSafe('ngo.market.regions', 'Regions with active produce')}
              </p>
              <div style={S.chipRow}>
                {view.regionsActive.slice(0, 8).map((r) => (
                  <span key={r} style={{ ...S.chip, ...S.chipNeutral }}>
                    📍 {r}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function Metric({ label, value, tone = 'neutral' }) {
  const colour =
      tone === 'good'   ? C.lightGreen
    : tone === 'accent' ? '#86EFAC'
    : tone === 'muted'  ? 'rgba(255,255,255,0.5)'
    :                     C.white;
  return (
    <div style={S.metric}>
      <div style={{ ...S.metricValue, color: colour }}>
        {Number(value || 0).toLocaleString()}
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
    margin: '0.15rem 0 0', fontSize: '1.0625rem',
    fontWeight: 800, color: C.white, letterSpacing: '-0.005em',
  },
  cta: {
    display: 'inline-flex', alignItems: 'center',
    padding: '0.45rem 0.85rem', borderRadius: '999px',
    background: 'rgba(34,197,94,0.12)',
    border: '1px solid rgba(34,197,94,0.30)',
    color: C.lightGreen,
    fontSize: '0.8125rem', fontWeight: 700,
    textDecoration: 'none',
    flexShrink: 0,
  },
  metricsGrid: {
    display: 'grid', gap: '0.75rem',
    gridTemplateColumns: 'repeat(auto-fit, minmax(8rem, 1fr))',
  },
  metric: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '12px',
    padding: '0.75rem',
    display: 'flex', flexDirection: 'column', gap: '0.15rem',
  },
  metricValue: { fontSize: '1.5rem', fontWeight: 800,
                 lineHeight: 1.05 },
  metricLabel: { color: 'rgba(255,255,255,0.6)',
                 fontSize: '0.78rem',
                 textTransform: 'uppercase',
                 letterSpacing: '0.06em', fontWeight: 700 },

  subsection: { display: 'flex', flexDirection: 'column',
                gap: '0.4rem' },
  subLabel:   { margin: 0, color: 'rgba(255,255,255,0.6)',
                fontSize: '0.78rem',
                textTransform: 'uppercase',
                letterSpacing: '0.06em', fontWeight: 700 },
  chipRow:    { display: 'flex', flexWrap: 'wrap', gap: '0.4rem' },
  chip: {
    display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
    padding: '0.3rem 0.75rem',
    background: 'rgba(34,197,94,0.10)',
    border: '1px solid rgba(34,197,94,0.30)',
    borderRadius: '999px',
    color: C.lightGreen,
    fontSize: '0.8125rem', fontWeight: 700,
    textTransform: 'capitalize',
  },
  chipCount: {
    background: 'rgba(255,255,255,0.10)',
    color: C.white,
    padding: '0.05rem 0.45rem',
    borderRadius: '999px',
    fontSize: '0.7rem', fontWeight: 800,
  },
  chipNeutral: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.10)',
    color: 'rgba(255,255,255,0.85)',
  },

  empty: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px dashed rgba(255,255,255,0.12)',
    borderRadius: '12px',
    padding: '1.25rem',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', textAlign: 'center', gap: '0.35rem',
  },
  emptyIcon: { fontSize: '1.5rem' },
  emptyText: { margin: 0, color: C.white, fontWeight: 700,
               fontSize: '0.9375rem' },
  emptyHint: { margin: 0, color: 'rgba(255,255,255,0.6)',
               fontSize: '0.875rem', maxWidth: '24rem' },
};
