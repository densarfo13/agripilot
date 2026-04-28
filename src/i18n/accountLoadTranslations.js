/**
 * accountLoadTranslations.js — i18n overlay for the
 * AccountLoadFallback component (src/components/
 * AccountLoadFallback.jsx).
 *
 * Empty-slot fill via mergeManyOverlays — translator-authored
 * values still win.
 *
 * Keys covered
 *   account.loadFailed.title   "Welcome"
 *   account.loadFailed.body    "Unable to load account. Please refresh or continue."
 *
 * Why these keys needed an overlay
 *   The component shipped with `tSafe('account.loadFailed.title',
 *   'Welcome')`. Before this overlay (and before the tSafe
 *   humanized-key detection patch), production t() returned
 *   humanizeKey('account.loadFailed.title') = "Title" for any
 *   missing key, tSafe saw a non-empty string and accepted it,
 *   and the literal word "Title" leaked to the UI on every
 *   account-load failure. Defining the keys here closes the
 *   leak at the dictionary level so even if the tSafe check
 *   regresses, EN (+ five other locales) render correctly.
 *
 * Strict-rule audit
 *   * Calm + non-shaming copy: "Unable to load account. Please
 *     refresh or continue." — never "Failed", "Error", "Try
 *     harder", "Your session is broken"
 *   * Six launch locales (en/fr/sw/ha/tw/hi)
 */

export const ACCOUNT_LOAD_TRANSLATIONS = Object.freeze({
  en: {
    'account.loadFailed.title':
      'Welcome',
    'account.loadFailed.body':
      'Unable to load account. Please refresh or continue.',
    'account.loadFailed.timeout':
      'Unable to load account. The request timed out. Please refresh or continue.',
  },

  fr: {
    'account.loadFailed.title':
      'Bienvenue',
    'account.loadFailed.body':
      'Impossible de charger le compte. Veuillez actualiser ou continuer.',
    'account.loadFailed.timeout':
      'Impossible de charger le compte. La requ\u00EAte a expir\u00E9. Veuillez actualiser ou continuer.',
  },

  sw: {
    'account.loadFailed.title':
      'Karibu',
    'account.loadFailed.body':
      'Imeshindikana kupakia akaunti. Tafadhali onyesha upya au endelea.',
    'account.loadFailed.timeout':
      'Imeshindikana kupakia akaunti. Ombi limeisha muda. Tafadhali onyesha upya au endelea.',
  },

  ha: {
    'account.loadFailed.title':
      'Sannu',
    'account.loadFailed.body':
      'An kasa loda asusu. Da fatan a sabunta ko a ci gaba.',
    'account.loadFailed.timeout':
      'An kasa loda asusu. Bukatar ta \u01ADare lokaci. Da fatan a sabunta ko a ci gaba.',
  },

  tw: {
    'account.loadFailed.title':
      'Akwaaba',
    'account.loadFailed.body':
      'Y\u025Bantumi anhw\u025B akawunt no. M\u025By\u025B foforɔ anaas\u025B k\u0254 so.',
    'account.loadFailed.timeout':
      'Y\u025Bantumi anhw\u025B akawunt no. Adabɔ no agye bere pii. M\u025By\u025B foforɔ anaas\u025B k\u0254 so.',
  },

  hi: {
    'account.loadFailed.title':
      'स्वागत है',
    'account.loadFailed.body':
      'खाता लोड नहीं कर सका। कृपया रिफ्रेश करें या जारी रखें।',
    'account.loadFailed.timeout':
      'खाता लोड नहीं कर सका। अनुरोध का समय समाप्त। कृपया रिफ्रेश करें या जारी रखें।',
  },
});

export default ACCOUNT_LOAD_TRANSLATIONS;
