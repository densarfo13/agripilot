/**
 * useCalmFeedSync — fires the calm-intelligence notification queue
 * once per mount, scoped to the active user.
 *
 *   useCalmFeedSync({
 *     mode:    ctxIntel.mode,
 *     weather,
 *     crop,
 *     region,
 *     tasks,
 *     scanHistory,
 *     buyerInterest,
 *     fundingMatches,
 *   }, { enabled: !weatherLoading });
 *
 * BEHAVIOUR
 *   • Reads the user id from the session-cache mirror (matches the
 *     V2 cookie flow used elsewhere in the app). Falls back to
 *     `__device` scope when unauthenticated.
 *   • Calls `commitCalmQueue(context, { userId, commit: true })`
 *     exactly once per mount. The calm engine's own cooldown /
 *     scheduler / daily-cap rules are the second-line gate — even
 *     if the hook re-fires across navigations, those gates prevent
 *     duplicate feed rows.
 *   • Gated by `enabled` so the consumer can hold off until live
 *     data settles (e.g. wait for weather to finish loading).
 *
 * STRICT-RULE AUDIT
 *   • Never throws — every step is try/catch wrapped.
 *   • SSR-safe — every storage read is window-guarded.
 *   • No state, no re-renders. Purely a side-effect bridge.
 */

import { useEffect, useRef } from 'react';
import { commitCalmQueue } from '../intelligence/notifications/notificationFeedBridge.js';

const SESSION_CACHE_KEY = 'farroway:session_cache';

function _readUserId() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(SESSION_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const u = parsed && parsed.user;
    if (!u) return null;
    const id = u.id || u.sub || u.email || null;
    return id ? String(id) : null;
  } catch { return null; }
}

export default function useCalmFeedSync(context, opts = {}) {
  const enabled = opts.enabled !== false;
  const firedRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    if (firedRef.current) return;
    // Context must be a non-null object; otherwise wait for the
    // caller's next render with usable data.
    if (!context || typeof context !== 'object') return;
    firedRef.current = true;
    try {
      const userId = _readUserId();
      commitCalmQueue(context, { userId, commit: true });
    } catch { /* swallow — calm bridge must never crash the host */ }
  }, [enabled, context]);
}

export { _readUserId };
