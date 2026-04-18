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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { getAutopilotDecision } from '../engine/autopilot/index.js';
import { getSuccessTextKey } from '../engine/autopilot/textKeys.js';
import { buildCompletionState } from '../domain/tasks/buildCompletionState.js';
import { logActivity } from '../services/activityLogger.js';

// Fallback auto-transition delay — only fires if user doesn't tap Continue/Later.
// Long enough that it never fires during normal use (user always taps first).
const COMPLETION_FALLBACK_MS = 30000;

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
  const [allPendingTasks, setAllPendingTasks] = useState([]);
  const [taskCount, setTaskCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [taskLoading, setTaskLoading] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [lastCompletedTask, setLastCompletedTask] = useState(null);
  const [feedbackStatus, setFeedbackStatus] = useState(null); // 'success'|'offline'|'failed'
  const [feedbackMessage, setFeedbackMessage] = useState(null);
  const [lastSuccessText, setLastSuccessText] = useState(null);
  const [completionState, setCompletionState] = useState(null);
  // Holds the server-returned next task during completion display (not loaded yet)
  const pendingNextRef = useRef(null);

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

  // ─── Autopilot decision (enriches primary task) ─────────
  const autopilot = useMemo(() => {
    if (!primaryTask) return null;
    const cropStage = profile?.cropStage || '';
    const crop = profile?.cropType || profile?.crop || '';
    return getAutopilotDecision({
      farm: profile,
      crop,
      cropStage,
      weather,
      primaryTask,
      pendingTasks: allPendingTasks,
      completedCount,
    });
  }, [primaryTask, profile, weather, allPendingTasks, completedCount]);

  // ─── Fetch primary task ──────────────────────────────────
  const fetchTask = useCallback(async (farmId) => {
    if (!farmId) return;
    setTaskLoading(true);

    const result = await getCurrentFarmerTask({ farmId, isOnline });

    setPrimaryTask(result.task);
    setAllPendingTasks(result.tasks || []);
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
      // Autopilot tracking: task generated
      const cropStageLocal = profile?.cropStage || '';
      const cropLocal = profile?.cropType || profile?.crop || '';
      const ap = getAutopilotDecision({
        farm: profile, crop: cropLocal, cropStage: cropStageLocal,
        weather, primaryTask: result.task,
        pendingTasks: result.tasks || [], completedCount: result.completedCount,
      });
      safeTrackEvent('autopilot_task_generated', {
        farmId, taskId: result.task.id, ruleId: ap.ruleId || null,
        confidence: ap.confidence, severity: ap.severity,
        hasWhy: !!ap.whyKey, hasRisk: !!ap.riskKey, hasNext: !!ap.nextTaskType,
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
      setCompletionState(null);
      pendingNextRef.current = null;
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
    setCompletionState(null);

    const result = await completeFarmerTask({
      farmId: currentFarmId,
      task,
      isOnline,
    });

    if (result.success) {
      logActivity('action_completed', { taskType: task?.type, taskId: task?.id }, { farmId: currentFarmId });
      setLastCompletedTask(task);
      setLoopState(LOOP_STATE.COMPLETED);

      // Update counts optimistically
      const newCompleted = completedCount + 1;
      setCompletedCount(newCompleted);
      let newRemaining;
      if (result.nextTask) {
        newRemaining = Math.max(0, taskCount - 1);
        setTaskCount(newRemaining);
      } else if (!result.offline) {
        setPrimaryTask(null);
        newRemaining = 0;
        setTaskCount(0);
      } else {
        setPrimaryTask(null);
        newRemaining = Math.max(0, taskCount - 1);
        setTaskCount(newRemaining);
      }

      // Resolve success text from autopilot
      const vm = decision.taskViewModel;
      const successLine = vm?.successText || t('success.general');
      setLastSuccessText(successLine);

      // Store pending next task for user-driven transition
      pendingNextRef.current = result.nextTask || null;

      // Build localized next task title
      const nextName = result.nextTask
        ? getLocalizedTaskTitle(result.nextTask.id, result.nextTask.title, lang)
        : null;

      // Build structured completion state
      const cs = buildCompletionState({
        completedTask: task,
        taskViewModel: vm,
        nextTask: result.nextTask || null,
        completedCount: newCompleted,
        remainingCount: newRemaining,
        savedOffline: result.offline,
        nextTaskTitle: nextName,
      });
      setCompletionState(cs);

      // Also set feedback for banner (backward compat)
      const localTitle = getLocalizedTaskTitle(task.id, task.title, lang);
      const msg = `\u2705 ${localTitle}\n${successLine}`;
      setFeedbackMessage(msg);
      setFeedbackStatus(result.offline ? 'offline' : 'success');

      if (result.offline) {
        safeTrackEvent('autopilot_saved_offline', {
          farmId: currentFarmId,
          taskId: task?.id,
        });
      }

      // Track completion
      safeTrackEvent('task_completed', {
        farmId: currentFarmId,
        taskId: task?.id,
        ruleId: vm?.autopilotRuleId || null,
        hasNext: !!result.nextTask,
        offline: result.offline,
      });
      safeTrackEvent('autopilot_task_completed', {
        farmId: currentFarmId,
        taskId: task?.id,
        ruleId: vm?.autopilotRuleId || null,
        hasNext: !!result.nextTask,
        offline: result.offline,
      });

      // Safety fallback: auto-transition after long timeout in case user doesn't tap
      clearTimeout(completionTimerRef.current);
      completionTimerRef.current = setTimeout(() => {
        transitionAfterCompletion(result.nextTask, result.offline);
      }, COMPLETION_FALLBACK_MS);
    } else {
      setFeedbackStatus('failed');
      setLoopState(LOOP_STATE.READY);
    }

    setCompleting(false);
    submitGuardRef.current = false;
  }, [currentFarmId, isOnline, taskCount, completedCount, lang, t, fetchTask, decision]);

  // ─── Transition helper (shared by continue + fallback) ──
  const transitionAfterCompletion = useCallback((nextTask, offline) => {
    clearTimeout(completionTimerRef.current);
    setCompletionState(null);
    setFeedbackStatus(null);
    setFeedbackMessage(null);

    const nextState = getNextTaskState({
      nextTask,
      remainingCount: nextTask ? taskCount - 1 : 0,
      offline,
    });

    if (nextState.loopState === LOOP_STATE.NEXT_READY && nextTask) {
      setPrimaryTask(nextTask);
      setLoopState(LOOP_STATE.READY);
      safeTrackEvent('loop.next_task_shown', {
        farmId: currentFarmId,
        taskId: nextTask.id,
      });
      safeTrackEvent('autopilot_next_task_ready', {
        farmId: currentFarmId,
        taskId: nextTask.id,
      });
    } else if (nextState.loopState === LOOP_STATE.NEXT_READY) {
      fetchTask(currentFarmId);
    } else {
      setLoopState(LOOP_STATE.ALL_DONE);
      safeTrackEvent('loop.all_done_shown', { farmId: currentFarmId });
    }
  }, [currentFarmId, taskCount, fetchTask]);

  // ─── User taps "Continue" — load next task ──────────────
  const continueAfterCompletion = useCallback(() => {
    safeTrackEvent('continue_clicked', { farmId: currentFarmId });
    const nextTask = pendingNextRef.current;
    const offline = completionState?.savedOffline || false;
    pendingNextRef.current = null;
    transitionAfterCompletion(nextTask, offline);
  }, [currentFarmId, completionState, transitionAfterCompletion]);

  // ─── User taps "Later" — go to updated home / all done ──
  const dismissCompletion = useCallback(() => {
    safeTrackEvent('later_clicked', { farmId: currentFarmId });
    clearTimeout(completionTimerRef.current);
    setCompletionState(null);
    setFeedbackStatus(null);
    setFeedbackMessage(null);
    pendingNextRef.current = null;

    // Show all_done or refetch to show updated home
    if (taskCount <= 0) {
      setLoopState(LOOP_STATE.ALL_DONE);
    } else {
      fetchTask(currentFarmId);
    }
  }, [currentFarmId, taskCount, fetchTask]);

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

    // Autopilot intelligence
    autopilot,
    lastSuccessText,

    // Completion flow
    completionState,
    continueAfterCompletion,
    dismissCompletion,

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
