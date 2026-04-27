/**
 * sessionTranslations.js — i18n overlay for the Settings
 * page's account-actions section (Logout + Reset) and the
 * shared ConfirmModal copy.
 *
 * Empty-slot fill via mergeManyOverlays — translator-authored
 * values still win.
 *
 * Keys:
 *   settings.account              "Account"
 *   settings.logout               "Logout"
 *   settings.reset                "Reset App"
 *   settings.logout.confirmTitle  "Are you sure you want to logout?"
 *   settings.logout.confirmBody   "You can sign back in any time …"
 *   settings.reset.confirmTitle   "Reset Farroway on this device?"
 *   settings.reset.confirmBody    "This will remove all your data on this device. Continue?"
 *   common.cancel                 "Cancel"
 *
 * Strict-rule audit
 *   * No shaming or threatening copy: reset uses "remove all your
 *     data on this device", not "delete account" or "wipe"
 *   * Cancel is reassuring — every destructive action is reversible
 *     up to confirm
 *   * Six shipped languages covered so non-English locales never
 *     leak the dotted key
 */

export const SESSION_TRANSLATIONS = Object.freeze({
  en: {
    'settings.account':             'Account',
    'settings.logout':              'Logout',
    'settings.reset':               'Reset App',
    'settings.logout.confirmTitle': 'Are you sure you want to logout?',
    'settings.logout.confirmBody':
      'You can sign back in any time \u2014 your farm data stays on this device.',
    'settings.reset.confirmTitle':  'Reset Farroway on this device?',
    'settings.reset.confirmBody':
      'This will remove all your data on this device. Continue?',
    'common.cancel':                'Cancel',
  },

  fr: {
    'settings.account':             'Compte',
    'settings.logout':              'D\u00E9connexion',
    'settings.reset':               'R\u00E9initialiser l\u2019appli',
    'settings.logout.confirmTitle': '\u00CAtes-vous s\u00FBr de vouloir vous d\u00E9connecter\u00A0?',
    'settings.logout.confirmBody':
      'Vous pouvez vous reconnecter \u00E0 tout moment \u2014 les donn\u00E9es de votre ferme restent sur cet appareil.',
    'settings.reset.confirmTitle':  'R\u00E9initialiser Farroway sur cet appareil\u00A0?',
    'settings.reset.confirmBody':
      'Cela supprimera toutes vos donn\u00E9es sur cet appareil. Continuer\u00A0?',
    'common.cancel':                'Annuler',
  },

  hi: {
    'settings.account':             'खाता',
    'settings.logout':              'लॉगआउट',
    'settings.reset':               'ऐप रीसेट करें',
    'settings.logout.confirmTitle': 'क्या आप वाकई लॉगआउट करना चाहते हैं?',
    'settings.logout.confirmBody':
      'आप किसी भी समय वापस साइन इन कर सकते हैं — आपका खेत डेटा इस डिवाइस पर रहेगा।',
    'settings.reset.confirmTitle':  'क्या इस डिवाइस पर Farroway रीसेट करें?',
    'settings.reset.confirmBody':
      'इससे इस डिवाइस का आपका सारा डेटा हट जाएगा। जारी रखें?',
    'common.cancel':                'रद्द करें',
  },

  sw: {
    'settings.account':             'Akaunti',
    'settings.logout':              'Toka',
    'settings.reset':               'Anzisha Upya Programu',
    'settings.logout.confirmTitle': 'Una uhakika unataka kutoka?',
    'settings.logout.confirmBody':
      'Unaweza kuingia tena wakati wowote \u2014 data ya shamba lako inabaki kwenye kifaa hiki.',
    'settings.reset.confirmTitle':  'Anzisha Farroway upya kwenye kifaa hiki?',
    'settings.reset.confirmBody':
      'Hii itaondoa data yako yote kwenye kifaa hiki. Endelea?',
    'common.cancel':                'Ghairi',
  },

  ha: {
    'settings.account':             'Asusu',
    'settings.logout':              'Fita',
    'settings.reset':               'Sake Saita Aikace-aikacen',
    'settings.logout.confirmTitle': 'Ka tabbata kana son fita?',
    'settings.logout.confirmBody':
      'Kana iya sake shiga kowane lokaci \u2014 bayanan gonarka za su kasance a wannan na\u2019urar.',
    'settings.reset.confirmTitle':  'Sake saita Farroway a wannan na\u2019urar?',
    'settings.reset.confirmBody':
      'Wannan zai cire dukkan bayananka a wannan na\u2019urar. A ci gaba?',
    'common.cancel':                'Soke',
  },

  tw: {
    'settings.account':             'Akawunt',
    'settings.logout':              'Pue',
    'settings.reset':               'San Yɛ App No Foforɔ',
    'settings.logout.confirmTitle': 'Wo pɛ sɛ wopue ampa?',
    'settings.logout.confirmBody':
      'Wobetumi asan aba mu bere biara \u2014 w\u02BCafuo ho nsɛm bɛtena saa afidie yi so.',
    'settings.reset.confirmTitle':  'San yɛ Farroway foforɔ wɔ saa afidie yi so?',
    'settings.reset.confirmBody':
      'Yei beyi wo nsɛm nyinaa afi saa afidie yi so. Toa so?',
    'common.cancel':                'Gyae',
  },
});

export default SESSION_TRANSLATIONS;
