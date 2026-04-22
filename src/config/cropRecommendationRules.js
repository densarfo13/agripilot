/**
 * cropRecommendationRules.js — v1 rule-based crop recommendations.
 *
 * Shape:
 *   RULES[countryCode] = {
 *     defaults: Rule[]                     // country-level fallback
 *     states?:  { [stateCode]: Rule[] }    // optional per-state overrides
 *   }
 *
 * Rule:
 *   {
 *     crop:            'maize' | 'rice' | …            (stable code)
 *     fit:             'high' | 'medium' | 'low'       (confidence bucket)
 *     why:             short why-string (English; can swap for i18n key later)
 *     plantingWindow:  short window string ('Apr–Jun', year-round, etc.)
 *     note:            farmer-friendly extra hint (optional)
 *   }
 *
 * v1 scope (spec §3):
 *   • United States (with California, Texas, Iowa, Minnesota samples)
 *   • Ghana         (with Ashanti, Northern, Greater Accra samples)
 *   • Nigeria       (with Kaduna, Lagos samples)
 *   • Kenya         (with Nairobi / Central samples)
 *   • India         (with Punjab, Maharashtra, Tamil Nadu samples)
 *
 * Extending later (spec §7):
 *   • Add a new country: push a new top-level key with defaults[] at
 *     minimum.
 *   • Add a new state/region: put it under states[CODE] and the
 *     engine will prefer state rules over country defaults.
 *   • Switch plain English copy to i18n keys: the engine surfaces
 *     whatever string lives in `why` / `note`, so you only need to
 *     run values through `t(...)` at the UI boundary later.
 */

const freeze = Object.freeze;

const US_DEFAULTS = [
  { crop: 'maize',   fit: 'high',   why: 'Widely grown across most US farming regions.',           plantingWindow: 'Apr–Jun' },
  { crop: 'soybean', fit: 'high',   why: 'Rotates well with maize; strong domestic + export market.', plantingWindow: 'May–Jun' },
  { crop: 'wheat',   fit: 'medium', why: 'Reliable in cooler-season states and rotations.',         plantingWindow: 'Sep–Oct (winter) / Mar–Apr (spring)' },
  { crop: 'tomato',  fit: 'medium', why: 'High-value horticulture option with steady demand.',     plantingWindow: 'Apr–May' },
  { crop: 'beans',   fit: 'medium', why: 'Short-cycle legume — good for first season learning.',   plantingWindow: 'May–Jun' },
];

const GH_DEFAULTS = [
  { crop: 'maize',    fit: 'high',   why: 'Staple cereal across Ghana; strong local demand.',     plantingWindow: 'Mar–May (major) / Aug–Sep (minor)' },
  { crop: 'cassava',  fit: 'high',   why: 'Drought-tolerant and forgiving for beginners.',         plantingWindow: 'Year-round (best Mar–Jun)' },
  { crop: 'yam',      fit: 'medium', why: 'High-value staple in many Ghanaian markets.',           plantingWindow: 'Nov–Apr (land prep + planting)' },
  { crop: 'groundnut',fit: 'medium', why: 'Good rotation with cereals; low input.',                plantingWindow: 'Apr–Jun' },
  { crop: 'cocoa',    fit: 'medium', why: 'Long-term tree crop in forest zones — cash income.',    plantingWindow: 'Apr–Jul (seedlings)', note: 'Best suited to forest belt; skip in dry Savannah.' },
];

const NG_DEFAULTS = [
  { crop: 'maize',     fit: 'high',   why: 'Staple cereal across most Nigerian climates.',          plantingWindow: 'Apr–Jun' },
  { crop: 'cassava',   fit: 'high',   why: 'Hardy and forgiving; stable local demand.',             plantingWindow: 'Mar–Jun' },
  { crop: 'yam',       fit: 'medium', why: 'High-value staple, especially in the Middle Belt.',     plantingWindow: 'Nov–Mar (land prep + planting)' },
  { crop: 'sorghum',   fit: 'medium', why: 'Drought-tolerant grain for the Northern zones.',        plantingWindow: 'Jun–Jul' },
  { crop: 'rice',      fit: 'medium', why: 'Growing local demand; needs reliable water.',           plantingWindow: 'May–Jul' },
];

const KE_DEFAULTS = [
  { crop: 'maize',   fit: 'high',   why: 'Kenya\'s main staple cereal across most regions.',      plantingWindow: 'Mar–May (long rains) / Oct–Nov (short rains)' },
  { crop: 'beans',   fit: 'high',   why: 'Often intercropped with maize; quick first harvest.',    plantingWindow: 'Mar–May' },
  { crop: 'tomato',  fit: 'medium', why: 'Steady demand; good fit for smallholders with water.',   plantingWindow: 'Feb–Apr / Aug–Oct' },
  { crop: 'potato',  fit: 'medium', why: 'Fits cooler highland areas (1,500–2,800 m).',             plantingWindow: 'Mar–Apr / Sep–Oct', note: 'Confirm altitude before planting.' },
  { crop: 'cassava', fit: 'medium', why: 'Drought-tolerant backup crop in dry lowlands.',          plantingWindow: 'Mar–May' },
];

const IN_DEFAULTS = [
  { crop: 'rice',      fit: 'high',   why: 'India\'s dominant kharif cereal; huge domestic demand.', plantingWindow: 'Jun–Jul (kharif)' },
  { crop: 'wheat',     fit: 'high',   why: 'Leading rabi cereal in the Northern plains.',            plantingWindow: 'Oct–Nov (rabi)' },
  { crop: 'cotton',    fit: 'medium', why: 'Strong cash crop in central + southern states.',         plantingWindow: 'May–Jul' },
  { crop: 'sugarcane', fit: 'medium', why: 'Long-cycle, water-intensive; strong mill demand.',       plantingWindow: 'Feb–Mar / Oct–Nov' },
  { crop: 'pulses',    fit: 'medium', why: 'Rotation-friendly legumes; strong government support.',  plantingWindow: 'Jun–Jul / Oct–Nov', note: 'Chickpea, pigeon pea, mung bean depending on region.' },
];

// ─── Tanzania (TZ) — East African savanna + highlands ────────
const TZ_DEFAULTS = [
  { crop: 'maize',     fit: 'high',   why: 'Core staple across most of Tanzania.',               plantingWindow: 'Oct–Dec (short rains) / Feb–Apr (long rains)' },
  { crop: 'cassava',   fit: 'high',   why: 'Drought-tolerant staple for lowland zones.',         plantingWindow: 'Oct–Dec' },
  { crop: 'beans',     fit: 'medium', why: 'Intercropped with maize on smallholder farms.',     plantingWindow: 'Mar–May' },
  { crop: 'sorghum',   fit: 'medium', why: 'Suited to drier central regions.',                   plantingWindow: 'Nov–Jan' },
  { crop: 'rice',      fit: 'medium', why: 'Growing demand; best where water is reliable.',      plantingWindow: 'Dec–Feb' },
];

// ─── Uganda (UG) — equatorial bimodal rains ────────────────────
const UG_DEFAULTS = [
  { crop: 'banana',    fit: 'high',   why: 'Matooke is the national staple; year-round harvest.', plantingWindow: 'Mar–May / Sep–Nov' },
  { crop: 'maize',     fit: 'high',   why: 'Key grain; two seasons thanks to bimodal rains.',     plantingWindow: 'Mar–May / Sep–Nov' },
  { crop: 'cassava',   fit: 'high',   why: 'Hardy staple tuber across most zones.',               plantingWindow: 'Mar–May' },
  { crop: 'beans',     fit: 'medium', why: 'Short-cycle legume for both seasons.',                 plantingWindow: 'Mar–May / Sep–Nov' },
  { crop: 'coffee',    fit: 'medium', why: 'Major cash crop in the western highlands.',            plantingWindow: 'Mar–May (seedlings)' },
];

// ─── Brazil (BR) — South America cerrado + coastal ─────────────
const BR_DEFAULTS = [
  { crop: 'soybean',   fit: 'high',   why: 'World\'s largest soy producer; cerrado agriculture.',  plantingWindow: 'Oct–Dec' },
  { crop: 'maize',     fit: 'high',   why: 'Safrinha (second-crop) corn after soy is huge.',       plantingWindow: 'Oct–Dec (main) / Jan–Mar (safrinha)' },
  { crop: 'sugarcane', fit: 'high',   why: 'Central-south belt dominates global sugar + ethanol.', plantingWindow: 'Jan–Apr / Sep–Nov' },
  { crop: 'cotton',    fit: 'medium', why: 'Large in Mato Grosso + Bahia.',                         plantingWindow: 'Dec–Feb' },
  { crop: 'cassava',   fit: 'medium', why: 'Traditional staple across the Northeast.',              plantingWindow: 'Sep–Nov' },
];

// ─── Per-state overrides (subset — extend as needed) ──────────────
const US_STATES = {
  CA: [
    { crop: 'tomato',    fit: 'high',   why: 'California leads US tomato production; ideal climate.', plantingWindow: 'Feb–Apr' },
    { crop: 'maize',     fit: 'medium', why: 'Grown across the Central Valley with irrigation.',       plantingWindow: 'Apr–May' },
    { crop: 'wheat',     fit: 'medium', why: 'Winter wheat suits cooler coastal valleys.',             plantingWindow: 'Nov–Dec' },
    { crop: 'sunflower', fit: 'medium', why: 'Drought-tolerant oilseed fits many valley soils.',       plantingWindow: 'Apr–May' },
    { crop: 'beans',     fit: 'low',    why: 'Limited by water cost in hotter inland areas.',          plantingWindow: 'May–Jun' },
  ],
  TX: [
    { crop: 'cotton',  fit: 'high',   why: 'Texas is the largest US cotton producer.',               plantingWindow: 'Mar–May' },
    { crop: 'sorghum', fit: 'high',   why: 'Drought-tolerant grain for dry-land Texas.',              plantingWindow: 'Mar–May' },
    { crop: 'maize',   fit: 'medium', why: 'Grown in irrigated and High Plains areas.',               plantingWindow: 'Mar–Apr' },
    { crop: 'wheat',   fit: 'medium', why: 'Winter wheat staple in the Panhandle.',                   plantingWindow: 'Sep–Oct' },
    { crop: 'soybean', fit: 'low',    why: 'Limited by heat in much of the state.',                   plantingWindow: 'May–Jun' },
  ],
  IA: [
    { crop: 'maize',   fit: 'high',   why: 'Iowa is the US maize belt heartland.',                    plantingWindow: 'Apr–May' },
    { crop: 'soybean', fit: 'high',   why: 'Universal rotation partner with maize in Iowa.',          plantingWindow: 'May' },
    { crop: 'wheat',   fit: 'low',    why: 'Possible but uncommon at this latitude.',                 plantingWindow: 'Sep–Oct' },
  ],
  MN: [
    { crop: 'maize',   fit: 'high',   why: 'Main cash grain in southern Minnesota.',                  plantingWindow: 'Apr–May' },
    { crop: 'soybean', fit: 'high',   why: 'Rotates with maize; cold-tolerant cultivars available.',  plantingWindow: 'May' },
    { crop: 'wheat',   fit: 'medium', why: 'Spring wheat suits the northern counties.',               plantingWindow: 'Apr' },
  ],
};

const GH_STATES = {
  AS: [ // Ashanti — forest zone
    { crop: 'cocoa',    fit: 'high',   why: 'Ashanti is the heartland of Ghana\'s cocoa belt.',       plantingWindow: 'Apr–Jul (seedlings)' },
    { crop: 'cassava',  fit: 'high',   why: 'Staple tuber across Ashanti farms.',                     plantingWindow: 'Mar–Jun' },
    { crop: 'plantain', fit: 'high',   why: 'Major forest-zone food crop with strong market.',        plantingWindow: 'Apr–Jun' },
    { crop: 'maize',    fit: 'medium', why: 'Grown in both major and minor seasons.',                 plantingWindow: 'Mar–May / Aug–Sep' },
  ],
  NP: [ // Northern region — savanna
    { crop: 'maize',     fit: 'high',   why: 'Core grain in the Northern savanna zone.',              plantingWindow: 'May–Jul' },
    { crop: 'sorghum',   fit: 'high',   why: 'Well suited to dry Northern rainfall pattern.',         plantingWindow: 'May–Jul' },
    { crop: 'millet',    fit: 'high',   why: 'Short-cycle cereal for the drier north.',               plantingWindow: 'May–Jun' },
    { crop: 'groundnut', fit: 'medium', why: 'Common legume rotation in the north.',                  plantingWindow: 'May–Jul' },
    { crop: 'yam',       fit: 'medium', why: 'Grown along the transition belt.',                      plantingWindow: 'Nov–Apr' },
  ],
  AA: [ // Greater Accra — coastal
    { crop: 'cassava', fit: 'high',   why: 'Reliable across the coastal belt.',                       plantingWindow: 'Mar–May' },
    { crop: 'maize',   fit: 'medium', why: 'Grown in both rainy seasons; rainfall is modest.',        plantingWindow: 'Mar–May / Aug–Sep' },
    { crop: 'tomato',  fit: 'medium', why: 'Strong urban market in Accra.',                           plantingWindow: 'Feb–Apr / Aug–Oct' },
    { crop: 'okra',    fit: 'medium', why: 'Short-cycle vegetable; consistent demand.',               plantingWindow: 'Mar–Jun' },
  ],
};

const NG_STATES = {
  KD: [ // Kaduna — Middle Belt + North West
    { crop: 'maize',   fit: 'high',   why: 'Kaduna is a leading maize state.',                         plantingWindow: 'Apr–Jun' },
    { crop: 'sorghum', fit: 'high',   why: 'Well suited to Kaduna\'s savanna climate.',                plantingWindow: 'Jun–Jul' },
    { crop: 'yam',     fit: 'medium', why: 'Transition-zone tuber with strong local demand.',          plantingWindow: 'Nov–Mar' },
    { crop: 'cowpea',  fit: 'medium', why: 'Short-cycle legume that fits northern rainfall.',          plantingWindow: 'Jul–Aug' },
  ],
  LA: [ // Lagos — coastal / urban
    { crop: 'cassava', fit: 'high',   why: 'Staple across the south-west coastal belt.',               plantingWindow: 'Mar–Jun' },
    { crop: 'tomato',  fit: 'high',   why: 'Strong Lagos urban market for vegetables.',                plantingWindow: 'Aug–Nov' },
    { crop: 'maize',   fit: 'medium', why: 'Grown on smallholder plots around Lagos.',                 plantingWindow: 'Mar–May' },
    { crop: 'okra',    fit: 'medium', why: 'Short-cycle vegetable for home + market sale.',            plantingWindow: 'Mar–Jun' },
  ],
};

const KE_STATES = {
  NRB: [ // Nairobi / peri-urban
    { crop: 'tomato',  fit: 'high',   why: 'Strong Nairobi demand for fresh vegetables.',              plantingWindow: 'Feb–Apr / Aug–Oct' },
    { crop: 'kale',    fit: 'high',   why: 'Fast-growing staple green; year-round demand.',            plantingWindow: 'Year-round (with water)' },
    { crop: 'maize',   fit: 'medium', why: 'Smallholder staple in the surrounding counties.',          plantingWindow: 'Mar–May' },
    { crop: 'beans',   fit: 'medium', why: 'Often intercropped with maize.',                            plantingWindow: 'Mar–May' },
  ],
  MUR: [ // Muranga — Central highlands
    { crop: 'tea',      fit: 'high',   why: 'Central Kenya highlands are prime tea-growing areas.',    plantingWindow: 'Year-round (seedlings: Mar–May)' },
    { crop: 'coffee',   fit: 'high',   why: 'Classic Central Kenya cash crop.',                         plantingWindow: 'Mar–May (seedlings)' },
    { crop: 'potato',   fit: 'high',   why: 'Fits the cool highland climate (>1,500 m).',              plantingWindow: 'Mar–Apr / Sep–Oct' },
    { crop: 'maize',    fit: 'medium', why: 'Grown alongside beans on smallholder plots.',              plantingWindow: 'Mar–May' },
    { crop: 'beans',    fit: 'medium', why: 'Intercrop staple with maize.',                             plantingWindow: 'Mar–May' },
  ],
};

const IN_STATES = {
  PB: [ // Punjab — North plains
    { crop: 'wheat',     fit: 'high',   why: 'Punjab is India\'s main wheat-producing state.',          plantingWindow: 'Oct–Nov (rabi)' },
    { crop: 'rice',      fit: 'high',   why: 'Kharif rice on Punjab\'s canal-irrigated plains.',        plantingWindow: 'Jun–Jul' },
    { crop: 'cotton',    fit: 'medium', why: 'Grown in the south-western cotton belt.',                 plantingWindow: 'Apr–May' },
    { crop: 'sugarcane', fit: 'medium', why: 'Perennial cash crop in sub-mountain belt.',               plantingWindow: 'Feb–Mar' },
  ],
  MH: [ // Maharashtra
    { crop: 'cotton',    fit: 'high',   why: 'Maharashtra is a top cotton-producing state.',            plantingWindow: 'May–Jul' },
    { crop: 'sugarcane', fit: 'high',   why: 'Core cash crop in western Maharashtra.',                  plantingWindow: 'Oct–Nov / Feb–Mar' },
    { crop: 'soybean',   fit: 'high',   why: 'Vidarbha + Marathwada are major soy areas.',              plantingWindow: 'Jun–Jul' },
    { crop: 'pulses',    fit: 'medium', why: 'Pigeon pea + chickpea rotation across dry zones.',        plantingWindow: 'Jun–Jul / Oct–Nov' },
  ],
  TN: [ // Tamil Nadu
    { crop: 'rice',      fit: 'high',   why: 'Multiple cropping seasons in the Cauvery delta.',         plantingWindow: 'Jun–Jul / Oct–Nov / Jan–Feb' },
    { crop: 'sugarcane', fit: 'high',   why: 'Major cash crop across northern Tamil Nadu.',             plantingWindow: 'Dec–Feb' },
    { crop: 'cotton',    fit: 'medium', why: 'Common in the southern dryland belt.',                    plantingWindow: 'Jul–Oct' },
    { crop: 'pulses',    fit: 'medium', why: 'Rainfed pulses complement paddy in dryland areas.',       plantingWindow: 'Jun–Jul / Sep–Oct' },
  ],
};

// ─── Global safe fallback (unsupported countries, spec §2) ────────
const GLOBAL_DEFAULTS = [
  { crop: 'maize',   fit: 'medium', why: 'Reliable staple across most farming regions.',                plantingWindow: 'Plant at the start of your main rainy season.' },
  { crop: 'beans',   fit: 'medium', why: 'Short-cycle legume — quick first harvest and soil-friendly.', plantingWindow: 'Plant at the start of your main rainy season.' },
  { crop: 'cassava', fit: 'medium', why: 'Drought-tolerant and forgiving for new farmers.',              plantingWindow: 'Any wet period.' },
  { crop: 'tomato',  fit: 'low',    why: 'High value but needs steady water and care.',                  plantingWindow: 'Cool / early rainy season.' },
  { crop: 'rice',    fit: 'low',    why: 'Only where water access is strong.',                           plantingWindow: 'Start of main rainy season.' },
];

export const RULES = freeze({
  US: freeze({ defaults: freeze(US_DEFAULTS), states: freeze(US_STATES) }),
  GH: freeze({ defaults: freeze(GH_DEFAULTS), states: freeze(GH_STATES) }),
  NG: freeze({ defaults: freeze(NG_DEFAULTS), states: freeze(NG_STATES) }),
  KE: freeze({ defaults: freeze(KE_DEFAULTS), states: freeze(KE_STATES) }),
  IN: freeze({ defaults: freeze(IN_DEFAULTS), states: freeze(IN_STATES) }),
  TZ: freeze({ defaults: freeze(TZ_DEFAULTS) }),
  UG: freeze({ defaults: freeze(UG_DEFAULTS) }),
  BR: freeze({ defaults: freeze(BR_DEFAULTS) }),
});

export const GLOBAL_FALLBACK = freeze(GLOBAL_DEFAULTS);

export const SUPPORTED_COUNTRIES = freeze(Object.keys(RULES));

/** Confidence bucket → numeric weight (used for sorting + UI badges). */
export const FIT_WEIGHT = freeze({ high: 0.9, medium: 0.6, low: 0.3 });

export const _internal = freeze({ US_DEFAULTS, GH_DEFAULTS, NG_DEFAULTS, KE_DEFAULTS, IN_DEFAULTS });
