/**
 * locationCache.js — tiny 24-hour cache for the detected-location
 * result. Lives in localStorage under a single namespaced key.
 *
 * Shape persisted:
 *   {
 *     latitude:  number,     // already coarse-rounded
 *     longitude: number,
 *     country:   string|null,
 *     stateCode: string|null,
 *     city:      string|null,
 *     source:    'network' | 'coarse' | null,
 *     timestamp: number       // epoch ms — used for TTL check
 *   }
 *
 * Every read/write is wrapped in try/catch so any storage failure
 * (private mode quota, locked-down WebView, JSON parse errors)
 * degrades gracefully instead of breaking onboarding.
 */

import { roundCoords } from './coordsPrivacy.js';

const STORAGE_KEY = 'farroway.locationCache';
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24h

function hasStorage() {
  return typeof window !== 'undefined' && !!window.localStorage;
}

function readRaw() {
  if (!hasStorage()) return null;
  try { return window.localStorage.getItem(STORAGE_KEY); } catch { return null; }
}
function writeRaw(str) {
  if (!hasStorage()) return false;
  try { window.localStorage.setItem(STORAGE_KEY, str); return true; }
  catch { return false; }
}
function removeRaw() {
  if (!hasStorage()) return false;
  try { window.localStorage.removeItem(STORAGE_KEY); return true; }
  catch { return false; }
}

/**
 * readCache — returns the stored result if it exists AND hasn't
 * expired. Returns null when missing, parse-failed, or stale.
 * Never throws.
 *
 *   readCache({ ttlMs?, now? }) → cached | null
 */
export function readCache({ ttlMs = DEFAULT_TTL_MS, now } = {}) {
  const raw = readRaw();
  if (!raw) return null;
  let data = null;
  try { data = JSON.parse(raw); } catch { return null; }
  if (!data || typeof data !== 'object') return null;
  if (!Number.isFinite(data.timestamp)) return null;
  const cur = Number.isFinite(now) ? Number(now)
    : (now instanceof Date ? now.getTime() : Date.now());
  if (cur - Number(data.timestamp) > ttlMs) return null; // expired
  return data;
}

/**
 * writeCache — persists a detection result. Coordinates are
 * re-rounded here as a second-chance privacy guard so callers can't
 * accidentally leak raw precision. Never throws.
 *
 *   writeCache({ latitude, longitude, country, stateCode?, city?, source?, now? })
 *     → written object | null
 */
export function writeCache({
  latitude, longitude,
  country = null, stateCode = null, city = null,
  source = null,
  now,
} = {}) {
  const { latitude: lat, longitude: lng } = roundCoords({ latitude, longitude });
  if (lat == null || lng == null) return null;
  const payload = {
    latitude:  lat,
    longitude: lng,
    country:   country ? String(country) : null,
    stateCode: stateCode ? String(stateCode) : null,
    city:      city ? String(city) : null,
    source:    source || null,
    timestamp: Number.isFinite(now) ? Number(now)
             : (now instanceof Date ? now.getTime() : Date.now()),
  };
  let ok = false;
  try { ok = writeRaw(JSON.stringify(payload)); } catch { ok = false; }
  return ok ? payload : null;
}

/** Clear the cache — used by tests and privacy-reset flows. */
export function clearCache() { return removeRaw(); }

export const _internal = Object.freeze({ STORAGE_KEY, DEFAULT_TTL_MS });
