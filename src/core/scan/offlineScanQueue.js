/**
 * offlineScanQueue.js — preserve scans when offline + sync on
 * reconnect. Spec §15.
 *
 *   import {
 *     enqueueOfflineScan, drainOfflineQueue, getQueuedScans,
 *     clearOfflineQueue,
 *   } from 'src/core/scan/offlineScanQueue.js';
 *
 * What this is
 * ────────────
 *   A small append-only queue of scan drafts that the user
 *   captured but couldn't upload + analyze due to offline state.
 *   Survives page reloads via localStorage. Sync-on-reconnect is
 *   driven by the caller — `drainOfflineQueue(processor)` invokes
 *   the supplied processor for each queued row, removing only
 *   successfully-processed entries.
 *
 *   Entries carry a structural row only — never raw image bytes
 *   in the queue itself (those live in scanImageStore /
 *   IndexedDB). The queue holds the imageId pointer + the scan
 *   draft metadata.
 *
 * Strict-rule audit
 *   • Pure-ish runtime. Never throws. SSR-safe.
 *   • localStorage wrapped — quota / private-mode silent-degrades.
 *   • Capped at 50 queued scans.
 *   • Idempotent enqueue via clientDraftId.
 */

const ENGINE_VERSION = 'offline-scan-queue-v1';
const STORAGE_KEY = 'farroway:offlineScanQueue:v1';
const MAX_QUEUE = 50;

const _isObj = (v) => v != null && typeof v === 'object';
const _str   = (v) => (typeof v === 'string' ? v : '');
const _num   = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };

function _readQueue() {
  return _safe(() => {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  }, []);
}

function _writeQueue(arr) {
  _safe(() => {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  });
}

/**
 * Enqueue a scan draft. Idempotent on clientDraftId — calling
 * twice with the same id updates the row instead of duplicating.
 */
export function enqueueOfflineScan(draft) {
  return _safe(() => {
    if (!_isObj(draft)) return null;
    const clientDraftId = _str(draft.clientDraftId)
      || ('draft_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8));
    const row = Object.freeze({
      clientDraftId,
      sessionId:     _str(draft.sessionId) || null,
      farmId:        _str(draft.farmId) || null,
      crop:          _str(draft.crop) || null,
      cropStage:     _str(draft.cropStage) || null,
      imageId:       _str(draft.imageId) || null,
      previewUrl:    _str(draft.previewUrl) || null,
      notes:         (typeof draft.notes === 'string' && draft.notes)
                       ? draft.notes.slice(0, 240) : null,
      weatherSnapshot: _isObj(draft.weatherSnapshot)
                       ? Object.freeze({ ...draft.weatherSnapshot }) : null,
      enqueuedAt:    Date.now(),
      retries:       _num(draft.retries) || 0,
    });
    const log = _readQueue();
    const idx = log.findIndex((r) => r && r.clientDraftId === clientDraftId);
    if (idx >= 0) log[idx] = row;
    else log.push(row);
    if (log.length > MAX_QUEUE) log.splice(0, log.length - MAX_QUEUE);
    _writeQueue(log);
    return row;
  }, null);
}

/** Read every queued scan. */
export function getQueuedScans() {
  return _readQueue();
}

/**
 * Process the queue with a caller-supplied processor. The
 * processor receives each row and returns either:
 *   • { ok: true }   — row is removed
 *   • { ok: false }  — row stays + retries++
 *
 * The processor may be async. drain() returns a summary.
 */
export async function drainOfflineQueue(processor) {
  return _safe(async () => {
    if (typeof processor !== 'function') {
      return _summary(0, 0, 0, 'no_processor');
    }
    const initial = _readQueue();
    if (initial.length === 0) return _summary(0, 0, 0, 'empty');
    const kept = [];
    let processed = 0;
    let failed = 0;
    for (const row of initial) {
      try {
        const result = await processor(row);
        if (result && result.ok === true) {
          processed += 1;
        } else {
          failed += 1;
          kept.push(Object.freeze({ ...row, retries: (row.retries || 0) + 1 }));
        }
      } catch {
        failed += 1;
        kept.push(Object.freeze({ ...row, retries: (row.retries || 0) + 1 }));
      }
    }
    _writeQueue(kept);
    return _summary(initial.length, processed, failed, null);
  }, _summary(0, 0, 0, 'drain_error'));
}

function _summary(total, processed, failed, reason) {
  return Object.freeze({
    engineVersion: ENGINE_VERSION,
    total, processed, failed,
    remaining: _readQueue().length,
    reason,
    completedAt: Date.now(),
  });
}

/** Drop the queue. */
export function clearOfflineQueue() { _writeQueue([]); }

export const _internal = Object.freeze({
  STORAGE_KEY, MAX_QUEUE, ENGINE_VERSION,
});

const _module = {
  enqueueOfflineScan, drainOfflineQueue,
  getQueuedScans, clearOfflineQueue, _internal,
};
export default _module;
