/**
 * runtime/flywheel/eventEngine.js — Phase 14 normalized event model.
 *
 *   import {
 *     EVENT_KIND, normalizeEvent, validateEvent, eventEquals,
 *   } from 'src/runtime/flywheel/eventEngine.js';
 *
 * What this is
 * ────────────
 *   The canonical event-shape contract for the Farroway data
 *   flywheel. Every farmer interaction normalizes through here on
 *   the way to the wave-5 event store. Pure compute — no I/O.
 *
 *   Canonical shape:
 *     {
 *       eventId,    // stable hash from sourceId + kind + timestamp
 *       userId,     // farmer user id (NEVER name/email/phone)
 *       farmId,     // optional
 *       cropId,     // optional
 *       eventType,  // a value from EVENT_KIND
 *       timestamp,  // ISO
 *       location,   // { regionLabel } only — no lat/lng
 *       metadata,   // free-form payload, PII-scrubbed by caller
 *       schemaVersion: 'v14',
 *     }
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • No PII fields accepted at this layer — `location` only
 *     carries `regionLabel`, never lat/lng or address.
 *   • Composition-only — engines downstream read events; they
 *     don't reach back into the event store.
 */

export const EVENT_ENGINE_VERSION = 'event-engine-v1';
export const EVENT_SCHEMA_VERSION = 'v14';

export const EVENT_KIND = Object.freeze({
  FARM_CREATED:             'farm_created',
  CROP_ADDED:               'crop_added',
  TASK_COMPLETED:           'task_completed',
  SCAN_COMPLETED:           'scan_completed',
  SCAN_NEEDS_REVIEW:        'scan_needs_review',
  JOURNAL_CREATED:          'journal_created',
  WEATHER_ALERT_VIEWED:     'weather_alert_viewed',
  HEALTH_SCORE_CHANGED:     'health_score_changed',
  YIELD_FORECAST_GENERATED: 'yield_forecast_generated',
  READY_TO_SELL_MARKED:     'ready_to_sell_marked',
  GRANT_VIEWED:             'grant_viewed',
  RECOMMENDATION_SHOWN:     'recommendation_shown',
  RECOMMENDATION_ACCEPTED:  'recommendation_accepted',
  RECOMMENDATION_IGNORED:   'recommendation_ignored',
  RECOMMENDATION_COMPLETED: 'recommendation_completed',
  TREATMENT_APPLIED:        'treatment_applied',
  PLANTING_LOGGED:          'planting_logged',
  HARVEST_LOGGED:           'harvest_logged',
  WEATHER_EVENT_RECORDED:   'weather_event_recorded',
});

const _kindSet = new Set(Object.values(EVENT_KIND));
const _isObj = (v) => v != null && typeof v === 'object';
const _str   = (v) => (typeof v === 'string' ? v : '');
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };

// PII drop-list — refuses to carry these through the event layer.
// Kept in sync with the Phase 12 anonymizer.
const PII_KEYS = Object.freeze([
  'farmerName', 'fullName', 'email', 'phone', 'phoneNumber',
  'deviceId', 'sessionId', 'address',
  'lat', 'lng', 'latitude', 'longitude', 'gpsLat', 'gpsLng',
  'ipAddress', 'ip', 'fingerprint',
  'imageBase64', 'imageUrl', 'thumbnail', 'photoUrl',
]);

function _stripPII(obj) {
  if (!_isObj(obj)) return null;
  const out = {};
  for (const k of Object.keys(obj)) {
    if (PII_KEYS.indexOf(k) !== -1) continue;
    const v = obj[k];
    if (v == null) continue;
    if (typeof v === 'function') continue;
    if (_isObj(v) && !Array.isArray(v)) {
      const sub = _stripPII(v);
      if (sub && Object.keys(sub).length > 0) out[k] = sub;
    } else {
      out[k] = v;
    }
  }
  return out;
}

function _hash(s) {
  // Light, deterministic hash — not crypto, just a stable ID.
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

function _eventId(raw) {
  const k  = _str(raw && raw.eventType);
  const t  = _str(raw && raw.timestamp);
  const s  = _str((raw && raw.sourceId) || (raw && raw.eventId) || '');
  if (s) return 'evt_' + _hash(k + '|' + t + '|' + s);
  return 'evt_' + _hash(k + '|' + t + '|' + JSON.stringify(raw && raw.metadata || {}));
}

/**
 * Normalize any caller-supplied event object into the canonical
 * Phase 14 shape. Returns null if eventType is unknown.
 */
export function normalizeEvent(raw) {
  return _safe(() => {
    if (!_isObj(raw)) return null;
    const eventType = _str(raw.eventType || raw.kind);
    if (!_kindSet.has(eventType)) return null;
    const timestamp = _str(raw.timestamp || raw.at) || new Date().toISOString();

    const loc = _isObj(raw.location) ? raw.location : null;
    const location = loc ? Object.freeze({
      regionLabel: _str(loc.regionLabel || loc.region),
    }) : Object.freeze({ regionLabel: '' });

    const metadata = _stripPII(raw.metadata) || {};

    return Object.freeze({
      eventId:       _eventId({ eventType, timestamp,
                                sourceId: raw.eventId || raw.sourceId,
                                metadata }),
      userId:        _str(raw.userId),
      farmId:        _str(raw.farmId),
      cropId:        _str(raw.cropId),
      eventType,
      timestamp,
      location,
      metadata:      Object.freeze(metadata),
      schemaVersion: EVENT_SCHEMA_VERSION,
    });
  }, null);
}

export function validateEvent(e) {
  if (!_isObj(e)) return { ok: false, reason: 'not_object' };
  if (!_kindSet.has(_str(e.eventType))) {
    return { ok: false, reason: 'unknown_eventType' };
  }
  if (!_str(e.timestamp)) return { ok: false, reason: 'missing_timestamp' };
  if (!_str(e.eventId))   return { ok: false, reason: 'missing_eventId' };
  if (e.schemaVersion !== EVENT_SCHEMA_VERSION) {
    return { ok: false, reason: 'wrong_schemaVersion' };
  }
  // PII spot-check on metadata
  if (_isObj(e.metadata)) {
    for (const k of Object.keys(e.metadata)) {
      if (PII_KEYS.indexOf(k) !== -1) {
        return { ok: false, reason: 'metadata_contains_pii:' + k };
      }
    }
  }
  return { ok: true, reason: '' };
}

export function eventEquals(a, b) {
  if (!_isObj(a) || !_isObj(b)) return false;
  return _str(a.eventId) !== '' && a.eventId === b.eventId;
}

export const _internals = Object.freeze({ PII_KEYS, _hash });
