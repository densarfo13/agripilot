/**
 * OfflineSyncBanner — small, non-blocking status pill for the
 * lightweight `src/offline/*` queue.
 *
 * Distinct from the existing `OfflineBanner.jsx`, which serves the
 * heavy IndexedDB sync engine (`src/lib/sync/transport.js`). Both
 * can render at the same time: the existing banner reflects the
 * production mutation queue; THIS pill reflects the simple
 * localStorage-backed queue used by the new low-literacy flows.
 *
 * Visible states
 * ──────────────
 *   • offline           → "You are offline. Actions will sync later."
 *   • online + items    → "Back online. Syncing data…"
 *   • online + empty    → nothing rendered
 *
 * The component listens to:
 *   • window 'online' / 'offline' events (the browser's own signal)
 *   • a custom 'farroway:offlineQueueChange' event, dispatched (by
 *     a tiny observer below) whenever the queue length we track
 *     transitions across zero. This avoids polling localStorage on
 *     every render.
 *
 * Visible text routes through tStrict so non-English UIs never
 * leak English.
 *
 * Mount: at App level alongside <VoiceAssistant />. Top-right
 * placement avoids colliding with the floating mic at bottom-centre
 * and the OfflineBanner at the top of the page-shell.
 */

import { useCallback, useEffect, useState } from 'react';
import { useStrictTranslation as useTranslation } from '../i18n/useStrictTranslation.js';
import { tStrict } from '../i18n/strictT.js';
import { getQueue } from '../offline/offlineQueue.js';

const POLL_MS = 4000;

function _onLine() {
  try {
    if (typeof navigator === 'undefined') return true;
    return navigator.onLine !== false;
  } catch { return true; }
}

export default function OfflineSyncBanner() {
  // Re-render on language change so the banner's strings update.
  useTranslation();

  const [online, setOnline] = useState(_onLine);
  const [counts, setCounts] = useState({ pending: 0, abandoned: 0 });

  // Update queue counts on the same cadence as the auto-sync hook.
  // The queue dispatches `farroway:offlineQueueChange` on every
  // mutation so this listener stays current without polling fast.
  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      if (cancelled) return;
      try {
        const all = getQueue();
        let pending = 0; let abandoned = 0;
        for (const e of all) {
          if (e.status === 'abandoned') abandoned += 1;
          else pending += 1;
        }
        setCounts({ pending, abandoned });
      } catch { /* ignore */ }
    };
    refresh();
    const id = setInterval(refresh, POLL_MS);
    const onChange = () => refresh();
    if (typeof window !== 'undefined') {
      window.addEventListener('farroway:offlineQueueChange', onChange);
    }
    return () => {
      cancelled = true;
      clearInterval(id);
      if (typeof window !== 'undefined') {
        window.removeEventListener('farroway:offlineQueueChange', onChange);
      }
    };
  }, []);

  const onlineHandler  = useCallback(() => setOnline(true),  []);
  const offlineHandler = useCallback(() => setOnline(false), []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    window.addEventListener('online',  onlineHandler);
    window.addEventListener('offline', offlineHandler);
    return () => {
      window.removeEventListener('online',  onlineHandler);
      window.removeEventListener('offline', offlineHandler);
    };
  }, [onlineHandler, offlineHandler]);

  let message = '';
  let tone    = 'info';

  if (!online) {
    message = tStrict('offlineSync.offline', 'You are offline. Actions will sync later.');
    tone    = 'warn';
  } else if (counts.abandoned > 0) {
    // Surface abandoned entries to the user so they know something
    // needs attention. The queue keeps them on disk for inspection
    // / manual retry rather than silently dropping them.
    message = tStrict('offlineSync.abandoned', 'Some actions could not sync. Please check your connection.');
    tone    = 'err';
  } else if (counts.pending > 0) {
    message = tStrict('offlineSync.syncing', 'Back online. Syncing data…');
    tone    = 'ok';
  }

  if (!message) return null;

  const style = {
    position: 'fixed',
    top: 12,
    right: 12,
    zIndex: 60,
    maxWidth: '70vw',
    padding: '6px 12px',
    borderRadius: 999,
    fontSize: 12,
    color: '#fff',
    background:
      tone === 'warn' ? 'rgba(245,158,11,0.92)'
      : tone === 'err' ? 'rgba(239,68,68,0.92)'
      : tone === 'ok' ? 'rgba(34,197,94,0.92)'
      : 'rgba(11,29,52,0.92)',
    boxShadow: '0 6px 18px rgba(0,0,0,0.35)',
    pointerEvents: 'none',
  };

  return (
    <div role="status" aria-live="polite" style={style} data-testid="offline-sync-banner">
      {message}
    </div>
  );
}
