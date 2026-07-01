/**
 * ProgressRing — a small circular progress indicator (0–100). Pure SVG, no deps.
 * Used for readiness / completion / confidence. Color is driven by a semantic
 * `tone` (good/watch/attention/neutral) so meaning is never carried by color
 * alone — always pair with a visible label.
 *
 *   import { ProgressRing } from 'src/design/components';
 *   <ProgressRing value={60} label="Fair" />
 */
import React from 'react';
import { COLORS } from '../tokens/colors.js';

// Fully token-driven (no hardcoded hex). `attention` uses the canonical error token
// (there is no `COLORS.danger` — the old fallback always fired with a stale crimson).
const TONES = {
  good:      COLORS.green,
  watch:     COLORS.amber,
  attention: COLORS.error,
  neutral:   COLORS.inkDim,
};

export default function ProgressRing({
  value = 0, size = 56, stroke = 6, tone = 'neutral', label, testId,
}) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const color = TONES[tone] || TONES.neutral;
  return (
    <span
      role="img"
      aria-label={label ? `${pct}% — ${label}` : `${pct}%`}
      data-testid={testId}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={COLORS.border} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${dash} ${circ - dash}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle"
          fontSize={size * 0.28} fontWeight="800" fill={color}>{pct}</text>
      </svg>
    </span>
  );
}
