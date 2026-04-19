/**
 * timeEngine.js — resolves the planting window for a crop in a given
 * climate subregion and classifies the farmer's timing:
 *
 *   plant_now   — currentMonth is inside the optimal window
 *   plant_soon  — within 1 month before the window opens
 *   wait        — more than 1 month until the window opens
 *   too_late    — past the window's close
 *
 * Pure function. Consumed by the scoring engine to enrich each crop
 * recommendation with a `timing` field, and by the UI to render a
 * "Do this now" badge.
 */

/** Days-per-month cushion used when the user hasn't specified a day. */
const SOON_THRESHOLD_MONTHS = 1;

/**
 * Return true if `month` ∈ [start, end], with wrap-around support
 * (e.g. 10..2 spans October through February).
 */
export function monthInWindow(month, start, end) {
  if (!Number.isFinite(month) || !Number.isFinite(start) || !Number.isFinite(end)) return false;
  if (start <= end) return month >= start && month <= end;
  return month >= start || month <= end;
}

/**
 * Calendar distance (in months, 0..6) from `month` to the next
 * occurrence of `target`. Used to decide plant_soon vs wait.
 */
export function monthsUntil(current, target) {
  if (!Number.isFinite(current) || !Number.isFinite(target)) return 0;
  const diff = ((target - current) % 12 + 12) % 12;
  return diff;
}

/**
 * Calendar distance (in months) from `month` to the most recent
 * occurrence of `target`. Used to detect too_late once the window
 * has closed.
 */
export function monthsSince(current, target) {
  if (!Number.isFinite(current) || !Number.isFinite(target)) return 0;
  const diff = ((current - target) % 12 + 12) % 12;
  return diff;
}

/**
 * @param {Object} args
 * @param {number} args.currentMonth      1..12
 * @param {number} args.plantingStartMonth 1..12
 * @param {number} args.plantingEndMonth   1..12
 * @returns {Object} timing details for a crop
 */
export function evaluateTiming({
  currentMonth, plantingStartMonth, plantingEndMonth,
}) {
  if (!Number.isFinite(currentMonth) ||
      !Number.isFinite(plantingStartMonth) ||
      !Number.isFinite(plantingEndMonth)) {
    return {
      recommendation: 'unknown',
      inWindow: false,
      monthsUntilWindow: null,
      monthsSinceWindowClose: null,
    };
  }

  const inWindow = monthInWindow(currentMonth, plantingStartMonth, plantingEndMonth);
  const untilOpen = monthsUntil(currentMonth, plantingStartMonth);
  const sinceClose = monthsSince(currentMonth, plantingEndMonth);

  let recommendation;
  if (inWindow) {
    recommendation = 'plant_now';
  } else if (untilOpen > 0 && untilOpen <= SOON_THRESHOLD_MONTHS) {
    recommendation = 'plant_soon';
  } else if (sinceClose > 0 && sinceClose < untilOpen) {
    // We're after the window's close but the next opening is still
    // far away — better to tell the farmer they've missed it than to
    // suggest they wait for the next spring.
    recommendation = 'too_late';
  } else {
    recommendation = 'wait';
  }

  return {
    recommendation,
    inWindow,
    monthsUntilWindow: untilOpen,
    monthsSinceWindowClose: sinceClose,
  };
}
