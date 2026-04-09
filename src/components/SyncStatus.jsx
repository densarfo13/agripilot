import React, { useState, useEffect } from 'react';
import { count as queueCount, onSyncChange, syncAll } from '../utils/offlineQueue.js';
import api from '../api/client.js';

/**
 * Floating sync status indicator.
 * Shows: offline banner, pending mutation count, sync progress.
 * Auto-hides when online with zero pending.
 */
export default function SyncStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  const [pending, setPending] = useState(0);
  const [syncState, setSyncState] = useState(null); // { syncing, synced, failed, remaining }

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    // Poll pending count every 5s (lightweight IDB count)
    const poll = setInterval(() => {
      queueCount().then(setPending).catch(() => {});
    }, 5000);
    queueCount().then(setPending).catch(() => {});

    // Listen for sync events
    const unsub = onSyncChange((status) => {
      setSyncState(status);
      if (!status.syncing) {
        setPending(status.remaining || 0);
        // Auto-clear sync result after delay (longer for failures so user can see/retry)
        const clearDelay = status.failed > 0 ? 8000 : 3000;
        if (status.remaining === 0 || status.failed > 0) {
          setTimeout(() => setSyncState(null), clearDelay);
        }
      }
    });

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      clearInterval(poll);
      unsub();
    };
  }, []);

  // Nothing to show when online + no pending + no sync activity
  if (online && pending === 0 && !syncState) return null;

  return (
    <div style={styles.container}>
      {!online && (
        <div style={styles.offlineBanner}>
          <span style={styles.dot('#EF4444')} />
          <span>You are offline — changes will sync when reconnected</span>
        </div>
      )}
      {pending > 0 && !syncState?.syncing && (
        <div style={styles.pendingBanner}>
          <span style={styles.dot('#F59E0B')} />
          <span>{pending} update{pending !== 1 ? 's' : ''} waiting to sync</span>
          {online && (
            <button
              onClick={() => syncAll(api)}
              style={styles.syncNowBtn}
            >
              Sync Now
            </button>
          )}
        </div>
      )}
      {syncState?.syncing && (
        <div style={styles.syncingBanner}>
          <span style={styles.spinner} />
          <span>Syncing changes...</span>
        </div>
      )}
      {syncState && !syncState.syncing && syncState.failed > 0 && (
        <div style={styles.failedBanner}>
          <span style={styles.dot('#EF4444')} />
          <span>{syncState.failed} update{syncState.failed !== 1 ? 's' : ''} failed to sync</span>
          {syncState.remaining > 0 && online && (
            <button
              onClick={() => syncAll(api)}
              style={styles.syncNowBtn}
            >
              Retry
            </button>
          )}
        </div>
      )}
      {syncState && !syncState.syncing && syncState.synced > 0 && syncState.failed === 0 && syncState.remaining === 0 && (
        <div style={styles.successBanner}>
          <span style={styles.dot('#22C55E')} />
          <span>{syncState.synced} update{syncState.synced !== 1 ? 's' : ''} synced</span>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    position: 'fixed', bottom: '1rem', left: '50%', transform: 'translateX(-50%)',
    zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '0.5rem',
    alignItems: 'center', pointerEvents: 'none',
  },
  offlineBanner: {
    display: 'flex', alignItems: 'center', gap: '0.5rem',
    background: 'rgba(239,68,68,0.9)', color: '#fff', padding: '0.5rem 1rem',
    borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600,
    backdropFilter: 'blur(8px)', boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
  },
  pendingBanner: {
    display: 'flex', alignItems: 'center', gap: '0.5rem',
    background: 'rgba(245,158,11,0.9)', color: '#fff', padding: '0.5rem 1rem',
    borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600,
    backdropFilter: 'blur(8px)', boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
    pointerEvents: 'auto',
  },
  syncingBanner: {
    display: 'flex', alignItems: 'center', gap: '0.5rem',
    background: 'rgba(14,165,233,0.9)', color: '#fff', padding: '0.5rem 1rem',
    borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600,
    backdropFilter: 'blur(8px)', boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
  },
  successBanner: {
    display: 'flex', alignItems: 'center', gap: '0.5rem',
    background: 'rgba(34,197,94,0.9)', color: '#fff', padding: '0.5rem 1rem',
    borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600,
    backdropFilter: 'blur(8px)', boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
  },
  failedBanner: {
    display: 'flex', alignItems: 'center', gap: '0.5rem',
    background: 'rgba(239,68,68,0.85)', color: '#fff', padding: '0.5rem 1rem',
    borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600,
    backdropFilter: 'blur(8px)', boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
    pointerEvents: 'auto',
  },
  syncNowBtn: {
    background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)',
    color: '#fff', padding: '0.2rem 0.6rem', borderRadius: 6,
    fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
    pointerEvents: 'auto', marginLeft: '0.5rem',
  },
  dot: (color) => ({
    width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0,
  }),
  spinner: {
    width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: '#fff', borderRadius: '50%',
    animation: 'spin 0.8s linear infinite', flexShrink: 0,
  },
};
