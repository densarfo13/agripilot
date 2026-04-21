/**
 * prices.js — static reference prices per country × crop for v1.
 *
 * All prices are approximate farmgate / wholesale medians expressed
 * in the country's local currency per kilogram. They're intentionally
 * rough — the goal is to give farmers + NGOs a ballpark expected
 * value at harvest, not a trading signal. Callers that want USD can
 * apply their own FX; this module keeps the local-currency anchor
 * stable for reporting + farmer comprehension.
 *
 * Shape:
 *   PRICES[countryCode][cropCode] = {
 *     price:    number,   // per `unit`
 *     unit:     'kg' | 't',
 *     currency: ISO-4217 code,
 *     updatedAt: 'YYYY-MM'  // when the reference was last reviewed
 *   }
 *
 * Missing country/crop → caller must branch. Use
 * `src/lib/pricing/priceEngine.js` for the safe-lookup helpers.
 */

// Country currency + standard unit for reference price lookups.
export const COUNTRY_CURRENCY = Object.freeze({
  GH: { currency: 'GHS', unit: 'kg' },   // Ghana
  NG: { currency: 'NGN', unit: 'kg' },   // Nigeria
  IN: { currency: 'INR', unit: 'kg' },   // India
  US: { currency: 'USD', unit: 'kg' },   // United States
  FR: { currency: 'EUR', unit: 'kg' },   // France
});

// Reference prices. These are illustrative farmgate ranges (2024–25)
// — operators should review quarterly. Keep the same crop set across
// countries so the UI can show a stable column order.
export const PRICES = Object.freeze({
  GH: Object.freeze({
    cassava:  { price: 3.0,  unit: 'kg', currency: 'GHS', updatedAt: '2025-01' },
    maize:    { price: 4.5,  unit: 'kg', currency: 'GHS', updatedAt: '2025-01' },
    rice:     { price: 8.0,  unit: 'kg', currency: 'GHS', updatedAt: '2025-01' },
    tomato:   { price: 6.0,  unit: 'kg', currency: 'GHS', updatedAt: '2025-01' },
    onion:    { price: 7.0,  unit: 'kg', currency: 'GHS', updatedAt: '2025-01' },
    sorghum:  { price: 4.0,  unit: 'kg', currency: 'GHS', updatedAt: '2025-01' },
    banana:   { price: 3.5,  unit: 'kg', currency: 'GHS', updatedAt: '2025-01' },
    cocoa:    { price: 12.0, unit: 'kg', currency: 'GHS', updatedAt: '2025-01' },
    potato:   { price: 6.5,  unit: 'kg', currency: 'GHS', updatedAt: '2025-01' },
    wheat:    { price: 7.5,  unit: 'kg', currency: 'GHS', updatedAt: '2025-01' },
  }),
  NG: Object.freeze({
    cassava:  { price: 180, unit: 'kg', currency: 'NGN', updatedAt: '2025-01' },
    maize:    { price: 350, unit: 'kg', currency: 'NGN', updatedAt: '2025-01' },
    rice:     { price: 800, unit: 'kg', currency: 'NGN', updatedAt: '2025-01' },
    tomato:   { price: 500, unit: 'kg', currency: 'NGN', updatedAt: '2025-01' },
    onion:    { price: 650, unit: 'kg', currency: 'NGN', updatedAt: '2025-01' },
    sorghum:  { price: 300, unit: 'kg', currency: 'NGN', updatedAt: '2025-01' },
    banana:   { price: 220, unit: 'kg', currency: 'NGN', updatedAt: '2025-01' },
    cocoa:    { price: 1800,unit: 'kg', currency: 'NGN', updatedAt: '2025-01' },
    potato:   { price: 500, unit: 'kg', currency: 'NGN', updatedAt: '2025-01' },
    wheat:    { price: 700, unit: 'kg', currency: 'NGN', updatedAt: '2025-01' },
  }),
  IN: Object.freeze({
    cassava:  { price: 16, unit: 'kg', currency: 'INR', updatedAt: '2025-01' },
    maize:    { price: 22, unit: 'kg', currency: 'INR', updatedAt: '2025-01' },
    rice:     { price: 35, unit: 'kg', currency: 'INR', updatedAt: '2025-01' },
    tomato:   { price: 30, unit: 'kg', currency: 'INR', updatedAt: '2025-01' },
    onion:    { price: 28, unit: 'kg', currency: 'INR', updatedAt: '2025-01' },
    sorghum:  { price: 28, unit: 'kg', currency: 'INR', updatedAt: '2025-01' },
    banana:   { price: 40, unit: 'kg', currency: 'INR', updatedAt: '2025-01' },
    cocoa:    { price: 260,unit: 'kg', currency: 'INR', updatedAt: '2025-01' },
    potato:   { price: 20, unit: 'kg', currency: 'INR', updatedAt: '2025-01' },
    wheat:    { price: 25, unit: 'kg', currency: 'INR', updatedAt: '2025-01' },
  }),
  US: Object.freeze({
    cassava:  { price: 2.2, unit: 'kg', currency: 'USD', updatedAt: '2025-01' },
    maize:    { price: 0.25,unit: 'kg', currency: 'USD', updatedAt: '2025-01' },
    rice:     { price: 0.65,unit: 'kg', currency: 'USD', updatedAt: '2025-01' },
    tomato:   { price: 2.5, unit: 'kg', currency: 'USD', updatedAt: '2025-01' },
    onion:    { price: 1.4, unit: 'kg', currency: 'USD', updatedAt: '2025-01' },
    sorghum:  { price: 0.22,unit: 'kg', currency: 'USD', updatedAt: '2025-01' },
    banana:   { price: 1.3, unit: 'kg', currency: 'USD', updatedAt: '2025-01' },
    cocoa:    { price: 9.5, unit: 'kg', currency: 'USD', updatedAt: '2025-01' },
    potato:   { price: 0.9, unit: 'kg', currency: 'USD', updatedAt: '2025-01' },
    wheat:    { price: 0.30,unit: 'kg', currency: 'USD', updatedAt: '2025-01' },
  }),
  FR: Object.freeze({
    cassava:  { price: 2.5, unit: 'kg', currency: 'EUR', updatedAt: '2025-01' },
    maize:    { price: 0.22,unit: 'kg', currency: 'EUR', updatedAt: '2025-01' },
    rice:     { price: 0.80,unit: 'kg', currency: 'EUR', updatedAt: '2025-01' },
    tomato:   { price: 2.0, unit: 'kg', currency: 'EUR', updatedAt: '2025-01' },
    onion:    { price: 1.2, unit: 'kg', currency: 'EUR', updatedAt: '2025-01' },
    sorghum:  { price: 0.25,unit: 'kg', currency: 'EUR', updatedAt: '2025-01' },
    banana:   { price: 1.4, unit: 'kg', currency: 'EUR', updatedAt: '2025-01' },
    cocoa:    { price: 8.5, unit: 'kg', currency: 'EUR', updatedAt: '2025-01' },
    potato:   { price: 0.8, unit: 'kg', currency: 'EUR', updatedAt: '2025-01' },
    wheat:    { price: 0.28,unit: 'kg', currency: 'EUR', updatedAt: '2025-01' },
  }),
});

export const SUPPORTED_COUNTRIES = Object.freeze(Object.keys(PRICES));
export const SUPPORTED_CROPS     = Object.freeze([
  'cassava', 'maize', 'rice', 'tomato', 'onion',
  'sorghum', 'banana', 'cocoa', 'potato', 'wheat',
]);
