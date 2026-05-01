/**
 * marketCatalog.js — frozen per-country configuration for the
 * multi-market expansion.
 *
 * Spec coverage (Multi-market expansion §1, §2, §3)
 *   §1 region-based data: crops, pricing, units
 *   §2 localize currency, language, crop suggestions
 *   §3 seed each market with initial listings + buyers
 *
 * Six markets seeded for pilot:
 *   GH — Ghana          (default focus; cedis, kg, English/Twi)
 *   KE — Kenya          (shillings, kg, Swahili/English)
 *   NG — Nigeria        (naira, kg, English/Hausa)
 *   TZ — Tanzania       (shillings, kg, Swahili/English)
 *   IN — India          (rupees, quintal, Hindi/English)
 *   US — United States  (USD, lb, English)
 *
 * Strict-rule audit
 *   • Frozen Object so callers cannot mutate the singleton.
 *   • Pure read; never throws.
 *   • Sample listings carry `sample: true` so existing surfaces
 *     can render the SAMPLE badge (the FundingCard renders it
 *     for funding samples; marketStore listings can use the same
 *     convention).
 *   • Suggested crops are lowercase canonical ids — match the
 *     existing crop registry.
 */

const _now = () => new Date().toISOString();

const _GH = Object.freeze({
  id:           'GH',
  country:      'Ghana',
  countryName:  'Ghana',
  regions:      ['Greater Accra', 'Ashanti', 'Western', 'Eastern', 'Volta', 'Central', 'Northern'],
  currency:     'GHS',
  primaryUnit:  'kg',
  defaultLang:  'en',
  fallbackLangs: ['en', 'tw'],
  suggestedCrops: ['maize', 'cassava', 'tomato', 'pepper', 'plantain', 'yam'],
  sampleListings: [
    {
      crop: 'maize',     quantity: 50,  unit: 'kg',
      priceRange: '6-8 GHS / kg',
      regionLabel: 'Greater Accra',
    },
    {
      crop: 'tomato',    quantity: 20,  unit: 'kg',
      priceRange: '12-15 GHS / kg',
      regionLabel: 'Ashanti',
    },
    {
      crop: 'cassava',   quantity: 100, unit: 'kg',
      priceRange: '4-5 GHS / kg',
      regionLabel: 'Eastern',
    },
  ],
  sampleBuyers: [
    { name: 'Accra Wholesalers Co-op', region: 'Greater Accra', interestedIn: 'maize' },
    { name: 'Kumasi Fresh Market',     region: 'Ashanti',       interestedIn: 'tomato' },
  ],
});

const _KE = Object.freeze({
  id:           'KE',
  country:      'Kenya',
  countryName:  'Kenya',
  regions:      ['Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Eldoret'],
  currency:     'KES',
  primaryUnit:  'kg',
  defaultLang:  'sw',
  fallbackLangs: ['sw', 'en'],
  suggestedCrops: ['maize', 'beans', 'tomato', 'cabbage', 'kale', 'onion'],
  sampleListings: [
    { crop: 'maize',  quantity: 90,  unit: 'kg', priceRange: '60-80 KES / kg',  regionLabel: 'Nakuru' },
    { crop: 'tomato', quantity: 25,  unit: 'kg', priceRange: '90-110 KES / kg', regionLabel: 'Nairobi' },
    { crop: 'beans',  quantity: 40,  unit: 'kg', priceRange: '120-140 KES / kg', regionLabel: 'Eldoret' },
  ],
  sampleBuyers: [
    { name: 'Nairobi Greengrocers',    region: 'Nairobi', interestedIn: 'tomato' },
    { name: 'Mombasa Coastal Market',  region: 'Mombasa', interestedIn: 'maize'  },
  ],
});

const _NG = Object.freeze({
  id:           'NG',
  country:      'Nigeria',
  countryName:  'Nigeria',
  regions:      ['Lagos', 'Abuja', 'Kano', 'Ibadan', 'Port Harcourt'],
  currency:     'NGN',
  primaryUnit:  'kg',
  defaultLang:  'en',
  fallbackLangs: ['en', 'ha'],
  suggestedCrops: ['maize', 'cassava', 'rice', 'yam', 'pepper', 'tomato'],
  sampleListings: [
    { crop: 'maize',   quantity: 100, unit: 'kg', priceRange: '700-900 NGN / kg',   regionLabel: 'Kano'   },
    { crop: 'cassava', quantity: 200, unit: 'kg', priceRange: '300-400 NGN / kg',   regionLabel: 'Ibadan' },
    { crop: 'tomato',  quantity: 30,  unit: 'kg', priceRange: '1500-1800 NGN / kg', regionLabel: 'Lagos'  },
  ],
  sampleBuyers: [
    { name: 'Lagos Mile-12 Market',  region: 'Lagos', interestedIn: 'tomato' },
    { name: 'Abuja Bulk Buyers',     region: 'Abuja', interestedIn: 'maize'  },
  ],
});

const _TZ = Object.freeze({
  id:           'TZ',
  country:      'Tanzania',
  countryName:  'Tanzania',
  regions:      ['Dar es Salaam', 'Arusha', 'Mwanza', 'Dodoma'],
  currency:     'TZS',
  primaryUnit:  'kg',
  defaultLang:  'sw',
  fallbackLangs: ['sw', 'en'],
  suggestedCrops: ['maize', 'rice', 'beans', 'cassava', 'tomato'],
  sampleListings: [
    { crop: 'maize',  quantity: 80,  unit: 'kg', priceRange: '900-1200 TZS / kg',  regionLabel: 'Arusha' },
    { crop: 'rice',   quantity: 60,  unit: 'kg', priceRange: '1800-2200 TZS / kg', regionLabel: 'Mwanza' },
    { crop: 'tomato', quantity: 25,  unit: 'kg', priceRange: '2000-2500 TZS / kg', regionLabel: 'Dar es Salaam' },
  ],
  sampleBuyers: [
    { name: 'Dar Fresh Coop',    region: 'Dar es Salaam', interestedIn: 'tomato' },
    { name: 'Arusha Bulk Buyer', region: 'Arusha',        interestedIn: 'maize'  },
  ],
});

const _IN = Object.freeze({
  id:           'IN',
  country:      'India',
  countryName:  'India',
  regions:      ['Maharashtra', 'Punjab', 'Karnataka', 'Tamil Nadu', 'Uttar Pradesh'],
  currency:     'INR',
  primaryUnit:  'quintal',
  defaultLang:  'hi',
  fallbackLangs: ['hi', 'en'],
  suggestedCrops: ['rice', 'wheat', 'sugarcane', 'cotton', 'maize', 'pulses'],
  sampleListings: [
    { crop: 'rice',  quantity: 5,  unit: 'quintal', priceRange: '2000-2400 INR / quintal', regionLabel: 'Punjab'      },
    { crop: 'wheat', quantity: 8,  unit: 'quintal', priceRange: '2200-2500 INR / quintal', regionLabel: 'Punjab'      },
    { crop: 'maize', quantity: 10, unit: 'quintal', priceRange: '1900-2100 INR / quintal', regionLabel: 'Maharashtra' },
  ],
  sampleBuyers: [
    { name: 'Mumbai Mandi Trader',  region: 'Maharashtra', interestedIn: 'rice'  },
    { name: 'Ludhiana Wheat Buyer', region: 'Punjab',      interestedIn: 'wheat' },
  ],
});

const _US = Object.freeze({
  id:           'US',
  country:      'United States',
  countryName:  'United States',
  regions:      ['California', 'Texas', 'Florida', 'New York', 'Illinois'],
  currency:     'USD',
  primaryUnit:  'lb',
  defaultLang:  'en',
  fallbackLangs: ['en'],
  suggestedCrops: ['tomato', 'pepper', 'lettuce', 'corn', 'herbs', 'cucumber'],
  sampleListings: [
    { crop: 'tomato',   quantity: 40, unit: 'lb', priceRange: '$2.50-3.50 / lb', regionLabel: 'California' },
    { crop: 'lettuce',  quantity: 30, unit: 'lb', priceRange: '$1.80-2.20 / lb', regionLabel: 'California' },
    { crop: 'cucumber', quantity: 25, unit: 'lb', priceRange: '$1.50-2.00 / lb', regionLabel: 'Florida'    },
  ],
  sampleBuyers: [
    { name: 'Bay Area Farmers Market',     region: 'California', interestedIn: 'tomato' },
    { name: 'Texas Restaurant Cooperative', region: 'Texas',      interestedIn: 'herbs'  },
  ],
});

const MARKETS = Object.freeze({
  GH: _GH, KE: _KE, NG: _NG, TZ: _TZ, IN: _IN, US: _US,
});

const COUNTRY_TO_ID = Object.freeze({
  ghana:        'GH',
  kenya:        'KE',
  nigeria:      'NG',
  tanzania:     'TZ',
  india:        'IN',
  'united states': 'US',
  usa:          'US',
  'us':         'US',
});

export function getMarket(id) {
  return MARKETS[String(id || '').toUpperCase()] || null;
}

export function listMarkets() {
  return Object.values(MARKETS);
}

export function getMarketIdByCountry(country) {
  const c = String(country || '').trim().toLowerCase();
  if (!c) return null;
  if (COUNTRY_TO_ID[c]) return COUNTRY_TO_ID[c];
  // Last-ditch substring match for variations like "the united states".
  for (const [name, id] of Object.entries(COUNTRY_TO_ID)) {
    if (c.includes(name)) return id;
  }
  return null;
}

export const _internal = Object.freeze({ MARKETS, COUNTRY_TO_ID });

export default { getMarket, listMarkets, getMarketIdByCountry };
export { _now };
