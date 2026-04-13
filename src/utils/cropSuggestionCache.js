/**
 * Crop Suggestion Cache — local caching layer for learned crop suggestions.
 *
 * Stores:
 * 1. Server-fetched popular crops per country (refreshed every 5 min)
 * 2. Farmer's last-used crop (localStorage, instant)
 *
 * Cache key: `farroway:crop_suggestions:{country}`
 * Last-used key: `farroway:last_crop`
 */

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const CACHE_PREFIX = 'farroway:crop_suggestions:';
const LAST_CROP_KEY = 'farroway:last_crop';

// ── Server fetch ──────────────────────────────────────────

/**
 * Fetch learned crop suggestions from backend, with local caching.
 * Returns array of { cropCode, cropName, useCount, country }.
 * Falls back to empty array on failure (non-blocking).
 */
export async function fetchCropSuggestions(country) {
  const cacheKey = CACHE_PREFIX + (country || 'global');

  // Check localStorage cache first
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed.ts && Date.now() - parsed.ts < CACHE_TTL) {
        return parsed.crops || [];
      }
    }
  } catch { /* ignore parse errors */ }

  // Fetch from server
  try {
    const url = country
      ? `/api/v2/crop-suggestions?country=${encodeURIComponent(country)}`
      : '/api/v2/crop-suggestions';
    const res = await fetch(url);
    if (!res.ok) return getCachedFallback(cacheKey);
    const data = await res.json();
    const crops = data.crops || [];

    // Cache to localStorage
    try {
      localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), crops }));
    } catch { /* localStorage full — ignore */ }

    return crops;
  } catch {
    return getCachedFallback(cacheKey);
  }
}

/** Return expired cache if available, otherwise empty */
function getCachedFallback(cacheKey) {
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) return JSON.parse(cached).crops || [];
  } catch { /* ignore */ }
  return [];
}

// ── Last-used crop ────────────────────────────────────────

/**
 * Save the farmer's last-selected crop code to localStorage.
 */
export function saveLastCrop(cropCode) {
  if (!cropCode) return;
  try {
    localStorage.setItem(LAST_CROP_KEY, JSON.stringify({
      code: cropCode,
      ts: Date.now(),
    }));
  } catch { /* ignore */ }
}

/**
 * Get the farmer's last-selected crop code.
 * Returns { code, ts } or null.
 */
export function getLastCrop() {
  try {
    const raw = localStorage.getItem(LAST_CROP_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ── Normalization ─────────────────────────────────────────

/**
 * Normalize a crop name for deduplication.
 * "okra" → "Okra", "SWEET POTATO" → "Sweet Potato"
 */
export function normalizeCropName(raw) {
  if (!raw) return '';
  return raw.trim().replace(/\s+/g, ' ')
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}
