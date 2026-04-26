/**
 * BuyerView — read-only list of farms ready to sell, with simple
 * crop / location / score filters. NOT a marketplace — no offer
 * flow, no buyer auth, no transaction state. Just a structured
 * surface that an NGO admin or vetted buyer can use to discover
 * which farms are signalling availability.
 *
 * Data
 *   • Reads from existing `GET /api/v2/supply-readiness/admin/list`
 *     (same endpoint the existing `SupplyReadinessPage` uses).
 *   • No new endpoint, no new model, no new migration.
 *   • Crop displays go through `getCropLabelSafe` per data rule #5.
 *   • Score is computed client-side from whichever per-farmer
 *     activity signals the supply payload exposes (joined via the
 *     existing `farmer` relation). Missing signals surface in the
 *     chip's tooltip as "data incomplete".
 *
 * Filters (chips, scoped to this page)
 *   • Crop          — chip row populated from current rows
 *   • Location      — text-input contains-match (region / location)
 *   • Score band    — All / High Risk / Medium / Good / Excellent
 *
 * Out of scope (intentional)
 *   • Buyer offers, messaging, payments
 *   • CSV export (use SupplyReadinessPage which already has it)
 *   • Buyer-link state machine (existing admin tool already covers it)
 */

import { useEffect, useMemo, useState } from 'react';
import { getAdminSupplyList } from '../lib/api.js';
import { useTranslation } from '../i18n/index.js';
import { tSafe } from '../i18n/tSafe.js';
import { getCropLabelSafe } from '../utils/crops.js';
import ScoreBadge from '../components/farmer/ScoreBadge.jsx';
import RiskBadge from '../components/admin/RiskBadge.jsx';
import { computeProgressScore } from '../lib/farmer/progressScore.js';

// "High priority" cutoff per spec: score >= 70 AND status='available'.
const HIGH_PRIORITY_MIN_SCORE = 70;

export default function BuyerView() {
  const { t, lang } = useTranslation();

  const [rows,    setRows]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const [crop,         setCrop]         = useState('all');
  const [locationText, setLocationText] = useState('');
  const [minScore,     setMinScore]     = useState(0);   // 0 = no filter

  // Load once. We intentionally pull only the ready-to-sell rows so
  // a buyer view doesn't surface farms that aren't signalling.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getAdminSupplyList({ readyOnly: true })
      .then((res) => {
        if (cancelled) return;
        const list = Array.isArray(res?.supply)   ? res.supply
                   : Array.isArray(res?.records)  ? res.records
                   : Array.isArray(res?.supplies) ? res.supplies
                   : Array.isArray(res?.data)     ? res.data
                   : [];
        setRows(list);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err && err.message ? err.message : 'Failed to load');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Crop options derived from current rows.
  const cropOptions = useMemo(() => {
    const set = new Set(['all']);
    for (const r of rows) if (r && r.crop) set.add(r.crop);
    return Array.from(set);
  }, [rows]);

  // Decorate each row with its computed score once so the high-
  // priority section + the filter step + the row render all read
  // the same number. Pure / deterministic.
  const decorated = useMemo(() => rows.map((r) => {
    const f = (r && r.farmer) || {};
    const computed = computeProgressScore({
      taskCompletionRate:     f.taskCompletionRate,
      cropHealthScore:        f.cropHealthScore,
      consistencyScore:       f.consistencyScore,
      weatherAdaptationScore: f.weatherAdaptationScore,
    });
    return { row: r, score: computed.score, reasons: computed.reasons };
  }), [rows]);

  // Apply local filters.
  const filtered = useMemo(() => {
    return decorated.filter(({ row, score }) => {
      if (!row) return false;
      if (crop !== 'all' && row.crop !== crop) return false;
      if (locationText) {
        const hay = `${row.location || ''} ${row.region || ''} ${row.farmer?.region || ''} ${row.farmer?.location || ''}`.toLowerCase();
        if (!hay.includes(locationText.toLowerCase())) return false;
      }
      if (minScore > 0 && score < minScore) return false;
      return true;
    });
  }, [decorated, crop, locationText, minScore]);

  // Spec: "🔥 High Priority" — score >= 70 AND status='available'.
  // Computed AFTER filters so adjusting the filters narrows both
  // sections together (predictable behaviour).
  const highPriority = useMemo(() => filtered.filter(({ row, score }) => {
    if (score < HIGH_PRIORITY_MIN_SCORE) return false;
    const status = (row && (row.status || (row.readyToSell ? 'available' : ''))) || '';
    return status === 'available' || row.readyToSell === true;
  }), [filtered]);

  return (
    <div style={S.page}>
      <header style={S.header}>
        <h1 style={S.title}>
          {tSafe(t, 'buyerView.title', 'Ready-to-sell farms')}
        </h1>
        <p style={S.sub}>
          {tSafe(t, 'buyerView.sub',
            'Read-only list of farms that have signalled they are ready to sell. Filters scoped to this page.')}
        </p>
      </header>

      {/* Filters */}
      <div style={S.filters}>
        <div style={S.filterGroup}>
          <span style={S.filterLabel}>{tSafe(t, 'admin.filter.crop', 'Crop')}</span>
          <div style={S.chipRow}>
            {cropOptions.map((c) => (
              <button key={c} type="button"
                onClick={() => setCrop(c)}
                style={crop === c ? { ...S.chip, ...S.chipActive } : S.chip}
                data-testid={`buyer-filter-crop-${c}`}
              >
                {c === 'all'
                  ? tSafe(t, 'admin.filter.all', 'All')
                  : (getCropLabelSafe(c, lang) || c)}
              </button>
            ))}
          </div>
        </div>

        <div style={S.filterGroup}>
          <span style={S.filterLabel}>{tSafe(t, 'admin.filter.location', 'Location')}</span>
          <input
            type="text"
            value={locationText}
            onChange={(e) => setLocationText(e.target.value)}
            placeholder={tSafe(t, 'admin.filter.locationPlaceholder',
              'Type a region or location name…')}
            style={S.input}
            data-testid="buyer-filter-location"
          />
        </div>

        <div style={S.filterGroup}>
          <span style={S.filterLabel}>
            {tSafe(t, 'admin.filter.minScore', 'Min Farmer Status')}
            {minScore > 0 && <span style={S.filterValue}> ≥ {minScore}</span>}
          </span>
          <input
            type="range"
            min={0} max={100} step={10}
            value={minScore}
            onChange={(e) => setMinScore(Number(e.target.value))}
            style={S.slider}
            data-testid="buyer-filter-min-score"
          />
        </div>
      </div>

      {/* Status line */}
      <div style={S.status}>
        {loading
          ? tSafe(t, 'buyerView.loading', 'Loading…')
          : error
            ? tSafe(t, 'buyerView.error', `Failed: ${error}`)
            : `${filtered.length} ${filtered.length === 1
                ? tSafe(t, 'buyerView.farm', 'farm')
                : tSafe(t, 'buyerView.farms', 'farms')}`}
      </div>

      {/* High-Priority section — score ≥ 70 AND status=available.
          Renders only when there's at least one match so we never
          show an empty "🔥" header. */}
      {!loading && !error && highPriority.length > 0 && (
        <section style={S.priorityBlock} data-testid="high-priority-block">
          <h2 style={S.priorityTitle}>
            <span aria-hidden>{'\uD83D\uDD25 '}</span>
            {tSafe(t, 'buyerView.highPriority',
              `High Priority (${highPriority.length})`).replace('{count}', String(highPriority.length))}
          </h2>
          <ul style={S.list}>
            {highPriority.map(({ row, score, reasons }) => (
              <BuyerRow
                key={row.id}
                row={row}
                score={score}
                reasons={reasons}
                lang={lang}
                priority
              />
            ))}
          </ul>
        </section>
      )}

      {/* Full filtered list */}
      {!loading && !error && filtered.length > 0 && (
        <section style={S.allBlock}>
          <h2 style={S.sectionTitle}>
            {tSafe(t, 'buyerView.marketReady', 'Market Ready')}
          </h2>
          <ul style={S.list}>
            {filtered.map(({ row, score, reasons }) => (
              <BuyerRow
                key={row.id}
                row={row}
                score={score}
                reasons={reasons}
                lang={lang}
              />
            ))}
          </ul>
        </section>
      )}

      {!loading && !error && filtered.length === 0 && (
        <p style={S.empty}>
          {tSafe(t, 'buyerView.empty',
            'No matching farms. Adjust your filters or come back later.')}
        </p>
      )}
    </div>
  );
}

function BuyerRow({ row, score, reasons, lang, priority = false }) {
  const f = row.farmer || {};
  const farmerName = f.fullName || row.farmerName || '\u2014';
  const location   = row.location || row.region
                  || f.location || f.region || '\u2014';
  const harvestDate = row.expectedHarvestDate
    ? new Date(row.expectedHarvestDate).toLocaleDateString()
    : '\u2014';
  const qty = row.estimatedQuantity != null
    ? `${row.estimatedQuantity} ${row.quantityUnit || 'kg'}`
    : '\u2014';
  return (
    <li style={priority ? { ...S.row, ...S.rowPriority } : S.row}>
      <div style={S.rowMain}>
        <strong style={S.rowName}>{farmerName}</strong>
        <span style={S.rowMeta}>
          {getCropLabelSafe(row.crop, lang) || row.crop}
          {' \u00B7 '}{location}
          {' \u00B7 '}{qty}
          {' \u00B7 '}{harvestDate}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {/* Simple NGO-decision risk band, in addition to the
            richer 4-band ScoreBadge already shown. The two coexist:
            ScoreBadge surfaces the score number + tooltip reasons,
            RiskBadge gives buyers the at-a-glance High/Med/Low
            decision call. */}
        <RiskBadge score={score} />
        <ScoreBadge score={score} reasons={reasons} />
      </div>
    </li>
  );
}

const S = {
  page:   { padding: '1rem 1.25rem', maxWidth: 960, margin: '0 auto',
            color: '#E2E8F0' },
  header: { marginBottom: '1rem' },
  title:  { margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#F8FAFC' },
  sub:    { margin: '0.25rem 0 0', fontSize: '0.875rem',
            color: 'rgba(255,255,255,0.55)' },
  filters:    { display: 'flex', flexWrap: 'wrap', gap: '0.875rem',
                margin: '0.75rem 0 1rem' },
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
  input: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 8, padding: '0.4rem 0.625rem',
    color: '#E2E8F0', fontSize: '0.8125rem', minWidth: 220,
  },
  status: { fontSize: '0.8125rem', color: 'rgba(255,255,255,0.55)',
            margin: '0 0 0.5rem' },
  list:   { listStyle: 'none', padding: 0, margin: 0,
            display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  row: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: '0.75rem',
    background: '#111D2E', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 12, padding: '0.625rem 0.875rem',
  },
  rowMain: { display: 'flex', flexDirection: 'column', gap: '0.125rem',
             minWidth: 0, flex: 1 },
  rowName: { color: '#F8FAFC', fontSize: '0.9375rem' },
  rowMeta: { color: 'rgba(255,255,255,0.65)', fontSize: '0.8125rem',
             overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  empty:  { color: 'rgba(255,255,255,0.55)', fontSize: '0.875rem',
            padding: '1rem 0' },

  // High-priority block — gentle accent, not a screaming red banner.
  priorityBlock: {
    border: '1px solid rgba(245,158,11,0.35)',
    background: 'rgba(245,158,11,0.06)',
    borderRadius: 12, padding: '0.75rem 0.875rem',
    marginBottom: '1rem', display: 'flex',
    flexDirection: 'column', gap: '0.5rem',
  },
  priorityTitle: { margin: 0, fontSize: '0.9375rem', fontWeight: 700,
                   color: '#FDE68A', display: 'flex', alignItems: 'center' },
  rowPriority: {
    border: '1px solid rgba(245,158,11,0.35)',
    background: 'rgba(245,158,11,0.04)',
  },
  allBlock: { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  sectionTitle: { margin: 0, fontSize: '0.875rem', fontWeight: 700,
                  color: 'rgba(255,255,255,0.65)',
                  textTransform: 'uppercase', letterSpacing: '0.04em' },

  // Slider input visuals.
  slider: { width: '180px', accentColor: '#22C55E' },
  filterValue: { color: '#86EFAC', fontWeight: 700, marginLeft: '0.25rem' },
};
