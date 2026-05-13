/**
 * usePlantTimeline — read + append plant timeline entries.
 *
 *   const {
 *     entries,             // newest-first list
 *     recent,              // top 10 newest
 *     count,               // total entries on file
 *     append,              // (input) → Entry — append a new milestone
 *     hasFirstScan,        // boolean — for delight detection
 *     hasFirstFlower,
 *     hasFirstFruit,
 *   } = usePlantTimeline();
 *
 * Subscribes to `farroway:plant_timeline_changed` (same-tab) and
 * `storage` (cross-tab) so the Home companion card stays in sync
 * with the My Grow timeline.
 *
 * Strict-rule audit
 *   • Hooks called unconditionally.
 *   • Never throws — every store call wrapped.
 *   • No async work.
 *   • SSR-safe.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  appendTimelineEntry, getTimelineEntries, getRecentEntries,
  getCountByType, TIMELINE_STORE_KEY, TIMELINE_TYPES,
} from '../lib/plant/timelineStore.js';

export default function usePlantTimeline(recentLimit = 10) {
  const [entries, setEntries] = useState(() => {
    try { return getTimelineEntries(); } catch { return []; }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const refresh = () => {
      try { setEntries(getTimelineEntries()); } catch { /* swallow */ }
    };
    const onStorage = (ev) => {
      try {
        if (ev?.key === TIMELINE_STORE_KEY) refresh();
      } catch { /* swallow */ }
    };

    try {
      window.addEventListener('farroway:plant_timeline_changed', refresh);
      window.addEventListener('storage', onStorage);
    } catch { /* swallow */ }
    return () => {
      try {
        window.removeEventListener('farroway:plant_timeline_changed', refresh);
        window.removeEventListener('storage', onStorage);
      } catch { /* swallow */ }
    };
  }, []);

  const append = useCallback((input) => {
    try {
      const entry = appendTimelineEntry(input);
      // Optimistic local update — store dispatches its own event,
      // but updating state here too avoids a one-frame lag on the
      // same tab.
      try { setEntries((prev) => [...prev, entry].slice(-100).reverse()); }
      catch { /* swallow */ }
      return entry;
    } catch { return null; }
  }, []);

  const recent = useMemo(() => {
    try { return getRecentEntries(recentLimit); } catch { return entries.slice(0, recentLimit); }
   
  }, [entries, recentLimit]);

  const flags = useMemo(() => {
    try {
      return {
        hasFirstScan:   getCountByType(TIMELINE_TYPES.SCAN_SAVED)     > 0,
        hasFirstFlower: getCountByType(TIMELINE_TYPES.FLOWER_NOTE)    > 0,
        hasFirstFruit:  getCountByType(TIMELINE_TYPES.FRUIT_NOTE)     > 0,
        firstScanIsRecent:
          getCountByType(TIMELINE_TYPES.SCAN_SAVED) > 0
          && getCountByType(TIMELINE_TYPES.SCAN_SAVED) === 1,
      };
    } catch {
      return { hasFirstScan: false, hasFirstFlower: false, hasFirstFruit: false, firstScanIsRecent: false };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries]);

  return {
    entries,
    recent,
    count: entries.length,
    append,
    ...flags,
  };
}

export { usePlantTimeline };
