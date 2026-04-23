import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from '../i18n/index.js';
import { getCropLabel } from '../config/crops/index.js';
import {
  fetchOrganizationDashboard, listOrganizationFarmers,
  exportOrganizationFarmersCsv, exportOrganizationDashboardCsv,
  fetchOrganizationMetrics, exportOrganizationMetricsCsv,
} from '../lib/organizations.js';
import TrustBadge from '../components/TrustBadge.jsx';
import { trustColor } from '../lib/verification/trustSignals.js';

/**
 * OrganizationDashboardPage — institutional-admin / super-admin
 * single-page view of an NGO or program's farmer portfolio.
 *
 * Layout
 *   ┌ header: org name + window toggle + export buttons ┐
 *   ┌ 6 metric tiles (total, active, inactive, avg score, yield, risk) ┐
 *   ┌ crop distribution bars ┐
 *   ┌ filterable farmer table (region / crop / score range) ┐
 *
 * Route: /organizations/:orgId
 * Assumes the route is guarded upstream by the same role checks
 * that gate AdminDashboard.
 */
export default function OrganizationDashboardPage() {
  const { orgId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [dashboard, setDashboard] = useState(null);
  const [loading,  setLoading]    = useState(true);
  const [error,    setError]      = useState(null);
  const [windowDays, setWindowDays] = useState(30);

  const [farmers, setFarmers] = useState([]);
  const [farmersLoading, setFarmersLoading] = useState(true);
  const [farmerFilters, setFarmerFilters] = useState({
    region: '', crop: '', scoreMin: '', scoreMax: '',
  });

  const [metrics, setMetrics] = useState(null);
  const [metricsLoading, setMetricsLoading] = useState(true);

  const tr = (k, fb) => {
    const v = t(k);
    return v && v !== k ? v : fb;
  };

  const loadDashboard = useCallback(async () => {
    setLoading(true); setError(null);
    const out = await fetchOrganizationDashboard(orgId, { windowDays });
    if (!out) setError('unavailable');
    setDashboard(out);
    setLoading(false);
  }, [orgId, windowDays]);

  const loadFarmers = useCallback(async () => {
    setFarmersLoading(true);
    const out = await listOrganizationFarmers(orgId, {
      region:   farmerFilters.region   || undefined,
      crop:     farmerFilters.crop     || undefined,
      scoreMin: farmerFilters.scoreMin || undefined,
      scoreMax: farmerFilters.scoreMax || undefined,
      limit:    100,
    });
    setFarmers(Array.isArray(out.data) ? out.data : []);
    setFarmersLoading(false);
  }, [orgId, farmerFilters]);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);
  useEffect(() => { loadFarmers(); }, [loadFarmers]);

  const loadMetrics = useCallback(async () => {
    setMetricsLoading(true);
    const out = await fetchOrganizationMetrics(orgId, { windowDays });
    setMetrics(out);
    setMetricsLoading(false);
  }, [orgId, windowDays]);
  useEffect(() => { loadMetrics(); }, [loadMetrics]);

  const styles = useMemo(() => buildStyles(), []);

  if (!orgId) return null;

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <button style={styles.backBtn} onClick={() => navigate(-1)}>
          ← {tr('common.back', 'Back')}
        </button>
        <h1 style={styles.title}>
          {tr('orgDashboard.title', 'Organization dashboard')}
        </h1>
        <div style={styles.headerActions}>
          <select value={windowDays}
                  onChange={(e) => setWindowDays(Number(e.target.value))}
                  style={styles.windowSelect}>
            <option value={7}>{tr('orgDashboard.window.7', 'Last 7 days')}</option>
            <option value={30}>{tr('orgDashboard.window.30', 'Last 30 days')}</option>
            <option value={90}>{tr('orgDashboard.window.90', 'Last 90 days')}</option>
          </select>
          <button style={styles.exportBtn}
                  onClick={() => exportOrganizationDashboardCsv(orgId, { windowDays })}
                  data-testid="export-dashboard-csv">
            {tr('orgDashboard.exportDashboard', 'Export summary')}
          </button>
          <button style={styles.exportBtn}
                  onClick={() => exportOrganizationFarmersCsv(orgId, farmerFilters)}
                  data-testid="export-farmers-csv">
            {tr('orgDashboard.exportFarmers', 'Export farmers')}
          </button>
        </div>
      </header>

      {loading && (
        <div style={styles.info}>{tr('orgDashboard.loading', 'Loading dashboard…')}</div>
      )}
      {!loading && error && (
        <div style={styles.error} role="alert">
          {tr('orgDashboard.error', 'Could not load the dashboard. You might not have access to this organization.')}
        </div>
      )}

      {!loading && !error && dashboard && (
        <>
          <section style={styles.tiles} data-testid="org-tiles">
            <MetricTile label={tr('orgDashboard.tile.total', 'Total farmers')}
                        value={dashboard.totalFarmers} styles={styles} />
            <MetricTile label={tr('orgDashboard.tile.active', 'Active')}
                        value={dashboard.active}
                        accent="#86EFAC" styles={styles} />
            <MetricTile label={tr('orgDashboard.tile.inactive', 'Inactive')}
                        value={dashboard.inactive}
                        accent="#CBD5E1" styles={styles} />
            <MetricTile label={tr('orgDashboard.tile.avgScore', 'Avg Farroway Score')}
                        value={dashboard.averageScore.value != null
                          ? dashboard.averageScore.value : '—'}
                        secondary={dashboard.averageScore.sampleSize
                          ? `${tr('orgDashboard.tile.from', 'from')} ${dashboard.averageScore.sampleSize}`
                          : tr('orgDashboard.tile.noScores', 'no scores yet')}
                        accent={bandColor(dashboard.averageScore.band)}
                        styles={styles} />
            <MetricTile label={tr('orgDashboard.tile.yield', 'Projected yield')}
                        value={formatKg(dashboard.yieldProjection.totalKg)}
                        secondary={tr('orgDashboard.tile.yieldSource', 'estimated')}
                        accent="#7DD3FC"
                        styles={styles} />
            <MetricTile label={tr('orgDashboard.tile.risk', 'Farmers with alerts')}
                        value={dashboard.riskIndicators.farmersWithPendingAlerts}
                        secondary={`${dashboard.riskIndicators.marketAlerts}m · ${dashboard.riskIndicators.weatherAlerts}w · ${dashboard.riskIndicators.pestAlerts}p`}
                        accent="#FCA5A5"
                        styles={styles} />
            <MetricTile label={tr('orgDashboard.tile.trust', 'Verified farmers')}
                        value={`${dashboard.trust ? dashboard.trust.high : 0}/${dashboard.totalFarmers}`}
                        secondary={dashboard.trust
                          ? `${dashboard.trust.high} high · ${dashboard.trust.medium} med · ${dashboard.trust.low} low · avg ${dashboard.trust.average}`
                          : tr('orgDashboard.tile.trustEmpty', 'no trust data yet')}
                        accent="#86EFAC"
                        styles={styles} />
          </section>

          {dashboard.cropDistribution.length > 0 && (
            <section style={styles.card} data-testid="org-crop-distribution">
              <h3 style={styles.cardTitle}>
                {tr('orgDashboard.cropDist', 'Crop distribution')}
              </h3>
              <ul style={styles.distList}>
                {dashboard.cropDistribution.slice(0, 10).map((row) => (
                  <li key={row.crop} style={styles.distRow}
                      data-testid={`org-crop-${row.crop}`}>
                    <div style={styles.distLabel}>
                      {getCropLabel(row.crop)}
                      <span style={styles.distCount}>{row.farms}</span>
                    </div>
                    <div style={styles.distTrack}>
                      <div style={{ ...styles.distFill, width: `${Math.round(row.share * 100)}%` }} />
                    </div>
                    <div style={styles.distShare}>{Math.round(row.share * 100)}%</div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {/* Pilot metrics section */}
      {!metricsLoading && metrics && (
        <section style={styles.card} data-testid="org-pilot-metrics">
          <header style={styles.cardHeader}>
            <h3 style={styles.cardTitle}>
              {tr('pilotMetrics.title', 'Pilot metrics')}
            </h3>
            <button style={styles.exportBtn}
                    onClick={() => exportOrganizationMetricsCsv(orgId, { windowDays })}
                    data-testid="export-metrics-csv">
              {tr('pilotMetrics.exportCsv', 'Export metrics CSV')}
            </button>
          </header>

          {/* Adoption + engagement + outcomes tiles */}
          <div style={styles.tiles} data-testid="pilot-adoption">
            <MetricTile label={tr('pilotMetrics.activeWeekly', 'Active this week')}
                        value={metrics.adoption.activeWeekly}
                        secondary={`${metrics.adoption.activeMonthly} ${tr('pilotMetrics.activeMonthlyTail', 'this month')}`}
                        accent="#7DD3FC" styles={styles} />
            <MetricTile label={tr('pilotMetrics.adoptionRate', 'Adoption rate')}
                        value={`${Math.round(metrics.adoption.adoptionRate * 100)}%`}
                        secondary={`${metrics.adoption.newThisPeriod} ${tr('pilotMetrics.newThisPeriod', 'new this period')}`}
                        accent="#86EFAC" styles={styles} />
            <MetricTile label={tr('pilotMetrics.tasksPerWeek', 'Tasks / week')}
                        value={metrics.engagement.tasksCompletedPerWeek}
                        secondary={metrics.engagement.taskCompletionRate != null
                          ? `${Math.round(metrics.engagement.taskCompletionRate * 100)}% ${tr('pilotMetrics.onTime', 'on time')}`
                          : tr('pilotMetrics.noTasks', 'no tasks yet')}
                        accent="#FCD34D" styles={styles} />
            <MetricTile label={tr('pilotMetrics.listings', 'Listings')}
                        value={metrics.outcomes.marketplaceListings}
                        secondary={`${metrics.outcomes.marketplaceRequests} ${tr('pilotMetrics.requests', 'requests')} · ${metrics.outcomes.acceptedRequests} ${tr('pilotMetrics.accepted', 'accepted')}`}
                        accent="#FCA5A5" styles={styles} />
          </div>

          {/* Trends */}
          {metrics.trends && metrics.trends.weekly.length > 0 && (
            <div style={{ marginTop: 16 }} data-testid="pilot-trends">
              <div style={styles.subhead}>
                {tr('pilotMetrics.weeklyTrends', 'Last 6 weeks')}
              </div>
              <div style={styles.trendRow}>
                {metrics.trends.weekly.map((b) => (
                  <TrendBar key={b.weekStart} bucket={b} styles={styles} />
                ))}
              </div>
            </div>
          )}

          {/* Top regions */}
          {metrics.topRegions && metrics.topRegions.length > 0 && (
            <div style={{ marginTop: 16 }} data-testid="pilot-top-regions">
              <div style={styles.subhead}>
                {tr('pilotMetrics.topRegions', 'Top regions')}
              </div>
              <ul style={styles.distList}>
                {metrics.topRegions.map((r) => (
                  <li key={r.region} style={styles.distRow}
                      data-testid={`pilot-region-${r.region}`}>
                    <div style={styles.distLabel}>
                      {r.region}
                      <span style={styles.distCount}>{r.farmers}</span>
                    </div>
                    <div style={styles.distTrack}>
                      <div style={{
                        ...styles.distFill,
                        width: `${Math.min(100, r.averageScore || 0)}%`,
                      }} />
                    </div>
                    <div style={styles.distShare}>
                      {r.averageScore == null ? '—' : r.averageScore}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* At-risk farmers */}
          {metrics.atRiskFarmers && metrics.atRiskFarmers.length > 0 && (
            <div style={{ marginTop: 16 }} data-testid="pilot-at-risk">
              <div style={styles.subhead}>
                {tr('pilotMetrics.atRisk', 'At-risk farmers')}
                <span style={styles.atRiskCount}>
                  {metrics.atRiskFarmers.length}
                </span>
              </div>
              <ul style={styles.distList}>
                {metrics.atRiskFarmers.slice(0, 8).map((f) => (
                  <li key={f.farmerId} style={{ ...styles.distRow,
                        gridTemplateColumns: '1fr' }}
                      data-testid={`pilot-at-risk-${f.farmerId}`}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>
                        {f.fullName}
                        {f.region && (
                          <span style={styles.distCount}> · {f.region}</span>
                        )}
                        {f.score != null && (
                          <span style={{ ...styles.distCount, color: '#FCA5A5', marginLeft: 6 }}>
                            · {f.score}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: 'rgba(230,244,234,0.6)' }}>
                        {f.reasons.map((r) => r.detail).join(' · ')}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* Farmer table */}
      <section style={styles.card} data-testid="org-farmers">
        <header style={styles.cardHeader}>
          <h3 style={styles.cardTitle}>{tr('orgDashboard.farmers', 'Farmers')}</h3>
        </header>
        <div style={styles.filterRow}>
          <input style={styles.filterInput}
                 placeholder={tr('orgDashboard.filter.region', 'Filter by region')}
                 value={farmerFilters.region}
                 onChange={(e) => setFarmerFilters((f) => ({ ...f, region: e.target.value }))}
                 data-testid="org-filter-region" />
          <input style={styles.filterInput}
                 placeholder={tr('orgDashboard.filter.crop', 'Filter by crop')}
                 value={farmerFilters.crop}
                 onChange={(e) => setFarmerFilters((f) => ({ ...f, crop: e.target.value }))}
                 data-testid="org-filter-crop" />
          <input style={styles.filterInputSm}
                 placeholder={tr('orgDashboard.filter.scoreMin', 'Score ≥')}
                 type="number" min="0" max="100"
                 value={farmerFilters.scoreMin}
                 onChange={(e) => setFarmerFilters((f) => ({ ...f, scoreMin: e.target.value }))}
                 data-testid="org-filter-scoremin" />
          <input style={styles.filterInputSm}
                 placeholder={tr('orgDashboard.filter.scoreMax', 'Score ≤')}
                 type="number" min="0" max="100"
                 value={farmerFilters.scoreMax}
                 onChange={(e) => setFarmerFilters((f) => ({ ...f, scoreMax: e.target.value }))}
                 data-testid="org-filter-scoremax" />
        </div>
        {farmersLoading && <div style={styles.info}>{tr('orgDashboard.loadingFarmers', 'Loading farmers…')}</div>}
        {!farmersLoading && farmers.length === 0 && (
          <div style={styles.empty}>{tr('orgDashboard.noFarmers', 'No farmers match these filters.')}</div>
        )}
        {!farmersLoading && farmers.length > 0 && (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>{tr('orgDashboard.col.name', 'Farmer')}</th>
                  <th style={styles.th}>{tr('orgDashboard.col.region', 'Region')}</th>
                  <th style={styles.th}>{tr('orgDashboard.col.crop', 'Crop')}</th>
                  <th style={styles.th}>{tr('orgDashboard.col.score', 'Score')}</th>
                  <th style={styles.th}>{tr('orgDashboard.col.trust', 'Trust')}</th>
                  <th style={styles.th}>{tr('orgDashboard.col.status', 'Status')}</th>
                </tr>
              </thead>
              <tbody>
                {farmers.map((f) => (
                  <tr key={f.id} style={styles.tr}
                      data-testid={`org-farmer-${f.id}`}>
                    <td style={styles.td}>{f.fullName}</td>
                    <td style={styles.td}>{f.region || '—'}</td>
                    <td style={styles.td}>
                      {f.primaryCrop ? getCropLabel(f.primaryCrop) : '—'}
                    </td>
                    <td style={styles.td}>
                      {f.score
                        ? <span style={{ color: bandColor(f.score.band), fontWeight: 700 }}>
                            {f.score.overall}
                          </span>
                        : '—'}
                    </td>
                    <td style={styles.td}>
                      {f.trust
                        ? <TrustBadge precomputed={{
                              level: f.trust.level,
                              score: f.trust.score,
                              passedCount: f.trust.passedCount,
                              totalCount:  f.trust.totalCount,
                              checks: [], signals: f.trust.signals || {},
                            }}
                            variant="chip" />
                        : '—'}
                    </td>
                    <td style={styles.td}>
                      <span style={styles.statusChip}>{f.registrationStatus}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function MetricTile({ label, value, secondary, accent, styles }) {
  return (
    <div style={{ ...styles.tile, ...(accent ? { borderColor: accent } : {}) }}>
      <div style={styles.tileLabel}>{label}</div>
      <div style={{ ...styles.tileValue, ...(accent ? { color: accent } : {}) }}>
        {value}
      </div>
      {secondary && <div style={styles.tileSub}>{secondary}</div>}
    </div>
  );
}

function TrendBar({ bucket, styles }) {
  const label = bucket.weekStart
    ? new Date(bucket.weekStart).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : '—';
  // Height scales against a shared-max within the 6 buckets — use
  // the sum of (active + tasks + listings + requests) as a rough
  // activity signal.
  const total = (bucket.active || 0) + (bucket.tasks || 0)
              + (bucket.listings || 0) + (bucket.requests || 0);
  const height = Math.max(4, Math.min(100, total * 4));
  return (
    <div style={styles.trendCol}>
      <div style={{ ...styles.trendBar, height: `${height}px` }} />
      <div style={styles.trendLabel}>{label}</div>
      <div style={styles.trendValue}>{total}</div>
    </div>
  );
}

function bandColor(band) {
  if (band === 'excellent')  return '#86EFAC';
  if (band === 'strong')     return '#7DD3FC';
  if (band === 'improving')  return '#FCD34D';
  if (band === 'needs_help') return '#FCA5A5';
  return '#CBD5E1';
}

function formatKg(n) {
  if (!Number.isFinite(n)) return '—';
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M kg`;
  if (n >= 1000)    return `${(n / 1000).toFixed(1)}k kg`;
  return `${n} kg`;
}

function buildStyles() {
  return {
    page: {
      padding: 16, maxWidth: 1100, margin: '0 auto',
      display: 'flex', flexDirection: 'column', gap: 16,
      background: '#0B1D34', minHeight: '100vh', color: '#E6F4EA',
    },
    header: {
      display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
    },
    backBtn: {
      padding: '6px 12px', borderRadius: 8,
      border: '1px solid rgba(255,255,255,0.12)', background: 'transparent',
      color: '#E6F4EA', cursor: 'pointer', fontSize: 13,
    },
    title: { margin: 0, fontSize: 18, fontWeight: 700 },
    headerActions: { display: 'flex', gap: 8, flexWrap: 'wrap' },
    windowSelect: {
      padding: '8px 10px', borderRadius: 8,
      border: '1px solid rgba(255,255,255,0.12)',
      background: 'rgba(255,255,255,0.04)', color: '#E6F4EA', fontSize: 13,
    },
    exportBtn: {
      padding: '8px 12px', borderRadius: 8,
      border: '1px solid rgba(34,197,94,0.3)',
      background: 'rgba(34,197,94,0.12)', color: '#86EFAC',
      fontSize: 13, fontWeight: 600, cursor: 'pointer',
    },
    info:  { padding: 16, fontSize: 14, color: 'rgba(230,244,234,0.7)' },
    error: {
      padding: 16, borderRadius: 10, fontSize: 14, color: '#FEE2E2',
      background: 'rgba(239,68,68,0.16)', border: '1px solid rgba(239,68,68,0.32)',
    },
    empty: {
      padding: 16, borderRadius: 10, fontSize: 13, color: 'rgba(230,244,234,0.55)',
      background: 'rgba(255,255,255,0.03)',
      border: '1px dashed rgba(255,255,255,0.14)',
    },
    tiles: {
      display: 'grid', gap: 12,
      gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    },
    tile: {
      padding: 14, borderRadius: 12,
      background: 'rgba(255,255,255,0.04)',
      border: '2px solid rgba(255,255,255,0.08)',
    },
    tileLabel: { fontSize: 12, color: 'rgba(230,244,234,0.65)', textTransform: 'uppercase',
                  letterSpacing: 0.3 },
    tileValue: { fontSize: 28, fontWeight: 800, marginTop: 4 },
    tileSub:   { fontSize: 11, color: 'rgba(230,244,234,0.55)', marginTop: 2 },
    card: {
      padding: 16, borderRadius: 14,
      background: 'linear-gradient(180deg, #0F233E 0%, #0B1D34 100%)',
      border: '1px solid rgba(255,255,255,0.06)',
    },
    cardHeader: { display: 'flex', alignItems: 'center',
                   justifyContent: 'space-between', marginBottom: 8 },
    cardTitle: { margin: 0, fontSize: 16, fontWeight: 700, color: '#E6F4EA' },
    distList:  { listStyle: 'none', margin: 0, padding: 0,
                  display: 'flex', flexDirection: 'column', gap: 8 },
    distRow:   { display: 'grid', gridTemplateColumns: '130px 1fr 50px',
                  alignItems: 'center', gap: 10 },
    distLabel: { fontSize: 13, display: 'flex', justifyContent: 'space-between',
                  gap: 8, color: '#E6F4EA' },
    distCount: { color: 'rgba(230,244,234,0.55)', fontSize: 12 },
    distTrack: { height: 8, borderRadius: 4,
                  background: 'rgba(255,255,255,0.06)', overflow: 'hidden' },
    distFill:  { height: '100%',
                  background: 'linear-gradient(90deg, #22C55Eaa, #22C55E)',
                  borderRadius: 4 },
    distShare: { fontSize: 12, color: 'rgba(230,244,234,0.7)', textAlign: 'right' },
    filterRow: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 },
    filterInput: {
      flex: '1 1 150px', padding: '8px 10px', borderRadius: 8,
      border: '1px solid rgba(255,255,255,0.12)',
      background: 'rgba(255,255,255,0.04)', color: '#E6F4EA', fontSize: 13,
    },
    filterInputSm: {
      flex: '0 0 110px', padding: '8px 10px', borderRadius: 8,
      border: '1px solid rgba(255,255,255,0.12)',
      background: 'rgba(255,255,255,0.04)', color: '#E6F4EA', fontSize: 13,
    },
    tableWrap: { overflowX: 'auto' },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
    th: { padding: 8, textAlign: 'left', color: 'rgba(230,244,234,0.55)',
           borderBottom: '1px solid rgba(255,255,255,0.08)',
           textTransform: 'uppercase', letterSpacing: 0.3, fontSize: 11 },
    tr: { transition: 'background 120ms ease' },
    td: { padding: 10,
           borderBottom: '1px solid rgba(255,255,255,0.06)' },
    statusChip: {
      padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 600,
      background: 'rgba(255,255,255,0.08)', color: 'rgba(230,244,234,0.85)',
      textTransform: 'uppercase', letterSpacing: 0.3,
    },
    subhead: {
      fontSize: 12, color: 'rgba(230,244,234,0.75)',
      textTransform: 'uppercase', letterSpacing: 0.4,
      fontWeight: 700, marginBottom: 8,
      display: 'flex', alignItems: 'center', gap: 8,
    },
    atRiskCount: {
      padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700,
      background: 'rgba(239,68,68,0.18)', color: '#FCA5A5',
    },
    trendRow: {
      display: 'flex', gap: 6, alignItems: 'flex-end', overflowX: 'auto',
      padding: 8, borderRadius: 10,
      background: 'rgba(255,255,255,0.03)',
      minHeight: 120,
    },
    trendCol: {
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', gap: 4, flexShrink: 0, minWidth: 48,
    },
    trendBar: {
      width: 18, borderRadius: 3,
      background: 'linear-gradient(180deg, #22C55E, #22C55Eaa)',
      minHeight: 4,
    },
    trendLabel: { fontSize: 10, color: 'rgba(230,244,234,0.7)' },
    trendValue: { fontSize: 11, fontWeight: 700, color: '#E6F4EA' },
  };
}
