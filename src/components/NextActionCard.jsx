/**
 * NextActionCard — standard mode home card (daily loop view).
 *
 * Renders:
 *   1. One TaskCard (standard variant) — the current task
 *   2. Progress signal below the card
 *   3. Loop state cards (all_done, come_back, completed)
 *
 * Decision logic lives in src/engine/decisionEngine.js.
 * Loop state comes from useFarmerLoop via props.
 */
import { useTranslation } from '../i18n/index.js';
import { LOOP_STATE } from '../services/farmerLoopService.js';
import TaskCard from './farmer/TaskCard.jsx';

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

export default function NextActionCard({
  decision,
  taskViewModel,
  loading,
  loopState,
  progress,
  onDoThisNow,
  onSetStage,
  onGoToSetup,
  onAddUpdate,
  lastSuccessText,
  autopilotNextText,
  t,
  language,
}) {
  if (!decision && !loading) return null;

  const vm = taskViewModel;

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

  // ─── Loading ─────────────────────────────────────
  if (loading) {
    return (
      <div style={S.loadingCard}>
        <div style={S.loading}>
          <span style={S.spinner} />
          <span>{t('guided.loading')}</span>
        </div>
      </div>
    );
  }

  const isCompleted = loopState === LOOP_STATE.COMPLETED;
  const isAllDone = loopState === LOOP_STATE.ALL_DONE;
  const isComeBack = loopState === LOOP_STATE.COME_BACK;
  const showTask = vm && !isAllDone && !isComeBack && !isCompleted;

  return (
    <div style={S.wrapper}>
      {/* ═══ TASK CARD ═══ */}
      {showTask && (
        <TaskCard
          viewModel={vm}
          variant="standard"
          language={language}
          t={t}
          onCta={handleCta}
        />
      )}

      {/* ═══ COMPLETION SUCCESS ═══ */}
      {isCompleted && (
        <div style={S.stateCard} data-testid="loop-completed">
          <span style={S.stateIcon}>{'\u2705'}</span>
          <div>
            <div style={S.stateTitle}>{t('loop.taskDone')}</div>
            {lastSuccessText && (
              <div style={S.stateSubtext}>{lastSuccessText}</div>
            )}
            {autopilotNextText && (
              <div style={S.stateNext}>{autopilotNextText}</div>
            )}
            {!lastSuccessText && !autopilotNextText && (
              <div style={S.stateSubtext}>{t('loop.nextReady')}</div>
            )}
          </div>
        </div>
      )}

      {/* ═══ ALL DONE ═══ */}
      {isAllDone && !isCompleted && (
        <div style={S.stateCard} data-testid="loop-all-done">
          <span style={S.stateIcon}>{'\u2728'}</span>
          <div>
            <div style={S.stateTitle}>{t('loop.allDone')}</div>
            <div style={S.stateSubtext}>
              {progress && progress.done > 0
                ? t('loop.greatWork')
                : t('loop.comeBackTomorrow')}
            </div>
          </div>
        </div>
      )}

      {/* ═══ COME BACK ═══ */}
      {isComeBack && (
        <div style={S.stateCard} data-testid="loop-come-back">
          <span style={S.stateIcon}>{'\uD83C\uDF1F'}</span>
          <div>
            <div style={S.stateTitle}>{t('loop.comeBack')}</div>
          </div>
        </div>
      )}

      {/* ═══ PROGRESS SIGNAL ═══ */}
      {progress && progress.total > 0 && (
        <div style={S.progressRow} data-testid="loop-progress">
          <div style={S.progressTrack}>
            <div style={{ ...S.progressFill, width: `${progress.percent}%` }} />
          </div>
          <div style={S.progressMeta}>
            <span style={S.progressLabel}>
              {t('loop.progressToday', { done: progress.done, total: progress.total })}
            </span>
            {progress.percent >= 80 && (
              <span style={S.progressBadge}>{t('loop.onTrack')}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const S = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  loadingCard: {
    borderRadius: '20px',
    background: 'rgba(255,255,255,0.04)',
    padding: '1.5rem 1.25rem',
    border: '1px solid rgba(255,255,255,0.06)',
    boxShadow: '0 10px 30px rgba(0,0,0,0.28)',
  },
  loading: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.625rem',
    padding: '1.5rem 0', fontSize: '0.875rem', color: '#6F8299',
  },
  spinner: {
    width: '18px', height: '18px', border: '2px solid rgba(255,255,255,0.06)',
    borderTopColor: '#22C55E', borderRadius: '50%', animation: 'farroway-spin 0.8s linear infinite',
  },
  // ─── Loop state cards ──────
  stateCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.875rem',
    padding: '1.5rem 1.25rem',
    borderRadius: '20px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    boxShadow: '0 10px 30px rgba(0,0,0,0.28)',
    animation: 'farroway-fade-in 0.3s ease-out',
  },
  stateIcon: {
    fontSize: '2rem',
    flexShrink: 0,
  },
  stateTitle: {
    fontSize: '1rem',
    fontWeight: 700,
    color: '#EAF2FF',
  },
  stateSubtext: {
    fontSize: '0.8125rem',
    color: '#9FB3C8',
    marginTop: '0.125rem',
  },
  stateNext: {
    fontSize: '0.8125rem',
    color: '#22C55E',
    fontWeight: 600,
    marginTop: '0.25rem',
  },
  // ─── Progress signal ──────
  progressRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.375rem',
    padding: '0 0.25rem',
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
  progressMeta: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressLabel: {
    fontSize: '0.6875rem',
    fontWeight: 600,
    color: '#6F8299',
  },
  progressBadge: {
    fontSize: '0.625rem',
    fontWeight: 700,
    color: '#22C55E',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  },
};
