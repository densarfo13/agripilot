/**
 * currenciesByCountry.js — ISO-3166-1 alpha-2 country → currency
 * metadata. Used when the value engine needs to label a USD-fallback
 * value in the farmer's local currency (informational only — we do
 * NOT convert FX here, the USD number just comes with a local-currency
 * caption like "≈₦12,000 approx" so the farmer has context).
 *
 * Callers that need live FX conversion should call a dedicated FX
 * service. This module is a deterministic label lookup.
 *
 * Shape:
 *   { currency: 'NGN', symbol: '₦', country: 'Nigeria' }
 *
 * Missing / unknown → returns the USD default so the UI always has
 * something to render.
 */

const MAP = Object.freeze({
  // Africa
  GH: { currency: 'GHS', symbol: '₵',  country: 'Ghana' },
  NG: { currency: 'NGN', symbol: '₦',  country: 'Nigeria' },
  KE: { currency: 'KES', symbol: 'KSh',country: 'Kenya' },
  UG: { currency: 'UGX', symbol: 'USh',country: 'Uganda' },
  TZ: { currency: 'TZS', symbol: 'TSh',country: 'Tanzania' },
  RW: { currency: 'RWF', symbol: 'FRw',country: 'Rwanda' },
  ET: { currency: 'ETB', symbol: 'Br', country: 'Ethiopia' },
  ZA: { currency: 'ZAR', symbol: 'R',  country: 'South Africa' },
  CI: { currency: 'XOF', symbol: 'CFA',country: "Côte d'Ivoire" },
  SN: { currency: 'XOF', symbol: 'CFA',country: 'Senegal' },
  ML: { currency: 'XOF', symbol: 'CFA',country: 'Mali' },
  BF: { currency: 'XOF', symbol: 'CFA',country: 'Burkina Faso' },
  CM: { currency: 'XAF', symbol: 'FCFA',country:'Cameroon' },
  EG: { currency: 'EGP', symbol: 'E£', country: 'Egypt' },
  MA: { currency: 'MAD', symbol: 'DH', country: 'Morocco' },
  DZ: { currency: 'DZD', symbol: 'DA', country: 'Algeria' },
  ZM: { currency: 'ZMW', symbol: 'ZK', country: 'Zambia' },
  ZW: { currency: 'ZWL', symbol: 'Z$', country: 'Zimbabwe' },
  MW: { currency: 'MWK', symbol: 'MK', country: 'Malawi' },
  MZ: { currency: 'MZN', symbol: 'MT', country: 'Mozambique' },
  // Asia
  IN: { currency: 'INR', symbol: '₹',  country: 'India' },
  PK: { currency: 'PKR', symbol: '₨',  country: 'Pakistan' },
  BD: { currency: 'BDT', symbol: '৳',  country: 'Bangladesh' },
  LK: { currency: 'LKR', symbol: 'Rs', country: 'Sri Lanka' },
  NP: { currency: 'NPR', symbol: '₨',  country: 'Nepal' },
  PH: { currency: 'PHP', symbol: '₱',  country: 'Philippines' },
  ID: { currency: 'IDR', symbol: 'Rp', country: 'Indonesia' },
  VN: { currency: 'VND', symbol: '₫',  country: 'Vietnam' },
  TH: { currency: 'THB', symbol: '฿',  country: 'Thailand' },
  MY: { currency: 'MYR', symbol: 'RM', country: 'Malaysia' },
  CN: { currency: 'CNY', symbol: '¥',  country: 'China' },
  JP: { currency: 'JPY', symbol: '¥',  country: 'Japan' },
  // Americas
  US: { currency: 'USD', symbol: '$',  country: 'United States' },
  CA: { currency: 'CAD', symbol: 'C$', country: 'Canada' },
  MX: { currency: 'MXN', symbol: '$',  country: 'Mexico' },
  BR: { currency: 'BRL', symbol: 'R$', country: 'Brazil' },
  AR: { currency: 'ARS', symbol: '$',  country: 'Argentina' },
  CO: { currency: 'COP', symbol: '$',  country: 'Colombia' },
  PE: { currency: 'PEN', symbol: 'S/', country: 'Peru' },
  CL: { currency: 'CLP', symbol: '$',  country: 'Chile' },
  // Europe
  FR: { currency: 'EUR', symbol: '€',  country: 'France' },
  DE: { currency: 'EUR', symbol: '€',  country: 'Germany' },
  ES: { currency: 'EUR', symbol: '€',  country: 'Spain' },
  IT: { currency: 'EUR', symbol: '€',  country: 'Italy' },
  NL: { currency: 'EUR', symbol: '€',  country: 'Netherlands' },
  GB: { currency: 'GBP', symbol: '£',  country: 'United Kingdom' },
  // Oceania
  AU: { currency: 'AUD', symbol: 'A$', country: 'Australia' },
  NZ: { currency: 'NZD', symbol: 'NZ$',country: 'New Zealand' },
});

const DEFAULT = Object.freeze({ currency: 'USD', symbol: '$', country: null });

/**
 * getCurrencyForCountry — safe lookup. Never throws, never returns
 * null. Unknown / missing → USD fallback so UI code can always format
 * a number with a symbol.
 */
export function getCurrencyForCountry(countryCode) {
  const iso2 = String(countryCode || '').trim().toUpperCase();
  if (!iso2) return DEFAULT;
  return MAP[iso2] || DEFAULT;
}

/**
 * formatCurrency — opinionated, locale-lite renderer so the
 * intelligence engines can emit a display-ready string without
 * pulling in Intl polyfills for every runtime.
 *
 *   formatCurrency(12000, 'NGN') → '₦12,000'
 *   formatCurrency(3.5,   'USD') → '$3.50'
 */
export function formatCurrency(amount, currencyOrCountry) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '—';

  // Accept either an ISO-2 country or a currency code directly.
  const raw = String(currencyOrCountry || '').trim();
  let meta = DEFAULT;
  if (raw.length === 2) {
    meta = getCurrencyForCountry(raw);
  } else if (raw.length === 3) {
    // Find first country that uses this currency so we can pick the
    // right symbol. Falls back to USD default.
    meta = Object.values(MAP).find((m) => m.currency === raw.toUpperCase())
      || { currency: raw.toUpperCase(), symbol: raw.toUpperCase() + ' ', country: null };
  }

  const abs    = Math.abs(n);
  // Use decimals for small amounts only, otherwise zero-decimal for
  // readability (farmers don't care about "₦11,999.73").
  const digits = abs < 100 ? 2 : 0;
  const rounded = Math.round(n * 10 ** digits) / 10 ** digits;
  const withCommas = rounded.toFixed(digits).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  // Symbols that are word-like ("KSh", "R", "CFA") read better with a
  // space; glyphs ("₦", "$", "€") stay glued to the number.
  const isGlyph = /^[^A-Za-z]+$/.test(meta.symbol);
  return isGlyph ? `${meta.symbol}${withCommas}` : `${meta.symbol} ${withCommas}`;
}

export const _internal = Object.freeze({ MAP, DEFAULT });
