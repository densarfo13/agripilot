/**
 * SellEmptyPrompt — FEATURE_ACTIVATION_POLISH empty state for /sell.
 *
 * Shown above the listing form when the farmer has no active listings.
 * Gives context so the page doesn't feel blank, then points the farmer
 * straight down to the form with a "List produce" scroll-to-form CTA.
 *
 * Rules
 * ─────
 *   • No hooks except useCallback — rules-of-hooks safe.
 *   • Never throws.
 *   • No network, no blocking render.
 *   • Never forces a setup redirect (uses a soft scroll, not navigate).
 *
 * Props
 *   onListProduceClick — () → void   optional; called when CTA tapped
 *                        (parent can scroll to / focus the form)
 */

import { useCallback } from 'react';
import { WheatGlyph } from '../icons/InlineGlyphs.jsx';
import { tSafe } from '../../i18n/tSafe.js';

const S = {
  wrap: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px dashed rgba(255,255,255,0.15)',
    borderRadius: 14,
    padding: '20px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    alignItems: 'flex-start',
  },
  icon: { fontSize: 28, lineHeight: 1 },
  headline: {
    margin: 0,
    fontSize: 16,
    fontWeight: 800,
    color: '#fff',
  },
  body: {
    margin: 0,
    fontSize: 14,
    color: 'rgba(255,255,255,0.72)',
    lineHeight: 1.55,
  },
  btn: {
    marginTop: 4,
    appearance: 'none',
    border: 'none',
    background: '#C8944D',
    color: '#FFFFFF',
    fontWeight: 700,
    fontSize: 14,
    padding: '10px 18px',
    borderRadius: 10,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};

export default function SellEmptyPrompt({ onListProduceClick }) {
  // Unconditional hook — rules-of-hooks safe.
  const handleClick = useCallback(() => {
    if (typeof onListProduceClick === 'function') {
      try { onListProduceClick(); } catch { /* ignore */ }
    }
  }, [onListProduceClick]);

  return (
    <div style={S.wrap} data-testid="sell-empty-prompt">
      <span aria-hidden="true" style={S.icon}><WheatGlyph size={24} /></span>
      <h2 style={S.headline}>{tSafe('sell.empty.title', 'No produce listed yet.')}</h2>
      <p style={S.body}>
        {tSafe('sell.empty.body',
          'When your crop is ready, list it so buyers can find it.')}
      </p>
      <button
        type="button"
        style={S.btn}
        data-testid="sell-empty-prompt-cta"
        onClick={handleClick}
      >
        {tSafe('sell.empty.cta', 'List produce')}
      </button>
    </div>
  );
}
