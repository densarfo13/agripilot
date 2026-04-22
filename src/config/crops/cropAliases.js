/**
 * cropAliases.js — single normalization entry point for the Crop
 * Intelligence Layer.
 *
 * The rest of the registry keys every map by a canonical HYPHENATED
 * lowercase form (`sweet-potato`, `oil-palm`, `maize`). Callers send
 * whatever shape they have — storage codes (`SWEET_POTATO`), display
 * strings (`"Sweet Potato"`), synonyms (`"corn"`, `"chili"`), legacy
 * English labels (`"Cassava"`), or the canonical form itself — and
 * normalizeCropKey collapses them to the registry key.
 *
 *   normalizeCropKey('maize')         → 'maize'
 *   normalizeCropKey('MAIZE')         → 'maize'
 *   normalizeCropKey('corn')          → 'maize'        (synonym)
 *   normalizeCropKey('Sweet Potato')  → 'sweet-potato'
 *   normalizeCropKey('SWEET_POTATO')  → 'sweet-potato'
 *   normalizeCropKey('garden egg')    → 'eggplant'
 *   normalizeCropKey('OTHER:Teff')    → 'other'        (structured)
 *   normalizeCropKey(null)            → null
 *   normalizeCropKey('unobtainium')   → null           (unknown)
 *
 * Unknown inputs return `null` — callers decide whether to show a
 * neutral fallback UI, bail out, or log an upstream data issue.
 * The registry never crashes on unknown input.
 */

// Canonical lowercase hyphenated keys covered by the registry. Keep
// this list in sync with cropRegistry.js — a CI test asserts that
// every priority crop is in both places.
export const CANONICAL_KEYS = Object.freeze([
  // Priority crops (spec §11)
  'cassava', 'maize', 'rice', 'tomato', 'onion', 'okra',
  'pepper', 'potato', 'banana', 'plantain', 'cocoa', 'mango',
  // Extended crops — already have lifecycles + yield profiles
  'yam', 'sweet-potato', 'groundnut', 'beans', 'soybean',
  'sorghum', 'millet', 'cowpea', 'coffee', 'sugarcane',
  'cotton', 'eggplant', 'cabbage', 'carrot', 'cucumber',
  'spinach', 'watermelon', 'orange', 'avocado', 'ginger',
  'garlic', 'lettuce', 'soybean', 'sunflower', 'sesame',
  'oil-palm', 'wheat', 'chickpea', 'lentil', 'tea',
]);

const CANONICAL_SET = new Set(CANONICAL_KEYS);

/**
 * Alias table → canonical key.
 * Keep the LEFT side lowercase + separator-insensitive (we collapse
 * hyphens/underscores/spaces before lookup, so `garden-egg`,
 * `garden_egg`, and `garden egg` all land on the same row).
 */
const ALIASES = Object.freeze({
  // ─── Staples / grains ─────────────────────────────────────────
  corn: 'maize',
  'indian-corn': 'maize',
  'sweet-corn': 'maize',
  sweetcorn: 'maize',

  paddy: 'rice',
  'paddy-rice': 'rice',

  // ─── Roots & tubers ───────────────────────────────────────────
  manioc: 'cassava',
  yuca: 'cassava',
  tapioca: 'cassava',

  'sweet-potato': 'sweet-potato',
  'sweet-potatoes': 'sweet-potato',

  potatoes: 'potato',
  spuds: 'potato',

  yams: 'yam',

  cocoyam: 'taro',
  taro: 'taro',

  // ─── Legumes ──────────────────────────────────────────────────
  peanut: 'groundnut',
  peanuts: 'groundnut',
  'ground-nut': 'groundnut',
  'ground-nuts': 'groundnut',

  bean: 'beans',
  'common-bean': 'beans',

  soy: 'soybean',
  soya: 'soybean',
  soja: 'soybean',

  // ─── Vegetables ───────────────────────────────────────────────
  aubergine: 'eggplant',
  brinjal: 'eggplant',
  'garden-egg': 'eggplant',

  chili: 'pepper',
  chilli: 'pepper',
  chilly: 'pepper',
  'chili-pepper': 'pepper',
  'bell-pepper': 'pepper',
  'green-pepper': 'pepper',
  capsicum: 'pepper',

  tomatoes: 'tomato',

  onions: 'onion',
  'spring-onion': 'onion',

  ladyfinger: 'okra',
  'lady-finger': 'okra',
  bhindi: 'okra',
  gombo: 'okra',

  // ─── Fruit ────────────────────────────────────────────────────
  bananas: 'banana',
  plantains: 'plantain',

  mangos: 'mango',
  mangoes: 'mango',

  citrus: 'orange',
  oranges: 'orange',

  // ─── Tree / cash crops ────────────────────────────────────────
  cacao: 'cocoa',
  'cocoa-bean': 'cocoa',
  'cocoa-beans': 'cocoa',

  'oil-palm': 'oil-palm',
  palm: 'oil-palm',

  // ─── Sentinel / structured ────────────────────────────────────
  // Structured "OTHER:…" values (e.g. OTHER:Teff) collapse to
  // the `other` sentinel so downstream code doesn't leak the raw
  // free-text into registry lookups.
  other: 'other',
});

/**
 * normalizeCropKey — accept any input shape, return the canonical
 * registry key (lowercase, hyphen-separated) or `null` if unknown.
 */
export function normalizeCropKey(input) {
  if (input == null) return null;
  const raw = String(input).trim();
  if (!raw) return null;

  // Structured "OTHER:Teff" → 'other'
  if (/^other:/i.test(raw)) return 'other';

  // Collapse separators + case. Spaces/underscores → hyphens.
  const hyphenated = raw
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  if (!hyphenated) return null;

  // Canonical match on the hyphenated form.
  if (CANONICAL_SET.has(hyphenated)) return hyphenated;

  // Alias lookup.
  if (ALIASES[hyphenated]) {
    const target = ALIASES[hyphenated];
    // Aliases may resolve to a canonical key OR to another alias
    // (e.g. taro → taro is self, but some may chain). One hop is
    // enough — the alias table is hand-authored.
    return CANONICAL_SET.has(target) ? target : target;
  }

  // Also try underscore form against the alias table since some
  // legacy storage uses `sweet_potato` — collapse is already done.
  return null;
}

/**
 * isCanonicalCropKey — pure helper used by registry integrity checks
 * and test assertions.
 */
export function isCanonicalCropKey(key) {
  return typeof key === 'string' && CANONICAL_SET.has(key);
}

export const _internal = Object.freeze({ CANONICAL_SET, ALIASES });
