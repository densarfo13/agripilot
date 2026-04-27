/**
 * settingsPageTranslations.js — i18n overlay for the unified
 * Settings page (src/pages/Settings.jsx).
 *
 * The Settings page reads from src/store/settingsStore.js and
 * renders three sections: Notifications, Communication, Farmer ID.
 * Every visible label and helper line goes through `tSafe`, so we
 * fill the dictionary here once for every shipped language. Empty-
 * slot fill — translator-authored values in translations.js still
 * win.
 *
 * Keys (kept in step with src/pages/Settings.jsx):
 *   settings.notifications
 *   settings.communication
 *   settings.daily            settings.dailyHelper
 *   settings.weather          settings.weatherHelper
 *   settings.risk             settings.riskHelper
 *   settings.missed           settings.missedHelper
 *   settings.email            settings.emailHelper
 *   settings.sms              settings.smsHelper
 *   settings.reminderTime     settings.reminderTimeHelper
 *   settings.farmerId
 *   actions.copy   actions.copied
 *
 * (settings.title + common.copy + farmerId.copied already exist
 * in translations.js — kept untouched.)
 */

export const SETTINGS_PAGE_TRANSLATIONS = Object.freeze({
  en: {
    'settings.notifications':       'Notifications',
    'settings.communication':       'Communication',

    'settings.daily':               'Daily reminder',
    'settings.dailyHelper':         'A short summary of today\u2019s tasks each morning.',

    'settings.weather':             'Weather alerts',
    'settings.weatherHelper':       'Heads-up for rain, heat or wind that affects your crop.',

    'settings.risk':                'Risk alerts',
    'settings.riskHelper':          'Pest, disease and field warnings before they spread.',

    'settings.missed':              'Missed task reminders',
    'settings.missedHelper':        'A gentle nudge when an important task is overdue.',

    'settings.email':               'Email',
    'settings.emailHelper':         'Receive notifications by email.',

    'settings.sms':                 'SMS',
    'settings.smsHelper':           'Best when data is weak. Standard rates may apply.',

    'settings.reminderTime':        'Reminder time',
    'settings.reminderTimeHelper':  'When the daily reminder should arrive.',

    'settings.farmerId':            'Farmer ID',

    'actions.copy':                 'Copy',
    'actions.copied':               'Copied',
  },

  fr: {
    'settings.notifications':       'Notifications',
    'settings.communication':       'Communication',

    'settings.daily':               'Rappel quotidien',
    'settings.dailyHelper':         'Un bref r\u00E9sum\u00E9 des t\u00E2ches du jour, chaque matin.',

    'settings.weather':             'Alertes m\u00E9t\u00E9o',
    'settings.weatherHelper':       'Avertissements pour la pluie, la chaleur ou le vent qui touchent votre culture.',

    'settings.risk':                'Alertes de risque',
    'settings.riskHelper':          'Avertissements de ravageurs, maladies et conditions du champ avant qu\u2019ils ne se propagent.',

    'settings.missed':              'Rappels de t\u00E2ches manqu\u00E9es',
    'settings.missedHelper':        'Un rappel discret lorsqu\u2019une t\u00E2che importante est en retard.',

    'settings.email':               'E-mail',
    'settings.emailHelper':         'Recevoir les notifications par e-mail.',

    'settings.sms':                 'SMS',
    'settings.smsHelper':           'Pratique quand le r\u00E9seau est faible. Frais standards possibles.',

    'settings.reminderTime':        'Heure du rappel',
    'settings.reminderTimeHelper':  'Quand le rappel quotidien doit arriver.',

    'settings.farmerId':            'Identifiant du producteur',

    'actions.copy':                 'Copier',
    'actions.copied':               'Copi\u00E9',
  },

  hi: {
    'settings.notifications':       'सूचनाएँ',
    'settings.communication':       'संपर्क',

    'settings.daily':               'दैनिक अनुस्मारक',
    'settings.dailyHelper':         'हर सुबह आज के कामों का संक्षिप्त सारांश।',

    'settings.weather':             'मौसम चेतावनियाँ',
    'settings.weatherHelper':       'बारिश, गर्मी या हवा की चेतावनी जो आपकी फसल को प्रभावित कर सकती है।',

    'settings.risk':                'जोखिम चेतावनियाँ',
    'settings.riskHelper':          'कीट, रोग और खेत की चेतावनियाँ फैलने से पहले।',

    'settings.missed':              'छूटे काम के अनुस्मारक',
    'settings.missedHelper':        'जब कोई ज़रूरी काम छूट जाए तो हल्का अनुस्मारक।',

    'settings.email':               'ईमेल',
    'settings.emailHelper':         'ईमेल पर सूचनाएँ प्राप्त करें।',

    'settings.sms':                 'एसएमएस',
    'settings.smsHelper':           'कमज़ोर डेटा वाले क्षेत्रों के लिए बेहतर। मानक शुल्क लागू हो सकते हैं।',

    'settings.reminderTime':        'अनुस्मारक का समय',
    'settings.reminderTimeHelper':  'दैनिक अनुस्मारक कब आना चाहिए।',

    'settings.farmerId':            'किसान आईडी',

    'actions.copy':                 'कॉपी करें',
    'actions.copied':               'कॉपी किया गया',
  },

  sw: {
    'settings.notifications':       'Arifa',
    'settings.communication':       'Mawasiliano',

    'settings.daily':               'Kumbusho la kila siku',
    'settings.dailyHelper':         'Muhtasari mfupi wa kazi za leo kila asubuhi.',

    'settings.weather':             'Tahadhari za hali ya hewa',
    'settings.weatherHelper':       'Onyo kuhusu mvua, joto au upepo unaoathiri zao lako.',

    'settings.risk':                'Tahadhari za hatari',
    'settings.riskHelper':          'Maonyo ya wadudu, magonjwa na hali ya shamba kabla hayajaenea.',

    'settings.missed':              'Kumbusho la kazi zilizosahaulika',
    'settings.missedHelper':        'Kumbusho la upole wakati kazi muhimu imechelewa.',

    'settings.email':               'Barua pepe',
    'settings.emailHelper':         'Pokea arifa kupitia barua pepe.',

    'settings.sms':                 'SMS',
    'settings.smsHelper':           'Bora kwa maeneo yenye data dhaifu. Gharama za kawaida zinaweza kutozwa.',

    'settings.reminderTime':        'Saa ya kumbusho',
    'settings.reminderTimeHelper':  'Wakati kumbusho la kila siku linapaswa kufika.',

    'settings.farmerId':            'Kitambulisho cha Mkulima',

    'actions.copy':                 'Nakili',
    'actions.copied':               'Imenakiliwa',
  },

  ha: {
    'settings.notifications':       'Sanarwa',
    'settings.communication':       'Sadarwa',

    'settings.daily':               'Tunatarwar yau da kullum',
    'settings.dailyHelper':         'Taƙaitaccen ayyukan yau a kowace safiya.',

    'settings.weather':             'Faɗakarwar yanayi',
    'settings.weatherHelper':       'Gargaɗi kan ruwa, zafi ko iska da ke shafar shukarka.',

    'settings.risk':                'Faɗakarwar haɗari',
    'settings.riskHelper':          'Gargaɗin kwari, cututtuka da yanayin gona kafin su yaɗu.',

    'settings.missed':              'Tunatarwar ayyukan da aka rasa',
    'settings.missedHelper':        'Tunatarwa mai laushi lokacin da muhimmin aiki ya wuce lokaci.',

    'settings.email':               'Imel',
    'settings.emailHelper':         'Karɓi sanarwa ta imel.',

    'settings.sms':                 'SMS',
    'settings.smsHelper':           'Mafi dacewa lokacin da bayanan ke da rauni. Kuɗaɗen yau da kullum na iya aiki.',

    'settings.reminderTime':        'Lokacin tunatarwa',
    'settings.reminderTimeHelper':  'Lokacin da ya kamata tunatarwar yau da kullum ta zo.',

    'settings.farmerId':            'Lambar Manomi',

    'actions.copy':                 'Kwafa',
    'actions.copied':               'An kwafa',
  },

  tw: {
    'settings.notifications':       'Amanneɛbɔ',
    'settings.communication':       'Nkitahodi',

    'settings.daily':               'Daa nkae',
    'settings.dailyHelper':         'Anɔpa biara, ɛnnɛ nnwuma no tiawa.',

    'settings.weather':             'Ewiem nsakraeɛ ho kɔkɔbɔ',
    'settings.weatherHelper':       'Kɔkɔbɔ a ɛfa nsuo, ɛhyeɛ anaa mframa a ɛka w\u2019aduane ho.',

    'settings.risk':                'Asiane ho kɔkɔbɔ',
    'settings.riskHelper':          'Mmoawa, nyarewa ne afuom tebea ho kɔkɔbɔ ansa na atrɛw.',

    'settings.missed':              'Adwuma a wopaa ho nkae',
    'settings.missedHelper':        'Nkae brɛoo ɛberɛ a adwuma a ɛho hia atwa wo.',

    'settings.email':               'Email',
    'settings.emailHelper':         'Nya amanneɛbɔ wɔ email so.',

    'settings.sms':                 'SMS',
    'settings.smsHelper':           'Ɛyɛ ma mmeae a data sua. Wɔbɛtumi agye sika sɛdeɛ ɛteɛ.',

    'settings.reminderTime':        'Nkae berɛ',
    'settings.reminderTimeHelper':  'Berɛ a daa nkae no bɛba.',

    'settings.farmerId':            'Okuafoɔ ID',

    'actions.copy':                 'Kopi',
    'actions.copied':               'Yɛakɔpi',
  },
});

export default SETTINGS_PAGE_TRANSLATIONS;
