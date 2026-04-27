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

    // v1.5 single-question LabelPrompt
    'labelPrompt.question':   'Did you see any problem?',
    'labelPrompt.pest':       'Pests',
    'labelPrompt.drought':    'Dry crops',
    'labelPrompt.none':       'No problem',
    'labelPrompt.unknown':    'Not sure',
    'labelPrompt.addPhoto':   'Add photo (optional)',
    'labelPrompt.photoAdded': 'Photo added',
    'labelPrompt.skip':       'Skip',
    'labelPrompt.thanks':     'Thank you. This helps improve your farm advice.',
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

    'labelPrompt.question':   'Avez-vous vu un probl\u00E8me\u00A0?',
    'labelPrompt.pest':       'Ravageurs',
    'labelPrompt.drought':    'Cultures s\u00E8ches',
    'labelPrompt.none':       'Aucun probl\u00E8me',
    'labelPrompt.unknown':    'Pas s\u00FBr',
    'labelPrompt.addPhoto':   'Ajouter une photo (facultatif)',
    'labelPrompt.photoAdded': 'Photo ajout\u00E9e',
    'labelPrompt.skip':       'Ignorer',
    'labelPrompt.thanks':     'Merci. Cela am\u00E9liore les conseils pour votre ferme.',
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

    'labelPrompt.question':   'क्या आपको कोई समस्या दिखी?',
    'labelPrompt.pest':       'कीट',
    'labelPrompt.drought':    'सूखी फसल',
    'labelPrompt.none':       'कोई समस्या नहीं',
    'labelPrompt.unknown':    'पता नहीं',
    'labelPrompt.addPhoto':   'फ़ोटो जोड़ें (वैकल्पिक)',
    'labelPrompt.photoAdded': 'फ़ोटो जोड़ी गई',
    'labelPrompt.skip':       'छोड़ें',
    'labelPrompt.thanks':     'धन्यवाद। यह आपकी खेती की सलाह बेहतर बनाने में मदद करता है।',
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

    'labelPrompt.question':   'Umeona tatizo lolote?',
    'labelPrompt.pest':       'Wadudu',
    'labelPrompt.drought':    'Mazao kavu',
    'labelPrompt.none':       'Hakuna tatizo',
    'labelPrompt.unknown':    'Sijui',
    'labelPrompt.addPhoto':   'Ongeza picha (hiari)',
    'labelPrompt.photoAdded': 'Picha imeongezwa',
    'labelPrompt.skip':       'Ruka',
    'labelPrompt.thanks':     'Asante. Hii inasaidia kuboresha ushauri wa shamba lako.',
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

    'labelPrompt.question':   'Ka ga wata matsala?',
    'labelPrompt.pest':       'Kwari',
    'labelPrompt.drought':    'Bushewar shuka',
    'labelPrompt.none':       'Babu matsala',
    'labelPrompt.unknown':    'Ban tabbata ba',
    'labelPrompt.addPhoto':   '\u01B6ara hoto (na zabi)',
    'labelPrompt.photoAdded': 'An \u0257ora hoto',
    'labelPrompt.skip':       'Tsallake',
    'labelPrompt.thanks':     'Na gode. Wannan zai inganta shawarwarin gonarka.',
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

    'labelPrompt.question':   'Wohuu \u0254haw biara?',
    'labelPrompt.pest':       'Mmoawa',
    'labelPrompt.drought':    'Aduane a aw\u014D',
    'labelPrompt.none':       '\u0186haw biara nni h\u0254',
    'labelPrompt.unknown':    'Mennim',
    'labelPrompt.addPhoto':   'Fa mfonini ka ho (\u025Awo p\u025B a)',
    'labelPrompt.photoAdded': 'Wode mfonini akɛka ho',
    'labelPrompt.skip':       'F\u00CB ho',
    'labelPrompt.thanks':     'Meda wo ase. Eyi b\u025Bma w\u2019afuo ho afotue ay\u025B yie.',
  },
});

export default LABEL_TRANSLATIONS;
