/**
 * syncEngine.js — drains the offline action queue when the network
 * comes back.
 *
 *   syncPending({ transport, isOnline }) → {
 *     attempted, succeeded, failed, skipped,
 *     details: Array<{ id, status, reason? }>,
 *   }
 *
 * The engine is intentionally small:
 *   1. If offline, bail out with `skipped: N`.
 *   2. For each pending action, call `transport.send(action)`.
 *   3. A resolved `{ ok: true }` marks the action synced.
 *   4. A resolved `{ ok: false, code: 'duplicate' }` also marks the
 *      action synced (server already has it — avoid infinite retries).
 *   5. Any throw / `{ ok: false }` bumps attempts + stores the error.
 *   6. Records `setLastSyncAt(Date.now())` on every non-empty run.
 *
 * No exponential backoff here — the engine is invoked either on
 * page-open or on the `online` event. If every pending action fails,
 * they'll sit in the queue until the next call; the UI shows a retry
 * badge via pendingCount().
 *
 * Transport contract:
 *   transport.send(action) → Promise<{ ok: boolean, code?, message? }>
 * The default transport is a no-op that resolves `{ ok: false,
 * code: 'not_wired' }` so a real implementation can slot in later
 * without changing the engine.
 */

import {
  listQueue, markSynced, markFailure, pruneSynced, pendingCount,
} from './offlineQueue.js';
import { getNetworkStatus, setLastSyncAt } from '../network/networkStatus.js';

const DEFAULT_TRANSPORT = Object.freeze({
  send: async () => ({ ok: false, code: 'not_wired',
    message: 'Sync transport not wired — action left in queue.' }),
});

// Lock to prevent two concurrent drains (e.g. storage event + online
// event firing back-to-back on the same tab).
let draining = false;

export async function syncPending({
  transport = DEFAULT_TRANSPORT,
  isOnline  = null,
  maxBatch  = 50,
} = {}) {
  const online = (isOnline === null) ? getNetworkStatus().online : !!isOnline;
  const report = { attempted: 0, succeeded: 0, failed: 0, skipped: 0, details: [] };

  if (!online) {
    report.skipped = pendingCount();
    return report;
  }
  if (draining) {
    report.skipped = pendingCount();
    return report;
  }

  draining = true;
  try {
    const batch = listQueue({ pendingOnly: true, limit: maxBatch });
    if (batch.length === 0) return report;

    // [WIRING] surface every non-empty drain so prod ops can confirm
    // the sync engine actually runs after the page comes back online
    // (not just attaches handlers). Skipped runs stay silent.
    try {
      if (typeof console !== 'undefined') {
        console.log(`[WIRING] sync.run pending=${batch.length} `
          + `maxBatch=${maxBatch} online=${online}`);
      }
    } catch { /* never propagate */ }

    for (const action of batch) {
      report.attempted += 1;
      let result = { ok: false, code: 'transport_error' };
      try {
        result = await transport.send(action);
      } catch (err) {
        result = {
          ok: false,
          code: 'transport_threw',
          message: err && err.message ? err.message : 'unknown',
        };
      }

      if (result && result.ok) {
        markSynced(action.id);
        report.succeeded += 1;
        report.details.push({ id: action.id, status: 'sent' });
        continue;
      }

      // "duplicate" / "already_synced" from the server means the
      // action is effectively done — don't keep retrying.
      if (result && (result.code === 'duplicate' || result.code === 'already_synced')) {
        markSynced(action.id);
        report.succeeded += 1;
        report.details.push({ id: action.id, status: 'duplicate' });
        continue;
      }

      // Normalise to an Error-shaped object so offlineQueue.markFailure
      // stores a human-readable string, never "[object Object]".
      const reason = (result && (result.code || result.message)) || 'unknown';
      // Permanent vs transient: validation/auth/missing-resource codes
      // will never become valid by retrying, so mark them terminal so
      // the UI can surface them and the engine stops looping.
      // Transient codes (network/server/timeout/unauthorized after
      // refresh fails) follow exponential backoff up to MAX_ATTEMPTS.
      const code = result && result.code;
      const permanent = code === 'validation_error'
                      || code === 'unsupported_type'
                      || code === 'missing_action_type';
      const updated = markFailure(action.id, new Error(String(reason)),
                                    { permanent });
      report.failed += 1;
      report.details.push({
        id: action.id,
        status: updated && updated.failed ? 'failed_terminal' : 'failed_retrying',
        attempts: updated && updated.attempts,
        nextAttemptAt: updated && updated.nextAttemptAt,
        reason,
      });
    }

    // Tidy up old synced entries opportunistically.
    pruneSynced();
    setLastSyncAt(Date.now());
  } finally {
    draining = false;
  }

  return report;
}

/**
 * attachAutoSync — wires `syncPending` to the "online" event and
 * runs an immediate drain when already online. Returns a detach
 * function; safe to call repeatedly.
 *
 * Fix P3.10 — also polls every 60s as a belt-and-braces fallback.
 * Some PWAs / proxies / mobile browsers don't fire the `online`
 * event reliably. The poll only drains when:
 *   • there's a pending row
 *   • the navigator reports online
 * so an idle queue costs nothing.
 */
export function attachAutoSync({ transport = DEFAULT_TRANSPORT, pollIntervalMs = 60_000 } = {}) {
  if (typeof window === 'undefined') return () => {};
  const handler = () => {
    // Fire-and-forget — sync failures never bubble.
    syncPending({ transport }).catch(() => {});
  };
  window.addEventListener('online', handler);
  // Opportunistic initial drain — if the page was loaded while
  // online but the queue still has leftover items from a previous
  // tab's offline stretch, they'll sync right away.
  if (getNetworkStatus().online) handler();

  // Polling fallback. Skips the drain when offline OR queue empty
  // so a long-lived tab doesn't burn the network.
  let intervalId = null;
  if (typeof setInterval === 'function' && pollIntervalMs > 0) {
    intervalId = setInterval(() => {
      try {
        if (!getNetworkStatus().online) return;
        if (pendingCount() === 0) return;
        handler();
      } catch { /* never propagate */ }
    }, pollIntervalMs);
  }

  return () => {
    try { window.removeEventListener('online', handler); } catch { /* ignore */ }
    if (intervalId) { try { clearInterval(intervalId); } catch { /* ignore */ } intervalId = null; }
  };
}

export const _internal = Object.freeze({ DEFAULT_TRANSPORT });
