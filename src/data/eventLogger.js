/**
 * eventLogger.js — append-only event log for the future ML
 * training pipeline.
 *
 *   logEvent(type, payload)
 *     -> { id, type, payload, timestamp }
 *
 * Storage: localStorage `farroway_events`.
 * Cap:     MAX_EVENTS = 5000 (drop-oldest LRU). At ~150 bytes
 *          per row that's <1 MB - well under localStorage's
 *          5-10 MB quota even on low-end browsers.
 *
 * Strict-rule audit:
 *   * works offline (localStorage only)
 *   * never throws (every IO call try/catch wrapped)
 *   * lightweight: capped array; no IDB cost yet
 *   * structured: every record carries a stable shape +
 *     SCHEMA_VERSION so the Python ingestion job can validate
 *     batches before training
 *
 * Privacy
 *   The logger is a thin pass-through - it never inspects the
 *   payload. Callers MUST avoid passing PII (names, phones,
 *   emails). The auto-log call sites in progressStore +
 *   outbreakStore only pass IDs + signal data.
 */

export const STORAGE_KEY    = 'farroway_events';
export const SCHEMA_VERSION = 1;
export const MAX_EVENTS     = 5000;

/**
 * Canonical event types. Adding a new type here keeps the
 * Python schema and the JS callers from drifting.
 *
 * The original v1 set (TASK_VIEWED, TASK_COMPLETED, etc.) is
 * preserved for back-compat. The v2 data-foundation spec adds
 * 15 more types covering auth, sync, location, language,
 * accessibility, and explicit risk-alert / outcome events.
 */
export const EVENT_TYPES = Object.freeze({
  // ── Auth / lifecycle ──────────────────────────────────────
  AUTH_LOGIN:            'AUTH_LOGIN',
  APP_OPENED:            'APP_OPENED',

  // ── Today / task interaction ──────────────────────────────
  TODAY_VIEWED:          'TODAY_VIEWED',
  TASK_VIEWED:           'TASK_VIEWED',           // legacy alias
  TASK_GENERATED:        'TASK_GENERATED',
  TASK_LISTENED:         'TASK_LISTENED',
  TASK_COMPLETED:        'TASK_COMPLETED',
  TASK_SKIPPED:          'TASK_SKIPPED',

  // ── Label + outcome ───────────────────────────────────────
  LABEL_SUBMITTED:       'LABEL_SUBMITTED',
  OUTCOME_SUBMITTED:     'OUTCOME_SUBMITTED',

  // ── Location ──────────────────────────────────────────────
  LOCATION_CAPTURED:     'LOCATION_CAPTURED',
  LOCATION_DENIED:       'LOCATION_DENIED',

  // ── Risk alerts ───────────────────────────────────────────
  WEATHER_ALERT_SHOWN:   'WEATHER_ALERT_SHOWN',
  RISK_ALERT_SHOWN:      'RISK_ALERT_SHOWN',
  PEST_REPORTED:         'PEST_REPORTED',
  DROUGHT_REPORTED:      'DROUGHT_REPORTED',
  DROUGHT_ALERT_SHOWN:   'DROUGHT_ALERT_SHOWN',   // legacy alias
  WEATHER_FETCHED:       'WEATHER_FETCHED',
  RISK_COMPUTED:         'RISK_COMPUTED',

  // ── Sync / offline ────────────────────────────────────────
  OFFLINE_ACTION_QUEUED: 'OFFLINE_ACTION_QUEUED',
  SYNC_SUCCESS:          'SYNC_SUCCESS',
  SYNC_FAILED:           'SYNC_FAILED',

  // ── Accessibility / preferences ───────────────────────────
  LANGUAGE_CHANGED:      'LANGUAGE_CHANGED',
  SIMPLE_MODE_ENABLED:   'SIMPLE_MODE_ENABLED',
  SIMPLE_MODE_DISABLED:  'SIMPLE_MODE_DISABLED',

  // ── Misc ──────────────────────────────────────────────────
  FARM_INACTIVE:         'FARM_INACTIVE',
});

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

function _safeRemove(key) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(key);
  } catch { /* swallow */ }
}

function _read() {
  const raw = _safeGet(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    _safeRemove(STORAGE_KEY);
    return [];
  }
}

function _write(events) {
  // Drop oldest when over the cap. Keeping the most recent
  // MAX_EVENTS rows is the right ML choice: training rarely
  // benefits from year-old labels and quota cliffs hurt every
  // farmer on the device.
  const trimmed = events.length > MAX_EVENTS
    ? events.slice(events.length - MAX_EVENTS)
    : events;
  try { _safeSet(STORAGE_KEY, JSON.stringify(trimmed)); }
  catch { /* swallow */ }
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
  return `${ts}_${rand}`;
}

function _isOnline() {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
      return navigator.onLine;
    }
  } catch { /* ignore */ }
  return true;
}

/**
 * logEvent(type, payload)
 *
 * Append a single event. Returns the stored record (frozen).
 * Always succeeds in the sense that a corrupt store is reset
 * and the new event is the only entry rather than throwing.
 *
 * Records gained two flags in the v2 data-foundation pass:
 *   * offline — true when navigator.onLine === false at write
 *               time. Lets the trainer + NGO aggregates
 *               distinguish "logged on a flight-mode tap" from
 *               "logged on a connected device".
 *   * synced  — false until markEventSynced(id) flips it to
 *               true. The sync drainer pulls
 *               getUnsyncedEvents() and only marks rows it
 *               successfully shipped to the server.
 *
 * Both flags are additive; existing v1 callers (which only
 * read type / payload / timestamp / id) keep working unchanged.
 */
export function logEvent(type, payload) {
  const record = Object.freeze({
    id:        _mintId(),
    type:      String(type || 'UNKNOWN'),
    payload:   payload == null ? null : payload,
    timestamp: Date.now(),
    offline:   !_isOnline(),
    synced:    false,
    v:         SCHEMA_VERSION,
  });
  const events = _read();
  events.push(record);
  _write(events);
  return record;
}

/** Read-only access for feature builders + test helpers. */
export function getEvents() { return _read(); }

/** Filter helper used by featureStore + per-farm summaries. */
export function getEventsForFarm(farmId) {
  if (!farmId) return [];
  const target = String(farmId);
  return _read().filter((e) => {
    const p = e && e.payload;
    return p && p.farmId != null && String(p.farmId) === target;
  });
}

/**
 * getUnsyncedEvents() → Array<event>
 *
 * Returns every event whose `synced` flag is not true. Used by
 * the offline sync drainer: pull, ship to server, then call
 * markEventSynced(id) for each successful response. v1 records
 * (no `synced` field) are returned too — they predate the flag
 * and the sync layer should treat them as unsynced for safety.
 */
export function getUnsyncedEvents() {
  return _read().filter((e) => e && e.synced !== true);
}

/**
 * markEventSynced(id) → boolean
 *
 * Flip a single event's `synced` flag to true. Returns true
 * when the row was found + updated, false otherwise. The flag
 * is set in-place on a NEW frozen record (we replace the entry
 * rather than mutate the frozen original) so concurrent readers
 * can't observe a half-written record.
 */
export function markEventSynced(id) {
  if (!id) return false;
  const events = _read();
  const idx = events.findIndex((e) => e && e.id === id);
  if (idx < 0) return false;
  const prev = events[idx] || {};
  events[idx] = Object.freeze({ ...prev, synced: true });
  _write(events);
  return true;
}

/**
 * markEventsSynced(ids) → number of rows updated.
 * Convenience for batch callers — single read + single write.
 */
export function markEventsSynced(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return 0;
  const set = new Set(ids.map(String));
  const events = _read();
  let n = 0;
  for (let i = 0; i < events.length; i += 1) {
    const e = events[i];
    if (e && set.has(String(e.id)) && e.synced !== true) {
      events[i] = Object.freeze({ ...e, synced: true });
      n += 1;
    }
  }
  if (n > 0) _write(events);
  return n;
}

/** Test / admin "clear" helper. */
export function clearEvents() { _safeRemove(STORAGE_KEY); }
