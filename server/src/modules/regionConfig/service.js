/**
 * Region Configuration Service
 * Business rules, thresholds, defaults per country/region.
 * Includes crop calendars, storage recommendations, and market data.
 *
 * In-memory for now — can be moved to DB-backed RegionConfig model later.
 */

const regionDefaults = {
  KE: {
    country: 'Kenya',
    countryCode: 'KE',
    currencyCode: 'KES',
    currencySymbol: 'KSh',
    areaUnit: 'acres',
    defaultCrops: ['maize', 'wheat', 'tea', 'coffee', 'sugarcane', 'rice', 'beans', 'sorghum'],
    verificationThreshold: 70,
    maxLoanAmount: 5000000,
    minLoanAmount: 5000,
    fraudProximityDegrees: 0.001,
    languages: ['en', 'sw'],
    defaultLanguage: 'en',
    regions: ['Nakuru', 'Kiambu', 'Uasin Gishu', 'Trans Nzoia', 'Meru', 'Nyeri', 'Bungoma', 'Kakamega'],
    seasons: {
      long_rains: { months: [3, 4, 5], label: 'Long Rains (Mar-May)' },
      short_rains: { months: [10, 11], label: 'Short Rains (Oct-Nov)' },
      dry: { months: [1, 2, 6, 7, 8, 9, 12], label: 'Dry Season' },
    },
    cropCalendars: {
      maize: { plantMonths: [3, 4, 10], harvestMonths: [7, 8, 2], growingDays: 120 },
      wheat: { plantMonths: [6, 7], harvestMonths: [10, 11], growingDays: 120 },
      tea: { plantMonths: [3, 4], harvestMonths: null, growingDays: null },
      coffee: { plantMonths: [4, 5], harvestMonths: [10, 11, 12], growingDays: 270 },
      beans: { plantMonths: [3, 10], harvestMonths: [6, 1], growingDays: 90 },
      rice: { plantMonths: [3, 4], harvestMonths: [7, 8], growingDays: 120 },
    },
    storageDefaults: {
      maize: { method: 'hermetic_bag', maxDays: 180 },
      wheat: { method: 'silo', maxDays: 365 },
      coffee: { method: 'warehouse', maxDays: 365 },
      tea: { method: 'warehouse', maxDays: 180 },
      beans: { method: 'hermetic_bag', maxDays: 180 },
      rice: { method: 'hermetic_bag', maxDays: 365 },
    },
  },
  TZ: {
    country: 'Tanzania',
    countryCode: 'TZ',
    currencyCode: 'TZS',
    currencySymbol: 'TSh',
    areaUnit: 'hectares',
    defaultCrops: ['maize', 'rice', 'cashew', 'coffee', 'cotton', 'sisal', 'tobacco', 'tea'],
    verificationThreshold: 65,
    maxLoanAmount: 50000000,
    minLoanAmount: 50000,
    fraudProximityDegrees: 0.001,
    languages: ['en', 'sw'],
    defaultLanguage: 'sw',
    regions: ['Arusha', 'Dodoma', 'Dar es Salaam', 'Mbeya', 'Morogoro', 'Kilimanjaro', 'Iringa', 'Mwanza'],
    seasons: {
      masika: { months: [3, 4, 5], label: 'Masika / Long Rains (Mar-May)' },
      vuli: { months: [10, 11, 12], label: 'Vuli / Short Rains (Oct-Dec)' },
      dry: { months: [1, 2, 6, 7, 8, 9], label: 'Dry Season' },
    },
    cropCalendars: {
      maize: { plantMonths: [2, 3, 10], harvestMonths: [6, 7, 2], growingDays: 120 },
      rice: { plantMonths: [1, 2], harvestMonths: [5, 6], growingDays: 120 },
      cashew: { plantMonths: [11, 12], harvestMonths: [9, 10, 11], growingDays: 300 },
      coffee: { plantMonths: [3, 4], harvestMonths: [7, 8, 9], growingDays: 270 },
      cotton: { plantMonths: [12, 1], harvestMonths: [6, 7], growingDays: 180 },
      tobacco: { plantMonths: [9, 10], harvestMonths: [1, 2], growingDays: 120 },
    },
    storageDefaults: {
      maize: { method: 'hermetic_bag', maxDays: 180 },
      rice: { method: 'hermetic_bag', maxDays: 365 },
      cashew: { method: 'warehouse', maxDays: 365 },
      coffee: { method: 'warehouse', maxDays: 365 },
      cotton: { method: 'warehouse', maxDays: 365 },
      tobacco: { method: 'warehouse', maxDays: 180 },
    },
  },
};

export function getRegionConfig(countryCode) {
  return regionDefaults[countryCode?.toUpperCase()] || regionDefaults.KE;
}

export function listRegionConfigs() {
  return Object.entries(regionDefaults).map(([code, cfg]) => ({ code, ...cfg }));
}

export function getCountryCodes() {
  return Object.keys(regionDefaults);
}

export function getCropCalendar(countryCode, cropType) {
  const cfg = getRegionConfig(countryCode);
  return cfg.cropCalendars?.[cropType?.toLowerCase()] || null;
}

export function getCurrentSeason(countryCode) {
  const cfg = getRegionConfig(countryCode);
  const month = new Date().getMonth() + 1; // 1-12
  for (const [name, season] of Object.entries(cfg.seasons || {})) {
    if (season.months.includes(month)) {
      return { name, ...season };
    }
  }
  return { name: 'unknown', label: 'Unknown', months: [] };
}

export function getStorageDefault(countryCode, cropType) {
  const cfg = getRegionConfig(countryCode);
  return cfg.storageDefaults?.[cropType?.toLowerCase()] || { method: 'warehouse', maxDays: 90 };
}

export function getRegionsForCountry(countryCode) {
  const cfg = getRegionConfig(countryCode);
  return cfg.regions || [];
}

export function getCropsForCountry(countryCode) {
  const cfg = getRegionConfig(countryCode);
  return cfg.defaultCrops || [];
}
