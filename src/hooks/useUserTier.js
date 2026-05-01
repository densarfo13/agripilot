/**
 * useUserTier — React subscription to the user-tier store.
 *
 *   const { tier, isPro, isFree, setTier } = useUserTier();
 *
 * Re-renders the consumer on `farroway:tier_changed` (same-tab) +
 * the `storage` event (cross-tab). Defensive — never throws.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  getUserTier,
  setUserTier,
  TIER_FREE,
  TIER_PRO,
  TIER_CHANGED_EVENT,
} from '../monetization/userTier.js';

export default function useUserTier() {
  const [tier, setTierState] = useState(() => {
    try { return getUserTier(); } catch { return TIER_FREE; }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handler = () => {
      try { setTierState(getUserTier()); } catch { /* swallow */ }
    };
    try {
      window.addEventListener(TIER_CHANGED_EVENT, handler);
      window.addEventListener('storage', handler);
    } catch { /* swallow */ }
    return () => {
      try {
        window.removeEventListener(TIER_CHANGED_EVENT, handler);
        window.removeEventListener('storage', handler);
      } catch { /* swallow */ }
    };
  }, []);

  const setTier = useCallback((next) => {
    try { return setUserTier(next); } catch { return tier; }
  }, [tier]);

  return {
    tier,
    isPro:  tier === TIER_PRO,
    isFree: tier === TIER_FREE,
    setTier,
  };
}
