/**
 * WeeklyProgressCard — simple weekly task progress bar
 */
export default function WeeklyProgressCard({ doneThisWeek, weekTotal, t }) {
  if (weekTotal <= 0) return null;

  const pct = Math.min(100, Math.round((doneThisWeek / weekTotal) * 100));

  return (
    <div style={S.progressCard}>
      <div style={S.titleRow}>
        <span style={S.title}>{t('dashboard.thisWeek')}</span>
      </div>
      <div style={S.progressRow}>
        <span style={S.progressText}>
          {doneThisWeek} {t('dashboard.of')} {weekTotal} {t('dashboard.tasksDoneWeek')}
        </span>
      </div>
      <div style={S.progressTrack}>
        <div style={{ ...S.progressFill, width: `${pct}%` }} />
      </div>
    </div>
  );
}

const S = {
  progressCard: {
    padding: '0.75rem 1rem',
    borderRadius: '12px',
    background: '#1B2330',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  titleRow: {
    marginBottom: '0.35rem',
  },
  title: {
    fontSize: '0.75rem',
    fontWeight: 700,
    color: 'rgba(255,255,255,0.45)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  progressRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '0.5rem',
  },
  progressText: {
    fontSize: '0.8rem',
    color: 'rgba(255,255,255,0.6)',
    fontWeight: 600,
  },
  progressTrack: {
    height: '6px',
    borderRadius: '3px',
    background: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: '3px',
    background: '#22C55E',
    transition: 'width 0.3s ease',
    minWidth: '4px',
  },
};
