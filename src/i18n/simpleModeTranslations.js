/**
 * simpleModeTranslations.js — i18n overlay for the new
 * Accessibility (Simple Mode) section in Settings + the calm
 * inline copy the toggle exposes.
 *
 * Empty-slot fill via mergeManyOverlays — translator-authored
 * values still win.
 *
 * Keys covered
 *   settings.accessibility       — section title in Settings
 *   settings.simpleMode          — toggle label "Simple Mode"
 *   settings.simpleModeHelper    — one-line explanation
 *
 * Strict-rule audit
 *   * Six launch locales: en/fr/sw/ha/tw/hi
 *   * Helper copy stays under ~70 chars in every locale so it
 *     fits on a phone-width row without wrapping past two lines
 */

export const SIMPLE_MODE_TRANSLATIONS = Object.freeze({
  en: {
    'settings.accessibility':    'Accessibility',
    'settings.simpleMode':       'Simple Mode',
    'settings.simpleModeHelper':
      'Bigger icons, fewer words, voice plays automatically.',
  },

  fr: {
    'settings.accessibility':    'Accessibilit\u00E9',
    'settings.simpleMode':       'Mode Simple',
    'settings.simpleModeHelper':
      'Plus grandes ic\u00F4nes, moins de mots, voix automatique.',
  },

  sw: {
    'settings.accessibility':    'Ufikivu',
    'settings.simpleMode':       'Hali Rahisi',
    'settings.simpleModeHelper':
      'Aikoni kubwa, maneno machache, sauti hucheza moja kwa moja.',
  },

  ha: {
    'settings.accessibility':    'Sauk\u0101k\u00EB',
    'settings.simpleMode':       'Sahihi Mai Sauki',
    'settings.simpleModeHelper':
      'Manyan alamomi, kalmomi kadan, murya tana kunne ne kai tsaye.',
  },

  tw: {
    'settings.accessibility':    'Hokwan',
    'settings.simpleMode':       'Mfitiase\u025B Kwan',
    'settings.simpleModeHelper':
      'Mfoni akɛse\u025B, nsɛm ts\u025Bnts\u025Bn, nne kasa kɛkɛ.',
  },

  hi: {
    'settings.accessibility':    'सहायता',
    'settings.simpleMode':       'सरल मोड',
    'settings.simpleModeHelper':
      'बड़े आइकन, कम शब्द, आवाज़ अपने आप चलती है।',
  },
});

export default SIMPLE_MODE_TRANSLATIONS;
