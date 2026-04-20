/**
 * newFarmTranslations.js — i18n overlay for the "Add New Farm"
 * flow (NewFarmScreen + MyFarm addNewFarm button). Ships
 * English + Hindi + French full coverage; sw/tw/ha carry core
 * subset and fall back to English.
 */

export const NEW_FARM_TRANSLATIONS = Object.freeze({
  en: {
    'myFarm.addNewFarm':              'Add New Farm',
    'farm.newFarm.title':             'Add New Farm',
    'farm.newFarm.helper':            'Create another farm without affecting your current one.',
    'farm.newFarm.farmNamePlaceholder':'Optional',
    'farm.newFarm.saveNewFarm':       'Save New Farm',
    'farm.newFarm.countryRequired':   'Country is required to create a farm.',
    'farm.newFarm.cropRequired':      'Pick a crop or choose "Other" and name one.',
    'farm.newFarm.sizeRequired':      'Farm size is required and must be greater than zero.',
    'farm.newFarm.cropSearchPlaceholder': 'Search common crops…',
    'farm.newFarm.cropOtherPlaceholder':  'Name the crop',
    'farm.newFarm.setActive':         'Set this as my active farm after saving',
    'farm.newFarm.successMessage':    'Saved. Your farm is ready to use.',
    'farm.newFarm.saveFailed':        'Could not create the new farm.',
    'farm.newFarm.successTitle':      'New farm created',
    'farm.newFarm.successHelper':     'Would you like to switch to this new farm now?',
    'farm.newFarm.switchToThis':      'Switch to this farm',
    'farm.newFarm.stayOnCurrent':     'Stay on current farm',
  },
  hi: {
    'myFarm.addNewFarm':              'नया खेत जोड़ें',
    'farm.newFarm.title':             'नया खेत जोड़ें',
    'farm.newFarm.helper':            'अपने मौजूदा खेत को प्रभावित किए बिना दूसरा खेत बनाएँ।',
    'farm.newFarm.farmNamePlaceholder':'वैकल्पिक',
    'farm.newFarm.saveNewFarm':       'नया खेत सहेजें',
    'farm.newFarm.countryRequired':   'खेत बनाने के लिए देश आवश्यक है।',
    'farm.newFarm.cropRequired':      'कोई फसल चुनें या "अन्य" चुनकर नाम लिखें।',
    'farm.newFarm.sizeRequired':      'खेत का आकार आवश्यक है और शून्य से अधिक होना चाहिए।',
    'farm.newFarm.cropSearchPlaceholder': 'सामान्य फसलें खोजें…',
    'farm.newFarm.cropOtherPlaceholder':  'फसल का नाम लिखें',
    'farm.newFarm.setActive':         'सहेजने के बाद इसे मेरा सक्रिय खेत बनाएँ',
    'farm.newFarm.successMessage':    'सहेजा गया। आपका खेत उपयोग के लिए तैयार है।',
    'farm.newFarm.saveFailed':        'नया खेत नहीं बनाया जा सका।',
    'farm.newFarm.successTitle':      'नया खेत बनाया गया',
    'farm.newFarm.successHelper':     'क्या आप अभी इस नए खेत पर स्विच करना चाहेंगे?',
    'farm.newFarm.switchToThis':      'इस खेत पर स्विच करें',
    'farm.newFarm.stayOnCurrent':     'मौजूदा खेत पर बने रहें',
  },
  fr: {
    'myFarm.addNewFarm':              'Ajouter une ferme',
    'farm.newFarm.title':             'Ajouter une ferme',
    'farm.newFarm.helper':            'Créez une autre ferme sans affecter celle en cours.',
    'farm.newFarm.farmNamePlaceholder':'Optionnel',
    'farm.newFarm.saveNewFarm':       'Enregistrer la nouvelle ferme',
    'farm.newFarm.countryRequired':   'Le pays est requis pour créer une ferme.',
    'farm.newFarm.cropRequired':      'Choisissez une culture ou sélectionnez « Autre » et saisissez-la.',
    'farm.newFarm.sizeRequired':      'La taille de la ferme est requise et doit être supérieure à zéro.',
    'farm.newFarm.cropSearchPlaceholder': 'Rechercher les cultures courantes…',
    'farm.newFarm.cropOtherPlaceholder':  'Nommez la culture',
    'farm.newFarm.setActive':         'Définir comme ma ferme active après enregistrement',
    'farm.newFarm.successMessage':    'Enregistré. Votre ferme est prête à être utilisée.',
    'farm.newFarm.saveFailed':        'Impossible de créer la nouvelle ferme.',
    'farm.newFarm.successTitle':      'Nouvelle ferme créée',
    'farm.newFarm.successHelper':     'Voulez-vous passer à cette nouvelle ferme maintenant ?',
    'farm.newFarm.switchToThis':      'Passer à cette ferme',
    'farm.newFarm.stayOnCurrent':     'Rester sur la ferme actuelle',
  },
  sw: {
    'myFarm.addNewFarm':              'Ongeza Shamba Jipya',
    'farm.newFarm.title':             'Ongeza Shamba Jipya',
    'farm.newFarm.saveNewFarm':       'Hifadhi Shamba Jipya',
    'farm.newFarm.switchToThis':      'Badilisha hadi shamba hili',
    'farm.newFarm.stayOnCurrent':     'Baki kwenye shamba la sasa',
  },
  tw: {
    'myFarm.addNewFarm':              'Ka Afuo Foforɔ Ho',
    'farm.newFarm.saveNewFarm':       'Kora Afuo Foforɔ',
  },
  ha: {
    'myFarm.addNewFarm':              'Ƙara Sabuwar Gona',
    'farm.newFarm.saveNewFarm':       'Ajiye Sabuwar Gona',
  },
});

export default NEW_FARM_TRANSLATIONS;
