/**
 * offlineScanQueue.js — minimum-viable offline-first scan queue.
 *
 *   await enqueueScan({ imageBase64, cropName, region });
 *   const pending = getQueuedScanCount();
 *   await drainQueue(async (entry) => { ... });   // caller passes
 *                                                  // the analyzer fn
 *
 * Why this exists (spec §10)
 * ──────────────────────────
 *   When a farmer takes a photo with no internet, today's flow
 *   surfaces the 2-second rule-based fallback verdict and that's
 *   the end of the story — the ML model never sees the photo, so
 *   the farmer never gets the better answer.
 *
 *   This module fills the gap as a *queue + retry* primitive:
 *
 *     • `enqueueScan(entry)` persists the scan attempt + image
 *       payload to localStorage. Caller is the scan page when its
 *       network call fails.
 *
 *     • `drainQueue(retryFn)` re-runs the analyzer for each queued
 *       entry. Caller wires it to the browser's `online` event
 *       and to the scan page's mount path so we drain whenever the
 *       user is around AND has a network.
 *
 *   We deliberately do NOT ship background sync, conflict
 *   resolution, or service-worker integration — those need a
 *   bigger spec round. This is the minimum that makes the
 *   "your photo will be analysed when you're back online"
 *   promise true rather than a lie.
 *
 * Storage
 * ───────
 *   Slot:  `farroway_offline_scan_queue_v1`
 *   Shape: Array<{
 *     id:           string,             // queue id
 *     scanId:       string|null,        // engine's scanId if a fallback fired
 *     imageBase64:  string,             // dataURL — small base64 ok
 *     cropName:     string|null,
 *     region:       string|null,
 *     experience:   string|null,
 *     queuedAt:     ISO datetime,
 *     attempts:     number,             // retry count
 *     lastErrorAt:  ISO datetime|null,
 *   }>
 *
 *   We cap the queue at 8 entries (the most a phone-side localStorage
 *   slot can hold without blowing the 5MB quota on captured
 *   base64 photos — typical mobile JPEG is ~250KB).
 *
 * Strict-rule audit
 *   • Never throws. Every storage call is try/wrapped; quota / private
 *     mode → silent no-op.
 *   • SSR-safe (localStorage guard).
 *   • No network. The retry function is injected by the caller so
 *     this module stays decoupled from the scan engine.
 *   • Async drain — the retry function may be slow; we await each
 *     attempt sequentially so we don't blast the network from a
 *     cold start.
 */

export const QUEUE_KEY  = 'farroway_offline_scan_queue_v1';
export const QUEUE_CAP  = 8;
export const MAX_ATTEMPTS = 5;

function _now() {
  try { return new Date().toISOString(); } catch { return ''; }
}

function _makeId() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return 'q_' + crypto.randomUUID();
    }
  } catch { /* fall through */ }
  return 'q_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function _read() {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function _write(list) {
  try {
    if (typeof localStorage === 'undefined') return;
    const trimmed = list.slice(-QUEUE_CAP);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(trimmed));
  } catch {
    // Quota exceeded — drop the oldest and try once more before
    // giving up. The user's most recent attempt is the one they
    // care about.
    try {
      if (typeof localStorage !== 'undefined') {
        const half = list.slice(Math.max(0, list.length - Math.floor(QUEUE_CAP / 2)));
        localStorage.setItem(QUEUE_KEY, JSON.stringify(half));
      }
    } catch { /* give up — non-fatal */ }
  }
}

/**
 * Persist a scan attempt to the local queue. Returns the stored
 * entry's id, or null when the input was unusable (no base64 etc.).
 *
 * @param {object} entry
 * @param {string} entry.imageBase64    required
 * @param {string} [entry.scanId]
 * @param {string} [entry.cropName]
 * @param {string} [entry.region]
 * @param {string} [entry.experience]
 * @returns {string|null}
 */
export function enqueueScan(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const imageBase64 = String(entry.imageBase64 || '');
  if (!imageBase64) return null;

  const id = _makeId();
  const list = _read();
  const stored = {
    id,
    scanId:      entry.scanId      ? String(entry.scanId)     : null,
    imageBase64,
    cropName:    entry.cropName    ? String(entry.cropName)   : null,
    region:      entry.region      ? String(entry.region)     : null,
    experience:  entry.experience  ? String(entry.experience) : null,
    queuedAt:    _now(),
    attempts:    0,
    lastErrorAt: null,
  };
  list.push(stored);
  _write(list);
  return id;
}

/**
 * Count of pending (non-exhausted) queued scans. Use this for the
 * "X scans waiting to upload" indicator.
 *
 * @returns {number}
 */
export function getQueuedScanCount() {
  return _read().filter((e) => e && e.attempts < MAX_ATTEMPTS).length;
}

/**
 * Read the queue (non-mutating). Newest entries last.
 *
 * @returns {Array<object>}
 */
export function listQueuedScans() {
  return _read().slice();
}

/**
 * Drain the queue. For each entry, call `retryFn(entry)`:
 *   • If it resolves, the entry is removed from the queue and the
 *     fulfilled result is added to the returned array.
 *   • If it rejects, the entry's `attempts` counter increments and
 *     it stays in the queue (until MAX_ATTEMPTS).
 *
 * The caller decides what `retryFn` does — typically it re-invokes
 * analyzeScan + persists the result to scan history.
 *
 * Returns the results of successful retries. Never throws — caller
 * errors inside retryFn are caught per-entry.
 *
 * @param {(entry:object)=>Promise<any>} retryFn
 * @returns {Promise<Array<any>>}
 */
export async function drainQueue(retryFn) {
  if (typeof retryFn !== 'function') return [];
  const list = _read();
  if (list.length === 0) return [];

  const survivors = [];
  const successes = [];

  for (const entry of list) {
    if (!entry) continue;
    if ((entry.attempts || 0) >= MAX_ATTEMPTS) {
      survivors.push(entry);  // keep around so the UI can show "stuck"
      continue;
    }
    try {
      // Await each retry sequentially — concurrent requests from a
      // cold-start drain would just thrash the network.
      // eslint-disable-next-line no-await-in-loop
      const result = await retryFn(entry);
      successes.push(result);
      // success — entry is dropped (not pushed to survivors)
    } catch {
      survivors.push({
        ...entry,
        attempts:    (entry.attempts || 0) + 1,
        lastErrorAt: _now(),
      });
    }
  }

  _write(survivors);
  return successes;
}

/** Wipe the queue (sign-out / debug). */
export function clearQueue() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(QUEUE_KEY);
    }
  } catch { /* ignore */ }
}

/**
 * Best-effort online detector. Returns true when we can't determine
 * (some environments lie about navigator.onLine), so callers that
 * use this as a gate err on the side of trying.
 *
 * @returns {boolean}
 */
export function isLikelyOnline() {
  try {
    if (typeof navigator === 'undefined') return true;
    if (typeof navigator.onLine !== 'boolean') return true;
    return navigator.onLine;
  } catch {
    return true;
  }
}

export default {
  enqueueScan,
  getQueuedScanCount,
  listQueuedScans,
  drainQueue,
  clearQueue,
  isLikelyOnline,
  QUEUE_KEY,
  QUEUE_CAP,
  MAX_ATTEMPTS,
};
