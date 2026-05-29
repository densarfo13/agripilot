/**
 * runtime/grow/indoorPlantCare.js — Phase 9 indoor plant care.
 *
 *   import {
 *     composeIndoorCare, computeIndoorHealthScore,
 *     INDOOR_PLANT_CARE_VERSION,
 *   } from 'src/runtime/grow/indoorPlantCare.js';
 *
 *   composeIndoorCare({ plantId: 'monstera',
 *                       lastWateredAt, lastRepottedAt, ambient })
 *
 * What this is
 * ────────────
 *   Pure compute for houseplant care signals:
 *     • watering task     — overdue / due / not_yet
 *     • humidity advice   — bump_up / ok / reduce
 *     • sunlight advice   — move_to_brighter / move_to_shade / ok
 *     • repotting         — due / not_yet
 *
 *   Composes a 0-100 Indoor Health Score from the 4 signals,
 *   penalizing overdue watering + mismatched humidity.
 *
 *   Returns frozen envelope:
 *     {
 *       plantId, found, tasks, watering, humidityAdvice,
 *       sunlightAdvice, repottingAdvice, healthScore, healthBand,
 *       runtimeVersion,
 *     }
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • Composition-only — reads plant DB.
 *   • Returns 'unknown' band when input is thin.
 */

import { findPlant } from '../../data/plants/index.js';

export const INDOOR_PLANT_CARE_VERSION = 'indoor-plant-care-v1';

const _isObj = (v) => v != null && typeof v === 'object';
const _str   = (v) => (typeof v === 'string' ? v : '');
const _num   = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };

const MS_PER_DAY = 86400000;

function _daysSince(ts, nowMs) {
  const t = _safe(() => new Date(ts).getTime(), NaN);
  if (!Number.isFinite(t)) return null;
  return Math.floor((nowMs - t) / MS_PER_DAY);
}

function _wateringStatus(plant, lastWateredAt, nowMs) {
  const interval = _num(plant.wateringIntervalDays) || 7;
  const since = _daysSince(lastWateredAt, nowMs);
  if (since == null) return 'unknown';
  if (since > interval + 3) return 'overdue';
  if (since >= interval)    return 'due';
  return 'not_yet';
}

function _humidityAdvice(plant, ambientHumidity) {
  const want = _str(plant.humidity).toLowerCase();
  const have = _num(ambientHumidity);
  if (!want || have == null) return 'unknown';
  if (want === 'high' && have < 50) return 'bump_up';
  if (want === 'low'  && have > 70) return 'reduce';
  return 'ok';
}

function _sunlightAdvice(plant, lightLevel) {
  const want = _str(plant.sun).toLowerCase();
  const have = _str(lightLevel).toLowerCase();
  if (!want || !have) return 'unknown';
  if (want === 'indirect' && have === 'full')   return 'move_to_shade';
  if (want === 'low'      && have === 'full')   return 'move_to_shade';
  if (want === 'full'     && have === 'low')    return 'move_to_brighter';
  if (want === 'indirect' && have === 'low')    return 'move_to_brighter';
  return 'ok';
}

function _repottingAdvice(plant, lastRepottedAt, nowMs) {
  const interval = _num(plant.repottingIntervalDays) || 730;
  const since = _daysSince(lastRepottedAt, nowMs);
  if (since == null) return 'unknown';
  if (since >= interval) return 'due';
  return 'not_yet';
}

function _bandOf(score) {
  if (score >= 80) return 'thriving';
  if (score >= 60) return 'healthy';
  if (score >= 40) return 'fair';
  if (score >= 0)  return 'struggling';
  return 'unknown';
}

export function computeIndoorHealthScore(care) {
  return _safe(() => {
    if (!_isObj(care)) return 0;
    // Start at 100 and deduct
    let score = 100;
    if (care.watering === 'overdue') score -= 30;
    else if (care.watering === 'due') score -= 10;
    if (care.humidityAdvice === 'bump_up' || care.humidityAdvice === 'reduce')
      score -= 15;
    if (care.sunlightAdvice === 'move_to_brighter'
        || care.sunlightAdvice === 'move_to_shade') score -= 15;
    if (care.repottingAdvice === 'due') score -= 10;
    return Math.max(0, Math.min(100, Math.round(score)));
  }, 0);
}

export function composeIndoorCare(ctx) {
  return _safe(() => {
    const c     = _isObj(ctx) ? ctx : {};
    const plant = c.plant || (_str(c.plantId) ? findPlant(c.plantId) : null);
    if (!plant) {
      return Object.freeze({
        runtimeVersion: INDOOR_PLANT_CARE_VERSION,
        plantId: _str(c.plantId), found: false,
        tasks: Object.freeze([]),
        watering: 'unknown', humidityAdvice: 'unknown',
        sunlightAdvice: 'unknown', repottingAdvice: 'unknown',
        healthScore: 0, healthBand: 'unknown',
      });
    }
    const now    = _num(c.now) || Date.now();
    const ambient = _isObj(c.ambient) ? c.ambient : {};

    const watering        = _wateringStatus(plant, _str(c.lastWateredAt), now);
    const humidityAdvice  = _humidityAdvice(plant, ambient.humidity);
    const sunlightAdvice  = _sunlightAdvice(plant, ambient.lightLevel);
    const repottingAdvice = _repottingAdvice(plant, _str(c.lastRepottedAt), now);

    const tasks = [];
    if (watering === 'overdue') {
      tasks.push(Object.freeze({
        kind: 'water_overdue', priority: 1,
        labelKey: 'grow.indoor.task.waterOverdue',
        labelDefault: 'Water now — watering is overdue.',
      }));
    } else if (watering === 'due') {
      tasks.push(Object.freeze({
        kind: 'water_due', priority: 2,
        labelKey: 'grow.indoor.task.waterDue',
        labelDefault: 'Water today.',
      }));
    }
    if (humidityAdvice === 'bump_up') {
      tasks.push(Object.freeze({
        kind: 'humidity_low', priority: 3,
        labelKey: 'grow.indoor.task.humidityLow',
        labelDefault: 'Mist or move to a more humid spot.',
      }));
    }
    if (sunlightAdvice === 'move_to_brighter'
        || sunlightAdvice === 'move_to_shade') {
      tasks.push(Object.freeze({
        kind: 'light_mismatch', priority: 4,
        labelKey: 'grow.indoor.task.lightMismatch',
        labelDefault: sunlightAdvice === 'move_to_brighter'
          ? 'Move to a brighter spot.'
          : 'Move to a less direct light spot.',
      }));
    }
    if (repottingAdvice === 'due') {
      tasks.push(Object.freeze({
        kind: 'repot_due', priority: 5,
        labelKey: 'grow.indoor.task.repotDue',
        labelDefault: 'Time to repot.',
      }));
    }

    const care = { watering, humidityAdvice, sunlightAdvice, repottingAdvice };
    const healthScore = computeIndoorHealthScore(care);
    const healthBand  = _bandOf(healthScore);

    return Object.freeze({
      runtimeVersion: INDOOR_PLANT_CARE_VERSION,
      plantId: _str(plant.id), found: true,
      tasks: Object.freeze(tasks),
      watering, humidityAdvice, sunlightAdvice, repottingAdvice,
      healthScore, healthBand,
    });
  }, Object.freeze({
    runtimeVersion: INDOOR_PLANT_CARE_VERSION,
    plantId: '', found: false,
    tasks: Object.freeze([]),
    watering: 'unknown', humidityAdvice: 'unknown',
    sunlightAdvice: 'unknown', repottingAdvice: 'unknown',
    healthScore: 0, healthBand: 'unknown',
  }));
}
