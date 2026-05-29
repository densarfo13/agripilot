/**
 * useGardenPlatform.js — Phase 1-15 grow platform hook.
 *
 *   const platform = useGardenPlatform({
 *     growType, gardens, activeGardenId, plants, focusPlantId,
 *     weather, season, region, scanResult,
 *     lastWateredAt, lastFertilizedAt, lastRepottedAt, ambient,
 *     healthScores, bloomScores,
 *     assistantQuestion,
 *   });
 *
 * useMemo'd composite. Pure / SSR-safe.
 */

import { useMemo } from 'react';
import { gardenPlatform } from '../runtime/grow/index.js';

export function useGardenPlatform(ctx) {
  return useMemo(() => gardenPlatform(ctx || {}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      ctx && ctx.now,
      ctx && ctx.growType,
      ctx && ctx.gardens,
      ctx && ctx.activeGardenId,
      ctx && ctx.plants,
      ctx && ctx.focusPlantId,
      ctx && ctx.weather,
      ctx && ctx.season,
      ctx && ctx.region,
      ctx && ctx.scanResult,
      ctx && ctx.lastWateredAt,
      ctx && ctx.lastFertilizedAt,
      ctx && ctx.lastRepottedAt,
      ctx && ctx.ambient,
      ctx && ctx.healthScores,
      ctx && ctx.bloomScores,
      ctx && ctx.assistantQuestion,
      ctx && ctx.libraryType,
      ctx && ctx.libraryLimit,
      ctx && ctx.libraryOffset,
    ]);
}

const _module = { useGardenPlatform };
export default _module;
