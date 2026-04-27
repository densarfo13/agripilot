/**
 * farmStore.js — Farroway core farm record.
 *
 * Storage:
 *   * Primary:  IndexedDB store 'farm', key 'main'    (production)
 *   * Mirror:   localStorage 'farroway_farm'          (sync read so
 *                                                      every render
 *                                                      path that
 *                                                      depended on
 *                                                      the previous
 *                                                      sync API
 *                                                      keeps working)
 *
 * Same dual-write pattern as progressStore: every save fans out to
 * both stores; sync reads come from the mirror; `hydrateFarm()` on
 * app boot pulls the durable copy out of IDB and refreshes the
 * mirror.
 */

import { dbGet, dbSet, dbDelete } from '../../db/indexedDB.js';
import { safeRead, safeWrite, safeRemove } from './safeStorage.js';

export const FARM_KEY     = 'farroway_farm';   // localStorage mirror
export const FARM_IDB_KEY = 'main';            // IDB row id
export const FARM_STORE   = 'farm';

/* ─── Sync surface (mirror only) ───────────────────────────────── */

/** Synchronous getter backed by localStorage. Returns null when
 *  no farm is set, never throws. */
export function getCurrentFarm() {
  return safeRead(FARM_KEY, null);
}

/* ─── Async surface (IDB primary) ──────────────────────────────── */

/**
 * Hydrate the mirror from IndexedDB on app boot. If IDB has a
 * newer copy (e.g. another tab wrote it), the mirror picks it up
 * here so the first synchronous `getCurrentFarm()` is fresh.
 */
export async function hydrateFarm() {
  const idb = await dbGet(FARM_STORE, FARM_IDB_KEY);
  if (idb && typeof idb === 'object') {
    safeWrite(FARM_KEY, idb);
    return idb;
  }
  return getCurrentFarm();
}

/**
 * Persist the current farm. Pass null/undefined to clear.
 *
 * Returns a promise that resolves to the saved record (or null on
 * clear). Mirror is updated synchronously before the await so the
 * next `getCurrentFarm()` already reflects the change.
 */
export async function saveFarm(farm) {
  if (!farm || typeof farm !== 'object') {
    safeRemove(FARM_KEY);
    await dbDelete(FARM_STORE, FARM_IDB_KEY);
    return null;
  }
  // Mirror first - synchronous, immediately visible.
  safeWrite(FARM_KEY, farm);
  // Durable second.
  await dbSet(FARM_STORE, FARM_IDB_KEY, farm);
  return farm;
}

/** Patch a subset of fields on the current farm. */
export async function updateFarm(patch) {
  const current = getCurrentFarm() || {};
  const next = { ...current, ...(patch || {}) };
  return saveFarm(next);
}
