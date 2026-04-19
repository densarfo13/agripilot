/**
 * closingGapsTranslations.js — overlay for the closing-gaps
 * patch: freshness prefixes, feedback prompts, continuity copy,
 * and a handful of regional-tone refinements for temperate vs
 * tropical vs monsoon buckets.
 *
 * Key families:
 *   closing_gaps.based_on_last_update
 *   closing_gaps.recent_update_pending
 *   closing_gaps.reconnect_to_refresh
 *   closing_gaps.lets_get_back_on_track
 *   closing_gaps.conditions_may_not_be_right
 *   closing_gaps.does_this_match_your_field
 *   closing_gaps.feedback.*
 *   closing_gaps.region.<bucket>.*  (regional tone refinements)
 *
 * Every shipped locale has at least the English-leak-safe core set.
 */

export const CLOSING_GAPS_TRANSLATIONS = Object.freeze({
  en: {
    'closing_gaps.based_on_last_update':        'Based on your last update',
    'closing_gaps.recent_update_pending':       'Last updated more than a day ago',
    'closing_gaps.reconnect_to_refresh':        'Reconnect to refresh your guidance',
    'closing_gaps.lets_get_back_on_track':      'Let\u2019s get back on track',
    'closing_gaps.conditions_may_not_be_right': 'Conditions may not be right yet',
    'closing_gaps.does_this_match_your_field':  'Does this match your field?',
    'closing_gaps.minutes_ago':                 '{n} min ago',
    'closing_gaps.updated_yesterday':           'Updated yesterday',
    'closing_gaps.updated_days_ago':            'Updated {n} days ago',

    // Feedback prompts
    'closing_gaps.feedback.prompt':         'Does this match your field?',
    'closing_gaps.feedback.helpful':        'Helpful',
    'closing_gaps.feedback.not_right':      'Not right',
    'closing_gaps.feedback.why_not_right':  'Tell us why',
    'closing_gaps.feedback.doesnt_match':   'Doesn\u2019t match my field',
    'closing_gaps.feedback.already_did':    'I already did this',
    'closing_gaps.feedback.not_clear':      'Not clear',
    'closing_gaps.feedback.thanks':         'Thanks \u2014 we\u2019ll use this.',
    'closing_gaps.feedback.cancel':         'Cancel',

    // Continuity reminder variants
    'closing_gaps.reminder.try_again':      'Still on your list today',
    'closing_gaps.reminder.small_nudge':    'A quick reminder from yesterday',

    // Regional tone refinements
    'closing_gaps.region.tropical_manual.field_prep':
      'Prepare the field by hand before planting',
    'closing_gaps.region.tropical_manual.rain_note':
      'Watch the sky — rain can come fast',
    'closing_gaps.region.monsoon_mixed.field_prep':
      'Prepare the field before the rains arrive',
    'closing_gaps.region.monsoon_mixed.rain_note':
      'Rain expected soon \u2014 time your work accordingly',
    'closing_gaps.region.temperate_mechanized.field_prep':
      'Run field prep when the soil is workable',
    'closing_gaps.region.temperate_mechanized.row_note':
      'Check your rows and equipment before moving',
    'closing_gaps.region.temperate_mechanized.rain_note':
      'Rain expected \u2014 plan field work around it',
  },

  hi: {
    'closing_gaps.based_on_last_update':        'आपके पिछले अपडेट के अनुसार',
    'closing_gaps.recent_update_pending':       'एक दिन से अधिक पहले अपडेट हुआ',
    'closing_gaps.reconnect_to_refresh':        'नई मार्गदर्शिका के लिए फिर से कनेक्ट करें',
    'closing_gaps.lets_get_back_on_track':      'फिर से ट्रैक पर आएँ',
    'closing_gaps.conditions_may_not_be_right': 'स्थितियाँ अभी उपयुक्त नहीं हो सकतीं',
    'closing_gaps.does_this_match_your_field':  'क्या यह आपके खेत से मेल खाता है?',
    'closing_gaps.minutes_ago':                 '{n} मिनट पहले',
    'closing_gaps.updated_yesterday':           'कल अपडेट किया गया',
    'closing_gaps.updated_days_ago':            '{n} दिन पहले अपडेट हुआ',
    'closing_gaps.feedback.prompt':         'क्या यह आपके खेत से मेल खाता है?',
    'closing_gaps.feedback.helpful':        'उपयोगी',
    'closing_gaps.feedback.not_right':      'सही नहीं',
    'closing_gaps.feedback.why_not_right':  'कारण बताएँ',
    'closing_gaps.feedback.doesnt_match':   'मेरे खेत से मेल नहीं खाता',
    'closing_gaps.feedback.already_did':    'मैं पहले ही कर चुका हूँ',
    'closing_gaps.feedback.not_clear':      'स्पष्ट नहीं है',
    'closing_gaps.feedback.thanks':         'धन्यवाद — हम इसका उपयोग करेंगे।',
    'closing_gaps.feedback.cancel':         'रद्द करें',
    'closing_gaps.reminder.try_again':      'आज भी आपकी सूची में है',
    'closing_gaps.reminder.small_nudge':    'कल की एक छोटी याद',
    'closing_gaps.region.tropical_manual.field_prep':    'बुवाई से पहले खेत को हाथ से तैयार करें',
    'closing_gaps.region.tropical_manual.rain_note':     'आसमान पर नज़र रखें — बारिश तेज़ आ सकती है',
    'closing_gaps.region.monsoon_mixed.field_prep':      'बारिश आने से पहले खेत तैयार करें',
    'closing_gaps.region.monsoon_mixed.rain_note':       'जल्द ही बारिश की संभावना है — काम का समय तय करें',
    'closing_gaps.region.temperate_mechanized.field_prep':'मिट्टी उपयुक्त होने पर खेत तैयारी चलाएँ',
    'closing_gaps.region.temperate_mechanized.row_note': 'बढ़ने से पहले पंक्तियाँ और उपकरण जाँचें',
    'closing_gaps.region.temperate_mechanized.rain_note':'बारिश की संभावना — खेत के काम की योजना बनाएँ',
  },

  tw: core({
    'closing_gaps.based_on_last_update':   'Ɛgyinaa w\u02BCakyerɛ akyi',
    'closing_gaps.lets_get_back_on_track': 'Ma yɛnsan nkɔ kwan so',
    'closing_gaps.feedback.helpful':       'Ɛboa',
    'closing_gaps.feedback.not_right':     'Ɛnyɛ saa',
    'closing_gaps.feedback.thanks':        'Meda wo ase',
    'closing_gaps.region.tropical_manual.field_prep':
      'Siesie w\u02BCafuo ho nsumaa ansa na wobedua',
  }),
  es: core({
    'closing_gaps.based_on_last_update':   'Según tu última actualización',
    'closing_gaps.lets_get_back_on_track': 'Volvamos al ritmo',
    'closing_gaps.feedback.helpful':       'Útil',
    'closing_gaps.feedback.not_right':     'No es correcto',
    'closing_gaps.feedback.doesnt_match':  'No coincide con mi campo',
    'closing_gaps.feedback.already_did':   'Ya lo hice',
    'closing_gaps.feedback.not_clear':     'No queda claro',
    'closing_gaps.feedback.thanks':        'Gracias — lo usaremos.',
    'closing_gaps.feedback.cancel':        'Cancelar',
    'closing_gaps.region.temperate_mechanized.field_prep':
      'Prepara el campo cuando el suelo esté listo',
  }),
  pt: core({
    'closing_gaps.based_on_last_update':   'Com base na sua última atualização',
    'closing_gaps.lets_get_back_on_track': 'Voltemos ao ritmo',
    'closing_gaps.feedback.helpful':       'Útil',
    'closing_gaps.feedback.not_right':     'Não está certo',
    'closing_gaps.feedback.doesnt_match':  'Não combina com o meu campo',
    'closing_gaps.feedback.already_did':   'Eu já fiz isto',
    'closing_gaps.feedback.not_clear':     'Não está claro',
    'closing_gaps.feedback.thanks':        'Obrigado — vamos usar isto.',
  }),
  fr: core({
    'closing_gaps.based_on_last_update':   'D\u2019après votre dernière mise à jour',
    'closing_gaps.lets_get_back_on_track': 'Reprenons le rythme',
    'closing_gaps.feedback.helpful':       'Utile',
    'closing_gaps.feedback.not_right':     'Pas juste',
    'closing_gaps.feedback.doesnt_match':  'Ne correspond pas à mon champ',
    'closing_gaps.feedback.already_did':   'Je l\u2019ai déjà fait',
    'closing_gaps.feedback.not_clear':     'Pas clair',
    'closing_gaps.feedback.thanks':        'Merci — nous en tiendrons compte.',
  }),
  ar: core({
    'closing_gaps.based_on_last_update':   'استنادًا إلى آخر تحديث لك',
    'closing_gaps.lets_get_back_on_track': 'لنعد إلى المسار',
    'closing_gaps.feedback.helpful':       'مفيد',
    'closing_gaps.feedback.not_right':     'غير صحيح',
    'closing_gaps.feedback.doesnt_match':  'لا يطابق حقلي',
    'closing_gaps.feedback.already_did':   'قمت بذلك بالفعل',
    'closing_gaps.feedback.not_clear':     'غير واضح',
    'closing_gaps.feedback.thanks':        'شكرًا — سنستفيد من ذلك.',
  }),
  sw: core({
    'closing_gaps.based_on_last_update':   'Kulingana na sasisho lako la mwisho',
    'closing_gaps.lets_get_back_on_track': 'Turudi njiani',
    'closing_gaps.feedback.helpful':       'Imefaa',
    'closing_gaps.feedback.not_right':     'Si sahihi',
    'closing_gaps.feedback.doesnt_match':  'Hailingani na shamba langu',
    'closing_gaps.feedback.already_did':   'Tayari nimefanya',
    'closing_gaps.feedback.not_clear':     'Si wazi',
    'closing_gaps.feedback.thanks':        'Asante — tutatumia hii.',
  }),
  id: core({
    'closing_gaps.based_on_last_update':   'Berdasarkan pembaruan terakhir Anda',
    'closing_gaps.lets_get_back_on_track': 'Ayo kembali ke jalurnya',
    'closing_gaps.feedback.helpful':       'Membantu',
    'closing_gaps.feedback.not_right':     'Tidak tepat',
    'closing_gaps.feedback.doesnt_match':  'Tidak cocok dengan ladang saya',
    'closing_gaps.feedback.already_did':   'Saya sudah melakukannya',
    'closing_gaps.feedback.not_clear':     'Tidak jelas',
    'closing_gaps.feedback.thanks':        'Terima kasih — kami akan menggunakannya.',
  }),
});

/**
 * applyClosingGapsOverlay — merge into an existing dictionary.
 * Returns the same reference.
 */
export function applyClosingGapsOverlay(translations) {
  if (!translations || typeof translations !== 'object') return translations;
  for (const [locale, keys] of Object.entries(CLOSING_GAPS_TRANSLATIONS)) {
    translations[locale] = Object.assign(translations[locale] || {}, keys);
  }
  return translations;
}

/**
 * interpolate — deterministic token substitution for `{n}`,
 * `{crop}`, etc. Same helper other overlays use.
 */
export function interpolate(text, vars = {}) {
  if (!text) return text;
  return String(text).replace(/\{\{?\s*(\w+)\s*\}?\}/g, (_, k) =>
    vars[k] == null ? '' : String(vars[k]));
}

function core(keys) { return Object.freeze({ ...keys }); }

export default CLOSING_GAPS_TRANSLATIONS;
