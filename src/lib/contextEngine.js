/**
 * contextEngine.js — the single named ContextEngine the spec calls
 * for. Normalises every signal source into one clean farm context.
 *
 *   const ctx = await contextEngine.getContext({
 *     farmId, lat, lng, cropName, experience, userMode, language,
 *     fetchers: { weather, soil, satellite, scanHistory, tasks },
 *   });
 *
 * What it does
 * ────────────
 *   • Normalises signals from weather + soil + satellite + scan +
 *     task history + crop profile + farm location + growth stage +
 *     user mode + language + farm/garden mode into a single frozen
 *     context object.
 *   • Per-source TTL caching (spec rule):
 *       weather       30–60 min  (we use 45 min mid-range)
 *       soil          6 hours
 *       satellite     12–24 hours (we use 18 hours mid-range)
 *       recommendation short cache per farm/session
 *   • Feature-flag gates: signal sources can be turned off via
 *     intelligenceFlags. When a flag is off, the corresponding
 *     field is null and the context degrades gracefully.
 *   • Missing-data handling: a failing fetcher contributes null,
 *     never an error. The context always returns a usable object.
 *
 * Why this is a thin adapter (not a rebuild)
 * ──────────────────────────────────────────
 *   farmIntelligenceSnapshot already aggregates the underlying
 *   stores. ContextEngine adds the per-source CACHING + FEATURE-
 *   FLAG layer the spec mandates, and exposes the result under
 *   one named entry point ('contextEngine') so consumers
 *   (Home / Tasks / Notifications / Scan follow-up) have one
 *   import to learn.
 *
 * Strict-rule audit
 *   • Pure-ish (caches + clock dependent). Never throws.
 *   • All injected fetchers — testable without real APIs.
 *   • Per-source cache keyed on (farmId, signalName). Caller-supplied
 *     nowMs respected for TTL math in tests.
 */

import { isIntelligenceFlagOn } from './featureFlags/intelligenceFlags.js';

// ─── Cache TTLs (spec) ────────────────────────────────────────

export const CACHE_TTL = Object.freeze({
  weather:       45 * 60 * 1000,                  // 45 min
  soil:           6 * 60 * 60 * 1000,             // 6 hours
  satellite:     18 * 60 * 60 * 1000,             // 18 hours
  recommendation: 5 * 60 * 1000,                  // 5 min — short per spec
});

// ─── Cache ────────────────────────────────────────────────────

const _cache = new Map();   // `${farmId}:${signal}` → { value, expiresAt }

function _cacheKey(farmId, signal) {
  return `${farmId || '__none__'}:${signal}`;
}

function _cacheGet(key, nowMs) {
  const entry = _cache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt < nowMs) {
    _cache.delete(key);
    return undefined;
  }
  return entry.value;
}

function _cacheSet(key, value, ttl, nowMs) {
  _cache.set(key, { value, expiresAt: nowMs + ttl });
}

/** Test helper — wipe the in-process cache. */
export function _resetContextCache() {
  _cache.clear();
}

// ─── Helpers ──────────────────────────────────────────────────

async function _safeFetch(fetcher, fallback) {
  if (typeof fetcher !== 'function') return fallback;
  try {
    const result = await fetcher();
    return (result === undefined || result === null) ? fallback : result;
  } catch {
    return fallback;
  }
}

function _str(v) {
  const s = String(v == null ? '' : v).trim();
  return s ? s : null;
}

// ─── Per-source loaders ──────────────────────────────────────

async function _loadWeather(input, nowMs) {
  if (!isIntelligenceFlagOn('FEATURE_PREDICTIVE_ALERTS')) return null;
  const key = _cacheKey(input.farmId, 'weather');
  const cached = _cacheGet(key, nowMs);
  if (cached !== undefined) return cached;
  const value = await _safeFetch(input.fetchers && input.fetchers.weather, null);
  _cacheSet(key, value, CACHE_TTL.weather, nowMs);
  return value;
}

async function _loadSoil(input, nowMs) {
  if (!isIntelligenceFlagOn('FEATURE_SOIL_CONTEXT')) return null;
  const key = _cacheKey(input.farmId, 'soil');
  const cached = _cacheGet(key, nowMs);
  if (cached !== undefined) return cached;
  const value = await _safeFetch(input.fetchers && input.fetchers.soil, null);
  _cacheSet(key, value, CACHE_TTL.soil, nowMs);
  return value;
}

async function _loadSatellite(input, nowMs) {
  if (!isIntelligenceFlagOn('FEATURE_SATELLITE_CONTEXT')) return null;
  const key = _cacheKey(input.farmId, 'satellite');
  const cached = _cacheGet(key, nowMs);
  if (cached !== undefined) return cached;
  const value = await _safeFetch(input.fetchers && input.fetchers.satellite, null);
  _cacheSet(key, value, CACHE_TTL.satellite, nowMs);
  return value;
}

async function _loadScanHistory(input) {
  if (!isIntelligenceFlagOn('FEATURE_SCAN_MEMORY')) return [];
  const list = await _safeFetch(input.fetchers && input.fetchers.scanHistory, []);
  return Array.isArray(list) ? list : [];
}

async function _loadTasks(input) {
  const list = await _safeFetch(input.fetchers && input.fetchers.tasks, []);
  return Array.isArray(list) ? list : [];
}

// ─── Public API ──────────────────────────────────────────────

/**
 * Build the unified farm context.
 *
 * @param {object} input
 * @param {string} [input.farmId]
 * @param {number} [input.lat]
 * @param {number} [input.lng]
 * @param {string} [input.cropName]
 * @param {string} [input.experience]    — 'farmer' | 'gardener' | etc.
 * @param {string} [input.userMode]      — orchestrator mode
 * @param {string} [input.language]
 * @param {string} [input.growthStage]
 * @param {object} [input.fetchers]      — async signal sources
 * @param {number} [input.nowMs]
 * @returns {Promise<object>}            — frozen context
 */
export async function getContext(input) {
  const safe = (input && typeof input === 'object') ? input : {};
  const nowMs = (typeof safe.nowMs === 'number') ? safe.nowMs : Date.now();

  // Parallel-fetch every gated source.
  const [weather, soil, satellite, scanHistory, tasks] = await Promise.all([
    _loadWeather(safe, nowMs),
    _loadSoil(safe, nowMs),
    _loadSatellite(safe, nowMs),
    _loadScanHistory(safe),
    _loadTasks(safe),
  ]);

  // Track which sources contributed real data — surfaces use this
  // for the "based on:" sourceSignals list without re-deriving.
  const sources = [];
  if (weather)              sources.push('weather');
  if (soil)                 sources.push('soil');
  if (satellite)            sources.push('satellite');
  if (scanHistory.length > 0) sources.push('scan_history');
  if (tasks.length > 0)     sources.push('tasks');

  return Object.freeze({
    farmId:      _str(safe.farmId),
    location:    (typeof safe.lat === 'number' && typeof safe.lng === 'number')
                  ? Object.freeze({ lat: safe.lat, lng: safe.lng })
                  : null,
    cropName:    _str(safe.cropName),
    experience:  _str(safe.experience),
    userMode:    _str(safe.userMode),
    language:    _str(safe.language),
    growthStage: _str(safe.growthStage),
    weather,
    soil,
    satellite,
    scanHistory,
    tasks,
    sources:     Object.freeze(sources),
    readAt:      nowMs,
  });
}

export default {
  getContext,
  CACHE_TTL,
  _resetContextCache,
};
