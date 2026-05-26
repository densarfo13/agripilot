/**
 * productionGapTranslations.js — fills the translation-key gaps
 * surfaced by the production-incident investigation (on-device
 * screenshots, May 2026).
 *
 * Why this overlay
 * ────────────────
 *   On-device captures showed three classes of leak even though
 *   every prior locale-picker / sessionManager fix shipped to
 *   production successfully:
 *
 *     1. JournalPage strings (eyebrow / title / subtitle / identity
 *        line / "My Plant" fallback / timeline label / empty state
 *        / photo strip label / stat chip labels) wrapped in tSafe()
 *        but the keys were never authored into the locale columns.
 *
 *     2. ImmersiveHomeHero's `hero.subtype.*` keys (title / line /
 *        cta for the four backyard subtypes — small_farm, commercial,
 *        mixed, greenhouse) wrapped in tSafe() but again, never
 *        authored into the columns. So the hero card showed English
 *        even when the bottom nav was rendering French — exactly
 *        the "three languages on one screen" symptom captured.
 *
 *     3. LiveCameraScanner fallback panel ("Camera is taking a
 *        moment", "Tap retry, or use a saved photo to keep scanning
 *        now.", "Retry camera", etc.) was hardcoded English in JSX,
 *        not even wrapped in tSafe.
 *
 *   Shape: `{ key: { locale: value } }`. Merged via the empty-slot
 *   fill in src/i18n/index.js — translator-authored canonical
 *   column values always win if/when they're added.
 *
 *   Native translations for fr/sw/ha/tw/hi were drafted to match
 *   the tone and vocabulary already established in
 *   plantCompanionTranslations.js + briefingScanTranslations.js
 *   so the journal voice stays consistent across screens.
 *
 * Strict-rule audit
 *   • Pure data. Module-scope freeze.
 *   • Adding a key here MUST cover all 6 locales; the
 *     guard:duplicate-locales script will flag any partial entries.
 */

export const PRODUCTION_GAP_TRANSLATIONS = Object.freeze({
  // ─── Journal page (src/pages/JournalPage.jsx) ────────────────
  'journal.eyebrow': {
    en: 'Journal',
    fr: 'Journal',
    sw: 'Shajara',
    ha: 'Tarihi',
    tw: 'Daleehie',
    hi: 'जर्नल',
  },
  'journal.title': {
    en: 'Your growth story',
    fr: 'Votre histoire de croissance',
    sw: 'Hadithi yako ya kukua',
    ha: 'Labarinka na girma',
    tw: 'Wo nyini ho asɛm',
    hi: 'आपकी विकास कहानी',
  },
  'journal.subtitle': {
    en: 'Care moments, photos, and milestones — in the order they happened.',
    fr: 'Moments de soin, photos et étapes clés — dans l’ordre où ils se sont produits.',
    sw: 'Wakati wa utunzaji, picha, na hatua muhimu — kwa mpangilio walitokea.',
    ha: 'Lokutan kulawa, hotuna, da muhimman matakai — bisa tsarin da suka faru.',
    tw: 'Ɔhwɛ mmere, mfonini, ne nsɛm ahodoɔ — sɛnea ɛsisii no.',
    hi: 'देखभाल के पल, तस्वीरें, और मील के पत्थर — जिस क्रम में हुए।',
  },
  'journal.identity.tap': {
    en: 'Tap to set up your plant',
    fr: 'Touchez pour configurer votre plante',
    sw: 'Gusa kuanzisha mmea wako',
    ha: 'Danna don saita shukarka',
    tw: 'Mia bere wo dua no de wo dwumadi ho',
    hi: 'अपना पौधा सेट करने के लिए टैप करें',
  },
  'journal.timeline.label': {
    en: 'Care moments',
    fr: 'Moments de soin',
    sw: 'Wakati wa utunzaji',
    ha: 'Lokutan kulawa',
    tw: 'Ɔhwɛ mmere',
    hi: 'देखभाल के पल',
  },
  'journal.observation.label': {
    en: 'Today',
    fr: 'Aujourd’hui',
    sw: 'Leo',
    ha: 'Yau',
    tw: 'Ɛnnɛ',
    hi: 'आज',
  },
  'journal.empty.title': {
    en: 'Your journal is waiting',
    fr: 'Votre journal vous attend',
    sw: 'Shajara yako inakungoja',
    ha: 'Tarihinka yana jiranka',
    tw: 'Wo daleehie retwɛn wo',
    hi: 'आपकी जर्नल प्रतीक्षा कर रही है',
  },
  'journal.empty.body': {
    en: 'Care moments will appear here as you tend to your plant — first scan, first flower, first harvest.',
    fr: 'Les moments de soin apparaîtront ici à mesure que vous prenez soin de votre plante — premier scan, première fleur, première récolte.',
    sw: 'Wakati wa utunzaji utaonekana hapa unapotunza mmea wako — uchanganuzi wa kwanza, ua la kwanza, mavuno ya kwanza.',
    ha: 'Lokutan kulawa za su bayyana a nan yayin da kake kula da shukarka — sikan na farko, fure na farko, girbi na farko.',
    tw: 'Ɔhwɛ mmere bɛda adi wɔ ha bere a worehwɛ wo dua no — scan a edi kan, nhwiren a edi kan, otwa a edi kan.',
    hi: 'जैसे-जैसे आप अपने पौधे की देखभाल करेंगे, देखभाल के पल यहाँ दिखाई देंगे — पहला स्कैन, पहला फूल, पहली फसल।',
  },
  'journal.empty.cta': {
    en: 'Scan your plant',
    fr: 'Scanner votre plante',
    sw: 'Changanua mmea wako',
    ha: 'Sikan shukarka',
    tw: 'Scan wo dua no',
    hi: 'अपने पौधे को स्कैन करें',
  },
  'journal.photos.label': {
    en: 'Photo timeline',
    fr: 'Chronologie photo',
    sw: 'Ratiba ya picha',
    ha: 'Lokutan hotuna',
    tw: 'Mfonini berɛ',
    hi: 'फोटो समयरेखा',
  },
  'journal.stat.moments': {
    en: 'Moments',
    fr: 'Moments',
    sw: 'Wakati',
    ha: 'Lokuta',
    tw: 'Mmere',
    hi: 'पल',
  },
  'journal.stat.scanned': {
    en: 'First scan',
    fr: 'Premier scan',
    sw: 'Uchanganuzi wa kwanza',
    ha: 'Sikan na farko',
    tw: 'Scan a edi kan',
    hi: 'पहला स्कैन',
  },
  'journal.stat.scanned.value': {
    en: 'Yes',
    fr: 'Oui',
    sw: 'Ndio',
    ha: 'Eh',
    tw: 'Aane',
    hi: 'हाँ',
  },
  'journal.stat.flowered': {
    en: 'First flower',
    fr: 'Première fleur',
    sw: 'Ua la kwanza',
    ha: 'Fure na farko',
    tw: 'Nhwiren a edi kan',
    hi: 'पहला फूल',
  },
  'journal.stat.flowered.value': {
    en: 'Yes',
    fr: 'Oui',
    sw: 'Ndio',
    ha: 'Eh',
    tw: 'Aane',
    hi: 'हाँ',
  },
  'journal.stat.fruited': {
    en: 'First fruit',
    fr: 'Premier fruit',
    sw: 'Tunda la kwanza',
    ha: 'Ɗan itace na farko',
    tw: 'Aduaba a edi kan',
    hi: 'पहला फल',
  },
  'journal.stat.fruited.value': {
    en: 'Yes',
    fr: 'Oui',
    sw: 'Ndio',
    ha: 'Eh',
    tw: 'Aane',
    hi: 'हाँ',
  },
  'plant.fallback.nickname': {
    en: 'My Plant',
    fr: 'Ma plante',
    sw: 'Mmea wangu',
    ha: 'Shukata',
    tw: 'Me dua',
    hi: 'मेरा पौधा',
  },
  'plant.timeline.generic': {
    en: 'Care moment',
    fr: 'Moment de soin',
    sw: 'Wakati wa utunzaji',
    ha: 'Lokacin kulawa',
    tw: 'Ɔhwɛ bere',
    hi: 'देखभाल का पल',
  },

  // ─── ImmersiveHomeHero (src/components/home/ImmersiveHomeHero.jsx) ─
  'hero.eyebrow': {
    en: 'My farm',
    fr: 'Ma ferme',
    sw: 'Shamba langu',
    ha: 'Gonata',
    tw: 'Me afuo',
    hi: 'मेरा खेत',
  },
  'hero.subtype.small_farm.title': {
    en: 'Today on your farm',
    fr: 'Aujourd’hui sur votre ferme',
    sw: 'Leo kwenye shamba lako',
    ha: 'Yau a gonarka',
    tw: 'Ɛnnɛ wɔ wo afuo so',
    hi: 'आज आपके खेत पर',
  },
  'hero.subtype.small_farm.line': {
    en: 'A quick field check helps catch problems early.',
    fr: 'Une vérification rapide du champ aide à détecter les problèmes tôt.',
    sw: 'Ukaguzi wa haraka wa shamba husaidia kupata matatizo mapema.',
    ha: 'Bincike na sauri na gona yana taimakawa wajen gano matsaloli da wuri.',
    tw: 'Afuo no mu hwɛyie ntɛm boa ma yehunu nsɛm a esisi ntɛm.',
    hi: 'खेत की त्वरित जाँच जल्दी समस्याओं को पकड़ने में मदद करती है।',
  },
  'hero.subtype.small_farm.cta': {
    en: 'Start farm check',
    fr: 'Lancer la vérification de la ferme',
    sw: 'Anza ukaguzi wa shamba',
    ha: 'Fara bincike na gona',
    tw: 'Fi afuo no mu hwɛyie ase',
    hi: 'खेत की जाँच शुरू करें',
  },
  'hero.subtype.commercial.title': {
    en: 'Today on your farm',
    fr: 'Aujourd’hui sur votre ferme',
    sw: 'Leo kwenye shamba lako',
    ha: 'Yau a gonarka',
    tw: 'Ɛnnɛ wɔ wo afuo so',
    hi: 'आज आपके खेत पर',
  },
  'hero.subtype.commercial.line': {
    en: 'A quick field check helps catch problems early.',
    fr: 'Une vérification rapide du champ aide à détecter les problèmes tôt.',
    sw: 'Ukaguzi wa haraka wa shamba husaidia kupata matatizo mapema.',
    ha: 'Bincike na sauri na gona yana taimakawa wajen gano matsaloli da wuri.',
    tw: 'Afuo no mu hwɛyie ntɛm boa ma yehunu nsɛm a esisi ntɛm.',
    hi: 'खेत की त्वरित जाँच जल्दी समस्याओं को पकड़ने में मदद करती है।',
  },
  'hero.subtype.commercial.cta': {
    en: 'Start farm check',
    fr: 'Lancer la vérification de la ferme',
    sw: 'Anza ukaguzi wa shamba',
    ha: 'Fara bincike na gona',
    tw: 'Fi afuo no mu hwɛyie ase',
    hi: 'खेत की जाँच शुरू करें',
  },
  'hero.subtype.mixed.title': {
    en: 'Today in your garden',
    fr: 'Aujourd’hui dans votre jardin',
    sw: 'Leo kwenye bustani yako',
    ha: 'Yau a lambunka',
    tw: 'Ɛnnɛ wɔ wo turo mu',
    hi: 'आज आपके बगीचे में',
  },
  'hero.subtype.mixed.line': {
    en: 'A quick check helps catch problems early.',
    fr: 'Une vérification rapide aide à détecter les problèmes tôt.',
    sw: 'Ukaguzi wa haraka husaidia kupata matatizo mapema.',
    ha: 'Bincike na sauri yana taimakawa wajen gano matsaloli da wuri.',
    tw: 'Hwɛyie ntɛm boa ma yehunu nsɛm a esisi ntɛm.',
    hi: 'त्वरित जाँच जल्दी समस्याओं को पकड़ने में मदद करती है।',
  },
  'hero.subtype.mixed.cta': {
    en: 'Start garden check',
    fr: 'Lancer la vérification du jardin',
    sw: 'Anza ukaguzi wa bustani',
    ha: 'Fara bincike na lambu',
    tw: 'Fi turo no mu hwɛyie ase',
    hi: 'बगीचे की जाँच शुरू करें',
  },
  'hero.subtype.greenhouse.title': {
    en: 'Today in your greenhouse',
    fr: 'Aujourd’hui dans votre serre',
    sw: 'Leo kwenye chafu yako',
    ha: 'Yau a gidan dasawanka',
    tw: 'Ɛnnɛ wɔ wo dua dan no mu',
    hi: 'आज आपके ग्रीनहाउस में',
  },
  'hero.subtype.greenhouse.line': {
    en: 'A quick check helps catch heat or moisture problems early.',
    fr: 'Une vérification rapide aide à détecter les problèmes de chaleur ou d’humidité tôt.',
    sw: 'Ukaguzi wa haraka husaidia kupata matatizo ya joto au unyevu mapema.',
    ha: 'Bincike na sauri yana taimakawa wajen gano matsalolin zafi ko danshi da wuri.',
    tw: 'Hwɛyie ntɛm boa ma yehunu ɔhyew anaa nsuo ho nsɛm ntɛm.',
    hi: 'त्वरित जाँच गर्मी या नमी की समस्याओं को जल्दी पकड़ने में मदद करती है।',
  },
  'hero.subtype.greenhouse.cta': {
    en: 'Start check',
    fr: 'Lancer la vérification',
    sw: 'Anza ukaguzi',
    ha: 'Fara bincike',
    tw: 'Fi hwɛyie ase',
    hi: 'जाँच शुरू करें',
  },

  // ─── LiveCameraScanner fallback panel ──────────────────────
  // The user's iPhone Safari screenshot shows the camera fell back
  // to "Camera is taking a moment" — these are the strings that
  // panel renders. Wrap them so a French / Swahili / Hindi user
  // doesn't get jarring English fallback when the camera fails.
  'scan.camera.takingMoment.title': {
    en: 'Camera is taking a moment',
    fr: 'La caméra prend un instant',
    sw: 'Kamera inachukua muda',
    ha: 'Kamara tana ɗaukar lokaci',
    tw: 'Camera no regye bere kakra',
    hi: 'कैमरा थोड़ा समय ले रहा है',
  },
  'scan.camera.takingMoment.body': {
    en: 'Tap retry, or use a saved photo to keep scanning now.',
    fr: 'Touchez réessayer, ou utilisez une photo enregistrée pour continuer.',
    sw: 'Gusa jaribu tena, au tumia picha iliyohifadhiwa kuendelea kuchanganua sasa.',
    ha: 'Danna sake gwadawa, ko yi amfani da hoton da aka adana don ci gaba da sikan yanzu.',
    tw: 'Mia bio so, anaa fa mfonini a wɔakora di dwuma kɔ so scan seesei.',
    hi: 'पुनः प्रयास करें टैप करें, या अभी स्कैन जारी रखने के लिए सहेजी गई तस्वीर का उपयोग करें।',
  },
  'scan.camera.useSaved': {
    en: 'Use a saved photo',
    fr: 'Utiliser une photo enregistrée',
    sw: 'Tumia picha iliyohifadhiwa',
    ha: 'Yi amfani da hoton da aka adana',
    tw: 'Fa mfonini a wɔakora di dwuma',
    hi: 'सहेजी गई तस्वीर का उपयोग करें',
  },
  'scan.camera.retry': {
    en: 'Retry camera',
    fr: 'Réessayer la caméra',
    sw: 'Jaribu kamera tena',
    ha: 'Sake gwada kamara',
    tw: 'Sɔ camera no hwɛ bio',
    hi: 'कैमरा पुनः प्रयास करें',
  },

  // ─── Home page eyebrow + farm-name fallbacks ──────────────────
  'home.farm.newFallback': {
    en: 'My new farm',
    fr: 'Ma nouvelle ferme',
    sw: 'Shamba langu jipya',
    ha: 'Sabuwar gonata',
    tw: 'Me afuo foforɔ',
    hi: 'मेरा नया खेत',
  },

  // ─── ScanFallback retry surface (src/components/scan/ScanFallback.jsx) ─
  'common.retry': {
    en: 'Retry',
    fr: 'Réessayer',
    sw: 'Jaribu tena',
    ha: 'Sake gwadawa',
    tw: 'Sɔ hwɛ bio',
    hi: 'पुनः प्रयास करें',
  },
  'scan.gallery.upload': {
    en: 'Upload from gallery',
    fr: 'Télécharger depuis la galerie',
    sw: 'Pakia kutoka kwenye galari',
    ha: 'Loda daga ɗakin hoto',
    tw: 'Fa fi mfonini dan mu',
    hi: 'गैलरी से अपलोड करें',
  },
  'scan.fallback.setup.title': {
    en: 'Add your crop first',
    fr: 'Ajoutez d’abord votre culture',
    sw: 'Ongeza zao lako kwanza',
    ha: 'Da farko, ƙara amfaninka',
    tw: 'Di kan ka wo afude',
    hi: 'पहले अपनी फसल जोड़ें',
  },
  'scan.fallback.setup.body': {
    en: 'Farroway needs a crop or plant on your farm before we can scan it. Set up your farm and the scan will work.',
    fr: 'Farroway a besoin d’une culture ou plante sur votre ferme avant de pouvoir la scanner. Configurez votre ferme et le scan fonctionnera.',
    sw: 'Farroway inahitaji zao au mmea kwenye shamba lako kabla ya kuchanganua. Sanidi shamba lako na uchanganuzi utafanya kazi.',
    ha: 'Farroway na buƙatar amfani ko shuka a gonarka kafin mu iya sikan shi. Saita gonarka kuma sikan zai yi aiki.',
    tw: 'Farroway hia afude anaa dua wɔ wo afuo so ansa na yebetumi ascan. Yɛ wo afuo no nhyehyɛeɛ na scan no bɛyɛ adwuma.',
    hi: 'फरोवे को स्कैन करने से पहले आपके खेत पर एक फसल या पौधे की आवश्यकता है। अपना खेत सेट करें और स्कैन काम करेगा।',
  },
  'scan.fallback.setup.cta': {
    en: 'Set up my farm',
    fr: 'Configurer ma ferme',
    sw: 'Sanidi shamba langu',
    ha: 'Saita gonata',
    tw: 'Yɛ me afuo nhyehyɛeɛ',
    hi: 'मेरा खेत सेट करें',
  },

  // ─── MyFarmPage scan-card (src/pages/MyFarmPage.jsx) ─────────
  // On-device screenshot showed the "Scan crop health / Check
  // leaves or crop photo" card in English while the rest of the
  // page rendered correctly in French.
  'myFarm.scan.label': {
    en: 'Scan crop health',
    fr: 'Scanner la santé des cultures',
    sw: 'Changanua afya ya zao',
    ha: 'Sikan lafiyar amfani',
    tw: 'Scan afude apɔwmuden',
    hi: 'फसल स्वास्थ्य स्कैन करें',
  },
  'myFarm.scan.sub': {
    en: 'Check leaves or crop photo',
    fr: 'Vérifiez les feuilles ou la photo de la culture',
    sw: 'Angalia majani au picha ya zao',
    ha: 'Duba ganye ko hoton amfani',
    tw: 'Hwɛ nhaban anaa afude no mfonini',
    hi: 'पत्तियाँ या फसल की तस्वीर देखें',
  },
  'myFarm.scan.aria': {
    en: 'Scan crop health — check leaves or crop photo',
    fr: 'Scanner la santé des cultures — vérifiez les feuilles ou la photo de la culture',
    sw: 'Changanua afya ya zao — angalia majani au picha ya zao',
    ha: 'Sikan lafiyar amfani — duba ganye ko hoton amfani',
    tw: 'Scan afude apɔwmuden — hwɛ nhaban anaa afude no mfonini',
    hi: 'फसल स्वास्थ्य स्कैन करें — पत्तियाँ या फसल की तस्वीर देखें',
  },

  // ─── Sell empty state (src/components/activation/SellEmptyPrompt.jsx) ─
  // On-device screenshot showed these three strings in English on a
  // Swahili device. The component had hardcoded literals (not even
  // wrapped in tSafe) — the wrap-in-tSafe edit is in the same drop.
  'sell.empty.title': {
    en: 'No produce listed yet.',
    fr: 'Aucun produit listé pour le moment.',
    sw: 'Hakuna mazao yaliyoorodheshwa bado.',
    ha: 'Babu amfani da aka jera tukuna.',
    tw: 'Wonkyerɛw nnɔbae biara nkyerɛ.',
    hi: 'अभी तक कोई उपज सूचीबद्ध नहीं है।',
  },
  'sell.empty.body': {
    en: 'When your crop is ready, list it so buyers can find it.',
    fr: 'Quand votre récolte est prête, listez-la pour que les acheteurs la trouvent.',
    sw: 'Mavuno yako yakiwa tayari, yaorodheshe ili wanunuzi wayapate.',
    ha: 'Lokacin da amfaninka ya shirya, jera shi don masu siye su same shi.',
    tw: 'Sɛ wo nnɔbae ayɛ krado a, kyerɛ no na adetɔfoɔ ahunu.',
    hi: 'जब आपकी फसल तैयार हो, तो उसे सूचीबद्ध करें ताकि खरीदार उसे ढूँढ सकें।',
  },
  'sell.empty.cta': {
    en: 'List produce',
    fr: 'Lister un produit',
    sw: 'Orodhesha zao',
    ha: 'Jera amfani',
    tw: 'Kyerɛ nnɔbae',
    hi: 'उपज सूचीबद्ध करें',
  },

  // ─── Home page scan-row + task eyebrow + location button ──────
  // Screenshots showed these surfaces leaking English when the
  // active locale was French / Swahili.
  'home.scan': {
    en: 'Scan',
    fr: 'Scanner',
    sw: 'Changanua',
    ha: 'Sikan',
    tw: 'Scan',
    hi: 'स्कैन',
  },
  'home.checkHealth': {
    en: 'Check crop or plant health',
    fr: 'Vérifier la santé des cultures ou plantes',
    sw: 'Angalia afya ya zao au mmea',
    ha: 'Duba lafiyar amfani ko shuka',
    tw: 'Hwɛ afude anaa dua apɔwmuden',
    hi: 'फसल या पौधे का स्वास्थ्य देखें',
  },
  'home.todayTask.label': {
    en: "Today's task",
    fr: 'Tâche du jour',
    sw: 'Kazi ya leo',
    ha: 'Aikin yau',
    tw: 'Ɛnnɛ adwuma',
    hi: 'आज का कार्य',
  },
  'weather.useMyLocation': {
    en: 'Use my location',
    fr: 'Utiliser ma position',
    sw: 'Tumia mahali pangu',
    ha: 'Yi amfani da wurina',
    tw: 'Fa me bea no di dwuma',
    hi: 'मेरा स्थान उपयोग करें',
  },
  'hero.yourArea': {
    en: 'Your area',
    fr: 'Votre région',
    sw: 'Eneo lako',
    ha: 'Yankinku',
    tw: 'Wo mpɔtam',
    hi: 'आपका क्षेत्र',
  },
  'hero.defaultFarm': {
    en: 'Your farm',
    fr: 'Votre ferme',
    sw: 'Shamba lako',
    ha: 'Gonarka',
    tw: 'Wo afuo',
    hi: 'आपका खेत',
  },
  'hero.defaultGarden': {
    en: 'Your garden',
    fr: 'Votre jardin',
    sw: 'Bustani yako',
    ha: 'Lambunka',
    tw: 'Wo turo',
    hi: 'आपका बगीचा',
  },

  // ─── contextEngine.js + weatherTaskEngine.js task outputs ────
  // These were emitted as bare English strings by the intelligence
  // engines. They now ship `titleKey` / `reasonKey` alongside the
  // English fallback so the Home.jsx task card localizes properly.
  // Branches not yet migrated keep the legacy bare-string shape;
  // Home.jsx degrades to the literal when no key is present.
  'contextEngine.fallback.title': {
    en: 'Walk your field and check crop health',
    fr: 'Parcourez votre champ et vérifiez la santé des cultures',
    sw: 'Tembea kwenye shamba lako na uangalie afya ya mazao',
    ha: 'Yi yawo a gonarka ka duba lafiyar amfani',
    tw: 'Nantew wo afuo no mu na hwɛ afude apɔwmuden',
    hi: 'अपने खेत में टहलें और फसल का स्वास्थ्य जाँचें',
  },
  'contextEngine.fallback.title.crop': {
    en: 'Check soil moisture around your {crop}',
    fr: 'Vérifiez l’humidité du sol autour de votre {crop}',
    sw: 'Angalia unyevu wa udongo karibu na {crop} wako',
    ha: 'Duba danshin ƙasa kewaye da {crop} naka',
    tw: 'Hwɛ wo {crop} ho dɔteɛ no fɔwa',
    hi: 'अपनी {crop} के आस-पास मिट्टी की नमी जाँचें',
  },
  'contextEngine.fallback.reason': {
    en: 'Look for dry soil, weak leaves, pests, or unusual spots.',
    fr: 'Recherchez sol sec, feuilles faibles, parasites ou taches inhabituelles.',
    sw: 'Tafuta udongo mkavu, majani dhaifu, wadudu, au madoa yasiyo ya kawaida.',
    ha: 'Nemi busasshen ƙasa, raunanan ganye, kwari, ko alamu marasa kyau.',
    tw: 'Hwɛ asaase a awo, nhaban a ɛnyɛ den, mmoawa, anaa nsensanee a ɛnyɛ kwan.',
    hi: 'सूखी मिट्टी, कमज़ोर पत्तियाँ, कीट, या असामान्य धब्बे देखें।',
  },
  'home.weatherTask.fallback.title': {
    en: 'Walk your field and check crop health',
    fr: 'Parcourez votre champ et vérifiez la santé des cultures',
    sw: 'Tembea kwenye shamba lako na uangalie afya ya mazao',
    ha: 'Yi yawo a gonarka ka duba lafiyar amfani',
    tw: 'Nantew wo afuo no mu na hwɛ afude apɔwmuden',
    hi: 'अपने खेत में टहलें और फसल का स्वास्थ्य जाँचें',
  },
  'home.weatherTask.fallback.reason': {
    en: 'Water only if soil feels dry.',
    fr: 'N’arrosez que si le sol semble sec.',
    sw: 'Mwagilia maji tu kama udongo unaonekana mkavu.',
    ha: 'Bashe ruwa kawai idan ƙasa ta bushe.',
    tw: 'Gugu nsu nko ara sɛ asaase no awo.',
    hi: 'मिट्टी सूखी लगे तभी पानी दें।',
  },
  'home.weatherTask.rain.title': {
    en: 'Check drainage around your crop',
    fr: 'Vérifiez le drainage autour de votre culture',
    sw: 'Angalia mifereji ya maji karibu na zao lako',
    ha: 'Duba magudanar ruwa kewaye da amfaninka',
    tw: 'Hwɛ nsu kwan a ɛda wo afude no ho',
    hi: 'अपनी फसल के चारों ओर जल निकासी जाँचें',
  },
  'home.weatherTask.rain.reason': {
    en: 'Heavy rain expected. Ensure water doesn’t pool.',
    fr: 'Forte pluie prévue. Assurez-vous que l’eau ne s’accumule pas.',
    sw: 'Mvua kubwa inatarajiwa. Hakikisha maji hayajai.',
    ha: 'Ana sa ran ruwan sama mai yawa. Tabbatar ruwa baya tarawa.',
    tw: 'Nsutɔ kɛse reba. Hwɛ na nsuo nntɔtɔ.',
    hi: 'भारी वर्षा की संभावना है। पानी जमा न होने दें।',
  },
  'home.weatherTask.heat.title': {
    en: 'Water crops early morning or late evening',
    fr: 'Arrosez les cultures tôt le matin ou en fin de soirée',
    sw: 'Mwagilia mazao asubuhi mapema au jioni',
    ha: 'Bashe amfani da safe ko da maraice',
    tw: 'Gugu afude nsu anɔpa anaa anwummerɛ',
    hi: 'सुबह जल्दी या देर शाम फसलों को पानी दें',
  },
  'home.weatherTask.heat.reason': {
    en: 'High heat can stress plants during midday.',
    fr: 'Une forte chaleur peut stresser les plantes en milieu de journée.',
    sw: 'Joto kali linaweza kusumbua mimea wakati wa mchana.',
    ha: 'Zafi mai yawa zai iya damun shuke-shuke da rana.',
    tw: 'Ɔhyew kɛse betumi ha nnua awia.',
    hi: 'अधिक गर्मी दोपहर में पौधों पर तनाव डाल सकती है।',
  },
  'home.weatherTask.wind.title': {
    en: 'Support weak plants',
    fr: 'Soutenez les plantes fragiles',
    sw: 'Saidia mimea dhaifu',
    ha: 'Tallafa wa raunanan shuke-shuke',
    tw: 'Boa nnua a ɛnyɛ den',
    hi: 'कमज़ोर पौधों को सहारा दें',
  },
  'home.weatherTask.wind.reason': {
    en: 'Strong winds can damage crops.',
    fr: 'Des vents forts peuvent endommager les cultures.',
    sw: 'Upepo mkali unaweza kuharibu mazao.',
    ha: 'Iska mai ƙarfi zai iya lalata amfani.',
    tw: 'Mframa a ano yɛ den betumi asɛe afude.',
    hi: 'तेज़ हवाएँ फसलों को नुकसान पहुँचा सकती हैं।',
  },
  'home.weatherTask.dry.title': {
    en: 'Check soil moisture',
    fr: 'Vérifiez l’humidité du sol',
    sw: 'Angalia unyevu wa udongo',
    ha: 'Duba danshin ƙasa',
    tw: 'Hwɛ asaase no fɔwa',
    hi: 'मिट्टी की नमी जाँचें',
  },
  'home.weatherTask.dry.reason': {
    en: 'Dry conditions may require watering.',
    fr: 'Les conditions sèches peuvent nécessiter un arrosage.',
    sw: 'Hali kavu inaweza kuhitaji kumwagiliwa maji.',
    ha: 'Bushewar yanayi na iya buƙatar bashe ruwa.',
    tw: 'Tebea a awo no betumi ahia nsugu.',
    hi: 'सूखी स्थिति में सिंचाई की आवश्यकता हो सकती है।',
  },
  'home.weatherTask.inspect.title': {
    en: 'Inspect your crops',
    fr: 'Inspectez vos cultures',
    sw: 'Kagua mazao yako',
    ha: 'Bincika amfaninka',
    tw: 'Hwɛ wo afude',
    hi: 'अपनी फसलों का निरीक्षण करें',
  },
  'home.weatherTask.inspect.reason': {
    en: 'Regular checks help catch issues early.',
    fr: 'Des vérifications régulières aident à détecter les problèmes tôt.',
    sw: 'Ukaguzi wa mara kwa mara husaidia kupata matatizo mapema.',
    ha: 'Bincike akai-akai yana taimakawa wajen gano matsaloli da wuri.',
    tw: 'Hwɛyie a wɔyɛ no daa boa ma yehunu nsɛm ntɛm.',
    hi: 'नियमित जाँच से समस्याओं को जल्दी पकड़ने में मदद मिलती है।',
  },

  // ─── Phase 11 leaf-focus guidance chips ────────────────────
  // Rendered by src/components/scan/LeafFocusGuidance.jsx during
  // scan analysis. Self-suppressing — users only see them when
  // the engine has something to correct (move closer, dark
  // lighting, multiple leaves, etc.).
  'scan.focus.guidance.moveCloser': {
    en: 'Move closer to the leaf',
    fr: 'Rapprochez-vous de la feuille',
    sw: 'Sogea karibu na jani',
    ha: 'Matsa kusa da ganye',
    tw: 'Bɛn aba no',
    hi: 'पत्ते के पास जाएँ',
  },
  'scan.focus.guidance.leafNotCentered': {
    en: 'Center the leaf in the frame',
    fr: 'Centrez la feuille dans le cadre',
    sw: 'Weka jani katikati ya fremu',
    ha: 'Sa ganye a tsakiyar firam',
    tw: 'Fa aba no si fa-ɔha',
    hi: 'पत्ते को फ्रेम के बीच में रखें',
  },
  'scan.focus.guidance.multipleLeaves': {
    en: 'Multiple leaves detected — pick one',
    fr: 'Plusieurs feuilles détectées — choisissez-en une',
    sw: 'Majani mengi yameonekana — chagua moja',
    ha: 'An gano ganye da yawa — zaɓi ɗaya',
    tw: 'Yɛahunu nhaban pii — yi baako',
    hi: 'कई पत्ते मिले — एक चुनें',
  },
  'scan.focus.guidance.lightingDark': {
    en: 'Lighting is too dark — move into brighter light',
    fr: 'L’éclairage est trop sombre — déplacez-vous vers une lumière plus vive',
    sw: 'Mwanga ni hafifu — hama mahali penye mwanga zaidi',
    ha: 'Hasken yana da duhu — koma wuri mai haske',
    tw: 'Hann no asum dodo — kɔ baabi a hann wɔ',
    hi: 'रोशनी बहुत कम है — उजली जगह जाएँ',
  },
  'scan.focus.guidance.lightingBright': {
    en: 'Glare detected — angle the camera away from light',
    fr: 'Reflet détecté — orientez la caméra à l’écart de la lumière',
    sw: 'Mng’aro umeonekana — geuza kamera mbali na mwanga',
    ha: 'An gano hasken — juya kamara daga hasken',
    tw: 'Hann reka — dane camera fi hann no ho',
    hi: 'चमक का पता चला — कैमरा रोशनी से दूर मोड़ें',
  },
  'scan.focus.guidance.noLeafDetected': {
    en: 'No leaf detected — point camera at a leaf',
    fr: 'Aucune feuille détectée — pointez la caméra vers une feuille',
    sw: 'Hakuna jani lililoonekana — elekeza kamera kwenye jani',
    ha: 'Ba a gano ganye ba — nuna kamara zuwa ganye',
    tw: 'Wonhunuu aba biara — kyerɛ camera no aba ho',
    hi: 'कोई पत्ता नहीं मिला — कैमरा पत्ते की ओर रखें',
  },

  // ─── Phase 12 context diagnosis UX strings ─────────────────
  // Rendered by surfaces that consume contextDiagnosisEngine.
  // The engine emits stable keys + English fallbacks; surfaces
  // route through tSafe so the verdict localises.
  'scan.diagnosis.whatNoticed.header': {
    en: 'What Farroway noticed',
    fr: 'Ce que Farroway a remarqué',
    sw: 'Kile Farroway ilichoona',
    ha: 'Abin da Farroway ya lura',
    tw: 'Deɛ Farroway hunuiɛ',
    hi: 'फरोवे ने क्या देखा',
  },
  'scan.diagnosis.likelyIssue.header': {
    en: 'Most likely issue',
    fr: 'Problème le plus probable',
    sw: 'Tatizo linalowezekana zaidi',
    ha: 'Matsalar da ta fi yiwuwa',
    tw: 'Asɛm a ɛsɛsɛ no',
    hi: 'सबसे संभावित समस्या',
  },
  'scan.diagnosis.whyWeThinkThis.header': {
    en: 'Why we think this',
    fr: 'Pourquoi nous pensons cela',
    sw: 'Kwa nini tunafikiri hivyo',
    ha: 'Me yasa muke tunani haka',
    tw: 'Adɛn nti na yɛdwen saa',
    hi: 'हमें ऐसा क्यों लगता है',
  },
  'scan.diagnosis.whatToDoNow.header': {
    en: 'What to do now',
    fr: 'Que faire maintenant',
    sw: 'Cha kufanya sasa',
    ha: 'Abin da za a yi yanzu',
    tw: 'Deɛ ɛsɛsɛ wɔyɛ seesei',
    hi: 'अभी क्या करें',
  },
  'scan.diagnosis.prevention.header': {
    en: 'How to prevent this',
    fr: 'Comment prévenir cela',
    sw: 'Jinsi ya kuzuia hili',
    ha: 'Yadda za a hana wannan',
    tw: 'Sɛnea yɛbɛsiw ano',
    hi: 'इसे कैसे रोकें',
  },
  'scan.diagnosis.alternatives.header': {
    en: 'Other possibilities',
    fr: 'Autres possibilités',
    sw: 'Uwezekano mwingine',
    ha: 'Sauran yiwuwa',
    tw: 'Akwan foforɔ',
    hi: 'अन्य संभावनाएँ',
  },
  'scan.diagnosis.monitor.window': {
    en: 'Monitor again in {days} days',
    fr: 'Vérifiez à nouveau dans {days} jours',
    sw: 'Angalia tena baada ya siku {days}',
    ha: 'Bincika kuma a cikin kwanaki {days}',
    tw: 'Hwɛ bio wɔ nna {days} mu',
    hi: '{days} दिन में फिर से जाँचें',
  },
  'scan.diagnosis.severity.mild': {
    en: 'Mild',
    fr: 'Léger',
    sw: 'Wastani',
    ha: 'Mai sauƙi',
    tw: 'Ɛnyɛ den',
    hi: 'हल्का',
  },
  'scan.diagnosis.severity.moderate': {
    en: 'Moderate',
    fr: 'Modéré',
    sw: 'Wastani',
    ha: 'Matsakaici',
    tw: 'Mfinimfini',
    hi: 'मध्यम',
  },
  'scan.diagnosis.severity.serious': {
    en: 'Serious',
    fr: 'Sérieux',
    sw: 'Mbaya',
    ha: 'Mai tsanani',
    tw: 'Ɛyɛ den',
    hi: 'गंभीर',
  },
  'scan.outcome.prompt': {
    en: 'Was Farroway helpful? Confirm the outcome so future scans get smarter.',
    fr: 'Farroway a-t-il été utile ? Confirmez le résultat pour améliorer les futurs scans.',
    sw: 'Je, Farroway ilikuwa ya manufaa? Thibitisha matokeo ili uchanganuzi wa baadaye uboreshe.',
    ha: 'Farroway ya taimaka? Tabbatar da sakamakon don sikan na gaba ya zama mai hikima.',
    tw: 'Farroway boa wo? Si nea esiei so sɛ ɛrebɛboa scan a ɛreba.',
    hi: 'क्या फरोवे मददगार था? परिणाम की पुष्टि करें ताकि भविष्य के स्कैन बेहतर हों।',
  },
  'scan.outcome.resolved': {
    en: 'Problem resolved',
    fr: 'Problème résolu',
    sw: 'Tatizo limetatuliwa',
    ha: 'Matsalar an warware',
    tw: 'Asɛm no aba awieɛ',
    hi: 'समस्या हल हो गई',
  },
  'scan.outcome.improved': {
    en: 'Improving',
    fr: 'S’améliore',
    sw: 'Inaboreka',
    ha: 'Yana kyautata',
    tw: 'Ɛrekɔ so yiye',
    hi: 'सुधार हो रहा है',
  },
  'scan.outcome.no_change': {
    en: 'No change',
    fr: 'Aucun changement',
    sw: 'Hakuna mabadiliko',
    ha: 'Babu canji',
    tw: 'Nsesa biara',
    hi: 'कोई बदलाव नहीं',
  },
  'scan.outcome.worsened': {
    en: 'Got worse',
    fr: 'A empiré',
    sw: 'Imezidi kuwa mbaya',
    ha: 'Ya tabarbare',
    tw: 'Ɛkɔɔ bɔne so',
    hi: 'बिगड़ गया',
  },
  'scan.outcome.escalated': {
    en: 'Asked an agronomist',
    fr: 'A consulté un agronome',
    sw: 'Niliuliza mtaalamu',
    ha: 'Na tambayi masanin noma',
    tw: 'Mibisaa kuayɛni',
    hi: 'कृषि विशेषज्ञ से पूछा',
  },
  'scan.outcome.wrong_diagnosis': {
    en: 'Diagnosis was wrong',
    fr: 'Le diagnostic était faux',
    sw: 'Utambuzi ulikuwa wa makosa',
    ha: 'Binciken ya yi kuskure',
    tw: 'Yare a yɛkae no nyɛ nokorɛ',
    hi: 'निदान गलत था',
  },

  // ─── Phase 14 memory-driven guidance ──────────────────────
  // Emitted by farmMemorySnapshot.deriveMemoryGuidance + the
  // recommendation-learning surface. Hedged + calm — surfaces
  // weave these in subtly, never as a giant dashboard.
  'memory.recurring.issue': {
    en: 'You’ve scanned this same issue {count} times — let’s try a different approach.',
    fr: 'Vous avez scanné ce même problème {count} fois — essayons une approche différente.',
    sw: 'Umechanganua tatizo hili mara {count} — hebu tujaribu njia tofauti.',
    ha: 'Ka sikan wannan matsala sau {count} — bari mu gwada wani hanya.',
    tw: 'W’ascan saa asɛm yi mpɛn {count} — ma yɛn nsɔ kwan foforɔ nhwɛ.',
    hi: 'आपने यह समस्या {count} बार स्कैन की है — चलिए कोई अलग तरीका आज़माएँ।',
  },
  'memory.trend.worsening': {
    en: 'Recent scans suggest this is getting worse — act sooner rather than later.',
    fr: 'Les scans récents suggèrent que cela empire — agissez plus tôt que tard.',
    sw: 'Uchanganuzi wa hivi karibuni unaonyesha hili linazidi kuwa baya — chukua hatua mapema.',
    ha: 'Sikan na baya-bayan nan suna nuna wannan yana ƙara tabarbare — yi aiki da wuri.',
    tw: 'Scan a yɛyɛɛ nnansa yi kyerɛ sɛ ɛrekɔ bɔne so — yɛ biribi ntɛm.',
    hi: 'हाल के स्कैन बताते हैं कि यह बिगड़ रहा है — जल्द ही कार्रवाई करें।',
  },
  'memory.wins.recent': {
    en: 'Your care has resolved {count} issues recently. Keep the routine going.',
    fr: 'Vos soins ont résolu {count} problèmes récemment. Continuez la routine.',
    sw: 'Utunzaji wako umesuluhisha matatizo {count} hivi karibuni. Endeleza ratiba hiyo.',
    ha: 'Kulawarka ta warware matsaloli {count} kwanan nan. Ci gaba da aikin.',
    tw: 'Wo dwumadi awie nsɛm {count} nnansa yi. Toa adwuma no so.',
    hi: 'आपकी देखभाल से हाल ही में {count} समस्याएँ हल हुई हैं। यह दिनचर्या जारी रखें।',
  },
  'memory.lastScan.longGap': {
    en: 'It has been {days} days since your last scan. A quick check helps catch issues early.',
    fr: 'Cela fait {days} jours depuis votre dernier scan. Une vérification rapide aide à détecter tôt.',
    sw: 'Imepita siku {days} tangu uchanganuzi wako wa mwisho. Ukaguzi wa haraka husaidia kupata matatizo mapema.',
    ha: 'An shafe kwanaki {days} tun bayan sikan ɗinka na ƙarshe. Bincike na sauri yana taimakawa wajen gano matsaloli da wuri.',
    tw: 'Nna {days} atwam fi wo scan a etwa toɔ akyi. Hwɛyie ntɛm boa ma yehunu nsɛm ntɛm.',
    hi: 'आपके अंतिम स्कैन को {days} दिन हो गए हैं। त्वरित जाँच जल्दी समस्याओं को पकड़ने में मदद करती है।',
  },
  'memory.seasonal.pattern': {
    en: 'This issue tends to show up around this time of year on your farm.',
    fr: 'Ce problème a tendance à apparaître à cette période de l’année sur votre ferme.',
    sw: 'Tatizo hili huwa linatokea wakati huu wa mwaka kwenye shamba lako.',
    ha: 'Wannan matsala tana saba bayyana a wannan lokacin shekara a gonarka.',
    tw: 'Saa asɛm yi taa pue bere a ɛtenase mu yi mu wɔ wo afuo so.',
    hi: 'यह समस्या आपके खेत पर साल के इस समय के आसपास होती रहती है।',
  },
  'recommendation.learning.usuallyHelpful': {
    en: 'This usually works for you',
    fr: 'Cela fonctionne généralement pour vous',
    sw: 'Hii kwa kawaida hukufanyia kazi',
    ha: 'Wannan yawanci yana aiki a gareka',
    tw: 'Eyi taa boa wo',
    hi: 'यह आमतौर पर आपके लिए काम करता है',
  },
  'recommendation.learning.oftenIgnored': {
    en: 'You usually skip this — keep what works',
    fr: 'Vous ignorez généralement cela — gardez ce qui fonctionne',
    sw: 'Kwa kawaida unaruka hii — endelea na kinachofanya kazi',
    ha: 'Yawanci kana watsi da wannan — riƙe abin da ke aiki',
    tw: 'Wotaa di eyi akyi — kɔ so yɛ deɛ ɛyɛ adwuma',
    hi: 'आप आमतौर पर इसे छोड़ते हैं — जो काम करता है उसे जारी रखें',
  },
  'ngo.analytics.effectiveness.header': {
    en: 'Intervention effectiveness',
    fr: 'Efficacité des interventions',
    sw: 'Ufanisi wa hatua',
    ha: 'Tasirin shiga tsakani',
    tw: 'Adwumayɛ a ɛboa',
    hi: 'हस्तक्षेप की प्रभावशीलता',
  },
  'ngo.analytics.engagement.header': {
    en: 'Farmer engagement',
    fr: 'Engagement des agriculteurs',
    sw: 'Ushiriki wa mkulima',
    ha: 'Shigar manomi',
    tw: 'Okuafoɔ a ɔde ne ho ahyɛ mu',
    hi: 'किसान सहभागिता',
  },
  'ngo.analytics.regionalStress.header': {
    en: 'Regional crop stress',
    fr: 'Stress des cultures par région',
    sw: 'Mfadhaiko wa zao wa kikanda',
    ha: 'Damuwar amfani na yanki',
    tw: 'Mantam mu afude haw',
    hi: 'क्षेत्रीय फसल तनाव',
  },

  // ─── Decision Priority Engine v1 ─────────────────────────
  // The engine emits `{key, fallback, params}` envelopes; the
  // surface routes through tSafe. Only the most commonly-rendered
  // shared phrases live in this overlay — branch-specific copy
  // (e.g. decision.action.cropSurvival.frost) ships its English
  // fallback via the engine itself + can be localised in a future
  // overlay extension without changing the engine.
  'decision.bestTime.today': {
    en: 'Today',
    fr: 'Aujourd’hui',
    sw: 'Leo',
    ha: 'Yau',
    tw: 'Ɛnnɛ',
    hi: 'आज',
  },
  'decision.bestTime.morning': {
    en: 'This morning',
    fr: 'Ce matin',
    sw: 'Asubuhi hii',
    ha: 'Wannan safiya',
    tw: 'Anɔpa yi',
    hi: 'आज सुबह',
  },
  'decision.bestTime.evening': {
    en: 'This evening',
    fr: 'Ce soir',
    sw: 'Jioni hii',
    ha: 'Wannan yamma',
    tw: 'Anwummerɛ yi',
    hi: 'आज शाम',
  },
  'decision.bestTime.coolerHours': {
    en: 'Cooler hours',
    fr: 'Heures plus fraîches',
    sw: 'Saa za baridi',
    ha: 'Sa’o’i masu sanyi',
    tw: 'Mmere a awɔ',
    hi: 'ठंडे घंटे',
  },
  'decision.bestTime.beforeRain': {
    en: 'Before the rain starts',
    fr: 'Avant le début de la pluie',
    sw: 'Kabla ya mvua kuanza',
    ha: 'Kafin ruwan sama ya fara',
    tw: 'Ansa na nsuo bɛtɔ',
    hi: 'बारिश शुरू होने से पहले',
  },
  'decision.bestTime.beforeWind': {
    en: 'Before the wind picks up',
    fr: 'Avant que le vent ne se lève',
    sw: 'Kabla ya upepo kuongezeka',
    ha: 'Kafin iska ta tashi',
    tw: 'Ansa na mframa atu',
    hi: 'हवा तेज़ होने से पहले',
  },
  'decision.urgency.high': {
    en: 'High',
    fr: 'Élevée',
    sw: 'Juu',
    ha: 'Mai girma',
    tw: 'Ɛyɛ den',
    hi: 'उच्च',
  },
  'decision.urgency.medium': {
    en: 'Medium',
    fr: 'Moyenne',
    sw: 'Wastani',
    ha: 'Matsakaici',
    tw: 'Mfinimfini',
    hi: 'मध्यम',
  },
  'decision.urgency.low': {
    en: 'Low',
    fr: 'Faible',
    sw: 'Chini',
    ha: 'Ƙarami',
    tw: 'Ɛnyɛ den',
    hi: 'कम',
  },
  'decision.suppressed.rankedLower': {
    en: 'A higher-priority action is showing first.',
    fr: 'Une action plus prioritaire est affichée en premier.',
    sw: 'Hatua ya kipaumbele zaidi inaonyeshwa kwanza.',
    ha: 'Wani aiki mai fifiko ya fi gabatarwa.',
    tw: 'Adwuma a ɛho hia kɛse na ɛda adi kan.',
    hi: 'पहले उच्च-प्राथमिकता वाली कार्रवाई दिखाई जा रही है।',
  },
  'decision.suppressed.headerCount': {
    en: '{count} other suggestions',
    fr: '{count} autres suggestions',
    sw: 'Mapendekezo mengine {count}',
    ha: 'Wasu shawarwari {count}',
    tw: 'Afotuo afoforɔ {count}',
    hi: '{count} अन्य सुझाव',
  },
  'decision.reason.calm': {
    en: 'No urgent signals today.',
    fr: 'Aucun signal urgent aujourd’hui.',
    sw: 'Hakuna ishara ya dharura leo.',
    ha: 'Babu alamun gaggawa yau.',
    tw: 'Nsɛnkyerɛnneɛ a ɛho hia biara nni hɔ ɛnnɛ.',
    hi: 'आज कोई जरूरी संकेत नहीं।',
  },
  'decision.action.calm': {
    en: 'Walk your field and check crop health.',
    fr: 'Parcourez votre champ et vérifiez la santé des cultures.',
    sw: 'Tembea kwenye shamba lako na uangalie afya ya mazao.',
    ha: 'Yi yawo a gonarka ka duba lafiyar amfani.',
    tw: 'Nantew wo afuo no mu na hwɛ afude apɔwmuden.',
    hi: 'अपने खेत में टहलें और फसल का स्वास्थ्य जाँचें।',
  },
});

const _module = { PRODUCTION_GAP_TRANSLATIONS };
export default _module;
