/**
 * useFarmerLoop — React hook managing the daily farmer action loop.
 *
 * State machine:
 *   loading → ready → in_progress → completed → next_ready → ready
 *                                              → all_done / come_back
 *
 * Owns: task fetching, task completion, progress signal, next-task handoff.
 * Consumes: useFarmDecision for decision engine + view model.
 * Does NOT own: weather, profile, auth (those come from context).
 *
 * Returns everything the Home screen needs to render the loop.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from '../i18n/index.js';
import { useProfile } from '../context/ProfileContext.jsx';
import { useNetwork } from '../context/NetworkContext.jsx';
import { useWeather } from '../context/WeatherContext.jsx';
import { useAppPrefs } from '../context/AppPrefsContext.jsx';
import { useFarmDecision } from './useFarmDecision.js';
import { safeTrackEvent } from '../lib/analytics.js';
import { getLocalizedTaskTitle } from '../utils/taskTranslations.js';
import {
  LOOP_STATE,
  getCurrentFarmerTask,
  completeFarmerTask,
  getProgressSignal,
  getNextTaskState,
} from '../services/farmerLoopService.js';

// Auto-transition delay after completion feedback (ms)
const COMPLETION_DISPLAY_MS = 2200;

/**
 * @returns {Object} Loop state + actions for Home screen
 */
export function useFarmerLoop() {
  const { t, lang } = useTranslation();
  const { profile, currentFarmId, loading: profileLoading, farmSwitching, activeFarms } = useProfile();
  const { isOnline } = useNetwork();
  const { weather, fetchedAt: weatherFetchedAt, freshness: weatherFreshness, refreshWeather } = useWeather();
  const { autoVoice, language } = useAppPrefs();

  // ─── Core loop state ─────────────────────────────────────
  const [loopState, setLoopState] = useState(LOOP_STATE.LOADING);
  const [primaryTask, setPrimaryTask] = useState(null);
  const [taskCount, setTaskCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [taskLoading, setTaskLoading] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [lastCompletedTask, setLastCompletedTask] = useState(null);
  const [feedbackStatus, setFeedbackStatus] = useState(null); // 'success'|'offline'|'failed'
  const [feedbackMessage, setFeedbackMessage] = useState(null);

  const prevFarmIdRef = useRef(null);
  const completionTimerRef = useRef(null);
  const submitGuardRef = useRef(false);

  // ─── Decision engine (for view model + weather) ──────────
  const decision = useFarmDecision({
    profile,
    primaryTask,
    taskCount,
    completedCount,
    weather,
    fetchedAt: weatherFetchedAt,
    freshness: weatherFreshness,
    isOnline,
    taskLoading,
  });

  // ─── Progress signal ─────────────────────────────────────
  const progress = getProgressSignal({ completedCount, taskCount });

  // ─── Fetch primary task ──────────────────────────────────
  const fetchTask = useCallback(async (farmId) => {
    if (!farmId) return;
    setTaskLoading(true);

    const result = await getCurrentFarmerTask({ farmId, isOnline });

    setPrimaryTask(result.task);
    setTaskCount(result.taskCount);
    setCompletedCount(result.completedCount);
    setTaskLoading(false);

    // Determine loop state from fetch result
    if (result.task) {
      setLoopState(LOOP_STATE.READY);
      safeTrackEvent('loop.task_shown', {
        farmId,
        taskId: result.task.id,
        taskCount: result.taskCount,
      });
    } else if (result.completedCount > 0) {
      setLoopState(LOOP_STATE.ALL_DONE);
    } else if (result.error === 'offline') {
      setLoopState(LOOP_STATE.COME_BACK);
    } else {
      // No tasks and nothing completed — decision engine will handle
      // (could be onboarding, stage missing, etc.)
      setLoopState(LOOP_STATE.READY);
    }
  }, [isOnline]);

  // ─── Farm change / initial load ──────────────────────────
  useEffect(() => {
    if (!currentFarmId) return;
    if (currentFarmId !== prevFarmIdRef.current) {
      prevFarmIdRef.current = currentFarmId;
      setPrimaryTask(null);
      setLoopState(LOOP_STATE.LOADING);
      setFeedbackStatus(null);
      setFeedbackMessage(null);
      fetchTask(currentFarmId);
    }
  }, [currentFarmId, fetchTask]);

  // Refetch when coming back online
  useEffect(() => {
    if (isOnline && currentFarmId && loopState === LOOP_STATE.COME_BACK) {
      fetchTask(currentFarmId);
    }
  }, [isOnline, currentFarmId, loopState, fetchTask]);

  // Track home opened
  useEffect(() => {
    safeTrackEvent('loop.farmer_home_opened', { farmId: currentFarmId });
  }, [currentFarmId]);

  // ─── Complete task ───────────────────────────────────────
  const completeTask = useCallback(async (task) => {
    if (!task || !currentFarmId || submitGuardRef.current) return;
    submitGuardRef.current = true;
    setCompleting(true);
    setLoopState(LOOP_STATE.IN_PROGRESS);
    setFeedbackStatus(null);
    setFeedbackMessage(null);

    const result = await completeFarmerTask({
      farmId: currentFarmId,
      task,
      isOnline,
    });

    if (result.success) {
      setLastCompletedTask(task);
      setLoopState(LOOP_STATE.COMPLETED);

      // Update counts optimistically
      setCompletedCount((prev) => prev + 1);
      if (result.nextTask) {
        setTaskCount((prev) => Math.max(0, prev - 1));
      } else if (!result.offline) {
        setPrimaryTask(null);
        setTaskCount(0);
      } else {
        setPrimaryTask(null);
        setTaskCount((prev) => Math.max(0, prev - 1));
      }

      // Build feedback message
      const localTitle = getLocalizedTaskTitle(task.id, task.title, lang);
      const nextName = result.nextTask
        ? getLocalizedTaskTitle(result.nextTask.id, result.nextTask.title, lang)
        : null;
      const msg = nextName
        ? `\u2705 ${localTitle}\n${t('loop.next')}: ${nextName}`
        : `\u2705 ${localTitle}`;
      setFeedbackMessage(msg);
      setFeedbackStatus(result.offline ? 'offline' : 'success');

      // Haptic
      if (navigator.vibrate) {
        try { navigator.vibrate(result.offline ? [30, 30, 30] : 50); } catch {}
      }

      // Auto-transition to next state after brief display
      clearTimeout(completionTimerRef.current);
      completionTimerRef.current = setTimeout(() => {
        const nextState = getNextTaskState({
          nextTask: result.nextTask,
          remainingCount: result.nextTask ? taskCount - 1 : 0,
          offline: result.offline,
        });

        if (nextState.loopState === LOOP_STATE.NEXT_READY && result.nextTask) {
          // Load next task directly
          setPrimaryTask(result.nextTask);
          setLoopState(LOOP_STATE.READY);
          safeTrackEvent('loop.next_task_shown', {
            farmId: currentFarmId,
            taskId: result.nextTask.id,
          });
        } else if (nextState.loopState === LOOP_STATE.NEXT_READY) {
          // Need to refetch
          fetchTask(currentFarmId);
        } else {
          setLoopState(LOOP_STATE.ALL_DONE);
          safeTrackEvent('loop.all_done_shown', { farmId: currentFarmId });
        }

        setFeedbackStatus(null);
        setFeedbackMessage(null);
      }, COMPLETION_DISPLAY_MS);
    } else {
      setFeedbackStatus('failed');
      setLoopState(LOOP_STATE.READY); // Return to ready so farmer can retry
    }

    setCompleting(false);
    submitGuardRef.current = false;
  }, [currentFarmId, isOnline, taskCount, lang, t, fetchTask]);

  // ─── Dismiss feedback ────────────────────────────────────
  const dismissFeedback = useCallback(() => {
    setFeedbackStatus(null);
    setFeedbackMessage(null);
  }, []);

  // ─── Retry failed completion ─────────────────────────────
  const retryCompletion = useCallback(() => {
    if (primaryTask) completeTask(primaryTask);
  }, [primaryTask, completeTask]);

  // ─── Refresh (pull to refresh or manual) ─────────────────
  const refreshLoop = useCallback(() => {
    if (currentFarmId) {
      setLoopState(LOOP_STATE.LOADING);
      fetchTask(currentFarmId);
      refreshWeather();
    }
  }, [currentFarmId, fetchTask, refreshWeather]);

  // Cleanup
  useEffect(() => {
    return () => clearTimeout(completionTimerRef.current);
  }, []);

  return {
    // Loop state
    loopState,
    isLoading: profileLoading || loopState === LOOP_STATE.LOADING,
    farmSwitching,

    // Task data
    primaryTask,
    taskCount,
    completedCount,
    completing,
    lastCompletedTask,

    // Decision engine output
    decision,
    taskViewModel: decision.taskViewModel,
    weatherDecision: decision.weatherDecision,

    // Progress
    progress,

    // Feedback
    feedbackStatus,
    feedbackMessage,

    // Actions
    completeTask,
    dismissFeedback,
    retryCompletion,
    refreshLoop,

    // Context pass-through (convenience for Home)
    profile,
    currentFarmId,
    activeFarms,
    isOnline,
    weather,
    autoVoice,
    language,
  };
}
