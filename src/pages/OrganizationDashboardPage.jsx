import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from '../i18n/index.js';
import { getCropLabel } from '../config/crops/index.js';
import {
  fetchOrganizationDashboard, listOrganizationFarmers,
  exportOrganizationFarmersCsv, exportOrganizationDashboardCsv,
} from '../lib/organizations.js';

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
  };
}
