/**
 * useActionabilityResponses — exposes the decision engine's
 * per-surface responses as small useMemo-d selectors, so each
 * screen can read the hints relevant to it.
 *
 * Usage:
 *   const { onboarding, recommendation, today, listing, meta } =
 *     useActionabilityResponses(snapshot);
 *   if (onboarding.manualShortcut) { ... }
 *   if (recommendation.fallbackMode === 'manual_crop_search') { ... }
 *
 * The hook is a pure read on `snapshot.responses` with stable
 * empty-object defaults — calling components don't need to null-check.
 */

import { useMemo } from 'react';

const EMPTY = Object.freeze({});

export function useActionabilityResponses(snapshot) {
  return useMemo(() => {
    const r = snapshot?.responses || {};
    return {
      onboarding:     r.onboarding     || EMPTY,
      recommendation: r.recommendation || EMPTY,
      today:          r.today          || EMPTY,
      listing:        r.listing        || EMPTY,
      meta: {
        hasAnyAction:     !!r.meta?.hasAnyAction,
        highestPriority:  r.meta?.highestPriority ?? null,
        contextKey:       r.meta?.contextKey ?? null,
      },
    };
  }, [snapshot]);
}

export default useActionabilityResponses;
