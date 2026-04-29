/**
 * SellIntroBanner — one-time educational card on FarmerTodayPage
 * that introduces the marketplace ("you can sell your crops
 * here") to returning farmers.
 *
 * Lifecycle
 *   • Eligibility comes from `shouldShowSellIntro()`. The parent
 *     calls `markTodayVisit()` on mount; this banner only
 *     renders when the visit counter has crossed the threshold
 *     and the farmer hasn't already dismissed it.
 *   • Dismiss is sticky (localStorage flag). Tapping Continue
 *     also dismisses — the user has now "seen" the intro.
 *
 * No data dependencies — pure presentation + localStorage flag.
 * Safe to remove without affecting any other engine or store.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { tStrict } from '../../i18n/strictT.js';
import { useTranslation } from '../../i18n/index.js';
import {
  shouldShowSellIntro, dismissSellIntro,
} from '../../lib/farm/sellIntroFlag.js';
import { ArrowRight } from '../icons/lucide.jsx';

export default function SellIntroBanner() {
  // Subscribe to language change so headline + CTA refresh
  // without remount.
  useTranslation();

  // Local "hide now" mirror of the persistent flag — keeps the
  // dismiss interaction snappy without having to re-read
  // localStorage on each render.
  const [hidden, setHidden] = useState(() => !shouldShowSellIntro());
  const navigate = useNavigate();

  if (hidden) return null;

  function handleDismiss() {
    try { dismissSellIntro(); } catch { /* ignore */ }
    setHidden(true);
  }

  function handleContinue() {
    try { dismissSellIntro(); } catch { /* ignore */ }
    setHidden(true);
    try { navigate('/sell'); } catch { /* ignore */ }
  }

  return (
    <section
      style={S.card}
      data-testid="sell-intro-banner"
      role="region"
      aria-label={tStrict('farm.sellIntro.title', 'You can sell your crops here')}
    >
      <div style={S.body}>
        <h2 style={S.title}>
          {tStrict('farm.sellIntro.title', 'You can sell your crops here')}
        </h2>
        <p style={S.lead}>
          {tStrict(
            'farm.sellIntro.lead',
            'When your crop is ready, buyers can find you.',
          )}
        </p>
      </div>
      <div style={S.actions}>
        <button
          type="button"
          style={S.cta}
          data-testid="sell-intro-continue"
          onClick={handleContinue}
        >
          <span>{tStrict('farm.sellIntro.continue', 'Continue')}</span>
          <ArrowRight size={14} />
        </button>
        <button
          type="button"
          style={S.dismiss}
          data-testid="sell-intro-dismiss"
          aria-label={tStrict('farm.sellIntro.dismiss', 'Dismiss')}
          onClick={handleDismiss}
        >
          {'\u2715'}
        </button>
      </div>
    </section>
  );
}

const S = {
  card: {
    background: '#102C47',
    border: '1px solid rgba(34,197,94,0.35)',
    borderRadius: 12,
    padding: '12px 14px',
    margin: '0 0 12px 0',
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    flexWrap: 'wrap',
  },
  body: {
    flex: '1 1 220px',
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  title: {
    margin: 0,
    fontSize: '0.95rem',
    fontWeight: 700,
    color: '#fff',
    lineHeight: 1.3,
  },
  lead: {
    margin: 0,
    fontSize: '0.825rem',
    color: 'rgba(255,255,255,0.72)',
    lineHeight: 1.45,
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flex: '0 0 auto',
  },
  cta: {
    appearance: 'none',
    border: 'none',
    background: '#22C55E',
    color: '#fff',
    borderRadius: 999,
    padding: '6px 12px',
    fontSize: '0.8125rem',
    fontWeight: 700,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    boxShadow: '0 4px 12px rgba(34,197,94,0.20)',
  },
  dismiss: {
    appearance: 'none',
    border: '1px solid rgba(255,255,255,0.18)',
    background: 'transparent',
    color: 'rgba(255,255,255,0.72)',
    borderRadius: 999,
    width: 32,
    height: 32,
    minHeight: 32,
    fontSize: '0.9rem',
    fontWeight: 700,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
};
