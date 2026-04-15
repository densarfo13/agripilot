/**
 * useFarmDecision — React hook wrapping the decision engine.
 *
 * Reads from ProfileContext, task state, and weather context,
 * then returns a resolved DecisionResult that the dashboard renders.
 *
 * Now also produces:
 *   - taskViewModel: a normalized, render-ready view model (single source of truth)
 *   - weatherDecision: chip, action line, last-updated label, task override info
 *
 * Recalculates automatically when any input changes.
 */
import { useMemo } from 'react';
import { resolveDecision } from '../engine/decisionEngine.js';
import { getWeatherDecision } from '../engine/weatherEngine.js';
import { useTranslation } from '../i18n/index.js';
import { calculateFarmScore } from '../lib/farmScore.js';
import { buildFarmerTaskViewModel } from '../domain/tasks/index.js';
import { useUserMode } from '../context/UserModeContext.jsx';

/**
 * @param {Object} params
 * @param {Object|null} params.profile - Current farm profile
 * @param {Object|null} params.primaryTask - Highest-priority server task
 * @param {number} params.taskCount - Pending task count
 * @param {number} params.completedCount - Completed tasks count
 * @param {Object|null} params.weather - Weather data
 * @param {number|null} params.fetchedAt - Epoch ms when weather was fetched
 * @param {'fresh'|'aging'|'stale'|'none'} params.freshness - Weather staleness
 * @param {boolean} params.isOnline - Network status
 * @param {boolean} params.taskLoading - Whether tasks are still loading
 * @returns {Object} DecisionResult + taskViewModel + weatherDecision + loading
 */
export function useFarmDecision({ profile, primaryTask, taskCount, completedCount, weather, fetchedAt, freshness, isOnline, taskLoading }) {
  const { t, lang } = useTranslation();
  const { isBasic } = useUserMode();

  const setupComplete = useMemo(() => {
    if (!profile) return false;
    return calculateFarmScore(profile).isReady === true;
  }, [profile]);

  const decision = useMemo(() => {
    // While tasks are loading, return a loading sentinel
    if (taskLoading) return null;

    return resolveDecision({
      profile,
      setupComplete,
      primaryTask,
      taskCount,
      completedCount,
      weather,
      isOnline,
    }, t);
  }, [profile, setupComplete, primaryTask, taskCount, completedCount, weather, isOnline, taskLoading, t]);

  // Weather decision — display-ready chip + action + timestamp + override
  const weatherDecision = useMemo(() => {
    const crop = profile?.cropType || profile?.crop || '';
    const stage = profile?.cropStage || '';
    return getWeatherDecision({
      weather,
      crop,
      stage,
      currentTask: primaryTask,
      fetchedAt: fetchedAt || null,
      freshness: freshness || 'none',
    }, t);
  }, [weather, profile, primaryTask, fetchedAt, freshness, t]);

  // Task view model — THE single source of truth for rendering
  const taskViewModel = useMemo(() => {
    if (!decision?.primaryAction) return null;

    return buildFarmerTaskViewModel({
      task: decision.primaryAction.task || primaryTask,
      action: decision.primaryAction,
      weatherGuidance: decision.weatherGuidance,
      language: lang,
      t,
      mode: isBasic ? 'simple' : 'standard',
    });
  }, [decision, primaryTask, lang, t, isBasic]);

  return {
    loading: taskLoading || !decision,
    ...(decision || {
      primaryAction: null,
      todaysPlan: [],
      farmStatus: null,
      secondaryActions: [],
      weatherGuidance: null,
    }),
    taskViewModel,
    weatherDecision,
  };
}
