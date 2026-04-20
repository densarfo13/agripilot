/**
 * plantingCalendar.js — pure resolver on top of the seasonal rules
 * config.
 *
 *   getPlantingStatus({ country, state, crop, now, plantSoonDays })
 *     → {
 *         status: 'in_season' | 'plant_soon' | 'off_season' | 'unknown',
 *         windows: [[startMonth, endMonth], ...],        // canonical rules used
 *         source:  'state' | 'country' | 'none',
 *         daysToNextWindow: number | null,               // null when in_season or unknown
 *       }
 *
 * `plant_soon` fires when the nearest upcoming window starts within
 * `plantSoonDays` (default 30). Everything else outside the window
 * is `off_season`. If the crop isn't in the calendar, status is
 * `unknown` and the UI falls back to a safe generic message.
 */

import { CALENDAR, CALENDAR_STATES } from '../../config/plantingCalendar.js';

const DEFAULT_PLANT_SOON_DAYS = 30;

function upper(v) { return v ? String(v).toUpperCase() : null; }
function lower(v) { return v ? String(v).toLowerCase() : null; }

/**
 * Find the per-crop rule, preferring state → country.
 * Returns `{ windows, source }` or null when unknown.
 */
function findRule({ country, state, crop }) {
  const c = upper(country);
  const s = upper(state);
  const cropKey = lower(crop);
  if (!c || !cropKey) return null;

  if (s && CALENDAR_STATES[c] && CALENDAR_STATES[c][s]) {
    const ruleByState = CALENDAR_STATES[c][s][cropKey];
    if (ruleByState && ruleByState.windows && ruleByState.windows.length > 0) {
      return { windows: ruleByState.windows, source: 'state' };
    }
  }
  if (CALENDAR[c] && CALENDAR[c][cropKey]) {
    const rule = CALENDAR[c][cropKey];
    if (rule.windows && rule.windows.length > 0) {
      return { windows: rule.windows, source: 'country' };
    }
  }
  return null;
}

/** Inclusive month-range check that supports wrap-around windows. */
function isMonthInWindow(month, [start, end]) {
  if (start <= end) return month >= start && month <= end;
  return month >= start || month <= end;     // wraps across year boundary
}

/**
 * daysUntilMonthStart — coarse distance (in whole days) between
 * `now` and the next occurrence of the 1st of `targetMonth`.
 * Returns 0 if we're already in that month.
 *
 * Used to compute the plant_soon window.
 */
function daysUntilMonthStart(now, targetMonth) {
  const d = now instanceof Date ? now : new Date(now);
  const year = d.getFullYear();
  const currentMonth = d.getMonth() + 1; // 1..12
  if (currentMonth === targetMonth) return 0;
  let targetYear = year;
  if (targetMonth < currentMonth
      || (targetMonth === currentMonth && d.getDate() > 1)) {
    // only move to next year when target month has already started
    if (targetMonth <= currentMonth) targetYear = year + 1;
  }
  const target = new Date(targetYear, targetMonth - 1, 1);
  const ms = target.getTime() - new Date(year, d.getMonth(), d.getDate()).getTime();
  return Math.max(0, Math.round(ms / 86400000));
}

export function getPlantingStatus({
  country, state, crop, now,
  plantSoonDays = DEFAULT_PLANT_SOON_DAYS,
} = {}) {
  const rule = findRule({ country, state, crop });
  if (!rule) {
    return Object.freeze({
      status: 'unknown', windows: [], source: 'none',
      daysToNextWindow: null,
    });
  }
  const d = now instanceof Date ? now : new Date(now || Date.now());
  const month = d.getMonth() + 1; // 1..12

  // In season?
  for (const w of rule.windows) {
    if (isMonthInWindow(month, w)) {
      return Object.freeze({
        status: 'in_season', windows: rule.windows, source: rule.source,
        daysToNextWindow: 0,
      });
    }
  }

  // Compute distance to the next upcoming window start.
  let minDays = null;
  for (const [start] of rule.windows) {
    const diff = daysUntilMonthStart(d, start);
    if (minDays == null || diff < minDays) minDays = diff;
  }

  if (minDays != null && minDays <= plantSoonDays) {
    return Object.freeze({
      status: 'plant_soon', windows: rule.windows, source: rule.source,
      daysToNextWindow: minDays,
    });
  }
  return Object.freeze({
    status: 'off_season', windows: rule.windows, source: rule.source,
    daysToNextWindow: minDays,
  });
}

export const _internal = Object.freeze({
  findRule, isMonthInWindow, daysUntilMonthStart, DEFAULT_PLANT_SOON_DAYS,
});
