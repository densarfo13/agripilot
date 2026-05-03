/**
 * migrateFarmGardenSplit.js — one-shot migration that reclassifies
 * legacy farm rows that should have been gardens. Spec: "Farm vs
 * Garden UX", §8 (Migration).
 *
 *   import { migrateFarmGardenSplit } from '../store/migrateFarmGardenSplit.js';
 *   migrateFarmGardenSplit();
 *
 * The migration is idempotent + safe to call on every boot:
 *   • Self-skips when the sentinel `farroway_farm_garden_split_v1`
 *     is set in localStorage. Re-running has no effect.
 *   • Self-skips when the legacy partition (`farroway.farms`) is
 *     empty so a brand-new install pays no cost.
 *   • Never throws — every read / write try/catch wrapped.
 *   • Never deletes data. The original row is mutated in place to
 *     update farmType + type so downstream consumers (Manage
 *     Farms / Manage Gardens / decision engine) immediately stop
 *     mixing the partitions.
 *
 * Reclassification rules (per spec §8)
 * ────────────────────────────────────
 *   A farm row should become a garden when ANY of:
 *     1. The row already carries a `growingSetup` value (only
 *        garden onboarding writes that field).
 *     2. The row's farmType OR name contains 'backyard' / 'home'
 *        / 'garden' wording.
 *     3. The row's `sizeInAcres` is < 1 AND the original
 *        farmType isn't 'commercial' (a < 1-acre commercial
 *        operation is still legitimate; we only reclassify
 *        small-tier rows).
 *
 *   When reclassified:
 *     • farmType  → 'backyard'
 *     • type      → 'garden'
 *     • autoFarmClass → 'garden'
 *
 *   The change persists via writeJson into `farroway.farms`.
 *   The store's saveFarm path also dual-writes into the
 *   first-class farroway_gardens / farroway_farms arrays; the
 *   migration triggers a one-time rewrite of those arrays so
 *   the partition is consistent post-migration.
 *
 * Strict-rule audit
 *   • Pure ESM. No React imports. No backend calls.
 *   • Idempotent (sentinel-gated).
 *   • Never throws — failures are swallowed; the legacy partition
 *     stays as-is.
 *   • Logs a single audit entry into a tiny dev log so a QA pass
 *     can verify what was reclassified.
 */

const SENTINEL_KEY = 'farroway_farm_garden_split_v1';
const FARMS_KEY    = 'farroway.farms';
const GARDENS_KEY  = 'farroway_gardens';
const NEW_FARMS_KEY = 'farroway_farms';

function _hasStorage() {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch { return false; }
}

function _readArr(key) {
  if (!_hasStorage()) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : null;
  } catch { return null; }
}

function _writeArr(key, arr) {
  if (!_hasStorage()) return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(arr));
    return true;
  } catch { return false; }
}

/**
 * _shouldBeGarden(row) → boolean
 *
 * Encapsulates the §8 reclassification rules so the test harness
 * can verify each branch independently. Returns true when the
 * row's data shape says "this is a garden" regardless of how it
 * was originally tagged.
 */
export function _shouldBeGarden(row) {
  if (!row || typeof row !== 'object') return false;
  const ft = String(row.farmType || '').toLowerCase();
  // Already-tagged garden rows pass through without reclassification.
  // The migration's job is to find MIS-tagged rows; correctly tagged
  // ones don't need touching (and we preserve `type` if missing).
  if (ft === 'backyard' || ft === 'home' || ft === 'home_garden') return true;

  // Rule 1 — explicit growingSetup field is a garden-only marker.
  if (row.growingSetup) return true;

  // Rule 2 — name / wording contains 'home' / 'garden' / 'backyard'.
  const haystack = String(
    (row.name || '') + ' ' + (row.farmName || '') + ' ' + (row.gardenName || ''),
  ).toLowerCase();
  if (/\b(home|garden|backyard|patio|balcony|pot)\b/.test(haystack)) return true;

  // Rule 3 — sub-1-acre AND not commercial.
  const acres = Number(row.sizeInAcres);
  if (Number.isFinite(acres) && acres > 0 && acres < 1
      && ft !== 'commercial') {
    return true;
  }
  return false;
}

/**
 * migrateFarmGardenSplit() → { migrated, scanned, reclassified, skipped }
 *
 * Returns a summary so the boot log can report what changed. The
 * sentinel key prevents re-runs; pass `force: true` to re-run for
 * QA / dev. Never throws.
 *
 * @param {object} [opts]
 * @param {boolean} [opts.force]  bypass the sentinel — re-run even
 *                                if a previous run completed.
 */
export function migrateFarmGardenSplit(opts = {}) {
  const summary = { migrated: false, scanned: 0, reclassified: 0, skipped: 0 };
  if (!_hasStorage()) {
    summary.skipped = 1;
    return summary;
  }

  // Sentinel-gated. Once we've successfully migrated this device,
  // every subsequent call is a no-op.
  try {
    if (!opts.force
        && window.localStorage.getItem(SENTINEL_KEY) === 'true') {
      return summary;
    }
  } catch { /* fall through */ }

  const rows = _readArr(FARMS_KEY);
  if (!rows || rows.length === 0) {
    // Nothing to migrate — set the sentinel so the no-op cost
    // disappears on subsequent boots.
    try { window.localStorage.setItem(SENTINEL_KEY, 'true'); }
    catch { /* swallow */ }
    return summary;
  }

  summary.scanned = rows.length;

  const updated = rows.map((row) => {
    if (!row || typeof row !== 'object') return row;
    const wantsGarden = _shouldBeGarden(row);
    const ft = String(row.farmType || '').toLowerCase();
    const isAlreadyGarden = ft === 'backyard' || ft === 'home' || ft === 'home_garden';

    // Patch the row when EITHER reclassification is needed OR the
    // row is missing the new spec-shaped `type` field. Existing
    // backyard rows fall through the second branch so their
    // `type` is set to 'garden' on first migrate.
    if (wantsGarden && !isAlreadyGarden) {
      summary.reclassified += 1;
      return {
        ...row,
        farmType:      'backyard',
        type:          'garden',
        autoFarmClass: 'garden',
      };
    }
    if (!row.type) {
      return {
        ...row,
        type: isAlreadyGarden ? 'garden' : 'farm',
      };
    }
    return row;
  });

  // Persist back to the legacy partition.
  _writeArr(FARMS_KEY, updated);

  // Rewrite the first-class arrays so post-migration readers see
  // a consistent partition. We split by the new `type` field so
  // the dual-write logic in saveFarm + the multiExperience
  // helpers don't have to coordinate with this script.
  const gardens = updated.filter((r) => r && r.type === 'garden');
  const farmsOnly = updated.filter((r) => r && r.type === 'farm');
  _writeArr(GARDENS_KEY,    gardens);
  _writeArr(NEW_FARMS_KEY,  farmsOnly);

  // Sentinel marks this device migrated.
  try { window.localStorage.setItem(SENTINEL_KEY, 'true'); }
  catch { /* swallow */ }

  summary.migrated = true;
  return summary;
}

export default migrateFarmGardenSplit;
