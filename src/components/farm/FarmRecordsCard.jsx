/**
 * FarmRecordsCard — four small counters showing the farm's recent
 * activity at a glance.
 *
 *   • Tasks completed this week  ← getTaskCompletions() (last 7 days)
 *   • Verified actions           ← farm.verifiedActions or 0
 *   • Produce listings           ← farm.listingsCount or 0
 *   • Funding interests          ← farm.fundingInterestsCount or 0
 *
 * Reads only client-local data (`farrowayLocal.getTaskCompletions`)
 * and whatever the farm payload already carries — no new endpoints.
 * Counts that resolve to 0 are still shown so the farmer always sees
 * the four tiles in the same layout.
 *
 * Icons: inline Lucide-style. Visible text via tStrict.
 */

import { useMemo } from 'react';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import { getTaskCompletions } from '../../store/farrowayLocal.js';
import { CheckCircle, ShieldCheck, ShoppingCart, Coins } from '../icons/lucide.jsx';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function _tasksThisWeek(farmId) {
  if (typeof getTaskCompletions !== 'function') return 0;
  let entries;
  try { entries = getTaskCompletions() || []; }
  catch { return 0; }
  if (!Array.isArray(entries)) return 0;
  const cutoff = Date.now() - SEVEN_DAYS_MS;
  return entries.filter((e) => {
    if (!e) return false;
    if (farmId && e.farmId && e.farmId !== farmId) return false;
    const ts = Number(e.completedAt || e.at || e.timestamp || 0);
    return Number.isFinite(ts) && ts >= cutoff;
  }).length;
}

function _coerceCount(v) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export default function FarmRecordsCard({ farm }) {
  useTranslation();
  if (!farm) return null;

  const completedThisWeek = useMemo(() => _tasksThisWeek(farm.id), [farm?.id]);

  const tiles = [
    {
      key: 'tasks',
      icon: <CheckCircle size={18} />,
      label: tStrict('farm.records.tasksThisWeek', ''),
      value: completedThisWeek,
    },
    {
      key: 'verified',
      icon: <ShieldCheck size={18} />,
      label: tStrict('farm.records.verifiedActions', ''),
      value: _coerceCount(farm.verifiedActions),
    },
    {
      key: 'listings',
      icon: <ShoppingCart size={18} />,
      label: tStrict('farm.records.produceListings', ''),
      value: _coerceCount(farm.listingsCount ?? farm.produceListings),
    },
    {
      key: 'funding',
      icon: <Coins size={18} />,
      label: tStrict('farm.records.fundingInterests', ''),
      value: _coerceCount(farm.fundingInterestsCount ?? farm.fundingInterests),
    },
  ];

  return (
    <section style={S.card} data-testid="farm-records-card">
      <h2 style={S.title}>{tStrict('farm.records.title', '')}</h2>
      <div style={S.grid}>
        {tiles.map((t) => (
          <div key={t.key} style={S.tile} data-record={t.key}>
            <span style={S.tileIcon} aria-hidden="true">{t.icon}</span>
            <span style={S.tileValue}>{t.value}</span>
            <span style={S.tileLabel}>{t.label || ''}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

const S = {
  card: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: '16px 18px',
    margin: '0 0 12px 0',
  },
  title: {
    margin: 0,
    fontSize: '0.85rem',
    fontWeight: 700,
    color: 'rgba(255,255,255,0.85)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: 10,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 8,
  },
  tile: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 4,
    padding: '10px 12px',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.03)',
    minHeight: 76,
  },
  tileIcon:  { color: '#86EFAC', display: 'inline-flex' },
  tileValue: { fontSize: '1.4rem', fontWeight: 800, color: '#fff', lineHeight: 1 },
  tileLabel: { fontSize: '0.78rem', color: 'rgba(255,255,255,0.65)', lineHeight: 1.2 },
};
