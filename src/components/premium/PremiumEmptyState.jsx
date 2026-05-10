/**
 * PremiumEmptyState — calm dark-glass empty state used by every
 * page when there is no data yet. Mirrors the spec's "premium
 * empty states" rule (§15): realistic visual + calm wording, no
 * stock-illustration placeholders.
 *
 *   <PremiumEmptyState
 *     icon={<LeafIcon />}
 *     title="No recent scans yet."
 *     subtitle="Your scans will appear here once you take a photo."
 *     action={<button onClick={…}>Open scan</button>}
 *   />
 *
 * Props
 *   icon     — optional inline SVG element rendered above title.
 *              When omitted, a calm leaf glyph is used.
 *   title    — required headline.
 *   subtitle — optional body line.
 *   action   — optional trailing element (typically a button).
 *
 * Strict-rule audit
 *   * Pure presentational. Never throws.
 *   * No emoji as primary visual — calls render an SVG icon.
 *   * Inline styles only.
 */

import React from 'react';
import PremiumCard from './PremiumCard.jsx';
// Wire-up audit (May 2026) — see tokens.js header.
import { PREMIUM_TOKENS as T } from './tokens.js';

function _defaultLeafIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path
        d="M24 6c-8 8-8 18 0 30 8-12 8-22 0-30z"
        fill="rgba(200,148,77,0.18)"
        stroke="rgba(134,239,172,0.85)"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M24 8v28"
        stroke="rgba(200,148,77,0.55)"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function PremiumEmptyState({
  icon = null,
  title,
  subtitle = null,
  action = null,
  testId = 'premium-empty-state',
  className = '',
}) {
  return (
    <PremiumCard
      tone="default"
      testId={testId}
      className={`premium-empty-state${className ? ' ' + className : ''}`}
      style={S.card}
    >
      <div style={S.iconWrap} aria-hidden="true">
        {icon || _defaultLeafIcon()}
      </div>
      <h2 style={S.title}>{title}</h2>
      {subtitle && <p style={S.subtitle}>{subtitle}</p>}
      {action && <div style={S.actionRow}>{action}</div>}
    </PremiumCard>
  );
}

const S = {
  card: {
    alignItems: 'center',
    textAlign:  'center',
    gap:        '0.65rem',
    padding:    '1.6rem 1.2rem',
  },
  iconWrap: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 60, height: 60,
    borderRadius: 16,
    background: T.greenSoft,
    border: `1px solid ${T.greenBorder}`,
  },
  title: {
    margin: 0,
    fontSize: '1.05rem',
    fontWeight: 800,
    letterSpacing: '-0.005em',
    color: T.ink,
  },
  subtitle: {
    margin: 0,
    fontSize: '0.875rem',
    fontWeight: 500,
    color: T.inkDim,
    lineHeight: 1.45,
    maxWidth: 320,
  },
  actionRow: {
    marginTop: '0.4rem',
  },
};
