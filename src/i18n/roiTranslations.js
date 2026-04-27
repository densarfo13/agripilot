/**
 * roiTranslations.js — i18n overlay for the ROI panel + the
 * downloadable Farroway Impact Report.
 *
 * Empty-slot fill via mergeManyOverlays - translator-authored
 * values still win.
 *
 * Keys:
 *   roi.title
 *   roi.window.thisWeek                "Last {n} days"
 *   roi.completionRate / avgChecks / reportsPerWeek
 *   roi.message.collecting / moderate / detection / strong
 *   roi.download.text
 *   roi.report.title / subtitle / observed / context /
 *     conclusion / generated
 *   roi.bullet.engagement / detection / behavior
 *   roi.activeFarmers / tasksCompleted / reports
 */

export const ROI_TRANSLATIONS = Object.freeze({
  en: {
    'roi.title':                'Programme impact',
    'roi.window.thisWeek':      'Last {n} days',
    'roi.completionRate':       'Task completion rate',
    'roi.avgChecks':            'Avg checks per week',
    'roi.reportsPerWeek':       'Pest reports per week',
    'roi.message.collecting':   'Farroway is collecting data. Impact will be visible as more farmers report.',
    'roi.message.moderate':     'Farmers using Farroway are checking their crops more often than baseline.',
    'roi.message.detection':    'Farroway is surfacing pest signals farmers would otherwise miss.',
    'roi.message.strong':       'Farmers using Farroway are checking crops more often AND identifying risks earlier.',
    'roi.download.text':        'Download report',
    'roi.report.title':         'Farroway Impact Report',
    'roi.report.subtitle':      'Summary for the last {n} days',
    'roi.report.observed':      'Observed:',
    'roi.report.context':       'Context',
    'roi.report.conclusion':    'Conclusion: Farroway improves daily farm decision-making.',
    'roi.report.generated':     'Generated {ts}',
    'roi.bullet.engagement':    'Increased farmer engagement',
    'roi.bullet.detection':     'Earlier pest detection',
    'roi.bullet.behavior':      'Improved monitoring behavior',
    'roi.activeFarmers':        'Active farmers',
    'roi.tasksCompleted':       'Tasks completed',
    'roi.reports':              'Pest reports',
  },

  fr: {
    'roi.title':                'Impact du programme',
    'roi.window.thisWeek':      'Sur les {n} derniers jours',
    'roi.completionRate':       'Taux de t\u00E2ches termin\u00E9es',
    'roi.avgChecks':            'V\u00E9rifications / semaine',
    'roi.reportsPerWeek':       'Rapports ravageur / semaine',
    'roi.message.collecting':   'Farroway collecte des donn\u00E9es. L\u2019impact sera visible avec plus de rapports.',
    'roi.message.moderate':     'Les agriculteurs Farroway v\u00E9rifient leurs cultures plus souvent.',
    'roi.message.detection':    'Farroway fait remonter des signaux que les agriculteurs auraient manqu\u00E9s.',
    'roi.message.strong':       'Les agriculteurs Farroway v\u00E9rifient plus souvent ET d\u00E9tectent plus t\u00F4t.',
    'roi.download.text':        'T\u00E9l\u00E9charger le rapport',
    'roi.report.title':         'Rapport d\u2019impact Farroway',
    'roi.report.subtitle':      'R\u00E9sum\u00E9 sur les {n} derniers jours',
    'roi.report.observed':      'Observ\u00E9\u00A0:',
    'roi.report.context':       'Contexte',
    'roi.report.conclusion':    'Conclusion\u00A0: Farroway am\u00E9liore les d\u00E9cisions quotidiennes \u00E0 la ferme.',
    'roi.report.generated':     'G\u00E9n\u00E9r\u00E9 {ts}',
    'roi.bullet.engagement':    'Engagement accru des agriculteurs',
    'roi.bullet.detection':     'D\u00E9tection plus pr\u00E9coce',
    'roi.bullet.behavior':      'Suivi am\u00E9lior\u00E9',
    'roi.activeFarmers':        'Agriculteurs actifs',
    'roi.tasksCompleted':       'T\u00E2ches termin\u00E9es',
    'roi.reports':              'Rapports ravageur',
  },

  hi: {
    'roi.title':                'कार्यक्रम प्रभाव',
    'roi.window.thisWeek':      'पिछले {n} दिन',
    'roi.completionRate':       'कार्य पूर्ति दर',
    'roi.avgChecks':            'औसत साप्ताहिक जाँच',
    'roi.reportsPerWeek':       'साप्ताहिक कीट रिपोर्ट',
    'roi.message.collecting':   'Farroway डेटा एकत्र कर रहा है। अधिक रिपोर्ट के साथ प्रभाव दिखेगा।',
    'roi.message.moderate':     'Farroway किसान फसल अधिक बार देख रहे हैं।',
    'roi.message.detection':    'Farroway कीट संकेत सामने ला रहा है जो किसान अन्यथा चूक जाते।',
    'roi.message.strong':       'Farroway किसान फसल अधिक बार देख रहे हैं और जोखिम जल्दी पहचान रहे हैं।',
    'roi.download.text':        'रिपोर्ट डाउनलोड करें',
    'roi.report.title':         'Farroway प्रभाव रिपोर्ट',
    'roi.report.subtitle':      'पिछले {n} दिनों का सारांश',
    'roi.report.observed':      'देखा गया:',
    'roi.report.context':       'संदर्भ',
    'roi.report.conclusion':    'निष्कर्ष: Farroway दैनिक खेत निर्णय सुधारता है।',
    'roi.report.generated':     '{ts} पर बनाया गया',
    'roi.bullet.engagement':    'किसान भागीदारी बढ़ी',
    'roi.bullet.detection':     'कीट की जल्दी पहचान',
    'roi.bullet.behavior':      'बेहतर निगरानी',
    'roi.activeFarmers':        'सक्रिय किसान',
    'roi.tasksCompleted':       'पूर्ण कार्य',
    'roi.reports':              'कीट रिपोर्ट',
  },

  sw: {
    'roi.title':                'Athari ya programu',
    'roi.window.thisWeek':      'Siku {n} zilizopita',
    'roi.completionRate':       'Asilimia ya kazi zilizokamilika',
    'roi.avgChecks':            'Wastani wa ukaguzi kwa wiki',
    'roi.reportsPerWeek':       'Ripoti za wadudu kwa wiki',
    'roi.message.collecting':   'Farroway inakusanya data. Athari itaonekana kadri wakulima wanavyoripoti.',
    'roi.message.moderate':     'Wakulima wa Farroway wanakagua mazao mara nyingi zaidi.',
    'roi.message.detection':    'Farroway inaonyesha viashiria vya wadudu ambavyo wakulima wangekosa.',
    'roi.message.strong':       'Wakulima wa Farroway wanakagua mara nyingi NA kugundua hatari mapema.',
    'roi.download.text':        'Pakua ripoti',
    'roi.report.title':         'Ripoti ya Athari ya Farroway',
    'roi.report.subtitle':      'Muhtasari wa siku {n} zilizopita',
    'roi.report.observed':      'Iliyobainika:',
    'roi.report.context':       'Muktadha',
    'roi.report.conclusion':    'Hitimisho: Farroway inaboresha maamuzi ya kila siku shambani.',
    'roi.report.generated':     'Imetolewa {ts}',
    'roi.bullet.engagement':    'Ushiriki ulioongezeka wa wakulima',
    'roi.bullet.detection':     'Ugunduzi wa mapema wa wadudu',
    'roi.bullet.behavior':      'Ufuatiliaji bora',
    'roi.activeFarmers':        'Wakulima hai',
    'roi.tasksCompleted':       'Kazi zilizokamilika',
    'roi.reports':              'Ripoti za wadudu',
  },

  ha: {
    'roi.title':                'Tasirin shirin',
    'roi.window.thisWeek':      'Kwanaki {n} da suka wuce',
    'roi.completionRate':       'Adadin kammala ayyuka',
    'roi.avgChecks':            'Matsakaicin duba kowane mako',
    'roi.reportsPerWeek':       'Rahoton kwari kowane mako',
    'roi.message.collecting':   'Farroway na tara bayanai. Tasiri zai bayyana yayin da rahotanni suka karu.',
    'roi.message.moderate':     'Man\u014Doman Farroway suna duba shukokinsu sosai.',
    'roi.message.detection':    'Farroway na nuna alamomin kwari da man\u014Doma za su rasa in ba haka ba.',
    'roi.message.strong':       'Man\u014Doman Farroway suna duba sosai KUMA ga\u0257in haxari da wuri.',
    'roi.download.text':        'Sauke rahoto',
    'roi.report.title':         'Rahoton Tasirin Farroway',
    'roi.report.subtitle':      'Tak\u0257aitaccen kwanaki {n} da suka wuce',
    'roi.report.observed':      'An lura:',
    'roi.report.context':       'Mahallin',
    'roi.report.conclusion':    'Kammalawa: Farroway na inganta yanke shawara na yau da kullum.',
    'roi.report.generated':     'An samar {ts}',
    'roi.bullet.engagement':    '\u01B6arar shigar man\u014Doma',
    'roi.bullet.detection':     'Ga\u0257in kwari da wuri',
    'roi.bullet.behavior':      'Inganta sa ido',
    'roi.activeFarmers':        'Man\u014Doma masu aiki',
    'roi.tasksCompleted':       'Ayyukan da aka kammala',
    'roi.reports':              'Rahotannin kwari',
  },

  tw: {
    'roi.title':                'D\u025Bm a programme no de aba',
    'roi.window.thisWeek':      'Nna {n} a atwam',
    'roi.completionRate':       'Adwuma a awie do',
    'roi.avgChecks':            'Hwehwemu bere ko dapen',
    'roi.reportsPerWeek':       'Mmoawa amane\u025B dapen biara',
    'roi.message.collecting':   'Farroway reboaboa data. D\u025Bm a aba b\u025Bda adi s\u025B akuafo de amane\u025B b\u025Bba pii.',
    'roi.message.moderate':     'Farroway akuafo hwehwe w\u02BCaduane mu pii.',
    'roi.message.detection':    'Farroway de mmoawa nsiwa pue ma akuafo a anka w\u0254b\u025Bka.',
    'roi.message.strong':       'Farroway akuafo hwehwe pii NA w\u0254hu asiane ntem.',
    'roi.download.text':        'Twe report no',
    'roi.report.title':         'Farroway D\u025Bm Report',
    'roi.report.subtitle':      'Tiawa wo nna {n} a atwam',
    'roi.report.observed':      'Ade a wohu:',
    'roi.report.context':       'D\u025Bm',
    'roi.report.conclusion':    'Awie\u025B: Farroway ma afuom gyinae\u025B daa y\u025B yie.',
    'roi.report.generated':     'W\u0254ay\u025B {ts}',
    'roi.bullet.engagement':    'Akuafo nsa baa mu pii',
    'roi.bullet.detection':     'Mmoawa hu ntem',
    'roi.bullet.behavior':      'Hwehwemu a y\u025B yie',
    'roi.activeFarmers':        'Akuafo a w\u0254y\u025B adwuma',
    'roi.tasksCompleted':       'Adwuma a awie',
    'roi.reports':              'Mmoawa amane\u025B',
  },
});

export default ROI_TRANSLATIONS;
