/**
 * scanPersistenceBridge.js — Runtime Authority Cleanup §2.
 *
 *   import {
 *     persistScanToJournal, persistScanUseful, markScanTaskAdded,
 *     createScanFollowUpTasks,
 *   } from 'src/core/scan/scanPersistenceBridge.js';
 *
 * What this is
 * ────────────
 *   ScanRuntime + downstream consumers call this bridge instead of
 *   pages calling `saveScanEntry` / `saveScanUseful` / `addScanTasks`
 *   / `markTaskAdded` directly. The bridge is the single funnel for
 *   scan persistence side-effects:
 *
 *     • journal entry write
 *     • scan-useful history mirror
 *     • follow-up task creation
 *     • idempotent task-added flag
 *
 *   ScanPage was the only direct caller; after this commit it
 *   delegates here. Every entry validates that the scan result is
 *   structurally complete BEFORE writing — invalid scans never
 *   pollute the journal or task list.
 *
 *   The bridge composes — does not replace — the underlying stores:
 *
 *     • scanHistory.saveScanEntry      (the journal-side entry)
 *     • scanHistoryStore.saveScanUseful (mirror for the result card)
 *     • scanToTask.addScanTasks        (follow-up tasks)
 *     • scanHistoryStore.markTaskAdded (idempotency flag)
 *
 *   Each call is independently try/catch'd so a journal write
 *   failure doesn't block the task creation that follows.
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws. SSR-safe.
 *   • Each delegation wrapped in safe — a downstream store throw
 *     becomes `{ok: false, reason}` not a crash.
 *   • Rejects scans that fail the structural check (no imageUrl,
 *     no diagnosis, no scanId) — failed images never persist.
 */

import { saveScanEntry } from '../../data/scanHistory.js';
import {
  saveScanUseful, markTaskAdded,
} from '../../lib/scan/scanHistoryStore.js';
import { addScanTasks } from '../scanToTask.js';

const BRIDGE_VERSION = 'scan-persistence-v1';

const _isObj = (v) => v != null && typeof v === 'object';
const _str   = (v) => (typeof v === 'string' ? v : '');
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };

function _isPersistable(result) {
  if (!_isObj(result)) return false;
  // Minimum structural check — must have an id-ish field and SOME
  // user-visible content (diagnosis, possibleIssue, or category).
  // Failed images don't pass this gate.
  const id = _str(result.scanId || result.id || result.sessionId);
  if (!id) return false;
  const hasContent = !!(result.diagnosis || result.possibleIssue
    || result.category || result.mlLabel);
  return hasContent;
}

/**
 * Write a validated scan to the canonical journal store.
 * Returns `{ ok, entry, reason }`.
 */
export function persistScanToJournal(result, opts) {
  return _safe(() => {
    if (!_isPersistable(result)) {
      return Object.freeze({
        ok: false, entry: null, reason: 'result_not_persistable',
        bridgeVersion: BRIDGE_VERSION,
      });
    }
    const safeOpts = _isObj(opts) ? opts : {};
    const entry = _safe(() => saveScanEntry(result, safeOpts), null);
    return Object.freeze({
      ok: !!entry, entry, reason: entry ? null : 'save_failed',
      bridgeVersion: BRIDGE_VERSION,
    });
  }, Object.freeze({
    ok: false, entry: null, reason: 'bridge_error',
    bridgeVersion: BRIDGE_VERSION,
  }));
}

/**
 * Mirror the scan into the result-card store so subsequent
 * surfaces (Journal entry detail, history list) see the same
 * envelope.
 */
export function persistScanUseful(result, opts) {
  return _safe(() => {
    if (!_isPersistable(result)) {
      return Object.freeze({
        ok: false, reason: 'result_not_persistable',
        bridgeVersion: BRIDGE_VERSION,
      });
    }
    const safeOpts = _isObj(opts) ? opts : {};
    _safe(() => saveScanUseful(result, safeOpts), null);
    return Object.freeze({
      ok: true, reason: null,
      bridgeVersion: BRIDGE_VERSION,
    });
  }, Object.freeze({
    ok: false, reason: 'bridge_error',
    bridgeVersion: BRIDGE_VERSION,
  }));
}

/**
 * Idempotently flag that a scan's tasks have been added — prevents
 * double-creation on retry/re-mount.
 */
export function markScanTaskAdded(scanId) {
  return _safe(() => {
    if (!_str(scanId)) {
      return Object.freeze({
        ok: false, reason: 'no_scan_id',
        bridgeVersion: BRIDGE_VERSION,
      });
    }
    _safe(() => markTaskAdded(scanId), null);
    return Object.freeze({
      ok: true, reason: null,
      bridgeVersion: BRIDGE_VERSION,
    });
  }, Object.freeze({
    ok: false, reason: 'bridge_error',
    bridgeVersion: BRIDGE_VERSION,
  }));
}

/**
 * Create follow-up tasks for the scan. Rejects when the scan is
 * not persistable (failed-image guard).
 *
 *   @param {Array}  suggestedTasks
 *   @param {object} opts            — passed straight to addScanTasks
 *   @returns {{ ok, stored, reason }}
 */
export function createScanFollowUpTasks(suggestedTasks, opts) {
  return _safe(() => {
    if (!Array.isArray(suggestedTasks) || suggestedTasks.length === 0) {
      return Object.freeze({
        ok: false, stored: [], reason: 'no_suggested_tasks',
        bridgeVersion: BRIDGE_VERSION,
      });
    }
    const safeOpts = _isObj(opts) ? opts : {};
    // Validate the scanId from opts so we never create orphan tasks.
    if (!_str(safeOpts.scanId)) {
      return Object.freeze({
        ok: false, stored: [], reason: 'no_scan_id_in_opts',
        bridgeVersion: BRIDGE_VERSION,
      });
    }
    const stored = _safe(() => addScanTasks(suggestedTasks, safeOpts), []);
    return Object.freeze({
      ok: true, stored: Object.freeze(stored || []), reason: null,
      bridgeVersion: BRIDGE_VERSION,
    });
  }, Object.freeze({
    ok: false, stored: [], reason: 'bridge_error',
    bridgeVersion: BRIDGE_VERSION,
  }));
}

export const _internal = Object.freeze({
  _isPersistable, BRIDGE_VERSION,
});

const _module = {
  persistScanToJournal, persistScanUseful,
  markScanTaskAdded, createScanFollowUpTasks,
  _internal,
};
export default _module;
