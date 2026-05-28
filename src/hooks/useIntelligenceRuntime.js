/**
 * useIntelligenceRuntime.js — Wave 6 RUNTIME hook.
 *
 *   import { useIntelligenceRuntime } from 'src/hooks/useIntelligenceRuntime.js';
 *
 *   const { produce, recordIntervention, recordOutcome, health }
 *     = useIntelligenceRuntime();
 *
 * What this is
 * ────────────
 *   The React-side entry to the intelligence pipeline. UI surfaces
 *   that need to surface a recommendation MUST use this hook —
 *   never call the underlying engines (in src/core/intelligence/*
 *   or src/intelligence/*) directly. The wave-6 CI guard enforces
 *   this.
 *
 *   The hook returns a stable bag so dependency arrays in calling
 *   components don't churn between renders.
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws. SSR-safe.
 *   • Stable shape across renders (useMemo).
 *   • No model calls happen on render — `produce` is a function
 *     the caller invokes on user intent.
 *   • RUNTIME → RUNTIME (allowed).
 */

import { useMemo } from 'react';
import {
  produceRecommendations, recordIntervention, recordOutcome,
  getIntelligenceHealth,
} from '../runtime/intelligence/intelligenceRuntime.js';

const _STABLE = Object.freeze({
  produce:            produceRecommendations,
  recordIntervention,
  recordOutcome,
  getHealth:          getIntelligenceHealth,
});

export function useIntelligenceRuntime() {
  return useMemo(() => _STABLE, []);
}

const _module = { useIntelligenceRuntime };
export default _module;
