/**
 * useNetworkIntelligence.js — Phase 12 RUNTIME hook.
 *
 *   const net = useNetworkIntelligence({
 *     events, scanHistory, dailyHealthSnapshots, ...
 *   });
 *
 * useMemo'd composite. Pure / SSR-safe.
 */

import { useMemo } from 'react';
import { networkIntelligence }
  from '../runtime/intelligenceNetwork/index.js';

export function useNetworkIntelligence(ctx) {
  return useMemo(() => networkIntelligence(ctx || {}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      ctx && ctx.now,
      ctx && ctx.windowDays,
      ctx && ctx.events,
      ctx && ctx.scanHistory,
      ctx && ctx.dailyHealthSnapshots,
      ctx && ctx.dailyRiskSnapshots,
      ctx && ctx.outcomeRecords,
      ctx && ctx.farmMetrics,
      ctx && ctx.benchmarkData,
      ctx && ctx.regionalSignals,
      ctx && ctx.pendingScanRecords,
      ctx && ctx.pendingTaskRecords,
      ctx && ctx.pendingOutcomeRecords,
    ]);
}

const _module = { useNetworkIntelligence };
export default _module;
