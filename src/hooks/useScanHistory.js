/**
 * useScanHistory.js — RUNTIME hook for read-side scan history access.
 *
 *   import { useScanHistory } from 'src/hooks/useScanHistory.js';
 *   const { entries, getEntry } = useScanHistory();
 *
 * Why this hook exists
 * ────────────────────
 *   Architecture migration (layered governance): UI surfaces must
 *   NOT import the SERVICE-layer store `src/data/scanHistory.js`
 *   directly. They subscribe to this RUNTIME hook instead, which
 *   wraps the underlying store and adds:
 *
 *     • subscription to the cross-tab `storage` event so the list
 *       auto-refreshes when another tab writes a new scan
 *     • a stable `getEntry(id)` reader memoized against the latest
 *       entries snapshot
 *     • SSR-safe initialization (returns an empty list when window
 *       is undefined; the underlying read is wrapped in try/catch)
 *
 *   This is a pure-read facade — for write operations (save / mark
 *   task added / create follow-up tasks), surfaces still use
 *   `scanPersistenceBridge.js` via the runtime.
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws.
 *   • SSR-safe (window guards).
 *   • Subscribes to `storage` event on mount; cleans up on unmount.
 *   • Does not own state ScanRuntime already manages — this hook is
 *     ONLY for the historical journal list, not the live scan.
 *   • Bridge layer: hook calls SERVICE (data/scanHistory.js).
 *     RUNTIME → SERVICE is allowed by ALLOWED_IMPORTS.
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { getScanHistory, getScanEntry } from '../data/scanHistory.js';

const STORAGE_KEY = 'farroway_scan_history';

function _readHistory() {
  try {
    const list = getScanHistory();
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/**
 * Subscribe to the local scan history. The returned `entries` array
 * is a stable reference per render; it updates when another tab
 * writes (cross-tab `storage` event) or when the component remounts.
 *
 *   @returns {{
 *     entries: Array<object>,
 *     getEntry: (id: string) => object | null,
 *     refresh: () => void,
 *   }}
 */
export function useScanHistory() {
  const [entries, setEntries] = useState(_readHistory);

  const refresh = useCallback(() => {
    setEntries(_readHistory());
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onStorage = (e) => {
      if (!e || e.key === STORAGE_KEY || e.key === null) {
        refresh();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [refresh]);

  // Stable reader — falls back to the underlying store if the id
  // isn't in the current snapshot (e.g. a write that happened in
  // the same tab between renders).
  const getEntry = useCallback((id) => {
    if (!id) return null;
    const hit = entries.find((e) => e && (e.id === id || e.scanId === id));
    if (hit) return hit;
    try { return getScanEntry(id) || null; } catch { return null; }
  }, [entries]);

  return useMemo(() => ({
    entries, getEntry, refresh,
  }), [entries, getEntry, refresh]);
}

const _module = { useScanHistory };
export default _module;
