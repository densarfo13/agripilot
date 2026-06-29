/**
 * locationLastAttempt.js — in-memory recorder for recent LOCATION acquisition attempts, so
 * an admin can root-cause "why did location fail in the field?" via GET /api/admin/location/debug.
 *
 * Location runs client-side, so the client POSTs a redacted attempt. Redaction by
 * construction: recordLocationDebug() builds a NEW object from a fixed whitelist of scalar
 * fields. Precise lat/long, API keys, and auth headers are NEVER in the whitelist — only the
 * COARSE coordinates (rounded ~1km) the client already computed.
 * Keeps a small ring (last 20) + the most recent. Never throws.
 */
const _str = (v) => (v == null ? null : String(v).slice(0, 200));
const _num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _bool = (v) => (typeof v === 'boolean' ? v : null);
const _round3 = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null);

const MAX = 20;
let _recent = [];

/** Record one location attempt. Only whitelisted scalar fields are kept; coords are coarse. */
export function recordLocationDebug(a = {}, nowIso) {
  try {
    if (!a || typeof a !== 'object') return getLocationDebug();
    const rec = Object.freeze({
      at:              _str(nowIso) || null,
      outcome:         a.outcome === 'success' ? 'success' : 'error',
      code:            _str(a.code),                 // verdict code (TIMEOUT / PERMISSION_DENIED / …)
      permission:      _str(a.permission),
      isSecureContext: _bool(a.isSecureContext),
      hasGeolocation:  _bool(a.hasGeolocation),
      browser:         _str(a.browser),
      platform:        _str(a.platform),
      latencyMs:       _num(a.latencyMs),
      accuracyM:       _num(a.accuracyM),
      coarseLat:       _round3(a.coarseLat),          // ~1km — never the precise position
      coarseLng:       _round3(a.coarseLng),
      reverseGeocoded: _bool(a.reverseGeocoded),
      errorMessage:    _str(a.errorMessage),
      userId:          _str(a.userId),                // attached server-side from the session
    });
    _recent = [rec, ..._recent].slice(0, MAX);
    return getLocationDebug();
  } catch { return getLocationDebug(); }
}

/** Admin view: the most recent attempt + a short ring of recent attempts. */
export function getLocationDebug() {
  return Object.freeze({ last: _recent[0] || null, recent: Object.freeze(_recent.slice()) });
}

export function clearLocationDebug() { _recent = []; }
