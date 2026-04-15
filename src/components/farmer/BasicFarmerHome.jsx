/**
 * BasicFarmerHome — final production farmer home screen.
 *
 * Structure (top to bottom):
 *   1. Farmer identity strip (name + crop + location)
 *   2. Weather-to-action block (icon + recommendation)
 *   3. Primary task card (icon + title + reason + voice + CTA)
 *   4. Completion feedback state
 *   5. Connectivity badge
 *
 * Design: See → Hear → Tap → Done
 * No charts. No clutter. One task only.
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '../../i18n/index.js';
import { useAppPrefs } from '../../context/AppPrefsContext.jsx';
import { useNetwork } from '../../context/NetworkContext.jsx';
import { speakText, languageToVoiceCode } from '../../lib/voice.js';
import { getCropLabel } from '../../utils/crops.js';
import { getAvatar } from '../../utils/avatarStorage.js';
import FarmerAvatar from '../FarmerAvatar.jsx';
import VoicePromptButton from '../VoicePromptButton.jsx';

const ACTION_ROUTES = {
  onboarding_incomplete: 'setup',
  no_active_farm: 'setup',
  profile_incomplete: 'setup',
  stage_missing: 'stage',
  stage_outdated: 'stage',
  severe_pest: 'task',
  pest_overdue: 'task',
  unread_alert: 'task',
  stale_activity: 'update',
  needs_checkin: 'update',
  daily_task: 'task',
  all_done: 'update',
};

export default function BasicFarmerHome({
  decision,
  profile,
  user,
  onDoThisNow,
  onSetStage,
  onAddUpdate,
  onGoToSetup,
}) {
  const { t } = useTranslation();
  const { autoVoice, language } = useAppPrefs();
  const { isOnline } = useNetwork();
  const lastSpokenRef = useRef(null);
  const [completed, setCompleted] = useState(false);

  const loading = decision?.loading;
  const action = decision?.primaryAction;
  const wx = decision?.weatherGuidance;
  const status = decision?.farmStatus;

  // Reset completion state when action changes
  useEffect(() => { setCompleted(false); }, [action?.key]);

  // Voice auto-play once per action
  useEffect(() => {
    if (!autoVoice || loading || !action) return;
    if (lastSpokenRef.current === action.key) return;
    lastSpokenRef.current = action.key;
    try { speakText(action.title, languageToVoiceCode(language)); } catch {}
  }, [autoVoice, loading, action, language]);

  function handleCta() {
    if (!action) return;
    const route = ACTION_ROUTES[action.key] || 'task';
    switch (route) {
      case 'setup': return onGoToSetup();
      case 'stage': return onSetStage();
      case 'task': return onDoThisNow();
      case 'update': return onAddUpdate();
    }
  }

  // ─── Loading ──────────────────────────────────────
  if (loading) {
    return (
      <div style={S.page} data-testid="basic-farmer-home">
        <div style={S.center}>
          <div style={S.spinner} />
        </div>
      </div>
    );
  }

  const farmerName = user?.fullName || profile?.farmerName || '';
  const cropDisplay = getCropLabel(profile?.cropType || profile?.crop || '');
  const locationDisplay = profile?.location || '';

  return (
    <div style={S.page} data-testid="basic-farmer-home">

      {/* ═══ 1. FARMER IDENTITY STRIP ═══ */}
      <div style={S.identityStrip}>
        <FarmerAvatar
          fullName={farmerName}
          profileImageUrl={getAvatar()}
          size={40}
        />
        <div>
          <div style={S.farmerName}>{farmerName}</div>
          {(cropDisplay || locationDisplay) && (
            <div style={S.farmMeta}>
              {cropDisplay && <span>{cropDisplay}</span>}
              {cropDisplay && locationDisplay && <span style={S.metaDot}>{'\u2022'}</span>}
              {locationDisplay && <span>{locationDisplay}</span>}
            </div>
          )}
        </div>
      </div>

      {/* Weather displays in header chip only — no duplicate block */}

      {/* ═══ 3. PRIMARY TASK CARD ═══ */}
      {action && !completed && (
        <div style={S.taskCard}>
          <div style={{ ...S.taskIcon, background: action.iconBg }}>
            <span style={S.taskEmoji}>{action.icon}</span>
          </div>
          <div style={S.taskTitle}>{action.title}</div>
          <div style={S.taskReason}>{action.reason}</div>

          <VoicePromptButton text={action.title} label={t('common.listen')} />

          <button
            onClick={handleCta}
            disabled={action.key === 'all_done'}
            style={action.isAlert ? S.ctaAlert : action.key === 'all_done' ? S.ctaDone : S.cta}
            data-testid="basic-action-btn"
          >
            {action.cta}
          </button>
        </div>
      )}

      {/* ═══ 4. COMPLETION FEEDBACK ═══ */}
      {completed && (
        <div style={S.doneCard}>
          <span style={S.doneIcon}>{'\u2705'}</span>
          <div style={S.doneText}>{t('farmer.taskDone')}</div>
        </div>
      )}

      {/* ═══ 5. CONNECTIVITY BADGE ═══ */}
      <div style={S.connectivity}>
        <span style={{ ...S.connDot, background: isOnline ? '#22C55E' : '#F59E0B' }} />
        <span style={S.connText}>
          {isOnline ? t('farmer.online') : t('farmer.offline')}
        </span>
      </div>
    </div>
  );
}

const S = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1rem',
    padding: '0.5rem 1rem 2rem',
    minHeight: '70vh',
  },
  center: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '50vh',
  },
  // ─── Identity strip ──────
  identityStrip: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.5rem 0',
  },
  farmerName: {
    fontSize: '1.375rem',
    fontWeight: 700,
    color: '#fff',
  },
  farmMeta: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.375rem',
    fontSize: '0.8125rem',
    color: 'rgba(255,255,255,0.45)',
    marginTop: '0.2rem',
  },
  metaDot: { color: 'rgba(255,255,255,0.25)' },
  // ─── Weather block ───────
  wxBlock: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    width: '100%',
    padding: '0.625rem 0.875rem',
    borderRadius: '12px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  wxIcon: { fontSize: '1.25rem', flexShrink: 0 },
  wxText: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.7)',
  },
  // ─── Task card ───────────
  taskCard: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '1.5rem 1rem',
    borderRadius: '20px',
    background: '#1B2330',
    border: '2px solid rgba(34,197,94,0.25)',
    textAlign: 'center',
  },
  taskIcon: {
    width: '100px',
    height: '100px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskEmoji: { fontSize: '3rem', lineHeight: 1 },
  taskTitle: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#fff',
    lineHeight: 1.3,
    maxWidth: '20rem',
  },
  taskReason: {
    fontSize: '0.8125rem',
    color: 'rgba(255,255,255,0.45)',
    lineHeight: 1.5,
    maxWidth: '20rem',
  },
  cta: {
    width: '100%',
    padding: '1rem',
    background: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: '16px',
    fontSize: '1.125rem',
    fontWeight: 800,
    cursor: 'pointer',
    minHeight: '56px',
    boxShadow: '0 4px 16px rgba(22,163,74,0.3)',
    WebkitTapHighlightColor: 'transparent',
    marginTop: '0.25rem',
  },
  ctaAlert: {
    width: '100%',
    padding: '1rem',
    background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: '16px',
    fontSize: '1.125rem',
    fontWeight: 800,
    cursor: 'pointer',
    minHeight: '56px',
    boxShadow: '0 4px 16px rgba(239,68,68,0.3)',
    WebkitTapHighlightColor: 'transparent',
    marginTop: '0.25rem',
  },
  ctaDone: {
    width: '100%',
    padding: '0.875rem',
    background: 'transparent',
    color: '#86EFAC',
    border: '1px solid rgba(34,197,94,0.3)',
    borderRadius: '16px',
    fontSize: '1rem',
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: '52px',
    WebkitTapHighlightColor: 'transparent',
    marginTop: '0.25rem',
  },
  // ─── Completion ──────────
  doneCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '2rem 1rem',
    borderRadius: '20px',
    background: 'rgba(34,197,94,0.08)',
    border: '1px solid rgba(34,197,94,0.2)',
    width: '100%',
  },
  doneIcon: { fontSize: '3rem' },
  doneText: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#86EFAC',
  },
  // ─── Connectivity ────────
  connectivity: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
    marginTop: 'auto',
    paddingTop: '0.5rem',
  },
  connDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  connText: {
    fontSize: '0.6875rem',
    color: 'rgba(255,255,255,0.3)',
    fontWeight: 500,
  },
  // ─── Spinner ─────────────
  spinner: {
    width: '2rem',
    height: '2rem',
    border: '3px solid rgba(255,255,255,0.1)',
    borderTopColor: '#22C55E',
    borderRadius: '50%',
    animation: 'farroway-spin 0.8s linear infinite',
  },
};
