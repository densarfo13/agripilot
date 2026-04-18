/**
 * Market Data Service — crop price signals for farmer guidance.
 *
 * Provides directional price signals (rising / stable / falling) per crop
 * per country. These are NOT exact prices — they're seasonal trend indicators
 * designed to help farmers make better planting and selling decisions.
 *
 * Current data: static seed signals based on known seasonal price patterns.
 * These represent typical market behavior, not real-time prices.
 *
 * Future: replace seed data with live feeds from:
 *   - FAO GIEWS food price data
 *   - WFP VAM food prices
 *   - National commodity exchange APIs (Ghana Commodities Exchange, etc.)
 *   - USDA Market News (for US crops)
 *
 * Data shape per signal:
 *   {
 *     cropCode: string,           — matches crops.js key
 *     trend: 'rising'|'stable'|'falling',
 *     confidence: 'low'|'medium', — how reliable is this signal
 *     season: string,             — which season this trend applies to
 *     noteKey: string,            — i18n key for a short explanation
 *     source: 'seasonal_pattern', — data source identifier
 *   }
 *
 * IMPORTANT: Wording is intentionally neutral. We say "prices trending up"
 * not "you will make profit". Farming has risks — never promise income.
 */

// ─── Currency defaults per country ──────────────────────────
const COUNTRY_CURRENCY = {
  GH: 'GHS',
  KE: 'KES',
  NG: 'NGN',
  TZ: 'TZS',
  UG: 'UGX',
  ET: 'ETB',
  US: 'USD',
  ZA: 'ZAR',
  CM: 'XAF',
  CI: 'XOF',
  SN: 'XOF',
};

/**
 * Get currency code for a country. Falls back to USD.
 * @param {string} countryCode
 * @returns {string}
 */
export function getCurrencyForCountry(countryCode) {
  return COUNTRY_CURRENCY[(countryCode || '').toUpperCase()] || 'USD';
}

// ─── Seasonal price signal seed data ────────────────────────
// Based on known seasonal patterns. Trend indicates direction
// relative to the typical annual average for that crop/country.
//
// Month ranges (0-indexed): used to determine which signal applies now.
// If current month falls within a signal's months, it's active.

const PRICE_SIGNALS = [
  // ═══════════════════════════════════════════════════════════
  // GHANA (GH)
  // ═══════════════════════════════════════════════════════════

  // Maize: lean season prices rise (Jun-Aug before major harvest)
  { cropCode: 'MAIZE',    country: 'GH', trend: 'rising',  months: [5, 6, 7],       confidence: 'medium', season: 'lean',    noteKey: 'market.note.leanSeasonRise' },
  { cropCode: 'MAIZE',    country: 'GH', trend: 'falling', months: [8, 9, 10],      confidence: 'medium', season: 'harvest', noteKey: 'market.note.harvestGlut' },
  { cropCode: 'MAIZE',    country: 'GH', trend: 'stable',  months: [0, 1, 2, 3, 4, 11], confidence: 'low', season: 'off', noteKey: 'market.note.stablePrices' },

  // Tomato: extreme seasonal swings in Ghana
  { cropCode: 'TOMATO',   country: 'GH', trend: 'rising',  months: [3, 4, 5],       confidence: 'medium', season: 'lean',    noteKey: 'market.note.shortageRise' },
  { cropCode: 'TOMATO',   country: 'GH', trend: 'falling', months: [7, 8, 9],       confidence: 'medium', season: 'harvest', noteKey: 'market.note.harvestGlut' },

  // Rice: imported rice sets baseline; local premium when available
  { cropCode: 'RICE',     country: 'GH', trend: 'stable',  months: [0,1,2,3,4,5,6,7,8,9,10,11], confidence: 'medium', season: 'year-round', noteKey: 'market.note.importBaseline' },

  // Cassava: stable food staple, mild seasonal variation
  { cropCode: 'CASSAVA',  country: 'GH', trend: 'rising',  months: [2, 3, 4],       confidence: 'low',    season: 'lean',    noteKey: 'market.note.leanSeasonRise' },
  { cropCode: 'CASSAVA',  country: 'GH', trend: 'stable',  months: [0,1,5,6,7,8,9,10,11], confidence: 'low', season: 'normal', noteKey: 'market.note.stapleDemand' },

  // Cocoa: follows global commodity markets
  { cropCode: 'COCOA',    country: 'GH', trend: 'rising',  months: [0, 1, 2, 3],    confidence: 'low',    season: 'post-harvest', noteKey: 'market.note.exportDemand' },
  { cropCode: 'COCOA',    country: 'GH', trend: 'stable',  months: [4,5,6,7,8,9,10,11], confidence: 'low', season: 'normal', noteKey: 'market.note.regulatedPrice' },

  // Onion: dry season crop, prices peak in rainy season
  { cropCode: 'ONION',    country: 'GH', trend: 'rising',  months: [5, 6, 7, 8],    confidence: 'medium', season: 'rainy',   noteKey: 'market.note.seasonalShortage' },

  // Pepper: steady demand, mild lean season rise
  { cropCode: 'PEPPER',   country: 'GH', trend: 'rising',  months: [3, 4, 5],       confidence: 'low',    season: 'lean',    noteKey: 'market.note.leanSeasonRise' },

  // Watermelon: profitable in dry season
  { cropCode: 'WATERMELON', country: 'GH', trend: 'rising', months: [11, 0, 1, 2], confidence: 'medium', season: 'dry', noteKey: 'market.note.drySeasonDemand' },

  // Ginger: export demand rising
  { cropCode: 'GINGER',   country: 'GH', trend: 'rising',  months: [0,1,2,3,4,5,6,7,8,9,10,11], confidence: 'low', season: 'year-round', noteKey: 'market.note.exportDemand' },

  // ═══════════════════════════════════════════════════════════
  // KENYA (KE)
  // ═══════════════════════════════════════════════════════════

  // Maize: lean season price spike typical
  { cropCode: 'MAIZE',    country: 'KE', trend: 'rising',  months: [3, 4, 5, 6],    confidence: 'medium', season: 'lean',    noteKey: 'market.note.leanSeasonRise' },
  { cropCode: 'MAIZE',    country: 'KE', trend: 'falling', months: [7, 8, 9, 10],   confidence: 'medium', season: 'harvest', noteKey: 'market.note.harvestGlut' },

  // Tomato: price spikes during long rains (gluts post-harvest)
  { cropCode: 'TOMATO',   country: 'KE', trend: 'rising',  months: [4, 5, 6],       confidence: 'medium', season: 'long_rains', noteKey: 'market.note.shortageRise' },
  { cropCode: 'TOMATO',   country: 'KE', trend: 'falling', months: [1, 2, 3],       confidence: 'medium', season: 'post-harvest', noteKey: 'market.note.harvestGlut' },

  // Potato: highland harvest drives prices
  { cropCode: 'POTATO',   country: 'KE', trend: 'rising',  months: [3, 4, 5],       confidence: 'medium', season: 'lean',    noteKey: 'market.note.leanSeasonRise' },
  { cropCode: 'POTATO',   country: 'KE', trend: 'falling', months: [7, 8],          confidence: 'medium', season: 'harvest', noteKey: 'market.note.harvestGlut' },

  // Kale (Sukuma wiki): stable staple, slight lean season rise
  { cropCode: 'KALE',     country: 'KE', trend: 'stable',  months: [0,1,2,3,4,5,6,7,8,9,10,11], confidence: 'medium', season: 'year-round', noteKey: 'market.note.stapleDemand' },

  // Coffee: premium Arabica, global price linked
  { cropCode: 'COFFEE',   country: 'KE', trend: 'rising',  months: [0, 1, 2],       confidence: 'low',    season: 'auction', noteKey: 'market.note.exportDemand' },

  // Tea: steady, but factory prices fluctuate
  { cropCode: 'TEA',      country: 'KE', trend: 'stable',  months: [0,1,2,3,4,5,6,7,8,9,10,11], confidence: 'low', season: 'year-round', noteKey: 'market.note.regulatedPrice' },

  // Avocado: export boom
  { cropCode: 'AVOCADO',  country: 'KE', trend: 'rising',  months: [2, 3, 4, 5, 6], confidence: 'medium', season: 'export', noteKey: 'market.note.exportDemand' },

  // Mango: seasonal glut then scarcity
  { cropCode: 'MANGO',    country: 'KE', trend: 'falling', months: [11, 0, 1],      confidence: 'medium', season: 'harvest', noteKey: 'market.note.harvestGlut' },
  { cropCode: 'MANGO',    country: 'KE', trend: 'rising',  months: [5, 6, 7, 8],    confidence: 'medium', season: 'off',     noteKey: 'market.note.seasonalShortage' },

  // Onion: import-dependent, local prices higher
  { cropCode: 'ONION',    country: 'KE', trend: 'rising',  months: [4, 5, 6],       confidence: 'low',    season: 'lean',    noteKey: 'market.note.seasonalShortage' },

  // Watermelon: dry area crop, urban demand rising
  { cropCode: 'WATERMELON', country: 'KE', trend: 'rising', months: [11, 0, 1, 2], confidence: 'low', season: 'dry', noteKey: 'market.note.drySeasonDemand' },

  // Bean: lean season spike
  { cropCode: 'BEAN',     country: 'KE', trend: 'rising',  months: [3, 4, 5],       confidence: 'medium', season: 'lean',    noteKey: 'market.note.leanSeasonRise' },

  // ═══════════════════════════════════════════════════════════
  // UNITED STATES — Maryland / Mid-Atlantic (US)
  // ═══════════════════════════════════════════════════════════

  // Tomato: farmers market premium in-season
  { cropCode: 'TOMATO',   country: 'US', trend: 'rising',  months: [5, 6],          confidence: 'low',    season: 'early',   noteKey: 'market.note.earlySeasonPremium' },
  { cropCode: 'TOMATO',   country: 'US', trend: 'falling', months: [7, 8, 9],       confidence: 'low',    season: 'peak',    noteKey: 'market.note.peakSupply' },

  // Strawberry: U-pick and farmers market premium
  { cropCode: 'STRAWBERRY', country: 'US', trend: 'rising', months: [4, 5],        confidence: 'medium', season: 'spring',  noteKey: 'market.note.earlySeasonPremium' },

  // Watermelon: July-Aug peak demand
  { cropCode: 'WATERMELON', country: 'US', trend: 'rising', months: [6, 7],        confidence: 'low',    season: 'summer',  noteKey: 'market.note.seasonalDemand' },

  // Sweet corn: peak summer demand at stands
  { cropCode: 'SWEET_CORN', country: 'US', trend: 'rising', months: [6, 7],        confidence: 'low',    season: 'summer',  noteKey: 'market.note.seasonalDemand' },

  // Garlic: specialty market premium
  { cropCode: 'GARLIC',   country: 'US', trend: 'stable',  months: [0,1,2,3,4,5,6,7,8,9,10,11], confidence: 'medium', season: 'year-round', noteKey: 'market.note.specialtyPremium' },

  // Lettuce/greens: spring and fall farmers market
  { cropCode: 'LETTUCE',  country: 'US', trend: 'rising',  months: [3, 4, 5],       confidence: 'low',    season: 'spring',  noteKey: 'market.note.earlySeasonPremium' },
  { cropCode: 'KALE',     country: 'US', trend: 'rising',  months: [9, 10, 11],     confidence: 'low',    season: 'fall',    noteKey: 'market.note.fallDemand' },
];

// ─── Indexes (built once at import) ─────────────────────────

/** @type {Map<string, Object[]>} country → signals */
const _byCountry = new Map();
for (const sig of PRICE_SIGNALS) {
  const cc = sig.country;
  if (!_byCountry.has(cc)) _byCountry.set(cc, []);
  _byCountry.get(cc).push(sig);
}

/** @type {Map<string, Object[]>} "country:crop" → signals */
const _byCropCountry = new Map();
for (const sig of PRICE_SIGNALS) {
  const key = `${sig.country}:${sig.cropCode}`;
  if (!_byCropCountry.has(key)) _byCropCountry.set(key, []);
  _byCropCountry.get(key).push(sig);
}

// ─── Public API ─────────────────────────────────────────────

/**
 * Check if market signal data is available for a country.
 * @param {string} countryCode
 * @returns {boolean}
 */
export function isMarketDataAvailable(countryCode) {
  return _byCountry.has((countryCode || '').toUpperCase());
}

/**
 * Get the currently active price signal for a crop in a country.
 * Uses the current month to pick the right seasonal signal.
 *
 * @param {Object} opts
 * @param {string} opts.cropCode
 * @param {string} opts.countryCode
 * @param {number} [opts.month] — 0-indexed month (default: current)
 * @returns {Object|null} Active price signal or null
 */
export function getCropPriceSignal({ cropCode, countryCode, month } = {}) {
  const cc = (countryCode || '').toUpperCase();
  const m = month ?? new Date().getMonth();
  const key = `${cc}:${cropCode}`;
  const signals = _byCropCountry.get(key);
  if (!signals) return null;

  // Find the signal whose months include the current month
  const active = signals.find(s => s.months.includes(m));
  if (!active) return null;

  return {
    cropCode: active.cropCode,
    trend: active.trend,
    confidence: active.confidence,
    season: active.season,
    noteKey: active.noteKey,
    source: 'seasonal_pattern',
  };
}

/**
 * Get all active price signals for a country at the current time.
 * Returns one signal per crop (the currently active seasonal signal).
 *
 * @param {Object} opts
 * @param {string} opts.countryCode
 * @param {number} [opts.month]
 * @param {number} [opts.limit] — max signals to return (default 8)
 * @returns {Array} Active signals sorted by confidence then trend
 */
export function getCountryPriceSignals({ countryCode, month, limit = 8 } = {}) {
  const cc = (countryCode || '').toUpperCase();
  const m = month ?? new Date().getMonth();
  const allSignals = _byCountry.get(cc);
  if (!allSignals) return [];

  // Group by crop, pick the active one per crop
  const byCrop = new Map();
  for (const sig of allSignals) {
    if (!sig.months.includes(m)) continue;
    // Prefer higher confidence and non-stable trends
    const existing = byCrop.get(sig.cropCode);
    if (!existing || confRank(sig) < confRank(existing)) {
      byCrop.set(sig.cropCode, sig);
    }
  }

  return [...byCrop.values()]
    .map(s => ({
      cropCode: s.cropCode,
      trend: s.trend,
      confidence: s.confidence,
      season: s.season,
      noteKey: s.noteKey,
      source: 'seasonal_pattern',
    }))
    .sort((a, b) => {
      // Non-stable trends first, then confidence
      const trendRank = { rising: 0, falling: 1, stable: 2 };
      const confOrder = { medium: 0, low: 1 };
      const ta = trendRank[a.trend] ?? 2;
      const tb = trendRank[b.trend] ?? 2;
      if (ta !== tb) return ta - tb;
      return (confOrder[a.confidence] ?? 1) - (confOrder[b.confidence] ?? 1);
    })
    .slice(0, limit);
}

/** Rank signal for dedup: prefer non-stable + higher confidence */
function confRank(sig) {
  const trendScore = sig.trend === 'stable' ? 10 : 0;
  const confScore = sig.confidence === 'medium' ? 0 : 5;
  return trendScore + confScore;
}

/**
 * Get a simple trend direction for use in recommendation scoring.
 * Returns: 1 (rising), 0 (stable/unknown), -1 (falling)
 *
 * @param {string} cropCode
 * @param {string} countryCode
 * @param {number} [month]
 * @returns {number}
 */
export function getPriceTrendScore(cropCode, countryCode, month) {
  const signal = getCropPriceSignal({ cropCode, countryCode, month });
  if (!signal) return 0;
  if (signal.trend === 'rising') return 1;
  if (signal.trend === 'falling') return -1;
  return 0;
}

// ─── Future API stubs (unchanged signatures) ────────────────

/**
 * Fetch real-time price for a crop. NOT YET IMPLEMENTED.
 * @returns {Promise<null>}
 */
export async function getCropPrice({ cropCode, countryCode } = {}) {
  return null;
}

/**
 * Fetch prices for multiple crops. NOT YET IMPLEMENTED.
 * @returns {Promise<Array>}
 */
export async function getCropPrices({ cropCodes = [], countryCode } = {}) {
  return [];
}

/**
 * Get price trend over time. NOT YET IMPLEMENTED.
 * @returns {Promise<null>}
 */
export async function getCropPriceTrend({ cropCode, countryCode, weeks = 4 } = {}) {
  return null;
}
