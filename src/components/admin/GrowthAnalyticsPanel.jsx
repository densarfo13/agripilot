/**
 * GrowthAnalyticsPanel — read-only renderer for the Growth
 * Analytics Dashboard payload (`buildGrowthAnalytics`).
 *
 * Five sections (Growth Analytics §6):
 *   1. Overview metrics  — total events, sessions, DAU, last event
 *   2. Funnel chart      — 5 stages with horizontal bars + drop-off %
 *   3. Retention chart   — D1 / D2 / D7 cohort markers
 *   4. Viral metrics     — shares triggered / completed / landing views
 *   5. Revenue           — paywall views + conversions + estimated USD
 *
 * Strict-rule audit
 *   • Read-only — never mutates any store. All numbers come from
 *     `buildGrowthAnalytics()` which itself is a pure derivation
 *     of `getEvents()`.
 *   • All visible text via tStrict; charts use plain divs (no
 *     external chart lib) so the panel boots offline.
 *   • Self-hides nothing — empty data still renders zeros so
 *     the operator can see "yes, the panel is wired and yes the
 *     event log is empty".
 *   • Caller-supplied `events` lets the panel plug into a
 *     server-fed event window if/when the team ships a
 *     /api/events ingestion endpoint.
 */

import { useMemo } from 'react';
import { useStrictTranslation as useTranslation } from '../../i18n/useStrictTranslation.js';
import { tStrict } from '../../i18n/strictT.js';
import { buildGrowthAnalytics } from '../../analytics/growthAnalytics.js';

function _fmt(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '0';
  if (v >= 1000) return v.toLocaleString();
  return String(v);
}

function _fmtPct(n) {
  if (n == null || !Number.isFinite(n)) return '\u2014';
  return `${n.toFixed(1)}%`;
}

export default function GrowthAnalyticsPanel({
  events,
  windowDays = 7,
  testId = 'growth-analytics-panel',
}) {
  // Subscribe to language change so labels refresh on flip.
  useTranslation();

  const data = useMemo(() => {
    try { return buildGrowthAnalytics({ events, windowDays }); }
    catch {
      return {
        overview: { totalEvents: 0, distinctSessions: 0, dau7: 0, wau: 0, lastEventAt: null },
        funnel: [], retention: { day1: 0, day2: 0, day7: 0 },
        viral: { sharesTriggered: 0, sharesCompleted: 0, landingViews: 0, landingCtaTaps: 0, newUsersFromShare: 0 },
        monetization: { paywallViews: 0, paidConversions: 0, estimatedRevenueUsd: 0 },
        generatedAt: null,
      };
    }
  }, [events, windowDays]);

  const maxFunnel = Math.max(1, ...data.funnel.map((r) => r.count || 0));

  return (
    <section style={S.section} data-testid={testId}>
      <header style={S.header}>
        <h2 style={S.title}>
          {tStrict('growth.dashboard.title', 'Growth analytics')}
        </h2>
        {data.generatedAt ? (
          <span style={S.timestamp} data-testid={`${testId}-generated-at`}>
            {tStrict('growth.dashboard.generatedAt',
              `Generated ${new Date(data.generatedAt).toLocaleString()}`,
              { ts: data.generatedAt })}
          </span>
        ) : null}
      </header>

      {/* 1. Overview */}
      <div style={S.subSection}>
        <h3 style={S.subTitle}>
          {tStrict('growth.dashboard.overview', 'Overview')}
        </h3>
        <div style={S.statGrid}>
          <Stat label={tStrict('growth.dashboard.totalEvents',     'Total events')}        value={_fmt(data.overview.totalEvents)} />
          <Stat label={tStrict('growth.dashboard.sessions',         'Sessions')}            value={_fmt(data.overview.distinctSessions)} />
          <Stat label={tStrict('growth.dashboard.dau',              `DAU (${windowDays}d)`,
            { windowDays })}            value={_fmt(data.overview.dau7)} />
          <Stat label={tStrict('growth.dashboard.weekTotal',        'Events (7d)')}         value={_fmt(data.overview.wau)} />
        </div>
      </div>

      {/* 2. Funnel */}
      <div style={S.subSection}>
        <h3 style={S.subTitle}>
          {tStrict('growth.dashboard.funnel', 'Funnel')}
        </h3>
        {data.funnel.length === 0 ? (
          <p style={S.empty}>
            {tStrict('growth.dashboard.empty', 'No events recorded yet.')}
          </p>
        ) : (
          <div style={S.funnelList}>
            {data.funnel.map((row) => {
              const widthPct = Math.max(2,
                Math.round(((row.count || 0) / maxFunnel) * 100));
              return (
                <div
                  key={row.stage}
                  style={S.funnelRow}
                  data-stage={row.stage}
                >
                  <span style={S.funnelLabel}>
                    {tStrict(`growth.funnel.${row.stage}`, _humanize(row.stage))}
                  </span>
                  <div style={S.funnelBarTrack}>
                    <div
                      style={{
                        ...S.funnelBarFill,
                        width: `${widthPct}%`,
                      }}
                    />
                  </div>
                  <span style={S.funnelCount}>{_fmt(row.count)}</span>
                  <span style={S.funnelConversion}>
                    {row.conversionPct == null ? '\u2014' : _fmtPct(row.conversionPct)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Retention */}
      <div style={S.subSection}>
        <h3 style={S.subTitle}>
          {tStrict('growth.dashboard.retention', 'Retention')}
        </h3>
        <div style={S.statGrid}>
          <Stat label={tStrict('growth.dashboard.day1', 'Day 1 returns')} value={_fmt(data.retention.day1)} />
          <Stat label={tStrict('growth.dashboard.day2', 'Day 2 returns')} value={_fmt(data.retention.day2)} />
          <Stat label={tStrict('growth.dashboard.day7', 'Day 7 returns')} value={_fmt(data.retention.day7)} />
        </div>
      </div>

      {/* 4. Viral */}
      <div style={S.subSection}>
        <h3 style={S.subTitle}>
          {tStrict('growth.dashboard.viral', 'Viral loop')}
        </h3>
        <div style={S.statGrid}>
          <Stat label={tStrict('growth.dashboard.sharesTriggered',  'Shares triggered')}     value={_fmt(data.viral.sharesTriggered)} />
          <Stat label={tStrict('growth.dashboard.sharesCompleted',  'Shares completed')}     value={_fmt(data.viral.sharesCompleted)} />
          <Stat label={tStrict('growth.dashboard.landingViews',      'Landing views')}        value={_fmt(data.viral.landingViews)} />
          <Stat label={tStrict('growth.dashboard.landingCtaTaps',    'Landing CTA taps')}     value={_fmt(data.viral.landingCtaTaps)} />
          <Stat label={tStrict('growth.dashboard.newUsersFromShare', 'New users from share')} value={_fmt(data.viral.newUsersFromShare)} />
        </div>
      </div>

      {/* 5. Monetization */}
      <div style={S.subSection}>
        <h3 style={S.subTitle}>
          {tStrict('growth.dashboard.monetization', 'Monetization')}
        </h3>
        <div style={S.statGrid}>
          <Stat label={tStrict('growth.dashboard.paywallViews',     'Paywall views')}    value={_fmt(data.monetization.paywallViews)} />
          <Stat label={tStrict('growth.dashboard.paidConversions',  'Paid conversions')} value={_fmt(data.monetization.paidConversions)} />
          <Stat label={tStrict('growth.dashboard.revenue',          'Revenue (USD)')}    value={`$${_fmt(data.monetization.estimatedRevenueUsd)}`} />
        </div>
        <p style={S.honesty}>
          {tStrict('growth.dashboard.revenueHonesty',
            'Revenue is a server-truth metric \u2014 wired when the billing webhook ingests subscription events.')}
        </p>
      </div>
    </section>
  );
}

function Stat({ label, value }) {
  return (
    <div style={S.stat}>
      <div style={S.statValue}>{value}</div>
      <div style={S.statLabel}>{label}</div>
    </div>
  );
}

function _humanize(slug) {
  return String(slug || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const C = {
  green:   '#C8944D',
  greenFg: '#86EFAC',
  ink:     '#EAF2FF',
  inkSoft: 'rgba(255,255,255,0.72)',
  inkDim:  'rgba(255,255,255,0.55)',
};

const S = {
  section: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: '1.25rem',
    color: C.ink,
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  header: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    margin: 0,
    fontSize: '1.125rem',
    fontWeight: 800,
  },
  timestamp: {
    fontSize: '0.75rem',
    color: C.inkDim,
    fontVariantNumeric: 'tabular-nums',
  },
  subSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.625rem',
  },
  subTitle: {
    margin: 0,
    fontSize: '0.6875rem',
    fontWeight: 800,
    color: C.greenFg,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  statGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '0.5rem',
  },
  stat: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: '0.625rem 0.75rem',
  },
  statValue: {
    fontSize: '1.25rem',
    fontWeight: 800,
    fontVariantNumeric: 'tabular-nums',
    color: '#FFFFFF',
  },
  statLabel: {
    fontSize: '0.7rem',
    color: C.inkDim,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    marginTop: 2,
  },
  funnelList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  funnelRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(140px, 1fr) 2fr 60px 60px',
    alignItems: 'center',
    gap: 8,
    fontSize: '0.85rem',
  },
  funnelLabel: {
    color: C.inkSoft,
    fontWeight: 600,
  },
  funnelBarTrack: {
    height: 10,
    borderRadius: 999,
    background: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
  },
  funnelBarFill: {
    height: '100%',
    background: C.green,
    transition: 'width 240ms ease',
  },
  funnelCount: {
    textAlign: 'right',
    fontVariantNumeric: 'tabular-nums',
    fontWeight: 700,
    color: '#FFFFFF',
  },
  funnelConversion: {
    textAlign: 'right',
    fontVariantNumeric: 'tabular-nums',
    color: C.greenFg,
    fontWeight: 700,
    fontSize: '0.78rem',
  },
  empty: {
    margin: 0,
    fontSize: '0.85rem',
    color: C.inkDim,
    fontStyle: 'italic',
  },
  honesty: {
    margin: 0,
    fontSize: '0.75rem',
    fontStyle: 'italic',
    color: C.inkDim,
  },
};
