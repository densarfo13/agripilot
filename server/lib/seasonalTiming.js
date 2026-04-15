/**
 * Seasonal Timing — shared constants and helpers.
 *
 * Single source of truth for seasonal timing logic across
 * the server (routes, task engine, validation).
 */

/** Month names (1-indexed) for display */
export const MONTH_LABELS = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Short month labels for compact UI */
export const MONTH_SHORT = [
  '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/**
 * All seasonal timing fields stored on FarmProfile.
 * Used to whitelist allowed fields in PATCH endpoints.
 */
export const SEASONAL_FIELDS = [
  'seasonStartMonth',
  'seasonEndMonth',
  'plantingWindowStartMonth',
  'plantingWindowEndMonth',
  'currentSeasonLabel',
  'lastRainySeasonStart',
  'lastDrySeasonStart',
];

/**
 * Check if a month (1–12) falls within a month range.
 * Handles wrap-around (e.g., Nov–Mar).
 */
export function isMonthInRange(month, start, end) {
  if (start == null || end == null || month == null) return null;
  if (start <= end) {
    return month >= start && month <= end;
  }
  // Wraps around year boundary (e.g., Nov=11 to Mar=3)
  return month >= start || month <= end;
}

/**
 * Check if the current date is within the planting window.
 * Returns true/false or null if timing data is missing.
 */
export function isInPlantingWindow(timing, now = new Date()) {
  if (!timing) return null;
  const { plantingWindowStartMonth, plantingWindowEndMonth } = timing;
  if (plantingWindowStartMonth == null || plantingWindowEndMonth == null) return null;
  const currentMonth = now.getMonth() + 1; // JS months are 0-indexed
  return isMonthInRange(currentMonth, plantingWindowStartMonth, plantingWindowEndMonth);
}

/**
 * Check if the current date is within the active season.
 * Returns true/false or null if timing data is missing.
 */
export function isInSeason(timing, now = new Date()) {
  if (!timing) return null;
  const { seasonStartMonth, seasonEndMonth } = timing;
  if (seasonStartMonth == null || seasonEndMonth == null) return null;
  const currentMonth = now.getMonth() + 1;
  return isMonthInRange(currentMonth, seasonStartMonth, seasonEndMonth);
}

/**
 * Determine seasonal context for task generation.
 * Returns a structured object the task engine can use.
 */
export function getSeasonalContext(timing, now = new Date()) {
  const currentMonth = now.getMonth() + 1;
  const inPlantingWindow = isInPlantingWindow(timing, now);
  const inSeason = isInSeason(timing, now);
  const hasSeasonalData = timing &&
    (timing.seasonStartMonth != null || timing.plantingWindowStartMonth != null);

  return {
    currentMonth,
    inPlantingWindow,
    inSeason,
    hasSeasonalData: !!hasSeasonalData,
    seasonLabel: timing?.currentSeasonLabel || null,
  };
}

/**
 * Format a seasonal timing range for display.
 * e.g. "Mar – Jul" or "Nov – Mar"
 */
export function formatMonthRange(startMonth, endMonth) {
  if (startMonth == null || endMonth == null) return null;
  return `${MONTH_SHORT[startMonth]} – ${MONTH_SHORT[endMonth]}`;
}
