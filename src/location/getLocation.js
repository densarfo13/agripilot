/**
 * getLocation.js — never-throws geolocation read.
 *
 *   const loc = await getLocation();
 *   if (loc) { /\* { lat, lng, accuracy, source, timestamp } *\/ }
 *   else     { /\* user denied / no GPS / no permission \/* }
 *
 * Contract (per the smart-geolocation spec)
 *   * Resolves with a fix object OR `null`. Never throws,
 *     never rejects.
 *   * Object shape: { lat, lng, accuracy, source, timestamp }
 *     where source = 'gps' (this module reads only the browser
 *     geolocation API; future sources like 'manual' / 'ip' /
 *     'cache' get plugged in alongside).
 *   * SSR-safe: a missing `navigator` short-circuits to null.
 *   * Insecure-context safe: HTTP origins (no HTTPS) resolve
 *     null instead of throwing — the browser would block the
 *     fetch anyway, but matching the contract here means the
 *     caller doesn't have to special-case it.
 *
 * Why a separate module
 *   The codebase already has src/lib/location/browserLocation.js
 *   (the strict + throws-on-error promise) and
 *   src/utils/geolocation.js (the permission-state helper).
 *   Both are good for callers that need rich error semantics.
 *   This module is the CALM caller surface the spec asks for —
 *   a single await, a single null check, no error class to
 *   catch. The Today screen + a future location chip wire to
 *   THIS path; the legacy strict surface stays for the
 *   onboarding wizard which uses error codes for its UX.
 *
 * Strict-rule audit
 *   * Pure with respect to time + permissions; impure only by
 *     calling the geolocation API
 *   * Deduped: a successful fix in the same JS session is
 *     reused for `maximumAge` ms so back-to-back calls
 *     (Today re-mount + a future LocationChip) don't re-prompt
 *   * No persisted cache here — the runtime cache lives in
 *     module scope and dies with the tab. A persisted location
 *     cache lives at src/lib/location/locationCache.js for
 *     surfaces that want it; this module deliberately stays
 *     stateless across reloads to avoid serving a stale fix
 *     from a previous farm visit.
 */

const DEFAULT_OPTS = Object.freeze({
  enableHighAccuracy: true,
  timeout:            8000,
  maximumAge:         300000, // 5 min — matches spec snippet
});

// Single in-flight promise so a burst of getLocation() calls
// during the same render tick (e.g. parent + child both
// requesting) makes ONE prompt to the OS. The cache below
// covers the post-resolve case.
let _inflight = null;

// Last successful fix in this JS session. Reused while still
// fresh per maximumAge. Cleared explicitly via clearLocationCache
// for tests + the "force re-fetch" admin path.
let _cachedFix = null;

function _isFresh(fix, maxAgeMs) {
  if (!fix || !fix.timestamp) return false;
  const ts = Date.parse(fix.timestamp);
  if (!Number.isFinite(ts)) return false;
  return (Date.now() - ts) <= maxAgeMs;
}

function _safeResolveNull(resolve) {
  try { resolve(null); } catch { /* never propagate */ }
}

/**
 * getLocation(opts?) → Promise<{lat, lng, accuracy, source, timestamp} | null>
 *
 * opts (all optional):
 *   enableHighAccuracy  — default true
 *   timeout             — ms, default 8000
 *   maximumAge          — ms, default 300000 (5 min)
 *   forceRefresh        — bypass the in-session cache
 */
export function getLocation(opts = {}) {
  const positionOptions = {
    enableHighAccuracy: opts.enableHighAccuracy != null
      ? opts.enableHighAccuracy : DEFAULT_OPTS.enableHighAccuracy,
    timeout: Number.isFinite(opts.timeout) ? opts.timeout : DEFAULT_OPTS.timeout,
    maximumAge: Number.isFinite(opts.maximumAge)
      ? opts.maximumAge : DEFAULT_OPTS.maximumAge,
  };

  // ── Cache hit ──────────────────────────────────────────────
  if (!opts.forceRefresh
      && _cachedFix && _isFresh(_cachedFix, positionOptions.maximumAge)) {
    return Promise.resolve(_cachedFix);
  }

  // ── Single-flight de-dup ───────────────────────────────────
  if (_inflight) return _inflight;

  _inflight = new Promise((resolve) => {
    // SSR / Capacitor pre-init / locked-down WebView — silently
    // resolve null. Never throw from this surface.
    if (typeof navigator === 'undefined') {
      _safeResolveNull(resolve);
      return;
    }
    if (!navigator.geolocation
        || typeof navigator.geolocation.getCurrentPosition !== 'function') {
      _safeResolveNull(resolve);
      return;
    }

    // Insecure context: geolocation API is blocked on plain
    // HTTP in every evergreen browser. Resolve null instead of
    // letting the call go through and reject; either way the
    // farmer doesn't get a fix.
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      _safeResolveNull(resolve);
      return;
    }

    let settled = false;
    function _settle(value) {
      if (settled) return;
      settled = true;
      _inflight = null;
      try { resolve(value); } catch { /* never propagate */ }
    }

    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          try {
            const c = pos && pos.coords;
            if (!c
                || !Number.isFinite(c.latitude)
                || !Number.isFinite(c.longitude)) {
              _settle(null);
              return;
            }
            const fix = Object.freeze({
              lat:       c.latitude,
              lng:       c.longitude,
              accuracy:  Number.isFinite(c.accuracy) ? c.accuracy : null,
              source:    'gps',
              timestamp: new Date().toISOString(),
            });
            _cachedFix = fix;
            // Event tracking — fire-and-forget; never block the
            // resolve path on logger work.
            try {
              import('../data/eventLogger.js').then((m) => {
                try {
                  m.logEvent(m.EVENT_TYPES.LOCATION_CAPTURED, {
                    source:   'gps',
                    accuracy: fix.accuracy,
                  });
                } catch { /* swallow */ }
              }).catch(() => { /* swallow */ });
            } catch { /* swallow */ }
            _settle(fix);
          } catch {
            _settle(null);
          }
        },
        () => {
          // Permission denied / position unavailable / timeout —
          // every error mode collapses to null per the calm
          // contract. Callers that need to distinguish should
          // use src/lib/location/browserLocation.js instead.
          try {
            import('../data/eventLogger.js').then((m) => {
              try { m.logEvent(m.EVENT_TYPES.LOCATION_DENIED, {}); }
              catch { /* swallow */ }
            }).catch(() => { /* swallow */ });
          } catch { /* swallow */ }
          _settle(null);
        },
        positionOptions,
      );
    } catch {
      // Synchronous throw from the API (rare — happens on some
      // older Safari builds when permissions are completely
      // blocked at the system level). Resolve null.
      _settle(null);
    }
  });

  return _inflight;
}

/**
 * clearLocationCache() — drop the in-session cached fix so the
 * next getLocation() call re-prompts. Useful for tests + an
 * admin "force refresh" affordance. Does NOT touch the
 * persisted location cache (that's owned by
 * src/lib/location/locationCache.js).
 */
export function clearLocationCache() {
  _cachedFix = null;
  _inflight  = null;
}

/**
 * peekCachedLocation() — synchronous read of whatever's in the
 * in-session cache. Returns null when there's no fresh fix.
 * Useful for first-paint surfaces that want to show a cached
 * value while a fresh getLocation() request is in flight.
 */
export function peekCachedLocation({ maximumAge = DEFAULT_OPTS.maximumAge } = {}) {
  if (!_cachedFix) return null;
  if (!_isFresh(_cachedFix, maximumAge)) return null;
  return _cachedFix;
}

export default getLocation;
