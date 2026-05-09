/**
 * OnTrackRowCard — compact dark-glass row that replaces the
 * full done-state card with the mockup's calmer layout:
 *
 *   ┌────────────────────────────────────────────────┐
 *   │  ⬤ leaf  You're on track today ✓        ›     │
 *   │          Great job staying ahead.              │
 *   │          Check again tomorrow morning.         │
 *   └────────────────────────────────────────────────┘
 *
 * The whole row is tappable and opens /progress so the user
 * can see the broader streak / journey context. Visuals match
 * the FarmGardenProfileCard so the two row cards on Home
 * share the same surface language.
 *
 * Strict-rule audit
 *   * Pure presentational. Never throws.
 *   * No emoji as primary visual — inline SVG leaf glyph.
 *   * Inline styles only.
 *   * Localised via tSafe; English fallbacks ship inline.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { tSafe } from '../../i18n/tSafe.js';
import { PREMIUM_TOKENS as T } from '../premium/tokens.js';

function _leafIcon() {
  // Soft Ochre system — growth-green stroke since "on track" is
  // a health/success signal. Keep the muted #5E8E5E (token green)
  // rather than the prior neon-mint stroke.
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 21V11" stroke="#3F6A3F" strokeWidth="1.6" strokeLinecap="round"/>
      <path d="M12 13c-3-1-5-3-5-6 3 0 5 1.6 5.5 4" fill="rgba(94,142,94,0.18)"
            stroke="#5E8E5E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12 11c3-1 5-3 5-6-3 0-5 1.6-5.5 4" fill="rgba(94,142,94,0.30)"
            stroke="#5E8E5E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export default function OnTrackRowCard({
  testId = 'home-on-track-row',
  to = '/progress',
}) {
  const headline = tSafe('home.onTrackToday', 'You’re on track today ✓');
  const sub1 = tSafe('home.greatJob',          'Great job staying ahead.');
  const sub2 = tSafe('home.checkTomorrow',     'Check again tomorrow morning.');

  return (
    <Link to={to} style={S.card} data-testid={testId} aria-label={headline}>
      <span style={S.iconWrap} aria-hidden="true">{_leafIcon()}</span>

      <span style={S.textCol}>
        <span style={S.headline}>{headline}</span>
        <span style={S.body}>
          {sub1}
          <br />
          {sub2}
        </span>
      </span>

      <span aria-hidden="true" style={S.chev}>{'›'}</span>
    </Link>
  );
}

const S = {
  // Soft Ochre system: white-on-beige surface, growth-green only
  // for the leaf halo since "on track" is a health/success signal.
  card: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.85rem',
    padding: '0.95rem 1rem',
    background:    T.panelHi,
    border:        `1px solid ${T.border}`,
    borderRadius:  '16px',
    color:         T.ink,
    textDecoration:'none',
    boxShadow:     T.shadowCard,
  },
  iconWrap: {
    width: 44, height: 44,
    flexShrink: 0,
    borderRadius: '50%',
    background: 'radial-gradient(circle at 35% 35%, rgba(94,142,94,0.30) 0%, rgba(94,142,94,0.08) 70%)',
    border: `1px solid ${T.greenBorder}`,
    boxShadow: '0 0 0 4px rgba(94,142,94,0.06)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.15rem',
    minWidth: 0,
    flex: 1,
  },
  headline: {
    fontSize: '1rem',
    fontWeight: 800,
    letterSpacing: '-0.005em',
    color: T.ink,
  },
  body: {
    fontSize: '0.85rem',
    fontWeight: 500,
    color: T.inkDim,
    lineHeight: 1.4,
  },
  chev: {
    fontSize: '1.4rem',
    fontWeight: 700,
    color: T.inkFaint,
    lineHeight: 1,
    flexShrink: 0,
    paddingLeft: '0.4rem',
  },
};
