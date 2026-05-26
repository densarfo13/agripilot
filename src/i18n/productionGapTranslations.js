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
});

const _module = { PRODUCTION_GAP_TRANSLATIONS };
export default _module;
