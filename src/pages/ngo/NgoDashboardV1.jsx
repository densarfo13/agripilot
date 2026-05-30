/**
 * NgoDashboardV1 — pilot NGO operator dashboard.
 *
 *   Route:  /dashboard  (when role ∈ ngo / ngo_admin / ngo_officer / ngo_agent)
 *
 * 8 cards (spec §1):
 *   • Total farmers      • Active farmers       • Inactive farmers
 *   • Task completion    • High-risk farmers    • Top crops
 *   • Regions covered    • Upcoming harvests
 *
 * Plus a farmer list with filters (region / crop / risk / status).
 * Risk classification runs locally via lib/ngoRiskLogic.js.
 *
 * Data source
 *   The backend already mounts /api/v2/ngo/* routes (NGO_SCOPE
 *   auth + org isolation). This page reads from
 *   GET /api/v2/ngo/overview     → counts + top crops/regions
 *   GET /api/v2/ngo/inactive-farmers → list
 *   GET /api/v2/ngo/risk-summary → risk band counts
 *
 *   Failures fall through to the "Data will appear after farmers
 *   start completing tasks." empty-state per spec §10.
 *
 * Strict-rule audit
 *   • Never throws. Every fetch try/catched.
 *   • Honours the role-accent token (NGO = teal) — no hard
 *     colours.
 *   • Mobile-first; no charts.
 *   • Pure functional — no Redux / context coupling.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../runtime/apiRuntime.js';
import { classifyFarmerRisk, summariseRisk } from '../../lib/ngoRiskLogic.js';
import { tSafe } from '../../i18n/tSafe.js';

// Best-effort runtime telemetry — dynamic-imported so a missing /
// broken health module can never break the dashboard render.
function _recordNgoApi(ok, payload) {
  try {
    import('../../runtime/launch/NgoMetricsHealth.ts')
      .then((m) => {
        try { m.recordApiCall(!!ok, payload); } catch { /* swallow */ }
        try { if (ok) m.recordLastRefresh(new Date().toISOString()); }
        catch { /* swallow */ }
      })
      .catch(() => { /* swallow — telemetry is best-effort */ });
  } catch { /* swallow */ }
}

// Shape: { totalFarmers, activeFarmers, inactiveFarmers,
//         taskCompletionRate, topCrops, regionsCovered,
//         upcomingHarvests }
const EMPTY_OVERVIEW = Object.freeze({
  totalFarmers:        0,
  activeFarmers:       0,
  inactiveFarmers:     0,
  taskCompletionRate:  null,
  topCrops:            [],
  regionsCovered:      [],
  upcomingHarvests:    0,
});

export default function NgoDashboardV1() {
  const [overview, setOverview] = useState(EMPTY_OVERVIEW);
  const [farmers, setFarmers]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error,   setError]     = useState(null);
  // Tracks whether the /v2/ngo/overview call itself failed so the
  // KPI section can render an honest "data unavailable" message
  // instead of a row of zero-counts dressed up as a success.
  const [overviewApiFailed, setOverviewApiFailed] = useState(false);

  // Filters
  const [regionFilter, setRegionFilter] = useState('all');
  const [cropFilter,   setCropFilter]   = useState('all');
  const [riskFilter,   setRiskFilter]   = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Fetch overview + farmer list. Both via the existing
  // /api/v2/ngo/* routes which already enforce role + org access.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setOverviewApiFailed(false);
      try {
        const [ovRes, farmersRes] = await Promise.all([
          api.get('/v2/ngo/overview').catch(() => null),
          api.get('/v2/ngo/inactive-farmers').catch(() => null),
        ]);
        if (cancelled) return;
        if (ovRes && ovRes.data) {
          const d = ovRes.data;
          setOverview({
            totalFarmers:       Number(d.totalFarmers       ?? d.total            ?? 0),
            activeFarmers:      Number(d.activeFarmers      ?? d.active           ?? 0),
            inactiveFarmers:    Number(d.inactiveFarmers    ?? d.inactive         ?? 0),
            taskCompletionRate: typeof d.taskCompletionRate === 'number'
              ? d.taskCompletionRate
              : (typeof d.completionRate === 'number' ? d.completionRate : null),
            topCrops:           Array.isArray(d.topCrops)        ? d.topCrops.slice(0, 3) : [],
            regionsCovered:     Array.isArray(d.regionsCovered)  ? d.regionsCovered       :
                                Array.isArray(d.regions)         ? d.regions              : [],
            upcomingHarvests:   Number(d.upcomingHarvests ?? 0),
          });
          _recordNgoApi(true, d);
        } else {
          // Overview call returned no usable payload — flag honest
          // "data unavailable" state instead of silently showing 0s.
          setOverviewApiFailed(true);
          _recordNgoApi(false, null);
        }
        if (farmersRes && farmersRes.data) {
          const list = Array.isArray(farmersRes.data.farmers)
            ? farmersRes.data.farmers
            : Array.isArray(farmersRes.data) ? farmersRes.data : [];
          setFarmers(list);
        }
      } catch (err) {
        if (!cancelled) setError(err && err.message ? err.message : 'load_failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Pre-compute risk bands once.
  const riskByFarmer = useMemo(() => {
    const m = new Map();
    for (const f of farmers) {
      m.set(f.id || f.farmerId, classifyFarmerRisk({
        daysSinceLastActivity:  f.daysSinceLastActivity,
        completionRate:         f.completionRate,
        pestAlertsLast7Days:    f.pestAlertsLast7Days,
        weatherAlertsLast7Days: f.weatherAlertsLast7Days,
      }));
    }
    return m;
  }, [farmers]);

  const riskSummary = useMemo(() => summariseRisk(farmers.map((f) => ({
    daysSinceLastActivity:  f.daysSinceLastActivity,
    completionRate:         f.completionRate,
    pestAlertsLast7Days:    f.pestAlertsLast7Days,
    weatherAlertsLast7Days: f.weatherAlertsLast7Days,
  }))), [farmers]);

  const filtered = useMemo(() => {
    return farmers.filter((f) => {
      const region = String(f.region || '').toLowerCase();
      const crop   = String(f.crop || '').toLowerCase();
      const risk   = (riskByFarmer.get(f.id || f.farmerId) || {}).level || 'low';
      const status = (f.status || (f.daysSinceLastActivity > 7 ? 'inactive' : 'active')).toLowerCase();
      if (regionFilter !== 'all' && region !== regionFilter.toLowerCase()) return false;
      if (cropFilter   !== 'all' && crop   !== cropFilter.toLowerCase())   return false;
      if (riskFilter   !== 'all' && risk   !== riskFilter)                 return false;
      if (statusFilter !== 'all' && status !== statusFilter)               return false;
      return true;
    });
  }, [farmers, regionFilter, cropFilter, riskFilter, statusFilter, riskByFarmer]);

  // Distinct filter options (cheap derive once farmers is set).
  const regionOptions = useMemo(() => {
    const s = new Set();
    for (const f of farmers) if (f.region) s.add(f.region);
    return ['all', ...Array.from(s).sort()];
  }, [farmers]);
  const cropOptions = useMemo(() => {
    const s = new Set();
    for (const f of farmers) if (f.crop) s.add(f.crop);
    return ['all', ...Array.from(s).sort()];
  }, [farmers]);

  const handleResetFilters = useCallback(() => {
    setRegionFilter('all'); setCropFilter('all');
    setRiskFilter('all');   setStatusFilter('all');
  }, []);

  // ─── Render ──────────────────────────────────────────────
  return (
    <main style={S.page} data-testid="ngo-dashboard-v1" data-role="ngo">
      <header style={S.header}>
        <span style={S.headerStrip} aria-hidden="true" />
        <h1 style={S.title}>NGO Dashboard</h1>
        <p style={S.subtitle}>
          Monitor farmer progress, activity, and risk across your
          program.
        </p>
      </header>

      {/* Empty state — spec §10. Renders BEFORE the cards so a
          fresh program with no farmers gets the calm prompt
          instead of a row of zeros. */}
      {!loading && overviewApiFailed ? (
        <section
          style={S.emptyCard}
          data-testid="ngo-dashboard-metrics-error"
          role="status"
        >
          <span aria-hidden="true" style={S.emptyIcon}>{'\u26A0\uFE0F'}</span>
          <h2 style={S.emptyTitle}>
            {tSafe('ngo.metrics.error', 'Data temporarily unavailable')}
          </h2>
          <p style={S.emptyBody}>
            We could not load NGO metrics right now. Please try
            again in a moment.
          </p>
        </section>
      ) : !loading
            && overview.totalFarmers === 0
            && overview.activeFarmers === 0
            && overview.inactiveFarmers === 0
            && overview.upcomingHarvests === 0
            && farmers.length === 0 ? (
        <section
          style={S.emptyCard}
          data-testid="ngo-dashboard-metrics-empty"
        >
          <span aria-hidden="true" style={S.emptyIcon}>{'\uD83C\uDF31'}</span>
          <h2 style={S.emptyTitle}>
            {tSafe('ngo.metrics.empty', 'Not enough data yet')}
          </h2>
          <p style={S.emptyBody}>
            Add or invite farmers to start monitoring progress.
          </p>
        </section>
      ) : null}

      {/* 8 dashboard cards. Suppressed when the metrics API
          failed OR returned all-zero placeholder data — the
          honest empty/error card above takes the slot instead so
          users never see "0 farmers reached" dressed up as a
          success metric. */}
      {!overviewApiFailed && !(
        overview.totalFarmers === 0
        && overview.activeFarmers === 0
        && overview.inactiveFarmers === 0
        && overview.upcomingHarvests === 0
        && farmers.length === 0
      ) ? (
        <section style={S.grid} data-testid="ngo-dashboard-cards">
          <Card label="Total farmers"     value={overview.totalFarmers} />
          <Card label="Active farmers"    value={overview.activeFarmers} />
          <Card label="Inactive farmers"  value={overview.inactiveFarmers} />
          <Card
            label="Task completion"
            value={overview.taskCompletionRate == null
              ? '—'
              : Math.round(overview.taskCompletionRate * 100) + '%'}
          />
          <Card
            label="High-risk farmers"
            value={riskSummary.high}
            tone="warn"
          />
          <Card
            label="Upcoming harvests"
            value={overview.upcomingHarvests}
          />
          <Card
            label="Top crops"
            value={(overview.topCrops || []).slice(0, 2).join(', ') || '—'}
            long
          />
          <Card
            label="Regions covered"
            value={(overview.regionsCovered || []).length}
          />
        </section>
      ) : null}

      {/* Filters */}
      <section style={S.filters} data-testid="ngo-dashboard-filters">
        <FilterSelect
          label="Region" value={regionFilter} onChange={setRegionFilter}
          options={regionOptions}
        />
        <FilterSelect
          label="Crop" value={cropFilter} onChange={setCropFilter}
          options={cropOptions}
        />
        <FilterSelect
          label="Risk" value={riskFilter} onChange={setRiskFilter}
          options={['all', 'high', 'medium', 'low']}
        />
        <FilterSelect
          label="Status" value={statusFilter} onChange={setStatusFilter}
          options={['all', 'active', 'inactive']}
        />
        <button
          type="button" onClick={handleResetFilters}
          style={S.resetBtn}
          data-testid="ngo-dashboard-reset-filters"
        >
          Reset
        </button>
      </section>

      {/* Farmer list */}
      <section style={S.list} data-testid="ngo-dashboard-list">
        {loading ? (
          <div style={S.loadingRow}>Loading farmers…</div>
        ) : filtered.length === 0 ? (
          <div style={S.emptyRow}>
            {error
              ? 'Could not load farmers — please try again.'
              : 'Data will appear after farmers start completing tasks.'}
          </div>
        ) : (
          filtered.map((f) => {
            const risk = riskByFarmer.get(f.id || f.farmerId) || { level: 'low' };
            return (
              <FarmerRow key={f.id || f.farmerId} farmer={f} risk={risk} />
            );
          })
        )}
      </section>
    </main>
  );
}

// ─── Sub-components ─────────────────────────────────────────

function Card({ label, value, tone, long }) {
  const toneStyle = tone === 'warn'
    ? { borderColor: 'var(--warning, #f4c430)', color: 'var(--warning, #f4c430)' }
    : {};
  return (
    <div style={{ ...S.card, ...(long ? S.cardWide : {}), ...toneStyle }}>
      <div style={S.cardLabel}>{label}</div>
      <div style={S.cardValue}>{String(value)}</div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <label style={S.filterCell}>
      <span style={S.filterLabel}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={S.filterSelect}
      >
        {options.map((o) => (
          <option key={o} value={o}>{o === 'all' ? 'All' : o}</option>
        ))}
      </select>
    </label>
  );
}

function FarmerRow({ farmer, risk }) {
  const status = (farmer.status
                || (farmer.daysSinceLastActivity > 7 ? 'inactive' : 'active'))
                .toString();
  const completion = typeof farmer.completionRate === 'number'
    ? Math.round(farmer.completionRate * 100) + '%'
    : '—';
  return (
    <div
      style={{
        ...S.row,
        borderLeft: `4px solid ${
          risk.level === 'high'   ? 'var(--danger, #ff6b6b)'
          : risk.level === 'medium' ? 'var(--warning, #f4c430)'
          : 'var(--accent-green, #2ecc71)'}`,
      }}
      data-testid={`ngo-farmer-row-${farmer.id || farmer.farmerId}`}
      data-risk={risk.level}
    >
      <div style={S.rowMain}>
        <div style={S.rowName}>{farmer.farmerName || farmer.name || 'Unnamed farmer'}</div>
        <div style={S.rowSub}>
          {farmer.crop || '—'} · {farmer.region || '—'} · last active {
            Number.isFinite(Number(farmer.daysSinceLastActivity))
              ? Math.floor(Number(farmer.daysSinceLastActivity)) + 'd ago'
              : '—'
          }
        </div>
      </div>
      <div style={S.rowMeta}>
        <span style={S.rowChip}>{completion}</span>
        <span style={{ ...S.rowChip, textTransform: 'capitalize' }}>{status}</span>
      </div>
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────
const S = {
  // Soft Ochre body wash (May 2026 platform refactor).
  page: {
    minHeight: '100vh',
    padding: '20px 16px 96px',
    maxWidth: 920,
    margin: '0 auto',
    background: 'linear-gradient(180deg, #F6F1E7 0%, #EFE7D5 100%)',
    color: 'var(--text-primary, #1F2933)',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  header: {
    position: 'relative',
    paddingBottom: 6,
  },
  headerStrip: {
    position: 'absolute',
    top: 0, left: 0, right: 0, height: 4,
    background: 'linear-gradient(90deg, var(--role-accent, #D4A35F), transparent)',
    opacity: 0.85, borderRadius: 2,
  },
  title: { margin: '14px 0 0', fontSize: 22, fontWeight: 800, letterSpacing: '-0.01em', color: 'var(--text-primary, #1F2933)' },
  subtitle: { margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary, #667085)', lineHeight: 1.5 },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: 10,
  },
  card: {
    padding: '14px 14px',
    borderRadius: 14,
    background: 'var(--card-bg, #FFF9F0)',
    border: '1px solid var(--card-border, rgba(255,255,255,0.12))',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  cardWide: { gridColumn: '1 / -1' },
  cardLabel: {
    fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
    textTransform: 'uppercase', color: 'var(--text-muted, rgba(255,255,255,0.55))',
  },
  cardValue: { fontSize: 22, fontWeight: 800, color: 'inherit' },
  filters: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'flex-end',
    marginTop: 4,
  },
  filterCell: { display: 'flex', flexDirection: 'column', gap: 4 },
  filterLabel: { fontSize: 11, fontWeight: 700, color: 'var(--text-muted, rgba(255,255,255,0.55))' },
  filterSelect: {
    minHeight: 36,
    padding: '6px 10px',
    background: 'var(--card-bg-strong, #FFFFFF)',
    color: 'var(--text-primary, #EAF2FF)',
    border: '1px solid var(--card-border, rgba(255,255,255,0.18))',
    borderRadius: 10,
    fontSize: 13,
  },
  resetBtn: {
    minHeight: 36,
    padding: '6px 14px',
    border: '1px solid var(--card-border, rgba(255,255,255,0.18))',
    background: 'transparent',
    color: 'var(--role-accent, #2aa7a1)',
    borderRadius: 10,
    fontSize: 13, fontWeight: 700,
    cursor: 'pointer',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    marginTop: 4,
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 10,
    padding: '12px 14px',
    background: 'var(--card-bg, #FFF9F0)',
    border: '1px solid var(--card-border, rgba(255,255,255,0.12))',
    borderRadius: 12,
    alignItems: 'center',
  },
  rowMain: { flex: 1, minWidth: 0 },
  rowName: { fontSize: 15, fontWeight: 800, lineHeight: 1.2 },
  rowSub:  { marginTop: 2, fontSize: 12, color: 'var(--text-muted, rgba(255,255,255,0.55))' },
  rowMeta: { display: 'flex', gap: 6, flexShrink: 0 },
  rowChip: {
    fontSize: 11, fontWeight: 700,
    padding: '4px 10px',
    borderRadius: 999,
    background: 'var(--card-bg-strong, #FFFFFF)',
    border: '1px solid var(--card-border, rgba(255,255,255,0.12))',
  },
  loadingRow: {
    padding: '16px 14px',
    color: 'var(--text-muted, rgba(255,255,255,0.55))',
    textAlign: 'center',
  },
  emptyRow: {
    padding: '20px 14px',
    color: 'var(--text-muted, rgba(255,255,255,0.55))',
    textAlign: 'center',
    background: 'var(--card-bg, #FFF9F0)',
    border: '1px dashed var(--card-border, rgba(255,255,255,0.18))',
    borderRadius: 12,
    fontSize: 13,
  },
  emptyCard: {
    padding: '22px 18px',
    textAlign: 'center',
    background: 'var(--card-bg, #FFF9F0)',
    border: '1px solid var(--card-border, rgba(255,255,255,0.12))',
    borderRadius: 16,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
  },
  emptyIcon: { fontSize: 36, lineHeight: 1 },
  emptyTitle: { margin: 0, fontSize: 18, fontWeight: 800 },
  emptyBody: { margin: 0, fontSize: 13, color: 'var(--text-secondary, rgba(255,255,255,0.7))' },
};
