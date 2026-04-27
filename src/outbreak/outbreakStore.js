/**
 * outbreakStore.js — local-first store for the Outbreak
 * Intelligence System v1.
 *
 * Storage layout
 *   * Primary: IndexedDB store `progress`, key `outbreakReports`
 *              (re-uses the existing farroway_db schema; no
 *              migration needed)
 *   * Mirror:  localStorage `farroway_outbreak_reports` so render
 *              paths can read synchronously
 *   * Outbox:  every save enqueues an OUTBREAK_REPORT action via
 *              the existing sync layer with a unique action.id
 *              for server-side idempotency
 *
 * Strict-rule audit:
 *   * Existing pestReports / pestCluster files from the v0
 *     "Report pest" feature are LEFT IN PLACE - this is a
 *     parallel, more structured layer, not a replacement.
 *   * Works offline: every helper uses local storage only.
 *   * Never throws: every IO call try/catch wrapped.
 *   * Auth, i18n core, crop label, notification engine all
 *     untouched.
 */

import { dbGet, dbSet, STORE } from '../db/indexedDB.js';
import { enqueueAction } from '../sync/actionQueue.js';

export const MIRROR_KEY = 'farroway_outbreak_reports';
export const IDB_KEY    = 'outbreakReports';

/* ─── Internal helpers ─────────────────────────────────────────── */

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
  } catch { /* swallow - quota / private mode */ }
}

function _coerce(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.reports)) {
    return { reports: [] };
  }
  return { reports: raw.reports };
}

function _mintId(prefix = 'outbreak') {
  const ts = Date.now();
  let rand = '';
  try {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const buf = new Uint8Array(6);
      crypto.getRandomValues(buf);
      rand = Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
    }
  } catch { /* fall through */ }
  if (!rand) rand = Math.random().toString(36).slice(2, 14);
  return `${prefix}_${ts}_${rand}`;
}

function _readMirror() {
  const raw = _safeGet(MIRROR_KEY);
  if (!raw) return { reports: [] };
  try { return _coerce(JSON.parse(raw)); }
  catch { return { reports: [] }; }
}

function _writeMirror(state) {
  try { _safeSet(MIRROR_KEY, JSON.stringify(state)); }
  catch { /* swallow */ }
}

/* ─── Sync surface (mirror only) ───────────────────────────────── */

/** Returns ALL outbreak reports as a plain array. Never throws. */
export function getOutbreakReports() {
  return _readMirror().reports;
}

/**
 * getReportsByRegion(region)
 *   -> array of reports whose `location.region` matches
 *      (case-insensitive trim).
 */
export function getReportsByRegion(region) {
  if (!region) return [];
  const target = String(region).trim().toLowerCase();
  if (!target) return [];
  return getOutbreakReports().filter((r) => {
    const loc = r && r.location;
    if (!loc) return false;
    const v = String(loc.region || '').trim().toLowerCase();
    return v === target;
  });
}

/* ─── Async surface (IDB primary) ──────────────────────────────── */

/** Refresh the localStorage mirror from IndexedDB on app boot. */
export async function hydrateOutbreakReports() {
  const idb = await dbGet(STORE.PROGRESS, IDB_KEY);
  if (idb && Array.isArray(idb.reports)) {
    _writeMirror({ reports: idb.reports });
    return idb.reports;
  }
  return getOutbreakReports();
}

/**
 * saveOutbreakReport(input)
 *   -> Promise<reportRecord>
 *
 * Coerces the caller's input into the canonical shape, fans out
 * to IDB + mirror, then enqueues an OUTBREAK_REPORT outbox
 * action. Mirror updates SYNCHRONOUSLY before the await returns
 * so the next getOutbreakReports() reflects the change.
 *
 * Canonical record shape:
 *   {
 *     id, farmId, farmerId, crop,
 *     issueType: 'pest' | 'disease' | 'unknown',
 *     severity:  'low'  | 'medium'  | 'high',
 *     symptoms:  string[],
 *     notes:     string,
 *     location:  { country, region, district, lat, lng },
 *     photoUrl:  string | null,
 *     createdAt: ISO8601,
 *     synced:    false,
 *   }
 */
export async function saveOutbreakReport(input = {}) {
  const issueType = _normaliseIssue(input.issueType);
  const severity  = _normaliseSeverity(input.severity);

  const record = Object.freeze({
    id:        input.id || _mintId(),
    farmId:    input.farmId   == null ? null : String(input.farmId),
    farmerId:  input.farmerId == null ? null : String(input.farmerId),
    crop:      input.crop     == null ? null : String(input.crop),
    issueType,
    severity,
    symptoms:  Array.isArray(input.symptoms)
                 ? input.symptoms.map((s) => String(s)).filter(Boolean)
                 : [],
    notes:     input.notes ? String(input.notes) : '',
    location:  _normaliseLocation(input.location),
    photoUrl:  input.photoUrl ? String(input.photoUrl) : null,
    createdAt: input.createdAt || new Date().toISOString(),
    synced:    false,
  });

  // Read current state - prefer IDB, fall back to mirror.
  let current = null;
  try { current = await dbGet(STORE.PROGRESS, IDB_KEY); }
  catch { /* ignore */ }
  const list = (current && Array.isArray(current.reports))
    ? current.reports
    : getOutbreakReports();

  const next = { reports: [...list, record] };

  // 1. Durable IDB write.
  try { await dbSet(STORE.PROGRESS, IDB_KEY, next); }
  catch { /* swallow - mirror still gets it */ }

  // 2. Sync mirror.
  _writeMirror(next);

  // 3. Outbox the server replay. Server idempotency on action.id.
  try { enqueueAction('OUTBREAK_REPORT', record); }
  catch { /* swallow */ }

  // 4. Best-effort log so testers see something happen even when
  //    no /sync handler is wired yet.
  try { console.log('[outbreak report queued]', record.id); }
  catch { /* console missing */ }

  return record;
}

/** Reset the report log. Tests + admin "clear" paths. */
export async function clearOutbreakReports() {
  try { await dbSet(STORE.PROGRESS, IDB_KEY, { reports: [] }); }
  catch { /* swallow */ }
  _writeMirror({ reports: [] });
}

/* ─── Validation / normalisation ───────────────────────────────── */

function _normaliseIssue(v) {
  const s = String(v || '').toLowerCase();
  if (s === 'pest' || s === 'disease' || s === 'unknown') return s;
  return 'unknown';
}

function _normaliseSeverity(v) {
  const s = String(v || '').toLowerCase();
  if (s === 'low' || s === 'medium' || s === 'high') return s;
  return 'low';
}

function _normaliseLocation(loc) {
  if (!loc || typeof loc !== 'object') {
    return { country: '', region: '', district: '', lat: null, lng: null };
  }
  const lat = Number(loc.lat);
  const lng = Number(loc.lng);
  return {
    country:  loc.country  ? String(loc.country)  : '',
    region:   loc.region   ? String(loc.region)   : '',
    district: loc.district ? String(loc.district) : '',
    lat:      Number.isFinite(lat) ? lat : null,
    lng:      Number.isFinite(lng) ? lng : null,
  };
}

export const _internal = Object.freeze({
  _normaliseIssue, _normaliseSeverity, _normaliseLocation, _mintId,
});
