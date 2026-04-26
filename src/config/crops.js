/**
 * crops.js — multilingual label table + searchable catalog layer.
 *
 * NOTE on prior "deprecated" framing
 *   An earlier sprint marked this file as a duplicate-of-registry to
 *   be deleted. That was incorrect. This file owns the per-language
 *   crop label tables (CROP_LABELS_BY_LANG, accessed via _internal)
 *   that src/config/crops/cropRegistry.js consumes at composition
 *   time (registry.js:58). It is a LAYER beneath the registry, not
 *   a duplicate.
 *
 *   Surface area used by the registry:
 *     getCropLabel(code, lang)  → resolves localised labels
 *     _internal.CROP_LABELS_BY_LANG → canonical i18n source for crops
 *     normalizeCrop(value)      → normalises legacy uppercase codes
 *
 *   New UI code should still prefer src/config/crops/index.js (the
 *   canonical barrel) so call sites are insulated from this
 *   internal shape, but THIS file is permanent infrastructure, not
 *   legacy code waiting for deletion.
 *
 * crops.js — searchable catalog of common crops, shared by every
 * "pick a crop" input (NewFarmScreen, EditFarmScreen, CropFit).
 *
 *   COMMON_CROPS             → frozen list of { code, label }
 *                              (label stays English — for operator/
 *                              ops tooling that reads the raw module)
 *   searchCrops(query)       → filtered list (starts-with wins over contains)
 *   normalizeCrop(val)       → lowercase code suitable for storage
 *   getCropLabel(code, lang) → localised display label with safe fallbacks
 *   useCropLabel(code)       → React hook — reads the active language
 *                              from i18n context, re-renders on switch
 *   CROP_OTHER               → the sentinel 'other' option
 *
 * The DISPLAY label is translated at render time. The STORED value
 * is always the lowercase code (e.g. `cassava`). Old records that
 * accidentally stored a label like "Cassava" are collapsed back to
 * the code by `normalizeCrop`, so no migration is needed.
 */

import { useTranslation } from '../i18n/index.js';
// Import the canonical alias map so normalizeCrop resolves
// synonyms (corn/manioc/peanut/chili/...) without duplicating the
// table here. The alias map is read-only at load time.
import { _internal as _aliasInternal } from './crops/cropAliases.js';
const ALIAS_MAP = new Map(Object.entries(_aliasInternal.ALIASES));

// Keep labels English here so operators can audit raw data easily.
// UI components should call getCropLabel(code, lang) or useCropLabel
// so farmers see the label in their language.
export const COMMON_CROPS = Object.freeze([
  ['maize',      'Maize (corn)'],
  ['rice',       'Rice'],
  ['wheat',      'Wheat'],
  ['sorghum',    'Sorghum'],
  ['millet',     'Millet'],
  ['cassava',    'Cassava'],
  ['yam',        'Yam'],
  ['potato',     'Potato'],
  ['sweet_potato','Sweet potato'],
  ['beans',      'Beans'],
  ['soybean',    'Soybean'],
  ['groundnut',  'Groundnut / peanut'],
  ['cowpea',     'Cowpea'],
  ['chickpea',   'Chickpea'],
  ['lentil',     'Lentil'],
  ['tomato',     'Tomato'],
  ['onion',      'Onion'],
  ['pepper',     'Pepper / chili'],
  ['cabbage',    'Cabbage'],
  ['carrot',     'Carrot'],
  ['okra',       'Okra'],
  ['spinach',    'Spinach / leafy greens'],
  ['cucumber',   'Cucumber'],
  ['watermelon', 'Watermelon'],
  ['plantain',   'Plantain'],
  ['banana',     'Banana'],
  ['mango',      'Mango'],
  ['orange',     'Orange / citrus'],
  ['avocado',    'Avocado'],
  ['coffee',     'Coffee'],
  ['tea',        'Tea'],
  ['cocoa',      'Cocoa'],
  ['cotton',     'Cotton'],
  ['sugarcane',  'Sugarcane'],
  ['sunflower',  'Sunflower'],
  ['sesame',     'Sesame'],
  ['tobacco',    'Tobacco'],
  // Newly added — canonical crops that previously had no entry in
  // CROP_LABELS_BY_LANG and only resolved via the fallback humaniser.
  // Adding them here AND in the per-language tables below gives Hindi
  // / Twi / Swahili / Hausa / French farmers a real localised label.
  ['eggplant',   'Eggplant'],
  ['ginger',     'Ginger'],
  ['garlic',     'Garlic'],
  ['lettuce',    'Lettuce'],
  ['oil_palm',   'Oil palm'],
  ['other',      'Other'],
].map(([code, label]) => Object.freeze({ code, label })));

export const CROP_OTHER = 'other';

const CODES = new Set(COMMON_CROPS.map((c) => c.code));

// ─── Localised label table ──────────────────────────────────────
// Keys are the same `code` values stored in the farm row. English
// falls back from the COMMON_CROPS list so we only hand-translate
// the non-English strings here. Any missing locale falls back to
// English at lookup time (see getCropLabel).
//
// Additional locales can be added without touching call sites — the
// helper below reads the table dynamically.
const EN_LABELS = Object.freeze(Object.fromEntries(
  COMMON_CROPS.map((c) => [c.code, c.label]),
));

const CROP_LABELS_BY_LANG = Object.freeze({
  en: EN_LABELS,

  fr: Object.freeze({
    maize: 'Ma\u00EFs', rice: 'Riz', wheat: 'Bl\u00E9',
    sorghum: 'Sorgho', millet: 'Millet', cassava: 'Manioc',
    yam: 'Igname', potato: 'Pomme de terre',
    sweet_potato: 'Patate douce', beans: 'Haricots',
    soybean: 'Soja', groundnut: 'Arachide', cowpea: 'Ni\u00E9b\u00E9',
    chickpea: 'Pois chiche', lentil: 'Lentille',
    tomato: 'Tomate', onion: 'Oignon', pepper: 'Piment',
    cabbage: 'Chou', carrot: 'Carotte', okra: 'Gombo',
    spinach: '\u00C9pinard', cucumber: 'Concombre',
    watermelon: 'Past\u00E8que', plantain: 'Plantain',
    banana: 'Banane', mango: 'Mangue', orange: 'Orange',
    avocado: 'Avocat', coffee: 'Caf\u00E9', tea: 'Th\u00E9',
    cocoa: 'Cacao', cotton: 'Coton', sugarcane: 'Canne \u00E0 sucre',
    sunflower: 'Tournesol', sesame: 'S\u00E9same', tobacco: 'Tabac',
    eggplant: 'Aubergine', ginger: 'Gingembre', garlic: 'Ail',
    lettuce: 'Laitue', oil_palm: 'Palmier \u00E0 huile',
    other: 'Autre',
  }),

  sw: Object.freeze({
    maize: 'Mahindi', rice: 'Mpunga', wheat: 'Ngano',
    sorghum: 'Mtama', millet: 'Uwele', cassava: 'Muhogo',
    yam: 'Viazi vikuu', potato: 'Viazi', sweet_potato: 'Viazi vitamu',
    beans: 'Maharagwe', soybean: 'Soya', groundnut: 'Karanga',
    cowpea: 'Kunde',
    chickpea: 'Mbaazi', lentil: 'Dengu',
    tomato: 'Nyanya', onion: 'Vitunguu',
    pepper: 'Pilipili', cabbage: 'Kabeji', carrot: 'Karoti',
    okra: 'Bamia', spinach: 'Mchicha', cucumber: 'Tango',
    watermelon: 'Tikiti maji', plantain: 'Ndizi za kupika',
    banana: 'Ndizi', mango: 'Embe', orange: 'Chungwa',
    avocado: 'Parachichi', coffee: 'Kahawa', tea: 'Chai',
    cocoa: 'Kakao', cotton: 'Pamba', sugarcane: 'Miwa',
    sunflower: 'Alizeti', sesame: 'Ufuta', tobacco: 'Tumbaku',
    eggplant: 'Bilinganya', ginger: 'Tangawizi', garlic: 'Kitunguu saumu',
    lettuce: 'Saladi', oil_palm: 'Mchikichi',
    other: 'Nyingine',
  }),

  ha: Object.freeze({
    maize: 'Masara', rice: 'Shinkafa', wheat: 'Alkama',
    sorghum: 'Dawa', millet: 'Gero', cassava: 'Rogo',
    yam: 'Doya', potato: 'Dankali', sweet_potato: 'Dankalin Turawa',
    beans: 'Wake', soybean: 'Soya', groundnut: 'Gy\u1E0Da',
    cowpea: 'Wake',
    chickpea: 'Wake na Indiya', lentil: 'Wake na lentil',
    tomato: 'Tumatur', onion: 'Albasa',
    pepper: 'Barkono', cabbage: 'Kabeji', carrot: 'Karas',
    okra: 'Kubewa', spinach: 'Alayyaho', cucumber: 'Kukumba',
    watermelon: 'Kankana', plantain: 'Ayaba ta dafawa',
    banana: 'Ayaba', mango: 'Mangwaro', orange: 'Lemu',
    avocado: 'Afokado', coffee: 'Kofi', tea: 'Shayi',
    cocoa: 'Koko', cotton: 'Auduga', sugarcane: 'Rake',
    sunflower: 'Furen rana', sesame: 'Ri\u1E0Di', tobacco: 'Taba',
    eggplant: 'Yalo', ginger: 'Citta', garlic: 'Tafarnuwa',
    lettuce: 'Latas', oil_palm: 'Itacen man ja',
    other: 'Sauran',
  }),

  tw: Object.freeze({
    maize: 'Aburoo', rice: 'Ɛmo', wheat: 'Atoko', sorghum: 'Aburoberɛ',
    millet: 'Nafo', cassava: 'Bankye', yam: 'Ɛbayerɛ',
    potato: 'Nkat\u025B', sweet_potato: 'Santom bankye',
    beans: 'Aduwa', soybean: 'Soya', groundnut: 'Nkat\u025B',
    cowpea: 'Aduwa',
    chickpea: 'Akukɔbene', lentil: 'Adua nketewa',
    tomato: 'Nt\u0254s', onion: 'Gyeene',
    pepper: 'Mak\u0254', cabbage: 'Kabeji',
    carrot: 'Karɔɔt', okra: 'Nkruma',
    spinach: 'Bɔdwomaa', cucumber: 'Nk\u0254k\u0254haabaa',
    watermelon: 'Nkw\u025Bntwoma', plantain: 'Br\u0254d\u025B',
    banana: 'Kwadu', mango: 'Aman\u025B', orange: 'Akutu',
    avocado: 'Paya', coffee: 'Kɔfe', tea: 'Tii',
    cocoa: 'Koko', cotton: 'Asaawa', sugarcane: 'Mpatre',
    sunflower: 'Awia nhwiren', sesame: 'Sesimi', tobacco: 'Taa',
    eggplant: 'Nyaadewa', ginger: 'Akakaduro', garlic: 'Gyeene-fitaa',
    lettuce: 'Lɛtas', oil_palm: 'Abɛ',
    other: 'Foforɔ',
  }),

  hi: Object.freeze({
    maize: '\u092E\u0915\u094D\u0915\u093E',
    rice: '\u091A\u093E\u0935\u0932',
    wheat: '\u0917\u0947\u0939\u0942\u0901',
    sorghum: '\u091C\u094B\u0935\u093E\u0930',
    millet: '\u092C\u093E\u091C\u0930\u093E',
    cassava: '\u0915\u0938\u093E\u0935\u093E',
    yam: '\u0930\u0924\u093E\u0932\u0942',
    potato: '\u0906\u0932\u0942',
    sweet_potato: '\u0936\u0915\u0930\u0915\u0902\u0926',
    beans: '\u0938\u0947\u092E',
    soybean: '\u0938\u094B\u092F\u093E\u092C\u0940\u0928',
    groundnut: '\u092E\u0942\u0902\u0917\u092B\u0932\u0940',
    cowpea: '\u0932\u094B\u092C\u093F\u092F\u093E',
    chickpea: '\u091A\u0928\u093E',
    lentil: '\u092E\u0938\u0942\u0930',
    tomato: '\u091F\u092E\u093E\u091F\u0930',
    onion: '\u092A\u094D\u092F\u093E\u091C',
    pepper: '\u092E\u093F\u0930\u094D\u091A',
    cabbage: '\u092A\u0924\u094D\u0924\u093E \u0917\u094B\u092D\u0940',
    carrot: '\u0917\u093E\u091C\u0930',
    okra: '\u092D\u093F\u0902\u0921\u0940',
    spinach: '\u092A\u093E\u0932\u0915',
    cucumber: '\u0916\u0940\u0930\u093E',
    watermelon: '\u0924\u0930\u092C\u0942\u091C',
    plantain: '\u0915\u091A\u094D\u091A\u093E \u0915\u0947\u0932\u093E',
    banana: '\u0915\u0947\u0932\u093E',
    mango: '\u0906\u092E',
    orange: '\u0938\u0902\u0924\u0930\u093E',
    avocado: '\u090F\u0935\u094B\u0915\u093E\u0921\u094B',
    coffee: '\u0915\u0949\u092B\u0940',
    tea: '\u091A\u093E\u092F',
    cocoa: '\u0915\u094B\u0915\u094B',
    cotton: '\u0915\u092A\u093E\u0938',
    sugarcane: '\u0917\u0928\u094D\u0928\u093E',
    sunflower: '\u0938\u0942\u0930\u091C\u092E\u0941\u0916\u0940',
    sesame: '\u0924\u093F\u0932',
    tobacco: '\u0924\u092E\u093E\u0916\u0942',
    eggplant: '\u092C\u0948\u0902\u0917\u0928',
    ginger: '\u0905\u0926\u0930\u0915',
    garlic: '\u0932\u0939\u0938\u0941\u0928',
    lettuce: '\u0938\u0932\u093E\u0926 \u092A\u0924\u094D\u0924\u093E',
    oil_palm: '\u0924\u093E\u0921 \u0915\u093E \u0924\u0947\u0932',
    other: '\u0905\u0928\u094D\u092F',
  }),
});

/**
 * normalizeCrop — produce a storage-safe lowercase code.
 *   • known labels or codes → the canonical code
 *   • anything else → the string lowercased/underscored
 *   • empty/invalid → ''
 *
 * Backward compatibility: farm records created before this module
 * existed may store the English *label* ("Cassava") instead of the
 * code. `collapseLabelToCode` below tries every language's label
 * table to recover the code, so a farm saved as "Cassava" still
 * resolves to the `cassava` code on render.
 */
export function normalizeCrop(value) {
  if (value == null) return '';
  const raw = String(value).trim().toLowerCase();
  if (!raw) return '';
  if (CODES.has(raw)) return raw;
  // Accept common label-to-code collapses (spaces → underscores).
  const squashed = raw.replace(/\s+/g, '_');
  if (CODES.has(squashed)) return squashed;
  // i18n upgrade — consult the canonical alias map so synonyms like
  // `corn → maize`, `manioc → cassava`, `peanut → groundnut`,
  // `chili → pepper` resolve to a localisable code instead of
  // falling through to the unknown-crop branch. The alias map is
  // already the source of truth for the rest of the codebase
  // (cropRegistry, FarmForm), so we just adopt the same lookup.
  const aliased = ALIAS_MAP.get(raw) || ALIAS_MAP.get(squashed);
  if (aliased && CODES.has(aliased)) return aliased;
  if (aliased && CODES.has(String(aliased).replace(/-/g, '_'))) {
    return String(aliased).replace(/-/g, '_');
  }
  // Try to reverse-map from any known label in any language back to
  // a code. Handles legacy records that saved the display label.
  const fromLabel = collapseLabelToCode(raw);
  if (fromLabel) return fromLabel;
  // Unknown crop — keep the user's value but in a safe shape.
  return squashed.replace(/[^\w]+/g, '_');
}

function collapseLabelToCode(lowerRaw) {
  for (const lang of Object.keys(CROP_LABELS_BY_LANG)) {
    const table = CROP_LABELS_BY_LANG[lang];
    for (const [code, label] of Object.entries(table)) {
      if (String(label).toLowerCase() === lowerRaw) return code;
    }
  }
  return null;
}

/**
 * searchCrops — filters the catalog for a searchable dropdown.
 * Works against both code AND every language's label so a Hindi
 * user can type "आलू" or "aloo" or "potato" and land on the same
 * row. English labels remain the audit-friendly source of truth
 * for ops tooling.
 */
export function searchCrops(query, { limit = 20, lang = 'en' } = {}) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return COMMON_CROPS.slice(0, limit);
  const startsWith = [];
  const contains = [];
  let other = null;
  const langTable = CROP_LABELS_BY_LANG[lang] || {};
  for (const c of COMMON_CROPS) {
    if (c.code === CROP_OTHER) { other = c; continue; }
    const hayLabel = c.label.toLowerCase();
    const hayCode  = c.code.toLowerCase();
    const hayLocal = String(langTable[c.code] || '').toLowerCase();
    if (hayLabel.startsWith(q) || hayCode.startsWith(q) || (hayLocal && hayLocal.startsWith(q))) {
      startsWith.push(c);
    } else if (hayLabel.includes(q) || hayCode.includes(q) || (hayLocal && hayLocal.includes(q))) {
      contains.push(c);
    }
  }
  const out = [...startsWith, ...contains];
  if (other) out.push(other);
  return out.slice(0, limit);
}

/**
 * getCropLabel — pure, language-aware display label.
 *
 *   getCropLabel('cassava')        → 'Cassava'
 *   getCropLabel('cassava', 'hi')  → '\u0915\u0938\u093E\u0935\u093E'
 *   getCropLabel('UNKNOWN', 'hi')  → 'UNKNOWN' (string fallback — never empty)
 *   getCropLabel('Cassava')        → 'Cassava' (old label → still resolves)
 *
 * Lookup order:
 *   1. Target language's localised label
 *   2. English label
 *   3. Code capitalised as a human-readable last resort
 */
export function getCropLabel(code, lang = 'en') {
  if (!code) return '';
  const norm = normalizeCrop(code);
  if (!norm) return String(code);
  const table = CROP_LABELS_BY_LANG[lang] || CROP_LABELS_BY_LANG.en;
  if (table[norm]) return table[norm];
  if (CROP_LABELS_BY_LANG.en[norm]) return CROP_LABELS_BY_LANG.en[norm];
  // Last resort — never return empty, never return the raw code
  // verbatim if we can humanise it slightly.
  return norm.replace(/_/g, ' ').replace(/^./, (ch) => ch.toUpperCase());
}

/**
 * useCropLabel — React hook. Re-renders when the active UI
 * language changes so every chip / card / summary updates at the
 * same time. Callers that are already inside a React render can
 * prefer this over threading `lang` through props.
 *
 *   function CropChip({ code }) {
 *     const label = useCropLabel(code);
 *     return <span>{label}</span>;
 *   }
 */
export function useCropLabel(code) {
  const { lang } = useTranslation();
  return getCropLabel(code, lang);
}

export const _internal = Object.freeze({
  CODES, CROP_LABELS_BY_LANG, collapseLabelToCode,
});
