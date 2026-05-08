/**
 * PremiumSectionTitle — small uppercase eyebrow used at the top
 * of cards / sections. Matches the Home "Today's task" label.
 *
 *   <PremiumSectionTitle>Today’s task</PremiumSectionTitle>
 *
 * Stays a paragraph (not h2/h3) by default so it doesn't compete
 * with the page hero's H1. Pass `as="h2"` to opt into a
 * semantically heavier heading.
 */

import React from 'react';
// Wire-up audit (May 2026) — see tokens.js header.
import { PREMIUM_TOKENS as T } from './tokens.js';

export default function PremiumSectionTitle({
  children,
  as = 'p',
  className = '',
  style = null,
}) {
  const Tag = as;
  const merged = { ...S.title, ...(style || {}) };
  return (
    <Tag className={`premium-section-title${className ? ' ' + className : ''}`} style={merged}>
      {children}
    </Tag>
  );
}

const S = {
  title: {
    margin:        0,
    fontSize:      '0.6875rem',
    fontWeight:    800,
    letterSpacing: '0.10em',
    textTransform: 'uppercase',
    color:         T.inkFaint,
  },
};
