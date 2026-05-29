/**
 * src/runtime/plants/media/PlantMediaCache.ts — In-memory LRU
 * cache for plant / disease / pest media + offline-aware
 * subscriber envelope.
 *
 *   import {
 *     cacheMedia, getCachedMedia, listCachedKeys,
 *     subscribeMediaCacheEvents, clearMediaCache,
 *     PLANT_MEDIA_CACHE_VERSION,
 *   } from 'src/runtime/plants/media/PlantMediaCache';
 *
 * What this is
 * ────────────
 *   Memory-bound LRU (max 200 entries) keyed by `${type}:${plantId}`.
 *   When an entry is added or evicted the cache emits a frozen
 *   envelope to all subscribers — the OfflineRuntime can listen
 *   and decide whether to persist the URL set into the offline
 *   queue (wave-5: persistence is its job, not ours).
 *
 *   This module DOES NOT write to localStorage or IndexedDB. It
 *   holds references in JS memory only; the offline subscriber
 *   pattern keeps the engine pure.
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • No fetch. No persistence writes.
 *   • Subscribers run inside try/catch; one bad listener cannot
 *     poison the cache.
 *   • Eviction order: classic LRU on read+write touch.
 */

import type { PlantMedia } from './PlantMediaRegistry';

export const PLANT_MEDIA_CACHE_VERSION = 'plant-media-cache-v1';
export const PLANT_MEDIA_CACHE_MAX = 200;

export const CACHE_EVENT = Object.freeze({
  HIT:     'cache:hit',
  MISS:    'cache:miss',
  ADD:     'cache:add',
  EVICT:   'cache:evict',
  CLEAR:   'cache:clear',
});

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _str   = (v: unknown): string => (typeof v === 'string' ? v : '');
const _safe  = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _now = () => _safe(() => new Date().toISOString(), '');

interface CacheEntry {
  key:     string;
  media:   PlantMedia;
  touched: number;
}

const _map = new Map<string, CacheEntry>();
const _subscribers: Array<(evt: any) => void> = [];

function _emit(kind: string, payload: Record<string, unknown>) {
  const envelope = Object.freeze({
    runtimeVersion: PLANT_MEDIA_CACHE_VERSION,
    kind,
    at: _now(),
    ...payload,
  });
  for (const fn of _subscribers) {
    try { fn(envelope); } catch { /* swallow per-listener errors */ }
  }
}

function _keyFor(plantId: string, type: string): string {
  return _str(type) + ':' + _str(plantId);
}

function _touch(entry: CacheEntry) {
  entry.touched = Date.now();
  // Re-insert to move to the end (Map preserves insertion order
  // which acts as our LRU ranking).
  _map.delete(entry.key);
  _map.set(entry.key, entry);
}

function _evictIfNeeded() {
  while (_map.size > PLANT_MEDIA_CACHE_MAX) {
    const firstKey = _map.keys().next().value as string | undefined;
    if (!firstKey) break;
    const evicted = _map.get(firstKey);
    _map.delete(firstKey);
    if (evicted) {
      _emit(CACHE_EVENT.EVICT, {
        key: evicted.key,
        plantId: evicted.media.plantId,
        type: evicted.media.type,
      });
    }
  }
}

/**
 * Insert (or refresh) a media entry into the cache. Returns the
 * frozen cache record on success. Emits CACHE_EVENT.ADD; emits
 * CACHE_EVENT.EVICT when the LRU spills.
 */
export function cacheMedia(media: PlantMedia) {
  return _safe(() => {
    if (!_isObj(media)) return null;
    const key = _keyFor(media.plantId, media.type);
    if (!key || key === ':') return null;
    const existing = _map.get(key);
    if (existing) {
      existing.media = media;
      _touch(existing);
      _emit(CACHE_EVENT.ADD, { key, plantId: media.plantId,
        type: media.type, refreshed: true });
      return Object.freeze({ key, media });
    }
    const entry: CacheEntry = { key, media, touched: Date.now() };
    _map.set(key, entry);
    _evictIfNeeded();
    _emit(CACHE_EVENT.ADD, { key, plantId: media.plantId,
      type: media.type, refreshed: false });
    return Object.freeze({ key, media });
  }, null);
}

/**
 * Resolve from cache only (no fetch). Emits CACHE_EVENT.HIT or
 * CACHE_EVENT.MISS for the OfflineRuntime to observe.
 */
export function getCachedMedia(plantId: string,
                                 type: string): PlantMedia | null {
  return _safe(() => {
    const key = _keyFor(plantId, type);
    const entry = _map.get(key);
    if (entry) {
      _touch(entry);
      _emit(CACHE_EVENT.HIT, { key, plantId, type });
      return entry.media;
    }
    _emit(CACHE_EVENT.MISS, { key, plantId, type });
    return null;
  }, null);
}

/** List every cached key. Used by diagnostics + the CI gate. */
export function listCachedKeys(): ReadonlyArray<string> {
  return _safe(() => Object.freeze(Array.from(_map.keys())),
    Object.freeze([] as string[]));
}

export function cachedSize(): number {
  return _safe(() => _map.size, 0);
}

/**
 * Subscribe to cache events — returns an unsubscribe function.
 * The OfflineRuntime calls this on boot to mirror recent
 * media into the offline queue.
 */
export function subscribeMediaCacheEvents(fn: (evt: any) => void) {
  return _safe(() => {
    if (typeof fn !== 'function') return () => false;
    _subscribers.push(fn);
    return () => {
      const i = _subscribers.indexOf(fn);
      if (i >= 0) _subscribers.splice(i, 1);
      return true;
    };
  }, () => false);
}

/**
 * Wipe the cache and emit CACHE_EVENT.CLEAR. Used by the
 * 'remove device data' privacy flow.
 */
export function clearMediaCache(): boolean {
  return _safe(() => {
    const count = _map.size;
    _map.clear();
    _emit(CACHE_EVENT.CLEAR, { count });
    return true;
  }, false);
}

/**
 * Diagnostic snapshot for __plantMediaHealth and the CI gate.
 */
export function plantMediaCacheSnapshot() {
  return Object.freeze({
    runtimeVersion: PLANT_MEDIA_CACHE_VERSION,
    size:           cachedSize(),
    max:            PLANT_MEDIA_CACHE_MAX,
    keys:           listCachedKeys(),
    subscribers:    _subscribers.length,
  });
}

/** Test-only — wipe everything (cache + subscribers). */
export function _resetPlantMediaCache() {
  _map.clear();
  _subscribers.length = 0;
}
