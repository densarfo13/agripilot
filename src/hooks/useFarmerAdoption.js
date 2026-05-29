/**
 * useFarmerAdoption.js — Phase 13 RUNTIME hook.
 *
 *   const adoption = useFarmerAdoption({
 *     farm, scanHistory, taskState, events, sessionLog,
 *     dailyHealthSnapshots, dailyYieldSnapshots,
 *     referralLog, communitySignals, regionLabel,
 *     riskEnvelope, weatherForecast, cropStage, sentLog,
 *   });
 *
 * useMemo'd composite. Pure / SSR-safe.
 */

import { useMemo } from 'react';
import { farmerAdoption } from '../runtime/adoption/index.js';

export function useFarmerAdoption(ctx) {
  return useMemo(() => farmerAdoption(ctx || {}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      ctx && ctx.now,
      ctx && ctx.farm,
      ctx && ctx.scanHistory,
      ctx && ctx.taskState,
      ctx && ctx.events,
      ctx && ctx.sessionLog,
      ctx && ctx.dailyHealthSnapshots,
      ctx && ctx.dailyYieldSnapshots,
      ctx && ctx.referralLog,
      ctx && ctx.communitySignals,
      ctx && ctx.regionLabel,
      ctx && ctx.riskEnvelope,
      ctx && ctx.weatherForecast,
      ctx && ctx.cropStage,
      ctx && ctx.sentLog,
    ]);
}

const _module = { useFarmerAdoption };
export default _module;
