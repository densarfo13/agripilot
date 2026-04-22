/**
 * useFarmInsight — React hook that wires the farm-intelligence
 * orchestrator to the current language and returns a memoised
 * insight payload.
 *
 *   const insight = useFarmInsight({ farm, weather, tasks, issues });
 *
 * The hook just forwards its inputs to getFarmInsight() and passes
 * the current language so crop labels + card titles come out
 * localised. All heavy lifting lives in the pure engine — the hook is
 * intentionally thin so it can be swapped for a server call later.
 */

import { useMemo } from 'react';
import { useTranslation } from '../../i18n/index.js';
import { getFarmInsight } from './farmInsightEngine.js';

export function useFarmInsight({
  farm     = null,
  weather  = null,
  tasks    = [],
  issues   = [],
  completions = [],
  now      = null,
} = {}) {
  const { language } = useTranslation() || {};

  return useMemo(() => getFarmInsight({
    farm, weather, tasks, issues, completions,
    language: language || 'en',
    now,
  }), [farm, weather, tasks, issues, completions, language, now]);
}

export default useFarmInsight;
