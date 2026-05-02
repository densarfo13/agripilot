/**
 * reverseGeocode.js \u2014 lat/lng \u2192 { country, region } async
 * helper used by the onboarding location step (Final Review
 * Validation follow-up).
 *
 *   import { reverseGeocode } from '../utils/reverseGeocode.js';
 *
 *   const geo = await reverseGeocode(38.9072, -77.0369);
 *   // \u2192 { country: 'United States', region: 'District of Columbia' }
 *   //   OR null on any failure / unsupported environment.
 *
 * Why we have one
 * ───────────────
 * The location handler (requestUserLocation) returns lat/lng
 * on success but doesn't fill the user's country / region
 * inputs. The setup forms then fall back to manual entry,
 * which is friction. This helper closes that loop: when geo
 * permission lands, we hit a free public reverse-geocoder
 * and auto-populate the inputs (the user can still edit).
 *
 * Provider choice
 * ───────────────
 * BigDataCloud's `reverse-geocode-client` endpoint is
 * specifically designed for client-side calls:
 *   \u2022 No API key required
 *   \u2022 Free for unlimited client traffic
 *   \u2022 CORS open
 *   \u2022 Stable JSON shape
 * Spec link:
 *   https://www.bigdatacloud.com/free-api/free-reverse-geocode-to-city-api
 *
 * Privacy posture (data-moat \u00a77)
 * ──────────────────────────────
 * This is the ONLY 3rd-party network call the location
 * surface makes. We send only the precise coordinates the
 * user just granted (already in browser memory); we don't
 * persist the response shape \u2014 only `country` + `region` are
 * extracted, the rest is dropped. The full request never
 * touches any of the local stores.
 *
 * Strict-rule audit
 *   \u2022 Pure async function. Never throws. Returns null on
 *     any failure (offline, CORS, malformed response, bad
 *     coords, timeout).
 *   \u2022 6-second timeout via AbortController so a slow
 *     network never blocks the UX.
 *   \u2022 SSR-safe: returns null synchronously when fetch is
 *     unavailable.
 *   \u2022 No side effects, no localStorage writes here \u2014 the
 *     setup forms decide what to do with the result.
 */

const ENDPOINT = 'https://api.bigdatacloud.net/data/reverse-geocode-client';
const TIMEOUT_MS = 6000;

function _validCoord(n, min, max) {
  return typeof n === 'number'
      && Number.isFinite(n)
      && n >= min
      && n <= max;
}

/**
 * reverseGeocode(lat, lng) \u2192 Promise<{ country, region } | null>
 *
 * Returns null on every failure path so the caller can fall
 * through to manual entry without a try/catch. Validates the
 * input range (lat \u00b190, lng \u00b1180) so a stray 0/0 doesn't
 * spend a network round trip on the null island.
 */
export async function reverseGeocode(lat, lng) {
  if (!_validCoord(lat, -90, 90)) return null;
  if (!_validCoord(lng, -180, 180)) return null;
  if (typeof fetch !== 'function') return null;

  const controller = (typeof AbortController === 'function')
    ? new AbortController()
    : null;
  const timer = controller
    ? setTimeout(() => { try { controller.abort(); } catch { /* ignore */ } }, TIMEOUT_MS)
    : null;

  try {
    const url = `${ENDPOINT}?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lng)}&localityLanguage=en`;
    const opts = controller ? { signal: controller.signal } : {};
    const res = await fetch(url, opts);
    if (!res || !res.ok) return null;
    const data = await res.json();
    if (!data || typeof data !== 'object') return null;
    const country = String(data.countryName || data.countryCode || '').trim();
    const region  = String(
      data.principalSubdivision
      || data.locality
      || data.city
      || '',
    ).trim();
    if (!country && !region) return null;
    return {
      country: country || '',
      region:  region  || '',
    };
  } catch {
    // Network error, timeout, abort, malformed JSON \u2014 all
    // collapse to null. The caller leaves the form fields
    // blank and the manual inputs stay usable.
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export default reverseGeocode;
