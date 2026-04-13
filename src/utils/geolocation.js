/**
 * Geolocation utilities — browser GPS + lightweight reverse geocoding.
 *
 * Reverse geocoding uses OpenStreetMap Nominatim (free, no API key).
 * Rate-limited to 1 req/s per Nominatim policy — only called on explicit user action.
 */

// ─── Browser Geolocation ───────────────────────────────

/**
 * Request the user's current position via the browser Geolocation API.
 * Only call this in response to an explicit user action (button click).
 *
 * @param {Object} opts
 * @param {boolean} opts.enableHighAccuracy - Use GPS if available (slower but more precise)
 * @param {number}  opts.timeout - Max wait in ms (default 15s)
 * @returns {Promise<{latitude: number, longitude: number, accuracy: number, capturedAt: string}>}
 */
export function getCurrentPosition({ enableHighAccuracy = true, timeout = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      return reject(new Error('Geolocation is not supported by this device.'));
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          capturedAt: new Date().toISOString(),
        });
      },
      (err) => {
        switch (err.code) {
          case err.PERMISSION_DENIED:
            reject(new Error('Location access was denied. You can enter your location manually.'));
            break;
          case err.POSITION_UNAVAILABLE:
            reject(new Error('Could not detect your location. Please enter it manually.'));
            break;
          case err.TIMEOUT:
            reject(new Error('Location detection timed out. Please try again or enter manually.'));
            break;
          default:
            reject(new Error('Could not detect your location. Please enter it manually.'));
        }
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

// ─── Combined: Detect + Reverse Geocode ────────────────

/**
 * Full flow: get GPS coordinates, then reverse geocode to structured fields.
 * Call only on explicit user action.
 *
 * @returns {Promise<{latitude, longitude, accuracy, capturedAt, country, countryCode, region, district, locality, displayName}>}
 */
export async function detectAndResolveLocation() {
  const coords = await getCurrentPosition();
  const geo = await reverseGeocode(coords.latitude, coords.longitude);
  return { ...coords, ...geo };
}
