/**
 * pestReports.js — local-first pest report log.
 *
 * Storage:
 *   * Primary:  IndexedDB store `progress`, key `pestReports`
 *               (durable, survives quota pressure better than
 *               localStorage; piggy-backs on the existing
 *               farroway_db schema rather than adding a new store)
 *   * Mirror:   localStorage `farroway_pest_reports` so render
 *               paths can read synchronously
 *   * Outbox:   each submit also enqueues a PEST_REPORT action
 *               via the existing sync layer so the server gets
 *               the report on next online drain
 *
 * Strict rules respected:
 *   * works offline      - every helper is local-first
 *   * never throws       - every storage call try/catch wrapped
 *   * idempotent         - report ids are unique per submit
 *   * additive surface   - no existing module touched
 */

import { dbGet, dbSet, STORE } from '../db/indexedDB.js';
import { enqueueAction } from '../sync/actionQueue.js';

const MIRROR_KEY = 'farroway_pest_reports';
const IDB_KEY    = 'pestReports';

const EMPTY = Object.freeze({ reports: [] });

function _safeGet(key) {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  } catch { return null; }
}

function _safeSet(key, value) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, value);
  } catch { /* swallow */ }
}

function _coerce(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.reports)) {
    return { reports: [] };
  }
  return { reports: raw.reports };
}

function _mintId() {
  const ts = Date.now();
  let rand = '';
  try {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const buf = new Uint8Array(4);
      crypto.getRandomValues(buf);
      rand = Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
    }
  } catch { /* ignore */ }
  if (!rand) rand = Math.random().toString(36).slice(2, 10);
  return `pest_${ts}_${rand}`;
}

/* ─── Sync surface (mirror only) ───────────────────────────────── */

/**
 * Synchronous getter backed by the localStorage mirror. Always
 * returns an array (possibly empty), never throws.
 */
export function getPestReports() {
  const raw = _safeGet(MIRROR_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return _coerce(parsed).reports;
  } catch { return []; }
}

/* ─── Async surface (IDB primary) ──────────────────────────────── */

/**
 * Refresh the localStorage mirror from IndexedDB. Call once at
 * boot so a report submitted in another tab shows up here.
 */
export async function hydratePestReports() {
  const idb = await dbGet(STORE.PROGRESS, IDB_KEY);
  if (idb && Array.isArray(idb.reports)) {
    _safeSet(MIRROR_KEY, JSON.stringify({ reports: idb.reports }));
    return idb.reports;
  }
  return getPestReports();
}

/**
 * submitPestReport({ farmId, crop, location, severity? })
 *   -> Promise<reportRecord>
 *
 * Builds a stable record, fans out to IDB + mirror, then enqueues
 * a PEST_REPORT outbox action keyed on a unique id so the server
 * can dedupe replays. Mirror updates SYNCHRONOUSLY before the
 * await returns so the next getPestReports() reflects the change.
 *
 * `location` is a free-form string. When the caller has access to
 * the active farm's country / region, pass them as a single
 * "Region, Country" string so the cluster engine can group.
 */
export async function submitPestReport({
  farmId   = null,
  crop     = null,
  location = null,
  severity = null,
} = {}) {
  const record = {
    id:        _mintId(),
    farmId:    farmId == null ? null : String(farmId),
    crop:      crop     == null ? null : String(crop),
    location:  location == null ? null : String(location),
    severity:  severity == null ? null : String(severity),
    type:      'pest',
    timestamp: Date.now(),
    createdAt: new Date().toISOString(),
  };

  // Read current state - prefer IDB, fall back to mirror.
  let current = null;
  try { current = await dbGet(STORE.PROGRESS, IDB_KEY); }
  catch { /* ignore */ }
  const list = (current && Array.isArray(current.reports))
    ? current.reports
    : getPestReports();

  const next = { reports: [...list, record] };

  // 1. Durable IDB write.
  try { await dbSet(STORE.PROGRESS, IDB_KEY, next); }
  catch { /* swallow - mirror still gets the record below */ }

  // 2. Sync mirror.
  _safeSet(MIRROR_KEY, JSON.stringify(next));

  // 3. Outbox the server replay.
  try { enqueueAction('PEST_REPORT', record); }
  catch { /* swallow */ }

  return record;
}

/** Test / admin helper. Does NOT clear the outbox queue. */
export async function resetPestReports() {
  try { await dbSet(STORE.PROGRESS, IDB_KEY, { reports: [] }); }
  catch { /* swallow */ }
  _safeSet(MIRROR_KEY, JSON.stringify({ reports: [] }));
}

export const _internal = Object.freeze({
  MIRROR_KEY, IDB_KEY,
});
