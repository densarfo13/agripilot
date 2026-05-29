/**
 * useDailyGrow.ts — Phase 16 RUNTIME hook.
 *
 *   const today = useDailyGrow({
 *     growType, plantId, weather, weatherForecast, region,
 *     country, state, district, plantedAt, growthDays,
 *     soilData, scanResults, recentScans,
 *     lastWateredAt, lastFertilizedAt, lastRepottedAt,
 *     ambient, plantsInGarden, haveInGarden,
 *     plantHealthScores, wateringCompliance, growthRate,
 *   });
 *
 * useMemo'd. Pure / SSR-safe.
 */

import { useMemo } from 'react';
import { dailyGrowEngine } from '../intelligence/dailyGrowEngine';

export function useDailyGrow(ctx: any) {
  return useMemo(() => dailyGrowEngine((ctx || {}) as any),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      ctx && ctx.now,
      ctx && ctx.growType,
      ctx && ctx.plantId,
      ctx && ctx.plantType,
      ctx && ctx.weather,
      ctx && ctx.weatherForecast,
      ctx && ctx.region,
      ctx && ctx.country,
      ctx && ctx.state,
      ctx && ctx.district,
      ctx && ctx.plantedAt,
      ctx && ctx.growthDays,
      ctx && ctx.growthStage,
      ctx && ctx.soilData,
      ctx && ctx.scanResults,
      ctx && ctx.recentScans,
      ctx && ctx.lastWateredAt,
      ctx && ctx.lastFertilizedAt,
      ctx && ctx.lastRepottedAt,
      ctx && ctx.ambient,
      ctx && ctx.plantsInGarden,
      ctx && ctx.haveInGarden,
      ctx && ctx.plantHealthScores,
      ctx && ctx.wateringCompliance,
      ctx && ctx.growthRate,
      ctx && ctx.marketOpportunity,
      ctx && ctx.satelliteInputs,
    ]);
}

const _module = { useDailyGrow };
export default _module;
