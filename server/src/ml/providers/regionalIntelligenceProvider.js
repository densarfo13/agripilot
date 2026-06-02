/**
 * regionalIntelligenceProvider.js — disease + pest + rainfall +
 * planting + harvest windows for the scan's GPS / region.
 *
 * Scan V3 §5. Composes:
 *   - Recent scanTrainingEvent rows for the same country/region
 *     to derive disease + pest PRESSURE (count of recent local
 *     reports / N-day window). Honest "unknown" when n<3.
 *   - Weather snapshot (Open-Meteo) for rainfall trend signal.
 *   - A small per-family planting/harvest window table when the
 *     country is known. Falls back to crop-stage rules.
 *
 * Pure async helper. Never throws.
 */

const _str = (v) => (typeof v === 'string' ? v : '');
const _arr = (v) => (Array.isArray(v) ? v : []);
const _num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);

const RECENT_DAYS = 30;
const RECENT_LIMIT = 200;
const MIN_LOCAL_SAMPLES = 3;

// Coarse Northern/Southern hemisphere planting windows per crop
// family. Conservative; the runtime returns a "window" object, not
// a hard date — UI explains it as a band, not a calendar pick.
const PLANTING_WINDOWS = Object.freeze({
  generic: {
    northern: { plantingMonths: [4, 5, 6],  harvestMonths: [8, 9, 10] },
    southern: { plantingMonths: [10, 11, 12], harvestMonths: [3, 4, 5] },
  },
  cereal: {
    northern: { plantingMonths: [4, 5],     harvestMonths: [9, 10] },
    southern: { plantingMonths: [10, 11],   harvestMonths: [4, 5] },
  },
  legume: {
    northern: { plantingMonths: [4, 5, 6],  harvestMonths: [8, 9] },
    southern: { plantingMonths: [10, 11, 12], harvestMonths: [2, 3, 4] },
  },
  leafy: {
    northern: { plantingMonths: [3, 4, 5, 8, 9],   harvestMonths: [5, 6, 7, 10, 11] },
    southern: { plantingMonths: [9, 10, 11, 2, 3], harvestMonths: [11, 12, 1, 4, 5] },
  },
  fruit: {
    northern: { plantingMonths: [3, 4, 5],  harvestMonths: [7, 8, 9, 10] },
    southern: { plantingMonths: [9, 10, 11], harvestMonths: [1, 2, 3, 4] },
  },
});

function _hemisphereFor(country) {
  // Conservative split — most African pilot countries are in the
  // Southern hemisphere band (south of equator) or straddle it.
  // Treat sub-Saharan as 'southern' by default; North America +
  // Europe + most of Asia as 'northern'.
  const c = _str(country).toLowerCase();
  const SOUTHERN = [
    'argentina', 'australia', 'bolivia', 'brazil', 'chile', 'ecuador',
    'fiji', 'indonesia', 'kenya', 'malawi', 'madagascar', 'mozambique',
    'namibia', 'new zealand', 'paraguay', 'peru', 'south africa',
    'tanzania', 'uganda', 'uruguay', 'zambia', 'zimbabwe', 'angola',
    'rwanda', 'botswana', 'lesotho',
  ];
  if (SOUTHERN.some((s) => c.includes(s))) return 'southern';
  return 'northern';
}

function _familyFor(crop) {
  const t = _str(crop).toLowerCase();
  if (/maize|corn|wheat|rice|barley|sorghum|millet|teff/.test(t)) return 'cereal';
  if (/bean|pea|cowpea|chickpea|lentil|soy|peanut|groundnut/.test(t)) return 'legume';
  if (/lettuce|spinach|kale|cabbage|chard|amaranth|moringa\s*leaf/.test(t)) return 'leafy';
  if (/tomato|pepper|okra|eggplant|squash|melon|cucumber|mango|banana|citrus|apple/.test(t)) return 'fruit';
  return 'generic';
}

function _pressureBand(count, samples) {
  if (samples < MIN_LOCAL_SAMPLES) return 'unknown';
  const rate = count / samples;
  if (rate >= 0.4) return 'high';
  if (rate >= 0.15) return 'medium';
  return 'low';
}

function _rainfallTrendFromWeather(weather) {
  if (!weather || typeof weather !== 'object') return null;
  // Single-snapshot trend is necessarily coarse — we report
  // {direction, mmNext24h} only when both fields are present.
  const mm = _num(weather.rainMmNext24h) ?? _num(weather.rainMmToday);
  if (mm == null) return null;
  const direction = mm >= 10 ? 'wet'
                  : mm >= 2  ? 'moderate'
                  : 'dry';
  return Object.freeze({ direction, mmNext24h: Math.round(mm * 10) / 10 });
}

function _formatWindow(window, hemisphere) {
  if (!window) return null;
  return Object.freeze({
    hemisphere,
    plantingMonths: Object.freeze(window.plantingMonths.slice()),
    harvestMonths:  Object.freeze(window.harvestMonths.slice()),
    monthLabel:     'months expressed 1=Jan..12=Dec',
  });
}

/**
 * @param {object} prisma
 * @param {object} input
 * @param {string} [input.country]
 * @param {string} [input.region]   coarse — state / province
 * @param {string} [input.district]
 * @param {number} [input.latitude]
 * @param {number} [input.longitude]
 * @param {string} [input.cropName]
 * @param {object} [input.weather]
 */
export async function getRegionalIntelligence(prisma, input = {}) {
  try {
    const country  = _str(input.country);
    const region   = _str(input.region);
    const district = _str(input.district);
    const lat      = _num(input.latitude);
    const lng      = _num(input.longitude);
    const cropName = _str(input.cropName);
    const family   = _familyFor(cropName);
    const hemi     = _hemisphereFor(country);
    const windowTable = PLANTING_WINDOWS[family] || PLANTING_WINDOWS.generic;
    const window = windowTable[hemi];

    // Pressure computation — read recent local scan rows.
    let diseasePressure = 'unknown';
    let pestPressure    = 'unknown';
    let samples         = 0;
    let diseaseCount    = 0;
    let pestCount       = 0;

    if (prisma && prisma.scanTrainingEvent && (country || region)) {
      try {
        const since = new Date(Date.now() - RECENT_DAYS * 24 * 3600 * 1000);
        const where = { createdAt: { gte: since } };
        if (country) where.country = country;
        if (region)  where.region  = region;
        const rows = await prisma.scanTrainingEvent.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: RECENT_LIMIT,
          select: { predictedIssue: true, weatherSummary: true },
        });
        samples = rows.length;
        for (const r of rows) {
          const issue = _str(r.predictedIssue).toLowerCase();
          if (issue && /spot|lesion|mildew|rust|blight|mold|wilt|yellow|discolor/.test(issue)) {
            diseaseCount++;
          }
          const ws = r.weatherSummary;
          const pest = ws && ws.pest;
          if (pest && pest.pestCategory && pest.pestCategory !== 'unknown') {
            pestCount++;
          }
        }
        diseasePressure = _pressureBand(diseaseCount, samples);
        pestPressure    = _pressureBand(pestCount,    samples);
      } catch { /* swallow — pressure stays 'unknown' */ }
    }

    return Object.freeze({
      ok: true,
      country: country || null,
      region:  region  || null,
      district: district || null,
      latitude: lat, longitude: lng,
      cropFamily: family,
      hemisphere: hemi,
      diseasePressure,
      pestPressure,
      rainfallTrend:   _rainfallTrendFromWeather(input.weather),
      plantingWindow:  _formatWindow(window, hemi),
      harvestWindow:   window ? Object.freeze({
        hemisphere: hemi,
        months:    Object.freeze(window.harvestMonths.slice()),
        monthLabel: 'months expressed 1=Jan..12=Dec',
      }) : null,
      sampleSize:     samples,
      confidence:     samples >= 10 ? 'high'
                      : samples >= MIN_LOCAL_SAMPLES ? 'medium' : 'low',
      v: 3,
      limitations: 'Decision support, not a guarantee.',
    });
  } catch (err) {
    return Object.freeze({
      ok: false, reason: 'exception',
      message: err && err.message,
      country: null, region: null, district: null,
      latitude: null, longitude: null,
      cropFamily: 'generic', hemisphere: 'northern',
      diseasePressure: 'unknown', pestPressure: 'unknown',
      rainfallTrend: null,
      plantingWindow: null, harvestWindow: null,
      sampleSize: 0, confidence: 'low', v: 3,
      limitations: 'Decision support, not a guarantee.',
    });
  }
}

export function regionalIntelligenceInfo() {
  return Object.freeze({
    name:             'regional-intelligence-engine',
    sourcesComposed:  Object.freeze(['scan_training_events', 'weather_snapshot', 'planting_window_table']),
    minSamples:       MIN_LOCAL_SAMPLES,
    recentDays:       RECENT_DAYS,
    families:         Object.freeze(Object.keys(PLANTING_WINDOWS)),
  });
}

export const _internal = Object.freeze({
  _familyFor, _hemisphereFor, _pressureBand,
  _rainfallTrendFromWeather, PLANTING_WINDOWS,
});

export default getRegionalIntelligence;
