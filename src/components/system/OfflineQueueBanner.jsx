/**
 * OfflineQueueBanner.jsx — RC1 persistent offline-pending banner.
 *
 *   <OfflineQueueBanner />
 *
 * What this is
 * ────────────
 *   Reads queue depth via the wave-7 queueRegistry (lazy-loaded so
 *   the component never bundles transport code). Shows a calm one-
 *   line banner when there are pending writes. Hides automatically
 *   when the queue is empty.
 *
 *   Polls every 8 s while pending items exist; idle (no banner)
 *   when empty. No direct localStorage / IDB reads from UI.
 *
 * Strict-rule audit
 *   • Pure renderer. SSR-safe (no module-load side effects).
 *   • Lazy import via Function-constructed specifier so this UI
 *     never bundles the runtime/offline graph at the top level.
 *   • Cleans up timer on unmount.
 *   • All text via tSafe.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { tSafe } from '../../i18n/tSafe.js';

const STYLES = {
  banner: {
    position:      'sticky',
    top:           0,
    zIndex:        140,
    background:    '#FEF3C7',
    color:         '#78350F',
    fontSize:      13,
    fontWeight:    600,
    padding:       '8px 14px',
    textAlign:     'center',
    borderBottom:  '1px solid rgba(120,53,15,0.16)',
  },
  // bottom-nav is at ~64px tall on mobile; the sticky top placement
  // means no overlap with bottom nav. No fixed positioning so
  // scrollable content beneath isn't shifted.
};

const POLL_MS = 8000;

async function _readDepth() {
  try {
    // Function-constructed import keeps Rollup from bundling the
    // entire offline graph into every page's chunk; also tolerant
    // of build environments where the runtime path isn't shipped.
    const dyn = new Function('s', 'return import(s)');
    const mod = await dyn('../runtime/offline/queueRegistry.js');
    if (!mod || typeof mod.getRegistrySnapshot !== 'function') return 0;
    const snap = await mod.getRegistrySnapshot();
    let total = 0;
    if (snap && snap.queues) {
      for (const q of Object.values(snap.queues)) {
        if (q && typeof q.depth === 'number') total += q.depth;
      }
    }
    return total;
  } catch { return 0; }
}

export default function OfflineQueueBanner() {
  const [pending, setPending] = useState(0);
  const refresh = useCallback(async () => {
    const depth = await _readDepth();
    setPending(typeof depth === 'number' ? depth : 0);
  }, []);

  useEffect(() => {
    let alive = true;
    let timer = null;
    const tick = async () => {
      if (!alive) return;
      await refresh();
      if (!alive) return;
      timer = setTimeout(tick, POLL_MS);
    };
    tick();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [refresh]);

  if (!pending || pending <= 0) return null;
  const label = pending === 1
    ? tSafe('rc1.offline.banner.one',
            '1 update waiting to sync',
            { count: 1 })
    : tSafe('rc1.offline.banner.many',
            `${pending} updates waiting to sync`,
            { count: pending });
  const prefix = tSafe('rc1.offline.banner.prefix', 'Offline');
  return (
    <div
      style={STYLES.banner}
      role="status"
      aria-live="polite"
      data-testid="offline-queue-banner"
    >
      {prefix}: {label}
    </div>
  );
}
