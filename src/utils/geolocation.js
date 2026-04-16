/**
 * Geolocation utilities — browser GPS + lightweight reverse geocoding.
 *
 * Mobile-hardened for iOS Safari + Android Chrome:
 *   - No async delay before navigator.geolocation.getCurrentPosition()
 *   - Permission pre-check where supported
 *   - Granular error codes (permission_denied, unavailable, timeout, unsupported)
 *   - Debug logging for field troubleshooting
 *
 * Reverse geocoding uses OpenStreetMap Nominatim (free, no API key).
 * Rate-limited to 1 req/s per Nominatim policy — only called on explicit user action.
 */

// ─── Error codes (stable, for programmatic use) ──────
export const GPS_ERROR = {
  UNSUPPORTED: 'unsupported',
  PERMISSION_DENIED: 'permission_denied',
  UNAVAILABLE: 'unavailable',
  TIMEOUT: 'timeout',
  UNKNOWN: 'unknown',
};

// ─── Debug logger (temporary, for mobile field debugging) ─
function gpsLog(msg, data) {
  try {
    console.log(`[GPS] ${msg}`, data !== undefined ? data : '');
  } catch { /* swallow in environments without console */ }
}

// ─── Permission pre-check ─────────────────────────────
/**
 * Check geolocation permission state (where supported).
 * Falls back to 'unknown' on browsers without Permissions API.
 *
 * @returns {Promise<'granted'|'prompt'|'denied'|'unknown'>}
 */
export async function checkLocationPermission() {
  try {
    if (navigator.permissions && navigator.permissions.query) {
      const result = await navigator.permissions.query({ name: 'geolocation' });
      gpsLog('Permission state:', result.state);
      return result.state; // 'granted' | 'prompt' | 'denied'
    }
  } catch {
    // Some browsers (older iOS Safari) don't support permissions.query for geolocation
    gpsLog('Permissions API not available, returning unknown');
  }
  return 'unknown';
}

// ─── Browser Geolocation ───────────────────────────────

/**
 * Request the user's current position via the browser Geolocation API.
 *
 * IMPORTANT — iOS Safari requirements:
 *   1. Must be called directly inside a user-gesture handler (click/tap)
 *   2. No await/async before the navigator.geolocation.getCurrentPosition() call
 *   3. Page must be served over HTTPS (or localhost)
 *
 * @param {Object} opts
 * @param {boolean} opts.enableHighAccuracy - Use GPS if available (slower but more precise)
 * @param {number}  opts.timeout - Max wait in ms (default 15s)
 * @returns {Promise<{latitude: number, longitude: number, accuracy: number, capturedAt: string}>}
 * @throws {Error} with .code property set to a GPS_ERROR value
 */
export function getCurrentPosition({ enableHighAccuracy = true, timeout = 15000 } = {}) {
  // Start the native geolocation call IMMEDIATELY — no async before this.
  // This preserves the user-gesture context on iOS Safari.
  gpsLog('Requesting position', { enableHighAccuracy, timeout });

  if (!navigator.geolocation) {
    gpsLog('Geolocation API not available');
    const err = new Error('GPS is not supported on this device.');
    err.code = GPS_ERROR.UNSUPPORTED;
    return Promise.reject(err);
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        gpsLog('Position acquired', {
          lat: pos.coords.latitude.toFixed(5),
          lng: pos.coords.longitude.toFixed(5),
          accuracy: Math.round(pos.coords.accuracy),
        });
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          capturedAt: new Date().toISOString(),
        });
      },
      (err) => {
        let code = GPS_ERROR.UNKNOWN;
        if (err.code === 1) code = GPS_ERROR.PERMISSION_DENIED;
        else if (err.code === 2) code = GPS_ERROR.UNAVAILABLE;
        else if (err.code === 3) code = GPS_ERROR.TIMEOUT;

        gpsLog('Position error', { code, nativeCode: err.code, message: err.message });

        const wrapped = new Error(err.message || 'Location request failed.');
        wrapped.code = code;
        reject(wrapped);
      },
      { enableHighAccuracy, timeout, maximumAge: 60000 }
    );
  });
}

// ─── Reverse Geocoding (Nominatim) ─────────────────────

/**
 * Convert lat/lng into structured address fields using OSM Nominatim.
 * Returns best-effort results — fields may be null if not available.
 *
 * @param {number} latitude
 * @param {number} longitude
 * @returns {Promise<{country: string|null, countryCode: string|null, region: string|null, district: string|null, locality: string|null, displayName: string|null}>}
 */
export async function reverseGeocode(latitude, longitude) {
  const fallback = { country: null, countryCode: null, region: null, district: null, locality: null, displayName: null };
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1&zoom=14`;
    const res = await fetch(url, {
      headers: { 'Accept-Language': 'en', 'User-Agent': 'Farroway/1.0' },
    });
    if (!res.ok) return fallback;
    const data = await res.json();
    const addr = data.address || {};

    return {
      country: addr.country || null,
      countryCode: (addr.country_code || '').toUpperCase() || null,
      region: addr.state || addr.county || addr.region || null,
      district: addr.county || addr.city || addr.town || null,
      locality: addr.village || addr.suburb || addr.hamlet || addr.town || null,
      displayName: data.display_name || null,
    };
  } catch {
    return fallback;
  }
}

// ─── IP-based country detection (fallback) ────────────

/**
 * Detect country from IP address using free geolocation APIs.
 * Tries multiple providers for resilience (no API key required).
 *
 * Returns best-effort country info — intended as a lightweight fallback
 * when GPS is unavailable or not yet granted.
 *
 * @returns {Promise<{countryCode: string|null, country: string|null, region: string|null, method: 'ip'}>}
 */
export async function detectCountryByIP() {
  const fallback = { countryCode: null, country: null, region: null, method: 'ip' };

  // Provider 1: ip-api.com (free, no key, 45 req/min)
  try {
    const res = await fetch('http://ip-api.com/json/?fields=status,countryCode,country,regionName', {
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.status === 'success' && data.countryCode) {
        gpsLog('IP detection (ip-api):', { country: data.country, code: data.countryCode });
        return {
          countryCode: data.countryCode.toUpperCase(),
          country: data.country || null,
          region: data.regionName || null,
          method: 'ip',
        };
      }
    }
  } catch { /* try next provider */ }

  // Provider 2: ipapi.co (free tier, 1k/day)
  try {
    const res = await fetch('https://ipapi.co/json/', {
      headers: { 'User-Agent': 'Farroway/1.0' },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.country_code) {
        gpsLog('IP detection (ipapi.co):', { country: data.country_name, code: data.country_code });
        return {
          countryCode: data.country_code.toUpperCase(),
          country: data.country_name || null,
          region: data.region || null,
          method: 'ip',
        };
      }
    }
  } catch { /* exhausted providers */ }

  gpsLog('IP detection failed — all providers exhausted');
  return fallback;
}

// ─── Combined: Detect + Reverse Geocode ────────────────

/**
 * Full flow: get GPS coordinates, then reverse geocode to structured fields.
 * Call only on explicit user action (button click handler — no async before this).
 *
 * @returns {Promise<{latitude, longitude, accuracy, capturedAt, country, countryCode, region, district, locality, displayName}>}
 */
export async function detectAndResolveLocation() {
  const coords = await getCurrentPosition();
  const geo = await reverseGeocode(coords.latitude, coords.longitude);
  return { ...coords, ...geo };
}
