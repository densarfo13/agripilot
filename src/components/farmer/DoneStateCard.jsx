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
import { tSafe } from '../../i18n/tSafe.js';

export default function DoneStateCard({
  progressPercent = null,
  donePill        = null,
  // Gap-fix §2: never leave the card with no next action. Callers
  // pass one or more of these; we render whichever are provided so
  // the farmer always has somewhere obvious to go.
  nextActionLabel = null,
  onNextAction    = null,
  reviewLabel     = null,
  onReview        = null,
  tomorrowPreview = null,     // optional string; shown as a subtle line
}) {
  const { t } = useAppSettings();

  // Stable English fallbacks ensure we never render the raw key even
  // if the active language is missing this block.
  const title    = tSafe('today.done.title', '');
  const body     = t('today.done.body')  || "You're on track. Great work.";
  const nextLbl  = nextActionLabel
                || tSafe('today.done.nextAction', '');
  const revLbl   = reviewLabel
                || tSafe('today.done.reviewProgress', '');

  return (
    <section style={S.card} data-testid="done-state-card">
      <div style={S.celebration}>{'\u2705'}</div>
      <h2 style={S.title}>{title}</h2>
      <p style={S.body}>{body}</p>

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

      {tomorrowPreview && (
        <div style={S.tomorrow} data-testid="done-state-tomorrow">
          {tomorrowPreview}
        </div>
      )}

      {(onNextAction || onReview) && (
        <div style={S.actionsRow} data-testid="done-state-actions">
          {onNextAction && (
            <button
              type="button"
              onClick={onNextAction}
              style={S.nextBtn}
              data-testid="done-state-next-action"
            >
              {nextLbl}
            </button>
          )}
          {onReview && (
            <button
              type="button"
              onClick={onReview}
              style={S.reviewBtn}
              data-testid="done-state-review"
            >
              {revLbl}
            </button>
          )}
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
  tomorrow: {
    marginTop: '0.5rem',
    fontSize: '0.8125rem',
    color: 'rgba(234,242,255,0.72)',
    lineHeight: 1.4,
  },
  actionsRow: {
    marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap',
    justifyContent: 'center', width: '100%',
  },
  nextBtn: {
    padding: '0.5rem 0.875rem', borderRadius: 10, border: 'none',
    background: '#22C55E', color: '#07210E',
    fontWeight: 700, fontSize: '0.8125rem', cursor: 'pointer',
    minHeight: 40,
  },
  reviewBtn: {
    padding: '0.5rem 0.875rem', borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.18)',
    background: 'transparent', color: '#EAF2FF',
    fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer',
    minHeight: 40,
  },
};
