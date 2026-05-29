/**
 * useFarmIntelligence.js — Phase 10 RUNTIME hook.
 *
 *   const intel = useFarmIntelligence({
 *     farm,            // canonical active farm
 *     healthSignals,
 *     riskSignals,
 *     forecast,
 *     cropInput,
 *     trustSignals,
 *   });
 *
 * Returns the frozen composite envelope from
 * computeFarmIntelligence(). useMemo-ed so consumers can pass it
 * down without dependency churn. SSR-safe.
 */

import { useMemo } from 'react';
import {
  computeFarmIntelligence,
} from '../runtime/farmIntelligence/index.js';

export function useFarmIntelligence(ctx) {
  return useMemo(() => computeFarmIntelligence(ctx || {}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      ctx && ctx.farm,
      ctx && ctx.healthSignals,
      ctx && ctx.riskSignals,
      ctx && ctx.forecast,
      ctx && ctx.cropInput,
      ctx && ctx.trustSignals,
    ]);
}

const _module = { useFarmIntelligence };
export default _module;
