/**
 * plantStore.js — Garden Mode plant-identity store.
 *
 * Local-first storage for the gardener's plant profile:
 *   { id, nickname, plantType, photo, indoorOutdoor, containerType,
 *     containerSize, growthStage, startedDate, lastUpdated }
 *
 * Storage key: farroway_plant_v1   (single active plant per device)
 *
 * Garden Mode positions Farroway as a personal plant-care companion
 * — one plant the user is caring for "right now". Multi-plant
 * support is a future expansion; the keyed list is a single object
 * here so today's UI never has to choose which plant is "active".
 *
 * Strict-rule audit
 *   • Pure module — no React, no hooks.
 *   • Never throws — every read/write guarded.
 *   • SSR-safe — localStorage access is tolerant.
 *   • No network. No blocking I/O.
 *   • Corrupt JSON → safe empty profile (never crashes the app).
 */

export const PLANT_STORE_KEY = 'farroway_plant_v1';

// ─── Canonical defaults ───────────────────────────────────────────

/**
 * The fallback profile callers receive when no plant is saved or
 * the stored payload is corrupt. Every UI surface reads through
 * these so a missing field never blanks a card.
 */
export const PLANT_FALLBACK = Object.freeze({
  id:             null,
  nickname:       'My Plant',          // generic fallback per spec §1
  plantType:      null,                 // crop slug — drives intelligence
  photo:          null,                 // dataURL or remote URL; lazy-loaded
  indoorOutdoor:  null,                 // 'indoor' | 'outdoor' | null
  containerType:  null,                 // 'pot' | 'raisedBed' | 'ground' | 'balcony'
  containerSize:  null,                 // 'small' | 'medium' | 'large'
  growthStage:    null,                 // matches contextEngine stage vocab
  startedDate:    null,                 // ISO date string
  lastUpdated:    null,                 // ISO datetime
});

const VALID_INDOOR  = new Set(['indoor', 'outdoor']);
const VALID_CTYPE   = new Set(['pot', 'raisedBed', 'ground', 'balcony', 'window']);
const VALID_CSIZE   = new Set(['small', 'medium', 'large']);
const VALID_STAGE   = new Set([
  'seedling', 'growing', 'vegetative',
  'flowering', 'fruiting', 'ready_to_pick',
  'harvest', 'post_harvest', 'resting', 'dormant',
]);

// ─── Helpers ──────────────────────────────────────────────────────

function _isoNow() {
  try { return new Date().toISOString(); } catch { return ''; }
}

function _makeId() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return 'plant_' + crypto.randomUUID();
    }
  } catch { /* fall through */ }
  return 'plant_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

/**
 * Normalize an input partial-profile into the canonical shape.
 * Unknown enum values fall back to null. String fields are trimmed.
 */
function _normalize(input) {
  const o = (input && typeof input === 'object') ? input : {};
  const trim = (v) => (typeof v === 'string' ? v.trim() : null);

  const indoor = trim(o.indoorOutdoor) ? String(o.indoorOutdoor).toLowerCase() : null;
  const ctype  = trim(o.containerType) ? String(o.containerType) : null;
  const csize  = trim(o.containerSize) ? String(o.containerSize).toLowerCase() : null;
  const stage  = trim(o.growthStage)   ? String(o.growthStage).toLowerCase()   : null;

  return {
    id:            trim(o.id) || _makeId(),
    nickname:      trim(o.nickname) || PLANT_FALLBACK.nickname,
    plantType:     trim(o.plantType) || null,
    photo:         (typeof o.photo === 'string' && o.photo.length < 1_500_000)
                     ? o.photo : null,        // 1.5 MB cap on inline dataURL
    indoorOutdoor: VALID_INDOOR.has(indoor) ? indoor : null,
    containerType: VALID_CTYPE.has(ctype)   ? ctype  : null,
    containerSize: VALID_CSIZE.has(csize)   ? csize  : null,
    growthStage:   VALID_STAGE.has(stage)   ? stage  : null,
    startedDate:   trim(o.startedDate)      || null,
    lastUpdated:   _isoNow(),
  };
}

// ─── Public API ──────────────────────────────────────────────────

/**
 * readPlant() → PlantProfile
 *
 * Returns the saved profile or PLANT_FALLBACK. Never throws.
 */
export function readPlant() {
  try {
    if (typeof localStorage === 'undefined') return { ...PLANT_FALLBACK };
    const raw = localStorage.getItem(PLANT_STORE_KEY);
    if (!raw) return { ...PLANT_FALLBACK };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { ...PLANT_FALLBACK };
    return { ...PLANT_FALLBACK, ...parsed };
  } catch {
    return { ...PLANT_FALLBACK };
  }
}

/**
 * savePlant(partial) → PlantProfile
 *
 * Merges `partial` over the existing profile, normalizes, persists.
 * Returns the resulting full profile. Never throws.
 *
 * Fires `farroway:plant_changed` so React hooks listening for it
 * re-render in the same tab without needing a storage event.
 */
export function savePlant(partial) {
  const next = _normalize({ ...readPlant(), ...((partial && typeof partial === 'object') ? partial : {}) });
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(PLANT_STORE_KEY, JSON.stringify(next));
    }
  } catch { /* quota / private mode — non-fatal */ }
  try {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('farroway:plant_changed', { detail: { plant: next } }));
    }
  } catch { /* swallow */ }
  return next;
}

/**
 * patchPlant(field, value) — convenience for single-field updates.
 * Returns the resulting full profile.
 */
export function patchPlant(field, value) {
  if (typeof field !== 'string' || !field) return readPlant();
  return savePlant({ [field]: value });
}

/**
 * clearPlant() — remove the saved profile (sign-out / reset).
 */
export function clearPlant() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(PLANT_STORE_KEY);
    }
  } catch { /* ignore */ }
  try {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('farroway:plant_changed', { detail: { plant: null } }));
    }
  } catch { /* swallow */ }
}

/**
 * hasPlant() — true when the user has stamped any custom field.
 * Used by Home to decide between "Add your first plant" empty state
 * and the Companion Card.
 */
export function hasPlant() {
  try {
    const p = readPlant();
    return !!(p && (p.nickname && p.nickname !== PLANT_FALLBACK.nickname
              || p.plantType || p.photo || p.containerType
              || p.containerSize || p.growthStage || p.startedDate));
  } catch {
    return false;
  }
}

// ─── Test surface ──────────────────────────────────────────────────
export const _internal = Object.freeze({
  PLANT_FALLBACK,
  VALID_INDOOR,
  VALID_CTYPE,
  VALID_CSIZE,
  VALID_STAGE,
  _normalize,
  _makeId,
});
