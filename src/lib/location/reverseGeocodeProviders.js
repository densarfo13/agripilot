/**
 * reverseGeocodeProviders.js — provider abstraction for reverse
 * geocoding.
 *
 * Each provider is a function:
 *
 *   async (lat, lng, { timeoutMs, fetchJson }) → {
 *     country:              ISO-2 uppercase,
 *     countryLabel:         human name or null,
 *     principalSubdivision: state/region label or null,
 *     city:                 locality or null,
 *     raw:                  the provider's raw response (diagnostic)
 *   } | null
 *
 * Returning `null` means "no usable result from me" — the chain
 * then tries the next provider. Throwing is NOT expected; providers
 * catch their own failures and return null.
 *
 * Shipping two providers so onboarding never depends on a single
 * vendor:
 *   1. bigdatacloud — public CORS-friendly endpoint, no key.
 *   2. nominatim    — OpenStreetMap community endpoint, no key.
 */

const BIG_ENDPOINT = 'https://api.bigdatacloud.net/data/reverse-geocode-client';
const NOM_ENDPOINT = 'https://nominatim.openstreetmap.org/reverse';

const DEFAULT_TIMEOUT_MS = 7000;

/**
 * fetchWithTimeout — shared helper. Returns null on any failure.
 * Accepts a custom fetchJson shim for tests.
 */
async function defaultFetchJson(url, { timeoutMs, headers } = {}) {
  if (typeof fetch !== 'function') return null;
  const controller = typeof AbortController !== 'undefined'
    ? new AbortController() : null;
  const signal = controller ? controller.signal : undefined;
  const timer = controller
    ? setTimeout(() => controller.abort(), timeoutMs || DEFAULT_TIMEOUT_MS)
    : null;
  try {
    const res = await fetch(url, { signal, headers });
    if (!res || !res.ok) return null;
    return await res.json();
  } catch { return null; }
  finally { if (timer) clearTimeout(timer); }
}

// ─── Provider 1: bigdatacloud ──────────────────────────────────────
export async function bigdatacloudProvider(lat, lng, opts = {}) {
  const fetchJson = opts.fetchJson || defaultFetchJson;
  const la = Number(lat).toFixed(6);
  const lo = Number(lng).toFixed(6);
  const url = `${BIG_ENDPOINT}?latitude=${la}&longitude=${lo}&localityLanguage=en`;
  const data = await fetchJson(url, { timeoutMs: opts.timeoutMs });
  if (!data || (!data.countryCode && !data.countryName)) return null;
  return {
    country:              data.countryCode ? String(data.countryCode).toUpperCase() : null,
    countryLabel:         data.countryName || null,
    principalSubdivision: data.principalSubdivision || null,
    city:                 data.city || data.locality || null,
    raw:                  data,
  };
}

// ─── Provider 2: OpenStreetMap Nominatim ──────────────────────────
export async function nominatimProvider(lat, lng, opts = {}) {
  const fetchJson = opts.fetchJson || defaultFetchJson;
  const la = Number(lat).toFixed(6);
  const lo = Number(lng).toFixed(6);
  const url = `${NOM_ENDPOINT}?lat=${la}&lon=${lo}&format=json&zoom=10&addressdetails=1`;
  // Nominatim asks every caller to identify itself in a User-Agent /
  // Referer. Browsers set Referer automatically; we add a stable UA
  // so the OSM operators have something to filter if we ever misbehave.
  const data = await fetchJson(url, {
    timeoutMs: opts.timeoutMs,
    headers: { 'User-Agent': 'Farroway/1.0 (https://farroway.app)' },
  });
  const addr = data && data.address;
  if (!addr || !addr.country_code) return null;
  // Nominatim's state / region can live under one of several keys
  // depending on the country administrative hierarchy.
  const subdivision = addr.state || addr.region || addr.county || null;
  return {
    country:              String(addr.country_code).toUpperCase(),
    countryLabel:         addr.country || null,
    principalSubdivision: subdivision,
    city:                 addr.city || addr.town || addr.village || null,
    raw:                  data,
  };
}

/**
 * tryProviders — iterates the chain, returning the first non-null
 * result. Providers are tried in the order given. Never throws.
 *
 *   tryProviders(lat, lng, { providers, timeoutMs, fetchJson }) → result|null
 *
 * When `opts.providers` is omitted, the CURRENT default chain is
 * read from the module-level `_defaultProviders` slot — not from
 * the frozen `DEFAULT_PROVIDERS` export — so callers that swap in a
 * keyed provider via `setDefaultProviders()` take effect globally.
 */
export async function tryProviders(lat, lng, opts = {}) {
  const list = Array.isArray(opts.providers) && opts.providers.length > 0
    ? opts.providers
    : _defaultProviders;
  for (const p of list) {
    try {
      const r = await p(lat, lng, opts);
      if (r && r.country) return r;
    } catch { /* next provider */ }
  }
  return null;
}

// Default chain — primary bigdatacloud, fallback nominatim.
//
// ─── SWAPPING IN A KEYED PROVIDER ─────────────────────────────────
// If / when Nominatim starts throttling or you want a paid provider
// like Geoapify / MapTiler / Google, add a module-level bootstrap
// somewhere near app init:
//
//   import { setDefaultProviders, bigdatacloudProvider }
//     from './lib/location/reverseGeocodeProviders.js';
//
//   async function geoapifyProvider(lat, lng, opts) {
//     const key = import.meta.env.VITE_GEOAPIFY_KEY;
//     if (!key) return null;
//     const fetchJson = opts.fetchJson || defaultFetchJson;
//     const url = `https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lng}&apiKey=${key}`;
//     const data = await fetchJson(url);
//     const p = data?.features?.[0]?.properties;
//     if (!p?.country_code) return null;
//     return {
//       country: p.country_code.toUpperCase(),
//       countryLabel: p.country || null,
//       principalSubdivision: p.state || p.region || null,
//       city: p.city || p.town || p.village || null,
//       raw: data,
//     };
//   }
//
//   setDefaultProviders([bigdatacloudProvider, geoapifyProvider]);
//
// No other code needs to change — the chain is consulted through
// tryProviders() everywhere.
export const DEFAULT_PROVIDERS = Object.freeze([
  bigdatacloudProvider,
  nominatimProvider,
]);

// Mutable slot the chain actually reads from. Seeded with
// DEFAULT_PROVIDERS but can be replaced at runtime via
// setDefaultProviders(); tests use resetDefaultProviders() to
// restore the initial state between runs.
let _defaultProviders = DEFAULT_PROVIDERS.slice();

/**
 * setDefaultProviders — replace the active chain. Input must be a
 * non-empty array of functions; anything else is ignored so the
 * chain can never be left empty accidentally.
 */
export function setDefaultProviders(providers) {
  if (!Array.isArray(providers) || providers.length === 0) return false;
  const onlyFns = providers.filter((p) => typeof p === 'function');
  if (onlyFns.length === 0) return false;
  _defaultProviders = onlyFns.slice();
  return true;
}

/** Expose the current chain (useful in tests + introspection UI). */
export function getDefaultProviders() {
  return _defaultProviders.slice();
}

/** Restore the factory default chain. Used by test teardown. */
export function resetDefaultProviders() {
  _defaultProviders = DEFAULT_PROVIDERS.slice();
}

export const _internal = Object.freeze({
  BIG_ENDPOINT, NOM_ENDPOINT, DEFAULT_TIMEOUT_MS, defaultFetchJson,
  // Named accessor lets the test suite inspect the mutable slot
  // without relying on the module's non-exported binding.
  getSlot: () => _defaultProviders,
});
