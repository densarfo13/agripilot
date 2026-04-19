/**
 * BasicFarmerHome — simple mode farmer home (daily loop view).
 *
 * Structure (top to bottom):
 *   1. Section label ("Current task" / "All done" / "Come back later")
 *   2. Primary task card (via unified TaskCard, simple variant)
 *   3. Progress signal (lightweight: "2 of 5 done today")
 *   4. Connectivity badge
 *
 * Loop states handled:
 *   ready       — show task card + CTA
 *   completed   — show success state briefly
 *   all_done    — show all-done card with come-back message
 *   come_back   — offline/empty, show come-back message
 *
 * Design: See → Hear → Tap → Done → Progress
 * No charts. No clutter. One task only.
 *
 * ARCHITECTURE: Renders ONLY from taskViewModel. No raw task access.
 */
import { useEffect, useRef } from 'react';
import { useTranslation } from '../../i18n/index.js';
import { useAppPrefs } from '../../context/AppPrefsContext.jsx';
import { useNetwork } from '../../context/NetworkContext.jsx';
import { speakText, languageToVoiceCode } from '../../lib/voice.js';
import { SECTION_ICONS } from '../../lib/farmerIcons.js';
import { LOOP_STATE } from '../../services/farmerLoopService.js';
import TaskCard from './TaskCard.jsx';
import CompletionCard from './CompletionCard.jsx';

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
  loopState,
  progress,
  onDoThisNow,
  onSetStage,
  onAddUpdate,
  onGoToSetup,
  lastSuccessText,
  autopilotNextText,
  completionState,
  onContinue,
  onLater,
}) {
  const { t } = useTranslation();
  const { autoVoice, language } = useAppPrefs();
  const { isOnline } = useNetwork();
  const lastSpokenRef = useRef(null);

  const loading = decision?.loading;
  const vm = taskViewModel;

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

  const isAllDone = loopState === LOOP_STATE.ALL_DONE;
  const isComeBack = loopState === LOOP_STATE.COME_BACK;
  const isCompleted = loopState === LOOP_STATE.COMPLETED;
  const showTask = vm && !isAllDone && !isComeBack && !isCompleted;

  return (
    <div style={S.page} data-testid="basic-farmer-home">

      {/* ═══ SECTION LABEL ═══ */}
      {showTask && (
        <div style={S.sectionLabel}>
          <span style={S.sectionIcon}>{SECTION_ICONS.currentTask}</span>
          <span style={S.sectionText}>{t('dashboard.currentTask')}</span>
        </div>
      )}

      {/* ═══ PRIMARY TASK CARD ═══ */}
      {showTask && (
        <TaskCard
          viewModel={vm}
          variant="simple"
          language={language}
          t={t}
          onCta={handleCta}
        />
      )}

      {/* ═══ COMPLETION SUCCESS STATE ═══ */}
      {isCompleted && completionState && (
        <CompletionCard
          completionState={completionState}
          t={t}
          onContinue={onContinue}
          onLater={onLater}
          variant="simple"
        />
      )}
      {isCompleted && !completionState && (
        <div style={S.doneCard} data-testid="loop-completed">
          <span style={S.doneIcon}>{'\u2705'}</span>
          <div style={S.doneText}>{t('loop.taskDone')}</div>
          {lastSuccessText && (
            <div style={S.doneSubtext}>{lastSuccessText}</div>
          )}
          {autopilotNextText && (
            <div style={S.doneNext}>{autopilotNextText}</div>
          )}
          {!lastSuccessText && !autopilotNextText && (
            <div style={S.doneSubtext}>{t('loop.nextReady')}</div>
          )}
        </div>
      )}

      {/* ═══ ALL DONE STATE ═══ */}
      {isAllDone && !isCompleted && (
        <div style={S.allDoneCard} data-testid="loop-all-done">
          <span style={S.allDoneIcon}>{'\u2728'}</span>
          <div style={S.allDoneTitle}>{t('loop.allDone')}</div>
          <div style={S.allDoneSubtext}>
            {progress.done > 0
              ? t('loop.greatWork')
              : t('loop.comeBackTomorrow')}
          </div>
        </div>
      )}

      {/* ═══ COME BACK STATE ═══ */}
      {isComeBack && (
        <div style={S.allDoneCard} data-testid="loop-come-back">
          <span style={S.allDoneIcon}>{'\uD83C\uDF1F'}</span>
          <div style={S.allDoneTitle}>{t('loop.comeBack')}</div>
        </div>
      )}

      {/* ═══ PROGRESS SIGNAL ═══ */}
      {progress.total > 0 && (
        <div style={S.progressRow} data-testid="loop-progress">
          <div style={S.progressTrack}>
            <div style={{ ...S.progressFill, width: `${progress.percent}%` }} />
          </div>
          <div style={S.progressLabel}>
            {t('loop.progressToday', { done: progress.done, total: progress.total })}
          </div>
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
  // ─── Completion success ──
  doneCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '2rem 1rem',
    borderRadius: '22px',
    background: 'rgba(34,197,94,0.06)',
    border: '1px solid rgba(34,197,94,0.12)',
    boxShadow: '0 10px 30px rgba(0,0,0,0.28)',
    width: '100%',
    animation: 'farroway-fade-in 0.3s ease-out',
  },
  doneIcon: { fontSize: '3rem' },
  doneText: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#EAF2FF',
  },
  doneSubtext: {
    fontSize: '0.875rem',
    color: '#9FB3C8',
    fontWeight: 500,
  },
  doneNext: {
    fontSize: '0.875rem',
    color: '#22C55E',
    fontWeight: 600,
    textAlign: 'center',
  },
  // ─── All done / come back ──
  allDoneCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.625rem',
    padding: '2.5rem 1.25rem',
    borderRadius: '22px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    boxShadow: '0 10px 30px rgba(0,0,0,0.28)',
    width: '100%',
    animation: 'farroway-fade-in 0.3s ease-out',
  },
  allDoneIcon: { fontSize: '3rem' },
  allDoneTitle: {
    fontSize: '1.125rem',
    fontWeight: 700,
    color: '#EAF2FF',
    textAlign: 'center',
  },
  allDoneSubtext: {
    fontSize: '0.875rem',
    color: '#9FB3C8',
    fontWeight: 500,
    textAlign: 'center',
  },
  // ─── Progress signal ──────
  progressRow: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.375rem',
  },
  progressTrack: {
    height: '4px',
    borderRadius: '2px',
    background: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: '2px',
    background: '#22C55E',
    transition: 'width 0.4s ease',
    minWidth: '2px',
  },
  progressLabel: {
    fontSize: '0.6875rem',
    fontWeight: 600,
    color: '#6F8299',
    textAlign: 'center',
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
    color: '#6F8299',
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
    color: '#6F8299',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  // ─── Spinner ─────────────
  spinner: {
    width: '2rem',
    height: '2rem',
    border: '3px solid rgba(255,255,255,0.06)',
    borderTopColor: '#22C55E',
    borderRadius: '50%',
    animation: 'farroway-spin 0.8s linear infinite',
  },
};
