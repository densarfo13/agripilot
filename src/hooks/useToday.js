/**
 * useToday.js — Phase 11 RUNTIME hook.
 *
 *   const today = useToday({
 *     farm, tasks, forecast, riskSignals, healthSignals,
 *     scanHistory, events, counts,
 *   });
 *
 * useMemo'd composite over the today-engine pure function. Stable
 * shape per render. SSR-safe.
 */

import { useMemo } from 'react';
import { todayEngine } from '../runtime/today/index.js';

export function useToday(ctx) {
  return useMemo(() => todayEngine(ctx || {}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      ctx && ctx.farm,
      ctx && ctx.tasks,
      ctx && ctx.forecast,
      ctx && ctx.riskSignals,
      ctx && ctx.healthSignals,
      ctx && ctx.scanHistory,
      ctx && ctx.events,
      ctx && ctx.counts,
      ctx && ctx.now,
    ]);
}

const _module = { useToday };
export default _module;
