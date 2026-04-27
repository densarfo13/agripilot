/**
 * labelTranslations.js — i18n overlay for the post-task
 * outcome-labeling prompt.
 *
 * Empty-slot fill via mergeManyOverlays - translator-authored
 * values still win.
 *
 * Keys:
 *   label.pest.question / pest.yes / pest.no / pest.unsure
 *   label.drought.question / drought.yes / drought.no
 *   label.skip
 */

export const LABEL_TRANSLATIONS = Object.freeze({
  en: {
    'label.pest.question':    'Did you see pests?',
    'label.pest.yes':         'Yes',
    'label.pest.no':          'No',
    'label.pest.unsure':      'Not sure',
    'label.drought.question': 'Are your crops drying?',
    'label.drought.yes':      'Yes',
    'label.drought.no':       'No',
    'label.skip':             'Skip',
  },

  fr: {
    'label.pest.question':    'Avez-vous vu des ravageurs\u00A0?',
    'label.pest.yes':         'Oui',
    'label.pest.no':          'Non',
    'label.pest.unsure':      'Pas s\u00FBr',
    'label.drought.question': 'Vos cultures s\u00E8chent-elles\u00A0?',
    'label.drought.yes':      'Oui',
    'label.drought.no':       'Non',
    'label.skip':             'Ignorer',
  },

  hi: {
    'label.pest.question':    'क्या आपने कीट देखे?',
    'label.pest.yes':         'हाँ',
    'label.pest.no':          'नहीं',
    'label.pest.unsure':      'पता नहीं',
    'label.drought.question': 'क्या आपकी फसल सूख रही है?',
    'label.drought.yes':      'हाँ',
    'label.drought.no':       'नहीं',
    'label.skip':             'छोड़ें',
  },

  sw: {
    'label.pest.question':    'Umeona wadudu?',
    'label.pest.yes':         'Ndiyo',
    'label.pest.no':          'Hapana',
    'label.pest.unsure':      'Sijui',
    'label.drought.question': 'Mazao yako yanakauka?',
    'label.drought.yes':      'Ndiyo',
    'label.drought.no':       'Hapana',
    'label.skip':             'Ruka',
  },

  ha: {
    'label.pest.question':    'Ka ga kwari?',
    'label.pest.yes':         'Ee',
    'label.pest.no':          'A\u02BCa',
    'label.pest.unsure':      'Ban tabbata ba',
    'label.drought.question': 'Shukokinka suna bushewa?',
    'label.drought.yes':      'Ee',
    'label.drought.no':       'A\u02BCa',
    'label.skip':             'Tsallake',
  },

  tw: {
    'label.pest.question':    'Wohuu mmoawa?',
    'label.pest.yes':         'Aane',
    'label.pest.no':          'Dabi',
    'label.pest.unsure':      'Mennim',
    'label.drought.question': 'W\u02BCaduane reduane?',
    'label.drought.yes':      'Aane',
    'label.drought.no':       'Dabi',
    'label.skip':             'F\u00CB ho',
  },
});

export default LABEL_TRANSLATIONS;
