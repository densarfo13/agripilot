/**
 * farmStore.js — Farroway core farm record (spec section 1).
 *
 * Storage key: farroway_farm
 *
 * Single-farm, local-first. Returns null when no farm is set so
 * downstream task / notification code can short-circuit without
 * crashing. Auth + the existing multi-farm context are untouched -
 * this store is the small, defensive surface the new core relies
 * on.
 */

import { safeRead, safeWrite, safeRemove } from './safeStorage.js';

export const FARM_KEY = 'farroway_farm';

/**
 * Returns the current farm object, or null if none is stored / the
 * record is unreadable.
 *
 * Expected shape (all optional - downstream code defends against
 * missing fields):
 *   {
 *     id?: string,
 *     crop?: string,             // e.g. 'cassava', 'maize'
 *     plantingDate?: string,     // ISO date
 *     phone?: string,            // e164 for SMS
 *     readyToSell?: boolean,     // NGO alert hint
 *   }
 */
export function getCurrentFarm() {
  return safeRead(FARM_KEY, null);
}

/** Persist the current farm. Pass null/undefined to clear. */
export function saveFarm(farm) {
  if (!farm || typeof farm !== 'object') {
    safeRemove(FARM_KEY);
    return null;
  }
  safeWrite(FARM_KEY, farm);
  return farm;
}

/** Patch a subset of fields on the current farm. */
export function updateFarm(patch) {
  const current = getCurrentFarm() || {};
  const next = { ...current, ...(patch || {}) };
  safeWrite(FARM_KEY, next);
  return next;
}
