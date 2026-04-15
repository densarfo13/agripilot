/**
 * BasicFarmerHome — simple mode farmer home screen.
 *
 * Structure (top to bottom):
 *   1. Primary task card (via unified TaskCard, simple variant)
 *   2. Completion feedback state
 *   3. Connectivity badge
 *
 * Design: See → Hear → Tap → Done
 * No charts. No clutter. One task only.
 *
 * ARCHITECTURE: Renders ONLY from taskViewModel. No raw task access.
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '../../i18n/index.js';
import { useAppPrefs } from '../../context/AppPrefsContext.jsx';
import { useNetwork } from '../../context/NetworkContext.jsx';
import { speakText, languageToVoiceCode } from '../../lib/voice.js';
import { SECTION_ICONS } from '../../lib/farmerIcons.js';
import TaskCard from './TaskCard.jsx';

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
  weather_override: 'task',
  all_done: 'update',
};

export default function BasicFarmerHome({
  decision,
  taskViewModel,
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
  const vm = taskViewModel;

  // Reset completion state when action changes
  useEffect(() => { setCompleted(false); }, [vm?.id]);

  // Voice auto-play once per action
  useEffect(() => {
    if (!autoVoice || loading || !vm) return;
    if (lastSpokenRef.current === vm.id) return;
    lastSpokenRef.current = vm.id;
    try { speakText(vm.voiceText || vm.title, languageToVoiceCode(language)); } catch {}
  }, [autoVoice, loading, vm, language]);

  function handleCta() {
    if (!vm) return;
    const route = ACTION_ROUTES[vm.actionKey] || 'task';
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

  return (
    <div style={S.page} data-testid="basic-farmer-home">

      {/* ═══ SECTION LABEL ═══ */}
      {vm && !completed && (
        <div style={S.sectionLabel}>
          <span style={S.sectionIcon}>{SECTION_ICONS.currentTask}</span>
          <span style={S.sectionText}>{t('dashboard.currentTask') || 'Current task'}</span>
        </div>
      )}

      {/* ═══ PRIMARY TASK CARD (unified TaskCard, simple variant) ═══ */}
      {vm && !completed && (
        <TaskCard
          viewModel={vm}
          variant="simple"
          language={language}
          t={t}
          onCta={handleCta}
        />
      )}

      {/* ═══ COMPLETION FEEDBACK ═══ */}
      {completed && (
        <div style={S.doneCard}>
          <span style={S.doneIcon}>{'\u2705'}</span>
          <div style={S.doneText}>{t('farmer.taskDone')}</div>
        </div>
      )}

      {/* ═══ CONNECTIVITY BADGE ═══ */}
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
    gap: '1.25rem',
    padding: '0.75rem 1rem 2.5rem',
    minHeight: '70vh',
  },
  center: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '50vh',
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
  // ─── Section label ──────────
  sectionLabel: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.375rem',
  },
  sectionIcon: {
    fontSize: '0.875rem',
  },
  sectionText: {
    fontSize: '0.6875rem',
    fontWeight: 700,
    color: 'rgba(255,255,255,0.35)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
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
