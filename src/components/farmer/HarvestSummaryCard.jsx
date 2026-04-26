/**
 * HarvestSummaryCard — the "what happened this cycle" card on the
 * PostHarvestSummaryPage. Purely presentational.
 *
 * The server hands us:
 *   summary = {
 *     outcomeClass,
 *     wentWell:     [i18n keys],
 *     couldImprove: [i18n keys],
 *     metrics:      { completionRate, skippedTasksCount, issueCount,
 *                     qualityBand, yieldKg, durationDays,
 *                     timingDeltaDays, … }
 *   }
 *
 * We route every string through t() so the whole card re-renders
 * correctly when the user switches language.
 */
import { useAppSettings } from '../../context/AppSettingsContext.jsx';
import { tSafe } from '../../i18n/tSafe.js';

export default function HarvestSummaryCard({ summary }) {
  const { t } = useAppSettings();
  if (!summary) return null;
  const { wentWell = [], couldImprove = [], metrics = {} } = summary;

  const completionPct = Number.isFinite(metrics.completionRate)
    ? Math.round(metrics.completionRate * 100) : null;

  return (
    <section style={S.section} data-testid="harvest-summary-card">
      {wentWell.length > 0 && (
        <div>
          <h3 style={S.hGood}>{tSafe('postHarvest.whatWentWell', '')}</h3>
          <ul style={S.list}>
            {wentWell.map((k) => (
              <li key={k} style={S.item}>
                <span style={S.dotGood} /> {t(k)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {couldImprove.length > 0 && (
        <div>
          <h3 style={S.hImprove}>{tSafe('postHarvest.whatCouldImprove', '')}</h3>
          <ul style={S.list}>
            {couldImprove.map((k) => (
              <li key={k} style={S.item}>
                <span style={S.dotImprove} /> {t(k)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div style={S.metricsGrid}>
        {completionPct !== null && (
          <Metric label={tSafe('postHarvest.metrics.completion', '')} value={`${completionPct}%`} />
        )}
        {metrics.skippedTasksCount > 0 && (
          <Metric label={tSafe('postHarvest.metrics.skipped', '')} value={metrics.skippedTasksCount} />
        )}
        {metrics.issueCount > 0 && (
          <Metric label={tSafe('postHarvest.metrics.issues', '')} value={metrics.issueCount} />
        )}
        {metrics.qualityBand && (
          <Metric label={tSafe('postHarvest.metrics.quality', '')} value={t(`harvest.quality.${metrics.qualityBand}`) || metrics.qualityBand} />
        )}
        {Number.isFinite(metrics.yieldKg) && metrics.yieldKg > 0 && (
          <Metric label={tSafe('postHarvest.metrics.yield', '')} value={`${metrics.yieldKg} kg`} />
        )}
        {Number.isFinite(metrics.durationDays) && metrics.durationDays > 0 && (
          <Metric label={tSafe('postHarvest.metrics.duration', '')} value={`${metrics.durationDays} d`} />
        )}
        {Number.isFinite(metrics.timingDeltaDays) && Math.abs(metrics.timingDeltaDays) > 3 && (
          <Metric
            label={tSafe('postHarvest.metrics.timing', '')}
            value={metrics.timingDeltaDays > 0
              ? `+${metrics.timingDeltaDays} d`
              : `${metrics.timingDeltaDays} d`}
          />
        )}
      </div>
    </section>
  );
}

function Metric({ label, value }) {
  return (
    <div style={S.metric}>
      <div style={S.mVal}>{value}</div>
      <div style={S.mLabel}>{label}</div>
    </div>
  );
}

const S = {
  section: {
    padding: '1rem', borderRadius: '16px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    color: '#EAF2FF',
    display: 'flex', flexDirection: 'column', gap: '0.75rem',
  },
  hGood: { fontSize: '0.9375rem', fontWeight: 700, margin: '0 0 0.375rem', color: '#22C55E' },
  hImprove: { fontSize: '0.9375rem', fontWeight: 700, margin: '0 0 0.375rem', color: '#F59E0B' },
  list: { margin: 0, paddingLeft: 0, listStyle: 'none' },
  item: { display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', padding: '0.25rem 0', lineHeight: 1.4 },
  dotGood: { width: '7px', height: '7px', borderRadius: '50%', background: '#22C55E', flexShrink: 0 },
  dotImprove: { width: '7px', height: '7px', borderRadius: '50%', background: '#F59E0B', flexShrink: 0 },
  metricsGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))', gap: '0.5rem',
  },
  metric: { padding: '0.5rem', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', textAlign: 'center' },
  mVal: { fontSize: '1rem', fontWeight: 700 },
  mLabel: { fontSize: '0.6875rem', color: '#9FB3C8', textTransform: 'uppercase', letterSpacing: '0.04em' },
};
