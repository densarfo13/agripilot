/**
 * ngoInsightsTranslations.js — i18n overlay for the NGO
 * Insights & Actions panel.
 *
 * Empty-slot fill via mergeManyOverlays - translator-authored
 * values still win.
 *
 * Keys:
 *   ngo.insights.title / sub / empty
 *   ngo.insights.farms / highPest / highDrought / vsYesterday
 *   ngo.insights.downloadJson
 *   ngo.insights.conf.high / medium / low
 *   ngo.action.collectLabels  (paired with actionEngine COLLECT_MORE_LABELS)
 *
 * (ngo.action.pestSendAgents / droughtIrrigation / pestWatch /
 *  droughtMonitor already exist in ngoControlTranslations.js
 *  from the v1.4 commit - we don't redefine them.)
 */

export const NGO_INSIGHTS_TRANSLATIONS = Object.freeze({
  en: {
    'ngo.insights.title':         'Insights & actions',
    'ngo.insights.sub':           'Region-level summary with recommended next steps.',
    'ngo.insights.empty':         'No farm data yet. Insights will appear as farmers report.',
    'ngo.insights.farms':         'farms',
    'ngo.insights.highPest':      'high pest',
    'ngo.insights.highDrought':   'high drought',
    'ngo.insights.vsYesterday':   'vs yesterday',
    'ngo.insights.downloadJson':  'Download report',
    'ngo.insights.conf.high':     'High confidence',
    'ngo.insights.conf.medium':   'Medium confidence',
    'ngo.insights.conf.low':      'Low confidence',
    'ngo.action.collectLabels':   'Visit farmers to collect more reports',
  },

  fr: {
    'ngo.insights.title':         'Aper\u00E7us et actions',
    'ngo.insights.sub':           'R\u00E9sum\u00E9 par r\u00E9gion avec les prochaines \u00E9tapes recommand\u00E9es.',
    'ngo.insights.empty':         'Pas encore de donn\u00E9es. Les aper\u00E7us appara\u00EEtront avec les rapports.',
    'ngo.insights.farms':         'fermes',
    'ngo.insights.highPest':      'ravageur \u00E9lev\u00E9',
    'ngo.insights.highDrought':   's\u00E9cheresse \u00E9lev\u00E9e',
    'ngo.insights.vsYesterday':   'vs hier',
    'ngo.insights.downloadJson':  'T\u00E9l\u00E9charger le rapport',
    'ngo.insights.conf.high':     'Confiance \u00E9lev\u00E9e',
    'ngo.insights.conf.medium':   'Confiance moyenne',
    'ngo.insights.conf.low':      'Confiance faible',
    'ngo.action.collectLabels':   'Visiter les agriculteurs pour plus de rapports',
  },

  hi: {
    'ngo.insights.title':         'अंतर्दृष्टि और कार्यवाही',
    'ngo.insights.sub':           'क्षेत्र-स्तरीय सारांश और अगला कदम।',
    'ngo.insights.empty':         'अभी कोई खेत डेटा नहीं। किसान रिपोर्ट करते ही अंतर्दृष्टि दिखेगी।',
    'ngo.insights.farms':         'खेत',
    'ngo.insights.highPest':      'अधिक कीट',
    'ngo.insights.highDrought':   'अधिक सूखा',
    'ngo.insights.vsYesterday':   'कल की तुलना में',
    'ngo.insights.downloadJson':  'रिपोर्ट डाउनलोड करें',
    'ngo.insights.conf.high':     'अधिक विश्वास',
    'ngo.insights.conf.medium':   'मध्यम विश्वास',
    'ngo.insights.conf.low':      'कम विश्वास',
    'ngo.action.collectLabels':   'अधिक रिपोर्ट के लिए किसानों से मिलें',
  },

  sw: {
    'ngo.insights.title':         'Maarifa na hatua',
    'ngo.insights.sub':           'Muhtasari wa kanda na hatua zinazopendekezwa.',
    'ngo.insights.empty':         'Hakuna data ya shamba bado. Maarifa yataonekana wakulima wakianza kuripoti.',
    'ngo.insights.farms':         'mashamba',
    'ngo.insights.highPest':      'wadudu wengi',
    'ngo.insights.highDrought':   'ukame mkubwa',
    'ngo.insights.vsYesterday':   'ikilinganishwa na jana',
    'ngo.insights.downloadJson':  'Pakua ripoti',
    'ngo.insights.conf.high':     'Imani kubwa',
    'ngo.insights.conf.medium':   'Imani ya wastani',
    'ngo.insights.conf.low':      'Imani ndogo',
    'ngo.action.collectLabels':   'Tembelea wakulima kukusanya ripoti zaidi',
  },

  ha: {
    'ngo.insights.title':         'Fahimta da matakai',
    'ngo.insights.sub':           'Tak\u0257aitaccen yanki da matakai da aka ba da shawara.',
    'ngo.insights.empty':         'Babu bayanan gona tukuna. Fahimta za ta bayyana yayin da man\u014Doma ke bada rahoto.',
    'ngo.insights.farms':         'gonaki',
    'ngo.insights.highPest':      'kwari masu yawa',
    'ngo.insights.highDrought':   'fari mai tsanani',
    'ngo.insights.vsYesterday':   'idan aka kwatanta da jiya',
    'ngo.insights.downloadJson':  'Sauke rahoto',
    'ngo.insights.conf.high':     'Tabbas mai \u0257aukaka',
    'ngo.insights.conf.medium':   'Matsakaicin tabbas',
    'ngo.insights.conf.low':      '\u1E62a\u0257an\u0257aicin tabbas',
    'ngo.action.collectLabels':   'Ziyarci man\u014Doma don tara karin rahotanni',
  },

  tw: {
    'ngo.insights.title':         'Ntease ne nneyɛe',
    'ngo.insights.sub':           '\u0186man mu mpoano + akwankyer\u025B a y\u025Bt\u025B b\u0254.',
    'ngo.insights.empty':         '\u00D8 afuom data nni h\u0254 nn\u025B. Ntease b\u025Bba s\u025B akuafo amane\u025B b\u025Bba.',
    'ngo.insights.farms':         'mfuw',
    'ngo.insights.highPest':      'mmoawa pii',
    'ngo.insights.highDrought':   'aw\u0254 k\u025Bse',
    'ngo.insights.vsYesterday':   'ne nnora ho',
    'ngo.insights.downloadJson':  'Twe report no',
    'ngo.insights.conf.high':     'Ahodina k\u025Bse',
    'ngo.insights.conf.medium':   'Mfimfini ahodina',
    'ngo.insights.conf.low':      'Ahodina ket\u025Bwa',
    'ngo.action.collectLabels':   'K\u0254 nsra akuafo na boa amane\u025B foforo',
  },
});

export default NGO_INSIGHTS_TRANSLATIONS;
