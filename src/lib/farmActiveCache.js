/**
 * farmActiveCache — non-destructive fast-read cache for the
 * canonical active farm.
 *
 *   import { startFarmActiveCache, readFarmActiveCache }
 *     from '../lib/farmActiveCache.js';
 *
 *   startFarmActiveCache();   // call once at app bootstrap
 *   const farm = readFarmActiveCache(); // sync, never-throws
 *
 * Purpose
 *   The Farm State Synchronization Audit asked for a single
 *   canonical storage key (`farroway_active_farm_v1`). Forcing
 *   every legacy writer to migrate would erase real users'
 *   farms in flight. Instead, this module mirrors the canonical
 *   resolution into `farroway_active_farm_v1` whenever farm
 *   state changes — so any new code can prefer the v1 slot for
 *   reads while the legacy keys (`farroway_active_farm`,
 *   `farroway.farms`, `farroway.gardens`) keep working as the
 *   primary write paths.
 *
 *   Eventually the legacy keys can be retired with a coordinated
 *   migration; until then, v1 stays in lock-step.
 *
 * Subscribes to:
 *   FarmEvents.FARM_CREATED, FARM_UPDATED, LOCATION_UPDATED,
 *   CROP_ADDED — every event that could change the canonical
 *   active farm. Also writes on the initial call.
 *
 * Strict-rule audit
 *   • SSR-safe. localStorage absence → no-op writes.
 *   • Never throws. All event handlers swallow errors.
 *   • Idempotent — start() can be called any number of times.
 *   • No React imports.
 */

import { FarmEvents, subscribe } from './farmEventBus.js';
import { getFarmContext } from './farmContextEngine.js';

export const FARM_ACTIVE_CACHE_KEY = 'farroway_active_farm_v1';

let _wired = false;

function _safeWrite() {
  try {
    if (typeof localStorage === 'undefined') return;
    const ctx = getFarmContext();
    const farm = ctx && ctx.farm;
    if (!farm || typeof farm !== 'object' || !farm.id) {
      // No farm to cache — leave the slot alone. We deliberately
      // do NOT remove the previous cache when transient state
      // (e.g. a switch in flight) returns null — better to keep
      // the last-known-good than to surface "no farm" during
      // a momentary race.
      return;
    }
    localStorage.setItem(FARM_ACTIVE_CACHE_KEY, JSON.stringify({
      farm,
      farmId:        farm.id,
      activeFarmId:  ctx.activeFarmId || null,
      experience:    ctx.experience   || 'farm',
      crop:          ctx.crop         || null,
      cropStage:     ctx.cropStage    || null,
      location:      ctx.location     || null,
      savedAt:       Date.now(),
    }));
  } catch { /* swallow */ }
}

/**
 * Read the cached canonical farm. Returns null on miss / corruption.
 * The shape mirrors getFarmContext()'s `.farm` field plus a few
 * convenience fields so a new surface can render without calling
 * the full resolver.
 */
export function readFarmActiveCache() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(FARM_ACTIVE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch { return null; }
}

/**
 * Wire the cache to the typed event bus. Idempotent — subsequent
 * calls are no-ops. Call once at app bootstrap.
 */
export function startFarmActiveCache() {
  if (_wired) return;
  _wired = true;
  try {
    subscribe(FarmEvents.FARM_CREATED,     _safeWrite);
    subscribe(FarmEvents.FARM_UPDATED,     _safeWrite);
    subscribe(FarmEvents.LOCATION_UPDATED, _safeWrite);
    subscribe(FarmEvents.CROP_ADDED,       _safeWrite);
  } catch { /* swallow */ }
  // Initial mirror — capture the current state so a first-run
  // refresh has v1 populated without waiting for the next event.
  _safeWrite();
}

/** Test seam — flush the cache + reset the wired flag. */
export function _resetFarmActiveCache() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(FARM_ACTIVE_CACHE_KEY);
    }
  } catch { /* swallow */ }
  _wired = false;
}

/** Test seam — force a mirror write right now. */
export function _flushFarmActiveCacheOnce() {
  _safeWrite();
}

const _module = {
  FARM_ACTIVE_CACHE_KEY,
  startFarmActiveCache,
  readFarmActiveCache,
  _resetFarmActiveCache,
  _flushFarmActiveCacheOnce,
};
export default _module;
