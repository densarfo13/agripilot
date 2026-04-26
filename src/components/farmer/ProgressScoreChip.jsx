/**
 * ProgressScoreChip — compact one-line badge for tables / lists.
 *
 * Use when full ProgressScoreCard would be too heavy (farmer list
 * row, ready-to-sell row, card subtitle). Renders the number + a
 * colour-coded label band, with the per-driver reasons surfaced in
 * the native browser tooltip via `title=` so screen readers + mouse
 * users both get the explanation without a popover library.
 *
 *   <ProgressScoreChip
 *     taskCompletionRate={0.6}
 *     cropHealthScore={0.4}
 *     consistencyScore={0.7}
 *     weatherAdaptationScore={0.3}
 *   />
 *
 * Pure presentational — no API calls, no localStorage.
 */

import { computeProgressScore } from '../../lib/farmer/progressScore.js';

const LABEL_COLORS = Object.freeze({
  'High Risk': { bg: 'rgba(239,68,68,0.15)',  fg: '#FCA5A5', border: 'rgba(239,68,68,0.35)' },
  Medium:      { bg: 'rgba(245,158,11,0.15)', fg: '#FDE68A', border: 'rgba(245,158,11,0.35)' },
  Good:        { bg: 'rgba(34,197,94,0.15)',  fg: '#86EFAC', border: 'rgba(34,197,94,0.35)' },
  Excellent:   { bg: 'rgba(34,197,94,0.25)',  fg: '#22C55E', border: 'rgba(34,197,94,0.55)' },
});

export default function ProgressScoreChip({
  taskCompletionRate     = null,
  cropHealthScore        = null,
  consistencyScore       = null,
  weatherAdaptationScore = null,
  showLabel = true,
}) {
  const result = computeProgressScore({
    taskCompletionRate,
    cropHealthScore,
    consistencyScore,
    weatherAdaptationScore,
  });
  const c = LABEL_COLORS[result.label] || LABEL_COLORS.Medium;

  // Tooltip text — short summary of which drivers are weak / strong.
  // Browser-native tooltip; no popover library needed.
  const tooltip = result.reasons
    .map((r) => `${r.weightPct}% ${r.band}: ${r.detail}`)
    .join('\n');

  return (
    <span
      style={{ ...S.chip, background: c.bg, color: c.fg, borderColor: c.border }}
      title={tooltip}
      data-testid="progress-score-chip"
    >
      <strong style={S.score}>{result.score}</strong>
      {showLabel && <span style={S.label}>{result.label}</span>}
    </span>
  );
}

const S = {
  chip: {
    display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
    padding: '0.2rem 0.625rem', borderRadius: 999,
    border: '1px solid', fontSize: '0.75rem', whiteSpace: 'nowrap',
    cursor: 'help',
  },
  score: { fontWeight: 800, lineHeight: 1, fontSize: '0.8125rem' },
  label: { fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em',
           fontSize: '0.625rem' },
};
