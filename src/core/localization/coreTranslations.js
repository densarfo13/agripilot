/**
 * coreTranslations — starter multi-language pack of the highest-
 * leverage shared strings (spec §11).
 *
 * This is NOT the app's full translations source of truth — that is
 * `src/i18n/translations.js`. This module exists so a future
 * expansion (more languages, community-contributed packs, embedded
 * partners) can drop in a starter set without reaching into the
 * master table.
 *
 * Shape: CORE_TRANSLATIONS[stringId][lang] → localized string.
 *
 * Unlisted (lang, key) pairs fall back to English at lookup time.
 * No raw key ever leaks to UI.
 */

// The 18 high-leverage keys the spec called out. All have official
// entries in the master translations.js already — the starter pack
// mirrors those plus a consistent shorthand key name surface.
export const CORE_TRANSLATIONS = Object.freeze({
  undo: {
    en: 'Undo',
    twi: 'San yi',
    hausa: 'Soke',
    hindi: 'पूर्ववत करें',
  },
  mark_as_not_done: {
    en: 'Mark as not done',
    twi: 'Kyerɛ sɛ wunyɛɛ ɛ',
    hausa: 'Sanya ba a gama ba',
    hindi: 'अधूरा चिह्नित करें',
  },
  something_is_wrong: {
    en: 'Something is wrong',
    twi: 'Biribi nyɛ yie',
    hausa: 'Akwai matsala',
    hindi: 'कुछ गलत है',
  },
  good_work_crop_better: {
    en: 'Good work — your crop is getting better',
    twi: 'Adwuma pa — wo nnɔbae rekɔ so yie',
    hausa: 'Aikin kirki — amfaninku yana samun sauƙi',
    hindi: 'बढ़िया काम — आपकी फसल बेहतर हो रही है',
  },
  added_do_this_today: {
    en: 'Added — do this today',
    twi: 'Woafa — yɛ nnɛ',
    hausa: 'An ƙara — yi yau',
    hindi: 'जोड़ा गया — आज करें',
  },
  fix_this_today: {
    en: 'Fix this today',
    twi: 'Siesie nnɛ',
    hausa: 'Gyara yau',
    hindi: 'आज ठीक करें',
  },
  continue: {
    en: 'Continue',
    twi: 'Toa so',
    hausa: 'Ci gaba',
    hindi: 'जारी रखें',
  },
  ready: {
    en: 'Ready',
    twi: 'Krado',
    hausa: 'A shirye',
    hindi: 'तैयार',
  },
  plan_your_next_crop: {
    en: 'Plan your next crop',
    twi: 'Siesie wo nnɔbae a ɛdi hɔ',
    hausa: 'Shirya amfani na gaba',
    hindi: 'अगली फसल की योजना बनाएं',
  },
  tell_us_about_your_farm: {
    en: 'Tell us about your farm',
    twi: 'Ka wo afuo ho asɛm kyerɛ yɛn',
    hausa: 'Gaya mana game da gonarka',
    hindi: 'हमें अपने खेत के बारे में बताएं',
  },
  this_is_not_main_season: {
    en: 'This is not the main season now',
    twi: 'Ɛnyɛ bere titiriw no seesei',
    hausa: 'Wannan ba babban lokaci bane yanzu',
    hindi: 'यह अभी मुख्य मौसम नहीं है',
  },
  possible_issue_detected: {
    en: 'Possible issue detected',
    twi: 'Ebia, yehunu ɔhaw bi',
    hausa: 'Mai yiwuwa an gano matsala',
    hindi: 'संभावित समस्या मिली',
  },
  your_crop_looks_healthy: {
    en: 'Your crop looks healthy right now',
    twi: 'Wo nnɔbae no ho yɛ pa seesei',
    hausa: 'Amfaninku yana lafiya a yanzu',
    hindi: 'आपकी फसल अभी स्वस्थ दिख रही है',
  },
  check_again_tomorrow: {
    en: 'Check again tomorrow',
    twi: 'San hwɛ ɔkyena',
    hausa: 'Sake duba gobe',
    hindi: 'कल फिर जांचें',
  },
  works_well_in_your_area_now: {
    en: 'Works well in your area right now',
    twi: 'Ɛkɔ yie wɔ wo mantam seesei',
    hausa: 'Ya dace da yankinku a yanzu',
    hindi: 'आपके क्षेत्र में अभी अच्छा काम करता है',
  },
  have_you_farmed_before: {
    en: 'Have you farmed before?',
    twi: 'Woayɛ afuo pɛn?',
    hausa: 'Ka taɓa noma a baya?',
    hindi: 'क्या आपने पहले खेती की है?',
  },
  no_im_just_starting: {
    en: "No, I'm just starting",
    twi: 'Dabi, mefiri aseɛ seesei',
    hausa: "A'a, ina farawa",
    hindi: 'नहीं, मैं अभी शुरू कर रहा हूँ',
  },
  yes_i_already_farm: {
    en: 'Yes, I already farm',
    twi: 'Aane, meyɛ afuo dada',
    hausa: 'Ee, ina noma',
    hindi: 'हाँ, मैं पहले से खेती करता हूँ',
  },
});

// Map the shorthand lang tags to the ISO codes the rest of the app
// uses. The app i18n stores Twi as `tw`, Hausa as `ha`, Hindi as
// `hi`; this table keeps the starter pack readable without forcing
// call-sites to remember the tag split.
const LANG_ALIAS = Object.freeze({
  en: 'en',
  tw: 'twi',
  ha: 'hausa',
  hi: 'hindi',
});

/**
 * Look up a core string.
 *
 *   coreT('undo', 'hi')  → 'पूर्ववत करें'
 *   coreT('undo', 'sw')  → 'Undo' (no Swahili in the starter pack; falls back to en)
 *   coreT('unknown', 'en') → '' (unknown keys never leak)
 */
export function coreT(stringId, lang = 'en') {
  const entry = CORE_TRANSLATIONS[stringId];
  if (!entry) return '';
  const tag = LANG_ALIAS[lang] || lang;
  return entry[tag] || entry.en || '';
}

/** List of language tags this starter pack ships values for. */
export const CORE_LANGUAGES = Object.freeze(['en', 'twi', 'hausa', 'hindi']);

/** List of stringIds covered by the starter pack. */
export function listCoreStringIds() {
  return Object.keys(CORE_TRANSLATIONS);
}
