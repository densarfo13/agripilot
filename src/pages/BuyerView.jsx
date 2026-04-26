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
import ProgressScoreChip from '../components/farmer/ProgressScoreChip.jsx';
import { computeProgressScore } from '../lib/farmer/progressScore.js';

const SCORE_BANDS = ['all', 'High Risk', 'Medium', 'Good', 'Excellent'];

export default function BuyerView() {
  const { t, lang } = useTranslation();

  const [rows,    setRows]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const [crop,         setCrop]         = useState('all');
  const [locationText, setLocationText] = useState('');
  const [scoreBand,    setScoreBand]    = useState('all');

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

  // Apply local filters. Score band uses the same compute function
  // as everywhere else — single source of truth.
  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (!r) return false;
      if (crop !== 'all' && r.crop !== crop) return false;
      if (locationText) {
        const hay = `${r.location || ''} ${r.region || ''} ${r.farmer?.region || ''} ${r.farmer?.location || ''}`.toLowerCase();
        if (!hay.includes(locationText.toLowerCase())) return false;
      }
      if (scoreBand !== 'all') {
        const f = r.farmer || {};
        const score = computeProgressScore({
          taskCompletionRate:    f.taskCompletionRate,
          cropHealthScore:       f.cropHealthScore,
          consistencyScore:      f.consistencyScore,
          weatherAdaptationScore: f.weatherAdaptationScore,
        });
        if (score.label !== scoreBand) return false;
      }
      return true;
    });
  }, [rows, crop, locationText, scoreBand]);

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
          <span style={S.filterLabel}>{tSafe(t, 'admin.filter.score', 'Score')}</span>
          <div style={S.chipRow}>
            {SCORE_BANDS.map((band) => (
              <button key={band} type="button"
                onClick={() => setScoreBand(band)}
                style={scoreBand === band ? { ...S.chip, ...S.chipActive } : S.chip}
                data-testid={`buyer-filter-score-${band}`}
              >
                {band === 'all'
                  ? tSafe(t, 'admin.filter.all', 'All')
                  : tSafe(t, `progressScore.label.${band.toLowerCase().replace(/\s+/g, '_')}`, band)}
              </button>
            ))}
          </div>
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

      {/* Rows */}
      {!loading && !error && filtered.length > 0 && (
        <ul style={S.list}>
          {filtered.map((row) => {
            const f = row.farmer || {};
            const farmerName = f.fullName || row.farmerName || '—';
            const location   = row.location || row.region
                             || f.location || f.region || '—';
            const harvestDate = row.expectedHarvestDate
              ? new Date(row.expectedHarvestDate).toLocaleDateString()
              : '—';
            const qty = row.estimatedQuantity != null
              ? `${row.estimatedQuantity} ${row.quantityUnit || 'kg'}`
              : '—';
            return (
              <li key={row.id} style={S.row}>
                <div style={S.rowMain}>
                  <strong style={S.rowName}>{farmerName}</strong>
                  <span style={S.rowMeta}>
                    {getCropLabelSafe(row.crop, lang) || row.crop}
                    {' \u00B7 '}{location}
                    {' \u00B7 '}{qty}
                    {' \u00B7 '}{harvestDate}
                  </span>
                </div>
                <ProgressScoreChip
                  taskCompletionRate={f.taskCompletionRate}
                  cropHealthScore={f.cropHealthScore}
                  consistencyScore={f.consistencyScore}
                  weatherAdaptationScore={f.weatherAdaptationScore}
                />
              </li>
            );
          })}
        </ul>
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
};
