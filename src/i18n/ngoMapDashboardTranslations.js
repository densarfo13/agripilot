/**
 * ngoMapDashboardTranslations.js — i18n overlay for the new
 * NGOMapDashboard + NGOMap surfaces.
 *
 *   src/pages/NGOMapDashboard.jsx
 *   src/ngo/NGOMap.jsx
 *
 * Empty-slot fill via mergeManyOverlays — translator-authored
 * values still win.
 *
 * Strict-rule audit
 *   * Six launch locales: en/fr/sw/ha/tw/hi
 *   * `ngo.actions.pestDeploy` / `.pestAdvise` /
 *     `.droughtMonitor` / `.droughtOutreach` /
 *     `.reengageInactive` were already shipped in the earlier
 *     weeklyAndNgoActionsTranslations overlay; this overlay
 *     adds only the NEW dashboard keys plus
 *     `ngo.actions.monitor` (used as the calm default in the
 *     region table when neither risk nor reports exceed
 *     thresholds).
 *   * {count} placeholder pre-positioned per locale word order
 */

export const NGO_MAP_DASHBOARD_TRANSLATIONS = Object.freeze({
  en: {
    'ngo.dashboard.title':           'NGO Dashboard',
    'ngo.dashboard.mapTitle':        'Farm locations',
    'ngo.dashboard.actionsTitle':    'Priority actions',
    'ngo.dashboard.regionTitle':     'Regions overview',
    'ngo.dashboard.noUrgentActions': 'No urgent actions right now.',
    'ngo.dashboard.noRegionData':    'No region data yet.',

    'ngo.summary.totalFarmers':      'Total farmers',
    'ngo.summary.activeFarmers':     'Active farmers',
    'ngo.summary.highPest':          'High pest risk',
    'ngo.summary.highDrought':       'High drought risk',
    'ngo.summary.activeClusters':    'Active clusters',

    'ngo.region.country':            'Country',
    'ngo.region.region':             'Region',
    'ngo.region.crop':               'Crop',
    'ngo.region.riskCount':          'High risk',
    'ngo.region.reports':            'Reports',
    'ngo.region.recommendedAction':  'Action',

    'ngo.actions.monitor':           'Monitor this region for the next 48 hours.',

    'ngo.map.unavailable':
      'Map view unavailable. Showing data in the table below.',
    'ngo.map.loading':               'Loading map\u2026',
    'ngo.map.empty':
      'No farm locations to plot yet. Region table below covers all farms.',
    'ngo.map.farmsWithGps':          '{count} farms with GPS',
    'ngo.map.farmsRegionOnly':       '{count} in regions only',
  },

  fr: {
    'ngo.dashboard.title':           'Tableau de bord ONG',
    'ngo.dashboard.mapTitle':        'Emplacement des fermes',
    'ngo.dashboard.actionsTitle':    'Actions prioritaires',
    'ngo.dashboard.regionTitle':     'Aper\u00E7u des r\u00E9gions',
    'ngo.dashboard.noUrgentActions': 'Aucune action urgente pour le moment.',
    'ngo.dashboard.noRegionData':    'Pas encore de donn\u00E9es r\u00E9gionales.',

    'ngo.summary.totalFarmers':      'Total agriculteurs',
    'ngo.summary.activeFarmers':     'Actifs',
    'ngo.summary.highPest':          'Risque ravageurs \u00E9lev\u00E9',
    'ngo.summary.highDrought':       'Risque s\u00E9cheresse \u00E9lev\u00E9',
    'ngo.summary.activeClusters':    'Foyers actifs',

    'ngo.region.country':            'Pays',
    'ngo.region.region':             'R\u00E9gion',
    'ngo.region.crop':               'Culture',
    'ngo.region.riskCount':          'Risque \u00E9lev\u00E9',
    'ngo.region.reports':            'Signalements',
    'ngo.region.recommendedAction':  'Action',

    'ngo.actions.monitor':           'Surveiller cette r\u00E9gion pendant les 48 prochaines heures.',

    'ngo.map.unavailable':
      'Vue carte indisponible. Donn\u00E9es affich\u00E9es dans le tableau ci-dessous.',
    'ngo.map.loading':               'Chargement de la carte\u2026',
    'ngo.map.empty':
      'Aucun emplacement de ferme \u00E0 afficher. Le tableau couvre toutes les fermes.',
    'ngo.map.farmsWithGps':          '{count} fermes avec GPS',
    'ngo.map.farmsRegionOnly':       '{count} en r\u00E9gions uniquement',
  },

  sw: {
    'ngo.dashboard.title':           'Dashibodi ya NGO',
    'ngo.dashboard.mapTitle':        'Maeneo ya mashamba',
    'ngo.dashboard.actionsTitle':    'Vitendo vya kipaumbele',
    'ngo.dashboard.regionTitle':     'Muhtasari wa mikoa',
    'ngo.dashboard.noUrgentActions': 'Hakuna hatua za haraka sasa.',
    'ngo.dashboard.noRegionData':    'Bado hakuna data ya mkoa.',

    'ngo.summary.totalFarmers':      'Wakulima wote',
    'ngo.summary.activeFarmers':     'Wanaofanya kazi',
    'ngo.summary.highPest':          'Hatari kubwa ya wadudu',
    'ngo.summary.highDrought':       'Hatari kubwa ya ukame',
    'ngo.summary.activeClusters':    'Vikundi vya hatari',

    'ngo.region.country':            'Nchi',
    'ngo.region.region':             'Mkoa',
    'ngo.region.crop':               'Zao',
    'ngo.region.riskCount':          'Hatari kubwa',
    'ngo.region.reports':            'Ripoti',
    'ngo.region.recommendedAction':  'Hatua',

    'ngo.actions.monitor':           'Fuatilia mkoa huu kwa masaa 48 yajayo.',

    'ngo.map.unavailable':
      'Mwonekano wa ramani haupatikani. Tunaonyesha data kwenye jedwali hapa chini.',
    'ngo.map.loading':               'Inapakia ramani\u2026',
    'ngo.map.empty':
      'Hakuna maeneo ya mashamba ya kuonyesha bado. Jedwali la mikoa lina mashamba yote.',
    'ngo.map.farmsWithGps':          'Mashamba {count} yenye GPS',
    'ngo.map.farmsRegionOnly':       '{count} kwa mikoa pekee',
  },

  ha: {
    'ngo.dashboard.title':           'Dashboard na NGO',
    'ngo.dashboard.mapTitle':        'Wuraren gonaki',
    'ngo.dashboard.actionsTitle':    'Ayyukan da suka fi muhimmanci',
    'ngo.dashboard.regionTitle':     'Bayanan yankuna',
    'ngo.dashboard.noUrgentActions': 'Babu wani aikin gaggawa yanzu.',
    'ngo.dashboard.noRegionData':    'Babu bayanan yanki tukuna.',

    'ngo.summary.totalFarmers':      'Jimillar manoma',
    'ngo.summary.activeFarmers':     'Manoman da ke aiki',
    'ngo.summary.highPest':          'Babban ha\u01ADarin kwari',
    'ngo.summary.highDrought':       'Babban ha\u01ADarin fari',
    'ngo.summary.activeClusters':    'Tarukan ha\u01ADari',

    'ngo.region.country':            '\u01B6asa',
    'ngo.region.region':             'Yanki',
    'ngo.region.crop':               'Amfani',
    'ngo.region.riskCount':          'Babban ha\u01ADari',
    'ngo.region.reports':            'Rahotanni',
    'ngo.region.recommendedAction':  'Aiki',

    'ngo.actions.monitor':           'Sa idanu kan wannan yankin na sa\u02BCo\u02BDi 48 masu zuwa.',

    'ngo.map.unavailable':
      'Taswira ba ta nan. Muna nuna bayanai a teburin da ke \u01ADasa.',
    'ngo.map.loading':               'Ana loda taswira\u2026',
    'ngo.map.empty':
      'Babu wuraren gonaki da za a nuna tukuna. Teburin yankin yana cikin dukkan gonaki.',
    'ngo.map.farmsWithGps':          'Gonaki {count} masu GPS',
    'ngo.map.farmsRegionOnly':       '{count} a yankuna kawai',
  },

  tw: {
    'ngo.dashboard.title':           'NGO Dashboard',
    'ngo.dashboard.mapTitle':        'Mfuo no afa',
    'ngo.dashboard.actionsTitle':    'Adwuma a ɛho hia',
    'ngo.dashboard.regionTitle':     'Manp\u0254w a ɛw\u0254 h\u02BC',
    'ngo.dashboard.noUrgentActions': 'Adwuma biara nni h\u02BC s\u025Bes\u025Bei.',
    'ngo.dashboard.noRegionData':    'Manp\u0254w ho nsɛm biara nni h\u02BC ɛda.',

    'ngo.summary.totalFarmers':      'Akuafoɔ nyinaa',
    'ngo.summary.activeFarmers':     'Akuafoɔ a wɔreyɛ adwuma',
    'ngo.summary.highPest':          'Mmoawa ha\u01ADari kɛse',
    'ngo.summary.highDrought':       'Awɔw ha\u01ADari kɛse',
    'ngo.summary.activeClusters':    'Mpɛkuw ha\u01ADari',

    'ngo.region.country':            '\u0186man',
    'ngo.region.region':             'Manp\u0254w',
    'ngo.region.crop':               'Aduan',
    'ngo.region.riskCount':          'Ha\u01ADari kɛse',
    'ngo.region.reports':            'Amanneɛ',
    'ngo.region.recommendedAction':  'Adwuma',

    'ngo.actions.monitor':           'Hw\u025B saa manp\u0254w yi nnɔnhwere 48 a ɛreba.',

    'ngo.map.unavailable':
      'Asaase mfoni nni h\u02BC. Y\u025Bde nsɛm no ag\u02BD\u02BD ase wɔ ahyɛnsodeɛ no mu.',
    'ngo.map.loading':               'Ɛrelɔode asaase mfoni\u2026',
    'ngo.map.empty':
      'Mfuo afa biara nni h\u02BC ɛda. Manp\u0254w nhwehw\u025Bmu wɔ mfuo nyinaa h\u0254.',
    'ngo.map.farmsWithGps':          'Mfuo {count} a GPS w\u0254 h\u02BC',
    'ngo.map.farmsRegionOnly':       '{count} wɔ manp\u0254w nko ara mu',
  },

  hi: {
    'ngo.dashboard.title':           'NGO डैशबोर्ड',
    'ngo.dashboard.mapTitle':        'खेत स्थान',
    'ngo.dashboard.actionsTitle':    'प्राथमिकता क्रिया',
    'ngo.dashboard.regionTitle':     'क्षेत्र अवलोकन',
    'ngo.dashboard.noUrgentActions': 'अभी कोई जरूरी कार्रवाई नहीं।',
    'ngo.dashboard.noRegionData':    'अभी कोई क्षेत्र डेटा नहीं।',

    'ngo.summary.totalFarmers':      'कुल किसान',
    'ngo.summary.activeFarmers':     'सक्रिय किसान',
    'ngo.summary.highPest':          'उच्च कीट जोखिम',
    'ngo.summary.highDrought':       'उच्च सूखा जोखिम',
    'ngo.summary.activeClusters':    'सक्रिय क्लस्टर',

    'ngo.region.country':            'देश',
    'ngo.region.region':             'क्षेत्र',
    'ngo.region.crop':               'फसल',
    'ngo.region.riskCount':          'उच्च जोखिम',
    'ngo.region.reports':            'रिपोर्ट',
    'ngo.region.recommendedAction':  'क्रिया',

    'ngo.actions.monitor':           'अगले 48 घंटे इस क्षेत्र पर नज़र रखें।',

    'ngo.map.unavailable':
      'मानचित्र अनुपलब्ध। नीचे तालिका में डेटा दिखाया गया है।',
    'ngo.map.loading':               'मानचित्र लोड हो रहा है…',
    'ngo.map.empty':
      'अभी प्लॉट करने के लिए कोई खेत स्थान नहीं। क्षेत्र तालिका सभी खेतों को कवर करती है।',
    'ngo.map.farmsWithGps':          'GPS वाले {count} खेत',
    'ngo.map.farmsRegionOnly':       '{count} केवल क्षेत्र में',
  },
});

export default NGO_MAP_DASHBOARD_TRANSLATIONS;
