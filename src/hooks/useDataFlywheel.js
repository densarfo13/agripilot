/**
 * useDataFlywheel.js — Phase 14 RUNTIME hook.
 *
 *   const flywheel = useDataFlywheel({
 *     events, farmId, cropId, taskState, scanHistory,
 *     outcomeRecords, region, crop, season, weather,
 *     baseTrust, buyerInputs, programInputs,
 *   });
 *
 * useMemo'd composite. Pure / SSR-safe.
 */

import { useMemo } from 'react';
import { dataFlywheel } from '../runtime/flywheel/index.js';

export function useDataFlywheel(ctx) {
  return useMemo(() => dataFlywheel(ctx || {}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      ctx && ctx.now,
      ctx && ctx.events,
      ctx && ctx.farmId,
      ctx && ctx.cropId,
      ctx && ctx.taskState,
      ctx && ctx.scanHistory,
      ctx && ctx.outcomeRecords,
      ctx && ctx.region,
      ctx && ctx.crop,
      ctx && ctx.season,
      ctx && ctx.weather,
      ctx && ctx.sampleSize,
      ctx && ctx.baseTrust,
      ctx && ctx.buyerInputs,
      ctx && ctx.programInputs,
    ]);
}

const _module = { useDataFlywheel };
export default _module;
