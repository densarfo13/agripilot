/**
 * notificationPrefsTranslations.js — i18n overlay for the
 * NotificationPreferencesCard ("Notifications" settings menu).
 *
 * Without this overlay the card was rendering humanized fallbacks
 * ("Title", "Subtitle", "Daily", "Daily helper", …) because the
 * `notif.prefs.*` keys had no values in translations.js.
 *
 * Ships full English + French + Hindi coverage; sw/tw/ha carry the
 * core (label + helper) for every row so the card is meaningful in
 * every shipped language. Anything still missing falls back via
 * the standard tSafe/strict-leak path.
 */

export const NOTIFICATION_PREFS_TRANSLATIONS = Object.freeze({
  en: {
    'notif.prefs.title':              'Notifications',
    'notif.prefs.subtitle':           'Choose what we send you and when. Changes save automatically.',

    'notif.prefs.daily':              'Daily reminder',
    'notif.prefs.dailyHelper':        'A short summary of today\u2019s tasks and what needs attention.',

    'notif.prefs.weather':            'Weather alerts',
    'notif.prefs.weatherHelper':      'Heads-up for rain, heat or wind that affects your crop.',

    'notif.prefs.risk':               'Risk alerts',
    'notif.prefs.riskHelper':         'Pest, disease and field-condition warnings before they spread.',

    'notif.prefs.missed':             'Missed task reminders',
    'notif.prefs.missedHelper':       'A gentle nudge when an important task is overdue.',

    'notif.prefs.email':              'Email',
    'notif.prefs.sms':                'SMS',
    'notif.prefs.smsHelper':          'Best for areas with weak data. Standard rates may apply.',

    'notif.prefs.reminderTime':       'Reminder time',
    'notif.prefs.reminderTimeHelper': 'When the daily reminder should arrive.',
  },

  fr: {
    'notif.prefs.title':              'Notifications',
    'notif.prefs.subtitle':           'Choisissez ce que nous vous envoyons et quand. Les modifications sont enregistr\u00E9es automatiquement.',
    'notif.prefs.daily':              'Rappel quotidien',
    'notif.prefs.dailyHelper':        'Un bref r\u00E9sum\u00E9 des t\u00E2ches du jour et de ce qui demande de l\u2019attention.',
    'notif.prefs.weather':            'Alertes m\u00E9t\u00E9o',
    'notif.prefs.weatherHelper':      'Avertissements pour la pluie, la chaleur ou le vent qui touchent votre culture.',
    'notif.prefs.risk':               'Alertes de risque',
    'notif.prefs.riskHelper':         'Avertissements de ravageurs, maladies et conditions du champ avant qu\u2019ils ne se propagent.',
    'notif.prefs.missed':             'Rappels de t\u00E2ches manqu\u00E9es',
    'notif.prefs.missedHelper':       'Un rappel discret lorsqu\u2019une t\u00E2che importante est en retard.',
    'notif.prefs.email':              'E-mail',
    'notif.prefs.sms':                'SMS',
    'notif.prefs.smsHelper':          'Pratique dans les zones \u00E0 faible couverture. Frais standards possibles.',
    'notif.prefs.reminderTime':       'Heure du rappel',
    'notif.prefs.reminderTimeHelper': 'Quand le rappel quotidien doit arriver.',
  },

  hi: {
    'notif.prefs.title':              'सूचनाएँ',
    'notif.prefs.subtitle':           'चुनें कि हम आपको क्या और कब भेजें। बदलाव अपने आप सहेजे जाते हैं।',
    'notif.prefs.daily':              'दैनिक अनुस्मारक',
    'notif.prefs.dailyHelper':        'आज के कामों और ध्यान देने योग्य बातों का संक्षिप्त सारांश।',
    'notif.prefs.weather':            'मौसम चेतावनियाँ',
    'notif.prefs.weatherHelper':      'बारिश, गर्मी या हवा की चेतावनी जो आपकी फसल को प्रभावित कर सकती है।',
    'notif.prefs.risk':               'जोखिम चेतावनियाँ',
    'notif.prefs.riskHelper':         'कीट, रोग और खेत की स्थिति की चेतावनियाँ फैलने से पहले।',
    'notif.prefs.missed':             'छूटे काम के अनुस्मारक',
    'notif.prefs.missedHelper':       'जब कोई ज़रूरी काम छूट जाए तो हल्का अनुस्मारक।',
    'notif.prefs.email':              'ईमेल',
    'notif.prefs.sms':                'एसएमएस',
    'notif.prefs.smsHelper':          'कमज़ोर डेटा वाले क्षेत्रों के लिए सबसे अच्छा। मानक शुल्क लागू हो सकते हैं।',
    'notif.prefs.reminderTime':       'अनुस्मारक का समय',
    'notif.prefs.reminderTimeHelper': 'दैनिक अनुस्मारक कब आना चाहिए।',
  },

  sw: {
    'notif.prefs.title':              'Arifa',
    'notif.prefs.subtitle':           'Chagua tunachokutumia na lini. Mabadiliko huhifadhiwa otomatiki.',
    'notif.prefs.daily':              'Kumbusho la kila siku',
    'notif.prefs.dailyHelper':        'Muhtasari mfupi wa kazi za leo na kinachohitaji uangalifu.',
    'notif.prefs.weather':            'Tahadhari za hali ya hewa',
    'notif.prefs.weatherHelper':      'Onyo kuhusu mvua, joto au upepo unaoathiri zao lako.',
    'notif.prefs.risk':               'Tahadhari za hatari',
    'notif.prefs.riskHelper':         'Maonyo ya wadudu, magonjwa na hali ya shamba kabla hayajaenea.',
    'notif.prefs.missed':             'Kumbusho la kazi zilizosahaulika',
    'notif.prefs.missedHelper':       'Kumbusho la upole wakati kazi muhimu imechelewa.',
    'notif.prefs.email':              'Barua pepe',
    'notif.prefs.sms':                'SMS',
    'notif.prefs.smsHelper':          'Bora kwa maeneo yenye data dhaifu. Gharama za kawaida zinaweza kutozwa.',
    'notif.prefs.reminderTime':       'Saa ya kumbusho',
    'notif.prefs.reminderTimeHelper': 'Wakati kumbusho la kila siku linapaswa kufika.',
  },

  ha: {
    'notif.prefs.title':              'Sanarwa',
    'notif.prefs.subtitle':           'Zaɓi abin da muke aikawa da kuma yaushe. Canje-canje suna ajiyewa kai tsaye.',
    'notif.prefs.daily':              'Tunatarwar yau da kullum',
    'notif.prefs.dailyHelper':        'Taƙaitaccen taƙaitaccen ayyukan yau da abin da ke buƙatar kulawa.',
    'notif.prefs.weather':            'Faɗakarwar yanayi',
    'notif.prefs.weatherHelper':      'Gargaɗi kan ruwa, zafi ko iska da ke shafar shukarka.',
    'notif.prefs.risk':               'Faɗakarwar haɗari',
    'notif.prefs.riskHelper':         'Gargaɗin kwari, cututtuka da yanayin gona kafin su yaɗu.',
    'notif.prefs.missed':             'Tunatarwar ayyukan da aka rasa',
    'notif.prefs.missedHelper':       'Tunatarwa mai laushi lokacin da muhimmin aiki ya wuce lokaci.',
    'notif.prefs.email':              'Imel',
    'notif.prefs.sms':                'SMS',
    'notif.prefs.smsHelper':          'Mafi dacewa ga wuraren da ba su da bayanan ƙarfi. Kuɗaɗen yau da kullum na iya aiki.',
    'notif.prefs.reminderTime':       'Lokacin tunatarwa',
    'notif.prefs.reminderTimeHelper': 'Lokacin da ya kamata tunatarwar yau da kullum ta zo.',
  },

  tw: {
    'notif.prefs.title':              'Amanneɛbɔ',
    'notif.prefs.subtitle':           'Paw deɛ yɛde bɛkɔ ma wo ne ɛberɛ. Nsesa no kora ho ankasa.',
    'notif.prefs.daily':              'Daa nkae',
    'notif.prefs.dailyHelper':        'Ɛnnɛ nnwuma ne nsɛm a ɛhia hwɛ no tiawa.',
    'notif.prefs.weather':            'Ewiem nsakraeɛ ho kɔkɔbɔ',
    'notif.prefs.weatherHelper':      'Kɔkɔbɔ a ɛfa nsuo, ɛhyeɛ anaa mframa a ɛka w\u2019aduane ho.',
    'notif.prefs.risk':               'Asiane ho kɔkɔbɔ',
    'notif.prefs.riskHelper':         'Mmoawa, nyarewa ne afuom tebea ho kɔkɔbɔ ansa na atrɛw.',
    'notif.prefs.missed':             'Adwuma a wopaa ho nkae',
    'notif.prefs.missedHelper':       'Nkae brɛoo ɛberɛ a adwuma a ɛho hia atwa wo.',
    'notif.prefs.email':              'Email',
    'notif.prefs.sms':                'SMS',
    'notif.prefs.smsHelper':          'Ɛyɛ ma mmeae a data sua. Wɔbɛtumi agye sika sɛdeɛ ɛteɛ.',
    'notif.prefs.reminderTime':       'Nkae berɛ',
    'notif.prefs.reminderTimeHelper': 'Berɛ a daa nkae no bɛba.',
  },
});

export default NOTIFICATION_PREFS_TRANSLATIONS;
