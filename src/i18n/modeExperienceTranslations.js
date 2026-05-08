/**
 * modeExperienceTranslations.js — labels and emotional-goal copy
 * exposed by src/modes/modeExperience.js.
 *
 * Other mode-specific keys (gardenMode.userLabel, gardenMode.empty.*,
 * task.vocab.*, etc.) ship in the per-feature overlays already
 * registered (gardenModeTranslations.js, plantCompanionTranslations.js).
 * This file only adds the new keys this commit introduces.
 *
 * Coverage: en, fr, sw, ha, tw, hi.
 */

export const MODE_EXPERIENCE_TRANSLATIONS = Object.freeze({
  // ── Mode labels ───────────────────────────────────────────
  'mode.farm.label':   { en: 'Farm',   fr: 'Ferme',   sw: 'Shamba',   ha: 'Gona',     tw: 'Afuo',  hi: 'खेत' },
  'mode.garden.label': { en: 'Garden', fr: 'Jardin',  sw: 'Bustani',  ha: 'Lambu',    tw: 'Turo',  hi: 'बगीचा' },

  // ── Emotional goals (spec headlines) ──────────────────────
  'mode.farm.emotionalGoal': {
    en: 'I know what matters today.',
    fr: 'Je sais ce qui compte aujourd\'hui.',
    sw: 'Najua kinachoongoza leo.',
    ha: 'Na san abin da yake da muhimmanci yau.',
    tw: 'Menim deɛ ɛho hia ɛnnɛ.',
    hi: 'मुझे पता है कि आज क्या महत्वपूर्ण है।',
  },
  'mode.garden.emotionalGoal': {
    en: 'My plants are doing better because of this app.',
    fr: 'Mes plantes vont mieux grâce à cette app.',
    sw: 'Mimea yangu inafanya vizuri zaidi kwa sababu ya programu hii.',
    ha: 'Tsire-tsirena suna kyau saboda wannan app.',
    tw: 'Me afifideɛ no rekɔ yiye saa app yi nti.',
    hi: 'इस ऐप की वजह से मेरे पौधे बेहतर हो रहे हैं।',
  },

  // ── User labels (Farm side) ──────────────────────────────
  // Garden side already in gardenModeTranslations.js as
  // gardenMode.userLabel — kept there to stay close to the
  // gardener-specific palette.
  'mode.farm.userLabel': {
    en: 'Farmer', fr: 'Agriculteur', sw: 'Mkulima', ha: 'Manomi', tw: 'Okuafoɔ', hi: 'किसान',
  },

  // ── Task vocabulary (mode-specific subject words) ─────────
  'task.vocab.farm.crop':     { en: 'crop',    fr: 'culture',  sw: 'mazao',    ha: 'amfanin gona', tw: 'nnɔbae',     hi: 'फसल' },
  'task.vocab.farm.field':    { en: 'field',   fr: 'champ',    sw: 'shamba',   ha: 'gona',         tw: 'afuo',       hi: 'खेत' },
  'task.vocab.farm.task':     { en: 'task',    fr: 'tâche',    sw: 'kazi',     ha: 'aiki',         tw: 'adwuma',     hi: 'कार्य' },
  'task.vocab.farm.drainage': { en: 'drainage',fr: 'drainage', sw: 'mfumo',    ha: 'magudana',     tw: 'nsuo kwan',  hi: 'जल निकासी' },
  'task.vocab.farm.buyers':   { en: 'buyers',  fr: 'acheteurs',sw: 'wanunuzi', ha: 'masu siye',    tw: 'atɔfoɔ',     hi: 'खरीदार' },
  'task.vocab.farm.funding':  { en: 'funding', fr: 'financement', sw: 'ufadhili', ha: 'tallafi', tw: 'sika boa',   hi: 'धन' },
  'task.vocab.farm.listing':  { en: 'listing', fr: 'annonce',  sw: 'orodha',   ha: 'jeri',         tw: 'nkrataa',    hi: 'सूची' },
  'task.vocab.farm.yield':    { en: 'yield',   fr: 'rendement',sw: 'mavuno',   ha: 'amfani',       tw: 'aba',        hi: 'उपज' },

  'task.vocab.garden.plant':    { en: 'plant',   fr: 'plante',  sw: 'mmea',      ha: 'tsiro',       tw: 'afifideɛ',   hi: 'पौधा' },
  'task.vocab.garden.pot':      { en: 'pot',     fr: 'pot',     sw: 'chungu',    ha: 'tukunya',     tw: 'kuruwa',     hi: 'गमला' },
  'task.vocab.garden.care':     { en: 'care',    fr: 'soin',    sw: 'utunzaji',  ha: 'kulawa',      tw: 'ɔhwɛ',       hi: 'देखभाल' },
  'task.vocab.garden.watering': { en: 'watering',fr: 'arrosage',sw: 'kumwagilia',ha: 'shayarwa',    tw: 'nsuo gugu',  hi: 'पानी देना' },
  'task.vocab.garden.share':    { en: 'share',   fr: 'partage', sw: 'kushiriki', ha: 'rabawa',      tw: 'kyɛ',        hi: 'साझा करें' },
  'task.vocab.garden.tools':    { en: 'tools',   fr: 'outils',  sw: 'zana',      ha: 'kayan aiki',  tw: 'nnɔɔso',     hi: 'उपकरण' },
  'task.vocab.garden.note':     { en: 'note',    fr: 'note',    sw: 'maelezo',   ha: 'bayanin kula', tw: 'nsɛm',     hi: 'टिप्पणी' },
  'task.vocab.garden.growth':   { en: 'growth',  fr: 'croissance',sw: 'ukuaji',  ha: 'girma',       tw: 'nyini',      hi: 'विकास' },

  // ── Farm empty states (Garden side already shipped) ──────
  'farm.empty.noProduce': {
    en: 'No produce listed yet. When your crop is ready, buyers can discover it here.',
    fr: 'Aucun produit listé. Lorsque votre culture sera prête, les acheteurs pourront la découvrir ici.',
    sw: 'Hakuna mazao yaliyoorodheshwa bado. Mazao yako yatakapokuwa tayari, wanunuzi wataweza kuyagundua hapa.',
    ha: 'Babu amfani da aka jera har yanzu. Lokacin da amfanin gonarka ya shirya, masu siye za su iya ganinsa a nan.',
    tw: 'Wonnyaa nnɔbae a wɔatɔ ase. Sɛ wo nnɔbae no asi a, atɔfoɔ bɛhunu wɔ ha.',
    hi: 'अभी कोई उपज सूचीबद्ध नहीं। जब आपकी फसल तैयार होगी, खरीदार इसे यहाँ देख सकेंगे।',
  },
  'farm.empty.noProgress': {
    en: 'Complete one task to start tracking your farm progress.',
    fr: 'Complétez une tâche pour commencer à suivre votre progression agricole.',
    sw: 'Kamilisha kazi moja kuanza kufuatilia maendeleo ya shamba lako.',
    ha: 'Kammala aiki ɗaya don fara bin diddigin ci gaban gonarka.',
    tw: 'Wie adwuma baako na fi wo afuo nkɔso ho mu.',
    hi: 'अपनी खेत की प्रगति देखने के लिए एक कार्य पूरा करें।',
  },
  'farm.empty.noScan': {
    en: 'Scan a crop when you want help checking plant health.',
    fr: 'Scannez une culture lorsque vous voulez vérifier l\'état de votre plante.',
    sw: 'Pima zao wakati unataka msaada wa kuangalia afya ya mmea.',
    ha: 'Bincika amfani idan kana son taimako wajen duba lafiyar tsiro.',
    tw: 'Scan nnɔbae bere a wopɛ mmoa wɔ afifideɛ apɔwmuden ho.',
    hi: 'जब आप पौधे के स्वास्थ्य की जाँच में मदद चाहें तो फसल को स्कैन करें।',
  },
});

export default MODE_EXPERIENCE_TRANSLATIONS;
