/**
 * harvestValidation.js — pure validation for a harvest report
 * payload. Used by the POST /api/v2/harvests route before we
 * touch the DB so error codes stay consistent.
 *
 * Rules:
 *   quantityHarvested     required, > 0, finite
 *   quantityLost          optional, >= 0, <= quantityHarvested
 *   quantitySold/Stored   optional, >= 0
 *   quantitySold + stored + lost ≤ quantityHarvested (with 1% slack)
 *   harvestDate           required, not in the future
 *   quantityUnit          required, enum-checked
 *   qualityGrade          optional, enum-checked
 *   cropId                required, non-empty
 *
 * Output: { ok: true, data } on success, { ok: false, error } on
 * failure. The service layer translates these codes to HTTP status.
 */

const VALID_UNITS = new Set(['kg', 'bags', 'tonnes', 'crates', 'bundles']);
const VALID_GRADES = new Set(['A', 'B', 'C', 'poor', 'good', 'excellent']);
const MAX_QUANTITY = 1_000_000; // sanity cap — anything larger is a typo

function num(v) { return typeof v === 'number' && Number.isFinite(v) ? v : NaN; }

export function validateHarvestPayload(input = {}) {
  const harvested = num(input.quantityHarvested);
  if (!(harvested > 0)) return fail('quantity_must_be_positive');
  if (harvested > MAX_QUANTITY) return fail('quantity_too_large');

  const unit = typeof input.quantityUnit === 'string' ? input.quantityUnit.toLowerCase() : null;
  if (!unit || !VALID_UNITS.has(unit)) return fail('invalid_unit');

  const cropId = typeof input.cropId === 'string' ? input.cropId.trim() : '';
  if (!cropId) return fail('missing_crop');

  const dateRaw = input.harvestDate;
  const date = dateRaw instanceof Date ? dateRaw : new Date(dateRaw);
  if (Number.isNaN(date.getTime())) return fail('invalid_harvest_date');
  if (date.getTime() > Date.now() + 24 * 3600 * 1000) {
    // Allow up to 24h of clock skew but reject clearly-future dates.
    return fail('harvest_date_in_future');
  }

  const optionalNonNegative = (v, code) => {
    if (v == null) return null;
    const n = num(v);
    if (!Number.isFinite(n) || n < 0) return fail(code);
    return n;
  };
  const lost = optionalNonNegative(input.quantityLost, 'losses_must_be_nonnegative');
  if (lost && lost.ok === false) return lost;
  const sold = optionalNonNegative(input.quantitySold, 'sold_must_be_nonnegative');
  if (sold && sold.ok === false) return sold;
  const stored = optionalNonNegative(input.quantityStored, 'stored_must_be_nonnegative');
  if (stored && stored.ok === false) return stored;

  const lostVal = typeof lost === 'number' ? lost : 0;
  const soldVal = typeof sold === 'number' ? sold : 0;
  const storedVal = typeof stored === 'number' ? stored : 0;

  if (lostVal > harvested) return fail('losses_exceed_harvest');
  // Allow 1% slack for rounding in farmer-entered values.
  if (soldVal + storedVal + lostVal > harvested * 1.01) {
    return fail('breakdown_exceeds_harvest');
  }

  const grade = input.qualityGrade == null
    ? null
    : typeof input.qualityGrade === 'string' && VALID_GRADES.has(input.qualityGrade)
      ? input.qualityGrade
      : undefined;
  if (grade === undefined) return fail('invalid_quality_grade');

  const notes = typeof input.notes === 'string' ? input.notes.slice(0, 2000) : null;

  return {
    ok: true,
    data: {
      cropId,
      cropLabel: typeof input.cropLabel === 'string' ? input.cropLabel : cropId,
      cropCycleId: typeof input.cropCycleId === 'string' ? input.cropCycleId : null,
      harvestDate: date,
      quantityHarvested: harvested,
      quantityUnit: unit,
      quantityLost: typeof lost === 'number' ? lost : null,
      quantitySold: typeof sold === 'number' ? sold : null,
      quantityStored: typeof stored === 'number' ? stored : null,
      qualityGrade: grade,
      notes,
    },
  };
}

function fail(code) { return { ok: false, error: code }; }

export const _internal = { VALID_UNITS, VALID_GRADES, MAX_QUANTITY };
