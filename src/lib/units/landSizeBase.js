/**
 * landSizeBase.js — single canonical land-size base unit.
 *
 * Spec
 *   • Store ONLY one base unit on each row: `landSizeSqFt`.
 *   • Capture the user's chosen unit as `displayUnit` so the UI
 *     can render the same value back without re-conversion.
 *   • Convert ONCE on save, ONCE on display. Never twice.
 *
 * Coexists with the existing canonical area logic:
 *   • `src/lib/units/areaConversion.js` carries `normalizedAreaSqm`
 *     (m² as the historical base) — kept for back-compat with
 *     yield/per-area math + NGO summaries.
 *   • This module ADDS `landSizeSqFt` + `displayUnit` so the
 *     edit + display surfaces can implement the spec's
 *     "store once, format on render" rule without reading m²
 *     and re-converting.
 *
 *   `landSizeSqFt = round(normalizedAreaSqm * 10.7639, 4)` exactly.
 *   So both bases stay perfectly consistent — neither is the
 *   source of truth at the expense of the other.
 *
 * API
 *   toLandSizeSqFt(value, unit)        → number | null
 *   fromLandSizeSqFt(landSizeSqFt, u)  → number | null
 *   displayLandSize(landSizeSqFt, u)   → '4,356,000 sq ft'
 *   repairLandSize(row)                → patched row (heuristic §6)
 *   repairLandSizeBase()               → boot-time sweep
 *
 * Strict-rule audit
 *   * Pure functions; no I/O on import.
 *   * Never throws — every read/write is try/catch wrapped.
 *   * Repair sweep is idempotent; running twice is a no-op.
 *   * Heuristic correction is conservative: only flips
 *     `acres > 10000` → `sqft`, never the other direction.
 *     A genuine 10k+ acre commercial farm is rare; an
 *     accidental sqft typed into an acres field is common.
 */

import {
  normalizeUnit, toSquareMeters,
} from './areaConversion.js';

// Conversion factors expressed in square FEET so this module
// owns its own constants and isn't tied to the m²-base round-trip.
const SQFT_PER_UNIT = Object.freeze({
  sqft:     1,
  sqm:      10.7639,
  acres:    43560,
  hectares: 107639,
});

/**
 * toLandSizeSqFt — convert any (value, unit) pair into the
 * canonical sqft base. Returns null on invalid input so callers
 * can branch without try/catch.
 */
export function toLandSizeSqFt(value, unit) {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;

  const key = normalizeUnit(unit);
  if (!key) return null;
  const factor = SQFT_PER_UNIT[key];
  if (!Number.isFinite(factor)) return null;
  return n * factor;
}

/**
 * fromLandSizeSqFt — convert the canonical base back into the
 * user's preferred display unit. Returns null on invalid input.
 */
export function fromLandSizeSqFt(landSizeSqFt, displayUnit) {
  const n = Number(landSizeSqFt);
  if (!Number.isFinite(n)) return null;
  const key = normalizeUnit(displayUnit);
  if (!key) return null;
  const factor = SQFT_PER_UNIT[key];
  if (!Number.isFinite(factor)) return null;
  return n / factor;
}

const _DISPLAY = Object.freeze({
  sqft:     'sq ft',
  sqm:      'sq m',
  acres:    'acres',
  hectares: 'hectares',
});

function _round(n, places) {
  if (!Number.isFinite(n)) return n;
  const f = Math.pow(10, places);
  return Math.round(n * f) / f;
}

function _addThousandsCommas(intStr) {
  return String(intStr).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * displayLandSize — single conversion + format.
 *
 *   displayLandSize(4356000, 'sq_ft')   → '4,356,000 sq ft'
 *   displayLandSize(4356000, 'acres')   → '100 acres'
 *   displayLandSize(929.0304, 'sq_m')   → '929 sq m'
 *   displayLandSize(null, 'acres')      → 'Not set'
 *
 * Rounding rules
 *   acres / hectares → 1 decimal max (strip trailing .0)
 *   sqft / sqm       → integer with thousands commas
 */
export function displayLandSize(landSizeSqFt, displayUnit) {
  if (landSizeSqFt == null || landSizeSqFt === '' || Number(landSizeSqFt) === 0) {
    return 'Not set';
  }
  const value = fromLandSizeSqFt(landSizeSqFt, displayUnit);
  if (value == null) return 'Not set';
  const key = normalizeUnit(displayUnit);
  const label = _DISPLAY[key] || displayUnit || '';

  if (key === 'sqft' || key === 'sqm') {
    const intPart = Math.round(value);
    return `${_addThousandsCommas(intPart)} ${label}`.trim();
  }
  // acres / hectares
  const rounded = _round(value, 1);
  const tidy = rounded === Math.trunc(rounded)
    ? String(Math.trunc(rounded))
    : String(rounded);
  return `${tidy} ${label}`.trim();
}

/**
 * repairLandSize(row) — single-row heuristic. Returns the row
 * unchanged when nothing to fix, or a patched copy when the
 * spec §6 rule fires.
 *
 * Heuristic: stored size > 10,000 with unit === 'acres' almost
 * certainly meant sq ft (a 10k+ acre row from a smallholder
 * pilot is not realistic; an accidental sqft typed into an
 * acres field is). Flip the unit and recompute the base.
 */
export function repairLandSize(row) {
  if (!row || typeof row !== 'object') return row;
  const size = Number(row.farmSize);
  const unit = normalizeUnit(row.sizeUnit);
  if (!Number.isFinite(size)) return row;
  if (unit !== 'acres') return row;
  if (size <= 10000) return row;

  const fixedUnit  = 'sqft';
  const fixedBase  = size; // size was always sqft, just mislabeled
  return {
    ...row,
    sizeUnit:        fixedUnit,
    landSizeSqFt:    fixedBase,
    displayUnit:     fixedUnit,
    _repairedFromAcres: true,
  };
}

/**
 * repairLandSizeBase — boot-time sweep over `farroway.farms`.
 *
 *   * Adds `landSizeSqFt` + `displayUnit` to every row that
 *     doesn't already carry them (computed from the existing
 *     `farmSize` × `sizeUnit` pair so historical rows acquire
 *     the new base without churn).
 *   * Applies `repairLandSize` to flip the >10k-acres heuristic.
 *   * Returns a list of action tags ('migrated_to_base',
 *     'repaired_acres_to_sqft') for dev-time logging.
 *
 * Idempotent — re-running is a no-op once every row has the
 * base + display fields set correctly.
 *
 * Strict-rule audit: never wipes existing data. Never throws.
 */
export function repairLandSizeBase() {
  const actions = [];
  if (typeof localStorage === 'undefined') return actions;

  let raw;
  try { raw = localStorage.getItem('farroway.farms'); }
  catch { return actions; }
  if (!raw) return actions;

  let rows;
  try { rows = JSON.parse(raw); }
  catch { return actions; }
  if (!Array.isArray(rows)) return actions;

  let dirty = false;
  const next = rows.map((row) => {
    if (!row || typeof row !== 'object') return row;

    // §6 heuristic — flip mislabeled acres to sqft first.
    const repaired = repairLandSize(row);
    if (repaired !== row) {
      actions.push('repaired_acres_to_sqft');
      dirty = true;
    }
    let r = repaired;

    // Migrate to base unit if missing.
    if (r.landSizeSqFt == null && r.farmSize != null && r.sizeUnit != null) {
      const base = toLandSizeSqFt(r.farmSize, r.sizeUnit);
      if (Number.isFinite(base)) {
        r = {
          ...r,
          landSizeSqFt: _round(base, 4),
          displayUnit:  normalizeUnit(r.sizeUnit) || r.sizeUnit,
        };
        actions.push('migrated_to_base');
        dirty = true;
      }
    }

    return r;
  });

  if (dirty) {
    try { localStorage.setItem('farroway.farms', JSON.stringify(next)); }
    catch { /* swallow */ }
  }
  return actions;
}

export const _internal = Object.freeze({ SQFT_PER_UNIT });
