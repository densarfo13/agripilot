/**
 * useGrowMode — React hook for farroway_active_grow_mode.
 *
 * Returns { mode, setMode } where:
 *   mode    — 'farm' | 'garden'  (current persisted choice)
 *   setMode — (m: string) => void  (writes + dispatches event)
 *
 * Re-renders on:
 *   • GROW_MODE_EVENT  — same-tab toggle (ExperienceTabs.go())
 *   • storage event    — cross-tab sync (key === GROW_MODE_KEY)
 *
 * Rules
 *   • All hooks unconditional — rules-of-hooks safe.
 *   • Never throws.
 *   • No network, no blocking render.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  readGrowMode, writeGrowMode,
  GROW_MODE_EVENT, GROW_MODE_KEY,
} from '../lib/growMode.js';

export default function useGrowMode() {
  const [mode, setModeState] = useState(readGrowMode);

  useEffect(() => {
    const refresh = () => setModeState(readGrowMode());

    const onStorage = (ev) => {
      try {
        if (ev?.key === GROW_MODE_KEY) refresh();
      } catch { /* swallow */ }
    };

    try {
      if (typeof window !== 'undefined') {
        window.addEventListener(GROW_MODE_EVENT, refresh);
        window.addEventListener('storage', onStorage);
      }
    } catch { /* swallow */ }

    return () => {
      try {
        if (typeof window !== 'undefined') {
          window.removeEventListener(GROW_MODE_EVENT, refresh);
          window.removeEventListener('storage', onStorage);
        }
      } catch { /* swallow */ }
    };
  }, []);

  const setMode = useCallback((m) => {
    writeGrowMode(m);
    // Optimistic local update so the caller's render fires
    // before the event listener round-trip completes.
    setModeState(m === 'garden' ? 'garden' : 'farm');
  }, []);

  return { mode, setMode };
}

export { useGrowMode };
