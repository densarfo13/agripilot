/**
 * riskTranslations.js — i18n overlay for the predictive-risk layer
 * (drought + pest risk scoring on top of the Outbreak Intelligence
 * System).
 *
 * Empty-slot fill via mergeManyOverlays - translator-authored
 * values still win.
 *
 * Keys (kept in step with the components):
 *   risk.pestHigh / risk.droughtHigh
 *   risk.checkNow / risk.waterNow
 *   risk.takeAction
 *   risk.voice.high
 *   risk.summary.title / risk.summary.sub / risk.summary.empty
 *   risk.summary.highPest / risk.summary.highDrought
 *   risk.summary.farms
 */

export const RISK_TRANSLATIONS = Object.freeze({
  en: {
    'risk.pestHigh':         'Pest risk rising. Check crops now.',
    'risk.droughtHigh':      'Dry conditions. Water your crops.',
    'risk.checkNow':         'Check crop',
    'risk.waterNow':         'Water crops',
    'risk.takeAction':       'High risk on your farm. Take action today.',
    'risk.voice.high':       'High risk on your farm. Take action today.',
    'risk.summary.title':    'Risk by region',
    'risk.summary.sub':      'Farms at HIGH pest or drought risk in each region.',
    'risk.summary.empty':    'No farms at HIGH risk right now.',
    'risk.summary.highPest':    'high pest',
    'risk.summary.highDrought': 'high drought',
    'risk.summary.farms':       'farms',
  },

  fr: {
    'risk.pestHigh':         'Risque de ravageur en hausse. V\u00E9rifiez vos cultures.',
    'risk.droughtHigh':      'Temps sec. Arrosez vos cultures.',
    'risk.checkNow':         'V\u00E9rifier la culture',
    'risk.waterNow':         'Arroser les cultures',
    'risk.takeAction':       'Risque \u00E9lev\u00E9 sur votre ferme. Agissez aujourd\u2019hui.',
    'risk.voice.high':       'Risque \u00E9lev\u00E9 sur votre ferme. Agissez aujourd\u2019hui.',
    'risk.summary.title':    'Risque par r\u00E9gion',
    'risk.summary.sub':      'Fermes en risque \u00C9LEV\u00C9 (ravageur ou s\u00E9cheresse) par r\u00E9gion.',
    'risk.summary.empty':    'Aucune ferme en risque \u00E9lev\u00E9 pour l\u2019instant.',
    'risk.summary.highPest':    'ravageur \u00E9lev\u00E9',
    'risk.summary.highDrought': 's\u00E9cheresse \u00E9lev\u00E9e',
    'risk.summary.farms':       'fermes',
  },

  hi: {
    'risk.pestHigh':         'कीट जोखिम बढ़ रहा है। अभी फसल देखें।',
    'risk.droughtHigh':      'सूखी स्थिति। अपनी फसल को पानी दें।',
    'risk.checkNow':         'फसल देखें',
    'risk.waterNow':         'फसल को पानी दें',
    'risk.takeAction':       'आपके खेत पर अधिक जोखिम। आज ही कार्रवाई करें।',
    'risk.voice.high':       'आपके खेत पर अधिक जोखिम। आज ही कार्रवाई करें।',
    'risk.summary.title':    'क्षेत्रीय जोखिम',
    'risk.summary.sub':      'प्रत्येक क्षेत्र में कीट या सूखे के अधिक जोखिम वाले खेत।',
    'risk.summary.empty':    'अभी कोई खेत अधिक जोखिम पर नहीं है।',
    'risk.summary.highPest':    'अधिक कीट',
    'risk.summary.highDrought': 'अधिक सूखा',
    'risk.summary.farms':       'खेत',
  },

  sw: {
    'risk.pestHigh':         'Hatari ya wadudu inaongezeka. Angalia zao sasa.',
    'risk.droughtHigh':      'Hali kavu. Mwagilia mazao yako.',
    'risk.checkNow':         'Angalia zao',
    'risk.waterNow':         'Mwagilia mazao',
    'risk.takeAction':       'Hatari kubwa shambani kwako. Chukua hatua leo.',
    'risk.voice.high':       'Hatari kubwa shambani kwako. Chukua hatua leo.',
    'risk.summary.title':    'Hatari kwa kanda',
    'risk.summary.sub':      'Mashamba yaliyo katika hatari kubwa ya wadudu au ukame kwa kila kanda.',
    'risk.summary.empty':    'Hakuna shamba lililo katika hatari kubwa sasa.',
    'risk.summary.highPest':    'wadudu wengi',
    'risk.summary.highDrought': 'ukame mkubwa',
    'risk.summary.farms':       'mashamba',
  },

  ha: {
    'risk.pestHigh':         'Ha\u0257arin kwari na ta\u0253arwa. Duba shukarka yanzu.',
    'risk.droughtHigh':      'Yanayin bushewa. Ba shukarka ruwa.',
    'risk.checkNow':         'Duba shuka',
    'risk.waterNow':         'Ba shuka ruwa',
    'risk.takeAction':       'Babban ha\u0257ari a gonarka. Yi aiki yau.',
    'risk.voice.high':       'Babban ha\u0257ari a gonarka. Yi aiki yau.',
    'risk.summary.title':    'Ha\u0257ari kowace yanki',
    'risk.summary.sub':      'Gonaki masu babban ha\u0257ari na kwari ko fari a kowace yanki.',
    'risk.summary.empty':    'Babu gona da ke da babban ha\u0257ari yanzu.',
    'risk.summary.highPest':    'kwari masu yawa',
    'risk.summary.highDrought': 'fari mai tsanani',
    'risk.summary.farms':       'gonaki',
  },

  tw: {
    'risk.pestHigh':         'Mmoawa asiane reb\u025Bs\u0254. Hw\u025B w\u2019aduane seesei.',
    'risk.droughtHigh':      'Aw\u0254 berɛ. Gugu w\u2019aduane so nsuo.',
    'risk.checkNow':         'Hw\u025B aduane no',
    'risk.waterNow':         'Gugu nsuo',
    'risk.takeAction':       'Asiane k\u025Bse w\u0254 w\u2019afuo so. Y\u025B biribi nn\u025B.',
    'risk.voice.high':       'Asiane k\u025Bse w\u0254 w\u2019afuo so. Y\u025B biribi nn\u025B.',
    'risk.summary.title':    'Asiane wɔ ɔman mu biara',
    'risk.summary.sub':      'Mfuw a w\u0254w\u0254 mmoawa anaa aw\u0254 asiane k\u025Bse mu wɔ ɔman mu biara.',
    'risk.summary.empty':    'Afuo biara nni asiane k\u025Bse mu seesei.',
    'risk.summary.highPest':    'mmoawa pii',
    'risk.summary.highDrought': 'aw\u0254 k\u025Bse',
    'risk.summary.farms':       'mfuw',
  },
});

export default RISK_TRANSLATIONS;
