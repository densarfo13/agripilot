/**
 * ProgressSummaryCard — intentionally placed LOWER on the screen so
 * the farmer sees the next action before stats.
 *
 * Core Product Signal §7 (May 2026)
 * ─────────────────────────────────
 * Progress is reinforcement only. The legacy three-tier status
 * (On track / Slight delay / Needs attention) used to flip to
 * red/amber under the same conditions that made Home say
 * "Take action now" — two contradictory signals on one screen.
 *
 * Now there are two reinforcing states only:
 *   • on_track  — anything below 100% completion
 *   • all_done  — every step complete
 *
 * Both are green-toned. Risk and overdue counts no longer
 * downgrade the pill; if action is needed, it's the FirstActionGate
 * on Home that says so — Progress simply reflects today's work.
 */
import { useAppSettings } from '../../context/AppSettingsContext.jsx';

const STATUS_KEY = {
  on_track: 'actionHome.progress.status.onTrack',
  all_done: 'actionHome.progress.status.allDone',
};
const STATUS_COLOR = {
  on_track: '#22C55E',
  all_done: '#22C55E',
};

function deriveStatus({ percent = 0 } = {}) {
  return percent >= 100 ? 'all_done' : 'on_track';
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
  // Spec §7 — overdueCount + riskLevel deliberately ignored when
  // deriving status so the pill never contradicts the headline.
  // Any "act now" signalling lives on Home, not here.
  void overdueCount; void riskLevel;
  // Legacy callers may still pass status='slight_delay' or
  // 'needs_attention'; collapse anything non-all_done back to
  // on_track so the warning tone never reaches the screen.
  const passedStatus = (status === 'all_done') ? 'all_done'
                     : (status === 'on_track') ? 'on_track'
                     : null;
  const effectiveStatus = passedStatus || deriveStatus({ percent });
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
