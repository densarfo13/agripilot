/**
 * useCropTranslations.js — i18n overlay for the §3 "Use this
 * crop" decision flow on the recommendations page. Full
 * English + Hindi + French; sw/tw/ha carry a core subset.
 */

export const USE_CROP_TRANSLATIONS = Object.freeze({
  en: {
    'cropFit.results.useThisCrop':    'Use this crop',
    'cropFit.results.farmUpdated':    'Farm updated successfully',
    'cropFit.results.useCropFailed':  'Could not update your farm. Please try again.',
  },
  hi: {
    'cropFit.results.useThisCrop':    'यह फसल चुनें',
    'cropFit.results.farmUpdated':    'खेत सफलतापूर्वक अपडेट हुआ',
    'cropFit.results.useCropFailed':  'खेत अपडेट नहीं हो सका। कृपया पुनः प्रयास करें।',
  },
  fr: {
    'cropFit.results.useThisCrop':    'Choisir cette culture',
    'cropFit.results.farmUpdated':    'Ferme mise à jour avec succès',
    'cropFit.results.useCropFailed':  'Impossible de mettre à jour votre ferme. Réessayez.',
  },
  sw: {
    'cropFit.results.useThisCrop':    'Tumia zao hili',
    'cropFit.results.farmUpdated':    'Shamba limesasishwa',
  },
  tw: {
    'cropFit.results.useThisCrop':    'Fa saa aduan yi',
  },
  ha: {
    'cropFit.results.useThisCrop':    'Yi amfani da wannan amfani',
  },
});

export default USE_CROP_TRANSLATIONS;
