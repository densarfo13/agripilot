/**
 * weeklyAndNgoActionsTranslations.js — i18n overlay for the
 * WeeklySummary component + the dashboard-level NGO action
 * recommendations (src/ngo/actionRecommendations.js).
 *
 * Empty-slot fill via mergeManyOverlays — translator-authored
 * values still win.
 *
 * Keys covered
 *   weekly.tasks / weekly.checks / weekly.reports
 *   weekly.streak (with {days} interpolation)
 *   weekly.checksLine (with {count} interpolation)
 *   weekly.message.welcome / .strong / .steady / .encourage
 *
 *   ngo.actions.pestDeploy
 *   ngo.actions.pestAdvise
 *   ngo.actions.droughtMonitor
 *   ngo.actions.droughtOutreach
 *   ngo.actions.reengageInactive
 *
 * Strict-rule audit
 *   * Supportive copy: weekly messages never include "missed",
 *     "behind", "failed". Always reflect the farmer's progress
 *     back positively.
 *   * NGO action strings are imperative + specific so the panel
 *     reads as a to-do list, not a metric leak.
 *   * `weekly.title` is intentionally omitted here because it
 *     already lives in src/i18n/translations.js (line 6202)
 *     across all 6 launch locales — overlays only fill empty
 *     slots, so re-declaring would be redundant.
 *   * Five launch locales: en/fr/sw/ha/tw/hi.
 */

export const WEEKLY_AND_NGO_ACTIONS_TRANSLATIONS = Object.freeze({
  en: {
    'weekly.tasks':              'Tasks done',
    'weekly.checks':             'Farm checks',
    'weekly.reports':            'Reports',
    'weekly.streak':             '{days} day streak',
    'weekly.checksLine':         'You checked your farm {count} times this week.',
    'weekly.message.welcome':    'Welcome \u2014 start by checking your farm today.',
    'weekly.message.strong':     'Excellent. You checked your farm most days this week.',
    'weekly.message.steady':     'Good work. Keep checking your crops.',
    'weekly.message.encourage':  'Nice start. Try one quick check tomorrow.',

    'ngo.actions.pestDeploy':       'Send field agent to inspect high-risk farms',
    'ngo.actions.pestAdvise':       'Advise farmers to check crops today',
    'ngo.actions.droughtMonitor':   'Monitor drought-risk farms this week',
    'ngo.actions.droughtOutreach':  'Reach out to farmers about water-saving practices',
    'ngo.actions.reengageInactive': 'Follow up with inactive farmers this week',
  },

  fr: {
    'weekly.tasks':              'T\u00E2ches faites',
    'weekly.checks':             'Visites de la ferme',
    'weekly.reports':            'Signalements',
    'weekly.streak':             '{days} jours d\u2019affil\u00E9e',
    'weekly.checksLine':         'Vous avez visit\u00E9 votre ferme {count} fois cette semaine.',
    'weekly.message.welcome':    'Bienvenue \u2014 commencez par v\u00E9rifier votre ferme aujourd\u2019hui.',
    'weekly.message.strong':     'Excellent. Vous avez v\u00E9rifi\u00E9 votre ferme presque tous les jours cette semaine.',
    'weekly.message.steady':     'Bon travail. Continuez \u00E0 surveiller vos cultures.',
    'weekly.message.encourage':  'Bon d\u00E9but. Essayez une petite visite demain.',

    'ngo.actions.pestDeploy':       'Envoyer un agent v\u00E9rifier les fermes \u00E0 haut risque',
    'ngo.actions.pestAdvise':       'Conseiller aux agriculteurs de v\u00E9rifier leurs cultures aujourd\u2019hui',
    'ngo.actions.droughtMonitor':   'Surveiller les fermes \u00E0 risque de s\u00E9cheresse cette semaine',
    'ngo.actions.droughtOutreach':  'Contacter les agriculteurs sur les pratiques d\u2019\u00E9conomie d\u2019eau',
    'ngo.actions.reengageInactive': 'Recontacter les agriculteurs inactifs cette semaine',
  },

  sw: {
    'weekly.tasks':              'Kazi zilizofanywa',
    'weekly.checks':             'Ukaguzi wa shamba',
    'weekly.reports':            'Ripoti',
    'weekly.streak':             'Siku {days} mfululizo',
    'weekly.checksLine':         'Umeangalia shamba lako mara {count} wiki hii.',
    'weekly.message.welcome':    'Karibu \u2014 anza kwa kuangalia shamba lako leo.',
    'weekly.message.strong':     'Vizuri sana. Umeangalia shamba lako siku nyingi wiki hii.',
    'weekly.message.steady':     'Kazi nzuri. Endelea kuangalia mazao yako.',
    'weekly.message.encourage':  'Mwanzo mzuri. Jaribu ukaguzi mfupi kesho.',

    'ngo.actions.pestDeploy':       'Tuma afisa wa shamba kukagua mashamba yaliyo hatarini',
    'ngo.actions.pestAdvise':       'Washauri wakulima kuangalia mazao leo',
    'ngo.actions.droughtMonitor':   'Fuatilia mashamba yenye hatari ya ukame wiki hii',
    'ngo.actions.droughtOutreach':  'Wafikie wakulima kuhusu njia za kuhifadhi maji',
    'ngo.actions.reengageInactive': 'Wafuatilie wakulima wasiokuwa hai wiki hii',
  },

  ha: {
    'weekly.tasks':              'Ayyukan da aka kammala',
    'weekly.checks':             'Dubawa gona',
    'weekly.reports':            'Rahotanni',
    'weekly.streak':             'Kwanaki {days} jere',
    'weekly.checksLine':         'Ka duba gonarka sau {count} a wannan mako.',
    'weekly.message.welcome':    'Sannu \u2014 fara da duba gonarka yau.',
    'weekly.message.strong':     'Madalla. Ka duba gonarka kusan kowace rana a wannan mako.',
    'weekly.message.steady':     'Aiki nagari. Ci gaba da duba amfanin gonarka.',
    'weekly.message.encourage':  'Farawa mai kyau. Gwada \u01ADaramin dubawa gobe.',

    'ngo.actions.pestDeploy':       'Aika wakili filin ya duba gonaki masu ha\u01ADari',
    'ngo.actions.pestAdvise':       'Shawarci manoma su duba amfanin gonarsu yau',
    'ngo.actions.droughtMonitor':   'Sa idanu kan gonaki masu ha\u01ADarin fari a wannan mako',
    'ngo.actions.droughtOutreach':  'Tuntu\u01B6i manoma game da hanyoyin tanadin ruwa',
    'ngo.actions.reengageInactive': 'Bi sahun manoman da ba sa aiki a wannan mako',
  },

  tw: {
    'weekly.tasks':              'Adwuma a yɛaw\u02BCie',
    'weekly.checks':             'Afuo nhwehwɛmu',
    'weekly.reports':            'Amanneɛ',
    'weekly.streak':             'Nna {days} a w\u02BCa to',
    'weekly.checksLine':         'Wo ahw\u025B w\u02BCafuo mpɛn {count} nnawɔtwe yi mu.',
    'weekly.message.welcome':    'Akwaaba \u2014 fi ase hw\u025B w\u02BCafuo nn\u025B.',
    'weekly.message.strong':     'Ɛy\u025B papa pa. Wo ahw\u025B w\u02BCafuo nna pii nnawɔtwe yi mu.',
    'weekly.message.steady':     'Adwuma pa. K\u0254 so hw\u025B w\u02BCafoa.',
    'weekly.message.encourage':  'Mfitiase pa. S\u0254 hw\u025B kakra ɔkyena.',

    'ngo.actions.pestDeploy':       'Soma adwumayɛni kɔhw\u025B mfuo a asoɛhia w\u02BCom',
    'ngo.actions.pestAdvise':       'Tu akuafoɔ fo s\u025B wonhwɛ wɔn afoa nn\u025B',
    'ngo.actions.droughtMonitor':   'Hw\u025B mfuo a awɔw \u025Bb\u025Bba so nnawɔtwe yi',
    'ngo.actions.droughtOutreach':  'Frɛ akuafoɔ ka nsuo so hwɛ akwan',
    'ngo.actions.reengageInactive': 'Bisa akuafoɔ a wɔnny\u025B adwuma nnawɔtwe yi',
  },

  hi: {
    'weekly.tasks':              'पूर्ण कार्य',
    'weekly.checks':             'खेत की जाँच',
    'weekly.reports':            'रिपोर्ट',
    'weekly.streak':             '{days} दिन की स्ट्रीक',
    'weekly.checksLine':         'आपने इस सप्ताह अपने खेत की {count} बार जाँच की।',
    'weekly.message.welcome':    'स्वागत है — आज अपने खेत की जाँच से शुरू करें।',
    'weekly.message.strong':     'बहुत बढ़िया। आपने इस सप्ताह लगभग हर दिन अपने खेत की जाँच की।',
    'weekly.message.steady':     'अच्छा काम। अपनी फसलों की जाँच करते रहें।',
    'weekly.message.encourage':  'अच्छी शुरुआत। कल एक छोटी जाँच आज़माएँ।',

    'ngo.actions.pestDeploy':       'उच्च-जोखिम खेतों की जाँच के लिए फील्ड एजेंट भेजें',
    'ngo.actions.pestAdvise':       'किसानों को आज फसल जाँचने की सलाह दें',
    'ngo.actions.droughtMonitor':   'इस सप्ताह सूखा-जोखिम खेतों पर नज़र रखें',
    'ngo.actions.droughtOutreach':  'किसानों से जल-संरक्षण के बारे में संपर्क करें',
    'ngo.actions.reengageInactive': 'इस सप्ताह निष्क्रिय किसानों से संपर्क करें',
  },
});

export default WEEKLY_AND_NGO_ACTIONS_TRANSLATIONS;
