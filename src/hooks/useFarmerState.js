/**
 * useFarmerState — React hook wrapper around resolveFarmerState.
 *
 *   const state = useFarmerState({
 *     farmerProfile, cropProfile, landProfile,
 *     countryCode, month,
 *     weatherNow, cameraTask, recentEvents,
 *     offlineState, lastUpdatedAt,
 *     hasCompletedOnboarding, hasActiveCropCycle,
 *     hasJustCompletedHarvest, hasCatchUpState, missedDays,
 *     primaryTaskId,
 *   });
 *
 * Returns the full FarmerState object from stateEngine.js. The
 * hook uses useMemo keyed on a stable serialization of the
 * consumed context fields so React can skip re-computing the
 * state when nothing relevant changed.
 */

import { useMemo } from 'react';
import { resolveFarmerState } from '../utils/farmerState/index.js';

export function useFarmerState(ctx = {}) {
  const key = useMemo(() => stableKey(ctx), [ctx]);
  return useMemo(() => resolveFarmerState(ctx || {}), [key]); // eslint-disable-line react-hooks/exhaustive-deps
}

function stableKey(ctx) {
  if (!ctx || typeof ctx !== 'object') return '';
  const parts = [];
  // Scalar fields
  for (const f of [
    'countryCode', 'month',
    'hasCompletedOnboarding', 'hasActiveCropCycle',
    'hasJustCompletedHarvest', 'hasCatchUpState',
    'missedDays', 'lastUpdatedAt', 'primaryTaskId', 'regionBucket',
  ]) {
    const v = ctx[f];
    if (v != null) parts.push(`${f}=${String(v)}`);
  }
  // Nested objects — only the fields the engine reads
  if (ctx.cropProfile) {
    parts.push('crop=' + (ctx.cropProfile.name || '') + '|' +
                         (ctx.cropProfile.stage || '') + '|' +
                         (ctx.cropProfile.phase || ''));
  }
  if (ctx.landProfile) {
    parts.push('land=' + (ctx.landProfile.blocker || '') + '|' +
                         (ctx.landProfile.moisture || '') + '|' +
                         (ctx.landProfile.cleared == null ? '' : String(ctx.landProfile.cleared)) + '|' +
                         (ctx.landProfile.source || ''));
  }
  if (ctx.weatherNow) {
    parts.push('weather=' + (ctx.weatherNow.rainRisk || '') + '|' +
                            (ctx.weatherNow.heatRisk || '') + '|' +
                            (ctx.weatherNow.rainMmNext24h ?? '') + '|' +
                            (ctx.weatherNow.tempHighC ?? ''));
  }
  if (ctx.cameraTask) {
    parts.push('cam=' + (ctx.cameraTask.type || ''));
  }
  if (ctx.offlineState) {
    parts.push('offline=' + !!ctx.offlineState.isOffline);
  }
  const re = Array.isArray(ctx.recentEvents) ? ctx.recentEvents : [];
  parts.push('events=' + re.length + ':' + re.slice(-3).map((e) => e?.type).join('|'));
  return parts.join('#');
}

export default useFarmerState;
