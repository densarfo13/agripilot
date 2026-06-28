/**
 * gardenModeTranslations.js — Garden Mode polish overlay.
 *
 * Covers the keys the Garden Mode upgrade spec calls out:
 *   • Garden-specific greeting label (Gardener)
 *   • Garden-specific empty states (no plant / no scan / no progress / no weather)
 *   • Garden-flavoured progress + streak copy
 *   • Garden voice-guide answers
 *   • Garden status chips / labels
 *
 * Shape: `{ key: { locale: value } }`. Coverage: en, fr, sw, ha, tw, hi.
 * Merged via the briefing/scan overlay slot in src/i18n/index.js as
 * empty-slot fill — translator-authored values in the main T
 * dictionary always win.
 */

export const GARDEN_MODE_TRANSLATIONS = Object.freeze({
  // ── Mode label (used in greeting + voice) ────────────────
  'gardenMode.userLabel': {
    en: 'Gardener',
    fr: 'Jardinier',
    sw: 'Mkulima wa bustani',
    ha: 'Manomi na lambu',
    tw: 'Turo nipa',
    hi: 'बागवान',
  },
  'gardenMode.morningEmoji': {
    en: '🌿 Good morning',
    fr: '🌿 Bonjour',
    sw: '🌿 Habari za asubuhi',
    ha: '🌿 Ina kwana',
    tw: '🌿 Maakye',
    hi: '🌿 सुप्रभात',
  },

  // ── Empty states (spec §9) ────────────────────────────────
  'gardenMode.empty.noPlant': {
    en: 'Add your first plant to get simple daily care guidance.',
    fr: 'Ajoutez votre première plante pour recevoir des conseils de soins quotidiens.',
    sw: 'Ongeza mmea wako wa kwanza ili upate mwongozo rahisi wa utunzaji wa kila siku.',
    ha: 'Ƙara tsiron ka na farko don samun jagoran kulawa na yau da kullum mai sauƙi.',
    tw: 'Fa wo afifideɛ a ɛdi kan ka ho na woanya da biara ho akwankyerɛ a ɛyɛ mmerɛw.',
    hi: 'सरल दैनिक देखभाल मार्गदर्शन पाने के लिए अपना पहला पौधा जोड़ें।',
  },
  'gardenMode.empty.noScan': {
    en: 'Scan a plant when you want help checking leaves.',
    fr: 'Scannez une plante quand vous voulez vérifier les feuilles.',
    sw: 'Pima mmea wakati unataka msaada wa kuangalia majani.',
    ha: 'Bincika tsiro idan kana son taimako wajen duba ganyaye.',
    tw: 'Scan afifideɛ bere a wopɛ mmoa wɔ aba hwɛ ho.',
    hi: 'जब आप पत्तियों की जाँच में मदद चाहें तो पौधे को स्कैन करें।',
  },
  'gardenMode.empty.noProgress': {
    en: 'Complete one care task to start your progress.',
    fr: 'Complétez une tâche de soin pour commencer votre progression.',
    sw: 'Kamilisha kazi moja ya utunzaji ili kuanza maendeleo yako.',
    ha: 'Kammala aiki ɗaya na kulawa don fara ci gaba.',
    tw: 'Wie ɔhwɛ adwuma baako na fi wo nkɔso ase.',
    hi: 'अपनी प्रगति शुरू करने के लिए एक देखभाल कार्य पूरा करें।',
  },
  'gardenMode.empty.noWeather': {
    en: 'Add location for better watering tips.',
    fr: 'Ajoutez votre localisation pour de meilleurs conseils d\'arrosage.',
    sw: 'Ongeza eneo ili upate vidokezo bora vya kumwagilia.',
    ha: 'Ƙara wuri don samun shawarwarin shayarwa mafi kyau.',
    tw: 'Fa wo baabi ka ho na woanya nsuo gugu ho afotuo a eye.',
    hi: 'बेहतर पानी देने की सलाह के लिए स्थान जोड़ें।',
  },

  // ── Progress copy (spec §8) — care, not analytics ─────────
  'gardenMode.progress.carestreak': {
    en: 'Care streak',
    fr: 'Série de soins',
    sw: 'Mwendelezo wa utunzaji',
    ha: 'Jerin kulawa',
    tw: 'Ɔhwɛ nkɔso',
    hi: 'देखभाल श्रृंखला',
  },
  'gardenMode.progress.tasksThisWeek': {
    en: 'care tasks completed this week',
    fr: 'tâches de soin complétées cette semaine',
    sw: 'kazi za utunzaji zilizokamilika wiki hii',
    ha: 'ayyukan kulawa da aka kammala wannan makon',
    tw: 'ɔhwɛ adwuma a wɔawie nnawɔtwe yi',
    hi: 'इस सप्ताह पूरे किए गए देखभाल कार्य',
  },
  'gardenMode.progress.daysCount': {
    en: 'days',
    fr: 'jours',
    sw: 'siku',
    ha: 'kwanaki',
    tw: 'nna',
    hi: 'दिन',
  },

  // ── Voice answers (spec §10) — short, reassuring, non-technical ──
  'gardenMode.voice.shouldIWater': {
    en: 'Check the soil with your finger. If it feels dry below the surface, water gently.',
    fr: 'Touchez la terre avec votre doigt. Si elle est sèche sous la surface, arrosez doucement.',
    sw: 'Gusa udongo na kidole chako. Ikiwa unahisi mkavu chini ya uso, mwagilia kwa upole.',
    ha: 'Taɓa ƙasa da yatsa. Idan ta ji bushe a ƙarƙashi, ka shayar a hankali.',
    tw: 'Fa wo nsa to asase no so. Sɛ ase awo a, gugu nsuo brɛoo.',
    hi: 'अपनी उंगली से मिट्टी छुएँ। अगर सतह के नीचे सूखी लगे, तो धीरे से पानी दें।',
  },
  'gardenMode.voice.yellowLeaves': {
    en: 'Yellow leaves often mean too much or too little water. Check soil moisture and look under leaves for pests.',
    fr: 'Les feuilles jaunes signifient souvent trop ou trop peu d\'eau. Vérifiez l\'humidité du sol et regardez sous les feuilles.',
    sw: 'Majani ya manjano mara nyingi yanamaanisha maji mengi sana au kidogo sana. Kagua unyevu wa udongo na uangalie chini ya majani.',
    ha: 'Ganyaye masu launin rawaya sau da yawa suna nufin yawan ruwa ko ƙarancin ruwa. Duba damshin ƙasa kuma ka duba ƙarƙashin ganyaye.',
    tw: 'Aba a ɛyɛ akokɔsradeɛ taa kyerɛ nsuo bebree anaa nsuo kakra. Hwɛ asase no mu nsuo na hwɛ aba no ase.',
    hi: 'पीली पत्तियाँ अक्सर बहुत अधिक या बहुत कम पानी का संकेत हैं। मिट्टी की नमी जाँचें और पत्तियों के नीचे देखें।',
  },
  'gardenMode.voice.howToScan': {
    en: 'Tap Scan, then take a clear photo of the leaf in good light. We will tell you what to check next.',
    fr: 'Appuyez sur Scanner, puis prenez une photo claire de la feuille à la lumière. Nous vous dirons quoi vérifier ensuite.',
    sw: 'Bonyeza Pima, kisha piga picha wazi ya jani katika mwanga mzuri. Tutakuambia kile cha kuangalia baadaye.',
    ha: 'Danna Bincika, sannan ɗauki hoton ganye a wuri mai haske. Za mu gaya maka abin da za a duba na gaba.',
    tw: 'Mia Scan, na twa aba mfoni a ɛda hɔ pefee wɔ hann pa mu. Yɛbɛkyerɛ wo deɛ ɛsɛ sɛ wohwɛ.',
    hi: 'स्कैन दबाएँ, फिर अच्छी रोशनी में पत्ती का साफ़ फ़ोटो लें। हम आपको बताएँगे कि आगे क्या जाँचना है।',
  },

  // ── Status chips (Garden-friendly variant — spec §7) ──────
  'gardenMode.scanChip.healthy':       { en: 'No disease seen',         fr: 'Semble en bonne santé',   sw: 'Inaonekana yenye afya',    ha: 'Tana da lafiya',          tw: 'Apɔw',              hi: 'स्वस्थ दिखती है' },
  'gardenMode.scanChip.needsReview':   { en: 'Needs review',           fr: 'À vérifier',              sw: 'Inahitaji ukaguzi',        ha: 'Buƙatar bita',            tw: 'Ɛhia hwɛyie',       hi: 'समीक्षा की आवश्यकता' },
  'gardenMode.scanChip.leafStress':    { en: 'Possible leaf stress',   fr: 'Stress foliaire possible',sw: 'Mfadhaiko wa majani',      ha: 'Yiwuwar matsalar ganye',  tw: 'Aba haw',           hi: 'पत्तियों पर तनाव संभव' },
  'gardenMode.scanChip.pestDamage':    { en: 'Possible pest damage',   fr: 'Dégâts de ravageurs',     sw: 'Uharibifu wa wadudu',      ha: 'Lalacewa ta kwari',       tw: 'Mmoawa sɛe',        hi: 'कीट क्षति संभव' },
  'gardenMode.scanChip.unclearPhoto':  { en: 'Unclear photo',          fr: 'Photo floue',             sw: 'Picha haijaeleweka',       ha: 'Hoto da ba a sani ba',    tw: 'Mfoni a ɛnyɛ pefee', hi: 'धुंधला फ़ोटो' },
});

export default GARDEN_MODE_TRANSLATIONS;
