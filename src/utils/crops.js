import {
  getCropLabel as getLangCropLabel,
  normalizeCrop,
  _internal as _cropsInternal,
} from '../config/crops.js';
import { useTranslation } from '../i18n/index.js';
import { assertNormalizedCrop } from '../config/crops/assertNormalizedCrop.js';

/**
 * utils/crops.js — UI-layer crop catalog + form helpers.
 *
 * Owns concerns the canonical registry deliberately doesn't:
 *   • CROPS array of UI-friendly { code, name, category } rows for
 *     dropdown/grid selectors
 *   • CATEGORY_LABELS / CATEGORY_ICONS / CROP_ICONS — emoji + group
 *     metadata used by FarmForm, CropPicker, etc.
 *   • parseCropValue / buildOtherCropValue — handles the special
 *     "OTHER:Custom Name" sentinel form storage uses
 *   • getCropIcon / useCropLabel — React-friendly accessors
 *
 * Relationship to src/config/crops/cropRegistry.js (canonical):
 *   • The registry composes intelligence-layer data (lifecycle,
 *     yield, water profile, harvest profile, regions). It does not
 *     own UI form metadata (icons, dropdown rows).
 *   • This file calls into the canonical multilingual table via
 *     `getLangCropLabel` from `src/config/crops.js`, so all label
 *     resolution flows through one source.
 *
 * New UI components SHOULD prefer `src/config/crops/index.js` for
 * label/image/lifecycle resolution, and only fall back to this
 * file for the icon/category UI metadata it owns. The CI drift
 * guard tracks any growth in this file's CROPS array.
 *
 * Shared Crop Dataset — single source of truth for all crop selectors.
 *
 * Structure per entry:
 *   code     — stable uppercase identifier, stored in DB
 *   name     — display name, A-Z sorted
 *   category — grouping key
 *
 * "OTHER" is always last in dropdowns.
 * One source of truth — every form and display imports from here.
 */

export const CROPS = [
  { code: 'ALFALFA',       name: 'Alfalfa',             category: 'forage' },
  { code: 'ALMOND',        name: 'Almond',              category: 'tree_crop' },
  { code: 'APPLE',         name: 'Apple',               category: 'fruit' },
  { code: 'APRICOT',       name: 'Apricot',             category: 'fruit' },
  { code: 'AVOCADO',       name: 'Avocado',             category: 'fruit' },

  { code: 'BANANA',        name: 'Banana',              category: 'fruit' },
  { code: 'BARLEY',        name: 'Barley',              category: 'cereal' },
  { code: 'BEAN',          name: 'Bean',                category: 'legume' },
  { code: 'BEETROOT',      name: 'Beetroot',            category: 'vegetable' },
  { code: 'BLACK_PEPPER',  name: 'Black Pepper',        category: 'spice' },
  { code: 'BLUEBERRY',     name: 'Blueberry',           category: 'fruit' },

  { code: 'CABBAGE',       name: 'Cabbage',             category: 'vegetable' },
  { code: 'CACAO',         name: 'Cacao',               category: 'cash_crop' },
  { code: 'CARROT',        name: 'Carrot',              category: 'vegetable' },
  { code: 'CASSAVA',       name: 'Cassava',             category: 'root_tuber' },
  { code: 'CAULIFLOWER',   name: 'Cauliflower',         category: 'vegetable' },
  { code: 'CHILI',         name: 'Chili Pepper',        category: 'vegetable' },
  { code: 'COCOA',         name: 'Cocoa',               category: 'cash_crop' },
  { code: 'COCONUT',       name: 'Coconut',             category: 'tree_crop' },
  { code: 'COFFEE',        name: 'Coffee',              category: 'cash_crop' },
  { code: 'CORN',          name: 'Corn (Maize)',        category: 'cereal' },
  { code: 'COTTON',        name: 'Cotton',              category: 'cash_crop' },
  { code: 'COWPEA',        name: 'Cowpea',              category: 'legume' },
  { code: 'CUCUMBER',      name: 'Cucumber',            category: 'vegetable' },

  { code: 'DATE',          name: 'Date',                category: 'fruit' },
  { code: 'DRAGON_FRUIT',  name: 'Dragon Fruit',        category: 'fruit' },

  { code: 'EGGPLANT',      name: 'Eggplant',            category: 'vegetable' },

  { code: 'FIG',           name: 'Fig',                 category: 'fruit' },

  { code: 'GARLIC',        name: 'Garlic',              category: 'vegetable' },
  { code: 'GINGER',        name: 'Ginger',              category: 'spice' },
  { code: 'GRAPE',         name: 'Grape',               category: 'fruit' },
  { code: 'GROUNDNUT',     name: 'Groundnut (Peanut)',  category: 'legume' },

  { code: 'KALE',          name: 'Kale',                category: 'vegetable' },

  { code: 'LETTUCE',       name: 'Lettuce',             category: 'vegetable' },

  { code: 'MAIZE',         name: 'Maize',               category: 'cereal' },
  { code: 'MANGO',         name: 'Mango',               category: 'fruit' },
  { code: 'MILLET',        name: 'Millet',              category: 'cereal' },
  { code: 'MUSHROOM',      name: 'Mushroom',            category: 'fungi' },

  { code: 'OKRA',          name: 'Okra',                category: 'vegetable' },
  { code: 'ONION',         name: 'Onion',               category: 'vegetable' },
  { code: 'ORANGE',        name: 'Orange',              category: 'fruit' },

  { code: 'PAPAYA',        name: 'Papaya',              category: 'fruit' },
  { code: 'PALM_OIL',      name: 'Palm Oil',            category: 'cash_crop' },
  { code: 'PEA',           name: 'Pea',                 category: 'legume' },
  { code: 'PEACH',         name: 'Peach',               category: 'fruit' },
  { code: 'PEAR',          name: 'Pear',                category: 'fruit' },
  { code: 'PEPPER',        name: 'Pepper',              category: 'vegetable' },
  { code: 'PINEAPPLE',     name: 'Pineapple',           category: 'fruit' },
  { code: 'PLANTAIN',      name: 'Plantain',            category: 'fruit' },
  { code: 'POTATO',        name: 'Potato',              category: 'root_tuber' },

  { code: 'RICE',          name: 'Rice',                category: 'cereal' },

  { code: 'SESAME',        name: 'Sesame',              category: 'oilseed' },
  { code: 'SORGHUM',       name: 'Sorghum',             category: 'cereal' },
  { code: 'SOYBEAN',       name: 'Soybean',             category: 'legume' },
  { code: 'SPINACH',       name: 'Spinach',             category: 'vegetable' },
  { code: 'SUGARCANE',     name: 'Sugarcane',           category: 'cash_crop' },
  { code: 'SUNFLOWER',     name: 'Sunflower',           category: 'oilseed' },
  { code: 'SWEET_POTATO',  name: 'Sweet Potato',        category: 'root_tuber' },

  { code: 'TOMATO',        name: 'Tomato',              category: 'vegetable' },
  { code: 'TEA',           name: 'Tea',                 category: 'cash_crop' },

  { code: 'WATERMELON',    name: 'Watermelon',          category: 'fruit' },
  { code: 'WHEAT',         name: 'Wheat',               category: 'cereal' },

  { code: 'YAM',           name: 'Yam',                 category: 'root_tuber' },
];

/**
 * Full A-Z crop list (without OTHER). Sorted alphabetically by name.
 */
export const ALL_CROPS = [...CROPS].sort((a, b) => a.name.localeCompare(b.name));

/**
 * Set of all valid crop codes for O(1) lookup.
 */
export const CROP_CODE_SET = new Set(CROPS.map(c => c.code));

/**
 * The "Other" entry — always last in dropdowns.
 */
export const OTHER_CROP = { code: 'OTHER', name: 'Other', category: 'other' };

/**
 * Full list with OTHER at the end. Use for dropdown rendering.
 */
export const ALL_CROPS_WITH_OTHER = [...ALL_CROPS, OTHER_CROP];

/**
 * Category display labels.
 */
export const CATEGORY_LABELS = {
  cereal:     'Cereals & Grains',
  legume:     'Legumes & Pulses',
  root_tuber: 'Root & Tuber Crops',
  cash_crop:  'Cash Crops',
  fruit:      'Fruits',
  vegetable:  'Vegetables',
  spice:      'Spices',
  oilseed:    'Oilseeds',
  forage:     'Forage',
  tree_crop:  'Tree Crops',
  fungi:      'Fungi',
  other:      'Other',
};

// ── Lookup helpers ───────────────────────────────────────────

/**
 * Look up a crop by code (case-insensitive). Returns crop object or null.
 */
export function getCropByCode(code) {
  if (!code) return null;
  const upper = code.toUpperCase().trim();
  return CROPS.find(c => c.code === upper) || null;
}

/**
 * Backward-compatible lookup: accepts old lowercase values (e.g. "maize")
 * AND new uppercase codes (e.g. "MAIZE"). Returns crop object or null.
 */
export function getCropByValue(value) {
  if (!value) return null;
  const upper = value.toUpperCase().trim();
  // Handle old underscore-style lowercase: "sweet_potato" → "SWEET_POTATO"
  return CROPS.find(c => c.code === upper) || null;
}

/**
 * Get display name for a crop code/value, with fallbacks.
 * Handles: "MAIZE" → "Maize", "OTHER" → "Other", "OTHER:Teff" → "Teff",
 * "maize" (legacy) → "Maize", unknown → raw value as-is.
 *
 * Optional `lang` parameter translates to the active UI language
 * (Hindi, Swahili, Hausa, Twi, French, English). When the language
 * table doesn't have the crop, falls back to the English catalog
 * here, then finally to the raw value. Callers inside a React
 * render can use the `useCropLabel` hook instead for automatic
 * re-render on language switch.
 */
// Local copy of the humanise routine the resolver uses to detect
// "the localised lookup just gave us back a humanised form" — used
// to reject bogus matches like "Black Pepper" for unknown code
// "BLACK_PEPPER" without rejecting real translations like "मक्का"
// for known code "MAIZE".
function _humanize(value) {
  if (!value) return '';
  const tail = String(value).split('.').pop() || value;
  const spaced = tail.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  if (!spaced) return '';
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

export function getCropLabel(value, lang = 'en') {
  if (!value) return '';
  // Structured "Other" → extract custom name (language-agnostic)
  if (String(value).toUpperCase().startsWith('OTHER:')) {
    return String(value).slice(6).trim() || 'Other';
  }
  if (String(value).toUpperCase() === 'OTHER') return 'Other';

  // 1) Prefer the language-aware catalog in config/crops.js so every
  //    other language (hi/sw/ha/tw/fr) resolves correctly. It
  //    lowercases the code internally via normalizeCrop, so
  //    'MAIZE' / 'Maize' / 'maize' all resolve to the same row.
  const localised = getLangCropLabel(value, lang);
  // PILOT BUG (Apr 2026): the previous version had
  //   `localised && localised !== value && !/^[A-Z_]+$/.test(value)`
  // The uppercase guard was meant to skip stale humanised
  // results for unmapped codes — but it ALSO rejected valid
  // localised values for known uppercase storage codes. Hindi
  // UIs were showing "MAIZE → Maize" instead of "मक्का"
  // because `localised` was correctly 'मक्का' but the regex
  // matched 'MAIZE' and the branch refused to return it.
  //
  // New rule: accept the localised value whenever it differs
  // from the raw input AND from the input's humanised form
  // (the catch for unmapped codes still works — humanise(BLACK_
  // PEPPER) = "Black Pepper", and we won't accept that bogus
  // hit; getCropByValue then resolves it via the legacy CROPS
  // catalog below).
  if (localised && localised !== value && localised !== _humanize(value)) {
    return localised;
  }

  // 2) Legacy English catalog (uppercase codes). Still the only
  //    source of truth for crops we haven't added to the
  //    config/crops.js table yet (APPLE, ALMOND, BLUEBERRY, etc).
  const crop = getCropByValue(value);
  if (crop) return crop.name;

  // 3) Fall back to the localised label (even if it just humanised
  //    the code) — better than leaking the raw UPPERCASE value.
  return localised || value;
}

/**
 * useCropLabel — React hook that returns the display label in the
 * active UI language. Re-renders automatically when the farmer
 * switches languages. Use this inside a React component; for pure
 * / non-React code paths use `getCropLabel(value, lang)`.
 */
export function useCropLabel(value) {
  const { lang } = useTranslation();
  return getCropLabel(value, lang);
}

// ── Crop Icon Registry ──────────────────────────────────────
// Priority: crop-specific → category fallback → generic 🌱

/**
 * Crop-specific icon map. Keyed by crop CODE (uppercase).
 * Every built-in crop gets the best available emoji.
 */
const CROP_ICONS = {
  // Cereals & Grains
  BARLEY:       '🌾',
  CORN:         '🌽',
  MAIZE:        '🌽',
  MILLET:       '🌾',
  RICE:         '🍚',
  SORGHUM:      '🌾',
  WHEAT:        '🌾',

  // Legumes & Pulses
  BEAN:         '🫘',
  COWPEA:       '🫘',
  GROUNDNUT:    '🥜',
  PEA:          '🫛',
  SOYBEAN:      '🫘',

  // Root & Tuber
  CASSAVA:      '🥔',
  POTATO:       '🥔',
  SWEET_POTATO: '🍠',
  YAM:          '🍠',

  // Fruits
  APPLE:        '🍎',
  APRICOT:      '🍑',
  AVOCADO:      '🥑',
  BANANA:       '🍌',
  BLUEBERRY:    '🫐',
  DATE:         '🌴',
  DRAGON_FRUIT: '🐉',
  FIG:          '🍈',
  GRAPE:        '🍇',
  MANGO:        '🥭',
  ORANGE:       '🍊',
  PAPAYA:       '🍈',
  PEACH:        '🍑',
  PEAR:         '🍐',
  PINEAPPLE:    '🍍',
  PLANTAIN:     '🍌',
  WATERMELON:   '🍉',

  // Vegetables
  BEETROOT:     '🥬',
  CABBAGE:      '🥬',
  CARROT:       '🥕',
  CAULIFLOWER:  '🥦',
  CHILI:        '🌶️',
  CUCUMBER:     '🥒',
  EGGPLANT:     '🍆',
  GARLIC:       '🧄',
  KALE:         '🥬',
  LETTUCE:      '🥬',
  OKRA:         '🟢',
  ONION:        '🧅',
  PEPPER:       '🫑',
  SPINACH:      '🥬',
  TOMATO:       '🍅',

  // Spices
  BLACK_PEPPER: '🌶️',
  GINGER:       '🫚',

  // Cash Crops
  CACAO:        '🍫',
  COCOA:        '🍫',
  COFFEE:       '☕',
  COTTON:       '🏵️',
  PALM_OIL:     '🌴',
  SUGARCANE:    '🎋',
  TEA:          '🍵',

  // Oilseeds
  SESAME:       '🌻',
  SUNFLOWER:    '🌻',

  // Tree Crops
  ALMOND:       '🌰',
  COCONUT:      '🥥',

  // Forage
  ALFALFA:      '🌿',

  // Fungi
  MUSHROOM:     '🍄',
};

/**
 * Category fallback icons — used when a crop has no specific icon.
 */
const CATEGORY_ICONS = {
  cereal:     '🌾',
  legume:     '🫘',
  root_tuber: '🥔',
  cash_crop:  '☕',
  fruit:      '🍎',
  vegetable:  '🥬',
  spice:      '🌶️',
  oilseed:    '🌻',
  forage:     '🌿',
  tree_crop:  '🌳',
  fungi:      '🍄',
  other:      '🌱',
};

/** Generic fallback when nothing else matches. */
const GENERIC_ICON = '🌱';

/**
 * Alias map for common naming variations.
 * Maps normalized name → crop CODE for icon lookup only.
 */
const CROP_ALIASES = {
  beans:          'BEAN',
  peanut:         'GROUNDNUT',
  peanuts:        'GROUNDNUT',
  groundnuts:     'GROUNDNUT',
  'chili pepper': 'CHILI',
  'chilli':       'CHILI',
  'bell pepper':  'PEPPER',
  manioc:         'CASSAVA',
  tapioca:        'CASSAVA',
  'sweet potatoes': 'SWEET_POTATO',
  potatoes:       'POTATO',
  yams:           'YAM',
  plantains:      'PLANTAIN',
  tomatoes:       'TOMATO',
  onions:         'ONION',
  carrots:        'CARROT',
  grapes:         'GRAPE',
  oranges:        'ORANGE',
  mangoes:        'MANGO',
  apples:         'APPLE',
  bananas:        'BANANA',
  peas:           'PEA',
  soybeans:       'SOYBEAN',
  almonds:        'ALMOND',
  mushrooms:      'MUSHROOM',
  cucumbers:      'CUCUMBER',
  dates:          'DATE',
  figs:           'FIG',
  peaches:        'PEACH',
  pears:          'PEAR',
  cabbages:       'CABBAGE',
};

/**
 * Normalize a crop name for icon lookup.
 * Trims, lowercases, collapses whitespace.
 */
export function normalizeCropName(name) {
  if (!name) return '';
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Get the icon for a crop value.
 *
 * Priority:
 *   1. Crop-specific icon (by code)
 *   2. Alias lookup (by normalized name)
 *   3. Category fallback
 *   4. Generic plant fallback 🌱
 */
export function getCropIcon(value) {
  if (!value) return GENERIC_ICON;

  const upper = value.toUpperCase().trim();

  // Handle custom crops: "OTHER:Teff" → try alias lookup for "teff"
  if (upper.startsWith('OTHER:')) {
    const customName = normalizeCropName(value.slice(6));
    const aliasCode = CROP_ALIASES[customName];
    if (aliasCode && CROP_ICONS[aliasCode]) return CROP_ICONS[aliasCode];
    return GENERIC_ICON;
  }
  if (upper === 'OTHER') return GENERIC_ICON;

  // 1. Direct crop-specific icon by code
  if (CROP_ICONS[upper]) return CROP_ICONS[upper];

  // 2. Lookup by crop object — try code match, then alias
  const crop = getCropByValue(value);
  if (crop) {
    if (CROP_ICONS[crop.code]) return CROP_ICONS[crop.code];
    // 3. Category fallback
    return CATEGORY_ICONS[crop.category] || GENERIC_ICON;
  }

  // 4. Alias lookup for unknown values (e.g. "beans", "peanut")
  const normalized = normalizeCropName(value);
  const aliasCode = CROP_ALIASES[normalized];
  if (aliasCode && CROP_ICONS[aliasCode]) return CROP_ICONS[aliasCode];

  return GENERIC_ICON;
}

/** Export for testing/external use */
export { CROP_ICONS, CATEGORY_ICONS };

// ── Validation helpers ───────────────────────────────────────

/**
 * Check if a value is a valid crop selection.
 * Accepts: known codes, "OTHER", "OTHER:CustomName", and legacy lowercase.
 */
export function isValidCrop(value) {
  if (!value) return false;
  const upper = value.toUpperCase().trim();
  if (upper === 'OTHER') return true;
  if (upper.startsWith('OTHER:')) return upper.slice(6).trim().length >= 2;
  return CROP_CODE_SET.has(upper);
}

// ── Structured "Other" helpers ───────────────────────────────

/**
 * Parse a stored crop value into structured form.
 *
 * Returns: { cropCode, cropName, customCropName, isCustomCrop }
 *
 * Examples:
 *   "MAIZE"        → { cropCode: "MAIZE",  cropName: "Maize",  customCropName: null,   isCustomCrop: false }
 *   "OTHER:Teff"   → { cropCode: "OTHER",  cropName: "Other",  customCropName: "Teff", isCustomCrop: true  }
 *   "OTHER"        → { cropCode: "OTHER",  cropName: "Other",  customCropName: null,   isCustomCrop: true  }
 *   ""             → { cropCode: "",        cropName: "",       customCropName: null,   isCustomCrop: false }
 */
export function parseCropValue(stored) {
  if (!stored) return { cropCode: '', cropName: '', customCropName: null, isCustomCrop: false };
  const upper = stored.toUpperCase().trim();
  if (upper.startsWith('OTHER:')) {
    const custom = stored.slice(6).trim();
    return { cropCode: 'OTHER', cropName: 'Other', customCropName: custom || null, isCustomCrop: true };
  }
  if (upper === 'OTHER') {
    return { cropCode: 'OTHER', cropName: 'Other', customCropName: null, isCustomCrop: true };
  }
  const crop = getCropByValue(stored);
  return {
    cropCode: crop ? crop.code : stored,
    cropName: crop ? crop.name : stored,
    customCropName: null,
    isCustomCrop: false,
  };
}

/**
 * Build a stored value for "Other" with a custom name.
 * Returns "OTHER:CustomName".
 */
export function buildOtherCropValue(customName) {
  const trimmed = (customName || '').trim();
  return trimmed ? `OTHER:${trimmed}` : 'OTHER';
}

/**
 * getCropLabelSafe — leak-aware label resolver.
 *
 * Wraps the existing `getCropLabel` so callers in farmer-facing
 * surfaces get:
 *   1. A dev-time `[CROP_LEAK]` warning when a non-canonical value
 *      slips through (via `assertNormalizedCrop`).
 *   2. A stricter dev marker `[MISSING_CROP_LABEL:<id>]` when the
 *      requested language has no entry, so screenshot QA spots
 *      the gap. Production: silently falls back to English label,
 *      then to the normalised id, never empty, never throws.
 *
 * Architecture
 *   • Does NOT replace `getCropLabel`. Plain `getCropLabel` stays
 *     the canonical resolver; this is a safety wrapper.
 *   • Does NOT mutate stored data — operates on display values.
 *   • Optional `t` parameter is reserved for callers that want to
 *     route through the i18n table for an exotic label key. The
 *     shipped CROP_LABELS_BY_LANG already has full coverage so
 *     `t` is effectively unused today; kept for API forward-compat.
 *
 *   getCropLabelSafe('corn', 'hi')         → "मक्का"
 *   getCropLabelSafe('Cassava root', 'tw') → "Bankye"
 *   getCropLabelSafe('spaghetti', 'hi')    → "Spaghetti" + dev [CROP_LEAK]
 *   getCropLabelSafe('', 'hi')             → ""
 */
function _isDevForCropLabelSafe() {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV) return true;
  } catch { /* SSR / non-Vite */ }
  try {
    if (typeof process !== 'undefined' && process.env) {
      if (process.env.NODE_ENV === 'development') return true;
      if (process.env.NODE_ENV === 'test')        return true;
      if (process.env.VITE_I18N_STRICT === '1')   return true;
    }
  } catch { /* ignore */ }
  return false;
}
const _warnedLabelMisses = new Set();

// Track which (id × lang) pairs have already issued a "fallback used"
// warning, so a busy dashboard doesn't flood the console.
const _warnedFallbackUsed = new Set();

export function getCropLabelSafe(value, lang = 'en', t = null) {
  if (!value) return '';
  // 1. Leak detection (dev-only console.warn; returns value unchanged).
  assertNormalizedCrop(value);

  // Pre-compute the normalised id once — used for both the
  // fallback-detection check and any miss path.
  const norm = normalizeCrop(value) || String(value);

  // 2. Existing label resolver. It already handles alias resolution,
  //    locale fallback, English fallback, and humanised last-resort.
  const label = getCropLabel(value, lang);
  if (label && !label.startsWith('[MISSING_CROP_LABEL:')) {
    // 2a. Spec hardening — if the resolved label is identical to the
    //     normalised id (e.g. resolver fell through to humanised
    //     code form because no entry exists), surface a one-time
    //     `[FALLBACK_USED]` warning so QA can see when an English
    //     fallback / humanised id is shipping to a non-English user.
    if (label === norm) {
      const memoKey = `${norm}:${lang}`;
      if (!_warnedFallbackUsed.has(memoKey)) {
        _warnedFallbackUsed.add(memoKey);
        try { console.warn('[FALLBACK_USED]', norm, '(lang=' + lang + ')'); }
        catch { /* never crash */ }
      }
    }
    return label;
  }

  // 3. The inner resolver returned its dev marker. Re-emit with the
  //    normalised id so screenshot QA sees the canonical form.
  const dev = _isDevForCropLabelSafe();

  // Production: prefer the English label from the canonical map,
  // then the normalised id, then the raw value. Never empty.
  if (!dev) {
    try {
      const enLabel = _cropsInternal.CROP_LABELS_BY_LANG.en[norm];
      if (enLabel) return enLabel;
    } catch { /* defensive */ }
    return norm || String(value);
  }

  // Dev: surface the gap, but warn once per id × lang.
  const memoKey = `${norm}:${lang}`;
  if (!_warnedLabelMisses.has(memoKey)) {
    _warnedLabelMisses.add(memoKey);
    try {
      console.warn(`[getCropLabelSafe] no label for "${norm}" in lang="${lang}". `
        + 'Add an entry to CROP_LABELS_BY_LANG in src/config/crops.js.');
    } catch { /* never crash */ }
  }
  // Optional t() route for callers that wanted a key lookup. We do
  // NOT call t() unless the caller passed one in, so we don't
  // accidentally hit the translation table for crop ids the
  // canonical map already owns.
  if (typeof t === 'function') {
    try {
      const tKey = `crop.${norm}`;
      const tVal = t(tKey);
      if (tVal && !tVal.startsWith('[MISSING:') && tVal !== tKey) return tVal;
    } catch { /* ignore */ }
  }
  return `[MISSING_CROP_LABEL:${norm}]`;
}

/**
 * Normalize a legacy lowercase crop value to the new uppercase code format.
 * "maize" → "MAIZE", "sweet_potato" → "SWEET_POTATO", "other:Teff" → "OTHER:Teff".
 * Unknown values are returned as-is for backward compatibility.
 */
export function normalizeCropCode(value) {
  if (!value) return '';
  // Preserve "OTHER:Custom" casing on the custom part
  if (value.toUpperCase().startsWith('OTHER:')) {
    return `OTHER:${value.slice(6)}`;
  }
  const upper = value.toUpperCase().trim();
  if (CROP_CODE_SET.has(upper) || upper === 'OTHER') return upper;
  return value; // unknown → return as-is
}
