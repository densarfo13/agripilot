/**
 * ChooseCropCard — calm "no crop selected" prompt on Home (Farm mode).
 *
 *   <ChooseCropCard farm={farm} />
 *
 * Self-suppresses when:
 *   • A crop is already selected on the active farm.
 *   • Garden mode (handled by the caller — pass `mode` if you want
 *     the card to skip itself automatically).
 *
 * Visual: compact horizontal row with an ochre seedling glyph,
 * one-line title, one-line explanation, and a "Set crop" CTA that
 * deep-links into the existing /my-farm flow where crop selection
 * happens. The card is intentionally short so it does NOT push the
 * weather hero / land health / today's task surfaces below the
 * fold on mobile.
 *
 * Strict-rule audit
 *   • Pure presentational. SSR-safe. Never throws.
 *   • Uses Soft Ochre / olive tokens (no inline hex). Lucide-style
 *     inline SVG — no emoji.
 *   • Reads crop fields defensively from multiple legacy aliases so
 *     existing farms with `cropName` or `cropType` aren't flagged.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { tSafe } from '../../i18n/tSafe.js';
import { PREMIUM_TOKENS as T } from '../premium/tokens.js';

function _hasCrop(farm) {
  if (!farm || typeof farm !== 'object') return false;
  const candidates = [farm.crop, farm.cropName, farm.cropType, farm.mainCrop];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return true;
  }
  return false;
}

function _SeedlingIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 21V12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      <path d="M12 12c-3 0-5-2-5-5 3 0 5 2 5 5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none"/>
      <path d="M12 14c3 0 5-2 5-5-3 0-5 2-5 5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none"/>
      <path d="M8 21h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

export default function ChooseCropCard({
  farm = null,
  mode = 'farm',
  to = '/my-farm',
  testId = 'choose-crop-card',
}) {
  // Self-suppress in Garden mode — plant-level crop choice happens
  // inside the My Grow flow, not via a "main crop" decision.
  if (String(mode || '').toLowerCase() === 'garden') return null;
  // Self-suppress when a crop is already on file.
  if (_hasCrop(farm)) return null;

  return (
    <Link
      to={to}
      style={S.card}
      data-testid={testId}
      aria-label={tSafe('home.chooseCrop.ariaLabel', 'Choose your main crop')}
    >
      <span style={S.iconWrap} aria-hidden="true"><_SeedlingIcon /></span>
      <span style={S.textCol}>
        <span style={S.title}>
          {tSafe('home.chooseCrop.title', 'Choose your main crop')}
        </span>
        <span style={S.subtitle}>
          {tSafe(
            'home.chooseCrop.body',
            'Tasks and advice improve after crop selection.',
          )}
        </span>
      </span>
      <span style={S.cta}>
        <span>{tSafe('home.chooseCrop.cta', 'Set crop')}</span>
        <span aria-hidden="true" style={S.chev}>{'›'}</span>
      </span>
    </Link>
  );
}

const S = {
  card: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.7rem',
    padding: '0.7rem 0.85rem',
    background: T.panelHi,
    border: `1px solid ${T.ochreBorder}`,
    borderRadius: 14,
    color: T.ink,
    textDecoration: 'none',
    boxShadow: T.shadowCard,
  },
  iconWrap: {
    width: 38,
    height: 38,
    flexShrink: 0,
    borderRadius: 10,
    background: T.ochreSoft,
    border: `1px solid ${T.ochreBorder}`,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: T.ochreInk,
  },
  textCol: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    flex: 1,
  },
  title: {
    fontSize: '0.92rem',
    fontWeight: 800,
    letterSpacing: '-0.005em',
    color: T.ink,
  },
  subtitle: {
    marginTop: 2,
    fontSize: '0.78rem',
    fontWeight: 600,
    color: T.inkDim,
    lineHeight: 1.35,
  },
  cta: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.3rem',
    flexShrink: 0,
    paddingLeft: '0.4rem',
    fontSize: '0.82rem',
    fontWeight: 800,
    color: T.ochreInk,
  },
  chev: {
    fontSize: '1.05rem',
    fontWeight: 700,
    lineHeight: 1,
  },
};
