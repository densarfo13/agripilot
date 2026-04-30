/**
 * useEngagementDay — small React hook for the 7-day engagement
 * loop. Surfaces the four facts the Home / Today surfaces need
 * to drive personalized greetings, day-of-7 indicators, and
 * progressive unlocks:
 *
 *   • dayNumber       0..7   (0 = pre-onboarding)
 *   • tasksCompleted  number monotonic counter from streakStore
 *   • lastActionTime  ISO    (lastCompletionISO from streakStore)
 *   • currentStage    string crop stage (or '' when unknown)
 *
 * Strict rules
 * ────────────
 *   • Pure derivation — no fetch, no API call.
 *   • Subscribes to `farroway:localstore:change` so a write to
 *     the retention store from anywhere in the app re-renders
 *     consumers immediately (matches the existing localStore
 *     event pattern).
 *   • Cross-tab sync via the storage event (free, since
 *     localStore.subscribe handles it).
 *
 * Unlock helpers
 * ──────────────
 * The hook exposes a tiny `unlocks` object so consumers don't
 * scatter `dayNumber >= N` checks across the codebase:
 *
 *   unlocks.scanCrop      → dayNumber >= 3
 *   unlocks.viewFunding   → dayNumber >= 5
 *   unlocks.markSell      → dayNumber >= 6
 *
 * `checkLand` is intentionally NOT in the unlocks map — it's the
 * Day-1 always-available action so the home grid is never empty.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  getRetentionState,
  dayNumber as _dayNumber,
} from '../lib/retention/streakStore.js';

const EVENT = 'farroway:localstore:change';
const STORAGE_KEY = 'farroway:retention:visit';

function _snapshot(profile) {
  const state = getRetentionState();
  const dn = _dayNumber();
  return {
    dayNumber:       dn,
    tasksCompleted:  state.tasksCompleted || 0,
    lastActionTime:  state.lastCompletionISO || null,
    currentStage:    (profile && profile.cropStage) || '',
    unlocks: Object.freeze({
      scanCrop:    dn >= 3,
      viewFunding: dn >= 5,
      markSell:    dn >= 6,
    }),
  };
}

/**
 * @param {object|null} [profile] optional profile object (so the
 *   hook can include `currentStage` without forcing every caller
 *   to import ProfileContext separately). Pass `null` when the
 *   stage isn't needed.
 * @returns {{
 *   dayNumber: number,
 *   tasksCompleted: number,
 *   lastActionTime: string|null,
 *   currentStage: string,
 *   unlocks: { scanCrop: boolean, viewFunding: boolean, markSell: boolean }
 * }}
 */
export default function useEngagementDay(profile = null) {
  const [snap, setSnap] = useState(() => _snapshot(profile));

  const refresh = useCallback(() => {
    setSnap(_snapshot(profile));
  }, [profile]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onChange = () => refresh();
    const onStorage = (e) => {
      if (!e || !e.key) return;
      if (e.key.startsWith('farroway:retention:') || e.key === STORAGE_KEY) {
        refresh();
      }
    };
    window.addEventListener(EVENT, onChange);
    window.addEventListener('storage', onStorage);
    // Recompute when the day flips at midnight — cheap interval.
    const intId = setInterval(refresh, 5 * 60 * 1000);
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener('storage', onStorage);
      clearInterval(intId);
    };
  }, [refresh]);

  // Re-snapshot when the profile id / stage actually changes.
  useEffect(() => { refresh(); }, [profile && profile.id, profile && profile.cropStage, refresh]);

  return snap;
}
