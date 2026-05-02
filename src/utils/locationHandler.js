/**
 * locationHandler.js — error-code-aware geolocation request helper.
 *
 *   import { requestUserLocation } from '../utils/locationHandler.js';
 *
 *   const { status, position, errorKey } = await requestUserLocation();
 *   // status:   'ok' | 'denied' | 'unavailable' | 'timeout' | 'unsupported'
 *   // position: { latitude, longitude } | null
 *   // errorKey: translation key for the user-visible error | null
 *
 * Why a shared helper
 * ───────────────────
 * QuickGardenSetup and QuickFarmSetup both need to call
 * navigator.geolocation.getCurrentPosition with identical
 * error-distinguishing logic (PERMISSION_DENIED=1,
 * POSITION_UNAVAILABLE=2, TIMEOUT=3). Copy-pasting the same
 * 30-line callback into two forms makes drift inevitable. This
 * helper holds the canonical contract and returns a typed
 * result the form code can render through tSafe.
 *
 * Strict-rule audit
 *   • Pure async function (no I/O beyond the geolocation
 *     browser API). Resolves; never rejects.
 *   • SSR-safe: returns 'unsupported' synchronously when
 *     navigator.geolocation is unavailable.
 *   • The translation KEYS are returned, not strings, so the
 *     caller can route through tSafe + the active locale wins.
 *   • Default options match the original spec: 10s timeout,
 *     fresh fix only (maximumAge: 0), high-accuracy on. The
 *     caller can override.
 */

const DEFAULT_OPTIONS = Object.freeze({
  enableHighAccuracy: true,
  timeout:            10_000,
  maximumAge:         0,
});

/**
 * Map a PositionError to a stable status + translation key.
 * Browser PositionError.code values:
 *   1 — PERMISSION_DENIED
 *   2 — POSITION_UNAVAILABLE
 *   3 — TIMEOUT
 */
function _mapError(err) {
  const code = (err && typeof err.code === 'number') ? err.code : 0;
  if (code === 1) return { status: 'denied',      errorKey: 'onboarding.locationFailed.denied' };
  if (code === 2) return { status: 'unavailable', errorKey: 'onboarding.locationFailed.unavailable' };
  if (code === 3) return { status: 'timeout',     errorKey: 'onboarding.locationFailed.timeout' };
  // Unknown / generic — fall through to the legacy generic key.
  return { status: 'denied', errorKey: 'onboarding.locationFailed' };
}

/**
 * requestUserLocation(options?) → Promise<{ status, position, errorKey }>
 *
 * @param {object} [options]
 * @param {boolean} [options.enableHighAccuracy=true]
 * @param {number}  [options.timeout=10_000]
 * @param {number}  [options.maximumAge=0]
 * @returns {Promise<{
 *   status:   'ok' | 'denied' | 'unavailable' | 'timeout' | 'unsupported',
 *   position: { latitude:number, longitude:number } | null,
 *   errorKey: string | null,
 * }>}
 *
 * Never throws. Resolves with the failure shape on any error
 * branch so callers don't need a try/catch. The caller is
 * responsible for surfacing the errorKey through tSafe and
 * for any reverse-geocoding step (the helper deliberately
 * doesn't do reverse-geocoding — pilots are offline-tolerant
 * and we have no API for it yet; the user keeps the manual
 * country/region inputs as the source of truth).
 */
export function requestUserLocation(options) {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve({
        status:   'unsupported',
        position: null,
        errorKey: 'onboarding.locationFailed.unsupported',
      });
      return;
    }
    const opts = { ...DEFAULT_OPTIONS, ...(options && typeof options === 'object' ? options : {}) };
    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          // Defensive: some browsers stub getCurrentPosition
          // and call success without a coords object.
          const c = (pos && pos.coords) ? pos.coords : null;
          if (!c || typeof c.latitude !== 'number' || typeof c.longitude !== 'number') {
            resolve({
              status:   'unavailable',
              position: null,
              errorKey: 'onboarding.locationFailed.unavailable',
            });
            return;
          }
          resolve({
            status:   'ok',
            position: { latitude: c.latitude, longitude: c.longitude },
            errorKey: null,
          });
        },
        (err) => {
          const { status, errorKey } = _mapError(err);
          resolve({ status, position: null, errorKey });
        },
        opts,
      );
    } catch {
      // Synchronous throw from the browser (rare). Treat as
      // unavailable so the user sees the manual-entry hint.
      resolve({
        status:   'unavailable',
        position: null,
        errorKey: 'onboarding.locationFailed.unavailable',
      });
    }
  });
}

export default requestUserLocation;
