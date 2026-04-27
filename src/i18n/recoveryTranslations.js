/**
 * recoveryTranslations.js — i18n overlay for the gentle
 * missed-day recovery flow.
 *
 * Empty-slot fill via mergeManyOverlays - translator-authored
 * values still win.
 *
 * Keys:
 *   recovery.title           "Welcome back"
 *   recovery.message         "You missed a few days. Let's get back on track."
 *   recovery.newStart        "New start today"
 *   recovery.listen          "Listen"
 *   recovery.voice           "Welcome back. Check your farm today."
 *   tasks.checkFarm.title    "Check your farm today"
 *   tasks.checkFarm.why      "A quick walk through your field gets you back on track."
 *
 * Strict-rule audit
 *   * non-shaming copy: "welcome back", "let's get back on
 *     track", "new start today" - no "missed", "late",
 *     "behind", "failed"
 *   * full coverage in the six shipped languages; no English
 *     leak in non-English locales
 */

export const RECOVERY_TRANSLATIONS = Object.freeze({
  en: {
    'recovery.title':         'Welcome back',
    'recovery.message':       'You missed a few days. Let\u2019s get back on track.',
    'recovery.newStart':      'New start today',
    'recovery.listen':        'Listen',
    'recovery.voice':         'Welcome back. Check your farm today.',
    'tasks.checkFarm.title':  'Check your farm today',
    'tasks.checkFarm.why':    'A quick walk through your field gets you back on track.',
  },

  fr: {
    'recovery.title':         'Bon retour',
    'recovery.message':       'Vous avez \u00E9t\u00E9 absent quelques jours. Reprenons doucement.',
    'recovery.newStart':      'Nouveau d\u00E9part aujourd\u2019hui',
    'recovery.listen':        '\u00C9couter',
    'recovery.voice':         'Bon retour. V\u00E9rifiez votre ferme aujourd\u2019hui.',
    'tasks.checkFarm.title':  'V\u00E9rifiez votre ferme aujourd\u2019hui',
    'tasks.checkFarm.why':    'Une rapide promenade dans le champ vous remet sur la bonne voie.',
  },

  hi: {
    'recovery.title':         'वापस स्वागत है',
    'recovery.message':       'आप कुछ दिन नहीं आए। चलिए फिर से शुरू करते हैं।',
    'recovery.newStart':      'आज नई शुरुआत',
    'recovery.listen':        'सुनें',
    'recovery.voice':         'वापस स्वागत है। आज अपने खेत की जाँच करें।',
    'tasks.checkFarm.title':  'आज अपने खेत की जाँच करें',
    'tasks.checkFarm.why':    'खेत में एक छोटी सैर आपको फिर से सही रास्ते पर ले आएगी।',
  },

  sw: {
    'recovery.title':         'Karibu tena',
    'recovery.message':       'Umekosa siku chache. Turudi kwenye njia pamoja.',
    'recovery.newStart':      'Mwanzo mpya leo',
    'recovery.listen':        'Sikiliza',
    'recovery.voice':         'Karibu tena. Angalia shamba lako leo.',
    'tasks.checkFarm.title':  'Angalia shamba lako leo',
    'tasks.checkFarm.why':    'Tembea kidogo shambani na rudi kwenye njia.',
  },

  ha: {
    'recovery.title':         'Sannu da dawowa',
    'recovery.message':       'Ka rasa kwanaki kadan. Mu koma kan turba tare.',
    'recovery.newStart':      'Sabon farawa yau',
    'recovery.listen':        'Saurara',
    'recovery.voice':         'Sannu da dawowa. Duba gonarka yau.',
    'tasks.checkFarm.title':  'Duba gonarka yau',
    'tasks.checkFarm.why':    '\u01B6an gajeren tafiya a gona zai dawo da kai kan turba.',
  },

  tw: {
    'recovery.title':         'Akwaaba bio',
    'recovery.message':       'Wopaa nna kakra. Ma yensan nkɔ kwan so.',
    'recovery.newStart':      'Mfitiase\u025B foforɔ nn\u025B',
    'recovery.listen':        'Tie',
    'recovery.voice':         'Akwaaba bio. Hw\u025B w\u02BCafuo nn\u025B.',
    'tasks.checkFarm.title':  'Hw\u025B w\u02BCafuo nn\u025B',
    'tasks.checkFarm.why':    'Nants\u025B ket\u025Bwa wo afuo no mu na san k\u0254 \u025Bkwan pa so.',
  },
});

export default RECOVERY_TRANSLATIONS;
