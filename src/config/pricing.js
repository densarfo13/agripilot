/**
 * pricing.js — Farroway monetisation tiers.
 *
 * Keep numbers + currency here, never in the UI. The Pricing page,
 * the calculator, and any future billing call site all read from
 * this object. Adjusting the model is a single edit.
 */

export const CURRENCY = Object.freeze({
  code:   'USD',
  symbol: '$',
});

export const PRICING = Object.freeze({
  NGO: Object.freeze({
    perFarmer:    1,     // USD per farmer per month
    minContract:  500,   // USD/month floor
  }),
  ENTERPRISE: Object.freeze({
    custom:        true, // contact sales
    indicativeFrom: 5000, // USD/month, just for the demo blurb
  }),
});

/** Demo-friendly tier sizes used by the Pricing screen. */
export const DEMO_TIERS = Object.freeze([
  { label: 'Pilot',       farmers: 100   },
  { label: 'Programme',   farmers: 1000  },
  { label: 'Region',      farmers: 5000  },
  { label: 'National',    farmers: 25000 },
]);
