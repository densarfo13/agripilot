/**
 * useFarmDecision — React hook wrapping the decision engine.
 *
 * Reads from ProfileContext, task state, and weather context,
 * then returns a resolved DecisionResult that the dashboard renders.
 *
 * Recalculates automatically when any input changes.
 */
import { useMemo } from 'react';
import { resolveDecision } from '../engine/decisionEngine.js';
import { useTranslation } from '../i18n/index.js';
import { calculateFarmScore } from '../lib/farmScore.js';

/**
 * @param {Object} params
 * @param {Object|null} params.profile - Current farm profile
 * @param {Object|null} params.primaryTask - Highest-priority server task
 * @param {number} params.taskCount - Pending task count
 * @param {number} params.completedCount - Completed tasks count
 * @param {Object|null} params.weather - Weather data
 * @param {boolean} params.isOnline - Network status
 * @param {boolean} params.taskLoading - Whether tasks are still loading
 * @returns {import('../engine/decisionTypes.js').DecisionResult & { loading: boolean }}
 */
export function useFarmDecision({ profile, primaryTask, taskCount, completedCount, weather, isOnline, taskLoading }) {
  const { t } = useTranslation();

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

  return {
    loading: taskLoading || !decision,
    ...(decision || {
      primaryAction: null,
      todaysPlan: [],
      farmStatus: null,
      secondaryActions: [],
    }),
  };
}
