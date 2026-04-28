/**
 * retentionTranslations.js — i18n overlay for the retention
 * engine surfaces (DailyMessage banner + YesterdayMemory line).
 *
 * Empty-slot fill via mergeManyOverlays — translator-authored
 * values still win.
 *
 * Keys covered
 *   daily.message.pestRisk         "Pest risk today. Check your crops."
 *   daily.message.droughtRisk      "Dry conditions today. Check soil moisture."
 *   daily.message.heavyRain        "Heavy rain expected today. Plan around wet conditions."
 *   daily.message.lightRain        "Some rain expected today."
 *   daily.message.rainyWeek        "Rain expected this week."
 *   daily.message.hotDay           "Hot day ahead. Water crops early."
 *   daily.message.fallback         "Check your farm today."
 *
 *   memory.yesterdayLine           "Yesterday you {action}."
 *   memory.task.prepareRows        "prepared your rows"
 *   memory.task.weedRows           "cleared weeds from your rows"
 *   memory.task.scoutPests         "checked for pests"
 *   memory.task.checkMoisture      "checked soil moisture"
 *   memory.task.waterCrops         "watered your crops"
 *   memory.task.fertilize          "fertilised your crops"
 *   memory.task.prepareHarvest     "prepared for harvest"
 *   memory.task.checkFarm          "checked your farm"
 *
 * Strict-rule audit
 *   * Six launch locales: en/fr/sw/ha/tw/hi
 *   * Daily message copy is calm + actionable; never alarmist
 *   * Memory copy is supportive; never "you missed", "you
 *     skipped", "you forgot"
 *   * {action} placeholder pre-positioned for each locale's
 *     idiomatic word order
 */

export const RETENTION_TRANSLATIONS = Object.freeze({
  en: {
    'daily.message.pestRisk':       'Pest risk today. Check your crops.',
    'daily.message.droughtRisk':    'Dry conditions today. Check soil moisture.',
    'daily.message.heavyRain':      'Heavy rain expected today. Plan around wet conditions.',
    'daily.message.lightRain':      'Some rain expected today.',
    'daily.message.rainyWeek':      'Rain expected this week.',
    'daily.message.hotDay':         'Hot day ahead. Water crops early.',
    'daily.message.fallback':       'Check your farm today.',

    'memory.yesterdayLine':         'Yesterday you {action}.',
    'memory.task.prepareRows':      'prepared your rows',
    'memory.task.weedRows':         'cleared weeds from your rows',
    'memory.task.scoutPests':       'checked for pests',
    'memory.task.checkMoisture':    'checked soil moisture',
    'memory.task.waterCrops':       'watered your crops',
    'memory.task.fertilize':        'fertilised your crops',
    'memory.task.prepareHarvest':   'prepared for harvest',
    'memory.task.checkFarm':        'checked your farm',
  },

  fr: {
    'daily.message.pestRisk':       'Risque de nuisibles aujourd\u2019hui. V\u00E9rifiez vos cultures.',
    'daily.message.droughtRisk':    'Conditions s\u00E8ches aujourd\u2019hui. V\u00E9rifiez l\u2019humidit\u00E9 du sol.',
    'daily.message.heavyRain':      'Forte pluie pr\u00E9vue aujourd\u2019hui. Pr\u00E9voyez en cons\u00E9quence.',
    'daily.message.lightRain':      'Un peu de pluie pr\u00E9vue aujourd\u2019hui.',
    'daily.message.rainyWeek':      'Pluie pr\u00E9vue cette semaine.',
    'daily.message.hotDay':         'Journ\u00E9e chaude. Arrosez t\u00F4t.',
    'daily.message.fallback':       'V\u00E9rifiez votre ferme aujourd\u2019hui.',

    'memory.yesterdayLine':         'Hier, vous avez {action}.',
    'memory.task.prepareRows':      'pr\u00E9par\u00E9 vos rang\u00E9es',
    'memory.task.weedRows':         'enlev\u00E9 les mauvaises herbes',
    'memory.task.scoutPests':       'v\u00E9rifi\u00E9 les nuisibles',
    'memory.task.checkMoisture':    'v\u00E9rifi\u00E9 l\u2019humidit\u00E9 du sol',
    'memory.task.waterCrops':       'arros\u00E9 vos cultures',
    'memory.task.fertilize':        'fertilis\u00E9 vos cultures',
    'memory.task.prepareHarvest':   'pr\u00E9par\u00E9 la r\u00E9colte',
    'memory.task.checkFarm':        'v\u00E9rifi\u00E9 votre ferme',
  },

  sw: {
    'daily.message.pestRisk':       'Hatari ya wadudu leo. Angalia mazao yako.',
    'daily.message.droughtRisk':    'Hali kavu leo. Angalia unyevu wa udongo.',
    'daily.message.heavyRain':      'Mvua kubwa inatarajiwa leo. Panga ipasavyo.',
    'daily.message.lightRain':      'Mvua kidogo inatarajiwa leo.',
    'daily.message.rainyWeek':      'Mvua inatarajiwa wiki hii.',
    'daily.message.hotDay':         'Siku ya joto. Mwagilia mapema.',
    'daily.message.fallback':       'Angalia shamba lako leo.',

    'memory.yesterdayLine':         'Jana ulifanya: {action}.',
    'memory.task.prepareRows':      'kuandaa mistari',
    'memory.task.weedRows':         'kuondoa magugu',
    'memory.task.scoutPests':       'kuangalia wadudu',
    'memory.task.checkMoisture':    'kuangalia unyevu wa udongo',
    'memory.task.waterCrops':       'kumwagilia mazao',
    'memory.task.fertilize':        'kuweka mbolea',
    'memory.task.prepareHarvest':   'kuandaa mavuno',
    'memory.task.checkFarm':        'kuangalia shamba lako',
  },

  ha: {
    'daily.message.pestRisk':       'Ha\u01ADarin kwari yau. Duba amfanin gona.',
    'daily.message.droughtRisk':    'Yanayi mai bushewa yau. Duba ruwan kasa.',
    'daily.message.heavyRain':      'Ana sa ran ruwan sama mai yawa yau. Tsara aiki.',
    'daily.message.lightRain':      'Ana sa ran ruwan sama kadan yau.',
    'daily.message.rainyWeek':      'Ana sa ran ruwan sama a wannan mako.',
    'daily.message.hotDay':         'Yini mai zafi. Shayar da wuri.',
    'daily.message.fallback':       'Duba gonarka yau.',

    'memory.yesterdayLine':         'Jiya kayi: {action}.',
    'memory.task.prepareRows':      'shirya layuka',
    'memory.task.weedRows':         'cire ciyawa',
    'memory.task.scoutPests':       'duba kwari',
    'memory.task.checkMoisture':    'duba ruwan kasa',
    'memory.task.waterCrops':       'shayar da amfanin gona',
    'memory.task.fertilize':        'sa taki',
    'memory.task.prepareHarvest':   'shirya don girbi',
    'memory.task.checkFarm':        'duba gonarka',
  },

  tw: {
    'daily.message.pestRisk':       'Mmoawa b\u025Bb\u025Bg yi. Hw\u025B w\u02BCafoa.',
    'daily.message.droughtRisk':    'Asaase awo nn\u025B. Hw\u025B fa\u02BD ho dɔm.',
    'daily.message.heavyRain':      'Nsuo b\u025Bt\u0254 pii nn\u025B. Yɛ nhyehy\u025Be\u025B.',
    'daily.message.lightRain':      'Nsuo kakra b\u025Bt\u0254 nn\u025B.',
    'daily.message.rainyWeek':      'Nsuo b\u025Bt\u0254 nnawɔtwe yi.',
    'daily.message.hotDay':         'Hyew y\u025Bd\u025B nn\u025B. Gugu nsuo ntɛm.',
    'daily.message.fallback':       'Hw\u025B w\u02BCafuo nn\u025B.',

    'memory.yesterdayLine':         'Nnora wo: {action}.',
    'memory.task.prepareRows':      'siesie nsensanee',
    'memory.task.weedRows':         'yi nwura',
    'memory.task.scoutPests':       'hw\u025Bhw\u025B mmoawa',
    'memory.task.checkMoisture':    'hw\u025B asaase fa\u02BD',
    'memory.task.waterCrops':       'gugu nsuo gu nnɔbae so',
    'memory.task.fertilize':        'fa nnuru gu nnɔbae so',
    'memory.task.prepareHarvest':   'si\u025Bs\u025B s\u025B w\u02BCetwa',
    'memory.task.checkFarm':        'hw\u025B w\u02BCafuo',
  },

  hi: {
    'daily.message.pestRisk':       '\u0906\u091C \u0915\u0940\u091F \u091C\u094B\u0916\u093F\u092E\u0964 \u092B\u0938\u0932 \u091C\u093E\u0901\u091A\u0947\u0902\u0964',
    'daily.message.droughtRisk':    '\u0906\u091C \u0938\u0942\u0916\u0940 \u0938\u094D\u0925\u093F\u0924\u093F\u0964 \u092E\u093F\u091F\u094D\u091F\u0940 \u0915\u0940 \u0928\u092E\u0940 \u091C\u093E\u0901\u091A\u0947\u0902\u0964',
    'daily.message.heavyRain':      '\u0906\u091C \u0924\u0947\u091C़ \u092C\u093E\u0930\u093F\u0936 \u0915\u0940 \u0938\u0902\u092D\u093E\u0935\u0928\u093E\u0964 \u092A\u0939\u0932\u0947 \u0938\u0947 \u092F\u094B\u091C\u0928\u093E \u092C\u0928\u093E\u090F\u0901\u0964',
    'daily.message.lightRain':      '\u0906\u091C \u0925\u094B\u095C\u0940 \u092C\u093E\u0930\u093F\u0936 \u0939\u094B \u0938\u0915\u0924\u0940 \u0939\u0948\u0964',
    'daily.message.rainyWeek':      '\u0907\u0938 \u0938\u092A\u094D\u0924\u093E\u0939 \u092C\u093E\u0930\u093F\u0936 \u0915\u0940 \u0938\u0902\u092D\u093E\u0935\u0928\u093E\u0964',
    'daily.message.hotDay':         '\u0917\u0930\u094D\u092E \u0926\u093F\u0928\u0964 \u091C\u0932\u094D\u0926\u0940 \u092A\u093E\u0928\u0940 \u0926\u0947\u0902\u0964',
    'daily.message.fallback':       '\u0906\u091C \u0905\u092A\u0928\u093E \u0916\u0947\u0924 \u0926\u0947\u0916\u0947\u0902\u0964',

    'memory.yesterdayLine':         '\u0915\u0932 \u0906\u092A\u0928\u0947 {action}\u0964',
    'memory.task.prepareRows':      '\u0915\u0924\u093E\u0930\u0947\u0902 \u0924\u0948\u092F\u093E\u0930 \u0915\u0940\u0902',
    'memory.task.weedRows':         '\u0916\u0930\u092A\u0924\u0935\u093E\u0930 \u0939\u091F\u093E\u090F',
    'memory.task.scoutPests':       '\u0915\u0940\u091F \u0926\u0947\u0916\u0947',
    'memory.task.checkMoisture':    '\u092E\u093F\u091F\u094D\u091F\u0940 \u0915\u0940 \u0928\u092E\u0940 \u091C\u093E\u0901\u091A\u0940',
    'memory.task.waterCrops':       '\u092B\u0938\u0932 \u0915\u094B \u092A\u093E\u0928\u0940 \u0926\u093F\u092F\u093E',
    'memory.task.fertilize':        '\u092B\u0938\u0932 \u092E\u0947\u0902 \u0916\u093E\u0926 \u0921\u093E\u0932\u0940',
    'memory.task.prepareHarvest':   '\u0915\u091F\u093E\u0908 \u0915\u0940 \u0924\u0948\u092F\u093E\u0930\u0940 \u0915\u0940',
    'memory.task.checkFarm':        '\u0905\u092A\u0928\u093E \u0916\u0947\u0924 \u0926\u0947\u0916\u093E',
  },
});

export default RETENTION_TRANSLATIONS;
