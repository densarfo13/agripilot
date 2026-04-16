/**
 * Crop Recommendation Engine — lightweight, rule-based, explainable.
 *
 * Uses only existing land/context data to suggest crops.
 * No black-box AI. Every recommendation has an explicit reason.
 *
 * Input context (all optional):
 *   country    — "KE" | "TZ" | etc.
 *   region     — string (e.g. "Nakuru")
 *   season     — "long_rains" | "short_rains" | "masika" | "vuli" | "dry"
 *   farmSize   — number (acres)
 *   soilType   — string (e.g. "loam", "clay", "sandy")
 *   altitude   — number (meters)
 *   landType   — string (e.g. "irrigated", "rainfed", "wetland")
 *
 * Returns: { recommendations: [{ code, name, reason }], hasContext: boolean }
 */

import { getCropByCode } from './crops.js';
import { getCountryCropCodes, getRegionForCountry, getCropsForRegion } from '../data/cropRegionCatalog.js';

// ── Country display names (for recommendation reasons) ──────
const COUNTRY_NAMES = {
  KE: 'Kenya', TZ: 'Tanzania', UG: 'Uganda', NG: 'Nigeria', GH: 'Ghana',
  ET: 'Ethiopia', ZA: 'South Africa', ZM: 'Zambia', ZW: 'Zimbabwe',
  MW: 'Malawi', MZ: 'Mozambique', CM: 'Cameroon', RW: 'Rwanda',
  SN: 'Senegal', ML: 'Mali', CI: "Côte d'Ivoire", BF: 'Burkina Faso',
  NE: 'Niger', CD: 'DR Congo', BW: 'Botswana',
};

// ── Season-crop affinity ────────────────────────────────────
const SEASON_CROPS = {
  long_rains: ['MAIZE', 'BEAN', 'RICE', 'SORGHUM', 'GROUNDNUT', 'SWEET_POTATO', 'CASSAVA'],
  short_rains: ['BEAN', 'COWPEA', 'MAIZE', 'MILLET', 'GROUNDNUT'],
  masika: ['MAIZE', 'RICE', 'BEAN', 'CASSAVA', 'SWEET_POTATO', 'GROUNDNUT'],
  vuli: ['BEAN', 'COWPEA', 'MAIZE', 'MILLET', 'SORGHUM'],
  dry: ['SORGHUM', 'MILLET', 'COWPEA', 'CASSAVA', 'SWEET_POTATO'],
};

// ── Soil-crop affinity ──────────────────────────────────────
const SOIL_CROPS = {
  loam:      ['MAIZE', 'WHEAT', 'BEAN', 'COFFEE', 'TOMATO', 'CABBAGE'],
  clay:      ['RICE', 'SUGARCANE', 'BEAN', 'CABBAGE', 'SWEET_POTATO'],
  sandy:     ['GROUNDNUT', 'CASSAVA', 'COWPEA', 'WATERMELON', 'SWEET_POTATO', 'MILLET'],
  volcanic:  ['COFFEE', 'TEA', 'POTATO', 'MAIZE', 'BEAN'],
  alluvial:  ['RICE', 'SUGARCANE', 'BANANA', 'MAIZE', 'BEAN'],
  laterite:  ['CASSAVA', 'MANGO', 'GROUNDNUT', 'COWPEA'],
  black:     ['COTTON', 'SORGHUM', 'SUNFLOWER', 'WHEAT', 'MAIZE'],
};

// ── Land-type affinity ──────────────────────────────────────
const LAND_CROPS = {
  irrigated: ['RICE', 'SUGARCANE', 'TOMATO', 'ONION', 'CABBAGE', 'WHEAT'],
  rainfed:   ['MAIZE', 'SORGHUM', 'MILLET', 'BEAN', 'GROUNDNUT', 'CASSAVA'],
  wetland:   ['RICE', 'SUGARCANE', 'BANANA'],
  highland:  ['TEA', 'COFFEE', 'POTATO', 'WHEAT', 'BARLEY', 'PEA'],
  lowland:   ['RICE', 'MAIZE', 'CASSAVA', 'PALM_OIL', 'COCONUT', 'SUGARCANE'],
  arid:      ['SORGHUM', 'MILLET', 'COWPEA', 'GROUNDNUT', 'SESAME'],
};

// ── Farm-size heuristics ────────────────────────────────────
const SMALL_FARM_CROPS = ['MAIZE', 'BEAN', 'KALE', 'TOMATO', 'ONION', 'SWEET_POTATO', 'CASSAVA'];
const LARGE_FARM_CROPS = ['TEA', 'COFFEE', 'SUGARCANE', 'WHEAT', 'COTTON', 'SUNFLOWER', 'RICE'];

/**
 * Generate crop recommendations from available land context.
 *
 * @param {Object} ctx — context fields (all optional)
 * @returns {{ recommendations: Array<{code, name, reason}>, hasContext: boolean, contextUsed: string[] }}
 */
export function recommendCrops(ctx = {}) {
  const { country, region, season, farmSize, soilType, altitude, landType } = ctx;

  const contextUsed = [];
  const scores = new Map();

  function addCrops(codes, reason) {
    for (const code of codes) {
      if (!scores.has(code)) scores.set(code, new Set());
      scores.get(code).add(reason);
    }
  }

  // 1. Country (from catalog — supports all African countries)
  const cc = country?.toUpperCase();
  const countryCrops = cc ? getCountryCropCodes(cc) : [];
  if (countryCrops.length > 0) {
    addCrops(countryCrops, `Common in ${COUNTRY_NAMES[cc] || cc}`);
    contextUsed.push('country');
    // Also add regional crops with lower implicit weight (added once vs country crops)
    const regionKey = getRegionForCountry(cc);
    if (regionKey) {
      const regionalCodes = getCropsForRegion(regionKey).map(e => e.code).filter(c => !countryCrops.includes(c));
      if (regionalCodes.length > 0) {
        addCrops(regionalCodes, `Grown in the region`);
      }
    }
  }

  // 2. Season
  const seasonKey = season?.toLowerCase();
  if (seasonKey && SEASON_CROPS[seasonKey]) {
    const label = seasonKey.replace(/_/g, ' ');
    addCrops(SEASON_CROPS[seasonKey], `Suited to ${label} season`);
    contextUsed.push('season');
  }

  // 3. Soil type
  const soilKey = soilType?.toLowerCase();
  if (soilKey && SOIL_CROPS[soilKey]) {
    addCrops(SOIL_CROPS[soilKey], `Good for ${soilKey} soil`);
    contextUsed.push('soilType');
  }

  // 4. Land type
  const landKey = landType?.toLowerCase();
  if (landKey && LAND_CROPS[landKey]) {
    addCrops(LAND_CROPS[landKey], `Suited to ${landKey} land`);
    contextUsed.push('landType');
  }

  // 5. Farm size
  if (typeof farmSize === 'number' && farmSize > 0) {
    if (farmSize < 2) {
      addCrops(SMALL_FARM_CROPS, 'Good for small farms (<2 acres)');
    } else if (farmSize > 20) {
      addCrops(LARGE_FARM_CROPS, 'Viable at scale (>20 acres)');
    }
    contextUsed.push('farmSize');
  }

  // 6. Altitude
  if (typeof altitude === 'number' && altitude > 0) {
    if (altitude > 1500) {
      addCrops(['TEA', 'COFFEE', 'POTATO', 'WHEAT', 'BARLEY', 'PEA'], `Suited to highland (${altitude}m)`);
    } else if (altitude < 500) {
      addCrops(['RICE', 'COCONUT', 'PALM_OIL', 'CASSAVA', 'BANANA'], `Suited to lowland (${altitude}m)`);
    }
    contextUsed.push('altitude');
  }

  // 7. Learned crop usage (from server data passed via learnedCrops param)
  const learned = ctx.learnedCrops;
  if (Array.isArray(learned) && learned.length > 0) {
    for (const lc of learned) {
      if (lc.cropCode && lc.useCount >= 2) {
        addCrops([lc.cropCode], `Popular nearby (used ${lc.useCount}×)`);
      }
    }
    contextUsed.push('learnedCrops');
  }

  // 8. Last-used crop gets a bonus
  const lastCrop = ctx.lastCropCode;
  if (lastCrop) {
    addCrops([lastCrop], 'Your last crop');
    if (!contextUsed.includes('lastCrop')) contextUsed.push('lastCrop');
  }

  const hasContext = contextUsed.length > 0;

  if (!hasContext) {
    return { recommendations: [], hasContext: false, contextUsed: [] };
  }

  // Rank by number of matching reasons (more context matches = stronger recommendation)
  const ranked = [...scores.entries()]
    .map(([code, reasons]) => ({ code, reasons: [...reasons], score: reasons.size }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  const recommendations = ranked
    .map(({ code, reasons }) => {
      const crop = getCropByCode(code);
      // For custom crops (OTHER:Name) not in static list, build entry dynamically
      if (!crop && code.toUpperCase().startsWith('OTHER:')) {
        const name = code.slice(6).trim();
        return name ? { code, name, reason: reasons.join('; ') } : null;
      }
      if (!crop) return null;
      return { code: crop.code, name: crop.name, reason: reasons.join('; ') };
    })
    .filter(Boolean);

  return { recommendations, hasContext, contextUsed };
}

/**
 * Quick helper: get recommended crop codes for a country.
 * Now backed by the shared crop region catalog (supports all African countries).
 */
export function getCountryRecommendedCodes(countryCode) {
  return getCountryCropCodes(countryCode);
}
