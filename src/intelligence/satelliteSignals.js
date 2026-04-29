/**
 * satelliteSignals.js — pluggable provider for crop-health satellite
 * signals.
 *
 * Strict rules
 * ────────────
 * • Pure JS, no React, no i18n. The intelligence layer never speaks
 *   to the farmer-facing UI directly — its callers translate the
 *   numeric signals into already-localised task labels.
 * • Mock-by-default. Real provider can be plugged later via
 *   `setProvider(fn)` without touching call sites or downstream
 *   modules.
 * • Deterministic mock so tests and dashboards don't jitter on every
 *   render. Same lat/lng/date → same signals.
 *
 * Signal shape (frozen contract)
 * ──────────────────────────────
 *   {
 *     ndvi:           number   // 0-1, vegetation index (0.3 bare, 0.7 lush)
 *     soilMoisture:   number   // 0-1, surface moisture proxy
 *     cloudCover:     number   // 0-1, fraction of latest pass
 *     observedAt:     number   // ms epoch
 *     source:         'mock' | 'sentinel' | 'planet' | string
 *     confidence:     'low' | 'medium' | 'high'   // observation confidence
 *   }
 *
 * The contract is intentionally narrow — extending it requires a
 * matching update to the consumers (yieldForecast, recommendationRanker).
 * Adding a NEW field is safe; renaming or removing a field is not.
 */

const SIGNAL_KEYS = Object.freeze([
  'ndvi', 'soilMoisture', 'cloudCover',
  'observedAt', 'source', 'confidence',
]);

let _provider = null;

/**
 * Install a real-API provider. Signature:
 *   provider({ lat, lng, dateMs }) → Promise<Signal> | Signal
 *
 * The provider should return the contract shape above. Throwing /
 * rejecting is allowed — `getSatelliteSignals` falls back to the
 * mock and tags `confidence: 'low'`.
 */
export function setProvider(fn) {
  _provider = (typeof fn === 'function') ? fn : null;
}

export function clearProvider() { _provider = null; }

/** Re-exported for tests + dashboards that want to inspect the contract. */
export { SIGNAL_KEYS };

/**
 * @param {object} input
 * @param {number} [input.lat]
 * @param {number} [input.lng]
 * @param {number} [input.dateMs]   defaults to Date.now()
 * @returns {Promise<object>}
 */
export async function getSatelliteSignals(input = {}) {
  const lat = _toFiniteNumber(input.lat, NaN);
  const lng = _toFiniteNumber(input.lng, NaN);
  const dateMs = _toFiniteNumber(input.dateMs, Date.now());

  if (_provider) {
    try {
      const out = await _provider({ lat, lng, dateMs });
      const norm = _normalizeSignal(out);
      if (norm) return norm;
    } catch {
      /* fall through to mock */
    }
  }
  return _mockSignal({ lat, lng, dateMs });
}

/**
 * Synchronous variant for callers that can't await — returns a
 * deterministic mock when the active provider is async or absent.
 * Real providers should be wired through the async variant; this
 * exists so the recommendation ranker can stay synchronous.
 */
export function getSatelliteSignalsSync(input = {}) {
  const lat = _toFiniteNumber(input.lat, NaN);
  const lng = _toFiniteNumber(input.lng, NaN);
  const dateMs = _toFiniteNumber(input.dateMs, Date.now());
  return _mockSignal({ lat, lng, dateMs });
}

// ─── Helpers ────────────────────────────────────────────────

function _toFiniteNumber(v, fallback) {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function _clamp01(n) {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function _normalizeSignal(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return Object.freeze({
    ndvi:         _clamp01(_toFiniteNumber(raw.ndvi, 0.5)),
    soilMoisture: _clamp01(_toFiniteNumber(raw.soilMoisture, 0.5)),
    cloudCover:   _clamp01(_toFiniteNumber(raw.cloudCover, 0)),
    observedAt:   _toFiniteNumber(raw.observedAt, Date.now()),
    source:       typeof raw.source === 'string' ? raw.source : 'unknown',
    confidence:   _confLevel(raw.confidence),
  });
}

function _confLevel(c) {
  if (c === 'high' || c === 'medium' || c === 'low') return c;
  return 'medium';
}

/**
 * Deterministic mock — no Math.random(). Hashes lat/lng/date into a
 * 0-1 seed and shapes plausible NDVI / moisture / cloud values
 * around it. Avoids nondeterminism in tests.
 */
function _mockSignal({ lat, lng, dateMs }) {
  const seed = _hashSeed(lat, lng, dateMs);
  const ndvi         = 0.35 + (seed * 0.45);                   // 0.35-0.80
  const soilMoisture = 0.25 + (((seed * 1.7) % 1) * 0.55);     // 0.25-0.80
  const cloudCover   = (seed * 2.3) % 1;                       // 0-1
  return Object.freeze({
    ndvi:         _clamp01(ndvi),
    soilMoisture: _clamp01(soilMoisture),
    cloudCover:   _clamp01(cloudCover),
    observedAt:   _toFiniteNumber(dateMs, Date.now()),
    source:       'mock',
    confidence:   Number.isFinite(lat) && Number.isFinite(lng) ? 'medium' : 'low',
  });
}

function _hashSeed(lat, lng, dateMs) {
  const a = Number.isFinite(lat) ? Math.abs(lat * 1000) : 1;
  const b = Number.isFinite(lng) ? Math.abs(lng * 1000) : 1;
  // Bucket dateMs to per-day so consecutive renders within the same
  // day return the same mock — avoids "ndvi changed, refresh!"
  // jitter on every reload.
  const day = Math.floor(_toFiniteNumber(dateMs, Date.now()) / 86400000);
  const mix = (a * 31 + b * 17 + day * 7) % 1009;
  return (mix / 1009);
}
