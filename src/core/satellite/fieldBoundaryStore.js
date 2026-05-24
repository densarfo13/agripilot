/**
 * fieldBoundaryStore.js — local store for farm/field polygon
 * geometry (architecture-only seam).
 *
 *   import { saveFieldBoundary, getFieldBoundaries, removeFieldBoundary }
 *     from 'src/core/satellite/fieldBoundaryStore.js';
 *
 * What it is
 * ──────────
 *   A small offlineStore-backed store for GeoJSON-shaped field
 *   polygons a farmer might draw later when satellite features
 *   land. No map UI exists yet — this is just the persistence
 *   contract so geometries SURVIVE between sessions and sync
 *   with the rest of the offline data.
 *
 * Strict-rule audit
 *   • Never throws. SSR-safe (offlineStore guards localStorage).
 *   • No external API call.
 */

import { saveOffline, getOffline, OFFLINE_KEYS } from '../offline/offlineStore.js';

const STORE_KEY = OFFLINE_KEYS.FIELD_BOUNDARIES || 'field_boundaries';

function _newId() {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch { /* fallthrough */ }
  return `field_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

function _readList() {
  try {
    const entry = getOffline(STORE_KEY);
    return entry && Array.isArray(entry.data) ? entry.data : [];
  } catch { return []; }
}

function _writeList(list) {
  try { saveOffline(STORE_KEY, Array.isArray(list) ? list : []); }
  catch { /* ignore */ }
}

function _validCoords(coords) {
  if (!Array.isArray(coords) || coords.length < 3) return false;
  for (const p of coords) {
    if (!Array.isArray(p) || p.length !== 2) return false;
    const [lng, lat] = p;
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return false;
    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) return false;
  }
  return true;
}

/**
 * Save a field boundary. Polygon coordinates are GeoJSON-style
 * `[[lng, lat], …]` rings — at least 3 points, valid ranges.
 *
 * @param {object} input { id?, name, coordinates, farmId?, cropKey? }
 * @returns {object|null}  the stored entry
 */
export function saveFieldBoundary(input) {
  try {
    if (!input || typeof input !== 'object') return null;
    if (!_validCoords(input.coordinates)) return null;
    const entry = Object.freeze({
      id:          input.id || _newId(),
      name:        String(input.name || 'Field'),
      coordinates: input.coordinates.slice(),
      farmId:      input.farmId || null,
      cropKey:     input.cropKey || null,
      createdAt:   Date.now(),
    });
    const list = _readList();
    const idx = list.findIndex((e) => e && e.id === entry.id);
    if (idx >= 0) list[idx] = entry; else list.push(entry);
    _writeList(list);
    return entry;
  } catch {
    return null;
  }
}

export function getFieldBoundaries() {
  return _readList();
}

export function getFieldBoundary(id) {
  return _readList().find((e) => e && e.id === id) || null;
}

export function removeFieldBoundary(id) {
  try {
    if (!id) return false;
    _writeList(_readList().filter((e) => e && e.id !== id));
    return true;
  } catch { return false; }
}

/** Wipe everything (test hook / hard reset). */
export function clearFieldBoundaries() {
  _writeList([]);
}

const _module = {
  saveFieldBoundary, getFieldBoundaries, getFieldBoundary,
  removeFieldBoundary, clearFieldBoundaries,
};
export default _module;
