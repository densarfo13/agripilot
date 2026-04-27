/**
 * todayQuickTranslations.js — i18n overlay for the optimised
 * Today screen (src/pages/Today.jsx + the four little
 * components beside it).
 *
 * Empty-slot fill via mergeManyOverlays - translator-authored
 * values still win.
 *
 * Keys:
 *   today.greeting.morning / afternoon / evening
 *   today.todaysTask
 *   today.fallbackTask
 *   today.listen / today.done
 *   today.risk.pestHigh / today.risk.droughtHigh
 *   today.progress.streak / today.progress.tasksToday
 */

export const TODAY_QUICK_TRANSLATIONS = Object.freeze({
  en: {
    'today.greeting.morning':       'Good morning',
    'today.greeting.afternoon':     'Good afternoon',
    'today.greeting.evening':       'Good evening',
    'today.todaysTask':             'Today\u2019s task',
    'today.fallbackTask':           'Check your farm today',
    'today.listen':                 'Listen',
    'today.done':                   'Done',
    'today.risk.pestHigh':          'Pest risk: HIGH',
    'today.risk.droughtHigh':       'Drought risk: HIGH',
    'today.progress.streak':        'day streak',
    'today.progress.tasksToday':    'tasks today',
  },

  fr: {
    'today.greeting.morning':       'Bonjour',
    'today.greeting.afternoon':     'Bon apr\u00E8s-midi',
    'today.greeting.evening':       'Bonsoir',
    'today.todaysTask':             'T\u00E2che du jour',
    'today.fallbackTask':           'V\u00E9rifiez votre ferme aujourd\u2019hui',
    'today.listen':                 '\u00C9couter',
    'today.done':                   'Fait',
    'today.risk.pestHigh':          'Risque ravageur\u00A0: \u00C9LEV\u00C9',
    'today.risk.droughtHigh':       'Risque s\u00E9cheresse\u00A0: \u00C9LEV\u00C9',
    'today.progress.streak':        'jours de suite',
    'today.progress.tasksToday':    't\u00E2ches aujourd\u2019hui',
  },

  hi: {
    'today.greeting.morning':       'सुप्रभात',
    'today.greeting.afternoon':     'शुभ दोपहर',
    'today.greeting.evening':       'शुभ संध्या',
    'today.todaysTask':             'आज का काम',
    'today.fallbackTask':           'आज अपने खेत की जाँच करें',
    'today.listen':                 'सुनें',
    'today.done':                   'पूरा',
    'today.risk.pestHigh':          'कीट जोखिम: अधिक',
    'today.risk.droughtHigh':       'सूखा जोखिम: अधिक',
    'today.progress.streak':        'दिनों की लय',
    'today.progress.tasksToday':    'आज के काम',
  },

  sw: {
    'today.greeting.morning':       'Habari ya asubuhi',
    'today.greeting.afternoon':     'Habari ya mchana',
    'today.greeting.evening':       'Habari ya jioni',
    'today.todaysTask':             'Kazi ya leo',
    'today.fallbackTask':           'Angalia shamba lako leo',
    'today.listen':                 'Sikiliza',
    'today.done':                   'Imefanyika',
    'today.risk.pestHigh':          'Hatari ya wadudu: KUBWA',
    'today.risk.droughtHigh':       'Hatari ya ukame: KUBWA',
    'today.progress.streak':        'siku mfululizo',
    'today.progress.tasksToday':    'kazi za leo',
  },

  ha: {
    'today.greeting.morning':       'Ina kwana',
    'today.greeting.afternoon':     'Ina yini',
    'today.greeting.evening':       'Ina wuni',
    'today.todaysTask':             'Aikin yau',
    'today.fallbackTask':           'Duba gonarka yau',
    'today.listen':                 'Saurara',
    'today.done':                   'An gama',
    'today.risk.pestHigh':          'Ha\u0257arin kwari: BABBA',
    'today.risk.droughtHigh':       'Ha\u0257arin fari: BABBA',
    'today.progress.streak':        'kwanaki a jere',
    'today.progress.tasksToday':    'ayyukan yau',
  },

  tw: {
    'today.greeting.morning':       'Maakye',
    'today.greeting.afternoon':     'Maaha',
    'today.greeting.evening':       'Maadwo',
    'today.todaysTask':             '\u0190nn\u025B adwuma',
    'today.fallbackTask':           'Hw\u025B w\u02BCafuo nn\u025B',
    'today.listen':                 'Tie',
    'today.done':                   'Wie',
    'today.risk.pestHigh':          'Mmoawa asiane: \u0190S\u0186',
    'today.risk.droughtHigh':       'Aw\u0254 asiane: \u0190S\u0186',
    'today.progress.streak':        'nna a w\u0254di so',
    'today.progress.tasksToday':    '\u025Bnn\u025B adwuma',
  },
});

export default TODAY_QUICK_TRANSLATIONS;
