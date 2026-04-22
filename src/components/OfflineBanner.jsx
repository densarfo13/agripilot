/**
 * OfflineBanner — subtle top-of-page strip that reflects the current
 * network state and queued-action count.
 *
 *   • offline:          "Offline mode — actions will sync when connection returns."
 *   • online + pending: "Back online — syncing now…"
 *   • online + empty:   hidden
 *
 * Designed to be lightweight: a single <div> at the top of the page
 * tree, no layout shift when hidden, no polling, no blocking state.
 * Subscribes to the network-status layer and the sync engine's
 * auto-attach is delegated — callers mount <OfflineBanner /> once
 * near the app root.
 */

import { useEffect, useState } from 'react';
import { useNetworkStatus } from '../lib/network/networkStatus.js';
import { pendingCount } from '../lib/sync/offlineQueue.js';
import { attachAutoSync, syncPending } from '../lib/sync/syncEngine.js';
import { useTranslation } from '../i18n/index.js';

export default function OfflineBanner({ transport = null } = {}) {
  const { t } = useTranslation();
  const { online } = useNetworkStatus();
  const [pending, setPending] = useState(() => pendingCount());
  const [syncing, setSyncing] = useState(false);
  const [justSynced, setJustSynced] = useState(false);

  // Mount once: wire the online-event auto-sync + refresh the
  // pending count on every storage-mutation event so the UI stays
  // honest even across tabs.
  useEffect(() => {
    const detach = attachAutoSync(transport ? { transport } : undefined);
    const refresh = () => setPending(pendingCount());
    const onStorage = (e) => {
      if (!e || !e.key) { refresh(); return; }
      if (e.key === 'farroway.offlineQueue.v1') refresh();
    };
    window.addEventListener('storage', onStorage);
    const t = setInterval(refresh, 5000);  // cheap belt-and-braces
    return () => {
      detach();
      window.removeEventListener('storage', onStorage);
      clearInterval(t);
    };
  }, [transport]);

  // When we transition offline → online and still have pending items,
  // kick a sync and flash a "Back online — syncing" strip.
  useEffect(() => {
    let cancelled = false;
    async function runSync() {
      if (!online || pending === 0) return;
      setSyncing(true);
      try {
        await syncPending(transport ? { transport } : undefined);
      } catch { /* engine never throws, but guard anyway */ }
      if (cancelled) return;
      setPending(pendingCount());
      setSyncing(false);
      setJustSynced(true);
      setTimeout(() => { if (!cancelled) setJustSynced(false); }, 2500);
    }
    runSync();
    return () => { cancelled = true; };
  }, [online, pending, transport]);

  if (online && !syncing && !justSynced) return null;

  const tone = !online ? S.offline : syncing ? S.syncing : S.synced;
  const label = !online
    ? (t('offline.banner.offline')
        || 'Offline mode — actions will sync when connection returns.')
    : syncing
      ? (t('offline.banner.syncing')
          || 'Back online — syncing now\u2026')
      : (t('offline.banner.synced')
          || 'Changes saved.');

  return (
    <div
      role="status"
      aria-live="polite"
      style={{ ...S.wrap, ...tone }}
      data-testid="offline-banner"
    >
      {!online && <span style={S.dot} />}
      {syncing && <span style={S.spinner} aria-hidden="true" />}
      <span>{label}</span>
    </div>
  );
}

const S = {
  wrap: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: '0.5rem',
    fontSize: '0.8125rem', fontWeight: 600,
    padding: '0.5rem 1rem',
    position: 'sticky', top: 0, zIndex: 50,
    textAlign: 'center',
  },
  offline: {
    background: 'rgba(252,165,165,0.12)',
    borderBottom: '1px solid rgba(252,165,165,0.3)',
    color: '#FCA5A5',
  },
  syncing: {
    background: 'rgba(147,197,253,0.12)',
    borderBottom: '1px solid rgba(147,197,253,0.3)',
    color: '#BFDBFE',
  },
  synced: {
    background: 'rgba(134,239,172,0.12)',
    borderBottom: '1px solid rgba(134,239,172,0.3)',
    color: '#86EFAC',
  },
  dot: { width: '7px', height: '7px', borderRadius: '50%', background: 'currentColor' },
  spinner: {
    width: '0.875rem', height: '0.875rem', borderRadius: '50%',
    border: '2px solid rgba(191,219,254,0.3)',
    borderTopColor: '#BFDBFE',
    animation: 'farrowaySpin 640ms linear infinite',
  },
};

// Reuse the keyframes the LoadingButton already injected; if that
// component hasn't loaded yet, inject a copy here.
if (typeof document !== 'undefined' && !document.getElementById('farroway-spin-kf')) {
  const style = document.createElement('style');
  style.id = 'farroway-spin-kf';
  style.textContent = '@keyframes farrowaySpin { to { transform: rotate(360deg) } }';
  document.head.appendChild(style);
}
