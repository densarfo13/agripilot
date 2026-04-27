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
 * Canonical event types per spec section 2. Adding a new type
 * here keeps the Python schema and the JS callers from drifting.
 */
export const EVENT_TYPES = Object.freeze({
  TASK_VIEWED:           'TASK_VIEWED',
  TASK_COMPLETED:        'TASK_COMPLETED',
  PEST_REPORTED:         'PEST_REPORTED',
  DROUGHT_ALERT_SHOWN:   'DROUGHT_ALERT_SHOWN',
  FARM_INACTIVE:         'FARM_INACTIVE',
  WEATHER_FETCHED:       'WEATHER_FETCHED',
  RISK_COMPUTED:         'RISK_COMPUTED',
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

/**
 * logEvent(type, payload)
 *
 * Append a single event. Returns the stored record (frozen).
 * Always succeeds in the sense that a corrupt store is reset
 * and the new event is the only entry rather than throwing.
 */
export function logEvent(type, payload) {
  const record = Object.freeze({
    id:        _mintId(),
    type:      String(type || 'UNKNOWN'),
    payload:   payload == null ? null : payload,
    timestamp: Date.now(),
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

/** Test / admin "clear" helper. */
export function clearEvents() { _safeRemove(STORAGE_KEY); }
