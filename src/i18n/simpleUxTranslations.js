/**
 * simpleUxTranslations.js — i18n overlay for the No-Reading-
 * Required (Simple Mode) UX surface.
 *
 *   simple.today          — kicker on the SimpleTodayCard
 *   simple.listen         — Listen button label
 *   simple.done           — Done button label
 *   simple.checkFarm      — fallback task phrase when no task
 *                            is available
 *   simple.pest           — LabelPrompt 1-word label
 *   simple.dry            — LabelPrompt 1-word label
 *   simple.good           — LabelPrompt 1-word label
 *   simple.unsure         — LabelPrompt 1-word label
 *
 * Strict-rule audit
 *   * Six launch locales: en/fr/sw/ha/tw/hi
 *   * Each value is at most TWO words so the simple-mode
 *     visible labels stay short. Voice scripts in
 *     src/voice/voiceScripts.js carry the longer cadence.
 *   * Coexists with src/i18n/simpleModeTranslations.js (the
 *     settings-toggle copy) — does NOT replace it
 */

export const SIMPLE_UX_TRANSLATIONS = Object.freeze({
  en: {
    'simple.today':     'Today',
    'simple.listen':    'Listen',
    'simple.done':      'Done',
    'simple.checkFarm': 'Check farm',
    'simple.pest':      'Pest',
    'simple.dry':       'Dry',
    'simple.good':      'Good',
    'simple.unsure':    'Unsure',
  },

  fr: {
    'simple.today':     'Aujourd\u2019hui',
    'simple.listen':    '\u00C9couter',
    'simple.done':      'Termin\u00E9',
    'simple.checkFarm': 'V\u00E9rifier',
    'simple.pest':      'Nuisible',
    'simple.dry':       'Sec',
    'simple.good':      'Bon',
    'simple.unsure':    'Pas s\u00FBr',
  },

  sw: {
    'simple.today':     'Leo',
    'simple.listen':    'Sikiliza',
    'simple.done':      'Imekamilika',
    'simple.checkFarm': 'Angalia',
    'simple.pest':      'Wadudu',
    'simple.dry':       'Kavu',
    'simple.good':      'Salama',
    'simple.unsure':    'Sina hakika',
  },

  ha: {
    'simple.today':     'Yau',
    'simple.listen':    'Saurari',
    'simple.done':      'An gama',
    'simple.checkFarm': 'Duba',
    'simple.pest':      'Kwari',
    'simple.dry':       'Bushe',
    'simple.good':      'Lafiya',
    'simple.unsure':    'Ban tabbata',
  },

  tw: {
    'simple.today':     'Nn\u025B',
    'simple.listen':    'Tie',
    'simple.done':      'Aw\u02BDie',
    'simple.checkFarm': 'Hw\u025B afuo',
    'simple.pest':      'Mmoawa',
    'simple.dry':       'Awo',
    'simple.good':      'Ɛy\u025B',
    'simple.unsure':    'Mennim',
  },

  hi: {
    'simple.today':     '\u0906\u091C',
    'simple.listen':    '\u0938\u0941\u0928\u0947\u0902',
    'simple.done':      '\u0939\u094B \u0917\u092F\u093E',
    'simple.checkFarm': '\u0916\u0947\u0924 \u0926\u0947\u0916\u0947\u0902',
    'simple.pest':      '\u0915\u0940\u091F',
    'simple.dry':       '\u0938\u0942\u0916\u093E',
    'simple.good':      '\u0920\u0940\u0915',
    'simple.unsure':    '\u092A\u0924\u093E \u0928\u0939\u0940\u0902',
  },
});

export default SIMPLE_UX_TRANSLATIONS;
