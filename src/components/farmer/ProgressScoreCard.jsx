/**
 * ProgressScoreCard — investor-grade score display.
 *
 * Reads inputs from props (the parent page is responsible for
 * fetching the underlying signals). Renders:
 *   • headline number (0..100)
 *   • label chip (Low / Medium / High / Excellent)
 *   • per-driver breakdown with weight % and points contributed
 *   • a "data incomplete" badge when any input fell back to 0
 *
 * Pure presentational — no API calls, no localStorage, no
 * side-effects on render.
 */

import { computeProgressScore } from '../../lib/farmer/progressScore.js';
import { useTranslation } from '../../i18n/index.js';
import { tSafe } from '../../i18n/tSafe.js';

const LABEL_COLORS = Object.freeze({
  Low:       { bg: 'rgba(239,68,68,0.15)',  fg: '#FCA5A5' },
  Medium:    { bg: 'rgba(245,158,11,0.15)', fg: '#FDE68A' },
  High:      { bg: 'rgba(34,197,94,0.15)',  fg: '#86EFAC' },
  Excellent: { bg: 'rgba(34,197,94,0.25)',  fg: '#22C55E' },
});

const REASON_LABEL_FALLBACK = {
  'progressScore.reason.taskCompletion':    'Task completion',
  'progressScore.reason.cropHealth':        'Crop health',
  'progressScore.reason.consistency':       'Consistency',
  'progressScore.reason.weatherAdaptation': 'Weather adaptation',
};

export default function ProgressScoreCard({
  taskCompletionRate    = null,
  cropHealthScore       = null,
  consistencyScore      = null,
  weatherAdaptationScore = null,
  compact = false,
}) {
  const { t } = useTranslation();
  const result = computeProgressScore({
    taskCompletionRate,
    cropHealthScore,
    consistencyScore,
    weatherAdaptationScore,
  });

  const colour = LABEL_COLORS[result.label] || LABEL_COLORS.Medium;
  const incomplete = result.dataMissing.length > 0;

  return (
    <section style={S.card} data-testid="progress-score-card">
      <header style={S.headerRow}>
        <div style={S.titleBlock}>
          <h3 style={S.title}>
            {tSafe(t, 'progressScore.title', 'Farm progress')}
          </h3>
          <span style={{ ...S.labelChip, background: colour.bg, color: colour.fg }}>
            {tSafe(t, `progressScore.label.${result.label.toLowerCase()}`, result.label)}
          </span>
        </div>
        <div style={S.scoreBlock}>
          <span style={S.scoreNumber}>{result.score}</span>
          <span style={S.scoreOutOf}>/ 100</span>
        </div>
      </header>

      {incomplete && (
        <p style={S.incomplete}>
          {tSafe(t, 'progressScore.incomplete',
            'Some inputs are still missing — the score will improve as data fills in.')}
        </p>
      )}

      {!compact && (
        <ul style={S.reasonList}>
          {result.reasons.map((r) => (
            <li key={r.key} style={S.reasonRow}>
              <div style={S.reasonHead}>
                <span style={S.reasonLabel}>
                  {tSafe(t, r.key, REASON_LABEL_FALLBACK[r.key] || r.key)}
                </span>
                <span style={S.reasonWeight}>{r.weightPct}%</span>
              </div>
              <div style={S.reasonMeta}>
                <span style={S.reasonContribution}>
                  {tSafe(t, 'progressScore.points', 'pts')}: <strong>{r.contributionPts}</strong>
                </span>
                <span style={S.reasonDetail}>{r.detail}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const S = {
  card: {
    background: '#111D2E',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: '1rem 1.125rem',
    color: '#E2E8F0',
    display: 'flex', flexDirection: 'column', gap: '0.625rem',
  },
  headerRow: {
    display: 'flex', alignItems: 'flex-start',
    justifyContent: 'space-between', gap: '1rem',
  },
  titleBlock: { display: 'flex', flexDirection: 'column', gap: '0.375rem' },
  title:     { margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: '#F8FAFC' },
  labelChip: {
    alignSelf: 'flex-start',
    fontSize: '0.6875rem', fontWeight: 700,
    padding: '0.2rem 0.625rem', borderRadius: 999,
    textTransform: 'uppercase', letterSpacing: '0.04em',
  },
  scoreBlock: { display: 'flex', alignItems: 'baseline', gap: '0.25rem' },
  scoreNumber: { fontSize: '2.25rem', fontWeight: 800, color: '#F8FAFC', lineHeight: 1 },
  scoreOutOf:  { fontSize: '0.875rem', color: 'rgba(255,255,255,0.55)' },
  incomplete: {
    margin: 0,
    fontSize: '0.75rem',
    color: '#FDE68A',
    background: 'rgba(245,158,11,0.08)',
    border: '1px solid rgba(245,158,11,0.25)',
    padding: '0.4rem 0.625rem',
    borderRadius: 10,
  },
  reasonList: { listStyle: 'none', padding: 0, margin: 0,
                display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  reasonRow: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 12, padding: '0.625rem 0.75rem',
    display: 'flex', flexDirection: 'column', gap: '0.25rem',
  },
  reasonHead: { display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', gap: '0.5rem' },
  reasonLabel: { fontSize: '0.875rem', fontWeight: 600, color: '#F8FAFC' },
  reasonWeight: { fontSize: '0.75rem', color: 'rgba(255,255,255,0.55)' },
  reasonMeta: { display: 'flex', alignItems: 'baseline',
                gap: '0.5rem', flexWrap: 'wrap' },
  reasonContribution: { fontSize: '0.75rem', color: 'rgba(255,255,255,0.65)' },
  reasonDetail: { fontSize: '0.75rem', color: 'rgba(255,255,255,0.55)',
                  flex: 1, minWidth: 0 },
};
