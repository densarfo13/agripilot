/**
 * OfflineSyncBanner — pure consumer of the centralized
 * syncManager state. NEVER owns timers; NEVER reads queue
 * lengths; NEVER stays stuck.
 *
 *   <OfflineSyncBanner />
 *
 * What it shows
 *   • connectionMessage from useSyncManager()
 *     (e.g. "Offline mode", "Back online. Updating…",
 *           "Updating your farm data…")
 *   • Hides when the message is null. The manager guarantees
 *     the message clears within 5 seconds of any sync trigger
 *     and within 3 seconds of the "Back online" pill firing.
 *
 * Why so small
 *   The previous version maintained its own queue counts +
 *   auto-hide timers, which drifted out of sync with the rest
 *   of the app. Hoisting the state into syncManager.js means
 *   there's exactly ONE place to find a stuck banner.
 */

import { useSyncManager } from '../lib/syncManager.js';
import { useStrictTranslation as useTranslation } from '../i18n/useStrictTranslation.js';

export default function OfflineSyncBanner() {
  // Re-render on language change so the banner's strings update
  // even though our message is provided externally — the
  // useTranslation subscription is the canonical re-render hook.
  useTranslation();

  const { connectionMessage } = useSyncManager();
  if (!connectionMessage) return null;

  // Pick a tone from the message keyword. We deliberately don't
  // expose a separate `tone` field on the manager — the message
  // text IS the user-facing signal, and the colour is pure UX.
  const lower = String(connectionMessage).toLowerCase();
  let tone = 'info';
  if (lower.includes('offline')) tone = 'warn';
  else if (lower.includes('back online') || lower.includes('updating')) tone = 'ok';

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
      : tone === 'ok' ? 'rgba(200,148,77,0.92)'
      : 'rgba(11,29,52,0.92)',
    boxShadow: '0 6px 18px rgba(0,0,0,0.35)',
    pointerEvents: 'none',
  };

  return (
    <div
      role="status"
      aria-live="polite"
      style={style}
      data-testid="offline-sync-banner"
    >
      {connectionMessage}
    </div>
  );
}
