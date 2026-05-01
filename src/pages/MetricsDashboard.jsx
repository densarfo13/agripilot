/**
 * MetricsDashboard — investor-facing metrics surface at
 * `/internal/metrics`.
 *
 * Spec coverage (Funding readiness §2, §3)
 *   §2 Metrics dashboard: users, transactions, revenue
 *   §3 Track growth: weekly usage, retention
 *
 * Layout
 *   1. Headline KPI strip (6 tiles)
 *   2. Growth & retention block (week-over-week + D1/D7/D30)
 *   3. Per-market breakdown grid
 *
 * Strict-rule audit
 *   • All visible strings via tStrict.
 *   • Inline styles only.
 *   • Self-suppresses behind the `investorMetrics` flag — flag-off
 *     path renders a calm "internal only" notice so the route is
 *     never 404-bait.
 *   • Reads only via the growthMetrics aggregator (pure read on
 *     existing stores).
 *   • Numbers are local-pilot scale; production billing
 *     integration replaces the revenue line in one swap (see
 *     growthMetrics.js comments).
 */

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from '../i18n/index.js';
import { tStrict } from '../i18n/strictT.js';
import { isFeatureEnabled } from '../config/features.js';
import {
  getGrowthMetrics,
  getHeadlineKPIs,
  getPerMarketBreakdown,
} from '../admin/growthMetrics.js';
import { getAttributionBySource } from '../admin/attributionMetrics.js';

const S = {
  page: {
    minHeight: '100vh',
    background: '#0B1D34',
    color: '#fff',
    padding: '20px 16px 96px',
    maxWidth: 1080,
    margin: '0 auto',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  title: {
    margin: 0,
    fontSize: 24,
    fontWeight: 800,
    letterSpacing: '-0.01em',
  },
  subtitle: {
    margin: '4px 0 0',
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 1.45,
  },
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: 10,
  },
  kpiCard: {
    background: '#162033',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 14,
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.6)',
  },
  kpiValue: { fontSize: 22, fontWeight: 800, color: '#fff' },

  block: {
    background: '#162033',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 14,
    padding: '14px 16px',
    color: '#EAF2FF',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
  },
  blockEyebrow: {
    margin: 0,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: '#86EFAC',
  },
  twoCol: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 10,
  },
  metaCard: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 10,
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  metaLabel: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.6)',
  },
  metaValue: { fontSize: 16, fontWeight: 800, color: '#fff' },
  metaSub: { fontSize: 12, color: 'rgba(255,255,255,0.65)' },

  cohortBar: {
    height: 8,
    background: 'rgba(255,255,255,0.10)',
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 4,
  },
  cohortFill: {
    height: '100%',
    background: '#22C55E',
    borderRadius: 999,
    transition: 'width 220ms ease-out',
  },

  marketGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 10,
  },
  marketCard: {
    background: '#162033',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 14,
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  marketHead: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
  },
  marketTitle: { fontSize: 14, fontWeight: 800, color: '#fff' },
  marketCurrency: {
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: '0.04em',
    color: 'rgba(255,255,255,0.65)',
  },
  marketStat: { fontSize: 12, color: 'rgba(255,255,255,0.78)' },

  comingSoon: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 14,
    padding: '20px 16px',
    color: 'rgba(255,255,255,0.78)',
    textAlign: 'center',
    fontSize: 14,
  },
};

function _pct(n) {
  return `${Math.round((Number(n) || 0) * 100)}%`;
}

export default function MetricsDashboard() {
  useTranslation();
  const flagOn = isFeatureEnabled('investorMetrics');
  const [tick, setTick] = useState(0);

  // Live refresh on cross-component change events so an investor
  // demo can show numbers tick up while a buyer / farmer
  // simulates activity in another tab.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handler = () => setTick((n) => (n + 1) % 1_000_000);
    const evts = [
      'farroway:market_changed',
      'farroway:engagement_changed',
      'farroway:boost_changed',
      'farroway:assist_changed',
      'farroway:referral_changed',
      'storage',
    ];
    try { for (const e of evts) window.addEventListener(e, handler); }
    catch { /* swallow */ }
    return () => {
      try { for (const e of evts) window.removeEventListener(e, handler); }
      catch { /* swallow */ }
    };
  }, []);

  const headline = useMemo(() => {
    if (!flagOn) return [];
    try { return getHeadlineKPIs(); } catch { return []; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flagOn, tick]);

  const metrics = useMemo(() => {
    if (!flagOn) return null;
    try { return getGrowthMetrics(); } catch { return null; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flagOn, tick]);

  const markets = useMemo(() => {
    if (!flagOn) return [];
    try { return getPerMarketBreakdown(); } catch { return []; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flagOn, tick]);

  // Attribution + funnel §4: by-source rows (installs / first-
  // action rate / day2 return rate / avg time-to-value).
  const attribution = useMemo(() => {
    if (!flagOn) return [];
    try { return getAttributionBySource(); } catch { return []; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flagOn, tick]);

  if (!flagOn) {
    return (
      <main style={S.page} data-screen="metrics-coming-soon">
        <h1 style={S.title}>
          {tStrict('metrics.title', 'Farroway metrics')}
        </h1>
        <div style={S.comingSoon}>
          {tStrict('metrics.comingSoon',
            'Internal metrics surface — enable VITE_FARROWAY_FEATURE_INVESTORMETRICS=1 to view.')}
        </div>
      </main>
    );
  }

  return (
    <main style={S.page} data-screen="metrics-dashboard">
      <div>
        <h1 style={S.title}>
          {tStrict('metrics.title', 'Farroway metrics')}
        </h1>
        <p style={S.subtitle}>
          {tStrict(
            'metrics.subtitle',
            'Live pilot snapshot. Numbers update as activity flows through the local stores.',
          )}
        </p>
      </div>

      {/* Headline KPI strip */}
      <section style={S.kpiGrid} data-testid="metrics-headline-strip">
        {headline.map((k) => (
          <div key={k.id} style={S.kpiCard} data-testid={`metrics-kpi-${k.id}`}>
            <span style={S.kpiLabel}>
              {tStrict(`metrics.kpi.${k.id}`, k.label)}
            </span>
            <span style={S.kpiValue}>{k.value}</span>
          </div>
        ))}
      </section>

      {/* Growth + retention */}
      {metrics ? (
        <section style={S.block} data-testid="metrics-growth-retention">
          <h3 style={S.blockEyebrow}>
            {tStrict('metrics.growthBlock', 'Growth + retention')}
          </h3>
          <div style={S.twoCol}>
            <div style={S.metaCard} data-testid="metrics-wow">
              <span style={S.metaLabel}>
                {tStrict('metrics.weekOverWeek', 'Week-over-week listings')}
              </span>
              <span style={S.metaValue}>
                {(metrics.growth.weekOverWeekChange || 0).toFixed(2)}{'\u00D7'}
              </span>
              <span style={S.metaSub}>
                {tStrict('metrics.weekOverWeekDetail',
                  '{thisWeek} this week \u00B7 {lastWeek} last week')
                  .replace('{thisWeek}', String(metrics.growth.newListingsThisWeek))
                  .replace('{lastWeek}', String(metrics.growth.newListingsLastWeek))}
              </span>
            </div>
            <div style={S.metaCard} data-testid="metrics-retention">
              <span style={S.metaLabel}>
                {tStrict('metrics.retention', 'Retention (active-day proxy)')}
              </span>
              <span style={S.metaValue}>
                {tStrict('metrics.retentionLine',
                  'D1 {d1} \u00B7 D7 {d7} \u00B7 D30 {d30}')
                  .replace('{d1}',  _pct(metrics.retention.d1))
                  .replace('{d7}',  _pct(metrics.retention.d7))
                  .replace('{d30}', _pct(metrics.retention.d30))}
              </span>
              <div style={S.cohortBar}>
                <div style={{
                  ...S.cohortFill,
                  width: `${Math.min(100, Math.round((metrics.retention.d7 || 0) * 100))}%`,
                }} />
              </div>
            </div>
            <div style={S.metaCard} data-testid="metrics-revenue-detail">
              <span style={S.metaLabel}>
                {tStrict('metrics.revenueDetail', 'Revenue mix (pilot pricing)')}
              </span>
              <span style={S.metaValue}>
                ${metrics.revenue.estimatedTotalUSD}
              </span>
              <span style={S.metaSub}>
                {tStrict('metrics.revenueLine',
                  'Boosts ${b} \u00B7 Assist ${a}')
                  .replace('${b}', String(metrics.revenue.boostsCharged))
                  .replace('${a}', String(metrics.revenue.assistFees))}
              </span>
            </div>
          </div>
        </section>
      ) : null}

      {/* Per-market breakdown */}
      <section style={S.block} data-testid="metrics-per-market">
        <h3 style={S.blockEyebrow}>
          {tStrict('metrics.perMarket', 'Per-market breakdown')}
        </h3>
        <div style={S.marketGrid}>
          {markets.map((m) => (
            <div
              key={m.id}
              style={S.marketCard}
              data-testid={`metrics-market-${m.id}`}
            >
              <div style={S.marketHead}>
                <span style={S.marketTitle}>{m.country}</span>
                <span style={S.marketCurrency}>{m.currency}</span>
              </div>
              <span style={S.marketStat}>
                {tStrict('metrics.marketLine',
                  '{l} listings \u00B7 {b} buyers \u00B7 {d} deals')
                  .replace('{l}', String(m.stats?.listingCount  || 0))
                  .replace('{b}', String(m.stats?.uniqueBuyers   || 0))
                  .replace('{d}', String(m.stats?.dealsClosed    || 0))}
              </span>
              <span style={S.marketStat}>
                {tStrict('metrics.marketConversion', 'Conv. {pct}')
                  .replace('{pct}', _pct(m.stats?.conversion || 0))}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Attribution + funnel §4: per-source breakdown table.
          Gated by the `attributionTracking` flag (in addition to
          `investorMetrics` which gates the whole dashboard). */}
      {isFeatureEnabled('attributionTracking') && attribution.length > 0 ? (
        <section style={S.block} data-testid="metrics-attribution">
          <h3 style={S.blockEyebrow}>
            {tStrict('metrics.attributionTitle', 'By acquisition source')}
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 13,
              color: '#EAF2FF',
            }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'rgba(255,255,255,0.6)', fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  <th style={{ padding: '6px 8px' }}>{tStrict('metrics.attr.source', 'Source')}</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>{tStrict('metrics.attr.installs', 'Installs')}</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>{tStrict('metrics.attr.firstActionRate', 'First-action %')}</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>{tStrict('metrics.attr.day2', 'D2 return %')}</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>{tStrict('metrics.attr.ttv', 'Avg TTV')}</th>
                </tr>
              </thead>
              <tbody>
                {attribution.map((row) => (
                  <tr
                    key={row.source}
                    style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
                    data-testid={`metrics-attr-row-${row.source}`}
                  >
                    <td style={{ padding: '8px', fontWeight: 700 }}>{row.source}</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>{row.installs}</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>{_pct(row.firstActionRate)}</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>{_pct(row.day2ReturnRate)}</td>
                    <td style={{ padding: '8px', textAlign: 'right', color: 'rgba(255,255,255,0.78)' }}>
                      {row.avgTimeToValueMs != null
                        ? `${Math.round(row.avgTimeToValueMs / 1000)}s`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </main>
  );
}
