/**
 * ProgressSummaryCard — intentionally placed LOWER on the screen so
 * the farmer sees the next action before stats.
 *
 * Per the action-first spec the progress section stays *light*: a
 * single-bar progress indicator + a one-word status label
 * (On track / Slight delay / Needs attention). The compact
 * "tasks done / cycles active" grid is preserved behind the bar so
 * the farmer can still scan numbers if they want, but it doesn't
 * dominate.
 */
import { useAppSettings } from '../../context/AppSettingsContext.jsx';

const STATUS_KEY = {
  on_track:          'actionHome.progress.status.onTrack',
  slight_delay:      'actionHome.progress.status.slightDelay',
  needs_attention:   'actionHome.progress.status.needsAttention',
};
const STATUS_COLOR = {
  on_track:        '#22C55E',
  slight_delay:    '#F59E0B',
  needs_attention: '#EF4444',
};

function deriveStatus({ percent = 0, overdueCount = 0, riskLevel = 'low' } = {}) {
  if (riskLevel === 'high' || overdueCount >= 3) return 'needs_attention';
  if (overdueCount >= 1 || (percent < 50 && percent > 0)) return 'slight_delay';
  return 'on_track';
}

export default function ProgressSummaryCard({
  tasksDone = 0,
  cyclesActive = 0,
  percent = null,
  status = null,
  overdueCount = 0,
  riskLevel = 'low',
}) {
  const { t } = useAppSettings();
  const effectiveStatus = status || deriveStatus({ percent, overdueCount, riskLevel });
  const barPercent = Number.isFinite(percent) ? Math.max(0, Math.min(100, Math.round(percent))) : null;
  const statusColor = STATUS_COLOR[effectiveStatus] || STATUS_COLOR.on_track;

  return (
    <section style={S.section} data-testid="progress-summary-card">
      <div style={S.head}>
        <h3 style={S.title}>{t('actionHome.progress.title')}</h3>
        <span
          style={{ ...S.statusPill, color: statusColor, borderColor: statusColor }}
          data-testid="progress-status"
        >
          {t(STATUS_KEY[effectiveStatus])}
        </span>
      </div>

      {barPercent !== null && (
        <div style={S.barTrack} aria-label={t('actionHome.progress.title')} data-testid="progress-bar">
          <div style={{ ...S.barFill, width: `${barPercent}%`, background: statusColor }} />
          <span style={S.barPct}>{barPercent}%</span>
        </div>
      )}

      <div style={S.grid}>
        <Stat label={t('actionHome.progress.tasksDone')}    value={tasksDone} />
        <Stat label={t('actionHome.progress.cyclesActive')} value={cyclesActive} />
      </div>
    </section>
  );
}

function Stat({ label, value }) {
  return (
    <div style={S.stat}>
      <div style={S.statValue}>{value}</div>
      <div style={S.statLabel}>{label}</div>
    </div>
  );
}

export const _internal = { deriveStatus, STATUS_KEY, STATUS_COLOR };

const S = {
  section: {
    padding: '1rem', borderRadius: '16px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    color: '#EAF2FF',
  },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' },
  title: { fontSize: '0.9375rem', fontWeight: 700, margin: 0 },
  statusPill: {
    padding: '0.125rem 0.5rem',
    borderRadius: '999px',
    border: '1px solid',
    fontSize: '0.6875rem',
    fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.04em',
  },
  barTrack: {
    position: 'relative',
    width: '100%', height: '8px',
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
    marginBottom: '0.625rem',
  },
  barFill: { height: '100%', transition: 'width 0.3s ease, background 0.2s' },
  barPct: {
    position: 'absolute', right: '0.5rem', top: '-1.125rem',
    fontSize: '0.6875rem', color: '#9FB3C8', fontWeight: 600,
  },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' },
  stat: { padding: '0.625rem', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', textAlign: 'center' },
  statValue: { fontSize: '1.125rem', fontWeight: 700 },
  statLabel: { fontSize: '0.6875rem', color: '#9FB3C8', textTransform: 'uppercase', letterSpacing: '0.04em' },
};
