/**
 * NGOMapDashboard — simple, fast NGO/admin overview built around
 * the new outbreak-cluster engine + farm-location map.
 *
 * Coexistence note
 *   src/pages/NgoDashboard.jsx is the OTHER NGO surface — the
 *   multi-program operator view that fetches /program-summary
 *   + /program-farmers + /program-risk + /program-performance.
 *   This dashboard does NOT replace it. Both are mountable;
 *   the host route picks whichever fits the persona.
 *
 *   This dashboard is the spec's simpler "map + clusters +
 *   priority actions" view tuned for fast first paint and
 *   GPS-aware visualisation.
 *
 * Sections (top -> bottom)
 *   1. Summary cards     total / active / high-pest /
 *                        high-drought / clusters
 *   2. Map               NGOMap (lazy leaflet, list fallback)
 *   3. Priority actions  getNGOAction list, calm imperative
 *   4. Region table      country / region / crop / risk count /
 *                        reports / recommended action
 *
 * Strict-rule audit
 *   * Simple + fast: thin presentational reads of pure helpers.
 *     No dashboard-specific API endpoints to wait on; data is
 *     in the props the host passes in.
 *   * Privacy: farm points only render inside the lazy-loaded
 *     map (which is itself behind the route-level
 *     ProtectedRoute). The region table aggregates per region
 *     and never names individual farms.
 *   * tSafe friendly throughout.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { tSafe } from '../i18n/tSafe.js';
import { useStrictTranslation as useTranslation } from '../i18n/useStrictTranslation.js';
import { detectClusters } from '../ngo/outbreakClusterEngine.js';
import { getNGOAction } from '../ngo/actionRecommendations.js';
// Map: use the new direct-leaflet variant at src/components/NGOMap.jsx.
// The older lazy-loaded src/ngo/NGOMap.jsx remains exported for
// callers that prefer Suspense-based code-splitting; this dashboard
// pays the leaflet chunk cost up-front because the map is the
// primary surface.
import NGOMap from '../components/NGOMap.jsx';
import { getFarms } from '../api/ngoApi.js';
import { hasGPS, getRegionKey } from '../location/geoUtils.js';
import BrandLogo from '../components/BrandLogo.jsx';
import { FARROWAY_BRAND } from '../brand/farrowayBrand.js';
import FundingImpact   from '../components/ngo/FundingImpact.jsx';
import MarketActivity  from '../components/ngo/MarketActivity.jsx';

function _safeArr(v) { return Array.isArray(v) ? v.filter(Boolean) : []; }

function _summarise({ farms, perFarmRisks }) {
  const safeFarms = _safeArr(farms);
  const totalFarmers = safeFarms.length;

  // "Active" without an explicit lastActivityAt field: any
  // farm with a non-empty crop AND either GPS or a region.
  // Hosts that have richer data should pass an explicit
  // activeFarms count.
  const activeFarmers = safeFarms.filter((f) =>
    f && f.crop && (hasGPS(f) || (f.region || f.country))).length;

  let highPest = 0;
  let highDrought = 0;
  if (perFarmRisks && typeof perFarmRisks === 'object') {
    for (const farm of safeFarms) {
      const id = String(farm.id || farm.farmerId || '');
      const r  = id ? perFarmRisks[id] : null;
      if (!r) continue;
      if (String(r.pest    || '').toUpperCase() === 'HIGH') highPest    += 1;
      if (String(r.drought || '').toUpperCase() === 'HIGH') highDrought += 1;
    }
  }
  return { totalFarmers, activeFarmers, highPest, highDrought };
}

function _regionTable({ farms, reports, perFarmRisks }) {
  const safeFarms   = _safeArr(farms);
  const safeReports = _safeArr(reports);
  const buckets = new Map();

  for (const f of safeFarms) {
    if (!f) continue;
    const key = getRegionKey({
      country: f.country || (f.location && f.location.country),
      region:  f.region  || (f.location && f.location.region),
      district: f.district || (f.location && f.location.district),
    });
    if (!key) continue;
    if (!buckets.has(key)) {
      buckets.set(key, {
        key,
        country: f.country || (f.location && f.location.country) || '',
        region:  f.region  || (f.location && f.location.region)  || '',
        crop:    f.crop || '',
        riskCount: 0,
        reportCount: 0,
      });
    }
    const id = String(f.id || f.farmerId || '');
    const r  = (perFarmRisks && id) ? perFarmRisks[id] : null;
    if (r && (String(r.pest || '').toUpperCase() === 'HIGH'
           || String(r.drought || '').toUpperCase() === 'HIGH')) {
      buckets.get(key).riskCount += 1;
    }
  }

  for (const r of safeReports) {
    const key = getRegionKey({
      country: r.country, region: r.region, district: r.district,
    });
    if (!key) continue;
    if (!buckets.has(key)) {
      buckets.set(key, {
        key,
        country: r.country || '', region: r.region || '',
        crop: r.crop || '',
        riskCount: 0, reportCount: 0,
      });
    }
    buckets.get(key).reportCount += 1;
  }

  const rows = Array.from(buckets.values());
  rows.sort((a, b) => (b.riskCount + b.reportCount) - (a.riskCount + a.reportCount));
  return rows.slice(0, 25);
}

export default function NGOMapDashboard({
  farms        = null,         // null = auto-fetch via getFarms()
  reports      = [],
  perFarmRisks = null,
  inactiveFarms = 0,
}) {
  useTranslation();   // subscribe to language change

  // Auto-fetch the farm list via /api/ngo/farms when the
  // caller didn't supply one. getFarms() is fail-safe — it
  // returns [] on any error so a 404 (deployment lag, missing
  // route on a downstream env) renders the map's calm
  // "Map data unavailable" fallback instead of crashing.
  // When the caller passes farms via prop (existing host /
  // tests), we skip the network round-trip entirely.
  const [fetchedFarms, setFetchedFarms] = useState(
    Array.isArray(farms) ? farms : [],
  );
  useEffect(() => {
    if (Array.isArray(farms)) return;
    let alive = true;
    getFarms()
      .then((rows) => { if (alive) setFetchedFarms(rows || []); })
      .catch(() => { /* getFarms already swallows; defensive */ });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const effectiveFarms = Array.isArray(farms) ? farms : fetchedFarms;

  const clusters = useMemo(
    () => detectClusters({ farms: effectiveFarms, reports, risks: perFarmRisks }),
    [effectiveFarms, reports, perFarmRisks],
  );

  const summary = useMemo(
    () => _summarise({ farms: effectiveFarms, perFarmRisks }),
    [effectiveFarms, perFarmRisks],
  );

  const activeClusterCount = useMemo(
    () => clusters.filter((c) => c.severity !== 'LOW').length,
    [clusters],
  );

  const actions = useMemo(() => getNGOAction({
    pestHigh:      summary.highPest,
    droughtHigh:   summary.highDrought,
    inactiveFarms: Number(inactiveFarms) || 0,
  }), [summary.highPest, summary.highDrought, inactiveFarms]);

  const regionRows = useMemo(
    () => _regionTable({ farms: effectiveFarms, reports, perFarmRisks }),
    [effectiveFarms, reports, perFarmRisks],
  );

  return (
    <main style={S.page} data-testid="ngo-map-dashboard">
      <div style={S.container}>
        {/* v3 brand header — Farroway logo top-left, tagline as
            the dashboard subtitle. Replaces the old plain "NGO
            Dashboard" h1 so operators always see the brand
            voice. The dashboard's section titles (h2) carry the
            specific surface labels below. */}
        <header style={S.brandHeader} data-testid="ngo-brand-header">
          <BrandLogo variant="light" size="md" />
          <p style={S.brandSubtitle}>{FARROWAY_BRAND.tagline}</p>
        </header>

        <h1 style={S.h1}>
          {tSafe('ngo.dashboard.title', 'NGO Dashboard')}
        </h1>

        {/* 1. Summary cards */}
        <section style={S.cardsGrid} data-testid="ngo-summary-cards">
          <SummaryCard
            label={tSafe('ngo.summary.totalFarmers', 'Total farmers')}
            value={summary.totalFarmers}
            testId="ngo-summary-total"
          />
          <SummaryCard
            label={tSafe('ngo.summary.activeFarmers', 'Active farmers')}
            value={summary.activeFarmers}
            testId="ngo-summary-active"
          />
          <SummaryCard
            label={tSafe('ngo.summary.highPest', 'High pest risk')}
            value={summary.highPest}
            tone="warning"
            testId="ngo-summary-pest"
          />
          <SummaryCard
            label={tSafe('ngo.summary.highDrought', 'High drought risk')}
            value={summary.highDrought}
            tone="warning"
            testId="ngo-summary-drought"
          />
          <SummaryCard
            label={tSafe('ngo.summary.activeClusters', 'Active clusters')}
            value={activeClusterCount}
            tone={activeClusterCount > 0 ? 'danger' : 'default'}
            testId="ngo-summary-clusters"
          />
        </section>

        {/* 2. Map — direct leaflet via src/components/NGOMap.jsx.
              Receives the auto-fetched (or prop-supplied) farms
              + the in-memory clusters. The component handles its
              own no-GPS fallback ("Map data unavailable...") so
              the dashboard's other sections always render below. */}
        <section style={S.section} data-testid="ngo-map-section">
          <h2 style={S.h2}>
            {tSafe('ngo.dashboard.mapTitle', 'Risk Map')}
          </h2>
          <NGOMap
            farms={effectiveFarms}
            clusters={clusters}
          />
        </section>

        {/* 3. Priority actions */}
        <section style={S.section} data-testid="ngo-actions-section">
          <h2 style={S.h2}>
            {tSafe('ngo.dashboard.actionsTitle', 'Priority actions')}
          </h2>
          {actions.length === 0 ? (
            <p style={S.empty}>
              {tSafe('ngo.dashboard.noUrgentActions',
                'No urgent actions right now.')}
            </p>
          ) : (
            <ul style={S.actionList} data-testid="ngo-actions-list">
              {actions.map((a, i) => (
                <li key={i} style={{ ...S.actionItem, ...(a.severity === 'high' ? S.actionHigh : null) }}>
                  <span style={S.actionDot} aria-hidden="true">{'\u2022'}</span>
                  <span style={S.actionText}>
                    {tSafe(a.messageKey, a.fallback)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 4. Funding & Impact (v3 buyer + funding layer).
              Reads the local event log + farms list to show
              donor-ready impact metrics with a CSV export.
              When server-side aggregates exist, the host can
              pass `summary` directly to FundingImpact. */}
        <FundingImpact
          farms={effectiveFarms}
          risks={perFarmRisks}
          testId="ngo-map-funding"
        />

        {/* 5. Market Activity (v3 buyer + funding layer).
              Reads marketStore so it works offline — listings
              + buyer interests roll up into a calm summary
              card pointing operators at /marketplace. */}
        <MarketActivity testId="ngo-map-market" />

        {/* 6. Region table */}
        <section style={S.section} data-testid="ngo-region-section">
          <h2 style={S.h2}>
            {tSafe('ngo.dashboard.regionTitle', 'Regions overview')}
          </h2>
          {regionRows.length === 0 ? (
            <p style={S.empty}>
              {tSafe('ngo.dashboard.noRegionData',
                'No region data yet.')}
            </p>
          ) : (
            <div style={S.tableWrap}>
              <table style={S.table} data-testid="ngo-region-table">
                <thead>
                  <tr>
                    <th style={S.th}>{tSafe('ngo.region.country', 'Country')}</th>
                    <th style={S.th}>{tSafe('ngo.region.region',  'Region')}</th>
                    <th style={S.th}>{tSafe('ngo.region.crop',    'Crop')}</th>
                    <th style={{ ...S.th, ...S.thNum }}>
                      {tSafe('ngo.region.riskCount', 'High risk')}
                    </th>
                    <th style={{ ...S.th, ...S.thNum }}>
                      {tSafe('ngo.region.reports', 'Reports')}
                    </th>
                    <th style={S.th}>
                      {tSafe('ngo.region.recommendedAction', 'Action')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {regionRows.map((r) => {
                    let actionText = tSafe('ngo.actions.monitor',
                      'Monitor this region for the next 48 hours.');
                    if (r.riskCount >= 5) {
                      actionText = tSafe('ngo.actions.pestDeploy',
                        'Send field agent to inspect high-risk farms');
                    } else if (r.reportCount >= 3) {
                      actionText = tSafe('ngo.actions.pestAdvise',
                        'Advise farmers to check crops today');
                    }
                    return (
                      <tr key={r.key}>
                        <td style={S.td}>{r.country || '\u2014'}</td>
                        <td style={S.td}>{r.region  || '\u2014'}</td>
                        <td style={S.td}>{r.crop    || '\u2014'}</td>
                        <td style={{ ...S.td, ...S.tdNum,
                          ...(r.riskCount > 0 ? S.tdAlert : null) }}>
                          {r.riskCount}
                        </td>
                        <td style={{ ...S.td, ...S.tdNum,
                          ...(r.reportCount > 0 ? S.tdAlert : null) }}>
                          {r.reportCount}
                        </td>
                        <td style={S.td}>{actionText}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function SummaryCard({ label, value, tone = 'default', testId = '' }) {
  const toneStyle = tone === 'warning' ? S.cardWarn
                  : tone === 'danger'  ? S.cardDanger
                  : S.cardDefault;
  return (
    <div style={{ ...S.card, ...toneStyle }} data-testid={testId}>
      <div style={S.cardValue}>{Number.isFinite(value) ? value : 0}</div>
      <div style={S.cardLabel}>{label}</div>
    </div>
  );
}

const S = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #0B1D34 0%, #081423 100%)',
    color: '#EAF2FF',
    padding: '1rem 0 4rem',
  },
  container: {
    maxWidth: '64rem',
    margin: '0 auto',
    padding: '0 1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  brandHeader: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '0.35rem',
    paddingBottom: '0.25rem',
  },
  brandSubtitle: {
    margin: 0,
    color: 'rgba(255,255,255,0.65)',
    fontSize: '0.875rem',
  },
  h1: {
    margin: 0,
    fontSize: '1.5rem',
    fontWeight: 800,
    color: '#EAF2FF',
  },
  h2: {
    margin: 0,
    fontSize: '1rem',
    fontWeight: 700,
    color: '#86EFAC',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  cardsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(8.5rem, 1fr))',
    gap: '0.5rem',
  },
  card: {
    padding: '0.875rem 1rem',
    borderRadius: '12px',
    border: '1px solid',
    background: 'rgba(255,255,255,0.04)',
    overflow: 'hidden',
    overflowWrap: 'break-word',
  },
  cardDefault: {
    borderColor: 'rgba(255,255,255,0.10)',
  },
  cardWarn: {
    borderColor: 'rgba(245,158,11,0.30)',
    background: 'rgba(245,158,11,0.06)',
  },
  cardDanger: {
    borderColor: 'rgba(239,68,68,0.40)',
    background: 'rgba(239,68,68,0.08)',
  },
  cardValue: {
    fontSize: '1.625rem',
    fontWeight: 800,
    color: '#FFFFFF',
    lineHeight: 1.1,
  },
  cardLabel: {
    marginTop: '0.25rem',
    fontSize: '0.75rem',
    color: 'rgba(255,255,255,0.65)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.625rem',
  },
  empty: {
    margin: 0,
    padding: '0.875rem 1rem',
    background: 'rgba(255,255,255,0.04)',
    border: '1px dashed rgba(255,255,255,0.18)',
    borderRadius: '12px',
    color: 'rgba(255,255,255,0.65)',
    fontSize: '0.9375rem',
  },
  actionList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.375rem',
  },
  actionItem: {
    display: 'flex',
    gap: '0.5rem',
    alignItems: 'flex-start',
    padding: '0.625rem 0.875rem',
    borderRadius: '10px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    color: '#EAF2FF',
    fontSize: '0.9375rem',
  },
  actionHigh: {
    borderColor: 'rgba(239,68,68,0.40)',
    background: 'rgba(239,68,68,0.08)',
  },
  actionDot: {
    fontSize: '1rem',
    lineHeight: 1.2,
    color: '#86EFAC',
    flexShrink: 0,
  },
  actionText: { flex: 1, minWidth: 0, overflowWrap: 'break-word' },
  tableWrap: {
    overflowX: 'auto',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.10)',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.875rem',
    color: '#EAF2FF',
  },
  th: {
    textAlign: 'left',
    fontWeight: 700,
    fontSize: '0.6875rem',
    color: 'rgba(255,255,255,0.65)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    padding: '0.625rem 0.75rem',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
  },
  thNum: { textAlign: 'right' },
  td: {
    padding: '0.625rem 0.75rem',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    overflowWrap: 'break-word',
    wordBreak: 'break-word',
  },
  tdNum: { textAlign: 'right', fontVariantNumeric: 'tabular-nums' },
  tdAlert: { color: '#FCA5A5', fontWeight: 700 },
};
