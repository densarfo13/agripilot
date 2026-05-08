/**
 * PremiumStatChip — single-stat pill used on stat rows / hero
 * banners across pages.
 *
 *   <PremiumStatChip label="Stage" value="Flowering" tone="green" />
 *   <PremiumStatChip label="Tasks left" value="3" tone="amber" />
 *
 * Props
 *   label  — short uppercase label.
 *   value  — primary value text (string or number).
 *   tone   — 'green' | 'amber' | 'neutral'. Drives accent color.
 *
 * Strict-rule audit
 *   * Pure presentational.
 *   * Never throws — coerces value via String().
 */

import React from 'react';
import { PREMIUM_TOKENS as T } from './index.js';

const TONES = {
  green:   { ink: T.greenInk, soft: T.greenSoft, border: T.greenBorder },
  amber:   { ink: T.amberInk, soft: T.amberSoft, border: T.amberBorder },
  neutral: { ink: T.inkDim,   soft: T.panelHi,   border: T.borderHi },
};

export default function PremiumStatChip({
  label,
  value,
  tone = 'neutral',
  testId = null,
}) {
  const t = TONES[tone] || TONES.neutral;
  return (
    <span
      data-testid={testId || undefined}
      style={{
        display:      'inline-flex',
        flexDirection:'column',
        gap:          2,
        padding:      '0.5rem 0.75rem',
        borderRadius: 12,
        background:   t.soft,
        border:       `1px solid ${t.border}`,
        minWidth:     0,
      }}
    >
      <span
        style={{
          fontSize:      '0.62rem',
          fontWeight:    700,
          letterSpacing: '0.10em',
          textTransform: 'uppercase',
          color:         T.inkFaint,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize:   '0.95rem',
          fontWeight: 800,
          color:      t.ink,
        }}
      >
        {String(value)}
      </span>
    </span>
  );
}
