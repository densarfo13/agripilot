/**
 * harvestRecordStore.js — persists harvest records per farm under a
 * single localStorage key.
 *
 * Storage:
 *   localStorage['farroway.harvestRecords.v1'] = {
 *     byFarm: {
 *       [farmId]: [ HarvestRecord, … ]
 *     }
 *   }
 *
 * HarvestRecord:
 *   {
 *     id,
 *     farmId,
 *     crop,            // canonical lowercase crop key (from the farm)
 *     harvestedAmount, // number
 *     harvestedUnit,   // 'kg' | 'tons' | 'bags' | 'crates' | 'pieces'
 *     harvestedAt,     // ISO string
 *     notes,           // optional string
 *     plantingDate,    // mirrored from the farm at record time
 *     cycleCompletedAt,// ISO string (set on record — completion is implicit)
 *   }
 *
 * Append-only. Record deletion is intentionally omitted in v1 to
 * preserve the farmer's history for analytics + the crop_cycle_
 * completed milestone.
 */

const KEY = 'farroway.harvestRecords.v1';

export const HARVEST_UNITS = Object.freeze([
  { key: 'kg',     labelKey: 'harvest.unit.kg',     fallback: 'kg' },
  { key: 'tons',   labelKey: 'harvest.unit.tons',   fallback: 'tons' },
  { key: 'bags',   labelKey: 'harvest.unit.bags',   fallback: 'bags' },
  { key: 'crates', labelKey: 'harvest.unit.crates', fallback: 'crates' },
  { key: 'pieces', labelKey: 'harvest.unit.pieces', fallback: 'pieces' },
]);

function hasStorage() {
  return typeof window !== 'undefined' && !!window.localStorage;
}

function readRaw() {
  if (!hasStorage()) return { byFarm: {} };
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== 'object' || !parsed.byFarm) return { byFarm: {} };
    return parsed;
  } catch { return { byFarm: {} }; }
}

function writeRaw(store) {
  if (!hasStorage()) return false;
  try { window.localStorage.setItem(KEY, JSON.stringify(store)); return true; }
  catch { return false; }
}

function genId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'hv_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

/**
 * recordHarvest — append a new harvest record.
 *
 *   { farmId, crop, harvestedAmount, harvestedUnit, harvestedAt?, notes?, plantingDate? }
 *
 * Returns the frozen record, or null when required fields are
 * missing (caller must branch — the record engine never crashes).
 */
export function recordHarvest({
  farmId,
  crop,
  harvestedAmount,
  harvestedUnit = 'kg',
  harvestedAt   = null,
  notes         = null,
  plantingDate  = null,
} = {}) {
  if (!farmId) return null;
  const amount = Number(harvestedAmount);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const unit = HARVEST_UNITS.find((u) => u.key === String(harvestedUnit).toLowerCase());
  if (!unit) return null;

  const store = readRaw();
  const slot  = Array.isArray(store.byFarm[farmId]) ? store.byFarm[farmId] : [];

  const record = Object.freeze({
    id:              genId(),
    farmId:          String(farmId),
    crop:            crop ? String(crop).toLowerCase() : null,
    harvestedAmount: amount,
    harvestedUnit:   unit.key,
    harvestedAt:     harvestedAt || new Date().toISOString(),
    notes:           notes || null,
    plantingDate:    plantingDate || null,
    cycleCompletedAt: new Date().toISOString(),
  });

  slot.push({ ...record });
  store.byFarm[farmId] = slot;
  writeRaw(store);
  return record;
}

/**
 * listHarvests — records for a farm, newest first.
 */
export function listHarvests(farmId) {
  if (!farmId) return [];
  const store = readRaw();
  const slot = store.byFarm[farmId];
  if (!Array.isArray(slot)) return [];
  return slot.slice().reverse();
}

/**
 * getLatestHarvest — most recent record for a farm, or null.
 */
export function getLatestHarvest(farmId) {
  const list = listHarvests(farmId);
  return list.length > 0 ? list[0] : null;
}

/**
 * hasRecentHarvest — true when a record was made for THIS crop cycle.
 *
 * A cycle counts as "completed" if ANY of these matches — ordered
 * from most to least specific so real-world edge cases (a farmer
 * correcting plantingDate post-harvest, a legacy record with no
 * planting anchor) never trigger a spurious regression to active:
 *
 *   1. Exact plantingDate match on the latest record
 *   2. plantingDate within ±3 days of the record's anchor (small
 *      corrections don't un-complete the cycle)
 *   3. Record harvested AFTER the current plantingDate (the record
 *      can only belong to THIS or a prior cycle; since it's the
 *      latest record, it belongs to this one)
 *   4. No plantingDate on the farm + record within the last 60 days
 */
export function hasRecentHarvest({ farmId, plantingDate = null } = {}) {
  if (!farmId) return false;
  const list = listHarvests(farmId);
  if (list.length === 0) return false;
  const latest = list[0];

  // 1) Exact match on the stored plantingDate.
  if (plantingDate && latest.plantingDate === plantingDate) return true;

  // 2) Small corrections: if the farm's plantingDate moved within
  //    ±3 days of the record's own plantingDate, still the same
  //    cycle — the farmer just fixed the date.
  if (plantingDate && latest.plantingDate) {
    const a = new Date(plantingDate).getTime();
    const b = new Date(latest.plantingDate).getTime();
    if (Number.isFinite(a) && Number.isFinite(b)
        && Math.abs(a - b) <= 3 * 86400000) {
      return true;
    }
  }

  // 3) Record happened AFTER the current plantingDate. It can only
  //    belong to this cycle (you can't harvest a crop before you
  //    planted it). Prevents regression when plantingDate gets
  //    edited post-completion without starting a genuinely new cycle.
  if (plantingDate) {
    const planted = new Date(plantingDate).getTime();
    const harvestedAt = new Date(latest.harvestedAt).getTime();
    if (Number.isFinite(planted) && Number.isFinite(harvestedAt)
        && harvestedAt > planted) {
      return true;
    }
    // A plantingDate was supplied AND none of the specific rules
    // matched → this is a genuinely new cycle. Don't fall through
    // to the 60-day legacy guard (which is only meant for rows
    // that never had a planting anchor in the first place).
    return false;
  }

  // 4) No planting anchor at all — treat records within 60 days as
  //    the current cycle's harvest.
  const ageMs = Date.now() - new Date(latest.harvestedAt).getTime();
  return Number.isFinite(ageMs) && ageMs < 60 * 86400000;
}

export function clearHarvestsForFarm(farmId) {
  if (!farmId) return;
  const store = readRaw();
  if (store.byFarm[farmId]) {
    delete store.byFarm[farmId];
    writeRaw(store);
  }
}

export const _internal = Object.freeze({ KEY, readRaw, writeRaw });
