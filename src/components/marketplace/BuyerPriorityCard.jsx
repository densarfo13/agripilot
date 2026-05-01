/**
 * BuyerPriorityCard — opt-in "priority access" toggle for buyers.
 *
 * Spec coverage (Marketplace monetization §3)
 *   • option for buyers to access listings faster
 *
 * Position
 *   Mounts at the top of `/buy` when the `marketMonetization`
 *   flag is on. Toggling it on persists `farroway_buyer_priority`;
 *   the existing `listingPriority.sortListingsByRelevance` already
 *   bubbles boosted listings ahead, so a priority buyer naturally
 *   sees the freshest paid placements first.
 *
 * Strict-rule audit
 *   • All visible strings via tStrict.
 *   • Inline styles only.
 *   • Pure presentational; reads `isBuyerPriority` and writes via
 *     `setBuyerPriority`.
 *   • Self-hides when flag is off.
 *   • Never blocks the `/buy` listings (additive only).
 */

import { useEffect, useState } from 'react';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import { isFeatureEnabled } from '../../config/features.js';
import {
  isBuyerPriority,
  setBuyerPriority,
  PRIORITY_CHANGED_EVENT,
} from '../../market/buyerPriority.js';

const S = {
  card: {
    background: 'linear-gradient(135deg, rgba(168,85,247,0.16), rgba(34,197,94,0.08))',
    border: '1px solid rgba(168,85,247,0.42)',
    borderRadius: 14,
    padding: '12px 14px',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
  },
  body: { display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 },
  title: { margin: 0, fontSize: 14, fontWeight: 800 },
  copy: { margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.78)', lineHeight: 1.5 },
  toggle: {
    appearance: 'none',
    border: '1px solid rgba(168,85,247,0.55)',
    background: 'rgba(168,85,247,0.18)',
    color: '#E9D5FF',
    fontSize: 12,
    fontWeight: 800,
    padding: '6px 12px',
    borderRadius: 999,
    cursor: 'pointer',
    fontFamily: 'inherit',
    flex: '0 0 auto',
  },
  toggleOn: {
    background: '#A855F7',
    color: '#0B1D34',
  },
};

export default function BuyerPriorityCard({ style }) {
  useTranslation();
  const flagOn = isFeatureEnabled('marketMonetization');
  const [enabled, setEnabled] = useState(() => {
    try { return isBuyerPriority(); } catch { return false; }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handler = () => {
      try { setEnabled(isBuyerPriority()); } catch { /* swallow */ }
    };
    try {
      window.addEventListener(PRIORITY_CHANGED_EVENT, handler);
      window.addEventListener('storage', handler);
    } catch { /* swallow */ }
    return () => {
      try {
        window.removeEventListener(PRIORITY_CHANGED_EVENT, handler);
        window.removeEventListener('storage', handler);
      } catch { /* swallow */ }
    };
  }, []);

  const onToggle = () => {
    const next = !enabled;
    try { setBuyerPriority(next, { source: 'buy_page' }); } catch { /* swallow */ }
    setEnabled(next);
  };

  if (!flagOn) return null;

  return (
    <section
      style={{ ...S.card, ...(style || null) }}
      data-testid="market-buyer-priority-card"
    >
      <div style={S.body}>
        <h3 style={S.title}>
          {tStrict('market.priority.title', 'Buyer Priority')}
        </h3>
        <p style={S.copy}>
          {enabled
            ? tStrict('market.priority.copy.on',
                'Priority on \u2014 boosted listings surface first for you.')
            : tStrict('market.priority.copy.off',
                'See boosted listings first and skip the queue.')}
        </p>
      </div>
      <button
        type="button"
        onClick={onToggle}
        style={{ ...S.toggle, ...(enabled ? S.toggleOn : null) }}
        data-testid="market-buyer-priority-toggle"
        aria-pressed={enabled ? 'true' : 'false'}
      >
        {enabled
          ? tStrict('monetization.ngo.toggle.on',  'On')
          : tStrict('market.priority.cta',         'Get priority')}
      </button>
    </section>
  );
}
