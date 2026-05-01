/**
 * useDailyEngagement — React hook that gives a surface everything
 * it needs to render the daily engagement layer.
 *
 *   const {
 *     plan,             // generateEngagementPlan output
 *     streak,           // current streak count (int)
 *     activityToday,    // boolean
 *     completeTask,     // (task) → { entry, streak } — bumps streak + history
 *     refresh,          // () → void — manual recompute (rarely needed)
 *   } = useDailyEngagement({ plant, country, region, stage, plantingStatus, weather });
 *
 * The hook subscribes to the `farroway:engagement_changed` window
 * event so a completion in one tab refreshes streak chips in any
 * sibling surface without a parent re-render.
 *
 * Strict-rule audit
 *   • Pure subscriber — no fetch, no DOM mutations.
 *   • Defensive — every storage read is wrapped in try/catch in
 *     the callee modules, so the hook itself can't throw.
 *   • Stable identities for `completeTask` + `refresh` so children
 *     that memo on them don't churn.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { generateEngagementPlan } from '../engine/dailyEngagementEngine.js';
import {
  markTaskCompleted,
  hadActivityToday,
  getRecentCompletions,
  ENGAGEMENT_CHANGE_EVENT,
} from '../engine/engagementHistory.js';
import { getStreak } from '../utils/streak.js';

export default function useDailyEngagement({
  plant            = '',
  country          = '',
  region           = '',
  stage            = null,
  plantingStatus   = null,
  weather          = null,
  farmId           = null,
  farmerType       = null,
} = {}) {
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => {
    setTick((n) => (n + 1) % 1_000_000);
  }, []);

  // Cross-component sync: any markTaskCompleted call (here or
  // elsewhere) emits the change event; we recompute on it.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handler = () => setTick((n) => (n + 1) % 1_000_000);
    try {
      window.addEventListener(ENGAGEMENT_CHANGE_EVENT, handler);
      // Cross-tab: storage events fire when localStorage changes
      // in another tab. Cheap to subscribe; harmless when never fires.
      window.addEventListener('storage', handler);
    } catch { /* swallow */ }
    return () => {
      try {
        window.removeEventListener(ENGAGEMENT_CHANGE_EVENT, handler);
        window.removeEventListener('storage', handler);
      } catch { /* swallow */ }
    };
  }, []);

  const plan = useMemo(() => {
    try {
      return generateEngagementPlan({
        plant, country, region,
        stage, plantingStatus,
        weather, farmerType,
        completions: getRecentCompletions(7),
      });
    } catch {
      // Hard fallback — guaranteed non-empty list so the surface
      // never renders empty even under a runtime error.
      return {
        tasks: [
          {
            id:       'engagement_safe_check',
            titleKey: 'engagement.fallback.checkPlants',
            title:    'Check on your plants today',
            kind:     'fallback',
            priority: 'medium',
          },
        ],
        source: 'fallback',
        stage:  null,
        supported: false,
        scanInjected: false,
        weatherApplied: null,
      };
    }
    // tick triggers recompute on completion / cross-tab change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plant, country, region, stage, plantingStatus, weather, farmerType, tick]);

  const streak = useMemo(() => {
    try { return getStreak(); } catch { return 0; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  const activityToday = useMemo(() => {
    try { return hadActivityToday(); } catch { return false; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  const completeTask = useCallback((task) => {
    if (!task || !task.id) return { entry: null, streak };
    return markTaskCompleted(task.id, {
      plantId: plant || null,
      kind:    task.kind   || 'engine',
      source:  task.source || 'plan_card',
      farmId:  farmId      || null,
    });
  }, [plant, farmId, streak]);

  return { plan, streak, activityToday, completeTask, refresh };
}
