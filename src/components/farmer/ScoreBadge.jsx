/**
 * ScoreBadge — modular score display per the NGO decision-layer
 * spec. Thin wrapper around the shipped `getScoreLabel` mapper +
 * the existing `ProgressScoreChip` so we have a single place that
 * stamps "Farmer Status" wording onto a score.
 *
 *   <ScoreBadge score={72} reasons={[…]} />
 *
 * Two ways to use it
 *   • Pass `score` directly when the caller already has a number
 *     (e.g. dashboard list reading farmerScore from the API).
 *   • Pass the four computed-progress signals (taskCompletionRate
 *     etc.) and let the badge call `computeProgressScore` internally.
 *     This keeps the per-row math out of the page component.
 *
 * Reasons for the tooltip
 *   When `reasons` is provided (each `{ key|label, detail, band }`),
 *   the tooltip surfaces them line-by-line. When the caller passes
 *   the raw signals instead, the underlying computeProgressScore
 *   builds the reasons automatically.
 */

import { computeProgressScore, getScoreLabel } from '../../lib/farmer/progressScore.js';

const COLOR_STYLES = Object.freeze({
  red:    { bg: 'rgba(239,68,68,0.15)',  fg: '#FCA5A5', border: 'rgba(239,68,68,0.35)' },
  yellow: { bg: 'rgba(245,158,11,0.15)', fg: '#FDE68A', border: 'rgba(245,158,11,0.35)' },
  green:  { bg: 'rgba(34,197,94,0.15)',  fg: '#86EFAC', border: 'rgba(34,197,94,0.35)' },
  purple: { bg: 'rgba(168,85,247,0.20)', fg: '#D8B4FE', border: 'rgba(168,85,247,0.45)' },
});

export default function ScoreBadge({
  score = null,
  reasons = null,
  taskCompletionRate     = null,
  cropHealthScore        = null,
  consistencyScore       = null,
  weatherAdaptationScore = null,
  showLabel = true,
  size = 'md', // 'sm' | 'md'
}) {
  // Decide which path: explicit score or compute from signals.
  let resolvedScore = score;
  let resolvedReasons = reasons;
  if (resolvedScore == null) {
    const computed = computeProgressScore({
      taskCompletionRate,
      cropHealthScore,
      consistencyScore,
      weatherAdaptationScore,
    });
    resolvedScore = computed.score;
    resolvedReasons = resolvedReasons || computed.reasons;
  }

  const meta = getScoreLabel(resolvedScore);
  const c = COLOR_STYLES[meta.color] || COLOR_STYLES.yellow;

  const tooltipLines = [];
  tooltipLines.push(`Farmer Status: ${meta.label} (${meta.score}/100)`);
  if (Array.isArray(resolvedReasons) && resolvedReasons.length > 0) {
    for (const r of resolvedReasons) {
      const head = r.weightPct ? `${r.weightPct}% ` : '';
      const body = r.detail || r.label || r.key || '';
      tooltipLines.push(`${head}${r.band || ''}: ${body}`.trim());
    }
  }

  const sizeStyle = size === 'sm' ? S.chipSm : S.chip;
  return (
    <span
      style={{ ...sizeStyle, background: c.bg, color: c.fg, borderColor: c.border }}
      title={tooltipLines.join('\n')}
      data-testid="score-badge"
      data-band={meta.band}
    >
      <strong style={S.score}>{meta.score}</strong>
      {showLabel && <span style={S.label}>{meta.label}</span>}
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
  chipSm: {
    display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
    padding: '0.125rem 0.5rem', borderRadius: 999,
    border: '1px solid', fontSize: '0.6875rem', whiteSpace: 'nowrap',
    cursor: 'help',
  },
  score: { fontWeight: 800, lineHeight: 1, fontSize: '0.8125rem' },
  label: { fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em',
           fontSize: '0.625rem' },
};
