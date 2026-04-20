/**
 * editFarmTranslations.js — i18n overlay for the Edit Farm
 * screen. Covers the three modes (edit, complete_profile,
 * complete_for_recommendation) plus save success / error
 * copy and the missing-farm empty state.
 *
 * Key families:
 *   farm.editFarm.title / helper        — default edit mode
 *   farm.editFarm.completeProfileTitle  — ?mode=complete_profile
 *   farm.editFarm.completeForRecTitle   — ?mode=complete_for_recommendation
 *   farm.editFarm.saveChanges           — primary CTA
 *   farm.editFarm.saveSuccess           — post-save flash
 *   farm.editFarm.noFarm                — empty state
 *   farm.editFarm.farmNameRequired      — validation
 *   farm.editFarm.sizeNegative          — validation
 *
 * English + Hindi ship; Swahili, French, Twi, Hausa carry a
 * core subset and fall back to English for the long tail via
 * the main resolver (same pattern as the other overlays).
 */

export const EDIT_FARM_TRANSLATIONS = Object.freeze({
  en: {
    'farm.editFarm.title':                    'Edit Farm',
    'farm.editFarm.helper':                   'Change your farm details. This does not start onboarding over.',
    'farm.editFarm.completeProfileTitle':     'Complete your farm profile',
    'farm.editFarm.completeProfileHelper':    'Fill in the missing details so your guidance gets sharper.',
    'farm.editFarm.completeForRecTitle':      'Add your farm details for better recommendations',
    'farm.editFarm.completeForRecHelper':     'Add your farm location to get the best crop recommendations.',
    'farm.editFarm.saveChanges':              'Save Changes',
    'farm.editFarm.saveSuccess':              'Farm updated — your guidance has been refreshed',
    'farm.editFarm.noFarm':                   'You don\u2019t have a farm yet.',
    'farm.editFarm.farmNameRequired':         'Farm name is required',
    'farm.editFarm.sizeNegative':             'Size must be positive',
    'farm.editFarm.cancel':                   'Cancel',
    'farm.editFailed':                        'Could not save your changes.',
  },

  hi: {
    'farm.editFarm.title':                    'खेत संपादित करें',
    'farm.editFarm.helper':                   'अपने खेत का विवरण बदलें। यह फिर से शुरुआत नहीं करेगा।',
    'farm.editFarm.completeProfileTitle':     'अपना खेत प्रोफ़ाइल पूरा करें',
    'farm.editFarm.completeProfileHelper':    'बेहतर मार्गदर्शन के लिए बाकी जानकारी भरें।',
    'farm.editFarm.completeForRecTitle':      'बेहतर सुझावों के लिए विवरण जोड़ें',
    'farm.editFarm.completeForRecHelper':     'सबसे अच्छे फसल सुझावों के लिए अपने खेत का स्थान जोड़ें।',
    'farm.editFarm.saveChanges':              'परिवर्तन सहेजें',
    'farm.editFarm.saveSuccess':              'खेत अपडेट हुआ — मार्गदर्शन ताज़ा किया गया',
    'farm.editFarm.noFarm':                   'आपके पास अभी कोई खेत नहीं है।',
    'farm.editFarm.farmNameRequired':         'खेत का नाम आवश्यक है',
    'farm.editFarm.sizeNegative':             'आकार सकारात्मक होना चाहिए',
    'farm.editFarm.cancel':                   'रद्द करें',
    'farm.editFailed':                        'परिवर्तन सहेज नहीं सके।',
  },

  fr: {
    'farm.editFarm.title':                    'Modifier la ferme',
    'farm.editFarm.helper':                   'Modifiez les détails de votre ferme. Cela ne recommence pas l\u2019intégration.',
    'farm.editFarm.completeProfileTitle':     'Complétez le profil de votre ferme',
    'farm.editFarm.completeProfileHelper':    'Remplissez les détails manquants pour des conseils plus précis.',
    'farm.editFarm.completeForRecTitle':      'Ajoutez des détails pour de meilleures recommandations',
    'farm.editFarm.completeForRecHelper':     'Ajoutez l\u2019emplacement de votre ferme pour obtenir les meilleures recommandations de cultures.',
    'farm.editFarm.saveChanges':              'Enregistrer',
    'farm.editFarm.saveSuccess':              'Ferme mise à jour — vos conseils ont été actualisés',
    'farm.editFarm.noFarm':                   'Vous n\u2019avez pas encore de ferme.',
    'farm.editFarm.farmNameRequired':         'Le nom de la ferme est requis',
    'farm.editFarm.sizeNegative':             'La taille doit être positive',
    'farm.editFarm.cancel':                   'Annuler',
    'farm.editFailed':                        'Impossible d\u2019enregistrer les modifications.',
  },

  sw: {
    'farm.editFarm.title':                    'Hariri Shamba',
    'farm.editFarm.helper':                   'Badilisha maelezo ya shamba. Haita anza upya.',
    'farm.editFarm.completeProfileTitle':     'Kamilisha wasifu wa shamba',
    'farm.editFarm.saveChanges':              'Hifadhi Mabadiliko',
    'farm.editFarm.cancel':                   'Ghairi',
  },

  tw: {
    'farm.editFarm.title':                    'Sesa Afuo',
    'farm.editFarm.saveChanges':              'Kora Nsesae',
    'farm.editFarm.cancel':                   'Gyae',
  },

  ha: {
    'farm.editFarm.title':                    'Gyara Gona',
    'farm.editFarm.saveChanges':              'Ajiye Canje',
    'farm.editFarm.cancel':                   'Soke',
  },
});

/**
 * mergeEditFarmOverlay — rotate {locale: {key: v}} into the main
 * {key: {locale: v}} shape and fill only empty slots. Existing
 * translator-authored values always win.
 */
export function mergeEditFarmOverlay(T) {
  if (!T || typeof T !== 'object') return T;
  for (const [locale, keys] of Object.entries(EDIT_FARM_TRANSLATIONS)) {
    for (const [key, text] of Object.entries(keys)) {
      if (!T[key]) T[key] = {};
      if (!T[key][locale]) T[key][locale] = text;
    }
  }
  return T;
}

export default EDIT_FARM_TRANSLATIONS;
