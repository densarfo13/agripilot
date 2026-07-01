/**
 * Badge — a small status pill (Good / Watch / Needs attention / Unknown / Info).
 * Tone drives BOTH a color and a leading dot, so the status is never conveyed by
 * color alone (accessibility §no-color-only). Token-driven.
 *
 *   import { Badge } from 'src/design/components';
 *   <Badge tone="good">Good</Badge>
 */
import React from 'react';
import { COLORS } from '../tokens/colors.js';
import { RADIUS } from '../tokens/radius.js';

// Fully token-driven (no hardcoded hex). Meaning is carried by dot + color, never
// color alone. `attention` uses the canonical terracotta error token, not a stale
// light-theme crimson; info/neutral use light-on-dark surfaces that read on navy.
const TONES = {
  good:      { fg: COLORS.greenInk, bg: COLORS.greenSoft,   dot: '●' },
  watch:     { fg: COLORS.amberInk, bg: COLORS.amberSoft,   dot: '▲' },
  attention: { fg: COLORS.error,    bg: COLORS.errorSoft,   dot: '■' },
  info:      { fg: COLORS.ochreInk, bg: COLORS.ochreSurface, dot: '•' },
  neutral:   { fg: COLORS.inkDim,   bg: COLORS.panel,       dot: '○' },
};

export default function Badge({ tone = 'neutral', children, testId }) {
  const t = TONES[tone] || TONES.neutral;
  return (
    <span
      data-testid={testId}
      data-tone={tone}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '3px 10px', borderRadius: RADIUS.pill || 999,
        background: t.bg, color: t.fg, fontSize: 12, fontWeight: 700, lineHeight: 1.4,
      }}
    >
      <span aria-hidden="true" style={{ fontSize: 9 }}>{t.dot}</span>
      <span>{children}</span>
    </span>
  );
}
