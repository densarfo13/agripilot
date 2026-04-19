/**
 * DoneStateCard — the "nothing required right now" state of the
 * Today screen. Dominates the screen the same way PrimaryTaskCard
 * does in the ACTIVE state, so the farmer never has to guess
 * whether they have work left.
 *
 * Pure presentational. The resolver (getTodayScreenState) decides
 * when this renders; the parent page just drops it in.
 */
import { useAppSettings } from '../../context/AppSettingsContext.jsx';

export default function DoneStateCard({ progressPercent = null, donePill = null }) {
  const { t } = useAppSettings();

  return (
    <section style={S.card} data-testid="done-state-card">
      <div style={S.celebration}>{'\u2705'}</div>
      <h2 style={S.title}>{t('today.done.title') || 'All done for today'}</h2>
      <p style={S.body}>{t('today.done.body') || "You're on track. Great work."}</p>

      {donePill && (
        <div style={S.pill} data-testid="done-state-pill">
          <span>{donePill}</span>
        </div>
      )}

      {Number.isFinite(progressPercent) && (
        <div style={S.barTrack} aria-label={t('actionHome.progress.title')}>
          <div style={{ ...S.barFill, width: `${Math.max(0, Math.min(100, progressPercent))}%` }} />
        </div>
      )}
    </section>
  );
}

const S = {
  card: {
    padding: '1.5rem 1.25rem',
    borderRadius: '20px',
    background: 'rgba(34,197,94,0.08)',
    border: '1px solid rgba(34,197,94,0.22)',
    boxShadow: '0 12px 36px rgba(0,0,0,0.28)',
    color: '#EAF2FF',
    textAlign: 'center',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem',
  },
  celebration: { fontSize: '2.5rem', lineHeight: 1 },
  title: { fontSize: '1.375rem', fontWeight: 700, margin: 0, color: '#22C55E' },
  body: { fontSize: '0.9375rem', margin: 0, color: '#EAF2FF', lineHeight: 1.5 },
  pill: {
    marginTop: '0.25rem',
    padding: '0.25rem 0.75rem',
    borderRadius: '999px',
    background: 'rgba(34,197,94,0.14)',
    color: '#22C55E',
    fontSize: '0.75rem', fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.04em',
  },
  barTrack: {
    width: '80%', maxWidth: '240px', height: '6px',
    marginTop: '0.75rem',
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.08)', overflow: 'hidden',
  },
  barFill: { height: '100%', background: '#22C55E', transition: 'width 0.3s ease' },
};
