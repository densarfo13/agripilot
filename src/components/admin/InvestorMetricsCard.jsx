/**
 * InvestorMetricsCard — additive "investor-grade" metrics panel for
 * the admin analytics page. Mounts inside AdminAnalyticsPage as ONE
 * extra section. Does NOT replace any existing dashboard.
 *
 * Cards
 *   • Total / active / inactive farmers      (read from props)
 *   • Crop distribution top-3                (read from props)
 *   • Farms ready to sell                    (LIVE — supply-readiness/admin/list)
 *   • Average progress score                 (placeholder until a
 *                                             server aggregation
 *                                             endpoint exists)
 *   • High-risk farms count                  (read from props)
 *   • Predicted yield total                  (placeholder)
 *
 * Filters (chips, scoped to THIS card's data)
 *   • Country
 *   • Crop
 *   • Risk level
 *   • Ready to sell
 *
 * The card uses ONLY existing API endpoints. No new backend
 * routes. No new Prisma models. No new task / notification /
 * sync engines. No global UI redesign.
 */

import { useEffect, useMemo, useState } from 'react';
import { getAdminSupplyList } from '../../lib/api.js';
import { useTranslation } from '../../i18n/index.js';
import { tSafe } from '../../i18n/tSafe.js';
import { getCropLabelSafe } from '../../utils/crops.js';

const RISK_LEVELS = ['all', 'low', 'medium', 'high'];

export default function InvestorMetricsCard({
  totalFarmers      = 0,
  activeFarmers     = 0,
  inactiveFarmers   = 0,
  cropBreakdown     = [],   // [{ crop, count }, ...]
  highRiskCount     = 0,
  averageProgressScore = null,  // null when not yet wired to server aggregation
  predictedYieldTotal = null,   // same — placeholder until aggregation lands
}) {
  const { t, lang } = useTranslation();

  // ─── Filter state (scoped to this card) ─────────────────
  const [country,    setCountry]    = useState('all');
  const [cropFilter, setCropFilter] = useState('all');
  const [risk,       setRisk]       = useState('all');
  const [readyOnly,  setReadyOnly]  = useState(false);

  // ─── Live: supply-readiness list ────────────────────────
  const [supply,        setSupply]        = useState([]);
  const [supplyLoading, setSupplyLoading] = useState(true);
  const [supplyError,   setSupplyError]   = useState('');

  useEffect(() => {
    let cancelled = false;
    setSupplyLoading(true);
    setSupplyError('');
    const params = {};
    if (readyOnly) params.readyToSell = 'true';
    if (country && country !== 'all') params.country = country;
    if (cropFilter && cropFilter !== 'all') params.crop = cropFilter;
    getAdminSupplyList(params)
      .then((res) => {
        if (cancelled) return;
        const rows = Array.isArray(res?.supplies) ? res.supplies
                   : Array.isArray(res?.records)  ? res.records
                   : Array.isArray(res?.data)     ? res.data
                   : [];
        setSupply(rows);
      })
      .catch((err) => {
        if (cancelled) return;
        setSupplyError(err && err.message ? err.message : 'Failed to load');
      })
      .finally(() => { if (!cancelled) setSupplyLoading(false); });
    return () => { cancelled = true; };
  }, [country, cropFilter, readyOnly]);

  // Derived: crop options for the filter chip from props.
  const cropOptions = useMemo(() => {
    const codes = new Set(['all']);
    for (const c of cropBreakdown) if (c && c.crop) codes.add(c.crop);
    for (const s of supply) if (s && s.crop) codes.add(s.crop);
    return Array.from(codes);
  }, [cropBreakdown, supply]);

  // Derived: filter the (already filtered server-side) supply by
  // local risk filter — risk lives on the related farm profile but
  // server doesn't currently filter on it. We treat 'all' as
  // pass-through.
  const filteredSupply = useMemo(() => {
    if (risk === 'all') return supply;
    return supply.filter((s) => (s && s.riskLevel ? s.riskLevel === risk : false));
  }, [supply, risk]);

  const readyToSellCount = filteredSupply.filter((s) => s && s.readyToSell).length;

  // ─── Render ─────────────────────────────────────────────
  return (
    <section style={S.card} data-testid="investor-metrics-card">
      <header style={S.cardHeader}>
        <div>
          <h3 style={S.title}>
            {tSafe(t, 'admin.investor.title', 'Investor metrics')}
          </h3>
          <p style={S.sub}>
            {tSafe(t, 'admin.investor.sub',
              'Higher-level signals for portfolio review. Filters scoped to this card only.')}
          </p>
        </div>
      </header>

      {/* Filters */}
      <div style={S.filters}>
        <FilterGroup label={tSafe(t, 'admin.filter.country', 'Country')}
                     value={country} options={['all']}
                     onChange={setCountry} />
        <FilterGroup label={tSafe(t, 'admin.filter.crop', 'Crop')}
                     value={cropFilter} options={cropOptions}
                     onChange={setCropFilter}
                     formatOption={(c) => c === 'all'
                       ? tSafe(t, 'admin.filter.all', 'All')
                       : (getCropLabelSafe(c, lang) || c)} />
        <FilterGroup label={tSafe(t, 'admin.filter.riskLevel', 'Risk')}
                     value={risk} options={RISK_LEVELS}
                     onChange={setRisk}
                     formatOption={(r) => tSafe(t, `admin.risk.${r}`, r)} />
        <ToggleChip label={tSafe(t, 'admin.filter.readyOnly', 'Ready to sell only')}
                    value={readyOnly} onChange={setReadyOnly} />
      </div>

      {/* Cards grid */}
      <div style={S.grid}>
        <Stat label={tSafe(t, 'admin.totalFarmers', 'Total farmers')}
              value={totalFarmers} />
        <Stat label={tSafe(t, 'admin.activeFarmers', 'Active')}
              value={activeFarmers} />
        <Stat label={tSafe(t, 'admin.inactiveFarmers', 'Inactive')}
              value={inactiveFarmers} />
        <Stat label={tSafe(t, 'admin.investor.readyToSell', 'Ready to sell')}
              value={supplyLoading ? '…' : readyToSellCount}
              hint={supplyError || null} />
        <Stat label={tSafe(t, 'admin.investor.avgProgress', 'Avg progress score')}
              value={averageProgressScore == null ? '—' : averageProgressScore}
              hint={averageProgressScore == null
                ? tSafe(t, 'admin.investor.aggregationPending',
                    'Aggregation endpoint pending')
                : null} />
        <Stat label={tSafe(t, 'admin.investor.highRisk', 'High-risk farms')}
              value={highRiskCount} />
        <Stat label={tSafe(t, 'admin.investor.predictedYield', 'Predicted yield (kg)')}
              value={predictedYieldTotal == null ? '—' : predictedYieldTotal}
              hint={predictedYieldTotal == null
                ? tSafe(t, 'admin.investor.aggregationPending',
                    'Aggregation endpoint pending')
                : null} />
        <Stat label={tSafe(t, 'admin.investor.cropDistribution', 'Top crops')}
              value={
                cropBreakdown.slice(0, 3)
                  .map((c) => getCropLabelSafe(c.crop, lang) || c.crop)
                  .join(', ') || '—'
              } />
      </div>

      {/* Optional: ready-to-sell rows when the filter is on */}
      {readyOnly && filteredSupply.length > 0 && (
        <div style={S.rowList}>
          {filteredSupply.slice(0, 10).map((row) => (
            <div key={row.id} style={S.row}>
              <div style={S.rowMain}>
                <strong>{getCropLabelSafe(row.crop, lang) || row.crop}</strong>
                {row.estimatedQuantity ? (
                  <span style={S.rowMuted}>
                    {' \u00B7 '}{row.estimatedQuantity} {row.quantityUnit || 'kg'}
                  </span>
                ) : null}
                {row.expectedHarvestDate ? (
                  <span style={S.rowMuted}>
                    {' \u00B7 '}{new Date(row.expectedHarvestDate).toLocaleDateString()}
                  </span>
                ) : null}
              </div>
              <span style={S.rowBadge}>{row.status || 'active'}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Stat({ label, value, hint }) {
  return (
    <div style={S.stat}>
      <div style={S.statValue}>{value}</div>
      <div style={S.statLabel}>{label}</div>
      {hint && <div style={S.statHint}>{hint}</div>}
    </div>
  );
}

function FilterGroup({ label, value, options, onChange, formatOption }) {
  return (
    <div style={S.filterGroup}>
      <span style={S.filterLabel}>{label}</span>
      <div style={S.chipRow}>
        {options.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            style={value === o ? { ...S.chip, ...S.chipActive } : S.chip}
            data-testid={`filter-${label}-${o}`}
          >
            {formatOption ? formatOption(o) : o}
          </button>
        ))}
      </div>
    </div>
  );
}

function ToggleChip({ label, value, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      style={value ? { ...S.chip, ...S.chipActive } : S.chip}
      data-testid={`toggle-${label}`}
    >
      {value ? '\u2713 ' : ''}{label}
    </button>
  );
}

const S = {
  card: {
    background: '#111D2E', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16, padding: '1rem 1.125rem',
    color: '#E2E8F0', display: 'flex', flexDirection: 'column',
    gap: '0.875rem', marginTop: '1rem',
  },
  cardHeader: { display: 'flex', justifyContent: 'space-between',
                alignItems: 'flex-start', gap: '1rem' },
  title:      { margin: 0, fontSize: '1rem', fontWeight: 700, color: '#F8FAFC' },
  sub:        { margin: '0.25rem 0 0', fontSize: '0.8125rem',
                color: 'rgba(255,255,255,0.55)' },
  filters:    { display: 'flex', flexWrap: 'wrap', gap: '0.75rem',
                alignItems: 'flex-start' },
  filterGroup:{ display: 'flex', flexDirection: 'column', gap: '0.25rem' },
  filterLabel:{ fontSize: '0.6875rem', fontWeight: 700, color: 'rgba(255,255,255,0.55)',
                textTransform: 'uppercase', letterSpacing: '0.04em' },
  chipRow:    { display: 'flex', flexWrap: 'wrap', gap: '0.375rem' },
  chip: {
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.04)', color: '#E2E8F0',
    fontSize: '0.75rem', padding: '0.3rem 0.625rem',
    borderRadius: 999, cursor: 'pointer',
  },
  chipActive: {
    border: '1px solid rgba(34,197,94,0.55)',
    background: 'rgba(34,197,94,0.15)', color: '#86EFAC',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: '0.75rem',
  },
  stat: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 12, padding: '0.75rem',
    display: 'flex', flexDirection: 'column', gap: '0.125rem',
  },
  statValue: { fontSize: '1.5rem', fontWeight: 800, color: '#F8FAFC' },
  statLabel: { fontSize: '0.75rem', color: 'rgba(255,255,255,0.65)' },
  statHint:  { fontSize: '0.6875rem', color: 'rgba(255,255,255,0.4)',
               marginTop: '0.25rem' },
  rowList:   { display: 'flex', flexDirection: 'column', gap: '0.375rem',
               marginTop: '0.5rem' },
  row: {
    background: 'rgba(255,255,255,0.04)', borderRadius: 10,
    padding: '0.5rem 0.75rem', display: 'flex',
    justifyContent: 'space-between', alignItems: 'center',
    gap: '0.5rem', fontSize: '0.8125rem',
  },
  rowMain:   { color: '#E2E8F0', minWidth: 0, flex: 1 },
  rowMuted:  { color: 'rgba(255,255,255,0.55)' },
  rowBadge:  { fontSize: '0.6875rem', color: '#86EFAC',
               border: '1px solid rgba(134,239,172,0.35)',
               background: 'rgba(134,239,172,0.08)',
               padding: '0.125rem 0.5rem', borderRadius: 999,
               textTransform: 'uppercase', letterSpacing: '0.04em' },
};
