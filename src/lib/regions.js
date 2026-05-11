/**
 * regions — country → regional pack mapping for visual selection.
 *
 *   import {
 *     countryToRegion,
 *     cropToRegion,
 *     REGION_CLUSTERS,
 *   } from 'src/lib/regions.js';
 *
 *   countryToRegion('GH')  // → 'africa'
 *   countryToRegion('IN')  // → 'asia'
 *   countryToRegion('US')  // → 'north-america'
 *   cropToRegion('rice')   // → 'asia'  (rice is asian-pack signature)
 *
 * Drives the realVisuals resolver — when an operator-uploaded
 * regional pack exists for the resolved cluster, the resolver
 * prefers photos from it; otherwise falls back to the default
 * hero set.
 *
 * Region clusters (intentionally coarse — five buckets keep the
 * content team's photo-shoot scope tractable):
 *
 *   africa         — sub-saharan, east, west, southern Africa
 *   asia           — south, southeast, east Asia (rice belt)
 *   latin-america  — Mexico → Patagonia, Caribbean
 *   north-america  — USA + Canada
 *   middle-east    — Gulf, Levant, Egypt (climate-wise; geographically
 *                    Egypt is Africa but its agriculture reads as
 *                    arid Mediterranean / Middle Eastern)
 *
 * Asset path convention
 *   public/assets/realism/regions/<region>/<slot>.webp
 *
 * RULES (operator brief)
 *   • dignified realistic agriculture
 *   • no stereotypes
 *   • no poverty-focused visuals
 *   • no fake stock-photo smiles
 *   • no vector farming art
 *
 * Strict-rule audit
 *   • Pure data + pure functions. SSR-safe.
 *   • Frozen exports. No side effects.
 *   • Tolerates unknown inputs — `countryToRegion(null)` returns null.
 */

export const REGION_CLUSTERS = Object.freeze({
  AFRICA:        'africa',
  ASIA:          'asia',
  LATIN_AMERICA: 'latin-america',
  NORTH_AMERICA: 'north-america',
  MIDDLE_EAST:   'middle-east',
});

// ─── Country → region cluster (ISO 3166-1 alpha-2) ──────────────
//
// The list is intentionally explicit rather than algorithmic — a
// short map is faster to audit than a continent-detector lookup,
// and the operator can override any single entry by editing the
// frozen table.

const COUNTRY_TO_REGION = Object.freeze({
  // Africa — sub-saharan + east + west + southern
  GH: 'africa', NG: 'africa', KE: 'africa', UG: 'africa', TZ: 'africa',
  ET: 'africa', RW: 'africa', BI: 'africa', ZM: 'africa', MW: 'africa',
  ZW: 'africa', ZA: 'africa', BW: 'africa', NA: 'africa', AO: 'africa',
  MZ: 'africa', MG: 'africa', CI: 'africa', SN: 'africa', ML: 'africa',
  BF: 'africa', NE: 'africa', BJ: 'africa', TG: 'africa', CM: 'africa',
  CD: 'africa', CG: 'africa', GA: 'africa', GQ: 'africa', SS: 'africa',
  SD: 'africa', ER: 'africa', SO: 'africa', DJ: 'africa', GM: 'africa',
  GW: 'africa', SL: 'africa', LR: 'africa', CV: 'africa', LS: 'africa',
  SZ: 'africa', MR: 'africa', KM: 'africa', SC: 'africa', MU: 'africa',
  CF: 'africa', TD: 'africa', ST: 'africa',

  // Asia — south + southeast + east Asia
  IN:  'asia', VN: 'asia', TH: 'asia', PH: 'asia', ID: 'asia',
  MY:  'asia', SG: 'asia', BD: 'asia', PK: 'asia', LK: 'asia',
  NP:  'asia', BT: 'asia', MM: 'asia', LA: 'asia', KH: 'asia',
  CN:  'asia', JP: 'asia', KR: 'asia', TW: 'asia', MN: 'asia',
  KP:  'asia', HK: 'asia', MO: 'asia', BN: 'asia', TL: 'asia',
  MV:  'asia', AF: 'asia',

  // Latin America — Mexico → Patagonia + Caribbean
  MX: 'latin-america', GT: 'latin-america', BZ: 'latin-america',
  HN: 'latin-america', SV: 'latin-america', NI: 'latin-america',
  CR: 'latin-america', PA: 'latin-america',
  CU: 'latin-america', DO: 'latin-america', HT: 'latin-america',
  JM: 'latin-america', TT: 'latin-america', BB: 'latin-america',
  GD: 'latin-america', LC: 'latin-america', VC: 'latin-america',
  AG: 'latin-america', DM: 'latin-america', KN: 'latin-america',
  BS: 'latin-america', PR: 'latin-america',
  CO: 'latin-america', VE: 'latin-america', EC: 'latin-america',
  PE: 'latin-america', BO: 'latin-america', BR: 'latin-america',
  AR: 'latin-america', CL: 'latin-america', PY: 'latin-america',
  UY: 'latin-america', GY: 'latin-america', SR: 'latin-america',

  // North America — USA + Canada (Mexico is in LATAM cluster)
  US: 'north-america', CA: 'north-america',

  // Middle East — Gulf + Levant + Egypt (arid agriculture cluster)
  EG: 'middle-east', SA: 'middle-east', AE: 'middle-east',
  QA: 'middle-east', BH: 'middle-east', KW: 'middle-east',
  OM: 'middle-east', YE: 'middle-east', JO: 'middle-east',
  LB: 'middle-east', SY: 'middle-east', IQ: 'middle-east',
  IR: 'middle-east', IL: 'middle-east', PS: 'middle-east',
  TR: 'middle-east', LY: 'middle-east', TN: 'middle-east',
  DZ: 'middle-east', MA: 'middle-east',
});

// Country name → ISO alias map. The user profile sometimes
// carries a country NAME ("Ghana") rather than an ISO code
// ("GH"); this normaliser handles both shapes.
const COUNTRY_NAME_ALIASES = Object.freeze({
  ghana:        'GH', nigeria:    'NG', kenya:        'KE',
  uganda:       'UG', tanzania:   'TZ', ethiopia:     'ET',
  rwanda:       'RW', zambia:     'ZM', malawi:       'MW',
  zimbabwe:     'ZW', 'south africa': 'ZA', botswana:  'BW',
  namibia:      'NA', angola:     'AO', mozambique:   'MZ',
  'ivory coast':'CI', senegal:    'SN', mali:         'ML',
  burkina:      'BF', cameroon:   'CM', drc:          'CD',

  india:        'IN', vietnam:    'VN', thailand:     'TH',
  philippines:  'PH', indonesia:  'ID', malaysia:     'MY',
  singapore:    'SG', bangladesh: 'BD', pakistan:     'PK',
  'sri lanka':  'LK', nepal:      'NP', myanmar:      'MM',
  laos:         'LA', cambodia:   'KH', china:        'CN',
  japan:        'JP', korea:      'KR', taiwan:       'TW',

  mexico:       'MX', guatemala:  'GT', honduras:     'HN',
  'costa rica': 'CR', nicaragua:  'NI', panama:       'PA',
  colombia:     'CO', venezuela:  'VE', ecuador:      'EC',
  peru:         'PE', bolivia:    'BO', brazil:       'BR',
  argentina:    'AR', chile:      'CL', uruguay:      'UY',

  'united states': 'US', usa:    'US', america:      'US',
  canada:       'CA',

  egypt:        'EG', 'saudi arabia':'SA', uae:       'AE',
  emirates:     'AE', qatar:      'QA', bahrain:      'BH',
  kuwait:       'KW', oman:       'OM', jordan:       'JO',
  lebanon:      'LB', syria:      'SY', iraq:         'IQ',
  iran:         'IR', israel:     'IL', turkey:       'TR',
  morocco:      'MA', tunisia:    'TN', algeria:      'DZ',
  libya:        'LY',
});

function _normalizeCountry(input) {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  // Already an ISO code (2 letters uppercase)?
  if (/^[A-Z]{2}$/i.test(trimmed)) return trimmed.toUpperCase();
  // Otherwise look up by lower-case name
  const iso = COUNTRY_NAME_ALIASES[trimmed.toLowerCase()];
  return iso || null;
}

/**
 * Resolve the regional cluster for a country.
 *
 *   countryToRegion('GH')      → 'africa'
 *   countryToRegion('Ghana')   → 'africa'
 *   countryToRegion('VN')      → 'asia'
 *   countryToRegion('Vietnam') → 'asia'
 *   countryToRegion(null)      → null
 */
export function countryToRegion(country) {
  const iso = _normalizeCountry(country);
  if (!iso) return null;
  return COUNTRY_TO_REGION[iso] || null;
}

// ─── Crop → region implication ─────────────────────────────────
// When the user's country is unknown but the crop signals a
// strong regional context (rice → Asia, cassava/yam → Africa,
// cocoa → Africa/LATAM), we lean toward that pack.

const CROP_TO_REGION = Object.freeze({
  rice:    'asia',
  paddy:   'asia',

  cassava: 'africa',
  yam:     'africa',
  manioc:  'africa',
  cocoyam: 'africa',
  plantain:'africa',

  // Crops that are global — no region implication.
  // maize, tomato, pepper, lettuce, herbs, flower don't appear
  // here on purpose so countryToRegion stays authoritative.
});

export function cropToRegion(crop) {
  if (!crop || typeof crop !== 'string') return null;
  return CROP_TO_REGION[crop.trim().toLowerCase()] || null;
}

/**
 * Combined resolver — picks the best regional cluster from the
 * available context. Country wins when known; otherwise the
 * crop's implied region; otherwise null (caller falls back to
 * the default/global asset set).
 *
 *   resolveRegion({ country: 'GH', crop: 'rice' })  → 'africa'  (country wins)
 *   resolveRegion({ country: null, crop: 'rice' })  → 'asia'    (crop fallback)
 *   resolveRegion({ country: null, crop: 'maize' }) → null      (no signal)
 */
export function resolveRegion({ country = null, crop = null } = {}) {
  const c = countryToRegion(country);
  if (c) return c;
  const cr = cropToRegion(crop);
  if (cr) return cr;
  return null;
}

export const _internal = Object.freeze({
  COUNTRY_TO_REGION,
  COUNTRY_NAME_ALIASES,
  CROP_TO_REGION,
});
