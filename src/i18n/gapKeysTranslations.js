/**
 * gapKeysTranslations.js — i18n overlay covering keys that are
 * referenced by `t('...')` (bare, no inline fallback) but never
 * defined anywhere else. Every entry here was identified via
 * `npm run check:i18n` against the bare-t/tShort/tPlural call
 * graph; tSafe call sites already supply their own fallback so
 * they're not in scope.
 *
 * Coverage targets (per launch-language policy):
 *   en (source), fr, sw, ha = full strings
 *   tw           = covered when farmer-facing
 *   hi           = starter-language; English fallback acceptable
 *                  (resolver routes through `en` when slot empty)
 *
 * Domains covered
 *   harvest.*       — HarvestCard (post-cycle capture form)
 *   onboarding.*    — OnboardingSteps (legacy ProfileSetup flow)
 *   pest.whatToDo   — intelligence/AlertCard
 *   setup.acres     — FarmEditModal size unit chip
 *   setup.sizeUnit  — FarmEditModal size unit label
 *   timeline.confidence.low — CropTimelineCard "low confidence"
 *                             chip; HarvestCard chains through
 *                             farm.estimated when this is missing,
 *                             but covering it directly is cleaner
 *
 * Strict-rule audit
 *   * No new features — every key already has a render site
 *   * No UI redesign — strings are the visible labels the call
 *     sites already render via inline fallback or a humanised key
 *   * Empty-slot fill via mergeManyOverlays — translator-authored
 *     values in translations.js win
 */

export const GAP_KEYS_TRANSLATIONS = Object.freeze({
  en: {
    // ── Misc one-offs ──────────────────────────────────────────
    'settings.language':           'Language',
    'myFarm.setupFarm':            'Set up farm',

    // ── HarvestCard ────────────────────────────────────────────
    'harvest.badge.completed':     'Cycle complete',
    'harvest.badge.ready':         'Harvest-ready',
    'harvest.summary.approx':      '(estimated value)',
    'harvest.ready.title':         'Time to harvest',
    'harvest.ready.headline':      'Your crop is ready for harvest.',
    'harvest.ready.headlineLate':  'Your crop is past its expected harvest date.',
    'harvest.ready.why':
      'Recording the amount completes this crop cycle and unlocks your next planting plan.',
    'harvest.form.amount':         'Amount',
    'harvest.form.notes':          'Notes (optional)',
    'harvest.form.save':           'Record harvest',
    'harvest.form.saving':         'Saving\u2026',
    'harvest.err.amount':          'Enter how much you harvested.',
    'harvest.err.save':            'Could not save the record. Please try again.',

    // ── OnboardingSteps (legacy ProfileSetup flow) ────────────
    'onboarding.next':             'Next',
    'onboarding.back':             'Back',
    'onboarding.cancel':           'Cancel',
    'onboarding.gpsFailed':
      'We couldn\u2019t get your location automatically. Please type it instead.',
    'onboarding.locationPlaceholder': 'Village, town or area',
    'onboarding.typeCrop':         'Type your crop',

    // ── intelligence/AlertCard ────────────────────────────────
    'pest.whatToDo':               'What to do',

    // ── FarmEditModal size unit chip ──────────────────────────
    'setup.sizeUnit':              'Unit',
    'setup.acres':                 'Acres',

    // ── CropTimelineCard low-confidence chip ──────────────────
    'timeline.confidence.low':     'Estimated',
  },

  fr: {
    'settings.language':           'Langue',
    'myFarm.setupFarm':            'Configurer la ferme',

    'harvest.badge.completed':     'Cycle termin\u00E9',
    'harvest.badge.ready':         'Pr\u00EAt \u00E0 r\u00E9colter',
    'harvest.summary.approx':      '(valeur estim\u00E9e)',
    'harvest.ready.title':         'Heure de r\u00E9colte',
    'harvest.ready.headline':      'Votre culture est pr\u00EAte \u00E0 \u00EAtre r\u00E9colt\u00E9e.',
    'harvest.ready.headlineLate':  'Votre culture a d\u00E9pass\u00E9 sa date de r\u00E9colte pr\u00E9vue.',
    'harvest.ready.why':
      'Enregistrer la quantit\u00E9 termine ce cycle et d\u00E9bloque votre prochain plan de plantation.',
    'harvest.form.amount':         'Quantit\u00E9',
    'harvest.form.notes':          'Notes (facultatif)',
    'harvest.form.save':           'Enregistrer la r\u00E9colte',
    'harvest.form.saving':         'Enregistrement\u2026',
    'harvest.err.amount':          'Indiquez la quantit\u00E9 r\u00E9colt\u00E9e.',
    'harvest.err.save':            'Impossible d\u2019enregistrer. R\u00E9essayez.',

    'onboarding.next':             'Suivant',
    'onboarding.back':             'Retour',
    'onboarding.cancel':           'Annuler',
    'onboarding.gpsFailed':
      'Impossible d\u2019obtenir votre position. Veuillez la saisir.',
    'onboarding.locationPlaceholder': 'Village, ville ou zone',
    'onboarding.typeCrop':         'Saisissez votre culture',

    'pest.whatToDo':               'Que faire',

    'setup.sizeUnit':              'Unit\u00E9',
    'setup.acres':                 'Acres',

    'timeline.confidence.low':     'Estim\u00E9',
  },

  sw: {
    'settings.language':           'Lugha',
    'myFarm.setupFarm':            'Anzisha shamba',

    'harvest.badge.completed':     'Mzunguko umekamilika',
    'harvest.badge.ready':         'Tayari kuvuna',
    'harvest.summary.approx':      '(thamani inayokadiriwa)',
    'harvest.ready.title':         'Wakati wa kuvuna',
    'harvest.ready.headline':      'Mazao yako yapo tayari kuvunwa.',
    'harvest.ready.headlineLate':  'Mazao yako yamepita tarehe ya kuvunwa.',
    'harvest.ready.why':
      'Kurekodi kiasi kunakamilisha mzunguko huu na kufungua mpango wako mpya wa kupanda.',
    'harvest.form.amount':         'Kiasi',
    'harvest.form.notes':          'Maelezo (si lazima)',
    'harvest.form.save':           'Rekodi mavuno',
    'harvest.form.saving':         'Inahifadhi\u2026',
    'harvest.err.amount':          'Andika kiasi ulichovuna.',
    'harvest.err.save':            'Imeshindikana kuhifadhi. Jaribu tena.',

    'onboarding.next':             'Endelea',
    'onboarding.back':             'Rudi',
    'onboarding.cancel':           'Ghairi',
    'onboarding.gpsFailed':
      'Hatukuweza kupata eneo lako. Tafadhali liandike.',
    'onboarding.locationPlaceholder': 'Kijiji, mji au eneo',
    'onboarding.typeCrop':         'Andika zao lako',

    'pest.whatToDo':               'Cha kufanya',

    'setup.sizeUnit':              'Kipimo',
    'setup.acres':                 'Ekari',

    'timeline.confidence.low':     'Inakadiriwa',
  },

  ha: {
    'settings.language':           'Harshe',
    'myFarm.setupFarm':            'Saita gona',

    'harvest.badge.completed':     'An kammala zagayen',
    'harvest.badge.ready':         'A shirye don girbi',
    'harvest.summary.approx':      '(\u01ADimar kim\u0101nin)',
    'harvest.ready.title':         'Lokacin girbi',
    'harvest.ready.headline':      'Amfanin gonarka ya isa girbi.',
    'harvest.ready.headlineLate':  'Amfanin gonarka ya wuce kwanan girbinsa.',
    'harvest.ready.why':
      'Yin rajistar adadin yana kammala wannan zagaye kuma yana bu\u01ADe sabon shirin shuka.',
    'harvest.form.amount':         'Adadi',
    'harvest.form.notes':          'Bayanai (zaba)',
    'harvest.form.save':           'Yi rajistar girbi',
    'harvest.form.saving':         'Ana adanawa\u2026',
    'harvest.err.amount':          'Shigar da adadin da ka girbe.',
    'harvest.err.save':            'An kasa adanawa. A sake gwadawa.',

    'onboarding.next':             'Gaba',
    'onboarding.back':             'Baya',
    'onboarding.cancel':           'Soke',
    'onboarding.gpsFailed':
      'Mun kasa samun wurinka kai tsaye. A rubuta shi.',
    'onboarding.locationPlaceholder': '\u01B6auye, gari ko yanki',
    'onboarding.typeCrop':         'Rubuta amfanin gonarka',

    'pest.whatToDo':               'Abin yi',

    'setup.sizeUnit':              'Awo',
    'setup.acres':                 'Eka',

    'timeline.confidence.low':     'Kim\u0101nin',
  },

  tw: {
    'settings.language':           'Kasa',
    'myFarm.setupFarm':            'Yɛ afuo no nh\u0254so',

    'harvest.badge.completed':     'Adwuma awie',
    'harvest.badge.ready':         'Wo afoa wie',
    'harvest.summary.approx':      '(akontaab\u0254 a y\u025Bbu)',
    'harvest.ready.title':         'Otwa bere',
    'harvest.ready.headline':      'Wo afoa no asi se y\u025Btwa.',
    'harvest.ready.headlineLate':  'Wo afoa no atwa mu \u025B mmer\u025B no.',
    'harvest.ready.why':
      'S\u025B woky\u025Br\u025B do\u025Bs\u025Bn a wotwae a, w\u025Bma wofa fofo\u025Br\u0254 mu.',
    'harvest.form.amount':         'Do\u025Bs\u025Bn',
    'harvest.form.notes':          'Nsumase\u025B (a wop\u025B)',
    'harvest.form.save':           'Ky\u025Br\u025Bw otwa',
    'harvest.form.saving':         'R\u025Bky\u025Br\u025Bw\u2026',
    'harvest.err.amount':          'Ky\u025Br\u025Bw do\u025Bs\u025Bn a wotwae.',
    'harvest.err.save':            'Y\u025Bantumi anky\u025Br\u025Bw. S\u025Br\u025B s\u0254 mu.',

    'onboarding.next':             'K\u0254 so',
    'onboarding.back':             'San kɔ',
    'onboarding.cancel':           'Gyae',
    'onboarding.gpsFailed':
      'Yenntumi anhu w\u02BCabaabia. Y\u025B s\u025Br\u025B sɛ ky\u025Br\u025Bw.',
    'onboarding.locationPlaceholder': 'Akuraa, kuro anaa beae bi',
    'onboarding.typeCrop':         'Ky\u025Br\u025Bw w\u02BCafoa',

    'pest.whatToDo':               'D\u025Bn na y\u025By\u025B',

    'setup.sizeUnit':              'Nsusuwii',
    'setup.acres':                 'Eka',

    'timeline.confidence.low':     'Akontaab\u0254',
  },

  hi: {
    'settings.language':           'भाषा',
    'myFarm.setupFarm':            'खेत सेट करें',

    'harvest.badge.completed':     'चक्र पूर्ण',
    'harvest.badge.ready':         'कटाई के लिए तैयार',
    'harvest.summary.approx':      '(अनुमानित मूल्य)',
    'harvest.ready.title':         'कटाई का समय',
    'harvest.ready.headline':      'आपकी फसल कटाई के लिए तैयार है।',
    'harvest.ready.headlineLate':  'आपकी फसल कटाई की निर्धारित तारीख पार कर चुकी है।',
    'harvest.ready.why':
      'मात्रा दर्ज करने से यह चक्र पूरा होता है और अगली बुवाई की योजना खुलती है।',
    'harvest.form.amount':         'मात्रा',
    'harvest.form.notes':          'टिप्पणी (वैकल्पिक)',
    'harvest.form.save':           'कटाई दर्ज करें',
    'harvest.form.saving':         'सहेजा जा रहा है…',
    'harvest.err.amount':          'कटाई की मात्रा दर्ज करें।',
    'harvest.err.save':            'सहेज नहीं सका। कृपया पुनः प्रयास करें।',

    'onboarding.next':             'आगे',
    'onboarding.back':             'पीछे',
    'onboarding.cancel':           'रद्द करें',
    'onboarding.gpsFailed':
      'हम आपका स्थान स्वतः नहीं ले सके। कृपया लिखें।',
    'onboarding.locationPlaceholder': 'गाँव, शहर या क्षेत्र',
    'onboarding.typeCrop':         'अपनी फसल लिखें',

    'pest.whatToDo':               'क्या करें',

    'setup.sizeUnit':              'इकाई',
    'setup.acres':                 'एकड़',

    'timeline.confidence.low':     'अनुमानित',
  },
});

export default GAP_KEYS_TRANSLATIONS;
