/**
 * farmContextEngine.js — canonical synchronous snapshot of the
 * active farm + every derived signal Home / Tasks / Scan rely on.
 *
 *   import { getFarmContext } from '../lib/farmContextEngine.js';
 *
 *   const ctx = getFarmContext();
 *   // ctx = {
 *   //   activeFarmId,
 *   //   farms,
 *   //   gardens,
 *   //   farm,             // resolved active farm (or null)
 *   //   farmType,
 *   //   backyardType,
 *   //   crop,
 *   //   cropStage,
 *   //   location,         // { lat, lng, label, region } or null
 *   //   experience,       // 'farm' | 'garden'
 *   //   hasFarm,
 *   //   hasGarden,
 *   //   farmsCount,
 *   // }
 *
 * Why this exists
 *   Before this module, every consumer (Home.jsx, ScanPage,
 *   AllTasksPage, FarmerProgressPage, etc.) re-implemented its
 *   own "read the active farm" logic, mixing:
 *     • legacy 'farroway_active_farm' single-farm blob
 *     • V2 'farroway.farms' array + 'farroway.activeFarmId'
 *     • V2 'farroway.gardens' array + 'farroway_active_garden_id'
 *     • multi-experience snapshot via useExperience()
 *   The split led to surfaces disagreeing — Home showing "No
 *   farm added yet" while ScanPage rendered the farm context
 *   correctly. The 3-tier resolver shipped in commit 92aa2109
 *   fixed Home; this engine extracts that resolver + every
 *   adjacent helper into a single canonical read.
 *
 *   Goal per Solid Platform spec §1: one source of truth.
 *   All future surfaces should import getFarmContext() instead
 *   of re-reading localStorage. Existing surfaces will migrate
 *   incrementally — both patterns produce the same answer.
 *
 * Strict-rule audit
 *   • Pure / synchronous / SSR-safe (returns empty context when
 *     localStorage is unavailable).
 *   • Never throws — every read wrapped.
 *   • No React. Hook consumers wrap this in useMemo/useEffect.
 *   • No network calls. For remote context, use
 *     src/core/farm/farmContextClient.js (different concern).
 */

import { resolveBackyardType } from './backyardTypes.js';

const EMPTY_CONTEXT = Object.freeze({
  activeFarmId:    null,
  activeGardenId:  null,
  farms:           [],
  gardens:         [],
  farm:            null,
  farmType:        null,
  backyardType:    null,
  crop:            null,
  cropStage:       null,
  location:        null,
  experience:      'farm',
  hasFarm:         false,
  hasGarden:       false,
  farmsCount:      0,
  gardensCount:    0,
});

// ─── Safe storage reads ────────────────────────────────────────

function _safeGet(key) {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  } catch { return null; }
}

function _safeJson(key) {
  try {
    const raw = _safeGet(key);
    if (raw == null) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

// ─── Active-farm resolver (3-tier fallback) ────────────────────

function _resolveActiveFarm() {
  // Tier 1: legacy single-farm blob.
  const legacy = _safeJson('farroway_active_farm');
  if (legacy && typeof legacy === 'object') return { farm: legacy, source: 'legacy' };

  // Tier 2: V2 multi-farm store.
  try {
    const farms = _safeJson('farroway.farms');
    if (Array.isArray(farms) && farms.length > 0) {
      const id = _safeGet('farroway.activeFarmId');
      if (id) {
        const match = farms.find((f) => f && String(f.id) === String(id));
        if (match) return { farm: match, source: 'v2_active' };
      }
      // Spec §1: "if activeFarmId missing, use most recent farm".
      return { farm: farms[farms.length - 1], source: 'v2_most_recent' };
    }
  } catch { /* swallow */ }

  // Tier 3: V2 multi-garden store (garden-only users).
  try {
    const gardens = _safeJson('farroway.gardens');
    if (Array.isArray(gardens) && gardens.length > 0) {
      const id = _safeGet('farroway_active_garden_id');
      if (id) {
        const match = gardens.find((g) => g && String(g.id) === String(id));
        if (match) return { farm: match, source: 'v2_garden_active' };
      }
      return { farm: gardens[gardens.length - 1], source: 'v2_garden_most_recent' };
    }
  } catch { /* swallow */ }

  return { farm: null, source: 'empty' };
}

// ─── Field extractors ──────────────────────────────────────────

function _pickString(obj, keys) {
  for (const k of keys) {
    const v = obj && obj[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

function _resolveCrop(farm) {
  if (!farm) {
    const sel = _safeGet('farroway_selected_crop');
    if (typeof sel === 'string' && sel.trim()) return sel.trim();
    return null;
  }
  return _pickString(farm, ['cropName', 'crop', 'cropType', 'plantName']);
}

function _resolveCropStage(farm) {
  if (!farm) return null;
  return _pickString(farm, ['cropStage', 'stage', 'plantStage', 'growthStage']);
}

function _resolveLocation(farm) {
  if (!farm) return null;
  const lat = Number(farm.latitude  ?? farm.lat);
  const lng = Number(farm.longitude ?? farm.lng);
  const label = _pickString(farm, ['locationName', 'location', 'region', 'country']);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return { lat, lng, label, region: farm.region || null };
  }
  if (label) return { lat: null, lng: null, label, region: farm.region || null };
  return null;
}

function _resolveExperience(farm, hasGarden, hasFarm) {
  // Pinned override wins.
  const pinned = _safeGet('farroway_active_experience');
  if (pinned === 'garden' && hasGarden) return 'garden';
  if (pinned === 'farm'   && hasFarm)   return 'farm';
  // Derive from the active row's farmType.
  if (farm && typeof farm === 'object') {
    const ft = String(farm.farmType || '').toLowerCase();
    if (ft === 'backyard' || ft === 'home_garden' || ft === 'home') return 'garden';
  }
  // Count-based fallback.
  if (hasGarden && !hasFarm) return 'garden';
  return 'farm';
}

// ─── Public API ────────────────────────────────────────────────

/**
 * Get the canonical farm-context snapshot. Pure synchronous read.
 *
 * Returns the same `EMPTY_CONTEXT` shape with sensible defaults
 * when no farm or garden exists — never null. Consumers can
 * safely destructure without optional chaining.
 *
 * @returns {object} canonical farm context
 */
export function getFarmContext() {
  try {
    if (typeof localStorage === 'undefined') return EMPTY_CONTEXT;

    const farms        = _safeJson('farroway.farms')   || [];
    const gardens      = _safeJson('farroway.gardens') || [];
    const farmsList    = Array.isArray(farms)   ? farms   : [];
    const gardensList  = Array.isArray(gardens) ? gardens : [];
    const hasFarm      = farmsList.length   > 0;
    const hasGarden    = gardensList.length > 0;

    const { farm } = _resolveActiveFarm();
    const activeFarmId    = _safeGet('farroway.activeFarmId');
    const activeGardenId  = _safeGet('farroway_active_garden_id');

    return Object.freeze({
      activeFarmId:    activeFarmId   || null,
      activeGardenId:  activeGardenId || null,
      farms:           farmsList,
      gardens:         gardensList,
      farm,
      farmType:        farm && farm.farmType || null,
      backyardType:    farm ? resolveBackyardType(farm) : null,
      crop:            _resolveCrop(farm),
      cropStage:       _resolveCropStage(farm),
      location:        _resolveLocation(farm),
      experience:      _resolveExperience(farm, hasGarden, hasFarm),
      hasFarm,
      hasGarden,
      farmsCount:      farmsList.length,
      gardensCount:    gardensList.length,
    });
  } catch {
    return EMPTY_CONTEXT;
  }
}

/**
 * Sugar — returns just the resolved active farm (or null).
 * Equivalent to getFarmContext().farm.
 */
export function getActiveFarm() {
  return getFarmContext().farm;
}

/**
 * Whether the user has at least one farm or garden saved.
 * Used by Home / onboarding gates to decide whether to render
 * the empty state or the canonical Home shell.
 */
export function hasAnyFarm() {
  const ctx = getFarmContext();
  return ctx.hasFarm || ctx.hasGarden;
}

const _module = {
  getFarmContext,
  getActiveFarm,
  hasAnyFarm,
};
export default _module;
