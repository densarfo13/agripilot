/**
 * cropWaterProfiles.js — per-crop rainfall suitability map.
 *
 * Shape:
 *   CROP_WATER_PROFILES[canonicalKey] = {
 *     preferred:    [WeatherState, ...],   // rainfall crop thrives in
 *     tolerates:    [WeatherState, ...],   // acceptable but not ideal
 *     sensitiveTo:  [WeatherState, ...],   // hurts yield / health
 *     notes?:       string,
 *   }
 *
 * WeatherState ∈ { 'dry', 'light_rain', 'moderate_rain', 'heavy_rain' }
 * (mirrors src/lib/weather/weatherState.js). A state may appear in
 * at most one of the three lists for a given crop.
 *
 * Missing crop → getCropWaterProfile returns null and the rainfall
 * engine degrades to registry seasonality, never crashing.
 *
 * Adding a new crop
 *   1. Pick the rainfall bands this crop consistently likes.
 *   2. Be realistic about `sensitiveTo` — this is a penalty list,
 *      not a "dislikes slightly". A week of that rainfall should
 *      materially hurt the crop.
 *   3. Keep `tolerates` wide so farmers aren't over-warned.
 */

const f = Object.freeze;
const arr = (xs) => f(xs.slice());

function profile({ preferred = [], tolerates = [], sensitiveTo = [], notes = null }) {
  return f({
    preferred:   arr(preferred),
    tolerates:   arr(tolerates),
    sensitiveTo: arr(sensitiveTo),
    notes,
  });
}

export const CROP_WATER_PROFILES = f({
  // ─── Staples + grains ────────────────────────────────────────
  maize: profile({
    preferred:   ['moderate_rain'],
    tolerates:   ['light_rain'],
    sensitiveTo: ['dry', 'heavy_rain'],
    notes: 'Water stress at tasseling is the single biggest yield killer.',
  }),
  rice: profile({
    preferred:   ['heavy_rain', 'moderate_rain'],
    tolerates:   ['light_rain'],
    sensitiveTo: ['dry'],
    notes: 'Paddy rice needs standing water — dry conditions stunt tillering.',
  }),
  wheat: profile({
    preferred:   ['light_rain', 'moderate_rain'],
    tolerates:   ['dry'],
    sensitiveTo: ['heavy_rain'],
  }),
  sorghum: profile({
    preferred:   ['light_rain', 'moderate_rain'],
    tolerates:   ['dry'],
    sensitiveTo: ['heavy_rain'],
  }),
  millet: profile({
    preferred:   ['light_rain'],
    tolerates:   ['dry', 'moderate_rain'],
    sensitiveTo: ['heavy_rain'],
  }),

  // ─── Roots + tubers ──────────────────────────────────────────
  cassava: profile({
    preferred:   ['moderate_rain'],
    tolerates:   ['dry', 'light_rain'],
    sensitiveTo: ['heavy_rain'],
    notes: 'Drought tolerant; heavy rain causes root rot during bulking.',
  }),
  yam: profile({
    preferred:   ['moderate_rain'],
    tolerates:   ['light_rain'],
    sensitiveTo: ['heavy_rain', 'dry'],
  }),
  potato: profile({
    preferred:   ['moderate_rain', 'light_rain'],
    tolerates:   [],
    sensitiveTo: ['heavy_rain', 'dry'],
  }),
  'sweet-potato': profile({
    preferred:   ['moderate_rain'],
    tolerates:   ['dry', 'light_rain'],
    sensitiveTo: ['heavy_rain'],
  }),

  // ─── Legumes ─────────────────────────────────────────────────
  beans: profile({
    preferred:   ['light_rain', 'moderate_rain'],
    tolerates:   ['dry'],
    sensitiveTo: ['heavy_rain'],
  }),
  soybean: profile({
    preferred:   ['moderate_rain'],
    tolerates:   ['light_rain'],
    sensitiveTo: ['heavy_rain', 'dry'],
  }),
  groundnut: profile({
    preferred:   ['moderate_rain'],
    tolerates:   ['dry', 'light_rain'],
    sensitiveTo: ['heavy_rain'],
    notes: 'Heavy rain at pod fill invites aflatoxin-producing moulds.',
  }),
  cowpea: profile({
    preferred:   ['light_rain'],
    tolerates:   ['dry', 'moderate_rain'],
    sensitiveTo: ['heavy_rain'],
  }),

  // ─── Vegetables ──────────────────────────────────────────────
  tomato: profile({
    preferred:   ['light_rain', 'moderate_rain'],
    tolerates:   ['dry'],
    sensitiveTo: ['heavy_rain'],
    notes: 'Heavy rain at flowering/fruiting triggers late blight.',
  }),
  onion: profile({
    preferred:   ['light_rain'],
    tolerates:   ['dry', 'moderate_rain'],
    sensitiveTo: ['heavy_rain'],
    notes: 'Wet bulbing = splits and neck rot.',
  }),
  pepper: profile({
    preferred:   ['moderate_rain', 'light_rain'],
    tolerates:   ['dry'],
    sensitiveTo: ['heavy_rain'],
  }),
  okra: profile({
    preferred:   ['moderate_rain'],
    tolerates:   ['light_rain', 'dry'],
    sensitiveTo: ['heavy_rain'],
  }),
  cabbage: profile({
    preferred:   ['moderate_rain'],
    tolerates:   ['light_rain'],
    sensitiveTo: ['heavy_rain', 'dry'],
  }),
  cucumber: profile({
    preferred:   ['moderate_rain', 'light_rain'],
    tolerates:   [],
    sensitiveTo: ['heavy_rain', 'dry'],
  }),
  carrot: profile({
    preferred:   ['light_rain', 'moderate_rain'],
    tolerates:   [],
    sensitiveTo: ['heavy_rain', 'dry'],
  }),
  eggplant: profile({
    preferred:   ['moderate_rain'],
    tolerates:   ['light_rain', 'dry'],
    sensitiveTo: ['heavy_rain'],
  }),
  watermelon: profile({
    preferred:   ['light_rain'],
    tolerates:   ['moderate_rain', 'dry'],
    sensitiveTo: ['heavy_rain'],
  }),
  spinach: profile({
    preferred:   ['light_rain', 'moderate_rain'],
    tolerates:   [],
    sensitiveTo: ['heavy_rain', 'dry'],
  }),
  lettuce: profile({
    preferred:   ['light_rain'],
    tolerates:   ['moderate_rain'],
    sensitiveTo: ['heavy_rain', 'dry'],
  }),

  // ─── Fruit / tree ────────────────────────────────────────────
  banana: profile({
    preferred:   ['moderate_rain', 'heavy_rain'],
    tolerates:   ['light_rain'],
    sensitiveTo: ['dry'],
    notes: 'Needs consistent moisture; tolerates high rainfall.',
  }),
  plantain: profile({
    preferred:   ['moderate_rain', 'heavy_rain'],
    tolerates:   ['light_rain'],
    sensitiveTo: ['dry'],
  }),
  mango: profile({
    preferred:   ['light_rain', 'moderate_rain'],
    tolerates:   ['dry'],
    sensitiveTo: ['heavy_rain'],
    notes: 'Heavy rain at flowering triggers powdery mildew.',
  }),
  orange: profile({
    preferred:   ['moderate_rain', 'light_rain'],
    tolerates:   ['dry'],
    sensitiveTo: ['heavy_rain'],
  }),
  pineapple: profile({
    preferred:   ['moderate_rain', 'light_rain'],
    tolerates:   ['dry'],
    sensitiveTo: ['heavy_rain'],
  }),
  avocado: profile({
    preferred:   ['moderate_rain'],
    tolerates:   ['light_rain'],
    sensitiveTo: ['heavy_rain', 'dry'],
  }),

  // ─── Cash / tree crops ───────────────────────────────────────
  cocoa: profile({
    preferred:   ['moderate_rain', 'heavy_rain'],
    tolerates:   ['light_rain'],
    sensitiveTo: ['dry'],
    notes: 'Needs consistent moisture under shade.',
  }),
  coffee: profile({
    preferred:   ['moderate_rain'],
    tolerates:   ['light_rain', 'heavy_rain'],
    sensitiveTo: ['dry'],
  }),
  cotton: profile({
    preferred:   ['moderate_rain'],
    tolerates:   ['light_rain', 'dry'],
    sensitiveTo: ['heavy_rain'],
  }),
  sugarcane: profile({
    preferred:   ['moderate_rain', 'heavy_rain'],
    tolerates:   ['light_rain'],
    sensitiveTo: ['dry'],
  }),
  'oil-palm': profile({
    preferred:   ['moderate_rain', 'heavy_rain'],
    tolerates:   ['light_rain'],
    sensitiveTo: ['dry'],
  }),
});

/**
 * getCropWaterProfile(canonicalKey) — frozen profile | null.
 */
export function getCropWaterProfile(canonicalKey) {
  if (!canonicalKey) return null;
  return CROP_WATER_PROFILES[canonicalKey] || null;
}

export const _internal = f({ CROP_WATER_PROFILES });
