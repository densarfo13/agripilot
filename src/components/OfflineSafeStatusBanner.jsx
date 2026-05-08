/**
 * OfflineSafeStatusBanner — minimal, non-blocking offline status strip.
 *
 * WHAT IT SHOWS
 * ─────────────
 *   offline:              "Offline mode — changes will save on this device."
 *   back online (3s):     "Back online — syncing safely."
 *   online + idle:        hidden (renders null → zero layout impact)
 *
 * DESIGN RULES
 * ────────────
 *   • No polling, no setInterval — subscribes only to the browser's
 *     online/offline events via useNetworkStatus().
 *   • No blocking render — returns null immediately when idle.
 *   • No React state write during render — all state writes happen
 *     inside useEffect / event handlers.
 *   • Single sticky strip at the top; uses `position: sticky` so the
 *     page content shifts down naturally when the banner appears.
 *   • Auto-hides after ONLINE_SHOW_MS when back online so the farmer
 *     isn't staring at a confirmation strip indefinitely.
 *   • Accessible: role="status" + aria-live="polite".
 *   • Coexists with OfflineSyncBanner (different visual slot; different
 *     data source). This banner reads network events only; the other
 *     reads the heavy IndexedDB sync engine.
 *
 * USAGE
 * ─────
 *   Mount once near the top of the app shell, gated on FEATURE_OFFLINE_SAFE:
 *
 *     import { FEATURE_OFFLINE_SAFE } from '../lib/pilotFlags.js';
 *     {FEATURE_OFFLINE_SAFE && <OfflineSafeStatusBanner />}
 */

import { useEffect, useRef, useState } from 'react';
import { useNetworkStatus } from '../lib/network/networkStatus.js';

// How long to show the "Back online" confirmation before hiding.
const ONLINE_SHOW_MS = 3000;

export default function OfflineSafeStatusBanner() {
  const { online } = useNetworkStatus();

  // `showOnlineConfirm` is true for ONLINE_SHOW_MS after each
  // offline → online transition. It lets us show the "Back online"
  // message without flickering immediately to null.
  const [showOnlineConfirm, setShowOnlineConfirm] = useState(false);
  const prevOnlineRef = useRef(online);
  const timerRef = useRef(null);

  useEffect(() => {
    const wasOnline = prevOnlineRef.current;
    prevOnlineRef.current = online;

    // Transition: offline → online
    if (!wasOnline && online) {
      if (timerRef.current) clearTimeout(timerRef.current);
      setShowOnlineConfirm(true);
      timerRef.current = setTimeout(() => {
        setShowOnlineConfirm(false);
        timerRef.current = null;
      }, ONLINE_SHOW_MS);
    }

    // Transition: online → offline — cancel any pending confirm timer
    if (wasOnline && !online) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setShowOnlineConfirm(false);
    }
  }, [online]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Hidden when online and past the confirmation window.
  if (online && !showOnlineConfirm) return null;

  const isOffline = !online;
  const message = isOffline
    ? 'Offline mode — changes will save on this device.'
    : 'Back online — syncing safely.';

  return (
    <div
      role="status"
      aria-live="polite"
      style={isOffline ? S.wrapOffline : S.wrapOnline}
      data-testid="offline-safe-status-banner"
    >
      {isOffline && <span style={S.dot} aria-hidden="true" />}
      {!isOffline && <span style={S.check} aria-hidden="true">&#10003;</span>}
      <span style={S.text}>{message}</span>
    </div>
  );
}

const S = {
  wrapOffline: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.45rem',
    padding: '0.4rem 1rem',
    fontSize: '0.8rem',
    fontWeight: 600,
    lineHeight: 1.4,
    textAlign: 'center',
    position: 'sticky',
    top: 0,
    zIndex: 55,
    background: 'rgba(251,191,36,0.10)',
    borderBottom: '1px solid rgba(251,191,36,0.25)',
    color: '#FCD34D',
  },
  wrapOnline: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.45rem',
    padding: '0.4rem 1rem',
    fontSize: '0.8rem',
    fontWeight: 600,
    lineHeight: 1.4,
    textAlign: 'center',
    position: 'sticky',
    top: 0,
    zIndex: 55,
    background: 'rgba(134,239,172,0.10)',
    borderBottom: '1px solid rgba(134,239,172,0.25)',
    color: '#86EFAC',
  },
  dot: {
    display: 'inline-block',
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: '#FCD34D',
    flexShrink: 0,
  },
  check: {
    fontSize: '0.85rem',
    color: '#86EFAC',
    flexShrink: 0,
  },
  text: {
    display: 'inline',
  },
};
