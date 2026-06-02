/**
 * marketEngine.js — server-side market intelligence for a scan.
 *
 * Scan V3 §6. Composes:
 *   - Recent farmer-reported listings (when the marketplace
 *     module is wired) for the scanned plant + region.
 *   - A small conservative reference-price table that falls back
 *     to country averages when no recent listings exist.
 *   - The scan's growth stage signal so the recommended sell
 *     window is computed from time-to-harvest, not invented.
 *
 * Pure async helper. Never throws. NEVER fabricates prices — when
 * the reference table has no entry, currentPrice = null and the
 * UI shows "price not available in your region yet".
 */

const _str = (v) => (typeof v === 'string' ? v : '');
const _num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);

// Conservative reference prices (per kg, USD) for common pilot
// crops. Set deliberately low + flagged as `referenceOnly: true`
// so the UI never claims they are a live market quote. Operators
// configure real feeds at the deployment layer; runtime never
// invents above-reference prices.
const REFERENCE_PRICES_USD_PER_KG = Object.freeze({
  maize:      0.30,
  tomato:     0.80,
  pepper:     1.20,
  onion:      0.55,
  cabbage:    0.40,
  potato:     0.50,
  cassava:    0.20,
  banana:     0.45,
  beans:      0.90,
  rice:       0.70,
  millet:     0.40,
  sorghum:    0.40,
  groundnut:  1.20,
  okra:       1.00,
  cucumber:   0.70,
  spinach:    1.10,
  lettuce:    1.30,
});

const RECENT_LISTING_DAYS = 14;
const RECENT_LISTING_LIMIT = 100;
const NEARBY_BUYER_LIMIT = 5;

function _canonCrop(s) {
  return _str(s).toLowerCase().trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z_]/g, '');
}

function _trendFromSeries(series) {
  if (!Array.isArray(series) || series.length < 3) return 'unknown';
  // Compare last 3 mean to first 3 mean.
  const first = series.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
  const last  = series.slice(-3).reduce((a, b) => a + b, 0) / 3;
  const delta = (last - first) / Math.max(0.001, Math.abs(first));
  if (delta >= 0.08)  return 'rising';
  if (delta <= -0.08) return 'falling';
  return 'stable';
}

function _demandFromSamples(buyerCount, listingCount) {
  // Coarse demand score 0..100 from the buyer:listing ratio.
  // 5+ active buyers per listing → high demand; 0 buyers → 0.
  if (buyerCount === 0 && listingCount === 0) return null;
  const ratio = buyerCount / Math.max(1, listingCount);
  const score = Math.min(100, Math.round(ratio * 25));
  return score;
}

function _recommendedSellWindow(growthStage, demandScore) {
  // Honest band — only emits a window when we know the stage.
  if (!growthStage || growthStage === 'unknown') {
    return { open: null, close: null, hint:
      'Add planting date to receive a recommended sell window.' };
  }
  if (growthStage === 'harvest_ready') {
    const tone = (demandScore != null && demandScore >= 60)
      ? 'Demand looks strong — sell within the next 7 days.'
      : 'Crop is ready — sell within the next 10–14 days.';
    return { open: 0, close: demandScore >= 60 ? 7 : 14, hint: tone };
  }
  if (growthStage === 'fruiting') {
    return { open: 14, close: 35,
      hint: 'Aim to sell 2–5 weeks from now once fruit hits ripeness.' };
  }
  if (growthStage === 'flowering') {
    return { open: 30, close: 60,
      hint: 'Sell window is roughly 4–8 weeks away.' };
  }
  return { open: null, close: null,
    hint: 'Too early for a reliable sell window.' };
}

export async function getMarketIntelligence(prisma, input = {}) {
  try {
    const crop   = _canonCrop(input.cropName || input.plantName);
    const country = _str(input.country);
    const region  = _str(input.region);
    const growthStage = _str(input.growthStage);

    let listings = [];
    let buyers   = [];

    // Try the listings + buyers tables when the marketplace
    // module is wired. Never throw on missing models.
    if (prisma && crop) {
      try {
        if (prisma.marketListing && typeof prisma.marketListing.findMany === 'function') {
          const since = new Date(Date.now() - RECENT_LISTING_DAYS * 24 * 3600 * 1000);
          listings = await prisma.marketListing.findMany({
            where: {
              cropName: crop,
              createdAt: { gte: since },
              ...(region ? { region } : {}),
            },
            orderBy: { createdAt: 'desc' },
            take: RECENT_LISTING_LIMIT,
            select: { pricePerKg: true, createdAt: true,
                      country: true, region: true },
          });
        }
      } catch { listings = []; }
      try {
        if (prisma.marketBuyer && typeof prisma.marketBuyer.findMany === 'function') {
          buyers = await prisma.marketBuyer.findMany({
            where: {
              interestedCrops: { has: crop },
              ...(region ? { region } : {}),
            },
            take: NEARBY_BUYER_LIMIT,
            select: { displayName: true, region: true,
                      buyingMinKg: true, contactHint: true },
          });
        }
      } catch { buyers = []; }
    }

    // Price series from listings — sorted ascending by date.
    const priceSeries = listings
      .map((l) => _num(l.pricePerKg))
      .filter((v) => v != null && v > 0)
      .reverse();                // ascending by date for trend math

    const recentMean = priceSeries.length > 0
      ? priceSeries.reduce((a, b) => a + b, 0) / priceSeries.length
      : null;
    const referencePrice = REFERENCE_PRICES_USD_PER_KG[crop] || null;
    const currentPrice = recentMean != null
      ? Math.round(recentMean * 100) / 100
      : referencePrice;
    const priceSource = recentMean != null ? 'recent_listings'
                      : (referencePrice != null ? 'reference_table' : 'none');

    const priceTrend = _trendFromSeries(priceSeries);
    const demandScore = _demandFromSamples(buyers.length, listings.length);
    const recommendedSellWindow = _recommendedSellWindow(growthStage, demandScore);

    const nearbyBuyers = buyers.map((b) => Object.freeze({
      name:        _str(b.displayName) || 'Anonymous buyer',
      region:      _str(b.region) || region || null,
      minKg:       _num(b.buyingMinKg),
      contactHint: _str(b.contactHint),
    }));

    return Object.freeze({
      ok: true,
      crop:        crop || null,
      country:     country || null,
      region:      region  || null,
      currentPrice,
      currency:    'USD',
      unit:        'per_kg',
      priceSource,                       // 'recent_listings' | 'reference_table' | 'none'
      referenceOnly: priceSource === 'reference_table',
      priceTrend,
      priceSampleSize: priceSeries.length,
      nearbyBuyers: Object.freeze(nearbyBuyers),
      recommendedSellWindow: Object.freeze(recommendedSellWindow),
      demandScore,
      confidence:  priceSeries.length >= 5 ? 'high'
                   : priceSeries.length >= 1 ? 'medium' : 'low',
      v: 3,
      limitations: 'Decision support, not a guarantee.',
    });
  } catch (err) {
    return Object.freeze({
      ok: false, reason: 'exception',
      message: err && err.message,
      crop: null, country: null, region: null,
      currentPrice: null, currency: 'USD', unit: 'per_kg',
      priceSource: 'none', referenceOnly: false,
      priceTrend: 'unknown', priceSampleSize: 0,
      nearbyBuyers: Object.freeze([]),
      recommendedSellWindow: Object.freeze({ open: null, close: null,
        hint: 'Market data unavailable right now.' }),
      demandScore: null, confidence: 'low', v: 3,
      limitations: 'Decision support, not a guarantee.',
    });
  }
}

export function marketEngineInfo() {
  return Object.freeze({
    name:               'market-engine',
    sourcesComposed:    Object.freeze(['marketListing', 'marketBuyer', 'reference_price_table']),
    referenceCropCount: Object.keys(REFERENCE_PRICES_USD_PER_KG).length,
    recentDays:         RECENT_LISTING_DAYS,
    nearbyBuyerLimit:   NEARBY_BUYER_LIMIT,
    neverFabricatesPrices: true,
  });
}

export const _internal = Object.freeze({
  _canonCrop, _trendFromSeries, _demandFromSamples,
  _recommendedSellWindow, REFERENCE_PRICES_USD_PER_KG,
});

export default getMarketIntelligence;
