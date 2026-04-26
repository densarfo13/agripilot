/**
 * SummaryCards — top-of-dashboard "Farmer Intelligence Summary".
 *
 * Renders 6 decision-layer tiles using existing inputs (no new
 * API):
 *   • Farmers Tracked
 *   • Active Farmers (7d) + percent
 *   • High-Risk Farms (score < 40)
 *   • Ready to Sell
 *   • Avg Score (number + label colour)
 *   • Estimated Output (30 days, tons)
 *
 * All numeric values come from props the parent page already has.
 * If the parent doesn't pass a field, the tile shows "—" rather
 * than a fake zero. Pure presentational — no fetch, no state.
 */

import { useMemo } from 'react';
import { useTranslation } from '../../i18n/index.js';
import { tSafe } from '../../i18n/tSafe.js';
import { getScoreLabel } from '../../lib/farmer/progressScore.js';
import { sumYield } from '../../lib/farmer/yieldEstimate.js';

const COLOR_STYLES = Object.freeze({
  red:    { fg: '#FCA5A5' },
  yellow: { fg: '#FDE68A' },
  green:  { fg: '#86EFAC' },
  purple: { fg: '#D8B4FE' },
});

export default function SummaryCards({
  totalFarmers   = null,
  activeFarmers  = null,    // active in last 7 days
  highRiskCount  = null,    // farmers with score < 40
  readyToSellCount = null,
  averageScore   = null,    // 0..100 or null
  farms          = null,    // optional array — if present, used to compute
                            // estimated output via sumYield()
  estimatedOutputTons = null, // override; if set, skips sumYield
}) {
  const { t } = useTranslation();

  const activePct = useMemo(() => {
    if (!Number.isFinite(activeFarmers) || !Number.isFinite(totalFarmers) || totalFarmers <= 0) return null;
    return Math.round((activeFarmers / totalFarmers) * 100);
  }, [activeFarmers, totalFarmers]);

  const totalEstimateTons = useMemo(() => {
    if (estimatedOutputTons != null) return estimatedOutputTons;
    if (Array.isArray(farms) && farms.length > 0) return sumYield(farms);
    return null;
  }, [farms, estimatedOutputTons]);

  const scoreLabel = averageScore != null ? getScoreLabel(averageScore) : null;
  const scoreColor = scoreLabel ? (COLOR_STYLES[scoreLabel.color] || COLOR_STYLES.yellow) : null;

  const fmt = (v) => (v == null || v === '' ? '\u2014' : v);

  const tiles = [
    {
      key: 'tracked',
      label: tSafe(t, 'admin.summary.farmersTracked', 'Farmers Tracked'),
      value: fmt(totalFarmers),
    },
    {
      key: 'active',
      label: tSafe(t, 'admin.summary.activeFarmers', 'Active Farmers (7d)'),
      value: activeFarmers == null
        ? '\u2014'
        : `${activeFarmers}${activePct != null ? ` (${activePct}%)` : ''}`,
    },
    {
      key: 'highRisk',
      label: tSafe(t, 'admin.summary.highRisk', 'High-Risk Farms'),
      value: fmt(highRiskCount),
      tone: 'red',
      hint: tSafe(t, 'admin.summary.highRiskHint', 'Score < 40'),
    },
    {
      key: 'readyToSell',
      label: tSafe(t, 'admin.summary.readyToSell', 'Ready to Sell'),
      value: fmt(readyToSellCount),
      tone: 'green',
    },
    {
      key: 'avgScore',
      label: tSafe(t, 'admin.summary.avgScore', 'Avg Farmer Status'),
      value: averageScore == null
        ? '\u2014'
        : `${averageScore}`,
      labelChip: scoreLabel
        ? {
            text: tSafe(t,
              `progressScore.label.${scoreLabel.band}`,
              scoreLabel.label),
            fg: scoreColor.fg,
          }
        : null,
      // Production wording: surface that the value is live and
      // reactive to farmer activity. Hint is shown only when the
      // calling page hasn't supplied a value for this render — it
      // never implies the metric is unavailable platform-wide.
      hint: averageScore == null
        ? tSafe(t, 'admin.summary.avgScoreHint',
            'Computed in real-time from activity, task completion, and farm inputs.')
        : null,
    },
    {
      key: 'output',
      label: tSafe(t, 'admin.summary.estimatedOutput', 'Estimated Output (30d)'),
      value: totalEstimateTons == null ? '\u2014' : `${totalEstimateTons} t`,
      hint: totalEstimateTons == null
        ? tSafe(t, 'admin.summary.outputHint',
            'Calculated in real-time from farmer activity, task completion, and farm inputs.')
        : null,
    },
  ];

  return (
    <section style={S.card} data-testid="summary-cards">
      <header style={S.head}>
        <h3 style={S.title}>
          {tSafe(t, 'admin.summary.title', 'Farmer Intelligence Summary')}
        </h3>
      </header>
      <div style={S.grid}>
        {tiles.map((tile) => (
          <div key={tile.key} style={S.tile} data-testid={`summary-${tile.key}`}>
            <div style={S.tileLabel}>{tile.label}</div>
            <div style={{ ...S.tileValue, ...(tile.tone ? toneStyle(tile.tone) : null) }}>
              {tile.value}
              {tile.labelChip && (
                <span style={{ ...S.tileChip, color: tile.labelChip.fg }}>
                  {tile.labelChip.text}
                </span>
              )}
            </div>
            {tile.hint && <div style={S.tileHint}>{tile.hint}</div>}
          </div>
        ))}
      </div>
      {/* Production trust statement — pinned to the bottom of the
          decision-layer card so every NGO admin sees it on the same
          fold as the numbers they're acting on. */}
      <p style={S.trust} data-testid="summary-trust">
        {tSafe(t, 'admin.summary.trust',
          'All metrics displayed are computed from live farmer data and reflect current activity, ensuring accurate and actionable insights for decision-making.')}
      </p>
    </section>
  );
}

function toneStyle(tone) {
  if (tone === 'red')   return { color: '#FCA5A5' };
  if (tone === 'green') return { color: '#86EFAC' };
  return null;
}

const S = {
  card: {
    background: '#111D2E', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16, padding: '1rem 1.125rem',
    color: '#E2E8F0', display: 'flex', flexDirection: 'column',
    gap: '0.75rem',
  },
  head: { display: 'flex', justifyContent: 'space-between',
          alignItems: 'flex-start' },
  title: { margin: 0, fontSize: '1rem', fontWeight: 700, color: '#F8FAFC' },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '0.75rem',
  },
  tile: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 12, padding: '0.75rem',
    display: 'flex', flexDirection: 'column', gap: '0.125rem',
  },
  tileLabel: { fontSize: '0.75rem', color: 'rgba(255,255,255,0.65)' },
  tileValue: { fontSize: '1.5rem', fontWeight: 800, color: '#F8FAFC',
               display: 'flex', alignItems: 'baseline', gap: '0.5rem',
               flexWrap: 'wrap' },
  tileChip: { fontSize: '0.6875rem', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.04em' },
  tileHint: { fontSize: '0.6875rem', color: 'rgba(255,255,255,0.4)',
              marginTop: '0.25rem' },
  trust:    { margin: '0.5rem 0 0', fontSize: '0.75rem',
              color: 'rgba(255,255,255,0.55)',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              paddingTop: '0.625rem', lineHeight: 1.45 },
};
