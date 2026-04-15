/**
 * BasicFarmerHome — icon-first, voice-guided home for basic mode.
 *
 * Powered by the decision engine (same result as standard mode).
 * Receives decision as a prop from Dashboard — no internal hook call.
 *
 * Design principles:
 *   - ONE large icon (centered, 4rem+)
 *   - ONE big CTA button
 *   - Voice auto-plays once per action
 *   - Speaker button for replay
 *   - Short reason text
 *   - 48px+ touch targets
 *   - No multi-column, no small text
 */
import { useEffect, useRef } from 'react';
import { useTranslation } from '../../i18n/index.js';
import { useAppPrefs } from '../../context/AppPrefsContext.jsx';
import { speakText, languageToVoiceCode } from '../../lib/voice.js';
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
  onDoThisNow,
  onSetStage,
  onAddUpdate,
  onGoToSetup,
}) {
  const { t } = useTranslation();
  const { autoVoice, language } = useAppPrefs();
  const lastSpokenRef = useRef(null);

  const loading = decision?.loading;
  const primaryAction = decision?.primaryAction;
  const farmStatus = decision?.farmStatus;

  // Voice auto-play once per action
  useEffect(() => {
    if (!autoVoice || loading || !primaryAction) return;
    const actionKey = primaryAction.key;
    if (lastSpokenRef.current === actionKey) return;
    lastSpokenRef.current = actionKey;
    try { speakText(primaryAction.title, languageToVoiceCode(language)); } catch {}
  }, [autoVoice, loading, primaryAction, language]);

  function handleCta() {
    if (!primaryAction) return;
    const route = ACTION_ROUTES[primaryAction.key] || 'task';
    switch (route) {
      case 'setup': return onGoToSetup();
      case 'stage': return onSetStage();
      case 'task': return onDoThisNow();
      case 'update': return onAddUpdate();
    }
  }

  if (loading) {
    return (
      <div style={S.page} data-testid="basic-farmer-home">
        <div style={S.centerWrap}>
          <div style={S.spinner} />
          <div style={S.loadingText}>{t('guided.loading')}</div>
        </div>
      </div>
    );
  }

  if (!primaryAction) return null;

  const isAlert = primaryAction.isAlert;
  const isDone = primaryAction.key === 'all_done';

  return (
    <div style={S.page} data-testid="basic-farmer-home">
      <div style={S.centerWrap}>
        <div style={{ ...S.iconCircle, background: primaryAction.iconBg }}>
          <span style={S.iconEmoji}>{primaryAction.icon}</span>
        </div>

        <div style={S.taskTitle}>{primaryAction.title}</div>
        <div style={S.reason}>{primaryAction.reason}</div>

        <VoicePromptButton text={primaryAction.title} label={t('common.listen')} />

        <button
          onClick={handleCta}
          style={isDone ? S.bigCtaSecondary : isAlert ? S.bigCtaAlert : S.bigCta}
          data-testid="basic-action-btn"
        >
          {primaryAction.cta}
        </button>

        {primaryAction.next && (
          <div style={S.nextHint}>
            <span style={S.nextArrow}>{'\u2192'}</span>
            <span>{primaryAction.next}</span>
          </div>
        )}

        {farmStatus && (
          <div style={S.statusRow}>
            <span style={{ ...S.statusDot, background: farmStatus.progress >= 60 ? '#22C55E' : '#F59E0B' }} />
            <span style={S.statusText}>{farmStatus.label}</span>
          </div>
        )}
      </div>
    </div>
  );
}

const S = {
  page: {
    minHeight: '60vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.875rem',
    textAlign: 'center',
    padding: '1.5rem',
    maxWidth: '22rem',
    width: '100%',
  },
  iconCircle: {
    width: '120px',
    height: '120px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconEmoji: { fontSize: '4rem', lineHeight: 1 },
  taskTitle: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#fff',
    lineHeight: 1.3,
    maxWidth: '20rem',
  },
  reason: {
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 1.5,
    maxWidth: '20rem',
  },
  bigCta: {
    width: '100%',
    padding: '1.125rem',
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
  },
  bigCtaAlert: {
    width: '100%',
    padding: '1.125rem',
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
  },
  bigCtaSecondary: {
    width: '100%',
    padding: '1rem',
    background: 'transparent',
    color: '#86EFAC',
    border: '1px solid rgba(34,197,94,0.3)',
    borderRadius: '16px',
    fontSize: '1rem',
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: '56px',
    WebkitTapHighlightColor: 'transparent',
  },
  nextHint: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.375rem 0.75rem',
    borderRadius: '10px',
    background: 'rgba(255,255,255,0.03)',
    fontSize: '0.75rem',
    color: 'rgba(255,255,255,0.35)',
    lineHeight: 1.4,
  },
  nextArrow: { color: '#22C55E', fontWeight: 700, flexShrink: 0 },
  statusRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginTop: '0.5rem',
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  statusText: {
    fontSize: '0.8125rem',
    color: 'rgba(255,255,255,0.45)',
    fontWeight: 600,
  },
  loadingText: {
    fontSize: '0.9rem',
    color: 'rgba(255,255,255,0.6)',
  },
  spinner: {
    width: '2.5rem',
    height: '2.5rem',
    border: '3px solid rgba(255,255,255,0.1)',
    borderTopColor: '#22C55E',
    borderRadius: '50%',
    animation: 'farroway-spin 0.8s linear infinite',
  },
};
