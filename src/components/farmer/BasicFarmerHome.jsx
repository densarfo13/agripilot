/**
 * BasicFarmerHome — simple mode farmer home (daily loop view).
 *
 * Structure (top to bottom):
 *   1. Section label ("Current task" / "All done" / "Come back later")
 *   2. Primary task card (icon-first, voice-guided, one action)
 *   3. Big CTA button (56px min-height touch target)
 *   4. Voice prompt button (listen to task)
 *   5. Progress signal (completedCount / taskCount)
 *   6. Connectivity badge
 *
 * Loop states handled:
 *   loading     — show spinner + t('common.loading')
 *   setup       — show finish setup prompt (!setupComplete)
 *   stage       — show set stage prompt (!stageSet)
 *   ready       — show primaryTask card + CTA
 *   all_done    — show all-done card with come-back message
 *   come_back   — offline/empty, show come-back message
 *
 * Design: See → Hear → Tap → Done → Progress
 * No charts. No clutter. One task only.
 * No small text (min 0.875rem). 48px+ touch targets. No hardcoded English.
 */
import { useEffect, useRef } from 'react';
import { useStrictTranslation as useTranslation } from '../../i18n/useStrictTranslation.js';
import { useAppPrefs } from '../../context/AppPrefsContext.jsx';
import { useNetwork } from '../../context/NetworkContext.jsx';
import { speakText, languageToVoiceCode } from '../../lib/voice.js';
import { SECTION_ICONS } from '../../lib/farmerIcons.js';
import { LOOP_STATE } from '../../services/farmerLoopService.js';
import { getTaskIcon, getTaskVoiceKey, getTaskLabelKey } from '../../lib/taskPresentation.js';
import VoicePromptButton from '../VoicePromptButton.jsx';
import CompletionCard from './CompletionCard.jsx';
import { buildCompletionBridge } from '../../core/experience/index.js';
import { renderLocalizedMessage } from '../../core/i18n/index.js';

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
  // New props for mode-aware rendering
  primaryTask = null,
  taskLoading = false,
  setupComplete = true,
  stageSet = true,
  completedCount = 0,
  taskCount = 0,
}) {
  const { t } = useTranslation();
  const { autoVoice, language } = useAppPrefs();
  const { isOnline } = useNetwork();
  const lastSpokenTaskRef = useRef(null);

  const loading = taskLoading || decision?.loading;
  const vm = primaryTask || taskViewModel;

  // 1-word icon label (basic mode spec: icon + short label under icon)
  const iconLabel = primaryTask ? getTaskLabelKey(primaryTask) : null;
  const shortLabel = iconLabel;

  // Voice auto-play once per task load (when autoVoice is enabled)
  useEffect(() => {
    if (!autoVoice || taskLoading || !primaryTask) return;
    if (lastSpokenTaskRef.current === primaryTask.id) return;
    lastSpokenTaskRef.current = primaryTask.id;
    try { speakText(primaryTask.voiceText || primaryTask.title, languageToVoiceCode(language)); } catch { /* voice fail is non-blocking */ }
  }, [autoVoice, taskLoading, primaryTask, language]);

  // ─── Loading ──────────────────────────────────────
  if (loading) {
    return (
      <div style={S.page} data-testid="basic-farmer-home">
        <div style={S.center}>
          <div style={S.spinner} />
          <span style={S.loadingText}>{t('common.loading')}</span>
        </div>
      </div>
    );
  }

  // ─── Setup incomplete ─────────────────────────────
  if (!setupComplete) {
    return (
      <div style={S.page} data-testid="basic-farmer-home">
        <div style={S.promptCard}>
          <span style={S.promptIcon}>🌱</span>
          <button
            type="button"
            style={S.bigCta}
            onClick={onGoToSetup}
            data-testid="basic-do-now-btn"
          >
            {t('dashboard.finishSetup')}
          </button>
        </div>
      </div>
    );
  }

  // ─── Stage not set ───────────────────────────────
  if (!stageSet) {
    return (
      <div style={S.page} data-testid="basic-farmer-home">
        <div style={S.promptCard}>
          <span style={S.promptIcon}>📋</span>
          <button
            type="button"
            style={S.bigCta}
            onClick={onSetStage}
            data-testid="basic-do-now-btn"
          >
            {t('dashboard.setStage')}
          </button>
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

      {/* ═══ PRIMARY TASK ICON (large, 4rem) ═══ */}
      {showTask && (
        <div style={S.taskIconWrap}>
          <span
            data-testid="basic-task-icon"
            style={{ fontSize: '4rem', lineHeight: 1.1 }}
            aria-hidden="true"
          >
            {getTaskIcon(vm)}
          </span>
        </div>
      )}

      {/* ═══ TASK TITLE ═══ */}
      {showTask && vm.title && (
        <div style={S.taskTitle}>{vm.title}</div>
      )}

      {/* ═══ VOICE PROMPT BUTTON ═══ */}
      {showTask && (
        <VoicePromptButton
          promptKey={getTaskVoiceKey(vm)}
          voiceText={vm.voiceText || vm.title}
          label={t('common.listen')}
          language={language}
        />
      )}

      {/* ═══ BIG CTA ═══ */}
      {showTask && (
        <button
          type="button"
          data-testid="basic-do-now-btn"
          style={S.bigCta}
          onClick={onDoThisNow}
        >
          {t('dashboard.doThisNow')}
        </button>
      )}

      {/* ═══ ADD UPDATE LINK ═══ */}
      {showTask && (
        <button
          type="button"
          style={S.addUpdateLink}
          onClick={onAddUpdate}
        >
          {t('dashboard.addUpdate')}
        </button>
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
      {isAllDone && !isCompleted && (() => {
        const bridge = buildCompletionBridge({
          cropStage: decision?.cropStage || vm?.stage || null,
          missedDays: decision?.missedDays || 0,
          allDoneReason: decision?.reason || null,
        });
        const nextLine = bridge?.next
          ? renderLocalizedMessage(bridge.next, t)
          : '';
        return (
          <div style={S.allDoneCard} data-testid="loop-all-done">
            <span style={S.allDoneIcon}>{'\u2728'}</span>
            <div style={S.allDoneTitle}>{t('loop.allDone')}</div>
            <div style={S.allDoneSubtext}>
              {progress.done > 0
                ? t('loop.greatWork')
                : t('loop.comeBackTomorrow')}
            </div>
            {nextLine && (
              <div
                style={S.allDoneSubtext}
                data-testid="loop-next-bridge"
              >
                {nextLine}
              </div>
            )}
          </div>
        );
      })()}

      {/* ═══ COME BACK STATE ═══ */}
      {isComeBack && (
        <div style={S.allDoneCard} data-testid="loop-come-back">
          <span style={S.allDoneIcon}>{'\uD83C\uDF1F'}</span>
          <div style={S.allDoneTitle}>{t('loop.comeBack')}</div>
        </div>
      )}

      {/* ═══ PROGRESS SIGNAL (completedCount / taskCount) ═══ */}
      {(completedCount > 0 || taskCount > 0 || progress.total > 0) && (
        <div style={S.progressRow} data-testid="loop-progress">
          <div style={S.progressTrack}>
            <div style={{ ...S.progressFill, width: `${progress.percent || 0}%` }} />
          </div>
          <div style={S.progressLabel}>
            {completedCount > 0 || taskCount > 0
              ? t('loop.progressToday', { done: completedCount, total: taskCount + completedCount })
              : t('loop.progressToday', { done: progress.done, total: progress.total })}
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
    justifyContent: 'center',
    gap: '1.25rem',
    padding: '0.75rem 1rem 2.5rem',
    minHeight: '70vh',
  },
  center: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '50vh',
    gap: '1rem',
  },
  loadingText: {
    fontSize: '0.9375rem',
    color: '#9FB3C8',
  },
  promptCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1rem',
    padding: '2rem 1.25rem',
    width: '100%',
  },
  promptIcon: { fontSize: '3rem' },
  taskIconWrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    padding: '0.5rem 0',
  },
  taskTitle: {
    fontSize: '1.125rem',
    fontWeight: 700,
    color: '#EAF2FF',
    textAlign: 'center',
    lineHeight: 1.35,
    padding: '0 0.5rem',
  },
  // ─── Big CTA (56px min-height for 48px+ touch target spec) ──
  bigCta: {
    width: '100%',
    minHeight: '56px',
    borderRadius: '18px',
    background: '#22C55E',
    color: '#fff',
    fontSize: '1.0625rem',
    fontWeight: 700,
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 10px 24px rgba(34,197,94,0.22)',
    WebkitTapHighlightColor: 'transparent',
  },
  addUpdateLink: {
    background: 'none',
    border: 'none',
    color: '#9FB3C8',
    fontSize: '0.875rem',
    fontWeight: 500,
    cursor: 'pointer',
    padding: '0.5rem',
    minHeight: '48px',
    WebkitTapHighlightColor: 'transparent',
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
    height: '6px',
    borderRadius: '3px',
    background: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: '3px',
    background: '#22C55E',
    transition: 'width 0.4s ease',
    minWidth: '2px',
  },
  progressLabel: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: '#9FB3C8',
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
    fontSize: '0.875rem',
    color: '#9FB3C8',
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
    fontSize: '0.875rem',
    fontWeight: 700,
    color: '#9FB3C8',
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
