/**
 * RepeatPromptCard — "What do you need next?" card shown after a
 * transaction completes.
 *
 * Spec coverage (Marketplace scale §3)
 *   • Repeat prompt — after a transaction, ask for next need.
 *
 * Two roles:
 *   • role="buyer"   — shown after the buyer submits an interest.
 *                       CTA: list another crop they want
 *                       (route to /buy with a #search hint).
 *   • role="seller"  — shown after the seller marks a listing
 *                       sold or accepts an interest.
 *                       CTA: list another crop (route to /sell).
 *
 * Strict-rule audit
 *   • All visible strings via tStrict.
 *   • Inline styles only.
 *   • Pure presentational. Caller owns visibility state.
 */

import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import { useNavigate } from 'react-router-dom';
import { trackEvent } from '../../analytics/analyticsStore.js';

const S = {
  card: {
    background: 'linear-gradient(135deg, rgba(34,197,94,0.18), rgba(14,165,233,0.10))',
    border: '1px solid rgba(34,197,94,0.35)',
    borderRadius: 14,
    padding: '14px 16px',
    color: '#fff',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
  },
  headRow: { display: 'flex', alignItems: 'center', gap: 10 },
  icon: { fontSize: 20, lineHeight: 1 },
  title: { margin: 0, fontSize: 15, fontWeight: 800, color: '#fff' },
  copy:  { margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.78)', lineHeight: 1.5 },
  rowBtns: { display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  primary: {
    appearance: 'none',
    border: 'none',
    padding: '10px 14px',
    borderRadius: 10,
    background: '#22C55E',
    color: '#0B1D34',
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  secondary: {
    appearance: 'none',
    padding: '10px 14px',
    borderRadius: 10,
    background: 'transparent',
    color: 'rgba(255,255,255,0.85)',
    border: '1px solid rgba(255,255,255,0.20)',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};

/**
 * @param {object} props
 * @param {'buyer' | 'seller'} props.role
 * @param {() => void} [props.onDismiss]
 * @param {object} [props.style]
 */
export default function RepeatPromptCard({ role = 'buyer', onDismiss, style }) {
  useTranslation();
  const navigate = useNavigate();

  const isBuyer = role === 'buyer';

  const titleKey = isBuyer
    ? 'market.repeat.buyer.title'
    : 'market.repeat.seller.title';
  const titleFallback = isBuyer
    ? 'What else do you need?'
    : 'List another crop?';
  const copyKey = isBuyer
    ? 'market.repeat.buyer.copy'
    : 'market.repeat.seller.copy';
  const copyFallback = isBuyer
    ? 'Tell us your next produce need and we\u2019ll alert you when it\u2019s listed.'
    : 'Buyers came back fast. List another harvest while interest is high.';
  const primaryKey = isBuyer
    ? 'market.repeat.buyer.cta'
    : 'market.repeat.seller.cta';
  const primaryFallback = isBuyer ? 'Find another crop' : 'List another crop';

  const handlePrimary = () => {
    try {
      trackEvent('marketplace_repeat_cta_click', { role });
    } catch { /* swallow */ }
    try { navigate(isBuyer ? '/buy' : '/sell'); }
    catch { /* swallow */ }
  };

  return (
    <section
      style={{ ...S.card, ...(style || null) }}
      data-testid={`market-repeat-prompt-${role}`}
    >
      <div style={S.headRow}>
        <span style={S.icon} aria-hidden="true">{'\uD83D\uDD04'}</span>
        <h3 style={S.title}>{tStrict(titleKey, titleFallback)}</h3>
      </div>
      <p style={S.copy}>{tStrict(copyKey, copyFallback)}</p>
      <div style={S.rowBtns}>
        <button
          type="button"
          onClick={handlePrimary}
          style={S.primary}
          data-testid={`market-repeat-cta-${role}`}
        >
          {tStrict(primaryKey, primaryFallback)}
        </button>
        {typeof onDismiss === 'function' ? (
          <button
            type="button"
            onClick={onDismiss}
            style={S.secondary}
            data-testid={`market-repeat-dismiss-${role}`}
          >
            {tStrict('common.notNow', 'Not now')}
          </button>
        ) : null}
      </div>
    </section>
  );
}
