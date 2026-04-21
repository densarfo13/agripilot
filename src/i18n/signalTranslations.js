/**
 * signalTranslations.js — i18n overlay for the farmerSignalEngine.
 *
 * All keys used by the engine (`signal.category.*`, `signal.next.*`)
 * plus the banner wording the ReportIssuePage and the admin farm
 * issues list render. English is complete; French carries full
 * coverage; sw / ha / tw ship the farmer-visible subset and fall
 * back to English via the language resolver.
 *
 * Keep every string safe-hedged ("possible", "likely"). Never
 * echo a specific pest or disease name.
 */

export const SIGNAL_TRANSLATIONS = Object.freeze({
  en: {
    // ── Category labels (safe wording) ──────────────────────────
    'signal.category.pest':                'Likely pest issue',
    'signal.category.disease':             'Possible disease risk',
    'signal.category.nutrient_deficiency': 'Possible nutrient deficiency',
    'signal.category.water_stress':        'Possible water stress',
    'signal.category.physical_damage':     'Physical damage noted',
    'signal.category.unknown':             'Needs review',

    // ── Risk banding labels ─────────────────────────────────────
    'signal.risk.low':    'Low risk',
    'signal.risk.medium': 'Needs attention',
    'signal.risk.high':   'Needs review soon',

    // ── Banner / card wording (report-issue success screen) ─────
    'signal.banner.detected':     'We noticed a possible risk',
    'signal.banner.explainer':    'Based on what you reported, the app flagged this for a closer look.',
    'signal.banner.reviewLine':   'A field officer has been notified to review your report.',
    'signal.banner.noReviewLine': 'Keep watching your plants over the next few days.',

    // ── Confidence pills ────────────────────────────────────────
    'signal.confidence.low':    'Low confidence',
    'signal.confidence.medium': 'Medium confidence',
    'signal.confidence.high':   'High confidence',

    // ── Backyard-specific next steps ────────────────────────────
    'signal.next.backyard.water_stress':
      'Check the soil and water gently in the morning.',
    'signal.next.backyard.pest':
      'Look at nearby plants and remove any damaged leaves you see.',
    'signal.next.backyard.disease':
      'Keep affected plants separate and watch them for a few days.',
    'signal.next.backyard.review':
      'Share what you see with someone who can help review it.',

    // ── Commercial-specific next steps ──────────────────────────
    'signal.next.commercial.review':
      'Schedule a field inspection and log findings in today\u2019s report.',
    'signal.next.commercial.disease':
      'Isolate affected sections and check neighbouring blocks before operations resume.',
    'signal.next.commercial.water_stress':
      'Verify irrigation schedule and soil moisture across sections.',

    // ── Admin / officer column labels ───────────────────────────
    'signal.admin.colHeader':        'Signal',
    'signal.admin.scoreLabel':       'Score',
    'signal.admin.categoryLabel':    'Likely',
    'signal.admin.needsReview':      'Needs review',
    'signal.admin.photoAttached':    'Photo attached',
    'signal.admin.missedTasks':      'Missed tasks',
    'signal.admin.repeatIssues':     'Repeated issues',
    'signal.admin.emptySignals':     '—',
  },

  fr: {
    'signal.category.pest':                'Probl\u00E8me de ravageur probable',
    'signal.category.disease':             'Risque de maladie possible',
    'signal.category.nutrient_deficiency': 'Carence nutritionnelle possible',
    'signal.category.water_stress':        'Stress hydrique possible',
    'signal.category.physical_damage':     'D\u00E9g\u00E2ts physiques signal\u00E9s',
    'signal.category.unknown':             'Revue n\u00E9cessaire',
    'signal.risk.low':    'Risque faible',
    'signal.risk.medium': '\u00C0 surveiller',
    'signal.risk.high':   '\u00C0 revoir rapidement',
    'signal.banner.detected':     'Nous avons rep\u00E9r\u00E9 un risque possible',
    'signal.banner.explainer':    'D\u2019apr\u00E8s votre signalement, l\u2019app recommande un examen plus attentif.',
    'signal.banner.reviewLine':   'Un agent de terrain a \u00E9t\u00E9 inform\u00E9 pour examiner votre rapport.',
    'signal.banner.noReviewLine': 'Continuez \u00E0 surveiller vos plantes dans les prochains jours.',
    'signal.confidence.low':    'Confiance faible',
    'signal.confidence.medium': 'Confiance moyenne',
    'signal.confidence.high':   'Confiance \u00E9lev\u00E9e',
    'signal.next.backyard.water_stress':
      'V\u00E9rifiez la terre et arrosez doucement le matin.',
    'signal.next.backyard.pest':
      'Regardez les plantes voisines et retirez les feuilles ab\u00EEm\u00E9es.',
    'signal.next.backyard.disease':
      'Gardez les plantes touch\u00E9es s\u00E9par\u00E9es et surveillez-les quelques jours.',
    'signal.next.backyard.review':
      'Partagez ce que vous voyez avec quelqu\u2019un qui peut vous aider.',
    'signal.next.commercial.review':
      'Planifiez une inspection et consignez les observations du jour.',
    'signal.next.commercial.disease':
      'Isolez les sections touch\u00E9es et v\u00E9rifiez les blocs voisins avant de reprendre.',
    'signal.next.commercial.water_stress':
      'V\u00E9rifiez le calendrier d\u2019irrigation et l\u2019humidit\u00E9 par section.',
    'signal.admin.colHeader':        'Signal',
    'signal.admin.scoreLabel':       'Score',
    'signal.admin.categoryLabel':    'Probable',
    'signal.admin.needsReview':      '\u00C0 revoir',
    'signal.admin.photoAttached':    'Photo jointe',
    'signal.admin.missedTasks':      'T\u00E2ches manqu\u00E9es',
    'signal.admin.repeatIssues':     'Probl\u00E8mes r\u00E9p\u00E9t\u00E9s',
    'signal.admin.emptySignals':     '\u2014',
  },

  sw: {
    'signal.category.pest':                'Tatizo la wadudu linawezekana',
    'signal.category.disease':             'Hatari ya ugonjwa inawezekana',
    'signal.category.nutrient_deficiency': 'Upungufu wa virutubisho huenda',
    'signal.category.water_stress':        'Msongo wa maji huenda',
    'signal.category.physical_damage':     'Uharibifu wa kimwili',
    'signal.category.unknown':             'Inahitaji ukaguzi',
    'signal.risk.low':    'Hatari ndogo',
    'signal.risk.medium': 'Angalia',
    'signal.risk.high':   'Ukaguzi wa haraka',
    'signal.banner.detected':     'Tumeona hatari inayowezekana',
    'signal.banner.reviewLine':   'Afisa wa shamba amefahamishwa.',
    'signal.banner.noReviewLine': 'Endelea kuangalia mimea yako siku chache zijazo.',
  },

  ha: {
    'signal.category.pest':                'Kamar matsalar kwari',
    'signal.category.disease':             'Haɗarin cuta mai yiwuwa',
    'signal.category.nutrient_deficiency': 'Rashin sinadarai mai yiwuwa',
    'signal.category.water_stress':        'Rashin ruwa mai yiwuwa',
    'signal.category.physical_damage':     'Lalacewa ta jiki',
    'signal.category.unknown':             'Yana bukatar dubawa',
    'signal.risk.low':    'Haɗari kaɗan',
    'signal.risk.medium': 'Sa ido',
    'signal.risk.high':   'Bukatar dubawa da sauri',
    'signal.banner.detected':     'Mun lura da haɗari mai yiwuwa',
    'signal.banner.reviewLine':   'An sanar da jami\u2019in gona don dubawa.',
    'signal.banner.noReviewLine': 'Kula da tsire-tsirenka a cikin kwanaki masu zuwa.',
  },

  tw: {
    'signal.category.pest':                'Ebia mmoawa bi wɔ so',
    'signal.category.disease':             'Ebia yadeɛ bi reba',
    'signal.category.nutrient_deficiency': 'Ebia aduan mu adeɛ asa',
    'signal.category.water_stress':        'Ebia nsuo ho haw',
    'signal.category.physical_damage':     'Ɔsɛe bi wɔ so',
    'signal.category.unknown':             'Ɛhia nhwɛsoɔ',
    'signal.risk.low':    'Asiane ketewa',
    'signal.risk.medium': 'Hwɛ no yie',
    'signal.risk.high':   'Hia nhwɛsoɔ ntɛm',
    'signal.banner.detected':     'Yɛahunu asiane bi a ebia wɔ so',
    'signal.banner.reviewLine':   'Yɛabɔ afuo hwɛfoɔ no amanneɛ.',
    'signal.banner.noReviewLine': 'Kɔ so hwɛ wo nnua no nna kakra a ɛreba yi.',
  },
});

export default SIGNAL_TRANSLATIONS;
