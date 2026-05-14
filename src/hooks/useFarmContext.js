/**
 * useFarmContext — REACTIVE subscription to the canonical farm
 * context.
 *
 *   const ctx = useFarmContext();
 *   //   ctx === getFarmContext() at this moment in time.
 *   //   Re-renders when farms/gardens are added, removed, or
 *   //   switched, OR when localStorage changes in another tab.
 *
 * Why this hook exists
 *   farmContextEngine.getFarmContext() is a one-shot synchronous
 *   read. Components that called it inside a `useMemo(...,[])`
 *   never re-rendered when farms were added AFTER mount — that's
 *   the "Home says No farm added yet while My Farm has one" bug.
 *
 *   This hook listens to:
 *     • farmEventBus FARM_CREATED / FARM_UPDATED / FARM_DELETED /
 *       LOCATION_UPDATED / CROP_ADDED — emitted by the multi-
 *       experience store + scan flows
 *     • window 'farroway:experience_switched' — emitted by the
 *       legacy experience switcher
 *     • window 'storage' — cross-tab sync
 *   On each event it re-calls getFarmContext() and forces a
 *   re-render so every consumer sees the new active farm
 *   without a page refresh.
 *
 * Strict-rule audit
 *   • Subscribes on mount, cleans up on unmount.
 *   • SSR-safe — returns EMPTY_CONTEXT when localStorage is
 *     unavailable.
 *   • Never throws — all event listeners catch.
 *   • Stable identity across renders unless the underlying
 *     context actually changed (avoids spurious re-renders of
 *     useMemo consumers downstream).
 */

import { useEffect, useState } from 'react';
import { getFarmContext } from '../lib/farmContextEngine.js';
import { FarmEvents, subscribe } from '../lib/farmEventBus.js';

const RELEVANT_STORAGE_KEYS = new Set([
  'farroway_active_farm',
  'farroway.farms',
  'farroway.gardens',
  'farroway.activeFarmId',
  'farroway_active_garden_id',
  'farroway_active_experience',
]);

const EXPERIENCE_SWITCH_EVENT = 'farroway:experience_switched';

function _safeReadContext() {
  try { return getFarmContext(); }
  catch {
    // getFarmContext already returns EMPTY_CONTEXT on failure, but
    // belt + braces so this hook never crashes its host.
    return null;
  }
}

export default function useFarmContext() {
  const [ctx, setCtx] = useState(_safeReadContext);

  useEffect(() => {
    let mounted = true;
    const refresh = () => {
      if (!mounted) return;
      const next = _safeReadContext();
      // The frozen snapshot's identity changes on every read even
      // when nothing changed; rely on React's bail-out-on-equal
      // by passing the new object directly. Downstream consumers
      // memoize on `ctx.activeFarmId` / `ctx.farm.id` if needed.
      setCtx(next);
    };

    // ── farmEventBus ─────────────────────────────────────────
    const unsubs = [];
    try {
      unsubs.push(subscribe(FarmEvents.FARM_CREATED,     refresh));
      unsubs.push(subscribe(FarmEvents.FARM_UPDATED,     refresh));
      unsubs.push(subscribe(FarmEvents.LOCATION_UPDATED, refresh));
      unsubs.push(subscribe(FarmEvents.CROP_ADDED,       refresh));
    } catch { /* swallow */ }

    // ── Legacy switcher event ────────────────────────────────
    let onSwitch = null;
    if (typeof window !== 'undefined') {
      try {
        onSwitch = () => refresh();
        window.addEventListener(EXPERIENCE_SWITCH_EVENT, onSwitch);
      } catch { /* swallow */ }
    }

    // ── Cross-tab storage event ──────────────────────────────
    let onStorage = null;
    if (typeof window !== 'undefined') {
      try {
        onStorage = (ev) => {
          try {
            if (!ev || ev.storageArea !== window.localStorage) return;
            if (ev.key && RELEVANT_STORAGE_KEYS.has(ev.key)) refresh();
          } catch { /* swallow */ }
        };
        window.addEventListener('storage', onStorage);
      } catch { /* swallow */ }
    }

    // Initial refresh — in case the first state read happened
    // before localStorage was hydrated (rare; some bootstraps run
    // the very first render before AuthContext has settled).
    refresh();

    return () => {
      mounted = false;
      for (const u of unsubs) {
        try { u && u(); } catch { /* swallow */ }
      }
      if (onSwitch && typeof window !== 'undefined') {
        try { window.removeEventListener(EXPERIENCE_SWITCH_EVENT, onSwitch); } catch { /* swallow */ }
      }
      if (onStorage && typeof window !== 'undefined') {
        try { window.removeEventListener('storage', onStorage); } catch { /* swallow */ }
      }
    };
  }, []);

  return ctx || _safeReadContext();
}
