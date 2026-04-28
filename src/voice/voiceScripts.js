/**
 * voiceScripts.js — short per-task voice scripts for the
 * No-Reading-Required (Simple Mode) flow.
 *
 *   getTaskVoiceScript(taskType, lang)
 *     -> short sentence the speak() helper reads aloud
 *
 * Why a separate module from i18n
 *   The TODAY_ELITE_TRANSLATIONS overlay has detailed task
 *   strings (title + instruction + timing + risk) tuned for
 *   visual reading. Voice scripts are SHORTER, single-clause
 *   sentences tuned for TTS — natural cadence beats accuracy
 *   when the farmer is listening, not reading. Keeping the
 *   two surfaces independent lets each evolve without breaking
 *   the other.
 *
 *   The visual i18n still drives the visible card; this module
 *   only feeds speak(). Falls back gracefully:
 *     1. exact (lang, taskType) match
 *     2. English (lang, taskType)
 *     3. English check_farm (the calm default — never empty)
 *
 * Strict-rule audit
 *   * Pure: no I/O, no globals
 *   * Never throws on unknown lang / taskType
 *   * Never returns empty string — fallback always lands
 *   * Frozen so the dictionary is immutable at runtime
 *   * Coexists with src/i18n/todayElitTranslations.js — does
 *     NOT replace it
 */

const SCRIPTS = Object.freeze({
  en: Object.freeze({
    prepare_rows:    'Prepare rows for planting today.',
    weed_rows:       'Remove weeds from your crop today.',
    scout_pests:     'Check your crop for pests today.',
    check_moisture:  'Check if the soil is dry today.',
    water_crops:     'Water your crops today.',
    fertilize:       'Add fertiliser to your crops today.',
    prepare_harvest: 'Get ready to harvest your crop.',
    check_farm:      'Check your farm today.',
  }),

  fr: Object.freeze({
    prepare_rows:    'Pr\u00E9parez les rang\u00E9es pour planter aujourd\u2019hui.',
    weed_rows:       'Enlevez les mauvaises herbes aujourd\u2019hui.',
    scout_pests:     'V\u00E9rifiez les ravageurs aujourd\u2019hui.',
    check_moisture:  'V\u00E9rifiez si le sol est sec aujourd\u2019hui.',
    water_crops:     'Arrosez vos cultures aujourd\u2019hui.',
    fertilize:       'Fertilisez vos cultures aujourd\u2019hui.',
    prepare_harvest: 'Pr\u00E9parez la r\u00E9colte.',
    check_farm:      'V\u00E9rifiez votre ferme aujourd\u2019hui.',
  }),

  hi: Object.freeze({
    prepare_rows:    '\u0906\u091C \u092C\u094B\u0935\u093E\u0908 \u0915\u0947 \u0932\u093F\u090F \u0915\u0924\u093E\u0930\u0947\u0902 \u0924\u0948\u092F\u093E\u0930 \u0915\u0930\u0947\u0902\u0964',
    weed_rows:       '\u0906\u091C \u0916\u0947\u0924 \u0938\u0947 \u0916\u0930\u092A\u0924\u0935\u093E\u0930 \u0939\u091F\u093E\u090F\u0901\u0964',
    scout_pests:     '\u0906\u091C \u092B\u0938\u0932 \u092E\u0947\u0902 \u0915\u0940\u091F \u0926\u0947\u0916\u0947\u0902\u0964',
    check_moisture:  '\u0906\u091C \u092E\u093F\u091F\u094D\u091F\u0940 \u0915\u0940 \u0928\u092E\u0940 \u091C\u093E\u0901\u091A\u0947\u0902\u0964',
    water_crops:     '\u0906\u091C \u092B\u0938\u0932 \u0915\u094B \u092A\u093E\u0928\u0940 \u0926\u0947\u0902\u0964',
    fertilize:       '\u0906\u091C \u092B\u0938\u0932 \u092E\u0947\u0902 \u0916\u093E\u0926 \u0921\u093E\u0932\u0947\u0902\u0964',
    prepare_harvest: '\u092B\u0938\u0932 \u0915\u0940 \u0915\u091F\u093E\u0908 \u0915\u0940 \u0924\u0948\u092F\u093E\u0930\u0940 \u0915\u0930\u0947\u0902\u0964',
    check_farm:      '\u0906\u091C \u0905\u092A\u0928\u093E \u0916\u0947\u0924 \u0926\u0947\u0916\u0947\u0902\u0964',
  }),

  tw: Object.freeze({
    prepare_rows:    'Siesie nsensanee no nn\u025B.',
    weed_rows:       'Yi nwura no fi afuo no mu nn\u025B.',
    scout_pests:     'Hw\u025B wo nnɔbae no mu s\u025B mmoawa wɔ hɔ.',
    check_moisture:  'Hw\u025B s\u025B asaase no awo anaa.',
    water_crops:     'Gugu wo nnɔbae no so nsuo nn\u025B.',
    fertilize:       'Fa nnuru gu wo nnɔbae no so nn\u025B.',
    prepare_harvest: 'Si\u025Bs\u025B s\u025B wob\u025Btwa wo nnɔbae no.',
    check_farm:      'Hw\u025B wo afuo no nn\u025B.',
  }),

  ha: Object.freeze({
    prepare_rows:    'Shirya layukan gona yau.',
    weed_rows:       'Cire ciyawa daga gona yau.',
    scout_pests:     'Duba kwari a cikin amfanin gona yau.',
    check_moisture:  'Duba ko kasa ta bushe yau.',
    water_crops:     'Shayar da amfanin gona yau.',
    fertilize:       'Sa taki ga amfanin gona yau.',
    prepare_harvest: 'Shirya don girbi.',
    check_farm:      'Duba gonarka yau.',
  }),

  sw: Object.freeze({
    prepare_rows:    'Andaa mistari kwa ajili ya kupanda leo.',
    weed_rows:       'Ondoa magugu shambani leo.',
    scout_pests:     'Angalia wadudu kwenye mazao leo.',
    check_moisture:  'Angalia kama udongo umekauka leo.',
    water_crops:     'Mwagilia mazao yako leo.',
    fertilize:       'Weka mbolea kwenye mazao leo.',
    prepare_harvest: 'Jiandae kuvuna.',
    check_farm:      'Angalia shamba lako leo.',
  }),
});

/**
 * getTaskVoiceScript(taskType, lang) → string
 *
 * Returns the short voice sentence for the given task in the
 * requested language. Falls through to English, then to the
 * "check your farm today" calm default — never empty, never
 * undefined.
 */
export function getTaskVoiceScript(taskType, lang) {
  const langKey = (lang && typeof lang === 'string' ? lang : 'en').toLowerCase();
  const taskKey = (taskType && typeof taskType === 'string' ? taskType : 'check_farm');
  const langPack = SCRIPTS[langKey] || SCRIPTS.en;
  return langPack[taskKey]
      || SCRIPTS.en[taskKey]
      || SCRIPTS.en.check_farm;
}

/**
 * Short praise script played after a Done tap in Simple Mode.
 * Same fallback chain as the task scripts.
 */
const PRAISE = Object.freeze({
  en: 'Thank you. Good work.',
  fr: 'Merci. Bon travail.',
  hi: '\u0927\u0928\u094D\u092F\u0935\u093E\u0926\u0964 \u0905\u091A\u094D\u091B\u093E \u0915\u093E\u092E\u0964',
  tw: 'Meda wo ase. Adwuma pa.',
  ha: 'Na gode. Aiki nagari.',
  sw: 'Asante. Kazi nzuri.',
});

export function getPraiseVoiceScript(lang) {
  const langKey = (lang && typeof lang === 'string' ? lang : 'en').toLowerCase();
  return PRAISE[langKey] || PRAISE.en;
}

export const SUPPORTED_LANGS = Object.freeze(Object.keys(SCRIPTS));

export default getTaskVoiceScript;
