/**
 * cropStageEngine.js — Phase 10 crop-stage tracking.
 *
 *   import { deriveCropStage } from
 *     'src/runtime/farmIntelligence/cropStageEngine.js';
 *
 * What this is
 * ────────────
 *   Maps (cropName, plantingDate, now) → current stage envelope:
 *
 *     { stage, daysInStage, nextStage, expectedDaysToNext, totalDays }
 *
 *   Six canonical stages:
 *     seed → germination → vegetative → flowering →
 *     fruit_development → harvest
 *
 *   Per-crop durations are baked from agronomic averages. When the
 *   crop is unknown, falls back to a 'generic' profile so the UI
 *   still has SOMETHING calm to render.
 *
 * Strict-rule audit
 *   • Pure function. Never throws. SSR-safe.
 *   • No clock dependency beyond the caller-supplied `now` param;
 *     defaults to Date.now() when omitted.
 *   • Returns frozen envelope.
 */

const RUNTIME_VERSION = 'crop-stage-engine-v1';

export const CROP_STAGE = Object.freeze({
  SEED:              'seed',
  GERMINATION:       'germination',
  VEGETATIVE:        'vegetative',
  FLOWERING:         'flowering',
  FRUIT_DEVELOPMENT: 'fruit_development',
  HARVEST:           'harvest',
});

const STAGE_ORDER = Object.freeze([
  CROP_STAGE.SEED,
  CROP_STAGE.GERMINATION,
  CROP_STAGE.VEGETATIVE,
  CROP_STAGE.FLOWERING,
  CROP_STAGE.FRUIT_DEVELOPMENT,
  CROP_STAGE.HARVEST,
]);

// Per-crop stage durations in days. Numbers are agronomic averages
// and intentionally approximate — the engine never claims precision.
const CROP_PROFILES = Object.freeze({
  maize:    [3,  7, 35, 15, 30, 20],
  tomato:   [4,  7, 30, 14, 30, 25],
  pepper:   [5, 10, 40, 18, 32, 25],
  cassava:  [7, 14, 90, 45, 90, 60],
  rice:     [3,  9, 35, 20, 30, 15],
  wheat:    [4, 10, 40, 12, 28, 20],
  cucumber: [4,  6, 28, 12, 25, 18],
  lettuce:  [2,  5, 28, 10,  0, 15],
  rose:     [7, 14, 45, 25,  0, 30],
  generic:  [4,  8, 35, 18, 30, 25],
});

const DAY_MS = 24 * 60 * 60 * 1000;

const _isStr = (v) => typeof v === 'string' && v.length > 0;
const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };

function _profile(cropName) {
  if (!_isStr(cropName)) return CROP_PROFILES.generic;
  const key = cropName.toLowerCase();
  return CROP_PROFILES[key] || CROP_PROFILES.generic;
}

/**
 * @param {{
 *   cropName: string,
 *   plantingDate: string|number|Date,
 *   now?: number|Date,
 * }} input
 * @returns {Object} frozen envelope
 */
export function deriveCropStage(input) {
  const i = input && typeof input === 'object' ? input : {};
  const cropName = _isStr(i.cropName) ? i.cropName : null;
  const plantingTs = _safe(() => {
    if (i.plantingDate instanceof Date) return i.plantingDate.getTime();
    if (typeof i.plantingDate === 'number') return i.plantingDate;
    if (typeof i.plantingDate === 'string') {
      const d = new Date(i.plantingDate);
      return Number.isFinite(d.getTime()) ? d.getTime() : null;
    }
    return null;
  }, null);
  const nowTs = _safe(() => {
    if (i.now instanceof Date) return i.now.getTime();
    if (typeof i.now === 'number') return i.now;
    return Date.now();
  }, Date.now());

  if (plantingTs == null) {
    return Object.freeze({
      runtimeVersion: RUNTIME_VERSION,
      cropName, stage: null, daysInStage: null,
      nextStage: null, expectedDaysToNext: null,
      totalDays: null, healthy: false,
      reason: 'no_planting_date',
    });
  }

  const profile = _profile(cropName);
  const totalDays = Math.max(0, Math.floor((nowTs - plantingTs) / DAY_MS));
  let cumulative = 0;
  let stage = STAGE_ORDER[STAGE_ORDER.length - 1];
  let daysInStage = totalDays;
  let nextStage = null;
  let expectedDaysToNext = null;
  for (let i = 0; i < STAGE_ORDER.length; i += 1) {
    const dur = profile[i] || 0;
    if (totalDays < cumulative + dur || i === STAGE_ORDER.length - 1) {
      stage = STAGE_ORDER[i];
      daysInStage = Math.max(0, totalDays - cumulative);
      nextStage = i + 1 < STAGE_ORDER.length ? STAGE_ORDER[i + 1] : null;
      expectedDaysToNext = nextStage
        ? Math.max(0, (cumulative + dur) - totalDays)
        : null;
      break;
    }
    cumulative += dur;
  }

  return Object.freeze({
    runtimeVersion: RUNTIME_VERSION,
    cropName,
    stage,
    daysInStage,
    nextStage,
    expectedDaysToNext,
    totalDays,
    healthy: true,
  });
}

export { STAGE_ORDER, CROP_PROFILES };

export const _internal = Object.freeze({ _profile });
