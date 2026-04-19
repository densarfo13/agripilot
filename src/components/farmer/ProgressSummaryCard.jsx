/**
 * ProgressSummaryCard — intentionally placed LOWER on the screen so
 * the farmer sees the next action before stats.
 */
import { useAppSettings } from '../../context/AppSettingsContext.jsx';

export default function ProgressSummaryCard({ tasksDone = 0, cyclesActive = 0 }) {
  const { t } = useAppSettings();
  return (
    <section style={S.section} data-testid="progress-summary-card">
      <h3 style={S.title}>{t('actionHome.progress.title')}</h3>
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

const S = {
  section: {
    padding: '1rem', borderRadius: '16px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    color: '#EAF2FF',
  },
  title: { fontSize: '0.9375rem', fontWeight: 700, margin: '0 0 0.5rem' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' },
  stat: { padding: '0.75rem', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', textAlign: 'center' },
  statValue: { fontSize: '1.25rem', fontWeight: 700 },
  statLabel: { fontSize: '0.6875rem', color: '#9FB3C8', textTransform: 'uppercase', letterSpacing: '0.04em' },
};
