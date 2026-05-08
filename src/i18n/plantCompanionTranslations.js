/**
 * plantCompanionTranslations.js — Garden Mode emotional companion overlay.
 *
 * Covers every key emitted by the new plant store + timeline store +
 * reassurance engine:
 *   • Plant timeline milestone messages (added / scan / task / stage / etc.)
 *   • Reassurance lines (yellowing / pest / wilting / healthy)
 *   • Recovery moments
 *   • Delight moments (streak / first scan / flowering / fruiting / harvest)
 *   • Beginner guidance
 *
 * Coverage: en, fr, sw, ha, tw, hi (all six locales registered in
 * SUPPORTED_LANGUAGES).
 *
 * Shape: `{ key: { locale: value } }`. Merged via the empty-slot
 * fill in src/i18n/index.js — translator-authored values in T
 * always win.
 */

export const PLANT_COMPANION_TRANSLATIONS = Object.freeze({
  // ── Timeline milestones (i18n keys emitted by timelineStore) ────
  'plant.timeline.added': {
    en: 'Added {nickname}',
    fr: 'Ajouté {nickname}',
    sw: 'Imeongezwa {nickname}',
    ha: 'An ƙara {nickname}',
    tw: 'Wode {nickname} aka ho',
    hi: '{nickname} जोड़ा गया',
  },
  'plant.timeline.scanSaved': {
    en: 'Scan saved',
    fr: 'Scan enregistré',
    sw: 'Skana imehifadhiwa',
    ha: 'An adana sikan',
    tw: 'Wɔakora scan no',
    hi: 'स्कैन सहेजा गया',
  },
  'plant.timeline.taskCompleted': {
    en: 'Care task completed',
    fr: 'Tâche de soin complétée',
    sw: 'Kazi ya utunzaji imekamilika',
    ha: 'An kammala aikin kulawa',
    tw: 'Wɔawie ɔhwɛ adwuma',
    hi: 'देखभाल कार्य पूरा हुआ',
  },
  'plant.timeline.stageAdvanced': {
    en: 'New growth stage',
    fr: 'Nouvelle étape de croissance',
    sw: 'Hatua mpya ya ukuaji',
    ha: 'Sabuwar matakin girma',
    tw: 'Nyini bere foforɔ',
    hi: 'नई वृद्धि अवस्था',
  },
  'plant.timeline.issueNoticed': {
    en: 'Issue noticed in scan',
    fr: 'Problème détecté dans le scan',
    sw: 'Tatizo limegunduliwa katika skana',
    ha: 'An lura da matsala a sikan',
    tw: 'Yɛahunu asɛm wɔ scan no mu',
    hi: 'स्कैन में समस्या देखी गई',
  },
  'plant.timeline.recoveryNote': {
    en: 'Care follow-up recorded',
    fr: 'Suivi de soin enregistré',
    sw: 'Ufuatiliaji wa utunzaji umerekodiwa',
    ha: 'An rubuta bibiyar kulawa',
    tw: 'Yɛakora ɔhwɛ ho asɛm',
    hi: 'देखभाल अनुवर्ती दर्ज की गई',
  },
  'plant.timeline.harvestPicked': {
    en: 'Harvest picked',
    fr: 'Récolte effectuée',
    sw: 'Mavuno yamekusanywa',
    ha: 'An gama girbi',
    tw: 'Wɔatwa nnɔbae no',
    hi: 'फसल काटी गई',
  },
  'plant.timeline.flowerNote': {
    en: 'Flowering started',
    fr: 'Floraison commencée',
    sw: 'Maua yameanza',
    ha: 'Furannin sun fara',
    tw: 'Nhwiren afi ase',
    hi: 'फूल आना शुरू हुआ',
  },
  'plant.timeline.fruitNote': {
    en: 'Fruiting started',
    fr: 'Fructification commencée',
    sw: 'Matunda yameanza kuonekana',
    ha: 'Yan itacen sun fara fitowa',
    tw: 'Aba afi ase',
    hi: 'फल आना शुरू हुआ',
  },
  'plant.timeline.generic': {
    en: 'Care moment',
    fr: 'Moment de soin',
    sw: 'Wakati wa utunzaji',
    ha: 'Lokacin kulawa',
    tw: 'Ɔhwɛ bere',
    hi: 'देखभाल का क्षण',
  },

  // ── Reassurance (calm support — spec §4) ──────────────────
  'plant.reassurance.yellowing': {
    en: 'Small yellow leaves can happen during growth. A quick check helps.',
    fr: 'De petites feuilles jaunes peuvent apparaître pendant la croissance. Un contrôle rapide aide.',
    sw: 'Majani madogo ya manjano yanaweza kutokea wakati wa ukuaji. Ukaguzi wa haraka husaidia.',
    ha: 'Ƙananan ganyaye masu rawaya na iya bayyana lokacin girma. Bincike na sauri yana taimakawa.',
    tw: 'Aba akokɔsradeɛ kakra tumi ba bere a afifideɛ no renyini. Hwɛ no ntɛm a ɛboa.',
    hi: 'विकास के दौरान छोटी पीली पत्तियाँ हो सकती हैं। एक त्वरित जाँच मदद करती है।',
  },
  'plant.reassurance.pest': {
    en: 'You\'re doing okay. Check under leaves and remove damaged ones.',
    fr: 'Vous vous en sortez bien. Vérifiez sous les feuilles et retirez celles endommagées.',
    sw: 'Unaendelea vizuri. Kagua chini ya majani na uondoe yaliyoharibika.',
    ha: 'Kana yin daidai. Duba ƙarƙashin ganyaye kuma cire waɗanda suka lalace.',
    tw: 'Woreyɛ no yiye. Hwɛ aba no ase na yi nea asɛe no fi mu.',
    hi: 'आप ठीक कर रहे हैं। पत्तियों के नीचे जाँचें और क्षतिग्रस्त हटाएँ।',
  },
  'plant.reassurance.wilting': {
    en: 'Plants can recover with steady care. Check soil moisture first.',
    fr: 'Les plantes peuvent se rétablir avec des soins constants. Vérifiez d\'abord l\'humidité du sol.',
    sw: 'Mimea inaweza kupona kwa utunzaji thabiti. Kagua unyevu wa udongo kwanza.',
    ha: 'Tsire-tsire na iya warkewa da kulawa akai-akai. Da farko duba damshin ƙasa.',
    tw: 'Afifideɛ tumi nya ahoɔden bio sɛ wɔhwɛ no daa. Di kan hwɛ asase mu nsuo.',
    hi: 'स्थिर देखभाल से पौधे ठीक हो सकते हैं। पहले मिट्टी की नमी जाँचें।',
  },
  'plant.reassurance.healthy': {
    en: 'Your plant looks healthy. Your care is paying off.',
    fr: 'Votre plante semble en bonne santé. Vos soins portent leurs fruits.',
    sw: 'Mmea wako unaonekana mzima. Utunzaji wako unalipa.',
    ha: 'Tsiron ka yana da lafiya. Kulawar ka tana ba da sakamako.',
    tw: 'Wʼafifideɛ no apɔw. Wʼɔhwɛ rebrɛ aba.',
    hi: 'आपका पौधा स्वस्थ दिखता है। आपकी देखभाल काम कर रही है।',
  },
  'plant.reassurance.gentle': {
    en: 'A quick check today can help prevent bigger issues.',
    fr: 'Un contrôle rapide aujourd\'hui peut aider à prévenir de plus grands problèmes.',
    sw: 'Ukaguzi wa haraka leo unaweza kusaidia kuzuia matatizo makubwa.',
    ha: 'Bincike na sauri yau zai iya taimakawa wajen hana manyan matsaloli.',
    tw: 'Sɛ wohwɛ no ntɛm ɛnnɛ a, ɛboa ma asɛm kɛse antumi amma.',
    hi: 'आज एक त्वरित जाँच बड़ी समस्याओं को रोकने में मदद कर सकती है।',
  },

  // ── Recovery (after follow-up to flagged scan — spec §7) ──
  'plant.recovery.steadyCare': {
    en: 'Nice care. Keep monitoring for changes.',
    fr: 'Beaux soins. Continuez à surveiller les changements.',
    sw: 'Utunzaji mzuri. Endelea kufuatilia mabadiliko.',
    ha: 'Kulawa mai kyau. Ci gaba da lura da canje-canje.',
    tw: 'Wʼɔhwɛ ye. Kɔ so hwɛ nsakraeɛ.',
    hi: 'अच्छी देखभाल। बदलावों पर नज़र रखते रहें।',
  },

  // ── Delight (subtle positive moments — spec §8) ───────────
  'plant.delight.flowering': {
    en: '🌼 Flowering started — keep moisture steady.',
    fr: '🌼 Floraison commencée — gardez l\'humidité stable.',
    sw: '🌼 Maua yameanza — endelea na unyevu thabiti.',
    ha: '🌼 Furannin sun fara — ka ci gaba da damshi akai-akai.',
    tw: '🌼 Nhwiren afi ase — ma nsuo nko so daa.',
    hi: '🌼 फूल आना शुरू — स्थिर नमी रखें।',
  },
  'plant.delight.fruiting': {
    en: '🍅 Fruiting stage is exciting. Check daily.',
    fr: '🍅 La fructification est passionnante. Vérifiez chaque jour.',
    sw: '🍅 Hatua ya matunda inafurahisha. Kagua kila siku.',
    ha: '🍅 Matakin yan itace yana da daɗi. Duba kowace rana.',
    tw: '🍅 Aba bere yɛ anigye. Hwɛ no daa.',
    hi: '🍅 फलने की अवस्था रोमांचक है। रोज़ जाँचें।',
  },
  'plant.delight.readyToPick': {
    en: '🌿 Ready to pick. Harvest when colour and size look right.',
    fr: '🌿 Prêt à cueillir. Récoltez quand la couleur et la taille semblent bonnes.',
    sw: '🌿 Tayari kuvuna. Vuna wakati rangi na ukubwa unaonekana sahihi.',
    ha: '🌿 Shirye don ɗauka. Girbi lokacin da launi da girma suka yi daidai.',
    tw: '🌿 Ɛyɛ a wobɛtwa. Twa bere a ahosu ne kɛse no yɛ pɛ.',
    hi: '🌿 तोड़ने के लिए तैयार। रंग और आकार सही दिखे तो काटें।',
  },
  'plant.delight.newStage': {
    en: '🌿 New stage unlocked. Your plant is making progress.',
    fr: '🌿 Nouvelle étape débloquée. Votre plante progresse.',
    sw: '🌿 Hatua mpya imefunguliwa. Mmea wako unaendelea.',
    ha: '🌿 Sabuwar matakin ya buɗe. Tsiron ka yana ci gaba.',
    tw: '🌿 Bere foforɔ abue. Wʼafifideɛ rekɔ so.',
    hi: '🌿 नई अवस्था अनलॉक। आपका पौधा प्रगति कर रहा है।',
  },
  'plant.delight.streak3': {
    en: '🌿 You\'ve cared for this plant 3 times this week.',
    fr: '🌿 Vous avez soigné cette plante 3 fois cette semaine.',
    sw: '🌿 Umeitunza mmea huu mara 3 wiki hii.',
    ha: '🌿 Ka kula da wannan tsiron sau 3 wannan makon.',
    tw: '🌿 Woahwɛ saa afifideɛ yi mprɛnsa nnawɔtwe yi.',
    hi: '🌿 आपने इस सप्ताह इस पौधे की 3 बार देखभाल की है।',
  },
  'plant.delight.streak7': {
    en: '🌿 7-day care streak — your plant feels the consistency.',
    fr: '🌿 Série de soins de 7 jours — votre plante ressent la constance.',
    sw: '🌿 Mwendelezo wa siku 7 — mmea wako unahisi uthabiti.',
    ha: '🌿 Jerin kulawa kwanaki 7 — tsiron ka yana jin daidaito.',
    tw: '🌿 Nna 7 ɔhwɛ — wʼafifideɛ te no.',
    hi: '🌿 7-दिन देखभाल श्रृंखला — आपका पौधा निरंतरता महसूस करता है।',
  },
  'plant.delight.firstScan': {
    en: '📸 First scan saved — we\'ll keep watching alongside you.',
    fr: '📸 Premier scan enregistré — nous continuerons à observer avec vous.',
    sw: '📸 Skana ya kwanza imehifadhiwa — tutaendelea kuangalia pamoja nawe.',
    ha: '📸 An adana sikan na farko — za mu ci gaba da lura tare da kai.',
    tw: '📸 Yɛakora scan a ɛdi kan no — yɛbɛkɔ so ahwɛ ka wo ho.',
    hi: '📸 पहला स्कैन सहेजा गया — हम आपके साथ नज़र रखते रहेंगे।',
  },
  'plant.delight.firstFlower': {
    en: '🌼 First flower noted. Avoid water swings during flowering.',
    fr: '🌼 Première fleur notée. Évitez les variations d\'arrosage pendant la floraison.',
    sw: '🌼 Ua la kwanza limeandikwa. Epuka mabadiliko ya kumwagilia wakati wa maua.',
    ha: '🌼 An lura furen farko. Kauce wa canjin shayarwa lokacin furannin.',
    tw: '🌼 Yɛahyɛ nhwiren a ɛdi kan no nso. Mma nsuo gugu mu nsesa wɔ nhwiren bere mu.',
    hi: '🌼 पहला फूल नोट किया। फूल आने के दौरान पानी में उतार-चढ़ाव न करें।',
  },
  'plant.delight.firstFruit': {
    en: '🍅 First fruit on the way. Steady moisture helps it grow.',
    fr: '🍅 Premier fruit en route. Une humidité constante aide à sa croissance.',
    sw: '🍅 Tunda la kwanza linakuja. Unyevu thabiti husaidia kukua.',
    ha: '🍅 Yan itacen farko na zuwa. Damshi akai-akai yana taimakawa girma.',
    tw: '🍅 Aba a ɛdi kan reba. Nsuo a ɛyɛ daa boa ma ɛrenyini.',
    hi: '🍅 पहला फल आ रहा है। स्थिर नमी इसे बढ़ने में मदद करती है।',
  },

  // ── Beginner guidance (spec §10) ──────────────────────────
  'plant.beginner.welcome': {
    en: 'Add your first plant to get simple daily care guidance.',
    fr: 'Ajoutez votre première plante pour recevoir des conseils de soins quotidiens.',
    sw: 'Ongeza mmea wako wa kwanza ili upate mwongozo rahisi wa utunzaji.',
    ha: 'Ƙara tsiron ka na farko don samun jagoran kulawa mai sauƙi.',
    tw: 'Fa wo afifideɛ a ɛdi kan ka ho na woanya ɔhwɛ akwankyerɛ.',
    hi: 'सरल दैनिक देखभाल पाने के लिए अपना पहला पौधा जोड़ें।',
  },
  'plant.beginner.checkSoil': {
    en: 'Put your finger into the soil. If it feels dry, water gently.',
    fr: 'Mettez votre doigt dans la terre. Si elle est sèche, arrosez doucement.',
    sw: 'Weka kidole chako kwenye udongo. Ikiwa ni mkavu, mwagilia kwa upole.',
    ha: 'Sa yatsa cikin ƙasa. Idan ta ji bushe, ka shayar a hankali.',
    tw: 'Fa wo nsa to asase mu. Sɛ awo a, gugu nsuo brɛoo.',
    hi: 'अपनी उंगली मिट्टी में डालें। सूखी लगे तो धीरे से पानी दें।',
  },
  'plant.beginner.lookUnderLeaves': {
    en: 'Look under the leaves for tiny insects.',
    fr: 'Regardez sous les feuilles pour de petits insectes.',
    sw: 'Angalia chini ya majani kwa wadudu wadogo.',
    ha: 'Duba ƙarƙashin ganyaye don ƙananan kwari.',
    tw: 'Hwɛ aba no ase hwɛ mmoawa nkete.',
    hi: 'पत्तियों के नीचे छोटे कीटों को देखें।',
  },
  'plant.beginner.clearerPhoto': {
    en: 'Take a clearer photo in natural light.',
    fr: 'Prenez une photo plus claire à la lumière naturelle.',
    sw: 'Piga picha wazi katika mwanga wa asili.',
    ha: 'Ɗauki hoton da ya fi haske a hasken halitta.',
    tw: 'Twa mfoni a ɛda hɔ pefee wɔ owia hann mu.',
    hi: 'प्राकृतिक रोशनी में स्पष्ट फ़ोटो लें।',
  },

  // ── PlantEditModal — title + field labels ──────────────────────
  'plant.modal.title': {
    en: 'Edit your plant',
    fr: 'Modifier votre plante',
    sw: 'Hariri mmea wako',
    ha: 'Gyara tsironka',
    tw: 'Sesa wʼafifideɛ',
    hi: 'अपना पौधा संपादित करें',
  },
  'plant.modal.openCta': {
    en: 'Edit plant',
    fr: 'Modifier la plante',
    sw: 'Hariri mmea',
    ha: 'Gyara tsiro',
    tw: 'Sesa afifideɛ',
    hi: 'पौधा संपादित करें',
  },
  'plant.modal.openCta.first': {
    en: 'Add your plant',
    fr: 'Ajouter votre plante',
    sw: 'Ongeza mmea wako',
    ha: 'Ƙara tsironka',
    tw: 'Fa wʼafifideɛ ka ho',
    hi: 'अपना पौधा जोड़ें',
  },

  'plant.field.nickname': {
    en: 'Nickname',           fr: 'Surnom',
    sw: 'Jina la utani',      ha: 'Lakabi',
    tw: 'Din',                hi: 'उपनाम',
  },
  'plant.field.nickname.placeholder': {
    en: 'Balcony Tomato',
    fr: 'Tomate du balcon',
    sw: 'Nyanya ya Balcony',
    ha: 'Tumatir na Balcony',
    tw: 'Balcony Ntɔmate',
    hi: 'बालकनी टमाटर',
  },
  'plant.field.type': {
    en: 'Plant type',         fr: 'Type de plante',
    sw: 'Aina ya mmea',       ha: 'Nau\'in tsiro',
    tw: 'Afifideɛ suban',     hi: 'पौधे का प्रकार',
  },
  'plant.field.indoor': {
    en: 'Indoor or outdoor',
    fr: 'Intérieur ou extérieur',
    sw: 'Ndani au nje',
    ha: 'Ciki ko waje',
    tw: 'Fie mu anaa abɔnten',
    hi: 'अंदर या बाहर',
  },
  'plant.field.containerType': {
    en: 'Container',          fr: 'Récipient',
    sw: 'Chombo',             ha: 'Akwati',
    tw: 'Adaka',              hi: 'पात्र',
  },
  'plant.field.containerSize': {
    en: 'Container size',     fr: 'Taille du récipient',
    sw: 'Ukubwa wa chombo',   ha: 'Girman akwati',
    tw: 'Adaka kɛseɛ',        hi: 'पात्र का आकार',
  },
  'plant.field.stage': {
    en: 'Growth stage',       fr: 'Étape de croissance',
    sw: 'Hatua ya ukuaji',    ha: 'Matakin girma',
    tw: 'Nyini bere',         hi: 'विकास अवस्था',
  },

  // ── Indoor/outdoor options ─────────────────────────────────────
  'plant.indoor.indoor':  { en: 'Indoor',  fr: 'Intérieur', sw: 'Ndani', ha: 'Ciki', tw: 'Fie mu',    hi: 'अंदर' },
  'plant.indoor.outdoor': { en: 'Outdoor', fr: 'Extérieur', sw: 'Nje',   ha: 'Waje', tw: 'Abɔnten',   hi: 'बाहर' },

  // ── Container types ────────────────────────────────────────────
  'plant.container.pot': {
    en: 'Pot',                fr: 'Pot',
    sw: 'Chungu',             ha: 'Tukunya',
    tw: 'Kuruwa',             hi: 'गमला',
  },
  'plant.container.raisedBed': {
    en: 'Raised bed',         fr: 'Bac surélevé',
    sw: 'Kitanda kilichoinuliwa', ha: 'Gadon da aka ɗaga',
    tw: 'Mpa a ɛkorɔn',       hi: 'ऊँची क्यारी',
  },
  'plant.container.balcony': {
    en: 'Balcony planter',    fr: 'Jardinière de balcon',
    sw: 'Sufuria ya baraza',  ha: 'Akwatin baranda',
    tw: 'Balcony adaka',      hi: 'बालकनी प्लांटर',
  },
  'plant.container.window': {
    en: 'Window box',         fr: 'Jardinière de fenêtre',
    sw: 'Sanduku la dirisha', ha: 'Akwatin taga',
    tw: 'Mfɛnsere adaka',     hi: 'खिड़की बॉक्स',
  },
  'plant.container.ground': {
    en: 'Ground',             fr: 'Pleine terre',
    sw: 'Ardhi',              ha: 'Ƙasa',
    tw: 'Asase mu',           hi: 'ज़मीन',
  },

  // ── Container sizes ────────────────────────────────────────────
  'plant.size.small':  { en: 'Small',  fr: 'Petit',  sw: 'Ndogo',     ha: 'Karami',    tw: 'Ketewa',     hi: 'छोटा' },
  'plant.size.medium': { en: 'Medium', fr: 'Moyen',  sw: 'Wastani',   ha: 'Matsakaici',tw: 'Mfinimfini', hi: 'मध्यम' },
  'plant.size.large':  { en: 'Large',  fr: 'Grand',  sw: 'Kubwa',     ha: 'Babba',     tw: 'Kɛseɛ',      hi: 'बड़ा' },

  // ── Growth stages ──────────────────────────────────────────────
  'plant.stage.seedling':    { en: 'Seedling',     fr: 'Semis',         sw: 'Mche mchanga', ha: 'Tsire-tsire',  tw: 'Aba a afi ase',  hi: 'अंकुर' },
  'plant.stage.growing':     { en: 'Growing',      fr: 'En croissance', sw: 'Inakua',       ha: 'Yana girma',   tw: 'Renyini',        hi: 'बढ़ रहा' },
  'plant.stage.flowering':   { en: 'Flowering',    fr: 'En floraison',  sw: 'Inachanua',    ha: 'Yana fure',    tw: 'Nhwiren',        hi: 'फूल आ रहे' },
  'plant.stage.fruiting':    { en: 'Fruiting',     fr: 'En fructification', sw: 'Inazaa',   ha: 'Yana yan itace', tw: 'Aba',          hi: 'फल आ रहे' },
  'plant.stage.readyToPick': { en: 'Ready to pick',fr: 'Prêt à cueillir', sw: 'Tayari kuvuna', ha: 'Shirye don ɗauka', tw: 'Wobɛtwa', hi: 'तोड़ने के लिए तैयार' },
  'plant.stage.resting':     { en: 'Resting',      fr: 'Au repos',      sw: 'Inapumzika',   ha: 'Yana hutawa',  tw: 'Ɛrehome',        hi: 'विश्राम' },

  // ── Common buttons used by the modal ───────────────────────────
  'common.save':        { en: 'Save',        fr: 'Enregistrer', sw: 'Hifadhi',   ha: 'Adana',     tw: 'Kora',          hi: 'सहेजें' },
  'common.cancel':      { en: 'Cancel',      fr: 'Annuler',     sw: 'Ghairi',    ha: 'Soke',      tw: 'Twa kyene',     hi: 'रद्द करें' },
  'common.close':       { en: 'Close',       fr: 'Fermer',      sw: 'Funga',     ha: 'Rufe',      tw: 'To mu',         hi: 'बंद करें' },
  'common.unspecified': { en: '— select —',  fr: '— choisir —', sw: '— chagua —',ha: '— zaɓa —',  tw: '— yi paw —',    hi: '— चुनें —' },

  // ── My Grow page section labels ────────────────────────────────
  'plant.section.recent': {
    en: 'Recent care moments',
    fr: 'Récents moments de soin',
    sw: 'Wakati wa hivi karibuni wa utunzaji',
    ha: 'Lokutan kulawa na kwanan nan',
    tw: 'Ɔhwɛ bere a etwaam',
    hi: 'हाल के देखभाल पल',
  },
  'plant.section.empty': {
    en: 'Care moments will appear here as you tend to your plant.',
    fr: 'Les moments de soin apparaîtront ici à mesure que vous prenez soin de votre plante.',
    sw: 'Wakati wa utunzaji utaonekana hapa unapokitunza mmea wako.',
    ha: 'Lokutan kulawa za su bayyana a nan yayin da kake kula da tsironka.',
    tw: 'Ɔhwɛ bere bɛda adi wɔ ha bere a wohwɛ wʼafifideɛ no.',
    hi: 'जैसे-जैसे आप अपने पौधे की देखभाल करेंगे, देखभाल के पल यहाँ दिखाई देंगे।',
  },
});

export default PLANT_COMPANION_TRANSLATIONS;
