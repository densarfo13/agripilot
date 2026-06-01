/**
 * SoilCache.ts — localStorage-backed cache for SoilGrids responses.
 *
 * Key shape: farroway_soil_cache_v1:<farmId>:<lat2>:<lng2>
 * (lat/lng rounded to 2 decimals so nearby coordinates share a cache
 *  hit — SoilGrids resolution is ~250m which 2-decimal precision
 *  matches well enough.)
 *
 * TTL: SOILGRIDS_CACHE_TTL_MS (30 days).
 *
 * Self-contained, never throws, SSR-safe.
 */

import type { SoilProfile } from './SoilProfileContracts';
import { SOILGRIDS_CACHE_TTL_MS } from './SoilProfileContracts';

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };

const PREFIX = 'farroway_soil_cache_v1';

function _key(farmId: string, lat: number, lng: number): string {
  const lat2 = (Math.round(lat * 100) / 100).toFixed(2);
  const lng2 = (Math.round(lng * 100) / 100).toFixed(2);
  return `${PREFIX}:${farmId}:${lat2}:${lng2}`;
}

interface CacheEntry {
  ts: number;
  profile: SoilProfile;
}

/** Read a cached profile if present + fresh; otherwise null. */
export function readSoilCache(
  farmId: string, lat: number, lng: number, nowMs: number,
): Readonly<SoilProfile> | null {
  return _safe(() => {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    if (!farmId || !isFinite(lat) || !isFinite(lng)) return null;
    const raw = window.localStorage.getItem(_key(farmId, lat, lng));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry;
    if (!parsed || typeof parsed.ts !== 'number') return null;
    // Stale → caller should treat as miss but can still surface old
    // data with status='STALE_CACHE'.
    const age = nowMs - parsed.ts;
    if (age > SOILGRIDS_CACHE_TTL_MS) return null;
    return Object.freeze(parsed.profile);
  }, null);
}

/** Read a stale (expired) cached profile for graceful fallback. */
export function readStaleSoilCache(
  farmId: string, lat: number, lng: number,
): Readonly<SoilProfile> | null {
  return _safe(() => {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    if (!farmId || !isFinite(lat) || !isFinite(lng)) return null;
    const raw = window.localStorage.getItem(_key(farmId, lat, lng));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry;
    if (!parsed || !parsed.profile) return null;
    return Object.freeze(parsed.profile);
  }, null);
}

/** Persist a fetched profile. Bounded to last 32 farms × 4 coordinate
 *  buckets so the cache can't grow unbounded. */
export function writeSoilCache(
  farmId: string, lat: number, lng: number, profile: SoilProfile, nowMs: number,
): boolean {
  return _safe(() => {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    if (!farmId || !isFinite(lat) || !isFinite(lng)) return false;
    const entry: CacheEntry = { ts: nowMs, profile };
    window.localStorage.setItem(_key(farmId, lat, lng), JSON.stringify(entry));
    _gc();
    return true;
  }, false);
}

/** Garbage collect: keep at most 128 cache entries (≈ 32 farms × 4 spots). */
function _gc(): void {
  _safe(() => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.indexOf(PREFIX + ':') === 0) keys.push(k);
    }
    if (keys.length <= 128) return;
    // Drop the oldest by sorting on parsed ts.
    const entries = keys.map((k) => {
      try {
        const raw = window.localStorage.getItem(k) || '{}';
        const p = JSON.parse(raw) as CacheEntry;
        return { k, ts: typeof p.ts === 'number' ? p.ts : 0 };
      } catch { return { k, ts: 0 }; }
    }).sort((a, b) => a.ts - b.ts);
    const drop = entries.slice(0, entries.length - 128);
    for (const d of drop) window.localStorage.removeItem(d.k);
  }, undefined);
}

/** Are coordinates well-formed enough to call SoilGrids? */
export function hasValidCoordinates(lat: unknown, lng: unknown): boolean {
  return _safe(() => {
    if (typeof lat !== 'number' || typeof lng !== 'number') return false;
    if (!isFinite(lat) || !isFinite(lng)) return false;
    if (lat < -90 || lat > 90) return false;
    if (lng < -180 || lng > 180) return false;
    // Coordinates exactly at (0, 0) are almost always a missing-fix
    // sentinel rather than a real farm on the Gulf of Guinea.
    if (lat === 0 && lng === 0) return false;
    return true;
  }, false);
}
