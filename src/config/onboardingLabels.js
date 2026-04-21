/**
 * onboardingLabels.js — centralised translation + normalisation for
 * farmType, sizeUnit, and cropStage. Mirrors the pattern in
 * src/config/crops.js so every canonical code has:
 *
 *   • an English label           (stable, audit-friendly)
 *   • per-language translations  (render-time only)
 *   • a normalizer               (old English values → canonical key)
 *   • a useXxxLabel() React hook (auto-re-render on language switch)
 *
 * Canonical storage (NEVER translated text):
 *   farmType  ∈ 'backyard' | 'small_farm' | 'commercial'
 *   sizeUnit  ∈ 'ACRE' | 'HECTARE'
 *   cropStage ∈ 'planning' | 'land_preparation' | 'planting' |
 *               'germination' | 'vegetative' | 'flowering' |
 *               'fruiting' | 'harvest' | 'post_harvest'
 *
 * These canonical values are what the task engine + progress engine
 * + signal engine already read — do NOT change them without a
 * coordinated rewrite of farmTypeBehavior.js, dailyTaskEngine.js,
 * etc. Rename locally if the spec calls it 'small' but the storage
 * stays 'small_farm'.
 */

import { useTranslation } from '../i18n/index.js';

// ─── Farm type ───────────────────────────────────────────────────
export const FARM_TYPES = Object.freeze(['backyard', 'small_farm', 'commercial']);

const FARM_TYPE_LABELS_BY_LANG = Object.freeze({
  en: Object.freeze({
    backyard:   'Backyard / Home',
    small_farm: 'Small farm',
    commercial: 'Commercial farm',
  }),
  fr: Object.freeze({
    backyard:   'Potager domestique',
    small_farm: 'Petite exploitation',
    commercial: 'Exploitation commerciale',
  }),
  sw: Object.freeze({
    backyard:   'Bustani ya nyumbani',
    small_farm: 'Shamba dogo',
    commercial: 'Shamba la biashara',
  }),
  ha: Object.freeze({
    backyard:   'Lambun gida',
    small_farm: 'Karamar gona',
    commercial: 'Babbar gona',
  }),
  tw: Object.freeze({
    backyard:   'Fie afuo',
    small_farm: 'Afuo ket\u025Bw\u025Ba',
    commercial: 'Nsesa afuo',
  }),
  hi: Object.freeze({
    backyard:   '\u0918\u0930\u0947\u0932\u0942 \u092C\u0917\u0940\u091A\u093E',
    small_farm: '\u091B\u094B\u091F\u093E \u0916\u0947\u0924',
    commercial: '\u0935\u093E\u0923\u093F\u091C\u094D\u092F\u093F\u0915 \u0916\u0947\u0924',
  }),
});

// Accept old / spec-shorthand forms and collapse them to canonical.
const FARM_TYPE_ALIASES = Object.freeze({
  backyard:           'backyard',
  backyard_home:      'backyard',
  home:               'backyard',
  home_food:          'backyard',
  small:              'small_farm',
  small_farm:         'small_farm',
  sell_locally:       'small_farm',
  commercial:         'commercial',
  commercial_farm:    'commercial',
  large:              'commercial',
  enterprise:         'commercial',
});

export function normalizeFarmType(value) {
  if (value == null) return 'small_farm';
  const raw = String(value).toLowerCase().trim().replace(/[-\s]+/g, '_');
  if (FARM_TYPE_ALIASES[raw]) return FARM_TYPE_ALIASES[raw];
  // Reverse-map from an English label that might be stored on an
  // old record ("Small Farm", "Commercial farm"). Covers records
  // written before farmTypeBehavior canonical codes existed.
  for (const lang of Object.keys(FARM_TYPE_LABELS_BY_LANG)) {
    const table = FARM_TYPE_LABELS_BY_LANG[lang];
    for (const [code, label] of Object.entries(table)) {
      if (String(label).toLowerCase() === String(value).toLowerCase()) return code;
    }
  }
  return 'small_farm';
}

export function getFarmTypeLabel(code, lang = 'en') {
  const norm = normalizeFarmType(code);
  const table = FARM_TYPE_LABELS_BY_LANG[lang] || FARM_TYPE_LABELS_BY_LANG.en;
  return table[norm] || FARM_TYPE_LABELS_BY_LANG.en[norm] || 'Small farm';
}

export function useFarmTypeLabel(code) {
  const { lang } = useTranslation();
  return getFarmTypeLabel(code, lang);
}

// ─── Size unit ───────────────────────────────────────────────────
export const SIZE_UNITS = Object.freeze(['ACRE', 'HECTARE']);

const SIZE_UNIT_LABELS_BY_LANG = Object.freeze({
  en: Object.freeze({ ACRE: 'Acres',  HECTARE: 'Hectares' }),
  fr: Object.freeze({ ACRE: 'Acres',  HECTARE: 'Hectares' }),
  sw: Object.freeze({ ACRE: 'Ekari',  HECTARE: 'Hekta'   }),
  ha: Object.freeze({ ACRE: 'Ek\u1E69a', HECTARE: 'Hekta' }),
  tw: Object.freeze({ ACRE: 'Ɛka',    HECTARE: 'Hekta'   }),
  hi: Object.freeze({
    ACRE:    '\u090F\u0915\u095C',
    HECTARE: '\u0939\u0947\u0915\u094D\u091F\u0947\u092F\u0930',
  }),
});

const SIZE_UNIT_ALIASES = Object.freeze({
  acre: 'ACRE', acres: 'ACRE', ac: 'ACRE', ACRE: 'ACRE',
  hectare: 'HECTARE', hectares: 'HECTARE', ha: 'HECTARE', HECTARE: 'HECTARE',
  // common French / Swahili storage drift
  ekari: 'ACRE', hekta: 'HECTARE',
});

export function normalizeSizeUnit(value) {
  if (value == null) return 'ACRE';
  const raw = String(value).trim();
  if (SIZE_UNIT_ALIASES[raw]) return SIZE_UNIT_ALIASES[raw];
  const lower = raw.toLowerCase();
  if (SIZE_UNIT_ALIASES[lower]) return SIZE_UNIT_ALIASES[lower];
  return 'ACRE';
}

export function getUnitLabel(code, lang = 'en') {
  const norm = normalizeSizeUnit(code);
  const table = SIZE_UNIT_LABELS_BY_LANG[lang] || SIZE_UNIT_LABELS_BY_LANG.en;
  return table[norm] || SIZE_UNIT_LABELS_BY_LANG.en[norm] || 'Acres';
}

export function useUnitLabel(code) {
  const { lang } = useTranslation();
  return getUnitLabel(code, lang);
}

// ─── Crop stage ──────────────────────────────────────────────────
export const CROP_STAGES = Object.freeze([
  'planning', 'land_preparation', 'planting', 'germination',
  'vegetative', 'flowering', 'fruiting', 'harvest', 'post_harvest',
]);

const CROP_STAGE_LABELS_BY_LANG = Object.freeze({
  en: Object.freeze({
    planning:         'Planning',
    land_preparation: 'Land preparation',
    planting:         'Planting',
    germination:      'Germination',
    vegetative:       'Vegetative',
    flowering:        'Flowering',
    fruiting:         'Fruiting',
    harvest:          'Harvest',
    post_harvest:     'Post-harvest',
  }),
  fr: Object.freeze({
    planning:         'Planification',
    land_preparation: 'Pr\u00E9paration du terrain',
    planting:         'Plantation',
    germination:      'Germination',
    vegetative:       'Croissance v\u00E9g\u00E9tative',
    flowering:        'Floraison',
    fruiting:         'Fructification',
    harvest:          'R\u00E9colte',
    post_harvest:     'Apr\u00E8s-r\u00E9colte',
  }),
  sw: Object.freeze({
    planning:         'Kupanga',
    land_preparation: 'Kuandaa shamba',
    planting:         'Kupanda',
    germination:      'Kuchipua',
    vegetative:       'Kukua',
    flowering:        'Kutoa maua',
    fruiting:         'Kutoa matunda',
    harvest:          'Kuvuna',
    post_harvest:     'Baada ya kuvuna',
  }),
  ha: Object.freeze({
    planning:         'Tsari',
    land_preparation: 'Shirya gona',
    planting:         'Shuka',
    germination:      'Tsiro',
    vegetative:       'Ci gaba',
    flowering:        'Fure',
    fruiting:         '\u2019Ya\u2019yan itace',
    harvest:          'Girbi',
    post_harvest:     'Bayan girbi',
  }),
  tw: Object.freeze({
    planning:         'Nhyehy\u025B\u025B',
    land_preparation: 'Afuo ho nhyehy\u025B\u025B',
    planting:         'Aduaa',
    germination:      'Nhyiren',
    vegetative:       'Nkɔso',
    flowering:        'Nhwiren',
    fruiting:         'Aduaba',
    harvest:          'Twa',
    post_harvest:     'Twa akyi',
  }),
  hi: Object.freeze({
    planning:         '\u092F\u094B\u091C\u0928\u093E',
    land_preparation: '\u0916\u0947\u0924 \u0915\u0940 \u0924\u0948\u092F\u093E\u0930\u0940',
    planting:         '\u092C\u094B\u0935\u093E\u0908',
    germination:      '\u0905\u0902\u0915\u0941\u0930\u0923',
    vegetative:       '\u0935\u093E\u0928\u0938\u094D\u092A\u0924\u093F\u0915',
    flowering:        '\u092B\u0942\u0932 \u0906\u0928\u093E',
    fruiting:         '\u092B\u0932 \u0906\u0928\u093E',
    harvest:          '\u0915\u091F\u093E\u0908',
    post_harvest:     '\u0915\u091F\u093E\u0908 \u0915\u0947 \u092C\u093E\u0926',
  }),
});

const CROP_STAGE_ALIASES = Object.freeze({
  planning: 'planning',
  land_prep: 'land_preparation', land_preparation: 'land_preparation',
  planting: 'planting',
  germination: 'germination', germinate: 'germination',
  vegetative: 'vegetative', growth: 'vegetative', growing: 'vegetative',
  flowering: 'flowering', bloom: 'flowering',
  fruiting: 'fruiting', fruit: 'fruiting',
  harvest: 'harvest', harvesting: 'harvest',
  post_harvest: 'post_harvest', postharvest: 'post_harvest', 'post-harvest': 'post_harvest',
});

export function normalizeCropStage(value) {
  if (value == null) return 'planning';
  const raw = String(value).toLowerCase().trim().replace(/[-\s]+/g, '_');
  if (CROP_STAGE_ALIASES[raw]) return CROP_STAGE_ALIASES[raw];
  // Reverse-map from English label on old records.
  for (const lang of Object.keys(CROP_STAGE_LABELS_BY_LANG)) {
    const table = CROP_STAGE_LABELS_BY_LANG[lang];
    for (const [code, label] of Object.entries(table)) {
      if (String(label).toLowerCase() === String(value).toLowerCase()) return code;
    }
  }
  return 'planning';
}

export function getCropStageLabel(code, lang = 'en') {
  const norm = normalizeCropStage(code);
  const table = CROP_STAGE_LABELS_BY_LANG[lang] || CROP_STAGE_LABELS_BY_LANG.en;
  return table[norm] || CROP_STAGE_LABELS_BY_LANG.en[norm] || 'Planning';
}

export function useCropStageLabel(code) {
  const { lang } = useTranslation();
  return getCropStageLabel(code, lang);
}

export const _internal = Object.freeze({
  FARM_TYPE_LABELS_BY_LANG,
  SIZE_UNIT_LABELS_BY_LANG,
  CROP_STAGE_LABELS_BY_LANG,
  FARM_TYPE_ALIASES,
  SIZE_UNIT_ALIASES,
  CROP_STAGE_ALIASES,
});
