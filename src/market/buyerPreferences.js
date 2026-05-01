/**
 * buyerPreferences.js — local-first crop + region preferences for
 * a buyer, used by the Quick Reorder strip on /buy.
 *
 * Spec coverage (Marketplace revenue scale §5)
 *   • Save preferences
 *   • Quick reorder
 *
 * Storage
 *   farroway_buyer_preferences : {
 *     [buyerId]: {
 *       crops:   string[],   // newest-first, capped 20
 *       regions: string[],   // newest-first, capped 5
 *     }
 *   }
 *
 * Strict-rule audit
 *   • Never throws.
 *   • Works offline.
 *   • Idempotent: adding the same crop simply moves it to the
 *     front of the recency list.
 *   • Emits `farroway:buyer_prefs_changed`.
 */

export const PREFS_KEY = 'farroway_buyer_preferences';
const MAX_CROPS = 20;
const MAX_REGIONS = 5;
const CHANGE_EVENT = 'farroway:buyer_prefs_changed';

function _safeReadAll() {
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch { return {}; }
}

function _safeWriteAll(obj) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(PREFS_KEY, JSON.stringify(obj || {}));
  } catch { /* swallow */ }
}

function _emit() {
  try {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new Event(CHANGE_EVENT));
    }
  } catch { /* swallow */ }
}

function _norm(s) { return String(s || '').trim().toLowerCase(); }

function _readEntry(buyerId) {
  const id = String(buyerId || '').trim();
  if (!id) return { crops: [], regions: [] };
  const all = _safeReadAll();
  const e = all[id] || {};
  return {
    crops:   Array.isArray(e.crops)   ? e.crops   : [],
    regions: Array.isArray(e.regions) ? e.regions : [],
  };
}

export function getBuyerPreferences(buyerId) {
  return _readEntry(buyerId);
}

export function addCropPreference(buyerId, crop) {
  const id = String(buyerId || '').trim();
  const c  = _norm(crop);
  if (!id || !c) return null;
  const all = _safeReadAll();
  const e = all[id] || { crops: [], regions: [] };
  const next = [c, ...(Array.isArray(e.crops) ? e.crops.filter((x) => _norm(x) !== c) : [])];
  e.crops = next.slice(0, MAX_CROPS);
  all[id] = e;
  _safeWriteAll(all);
  _emit();
  return e;
}

export function addRegionPreference(buyerId, region) {
  const id = String(buyerId || '').trim();
  const r  = String(region || '').trim();
  if (!id || !r) return null;
  const all = _safeReadAll();
  const e = all[id] || { crops: [], regions: [] };
  const next = [r, ...(Array.isArray(e.regions)
    ? e.regions.filter((x) => String(x).trim() !== r) : [])];
  e.regions = next.slice(0, MAX_REGIONS);
  all[id] = e;
  _safeWriteAll(all);
  _emit();
  return e;
}

export function removeCropPreference(buyerId, crop) {
  const id = String(buyerId || '').trim();
  const c  = _norm(crop);
  if (!id || !c) return null;
  const all = _safeReadAll();
  const e = all[id];
  if (!e || !Array.isArray(e.crops)) return null;
  e.crops = e.crops.filter((x) => _norm(x) !== c);
  all[id] = e;
  _safeWriteAll(all);
  _emit();
  return e;
}

export const PREFS_CHANGED_EVENT = CHANGE_EVENT;

export default {
  PREFS_KEY,
  PREFS_CHANGED_EVENT,
  getBuyerPreferences,
  addCropPreference,
  addRegionPreference,
  removeCropPreference,
};
