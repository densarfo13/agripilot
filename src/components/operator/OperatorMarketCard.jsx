/**
 * OperatorMarketCard — single-market stats card on the operator
 * dashboard. Read-only; tappable to drill into the per-market
 * pending-interests queue.
 *
 * Spec coverage (Aggressive scaling §4)
 *   • Track per region: listings, buyers, transactions
 *
 * Strict-rule audit
 *   • All visible strings via tStrict.
 *   • Inline styles only.
 *   • Pure presentational.
 */

import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';

const S = {
  card: {
    appearance: 'none',
    fontFamily: 'inherit',
    cursor: 'pointer',
    textAlign: 'left',
    background: '#162033',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 14,
    padding: '14px 16px',
    color: '#EAF2FF',
    boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  cardActive: {
    border: '1px solid #22C55E',
    boxShadow: '0 4px 18px rgba(34,197,94,0.18)',
  },
  headRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: { margin: 0, fontSize: 16, fontWeight: 800, color: '#fff' },
  currency: {
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.65)',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))',
    gap: 8,
  },
  cell: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 10,
    padding: '8px 10px',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  cellLabel: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.6)',
  },
  cellValue: { fontSize: 16, fontWeight: 800, color: '#fff' },
  weeklyLine: {
    margin: 0,
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 1.45,
  },
  pendingPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '2px 8px',
    borderRadius: 999,
    background: 'rgba(245,158,11,0.10)',
    border: '1px solid rgba(245,158,11,0.32)',
    color: '#FDE68A',
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
};

/**
 * @param {object} props
 * @param {object} props.market    market object (catalog + stats)
 * @param {boolean} [props.active]
 * @param {() => void} [props.onSelect]
 * @param {object} [props.style]
 */
export default function OperatorMarketCard({ market, active, onSelect, style }) {
  useTranslation();
  if (!market) return null;
  const stats = market.stats || {};
  const conversionPct = Math.round((stats.conversion || 0) * 100);

  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        ...S.card,
        ...(active ? S.cardActive : null),
        ...(style || null),
      }}
      data-testid={`operator-market-card-${market.id}`}
      data-active={active ? 'true' : 'false'}
    >
      <div style={S.headRow}>
        <h3 style={S.title}>{market.country}</h3>
        <span style={S.currency}>
          {market.currency}{' \u00B7 '}{market.primaryUnit}
        </span>
      </div>

      <div style={S.grid}>
        <div style={S.cell}>
          <span style={S.cellLabel}>{tStrict('operator.stat.listings', 'Listings')}</span>
          <span style={S.cellValue}>{stats.listingCount || 0}</span>
        </div>
        <div style={S.cell}>
          <span style={S.cellLabel}>{tStrict('operator.stat.buyers', 'Buyers')}</span>
          <span style={S.cellValue}>{stats.uniqueBuyers || 0}</span>
        </div>
        <div style={S.cell}>
          <span style={S.cellLabel}>{tStrict('operator.stat.deals', 'Deals')}</span>
          <span style={S.cellValue}>{stats.dealsClosed || 0}</span>
        </div>
        <div style={S.cell}>
          <span style={S.cellLabel}>{tStrict('operator.stat.conversion', 'Conv.')}</span>
          <span style={S.cellValue}>{conversionPct}%</span>
        </div>
      </div>

      <p style={S.weeklyLine}>
        {tStrict(
          'operator.weeklyLine',
          '7d: {l} new listings \u00B7 {i} interests \u00B7 {d} closed',
        )
          .replace('{l}', String(stats.last7Days?.listingsCreated  || 0))
          .replace('{i}', String(stats.last7Days?.interestsReceived || 0))
          .replace('{d}', String(stats.last7Days?.dealsClosed       || 0))}
      </p>

      {stats.pendingInterests > 0 ? (
        <span style={S.pendingPill} data-testid="operator-market-pending">
          <span aria-hidden="true">{'\u26A0'}</span>
          <span>
            {tStrict('operator.pendingPill', '{n} pending')
              .replace('{n}', String(stats.pendingInterests))}
          </span>
        </span>
      ) : null}
    </button>
  );
}
