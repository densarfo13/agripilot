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
 * Performance: uses structural hashing to prevent redundant decision engine runs
 * when context objects change reference but not value (e.g., ProfileContext re-renders
 * due to syncStatus change while profile data is identical).
 */
import { useMemo, useRef } from 'react';
import { resolveDecision } from '../engine/decisionEngine.js';
import { getWeatherDecision } from '../engine/weatherEngine.js';
import { useTranslation } from '../i18n/index.js';
import { calculateFarmScore } from '../lib/farmScore.js';
import { buildFarmerTaskViewModel } from '../domain/tasks/index.js';
import { useUserMode } from '../context/UserModeContext.jsx';
import { useForecast } from '../context/ForecastContext.jsx';

/**
 * Build a lightweight fingerprint of decision-relevant fields.
 * Only re-run the engine when these actually change.
 */
function inputHash(profile, primaryTask, taskCount, completedCount, weather, isOnline, lang) {
  const p = profile;
  const w = weather;
  return [
    p?.id, p?.cropType, p?.cropStage, p?.cropStageUpdatedAt, p?.lastActivityDate,
    primaryTask?.id, primaryTask?.priority,
    taskCount, completedCount,
    w?.temp, w?.humidity, w?.windSpeed, w?.rainingNow, w?.rainTodayLikely,
    isOnline, lang,
  ].join('|');
}

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
  const { rainfall } = useForecast();
  const prevHashRef = useRef('');
  const prevDecisionRef = useRef(null);

  const setupComplete = useMemo(() => {
    if (!profile) return false;
    return calculateFarmScore(profile).isReady === true;
  }, [profile]);

  const decision = useMemo(() => {
    // While tasks are loading, return a loading sentinel
    if (taskLoading) return null;

    // Structural comparison: skip re-computation if meaningful inputs unchanged
    const hash = inputHash(profile, primaryTask, taskCount, completedCount, weather, isOnline, lang);
    if (hash === prevHashRef.current && prevDecisionRef.current) {
      return prevDecisionRef.current;
    }

    const result = resolveDecision({
      profile,
      setupComplete,
      primaryTask,
      taskCount,
      completedCount,
      weather,
      isOnline,
    }, t);

    prevHashRef.current = hash;
    prevDecisionRef.current = result;
    return result;
  }, [profile, setupComplete, primaryTask, taskCount, completedCount, weather, isOnline, taskLoading, t, lang]);

  // Enrich weather with 7-day forecast total when available
  const enrichedWeather = useMemo(() => {
    if (!weather) return weather;
    if (!rainfall || !rainfall.totalRainMm) return weather;
    return { ...weather, forecastRainWeekMm: rainfall.totalRainMm };
  }, [weather, rainfall]);

  // Weather decision — display-ready chip + action + timestamp + override
  const weatherDecision = useMemo(() => {
    const crop = profile?.cropType || profile?.crop || '';
    const stage = profile?.cropStage || '';
    return getWeatherDecision({
      weather: enrichedWeather,
      crop,
      stage,
      currentTask: primaryTask,
      fetchedAt: fetchedAt || null,
      freshness: freshness || 'none',
    }, t);
  }, [enrichedWeather, profile, primaryTask, fetchedAt, freshness, t]);

  // Task view model — THE single source of truth for rendering
  const taskViewModel = useMemo(() => {
    if (!decision?.primaryAction) return null;

    const cropStage = profile?.cropStage || '';
    return buildFarmerTaskViewModel({
      task: decision.primaryAction.task || primaryTask,
      action: decision.primaryAction,
      weatherGuidance: decision.weatherGuidance,
      language: lang,
      t,
      mode: isBasic ? 'simple' : 'standard',
      cropStage,
      weather,
      rainfall,
      crop: profile?.cropType || profile?.crop || null,
    });
  }, [decision, primaryTask, lang, t, isBasic, profile, weather, rainfall]);

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
