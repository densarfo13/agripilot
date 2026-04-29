/**
 * QuickActionsCard — four large buttons at the top of My Farm.
 *
 *   • Update Farm        → /edit-farm
 *   • Scan Crop          → /scan-crop
 *   • Mark Produce Ready → /sell
 *   • View Funding       → /opportunities
 *
 * Each button is mobile-first (large hit target), uses a
 * Lucide-style icon + a localized label, and routes via
 * react-router. The card only renders for farms — the empty-state
 * card owns the no-farm CTA path (Add Farm).
 *
 * Visible text routes through tStrict so non-English UIs never
 * leak English.
 */

import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Camera, ShoppingCart, Coins } from '../icons/lucide.jsx';

const ACTIONS = [
  { key: 'updateFarm',   labelKey: 'farm.actions.updateFarm',   icon: RefreshCw,    route: '/edit-farm' },
  { key: 'scanCrop',     labelKey: 'farm.actions.scanCrop',     icon: Camera,       route: '/scan-crop' },
  { key: 'markReady',    labelKey: 'farm.actions.markReady',    icon: ShoppingCart, route: '/sell' },
  { key: 'viewFunding',  labelKey: 'farm.actions.viewFunding',  icon: Coins,        route: '/opportunities' },
];

export default function QuickActionsCard() {
  useTranslation();
  const navigate = useNavigate();

  return (
    <section style={S.card} data-testid="farm-quick-actions">
      <h2 style={S.title}>{tStrict('farm.actions.title', '')}</h2>
      <div style={S.grid}>
        {ACTIONS.map((a, idx) => {
          const Icon = a.icon;
          const label = tStrict(a.labelKey, '');
          // First action (Update Farm) is the primary CTA — green;
          // the rest sit on a darker navy surface (matches the
          // visual reference's 1-primary / 3-secondary grid).
          const isPrimary = idx === 0;
          const btnStyle = { ...S.btn, ...(isPrimary ? S.btnPrimary : S.btnSecondary) };
          return (
            <button
              key={a.key}
              type="button"
              style={btnStyle}
              data-action={a.key}
              data-primary={isPrimary || undefined}
              onClick={() => { try { navigate(a.route); } catch { /* ignore */ } }}
              aria-label={label}
            >
              <span style={S.btnIcon} aria-hidden="true">
                <Icon size={20} />
              </span>
              <span style={S.btnLabel}>{label || ''}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

const S = {
  card: {
    background: '#102C47',
    border: '1px solid #1F3B5C',
    borderRadius: 12,
    padding: '14px 16px',
    margin: '0 0 12px 0',
  },
  title: {
    margin: '0 0 10px',
    fontSize: '0.95rem',
    fontWeight: 600,
    color: '#fff',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 10,
  },
  btn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '12px',
    minHeight: 64,
    appearance: 'none',
    color: '#fff',
    borderRadius: 10,
    cursor: 'pointer',
    textAlign: 'center',
    fontWeight: 600,
    transition: 'background 120ms ease',
  },
  btnPrimary: {
    background: '#22C55E',
    border: '1px solid #16A34A',
    boxShadow: '0 6px 16px rgba(34,197,94,0.22)',
  },
  btnSecondary: {
    background: '#1A3B5D',
    border: '1px solid #1F3B5C',
  },
  btnIcon: {
    color: '#fff',
    display: 'inline-flex',
    opacity: 0.9,
  },
  btnLabel: {
    fontSize: '0.9rem',
    color: '#fff',
    lineHeight: 1.2,
  },
};
