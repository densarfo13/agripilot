/**
 * syncCoordinator — unified facade over both offline stores.
 *
 * The app has two separate offline persistence layers:
 *   1. offlineQueue.js (IndexedDB 'mutations') — general mutation queue (tasks, stages, etc.)
 *   2. offlineDb.js (IndexedDB 'sync_queue') — profile-specific sync queue with idempotency
 *
 * This coordinator:
 *   - Provides a single status() for UI (total pending, last sync, errors)
 *   - Flushes both queues when coming online
 *   - Exposes a listener for sync state changes
 *   - Centralizes retry logic and failure logging
 */
import { count as mutationCount, purgeExpired, onSyncChange } from '../utils/offlineQueue.js';
import { getSyncQueue, getSyncMeta, saveSyncMeta } from '../lib/offlineDb.js';
import { log, logError } from '../lib/logger.js';
import { computeBackoffMs, shouldRetry } from './offlineBackoff.js';

let _listeners = [];
let _syncing = false;
// Count of consecutive flush failures so we can back off exponentially
// when the network is flapping. Reset on a clean success.
let _flushFailures = 0;

/**
 * Get unified sync status across both queues.
 *
 * @returns {Promise<{pending: number, lastSyncedAt: number|null, lastError: string|null, syncing: boolean}>}
 */
export async function getSyncStatus() {
  try {
    const [mutations, profileQueue, meta] = await Promise.all([
      mutationCount(),
      getSyncQueue().then(q => q.length).catch(() => 0),
      getSyncMeta().catch(() => ({})),
    ]);

    return {
      pending: mutations + profileQueue,
      lastSyncedAt: meta.lastSyncedAt || null,
      lastError: meta.lastError || null,
      syncing: _syncing,
    };
  } catch {
    return { pending: 0, lastSyncedAt: null, lastError: null, syncing: false };
  }
}

/**
 * Flush all pending offline mutations. Called on reconnect.
 *
 * Handles both queues sequentially:
 *   1. Profile sync queue (offlineDb) — has idempotency keys
 *   2. General mutation queue (offlineQueue) — task completions, stage updates, etc.
 *
 * @param {Object} [opts]
 * @param {Function} [opts.profileFlusher] - Custom profile flush function (from ProfileContext)
 */
export async function flushAll(opts = {}) {
  if (_syncing) return;
  _syncing = true;
  _notify();

  log('sync', 'flush_started');

  try {
    // 1. Purge expired mutations (>7 days)
    await purgeExpired().catch(() => {});

    // 2. General mutation queue is flushed by initAutoSync(api) in App.jsx
    //    (it needs the axios client instance). We just purge + track status here.

    // 3. Flush profile queue (delegated to ProfileContext's flusher if provided)
    let profileSynced = 0;
    if (opts.profileFlusher) {
      try {
        await opts.profileFlusher();
        profileSynced = 1;
      } catch (err) {
        logError('sync', err, { queue: 'profile' });
      }
    }

    const status = await getSyncStatus();
    if (status.pending === 0) {
      _flushFailures = 0;
      await saveSyncMeta({ lastSyncedAt: Date.now(), lastError: null }).catch(() => {});
    } else {
      // Still pending after flush — count as a soft failure and
      // schedule a backed-off retry. Capped by shouldRetry.
      _flushFailures += 1;
      if (shouldRetry(_flushFailures)) {
        const delay = computeBackoffMs(_flushFailures);
        setTimeout(() => {
          if (navigator.onLine) flushAll(opts);
        }, delay);
      }
    }

    log('sync', 'flush_completed', {
      profileSynced,
      remaining: status.pending,
      failures: _flushFailures,
    });
  } catch (err) {
    _flushFailures += 1;
    logError('sync', err, { phase: 'flush_all', failures: _flushFailures });
    await saveSyncMeta({ lastError: err.message || 'Flush failed' }).catch(() => {});
    if (shouldRetry(_flushFailures)) {
      const delay = computeBackoffMs(_flushFailures);
      setTimeout(() => {
        if (navigator.onLine) flushAll(opts);
      }, delay);
    }
  } finally {
    _syncing = false;
    _notify();
  }
}

/**
 * Subscribe to sync state changes.
 * @param {Function} fn - Called with { syncing, pending }
 * @returns {Function} unsubscribe
 */
export function onSyncStatusChange(fn) {
  _listeners.push(fn);
  // Also forward from underlying offlineQueue
  const unsub = onSyncChange((detail) => {
    fn({ syncing: detail.syncing || _syncing, pending: detail.remaining || 0 });
  });
  return () => {
    _listeners = _listeners.filter(l => l !== fn);
    unsub();
  };
}

/**
 * Initialize auto-sync on reconnect.
 * Should be called once at app startup.
 */
export function initSyncCoordinator() {
  if (typeof window === 'undefined') return;

  window.addEventListener('online', () => {
    log('sync', 'network_restored');
    // Small delay to let network stabilize
    setTimeout(() => flushAll(), 1500);
  });

  // Flush on visibility return (user switches back to app tab)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && navigator.onLine) {
      getSyncStatus().then(s => {
        if (s.pending > 0) flushAll();
      });
    }
  });

  log('sync', 'coordinator_initialized');
}

function _notify() {
  getSyncStatus().then(status => {
    for (const fn of _listeners) {
      try { fn(status); } catch { /* ignore listener errors */ }
    }
  });
}
