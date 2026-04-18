/**
 * globalContext — one-stop localization surface for the decision engine.
 *
 * Thin aggregator over the three existing engine modules:
 *   • countryProfiles  (engine/countryProfiles.js)
 *   • cropCalendars    (engine/cropCalendar.js)
 *   • regionProfiles   (engine/regionProfiles.js)
 *
 * Adds:
 *   • TASK_REGIONAL_OVERRIDES — per-region steps/tips tweaks on a
 *     handful of task types where manual vs mechanized wording
 *     matters (spec §10).
 *   • resolveStageFromMonth    — month → stage using the spec's
 *     shorthand names (prepare / plant / early_growth / …).
 *   • getRegionModifier         — country → region profile.
 *   • resolveLocalizedCropContext — country + crop + month → context.
 *   • applyRegionOverrides      — layer step/tip overrides on a task.
 *   • buildLocalizedTask        — full pipeline, base task in →
 *     localized task out (with off-season fallback).
 *
 * Pure synchronous lookups — no fetch, no async, no heavy work.
 * Callers get deterministic results on every call.
 */

import { COUNTRY_PROFILES, getCountryProfile, getRegionForCountry } from '../../engine/countryProfiles.js';
import {
  resolveCropStage as _resolveCanonicalStage,
  getCropCalendar as _getCropCalendar,
  _internal as _calInternal,
} from '../../engine/cropCalendar.js';
import { REGION_PROFILES, resolveRegionProfile, getRegionTaskHint } from '../../engine/regionProfiles.js';

// Re-export the underlying registries so callers only need this one
// module path. Mutating them directly is not supported.
export { COUNTRY_PROFILES, REGION_PROFILES, getCountryProfile };
export const cropCalendars = _getCropCalendar;  // function-style accessor

// ─── Stage vocabulary ──────────────────────────────────────
// The spec uses short names (prepare / plant / …) for the calendar
// layer; the downstream decision engine expects the storage-form
// names (land_preparation / planting / germination / vegetative …).
// Both are kept one-to-one here so the right one is at hand.

export const STAGE_SHORT = Object.freeze({
  prepare: 'prepare',
  plant: 'plant',
  early_growth: 'early_growth',
  maintain: 'maintain',
  harvest: 'harvest',
  post_harvest: 'post_harvest',
  off_season: 'off_season',
});

const SHORT_TO_CANONICAL = Object.freeze({
  prepare: 'land_preparation',
  plant: 'planting',
  early_growth: 'germination',
  maintain: 'vegetative',
  harvest: 'harvest',
  post_harvest: 'post_harvest',
  off_season: 'planning',
});

const CANONICAL_TO_SHORT = Object.freeze({
  land_preparation: 'prepare',
  planting: 'plant',
  germination: 'early_growth',
  vegetative: 'maintain',
  flowering: 'maintain',
  fruiting: 'maintain',
  harvest: 'harvest',
  post_harvest: 'post_harvest',
  planning: 'off_season',
});

export function toCanonicalStage(short) {
  return SHORT_TO_CANONICAL[short] || short || 'planning';
}

export function toShortStage(canonical) {
  return CANONICAL_TO_SHORT[canonical] || canonical || 'off_season';
}

// ─── Regional steps/tips overrides ─────────────────────────
// Title overrides already live in regionProfiles.taskHints. This
// table adds the finer step/tip overrides — only set an entry where
// manual-vs-mechanized matters (spec §10). Anything not listed falls
// through to the base task.

export const TASK_REGIONAL_OVERRIDES = Object.freeze({
  tropical_manual: {
    clear_field: {
      stepsKey: 'region.steps.clearField.manual',
      tipKey: 'region.tip.clearField.manual',
    },
    prepare_land: {
      stepsKey: 'region.steps.prepareLand.manual',
      tipKey: 'region.tip.prepareLand.manual',
    },
  },
  tropical_mixed: {
    prepare_land: {
      stepsKey: 'region.steps.prepareLand.mixed',
    },
  },
  monsoon_mixed: {
    prepare_land: {
      stepsKey: 'region.steps.prepareLand.monsoon',
      tipKey: 'region.tip.prepareLand.monsoon',
    },
    plant_seeds: {
      tipKey: 'region.tip.plantSeeds.monsoon',
    },
  },
  temperate_mechanized: {
    clear_field: {
      stepsKey: 'region.steps.clearField.mechanized',
      tipKey: 'region.tip.clearField.mechanized',
    },
    prepare_land: {
      stepsKey: 'region.steps.prepareLand.mechanized',
      tipKey: 'region.tip.prepareLand.mechanized',
    },
    plant_seeds: {
      stepsKey: 'region.steps.plantSeeds.mechanized',
    },
    weed_field: {
      tipKey: 'region.tip.weedField.mechanized',
    },
  },
  dry_irrigated: {
    prepare_land: {
      stepsKey: 'region.steps.prepareLand.dry',
    },
    water_after_planting: {
      tipKey: 'region.tip.waterAfterPlanting.dry',
    },
  },
});

// ─── Helpers ──────────────────────────────────────────────

function isDev() {
  try { if (typeof import.meta !== 'undefined') return !!import.meta.env?.DEV; } catch { /* ignore */ }
  return typeof process !== 'undefined' && process.env.NODE_ENV !== 'production';
}

function currentMonthNumber(date = new Date()) {
  return date.getMonth() + 1;
}

// ─── Public API ───────────────────────────────────────────

/**
 * Spec §2: month (or Date) + calendar → short stage name.
 * Accepts a full calendar object (landPreparation / planting / …) so
 * callers can pass any source, not just the built-in registry.
 */
export function resolveStageFromMonth(calendar, month) {
  if (!calendar || typeof calendar !== 'object') return STAGE_SHORT.off_season;
  const m = month instanceof Date
    ? currentMonthNumber(month)
    : (Number.isFinite(month) ? Math.max(1, Math.min(12, Math.round(month))) : currentMonthNumber());

  const order = ['landPreparation', 'planting', 'earlyGrowth', 'maintain', 'harvest', 'postHarvest'];
  for (const key of order) {
    if (Array.isArray(calendar[key]) && calendar[key].includes(m)) {
      switch (key) {
        case 'landPreparation': return STAGE_SHORT.prepare;
        case 'planting':        return STAGE_SHORT.plant;
        case 'earlyGrowth':     return STAGE_SHORT.early_growth;
        case 'maintain':        return STAGE_SHORT.maintain;
        case 'harvest':         return STAGE_SHORT.harvest;
        case 'postHarvest':     return STAGE_SHORT.post_harvest;
        default:                return STAGE_SHORT.off_season;
      }
    }
  }
  return STAGE_SHORT.off_season;
}

/**
 * Spec §3: country → region profile (the same object regionProfiles.js
 * returns, including the taskHints map the decision engine already
 * consumes).
 */
export function getRegionModifier(countryCode) {
  if (!countryCode) return REGION_PROFILES.default;
  return getRegionForCountry(countryCode) || resolveRegionProfile(countryCode);
}

/**
 * Spec §4: full localized context for a country + crop + month.
 */
export function resolveLocalizedCropContext({ countryCode, cropId, month } = {}) {
  if (isDev() && !countryCode) console.warn('[globalContext] missing countryCode');
  if (isDev() && !cropId) console.warn('[globalContext] missing cropId');

  const country = getCountryProfile(countryCode);
  const region = getRegionModifier(countryCode);
  const calendar = _getCropCalendar(countryCode, cropId);
  const stage = calendar
    ? resolveStageFromMonth(calendar, month)
    : (countryCode && cropId && isDev()
        ? (console.warn(`[globalContext] no calendar for ${countryCode} / ${cropId}`), STAGE_SHORT.off_season)
        : STAGE_SHORT.off_season);

  return {
    country,
    countryCode: country?.countryCode || null,
    regionBucket: region?.id || 'default',
    region,
    stage,
    canonicalStage: toCanonicalStage(stage),
    month: month instanceof Date ? currentMonthNumber(month) : (month || currentMonthNumber()),
  };
}

/**
 * Spec §5: apply region-specific step/tip overrides on top of a task.
 * Returns a new task (never mutates). Unknown regions or task types
 * pass the base task through unchanged.
 */
export function applyRegionOverrides(task, countryCode) {
  if (!task) return task;
  const region = getRegionModifier(countryCode);
  if (!region) return task;

  const bucketOverrides = TASK_REGIONAL_OVERRIDES[region.id];
  const typeOverride = bucketOverrides?.[task.type];

  // Region-level title hint (from regionProfiles.taskHints) can also
  // land here so the full override surface is one field layer.
  const titleHint = getRegionTaskHint(region, task.type);

  const localized = {
    ...task,
    regionBucket: region.id,
    regionOverridesApplied: false,
  };
  if (titleHint) {
    localized.titleKey = titleHint;
    localized.regionHinted = true;
    localized.regionOverridesApplied = true;
  }
  if (typeOverride?.stepsKey) {
    localized.stepsKey = typeOverride.stepsKey;
    localized.regionOverridesApplied = true;
  }
  if (typeOverride?.tipKey) {
    localized.tipsKey = typeOverride.tipKey;
    localized.regionOverridesApplied = true;
  }
  return localized;
}

/**
 * Spec §6: full pipeline — base task goes in, final localized task
 * comes out. When no calendar data exists or the current month is
 * off-season, returns the off-season "Plan your next crop" fallback.
 */
export function buildLocalizedTask({ countryCode, cropId, month, baseTask } = {}) {
  const ctx = resolveLocalizedCropContext({ countryCode, cropId, month });

  if (ctx.stage === STAGE_SHORT.off_season) {
    return {
      type: 'off_season_planning',
      titleKey: 'offSeason.title',
      whyKey: 'offSeason.why',
      ctaKey: 'offSeason.cta',
      urgency: 'optional',
      priority: 'low',
      icon: '\uD83D\uDCC5',
      iconBg: 'rgba(255,255,255,0.05)',
      stage: ctx.stage,
      regionBucket: ctx.regionBucket,
      country: ctx.countryCode,
      isOffSeason: true,
    };
  }

  if (!baseTask) {
    if (isDev()) console.warn('[globalContext] buildLocalizedTask called without baseTask');
    return {
      stage: ctx.stage,
      regionBucket: ctx.regionBucket,
      country: ctx.countryCode,
    };
  }

  const localized = applyRegionOverrides(baseTask, countryCode);
  return {
    ...localized,
    stage: ctx.stage,
    canonicalStage: ctx.canonicalStage,
    regionBucket: ctx.regionBucket,
    country: ctx.countryCode,
  };
}

export const _internal = { SHORT_TO_CANONICAL, CANONICAL_TO_SHORT, currentMonthNumber, _calInternal };
