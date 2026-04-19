/**
 * locationData.js — seed data for the structured country → state →
 * city location system.
 *
 * `COUNTRIES` is the searchable country list with ISO-2 codes.
 * Countries with defined subdivisions live in `COUNTRY_REGIONS`
 * keyed by the same ISO code; missing entries signal "no state
 * required" so the location flow can skip straight to optional city.
 *
 * `POPULAR_COUNTRY_CODES` surfaces farmer-heavy countries at the top
 * of the search list so people don't scroll through alphabet to
 * find US, GH, NG, IN, BR.
 *
 * `requiresState(code)` is the single source of truth downstream
 * components consult — if it returns true the state selector must
 * be filled before validation passes.
 */

export const COUNTRIES = Object.freeze([
  // Commonly used first (Farroway's core markets)
  { code: 'US', name: 'United States' },
  { code: 'GH', name: 'Ghana' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'IN', name: 'India' },
  { code: 'BR', name: 'Brazil' },
  { code: 'KE', name: 'Kenya' },
  { code: 'TZ', name: 'Tanzania' },
  { code: 'UG', name: 'Uganda' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'SN', name: 'Senegal' },
  // Remaining alphabetical
  { code: 'AR', name: 'Argentina' },
  { code: 'AU', name: 'Australia' },
  { code: 'BD', name: 'Bangladesh' },
  { code: 'CA', name: 'Canada' },
  { code: 'CI', name: "Côte d'Ivoire" },
  { code: 'CO', name: 'Colombia' },
  { code: 'EG', name: 'Egypt' },
  { code: 'ET', name: 'Ethiopia' },
  { code: 'FR', name: 'France' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'GT', name: 'Guatemala' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'KH', name: 'Cambodia' },
  { code: 'MA', name: 'Morocco' },
  { code: 'MX', name: 'Mexico' },
  { code: 'MW', name: 'Malawi' },
  { code: 'MZ', name: 'Mozambique' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'NP', name: 'Nepal' },
  { code: 'PE', name: 'Peru' },
  { code: 'PH', name: 'Philippines' },
  { code: 'PK', name: 'Pakistan' },
  { code: 'RW', name: 'Rwanda' },
  { code: 'TH', name: 'Thailand' },
  { code: 'VN', name: 'Vietnam' },
  { code: 'ZM', name: 'Zambia' },
  { code: 'ZW', name: 'Zimbabwe' },
  { code: 'OTHER', name: 'Other / not listed' },
]);

export const POPULAR_COUNTRY_CODES = Object.freeze([
  'US', 'GH', 'NG', 'IN', 'BR', 'KE',
]);

/**
 * State/region lists. Each entry is { code, name } so the UI can
 * store the canonical code while displaying the friendly name. For
 * countries without a hard code system (e.g. Ghana regions) we use
 * the slugified name as the code so it round-trips cleanly.
 */
export const COUNTRY_REGIONS = Object.freeze({
  US: [
    ['AL','Alabama'],['AK','Alaska'],['AZ','Arizona'],['AR','Arkansas'],['CA','California'],
    ['CO','Colorado'],['CT','Connecticut'],['DE','Delaware'],['DC','District of Columbia'],
    ['FL','Florida'],['GA','Georgia'],['HI','Hawaii'],['ID','Idaho'],['IL','Illinois'],
    ['IN','Indiana'],['IA','Iowa'],['KS','Kansas'],['KY','Kentucky'],['LA','Louisiana'],
    ['ME','Maine'],['MD','Maryland'],['MA','Massachusetts'],['MI','Michigan'],['MN','Minnesota'],
    ['MS','Mississippi'],['MO','Missouri'],['MT','Montana'],['NE','Nebraska'],['NV','Nevada'],
    ['NH','New Hampshire'],['NJ','New Jersey'],['NM','New Mexico'],['NY','New York'],
    ['NC','North Carolina'],['ND','North Dakota'],['OH','Ohio'],['OK','Oklahoma'],['OR','Oregon'],
    ['PA','Pennsylvania'],['RI','Rhode Island'],['SC','South Carolina'],['SD','South Dakota'],
    ['TN','Tennessee'],['TX','Texas'],['UT','Utah'],['VT','Vermont'],['VA','Virginia'],
    ['WA','Washington'],['WV','West Virginia'],['WI','Wisconsin'],['WY','Wyoming'],
  ].map(([code, name]) => ({ code, name })),

  GH: [
    'Greater Accra', 'Ashanti', 'Western', 'Central', 'Eastern',
    'Volta', 'Oti', 'Northern', 'Savannah', 'North East',
    'Upper East', 'Upper West', 'Bono', 'Bono East', 'Ahafo',
    'Western North',
  ].map((name) => ({ code: slugify(name), name })),

  NG: [
    'Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno',
    'Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','Gombe','Imo','Jigawa',
    'Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa','Niger',
    'Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba','Yobe',
    'Zamfara','Federal Capital Territory',
  ].map((name) => ({ code: slugify(name), name })),

  IN: [
    'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa',
    'Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala',
    'Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland',
    'Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura',
    'Uttar Pradesh','Uttarakhand','West Bengal',
    // Major UTs that matter for farming logistics
    'Delhi','Jammu and Kashmir','Ladakh','Puducherry',
  ].map((name) => ({ code: slugify(name), name })),

  BR: [
    'Acre','Alagoas','Amapá','Amazonas','Bahia','Ceará','Distrito Federal',
    'Espírito Santo','Goiás','Maranhão','Mato Grosso','Mato Grosso do Sul',
    'Minas Gerais','Pará','Paraíba','Paraná','Pernambuco','Piauí',
    'Rio de Janeiro','Rio Grande do Norte','Rio Grande do Sul','Rondônia',
    'Roraima','Santa Catarina','São Paulo','Sergipe','Tocantins',
  ].map((name) => ({ code: slugify(name), name })),

  KE: [
    'Nairobi','Mombasa','Kisumu','Nakuru','Eldoret','Machakos','Meru',
    'Nyeri','Kakamega','Kisii','Kilifi','Kitui','Kiambu','Uasin Gishu',
    'Bungoma','Kericho','Murang\'a','Laikipia','Tharaka-Nithi',
    'Makueni','Narok','Siaya','Homa Bay','Migori','Busia','Vihiga',
    'Nandi','Baringo','Trans Nzoia','Turkana','West Pokot','Samburu',
    'Isiolo','Marsabit','Garissa','Wajir','Mandera','Tana River',
    'Lamu','Taita Taveta','Kajiado','Bomet','Elgeyo-Marakwet',
    'Nyamira','Nyandarua','Kirinyaga',
  ].map((name) => ({ code: slugify(name), name })),
});

/** Countries we have structured regions for. */
export function hasRegions(countryCode) {
  return !!COUNTRY_REGIONS[String(countryCode || '').toUpperCase()];
}

/**
 * Should the UI require a state/region for this country? Currently
 * identical to hasRegions — every country we've seeded requires a
 * selection — but kept separate so we can relax the rule later
 * without touching every call site.
 */
export function requiresState(countryCode) {
  return hasRegions(countryCode);
}

/** Return the region list for a country (or []). */
export function getRegions(countryCode) {
  return COUNTRY_REGIONS[String(countryCode || '').toUpperCase()] || [];
}

/**
 * Resolve a state/region code back to its full entry. Accepts
 * either the stored code ("MD") or the display name ("Maryland")
 * so persisted values survive even if the UI layer converted them.
 */
export function resolveRegion(countryCode, regionCodeOrName) {
  const regions = getRegions(countryCode);
  if (!regionCodeOrName) return null;
  const search = String(regionCodeOrName).toLowerCase();
  return regions.find(
    (r) => r.code.toLowerCase() === search || r.name.toLowerCase() === search,
  ) || null;
}

export function findCountry(countryCode) {
  const code = String(countryCode || '').toUpperCase();
  return COUNTRIES.find((c) => c.code === code) || null;
}

/** Search countries by substring (case-insensitive). */
export function searchCountries(query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) {
    // No query — surface popular first, then the alphabetical rest.
    const popular = POPULAR_COUNTRY_CODES
      .map((code) => COUNTRIES.find((c) => c.code === code))
      .filter(Boolean);
    const rest = COUNTRIES
      .filter((c) => !POPULAR_COUNTRY_CODES.includes(c.code))
      .sort((a, b) => a.name.localeCompare(b.name));
    return [...popular, ...rest];
  }
  return COUNTRIES.filter(
    (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase() === q,
  ).sort((a, b) => a.name.localeCompare(b.name));
}

function slugify(name) {
  return String(name)
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

export const _internal = { slugify };
