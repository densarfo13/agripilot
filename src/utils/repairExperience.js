/**
 * repairExperience.js — idempotent repair pass over the
 * multi-experience storage state. Runs at app boot so a stale
 * pin, a deleted active row, or a corrupted JSON blob can never
 * leave the app pointed at nothing renderable.
 *
 *   import { repairExperience } from '.../utils/repairExperience.js';
 *   const actions = repairExperience();   // string[] of fixes applied
 *
 * Rules (final spec §4)
 *   1. activeExperience = backyard but activeGardenId missing →
 *      pick first garden as active.
 *   2. activeExperience = farm but activeFarmId missing →
 *      pick first farm.
 *   3. activeExperience missing →
 *      gardens exist  → backyard
 *      farms exist    → farm
 *      neither        → leave null (caller routes to onboarding).
 *   4. Active garden was deleted → fall back to remaining gardens
 *      → farms if no gardens left → null.
 *   5. Active farm was deleted → fall back to remaining farms
 *      → gardens if no farms left → null.
 *   6. Corrupted JSON for the keys we touch → remove only that
 *      one corrupted key. Never wipe other user data.
 *
 * Strict-rule audit
 *   * Never throws. Every storage read / write is try/catch wrapped.
 *   * Idempotent — calling it twice in a row is a no-op once the
 *     state is healthy.
 *   * No backend dependency. Pure local-storage repair.
 *   * Returns a list of human-readable action tags ('garden_pin_repaired',
 *     ...) so AuthContext can log them at dev verbosity without
 *     surfacing anything to the farmer.
 *   * Coexists with `src/utils/repairSession.js` — that file
 *     handles the auth + onboarding-flag side; this one handles
 *     the experience pointers.
 */

import {
  getGardens, getFarmsOnly,
  getActiveExperience, getActiveGardenId, setActiveGardenId,
  EXPERIENCE, STORAGE_KEYS,
} from '../store/multiExperience.js';
import { getActiveFarmId, setActiveFarmId } from '../store/farrowayLocal.js';

const FARROWAY_FARMS_KEY      = 'farroway.farms';
const ACTIVE_FARM_LEGACY_KEY  = 'farroway.activeFarmId';

function _safeParseList(key) {
  // Returns { ok, value, corrupted }. Used to detect a corrupted
  // JSON blob so we can drop the single key without touching the
  // rest of localStorage.
  try {
    if (typeof localStorage === 'undefined') return { ok: false, value: null, corrupted: false };
    const raw = localStorage.getItem(key);
    if (raw == null) return { ok: true, value: null, corrupted: false };
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return { ok: true, value: parsed, corrupted: false };
    // Wrong shape but parseable — treat as corrupted for our
    // purposes (downstream code expects an array).
    return { ok: false, value: null, corrupted: true };
  } catch {
    return { ok: false, value: null, corrupted: true };
  }
}

function _removeKey(key) {
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.removeItem(key);
    return true;
  } catch { return false; }
}

function _writeString(key, value) {
  try {
    if (typeof localStorage === 'undefined') return false;
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, String(value));
    return true;
  } catch { return false; }
}

/**
 * repairExperience(): string[]
 *
 * Returns the list of repair actions that were applied. Empty
 * array when the state was already healthy.
 */
export function repairExperience() {
  const actions = [];

  // ── Rule 6: drop corrupted blobs for our keys (only) ─────
  const farmsBlob = _safeParseList(FARROWAY_FARMS_KEY);
  if (farmsBlob.corrupted) {
    _removeKey(FARROWAY_FARMS_KEY);
    actions.push('farms_blob_dropped_corrupted');
  }

  // ── Read healthy state via the canonical store APIs ─────
  let gardens = [];
  let farms = [];
  try { gardens = getGardens() || []; } catch { gardens = []; }
  try { farms   = getFarmsOnly() || []; } catch { farms   = []; }

  let exp;
  try { exp = getActiveExperience(); } catch { exp = null; }

  // ── Rules 1 & 4: garden pointer & deleted-garden fallback ─
  let activeGardenId = null;
  try { activeGardenId = getActiveGardenId(); } catch { activeGardenId = null; }
  const gardenIdValid = activeGardenId
    && gardens.some((g) => String(g?.id) === String(activeGardenId));

  if (exp === EXPERIENCE.GARDEN) {
    if (!gardenIdValid) {
      if (gardens.length > 0) {
        setActiveGardenId(gardens[0].id);
        actions.push('garden_pin_repaired');
      } else {
        // Active experience says garden but there are none — fall
        // back to farm (rule 4).
        _writeString(STORAGE_KEYS.ACTIVE_GARDEN_ID, null);
        if (farms.length > 0) {
          _writeString(STORAGE_KEYS.ACTIVE_EXPERIENCE, EXPERIENCE.FARM);
          actions.push('garden_deleted_fellback_to_farm');
        } else {
          _writeString(STORAGE_KEYS.ACTIVE_EXPERIENCE, null);
          actions.push('experience_cleared_no_data');
        }
      }
    }
  } else if (activeGardenId && !gardenIdValid) {
    // Stale garden pin even when farm is active — drop it so a
    // future switch finds healthy state.
    _writeString(STORAGE_KEYS.ACTIVE_GARDEN_ID, null);
    actions.push('stale_garden_pin_dropped');
  }

  // ── Rules 2 & 5: farm pointer & deleted-farm fallback ───
  // Re-read after the garden branch may have flipped the experience.
  try { exp = getActiveExperience(); } catch { exp = null; }
  let activeFarmId = null;
  try { activeFarmId = getActiveFarmId(); } catch { activeFarmId = null; }
  const farmIdValid = activeFarmId
    && farms.some((f) => String(f?.id) === String(activeFarmId));

  if (exp === EXPERIENCE.FARM) {
    if (!farmIdValid) {
      if (farms.length > 0) {
        setActiveFarmId(farms[0].id);
        actions.push('farm_pin_repaired');
      } else {
        _removeKey(ACTIVE_FARM_LEGACY_KEY);
        if (gardens.length > 0) {
          _writeString(STORAGE_KEYS.ACTIVE_EXPERIENCE, EXPERIENCE.GARDEN);
          if (gardens[0]?.id) setActiveGardenId(gardens[0].id);
          actions.push('farm_deleted_fellback_to_garden');
        } else {
          _writeString(STORAGE_KEYS.ACTIVE_EXPERIENCE, null);
          actions.push('experience_cleared_no_data');
        }
      }
    }
  } else if (activeFarmId && !farmIdValid) {
    _removeKey(ACTIVE_FARM_LEGACY_KEY);
    actions.push('stale_farm_pin_dropped');
  }

  // ── Rule 3: derive active experience when missing ───────
  try { exp = getActiveExperience(); } catch { exp = null; }
  if (!exp) {
    if (gardens.length > 0) {
      _writeString(STORAGE_KEYS.ACTIVE_EXPERIENCE, EXPERIENCE.GARDEN);
      if (!getActiveGardenId() && gardens[0]?.id) setActiveGardenId(gardens[0].id);
      actions.push('experience_derived_garden');
    } else if (farms.length > 0) {
      _writeString(STORAGE_KEYS.ACTIVE_EXPERIENCE, EXPERIENCE.FARM);
      if (!getActiveFarmId() && farms[0]?.id) setActiveFarmId(farms[0].id);
      actions.push('experience_derived_farm');
    }
    // No data at all → leave null. Caller (FarmerEntry / route
    // guard) routes the user to onboarding.
  }

  return actions;
}

export default repairExperience;
