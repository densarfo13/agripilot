/**
 * AllTasksPage — focused task execution screen at /tasks.
 *
 * Structure:
 *   A. Current Task — one active task at top (same source as Home)
 *   B. Next Up — 1–2 upcoming tasks, compact rows
 *   C. View All — expandable section for remaining tasks
 *   D. Completed — session-completed tasks (subtle)
 *
 * NOT a task manager. NOT priority-grouped.
 * Optimized for "what should I do now / next".
 */

import { useCallback, useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfile } from '../context/ProfileContext.jsx';
// Strict no-English-leak alias — see useStrictTranslation.js header.
import { useStrictTranslation as useTranslation } from '../i18n/useStrictTranslation.js';
import { useNetwork } from '../context/NetworkContext.jsx';
import { useUserMode } from '../context/UserModeContext.jsx';
import { useWeather } from '../context/WeatherContext.jsx';
import { getFarmTasks, completeTask } from '../lib/api.js';
import { safeTrackEvent } from '../lib/analytics.js';
import { buildTaskListViewModels } from '../domain/tasks/index.js';
import { buildCompletionState } from '../domain/tasks/buildCompletionState.js';
import { getLocalizedTaskTitle } from '../utils/taskTranslations.js';
import { NAV_ICONS, getTaskActionIcon } from '../lib/farmerIcons.js';
import CompletionCard from '../components/farmer/CompletionCard.jsx';
import { loadTasksSafe, getFallbackTodayAction } from '../services/loadTasksSafe.js';
import { formatRelativeUpdate } from '../lib/relativeTime.js';
import { isReallyOnline } from '../services/isReallyOnline.js';
import { offlineEvents } from '../services/offlineLogger.js';
import VoiceButton from '../components/VoiceButton.jsx';
// Quick-onboarding voice-first hook. Plays the day's task once
// per session for users who came through the new QuickStart
// welcome screen. Existing /tasks visitors are unaffected.
import {
  isQuickOnboarded, hasFiredQuickVoice, markQuickVoiceFired,
} from '../utils/quickOnboarding.js';
import { speak } from '../core/farroway/voice.js';

export default function AllTasksPage() {
  const navigate = useNavigate();
  const { currentFarmId, profile } = useProfile();
  const { t, lang } = useTranslation();
  const { isOnline } = useNetwork();
  const { isBasic } = useUserMode();
  const { weather } = useWeather();

  const [tasks, setTasks] = useState([]);
  const [completedTasks, setCompletedTasks] = useState([]);
  const [completedCount, setCompletedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState('loading'); // online | offline_with_cache | offline_no_cache_fallback | retrying | loading
  const [bannerMessageKey, setBannerMessageKey] = useState(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [completing, setCompleting] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [taskCompletionState, setTaskCompletionState] = useState(null);
  const completionTimerRef = useRef(null);

  const fetchTasks = useCallback(async () => {
    if (!currentFarmId) return;
    setLoading(true);
    // Keep previous tasks on screen while retrying so the farmer
    // doesn't see a blank — spec §7.
    const result = await loadTasksSafe({
      farmId: currentFarmId,
      fetcher: () => getFarmTasks(currentFarmId),
      isOnline,
    });
    setTasks(result.tasks);
    setCompletedCount(result.completedCount);
    setCompletedTasks([]);
    setMode(result.mode);
    setBannerMessageKey(result.bannerMessageKey);
    setLastUpdatedAt(result.lastUpdatedAt);
    setLoading(false);
    safeTrackEvent('tasks.loadSafeResult', { mode: result.mode, source: result.source });
  }, [currentFarmId, isOnline]);

  // Retry honours the spec §7 rules: don't spam when offline; keep
  // the visible state while re-fetching. We verify actual reachability
  // (not just navigator.onLine) so captive portals don't trigger a
  // doomed fetch that ends in the same fallback state.
  async function handleRetry() {
    offlineEvents.retryClicked(mode);
    if (!isOnline) {
      setBannerMessageKey('offline.stillOffline');
      offlineEvents.retryBlocked('browser_offline');
      return;
    }
    const reachable = await isReallyOnline();
    if (!reachable) {
      setBannerMessageKey('offline.stillOffline');
      offlineEvents.reachabilityFailed();
      return;
    }
    setMode('retrying');
    await fetchTasks();
  }

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  async function handleComplete(task) {
    if (!currentFarmId || completing) return;
    setCompleting(task.id);
    setTaskCompletionState(null);
    let savedOffline = false;

    try {
      await completeTask(currentFarmId, task.id, {
        title: task.title,
        priority: task.priority,
        actionType: task.actionType || null,
      });
      finishCompletion(task, savedOffline);
    } catch (err) {
      if (!navigator.onLine || !err.status) {
        try {
          const { enqueue } = await import('../utils/offlineQueue.js');
          const { getIdempotencyKey } = await import('../lib/idempotency.js');
          await enqueue({
            method: 'POST',
            url: `/api/v2/farm-tasks/${currentFarmId}/tasks/${encodeURIComponent(task.id)}/complete`,
            data: { title: task.title, priority: task.priority, actionType: task.actionType || null },
            entityType: 'task',
            actionType: 'complete',
            idempotencyKey: getIdempotencyKey('task_completion', `${currentFarmId}:${task.id}`),
          });
          savedOffline = true;
          finishCompletion(task, savedOffline);
        } catch { /* queue failed */ }
      }
    } finally {
      setCompleting(null);
    }
  }

  function finishCompletion(task, savedOffline) {
    const remainingTasks = tasks.filter((t) => t.id !== task.id);
    const newCompletedCount = completedCount + 1;

    setTasks(remainingTasks);
    setCompletedTasks((prev) => [...prev, { ...task, completedAt: new Date().toISOString() }]);
    setCompletedCount(newCompletedCount);

    safeTrackEvent('task_completed', { farmId: currentFarmId, taskId: task.id, source: 'tasks_page', offline: savedOffline });
    if (savedOffline) safeTrackEvent('saved_offline_after_completion', { taskId: task.id });

    // Determine next task from remaining
    const sortedRemaining = [...remainingTasks].sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return (order[a.priority] ?? 3) - (order[b.priority] ?? 3);
    });
    const nextTask = sortedRemaining[0] || null;
    const nextTitle = nextTask ? (vmByTaskId[nextTask.id]?.title || getLocalizedTaskTitle(nextTask.id, nextTask.title, lang)) : null;

    const vm = vmByTaskId[task.id] || null;
    const cs = buildCompletionState({
      completedTask: task,
      taskViewModel: vm,
      nextTask,
      completedCount: newCompletedCount,
      remainingCount: sortedRemaining.length,
      savedOffline,
      nextTaskTitle: nextTitle,
    });
    setTaskCompletionState(cs);

    // Haptic
    if (navigator.vibrate) {
      try { navigator.vibrate(savedOffline ? [30, 30, 30] : 50); } catch {}
    }
  }

  function handleCompletionContinue() {
    safeTrackEvent('continue_clicked', { source: 'tasks_page' });
    setTaskCompletionState(null);
  }

  function handleCompletionLater() {
    safeTrackEvent('later_clicked', { source: 'tasks_page' });
    setTaskCompletionState(null);
    navigate('/dashboard');
  }

  // Build view models for localized titles + autopilot enrichment
  const cropStage = profile?.cropStage || '';
  const viewModels = buildTaskListViewModels({ tasks, weatherGuidance: null, language: lang, t, mode: isBasic ? 'simple' : 'standard', cropStage, weather });
  const vmByTaskId = Object.fromEntries(viewModels.map(vm => [vm.taskId, vm]));

  // Priority-sorted: high → medium → low (same cascade as Home)
  const sorted = [...tasks].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return (order[a.priority] ?? 3) - (order[b.priority] ?? 3);
  });

  // Split into current, next up, and rest
  const currentTask = sorted[0] || null;
  const nextUpTasks = sorted.slice(1, 3); // max 2
  const restTasks = sorted.slice(3);
  const totalDone = completedCount + completedTasks.length;
  const totalAll = totalDone + tasks.length;

  // ─── Quick-onboarding voice-first hook ─────────────────────────
  // Spec section 7: when /tasks loads for a user who came through
  // QuickStart, auto-play the day's first task once. Browsers
  // require a user gesture for speechSynthesis - the gesture is
  // the "Start farming" tap that just navigated here, so this
  // works on the first paint after that handler fires. Subsequent
  // visits no-op (markQuickVoiceFired stamps localStorage).
  useEffect(() => {
    if (loading) return;
    if (!currentTask) return;
    if (!isQuickOnboarded()) return;
    if (hasFiredQuickVoice()) return;
    const title = (vmByTaskId[currentTask.id] && vmByTaskId[currentTask.id].title)
      || getLocalizedTaskTitle(currentTask.id, currentTask.title, lang)
      || '';
    if (!title) return;
    try { speak(title); } catch { /* never propagate */ }
    markQuickVoiceFired();
    // We intentionally depend only on the loaded-state signals -
    // re-running this on every tab refocus would re-fire the voice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, currentTask && currentTask.id]);

  if (!profile) return null;

  return (
    <div style={S.page} data-testid="all-tasks-page">
      {/* Header */}
      <div style={S.header}>
        <span style={S.pageIcon}>{NAV_ICONS.tasks}</span>
        <h1 style={S.pageTitle}>{t('nav.tasks')}</h1>
        {/* Tap-to-hear: localized page title + today's progress count. */}
        <VoiceButton
          text={`${t('nav.tasks')}${totalAll > 0 ? '. ' + t('loop.progressToday', { done: totalDone, total: totalAll }) : ''}`}
        />
        {totalAll > 0 && (
          <span style={S.headerCount}>
            {t('loop.progressToday', { done: totalDone, total: totalAll })}
          </span>
        )}
      </div>

      {/* Loading */}
      {loading && mode !== 'retrying' && (
        <div style={S.loadingWrap}>
          <span style={S.spinner} />
        </div>
      )}

      {/* Calm offline banner — spec §5. Replaces the raw error card so
          farmers never see FetchEvent / TypeError strings. */}
      {bannerMessageKey && (
        <div style={S.offlineBanner} data-testid="tasks-offline-banner">
          <span style={S.offlineBannerDot} aria-hidden="true" />
          <div style={S.offlineBannerText}>
            <div>{t(bannerMessageKey)}</div>
            {mode === 'offline_with_cache' && (
              <div style={S.offlineBannerSub}>
                {lastUpdatedAt
                  ? (() => {
                      const rel = formatRelativeUpdate(lastUpdatedAt);
                      return t(rel.key, rel.params);
                    })()
                  : t('offline.syncOnReconnect')}
              </div>
            )}
          </div>
          {mode !== 'retrying' && (
            <button type="button" onClick={handleRetry} style={S.offlineRetryBtn} data-testid="tasks-offline-retry">
              {isOnline ? t('offline.tryAgain') : t('offline.stillOfflineShort')}
            </button>
          )}
        </div>
      )}

      {/* Fallback today-action card when no cached tasks exist —
          spec §5 second clause. Uses the same task card language as
          the rest of the app, never a red error panel. */}
      {!loading && mode === 'offline_no_cache_fallback' && tasks.length === 0 && !taskCompletionState && (
        <div style={S.fallbackCard} data-testid="tasks-fallback-card">
          <div style={S.fallbackLabel}>{t('home.hero.todaysAction')}</div>
          <h2 style={S.fallbackTitle}>{t('offline.fallback.title')}</h2>
          <div style={S.fallbackWhy}>
            <span style={S.fallbackWhyLabel}>{t('home.hero.why')}</span>
            {t('offline.fallback.why')}
          </div>
          <div style={S.fallbackNext}>{t('offline.fallback.next')}</div>
          <button type="button" onClick={handleRetry} style={S.fallbackCta}>
            {isOnline ? t('offline.tryAgain') : t('offline.stillOfflineShort')}
          </button>
        </div>
      )}

      {/* Empty — all caught up (only in true online/empty state) */}
      {!loading && mode === 'online' && tasks.length === 0 && !taskCompletionState && (
        <div style={S.emptyWrap}>
          <span style={S.emptyIcon}>{'\u2728'}</span>
          <p style={S.emptyTitle}>{t('tasks.allCaughtUp')}</p>
          <p style={S.emptySubtext}>{t('tasks.noMoreTasks')}</p>
          <button type="button" onClick={() => navigate('/dashboard')} style={S.homeBtn}>
            {t('tasks.backHome')}
          </button>
        </div>
      )}

      {/* ═══ COMPLETION CARD (after task completion) ═══ */}
      {taskCompletionState && (
        <div style={S.sections}>
          <CompletionCard
            completionState={taskCompletionState}
            t={t}
            onContinue={handleCompletionContinue}
            onLater={handleCompletionLater}
            variant="standard"
          />
        </div>
      )}

      {/* Task sections */}
      {!loading && tasks.length > 0 && !taskCompletionState && (
        <div style={S.sections}>

          {/* Scan-crop entry — "Having a problem? Scan" */}
          <button
            type="button"
            onClick={() => navigate('/scan-crop')}
            style={S.scanEntry}
            data-testid="tasks-scan-crop"
          >
            <span style={S.scanEntryIcon} aria-hidden="true">{'\uD83D\uDCF7'}</span>
            <span>{t('camera.entry.tasksCta')}</span>
            <span style={S.scanEntryChevron}>{'\u203A'}</span>
          </button>

          {/* ═══ A. CURRENT TASK ═══ */}
          {currentTask && (
            <>
              <div style={S.sectionLabel}>
                <span style={S.sectionIcon}>{'\uD83C\uDFAF'}</span>
                <span style={S.sectionText}>{t('tasks.currentTask')}</span>
              </div>
              <div style={S.currentCard}>
                <button
                  type="button"
                  onClick={() => handleComplete(currentTask)}
                  disabled={completing === currentTask.id}
                  style={S.doneBtn}
                  aria-label={t('taskAction.markDone')}
                >
                  {completing === currentTask.id
                    ? <span style={S.doneBtnSpinner} />
                    : <span style={S.doneBtnCircle} />}
                </button>
                <div style={S.currentContent}>
                  <span style={S.currentIcon}>{getTaskActionIcon(currentTask.actionType)}</span>
                  <div style={S.currentTextWrap}>
                    <span style={S.currentTitle}>{vmByTaskId[currentTask.id]?.title || getLocalizedTaskTitle(currentTask.id, currentTask.title, lang)}</span>
                    {vmByTaskId[currentTask.id]?.urgency && vmByTaskId[currentTask.id].urgency !== 'optional' && (
                      <span style={{ ...S.urgencyBadge, background: vmByTaskId[currentTask.id].urgencyStyle?.bg || 'rgba(34,197,94,0.12)', color: vmByTaskId[currentTask.id].urgencyStyle?.text || '#22C55E' }}>
                        {t(vmByTaskId[currentTask.id].urgencyStyle?.labelKey || 'urgency.thisWeek')}
                      </span>
                    )}
                    {vmByTaskId[currentTask.id]?.whyText && (
                      <span style={S.currentWhy}>{vmByTaskId[currentTask.id].whyText}</span>
                    )}
                    {vmByTaskId[currentTask.id]?.timingText && (
                      <span style={S.currentTiming}>{vmByTaskId[currentTask.id].timingText}</span>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ═══ B. NEXT UP ═══ */}
          {nextUpTasks.length > 0 && (
            <>
              <div style={S.sectionLabel}>
                <span style={S.sectionIcon}>{'\uD83D\uDCCB'}</span>
                <span style={S.sectionText}>{t('tasks.nextUp')}</span>
              </div>
              {nextUpTasks.map((task) => (
                <div key={task.id} style={S.compactRow}>
                  <button
                    type="button"
                    onClick={() => handleComplete(task)}
                    disabled={completing === task.id}
                    style={S.doneBtnSmall}
                    aria-label={t('taskAction.markDone')}
                  >
                    {completing === task.id
                      ? <span style={S.doneBtnSpinnerSmall} />
                      : <span style={S.doneBtnCircleSmall} />}
                  </button>
                  <span style={S.compactIcon}>{getTaskActionIcon(task.actionType)}</span>
                  {vmByTaskId[task.id]?.urgencyStyle?.dot && (
                    <span style={{ ...S.urgencyDot, background: vmByTaskId[task.id].urgencyStyle.accent }} />
                  )}
                  <span style={S.compactTitle}>{vmByTaskId[task.id]?.title || getLocalizedTaskTitle(task.id, task.title, lang)}</span>
                </div>
              ))}
            </>
          )}

          {/* ═══ C. VIEW ALL (expandable) ═══ */}
          {restTasks.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setShowAll(!showAll)}
                style={S.viewAllBtn}
              >
                {showAll
                  ? t('tasks.hideAll')
                  : `${t('tasks.viewAll')} (${restTasks.length})`}
              </button>
              {showAll && restTasks.map((task) => (
                <div key={task.id} style={S.compactRow}>
                  <button
                    type="button"
                    onClick={() => handleComplete(task)}
                    disabled={completing === task.id}
                    style={S.doneBtnSmall}
                    aria-label={t('taskAction.markDone')}
                  >
                    {completing === task.id
                      ? <span style={S.doneBtnSpinnerSmall} />
                      : <span style={S.doneBtnCircleSmall} />}
                  </button>
                  <span style={S.compactIcon}>{getTaskActionIcon(task.actionType)}</span>
                  {vmByTaskId[task.id]?.urgencyStyle?.dot && (
                    <span style={{ ...S.urgencyDot, background: vmByTaskId[task.id].urgencyStyle.accent }} />
                  )}
                  <span style={S.compactTitle}>{vmByTaskId[task.id]?.title || getLocalizedTaskTitle(task.id, task.title, lang)}</span>
                </div>
              ))}
            </>
          )}

          {/* ═══ D. COMPLETED (session) ═══ */}
          {completedTasks.length > 0 && (
            <>
              <div style={{ ...S.sectionLabel, marginTop: '0.5rem' }}>
                <span style={S.sectionIcon}>{'\u2705'}</span>
                <span style={S.sectionText}>{t('tasks.completed')}</span>
              </div>
              {completedTasks.map((task) => (
                <div key={task.id} style={S.completedRow}>
                  <span style={S.completedCheck}>{'\u2705'}</span>
                  <span style={S.completedIcon}>{getTaskActionIcon(task.actionType)}</span>
                  <span style={S.completedTitle}>{vmByTaskId[task.id]?.title || getLocalizedTaskTitle(task.id, task.title, lang)}</span>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

const S = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #0B1D34 0%, #081423 100%)',
    padding: '0 0 5rem 0',
    animation: 'farroway-fade-in 0.3s ease-out',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.625rem',
    padding: '1.125rem 1.25rem',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  },
  pageIcon: { fontSize: '1.25rem' },
  pageTitle: { fontSize: '1.25rem', fontWeight: 700, color: '#EAF2FF', margin: 0, flex: 1 },
  headerCount: { fontSize: '0.6875rem', fontWeight: 600, color: '#6F8299' },

  // Loading
  loadingWrap: { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem 0' },
  spinner: {
    display: 'inline-block', width: '1.5rem', height: '1.5rem',
    border: '3px solid rgba(255,255,255,0.06)', borderTopColor: '#22C55E',
    borderRadius: '50%', animation: 'farroway-spin 0.8s linear infinite',
  },

  // Error
  errorCard: { margin: '1.5rem 1.25rem', padding: '1rem', borderRadius: '14px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.14)' },
  errorText: { margin: 0, fontSize: '0.875rem', color: '#FCA5A5' },
  retryBtn: { marginTop: '0.75rem', padding: '0.5rem 1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.03)', color: '#9FB3C8', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' },
  // Calm offline banner — amber, not red. Never looks like a system error.
  offlineBanner: {
    margin: '0.75rem 1.25rem', padding: '0.75rem 0.875rem',
    borderRadius: '12px',
    background: 'rgba(251,191,36,0.06)',
    border: '1px solid rgba(251,191,36,0.22)',
    display: 'flex', alignItems: 'center', gap: '0.625rem',
  },
  offlineBannerDot: {
    width: '8px', height: '8px', borderRadius: '50%',
    background: '#F59E0B', flexShrink: 0,
  },
  offlineBannerText: { flex: 1, minWidth: 0, fontSize: '0.8125rem', color: '#FCD34D', fontWeight: 600, lineHeight: 1.35 },
  offlineBannerSub: { fontSize: '0.6875rem', color: '#9FB3C8', fontWeight: 500, marginTop: '0.125rem' },
  offlineRetryBtn: {
    padding: '0.375rem 0.75rem', borderRadius: '999px',
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
    color: '#EAF2FF', fontSize: '0.75rem', fontWeight: 700,
    cursor: 'pointer', flexShrink: 0,
    WebkitTapHighlightColor: 'transparent',
  },
  // Safe fallback today-action when no cache exists.
  fallbackCard: {
    margin: '0.75rem 1.25rem', padding: '1.5rem 1.25rem',
    borderRadius: '20px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    display: 'flex', flexDirection: 'column', gap: '0.625rem',
  },
  fallbackLabel: {
    fontSize: '0.6875rem', fontWeight: 800, color: '#6F8299',
    letterSpacing: '0.08em', textTransform: 'uppercase',
  },
  fallbackTitle: { fontSize: '1.25rem', fontWeight: 800, color: '#EAF2FF', margin: 0, lineHeight: 1.3 },
  fallbackWhy: {
    fontSize: '0.875rem', color: '#EAF2FF', lineHeight: 1.4,
    padding: '0.5rem 0.75rem', borderRadius: '10px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  fallbackWhyLabel: {
    fontSize: '0.625rem', fontWeight: 800, color: '#6F8299',
    textTransform: 'uppercase', letterSpacing: '0.08em',
    marginRight: '0.375rem',
  },
  fallbackNext: { fontSize: '0.8125rem', color: '#9FB3C8', lineHeight: 1.4 },
  fallbackCta: {
    marginTop: '0.5rem',
    padding: '0.875rem 1rem',
    borderRadius: '14px',
    background: '#22C55E', color: '#fff', border: 'none',
    fontSize: '0.9375rem', fontWeight: 800, cursor: 'pointer',
    minHeight: '48px',
    boxShadow: '0 10px 24px rgba(34,197,94,0.22)',
  },

  // Empty
  emptyWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 1.5rem', textAlign: 'center' },
  emptyIcon: { fontSize: '3rem', marginBottom: '0.5rem' },
  emptyTitle: { fontSize: '1.125rem', fontWeight: 700, color: '#EAF2FF', margin: '0 0 0.25rem 0' },
  emptySubtext: { fontSize: '0.875rem', color: '#9FB3C8', margin: '0 0 1.5rem 0' },
  homeBtn: { padding: '0.875rem 1.75rem', borderRadius: '14px', border: 'none', background: '#22C55E', color: '#fff', fontSize: '0.9375rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 10px 24px rgba(34,197,94,0.22)' },

  // Sections
  sections: { padding: '0.75rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  scanEntry: {
    display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%',
    padding: '0.625rem 0.875rem', borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.06)',
    background: 'rgba(255,255,255,0.03)', color: '#EAF2FF',
    fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent', textAlign: 'left',
    marginBottom: '0.25rem',
  },
  scanEntryIcon: { fontSize: '1rem', lineHeight: 1 },
  scanEntryChevron: { marginLeft: 'auto', color: '#6F8299', fontSize: '1.125rem' },
  sectionLabel: { display: 'flex', alignItems: 'center', gap: '0.375rem', marginTop: '0.75rem', marginBottom: '0.125rem' },
  sectionIcon: { fontSize: '0.875rem' },
  sectionText: { fontSize: '0.6875rem', fontWeight: 700, color: '#6F8299', textTransform: 'uppercase', letterSpacing: '0.04em' },

  // ─── Current task card (full size) ──────
  currentCard: {
    display: 'flex', alignItems: 'center', gap: '0.75rem',
    padding: '1.125rem 1rem',
    borderRadius: '18px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    boxShadow: '0 10px 30px rgba(0,0,0,0.28)',
  },
  currentContent: { display: 'flex', alignItems: 'flex-start', gap: '0.625rem', flex: 1, minWidth: 0 },
  currentIcon: { fontSize: '1.375rem', flexShrink: 0, marginTop: '0.125rem' },
  currentTextWrap: { display: 'flex', flexDirection: 'column', gap: '0.125rem', flex: 1, minWidth: 0 },
  currentTitle: { fontWeight: 700, color: '#EAF2FF', fontSize: '1rem' },
  currentWhy: { fontSize: '0.75rem', color: '#9FB3C8', fontWeight: 500, lineHeight: 1.3 },
  currentTiming: { fontSize: '0.6875rem', color: '#0EA5E9', fontWeight: 500, lineHeight: 1.3 },
  urgencyBadge: {
    display: 'inline-block', padding: '0.125rem 0.5rem', borderRadius: '8px',
    fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em',
    alignSelf: 'flex-start',
  },
  urgencyDot: {
    width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
  },

  // ─── Compact rows (next up / view all) ──
  compactRow: {
    display: 'flex', alignItems: 'center', gap: '0.625rem',
    padding: '0.75rem 0.875rem',
    borderRadius: '14px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.04)',
  },
  compactIcon: { fontSize: '1rem', flexShrink: 0 },
  compactTitle: { fontWeight: 600, color: '#9FB3C8', fontSize: '0.875rem', flex: 1, minWidth: 0 },

  // ─── Done buttons ──────────────
  doneBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: '32px', height: '32px', borderRadius: '50%',
    border: '2px solid rgba(255,255,255,0.12)',
    background: 'transparent', cursor: 'pointer', flexShrink: 0, padding: 0,
    WebkitTapHighlightColor: 'transparent',
  },
  doneBtnCircle: { width: '12px', height: '12px', borderRadius: '50%', background: 'transparent' },
  doneBtnSpinner: {
    width: '12px', height: '12px', borderRadius: '50%',
    border: '2px solid rgba(255,255,255,0.08)', borderTopColor: '#22C55E',
    animation: 'farroway-spin 0.6s linear infinite',
  },
  doneBtnSmall: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: '24px', height: '24px', borderRadius: '50%',
    border: '2px solid rgba(255,255,255,0.08)',
    background: 'transparent', cursor: 'pointer', flexShrink: 0, padding: 0,
    WebkitTapHighlightColor: 'transparent',
  },
  doneBtnCircleSmall: { width: '8px', height: '8px', borderRadius: '50%', background: 'transparent' },
  doneBtnSpinnerSmall: {
    width: '8px', height: '8px', borderRadius: '50%',
    border: '2px solid rgba(255,255,255,0.06)', borderTopColor: '#22C55E',
    animation: 'farroway-spin 0.6s linear infinite',
  },

  // ─── View all toggle ──────────
  viewAllBtn: {
    padding: '0.5rem 1rem',
    borderRadius: '10px',
    border: '1px dashed rgba(255,255,255,0.06)',
    background: 'transparent',
    color: '#6F8299',
    fontSize: '0.75rem',
    fontWeight: 600,
    cursor: 'pointer',
    textAlign: 'center',
    WebkitTapHighlightColor: 'transparent',
  },

  // ─── Completed rows ──────────
  completedRow: {
    display: 'flex', alignItems: 'center', gap: '0.5rem',
    padding: '0.5rem 0.875rem',
    borderRadius: '12px',
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.03)',
  },
  completedCheck: { fontSize: '0.75rem', flexShrink: 0 },
  completedIcon: { fontSize: '0.875rem', flexShrink: 0, opacity: 0.5 },
  completedTitle: { fontWeight: 500, color: '#6F8299', fontSize: '0.8125rem', flex: 1, textDecoration: 'line-through', textDecorationColor: 'rgba(255,255,255,0.06)' },
};
