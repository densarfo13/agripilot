/**
 * PremiumCard — dark glass surface with the layered gradient,
 * inset highlight, and two-tier shadow used by Home. The unit of
 * composition for every secondary card on every page.
 *
 *   <PremiumCard>
 *     <PremiumSectionTitle>Today’s task</PremiumSectionTitle>
 *     …content…
 *   </PremiumCard>
 *
 * Props
 *   tone     — 'default' | 'success' | 'warning'. Subtle border
 *              + background shift so the same component renders
 *              calm / on-track / heads-up states.
 *   padding  — '0.75rem' | '1rem' | '1.3rem' (default '1.15rem 1.1rem').
 *   testId   — data-testid forwarded to the wrapper.
 *   as       — render-element override (e.g. 'a', 'button',
 *              'section'). Defaults to 'section'.
 *   ...rest  — forwarded to the underlying element so callers
 *              can wire onClick / role / aria attributes.
 *
 * Strict-rule audit
 *   * Pure presentational. Never throws.
 *   * Inline styles only.
 *   * No data dependency — never re-renders on store updates.
 */

import React from 'react';
// Wire-up audit (May 2026) — see tokens.js header.
import { PREMIUM_TOKENS as T } from './tokens.js';

const TONES = {
  default: {
    bg: 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.025) 100%)',
    border: T.border,
  },
  success: {
    bg: 'linear-gradient(180deg, rgba(200,148,77,0.085) 0%, rgba(200,148,77,0.04) 100%)',
    border: T.greenBorder,
  },
  warning: {
    bg: 'linear-gradient(180deg, rgba(245,158,11,0.085) 0%, rgba(245,158,11,0.04) 100%)',
    border: T.amberBorder,
  },
};

export default function PremiumCard({
  tone = 'default',
  padding = '1.15rem 1.1rem',
  testId = null,
  as = 'section',
  className = '',
  style = null,
  children,
  ...rest
}) {
  const t = TONES[tone] || TONES.default;
  const cardStyle = {
    background:    t.bg,
    border:        `1px solid ${t.border}`,
    borderRadius:  T.radiusCard,
    padding,
    display:       'flex',
    flexDirection: 'column',
    gap:           '0.55rem',
    boxShadow:     T.shadowCard,
    ...(style || {}),
  };
  const Tag = as;
  const wrapClass = `premium-card${className ? ' ' + className : ''}`;
  return (
    <Tag
      className={wrapClass}
      style={cardStyle}
      data-testid={testId || undefined}
      data-tone={tone}
      {...rest}
    >
      {children}
    </Tag>
  );
}
