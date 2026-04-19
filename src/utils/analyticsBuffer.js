/**
 * analyticsBuffer.js — small localStorage-backed buffer for
 * analytics events. The goal is simple:
 *
 *   • Never drop an onboarding or task event because the device
 *     was briefly offline.
 *   • Flush FIFO so the server sees the same order the user
 *     experienced them in.
 *   • De-duplicate on flush — each event carries a client-side
 *     idempotency key, and the buffer keeps the last successfully
 *     acked keys to block replays if a retry races a page reload.
 *
 * The buffer is intentionally boring: no timers, no Web Workers,
 * no background sync. Callers trigger flush on reconnect and on
 * page load. If localStorage is unavailable (private-mode Safari,
 * SSR) the buffer degrades to an in-memory array.
 */

const STORAGE_KEY      = 'farroway.analytics.buffer.v1';
const ACKED_STORAGE_KEY = 'farroway.analytics.acked.v1';
const MAX_BUFFER        = 500;   // hard cap — protects storage quota
const ACK_HISTORY_CAP   = 1000;  // keep last N ack keys for dedupe

let memoryBuffer = [];
let memoryAcked  = [];
let flushing     = false;

function hasStorage() {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch {
    return false;
  }
}

function readJson(key, fallback) {
  if (!hasStorage()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  if (!hasStorage()) return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function loadBuffer() {
  return hasStorage() ? readJson(STORAGE_KEY, []) : memoryBuffer.slice();
}

function saveBuffer(buffer) {
  if (hasStorage()) writeJson(STORAGE_KEY, buffer);
  else              memoryBuffer = buffer.slice();
}

function loadAcked() {
  return hasStorage() ? readJson(ACKED_STORAGE_KEY, []) : memoryAcked.slice();
}

function saveAcked(acked) {
  if (hasStorage()) writeJson(ACKED_STORAGE_KEY, acked);
  else              memoryAcked = acked.slice();
}

/** Stable client-side idempotency key. */
function mintClientKey(event) {
  const t = event?.type || 'unknown';
  const ts = event?.timestamp || Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `${t}_${ts}_${rand}`;
}

/**
 * enqueueAnalyticsEvent — append an event to the buffer. Does NOT
 * send anything; callers trigger flush explicitly.
 *
 * @returns {string} the clientKey that was assigned
 */
export function enqueueAnalyticsEvent(event) {
  if (!event || typeof event !== 'object') return null;
  const buffer = loadBuffer();
  const clientKey = event.clientKey || mintClientKey(event);
  const stamped = {
    ...event,
    clientKey,
    timestamp: event.timestamp || Date.now(),
  };
  buffer.push(stamped);
  // Drop oldest if we blow past the cap; onboarding + recent task
  // events are more useful to preserve than month-old buffered crumbs.
  while (buffer.length > MAX_BUFFER) buffer.shift();
  saveBuffer(buffer);
  return clientKey;
}

/**
 * peekAnalyticsBuffer — returns a shallow copy of what's queued.
 * Useful for dev panels.
 */
export function peekAnalyticsBuffer() {
  return loadBuffer().slice();
}

export function bufferedAnalyticsCount() {
  return loadBuffer().length;
}

export function clearAnalyticsBuffer() {
  saveBuffer([]);
}

function mergeAcked(keys) {
  const acked = loadAcked();
  for (const k of keys) if (k) acked.push(k);
  while (acked.length > ACK_HISTORY_CAP) acked.shift();
  saveAcked(acked);
}

function alreadyAcked(key) {
  if (!key) return false;
  return loadAcked().includes(key);
}

/**
 * flushAnalyticsBuffer — sends everything in FIFO order through
 * the caller-supplied `sendOne` function. De-duplicates against
 * previously-acked keys so a retry that races a reload doesn't
 * post the same event twice.
 *
 * @param {function(event): Promise<boolean|object>} sendOne
 *        Resolves to truthy on success, falsy/throw on failure.
 * @param {object} [opts]
 * @param {number} [opts.maxBatch=50]
 * @returns {Promise<{ sent: number, failed: number, skipped: number }>}
 */
export async function flushAnalyticsBuffer(sendOne, opts = {}) {
  if (typeof sendOne !== 'function') {
    return { sent: 0, failed: 0, skipped: 0 };
  }
  if (flushing) return { sent: 0, failed: 0, skipped: 0, reentrant: true };
  flushing = true;
  try {
    const maxBatch = Math.max(1, opts.maxBatch || 50);
    const buffer   = loadBuffer();
    if (!buffer.length) return { sent: 0, failed: 0, skipped: 0 };

    const remaining  = [];
    const newlyAcked = [];
    let sent = 0, failed = 0, skipped = 0, processed = 0;

    for (const event of buffer) {
      if (processed >= maxBatch) { remaining.push(event); continue; }
      processed += 1;
      if (alreadyAcked(event.clientKey)) { skipped += 1; continue; }
      try {
        const ok = await sendOne(event);
        if (ok) {
          sent += 1;
          newlyAcked.push(event.clientKey);
        } else {
          failed += 1;
          remaining.push(event);
        }
      } catch {
        failed += 1;
        remaining.push(event);
      }
    }
    saveBuffer(remaining);
    if (newlyAcked.length) mergeAcked(newlyAcked);
    return { sent, failed, skipped };
  } finally {
    flushing = false;
  }
}

/**
 * installFlushOnReconnect — attaches a one-shot `online` listener
 * that triggers `flushAnalyticsBuffer(sendOne)`. Returns a dispose
 * fn. Safe to call multiple times — callers are expected to track
 * their own disposer.
 */
export function installFlushOnReconnect(sendOne) {
  if (typeof window === 'undefined') return () => {};
  const handler = () => { flushAnalyticsBuffer(sendOne).catch(() => {}); };
  window.addEventListener('online', handler);
  return () => window.removeEventListener('online', handler);
}

export const _internal = {
  STORAGE_KEY, ACKED_STORAGE_KEY, MAX_BUFFER, ACK_HISTORY_CAP,
  mintClientKey, loadBuffer, saveBuffer, loadAcked, saveAcked,
};
