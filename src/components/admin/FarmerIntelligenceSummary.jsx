/**
 * FarmerIntelligenceSummary — five-tile decision dashboard for the
 * NGO/admin overview page.
 *
 * Tiles (per spec)
 * ────────────────
 *   1. Total farmers           ← summary.totalFarmers
 *   2. Active %                ← summary.activeFarmers / totalFarmers
 *   3. High risk count         ← scoring rows with score < 40
 *   4. Ready to sell count     ← farmers in harvest-ready stage,
 *                                  fallback to marketplace.totalListings
 *   5. Estimated total yield   ← Σ row.yield (server) | est for row
 *                                  (estimateTotalYield helper)
 *
 * All numbers are derived client-side from data the parent page
 * already loaded — no new endpoints. Each tile self-shows a "—"
 * when the input is missing rather than a misleading "0".
 *
 * Visible text routes through tStrict so non-English UIs render
 * the correct copy when keys ship.
 */

import { useMemo } from 'react';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import { estimateTotalYield } from '../../lib/intelligence/estimateYield.js';

const READY_STAGES = new Set(['harvest', 'post_harvest', 'ready_to_sell', 'ready']);

function _num(v, fallback = 0) {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function _formatKg(kg) {
  if (!Number.isFinite(kg) || kg <= 0) return '—';
  if (kg >= 1_000_000) return `${(kg / 1_000_000).toFixed(1)} Mt`;
  if (kg >= 1000)      return `${(kg / 1000).toFixed(1)} t`;
  return `${Math.round(kg)} kg`;
}

export default function FarmerIntelligenceSummary({
  summary, farmers, performance, scoring, marketplace,
}) {
  // Subscribe to language change so labels refresh live.
  useTranslation();

  const total = _num(summary?.totalFarmers, 0);
  const active = _num(summary?.activeFarmers, 0);
  const activePct = total > 0 ? Math.round((active / total) * 100) : null;

  const highRisk = useMemo(() => {
    if (!Array.isArray(scoring)) return null;
    return scoring.filter(s => _num(s?.score, 0) > 0 && _num(s?.score, 0) < 40).length;
  }, [scoring]);

  const readyToSell = useMemo(() => {
    const farmList = Array.isArray(farmers) ? farmers : [];
    const byStage = farmList.filter(f => READY_STAGES.has(String(f?.stage || '').toLowerCase())).length;
    if (byStage > 0) return byStage;
    const listings = _num(marketplace?.totalListings, 0);
    return listings > 0 ? listings : null;
  }, [farmers, marketplace]);

  const yieldKg = useMemo(() => {
    // Prefer the performance[] rows which already carry a server-
    // computed `yield`. estimateTotalYield falls back to per-row
    // estimation when the field is missing.
    const rows = Array.isArray(performance) && performance.length
      ? performance
      : Array.isArray(scoring) ? scoring : [];
    const { totalKg } = estimateTotalYield(rows);
    return totalKg > 0 ? totalKg : null;
  }, [performance, scoring]);

  const tiles = [
    {
      key: 'total',
      labelKey: 'admin.summary.totalFarmers',
      labelFallback: 'Total Farmers',
      value: total > 0 ? total.toLocaleString() : '—',
    },
    {
      key: 'active',
      labelKey: 'admin.summary.activePct',
      labelFallback: 'Active %',
      value: activePct == null ? '—' : `${activePct}%`,
      hint: total > 0 ? `${active.toLocaleString()} / ${total.toLocaleString()}` : null,
    },
    {
      key: 'highRisk',
      labelKey: 'admin.summary.highRisk',
      labelFallback: 'High Risk',
      value: highRisk == null ? '—' : highRisk.toLocaleString(),
      tone: 'danger',
    },
    {
      key: 'ready',
      labelKey: 'admin.summary.readyToSell',
      labelFallback: 'Ready to Sell',
      value: readyToSell == null ? '—' : readyToSell.toLocaleString(),
      tone: 'success',
    },
    {
      key: 'yield',
      labelKey: 'admin.summary.estTotalYield',
      labelFallback: 'Est. Total Yield',
      value: _formatKg(yieldKg),
    },
  ];

  return (
    <section style={S.section} data-testid="farmer-intelligence-summary">
      <h3 style={S.h3}>
        {tStrict('admin.intelligence.title', 'Farmer Intelligence Summary')}
      </h3>
      <div style={S.grid}>
        {tiles.map(t => (
          <div
            key={t.key}
            style={{ ...S.tile, ...toneStyle(t.tone) }}
            data-tile={t.key}
            data-tone={t.tone || 'info'}
          >
            <div style={S.tileLabel}>{tStrict(t.labelKey, t.labelFallback)}</div>
            <div style={S.tileValue}>{t.value}</div>
            {t.hint ? <div style={S.tileHint}>{t.hint}</div> : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function toneStyle(tone) {
  switch (tone) {
    case 'danger':  return { borderColor: 'rgba(239,68,68,0.35)' };
    case 'success': return { borderColor: 'rgba(34,197,94,0.35)' };
    default:        return null;
  }
}

const S = {
  section: { marginTop: '1rem' },
  h3: { fontSize: '1.1rem', fontWeight: 600, margin: '0 0 0.5rem' },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '0.75rem',
  },
  tile: {
    padding: '0.875rem 1rem',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
  },
  tileLabel: {
    fontSize: '0.72rem',
    color: 'rgba(255,255,255,0.6)',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  tileValue: { fontSize: '1.5rem', fontWeight: 700, marginTop: 4, color: '#fff' },
  tileHint: { fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginTop: 2 },
};
