/**
 * JourneySummaryCard — the farmer-journey summary that sits at the
 * top of Today / Dashboard once the farmer is past onboarding.
 *
 * Shows:
 *   • current crop
 *   • current stage (farmer-friendly label)
 *   • quick status: on track / needs attention
 *   • next key action (from the progress engine's nextBestAction)
 *
 * Dumb presentational component — all data comes from the caller.
 * Designed to be mounted above PrimaryTaskCard without disturbing
 * the existing FarmerTodayPage layout.
 */

import { useAppSettings } from '../context/AppSettingsContext.jsx';

const STATE_LABEL_KEY = Object.freeze({
  onboarding:     'journey.state.onboarding',
  crop_selected:  'journey.state.crop_selected',
  planning:       'journey.state.planning',
  active_farming: 'journey.state.active_farming',
  harvest:        'journey.state.harvest',
  post_harvest:   'journey.state.post_harvest',
});

const STATE_LABEL_FALLBACK = Object.freeze({
  onboarding:     'Setting up',
  crop_selected:  'Crop chosen',
  planning:       'Planning',
  active_farming: 'Active farming',
  harvest:        'Harvest time',
  post_harvest:   'Post-harvest',
});

// Map the Progress Engine's status codes to a farmer-friendly quick
// label + subtle colour cue.
function quickStatusStyle(code) {
  if (code === 'on_track')      return { fg: '#1b5e20', bg: 'rgba(34,197,94,0.14)' };
  if (code === 'slight_delay')  return { fg: '#8d6e63', bg: 'rgba(245,158,11,0.14)' };
  return                              { fg: '#b71c1c', bg: 'rgba(239,68,68,0.14)' };
}

export default function JourneySummaryCard({
  journeyState,        // 'onboarding' | ... | 'post_harvest'
  cropLabel = null,
  stageLabel = null,
  progressStatus = null,    // 'on_track' | 'slight_delay' | 'high_risk'
  progressLabel = null,     // already-localized string for status
  nextActionText = null,
  stagePercent = null,      // 0..100 or null
  onContinue = null,        // optional CTA; renders a button if provided
}) {
  const { t } = useAppSettings();
  if (!journeyState) return null;

  const stateKey = STATE_LABEL_KEY[journeyState];
  const stateText = (stateKey && t(stateKey)) || STATE_LABEL_FALLBACK[journeyState] || journeyState;

  const statusStyle = quickStatusStyle(progressStatus);
  const pct = Number.isFinite(stagePercent)
    ? Math.max(0, Math.min(100, Math.round(stagePercent)))
    : null;

  const cropLbl = cropLabel || (t('journey.unknown_crop') || '—');
  const stageLbl = stageLabel || stateText;

  const headerLabel = t('journey.summary.header') || 'Your farm today';
  const stageHeader = t('journey.summary.stage') || 'Stage';
  const cropHeader  = t('journey.summary.crop')  || 'Crop';
  const nextHeader  = t('journey.summary.next_step') || 'Next step';

  return (
    <section style={S.card} data-testid="journey-summary-card"
             data-state={journeyState}>
      <div style={S.headerRow}>
        <span style={S.headerLabel}>{headerLabel}</span>
        {progressLabel && (
          <span style={{ ...S.statusBadge, color: statusStyle.fg,
                         background: statusStyle.bg }}
                data-testid="journey-status-badge">
            {progressLabel}
          </span>
        )}
      </div>

      <div style={S.metaRow}>
        <div style={S.metaBlock}>
          <span style={S.metaLabel}>{cropHeader}</span>
          <span style={S.metaValue}>{cropLbl}</span>
        </div>
        <div style={S.metaDivider} />
        <div style={S.metaBlock}>
          <span style={S.metaLabel}>{stageHeader}</span>
          <span style={S.metaValue}>{stageLbl}</span>
        </div>
      </div>

      {pct != null && (
        <div style={S.progressTrack} data-testid="journey-progress-track">
          <div style={{ ...S.progressFill, width: `${pct}%` }} />
        </div>
      )}

      {nextActionText && (
        <div style={S.nextWrap} data-testid="journey-next-step">
          <span style={S.nextLabel}>{nextHeader}</span>
          <span style={S.nextText}>{nextActionText}</span>
        </div>
      )}

      {typeof onContinue === 'function' && (
        <button
          type="button"
          onClick={onContinue}
          style={S.ctaBtn}
          data-testid="journey-continue"
        >
          {t('journey.summary.continue') || 'Continue'}
        </button>
      )}
    </section>
  );
}

const S = {
  card: {
    padding: '0.875rem 1rem',
    borderRadius: '16px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    boxShadow: '0 10px 30px rgba(0,0,0,0.28)',
    display: 'flex', flexDirection: 'column', gap: '0.625rem',
    color: '#EAF2FF',
  },
  headerRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: '0.5rem',
  },
  headerLabel: {
    fontSize: '0.6875rem', fontWeight: 700, color: '#9FB3C8',
    textTransform: 'uppercase', letterSpacing: '0.05em',
  },
  statusBadge: {
    padding: '0.2rem 0.625rem', borderRadius: '999px',
    fontSize: '0.6875rem', fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.04em',
  },
  metaRow: {
    display: 'flex', alignItems: 'center',
    gap: '0.875rem',
  },
  metaBlock: {
    display: 'flex', flexDirection: 'column', gap: '0.125rem',
    minWidth: 0,
  },
  metaLabel: {
    fontSize: '0.625rem', fontWeight: 700, color: '#6F8299',
    textTransform: 'uppercase', letterSpacing: '0.05em',
  },
  metaValue: {
    fontSize: '0.9375rem', fontWeight: 700, color: '#EAF2FF',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  metaDivider: {
    width: '1px', height: '2rem', background: 'rgba(255,255,255,0.08)',
  },
  progressTrack: {
    height: '4px', borderRadius: '2px',
    background: 'rgba(255,255,255,0.06)', overflow: 'hidden',
  },
  progressFill: {
    height: '100%', borderRadius: '2px',
    background: '#22C55E', transition: 'width 0.3s ease',
  },
  nextWrap: {
    display: 'flex', flexDirection: 'column', gap: '0.125rem',
    padding: '0.5rem 0.625rem', borderRadius: '10px',
    background: 'rgba(34,197,94,0.06)',
    border: '1px solid rgba(34,197,94,0.16)',
  },
  nextLabel: {
    fontSize: '0.625rem', fontWeight: 700, color: '#86EFAC',
    textTransform: 'uppercase', letterSpacing: '0.04em',
  },
  nextText: {
    fontSize: '0.9375rem', fontWeight: 600, color: '#EAF2FF',
  },
  ctaBtn: {
    padding: '0.625rem', borderRadius: '12px',
    border: 'none', background: '#22C55E', color: '#fff',
    fontSize: '0.9375rem', fontWeight: 700, cursor: 'pointer',
  },
};
