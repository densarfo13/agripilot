/**
 * Crop Region Catalog — derived from structured data files.
 *
 * This file builds the same indexes and public API as before, but now
 * derives its data from:
 *   - crops.js          (master crop metadata)
 *   - regions.js        (region definitions)
 *   - cropRegionRules.js (per-crop per-country rules)
 *
 * Used by:
 *   - OnboardingWizard (top crop buttons grouped by country)
 *   - CropSelect (recommendation section)
 *   - NewFarmerRecommendation (country-aware suggestions)
 *   - cropRecommendations.js (getCountryRecommendedCodes)
 *   - seasonProfitRules.js (region lookup)
 *
 * Each derived catalog entry has:
 *   code, countries, regions, beginner, goals, priority
 *   + rich crop metadata from crops.js (category, difficulty, etc.)
 */

import { CROPS, getCrop } from './crops.js';
import { REGIONS as REGION_DEFS, getRegionForCountry } from './regions.js';
import { CROP_REGION_RULES, getRule as _getRule } from './cropRegionRules.js';

// Re-export REGIONS in the original shape for backward compatibility
export const REGIONS = Object.fromEntries(
  Object.entries(REGION_DEFS).map(([key, r]) => [
    key,
    { countries: r.countries, labelKey: r.labelKey },
  ])
);

// ─── Build catalog entries from cropRegionRules ────────────
// Group rules by crop code → aggregate countries, regions, etc.

function buildCatalog() {
  /** @type {Map<string, { countries: Set, regions: Set, beginner: boolean, goals: Set, priority: number }>} */
  const byCode = new Map();

  for (const rule of CROP_REGION_RULES) {
    if (!byCode.has(rule.crop)) {
      const crop = getCrop(rule.crop);
      byCode.set(rule.crop, {
        code: rule.crop,
        countries: new Set(),
        regions: new Set(),
        beginner: crop?.beginner ?? false,
        goals: new Set(),
        priority: 9,
        // Rich fields from crops.js
        category: crop?.category || 'other',
        difficulty: crop?.difficulty || 'moderate',
        defaultFoodFit: crop?.defaultFoodFit || 'low',
        defaultProfitFit: crop?.defaultProfitFit || 'low',
        emoji: crop?.emoji || '🌱',
      });
    }

    const entry = byCode.get(rule.crop);
    entry.countries.add(rule.country);

    // Determine region from rule or from country
    const regionKey = rule.region || getRegionForCountry(rule.country);
    if (regionKey) entry.regions.add(regionKey);

    // Merge goals
    if (rule.goals) {
      for (const g of rule.goals) entry.goals.add(g);
    }

    // Use the best (lowest) priority across all rules
    if (rule.priority != null && rule.priority < entry.priority) {
      entry.priority = rule.priority;
    }

    // If any country rule says beginnerGood, keep beginner true
    if (rule.beginnerGood) entry.beginner = true;
  }

  // Convert Sets to arrays and freeze
  return [...byCode.values()].map(e => ({
    code: e.code,
    countries: [...e.countries],
    regions: [...e.regions],
    beginner: e.beginner,
    goals: [...e.goals],
    priority: e.priority === 9 ? 3 : e.priority,
    category: e.category,
    difficulty: e.difficulty,
    defaultFoodFit: e.defaultFoodFit,
    defaultProfitFit: e.defaultProfitFit,
    emoji: e.emoji,
  }));
}

export const CROP_REGION_CATALOG = buildCatalog();

// ─── Build indexes for fast lookup ──────────────────────────

/** @type {Map<string, Object>} code → catalog entry */
const _byCode = new Map(CROP_REGION_CATALOG.map(c => [c.code, c]));

/** @type {Map<string, Object[]>} countryCode → entries sorted by priority */
const _byCountry = new Map();

for (const entry of CROP_REGION_CATALOG) {
  for (const cc of entry.countries) {
    if (!_byCountry.has(cc)) _byCountry.set(cc, []);
    _byCountry.get(cc).push(entry);
  }
}
// Sort each country's crops by priority then alphabetically
for (const [, entries] of _byCountry) {
  entries.sort((a, b) => a.priority - b.priority || a.code.localeCompare(b.code));
}

/** @type {Map<string, Object[]>} regionKey → catalog entries sorted by priority */
const _byRegion = new Map();
for (const entry of CROP_REGION_CATALOG) {
  for (const r of entry.regions) {
    if (!_byRegion.has(r)) _byRegion.set(r, []);
    _byRegion.get(r).push(entry);
  }
}
for (const [, entries] of _byRegion) {
  entries.sort((a, b) => a.priority - b.priority || a.code.localeCompare(b.code));
}

// ─── Public API (unchanged signatures) ──────────────────────

export function getCatalogEntry(code) {
  return _byCode.get(code) || null;
}

export function getCropsForCountry(countryCode) {
  if (!countryCode) return [];
  return _byCountry.get(countryCode.toUpperCase()) || [];
}

export function getCountryCropCodes(countryCode) {
  return getCropsForCountry(countryCode).map(e => e.code);
}

export function getCropsForRegion(regionKey) {
  return _byRegion.get(regionKey) || [];
}

// Re-export from regions.js for backward compatibility
export { getRegionForCountry } from './regions.js';

export function getLocalizedCropList(countryCode) {
  const seen = new Set();
  const local = [];
  const regional = [];
  const global = [];

  for (const entry of getCropsForCountry(countryCode)) {
    if (!seen.has(entry.code)) { seen.add(entry.code); local.push(entry); }
  }

  const region = getRegionForCountry(countryCode);
  if (region) {
    for (const entry of getCropsForRegion(region)) {
      if (!seen.has(entry.code)) { seen.add(entry.code); regional.push(entry); }
    }
  }

  for (const entry of CROP_REGION_CATALOG) {
    if (!seen.has(entry.code)) { seen.add(entry.code); global.push(entry); }
  }

  return { local, regional, global };
}

export function isCropLocalToCountry(cropCode, countryCode) {
  const entry = _byCode.get(cropCode);
  if (!entry || !countryCode) return false;
  return entry.countries.includes(countryCode.toUpperCase());
}

export function getBeginnerCropsForCountry(countryCode, goal) {
  let crops = getCropsForCountry(countryCode).filter(c => c.beginner);
  if (goal) {
    crops = crops.filter(c => c.goals.includes(goal));
  }
  return crops;
}

// ─── New API: access rich crop metadata ─────────────────────

/**
 * Get the crop-region rule with local overrides for food/profit fit.
 * @param {string} cropCode
 * @param {string} countryCode
 * @returns {{ foodFit, profitFit, beginnerGood, notes } | null}
 */
export function getLocalCropContext(cropCode, countryCode) {
  if (!cropCode || !countryCode) return null;
  const rule = _getRule(cropCode, countryCode);
  if (!rule) return null;
  return {
    foodFit: rule.foodFit,
    profitFit: rule.profitFit,
    beginnerGood: rule.beginnerGood,
    notes: rule.notes,
  };
}
