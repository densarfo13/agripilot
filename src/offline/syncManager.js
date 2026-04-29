/**
 * syncManager.js — flushes the simple offline queue.
 *
 * Pairs with `src/offline/offlineQueue.js`. Both are deliberately
 * separate from the heavy IndexedDB sync engine in `src/lib/sync/*`.
 *
 * Hardening (Apr 2026)
 * ────────────────────
 *   • Idempotency keys: every entry gets a uuid the dispatcher
 *     forwards as `Idempotency-Key`. Servers that respect the
 *     header can dedupe a re-fired action after a lost response.
 *   • Retry budget + exponential backoff: failed entries don't
 *     re-fire on every 5s tick — `markAttempt` schedules a
 *     1/5/15/60/300/900/1800/3600s wait before they're due again.
 *     Past 8 attempts they're marked `abandoned`, kept on disk for
 *     debug/recovery instead of silently dropped.
 *   • Reachability: when the existing `isReallyOnline()` probe is
 *     available (everywhere except SSR / tests), use it instead of
 *     `navigator.onLine` so a captive portal or VPN handshake
 *     doesn't trigger a doomed flush.
 *
 * Public API
 * ──────────
 *   syncQueue(sendFn)       — flush due entries; respects backoff,
 *                              idempotency, max-attempts.
 *   safeAction(action,      — wrap an outbound action so going
 *              sendFn)         offline at the call site queues it.
 */

import {
  addToQueue,
  getDueEntries,
  markAttempt,
  removeFromQueue,
} from './offlineQueue.js';

let _flushing = false;

function _navigatorOnline() {
  try {
    if (typeof navigator === 'undefined') return true;
    return navigator.onLine !== false;
  } catch { return true; }
}

/**
 * Reachability probe. Tries the project's own `isReallyOnline`
 * helper first (returns Promise<boolean>) and falls back to the
 * browser's `navigator.onLine` flag when the helper is unavailable
 * (e.g. SSR, test environment, or before the bundle loads).
 *
 * Memoised lookup — avoids a dynamic import on every flush.
 */
let _probePromise = null;
function _resolveProbe() {
  if (_probePromise) return _probePromise;
  _probePromise = import('../services/isReallyOnline.js')
    .then((mod) => (typeof mod.isReallyOnline === 'function' ? mod.isReallyOnline : null))
    .catch(() => null);
  return _probePromise;
}

async function _isOnline() {
  // Cheap pre-check: if the browser says we're offline, trust it.
  if (!_navigatorOnline()) return false;
  try {
    const probe = await _resolveProbe();
    if (typeof probe === 'function') {
      // The probe self-caches for ~8s, so calling it on every 5s
      // tick is fine — it short-circuits to the cached result.
      const ok = await probe();
      return !!ok;
    }
  } catch { /* ignore */ }
  return _navigatorOnline();
}

/**
 * Flush due entries through `sendFn`. No-op when offline / a flush
 * is already running. Each `sendFn` call gets two args:
 *
 *     sendFn(entry.action, { idempotencyKey, attempts, version })
 *
 * The second arg is metadata the dispatcher can attach to the
 * outgoing request (typically as headers). Older dispatchers that
 * accept only one arg keep working — the second is positional.
 *
 * Successful entries are removed; failed entries are scheduled
 * via `markAttempt` (backoff + abandonment). Per-entry isolation
 * means one failure can't abort the rest of the flush.
 *
 * @returns {Promise<{flushed: number, failed: number, abandoned: number, skipped: number}>}
 */
export async function syncQueue(sendFn) {
  const result = { flushed: 0, failed: 0, abandoned: 0, skipped: 0 };
  if (typeof sendFn !== 'function') return result;
  if (_flushing) return result;
  // F4 fix (interactive smoke test): the reachability probe used
  // to run unconditionally on every 5s tick — even when the queue
  // was empty — burning a HEAD against /manifest.json every 10s
  // (probe self-caches for 8s) for the entire page lifetime. The
  // smoke-test network panel showed ~30 manifest HEADs accumulated
  // per 5-min session.
  //
  // Check queue FIRST, only probe reachability when there's work
  // to do. For an empty queue (the common case for most farmers
  // most of the time) we now skip the probe entirely, eliminating
  // the wasteful HEAD traffic without changing flush behaviour.
  const due = getDueEntries();
  if (!due.length) return result;
  if (!(await _isOnline())) return result;
  _flushing = true;
  try {
    for (const entry of due) {
      const meta = {
        idempotencyKey: entry.idempotencyKey,
        attempts:       entry.attempts,
        version:        entry.version,
      };
      try {
        const out = sendFn(entry.action, meta);
        if (out && typeof out.then === 'function') {
          await out;
        }
        removeFromQueue(entry.id);
        result.flushed += 1;
      } catch (err) {
        try { console.warn('[offlineQueue] sync failed', entry?.action, err && err.message); }
        catch { /* ignore */ }
        const updated = markAttempt(entry.id, { error: err });
        if (updated && updated.status === 'abandoned') {
          result.abandoned += 1;
        } else {
          result.failed += 1;
        }
      }
    }
    return result;
  } finally {
    _flushing = false;
  }
}

/**
 * Wrap a one-shot action so going offline at the moment of the
 * call enqueues instead of dropping it. Online → identical to the
 * existing logic. The caller's `sendFn` is invoked unchanged on
 * the online branch and receives the same `(action, meta)` shape
 * as the queue dispatcher, where `meta.idempotencyKey` is freshly
 * generated for the immediate-send case so a network error mid-
 * request can be safely retried by the queue without duplicate
 * server effects.
 *
 * Offline branch returns `{ queued: true, entry }`. Online branch
 * returns whatever `sendFn` returned (Promise-or-not).
 */
export function safeAction(action, sendFn) {
  // We only have a synchronous answer here for the offline branch;
  // for the online branch we hand control to the caller's sendFn,
  // which is already async-or-not. navigator.onLine is the cheapest
  // signal — if it disagrees with the captive-portal reality, the
  // queue's retry budget catches the failure on the next tick.
  if (!_navigatorOnline()) {
    try {
      const entry = addToQueue(action);
      return { queued: true, entry };
    } catch {
      // Fall through and try to send.
    }
  }
  if (typeof sendFn !== 'function') return undefined;
  // Mint a fresh idempotency key for the immediate path so the
  // dispatcher signature stays uniform across online/offline.
  const meta = {
    idempotencyKey: _mintKey(),
    attempts:       0,
    version:        (action && Number.isFinite(action.version)) ? action.version : 1,
  };
  try {
    return sendFn(action, meta);
  } catch (err) {
    // Synchronous throw at the call site — store the action so the
    // next tick can retry. Promise rejections are NOT caught here;
    // they remain the caller's responsibility (existing contract).
    try { addToQueue(action); } catch { /* ignore */ }
    throw err;
  }
}

function _mintKey() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch { /* ignore */ }
  return 'k_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
}
