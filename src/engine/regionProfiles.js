/**
 * Region Profiles — high-level agro-climatic buckets that modify how
 * generic tasks are phrased for a specific farmer context.
 *
 * V2 contract (spec §4): do NOT duplicate the app per country. Instead,
 * map country → region bucket, then let one profile modify task steps,
 * tips, timing, and risks.
 *
 * Six buckets cover the launch footprint:
 *   tropical_manual      — Sub-Saharan Africa, rain-fed, manual labour
 *   tropical_mixed       — Kenya / Tanzania / Uganda mixed-tool farms
 *   monsoon_mixed        — South / Southeast Asia monsoon systems
 *   dry_irrigated        — Sahel, Horn of Africa, irrigation-dependent
 *   temperate_mechanized — Europe / North America / Southern Africa commercial
 *   default              — safe fallback when no match
 *
 * Each profile stays intentionally small — enough to steer phrasing
 * without shipping per-country logic forks.
 */

// ─── Profile definitions ────────────────────────────────────
// Keep these descriptive but compact. `taskHints` maps a generic
// task.type → i18n key for a region-flavoured replacement title.

export const REGION_PROFILES = {
  tropical_manual: {
    id: 'tropical_manual',
    labelKey: 'region.tropicalManual',
    climateType: 'tropical',
    rainfallPattern: 'bimodal_or_unimodal',
    farmingStyle: 'manual',
    irrigationLevel: 'low',
    seasonality: 'rain_led',
    taskHints: {
      clear_field: 'cropTask.region.clearFieldManual',
      prepare_land: 'cropTask.region.prepareLandManualTropical',
      plant_seeds: 'cropTask.region.plantSeedsRainFed',
      monitor_water: 'cropTask.region.monitorWaterManual',
      weed_field: 'cropTask.region.weedFieldManual',
    },
  },

  tropical_mixed: {
    id: 'tropical_mixed',
    labelKey: 'region.tropicalMixed',
    climateType: 'tropical',
    rainfallPattern: 'bimodal',
    farmingStyle: 'mixed',
    irrigationLevel: 'partial',
    seasonality: 'rain_led',
    taskHints: {
      prepare_land: 'cropTask.region.prepareLandMixedTropical',
      apply_fertilizer: 'cropTask.region.applyFertilizerMixed',
    },
  },

  monsoon_mixed: {
    id: 'monsoon_mixed',
    labelKey: 'region.monsoonMixed',
    climateType: 'monsoon',
    rainfallPattern: 'monsoon',
    farmingStyle: 'mixed',
    irrigationLevel: 'partial',
    seasonality: 'monsoon_led',
    taskHints: {
      prepare_land: 'cropTask.region.prepareLandMonsoon',
      plant_seeds: 'cropTask.region.plantSeedsMonsoon',
      flood_field: 'cropTask.region.floodFieldMonsoon',
    },
  },

  dry_irrigated: {
    id: 'dry_irrigated',
    labelKey: 'region.dryIrrigated',
    climateType: 'arid',
    rainfallPattern: 'sparse',
    farmingStyle: 'mixed',
    irrigationLevel: 'essential',
    seasonality: 'irrigation_led',
    taskHints: {
      prepare_land: 'cropTask.region.prepareLandDry',
      water_after_planting: 'cropTask.region.waterAfterPlantingDry',
      monitor_water: 'cropTask.region.monitorWaterIrrigated',
    },
  },

  temperate_mechanized: {
    id: 'temperate_mechanized',
    labelKey: 'region.temperateMechanized',
    climateType: 'temperate',
    rainfallPattern: 'seasonal',
    farmingStyle: 'mechanized',
    irrigationLevel: 'partial',
    seasonality: 'calendar_led',
    taskHints: {
      prepare_land: 'cropTask.region.prepareLandMechanized',
      weed_field: 'cropTask.region.weedFieldMechanized',
    },
  },

  default: {
    id: 'default',
    labelKey: 'region.default',
    climateType: 'unknown',
    rainfallPattern: 'unknown',
    farmingStyle: 'mixed',
    irrigationLevel: 'partial',
    seasonality: 'rain_led',
    taskHints: {},
  },
};

// ─── Country → region mapping ──────────────────────────────
// Only enough coverage for the launch footprint. Unknown countries
// fall through to 'default' which keeps generic phrasing.

const COUNTRY_TO_REGION = {
  // West / Central Africa — mostly rain-fed, manual to mixed
  GH: 'tropical_manual', NG: 'tropical_manual', CI: 'tropical_manual',
  BF: 'tropical_manual', BJ: 'tropical_manual', TG: 'tropical_manual',
  SN: 'tropical_manual', ML: 'tropical_manual', CM: 'tropical_manual',
  LR: 'tropical_manual', SL: 'tropical_manual', GN: 'tropical_manual',

  // East Africa — mixed tools, bimodal rains
  KE: 'tropical_mixed', TZ: 'tropical_mixed', UG: 'tropical_mixed',
  RW: 'tropical_mixed', BI: 'tropical_mixed', ET: 'tropical_mixed',

  // Sahel / Horn — irrigation-dependent
  NE: 'dry_irrigated', TD: 'dry_irrigated', SD: 'dry_irrigated',
  SO: 'dry_irrigated', MR: 'dry_irrigated', ER: 'dry_irrigated',

  // Southern Africa — commercial + smallholder mix
  ZA: 'temperate_mechanized', ZM: 'tropical_mixed', ZW: 'tropical_mixed',
  MW: 'tropical_mixed', MZ: 'tropical_mixed',

  // Monsoon Asia
  IN: 'monsoon_mixed', BD: 'monsoon_mixed', PK: 'monsoon_mixed',
  LK: 'monsoon_mixed', MM: 'monsoon_mixed', TH: 'monsoon_mixed',
  VN: 'monsoon_mixed', ID: 'monsoon_mixed', PH: 'monsoon_mixed',

  // Temperate / mechanized
  US: 'temperate_mechanized', CA: 'temperate_mechanized',
  GB: 'temperate_mechanized', DE: 'temperate_mechanized',
  FR: 'temperate_mechanized', NL: 'temperate_mechanized',
  AU: 'temperate_mechanized', NZ: 'temperate_mechanized',
};

/**
 * Resolve a region profile from a country code / text.
 * Accepts ISO-2, ISO-3, or free-form country name as a defensive input.
 */
export function resolveRegionProfile(country) {
  if (!country) return REGION_PROFILES.default;
  const norm = String(country).trim().toUpperCase();
  // ISO-2 fast path
  if (COUNTRY_TO_REGION[norm]) return REGION_PROFILES[COUNTRY_TO_REGION[norm]];
  // ISO-3 best-effort — take first two letters
  if (norm.length === 3 && COUNTRY_TO_REGION[norm.slice(0, 2)]) {
    return REGION_PROFILES[COUNTRY_TO_REGION[norm.slice(0, 2)]];
  }
  return REGION_PROFILES.default;
}

/**
 * Return the region-flavoured titleKey for a given task type, or null
 * if no override is defined for this region (caller uses the base key).
 */
export function getRegionTaskHint(region, taskType) {
  if (!region || !taskType) return null;
  const profile = typeof region === 'string' ? REGION_PROFILES[region] : region;
  return profile?.taskHints?.[taskType] || null;
}

/**
 * Stable list of all region ids — useful for tests and dev assertions.
 */
export function listRegionIds() {
  return Object.keys(REGION_PROFILES);
}
