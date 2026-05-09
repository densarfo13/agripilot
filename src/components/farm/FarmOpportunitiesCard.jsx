/**
 * FarmOpportunitiesCard — calm secondary card that consolidates
 * Funding + Sell + (optional) Buyer interest entry points into
 * a single readable surface on My Farm.
 *
 *   <FarmOpportunitiesCard
 *     showFunding={true}
 *     showSell={true}
 *     onOpenFunding={() => …}
 *     onOpenSell={() => …}
 *   />
 *
 * Spec contract (May 2026 My Farm refinement §10)
 *   • Replace the disconnected "Funding →  /  Sell →" shortcut
 *     row with a single labelled card so the pair reads as a
 *     paired "Farm opportunities" utility, not bare links.
 *   • Small secondary section only — no marketing chrome, no
 *     dashboard energy.
 *   • Self-suppresses when neither shortcut is allowed (e.g.
 *     backyard users who don't see Funding/Sell at all).
 *
 * Strict-rule audit
 *   • Pure presentational. Never throws.
 *   • Inline styles only. Soft Ochre tokens.
 *   • All visible text via tSafe with English fallbacks.
 */

import React from 'react';
import { tSafe } from '../../i18n/tSafe.js';
import { PREMIUM_TOKENS as T } from '../premium/tokens.js';

function _fundingIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="#7A5A28" strokeWidth="1.6" fill="rgba(212,163,95,0.14)"/>
      <text x="12" y="16" textAnchor="middle" fontSize="11" fontWeight="800" fill="#7A5A28">$</text>
    </svg>
  );
}
function _sellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 7l1.5 12a2 2 0 0 0 2 1.8h11a2 2 0 0 0 2-1.8L21 7H3z"
            stroke="#7A5A28" strokeWidth="1.6" strokeLinejoin="round" fill="rgba(212,163,95,0.14)"/>
      <path d="M8 7a4 4 0 0 1 8 0" stroke="#7A5A28" strokeWidth="1.6" fill="none" strokeLinecap="round"/>
    </svg>
  );
}

export default function FarmOpportunitiesCard({
  showFunding = false,
  showSell = false,
  onOpenFunding = null,
  onOpenSell = null,
  testId = 'farm-opportunities-card',
}) {
  // Self-suppress when neither shortcut is allowed.
  if (!showFunding && !showSell) return null;
  if (!onOpenFunding && !onOpenSell) return null;

  return (
    <section style={S.card} data-testid={testId}>
      <p style={S.eyebrow}>
        {tSafe('farm.opportunities.title', 'Farm opportunities')}
      </p>
      <div style={S.row}>
        {showFunding && typeof onOpenFunding === 'function' ? (
          <button
            type="button"
            onClick={onOpenFunding}
            style={S.item}
            className="ff-tap"
            data-testid="farm-opportunities-funding"
          >
            <span style={S.itemIcon} aria-hidden="true">{_fundingIcon()}</span>
            <span style={S.itemText}>
              <span style={S.itemLabel}>
                {tSafe('farm.opportunities.funding', 'Funding')}
              </span>
              <span style={S.itemSub}>
                {tSafe('farm.opportunities.fundingSub', 'See programs in your region.')}
              </span>
            </span>
            <span aria-hidden="true" style={S.chev}>{'›'}</span>
          </button>
        ) : null}

        {showSell && typeof onOpenSell === 'function' ? (
          <button
            type="button"
            onClick={onOpenSell}
            style={S.item}
            className="ff-tap"
            data-testid="farm-opportunities-sell"
          >
            <span style={S.itemIcon} aria-hidden="true">{_sellIcon()}</span>
            <span style={S.itemText}>
              <span style={S.itemLabel}>
                {tSafe('farm.opportunities.sell', 'Sell produce')}
              </span>
              <span style={S.itemSub}>
                {tSafe('farm.opportunities.sellSub', 'Reach buyers when your harvest is ready.')}
              </span>
            </span>
            <span aria-hidden="true" style={S.chev}>{'›'}</span>
          </button>
        ) : null}
      </div>
    </section>
  );
}

const S = {
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.65rem',
    padding: '1rem 1.05rem',
    borderRadius: T.radiusCard,
    background: T.panelHi,
    border: `1px solid ${T.border}`,
    boxShadow: T.shadowCard,
  },
  eyebrow: {
    margin: 0,
    fontSize: '0.65rem',
    fontWeight: 800,
    letterSpacing: '0.10em',
    textTransform: 'uppercase',
    color: T.inkFaint,
  },
  row: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.55rem',
  },
  item: {
    appearance: 'none',
    fontFamily: 'inherit',
    cursor: 'pointer',
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.75rem 0.85rem',
    background: 'transparent',
    border: `1px solid ${T.border}`,
    borderRadius: 14,
    color: T.ink,
    textAlign: 'left',
    minHeight: 56,
    WebkitTapHighlightColor: 'transparent',
  },
  itemIcon: {
    width: 32, height: 32,
    flexShrink: 0,
    borderRadius: 10,
    background: T.ochreSoft,
    border: `1px solid ${T.ochreBorder}`,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    minWidth: 0,
    flex: 1,
  },
  itemLabel: {
    fontSize: '0.92rem',
    fontWeight: 700,
    color: T.ink,
  },
  itemSub: {
    fontSize: '0.76rem',
    fontWeight: 500,
    color: T.inkDim,
    lineHeight: 1.35,
  },
  chev: {
    fontSize: '1.1rem',
    fontWeight: 700,
    color: T.inkFaint,
    lineHeight: 1,
    flexShrink: 0,
  },
};
