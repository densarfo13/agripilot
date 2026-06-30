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

const TONES = {
  good:      { fg: COLORS.greenInk || '#1f6a3a', bg: COLORS.greenSoft || 'rgba(110,139,97,0.12)', dot: '●' },
  watch:     { fg: COLORS.amberInk || '#92400E', bg: COLORS.amberSoft || 'rgba(214,161,61,0.14)', dot: '▲' },
  attention: { fg: '#991B1B', bg: 'rgba(153,27,27,0.10)', dot: '■' },
  info:      { fg: COLORS.ink || '#1F2A1A', bg: 'rgba(0,0,0,0.05)', dot: '•' },
  neutral:   { fg: COLORS.inkDim || '#6B7766', bg: 'rgba(0,0,0,0.04)', dot: '○' },
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
