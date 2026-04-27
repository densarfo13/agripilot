/**
 * NgoControlPanel — single-page operational view at /ngo/control.
 *
 * Three sections (per spec):
 *   1. Overview KPIs:    total farms / high-risk farms / active
 *                         outbreaks
 *   2. Map:               <OutbreakMap /> (lazy-loaded behind a
 *                         MapErrorBoundary so a chunk-load or
 *                         leaflet runtime failure leaves the
 *                         rest of the page interactive)
 *   3. Alerts table:      region / crop / risk level / action
 *                         needed (from actionableInsights)
 *   + Filters             crop / region / risk level
 *
 * Strict-rule audit
 *   * UI simple + fast: KPI tiles + a table; map is the only
 *     heavy element and it's code-split + error-boundaried
 *   * works on low-end devices: clusters cap at 50 inside the
 *     map (in OutbreakMap), table renders every cluster but
 *     filters are applied first
 *   * never blocks UI: map failure shows the inline fallback,
 *     the table + filters keep working
 *   * map is OPTIONAL: when leaflet fails to load the rest of
 *     the page is fully usable
 */

import React, { Suspense, lazy, useMemo, useState } from 'react';
import { useTranslation } from '../i18n/index.js';
import { tSafe } from '../i18n/tSafe.js';
import { useProfile } from '../context/ProfileContext.jsx';
import { getCropLabelSafe } from '../utils/crops.js';
import { getOutbreakReports } from '../outbreak/outbreakStore.js';
import { detectActiveClusters } from '../outbreak/outbreakClusterEngine.js';
import { computeFarmRisks } from '../outbreak/riskEngine.js';
import { getAlertsForFarm } from '../outbreak/farmerOutbreakAlerts.js';
import { getInsightForCluster } from '../outbreak/actionableInsights.js';
import { normaliseRegion, normaliseCountry } from '../outbreak/regionNormaliser.js';
import MapErrorBoundary from '../components/MapErrorBoundary.jsx';
import NgoInsightsPanel from '../components/ngo/NgoInsightsPanel.jsx';
import RoiPanel from '../components/ngo/RoiPanel.jsx';

// Heavy: leaflet + tile layer + circles. Code-split so the
// dashboard chunk stays tiny on low-end devices.
const OutbreakMap = lazy(() => import('../components/OutbreakMap.jsx'));

const SEV_COLOR = Object.freeze({
  high:   '#FCA5A5',
  medium: '#FCD34D',
  low:    '#93C5FD',
});

function titleCase(s) {
  if (typeof s !== 'string' || !s) return s;
  return s.split(' ').map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(' ');
}

function StatTile({ label, value, accent }) {
  return (
    <div style={{ ...S.tile, ...(accent ? S.tileAccent : null) }}>
      <span style={S.tileLabel}>{label}</span>
      <strong style={S.tileValue}>{value}</strong>
    </div>
  );
}

function Filter({ value, setValue, options, placeholder, renderOption, testId }) {
  return (
    <select
      value={value}
      onChange={(e) => setValue(e.target.value)}
      style={S.filter}
      data-testid={testId}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {renderOption ? renderOption(o) : o}
        </option>
      ))}
    </select>
  );
}

export default function NgoControlPanel({ farms: farmsProp = null }) {
  const { lang } = useTranslation();
  const profile = useProfile();
  const farms = farmsProp != null
    ? farmsProp
    : (profile && Array.isArray(profile.farms) ? profile.farms : []);

  const [filterCrop,    setFilterCrop]    = useState('');
  const [filterRegion,  setFilterRegion]  = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');

  // Run the cluster engine once per render. Cheap; pure.
  const clusters = useMemo(() => {
    return detectActiveClusters(getOutbreakReports(), farms);
  }, [farms]);

  // Per-farm risk roll-up for the high-risk-farms KPI.
  const highRiskFarms = useMemo(() => {
    if (!Array.isArray(farms) || farms.length === 0) return 0;
    let n = 0;
    for (const f of farms) {
      if (!f || typeof f !== 'object') continue;
      const matched = getAlertsForFarm(f, clusters);
      const cluster = matched && matched.length ? matched[0] : null;
      const r = computeFarmRisks(f, cluster);
      if (r.top && r.top.level === 'HIGH') n += 1;
    }
    return n;
  }, [farms, clusters]);

  // Filter option lists derived from the live cluster set.
  const optionSets = useMemo(() => {
    const c = new Set(), r = new Set(), s = new Set();
    for (const x of clusters) {
      if (x.crop)     c.add(x.crop);
      if (x.region)   r.add(x.region);
      if (x.severity) s.add(x.severity);
    }
    return {
      crop:     [...c].sort(),
      region:   [...r].sort(),
      severity: [...s],
    };
  }, [clusters]);

  const filtered = useMemo(() => {
    return clusters.filter((c) => {
      if (filterCrop      && c.crop      !== filterCrop)     return false;
      if (filterRegion    && c.region    !== filterRegion)   return false;
      if (filterSeverity  && c.severity  !== filterSeverity) return false;
      return true;
    });
  }, [clusters, filterCrop, filterRegion, filterSeverity]);

  return (
    <main style={S.page} data-testid="ngo-control-panel">
      <div style={S.container}>
        <header style={S.header}>
          <h1 style={S.h1}>{tSafe('ngo.control.title', 'Outbreak Control Panel')}</h1>
          <p style={S.subtitle}>
            {tSafe('ngo.control.sub',
              'Live view of outbreak clusters + recommended actions.')}
          </p>
        </header>

        {/* ─── Section 1: KPIs ─────────────────────────────────── */}
        <section style={S.kpiGrid} data-testid="ngo-control-kpis">
          <StatTile
            label={tSafe('ngo.control.totalFarms', 'Total farms')}
            value={Array.isArray(farms) ? farms.length : 0}
          />
          <StatTile
            label={tSafe('ngo.control.highRiskFarms', 'High-risk farms')}
            value={highRiskFarms}
            accent
          />
          <StatTile
            label={tSafe('ngo.control.activeOutbreaks', 'Active outbreaks')}
            value={clusters.length}
            accent
          />
        </section>

        {/* ─── Section 2: Map (lazy + error-boundaried) ────────── */}
        <section style={S.card} data-testid="ngo-control-map">
          <h2 style={S.h2}>{tSafe('ngo.control.mapTitle', 'Cluster map')}</h2>
          <MapErrorBoundary
            fallbackText={tSafe('ngo.control.mapFallback',
              'Map unavailable \u2014 showing list view below.')}
          >
            <Suspense fallback={
              <div style={S.mapLoading} role="status" aria-live="polite">
                {tSafe('ngo.control.mapLoading', 'Loading map\u2026')}
              </div>
            }>
              <OutbreakMap clusters={filtered} height={400} />
            </Suspense>
          </MapErrorBoundary>
        </section>

        {/* ─── Section 3: Filters + Alerts table ──────────────── */}
        <section style={S.card} data-testid="ngo-control-table">
          <h2 style={S.h2}>{tSafe('ngo.control.alertsTitle', 'Alerts')}</h2>

          <div style={S.filterRow}>
            <Filter
              value={filterCrop} setValue={setFilterCrop}
              options={optionSets.crop}
              placeholder={tSafe('common.crop', 'Crop')}
              renderOption={(c) => getCropLabelSafe(c, lang) || c}
              testId="ngo-control-filter-crop"
            />
            <Filter
              value={filterRegion} setValue={setFilterRegion}
              options={optionSets.region}
              placeholder={tSafe('common.region', 'Region')}
              renderOption={(r) => titleCase(r)}
              testId="ngo-control-filter-region"
            />
            <Filter
              value={filterSeverity} setValue={setFilterSeverity}
              options={optionSets.severity}
              placeholder={tSafe('common.severity', 'Severity')}
              renderOption={(s) =>
                tSafe(`outbreak.severity${s[0].toUpperCase()}${s.slice(1)}`, s)}
              testId="ngo-control-filter-severity"
            />
          </div>

          {filtered.length === 0 ? (
            <p style={S.empty} data-testid="ngo-control-empty">
              {tSafe('ngo.control.empty',
                'No active outbreaks match your filters.')}
            </p>
          ) : (
            <ul style={S.list}>
              {filtered.map((c) => {
                const sevColor = SEV_COLOR[c.severity] || SEV_COLOR.low;
                const insight = getInsightForCluster(c);
                return (
                  <li key={c.id} style={S.row}>
                    <div style={S.rowMain}>
                      <div style={S.rowTitle}>
                        <span style={S.rowRegion}>{titleCase(c.region)}</span>
                        <span style={S.rowDot} aria-hidden="true">{'\u2022'}</span>
                        <span style={S.rowCrop}>{getCropLabelSafe(c.crop, lang) || c.crop}</span>
                        <span style={S.rowDot} aria-hidden="true">{'\u2022'}</span>
                        <span style={S.rowIssue}>
                          {tSafe(`outbreak.issue${c.issueType[0].toUpperCase()}${c.issueType.slice(1)}`, c.issueType)}
                        </span>
                      </div>
                      {insight && (
                        <div style={S.rowAction}>
                          <span style={S.rowActionIcon} aria-hidden="true">{'\u27A4'}</span>
                          <span>{tSafe(insight.messageKey, insight.fallback)}</span>
                        </div>
                      )}
                    </div>
                    <div style={S.rowMetrics}>
                      <span style={{ ...S.sevBadge, color: sevColor, borderColor: sevColor }}>
                        {tSafe(`outbreak.severity${c.severity[0].toUpperCase()}${c.severity.slice(1)}`, c.severity)}
                      </span>
                      <span style={S.metricCount}>
                        <strong style={S.metricBig}>{c.reportCount}</strong>{' '}
                        {tSafe('outbreak.reportCount', 'reports')}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* ─── Section 4: ROI / Programme impact ─────────────── */}
        <RoiPanel windowDays={7} />

        {/* ─── Section 5: Insights & Actions (NGO-friendly) ────── */}
        <NgoInsightsPanel farms={farms} />
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
    maxWidth: '60rem',
    margin: '0 auto',
    padding: '0 1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  header: { display: 'flex', flexDirection: 'column', gap: '0.25rem' },
  h1: { fontSize: '1.625rem', fontWeight: 800, margin: 0, color: '#EAF2FF' },
  subtitle: { margin: 0, fontSize: '0.9375rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 },
  h2: { margin: 0, fontSize: '1rem', fontWeight: 700, color: '#E2E8F0' },

  kpiGrid: {
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

  card: {
    background: 'rgba(15, 32, 52, 0.9)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '20px',
    padding: '1rem 1.125rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.875rem',
  },
  mapLoading: {
    minHeight: '200px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'rgba(255,255,255,0.6)',
    fontSize: '0.875rem',
    border: '1px dashed rgba(255,255,255,0.12)',
    borderRadius: '12px',
  },

  filterRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '0.5rem',
  },
  filter: {
    minHeight: '40px',
    padding: '0.5rem 0.625rem',
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.05)',
    color: '#EAF2FF',
    fontSize: '0.875rem',
    outline: 'none',
  },

  list: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  row: {
    display: 'flex', alignItems: 'flex-start', gap: '0.875rem',
    padding: '0.75rem 0.875rem',
    borderRadius: '14px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    flexWrap: 'wrap',
  },
  rowMain: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.375rem' },
  rowTitle: { display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' },
  rowRegion: { fontSize: '0.9375rem', fontWeight: 800, color: '#EAF2FF' },
  rowCrop:   { fontWeight: 700, color: '#86EFAC' },
  rowIssue:  { fontWeight: 600, color: '#FCD34D' },
  rowDot:    { color: 'rgba(255,255,255,0.4)' },
  rowAction: {
    display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.85)',
    background: 'rgba(34,197,94,0.08)',
    padding: '0.5rem 0.625rem',
    borderRadius: '10px',
    border: '1px solid rgba(34,197,94,0.25)',
  },
  rowActionIcon: { color: '#86EFAC', flexShrink: 0 },

  rowMetrics: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.625rem',
    flexWrap: 'wrap',
  },
  sevBadge: {
    fontSize: '0.6875rem', fontWeight: 800, letterSpacing: '0.05em',
    textTransform: 'uppercase',
    padding: '0.125rem 0.5rem',
    borderRadius: '999px',
    border: '1px solid',
    background: 'transparent',
  },
  metricCount: { fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' },
  metricBig: { color: '#EAF2FF', fontWeight: 800 },

  empty: {
    margin: 0, fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.55)',
    fontStyle: 'italic',
    padding: '0.5rem 0',
  },
};
