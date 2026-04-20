/**
 * browserLocation.js — production-safe wrapper around
 * navigator.geolocation.getCurrentPosition.
 *
 * Returns a Promise that resolves with `{ latitude, longitude, accuracy }`
 * or REJECTS with an Error carrying a stable `.code` the UI can map
 * to a localized message:
 *
 *   'insecure_context'     — window.isSecureContext is false (HTTP)
 *   'unsupported'          — navigator.geolocation is missing
 *   'permission_denied'    — user blocked access (PERMISSION_DENIED)
 *   'position_unavailable' — GPS / WiFi positioning unavailable
 *   'timeout'              — request didn't resolve in time
 *   'unknown'              — everything else (never swallowed silently)
 *
 * Caller options mirror the Farroway spec: enableHighAccuracy: true,
 * timeout: 15000, maximumAge: 0.
 */

const DEFAULT_OPTS = Object.freeze({
  enableHighAccuracy: true,
  timeout: 15000,
  maximumAge: 0,
});

export class BrowserLocationError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = 'BrowserLocationError';
    this.code = code;
  }
}

/**
 * getBrowserCoords — production entrypoint used by the onboarding
 * flow. Resolves with `{ latitude, longitude, accuracy }` on success,
 * rejects with a `BrowserLocationError` on every failure path.
 *
 * Tests can pass `opts.geolocation` to swap the impl; production
 * uses `navigator.geolocation` directly.
 */
export function getBrowserCoords(opts = {}) {
  return new Promise((resolve, reject) => {
    // Secure-context guard — geolocation is blocked on plain HTTP in
    // every evergreen browser.
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      reject(new BrowserLocationError(
        'insecure_context',
        'Geolocation requires HTTPS or localhost.',
      ));
      return;
    }

    const geo = opts.geolocation
      || (typeof navigator !== 'undefined' ? navigator.geolocation : null);
    if (!geo || typeof geo.getCurrentPosition !== 'function') {
      reject(new BrowserLocationError('unsupported',
        'This device or browser does not support location access.'));
      return;
    }

    const positionOptions = {
      ...DEFAULT_OPTS,
      ...(opts.positionOptions || {}),
    };

    try {
      geo.getCurrentPosition(
        (position) => {
          const c = position && position.coords;
          if (!c || !Number.isFinite(c.latitude) || !Number.isFinite(c.longitude)) {
            reject(new BrowserLocationError('position_unavailable',
              'Location response was empty.'));
            return;
          }
          resolve({
            latitude:  c.latitude,
            longitude: c.longitude,
            accuracy:  Number.isFinite(c.accuracy) ? c.accuracy : null,
          });
        },
        (err) => {
          // Geolocation API error codes:
          //   1 = PERMISSION_DENIED
          //   2 = POSITION_UNAVAILABLE
          //   3 = TIMEOUT
          let code = 'unknown';
          if (err && typeof err.code === 'number') {
            if (err.code === 1) code = 'permission_denied';
            else if (err.code === 2) code = 'position_unavailable';
            else if (err.code === 3) code = 'timeout';
          }
          reject(new BrowserLocationError(code, err && err.message));
        },
        positionOptions,
      );
    } catch (e) {
      reject(new BrowserLocationError('unknown', e && e.message));
    }
  });
}

export const _internal = Object.freeze({ DEFAULT_OPTS });
