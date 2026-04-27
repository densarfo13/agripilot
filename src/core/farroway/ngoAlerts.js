/**
 * ngoAlerts.js — Farroway core NGO alert engine (spec section 8).
 *
 * Pure function over a list of farm records. Returns a flat array
 * of alert objects:
 *
 *   { type: 'LOW_ACTIVITY', farm: <farmId> }
 *   { type: 'READY_TO_SELL', farm: <farmId> }
 *
 * Local-first: the only side input is the local progress log
 * (farroway_progress). No backend read, no auth, no network.
 *
 * Strict rules respected:
 *   * never crashes on missing / non-array input
 *   * never crashes on a farm record without an id
 */

import { getProgress } from './progressStore.js';

export const ALERT_TYPE = Object.freeze({
  LOW_ACTIVITY:  'LOW_ACTIVITY',
  READY_TO_SELL: 'READY_TO_SELL',
});

const LOW_ACTIVITY_THRESHOLD = 2;

export function generateAlerts(farms) {
  if (!Array.isArray(farms) || farms.length === 0) return [];

  // Read the progress log once - the engine is currently single-
  // farmer (one farroway_progress key per device). When the data
  // model grows to per-farm progress, swap this read inside the
  // map() call.
  const progress = getProgress();
  const completedCount = Array.isArray(progress.done) ? progress.done.length : 0;

  const out = [];
  for (const f of farms) {
    if (!f || typeof f !== 'object') continue;
    const farmId = f.id != null ? f.id : null;

    if (completedCount < LOW_ACTIVITY_THRESHOLD) {
      out.push({ type: ALERT_TYPE.LOW_ACTIVITY, farm: farmId });
    }
    if (f.readyToSell) {
      out.push({ type: ALERT_TYPE.READY_TO_SELL, farm: farmId });
    }
  }
  return out;
}
