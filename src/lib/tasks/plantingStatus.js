/**
 * plantingStatus.js — infer the high-level planting status of a
 * farm from whatever signals are available in onboarding + profile.
 *
 *   inferPlantingStatus({
 *     cropStage,         // server-known stage, if any (e.g. 'planting')
 *     plantingStatus,    // explicit override — always wins
 *     plantedAt,         // epoch ms / ISO / Date when the crop was planted
 *     calendarStatus,    // from planting decision ('in_season' etc.)
 *     country, state, crop, now,  // used only for the calendar fallback
 *   }) → 'not_started' | 'planted' | 'growing' | 'near_harvest'
 *
 * Priority:
 *   1. Explicit `plantingStatus` from the caller.
 *   2. `cropStage` mapped to one of the 4 buckets.
 *   3. `plantedAt` + time-since-planting bucketing:
 *        0d..7d    → 'planted'
 *        8d..120d  → 'growing'
 *        >120d     → 'near_harvest'
 *   4. Calendar signal (in_season → 'planted', plant_soon / off_season /
 *      unknown → 'not_started').
 *   5. Default fallback → 'not_started'.
 *
 * Pure + deterministic. No IO.
 */

import { getPlantingStatus as getCalendar }
  from '../recommendations/plantingCalendar.js';

export const PLANTING_STATUSES = Object.freeze([
  'not_started', 'planted', 'growing', 'near_harvest',
]);

const STATUS_SET = new Set(PLANTING_STATUSES);

// Map every stage the app uses anywhere onto the 4 high-level buckets.
const STAGE_TO_STATUS = Object.freeze({
  // Spec §3 stages
  pre_planting:  'not_started',
  planting:      'planted',
  early_growth:  'growing',
  mid_growth:    'growing',
  harvest:       'near_harvest',
  post_harvest:  'not_started',
  // Legacy taskEngine / cropCycle stages
  land_prep:     'not_started',
  maintain:      'growing',
  germination:   'growing',
  vegetative:    'growing',
  flowering:     'near_harvest',
  fruiting:      'near_harvest',
  harvest_ready: 'near_harvest',
  planning:      'not_started',
  land_preparation: 'not_started',
});

function toMs(x) {
  if (x == null) return null;
  if (x instanceof Date) return x.getTime();
  const n = Number(x);
  if (Number.isFinite(n)) return n;
  const parsed = Date.parse(String(x));
  return Number.isFinite(parsed) ? parsed : null;
}

export function inferPlantingStatus({
  plantingStatus = null,
  cropStage = null,
  plantedAt = null,
  calendarStatus = null,
  country = null,
  state = null,
  crop = null,
  now = null,
} = {}) {
  // 1. Explicit override wins.
  if (plantingStatus && STATUS_SET.has(plantingStatus)) return plantingStatus;

  // 2. Known stage → bucket.
  if (cropStage) {
    const key = String(cropStage).toLowerCase();
    if (STAGE_TO_STATUS[key]) return STAGE_TO_STATUS[key];
  }

  // 3. Time-since-planting.
  const plantedTs = toMs(plantedAt);
  if (plantedTs != null) {
    const nowTs = toMs(now) || Date.now();
    const days = Math.max(0, Math.floor((nowTs - plantedTs) / 86400000));
    if (days <= 7)        return 'planted';
    if (days <= 120)      return 'growing';
    return 'near_harvest';
  }

  // 4. Calendar signal fallback.
  let cal = calendarStatus;
  if (!cal && crop && country) {
    try {
      cal = getCalendar({ country, state, crop, now }).status;
    } catch { cal = null; }
  }
  if (cal === 'in_season') return 'planted';

  // 5. Default safe fallback.
  return 'not_started';
}

export const _internal = Object.freeze({ STAGE_TO_STATUS, toMs });
