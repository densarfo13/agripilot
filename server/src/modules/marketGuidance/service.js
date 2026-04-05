import { getRegionConfig } from '../regionConfig/service.js';

/**
 * Market Guidance Service
 * Advisory only — NOT a marketplace.
 * Provides price ranges, buyer type guidance, and seasonal advice per crop/region.
 */

const priceData = {
  KE: {
    maize:     { unit: 'kg', minPrice: 35,  maxPrice: 55,   season: 'Post-harvest prices tend to be lower (Jun-Aug). Consider holding if storage is good. Prices peak Jan-Mar.' },
    wheat:     { unit: 'kg', minPrice: 45,  maxPrice: 70,   season: 'Prices peak during low supply months (Feb-Apr). Import prices set floor.' },
    tea:       { unit: 'kg', minPrice: 25,  maxPrice: 45,   season: 'Auction prices vary weekly. Green leaf bonuses available for quality. Peak: Jan-Mar.' },
    coffee:    { unit: 'kg', minPrice: 200, maxPrice: 500,  season: 'Specialty grades command premium. Cherry quality matters. Peak auction: Oct-Dec.' },
    beans:     { unit: 'kg', minPrice: 80,  maxPrice: 150,  season: 'Prices highest during planting season when supply is low. Export demand growing.' },
    rice:      { unit: 'kg', minPrice: 80,  maxPrice: 130,  season: 'Local rice competes with imports. Aromatic varieties fetch premium.' },
    sugarcane: { unit: 'ton', minPrice: 4000, maxPrice: 5500, season: 'Contracted to mills. Negotiate before planting. Bonus for high sucrose.' },
    sorghum:   { unit: 'kg', minPrice: 30,  maxPrice: 50,   season: 'Growing demand from breweries. Quality grading matters.' },
  },
  TZ: {
    maize:   { unit: 'kg', minPrice: 500,  maxPrice: 900,   season: 'Post-harvest glut common Jun-Aug. Aggregation helps. Cross-border demand from Kenya.' },
    rice:    { unit: 'kg', minPrice: 1500, maxPrice: 2500,  season: 'Mbeya/Morogoro rice commands premium in Dar. Grade by size and broken %.' },
    cashew:  { unit: 'kg', minPrice: 3000, maxPrice: 5000,  season: 'Export prices depend on global market. Grade by size. Warehouse receipt system available.' },
    coffee:  { unit: 'kg', minPrice: 5000, maxPrice: 12000, season: 'Kilimanjaro arabica fetches premium. Auction-based pricing through TCB.' },
    cotton:  { unit: 'kg', minPrice: 800,  maxPrice: 1200,  season: 'Contracted to ginneries. Negotiate early. Quality affects price significantly.' },
    tobacco: { unit: 'kg', minPrice: 3000, maxPrice: 8000,  season: 'Auction-based. Grade determines price. Curing quality critical.' },
    sisal:   { unit: 'kg', minPrice: 500,  maxPrice: 1000,  season: 'Export-oriented. Processing quality matters. Long-term estate contracts.' },
    tea:     { unit: 'kg', minPrice: 400,  maxPrice: 800,   season: 'Factory-contracted. Green leaf quality bonuses. Regular picking schedule important.' },
  },
};

export function getMarketGuidance(cropType, countryCode = 'KE') {
  const regionCfg = getRegionConfig(countryCode);
  const countryPrices = priceData[countryCode] || priceData.KE;
  const cropInfo = countryPrices[cropType?.toLowerCase()];

  if (!cropInfo) {
    return {
      cropType,
      unit: 'kg',
      minPrice: 0,
      maxPrice: 0,
      currency: regionCfg.currencyCode,
      season: 'No price data available for this crop in this region.',
      country: regionCfg.country,
      available: false,
    };
  }

  return {
    cropType,
    ...cropInfo,
    currency: regionCfg.currencyCode,
    country: regionCfg.country,
    available: true,
  };
}

export function getAllCropPrices(countryCode = 'KE') {
  const regionCfg = getRegionConfig(countryCode);
  const countryPrices = priceData[countryCode] || priceData.KE;
  return Object.entries(countryPrices).map(([crop, info]) => ({
    cropType: crop,
    ...info,
    currency: regionCfg.currencyCode,
  }));
}

export function getBuyerTypes(cropType, countryCode = 'KE') {
  const regionCfg = getRegionConfig(countryCode);

  const types = [
    { type: 'aggregator', label: 'Aggregator', description: 'Buys in bulk from multiple farmers. Often offers lower price but guaranteed purchase.', suitableFor: ['maize', 'wheat', 'rice', 'beans', 'sorghum'] },
    { type: 'cooperative', label: 'Cooperative', description: 'Farmer-owned organization. May offer better prices, shared transport/storage costs, and market access.', suitableFor: ['coffee', 'tea', 'maize', 'rice'] },
    { type: 'processor', label: 'Processor', description: 'Buys raw produce for processing/value addition. May require specific quality grades.', suitableFor: ['coffee', 'tea', 'sugarcane', 'cotton', 'cashew'] },
    { type: 'export_agent', label: 'Export Agent', description: 'Buys for export markets. Higher quality requirements but better prices.', suitableFor: ['coffee', 'tea', 'cashew', 'cotton', 'tobacco'] },
    { type: 'local_market', label: 'Local Market', description: 'Direct sale at local markets. Variable prices, smaller quantities, immediate payment.', suitableFor: ['maize', 'beans', 'rice', 'vegetables'] },
    { type: 'institutional', label: 'Institutional Buyer', description: 'Schools, hospitals, WFP. Large volumes, competitive pricing, reliable payment.', suitableFor: ['maize', 'rice', 'beans'] },
  ];

  return types
    .filter(t => !cropType || t.suitableFor.includes(cropType?.toLowerCase()))
    .map(({ suitableFor, ...rest }) => ({ ...rest, country: regionCfg.country }));
}

export function getSellingTips(cropType, countryCode = 'KE') {
  const tips = {
    maize: [
      'Dry to <13% moisture for best price',
      'Grade by size — large grain fetches premium',
      'Sell in bulk for better per-unit price',
      'Compare prices from at least 3 buyers before selling',
      'Consider warehouse receipt system for delayed selling',
    ],
    coffee: [
      'Proper cherry selection directly impacts price',
      'Wet-processed coffee fetches higher prices',
      'Grade by screen size and defect count',
      'Sell through cooperative for auction access',
      'Specialty certification (organic, fair trade) adds value',
    ],
    rice: [
      'Mill to consumer-grade for higher margins',
      'Grade by broken percentage — low broken % fetches premium',
      'Brand packaging adds value',
      'Aromatic varieties command premium prices',
    ],
    cashew: [
      'Grade by nut size — larger nuts fetch premium',
      'Ensure proper drying before selling',
      'Raw cashew vs processed — know the price difference',
      'Use warehouse receipt system if available',
    ],
  };

  return tips[cropType?.toLowerCase()] || [
    'Compare prices from multiple buyers',
    'Ensure proper grading and quality',
    'Negotiate payment terms upfront',
    'Keep records of all sales',
  ];
}
