/**
 * ambeeSoilService.js — Ambee Soil API integration.
 *
 *   const soil = await fetchSoilFromAmbee(lat, lng);
 *   if (soil) enrichRecommendation({ soil });
 *
 * Contract
 * ────────
 *   • Reads AMBEE_API_KEY from process.env. When missing, returns
 *     null silently — never throws, never surfaces an error to the
 *     user.
 *   • Calls Ambee's current-soil endpoint with the supplied lat/lng.
 *   • Normalises the raw response into the calm 4-field shape:
 *       { soilMoisture, soilTemperature, moistureRisk, farmingHint }
 *     where moistureRisk is qualitative (low/medium/high) and
 *     farmingHint is a short calm sentence.
 *   • The RAW Ambee response is NEVER returned. Tests pin that the
 *     output contains only the 4 canonical fields — no createdAt,
 *     no soilWaterLevel decimal, no other API metadata.
 *   • Caches per-coordinate (rounded to ~1km / 2 decimal places)
 *     for 6 hours. A repeat call inside the TTL window does not
 *     hit Ambee.
 *   • Fetcher is INJECTABLE so the same code path serves tests
 *     (stub fetcher) and production (real fetch).
 *
 * Failure handling
 * ────────────────
 *   • Missing API key             → null
 *   • Bad coordinates             → null
 *   • Network error               → null
 *   • Non-2xx HTTP response       → null
 *   • Malformed / empty response  → null
 *   • Anything else               → null
 *   The service is designed so a Soil API outage NEVER surfaces an
 *   error to the farmer. Callers gracefully fall back to weather +
 *   crop guidance when this returns null.
 */

// ─── Constants ────────────────────────────────────────────────

export const AMBEE_SOIL_ENDPOINT = 'https://api.ambeedata.com/soil/latest/by-lat-lng';
export const CACHE_TTL_MS = 6 * 60 * 60 * 1000;   // 6 hours per spec
const COORD_PRECISION = 2;                         // ~1km city-block precision

// ─── Cache ────────────────────────────────────────────────────

const _cache = new Map();   // key → { value, expiresAt }

function _cacheKey(lat, lng) {
  return `${Number(lat).toFixed(COORD_PRECISION)},${Number(lng).toFixed(COORD_PRECISION)}`;
}

function _cacheGet(key, nowMs) {
  const entry = _cache.get(key);
  if (!entry) return undefined;
  const now = (typeof nowMs === 'number') ? nowMs : Date.now();
  if (entry.expiresAt < now) {
    _cache.delete(key);
    return undefined;
  }
  return entry.value;
}

function _cacheSet(key, value, nowMs) {
  const now = (typeof nowMs === 'number') ? nowMs : Date.now();
  _cache.set(key, { value, expiresAt: now + CACHE_TTL_MS });
}

/** Test helper — wipe the in-process cache. */
export function _clearAmbeeCache() {
  _cache.clear();
}

// ─── Helpers ──────────────────────────────────────────────────

function _coordValid(lat, lng) {
  if (typeof lat !== 'number' || !Number.isFinite(lat) || lat < -90  || lat > 90)  return false;
  if (typeof lng !== 'number' || !Number.isFinite(lng) || lng < -180 || lng > 180) return false;
  return true;
}

function _readApiKey() {
  try {
    if (typeof process !== 'undefined' && process.env && process.env.AMBEE_API_KEY) {
      const key = String(process.env.AMBEE_API_KEY).trim();
      return key ? key : null;
    }
  } catch { /* fall through */ }
  return null;
}

// ─── Risk + hint derivation ───────────────────────────────────

/**
 * Volumetric water content (m³/m³) → qualitative moisture risk.
 *   < 0.10  drought risk         → 'high'
 *   0.10..0.20 dry-leaning        → 'medium'
 *   0.20..0.35 balanced           → 'low'
 *   > 0.35  waterlogging risk    → 'high'
 *
 * @param {number} vwc
 * @returns {string|null}
 */
function _moistureRiskFor(vwc) {
  if (typeof vwc !== 'number' || !Number.isFinite(vwc)) return null;
  if (vwc < 0.10) return 'high';
  if (vwc > 0.35) return 'high';
  if (vwc < 0.20) return 'medium';
  return 'low';
}

/**
 * Compose a single calm farming hint from moisture + temperature.
 * Wording examples per the spec:
 *   "Soil may dry quickly today."
 *   "Check soil before watering."
 *   "Soil moisture looks stable."
 */
function _composeHint(vwc, tempC, risk) {
  if (typeof vwc !== 'number' || !Number.isFinite(vwc)) {
    return 'Soil moisture looks stable.';
  }

  // Hot + low moisture = drying risk
  if (risk === 'high' && vwc < 0.10) {
    if (typeof tempC === 'number' && Number.isFinite(tempC) && tempC >= 28) {
      return 'Soil may dry quickly today.';
    }
    return 'Check soil before watering.';
  }

  // High-end moisture risk (waterlogging)
  if (risk === 'high' && vwc > 0.35) {
    return 'Soil is holding water — ease back on irrigation.';
  }

  if (risk === 'medium') {
    return 'Check soil before watering.';
  }

  return 'Soil moisture looks stable.';
}

// ─── Response normalisation ──────────────────────────────────

/**
 * Convert the raw Ambee envelope (or anything-shaped) into the
 * calm 4-field shape. Returns null when the response is missing
 * the soil data array or it's empty / malformed.
 *
 * Ambee's documented shape (subject to change — we read defensively):
 *   { message: 'success', data: [{ soilWaterLevel, soilTemperatureLevel, ... }] }
 *
 * @param {object} raw
 * @returns {object|null}
 */
export function normalizeAmbeeResponse(raw) {
  if (!raw || typeof raw !== 'object') return null;

  // Ambee returns data either as an array (`data: [...]`) or a single
  // object (`data: {...}`). Handle both defensively.
  let entry = null;
  if (Array.isArray(raw.data) && raw.data.length > 0) {
    entry = raw.data[0];
  } else if (raw.data && typeof raw.data === 'object') {
    entry = raw.data;
  } else if (raw.soilWaterLevel != null || raw.soilTemperatureLevel != null) {
    // Some wrappers strip the envelope.
    entry = raw;
  }
  if (!entry || typeof entry !== 'object') return null;

  // Accept multiple known field names — Ambee + future-proofing.
  const moistureRaw =
       (typeof entry.soilWaterLevel       === 'number' ? entry.soilWaterLevel       : null)
    ?? (typeof entry.soilMoisture          === 'number' ? entry.soilMoisture          : null)
    ?? (typeof entry.soil_moisture         === 'number' ? entry.soil_moisture         : null);

  const tempRaw =
       (typeof entry.soilTemperatureLevel === 'number' ? entry.soilTemperatureLevel : null)
    ?? (typeof entry.soilTemperature       === 'number' ? entry.soilTemperature       : null)
    ?? (typeof entry.soil_temperature      === 'number' ? entry.soil_temperature      : null);

  if (moistureRaw == null && tempRaw == null) return null;

  const moistureRisk = _moistureRiskFor(moistureRaw);
  const farmingHint = _composeHint(moistureRaw, tempRaw, moistureRisk);

  // Defensive copy + freeze. The raw response NEVER surfaces.
  return Object.freeze({
    soilMoisture:    moistureRaw != null ? Math.round(moistureRaw * 1000) / 1000 : null,
    soilTemperature: tempRaw != null ? Math.round(tempRaw * 10) / 10 : null,
    moistureRisk,
    farmingHint,
  });
}

// ─── Public fetcher ──────────────────────────────────────────

/**
 * Fetch + normalise soil data from Ambee. Returns the calm 4-field
 * shape or null on any failure (missing key, bad coords, network
 * error, malformed response, etc.). Caches per ~1km grid for 6 hours.
 *
 * @param {number} lat
 * @param {number} lng
 * @param {object} [options]
 * @param {(url: string, init: object) => Promise<{ok:boolean, status:number, json:()=>Promise<any>}>} [options.fetcher]
 *                                — injected fetcher for tests; defaults to global fetch
 * @param {string} [options.apiKey]
 *                                — override AMBEE_API_KEY (tests)
 * @param {boolean} [options.bypassCache]
 *                                — skip cache read+write (tests)
 * @param {number} [options.nowMs]
 *                                — injection point for cache TTL tests
 * @returns {Promise<object|null>}
 */
export async function fetchSoilFromAmbee(lat, lng, options) {
  const opts = (options && typeof options === 'object') ? options : {};
  const nowMs = (typeof opts.nowMs === 'number') ? opts.nowMs : Date.now();

  // ── 1. Coord validation ─────────────────────────────────
  if (!_coordValid(lat, lng)) return null;

  // ── 2. API key check ───────────────────────────────────
  const apiKey = opts.apiKey || _readApiKey();
  if (!apiKey) return null;

  // ── 3. Cache check ─────────────────────────────────────
  const key = _cacheKey(lat, lng);
  if (!opts.bypassCache) {
    const cached = _cacheGet(key, nowMs);
    if (cached !== undefined) return cached;
  }

  // ── 4. Fetcher resolution ──────────────────────────────
  const fetcher = (typeof opts.fetcher === 'function')
    ? opts.fetcher
    : (typeof fetch === 'function' ? fetch : null);
  if (!fetcher) return null;

  // ── 5. Request ─────────────────────────────────────────
  const url = `${AMBEE_SOIL_ENDPOINT}?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`;
  let response;
  try {
    response = await fetcher(url, {
      method:  'GET',
      headers: {
        'x-api-key':    apiKey,
        'Content-type': 'application/json',
      },
    });
  } catch {
    return null;
  }

  if (!response || typeof response !== 'object' || response.ok !== true) {
    return null;
  }

  // ── 6. Parse + normalise ───────────────────────────────
  let json = null;
  try { json = await response.json(); }
  catch { return null; }

  const normalised = normalizeAmbeeResponse(json);
  if (!normalised) return null;

  // ── 7. Cache + return ─────────────────────────────────
  if (!opts.bypassCache) _cacheSet(key, normalised, nowMs);
  return normalised;
}

export default {
  fetchSoilFromAmbee,
  normalizeAmbeeResponse,
  _clearAmbeeCache,
  AMBEE_SOIL_ENDPOINT,
  CACHE_TTL_MS,
};
