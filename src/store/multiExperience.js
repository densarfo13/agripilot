/**
 * multiExperience.js — multi-experience selector layer.
 *
 * Lets a single user own BOTH a backyard garden AND a commercial
 * / small farm at the same time, switch contexts safely, and
 * never overwrite one with the other.
 *
 * Design
 *   * Storage stays untouched. Gardens and farms continue to
 *     live in `farroway.farms` (the canonical row store) tagged
 *     by `farmType`. Backyard rows have `farmType === 'backyard'`;
 *     farm rows are 'small_farm' or 'commercial'. This keeps
 *     every existing reader (NGO dashboards, sync engine, demo
 *     seeder, repairSession) working without migration.
 *   * A thin selector layer over that store partitions rows
 *     into `gardens` vs `farms` and tracks the user's active
 *     pointer for each.
 *   * A new `farroway_active_experience` key flips between
 *     'garden' | 'farm' so nav / home / data can render the
 *     right surface.
 *
 * New storage keys (additive — never set if not in use):
 *
 *   farroway_active_experience  : 'garden' | 'farm'
 *   farroway_active_garden_id   : string (id of active garden row)
 *   (existing farroway.activeFarmId stays as the active farm pointer)
 *
 * Window events
 *   `farroway:experience_switched` — fired on every successful
 *      switch / add. Detail: { experience, activeId }. Nav, Home,
 *      data hooks subscribe to re-render.
 *
 * Strict-rule audit
 *   * Never throws — every storage call is try/catch wrapped.
 *   * Never overwrites the wrong store — `addGarden` writes a
 *     `farmType: 'backyard'` row; `addFarm` writes a non-backyard
 *     row. Cross-type writes are rejected.
 *   * Idempotent — switching to the same experience is a no-op.
 *   * Edge cases: deleted active row repairs the pointer to the
 *     next available row of that experience; if none, falls back
 *     to the other experience; if both empty, returns null.
 *   * Pure ESM. No backend calls. No React imports — the hook
 *     lives in src/hooks/useExperience.js.
 */

import {
  getFarms, saveFarm, setActiveFarmId, getActiveFarmId,
} from './farrowayLocal.js';

export const EXPERIENCE = Object.freeze({
  GARDEN: 'garden',
  FARM:   'farm',
});

export const STORAGE_KEYS = Object.freeze({
  ACTIVE_EXPERIENCE: 'farroway_active_experience',
  ACTIVE_GARDEN_ID:  'farroway_active_garden_id',
  // Active farm id stays on its existing key (`farroway.activeFarmId`)
  // via setActiveFarmId / getActiveFarmId from farrowayLocal.js.
});

export const SWITCH_EVENT = 'farroway:experience_switched';

// ── Internals ─────────────────────────────────────────────────

function _hasStorage() {
  try { return typeof localStorage !== 'undefined'; }
  catch { return false; }
}

function _read(key) {
  if (!_hasStorage()) return null;
  try { return localStorage.getItem(key); }
  catch { return null; }
}

function _write(key, value) {
  if (!_hasStorage()) return false;
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, String(value));
    return true;
  } catch { return false; }
}

function _emitSwitch(experience, activeId, extra = {}) {
  try {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent(SWITCH_EVENT, {
      detail: { experience, activeId, ...extra },
    }));
  } catch { /* never propagate */ }
}

// ── Classification ────────────────────────────────────────────

/** True when the row is a backyard / home garden record. */
export function isGarden(row) {
  if (!row || typeof row !== 'object') return false;
  const t = String(row.farmType || '').toLowerCase();
  return t === 'backyard' || t === 'home_garden' || t === 'home';
}

/** True when the row is a non-garden farm record. */
export function isFarm(row) {
  if (!row || typeof row !== 'object') return false;
  if (isGarden(row)) return false;
  return true;
}

/** All garden rows (sorted newest first by createdAt). */
export function getGardens() {
  const rows = getFarms() || [];
  return rows
    .filter(isGarden)
    .sort((a, b) => Number(b?.createdAt || 0) - Number(a?.createdAt || 0));
}

/** All farm rows (sorted newest first by createdAt). */
export function getFarmsOnly() {
  const rows = getFarms() || [];
  return rows
    .filter(isFarm)
    .sort((a, b) => Number(b?.createdAt || 0) - Number(a?.createdAt || 0));
}

// ── Active pointers ───────────────────────────────────────────

export function getActiveGardenId() {
  return _read(STORAGE_KEYS.ACTIVE_GARDEN_ID) || null;
}

export function setActiveGardenId(id) {
  if (!id) return false;
  // Refuse to point at a row that isn't a garden — prevents the
  // active-garden pointer from accidentally indexing a farm row
  // when callers pass the wrong id.
  const rows = getGardens();
  if (!rows.some((g) => String(g?.id) === String(id))) return false;
  return _write(STORAGE_KEYS.ACTIVE_GARDEN_ID, id);
}

/**
 * getActiveExperience — 'garden' | 'farm' | null.
 *
 * Resolution order (safe-launch backyard-as-farm-type spec §8):
 *   1. Explicit pin in `farroway_active_experience`.
 *   2. Derived from the active farm row's `farmType` — if the
 *      legacy `farroway_active_farm` JSON blob carries
 *      farmType in {backyard, home_garden, home}, treat as
 *      garden. This keeps the spec's "active farm's farmType
 *      drives the experience surface" rule honored even when
 *      no explicit pin has been written yet.
 *   3. Derived: if only gardens exist, return 'garden'; if only
 *      farms exist, return 'farm'.
 *   4. Both exist, no valid pin → 'farm' (historical default).
 *   5. null when no rows of either type are stored.
 *
 * The "explicit pin must point to a non-empty experience" rule
 * stops a stale pin (e.g. user deleted their last garden, then
 * switched device) from making the app render an empty surface.
 */
export function getActiveExperience() {
  const pinned = _read(STORAGE_KEYS.ACTIVE_EXPERIENCE);
  const gardens = getGardens();
  const farms   = getFarmsOnly();

  if (pinned === EXPERIENCE.GARDEN && gardens.length > 0) return EXPERIENCE.GARDEN;
  if (pinned === EXPERIENCE.FARM   && farms.length   > 0) return EXPERIENCE.FARM;

  // Derivation step 2: read the legacy active-farm blob. If
  // that row's farmType is a backyard variant AND the user
  // actually has a garden record, surface garden — even
  // without an explicit pin. This honors the spec's
  // "activeFarm.farmType drives the experience" rule.
  try {
    const legacyActive = _readLegacyActiveFarm();
    if (legacyActive && (gardens.length > 0 || farms.length > 0)) {
      const t = String(legacyActive.farmType || '').toLowerCase();
      const isBackyard = t === 'backyard' || t === 'home_garden' || t === 'home';
      if (isBackyard && gardens.length > 0) return EXPERIENCE.GARDEN;
      if (!isBackyard && farms.length > 0)  return EXPERIENCE.FARM;
    }
  } catch { /* fall through to count-based derivation */ }

  if (gardens.length > 0 && farms.length === 0) return EXPERIENCE.GARDEN;
  if (farms.length   > 0 && gardens.length === 0) return EXPERIENCE.FARM;
  if (gardens.length > 0 && farms.length   > 0) {
    // Both exist but no valid pin — prefer farm (the historically
    // default surface). Caller can switch from there.
    return EXPERIENCE.FARM;
  }
  return null;
}

function _readLegacyActiveFarm() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem('farroway_active_farm');
    if (!raw) return null;
    const v = JSON.parse(raw);
    return v && typeof v === 'object' ? v : null;
  } catch { return null; }
}

/**
 * getActiveEntity — returns the row the active experience points
 * at, or `null` when nothing is active. Repairs a stale pointer
 * by falling through to the first row of the active experience.
 */
export function getActiveEntity() {
  const exp = getActiveExperience();
  if (exp === EXPERIENCE.GARDEN) {
    const gardens = getGardens();
    const id = getActiveGardenId();
    return gardens.find((g) => String(g?.id) === String(id)) || gardens[0] || null;
  }
  if (exp === EXPERIENCE.FARM) {
    const farms = getFarmsOnly();
    const id = getActiveFarmId();
    return farms.find((f) => String(f?.id) === String(id)) || farms[0] || null;
  }
  return null;
}

// ── Actions ───────────────────────────────────────────────────

/**
 * setActiveExperience(target) — pin the active experience.
 *
 *   * Refuses to pin to an empty experience (no rows of that type).
 *   * Same-experience writes are a no-op (no event fired).
 *   * Fires `farroway:experience_switched` on success.
 */
export function setActiveExperience(target) {
  const t = String(target || '').toLowerCase();
  if (t !== EXPERIENCE.GARDEN && t !== EXPERIENCE.FARM) return false;

  const gardens = getGardens();
  const farms   = getFarmsOnly();
  if (t === EXPERIENCE.GARDEN && gardens.length === 0) return false;
  if (t === EXPERIENCE.FARM   && farms.length   === 0) return false;

  const before = getActiveExperience();
  if (before === t) return true; // already pinned — no-op

  _write(STORAGE_KEYS.ACTIVE_EXPERIENCE, t);

  // Repair pointer if needed so callers immediately see a valid
  // active entity after the switch.
  if (t === EXPERIENCE.GARDEN) {
    const cur = getActiveGardenId();
    const ok  = cur && gardens.some((g) => String(g?.id) === String(cur));
    if (!ok) setActiveGardenId(gardens[0].id);
  } else {
    const cur = getActiveFarmId();
    const ok  = cur && farms.some((f) => String(f?.id) === String(cur));
    if (!ok) setActiveFarmId(farms[0].id);
  }

  const active = getActiveEntity();
  _emitSwitch(t, active ? active.id : null, { previous: before });
  return true;
}

/** Convenience alias for setActiveExperience. */
export function switchExperience(target) {
  return setActiveExperience(target);
}

/**
 * addGarden(payload) — create a backyard / home-garden row and
 * pin it as the active garden. Forces `farmType: 'backyard'` so
 * the row never lands in the farms partition.
 */
export function addGarden(payload = {}) {
  const safe = (payload && typeof payload === 'object') ? payload : {};
  const row  = saveFarm({
    ...safe,
    farmType: 'backyard',
    setActive: false, // we manage the active garden pointer ourselves
  });
  if (!row || !row.id) return null;
  setActiveGardenId(row.id);
  _write(STORAGE_KEYS.ACTIVE_EXPERIENCE, EXPERIENCE.GARDEN);
  _emitSwitch(EXPERIENCE.GARDEN, row.id, { added: true });
  return row;
}

/**
 * addFarm(payload) — create a non-garden farm row and pin it as
 * the active farm. Defaults to 'small_farm' when farmType is
 * absent; rejects 'backyard' so cross-type writes can't sneak in.
 */
export function addFarm(payload = {}) {
  const safe = (payload && typeof payload === 'object') ? payload : {};
  const ft = String(safe.farmType || 'small_farm').toLowerCase();
  const safeType = (ft === 'backyard' || ft === 'home_garden' || ft === 'home')
    ? 'small_farm'
    : ft;
  const row = saveFarm({
    ...safe,
    farmType: safeType,
    setActive: true, // existing setActiveFarmId behaviour
  });
  if (!row || !row.id) return null;
  _write(STORAGE_KEYS.ACTIVE_EXPERIENCE, EXPERIENCE.FARM);
  _emitSwitch(EXPERIENCE.FARM, row.id, { added: true });
  return row;
}

/**
 * removeExperience(id) — delete a garden or farm row and repair
 * the active pointer if it was pointing at the deleted row.
 *
 * Returns true when something was deleted, false otherwise. Does
 * not touch task completions / events tied to the row — those
 * stay in the append-only event log so historical reports still
 * work.
 */
export function removeExperience(id) {
  if (!id || !_hasStorage()) return false;
  let raw;
  try { raw = localStorage.getItem('farroway.farms'); }
  catch { return false; }
  if (!raw) return false;
  let rows;
  try { rows = JSON.parse(raw); }
  catch { return false; }
  if (!Array.isArray(rows)) return false;

  const before = rows.length;
  const next = rows.filter((r) => String(r?.id) !== String(id));
  if (next.length === before) return false;

  try { localStorage.setItem('farroway.farms', JSON.stringify(next)); }
  catch { return false; }

  // Repair active pointers if they pointed at the deleted row.
  if (getActiveGardenId() === String(id)) _write(STORAGE_KEYS.ACTIVE_GARDEN_ID, null);
  if (getActiveFarmId()   === String(id)) {
    try { localStorage.removeItem('farroway.activeFarmId'); }
    catch { /* swallow */ }
  }

  // Re-derive active experience so a now-empty experience can't
  // leave the app pointed at nothing renderable.
  const exp = getActiveExperience();
  if (!exp) {
    _write(STORAGE_KEYS.ACTIVE_EXPERIENCE, null);
  } else {
    _write(STORAGE_KEYS.ACTIVE_EXPERIENCE, exp);
  }

  _emitSwitch(getActiveExperience(),
    (getActiveEntity() && getActiveEntity().id) || null,
    { removed: id });
  return true;
}

// ── Snapshot ──────────────────────────────────────────────────

/**
 * getExperienceSnapshot — single read for hooks / hosts that
 * want the whole picture in one shot. Cheap; reads the same
 * storage keys the individual getters use.
 */
export function getExperienceSnapshot() {
  const gardens = getGardens();
  const farms   = getFarmsOnly();
  const activeExperience = getActiveExperience();
  const activeGardenId   = getActiveGardenId();
  const activeFarmId     = getActiveFarmId();
  const activeEntity     = getActiveEntity();
  return {
    gardens,
    farms,
    activeExperience,
    activeGardenId,
    activeFarmId,
    activeEntity,
    hasGarden: gardens.length > 0,
    hasFarm:   farms.length   > 0,
    hasBoth:   gardens.length > 0 && farms.length > 0,
  };
}

export default {
  EXPERIENCE,
  STORAGE_KEYS,
  SWITCH_EVENT,
  isGarden,
  isFarm,
  getGardens,
  getFarmsOnly,
  getActiveExperience,
  getActiveGardenId,
  setActiveGardenId,
  getActiveEntity,
  setActiveExperience,
  switchExperience,
  addGarden,
  addFarm,
  removeExperience,
  getExperienceSnapshot,
};
