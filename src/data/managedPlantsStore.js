/**
 * managedPlantsStore.js — local-first managed-plant persistence.
 *
 *   import {
 *     loadManagedPlants, appendManagedPlant,
 *     findManagedPlantById, updateManagedPlantById,
 *     removeManagedPlantById, MANAGED_PLANTS_STORE_VERSION,
 *   } from 'src/data/managedPlantsStore';
 *
 * Storage
 * ───────
 *   localStorage[`farroway_managed_plants`] = JSON.stringify(plants[])
 *
 * What this is
 * ────────────
 *   Gap-fix blocker 3: the wave-5 single-writer for managed-plant
 *   records. Replaces the inline `localStorage.setItem` calls in
 *   ScanPage / MyPlants / PlantProfile so all four call sites
 *   share one storage facade with:
 *     • try/catch around every read + write (quota / private
 *       mode / corrupt JSON degrade silently)
 *     • a per-id index for O(1) lookups
 *     • a hard cap so a runaway test never floods storage
 *     • all writes route through a single function for future
 *       middleware (sync, audit, debounce)
 *
 *   Engines NEVER call this directly. Only UI components +
 *   workflow callers do — the strict rule that engines emit
 *   immutable records stays intact.
 *
 * Strict-rule audit
 *   • Never throws — quota / private-mode / corrupt JSON all
 *     degrade silently.
 *   • Bounded growth (MAX_KEPT entries).
 *   • SSR-safe (typeof window guards).
 *   • Idempotent append (same plant id → in-place replace).
 *   • No image data stored; ManagedPlant carries no photo URL.
 */

const STORAGE_KEY = 'farroway_managed_plants';
const MAX_KEPT = 500;

export const MANAGED_PLANTS_STORE_VERSION = 'managed-plants-store-v1';

const _isObj = (v) => v != null && typeof v === 'object';
const _arr   = (v) => (Array.isArray(v) ? v : []);
const _str   = (v) => (typeof v === 'string' ? v : '');
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };

function _read() {
  return _safe(() => {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  }, []);
}

function _write(list) {
  return _safe(() => {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    const safe = _arr(list).slice(-MAX_KEPT);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
    return true;
  }, false);
}

// FARM_PERSISTENCE_V1 — mirror a plant write to the durable store
// (best-effort; localStorage above stays the cache). Never throws.
function _mirror(plant, deleted) {
  _safe(() => {
    if (!_isObj(plant) || !_str(plant.id)) return;
    import('../lib/sync/farmSync.js')
      .then((m) => m.mirror('plants', plant.id, plant, { deleted: !!deleted }))
      .catch(() => {});
  }, undefined);
}

/** Hydrate the cache from authoritative server records (recovery on login). */
export function hydrateManagedPlants(records) {
  return _safe(() => {
    const recs = _arr(records);
    if (recs.length === 0) return false;
    const byId = new Map();
    for (const p of _read()) if (_isObj(p) && _str(p.id)) byId.set(p.id, p);
    for (const r of recs) {
      const plant = r && r.payload;
      if (_isObj(plant) && _str(plant.id)) byId.set(plant.id, plant); // server wins
    }
    _write([...byId.values()]);
    return true;
  }, false);
}

/**
 * Return the full list. Always an array (never null).
 */
export function loadManagedPlants() {
  return Object.freeze(_read());
}

/**
 * Append a plant. If a plant with the same id already exists,
 * replace it in place (no duplicate). Returns the new list.
 */
export function appendManagedPlant(plant) {
  return _safe(() => {
    if (!_isObj(plant)) return loadManagedPlants();
    const id = _str(plant.id);
    if (!id) return loadManagedPlants();
    const current = _read();
    const filtered = current.filter((p) => !_isObj(p) || p.id !== id);
    filtered.push(plant);
    _write(filtered);
    _mirror(plant);
    return Object.freeze(filtered.slice());
  }, loadManagedPlants());
}

/**
 * Lookup by id. Returns null when not found.
 */
export function findManagedPlantById(id) {
  return _safe(() => {
    const key = _str(id);
    if (!key) return null;
    const list = _read();
    for (const p of list) {
      if (_isObj(p) && p.id === key) return p;
    }
    return null;
  }, null);
}

/**
 * Patch an existing plant by id. Caller-provided patch is
 * shallow-merged onto the existing record. NEVER reaches into
 * frozen sub-arrays — caller is responsible for replacing them
 * wholesale if they want to update history/scans/tasks.
 */
export function updateManagedPlantById(id, patch) {
  return _safe(() => {
    const key = _str(id);
    if (!key || !_isObj(patch)) return loadManagedPlants();
    const list = _read();
    let touched = false;
    const next = list.map((p) => {
      if (!_isObj(p) || p.id !== key) return p;
      touched = true;
      return Object.assign({}, p, patch, {
        updatedAt: _safe(() => new Date().toISOString(), p.updatedAt),
      });
    });
    if (touched) { _write(next); _mirror(next.find((p) => _isObj(p) && p.id === key)); }
    return Object.freeze(next.slice());
  }, loadManagedPlants());
}

/**
 * Remove a plant by id. Returns the new list.
 */
export function removeManagedPlantById(id) {
  return _safe(() => {
    const key = _str(id);
    if (!key) return loadManagedPlants();
    const filtered = _read().filter(
      (p) => !_isObj(p) || p.id !== key);
    _write(filtered);
    _mirror({ id: key }, true);
    return Object.freeze(filtered);
  }, loadManagedPlants());
}

/**
 * Diagnostic-only — exposes the storage key so QA can clear it
 * manually without guessing the namespace.
 */
export const _internals = Object.freeze({
  STORAGE_KEY, MAX_KEPT,
});
