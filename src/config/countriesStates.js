/**
 * countriesStates.js — small, curated country + state dataset used
 * by NewFarmScreen / FirstLaunchConfirm dropdowns.
 *
 * This is deliberately not every ISO-3166 subdivision. We include:
 *   • the full ISO-3166-1 alpha-2 country list (the tens we actually
 *     use, plus an "OTHER" escape hatch)
 *   • state/region lists for countries we support operationally
 *     (US, IN, NG, GH, KE, TZ, UG, ZA)
 *
 * Everything is frozen so callers can't mutate the shared tables.
 *
 * Helpers:
 *   getCountries()               → [{ code, label }]
 *   getStatesForCountry(code)    → [{ code, label }] (empty if none)
 *   hasStatesForCountry(code)    → boolean
 *   getCountryLabel(code)        → label or null
 */

// ─── Countries (kept concise — expand in one place) ───────────────
// Labels are English for the dataset; UI can still localise via t(),
// but labels here stay stable so the stored value is unambiguous.
export const COUNTRIES = Object.freeze([
  ['US', 'United States'],
  ['GB', 'United Kingdom'],
  ['CA', 'Canada'],
  ['AU', 'Australia'],
  ['IN', 'India'],
  ['PK', 'Pakistan'],
  ['BD', 'Bangladesh'],
  ['NP', 'Nepal'],
  ['LK', 'Sri Lanka'],
  ['PH', 'Philippines'],
  ['ID', 'Indonesia'],
  ['VN', 'Vietnam'],
  ['TH', 'Thailand'],
  ['MY', 'Malaysia'],
  ['GH', 'Ghana'],
  ['NG', 'Nigeria'],
  ['KE', 'Kenya'],
  ['TZ', 'Tanzania'],
  ['UG', 'Uganda'],
  ['RW', 'Rwanda'],
  ['ET', 'Ethiopia'],
  ['ZA', 'South Africa'],
  ['SN', 'Senegal'],
  ['CI', "Côte d'Ivoire"],
  ['ML', 'Mali'],
  ['BF', 'Burkina Faso'],
  ['CM', 'Cameroon'],
  ['CD', 'DR Congo'],
  ['ZM', 'Zambia'],
  ['ZW', 'Zimbabwe'],
  ['MZ', 'Mozambique'],
  ['MW', 'Malawi'],
  ['BR', 'Brazil'],
  ['MX', 'Mexico'],
  ['AR', 'Argentina'],
  ['CO', 'Colombia'],
  ['PE', 'Peru'],
  ['CL', 'Chile'],
  ['FR', 'France'],
  ['ES', 'Spain'],
  ['PT', 'Portugal'],
  ['DE', 'Germany'],
  ['IT', 'Italy'],
  ['NL', 'Netherlands'],
  ['OTHER', 'Other / international'],
].map(([code, label]) => Object.freeze({ code, label })));

// ─── States / regions by country ──────────────────────────────────
// Only listing subdivisions for countries we operate in. Callers get
// `[]` back for everywhere else, and the UI hides the field then.
const US_STATES = [
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
];

const IN_STATES = [
  ['AP','Andhra Pradesh'],['AR','Arunachal Pradesh'],['AS','Assam'],['BR','Bihar'],
  ['CT','Chhattisgarh'],['GA','Goa'],['GJ','Gujarat'],['HR','Haryana'],
  ['HP','Himachal Pradesh'],['JH','Jharkhand'],['KA','Karnataka'],['KL','Kerala'],
  ['MP','Madhya Pradesh'],['MH','Maharashtra'],['MN','Manipur'],['ML','Meghalaya'],
  ['MZ','Mizoram'],['NL','Nagaland'],['OR','Odisha'],['PB','Punjab'],['RJ','Rajasthan'],
  ['SK','Sikkim'],['TN','Tamil Nadu'],['TG','Telangana'],['TR','Tripura'],
  ['UP','Uttar Pradesh'],['UT','Uttarakhand'],['WB','West Bengal'],
  ['DL','Delhi'],['JK','Jammu & Kashmir'],['LA','Ladakh'],
];

const NG_STATES = [
  ['AB','Abia'],['AD','Adamawa'],['AK','Akwa Ibom'],['AN','Anambra'],['BA','Bauchi'],
  ['BY','Bayelsa'],['BE','Benue'],['BO','Borno'],['CR','Cross River'],['DE','Delta'],
  ['EB','Ebonyi'],['ED','Edo'],['EK','Ekiti'],['EN','Enugu'],['FC','FCT (Abuja)'],
  ['GO','Gombe'],['IM','Imo'],['JI','Jigawa'],['KD','Kaduna'],['KN','Kano'],
  ['KT','Katsina'],['KE','Kebbi'],['KO','Kogi'],['KW','Kwara'],['LA','Lagos'],
  ['NA','Nasarawa'],['NI','Niger'],['OG','Ogun'],['ON','Ondo'],['OS','Osun'],
  ['OY','Oyo'],['PL','Plateau'],['RI','Rivers'],['SO','Sokoto'],['TA','Taraba'],
  ['YO','Yobe'],['ZA','Zamfara'],
];

const GH_REGIONS = [
  ['AH','Ahafo'],['AS','Ashanti'],['BA','Bono'],['BE','Bono East'],['CP','Central'],
  ['EP','Eastern'],['AA','Greater Accra'],['NE','North East'],['NP','Northern'],
  ['OT','Oti'],['SV','Savannah'],['UE','Upper East'],['UW','Upper West'],
  ['TV','Volta'],['WP','Western'],['WN','Western North'],
];

const KE_COUNTIES = [
  ['NRB','Nairobi'],['MSA','Mombasa'],['KSM','Kisumu'],['NKR','Nakuru'],['UGR','Uasin Gishu'],
  ['KIA','Kiambu'],['MCK','Machakos'],['MER','Meru'],['KAK','Kakamega'],['MUR','Muranga'],
];

const TZ_REGIONS = [
  ['AR','Arusha'],['DS','Dar es Salaam'],['DO','Dodoma'],['IR','Iringa'],['KG','Kigoma'],
  ['KJ','Kilimanjaro'],['MB','Mbeya'],['MO','Morogoro'],['MW','Mwanza'],['TB','Tabora'],
];

const UG_REGIONS = [
  ['C','Central'],['E','Eastern'],['N','Northern'],['W','Western'],
];

const ZA_PROVINCES = [
  ['EC','Eastern Cape'],['FS','Free State'],['GT','Gauteng'],['KZ','KwaZulu-Natal'],
  ['LP','Limpopo'],['MP','Mpumalanga'],['NC','Northern Cape'],['NW','North West'],['WC','Western Cape'],
];

const STATES_BY_COUNTRY = Object.freeze({
  US: Object.freeze(US_STATES.map(([code, label]) => Object.freeze({ code, label }))),
  IN: Object.freeze(IN_STATES.map(([code, label]) => Object.freeze({ code, label }))),
  NG: Object.freeze(NG_STATES.map(([code, label]) => Object.freeze({ code, label }))),
  GH: Object.freeze(GH_REGIONS.map(([code, label]) => Object.freeze({ code, label }))),
  KE: Object.freeze(KE_COUNTIES.map(([code, label]) => Object.freeze({ code, label }))),
  TZ: Object.freeze(TZ_REGIONS.map(([code, label]) => Object.freeze({ code, label }))),
  UG: Object.freeze(UG_REGIONS.map(([code, label]) => Object.freeze({ code, label }))),
  ZA: Object.freeze(ZA_PROVINCES.map(([code, label]) => Object.freeze({ code, label }))),
});

export function getCountries() { return COUNTRIES.slice(); }

export function hasStatesForCountry(code) {
  return !!(code && STATES_BY_COUNTRY[code] && STATES_BY_COUNTRY[code].length > 0);
}

export function getStatesForCountry(code) {
  if (!code) return [];
  return (STATES_BY_COUNTRY[code] || []).slice();
}

export function getCountryLabel(code) {
  const row = COUNTRIES.find((c) => c.code === code);
  return row ? row.label : null;
}

export function getStateLabel(countryCode, stateCode) {
  const states = STATES_BY_COUNTRY[countryCode] || [];
  const row = states.find((s) => s.code === stateCode);
  return row ? row.label : null;
}

export const _internal = Object.freeze({ STATES_BY_COUNTRY });
