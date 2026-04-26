/**
 * Centralized UI translation map — all farmer-facing visible text.
 *
 * Structure: { 'section.key': { en, fr, sw, ha, tw } }
 *
 * Rules:
 *  - Keep text short, action-first, low-literacy friendly
 *  - Prefer practical phrasing over literal translation
 *  - English is the fallback if a key is missing in the target language
 *  - Add new keys at the bottom of the relevant section
 */

const T = {

  // ═══════════════════════════════════════════════════════════
  //  COMMON — buttons, labels, actions shared across screens
  // ═══════════════════════════════════════════════════════════

  // Starter Hindi set — high-priority shared strings only; other keys
  // fall back to English until Hindi is rolled out fully.
  'common.continue': {
    en: 'Continue', fr: 'Continuer', sw: 'Endelea', ha: 'Ci gaba', tw: 'Toa so', hi: 'जारी रखें',
  },
  'common.ready': {
    en: 'Ready', fr: 'Prêt', sw: 'Tayari', ha: 'A shirye', tw: 'Krado', hi: 'तैयार',
  },
  'common.stepN': {
    en: 'Step {n}', fr: 'Étape {n}', sw: 'Hatua {n}', ha: 'Mataki {n}', tw: 'Anammɔn {n}',
  },

  // ─── Offline safety / Tasks fallback ────────────────────────
  'offline.showingCached': {
    en: 'Offline — showing your last saved tasks',
    fr: 'Hors ligne — affichage de vos dernières tâches enregistrées',
    sw: 'Nje ya mtandao — inaonyesha kazi zako zilizohifadhiwa mwisho',
    ha: 'Babu yanar gizo — ana nuna ayyukanku na ƙarshe',
    tw: 'Wonni intanɛt — yɛrekyerɛ wo nnwuma a etwa toɔ',
  },
  'offline.syncOnReconnect': {
    en: 'Changes will sync when you reconnect',
    fr: 'Les changements se synchroniseront à la reconnexion',
    sw: 'Mabadiliko yataoanishwa utakaposimama tena',
    ha: 'Canje-canje za su daidaita lokacin da za ka sake haɗawa',
    tw: 'Nsesaeɛ bɛkɔ so bere a wosan ba intanɛt so',
  },
  'offline.rightNow': {
    en: "You're offline right now",
    fr: 'Vous êtes hors ligne actuellement',
    sw: 'Uko nje ya mtandao sasa',
    ha: 'Ba ka cikin yanar gizo a yanzu',
    tw: 'Wonni intanɛt seesei',
  },
  'offline.stillOffline': {
    en: "You're still offline",
    fr: 'Vous êtes toujours hors ligne',
    sw: 'Bado uko nje ya mtandao',
    ha: 'Har yanzu ba ka cikin yanar gizo ba',
    tw: 'Woda so nni intanɛt',
  },
  'offline.stillOfflineShort': {
    en: 'Offline', fr: 'Hors ligne', sw: 'Nje', ha: 'Babu', tw: 'Nni intanɛt',
  },
  'offline.tryAgain': {
    en: 'Try again', fr: 'Réessayer', sw: 'Jaribu tena', ha: 'Sake gwadawa', tw: 'San hwehwɛ',
  },
  'offline.retrying': {
    en: 'Trying again…', fr: 'Nouvelle tentative…', sw: 'Inajaribu tena…', ha: 'Ana sake gwadawa…', tw: 'Yɛresan hwehwɛ…',
  },
  'offline.lastSaved': {
    en: 'Last saved tasks', fr: 'Dernières tâches enregistrées', sw: 'Kazi zilizohifadhiwa mwisho', ha: 'Ayyuka na ƙarshe da aka adana', tw: 'Nnwuma a ɛtwa toɔ',
  },
  'offline.fallback.title': {
    en: 'Check your farm today',
    fr: 'Vérifiez votre ferme aujourd\'hui',
    sw: 'Kagua shamba lako leo',
    ha: 'Duba gonarka yau',
    tw: 'Hwɛ w\'afuo nnɛ',
  },
  'offline.fallback.why': {
    en: 'We could not load your latest tasks',
    fr: "Nous n'avons pas pu charger vos dernières tâches",
    sw: 'Hatukuweza kupakia kazi zako za hivi karibuni',
    ha: 'Ba za mu iya loda ayyukanku na ƙarshe ba',
    tw: 'Yɛantumi amfa wo nnwuma foforɔ aba',
  },
  'offline.fallback.next': {
    en: 'Reconnect to update your guidance',
    fr: 'Reconnectez-vous pour mettre à jour vos conseils',
    sw: 'Unganisha tena ili kusasisha mwongozo',
    ha: 'Sake haɗawa don sabunta jagora',
    tw: 'San bɔ intanɛt mu na akwankyerɛ ɛyɛ foforɔ',
  },
  'offline.connection': {
    en: 'Connection', fr: 'Connexion', sw: 'Muunganisho', ha: 'Haɗin kai', tw: 'Nkitahodie',
  },
  'offline.lastSavedOnline': {
    en: 'Last saved online', fr: 'Dernière sauvegarde en ligne', sw: 'Imehifadhiwa mwisho mtandaoni', ha: 'An ajiye na ƙarshe yanar gizo', tw: 'Wɔakora ntanɛt so bere a ɛtwa toɔ',
  },
  'offline.notYet': {
    en: 'Not yet', fr: 'Pas encore', sw: 'Bado', ha: 'Ba tukuna', tw: 'Ɛnyɛ nnɛ',
  },
  'status.online': {
    en: 'Online', fr: 'En ligne', sw: 'Mtandaoni', ha: 'Yanar gizo', tw: 'Intanɛt so',
  },
  'status.offline': {
    en: 'Offline', fr: 'Hors ligne', sw: 'Nje ya mtandao', ha: 'Babu yanar gizo', tw: 'Wonni intanɛt',
  },
  'mode.simple': {
    en: 'Simple', fr: 'Simple', sw: 'Rahisi', ha: 'Mai sauƙi', tw: 'Ɛyɛ mmerɛw',
  },
  'mode.full': {
    en: 'Full', fr: 'Complet', sw: 'Kamili', ha: 'Cikakke', tw: 'Nyinaa',
  },

  // ─── U.S. crop recommendation screen ──────────────────────
  'usRec.title': {
    en: 'Find crops that fit your farm',
    fr: 'Trouvez les cultures adaptées à votre ferme',
    sw: 'Pata mazao yanayofaa shamba lako',
    ha: 'Nemo amfanin gona masu dacewa da gonarka',
    tw: 'Hwehwɛ afudeɛ a ɛfata w\'afuo',
    hi: 'अपने खेत के लिए उपयुक्त फसलें खोजें',
  },
  'usRec.subtitle': {
    en: 'Pick your state and we\'ll rank crops by season, climate, and your setup.',
    fr: 'Choisissez votre état et nous classerons les cultures.',
    sw: 'Chagua jimbo lako na tutaorodhesha mazao.',
    ha: 'Zaɓi jiharka mu shirya amfanin gona masu dacewa.',
    tw: 'Yi wo man na yɛbɛto afudeɛ a ɛfata.',
    hi: 'अपना राज्य चुनें और हम फसलों को मौसम, जलवायु और आपके सेटअप के अनुसार क्रमबद्ध करेंगे।',
  },
  'usRec.hint.chooseState': {
    en: 'Choose a state to see recommendations.',
    fr: 'Choisissez un état pour voir les recommandations.',
    sw: 'Chagua jimbo ili uone mapendekezo.',
    ha: 'Zaɓi jiha domin ganin shawarwari.',
    tw: 'Yi man bi na hwɛ akwankyerɛ.',
    hi: 'सुझाव देखने के लिए एक राज्य चुनें।',
  },
  'usRec.errorLoad': {
    en: 'Could not load recommendations. Try again.',
    fr: 'Impossible de charger les recommandations.',
    sw: 'Imeshindwa kupakia mapendekezo. Jaribu tena.',
    ha: 'Ba a iya loda shawarwari ba. Sake gwadawa.',
    tw: 'Yɛantumi amfa akwankyerɛ aba. San hwehwɛ.',
    hi: 'सुझाव लोड नहीं हो सके। पुनः प्रयास करें।',
  },

  'usRec.form.state':         { en: 'State',          fr: 'État',            sw: 'Jimbo',       ha: 'Jiha',           tw: 'Ɔman',        hi: 'राज्य' },
  'usRec.form.farmType':      { en: 'Farm type',      fr: 'Type de ferme',   sw: 'Aina ya shamba', ha: 'Irin gona',  tw: 'Afuo su',     hi: 'खेत का प्रकार' },
  'usRec.form.beginnerLevel': { en: 'Experience',     fr: 'Expérience',      sw: 'Uzoefu',      ha: 'Kwarewa',        tw: 'Osuahunu',    hi: 'अनुभव स्तर' },
  'usRec.form.growingStyle':  { en: 'Growing style',  fr: 'Style de culture',sw: 'Mtindo wa kilimo', ha: 'Salon noma',tw: 'Dua kwan',    hi: 'उगाने का तरीका' },
  'usRec.form.purpose':       { en: 'Purpose',        fr: 'Objectif',        sw: 'Lengo',       ha: 'Dalili',         tw: 'Botaeɛ',      hi: 'उद्देश्य' },

  'usRec.farmType.backyard':   { en: 'Backyard',       fr: 'Jardin',          sw: 'Nyuma',       ha: 'Bayan gida',     tw: 'Efie akyi',   hi: 'पिछवाड़ा' },
  'usRec.farmType.smallFarm':  { en: 'Small farm',     fr: 'Petite ferme',    sw: 'Shamba dogo', ha: 'Karamar gona',   tw: 'Afuo ketewa', hi: 'छोटा खेत' },
  'usRec.farmType.commercial': { en: 'Commercial',     fr: 'Commercial',      sw: 'Biashara',    ha: 'Kasuwanci',      tw: 'Dwadie',      hi: 'वाणिज्यिक' },

  'usRec.beginner.beginner':    { en: 'Just starting',  fr: 'Débutant',       sw: 'Mpya',        ha: 'Sabon',          tw: 'Foforɔ',      hi: 'शुरुआती' },
  'usRec.beginner.intermediate':{ en: 'Some experience',fr: 'Intermédiaire',   sw: 'Uzoefu kidogo',ha: 'Matsakaici',    tw: 'Mfinimfini',  hi: 'मध्यम' },
  'usRec.beginner.advanced':    { en: 'Experienced',   fr: 'Expérimenté',     sw: 'Mwenye uzoefu', ha: 'Gogagge',      tw: 'Nimdefoɔ',    hi: 'अनुभवी' },

  'usRec.style.container':  { en: 'Containers',   fr: 'Pots',          sw: 'Vyombo',        ha: 'Tuluna',      tw: 'Asenaa',     hi: 'कंटेनर' },
  'usRec.style.raisedBed':  { en: 'Raised beds',  fr: 'Plates-bandes', sw: 'Vitanda vya juu', ha: 'Gadaje masu tsayi', tw: 'Mmoa mpa', hi: 'उठी हुई क्यारी' },
  'usRec.style.inGround':   { en: 'In the ground',fr: 'En pleine terre', sw: 'Chini',         ha: 'A ƙasa',       tw: 'Asase mu',   hi: 'ज़मीन में' },
  'usRec.style.mixed':      { en: 'Mixed',        fr: 'Mixte',         sw: 'Mchanganyiko',  ha: 'Gauraya',     tw: 'Ɛfra',      hi: 'मिश्रित' },

  'usRec.purpose.homeFood':    { en: 'Home food',    fr: 'Alimentation', sw: 'Chakula cha nyumbani', ha: 'Abinci na gida', tw: 'Fie aduane', hi: 'घरेलू भोजन' },
  'usRec.purpose.sellLocally': { en: 'Sell locally', fr: 'Vendre localement', sw: 'Uza karibu', ha: 'Sayar a kusa', tw: 'Tɔn wɔ hɔ', hi: 'स्थानीय रूप से बेचें' },
  'usRec.purpose.learning':    { en: 'Learning',     fr: 'Apprendre',    sw: 'Kujifunza',   ha: 'Koyo',        tw: 'Adesua',     hi: 'सीखना' },
  'usRec.purpose.mixed':       { en: 'A bit of all', fr: 'Un peu de tout', sw: 'Vyote',     ha: 'Duka kaɗan',  tw: 'Ne nyinaa',  hi: 'सब कुछ थोड़ा' },

  'usRec.header.backyard':   { en: 'Best backyard crops for {state}, USA',   fr: 'Meilleures cultures de jardin pour {state}, USA', sw: 'Mazao bora ya nyuma kwa {state}, USA', ha: 'Amfanin gona mafi kyau na bayan gida don {state}, USA', tw: 'Efie akyi afudeɛ a ɛyɛ pa ma {state}, USA', hi: '{state}, यूएसए के लिए सबसे अच्छी पिछवाड़ा फसलें' },
  'usRec.header.smallFarm':  { en: 'Best small-farm crops for {state}, USA', fr: 'Meilleures cultures de petite ferme pour {state}, USA', sw: 'Mazao bora ya shamba dogo kwa {state}, USA', ha: 'Amfanin gona mafi kyau na karamar gona don {state}, USA', tw: 'Afuo ketewa afudeɛ a ɛyɛ pa ma {state}, USA', hi: '{state}, यूएसए के लिए सबसे अच्छी छोटी खेत फसलें' },
  'usRec.header.commercial': { en: 'Best crops for {state}, USA',            fr: 'Meilleures cultures pour {state}, USA', sw: 'Mazao bora kwa {state}, USA', ha: 'Amfanin gona mafi kyau don {state}, USA', tw: 'Afudeɛ a ɛyɛ pa ma {state}, USA', hi: '{state}, यूएसए के लिए सबसे अच्छी फसलें' },

  'usRec.bucket.best':         { en: 'Best matches',        fr: 'Meilleures options', sw: 'Zinazofaa zaidi', ha: 'Mafi dacewa',   tw: 'Nea ɛyɛ pa paa', hi: 'सबसे अच्छे विकल्प' },
  'usRec.bucket.alsoConsider': { en: 'Also consider',       fr: 'À envisager aussi',  sw: 'Zingatia pia',    ha: 'Ku yi tunanin wadannan', tw: 'San susuw wɔ', hi: 'ये भी विचार करें' },
  'usRec.bucket.avoid':        { en: 'Not recommended now', fr: 'Non recommandé maintenant', sw: 'Hairui sasa', ha: 'Ba a shawarta yanzu', tw: 'Mfa seesei', hi: 'अभी अनुशंसित नहीं' },

  'usRec.whyThisCrop': { en: 'Why this crop',  fr: 'Pourquoi',    sw: 'Kwa nini',    ha: 'Me ya sa',  tw: 'Deɛ enti', hi: 'यह फसल क्यों' },
  'usRec.riskNotes':   { en: 'Watch out for',  fr: 'Attention à', sw: 'Jihadhari na',ha: 'Kula da',    tw: 'Hwɛ yie', hi: 'ध्यान दें' },
  'usRec.plant':       { en: 'Plant',          fr: 'Planter',     sw: 'Panda',       ha: 'Shuka',      tw: 'Dua',     hi: 'बोएँ' },
  'usRec.harvest':     { en: 'Harvest',        fr: 'Récolte',     sw: 'Vuna',        ha: 'Girbi',      tw: 'Otwa',    hi: 'कटाई' },
  'usRec.weeks':       { en: 'weeks',          fr: 'semaines',    sw: 'wiki',        ha: 'makonni',    tw: 'nnawɔtwe',hi: 'सप्ताह' },

  'usRec.diff.easy':   { en: 'Easy',   fr: 'Facile',  sw: 'Rahisi',  ha: 'Mai sauƙi', tw: 'Ɛnyɛ den', hi: 'आसान' },
  'usRec.diff.medium': { en: 'Medium', fr: 'Moyen',   sw: 'Wastani', ha: 'Matsakaici', tw: 'Mfinimfini', hi: 'मध्यम' },
  'usRec.diff.hard':   { en: 'Hard',   fr: 'Difficile',sw: 'Ngumu', ha: 'Mai wuyar',  tw: 'Ɛyɛ den',  hi: 'कठिन' },

  'usRec.water.low':    { en: 'Low water',    fr: 'Peu d\'eau', sw: 'Maji kidogo', ha: 'Ruwa kaɗan',  tw: 'Nsuo kakra', hi: 'कम पानी' },
  'usRec.water.medium': { en: 'Medium water', fr: 'Eau moyenne', sw: 'Maji wastani', ha: 'Ruwa matsakaici', tw: 'Nsuo mfinimfini', hi: 'मध्यम पानी' },
  'usRec.water.high':   { en: 'High water',   fr: 'Beaucoup d\'eau', sw: 'Maji mengi', ha: 'Ruwa mai yawa', tw: 'Nsuo pii', hi: 'अधिक पानी' },

  'usRec.badge.beginner':  { en: 'Beginner Friendly', fr: 'Facile',         sw: 'Rahisi',       ha: 'Mai sauƙi',     tw: 'Ɛnyɛ den',     hi: 'शुरुआती अनुकूल' },
  'usRec.badge.container': { en: 'Container Friendly',fr: 'Pot',             sw: 'Kyombo',       ha: 'Ga tulu',       tw: 'Asena',        hi: 'कंटेनर अनुकूल' },
  'usRec.badge.market':    { en: 'Strong Local Market', fr: 'Marché local', sw: 'Soko Imara',   ha: 'Kasuwa mai ƙarfi', tw: 'Adwa a ɛyɛ', hi: 'मजबूत स्थानीय बाज़ार' },
  'usRec.badge.heat':      { en: 'Heat Tolerant',     fr: 'Résiste chaleur',sw: 'Hustaalimili joto', ha: 'Mai juriyar zafi', tw: 'Hyew', hi: 'गर्मी सहनशील' },
  'usRec.badge.frost':     { en: 'Frost Risk',        fr: 'Risque gel',     sw: 'Hatari ya theluji',ha: 'Hatsarin sanyi', tw: 'Awɔw asiane', hi: 'पाला जोखिम' },
  'usRec.badge.cool':      { en: 'Cool Season',       fr: 'Saison fraîche', sw: 'Msimu Baridi', ha: 'Lokacin sanyi', tw: 'Awɔw berɛ',    hi: 'ठंडा मौसम' },
  'usRec.badge.warm':      { en: 'Warm Season',       fr: 'Saison chaude',  sw: 'Msimu Joto',   ha: 'Lokacin zafi',  tw: 'Hyew berɛ',    hi: 'गर्म मौसम' },
  'usRec.badge.drought':   { en: 'Drought Tolerant',  fr: 'Résiste sécheresse', sw: 'Hustahimili ukame', ha: 'Mai juriyar fari', tw: 'Osukɔmhia', hi: 'सूखा सहनशील' },

  // Time intelligence badges
  'usRec.timing.plant_now':  { en: 'Plant now',       fr: 'Planter maintenant', sw: 'Panda sasa',     ha: 'Shuka yanzu',      tw: 'Dua seesei',       hi: 'अभी बोएँ' },
  'usRec.timing.plant_soon': { en: 'Plant soon',      fr: 'Bientôt',            sw: 'Panda hivi karibuni', ha: 'Shuka ba da daɗewa ba', tw: 'Dua nkyɛ',  hi: 'जल्द बोएँ' },
  'usRec.timing.wait':       { en: 'Wait',            fr: 'Attendre',           sw: 'Subiri',         ha: 'Jira',             tw: 'Twɛn',             hi: 'प्रतीक्षा करें' },
  'usRec.timing.too_late':   { en: 'Too late',        fr: 'Trop tard',          sw: 'Umechelewa',     ha: 'Ya makara',        tw: 'Atwam',            hi: 'बहुत देर हो गई' },
  'usRec.timing.unknown':    { en: 'Timing',          fr: 'Moment',             sw: 'Wakati',         ha: 'Lokaci',           tw: 'Berɛ',             hi: 'समय' },

  // Risk & profitability
  'usRec.riskLevel': { en: 'Risk',       fr: 'Risque',    sw: 'Hatari',    ha: 'Haɗari',      tw: 'Asiane',    hi: 'जोखिम' },
  'usRec.risk.low':    { en: 'Low',     fr: 'Faible',   sw: 'Chini',    ha: 'Ƙanana',     tw: 'Ketewa',   hi: 'कम' },
  'usRec.risk.medium': { en: 'Medium',  fr: 'Moyen',    sw: 'Wastani',  ha: 'Matsakaici', tw: 'Mfinimfini', hi: 'मध्यम' },
  'usRec.risk.high':   { en: 'High',    fr: 'Élevé',    sw: 'Juu',      ha: 'Babba',      tw: 'Kɛse',     hi: 'उच्च' },

  'usRec.profitability':   { en: 'Profit',  fr: 'Profit',     sw: 'Faida',    ha: 'Riba',       tw: 'Mfasoɔ',   hi: 'लाभ' },
  'usRec.profit.low':      { en: 'Low',     fr: 'Faible',     sw: 'Chini',    ha: 'Ƙanana',     tw: 'Ketewa',   hi: 'कम' },
  'usRec.profit.medium':   { en: 'Medium',  fr: 'Moyen',      sw: 'Wastani',  ha: 'Matsakaici', tw: 'Mfinimfini', hi: 'मध्यम' },
  'usRec.profit.high':     { en: 'High',    fr: 'Élevé',      sw: 'Juu',      ha: 'Babba',      tw: 'Kɛse',     hi: 'उच्च' },

  // Action guidance
  'usRec.doThisNow':   { en: 'Do this now',  fr: 'À faire maintenant',  sw: 'Fanya hii sasa',     ha: 'Yi wannan yanzu',   tw: 'Yɛ yei seesei',    hi: 'यह अभी करें' },
  'usRec.nextStep':    { en: 'Next step',    fr: 'Étape suivante',      sw: 'Hatua inayofuata',   ha: 'Mataki na gaba',    tw: 'Anammɔn a ɛdi so', hi: 'अगला चरण' },
  'usRec.actionSteps': { en: 'Action steps', fr: 'Étapes d\'action',    sw: 'Hatua za utekelezaji', ha: 'Matakan aiki',    tw: 'Adwuma anammɔn',   hi: 'कार्य चरण' },
  'usRec.score':       { en: 'Score',       fr: 'Score',               sw: 'Alama',                ha: 'Maki',           tw: 'Nkyerɛwoɔ',          hi: 'स्कोर' },

  // Crop plan screen
  'plan.windows':       { en: 'Planting & harvest', fr: 'Fenêtres',         sw: 'Kupanda na kuvuna',  ha: 'Shuki da girbi',  tw: 'Dua ne twaeɛ',      hi: 'बोवाई और कटाई' },
  'plan.duration':      { en: 'Duration',           fr: 'Durée',            sw: 'Muda',               ha: 'Tsawon lokaci',   tw: 'Berɛ',              hi: 'अवधि' },
  'plan.riskBreakdown': { en: 'Risk breakdown',     fr: 'Détail du risque', sw: 'Uchanganuzi wa hatari', ha: 'Rarraba haɗari', tw: 'Asiane nkyemu',    hi: 'जोखिम विवरण' },
  'plan.frost':         { en: 'Frost',              fr: 'Gel',              sw: 'Theluji',            ha: 'Sanyi',           tw: 'Awɔw',              hi: 'पाला' },
  'plan.heat':          { en: 'Heat',               fr: 'Chaleur',          sw: 'Joto',               ha: 'Zafi',            tw: 'Hyew',              hi: 'गर्मी' },
  'plan.water':         { en: 'Water',              fr: 'Eau',              sw: 'Maji',               ha: 'Ruwa',            tw: 'Nsuo',              hi: 'पानी' },
  'plan.weeklyPlan':    { en: 'Weekly plan',        fr: 'Plan hebdomadaire',sw: 'Mpango wa kila wiki',ha: 'Shirin mako',    tw: 'Nnawɔtwe nhyehyɛeɛ',hi: 'साप्ताहिक योजना' },
  'plan.startTracking': { en: 'Start tracking',     fr: 'Commencer le suivi',sw: 'Anza kufuatilia',    ha: 'Fara bin diddigi',tw: 'Fi aseɛ hwɛ',       hi: 'ट्रैक करना शुरू करें' },

  // Issue report form
  'issue.title':              { en: 'Report an issue',  fr: 'Signaler un problème', sw: 'Ripoti tatizo',   ha: 'Bayar da rahoton matsala', tw: 'Ka ɔhaw', hi: 'समस्या की रिपोर्ट करें' },
  'issue.category':           { en: 'Category',        fr: 'Catégorie',           sw: 'Aina',           ha: 'Rukuni',                 tw: 'Su',      hi: 'श्रेणी' },
  'issue.severity':           { en: 'Severity',        fr: 'Gravité',             sw: 'Uzito',          ha: 'Tsanani',                tw: 'Emu den', hi: 'गंभीरता' },
  'issue.description':        { en: 'Description',     fr: 'Description',         sw: 'Maelezo',        ha: 'Bayani',                 tw: 'Nkyerɛmu', hi: 'विवरण' },
  'issue.descriptionPlaceholder': { en: 'What happened? Be as specific as you can.', fr: 'Que s\'est-il passé ?', sw: 'Nini kimetokea?', ha: 'Me ya faru?', tw: 'Dɛn na asi?', hi: 'क्या हुआ? जितना हो सके विशिष्ट रहें।' },
  'issue.submit':             { en: 'Submit report',   fr: 'Envoyer',             sw: 'Wasilisha ripoti', ha: 'Aika rahoto',           tw: 'Fa bra',  hi: 'रिपोर्ट भेजें' },
  'issue.submittedAck':       { en: 'Report sent. We\'ll follow up.', fr: 'Rapport envoyé.', sw: 'Ripoti imetumwa.', ha: 'An aika rahoto.', tw: 'Wɔafa.', hi: 'रिपोर्ट भेजी गई। हम जवाब देंगे।' },
  'issue.err.description_too_short': { en: 'Please add a few more details.', fr: 'Ajoutez plus de détails.', sw: 'Ongeza maelezo zaidi.', ha: 'Ƙara ƙarin bayani.', tw: 'Fa nkyerɛmu bi ka ho.', hi: 'कृपया और विवरण जोड़ें।' },
  'issue.err.network_error':  { en: 'Network error — try again.', fr: 'Erreur réseau.', sw: 'Tatizo la mtandao.', ha: 'Matsalar haɗin yanar gizo.', tw: 'Intanɛt nni hɔ.', hi: 'नेटवर्क त्रुटि — पुनः प्रयास करें।' },
  'issue.err.generic':        { en: 'Could not send. Try again.', fr: 'Envoi échoué.', sw: 'Imeshindwa kutuma.', ha: 'Ba a iya aikawa ba.', tw: 'Ansoma.', hi: 'भेज नहीं सके। पुनः प्रयास करें।' },
  'issue.category.pest':      { en: 'Pests',           fr: 'Ravageurs',          sw: 'Wadudu',        ha: 'Kwari',                 tw: 'Mmoawa',    hi: 'कीट' },
  'issue.category.disease':   { en: 'Disease',         fr: 'Maladie',            sw: 'Ugonjwa',       ha: 'Cuta',                  tw: 'Yadeɛ',      hi: 'रोग' },
  'issue.category.weather':   { en: 'Weather damage',  fr: 'Dégâts climatiques', sw: 'Uharibifu wa hali ya hewa', ha: 'Lahanin yanayi', tw: 'Ewim asɛm', hi: 'मौसम क्षति' },
  'issue.category.water':     { en: 'Water problem',   fr: 'Problème d\'eau',    sw: 'Tatizo la maji',ha: 'Matsalar ruwa',         tw: 'Nsuo ho ɔhaw', hi: 'पानी की समस्या' },
  'issue.category.soil':      { en: 'Soil problem',    fr: 'Problème de sol',    sw: 'Tatizo la udongo', ha: 'Matsalar ƙasa',     tw: 'Asase ho ɔhaw', hi: 'मिट्टी की समस्या' },
  'issue.category.other':     { en: 'Other',           fr: 'Autre',              sw: 'Nyingine',      ha: 'Sauran',                tw: 'Foforɔ',    hi: 'अन्य' },

  // Issue severity + harvest quality bands — used by the FeedbackModal
  'issue.severity.low':       { en: 'Low',             fr: 'Faible',             sw: 'Chini',         ha: 'Ƙasa',                  tw: 'Kakra',     hi: 'कम' },
  'issue.severity.medium':    { en: 'Medium',          fr: 'Moyen',              sw: 'Wastani',       ha: 'Matsakaici',            tw: 'Ntam',      hi: 'मध्यम' },
  'issue.severity.high':      { en: 'High',            fr: 'Élevé',              sw: 'Juu',           ha: 'Sama',                  tw: 'Kɛse',      hi: 'उच्च' },
  'harvest.quality.poor':      { en: 'Poor',            fr: 'Faible',             sw: 'Duni',          ha: 'Ƙasa',                  tw: 'Enye',      hi: 'खराब' },
  'harvest.quality.fair':      { en: 'Fair',            fr: 'Moyen',              sw: 'Wastani',       ha: 'Matsakaici',            tw: 'Bɛyɛ',      hi: 'औसत' },
  'harvest.quality.good':      { en: 'Good',            fr: 'Bon',                sw: 'Nzuri',         ha: 'Kyau',                  tw: 'Pa',        hi: 'अच्छा' },
  'harvest.quality.excellent': { en: 'Excellent',       fr: 'Excellent',          sw: 'Bora',          ha: 'Mafi kyau',             tw: 'Papapa',    hi: 'उत्कृष्ट' },

  // NGO dashboard
  'ngo.title':              { en: 'NGO Dashboard',         fr: 'Tableau ONG',          sw: 'Dashibodi ya NGO',   ha: 'Dashborden NGO',      tw: 'NGO dashboard',     hi: 'एनजीओ डैशबोर्ड' },
  'ngo.subtitle':           { en: 'Farmer activity and risk at a glance.', fr: 'Activité et risques.', sw: 'Shughuli na hatari.', ha: 'Ayyuka da haɗari.',   tw: 'Adwuma ne asiane.', hi: 'किसान गतिविधि और जोखिम एक नज़र में।' },
  'ngo.forbidden':          { en: 'You don\'t have access to this page.', fr: 'Accès refusé.',       sw: 'Huna ufikiaji wa ukurasa huu.', ha: 'Ba ka da izini.', tw: 'Wonni kwan.',  hi: 'आपको इस पृष्ठ तक पहुँच नहीं है।' },
  'ngo.error':              { en: 'Could not load dashboard.', fr: 'Chargement impossible.', sw: 'Imeshindwa kupakia.', ha: 'Ba a iya lodawa ba.', tw: 'Yɛantumi amfa aba.', hi: 'डैशबोर्ड लोड नहीं हो सका।' },
  'ngo.card.total':          { en: 'Total farmers',         fr: 'Agriculteurs totaux',  sw: 'Jumla wakulima',     ha: 'Jimillar manoma',     tw: 'Akuafoɔ nyinaa',    hi: 'कुल किसान' },
  'ngo.card.active':         { en: 'Active farmers',        fr: 'Agriculteurs actifs',  sw: 'Wanaofanya kazi',    ha: 'Masu aiki',           tw: 'Wɔredi dwuma',       hi: 'सक्रिय किसान' },
  'ngo.card.highRisk':       { en: 'High-risk farmers',     fr: 'Risque élevé',         sw: 'Hatari kubwa',       ha: 'Haɗari mai girma',    tw: 'Asiane kɛseɛ',       hi: 'उच्च जोखिम' },
  'ngo.card.cropsInProgress': { en: 'Crops in progress',     fr: 'Cultures en cours',    sw: 'Mazao yanaendelea',  ha: 'Amfani a ci gaba',    tw: 'Afudeɛ rekɔ so',     hi: 'जारी फसलें' },
  'ngo.risk.title':          { en: 'Risk this week',        fr: 'Risques cette semaine',sw: 'Hatari wiki hii',    ha: 'Haɗari wannan mako',  tw: 'Asiane nnawɔtwe yi', hi: 'इस सप्ताह जोखिम' },
  'ngo.risk.empty':          { en: 'No active risk items — good news.', fr: 'Aucun risque actif.', sw: 'Hakuna hatari.', ha: 'Babu haɗari.',        tw: 'Asiane biara nni hɔ.', hi: 'कोई सक्रिय जोखिम नहीं — अच्छी खबर।' },
  'ngo.risk.unnamedFarm':    { en: 'Unnamed farm',          fr: 'Ferme sans nom',       sw: 'Shamba bila jina',   ha: 'Gona mara suna',      tw: 'Afuo a enni din',    hi: 'बेनाम खेत' },
  'ngo.crops.title':         { en: 'Crop analytics',        fr: 'Analytique cultures',  sw: 'Uchambuzi wa mazao', ha: 'Bayanan amfani',      tw: 'Afudeɛ nkyerɛmu',    hi: 'फसल विश्लेषण' },
  'ngo.crops.crop':          { en: 'Crop',                  fr: 'Culture',              sw: 'Zao',                ha: 'Amfani',              tw: 'Afudeɛ',            hi: 'फसल' },
  'ngo.crops.total':         { en: 'Total',                 fr: 'Total',                sw: 'Jumla',              ha: 'Jimilla',             tw: 'Nyinaa',             hi: 'कुल' },
  'ngo.crops.growing':       { en: 'Growing',               fr: 'En croissance',        sw: 'Inaendelea',         ha: 'Yana girma',          tw: 'Renyin',             hi: 'बढ़ रही' },
  'ngo.crops.harvestReady':  { en: 'Harvest ready',         fr: 'Prêt récolte',         sw: 'Tayari kuvuna',      ha: 'A shirye girbi',      tw: 'Yɛtumi atwa',        hi: 'कटाई तैयार' },
  'ngo.crops.empty':         { en: 'No crop cycle data yet.', fr: 'Pas encore de données.', sw: 'Hakuna data bado.', ha: 'Babu bayanai tukuna.', tw: 'Data biara nni hɔ.', hi: 'अभी फसल चक्र डेटा नहीं।' },
  'ngo.harvest.title':       { en: 'Harvest totals',        fr: 'Totaux récolte',       sw: 'Jumla ya mavuno',    ha: 'Jimillar girbi',      tw: 'Otwa nyinaa',        hi: 'कटाई कुल' },
  'ngo.harvest.reports':     { en: 'Reports',               fr: 'Rapports',             sw: 'Ripoti',             ha: 'Rahotanni',           tw: 'Amanneɛbɔ',          hi: 'रिपोर्ट्स' },
  'ngo.harvest.totalKg':     { en: 'Total kg',              fr: 'Kg total',             sw: 'Kilogramu jumla',    ha: 'Kilo jimilla',        tw: 'Kilo nyinaa',        hi: 'कुल किलो' },
  'ngo.harvest.lossesKg':    { en: 'Losses kg',             fr: 'Pertes kg',            sw: 'Hasara kilogramu',   ha: 'Asara kilo',          tw: 'Anwo kilo',          hi: 'हानि किलो' },
  'ngo.openFarmers':         { en: 'Open farmer list',      fr: 'Voir les agriculteurs',sw: 'Fungua orodha',      ha: 'Duba jerin manoma',   tw: 'Hwɛ akuafoɔ',        hi: 'किसान सूची खोलें' },

  // NGO v2 decision support
  'ngoV2.recompute':             { en: 'Recompute',          fr: 'Recalculer',        sw: 'Hesabu tena',       ha: 'Sake lissafi',     tw: 'San bu',            hi: 'पुनर्गणना करें' },
  'ngoV2.dueBy':                 { en: 'Due by',             fr: 'Échéance',          sw: 'Mwisho wa',         ha: 'Iyakar lokaci',    tw: 'Bere a ɛbɛso',      hi: 'इसके द्वारा' },
  'ngoV2.markInProgress':        { en: 'In progress',        fr: 'En cours',          sw: 'Inaendelea',        ha: 'Ana gudana',       tw: 'Ɛrekɔ so',           hi: 'प्रगति में' },
  'ngoV2.markResolved':          { en: 'Resolved',           fr: 'Résolu',            sw: 'Imetatuliwa',       ha: 'An warware',       tw: 'Wɔasiesie',          hi: 'हल किया गया' },
  'ngoV2.dismiss':               { en: 'Dismiss',            fr: 'Ignorer',           sw: 'Puuza',             ha: 'Yi watsi',         tw: 'Gyae',               hi: 'खारिज करें' },

  'ngoV2.priority.critical':     { en: 'Critical',           fr: 'Critique',          sw: 'Muhimu sana',       ha: 'Mai muhimmanci',   tw: 'Ɛho hia kɛseɛ',      hi: 'गंभीर' },
  'ngoV2.priority.high':         { en: 'High',               fr: 'Élevée',            sw: 'Juu',               ha: 'Babba',            tw: 'Kɛseɛ',              hi: 'उच्च' },
  'ngoV2.priority.medium':       { en: 'Medium',             fr: 'Moyenne',           sw: 'Wastani',           ha: 'Matsakaici',       tw: 'Mfinimfini',         hi: 'मध्यम' },
  'ngoV2.priority.low':          { en: 'Low',                fr: 'Faible',            sw: 'Chini',             ha: 'Ƙanana',           tw: 'Ketewa',             hi: 'कम' },

  'ngoV2.interventions.title':   { en: 'Intervention Center',fr: "Centre d'intervention", sw: 'Kituo cha uingiliaji', ha: 'Cibiyar shiga tsakani', tw: 'Nsusuansoɔ fie', hi: 'हस्तक्षेप केंद्र' },
  'ngoV2.interventions.subtitle':{ en: 'Farmers who need attention right now.', fr: 'Agriculteurs nécessitant une attention.', sw: 'Wakulima wanaohitaji msaada.', ha: 'Manoman da suke buƙatar kulawa.', tw: 'Akuafoɔ a wɔhia mmoa.', hi: 'किसान जिन्हें अभी ध्यान चाहिए।' },
  'ngoV2.interventions.queue':   { en: 'Priority queue',     fr: 'File prioritaire',  sw: 'Foleni ya kipaumbele', ha: 'Jerin fifiko', tw: 'Nea edi kan',         hi: 'प्राथमिकता कतार' },
  'ngoV2.interventions.empty':   { en: 'Nothing to review right now.', fr: 'Rien à examiner.', sw: 'Hakuna cha kukagua.', ha: 'Babu abin da za a duba.', tw: 'Nea wobɛhwɛ nni hɔ.', hi: 'अभी समीक्षा के लिए कुछ नहीं।' },

  'ngoV2.scores.title':          { en: 'Farmer Scoring',     fr: 'Notation des agriculteurs', sw: 'Alama za wakulima', ha: 'Makin manoma', tw: 'Akuafoɔ nkyerɛwoɔ',  hi: 'किसान स्कोरिंग' },
  'ngoV2.scores.subtitle':       { en: 'Health, performance, consistency, risk, verification.', fr: 'Santé, performance, cohérence, risque, vérification.', sw: 'Afya, utendaji, uthabiti, hatari, uthibitisho.', ha: 'Lafiya, aiki, daidaito, haɗari, tabbatarwa.', tw: 'Apɔwmuden, dwumadie, gyinapɛn, asiane, adansedie.', hi: 'स्वास्थ्य, प्रदर्शन, स्थिरता, जोखिम, सत्यापन।' },
  'ngoV2.scores.filterBand':     { en: 'Filter band',        fr: 'Filtrer par tranche', sw: 'Chuja bendi',      ha: 'Tace madauki',     tw: 'Tew kuo',             hi: 'बैंड फ़िल्टर' },
  'ngoV2.scores.allBands':       { en: 'All bands',          fr: 'Toutes les tranches', sw: 'Bendi zote',       ha: 'Dukkan madauki',   tw: 'Kuo nyinaa',          hi: 'सभी बैंड' },
  'ngoV2.scores.empty':          { en: 'No farmer scores yet. Run Recompute.', fr: 'Aucun score. Recalculez.', sw: 'Hakuna alama. Bonyeza Recompute.', ha: 'Babu maki. Danna Recompute.', tw: 'Nkyerɛwoɔ nni hɔ.', hi: 'अभी कोई स्कोर नहीं। पुनर्गणना चलाएँ।' },
  'ngoV2.scores.band':           { en: 'Band',               fr: 'Tranche',           sw: 'Bendi',             ha: 'Madauki',          tw: 'Kuo',                hi: 'बैंड' },
  'ngoV2.scores.health':         { en: 'Health',             fr: 'Santé',             sw: 'Afya',              ha: 'Lafiya',           tw: 'Apɔwmuden',          hi: 'स्वास्थ्य' },
  'ngoV2.scores.performance':    { en: 'Performance',        fr: 'Performance',       sw: 'Utendaji',          ha: 'Aiki',             tw: 'Dwumadie',           hi: 'प्रदर्शन' },
  'ngoV2.scores.consistency':    { en: 'Consistency',        fr: 'Cohérence',         sw: 'Uthabiti',          ha: 'Daidaito',         tw: 'Gyinapɛn',           hi: 'स्थिरता' },
  'ngoV2.scores.risk':           { en: 'Risk',               fr: 'Risque',            sw: 'Hatari',            ha: 'Haɗari',           tw: 'Asiane',             hi: 'जोखिम' },
  'ngoV2.scores.verification':   { en: 'Verification',       fr: 'Vérification',      sw: 'Uthibitisho',       ha: 'Tabbatarwa',       tw: 'Adansedie',          hi: 'सत्यापन' },

  'ngoV2.band.excellent':        { en: 'Excellent',          fr: 'Excellent',         sw: 'Bora',              ha: 'Mai kyau sosai',   tw: 'Ɛyɛ pa paa',         hi: 'उत्तम' },
  'ngoV2.band.good':             { en: 'Good',               fr: 'Bon',               sw: 'Nzuri',             ha: 'Nagari',           tw: 'Ɛyɛ',                hi: 'अच्छा' },
  'ngoV2.band.fair':             { en: 'Fair',               fr: 'Correct',           sw: 'Wastani',           ha: 'Matsakaici',       tw: 'Ɛyɛ kakra',          hi: 'ठीक-ठाक' },
  'ngoV2.band.weak':             { en: 'Weak',               fr: 'Faible',            sw: 'Dhaifu',            ha: 'Rauni',            tw: 'Mmerɛw',             hi: 'कमज़ोर' },

  'ngoV2.funding.title':         { en: 'Funding Readiness',  fr: 'Admissibilité au financement', sw: 'Utayari wa ufadhili', ha: 'Shirya tallafin kuɗi', tw: 'Sika hwɛsoɔ', hi: 'वित्त-पोषण तत्परता' },
  'ngoV2.funding.subtitle':      { en: 'Who is ready, who needs review, who should wait.', fr: "Qui est prêt, qui a besoin d'une révision.", sw: 'Nani yuko tayari, nani anahitaji ukaguzi.', ha: 'Wa ya shirya, wa yake buƙatar bita.', tw: 'Hwan na wayare.', hi: 'कौन तैयार है, किसे समीक्षा चाहिए, किसे प्रतीक्षा करनी चाहिए।' },
  'ngoV2.funding.allDecisions':  { en: 'All decisions',      fr: 'Toutes',            sw: 'Zote',              ha: 'Duka',             tw: 'Ne nyinaa',          hi: 'सभी निर्णय' },
  'ngoV2.funding.eligible':      { en: 'Eligible',           fr: 'Admissible',        sw: 'Anastahili',        ha: 'Cancanta',         tw: 'Fata',               hi: 'योग्य' },
  'ngoV2.funding.monitor':       { en: 'Monitor',            fr: 'Surveiller',        sw: 'Fuatilia',          ha: 'Saka idanu',       tw: 'Hwɛ',                hi: 'निगरानी' },
  'ngoV2.funding.needsReview':   { en: 'Needs review',       fr: 'Examen requis',     sw: 'Inahitaji ukaguzi', ha: 'Yana buƙatar bita',tw: 'Hia hwɛ',            hi: 'समीक्षा चाहिए' },
  'ngoV2.funding.notYet':        { en: 'Not yet eligible',   fr: 'Pas encore',        sw: 'Bado haistahili',   ha: 'Ba tukuna',        tw: 'Ɛnnyɛ',              hi: 'अभी योग्य नहीं' },
  'ngoV2.funding.empty':         { en: 'No decisions yet. Run Recompute.', fr: 'Aucune décision.', sw: 'Hakuna maamuzi.', ha: 'Babu yanke hukunci.', tw: 'Wɔnyɛɛ gyinaeɛ.', hi: 'अभी कोई निर्णय नहीं। पुनर्गणना चलाएँ।' },

  // ─── Action-first home layout ──────────────────────
  'actionHome.primary.title':        { en: "Today's main action",     fr: 'Action principale', sw: 'Kazi kuu ya leo',    ha: 'Babban aikin yau',     tw: 'Nnɛ dwumadi titiriw',   hi: 'आज का मुख्य कार्य' },
  'actionHome.primary.why':          { en: 'Why this matters',        fr: 'Pourquoi',          sw: 'Kwa nini ni muhimu', ha: 'Me ya sa',             tw: 'Deɛ enti',              hi: 'क्यों यह ज़रूरी है' },
  'actionHome.primary.eta':          { en: 'Estimated time',          fr: 'Temps estimé',      sw: 'Muda uliokadiriwa',  ha: 'Lokacin da aka kiyasta',tw: 'Berɛ a ɛbɛfa',           hi: 'अनुमानित समय' },
  'actionHome.primary.minutes':      { en: '{n} min',                  fr: '{n} min',            sw: 'Dakika {n}',          ha: 'Minti {n}',             tw: 'Simma {n}',              hi: '{n} मिनट' },
  'actionHome.primary.markComplete': { en: 'Mark complete',            fr: 'Marquer terminé',    sw: 'Weka kama imekamilika', ha: 'Alama cikakke',      tw: 'Fa sɛ yɛawie',           hi: 'पूरा चिह्नित करें' },
  'actionHome.primary.markingDone':  { en: 'Marking done...',          fr: 'Marquage...',        sw: 'Inaweka...',           ha: 'Ana yin alama...',     tw: 'Yɛrehwɛ...',             hi: 'पूरा किया जा रहा है...' },
  'actionHome.primary.noTask':       { en: 'No task right now',        fr: 'Aucune tâche',       sw: 'Hakuna kazi sasa',     ha: 'Babu aiki yanzu',      tw: 'Adwuma biara nni hɔ',    hi: 'अभी कोई कार्य नहीं' },
  'actionHome.primary.noTaskHint':   { en: "You're all caught up for now.", fr: 'Tout est à jour.', sw: 'Uko sawa kwa sasa.',  ha: 'Duk an gama.',          tw: 'Wɔawie ne nyinaa mprempren.', hi: 'अभी के लिए सब ठीक है।' },
  'actionHome.urgency.urgent':       { en: 'Urgent',                   fr: 'Urgent',             sw: 'Haraka',               ha: 'Gaggawa',              tw: 'Ɛhia ntɛm',             hi: 'अत्यावश्यक' },
  'actionHome.urgency.important':    { en: 'Important',                fr: 'Important',          sw: 'Muhimu',               ha: 'Muhimmi',              tw: 'Ɛho hia',               hi: 'महत्वपूर्ण' },
  'actionHome.urgency.normal':       { en: 'Normal',                   fr: 'Normal',             sw: 'Kawaida',              ha: 'Na yau da kullum',     tw: 'Daa',                   hi: 'सामान्य' },
  'actionHome.completion.positive':  { en: 'Good job — this keeps your farm on track', fr: 'Bien joué — votre ferme reste sur la bonne voie', sw: 'Vizuri — shamba lako linaendelea vizuri', ha: 'Aikin kirki — gonarka tana kan hanya', tw: 'Ayɛ — ama wo kuayɛ ɛkwan pa so', hi: 'बहुत बढ़िया — इससे आपका खेत सही रास्ते पर है' },
  'actionHome.progress.summary':     { en: '{done} of {total} tasks completed', fr: '{done} sur {total} tâches terminées', sw: '{done} kati ya {total} zimekamilika', ha: '{done} cikin {total} an gama', tw: '{done} wɔ {total} mu awie', hi: '{total} में से {done} कार्य पूरे' },

  // ─── Daily loop (streak, entry, next-day preview, reinforcement) ─
  'loop.streak_label':          { en: '{days}-day streak',                      fr: 'Série de {days} jours',                 sw: 'Mfululizo wa siku {days}',              ha: 'Jerin kwanaki {days}',               tw: 'Nnansa {days} bere',                     hi: '{days}-दिन की लकीर' },
  'loop.streak_start':          { en: 'Start your streak today',                fr: 'Lancez votre série aujourd\'hui',       sw: 'Anzisha mfululizo wako leo',            ha: 'Fara jerinka yau',                   tw: 'Fi w\'agoro ase ɛnnɛ',                    hi: 'आज से अपनी लकीर शुरू करें' },
  'loop.first_visit_today':     { en: "Here's what to do today",                fr: "Voici ce qu'il faut faire aujourd'hui", sw: 'Haya hapa ya kufanya leo',              ha: 'Ga abin da za a yi yau',             tw: 'Yei ne deɛ wonyɛ ɛnnɛ',                   hi: 'आज क्या करना है' },
  'loop.continue_tasks':        { en: 'Continue your tasks',                    fr: 'Continuez vos tâches',                  sw: 'Endelea na kazi zako',                  ha: 'Ci gaba da ayyukanka',               tw: 'Toa w\'adwuma so',                        hi: 'कार्य जारी रखें' },
  'loop.missed_day_message':    { en: "You missed a day — let's get back on track", fr: "Vous avez manqué un jour — reprenons ensemble", sw: 'Ulikosa siku — turudi kwenye mstari', ha: "Kun rasa rana — mu koma kan hanya", tw: "Woantumi baa ɛnnɛra — momma yɛnsan mmɔ mu", hi: 'आपने एक दिन छोड़ा — वापस पटरी पर लौटें' },
  'loop.great_work_today':      { en: 'Great work today',                       fr: "Bon travail aujourd'hui",               sw: 'Kazi nzuri leo',                         ha: 'Aiki mai kyau yau',                  tw: 'Adwuma pa ɛnnɛ',                          hi: 'आज अच्छा काम किया' },
  'loop.check_tomorrow':        { en: 'Next: check tomorrow',                   fr: 'Ensuite : revenez demain',              sw: 'Ifuatayo: angalia kesho',               ha: 'Na gaba: duba gobe',                 tw: 'Nea edi so: hwɛ ɔkyena',                  hi: 'आगे: कल देखें' },
  'loop.tomorrow_preview':      { en: 'Tomorrow: {task}',                       fr: 'Demain : {task}',                       sw: 'Kesho: {task}',                          ha: 'Gobe: {task}',                       tw: 'Ɔkyena: {task}',                           hi: 'कल: {task}' },
  'loop.next_preview':          { en: 'Next: {task}',                           fr: 'Ensuite : {task}',                      sw: 'Ifuatayo: {task}',                       ha: 'Na gaba: {task}',                    tw: 'Nea edi so: {task}',                       hi: 'आगे: {task}' },
  'loop.reinforcement.1':       { en: 'Good job — this keeps your crop healthy', fr: 'Bien joué — votre culture reste saine', sw: 'Vizuri — zao lako linakaa lenye afya', ha: 'Aikin kirki — amfanin gonarka yana da lafiya', tw: 'Ayɛ — w\'afudeɛ ho bɛyɛ den',          hi: 'बहुत बढ़िया — इससे आपकी फसल स्वस्थ रहती है' },
  'loop.reinforcement.2':       { en: "Nice — you're making progress",          fr: 'Bravo — vous progressez',                sw: 'Vizuri — unapata maendeleo',             ha: 'Kyakkyawa — kana samun ci gaba',      tw: 'Pa — worenya nkɔso',                       hi: 'वाह — आप आगे बढ़ रहे हैं' },
  'loop.reinforcement.3':       { en: 'Well done — small steps add up',         fr: "Bien joué — les petits pas s'additionnent", sw: 'Hongera — hatua ndogo huleta mafanikio', ha: 'Godiya — ƙananan matakai suna taruwa', tw: 'Ayekoo — anammɔn nketewa bom',           hi: 'शाबाश — छोटे कदम बड़े नतीजे लाते हैं' },
  'loop.reinforcement.4':       { en: "Keep going — you're on track",           fr: 'Continuez — vous êtes sur la bonne voie', sw: 'Endelea — uko njia nzuri',              ha: 'Ci gaba — kuna kan hanya',            tw: 'Kɔ so — wowɔ ɛkwan pa so',                 hi: 'चलते रहें — आप सही रास्ते पर हैं' },

  // ─── Trust signals (spec §7) — last-activity "proof of activity" ─
  'trust.last_activity':        { en: 'Last activity: {ago}',                   fr: 'Dernière activité : {ago}',              sw: 'Shughuli ya mwisho: {ago}',              ha: 'Aiki na ƙarshe: {ago}',               tw: 'Adeyɛ a etwa too: {ago}',                  hi: 'अंतिम गतिविधि: {ago}' },
  'time.just_now':              { en: 'Just now',                               fr: "À l'instant",                            sw: 'Sasa hivi',                              ha: 'Yanzu-yanzu',                         tw: 'Seesei ara',                              hi: 'अभी' },
  'time.minutes_ago':           { en: '{n} min ago',                            fr: 'Il y a {n} min',                         sw: 'Dakika {n} zilizopita',                  ha: 'Minti {n} da suka wuce',              tw: 'Simma {n} a atwam',                        hi: '{n} मिनट पहले' },
  'time.hours_ago':             { en: '{n} h ago',                              fr: 'Il y a {n} h',                           sw: 'Saa {n} zilizopita',                     ha: 'Sa\'o\'i {n} da suka wuce',           tw: 'Nnɔnhwere {n} a atwam',                    hi: '{n} घंटे पहले' },
  'time.days_ago':              { en: '{n} d ago',                              fr: 'Il y a {n} j',                           sw: 'Siku {n} zilizopita',                    ha: 'Kwana {n} da suka wuce',              tw: 'Nna {n} a atwam',                          hi: '{n} दिन पहले' },
  'time.no_activity':           { en: 'No activity yet',                        fr: "Pas encore d'activité",                  sw: 'Hakuna shughuli bado',                   ha: 'Babu aiki tukuna',                    tw: 'Adeyɛ biara nni hɔ',                       hi: 'अभी तक कोई गतिविधि नहीं' },

  // ─── Daily reminders (spec §2, §4, §5, §6) ──────────────────
  'reminder.today_ready':       { en: "Today's farm action is ready",           fr: "L'action du jour est prête",             sw: 'Kazi ya leo iko tayari',                 ha: 'Aikin yau yana shirye',               tw: 'Ɛnnɛ adwuma no asiesie',                  hi: 'आज का कार्य तैयार है' },
  'reminder.missed_day':        { en: "You missed yesterday. Let's get back on track.", fr: "Vous avez manqué hier. Reprenons ensemble.", sw: 'Ulikosa jana. Turudi kwenye mstari.', ha: "Kun rasa jiya. Mu koma kan hanya.",   tw: "Woantumi baa ɛnnɛra. Momma yɛnsan mmɔ mu.", hi: 'कल आप चूक गए। आइए वापस पटरी पर आएँ।' },
  'reminder.weather_severe':    { en: 'Severe weather alert — protect your crops today.', fr: 'Alerte météo sévère — protégez vos cultures.', sw: 'Onyo la hali mbaya ya hewa — linda mazao yako leo.', ha: "Gargaɗin mummunan yanayi — kare amfaninka yau.", tw: 'Ewiem tebea aba mu denden — bɔ w\'afudeɛ ho ban ɛnnɛ.', hi: 'गंभीर मौसम चेतावनी — आज अपनी फसलें बचाएँ।' },
  'reminder.risk_high':         { en: 'Rain expected. Prepare drainage today.', fr: 'Pluie prévue. Préparez le drainage aujourd\'hui.', sw: 'Mvua inatarajiwa. Andaa mifereji leo.', ha: 'Ana sa ran ruwan sama. Shirya magudanar ruwa yau.', tw: 'Osutɔ rebɛba. Siesie nsuosene ɛnnɛ.',          hi: 'बारिश संभावित। आज जल निकासी तैयार करें।' },
  'reminder.permission_ask':    { en: 'Would you like daily farm reminders on this device?', fr: 'Voulez-vous des rappels quotidiens sur cet appareil ?', sw: 'Ungependa ukumbusho wa kila siku kwenye kifaa hiki?', ha: 'Kana son tunatarwa ta yau da kullun a wannan na\'urar?', tw: 'Wopɛ sɛ wonya nkaeɛ daa wɔ saa afidie yi so?', hi: 'क्या आप इस डिवाइस पर रोज़ाना कृषि रिमाइंडर चाहते हैं?' },

  // ─── Spec §12 canonical notifications.* aliases ───────────────
  // These are the keys evaluateReminder emits in messageKey. Values
  // mirror the reminder.* set above so either key renders correctly.
  'notifications.daily_ready':        { en: "Today's farm action is ready",           fr: "L'action du jour est prête",             sw: 'Kazi ya leo iko tayari',                 ha: 'Aikin yau yana shirye',               tw: 'Ɛnnɛ adwuma no asiesie',                  hi: 'आज का कार्य तैयार है' },
  'notifications.missed_day':         { en: "You missed yesterday — let's get back on track", fr: 'Vous avez manqué hier — reprenons ensemble', sw: 'Ulikosa jana — turudi kwenye mstari', ha: "Kun rasa jiya — mu koma kan hanya",   tw: "Woantumi baa ɛnnɛra — momma yɛnsan mmɔ mu", hi: 'आपने कल छोड़ा — आइए वापस पटरी पर आएँ' },
  'notifications.high_risk':          { en: 'Your farm needs attention today',       fr: 'Votre ferme nécessite votre attention aujourd\'hui', sw: 'Shamba lako linahitaji uangalizi leo', ha: 'Gonarka na bukatar kulawa yau',      tw: 'Wo kuayɛ hia hwɛ ɛnnɛ',                    hi: 'आपके खेत को आज ध्यान चाहिए' },
  'notifications.weather_warning':    { en: 'Rain expected. Prepare today.',          fr: 'Pluie prévue. Préparez-vous aujourd\'hui.', sw: 'Mvua inatarajiwa. Jiandae leo.',       ha: 'Ana sa ran ruwan sama. Shirya yau.',  tw: 'Osutɔ rebɛba. Siesie ɛnnɛ.',               hi: 'बारिश संभावित। आज तैयारी करें।' },
  'notifications.permission_prompt':  { en: 'Would you like daily farm reminders on this device?', fr: 'Voulez-vous des rappels quotidiens sur cet appareil ?', sw: 'Ungependa ukumbusho wa kila siku kwenye kifaa hiki?', ha: 'Kana son tunatarwa ta yau da kullun a wannan na\'urar?', tw: 'Wopɛ sɛ wonya nkaeɛ daa wɔ saa afidie yi so?', hi: 'क्या आप इस डिवाइस पर रोज़ाना कृषि रिमाइंडर चाहते हैं?' },
  'notifications.settings_title':     { en: 'Notifications',        fr: 'Notifications',          sw: 'Arifa',                  ha: 'Sanarwa',                     tw: 'Nkra',                       hi: 'सूचनाएँ' },

  // ─── Planting decision + weather summary (v1) ───────────────
  'planting.decision.good_to_plant':   { en: 'Good to plant now',       fr: 'Bon moment pour semer',         sw: 'Ni wakati mzuri wa kupanda',    ha: 'Lokaci mai kyau na shuka',    tw: 'Bere pa a wobɛdua',                 hi: 'अभी बोना सही है' },
  'planting.decision.plant_soon':      { en: 'Plant soon',              fr: 'Semer bientôt',                 sw: 'Panda hivi karibuni',           ha: 'Shuka nan ba da daɗewa ba',   tw: 'Dua ntɛm',                          hi: 'जल्द बोएँ' },
  'planting.decision.wait_monitor':    { en: 'Wait and monitor',        fr: 'Attendez et observez',          sw: 'Subiri na angalia',             ha: 'Jira ka sa ido',              tw: 'Twɛn na hwɛ',                       hi: 'रुकें और देखें' },
  'planting.decision.not_recommended': { en: 'Not recommended now',     fr: 'Déconseillé maintenant',        sw: 'Haipendekezwi sasa',            ha: 'Ba a ba da shawarar yanzu ba',tw: 'Wonhyɛ ho nkuran seesei',           hi: 'अभी अनुशंसित नहीं' },
  'planting.decision.unsupported':     { en: 'Seasonal guidance unavailable', fr: 'Conseil saisonnier indisponible', sw: 'Mwongozo wa msimu haupatikani', ha: 'Jagorar yanayi ba a samu ba', tw: 'Afe nyinaa ho akwankyerɛ nni hɔ',   hi: 'मौसमी सलाह उपलब्ध नहीं' },

  'planting.next_step.good_to_plant':   { en: 'Season is right where you are — start preparing your land.',           fr: 'La saison est bonne ici — commencez la préparation du sol.',                sw: 'Msimu umewadia eneoni mwako — anza kuandaa shamba.',                           ha: 'Lokacin ya dace a gonarka — fara shirya filin.',                        tw: 'Mmere no ayɛ yiye wɔ hɔ — fi ase siesie w\'asase.',                         hi: 'आपके क्षेत्र में मौसम सही है — ज़मीन तैयार करना शुरू करें।' },
  'planting.next_step.plant_soon':      { en: 'Get ready — your planting window is coming up.',                        fr: 'Préparez-vous — la fenêtre de semis approche.',                             sw: 'Jiandae — dirisha lako la kupanda linakaribia.',                               ha: 'Yi shirin — lokacin shuka yana gabatowa.',                              tw: 'Siesie wo ho — wo dua bere rebɛba.',                                        hi: 'तैयार हो जाएँ — बुवाई का समय नज़दीक है।' },
  'planting.next_step.wait_monitor':    { en: 'Hold off and watch the weather — check again in a few days.',           fr: 'Attendez et surveillez la météo — vérifiez dans quelques jours.',           sw: 'Ngoja na fuatilia hali ya hewa — angalia tena baada ya siku chache.',         ha: 'Tsaya kuma duba yanayi — sake duba cikin \u2018yan kwanaki.',          tw: 'Gyae na hwɛ ewiem tebea — hwɛ nnansa akyi.',                                hi: 'रुकिए और मौसम देखिए — कुछ दिनों में फिर जाँचें।' },
  'planting.next_step.not_recommended': { en: 'Outside the planting window — pick a different crop or wait for the next season.', fr: 'Hors fenêtre de semis — choisissez une autre culture ou attendez la prochaine saison.', sw: 'Nje ya dirisha la kupanda — chagua zao lingine au subiri msimu ujao.',        ha: 'A wajen lokacin shuka — zaɓi wani amfani ko jira lokaci na gaba.',      tw: 'Ɛnkɔ dua bere mu — paw afudeɛ foforɔ anaa twɛn berɛ a ɛdi hɔ.',              hi: 'बुवाई खिड़की से बाहर — कोई दूसरी फसल चुनें या अगले मौसम की प्रतीक्षा करें।' },
  'planting.next_step.unsupported':     { en: 'We don\u2019t have seasonal rules for your region yet — ask local extension services.', fr: 'Pas encore de règles saisonnières pour votre région — consultez les services agricoles locaux.', sw: 'Hatuna bado sheria za msimu wa eneo lako — wasiliana na huduma za kilimo.', ha: 'Ba mu da dokokin yanayi ga yankinku tukuna — tuntuɓi ayyukan noma na gida.',    tw: 'Yennya mmara afe nyinaa ho wɔ wo mpɔtam yi — bisa kuayɛ adwumayɛfoɔ.',      hi: 'आपके क्षेत्र के लिए अभी मौसमी नियम नहीं हैं — स्थानीय कृषि सेवा से संपर्क करें।' },

  'weather.summary.ok':              { en: 'Conditions look favourable.',        fr: 'Les conditions sont favorables.',     sw: 'Hali inaonekana nzuri.',            ha: 'Yanayi yana kyau.',                  tw: 'Tebea no yɛ.',                        hi: 'स्थिति अनुकूल दिख रही है।' },
  'weather.summary.low_rain':        { en: 'Rain has been low recently.',         fr: 'Pluies faibles récemment.',            sw: 'Mvua imekuwa kidogo hivi karibuni.',  ha: 'Ruwa ya yi ƙasa kwanan nan.',        tw: 'Osutɔ sua nnansa yi.',                hi: 'हाल ही में बारिश कम रही है।' },
  'weather.summary.dry_ahead':       { en: 'Dry spell expected in the week ahead.', fr: 'Période sèche prévue la semaine prochaine.', sw: 'Kipindi kikavu kinatarajiwa wiki ijayo.', ha: 'Ana sa ran lokacin bushewa mako mai zuwa.', tw: 'Yuyu bere rebɛba dapɛn a ɛdi hɔ.',   hi: 'आने वाले हफ़्ते सूखा अपेक्षित है।' },
  'weather.summary.excessive_heat':  { en: 'Temperatures are unusually high.',   fr: 'Températures inhabituellement élevées.',sw: 'Joto ni la juu zaidi.',             ha: 'Zafi ya yi yawa fiye da yadda aka saba.', tw: 'Ɛyɛ hyew bebree.',                 hi: 'तापमान असामान्य रूप से अधिक है।' },
  'weather.summary.uncertain':       { en: 'Weather signal is uncertain.',        fr: 'Les indicateurs météo sont incertains.', sw: 'Hali ya hewa haijulikani wazi.',    ha: 'Alamar yanayi ba ta tabbata ba.',   tw: 'Ewiem tebea nsɛm nso yɛ papa.',        hi: 'मौसम संकेत अनिश्चित हैं।' },
  'weather.summary.unavailable':     { en: 'Weather data is not available.',      fr: 'Données météo non disponibles.',       sw: 'Data ya hali ya hewa haipatikani.', ha: 'Bayanan yanayi ba a samu ba.',       tw: 'Ewiem tebea data nni hɔ.',             hi: 'मौसम डेटा उपलब्ध नहीं है।' },

  // ─── Daily task engine (v1) — due hint labels ───────────────
  'daily.due.today':       { en: 'Today',         fr: 'Aujourd\u2019hui',   sw: 'Leo',        ha: 'Yau',        tw: 'Ɛnnɛ',          hi: 'आज' },
  'daily.due.soon':        { en: 'Soon',          fr: 'Bientôt',             sw: 'Hivi karibuni', ha: 'Nan ba da daɗewa ba', tw: 'Ntɛm',     hi: 'जल्द' },
  'daily.due.this_week':   { en: 'This week',     fr: 'Cette semaine',       sw: 'Wiki hii',   ha: 'Wannan mako', tw: 'Saa dapɛn yi',  hi: 'इस हफ्ते' },

  // Section headers
  'daily.section.today':     { en: "Today's tasks",     fr: 'Tâches d\u2019aujourd\u2019hui', sw: 'Kazi za leo',   ha: 'Ayyukan yau',   tw: 'Ɛnnɛ adwuma',       hi: 'आज के कार्य' },
  'daily.section.this_week': { en: 'This week',         fr: 'Cette semaine',                sw: 'Wiki hii',       ha: 'Wannan mako',   tw: 'Saa dapɛn yi',      hi: 'इस हफ्ते' },
  'daily.empty':             { en: 'You\u2019re all caught up — check back tomorrow.', fr: 'Tout est fait — revenez demain.', sw: 'Kazi zote zimekamilika — angalia kesho.', ha: 'An gama duk ayyuka — dawo gobe.', tw: 'Wɔawie ne nyinaa — san bra ɔkyena.', hi: 'सब काम पूरे — कल फिर देखें।' },

  // ─── Pre-planting tasks ─────────────────────────────────────
  'daily.pre_planting.clear_land.title':     { en: 'Clear your land',                fr: 'Nettoyer votre terrain',          sw: 'Safisha shamba lako',          ha: 'Share filinka',            tw: 'Pra wo asase',                 hi: 'अपना खेत साफ़ करें' },
  'daily.pre_planting.clear_land.why':       { en: 'A clean field helps ridges sit well and reduces pests.', fr: 'Un terrain propre aide les buttes et réduit les ravageurs.', sw: 'Shamba safi husaidia matuta kukaa vizuri na kupunguza wadudu.', ha: 'Filin mai tsabta yana taimakawa kunuyi su zauna da rage kwari.', tw: 'Asase a ahyɛ pa no ma amoa si yie na ɛbrɛ mmoawa ase.', hi: 'साफ़ खेत से मेड़ अच्छी बैठती हैं और कीट कम लगते हैं।' },
  'daily.pre_planting.check_drainage.title': { en: 'Check drainage',                 fr: 'Vérifier le drainage',            sw: 'Angalia mifereji',             ha: 'Duba magudanar ruwa',      tw: 'Hwɛ nsuosene',                 hi: 'जल निकासी जांचें' },
  'daily.pre_planting.check_drainage.why':   { en: 'Good runoff prevents waterlogging when it rains.', fr: 'Un bon écoulement évite l\u2019engorgement.', sw: 'Mtiririko mzuri unazuia mafuriko.', ha: 'Kyakkyawan magudanar yana hana fiyayyen ruwa.', tw: 'Nsuosene pa bɔ w\u2019asase ho ban fri nsuo mu.', hi: 'अच्छी निकासी बारिश में जलभराव रोकती है।' },
  'daily.pre_planting.source_seed.title':    { en: 'Get your seeds ready',           fr: 'Préparer vos semences',           sw: 'Andaa mbegu zako',             ha: 'Shirya iri',               tw: 'Siesie w\u2019aba',            hi: 'बीज तैयार करें' },
  'daily.pre_planting.source_seed.why':      { en: 'Good seed is the foundation of a good harvest.', fr: 'De bonnes semences = bonne récolte.', sw: 'Mbegu nzuri ni msingi wa mavuno mazuri.', ha: 'Iri mai kyau shine tushen girbi mai kyau.', tw: 'Aba pa yɛ otwa pa nnyinasoɔ.', hi: 'अच्छे बीज अच्छी फसल की नींव हैं।' },
  'daily.pre_planting.mark_rows.title':      { en: 'Mark your planting rows',        fr: 'Marquer les rangées de semis',    sw: 'Weka alama za mistari ya kupanda', ha: 'Yi alamar layin shuka', tw: 'Yɛ nsɛnkyerɛnneɛ wɔ dua nsram so', hi: 'बुवाई की पंक्तियाँ चिह्नित करें' },
  'daily.pre_planting.mark_rows.why':        { en: 'Straight rows make weeding and spraying easier later.', fr: 'Des rangées droites facilitent désherbage et épandage.', sw: 'Mistari iliyonyooka hurahisisha palilio na dawa.', ha: 'Layin madaidaiciya yana sauƙaƙa ciyayi da feshi.', tw: 'Nsram a ɛtee yie ma ntuma ne aduro yɛ mmerɛw.', hi: 'सीधी पंक्तियाँ बाद में निराई-छिड़काव आसान करती हैं।' },
  'daily.pre_planting.prepare_ridges.title': { en: 'Prepare ridges',                 fr: 'Préparer les buttes',             sw: 'Andaa matuta',                 ha: 'Shirya kunuyi',            tw: 'Siesie amoa',                  hi: 'मेड़ तैयार करें' },
  'daily.pre_planting.prepare_ridges.why':   { en: 'Good ridges help cassava roots grow well.', fr: 'De bonnes buttes aident les racines de manioc.', sw: 'Matuta mazuri husaidia mizizi ya mihogo kukua vizuri.', ha: 'Kunuyi mai kyau yana taimakawa tushen rogo ya girma sosai.', tw: 'Amoa pa ma bankye ntwaho di yie.', hi: 'अच्छी मेड़ें कसावा की जड़ों की बढ़वार में मदद करती हैं।' },
  'daily.pre_planting.source_cuttings.title':{ en: 'Source cassava cuttings',        fr: 'Trouver des boutures de manioc',  sw: 'Tafuta vipande vya mihogo',    ha: 'Samo yankan rogo',         tw: 'Hwehwɛ bankye abaa',            hi: 'कसावा की टहनियाँ लाएँ' },
  'daily.pre_planting.source_cuttings.why':  { en: 'Healthy cuttings give a strong start.', fr: 'De bonnes boutures = bon départ.', sw: 'Vipande vya afya hutoa mwanzo mzuri.', ha: 'Yankan lafiya suna ba da farawa mai ƙarfi.', tw: 'Abaa a ho tesee ma mfitiaseɛ pa.', hi: 'स्वस्थ टहनियाँ मज़बूत शुरुआत देती हैं।' },
  'daily.pre_planting.plan_water.title':     { en: 'Plan your water supply',         fr: 'Planifier l\u2019eau',            sw: 'Panga maji',                   ha: 'Tsara ruwa',               tw: 'Siesie nsuo',                  hi: 'पानी की योजना बनाएँ' },
  'daily.pre_planting.plan_water.why':       { en: 'Rice needs reliable water from planting to harvest.', fr: 'Le riz a besoin d\u2019eau stable.', sw: 'Mpunga unahitaji maji ya kudumu.', ha: 'Shinkafa na bukatar ruwa mai ƙarfi.', tw: 'Ɛmo hia nsuo bere nyinaa.', hi: 'चावल को लगातार पानी चाहिए।' },

  // ─── Planting ──────────────────────────────────────────────
  'daily.planting.plant_seed.title':      { en: 'Plant your seeds',        fr: 'Semer vos graines',       sw: 'Panda mbegu zako',            ha: 'Shuka iri',         tw: 'Dua w\u2019aba',                hi: 'अपने बीज बोएँ' },
  'daily.planting.plant_seed.why':        { en: 'Plant within the window for best growth.', fr: 'Semer pendant la fenêtre optimale.', sw: 'Panda ndani ya muda mwafaka.', ha: 'Shuka a lokacin da ya dace.', tw: 'Dua wɔ bere pa mu.',           hi: 'सही समय पर बोएँ।' },
  'daily.planting.confirm_spacing.title': { en: 'Confirm plant spacing',   fr: 'Confirmer l\u2019espacement', sw: 'Thibitisha nafasi ya mimea',  ha: 'Tabbatar da nisa',  tw: 'Hwɛ sɛ afifideɛ ntam yɛ',       hi: 'दूरी सुनिश्चित करें' },
  'daily.planting.confirm_spacing.why':   { en: 'Proper spacing = stronger plants.', fr: 'Bon espacement = plantes plus fortes.', sw: 'Nafasi sahihi = mimea bora.', ha: 'Daidaitaccen nisa = shuka mai ƙarfi.', tw: 'Ntam a ɛfata = afifideɛ a ɛyɛ den.', hi: 'सही दूरी = मज़बूत पौधे।' },
  'daily.planting.water_after.title':     { en: 'Water after planting',    fr: 'Arroser après semis',     sw: 'Mwagilia baada ya kupanda',   ha: 'Shayar bayan shuka', tw: 'Fɔ nsuo wɔ akyi',              hi: 'बुवाई के बाद पानी दें' },
  'daily.planting.water_after.why':       { en: 'Moist soil helps seeds germinate.', fr: 'Un sol humide aide la germination.', sw: 'Udongo wenye unyevu husaidia kuota.', ha: 'Ƙasa mai ɗanshi na taimaka wa toho.', tw: 'Asase a ɛyɛ fɔ ma aba fifi.', hi: 'नम मिट्टी बीजों को अंकुरित करने में मदद करती है।' },
  'daily.planting.flood_field.title':     { en: 'Flood the field',         fr: 'Inonder la rizière',      sw: 'Jaza maji shambani',          ha: 'Cika fili da ruwa',  tw: 'Ma nsuo mmra afuo no mu',      hi: 'खेत में पानी भरें' },
  'daily.planting.flood_field.why':       { en: 'Rice needs standing water to establish.', fr: 'Le riz a besoin d\u2019eau stagnante.', sw: 'Mpunga unahitaji maji yaliyosimama.', ha: 'Shinkafa na bukatar ruwa mai tsaye.', tw: 'Ɛmo hwehwɛ nsuo a egyina.', hi: 'चावल को खड़े पानी की जरूरत है।' },

  // ─── Early growth ──────────────────────────────────────────
  'daily.early.inspect_emergence.title':  { en: 'Inspect crop emergence',  fr: 'Vérifier la levée',       sw: 'Kagua kuchipuka',             ha: 'Duba fitowar shuka', tw: 'Hwɛ sɛ afifideɛ afifiri',      hi: 'अंकुरण की जाँच करें' },
  'daily.early.inspect_emergence.why':    { en: 'Replant gaps early so the field stays even.', fr: 'Re-semer les trous tôt.', sw: 'Panda tena mapengo mapema.', ha: 'Sake shuka ramummuka da wuri.', tw: 'Dua nea afifiri da no bio ntɛm.', hi: 'खाली जगह जल्दी फिर से बोएँ।' },
  'daily.early.weed_control.title':       { en: 'Remove weeds',            fr: 'Désherber',               sw: 'Ng\u2019oa magugu',           ha: 'Cire ciyayi',        tw: 'Yi nhahan bɔne',                hi: 'खरपतवार हटाएँ' },
  'daily.early.weed_control.why':         { en: 'Weeds steal water and nutrients from young plants.', fr: 'Les mauvaises herbes volent l\u2019eau et les nutriments.', sw: 'Magugu huiba maji na virutubisho.', ha: 'Ciyayi suna satar ruwa da abinci.', tw: 'Nhahan bɔne gye nsuo ne aduane.', hi: 'खरपतवार पानी और पोषण छीनते हैं।' },
  'daily.early.check_pests.title':        { en: 'Check for pests',         fr: 'Vérifier les ravageurs',  sw: 'Kagua wadudu',                ha: 'Duba kwari',         tw: 'Hwɛ mmoawa',                   hi: 'कीटों की जाँच करें' },
  'daily.early.check_pests.why':          { en: 'Early detection prevents bigger losses.', fr: 'Une détection précoce évite les pertes.', sw: 'Kugundua mapema kunazuia hasara.', ha: 'Gano da wuri yana hana asara.', tw: 'Sɛ wohunu ntɛm a, adehweredeɛ renyɛ kɛseɛ.', hi: 'जल्दी पहचान से बड़ा नुकसान रुकता है।' },
  'daily.early.apply_fertilizer.title':   { en: 'Apply first fertilizer',  fr: 'Appliquer le premier engrais', sw: 'Weka mbolea ya kwanza',  ha: 'Saka takin farko',   tw: 'Fa asase aduro dii kan',        hi: 'पहली बार खाद दें' },
  'daily.early.apply_fertilizer.why':     { en: 'Young plants respond well to the first topdressing.', fr: 'Les jeunes plantes répondent bien à la première fertilisation.', sw: 'Mimea michanga huitikia mbolea ya kwanza vizuri.', ha: 'Shuke-shuke matasa suna amsawa ga taki na farko.', tw: 'Afifideɛ nketewa gye asase aduro di kan yie.', hi: 'नए पौधे पहली खाद को अच्छे से लेते हैं।' },

  // ─── Mid growth ────────────────────────────────────────────
  'daily.mid.monitor_moisture.title':  { en: 'Monitor soil moisture',    fr: 'Surveiller l\u2019humidité', sw: 'Fuatilia unyevu wa udongo',  ha: 'Sa ido ga ɗanshi',   tw: 'Hwɛ asase mu nsuo',              hi: 'मिट्टी की नमी देखें' },
  'daily.mid.monitor_moisture.why':    { en: 'Steady moisture keeps plants growing strong.', fr: 'L\u2019humidité stable garde les plantes fortes.', sw: 'Unyevu thabiti huweka mimea imara.', ha: 'Ɗanshi mai daidai yana riƙe shuka da ƙarfi.', tw: 'Nsuo a ɛyɛ papa ma afifideɛ gyina den.', hi: 'स्थिर नमी पौधों को मज़बूत रखती है।' },
  'daily.mid.check_pests.title':       { en: 'Scout for pests + disease', fr: 'Rechercher ravageurs + maladies', sw: 'Pekua wadudu na magonjwa',   ha: 'Bincika kwari da cututtuka', tw: 'Hwehwɛ mmoawa ne yadeɛ', hi: 'कीट व रोग जांचें' },
  'daily.mid.check_pests.why':         { en: 'Catch problems while they are small.', fr: 'Détectez tôt, perdez moins.', sw: 'Gundua matatizo yakiwa madogo.', ha: 'Gano matsaloli tun suna ƙanana.', tw: 'Hunu ɔhaw bere a ɛnkɔ akyirikyiri.', hi: 'समस्या छोटी हो तभी पकड़ें।' },
  'daily.mid.weed_control.title':      { en: 'Weed the field',          fr: 'Désherber le champ',         sw: 'Palilia shamba',              ha: 'Kashe ciyayi',      tw: 'Yi nhahan bɔne fi afuo no mu',   hi: 'खेत की निराई करें' },
  'daily.mid.weed_control.why':        { en: 'Keep weeds below the crop canopy.', fr: 'Garder les mauvaises herbes basses.', sw: 'Weka magugu chini ya zao.', ha: 'Riƙe ciyayi ƙasa da shuka.', tw: 'Ma nhahan bɔne nka afifideɛ no ase.', hi: 'खरपतवार फसल से नीचे रखें।' },
  'daily.mid.topdress.title':          { en: 'Top-dress fertilizer',    fr: 'Épandage d\u2019entretien',  sw: 'Mbolea ya juu',               ha: 'Taki na biyu',      tw: 'Fa asase aduro dii mprenu',      hi: 'दूसरी खाद दें' },
  'daily.mid.topdress.why':            { en: 'Mid-cycle nutrients boost yield.', fr: 'Les nutriments en milieu de cycle augmentent le rendement.', sw: 'Virutubisho vya kati vinaongeza mavuno.', ha: 'Abinci a tsakiyar lokaci yana ƙara girbi.', tw: 'Aduane wɔ afiri afa ma otwa pa.', hi: 'बीच-चक्र पोषण उपज बढ़ाता है।' },
  'daily.mid.manage_water.title':      { en: 'Manage paddy water level', fr: 'Gérer le niveau d\u2019eau du riz', sw: 'Dhibiti kiwango cha maji shambani', ha: 'Sarrafa matakin ruwa', tw: 'Kora ɛmo afuo mu nsuo so',   hi: 'धान का पानी संतुलित रखें' },
  'daily.mid.manage_water.why':        { en: 'Keep the field flooded but not over-deep.', fr: 'Gardez l\u2019eau sans excès.', sw: 'Weka shamba limejaa maji bila kufurika.', ha: 'Riƙe fili da ruwa, amma kada ya yi yawa.', tw: 'Ma afuo no hɔ nsuo, nanso mma no nnɔɔso.', hi: 'खेत में पानी रखें पर अधिक गहरा न हो।' },

  // ─── Harvest ───────────────────────────────────────────────
  'daily.harvest.check_readiness.title': { en: 'Check harvest readiness', fr: 'Vérifier la maturité', sw: 'Angalia utayari wa mavuno',  ha: 'Duba shirin girbi', tw: 'Hwɛ sɛ otwa berɛ adu',            hi: 'कटाई की तैयारी जाँचें' },
  'daily.harvest.check_readiness.why':   { en: 'Harvesting at the right time gives the best quality.', fr: 'Récolter au bon moment = meilleure qualité.', sw: 'Kuvuna kwa wakati sahihi hutoa ubora bora.', ha: 'Girbi a lokacin da ya dace = ingancin mafi kyau.', tw: 'Twa wɔ bere pa mu ma ade no yɛ papa.', hi: 'सही समय पर कटाई से गुणवत्ता बेहतर होती है।' },
  'daily.harvest.prepare_tools.title':   { en: 'Prepare harvesting tools', fr: 'Préparer les outils',  sw: 'Andaa vifaa vya kuvuna',     ha: 'Shirya kayan girbi', tw: 'Siesie twa nnwinneɛ',            hi: 'कटाई के औज़ार तैयार करें' },
  'daily.harvest.prepare_tools.why':     { en: 'Sharp, clean tools mean faster, cleaner harvest.', fr: 'Des outils propres = récolte plus rapide.', sw: 'Vifaa visafi na vikali = mavuno haraka.', ha: 'Kayan tsafta da kaifi = girbi da sauri.', tw: 'Nnwinneɛ a ɛyɛ papa ma twa ntɛm.', hi: 'तेज़-साफ़ औज़ार से कटाई तेज़ होती है।' },
  'daily.harvest.plan_labour.title':     { en: 'Plan harvest labour',     fr: 'Organiser la main-d\u2019œuvre', sw: 'Panga nguvu kazi ya mavuno', ha: 'Tsara aikin girbi',    tw: 'Siesie nnipa a wɔbɛtwa ho',       hi: 'कटाई के मज़दूरों की योजना' },
  'daily.harvest.plan_labour.why':       { en: 'Line up help early so the harvest isn\u2019t delayed.', fr: 'Préparez la main-d\u2019œuvre à temps.', sw: 'Panga msaada mapema ili usichelewe.', ha: 'Shirya taimako da wuri don kada a jinkirta.', tw: 'Siesie mmoa ntɛm na otwa no nkɔso akyiri.', hi: 'समय पर मदद तय कर लें।' },

  // ─── Post-harvest ──────────────────────────────────────────
  'daily.post.dry_and_store.title':    { en: 'Dry and store the harvest', fr: 'Sécher et stocker la récolte', sw: 'Kausha na hifadhi mavuno',     ha: 'Bushe kuma adana girbi',  tw: 'Hwie na kora wotwa adeɛ',  hi: 'फसल सुखाकर भंडारण करें' },
  'daily.post.dry_and_store.why':      { en: 'Dry storage keeps grain from spoiling.', fr: 'Un stockage sec évite la détérioration.', sw: 'Hifadhi kavu inazuia kuharibika.', ha: 'Adana mai bushewa yana hana lalacewa.', tw: 'Faako a ɛyɛ wo ma aburow no nsɛe.', hi: 'सूखा भंडारण अनाज को ख़राब होने से बचाता है।' },
  'daily.post.record_yield.title':     { en: 'Record your yield',         fr: 'Enregistrer votre récolte',     sw: 'Rekodi mavuno yako',           ha: 'Rubuta girbi',             tw: 'Kyerɛ wo twa ho nsɛm',    hi: 'उपज दर्ज करें' },
  'daily.post.record_yield.why':       { en: 'Tracking yield helps plan next season.', fr: 'Suivre le rendement aide pour la saison prochaine.', sw: 'Kurekodi mavuno husaidia kupanga msimu ujao.', ha: 'Rubuta girbi yana taimakawa tsara lokaci mai zuwa.', tw: 'Otwa ho nkyerɛkyerɛmu boa afe a ɛdi hɔ ho nhyehyɛe.', hi: 'उपज का रिकॉर्ड अगले मौसम की योजना में मदद करता है।' },
  'daily.post.plan_next_cycle.title':  { en: 'Plan your next cycle',      fr: 'Planifier le cycle suivant',    sw: 'Panga msimu ujao',             ha: 'Tsara zagaye na gaba',    tw: 'Siesie afiri a ɛdi hɔ',   hi: 'अगले चक्र की योजना बनाएँ' },
  'daily.post.plan_next_cycle.why':    { en: 'Rotating crops keeps soil healthy.', fr: 'La rotation des cultures préserve le sol.', sw: 'Kubadilishana mazao huweka udongo wenye afya.', ha: 'Juyawar amfanin gona yana kiyaye ƙasa lafiya.', tw: 'Nnɔbae ahodoɔ dua ma asase tena nkwa mu.', hi: 'फसल चक्र से मिट्टी स्वस्थ रहती है।' },

  // ─── Farmer journey summary card ────────────────────────────
  'journey.summary.header':     { en: 'Your farm today',      fr: 'Votre ferme aujourd\u2019hui', sw: 'Shamba lako leo',     ha: 'Gonarka yau',              tw: 'Wo kuayɛ ɛnnɛ',             hi: 'आज आपका खेत' },
  'journey.summary.crop':       { en: 'Crop',                 fr: 'Culture',                      sw: 'Zao',                  ha: 'Amfanin gona',             tw: 'Afudeɛ',                    hi: 'फसल' },
  'journey.summary.stage':      { en: 'Stage',                fr: 'Étape',                        sw: 'Hatua',                ha: 'Mataki',                   tw: 'Gyinaberɛ',                 hi: 'चरण' },
  'journey.summary.next_step':  { en: 'Next step',            fr: 'Prochaine étape',              sw: 'Hatua inayofuata',     ha: 'Mataki na gaba',           tw: 'Adeyɛ a ɛdi hɔ',            hi: 'अगला कदम' },
  'journey.summary.continue':   { en: 'Continue',             fr: 'Continuer',                    sw: 'Endelea',              ha: 'Ci gaba',                  tw: 'Toa so',                    hi: 'जारी रखें' },
  'journey.unknown_crop':       { en: 'Not selected',         fr: 'Non sélectionnée',             sw: 'Haijachaguliwa',       ha: 'Ba a zaɓa ba',             tw: 'Wɔmpaaw',                   hi: 'अभी नहीं चुनी' },

  'journey.state.onboarding':     { en: 'Setting up',         fr: 'Configuration',                sw: 'Kuandaa',              ha: 'Shirye-shirye',            tw: 'Siesie',                    hi: 'सेटअप' },
  'journey.state.crop_selected':  { en: 'Crop chosen',        fr: 'Culture choisie',              sw: 'Zao limechaguliwa',    ha: 'An zaɓi amfani',           tw: 'Wɔapaw afudeɛ',             hi: 'फसल चुनी' },
  'journey.state.planning':       { en: 'Planning',           fr: 'Planification',                sw: 'Kupanga',              ha: 'Tsara',                    tw: 'Nhyehyɛe',                  hi: 'योजना' },
  'journey.state.active_farming': { en: 'Active farming',     fr: 'Culture en cours',             sw: 'Kilimo hai',           ha: 'Noma mai aiki',            tw: 'Kuayɛ a ɛrekɔ so',          hi: 'सक्रिय खेती' },
  'journey.state.harvest':        { en: 'Harvest time',       fr: 'Période de récolte',           sw: 'Wakati wa mavuno',     ha: 'Lokacin girbi',            tw: 'Otwa berɛ',                 hi: 'कटाई का समय' },
  'journey.state.post_harvest':   { en: 'Post-harvest',       fr: 'Après récolte',                sw: 'Baada ya mavuno',      ha: 'Bayan girbi',              tw: 'Otwa akyi',                 hi: 'कटाई के बाद' },

  // ─── Notification feed (v1) ─────────────────────────────────
  'notifications.feed.title':       { en: 'Notifications',      fr: 'Notifications',            sw: 'Arifa',                ha: 'Sanarwa',                  tw: 'Nkra',                      hi: 'सूचनाएँ' },
  'notifications.feed.empty':       { en: 'You have no notifications yet.', fr: 'Aucune notification pour l\u2019instant.', sw: 'Bado hakuna arifa.', ha: 'Babu sanarwa tukuna.', tw: 'Nkra biara nni hɔ.', hi: 'अभी कोई सूचना नहीं है।' },
  'notifications.feed.mark_read':   { en: 'Mark as read',       fr: 'Marquer comme lu',         sw: 'Weka kama imesomwa',   ha: 'Sanya a matsayin an karanta', tw: 'Fa sɛ wɔakenkan',       hi: 'पढ़ा हुआ चिह्नित करें' },
  'notifications.feed.mark_all':    { en: 'Mark all as read',   fr: 'Tout marquer comme lu',    sw: 'Weka zote kama zimesomwa', ha: 'Sanya duka a karanta', tw: 'Fa ne nyinaa sɛ wɔakenkan', hi: 'सभी को पढ़ा हुआ मानें' },
  'notifications.feed.view_all':    { en: 'View all',           fr: 'Tout voir',                sw: 'Tazama zote',          ha: 'Duba duk',                 tw: 'Hwɛ ne nyinaa',             hi: 'सभी देखें' },

  'notifications.priority.high':    { en: 'High',               fr: 'Élevée',                   sw: 'Juu',                  ha: 'Babba',                    tw: 'Ɛso',                       hi: 'उच्च' },
  'notifications.priority.medium':  { en: 'Medium',             fr: 'Moyenne',                  sw: 'Wastani',              ha: 'Matsakaici',               tw: 'Ntam',                      hi: 'मध्यम' },
  'notifications.priority.low':     { en: 'Low',                fr: 'Faible',                   sw: 'Chini',                ha: 'Ƙasa',                     tw: 'Ase',                       hi: 'निम्न' },

  'notifications.feed.daily_pending':    { en: 'You have {count} tasks to complete today.',    fr: 'Vous avez {count} tâches à terminer aujourd\u2019hui.',  sw: 'Una kazi {count} za kukamilisha leo.',            ha: 'Kana da ayyuka {count} na yau.',                  tw: 'Wowɔ adwuma {count} a ɛsɛ sɛ woyɛ ɛnnɛ.',           hi: 'आज आपके पास {count} कार्य बाकी हैं।' },
  'notifications.feed.missed_yesterday': { en: 'You missed yesterday\u2019s tasks — let\u2019s get back on track.', fr: 'Vous avez manqué les tâches d\u2019hier — reprenons.', sw: 'Ulikosa kazi za jana — turudi kwenye mstari.', ha: "Kun rasa ayyukan jiya — mu koma kan hanya.",     tw: "Woantumi annyɛ ɛnnɛra adwuma — momma yɛnsan mmɔ mu.", hi: 'आप कल के कार्य चूक गए — वापस पटरी पर लौटें।' },
  'notifications.feed.stage_entered':    { en: 'Your farm has moved to a new stage.',          fr: 'Votre ferme entre dans une nouvelle étape.',            sw: 'Shamba lako limeingia hatua mpya.',              ha: 'Gonarka ta shiga sabon mataki.',                  tw: 'Wo kuayɛ akɔ gyinaberɛ foforɔ.',                    hi: 'आपका खेत एक नए चरण में पहुँचा है।' },
  'notifications.feed.harvest_nearing':  { en: 'Harvest season is approaching — prepare soon.', fr: 'La récolte approche — préparez-vous.',                  sw: 'Mavuno yanakaribia — jiandae hivi karibuni.',    ha: 'Lokacin girbi yana gabatowa — shirya.',           tw: 'Otwa berɛ rebɛn — siesie wo ho.',                   hi: 'कटाई का समय निकट है — तैयारी करें।' },
  'notifications.feed.inactivity':       { en: 'It\u2019s been {days} days — check in on your farm.', fr: 'Cela fait {days} jours — revenez voir votre ferme.', sw: 'Imepita siku {days} — angalia shamba lako.',     ha: 'Kwana {days} sun wuce — duba gonarka.',           tw: 'Nna {days} atwam — hwɛ wo kuayɛ.',                 hi: '{days} दिन हो गए — अपने खेत को देखें।' },

  // ─── Reports — printable + export ───────────────────────────
  'reports.print.title':            { en: 'Farroway program report',                fr: 'Rapport de programme Farroway',             sw: 'Ripoti ya programu ya Farroway',           ha: 'Rahoton shirin Farroway',                 tw: 'Farroway nhyehyɛe nkrataasɛm',                hi: 'फैरोवे कार्यक्रम रिपोर्ट' },
  'reports.print.generated':        { en: 'Generated',                              fr: 'Généré',                                    sw: 'Imetolewa',                                ha: 'An samar',                                tw: 'Wɔayɛ',                                        hi: 'तैयार' },
  'reports.print.total':            { en: 'Total farmers',                          fr: 'Agriculteurs au total',                     sw: 'Wakulima wote',                            ha: 'Jimillar manoma',                         tw: 'Akuafoɔ nyinaa',                               hi: 'कुल किसान' },
  'reports.print.active':           { en: 'Active (7d)',                            fr: 'Actifs (7j)',                               sw: 'Wanaoshughulika (siku 7)',                 ha: 'Masu aiki (kwana 7)',                     tw: 'Wɔrekɔ so (nnanson)',                          hi: 'सक्रिय (7 दिन)' },
  'reports.print.inactive':         { en: 'Inactive',                               fr: 'Inactifs',                                  sw: 'Wasioshughulika',                          ha: 'Marasa aiki',                             tw: 'Wɔnyɛ adwuma',                                  hi: 'निष्क्रिय' },
  'reports.print.recent_signups':   { en: 'Signups (30d)',                          fr: 'Inscriptions (30j)',                        sw: 'Usajili (siku 30)',                        ha: 'Sabbin rajistar (kwana 30)',              tw: 'Nkyerɛw (nnadu)',                              hi: 'पंजीकरण (30 दिन)' },
  'reports.print.tasks_completed':  { en: 'Tasks completed',                        fr: 'Tâches terminées',                          sw: 'Kazi zilizokamilika',                      ha: 'Ayyukan da aka gama',                     tw: 'Adwuma a wɔawie',                              hi: 'पूरे किए गए कार्य' },
  'reports.print.crops':            { en: 'Crops',                                  fr: 'Cultures',                                  sw: 'Mazao',                                    ha: 'Amfanin gona',                            tw: 'Afudeɛ',                                       hi: 'फसलें' },
  'reports.print.regions':          { en: 'Regions',                                fr: 'Régions',                                   sw: 'Mikoa',                                    ha: 'Yankuna',                                 tw: 'Mpɔtam',                                       hi: 'क्षेत्र' },
  'reports.print.stages':           { en: 'Stages',                                 fr: 'Étapes',                                    sw: 'Hatua',                                    ha: 'Matakai',                                 tw: 'Gyinaberɛ',                                    hi: 'चरण' },
  'reports.print.farmers':          { en: 'Farmers',                                fr: 'Agriculteurs',                              sw: 'Wakulima',                                 ha: 'Manoma',                                  tw: 'Akuafoɔ',                                      hi: 'किसान' },
  'reports.print.print_cta':        { en: 'Print',                                  fr: 'Imprimer',                                  sw: 'Chapisha',                                 ha: 'Buga',                                    tw: 'Tintim',                                       hi: 'प्रिंट' },
  'reports.print.program':          { en: 'Program',                                fr: 'Programme',                                 sw: 'Programu',                                 ha: 'Shiri',                                   tw: 'Nhyehyɛe',                                     hi: 'कार्यक्रम' },
  'reports.print.empty':            { en: 'No farmers match these filters.',        fr: 'Aucun agriculteur ne correspond à ces filtres.', sw: 'Hakuna mkulima anayelingana na vichujio hivi.', ha: "Babu manomi da suka dace da waɗannan matatattun.", tw: 'Akuafoɔ biara nni hɔ a ɛbɛfa saa nhwɛsoɔ yi.', hi: 'इन फ़िल्टर से कोई किसान मेल नहीं खाता।' },

  'reports.export.csv':             { en: 'Download CSV',                           fr: 'Télécharger CSV',                           sw: 'Pakua CSV',                                ha: 'Sauke CSV',                               tw: 'Twe CSV',                                      hi: 'CSV डाउनलोड' },
  'reports.export.unavailable':     { en: 'Download is not available on this device.', fr: 'Téléchargement non disponible sur cet appareil.', sw: 'Upakuaji haupatikani kwenye kifaa hiki.', ha: 'Saukewa ba a samu a wannan na\u2019ura ba.', tw: 'Twe nni hɔ wɔ afidie yi so.',             hi: 'इस डिवाइस पर डाउनलोड उपलब्ध नहीं है।' },
  'reports.export.failed':          { en: 'Export failed. Please try again.',       fr: 'Échec de l\u2019export. Réessayez.',        sw: 'Usafirishaji umeshindikana. Jaribu tena.', ha: 'Fitarwa ta gaza. Sake gwadawa.',          tw: 'Fi yɛɛ nnwo. San bɔ mmɔden.',                   hi: 'निर्यात विफल। कृपया फिर प्रयास करें।' },

  // ─── Settings page — notifications block ────────────────────
  'settings.notifications.title':             { en: 'Notifications',        fr: 'Notifications',          sw: 'Arifa',                  ha: 'Sanarwa',                     tw: 'Nkra',                       hi: 'सूचनाएँ' },
  'settings.notifications.daily':             { en: 'Daily reminders',      fr: 'Rappels quotidiens',     sw: 'Ukumbusho wa kila siku', ha: 'Tunatarwa ta yau da kullun',  tw: 'Daa nkaeɛ',                  hi: 'दैनिक रिमाइंडर' },
  'settings.notifications.time':              { en: 'Reminder time',        fr: "Heure du rappel",        sw: 'Muda wa ukumbusho',      ha: 'Lokacin tunatarwa',           tw: 'Nkaeɛ berɛ',                 hi: 'रिमाइंडर समय' },
  'settings.notifications.browser':           { en: 'Browser notifications',fr: 'Notifications navigateur',sw: 'Arifa za kivinjari',    ha: 'Sanarwar mai bincike',        tw: 'Browser nkra',               hi: 'ब्राउज़र सूचनाएँ' },
  'settings.notifications.email':             { en: 'Email reminders',      fr: 'Rappels par e-mail',     sw: 'Ukumbusho wa barua pepe',ha: 'Tunatarwa ta imel',           tw: 'Email nkaeɛ',                hi: 'ईमेल रिमाइंडर' },
  'settings.notifications.criticalOnly':      { en: 'Critical alerts only', fr: "Alertes critiques uniquement", sw: 'Tahadhari muhimu pekee', ha: 'Faɗakarwa masu muhimmanci kawai', tw: 'Asiane kɛseɛ nkoara', hi: 'केवल महत्वपूर्ण चेतावनी' },
  'settings.notifications.permissionDenied':  { en: 'Notifications blocked by the browser.', fr: 'Notifications bloquées par le navigateur.', sw: 'Arifa zimezuiwa na kivinjari.', ha: 'Sanarwa ta toshe ta mai bincike.', tw: "Browser no asiw nkra no kwan.", hi: 'ब्राउज़र ने सूचनाएँ अवरुद्ध की हैं।' },
  'settings.notifications.unsupported':       { en: 'This browser does not support notifications.', fr: 'Ce navigateur ne prend pas en charge les notifications.', sw: 'Kivinjari hiki hakihimili arifa.', ha: 'Wannan mai binciken baya goyon bayan sanarwa.', tw: 'Browser yi nnye nkra no.', hi: 'यह ब्राउज़र सूचनाओं का समर्थन नहीं करता।' },
  'actionHome.secondary.title':      { en: 'Up next',                  fr: 'À venir',            sw: 'Inayofuata',           ha: 'Na gaba',               tw: 'Nea edi so',             hi: 'आगे के कार्य' },
  'actionHome.secondary.empty':      { en: 'Nothing else scheduled.',  fr: 'Rien d\'autre.',     sw: 'Hakuna zaidi.',        ha: 'Babu sauran.',          tw: 'Biribi nso nni hɔ.',     hi: 'आगे कोई कार्य नहीं' },
  'actionHome.risks.title':          { en: 'Risk alerts',              fr: 'Alertes risque',     sw: 'Tahadhari za hatari',  ha: 'Faɗakarwar haɗari',     tw: 'Asiane nkra',            hi: 'जोखिम सूचनाएँ' },
  'actionHome.risks.none':           { en: 'No active risks.',          fr: 'Aucun risque actif.', sw: 'Hakuna hatari.',      ha: 'Babu haɗari.',          tw: 'Asiane biara nni hɔ.',  hi: 'कोई सक्रिय जोखिम नहीं' },
  'actionHome.progress.title':       { en: 'Your progress',            fr: 'Votre progrès',      sw: 'Maendeleo yako',       ha: 'Ci gaban ku',           tw: 'Wo nkɔso',               hi: 'आपकी प्रगति' },
  'actionHome.progress.tasksDone':   { en: 'Tasks done',               fr: 'Tâches faites',      sw: 'Kazi zilizofanyika',    ha: 'Ayyukan da aka gama',  tw: 'Adwuma a wɔawie',        hi: 'पूरे कार्य' },
  'actionHome.progress.cyclesActive':{ en: 'Active crop cycles',       fr: 'Cycles actifs',      sw: 'Mizunguko hai',         ha: 'Ayyukan da suke gudana',tw: 'Afudeɛ adwuma',          hi: 'सक्रिय फसल चक्र' },
  'actionHome.progress.seeMore':     { en: 'See full progress',        fr: 'Voir plus',          sw: 'Tazama zaidi',          ha: 'Duba ƙari',             tw: 'Hwɛ pii',                hi: 'और देखें' },
  'actionHome.progress.status.onTrack':        { en: 'On track',        hi: 'सही रास्ते पर',   tw: 'Ɛkɔ yie',         es: 'En marcha',           pt: 'No caminho certo',    fr: 'Sur la bonne voie', ar: 'في المسار الصحيح', sw: 'Unaenda vizuri',          id: 'Di jalur yang tepat' },
  'actionHome.progress.status.slightDelay':    { en: 'Slight delay',    hi: 'थोड़ी देरी',      tw: 'Akyire kakra',    es: 'Ligero retraso',      pt: 'Leve atraso',         fr: 'Léger retard',      ar: 'تأخر بسيط',        sw: 'Kuchelewa kidogo',        id: 'Sedikit terlambat' },
  'actionHome.progress.status.needsAttention': { en: 'Needs attention', hi: 'ध्यान की जरूरत',  tw: 'Hia adwene',      es: 'Necesita atención',   pt: 'Precisa de atenção',  fr: 'Demande attention', ar: 'يحتاج انتباه',    sw: 'Inahitaji umakini',       id: 'Perlu perhatian' },
  'actionHome.nextHint.label':       { en: 'Next:', hi: 'आगे:', tw: 'Nea ɛdi hɔ:', es: 'Siguiente:', pt: 'Próximo:', fr: 'Ensuite :', ar: 'التالي:', sw: 'Ifuatayo:', id: 'Berikutnya:' },

  // ─── Today: 2-state system (ACTIVE vs DONE) ─────────────
  'today.done.title':                { en: 'All done for today', hi: 'आज का सब काम पूरा',      tw: 'Nnɛ adwuma nyinaa awie',            es: 'Todo listo por hoy',           pt: 'Tudo feito por hoje',          fr: "C'est terminé pour aujourd'hui", ar: 'انتهى عمل اليوم',    sw: 'Kazi zote za leo zimekamilika',   id: 'Semua selesai hari ini' },
  'today.done.body':                 { en: "You're on track. Great work.", hi: 'आप सही रास्ते पर हैं। बहुत बढ़िया।', tw: 'Woreyɛ yiye. Adwuma pa.',  es: 'Vas bien encaminado. Buen trabajo.', pt: 'Você está no caminho certo. Ótimo trabalho.', fr: 'Vous êtes sur la bonne voie. Bon travail.', ar: 'أنت في المسار الصحيح. عمل رائع.', sw: 'Unaenda vizuri. Kazi nzuri.', id: 'Anda di jalur yang tepat. Kerja bagus.' },
  'today.done.donePill':             { en: '{done} of {total} done', hi: '{done} में से {total} पूरे', tw: '{done} wɔ {total} awie', es: '{done} de {total} listas', pt: '{done} de {total} concluídas', fr: '{done} sur {total} terminées', ar: '{done} من {total} مكتملة', sw: '{done} kati ya {total} zimekamilika', id: '{done} dari {total} selesai' },
  'today.optional.title':            { en: 'Optional checks', hi: 'वैकल्पिक जांच', tw: 'Nhwehwɛmu foforɔ',  es: 'Revisiones opcionales', pt: 'Verificações opcionais', fr: 'Vérifications optionnelles', ar: 'فحوصات اختيارية', sw: 'Ukaguzi wa hiari', id: 'Pemeriksaan opsional' },
  'today.optional.badge':            { en: 'optional', hi: 'वैकल्पिक',   tw: 'sɛ wopɛ a',         es: 'opcional',               pt: 'opcional',                    fr: 'optionnel',                        ar: 'اختياري',               sw: 'hiari',                          id: 'opsional' },
  'today.optional.scanCrop':         { en: 'Scan crop for issues',    hi: 'फसल में समस्याओं की जांच',    tw: 'Hwehwɛ afudeɛ no so nsɛm',          es: 'Revisa el cultivo en busca de problemas', pt: 'Verifique problemas na cultura',  fr: 'Inspecter la culture pour des problèmes', ar: 'افحص المحصول بحثًا عن مشكلات',  sw: 'Kagua zao kuhusu matatizo',             id: 'Pindai tanaman untuk masalah' },
  'today.optional.scanCrop.why':     { en: 'Catch pests or disease early',  hi: 'कीट या रोग जल्दी पकड़ें',  tw: 'Hu mmoawa anaa yadeɛ ntɛm',         es: 'Detecta plagas o enfermedades a tiempo', pt: 'Detecte pragas ou doenças cedo', fr: 'Détectez les ravageurs tôt',      ar: 'اكتشف الآفات أو الأمراض مبكرًا', sw: 'Gundua wadudu au magonjwa mapema',      id: 'Temukan hama atau penyakit sejak dini' },
  'today.optional.inspectField':     { en: 'Check field condition',    hi: 'खेत की स्थिति देखें',       tw: 'Hwɛ afuo no tebea',                 es: 'Revisa la condición del campo',          pt: 'Verifique a condição do campo', fr: "Vérifier l'état du champ",          ar: 'تحقق من حالة الحقل',             sw: 'Kagua hali ya shamba',                  id: 'Periksa kondisi lahan' },
  'today.optional.inspectField.why': { en: 'Quick walk-through keeps you ahead', hi: 'थोड़ी देर टहलने से मदद मिलती है', tw: 'Nantew afuo no mu kakra',        es: 'Un recorrido rápido te mantiene a la vanguardia', pt: 'Uma caminhada rápida ajuda',  fr: 'Une courte visite vous fait gagner du temps', ar: 'جولة سريعة تبقيك متقدمًا',   sw: 'Matembezi mafupi yanakusaidia',       id: 'Keliling cepat membantu Anda' },
  'today.optional.reviewStatus':     { en: 'Review crop status',       hi: 'फसल की स्थिति की समीक्षा',   tw: 'Hwɛ afudeɛ no tebea',              es: 'Revisa el estado del cultivo',           pt: 'Revise o estado da cultura',   fr: "Examiner l'état de la culture",   ar: 'راجع حالة المحصول',             sw: 'Kagua hali ya zao',                     id: 'Tinjau status tanaman' },
  'today.optional.reviewStatus.why': { en: 'See how your crop is doing', hi: 'देखें फसल कैसी है',       tw: 'Hwɛ sɛnea wo afudeɛ no reyɛ',       es: 'Ve cómo va tu cultivo',                  pt: 'Veja como está sua cultura',   fr: 'Voyez comment va votre culture',  ar: 'اطّلع على وضع محصولك',         sw: 'Ona jinsi zao lako linavyoendelea',     id: 'Lihat bagaimana tanaman Anda' },
  'today.nextHint.noMoreToday':      { en: 'No more tasks today',      hi: 'आज और कोई काम नहीं',        tw: 'Adwuma biara nni hɔ ɛnnɛ',         es: 'No hay más tareas hoy',                  pt: 'Sem mais tarefas hoje',        fr: 'Plus de tâches aujourd\'hui',       ar: 'لا مزيد من المهام اليوم',     sw: 'Hakuna kazi zaidi leo',                  id: 'Tidak ada tugas lagi hari ini' },
  'today.nextHint.keepGoing':        { en: 'Keep going — one step at a time', hi: 'चलते रहें — एक कदम एक बार', tw: 'Toa so — anammɔn baako', es: 'Sigue — un paso a la vez',       pt: 'Continue — um passo por vez',  fr: 'Continuez — un pas à la fois',    ar: 'واصل — خطوة تلو الأخرى',    sw: 'Endelea — hatua moja kwa moja',         id: 'Lanjutkan — selangkah demi selangkah' },

  // ─── Post-harvest summary page ─────────────────────────
  'postHarvest.title':               { en: 'Harvest recorded',         hi: 'फसल दर्ज हो गई',          tw: 'Wɔakyerɛw wo twa no',           es: 'Cosecha registrada',          pt: 'Colheita registrada',          fr: 'Récolte enregistrée',           ar: 'تم تسجيل الحصاد',    sw: 'Mavuno yamerekodiwa',            id: 'Panen tercatat' },
  'postHarvest.loadError':           { en: 'Could not load your summary.', hi: 'सारांश लोड नहीं हो सका।', tw: 'Yɛantumi ankan wo mpɔtam sɛm no.', es: 'No se pudo cargar tu resumen.', pt: 'Não foi possível carregar o resumo.', fr: 'Impossible de charger votre résumé.', ar: 'تعذر تحميل الملخص.', sw: 'Imeshindwa kupakia muhtasari.', id: 'Gagal memuat ringkasan.' },
  'postHarvest.backToToday':         { en: 'Back to Today',            hi: 'आज पर लौटें',              tw: 'San kɔ Nnɛ',                    es: 'Volver a Hoy',                pt: 'Voltar para Hoje',             fr: 'Retour à Aujourd\'hui',          ar: 'العودة إلى اليوم',   sw: 'Rudi kwa Leo',                   id: 'Kembali ke Hari Ini' },
  'postHarvest.startNext':           { en: 'Start next crop',          hi: 'अगली फसल शुरू करें',       tw: 'Fi afudeɛ foforɔ ase',          es: 'Iniciar próximo cultivo',     pt: 'Iniciar próxima cultura',      fr: 'Démarrer la prochaine culture',  ar: 'ابدأ المحصول التالي',  sw: 'Anza zao linalofuata',           id: 'Mulai tanaman berikutnya' },
  'postHarvest.sellPrompt':          { en: 'Do you want to sell this harvest?', hi: 'क्या आप यह फसल बेचना चाहते हैं?', tw: 'So wopɛ sɛ wotɔn twa yi?', es: '¿Quieres vender esta cosecha?', pt: 'Quer vender esta colheita?', fr: 'Voulez-vous vendre cette récolte ?', ar: 'هل تريد بيع هذا الحصاد؟', sw: 'Unataka kuuza mavuno haya?', id: 'Apakah Anda ingin menjual panen ini?' },

  // ─── Marketplace v1 — farmer + buyer ────────────────────
  'market.myListings.title':         { en: 'My listings',                hi: 'मेरी लिस्टिंग',              tw: "Me adetɔn",                   es: 'Mis publicaciones',           pt: 'Minhas publicações',           fr: 'Mes annonces',                  ar: 'إعلاناتي',           sw: 'Matangazo yangu',               id: 'Daftar saya' },
  'market.myListings.create':        { en: 'New listing',                hi: 'नई लिस्टिंग',                tw: 'Adetɔn foforɔ',                es: 'Nueva publicación',           pt: 'Nova publicação',              fr: 'Nouvelle annonce',              ar: 'إعلان جديد',         sw: 'Tangazo jipya',                  id: 'Daftar baru' },
  'market.myListings.all':           { en: 'All listings',               hi: 'सभी लिस्टिंग',              tw: 'Adetɔn nyinaa',                es: 'Todas',                       pt: 'Todas',                        fr: 'Toutes les annonces',            ar: 'كل الإعلانات',       sw: 'Yote',                            id: 'Semua' },
  'market.myListings.empty':         { en: 'No listings yet',            hi: 'अभी कोई लिस्टिंग नहीं',      tw: 'Adetɔn biara nni hɔ',          es: 'Aún no hay publicaciones',    pt: 'Ainda sem publicações',        fr: 'Pas encore d\'annonce',          ar: 'لا توجد إعلانات بعد',sw: 'Bado hakuna matangazo',         id: 'Belum ada daftar' },
  'market.myListings.emptyHint':     { en: 'Post your next harvest to reach buyers.', hi: 'अपनी अगली फसल पोस्ट करें।', tw: 'Fa wo twa foforɔ to so ma atɔfo nhu.', es: 'Publica tu próxima cosecha para llegar a compradores.', pt: 'Publique a próxima colheita para alcançar compradores.', fr: 'Publiez votre prochaine récolte pour toucher les acheteurs.', ar: 'انشر حصادك القادم للوصول إلى المشترين.', sw: 'Weka tangazo la mavuno yako.', id: 'Tampilkan panen berikutnya.' },
  'market.myListings.error':         { en: 'Could not load listings.',   hi: 'लिस्टिंग लोड नहीं हो सकी।',   tw: 'Yɛantumi ankyerɛ adetɔn',      es: 'No se pudieron cargar.',       pt: 'Não foi possível carregar.',    fr: 'Impossible de charger.',         ar: 'تعذر التحميل.',       sw: 'Imeshindwa kupakia.',            id: 'Gagal memuat.' },
  'market.browse.title':             { en: 'Browse listings',            hi: 'लिस्टिंग देखें',            tw: 'Hwɛ adetɔn',                   es: 'Buscar publicaciones',        pt: 'Procurar publicações',         fr: 'Parcourir les annonces',         ar: 'تصفح الإعلانات',     sw: 'Angalia matangazo',              id: 'Jelajahi daftar' },
  'market.browse.search':            { en: 'Search',                     hi: 'खोजें',                     tw: 'Hwehwɛ',                        es: 'Buscar',                       pt: 'Buscar',                        fr: 'Rechercher',                     ar: 'بحث',                 sw: 'Tafuta',                          id: 'Cari' },
  'market.browse.results':           { en: '{count} listings',           hi: '{count} लिस्टिंग',          tw: 'Adetɔn {count}',                es: '{count} publicaciones',        pt: '{count} publicações',          fr: '{count} annonces',               ar: '{count} إعلان',      sw: 'Matangazo {count}',              id: '{count} daftar' },
  'market.browse.error':             { en: 'Could not search.',          hi: 'खोज नहीं हो सकी।',           tw: 'Yɛantumi ahwehwɛ.',            es: 'No se pudo buscar.',          pt: 'Não foi possível buscar.',     fr: 'Recherche impossible.',          ar: 'تعذر البحث.',         sw: 'Imeshindwa kutafuta.',           id: 'Gagal mencari.' },
  'market.detail.notes':             { en: 'Seller notes',               hi: 'विक्रेता नोट्स',             tw: 'Ɔtɔnni nsɛm',                   es: 'Notas del vendedor',          pt: 'Notas do vendedor',            fr: 'Notes du vendeur',               ar: 'ملاحظات البائع',      sw: 'Maelezo ya muuzaji',             id: 'Catatan penjual' },
  'market.detail.notFound':          { en: 'Listing not found.',         hi: 'लिस्टिंग नहीं मिली।',         tw: 'Adetɔn no nni hɔ.',            es: 'Publicación no encontrada.',   pt: 'Publicação não encontrada.',   fr: 'Annonce introuvable.',           ar: 'الإعلان غير موجود.', sw: 'Tangazo halijapatikana.',        id: 'Daftar tidak ditemukan.' },
  'market.detail.contactNote':       { en: 'Contact info will be shared after the farmer accepts your interest.', hi: 'किसान द्वारा आपकी रुचि स्वीकार करने के बाद संपर्क जानकारी साझा की जाएगी।', tw: 'Yɛbɛma wo nea ɛho hia bere a okuafoɔ no bɛpene so.', es: 'La información de contacto se compartirá cuando el agricultor acepte tu interés.', pt: 'As informações de contacto serão partilhadas após o agricultor aceitar o seu interesse.', fr: 'Les coordonnées seront partagées après acceptation du fermier.', ar: 'ستتم مشاركة معلومات الاتصال بعد أن يقبل المزارع اهتمامك.', sw: 'Maelezo ya mawasiliano yatashirikiwa baada ya mkulima kukubali.', id: 'Info kontak akan dibagikan setelah petani menerima minat Anda.' },
  'market.interest.title':           { en: 'Tell the farmer what you need', hi: 'किसान को बताएं क्या चाहिए',   tw: 'Ka kyerɛ okuafoɔ deɛ wohia',    es: 'Dile al agricultor qué necesitas', pt: 'Diga ao agricultor o que precisa', fr: 'Dites au fermier ce qu\'il vous faut', ar: 'أخبر المزارع بما تحتاج', sw: 'Mweleze mkulima kile unachohitaji', id: 'Beri tahu petani kebutuhan Anda' },
  'market.interest.quantity':        { en: 'Quantity needed',            hi: 'मात्रा',                     tw: 'Dodoɔ a wohia',                 es: 'Cantidad',                    pt: 'Quantidade',                    fr: 'Quantité',                       ar: 'الكمية',              sw: 'Kiasi kinachohitajika',          id: 'Jumlah yang dibutuhkan' },
  'market.interest.offered':         { en: 'Offered price (optional)',   hi: 'प्रस्तावित कीमत (वैकल्पिक)',  tw: 'Bo a wotu (sɛ wopɛ a)',        es: 'Precio ofrecido (opcional)',  pt: 'Preço oferecido (opcional)',   fr: 'Prix proposé (optionnel)',       ar: 'السعر المعروض',       sw: 'Bei unayotoa (hiari)',           id: 'Harga yang ditawarkan (opsional)' },
  'market.interest.note':            { en: 'Short note (optional)',      hi: 'छोटा नोट (वैकल्पिक)',        tw: 'Nsɛm tiawa',                    es: 'Nota corta (opcional)',       pt: 'Nota curta (opcional)',        fr: 'Note courte (optionnelle)',      ar: 'ملاحظة قصيرة',        sw: 'Maelezo mafupi (hiari)',         id: 'Catatan singkat (opsional)' },
  'market.interest.sentTitle':       { en: 'Interest sent',              hi: 'रुचि भेज दी गई',             tw: 'Akokwaa no akɔ',                es: 'Interés enviado',             pt: 'Interesse enviado',            fr: 'Intérêt envoyé',                 ar: 'تم إرسال الاهتمام',   sw: 'Nia imetumwa',                   id: 'Minat terkirim' },
  'market.interest.sentBody':        { en: 'The farmer has been notified. You will see a response in your notifications.', hi: 'किसान को सूचित कर दिया गया है। उत्तर अधिसूचनाओं में दिखेगा।', tw: 'Yɛabɔ okuafoɔ no amanneɛ. Mmuae bɛba wo adwenɛ mu.', es: 'El agricultor ha sido notificado. Verás la respuesta en tus notificaciones.', pt: 'O agricultor foi notificado. Verá a resposta nas suas notificações.', fr: 'Le fermier a été notifié. La réponse apparaîtra dans vos notifications.', ar: 'تم إبلاغ المزارع. سترى الرد في إشعاراتك.', sw: 'Mkulima amepokea taarifa. Utaona jibu katika arifa zako.', id: 'Petani telah diberi tahu. Balasan akan muncul di notifikasi.' },
  'market.interest.browseMore':      { en: 'Browse more',                hi: 'और देखें',                   tw: 'Hwɛ bebree',                    es: 'Ver más',                     pt: 'Ver mais',                     fr: 'En voir plus',                   ar: 'تصفح المزيد',         sw: 'Angalia zaidi',                   id: 'Jelajahi lagi' },

  'market.action.interested':        { en: 'Interested',                 hi: 'रुचि है',                    tw: 'Meda so ho akokwaa',            es: 'Me interesa',                  pt: 'Tenho interesse',              fr: 'Intéressé',                      ar: 'مهتم',                sw: 'Nina nia',                         id: 'Tertarik' },
  'market.action.accept':            { en: 'Accept',                     hi: 'स्वीकार करें',               tw: 'Gye to mu',                     es: 'Aceptar',                     pt: 'Aceitar',                      fr: 'Accepter',                       ar: 'قبول',                sw: 'Kubali',                           id: 'Terima' },
  'market.action.decline':           { en: 'Decline',                    hi: 'अस्वीकार करें',              tw: 'Mpene so',                      es: 'Rechazar',                    pt: 'Recusar',                      fr: 'Refuser',                        ar: 'رفض',                 sw: 'Kataa',                            id: 'Tolak' },
  'market.action.markSold':          { en: 'Mark as sold',               hi: 'बिका हुआ चिह्नित करें',      tw: 'Kyerɛ sɛ wɔatɔn',               es: 'Marcar como vendida',         pt: 'Marcar como vendida',          fr: 'Marquer comme vendue',           ar: 'تحديد كمباع',          sw: 'Weka kama imeuzwa',              id: 'Tandai terjual' },
  'market.action.close':             { en: 'Close',                      hi: 'बंद करें',                  tw: 'To mu',                         es: 'Cerrar',                      pt: 'Fechar',                       fr: 'Fermer',                         ar: 'إغلاق',               sw: 'Funga',                            id: 'Tutup' },
  'market.action.viewDetail':        { en: 'View details',               hi: 'विवरण देखें',                tw: 'Hwɛ nsɛm no',                   es: 'Ver detalles',                pt: 'Ver detalhes',                 fr: 'Voir les détails',               ar: 'عرض التفاصيل',        sw: 'Angalia undani',                 id: 'Lihat detail' },

  'market.pending.title':            { en: 'Waiting for your response',   hi: 'आपके उत्तर की प्रतीक्षा',    tw: 'Yɛretwɛn wo mmuae',             es: 'Esperando tu respuesta',       pt: 'Aguardando sua resposta',      fr: 'En attente de votre réponse',     ar: 'بانتظار ردك',        sw: 'Inasubiri jibu lako',            id: 'Menunggu jawaban Anda' },
  'market.pending.lead':             { en: 'Buyer interested in {crop}',   hi: 'खरीदार {crop} में रुचि रखता है', tw: '{crop} ho akokwaa wɔ ɔtɔfo ho', es: 'Comprador interesado en {crop}', pt: 'Comprador interessado em {crop}', fr: 'Acheteur intéressé par {crop}', ar: 'مشترٍ مهتم بـ {crop}', sw: 'Mnunuzi ana nia ya {crop}',  id: 'Pembeli tertarik pada {crop}' },
  'market.pending.quantity':         { en: 'Wants {qty}',                  hi: '{qty} चाहिए',                tw: 'Ɔpɛ {qty}',                     es: 'Quiere {qty}',                 pt: 'Quer {qty}',                   fr: 'Veut {qty}',                     ar: 'يريد {qty}',          sw: 'Anataka {qty}',                   id: 'Ingin {qty}' },
  'market.pending.offer':            { en: 'Offered {price}',              hi: '{price} की पेशकश',           tw: 'Ɔde {price} bɛtua',             es: 'Ofrece {price}',               pt: 'Oferece {price}',              fr: 'Propose {price}',                ar: 'يعرض {price}',        sw: 'Anatoa {price}',                  id: 'Menawarkan {price}' },
  'market.pendingInterests':         { en: '{count} interested buyers',    hi: '{count} इच्छुक खरीदार',      tw: 'Atɔfo {count} na wɔwɔ akokwaa', es: '{count} compradores interesados', pt: '{count} compradores interessados', fr: '{count} acheteurs intéressés', ar: '{count} مشترون مهتمون', sw: 'Wanunuzi {count} wenye nia', id: '{count} pembeli tertarik' },

  'market.status.draft':             { en: 'Draft',         hi: 'ड्राफ्ट',      tw: 'Nhoma',       es: 'Borrador',    pt: 'Rascunho',   fr: 'Brouillon',   ar: 'مسودة',    sw: 'Rasimu',     id: 'Draf' },
  'market.status.active':            { en: 'Active',        hi: 'सक्रिय',       tw: 'Ekura so',    es: 'Activa',      pt: 'Ativa',      fr: 'Active',      ar: 'نشط',       sw: 'Hai',         id: 'Aktif' },
  'market.status.reserved':          { en: 'Reserved',      hi: 'आरक्षित',       tw: 'Wɔde asie',   es: 'Reservada',   pt: 'Reservada',  fr: 'Réservée',    ar: 'محجوز',    sw: 'Imewekwa',    id: 'Dipesan' },
  'market.status.sold':              { en: 'Sold',          hi: 'बिक गई',       tw: 'Wɔatɔn',      es: 'Vendida',     pt: 'Vendida',    fr: 'Vendue',      ar: 'مُباع',     sw: 'Imeuzwa',     id: 'Terjual' },
  'market.status.closed':            { en: 'Closed',        hi: 'बंद',          tw: 'Wɔato mu',    es: 'Cerrada',     pt: 'Fechada',    fr: 'Fermée',      ar: 'مغلق',      sw: 'Imefungwa',   id: 'Ditutup' },

  // ─── Buyer-side MyInterests + accepted contact reveal ──
  'market.myInterests.title':        { en: 'My interests',       hi: 'मेरी रुचियाँ',        tw: 'M\'akokwaa',           es: 'Mis intereses',          pt: 'Meus interesses',        fr: 'Mes intérêts',             ar: 'اهتماماتي',           sw: 'Nia zangu',                 id: 'Minat saya' },
  'market.myInterests.link':         { en: 'My interests',       hi: 'मेरी रुचियाँ',        tw: 'M\'akokwaa',           es: 'Mis intereses',          pt: 'Meus interesses',        fr: 'Mes intérêts',             ar: 'اهتماماتي',           sw: 'Nia zangu',                 id: 'Minat saya' },
  'market.myInterests.browse':       { en: 'Browse listings',    hi: 'लिस्टिंग देखें',      tw: 'Hwɛ adetɔn',           es: 'Buscar publicaciones',   pt: 'Procurar publicações',   fr: 'Parcourir les annonces',  ar: 'تصفح الإعلانات',     sw: 'Angalia matangazo',          id: 'Jelajahi daftar' },
  'market.myInterests.empty':        { en: 'No interests yet',   hi: 'अभी कोई रुचि नहीं',    tw: 'Akokwaa biara nni hɔ',  es: 'Aún no hay intereses',   pt: 'Sem interesses ainda',   fr: 'Pas encore d\'intérêt',     ar: 'لا توجد اهتمامات بعد', sw: 'Bado hakuna nia',          id: 'Belum ada minat' },
  'market.myInterests.emptyHint':    { en: 'Browse listings and tap Interested to start a conversation.', hi: 'लिस्टिंग देखें और रुचि पर टैप करें।', tw: 'Hwɛ adetɔn na mia "Meda so ho akokwaa" ma wobegye ɔkasa ase.', es: 'Explora las publicaciones y toca Me interesa para comenzar.', pt: 'Explore as publicações e toque em "Tenho interesse".', fr: 'Parcourez les annonces et appuyez sur "Intéressé" pour commencer.', ar: 'تصفح الإعلانات واضغط "مهتم" لبدء المحادثة.', sw: 'Angalia matangazo na ubofye "Nina nia" kuanzisha mazungumzo.', id: 'Jelajahi daftar dan ketuk Tertarik untuk memulai.' },
  'market.myInterests.error':        { en: 'Could not load interests.', hi: 'रुचियाँ लोड नहीं हो सकीं।', tw: 'Yɛantumi amfa akokwaa no aba.', es: 'No se pudieron cargar.', pt: 'Não foi possível carregar.', fr: 'Impossible de charger.', ar: 'تعذر التحميل.', sw: 'Imeshindwa kupakia.', id: 'Gagal memuat.' },

  'market.interestStatus.pending':   { en: 'Pending',            hi: 'लंबित',               tw: 'Ɛretwɛn',               es: 'Pendiente',              pt: 'Pendente',               fr: 'En attente',                ar: 'قيد الانتظار',         sw: 'Inasubiri',                 id: 'Menunggu' },
  'market.interestStatus.accepted':  { en: 'Accepted',           hi: 'स्वीकृत',              tw: 'Wɔagye mu',             es: 'Aceptada',                pt: 'Aceita',                  fr: 'Acceptée',                  ar: 'مقبولة',              sw: 'Imekubaliwa',              id: 'Diterima' },
  'market.interestStatus.declined':  { en: 'Declined',           hi: 'अस्वीकृत',             tw: 'Wɔapene so',            es: 'Rechazada',               pt: 'Recusada',                fr: 'Refusée',                   ar: 'مرفوضة',              sw: 'Imekataliwa',              id: 'Ditolak' },
  'market.interestStatus.expired':   { en: 'Expired',            hi: 'समाप्त',               tw: 'Aberɛ atwam',           es: 'Vencida',                 pt: 'Expirada',                fr: 'Expirée',                   ar: 'منتهية',              sw: 'Imemalizika',              id: 'Kedaluwarsa' },

  'market.interest.farmerNote':      { en: 'Farmer note',        hi: 'किसान की टिप्पणी',     tw: 'Okuafoɔ nsɛm',          es: 'Nota del agricultor',     pt: 'Nota do agricultor',     fr: 'Note du fermier',           ar: 'ملاحظة المزارع',     sw: 'Maelezo ya mkulima',         id: 'Catatan petani' },
  'market.interest.contactReady':    { en: 'You can now contact the farmer', hi: 'अब आप किसान से संपर्क कर सकते हैं', tw: 'Afei wubetumi ne okuafoɔ no akasa', es: 'Ya puedes contactar al agricultor', pt: 'Já pode contactar o agricultor', fr: 'Vous pouvez maintenant contacter le fermier', ar: 'يمكنك الآن التواصل مع المزارع', sw: 'Unaweza sasa kuwasiliana na mkulima', id: 'Sekarang Anda dapat menghubungi petani' },
  'market.interest.contactHint':     { en: 'The farmer has not shared direct contact details — in-app messaging is coming soon.', hi: 'किसान ने सीधे संपर्क विवरण साझा नहीं किए — इन-ऐप संदेश जल्द आ रहा है।', tw: 'Okuafoɔ no mfaa nkitahoɔ amma — yɛreba app no mu nkitahoɔ yi.', es: 'El agricultor no ha compartido contacto directo — mensajería en la app próximamente.', pt: 'O agricultor ainda não partilhou contacto direto — mensagens na app em breve.', fr: 'Le fermier n\'a pas partagé ses coordonnées directes — la messagerie arrive bientôt.', ar: 'لم يشارك المزارع معلومات الاتصال — المراسلة داخل التطبيق قريبًا.', sw: 'Mkulima hajashiriki mawasiliano ya moja kwa moja — ujumbe kwenye programu unakuja hivi karibuni.', id: 'Petani belum membagikan kontak langsung — pesan dalam aplikasi segera hadir.' },
  'market.interest.awaitingContact': { en: 'Farmer accepted. Contact details will appear here shortly.', hi: 'किसान ने स्वीकार किया। संपर्क विवरण शीघ्र ही दिखेगा।', tw: 'Okuafoɔ no agye mu. Nkitahoɔ nsɛm bɛba ha.', es: 'El agricultor aceptó. Los datos de contacto aparecerán pronto.', pt: 'O agricultor aceitou. Os contactos aparecerão em breve.', fr: 'Le fermier a accepté. Les coordonnées apparaîtront bientôt.', ar: 'قَبِل المزارع. ستظهر التفاصيل قريبًا.', sw: 'Mkulima amekubali. Maelezo ya mawasiliano yataonekana hivi karibuni.', id: 'Petani menerima. Info kontak akan muncul segera.' },
  'market.interest.declinedBody':    { en: 'This interest was declined. Browse other listings to keep going.', hi: 'यह रुचि अस्वीकार की गई। अन्य लिस्टिंग देखें।', tw: 'Wɔapene so akokwaa yi so. Hwɛ adetɔn foforɔ.', es: 'Este interés fue rechazado. Explora otras publicaciones.', pt: 'Este interesse foi recusado. Explore outras publicações.', fr: 'Cet intérêt a été refusé. Parcourez d\'autres annonces.', ar: 'تم رفض هذا الاهتمام. تصفح إعلانات أخرى.', sw: 'Nia hii imekataliwa. Angalia matangazo mengine.', id: 'Minat ini ditolak. Jelajahi daftar lain.' },
  'market.interest.phone':           { en: 'Phone',              hi: 'फ़ोन',                  tw: 'Ahoma so',              es: 'Teléfono',                pt: 'Telefone',                fr: 'Téléphone',                 ar: 'هاتف',                sw: 'Simu',                       id: 'Telepon' },
  'market.interest.email':           { en: 'Email',              hi: 'ईमेल',                  tw: 'E-mail',                es: 'Correo',                  pt: 'E-mail',                 fr: 'E-mail',                    ar: 'بريد إلكتروني',       sw: 'Barua pepe',                id: 'Email' },

  'market.action.sendInterest':      { en: 'Send interest',       hi: 'रुचि भेजें',            tw: 'Soma w\'akokwaa',       es: 'Enviar interés',          pt: 'Enviar interesse',        fr: 'Envoyer mon intérêt',        ar: 'إرسال الاهتمام',       sw: 'Tuma nia',                   id: 'Kirim minat' },

  'market.detail.reservedTitle':     { en: 'Currently reserved',  hi: 'अभी आरक्षित',          tw: 'Wɔde asie',             es: 'Reservada actualmente',   pt: 'Atualmente reservada',    fr: 'Actuellement réservée',       ar: 'محجوزة حاليًا',       sw: 'Imewekwa kwa sasa',         id: 'Dipesan saat ini' },
  'market.detail.reservedBody':      { en: 'Another buyer is finalizing this listing. It may re-open if that falls through.', hi: 'कोई अन्य खरीदार इसे अंतिम रूप दे रहा है। यदि वह विफल हो जाए तो यह फिर से खुल सकता है।', tw: 'Ɔtɔfo bi redi akyi so. Sɛ ɛdane a yebebue bio.', es: 'Otro comprador está finalizando esta publicación. Puede reabrirse si no concreta.', pt: 'Outro comprador está a finalizar. Pode reabrir caso não avance.', fr: 'Un autre acheteur finalise cette annonce. Elle peut rouvrir si cela échoue.', ar: 'يقوم مشترٍ آخر بإتمام هذه الصفقة. قد تعود للمتاح إن تعذرت.', sw: 'Mnunuzi mwingine anamaliza. Inaweza kufunguka tena ikishindikana.', id: 'Pembeli lain sedang menyelesaikan. Bisa terbuka kembali jika gagal.' },
  'market.detail.unavailableTitle':  { en: 'No longer available', hi: 'अब उपलब्ध नहीं',        tw: 'Ennyɛ hɔ bio',          es: 'Ya no disponible',        pt: 'Já não disponível',       fr: 'Plus disponible',            ar: 'لم تعد متوفرة',        sw: 'Haipatikani tena',           id: 'Tidak lagi tersedia' },
  'market.detail.unavailableBody':   { en: 'This listing is no longer accepting new interest.', hi: 'यह लिस्टिंग अब नई रुचि स्वीकार नहीं कर रही।', tw: 'Adetɔn yi nnye akokwaa foforɔ bio.', es: 'Esta publicación ya no acepta nuevos intereses.', pt: 'Esta publicação já não aceita novos interesses.', fr: 'Cette annonce n\'accepte plus de nouvelles marques d\'intérêt.', ar: 'لم يعد هذا الإعلان يقبل اهتمامًا جديدًا.', sw: 'Tangazo hili halikubali nia mpya.', id: 'Daftar ini tidak menerima minat baru lagi.' },

  'market.browse.noResults':         { en: 'No matching listings yet', hi: 'अभी कोई मिलान नहीं', tw: 'Deɛ ɛka ho nni hɔ', es: 'Aún no hay coincidencias', pt: 'Ainda sem correspondências', fr: 'Pas encore d\'annonces', ar: 'لا توجد نتائج بعد', sw: 'Bado hakuna matangazo yanayolingana', id: 'Belum ada yang cocok' },

  // ─── Buyer location preference UI ──────────────────────
  'market.field.location':           { en: 'Location',              hi: 'स्थान',                 tw: 'Baabi',              es: 'Ubicación',               pt: 'Localização',                fr: 'Emplacement',          ar: 'الموقع',           sw: 'Eneo',             id: 'Lokasi' },
  'market.field.cropPlaceholder':    { en: 'Search a crop…',        hi: 'फसल खोजें…',             tw: 'Hwehwɛ afudeɛ…',     es: 'Buscar cultivo…',        pt: 'Procurar cultura…',           fr: 'Rechercher une culture…', ar: 'ابحث عن محصول…', sw: 'Tafuta zao…',      id: 'Cari tanaman…' },
  'market.location.any':             { en: 'Any location',          hi: 'कोई भी स्थान',            tw: 'Baabi biara',        es: 'Cualquier ubicación',    pt: 'Qualquer localização',        fr: 'N\'importe où',         ar: 'أي موقع',          sw: 'Eneo lolote',      id: 'Lokasi mana pun' },
  'market.location.none':            { en: 'Any location',          hi: 'कोई भी स्थान',            tw: 'Baabi biara',        es: 'Cualquier ubicación',    pt: 'Qualquer localização',        fr: 'N\'importe où',         ar: 'أي موقع',          sw: 'Eneo lolote',      id: 'Lokasi mana pun' },
  'market.location.searchPlaceholder':{ en: 'Search regions…',      hi: 'क्षेत्र खोजें…',           tw: 'Hwehwɛ mpɔtam…',     es: 'Buscar regiones…',        pt: 'Procurar regiões…',           fr: 'Rechercher régions…',    ar: 'ابحث عن المناطق…', sw: 'Tafuta maeneo…',   id: 'Cari wilayah…' },
  'market.location.preferred':       { en: 'Your regions',          hi: 'आपके क्षेत्र',            tw: 'Wo mpɔtam',          es: 'Tus regiones',           pt: 'As suas regiões',             fr: 'Vos régions',           ar: 'مناطقك',           sw: 'Maeneo yako',      id: 'Wilayah Anda' },
  'market.location.preferredPill':   { en: 'Preferred',             hi: 'पसंदीदा',                tw: 'Deɛ wopɛ',           es: 'Preferida',               pt: 'Preferida',                   fr: 'Préférée',             ar: 'مفضلة',            sw: 'Inayopendelewa',   id: 'Disukai' },
  'market.location.other':           { en: 'Other regions',         hi: 'अन्य क्षेत्र',            tw: 'Mpɔtam foforɔ',      es: 'Otras regiones',         pt: 'Outras regiões',              fr: 'Autres régions',        ar: 'مناطق أخرى',       sw: 'Maeneo mengine',    id: 'Wilayah lain' },
  'market.location.reset':           { en: 'Reset to default region', hi: 'डिफ़ॉल्ट क्षेत्र पर रीसेट', tw: 'San kɔ wo mpɔtam',    es: 'Restablecer a región predeterminada', pt: 'Repor região padrão',    fr: 'Réinitialiser la région',  ar: 'إعادة إلى المنطقة الافتراضية', sw: 'Rejesha eneo chaguo-msingi', id: 'Atur ulang wilayah default' },
  'market.location.expand':          { en: 'Expand to more regions', hi: 'अधिक क्षेत्रों तक विस्तार', tw: 'Trɛ mu kɔ mpɔtam pii', es: 'Expandir a más regiones', pt: 'Expandir para mais regiões', fr: 'Étendre à plus de régions', ar: 'توسيع لمزيد من المناطق', sw: 'Panua hadi maeneo zaidi', id: 'Perluas ke lebih banyak wilayah' },
  'market.location.noResults':       { en: 'No regions match.',     hi: 'कोई क्षेत्र मेल नहीं खाते।', tw: 'Mpɔtam biara ɛnte sɛ.', es: 'Sin coincidencias.',   pt: 'Sem correspondências.',        fr: 'Aucune région ne correspond.', ar: 'لا توجد مناطق متطابقة.', sw: 'Hakuna eneo linalolingana.', id: 'Tidak ada wilayah cocok.' },

  // ─── Dual-mode labels ──────────────────────────────────
  'mode.backyard':                   { en: 'Backyard / Home garden', hi: 'घर / पिछवाड़े का बगीचा',   tw: 'Fie / Afuw ketewa',          es: 'Patio / Jardín casero',      pt: 'Quintal / Horta caseira',    fr: 'Jardin / Potager',               ar: 'الفناء / حديقة المنزل',    sw: 'Bustani ya nyumbani',          id: 'Halaman / Kebun rumah' },
  'mode.farm':                       { en: 'Farm',               hi: 'खेत',                    tw: 'Afuo',                        es: 'Granja',                       pt: 'Fazenda',                     fr: 'Ferme',                            ar: 'مزرعة',                     sw: 'Shamba',                         id: 'Pertanian' },

  // Backyard task rewrites used by modeAwareTasks.
  'backyardTask.feed':               { en: 'Feed your plants',       hi: 'पौधों को खाद दें',         tw: 'Ma w\'afifideɛ aduane',       es: 'Alimenta tus plantas',        pt: 'Alimente as plantas',          fr: 'Nourrissez vos plantes',           ar: 'غذِّ نباتاتك',            sw: 'Lisha mimea yako',             id: 'Beri makan tanaman Anda' },
  'backyardTask.checkLeaves':        { en: 'Check your leaves',      hi: 'पत्तियों की जाँच करें',    tw: 'Hwɛ nhaban no mu',           es: 'Revisa las hojas',            pt: 'Verifique as folhas',          fr: 'Vérifiez les feuilles',            ar: 'افحص الأوراق',              sw: 'Kagua majani',                 id: 'Periksa daunnya' },
  'backyardTask.waterDeeply':        { en: 'Water your plants',      hi: 'पौधों को पानी दें',         tw: 'Gugu w\'afifideɛ',            es: 'Riega tus plantas',           pt: 'Regue as plantas',             fr: 'Arrosez vos plantes',              ar: 'اسقِ نباتاتك',              sw: 'Mwagilia mimea yako',          id: 'Siram tanaman Anda' },
  'backyardTask.thinSeedlings':      { en: 'Thin out seedlings',     hi: 'बीजांकुर पतले करें',       tw: 'Tew asisedua no',              es: 'Aclara los brotes',           pt: 'Desbaste as mudas',            fr: 'Éclaircissez les plants',          ar: 'خفف الشتلات',              sw: 'Punguza miche',                 id: 'Jarangkan bibit' },
  'backyardTask.supportPlants':      { en: 'Support your plants',    hi: 'पौधों को सहारा दें',       tw: 'Ma w\'afifideɛ aguadeɛ',      es: 'Sostén tus plantas',          pt: 'Apoie as plantas',             fr: 'Soutenez vos plantes',             ar: 'ادعم نباتاتك',              sw: 'Saidia mimea yako',             id: 'Tahan tanaman Anda' },
  'backyardTask.pickRipe':           { en: 'Pick what is ripe',      hi: 'पके हुए फल तोड़ें',         tw: 'Te nea aben',                  es: 'Recoge lo que está maduro',    pt: 'Colha o que está maduro',      fr: 'Cueillez ce qui est mûr',          ar: 'اقطف ما نضج',             sw: 'Chukua vilivyoiva',            id: 'Petik yang matang' },

  // Recommendation warning for non-backyard-friendly crops demoted
  // by the mode filter. Shown as a riskNote so the card renders
  // "Experimental for backyard" style copy honestly.
  'recommendation.warning.notBackyardFriendly': { en: 'Usually grown on farms — more space than a backyard.', hi: 'आमतौर पर खेत में उगाई जाती है — पिछवाड़े से अधिक जगह चाहिए।', tw: 'Afuo so na wɔtaa dua yi — gye baabi kɛse.', es: 'Suele cultivarse en granjas — requiere más espacio que un patio.', pt: 'Costuma ser cultivada em fazendas — precisa de mais espaço.', fr: 'Généralement cultivé en ferme — demande plus d\'espace.', ar: 'يُزرع عادة في المزارع — يحتاج مساحة أكبر.', sw: 'Hukuzwa mashambani kwa kawaida — inahitaji nafasi kubwa.', id: 'Biasanya ditanam di lahan pertanian — butuh lebih banyak ruang.' },
  'recommendation.warning.heavyRainSoon':        { en: 'Heavy rain expected soon — consider delaying planting.', hi: 'जल्द भारी वर्षा संभावित — बुवाई में देरी पर विचार करें।', tw: 'Nsuo kɛse bɛtɔ — susuw ho sɛ wobɛtwɛn.', es: 'Se espera lluvia intensa — considera retrasar la siembra.', pt: 'Chuva forte esperada — considere atrasar o plantio.', fr: 'Fortes pluies attendues — envisagez de retarder la plantation.', ar: 'يُتوقع مطر غزير — فكّر في تأجيل الزراعة.', sw: 'Mvua kubwa inakuja — fikiria kuchelewesha kupanda.', id: 'Hujan lebat akan datang — pertimbangkan menunda tanam.' },
  'recommendation.warning.tropicalOutsideClimate': { en: 'Better suited to tropical regions than yours.', hi: 'यह फसल आपके क्षेत्र की बजाय उष्णकटिबंधीय क्षेत्रों के लिए बेहतर है।', tw: 'Ɛfata ahotɔhyew mpɔtam mmom.', es: 'Mejor adaptado a regiones tropicales que la tuya.', pt: 'Melhor adaptado a regiões tropicais.', fr: 'Mieux adapté aux régions tropicales.', ar: 'أنسب للمناطق الاستوائية من منطقتك.', sw: 'Inafaa zaidi maeneo ya joto kuliko lako.', id: 'Lebih cocok untuk wilayah tropis.' },
  'recommendation.warning.offSeason':             { en: 'Outside the normal planting window for your area.', hi: 'आपके क्षेत्र की सामान्य बुवाई अवधि से बाहर।', tw: 'Ɛnka bere pa a wodua no.', es: 'Fuera de la ventana de siembra habitual.', pt: 'Fora da janela de plantio habitual.', fr: 'En dehors de la fenêtre de plantation habituelle.', ar: 'خارج نافذة الزراعة المعتادة.', sw: 'Nje ya dirisha la kawaida la kupanda.', id: 'Di luar jendela tanam biasa.' },
  'recommendation.warning.farmTypeMismatch':      { en: 'Requires more space than your setup.',       hi: 'इसके लिए आपकी जगह से अधिक स्थान चाहिए।', tw: 'Gye baabi a ɛsen deɛ wowɔ.', es: 'Necesita más espacio del que tienes.', pt: 'Precisa de mais espaço do que você tem.', fr: 'Demande plus d\'espace que votre installation.', ar: 'يحتاج مساحة أكبر مما لديك.', sw: 'Inahitaji nafasi zaidi kuliko uliyonayo.', id: 'Membutuhkan lebih banyak ruang.' },

  // ─── Behavior-aware Today why-lines ─────────────────────
  'today.why.keepGoing':             { en: 'You\'re catching up — keep going.',  hi: 'आप पकड़ रहे हैं — चलते रहें।',    tw: 'Woreba wɔ akyi — toa so.',      es: 'Te estás poniendo al día — sigue.', pt: 'Está a recuperar — continue.', fr: 'Vous rattrapez — continuez.', ar: 'أنت تستدرك — واصل.', sw: 'Unapata tena — endelea.', id: 'Sedang mengejar — teruskan.' },
  'today.why.slipping':              { en: 'Several tasks slipped — pick one today.', hi: 'कई कार्य छूट गए — आज एक पूरा करें।', tw: 'Adwuma pii ahwere — yɛ biako nnɛ.', es: 'Varias tareas se retrasaron — termina una hoy.', pt: 'Várias tarefas atrasaram — termine uma hoje.', fr: 'Plusieurs tâches ont glissé — faites-en une aujourd\'hui.', ar: 'تأخرت عدة مهام — أنجز واحدة اليوم.', sw: 'Kazi kadhaa zimechelewa — maliza moja leo.', id: 'Beberapa tugas tertunda — selesaikan satu hari ini.' },
  'today.why.wateringGap':           { en: 'Watering was missed recently.',     hi: 'हाल ही में सिंचाई छूट गई।',      tw: 'Nsuogu bae akyi.',                es: 'Se omitió el riego recientemente.', pt: 'A rega foi esquecida recentemente.', fr: 'L\'arrosage a été oublié récemment.', ar: 'فات الري مؤخرًا.', sw: 'Kumwagilia kulikosekana hivi karibuni.', id: 'Penyiraman terlewat baru-baru ini.' },
  'today.why.wateringGapWithHeat':   { en: 'Missed watering plus heat — water deeply now.', hi: 'सिंचाई छूटी और गर्मी है — अभी भरपूर पानी दें।', tw: 'Nsuogu bae na ɔhyew wɔ hɔ — gugu nnɛ.', es: 'Faltó riego y hace calor — riega a fondo ahora.', pt: 'Rega em falta e calor — regue bem agora.', fr: 'Arrosage oublié et chaleur — arrosez bien maintenant.', ar: 'فات الري والحرارة مرتفعة — اسقِ بعمق الآن.', sw: 'Umeruka kumwagilia na joto — mwagilia kwa kina sasa.', id: 'Penyiraman terlewat dan panas — siram dalam sekarang.' },
  'today.why.pestPressure':          { en: 'Pest pressure is rising — scout first.', hi: 'कीट दबाव बढ़ रहा है — पहले जाँच करें।', tw: 'Mmoawa reba — hwehwɛ kan.', es: 'La presión de plagas está subiendo — revisa primero.', pt: 'Pressão de pragas a subir — inspecione primeiro.', fr: 'Pression des ravageurs en hausse — inspectez d\'abord.', ar: 'ضغط الآفات يرتفع — افحص أولاً.', sw: 'Shinikizo la wadudu linaongezeka — kagua kwanza.', id: 'Tekanan hama meningkat — periksa dulu.' },
  'today.why.catchUp':               { en: 'You missed a few days — start with one easy check.', hi: 'आपने कुछ दिन छोड़े हैं — एक आसान जाँच से शुरू करें।', tw: 'Woannya nna pii — fi ase wɔ nhwehwɛmu kakra so.', es: 'Te saltaste algunos días — empieza con una revisión.', pt: 'Faltou alguns dias — comece com uma verificação simples.', fr: 'Vous avez manqué quelques jours — commencez par une vérification simple.', ar: 'فاتتك بعض الأيام — ابدأ بفحص بسيط.', sw: 'Umeruka siku chache — anza na ukaguzi rahisi.', id: 'Anda melewatkan beberapa hari — mulai dengan satu pengecekan.' },

  // Catch-up primary tasks + banner
  'catchUp.banner.missedDays':       { en: 'You missed {n} days. Let\'s ease back in.', hi: 'आपने {n} दिन छोड़े। धीरे-धीरे लौटें।', tw: 'Woannya nna {n}. Ma yɛnkɔ nkakrankakra.', es: 'Te saltaste {n} días. Retomemos con calma.', pt: 'Faltou {n} dias. Vamos retomar com calma.', fr: 'Vous avez manqué {n} jours. Reprenons doucement.', ar: 'فاتتك {n} أيام. لنعُد بهدوء.', sw: 'Umeruka siku {n}. Turudi polepole.', id: 'Anda melewatkan {n} hari. Mari mulai perlahan.' },
  'catchUp.primary.water':           { en: 'Water your plants deeply today',    hi: 'आज पौधों को अच्छी तरह पानी दें',   tw: 'Gugu w\'afifideɛ yie nnɛ',       es: 'Riega bien tus plantas hoy',          pt: 'Regue bem as plantas hoje',           fr: 'Arrosez bien vos plantes aujourd\'hui', ar: 'اسقِ نباتاتك بعمق اليوم',     sw: 'Mwagilia mimea yako vizuri leo',  id: 'Siram tanaman Anda dengan baik hari ini' },
  'catchUp.detail.water':            { en: 'Give the soil a long soak to recover from the dry spell.', hi: 'सूखे से उबरने के लिए मिट्टी को अच्छी तरह भिगोएँ।', tw: 'Ma nsuo nka dɔte no yie na ɛfiri ɔpɛ mu.', es: 'Dale al suelo un remojo largo para recuperarse.', pt: 'Dê um ensopado longo para o solo se recuperar.', fr: 'Donnez un bon trempage au sol pour qu\'il récupère.', ar: 'اسقِ التربة طويلاً لتتعافى من الجفاف.', sw: 'Loweka udongo kwa muda mrefu ili uimarike.', id: 'Rendam tanah lama agar pulih dari kekeringan.' },
  'catchUp.primary.harvest':         { en: 'Check what\'s ready to harvest',    hi: 'देखें क्या कटाई के लिए तैयार है', tw: 'Hwɛ deɛ abere na wobetwa',       es: 'Revisa qué está listo para cosechar', pt: 'Verifique o que está pronto para colher', fr: 'Vérifiez ce qui est prêt à récolter', ar: 'افحص ما هو جاهز للحصاد',     sw: 'Angalia kilicho tayari kuvunwa',   id: 'Periksa yang siap dipanen' },
  'catchUp.detail.harvest':          { en: 'Ripe produce loses quality fast — pick what\'s ready first.', hi: 'पके फल तेज़ी से ख़राब होते हैं — पहले पके फल तोड़ें।', tw: 'Nea abere no sɛe ntɛm — te nea abere kan.', es: 'El producto maduro se daña rápido — recoge primero.', pt: 'Produto maduro estraga rápido — colha primeiro.', fr: 'Les fruits mûrs se gâtent vite — cueillez en priorité.', ar: 'المحصول الناضج يفسد بسرعة — اقطف أولاً.', sw: 'Matunda yaliyoiva huharibika haraka — chukua kwanza.', id: 'Buah matang cepat rusak — petik dulu.' },
  'catchUp.primary.inspect':         { en: 'Take a slow walk through your plants', hi: 'अपने पौधों का धीरे-धीरे निरीक्षण करें', tw: 'Nante w\'afifideɛ no mu brɛoo',  es: 'Da un recorrido pausado por tus plantas', pt: 'Caminhe devagar pelas suas plantas',  fr: 'Faites un tour calme dans vos plantes', ar: 'تمشَ ببطء بين نباتاتك',      sw: 'Tembea polepole kati ya mimea',    id: 'Jalan pelan di antara tanaman' },
  'catchUp.detail.inspect':          { en: 'Spot what changed while you were away.', hi: 'देखें आपकी अनुपस्थिति में क्या बदला।', tw: 'Hu nea asesa wɔ bere a woannkɔ.', es: 'Identifica qué cambió mientras estuviste fuera.', pt: 'Note o que mudou na sua ausência.', fr: 'Repérez ce qui a changé pendant votre absence.', ar: 'حدّد ما تغيّر في غيابك.', sw: 'Tambua kilichobadilika ulipokuwa mbali.', id: 'Perhatikan yang berubah selama Anda pergi.' },
  'catchUp.secondary.inspect':       { en: 'Inspect soil and leaves',           hi: 'मिट्टी और पत्तियों की जाँच करें', tw: 'Hwɛ dɔte ne nhaban',             es: 'Revisa suelo y hojas',               pt: 'Inspecione solo e folhas',          fr: 'Inspectez le sol et les feuilles', ar: 'افحص التربة والأوراق',      sw: 'Kagua udongo na majani',           id: 'Periksa tanah dan daun' },

  // Failure recovery
  'failure.cause.drought':           { en: 'Drought stress during growth',      hi: 'वृद्धि के दौरान सूखा दबाव',      tw: 'Ɔpɛ ho akwansideɛ',               es: 'Estrés por sequía durante el crecimiento', pt: 'Stress por seca no crescimento', fr: 'Stress hydrique pendant la croissance', ar: 'إجهاد الجفاف أثناء النمو', sw: 'Mkazo wa ukame wakati wa ukuaji', id: 'Tekanan kekeringan saat tumbuh' },
  'failure.cause.excessRain':        { en: 'Too much rain damaged the crop',    hi: 'अत्यधिक वर्षा ने फसल को नुकसान पहुँचाया', tw: 'Nsuo bebree kaa afudeɛ no',       es: 'El exceso de lluvia dañó el cultivo', pt: 'O excesso de chuva danificou a cultura', fr: 'L\'excès de pluie a endommagé la culture', ar: 'أمطار زائدة أضرت بالمحصول', sw: 'Mvua nyingi iliathiri zao', id: 'Hujan berlebih merusak tanaman' },
  'failure.cause.pest':              { en: 'Pests were a persistent problem',   hi: 'कीट लगातार समस्या रहे',          tw: 'Mmoawa kaa adwuma no daa',         es: 'Las plagas fueron un problema constante', pt: 'As pragas foram um problema persistente', fr: 'Les ravageurs ont été un problème persistant', ar: 'كانت الآفات مشكلة مستمرة', sw: 'Wadudu walikuwa tatizo la kudumu', id: 'Hama menjadi masalah berulang' },
  'failure.cause.poorGrowth':        { en: 'Plants grew more slowly than expected', hi: 'पौधे अपेक्षा से धीरे बढ़े',     tw: 'Afifideɛ nyinii sɛnea ɛhia',       es: 'Las plantas crecieron más despacio de lo esperado', pt: 'As plantas cresceram mais devagar do que o esperado', fr: 'Les plantes ont poussé plus lentement que prévu', ar: 'نمت النباتات ببطء أكثر من المتوقع', sw: 'Mimea ilikua polepole zaidi ya ilivyotarajiwa', id: 'Tanaman tumbuh lebih lambat dari perkiraan' },
  'failure.cause.missedTasks':       { en: 'Several key tasks were missed',     hi: 'कई मुख्य कार्य छूट गए',          tw: 'Adwuma titire bi ahwere',           es: 'Se perdieron varias tareas clave',   pt: 'Várias tarefas-chave ficaram por fazer', fr: 'Plusieurs tâches clés ont été manquées', ar: 'فاتت عدة مهام رئيسية',       sw: 'Kazi muhimu kadhaa zilikosekana',  id: 'Beberapa tugas penting terlewat' },
  'failure.cause.weatherDelays':     { en: 'Weather forced several delays',     hi: 'मौसम ने कई देरियाँ कीं',         tw: 'Wim tebea maa nkyɛ bebree',        es: 'El clima causó varios retrasos',     pt: 'O clima causou vários atrasos',      fr: 'La météo a causé plusieurs retards', ar: 'تسبب الطقس في عدة تأخيرات',  sw: 'Hali ya hewa ilisababisha kucheleweshwa', id: 'Cuaca menyebabkan beberapa penundaan' },
  'failure.cause.multipleIssues':    { en: 'Multiple issues compounded',        hi: 'कई समस्याओं ने मिलकर असर किया', tw: 'Nsɛm pii bɔɔ mu',                   es: 'Varios problemas se acumularon',     pt: 'Vários problemas acumularam-se',     fr: 'Plusieurs problèmes se sont cumulés', ar: 'تراكمت عدة مشاكل',           sw: 'Masuala kadhaa yaliongezeka',       id: 'Beberapa masalah menumpuk' },
  'failure.severity.minor':          { en: 'Minor impact',       hi: 'हल्का प्रभाव',    tw: 'Ɔhaw kakraa bi',    es: 'Impacto menor',     pt: 'Impacto menor',     fr: 'Impact mineur',     ar: 'تأثير بسيط',   sw: 'Athari ndogo',     id: 'Dampak kecil' },
  'failure.severity.moderate':       { en: 'Moderate impact',    hi: 'मध्यम प्रभाव',    tw: 'Ɔhaw nteaseɛ',      es: 'Impacto moderado',  pt: 'Impacto moderado',  fr: 'Impact modéré',     ar: 'تأثير معتدل',   sw: 'Athari ya kati',   id: 'Dampak sedang' },
  'failure.severity.major':          { en: 'Major impact',       hi: 'गंभीर प्रभाव',    tw: 'Ɔhaw kɛse',         es: 'Gran impacto',      pt: 'Grande impacto',    fr: 'Impact majeur',     ar: 'تأثير كبير',    sw: 'Athari kubwa',     id: 'Dampak besar' },
  'failure.retry.improvedWatering':  { en: 'Set a stricter watering schedule next time', hi: 'अगली बार अधिक नियमित सिंचाई करें', tw: 'Yɛ nsuogu nhyehyɛe yiye berɛ a ɛdi hɔ', es: 'Ajusta un calendario de riego más estricto', pt: 'Defina um calendário de rega mais rigoroso', fr: 'Mettez en place un calendrier d\'arrosage plus strict', ar: 'ضع جدول ري أكثر صرامة', sw: 'Weka ratiba kali zaidi ya kumwagilia', id: 'Tetapkan jadwal penyiraman lebih ketat' },
  'failure.retry.plantEarlier':      { en: 'Plant earlier to avoid the wet window', hi: 'गीली अवधि से बचने के लिए पहले बुवाई करें', tw: 'Dua ntɛm na bere a nsuo tɔ no mmɛka wo', es: 'Siembra antes para evitar la ventana húmeda', pt: 'Plante mais cedo para evitar a janela húmida', fr: 'Plantez plus tôt pour éviter la fenêtre humide', ar: 'ازرع مبكرًا لتجنّب موسم الرطوبة', sw: 'Panda mapema kuepuka dirisha la mvua', id: 'Tanam lebih awal untuk hindari periode basah' },
  'failure.retry.earlierPestChecks': { en: 'Start pest checks in the first week', hi: 'पहले ही सप्ताह से कीट जाँच शुरू करें', tw: 'Fi nnawɔtwe a edi kan so hwehwɛ mmoawa', es: 'Empieza a vigilar plagas la primera semana', pt: 'Comece a inspecionar pragas na primeira semana', fr: 'Commencez les contrôles de ravageurs dès la 1ʳᵉ semaine', ar: 'ابدأ فحص الآفات في الأسبوع الأول', sw: 'Anza kukagua wadudu wiki ya kwanza', id: 'Mulai periksa hama minggu pertama' },
  'failure.retry.fewerTasks':        { en: 'Try a crop with fewer tasks this time', hi: 'इस बार कम कार्य वाली फसल चुनें',   tw: 'Fa afudeɛ a ne adwuma sua sɛsɛɛ',  es: 'Prueba un cultivo con menos tareas',  pt: 'Experimente uma cultura com menos tarefas', fr: 'Essayez une culture avec moins de tâches', ar: 'جرّب محصولاً بمهام أقل',    sw: 'Jaribu zao lenye kazi chache',      id: 'Coba tanaman dengan tugas lebih sedikit' },
  'failure.retry.earlyStart':        { en: 'Start the next cycle earlier',      hi: 'अगला चक्र जल्दी शुरू करें',      tw: 'Fi adwuma a ɛdi hɔ no ase ntɛm',   es: 'Empieza el próximo ciclo antes',     pt: 'Comece o próximo ciclo mais cedo',   fr: 'Commencez le prochain cycle plus tôt', ar: 'ابدأ الدورة القادمة مبكرًا',sw: 'Anza mzunguko ujao mapema',         id: 'Mulai siklus berikutnya lebih awal' },
  'failure.advice.tryDifferentCrop': { en: 'Consider a different crop next time', hi: 'अगली बार अलग फसल पर विचार करें',  tw: 'Susuw afudeɛ foforɔ ho',           es: 'Considera un cultivo distinto la próxima vez', pt: 'Considere uma cultura diferente da próxima vez', fr: 'Envisagez une autre culture la prochaine fois', ar: 'فكّر في محصول مختلف في المرة القادمة', sw: 'Fikiria zao tofauti wakati ujao', id: 'Pertimbangkan tanaman berbeda kali berikutnya' },
  'failure.advice.retryWithTweaks':  { en: 'Try again with small tweaks',       hi: 'छोटे बदलावों के साथ दोबारा कोशिश करें', tw: 'Sɔ bio nso sesa kakra',           es: 'Vuelve a intentarlo con pequeños ajustes', pt: 'Tente novamente com pequenos ajustes', fr: 'Réessayez avec de petits ajustements', ar: 'حاول مجددًا مع تعديلات صغيرة', sw: 'Jaribu tena kwa marekebisho madogo', id: 'Coba lagi dengan sedikit penyesuaian' },

  // Listing freshness chips
  'market.freshness.fresh':          { en: 'Fresh listing',      hi: 'नई लिस्टिंग',    tw: 'Adetɔn foforɔ',   es: 'Publicación reciente',    pt: 'Publicação recente',     fr: 'Annonce récente',      ar: 'إعلان جديد',       sw: 'Tangazo jipya',           id: 'Daftar baru' },
  'market.freshness.older':          { en: 'Older listing',      hi: 'पुरानी लिस्टिंग', tw: 'Adetɔn dedaw',    es: 'Publicación antigua',     pt: 'Publicação antiga',      fr: 'Annonce ancienne',     ar: 'إعلان قديم',       sw: 'Tangazo la zamani',       id: 'Daftar lama' },
  'market.freshness.stale':          { en: 'Expires soon',       hi: 'शीघ्र समाप्त',   tw: 'Bɛba awieɛ ntɛm', es: 'Expira pronto',           pt: 'Expira em breve',        fr: 'Expire bientôt',       ar: 'ينتهي قريبًا',     sw: 'Inakwisha karibuni',       id: 'Segera kedaluwarsa' },
  'market.freshness.expired':        { en: 'Expired',            hi: 'समाप्त',         tw: 'Aberɛ atwam',     es: 'Vencida',                 pt: 'Expirada',               fr: 'Expirée',              ar: 'منتهية',           sw: 'Imemalizika',             id: 'Kedaluwarsa' },
  'market.freshness.unknown':        { en: 'Unknown age',        hi: 'अज्ञात समय',     tw: 'Bere a yɛnnim',   es: 'Edad desconocida',       pt: 'Idade desconhecida',     fr: 'Âge inconnu',          ar: 'عمر غير معروف',   sw: 'Umri usiojulikana',       id: 'Usia tidak diketahui' },

  'market.quality.high':             { en: 'High quality',   hi: 'उच्च गुणवत्ता', tw: 'Papa paa',    es: 'Alta calidad',  pt: 'Alta qualidade', fr: 'Haute qualité', ar: 'جودة عالية', sw: 'Ubora wa juu', id: 'Kualitas tinggi' },
  'market.quality.medium':           { en: 'Medium quality', hi: 'मध्यम गुणवत्ता', tw: 'Papa kakra',  es: 'Calidad media', pt: 'Qualidade média', fr: 'Qualité moyenne', ar: 'جودة متوسطة', sw: 'Ubora wa kati', id: 'Kualitas sedang' },
  'market.quality.low':              { en: 'Low quality',    hi: 'कम गुणवत्ता',  tw: 'Papa kakraa bi', es: 'Baja calidad',  pt: 'Qualidade baixa', fr: 'Qualité faible', ar: 'جودة منخفضة', sw: 'Ubora mdogo', id: 'Kualitas rendah' },

  'market.pricingMode.fixed':        { en: 'Fixed price',    hi: 'निश्चित मूल्य', tw: 'Bo a ɛyɛ pɛ',  es: 'Precio fijo',   pt: 'Preço fixo',    fr: 'Prix fixe',   ar: 'سعر ثابت',    sw: 'Bei maalum',   id: 'Harga tetap' },
  'market.pricingMode.negotiable':   { en: 'Negotiable',     hi: 'बातचीत के लिए',  tw: 'Yebetumi akasa so', es: 'Negociable',    pt: 'Negociável',    fr: 'Négociable',  ar: 'قابل للتفاوض', sw: 'Inaweza kujadiliwa', id: 'Dapat dinegosiasi' },
  'market.pricingMode.ask_buyer':    { en: 'Ask buyer',      hi: 'खरीदार से पूछें', tw: 'Bisa ɔtɔfo',   es: 'Preguntar al comprador', pt: 'Perguntar ao comprador', fr: 'Demander à l\'acheteur', ar: 'اسأل المشتري', sw: 'Uliza mnunuzi', id: 'Tanya pembeli' },

  'market.delivery.pickup':          { en: 'Pickup',         hi: 'पिकअप',       tw: 'Bɛfa',         es: 'Recogida',      pt: 'Retirada',    fr: 'Retrait',     ar: 'استلام',     sw: 'Kuchukua',     id: 'Ambil sendiri' },
  'market.delivery.delivery':        { en: 'Delivery',       hi: 'डिलिवरी',    tw: 'Mede bɛma wo',   es: 'Entrega',       pt: 'Entrega',     fr: 'Livraison',   ar: 'توصيل',       sw: 'Utoaji',       id: 'Pengantaran' },
  'market.delivery.either':          { en: 'Pickup or delivery', hi: 'कोई भी',  tw: 'Biara',         es: 'Cualquiera',    pt: 'Qualquer um', fr: 'L\'un ou l\'autre', ar: 'أيهما',     sw: 'Yoyote',       id: 'Salah satu' },

  'market.field.crop':               { en: 'Crop',           hi: 'फसल',          tw: 'Afudeɛ',       es: 'Cultivo',       pt: 'Cultura',     fr: 'Culture',     ar: 'المحصول',   sw: 'Zao',          id: 'Tanaman' },
  'market.field.quantity':           { en: 'Quantity',       hi: 'मात्रा',       tw: 'Dodoɔ',        es: 'Cantidad',      pt: 'Quantidade',  fr: 'Quantité',    ar: 'الكمية',    sw: 'Kiasi',        id: 'Jumlah' },
  'market.field.unit':               { en: 'Unit',           hi: 'इकाई',         tw: 'Ɔnkoroɔ',      es: 'Unidad',        pt: 'Unidade',     fr: 'Unité',       ar: 'الوحدة',    sw: 'Kipimo',       id: 'Satuan' },
  'market.field.quality':            { en: 'Quality',        hi: 'गुणवत्ता',      tw: 'Papa',         es: 'Calidad',       pt: 'Qualidade',   fr: 'Qualité',     ar: 'الجودة',    sw: 'Ubora',        id: 'Kualitas' },
  'market.field.price':              { en: 'Price',          hi: 'कीमत',        tw: 'Bo',           es: 'Precio',        pt: 'Preço',       fr: 'Prix',        ar: 'السعر',     sw: 'Bei',          id: 'Harga' },
  'market.field.pricingMode':        { en: 'Pricing',        hi: 'मूल्य निर्धारण', tw: 'Bo hyehyɛeɛ', es: 'Precio',        pt: 'Preço',       fr: 'Tarif',       ar: 'التسعير',   sw: 'Bei',          id: 'Penetapan harga' },
  'market.field.deliveryMode':       { en: 'Delivery',       hi: 'डिलिवरी',    tw: 'Sɛnea wɔde bɛma', es: 'Entrega',       pt: 'Entrega',     fr: 'Livraison',   ar: 'التوصيل',    sw: 'Utoaji',       id: 'Pengiriman' },
  'market.field.notes':              { en: 'Notes',          hi: 'नोट्स',       tw: 'Nsɛm',         es: 'Notas',         pt: 'Notas',       fr: 'Notes',       ar: 'ملاحظات',   sw: 'Maelezo',      id: 'Catatan' },
  'market.field.country':            { en: 'Country',        hi: 'देश',          tw: 'Ɔman',         es: 'País',          pt: 'País',        fr: 'Pays',        ar: 'الدولة',    sw: 'Nchi',         id: 'Negara' },
  'market.field.state':              { en: 'State / region', hi: 'राज्य',         tw: 'Ɔmantam',      es: 'Estado',        pt: 'Estado',      fr: 'Région',      ar: 'الولاية',    sw: 'Mkoa',         id: 'Provinsi' },
  'market.field.minQuality':         { en: 'Min quality',    hi: 'न्यूनतम गुणवत्ता', tw: 'Papa kakra', es: 'Calidad mínima', pt: 'Qualidade mínima', fr: 'Qualité min.', ar: 'الجودة الدنيا', sw: 'Ubora wa chini', id: 'Kualitas minimum' },

  'market.create.title':             { en: 'List this harvest', hi: 'इस फसल को सूचीबद्ध करें', tw: 'Fa twa yi to so',  es: 'Publicar esta cosecha', pt: 'Publicar esta colheita', fr: 'Annoncer cette récolte', ar: 'عرض هذا الحصاد', sw: 'Tangaza mavuno haya', id: 'Daftarkan panen ini' },
  'market.create.for':               { en: 'For {crop}',     hi: '{crop} के लिए', tw: '{crop} ho',    es: 'Para {crop}',   pt: 'Para {crop}', fr: 'Pour {crop}', ar: 'لـ {crop}',  sw: 'Kwa {crop}',   id: 'Untuk {crop}' },
  'market.create.submit':            { en: 'Publish listing', hi: 'लिस्टिंग प्रकाशित करें', tw: 'To adetɔn no so', es: 'Publicar', pt: 'Publicar',       fr: 'Publier',     ar: 'نشر',        sw: 'Chapisha',     id: 'Publikasikan' },

  // Trust badges
  'market.trust.verifiedHarvest':    { en: 'Verified harvest',  hi: 'सत्यापित फसल', tw: 'Twa a wɔahwɛ', es: 'Cosecha verificada', pt: 'Colheita verificada', fr: 'Récolte vérifiée', ar: 'حصاد موثق', sw: 'Mavuno yaliyothibitishwa', id: 'Panen terverifikasi' },
  'market.trust.guidanceFull':       { en: 'Fully guided',      hi: 'पूरी मार्गदर्शिका', tw: 'Akwankyerɛ a edi mu', es: 'Guía completa', pt: 'Orientação completa', fr: 'Guidage complet', ar: 'إرشاد كامل', sw: 'Mwongozo kamili', id: 'Panduan lengkap' },
  'market.trust.guidancePartial':    { en: 'Partial guidance',  hi: 'आंशिक मार्गदर्शन', tw: 'Akwankyerɛ kakra', es: 'Guía parcial', pt: 'Orientação parcial', fr: 'Guidage partiel', ar: 'إرشاد جزئي', sw: 'Mwongozo wa sehemu', id: 'Panduan sebagian' },
  'market.trust.qualityReported':    { en: 'Quality reported',  hi: 'गुणवत्ता दर्ज',  tw: 'Papa a wɔaka',  es: 'Calidad reportada', pt: 'Qualidade reportada', fr: 'Qualité rapportée', ar: 'الجودة مُبلّغ عنها', sw: 'Ubora umeripotiwa', id: 'Kualitas dilaporkan' },
  'market.trust.locationVerified':   { en: 'Location verified', hi: 'स्थान सत्यापित', tw: 'Beae a wɔahwɛ', es: 'Ubicación verificada', pt: 'Localização verificada', fr: 'Lieu vérifié', ar: 'الموقع موثق', sw: 'Mahali pamethibitishwa', id: 'Lokasi diverifikasi' },
  'market.trust.recentActivity':     { en: 'Recently active',   hi: 'हाल ही में सक्रिय', tw: 'Ɔkura so ntɛm',  es: 'Recientemente activo', pt: 'Recentemente ativo', fr: 'Récemment actif', ar: 'نشط حديثًا', sw: 'Amekuwa hai karibuni', id: 'Baru-baru ini aktif' },

  // Notifications (also used inside NotificationsPage directly)
  'notifications.title':             { en: 'Notifications',   hi: 'अधिसूचनाएँ',  tw: 'Amanneɛ',       es: 'Notificaciones', pt: 'Notificações', fr: 'Notifications', ar: 'الإشعارات', sw: 'Arifa',        id: 'Notifikasi' },
  'notifications.unread':            { en: '{count} new',     hi: '{count} नए',   tw: 'Foforɔ {count}', es: '{count} nuevas', pt: '{count} novas', fr: '{count} nouvelles', ar: '{count} جديدة', sw: '{count} mpya', id: '{count} baru' },
  'notifications.empty':             { en: 'No notifications yet.', hi: 'अभी कोई अधिसूचना नहीं।', tw: 'Amanneɛ biara nni hɔ.', es: 'Sin notificaciones aún.', pt: 'Sem notificações ainda.', fr: 'Aucune notification.', ar: 'لا توجد إشعارات.', sw: 'Hakuna arifa.',  id: 'Belum ada notifikasi.' },
  'notifications.error':             { en: 'Could not load.', hi: 'लोड नहीं हो सका।', tw: 'Yɛantumi ankan.', es: 'No se pudo cargar.', pt: 'Não foi possível carregar.', fr: 'Chargement impossible.', ar: 'تعذر التحميل.', sw: 'Imeshindwa kupakia.', id: 'Gagal memuat.' },
  'notification.interest.title':     { en: 'Buyer interested',      hi: 'खरीदार रुचि रखता है', tw: 'Ɔtɔfo bi wɔ akokwaa', es: 'Comprador interesado', pt: 'Comprador interessado', fr: 'Acheteur intéressé', ar: 'مشتر مهتم', sw: 'Mnunuzi anavutiwa', id: 'Pembeli tertarik' },
  'notification.interest.body':      { en: 'A buyer expressed interest in your listing.', hi: 'एक खरीदार ने आपकी लिस्टिंग में रुचि दिखाई है।', tw: 'Ɔtɔfo bi ada no adi sɛ ɔwɔ wo adetɔn ho akokwaa.', es: 'Un comprador mostró interés en tu publicación.', pt: 'Um comprador demonstrou interesse na sua publicação.', fr: 'Un acheteur s\'est montré intéressé par votre annonce.', ar: 'أظهر مشترٍ اهتمامًا بإعلانك.', sw: 'Mnunuzi amevutiwa na tangazo lako.', id: 'Seorang pembeli tertarik dengan daftar Anda.' },
  'notification.accepted.title':     { en: 'Interest accepted',     hi: 'रुचि स्वीकार की गई',    tw: 'Wɔagye mu',              es: 'Interés aceptado',     pt: 'Interesse aceito',    fr: 'Intérêt accepté',     ar: 'تم قبول الاهتمام', sw: 'Nia imekubaliwa',    id: 'Minat diterima' },
  'notification.accepted.body':      { en: 'The farmer accepted your interest. You can now proceed.', hi: 'किसान ने आपकी रुचि स्वीकार की है। अब आप आगे बढ़ सकते हैं।', tw: 'Okuafoɔ no agye wo akokwaa no mu.', es: 'El agricultor aceptó tu interés. Puedes continuar.', pt: 'O agricultor aceitou o seu interesse.', fr: 'Le fermier a accepté votre intérêt.', ar: 'قبل المزارع اهتمامك.', sw: 'Mkulima amekubali nia yako.', id: 'Petani menerima minat Anda.' },
  'notification.declined.title':     { en: 'Interest declined',      hi: 'रुचि अस्वीकार की गई',   tw: 'Wɔapene so',             es: 'Interés rechazado',    pt: 'Interesse recusado',  fr: 'Intérêt refusé',      ar: 'رُفض الاهتمام',   sw: 'Nia imekataliwa',     id: 'Minat ditolak' },
  'notification.declined.body':      { en: 'The farmer declined your interest this time.', hi: 'किसान ने इस बार आपकी रुचि अस्वीकार की है।', tw: 'Okuafoɔ no ampene so saa berɛ yi.', es: 'El agricultor rechazó tu interés esta vez.', pt: 'O agricultor recusou o seu interesse desta vez.', fr: 'Le fermier a refusé votre intérêt cette fois.', ar: 'رفض المزارع اهتمامك هذه المرة.', sw: 'Mkulima amekataa nia yako kwa sasa.', id: 'Petani menolak minat Anda kali ini.' },

  // Harvest form — field prompts + chip vocab
  'actionHome.harvest.datePrompt':    { en: 'Harvest date',             hi: 'कटाई की तारीख',            tw: 'Bere a wotwaeɛ',                es: 'Fecha de cosecha',            pt: 'Data da colheita',             fr: 'Date de récolte',               ar: 'تاريخ الحصاد',       sw: 'Tarehe ya mavuno',               id: 'Tanggal panen' },
  'actionHome.harvest.unitPrompt':     { en: 'Unit',                     hi: 'इकाई',                      tw: 'Ɔnkoroɔ',                       es: 'Unidad',                      pt: 'Unidade',                      fr: 'Unité',                         ar: 'الوحدة',              sw: 'Kipimo',                          id: 'Satuan' },
  'actionHome.harvest.issuesPrompt':   { en: 'Issues encountered (optional)', hi: 'सामने आई समस्याएँ (वैकल्पिक)', tw: 'Nsɛm a ebae (sɛ ɛwɔ hɔ a)',     es: 'Problemas encontrados (opcional)', pt: 'Problemas encontrados (opcional)', fr: 'Problèmes rencontrés (optionnel)', ar: 'المشكلات (اختياري)', sw: 'Masuala yaliyotokea (hiari)',  id: 'Masalah yang ditemui (opsional)' },

  'harvest.unit.kg':                  { en: 'kg',      hi: 'किग्रा',   tw: 'kg',      es: 'kg',     pt: 'kg',     fr: 'kg',      ar: 'كجم',     sw: 'kg',     id: 'kg' },
  'harvest.unit.lb':                  { en: 'lb',      hi: 'पाउंड',   tw: 'pɔn',     es: 'lb',     pt: 'lb',     fr: 'lb',      ar: 'رطل',     sw: 'paundi', id: 'lb' },
  'harvest.unit.crate':                { en: 'crate',  hi: 'क्रेट',     tw: 'adaka',   es: 'caja',   pt: 'caixa',  fr: 'caisse',  ar: 'صندوق',   sw: 'kreti',   id: 'peti' },
  'harvest.unit.bushel':               { en: 'bushel', hi: 'बुशल',      tw: 'bushel',  es: 'bushel', pt: 'alqueire', fr: 'boisseau', ar: 'بوشل', sw: 'bushel', id: 'gantang' },
  'harvest.unit.bag':                  { en: 'bag',    hi: 'बोरी',     tw: 'bɔɔsoɔ',  es: 'saco',   pt: 'saco',   fr: 'sac',     ar: 'كيس',     sw: 'gunia',  id: 'karung' },

  // Farmer-facing 3-band quality vocab (good/average/poor).
  'harvest.quality.average':          { en: 'Average', hi: 'औसत',       tw: 'Bɛyɛ',    es: 'Promedio', pt: 'Médio',  fr: 'Moyen',   ar: 'متوسط',   sw: 'Wastani', id: 'Rata-rata' },

  // Post-harvest issue chips (spec taxonomy)
  'harvest.issue.pest':               { en: 'Pests',            hi: 'कीट',              tw: 'Mmoawa',                     es: 'Plagas',                 pt: 'Pragas',            fr: 'Ravageurs',         ar: 'آفات',          sw: 'Wadudu',                 id: 'Hama' },
  'harvest.issue.drought':            { en: 'Drought',          hi: 'सूखा',              tw: 'Ɔpɛ',                         es: 'Sequía',                 pt: 'Seca',              fr: 'Sécheresse',        ar: 'جفاف',          sw: 'Ukame',                   id: 'Kekeringan' },
  'harvest.issue.excess_rain':        { en: 'Excess rain',      hi: 'अत्यधिक वर्षा',      tw: 'Nsuo bebree',                 es: 'Lluvia excesiva',        pt: 'Chuva em excesso',  fr: 'Pluies excessives', ar: 'أمطار غزيرة',   sw: 'Mvua nyingi',             id: 'Hujan berlebih' },
  'harvest.issue.missed_tasks':       { en: 'Missed tasks',     hi: 'छूटे कार्य',         tw: 'Adwuma a woanyɛ',             es: 'Tareas omitidas',        pt: 'Tarefas perdidas',  fr: 'Tâches manquées',   ar: 'مهام فائتة',    sw: 'Kazi zilizorukwa',       id: 'Tugas terlewat' },
  'harvest.issue.poor_growth':        { en: 'Poor growth',      hi: 'खराब वृद्धि',        tw: 'Nyin a enya yɛ den',          es: 'Crecimiento pobre',      pt: 'Crescimento fraco', fr: 'Croissance faible', ar: 'نمو ضعيف',      sw: 'Ukuaji dhaifu',           id: 'Pertumbuhan buruk' },
  'harvest.issue.other':              { en: 'Other',            hi: 'अन्य',              tw: 'Foforɔ',                      es: 'Otro',                   pt: 'Outro',             fr: 'Autre',             ar: 'أخرى',         sw: 'Nyingine',                id: 'Lainnya' },

  // Summary bullet keys driven by farmer-reported issue tags
  'summary.issueTag.pest':            { en: 'Pest pressure affected the crop',           hi: 'कीट दबाव ने फसल को प्रभावित किया',           tw: 'Mmoawa kaa afudeɛ no',                       es: 'La presión de plagas afectó el cultivo',        pt: 'A pressão de pragas afetou a cultura',          fr: 'Les ravageurs ont affecté la culture',           ar: 'أثر ضغط الآفات على المحصول',   sw: 'Mkazo wa wadudu uliathiri zao',            id: 'Tekanan hama memengaruhi tanaman' },
  'summary.issueTag.drought':         { en: 'Drought reduced growth this cycle',          hi: 'इस चक्र में सूखे से वृद्धि कम हुई',           tw: 'Ɔpɛ maa nyin no yɛɛ kakraa',                  es: 'La sequía redujo el crecimiento',               pt: 'A seca reduziu o crescimento',                  fr: 'La sécheresse a réduit la croissance',            ar: 'قلل الجفاف من النمو',           sw: 'Ukame ulipunguza ukuaji',                   id: 'Kekeringan mengurangi pertumbuhan' },
  'summary.issueTag.excessRain':      { en: 'Excess rain stressed the crop',              hi: 'अत्यधिक वर्षा ने फसल पर दबाव डाला',           tw: 'Nsuo bebree kaa afudeɛ no',                   es: 'El exceso de lluvia estresó el cultivo',         pt: 'O excesso de chuva estressou a cultura',         fr: 'L\'excès de pluie a stressé la culture',           ar: 'أجهد فائض المطر المحصول',     sw: 'Mvua nyingi iliathiri zao',                 id: 'Hujan berlebih menekan tanaman' },
  'summary.issueTag.missedTasks':     { en: 'Missed tasks reduced cycle performance',     hi: 'छूटे कार्यों से चक्र प्रदर्शन कम हुआ',       tw: 'Adwuma a woanyɛ maa adwuma no yɛɛ den',       es: 'Las tareas omitidas redujeron el rendimiento',  pt: 'Tarefas perdidas reduziram o desempenho',        fr: 'Les tâches manquées ont réduit la performance',    ar: 'أثرت المهام الفائتة على الأداء', sw: 'Kazi zilizorukwa zilipunguza utendaji',   id: 'Tugas yang terlewat menurunkan performa' },
  'summary.issueTag.poorGrowth':      { en: 'Growth was slower than expected',            hi: 'वृद्धि अपेक्षा से धीमी रही',                  tw: 'Nyin no yɛɛ brɛoo sen sɛnea ɛhia',             es: 'El crecimiento fue más lento de lo esperado',    pt: 'O crescimento foi mais lento que o esperado',    fr: 'La croissance a été plus lente que prévu',          ar: 'كان النمو أبطأ من المتوقع',      sw: 'Ukuaji ulikuwa polepole kuliko ilivyotarajiwa', id: 'Pertumbuhan lebih lambat dari perkiraan' },
  'summary.issueTag.other':           { en: 'Other factors affected the cycle',           hi: 'अन्य कारकों ने चक्र को प्रभावित किया',        tw: 'Nneɛma foforɔ kaa adwuma no',                 es: 'Otros factores afectaron el ciclo',              pt: 'Outros fatores afetaram o ciclo',                fr: 'D\'autres facteurs ont affecté le cycle',           ar: 'أثرت عوامل أخرى على الدورة',   sw: 'Sababu nyingine ziliathiri mzunguko',      id: 'Faktor lain memengaruhi siklus' },
  'postHarvest.whatWentWell':        { en: 'What went well',           hi: 'क्या अच्छा रहा',           tw: 'Nea ɛyɛɛ yie',                  es: 'Lo que salió bien',           pt: 'O que correu bem',             fr: 'Ce qui s\'est bien passé',       ar: 'ما سار بشكل جيد',    sw: 'Yaliyoenda vizuri',              id: 'Yang berjalan baik' },
  'postHarvest.whatCouldImprove':    { en: 'What could improve',       hi: 'क्या बेहतर हो सकता है',    tw: 'Nea ebetumi asɔre',             es: 'Qué puede mejorar',           pt: 'O que pode melhorar',          fr: 'Ce qui peut s\'améliorer',        ar: 'ما يمكن تحسينه',    sw: 'Yanayoweza kuboreshwa',          id: 'Yang bisa ditingkatkan' },
  'postHarvest.metrics.completion':  { en: 'Completion',   hi: 'पूर्णता',        tw: 'Ɔwiee',           es: 'Finalización',   pt: 'Conclusão',      fr: 'Achèvement',    ar: 'الإنجاز',      sw: 'Ukamilishaji',      id: 'Penyelesaian' },
  'postHarvest.metrics.skipped':     { en: 'Skipped',      hi: 'छोड़े गए',       tw: 'Wɔafa akyen',     es: 'Omitidas',       pt: 'Ignoradas',      fr: 'Passées',       ar: 'التُخطيها',   sw: 'Zilizorukwa',       id: 'Dilewati' },
  'postHarvest.metrics.issues':      { en: 'Issues',       hi: 'समस्याएँ',       tw: 'Nsɛm',            es: 'Problemas',      pt: 'Problemas',      fr: 'Problèmes',     ar: 'المشاكل',     sw: 'Masuala',           id: 'Masalah' },
  'postHarvest.metrics.quality':     { en: 'Quality',      hi: 'गुणवत्ता',        tw: 'Papa',            es: 'Calidad',        pt: 'Qualidade',      fr: 'Qualité',       ar: 'الجودة',      sw: 'Ubora',             id: 'Kualitas' },
  'postHarvest.metrics.yield':       { en: 'Yield',        hi: 'उत्पादन',         tw: 'Nea wɔatwa',      es: 'Rendimiento',    pt: 'Produção',       fr: 'Rendement',     ar: 'الإنتاج',     sw: 'Mavuno',            id: 'Hasil' },
  'postHarvest.metrics.duration':    { en: 'Duration',     hi: 'अवधि',            tw: 'Berɛ',            es: 'Duración',       pt: 'Duração',        fr: 'Durée',         ar: 'المدة',       sw: 'Muda',              id: 'Durasi' },
  'postHarvest.metrics.timing':      { en: 'Timing vs plan', hi: 'योजना बनाम समय', tw: 'Berɛ ne nhyehyɛe', es: 'Sincronía',      pt: 'Tempo vs. plano', fr: 'Calendrier',   ar: 'التوقيت',     sw: 'Muda dhidi ya mpango', id: 'Waktu vs rencana' },

  // Outcome class headlines (summary)
  'summary.headline.successful':     { en: 'Successful cycle',         hi: 'सफल चक्र',                 tw: 'Adwuma a ɛyɛɛ yie',             es: 'Ciclo exitoso',               pt: 'Ciclo bem-sucedido',           fr: 'Cycle réussi',                  ar: 'دورة ناجحة',         sw: 'Mzunguko uliofanikiwa',         id: 'Siklus sukses' },
  'summary.headline.delayed':        { en: 'Delayed cycle',            hi: 'विलंबित चक्र',             tw: 'Adwuma a ekyɛɛ',                es: 'Ciclo retrasado',             pt: 'Ciclo atrasado',               fr: 'Cycle retardé',                 ar: 'دورة متأخرة',        sw: 'Mzunguko ulioshelewa',          id: 'Siklus tertunda' },
  'summary.headline.highRisk':       { en: 'High-risk cycle',          hi: 'उच्च-जोखिम चक्र',          tw: 'Adwuma a asiane kɛse wom',       es: 'Ciclo de alto riesgo',        pt: 'Ciclo de alto risco',          fr: 'Cycle à haut risque',           ar: 'دورة عالية المخاطر', sw: 'Mzunguko wa hatari kubwa',      id: 'Siklus berisiko tinggi' },
  'summary.headline.failed':         { en: 'Cycle did not succeed',    hi: 'चक्र सफल नहीं हुआ',         tw: 'Adwuma no anyɛ yie',            es: 'El ciclo no tuvo éxito',      pt: 'O ciclo não teve sucesso',     fr: 'Le cycle n\'a pas réussi',       ar: 'لم تنجح الدورة',     sw: 'Mzunguko haukufanikiwa',        id: 'Siklus tidak berhasil' },

  // What went well — bullets
  'summary.wentWell.completedMostTasks': { en: 'You completed most tasks on time',         hi: 'आपने अधिकतर कार्य समय पर पूरे किए',       tw: 'Wowiee adwuma dodow no ara berɛ no mu',      es: 'Completaste la mayoría de las tareas a tiempo', pt: 'Você concluiu a maioria das tarefas no prazo', fr: 'Vous avez accompli la plupart des tâches à temps', ar: 'أنجزت معظم المهام في الوقت المحدد', sw: 'Ulikamilisha kazi nyingi kwa wakati',    id: 'Anda menyelesaikan sebagian besar tugas tepat waktu' },
  'summary.wentWell.noSkips':             { en: 'You did not skip any task',                 hi: 'आपने कोई कार्य नहीं छोड़ा',               tw: 'Woannyae adwuma biara',                       es: 'No omitiste ninguna tarea',                     pt: 'Você não ignorou nenhuma tarefa',               fr: 'Vous n\'avez sauté aucune tâche',                  ar: 'لم تتخطَ أي مهمة',                sw: 'Hukuruka kazi yoyote',                    id: 'Anda tidak melewatkan tugas apa pun' },
  'summary.wentWell.reportedIssuesEarly': { en: 'Reporting issues early helped',             hi: 'समस्याओं की जल्दी रिपोर्ट करने से मदद मिली',  tw: 'Nsɛm a wokaa ntɛm boaa',                     es: 'Reportar los problemas a tiempo ayudó',         pt: 'Relatar problemas cedo ajudou',                 fr: 'Signaler les problèmes tôt a aidé',                 ar: 'الإبلاغ المبكر عن المشاكل ساعد',   sw: 'Kuripoti masuala mapema kulisaidia',       id: 'Melaporkan masalah sejak dini sangat membantu' },
  'summary.wentWell.qualityStrong':       { en: 'Your harvest quality was strong',           hi: 'आपकी फसल की गुणवत्ता अच्छी रही',         tw: 'Wo twa no papa',                             es: 'La calidad de tu cosecha fue buena',           pt: 'A qualidade da sua colheita foi boa',          fr: 'La qualité de votre récolte était bonne',            ar: 'جودة الحصاد كانت جيدة',          sw: 'Ubora wa mavuno yako ulikuwa mzuri',       id: 'Kualitas panen Anda kuat' },
  'summary.wentWell.fewIssues':           { en: 'Very few issues throughout the cycle',      hi: 'चक्र के दौरान बहुत कम समस्याएँ',         tw: 'Nsɛm no yɛ kakraa bi',                       es: 'Muy pocos problemas en todo el ciclo',         pt: 'Muito poucos problemas ao longo do ciclo',     fr: 'Très peu de problèmes durant le cycle',              ar: 'مشاكل قليلة جدًا طوال الدورة',    sw: 'Masuala machache sana katika mzunguko',    id: 'Sangat sedikit masalah sepanjang siklus' },
  'summary.wentWell.cycleCompleted':      { en: 'You completed a full crop cycle',           hi: 'आपने पूरा फसल चक्र पूरा किया',           tw: 'Wowiee afudeɛ adwuma a edi mu',              es: 'Completaste un ciclo de cultivo completo',      pt: 'Você completou um ciclo de cultivo completo',   fr: 'Vous avez terminé un cycle complet',                  ar: 'أكملت دورة محصول كاملة',          sw: 'Ulikamilisha mzunguko kamili',              id: 'Anda menyelesaikan satu siklus penuh' },

  // What could improve — bullets
  'summary.couldImprove.tooManySkips':    { en: 'Several tasks were skipped',                 hi: 'कई कार्य छोड़ दिए गए',                      tw: 'Adwuma pii na woannyɛ',                       es: 'Se omitieron varias tareas',                    pt: 'Várias tarefas foram ignoradas',                fr: 'Plusieurs tâches ont été sautées',                   ar: 'تم تخطي عدة مهام',                 sw: 'Kazi kadhaa ziliokwepwa',                     id: 'Beberapa tugas dilewati' },
  'summary.couldImprove.lowCompletion':   { en: 'Task completion was low',                    hi: 'कार्य पूर्णता कम रही',                       tw: 'Adwuma no anwie daa',                         es: 'La finalización de tareas fue baja',            pt: 'A conclusão de tarefas foi baixa',              fr: 'Le taux d\'achèvement des tâches était faible',      ar: 'كان إكمال المهام منخفضًا',       sw: 'Ukamilishaji wa kazi ulikuwa chini',         id: 'Penyelesaian tugas rendah' },
  'summary.couldImprove.multipleIssues':  { en: 'Multiple issues affected the cycle',         hi: 'कई समस्याओं ने चक्र को प्रभावित किया',     tw: 'Nsɛm pii na ɛkaa adwuma no',                  es: 'Varios problemas afectaron el ciclo',           pt: 'Vários problemas afetaram o ciclo',             fr: 'Plusieurs problèmes ont affecté le cycle',           ar: 'أثرت عدة مشاكل على الدورة',    sw: 'Masuala kadhaa yaliathiri mzunguko',         id: 'Beberapa masalah memengaruhi siklus' },
  'summary.couldImprove.weatherDelays':   { en: 'Weather caused some task delays',            hi: 'मौसम के कारण कुछ कार्य विलंबित हुए',         tw: 'Wim tebea maa adwuma bi kyɛɛe',                es: 'El clima causó retrasos en tareas',              pt: 'O tempo causou atrasos em tarefas',              fr: 'La météo a causé des retards',                        ar: 'تسبب الطقس في تأخر بعض المهام',sw: 'Hali ya hewa ilisababisha baadhi ya kuchelewa', id: 'Cuaca menyebabkan penundaan tugas' },
  'summary.couldImprove.harvestedLate':   { en: 'Harvested later than planned',               hi: 'योजना से देर से कटाई',                     tw: 'Wotwaeɛ no akyiri',                            es: 'Cosechaste más tarde de lo planeado',            pt: 'Colheu mais tarde do que o planeado',            fr: 'Récolté plus tard que prévu',                          ar: 'حصدت متأخرًا عن المخطط',       sw: 'Ulivuna baadaye kuliko mpango',               id: 'Panen lebih lambat dari rencana' },
  'summary.couldImprove.harvestedEarly':  { en: 'Harvested earlier than planned',             hi: 'योजना से जल्दी कटाई',                      tw: 'Wotwaeɛ no ntɛm sen sɛnea na wɔahyehyɛ',       es: 'Cosechaste antes de lo planeado',                pt: 'Colheu antes do planeado',                       fr: 'Récolté plus tôt que prévu',                           ar: 'حصدت قبل الموعد المخطط',      sw: 'Ulivuna mapema kuliko mpango',                id: 'Panen lebih cepat dari rencana' },
  'summary.couldImprove.qualityPoor':     { en: 'Harvest quality was low',                    hi: 'फसल की गुणवत्ता कम रही',                    tw: 'Wo twa no papa yɛ sua',                         es: 'La calidad fue baja',                            pt: 'A qualidade foi baixa',                           fr: 'La qualité était faible',                              ar: 'جودة الحصاد كانت منخفضة',      sw: 'Ubora wa mavuno ulikuwa chini',               id: 'Kualitas panen rendah' },
  'summary.couldImprove.consider_support':{ en: 'Consider extra support next time',            hi: 'अगली बार अतिरिक्त सहायता पर विचार करें',   tw: 'Susuw mmoa foforɔ ho berɛ a ɛreba',            es: 'Considera más apoyo la próxima vez',              pt: 'Considere mais apoio da próxima vez',             fr: 'Pensez à plus de soutien la prochaine fois',            ar: 'ضع في اعتبارك دعمًا إضافيًا',  sw: 'Fikiria msaada zaidi safari ijayo',           id: 'Pertimbangkan dukungan tambahan lain kali' },

  // Next-cycle card
  'nextCycle.title':                 { en: "What's next?", hi: 'आगे क्या?',  tw: 'Deɛ ɛdi hɔ ne sɛn?',  es: '¿Qué sigue?',  pt: 'O que vem agora?',  fr: 'Et après ?',   ar: 'ما التالي؟',  sw: 'Kinachofuata?',  id: 'Apa selanjutnya?' },
  'nextCycle.headline.successful':   { en: 'Great cycle — pick your next move',  hi: 'बढ़िया चक्र — अगला कदम चुनें',  tw: 'Adwuma pa — yi nea ɛdi hɔ',  es: 'Gran ciclo — elige tu siguiente paso',  pt: 'Ótimo ciclo — escolha o próximo passo',  fr: 'Beau cycle — choisissez la suite',  ar: 'دورة رائعة — اختر خطوتك التالية',  sw: 'Mzunguko mzuri — chagua hatua inayofuata',  id: 'Siklus bagus — pilih langkah berikutnya' },
  'nextCycle.headline.delayed':      { en: 'Try an earlier start next cycle',   hi: 'अगले चक्र में जल्दी शुरू करें',   tw: 'Yɛ ntɛm wɔ adwuma a ɛdi hɔ no',   es: 'Intenta empezar antes el próximo ciclo',   pt: 'Tente começar mais cedo no próximo ciclo',   fr: 'Essayez de commencer plus tôt au prochain cycle',   ar: 'حاول البدء مبكرًا في الدورة التالية',   sw: 'Jaribu kuanza mapema mzunguko ujao',   id: 'Coba mulai lebih awal siklus berikutnya' },
  'nextCycle.headline.highRisk':     { en: 'Consider a safer crop next cycle',  hi: 'अगले चक्र में सुरक्षित फसल पर विचार करें',  tw: 'Susuw afudeɛ a ahobammɔ wom ho',  es: 'Considera un cultivo más seguro',  pt: 'Considere uma cultura mais segura',  fr: 'Envisagez une culture plus sûre',  ar: 'ضع في اعتبارك محصولًا أكثر أمانًا',  sw: 'Fikiria zao salama zaidi',  id: 'Pertimbangkan tanaman yang lebih aman' },
  'nextCycle.headline.failed':       { en: "Let's pick a better-fit crop",       hi: 'एक बेहतर फसल चुनते हैं',          tw: 'Yɛfa afudeɛ a ɛfata kyɛn',         es: 'Elijamos un cultivo más adecuado',           pt: 'Vamos escolher uma cultura mais adequada',    fr: 'Choisissons une culture plus adaptée',                  ar: 'لنختر محصولًا أنسب',               sw: 'Tuchague zao linalofaa zaidi',                id: 'Mari pilih tanaman yang lebih cocok' },
  'nextCycle.type.repeat_improved':  { en: 'Repeat improved',  hi: 'बेहतर प्लान से दोहराएँ',  tw: 'San yɛ no bio',  es: 'Repetir mejorado',  pt: 'Repetir aprimorado',  fr: 'Répéter amélioré',  ar: 'كرر محسّن',  sw: 'Rudia kwa maboresho',  id: 'Ulangi diperbaiki' },
  'nextCycle.type.switch_crop':      { en: 'Switch crop',      hi: 'फसल बदलें',              tw: 'Sesa afudeɛ',      es: 'Cambiar cultivo',  pt: 'Trocar cultura',       fr: 'Changer de culture',  ar: 'تبديل المحصول',  sw: 'Badilisha zao',        id: 'Ganti tanaman' },
  'nextCycle.type.delay_same_crop':  { en: 'Delay planting',   hi: 'बुवाई में देरी',         tw: 'Twɛn dua no',      es: 'Aplazar siembra',   pt: 'Atrasar plantio',     fr: 'Retarder la plantation', ar: 'تأجيل الزراعة', sw: 'Ahirisha kupanda',    id: 'Tunda tanam' },
  'nextCycle.type.auto_pick':        { en: 'Let the app choose', hi: 'ऐप को चुनने दें',    tw: 'Ma app no nyi',    es: 'Deja que la app elija', pt: 'Deixe o app escolher', fr: "Laissez l'app choisir",  ar: 'دع التطبيق يختار',  sw: 'Acha programu ichague', id: 'Biarkan aplikasi memilih' },
  'nextCycle.option.repeatImproved': { en: 'Repeat the same crop with an improved plan based on what you learned',  hi: 'अपने सबक के आधार पर बेहतर योजना के साथ वही फसल दोहराएँ',  tw: 'Fa wo suahu no yɛ nhyehyɛe foforɔ na san yɛ afudeɛ koro no',  es: 'Repite el mismo cultivo con un plan mejorado',  pt: 'Repita a mesma cultura com um plano aprimorado',  fr: 'Répétez la même culture avec un plan amélioré',  ar: 'كرر نفس المحصول بخطة محسّنة',  sw: 'Rudia zao lile lile kwa mpango ulioboreshwa',  id: 'Ulangi tanaman yang sama dengan rencana yang lebih baik' },
  'nextCycle.option.switchCrop':     { en: 'Try a better-fit crop for the next window',  hi: 'अगले अवसर के लिए बेहतर फसल आज़माएँ',  tw: 'Sɔ afudeɛ a ɛfata kyɛn wɔ bere a ɛreba',  es: 'Prueba un cultivo más adecuado',  pt: 'Experimente uma cultura mais adequada',  fr: 'Essayez une culture mieux adaptée',  ar: 'جرّب محصولًا أنسب',  sw: 'Jaribu zao linalofaa zaidi',  id: 'Coba tanaman yang lebih cocok' },
  'nextCycle.option.delay':          { en: 'Wait for the next planting window to open',  hi: 'अगले बुवाई अवसर की प्रतीक्षा करें',  tw: 'Twɛn kosi sɛ bere pa a wobɛdua bɛba',  es: 'Espera a la próxima ventana de siembra',  pt: 'Aguarde a próxima janela de plantio',  fr: 'Attendez la prochaine fenêtre de plantation',  ar: 'انتظر نافذة الزراعة التالية',  sw: 'Subiri dirisha la kupanda linalofuata',  id: 'Tunggu jendela tanam berikutnya' },
  'nextCycle.option.autoPick':       { en: 'Let the recommendation engine choose the strongest option for now',  hi: 'अभी के लिए सबसे अच्छा विकल्प ऐप चुनने दें',  tw: 'Ma akwankyerɛ no nyi deɛ ɛyɛ pa paa',  es: 'Deja que el motor de recomendaciones elija',  pt: 'Deixe o motor de recomendações escolher',  fr: 'Laissez le moteur choisir',  ar: 'دع المحرك يختار',  sw: 'Acha injini ichague',  id: 'Biarkan mesin rekomendasi memilih' },
  'nextCycle.hint.repeatImproved':   { en: 'Repeat with an improved plan', hi: 'बेहतर योजना के साथ दोहराएँ', tw: 'San yɛ no bio nso ma ɛyɛ yiye', es: 'Repite con un plan mejorado', pt: 'Repita com um plano aprimorado', fr: 'Répéter avec un plan amélioré', ar: 'كرّر بخطة محسّنة', sw: 'Rudia kwa mpango ulioboreshwa', id: 'Ulangi dengan rencana yang lebih baik' },
  'nextCycle.hint.tryEarlier':       { en: 'Try planting earlier',         hi: 'जल्दी बुवाई का प्रयास करें',  tw: 'Sɔ ntɛm dua',                   es: 'Intenta sembrar antes',       pt: 'Tente plantar mais cedo',      fr: 'Essayez de planter plus tôt',   ar: 'حاول الزرع مبكرًا',  sw: 'Jaribu kupanda mapema',          id: 'Coba tanam lebih awal' },
  'nextCycle.hint.saferCrop':        { en: 'Pick a safer crop',            hi: 'सुरक्षित फसल चुनें',           tw: 'Yi afudeɛ a ahobammɔ wom',     es: 'Elige un cultivo más seguro',  pt: 'Escolha uma cultura mais segura', fr: 'Choisissez une culture plus sûre', ar: 'اختر محصولًا أكثر أمانًا', sw: 'Chagua zao salama zaidi', id: 'Pilih tanaman yang lebih aman' },
  'nextCycle.hint.switchCrop':       { en: 'Consider switching crops',     hi: 'फसल बदलने पर विचार करें',      tw: 'Susuw sɛ wobɛsesa afudeɛ',     es: 'Considera cambiar de cultivo', pt: 'Considere trocar de cultura',   fr: 'Envisagez de changer de culture', ar: 'ضع في اعتبارك تغيير المحصول', sw: 'Fikiria kubadilisha zao', id: 'Pertimbangkan mengganti tanaman' },
  'actionHome.stage.title':          { en: 'Crop stage',               fr: 'Stade',              sw: 'Hatua ya zao',          ha: 'Matakin amfani',        tw: 'Afudeɛ mu berɛ',         hi: 'फसल की अवस्था' },
  'actionHome.stage.none':           { en: 'No active crop cycle',     fr: 'Aucun cycle actif',  sw: 'Hakuna mzunguko',       ha: 'Babu aiki',             tw: 'Afudeɛ adwuma nni hɔ',   hi: 'अभी कोई फसल चक्र नहीं' },
  'actionHome.motivation.title':     { en: "You're doing well",        fr: 'Bon travail',        sw: 'Unafanya vizuri',       ha: 'Kuna yi da kyau',       tw: 'Woreyɛ yie',             hi: 'आप अच्छा कर रहे हैं' },
  'actionHome.motivation.body':      { en: 'Every small step makes your farm stronger.', fr: 'Chaque petit pas compte.', sw: 'Kila hatua ndogo hufanya shamba lako kuwa imara.', ha: 'Kowane mataki yana ƙara ƙarfin gonar ku.', tw: 'Anammɔn biara ma w\'afuo mu yɛ den.', hi: 'हर छोटा कदम आपके खेत को मजबूत बनाता है।' },
  'actionHome.todayHeader':          { en: 'Today on your farm',              fr: 'Aujourd\'hui sur votre ferme',   sw: 'Leo kwenye shamba lako',        ha: 'Yau a gonarku',               tw: 'Nnɛ wɔ w\'afuo so',           hi: 'आज आपके खेत पर' },
  'actionHome.primary.reportIssue':  { en: 'Report an issue',                 fr: 'Signaler un problème',           sw: 'Ripoti tatizo',                 ha: 'Bayar da rahoton matsala',    tw: 'Ka ɔhaw',                     hi: 'समस्या की रिपोर्ट करें' },

  // ─── Feedback loop — skip / harvest / issue prompts ────────
  'actionHome.primary.skip':           { en: 'Skip',                           fr: 'Passer',                          sw: 'Ruka',                           ha: 'Tsallake',                   tw: 'Fa kyɛn',                     hi: 'छोड़ें' },
  'actionHome.primary.skipReason':     { en: 'Why are you skipping?',          fr: 'Pourquoi passer ?',               sw: 'Kwa nini unaruka?',              ha: 'Me ya sa kake tsallake?',    tw: 'Adɛn na worefa kyɛn?',        hi: 'क्यों छोड़ रहे हैं?' },
  'actionHome.primary.reportHarvest':  { en: 'Report harvest',                 fr: 'Signaler la récolte',             sw: 'Ripoti mavuno',                  ha: 'Bayar da rahoton girbi',     tw: 'Ka wo twa ho asɛm',           hi: 'फसल की रिपोर्ट करें' },
  'actionHome.issue.categoryPrompt':   { en: 'Category (pest/disease/water/soil/weather/other)', fr: 'Catégorie (ravageurs/maladie/eau/sol/météo/autre)', sw: 'Aina (wadudu/magonjwa/maji/udongo/hewa/nyingine)', ha: 'Nau\'i (kwari/cuta/ruwa/kasa/yanayi/sauran)', tw: 'Ɔhaw su (mmoawa/yadeɛ/nsuo/asase/wim/foforɔ)', hi: 'श्रेणी (कीट/रोग/पानी/मिट्टी/मौसम/अन्य)' },
  'actionHome.issue.severityPrompt':   { en: 'Severity (low/medium/high)',     fr: 'Sévérité (faible/moyen/élevé)',   sw: 'Ukali (chini/kati/juu)',         ha: 'Tsanani (ƙasa/matsakaici/sama)', tw: 'Ɛhyɛ mu (kakra/ntam/kɛse)',   hi: 'गंभीरता (कम/मध्यम/उच्च)' },
  'actionHome.issue.descriptionPrompt':{ en: 'What happened?',                 fr: 'Que s\'est-il passé ?',           sw: 'Nini kilichotokea?',             ha: 'Me ya faru?',                tw: 'Ɛdeɛn na asi?',               hi: 'क्या हुआ?' },
  'actionHome.harvest.yieldPrompt':    { en: 'Yield in kg (optional)',         fr: 'Rendement en kg (optionnel)',     sw: 'Mavuno kwa kg (hiari)',          ha: 'Girbi a kg (na son rai)',    tw: 'Deɛ wotwaeɛ (kg)',            hi: 'उपज किलोग्राम में (वैकल्पिक)' },
  'actionHome.harvest.qualityPrompt':  { en: 'Quality (poor/fair/good/excellent)', fr: 'Qualité (faible/moyen/bon/excellent)', sw: 'Ubora (duni/wastani/nzuri/bora)', ha: 'Inganci (ƙasa/matsakaici/kyau/mafi kyau)', tw: 'Papa (enye/bɛyɛ/pa/papapa)', hi: 'गुणवत्ता (खराब/औसत/अच्छा/उत्कृष्ट)' },
  'actionHome.harvest.notesPrompt':    { en: 'Notes (optional)',               fr: 'Notes (optionnel)',               sw: 'Maelezo (hiari)',                ha: 'Bayanin kula (na son rai)',  tw: 'Nsɛm a woka',                 hi: 'नोट्स (वैकल्पिक)' },
  'actionHome.feedback.didThisHelp':   { en: 'Did this help?',                 fr: 'Est-ce que cela a aidé ?',        sw: 'Je, hii ilisaidia?',             ha: 'Shin wannan ya taimaka?',    tw: 'So yei boaa wo?',             hi: 'क्या इससे मदद मिली?' },

  // ─── Generated task titles (type × crop × timing) ──────────
  'generatedTask.crop.generic':       { en: 'your crop',        fr: 'votre culture',     sw: 'zao lako',         ha: 'amfaninku',       tw: 'w\'afudeɛ',       hi: 'आपकी फसल' },
  'generatedTask.crop.tomato':        { en: 'tomatoes',         fr: 'tomates',           sw: 'nyanya',           ha: 'tumatir',         tw: 'ntɔs',            hi: 'टमाटर' },
  'generatedTask.crop.pepper':        { en: 'peppers',          fr: 'poivrons',          sw: 'pilipili hoho',    ha: 'tattasai',        tw: 'mako',            hi: 'मिर्च' },
  'generatedTask.crop.lettuce':       { en: 'lettuce',          fr: 'laitue',            sw: 'letusi',           ha: 'letas',           tw: 'letusi',          hi: 'लेट्यूस' },
  'generatedTask.crop.kale':          { en: 'kale',             fr: 'chou frisé',        sw: 'sukuma wiki',      ha: 'kel',             tw: 'kale',            hi: 'केल' },
  'generatedTask.crop.okra':          { en: 'okra',             fr: 'gombo',             sw: 'bamia',            ha: 'kubewa',          tw: 'nkruma',          hi: 'भिंडी' },
  'generatedTask.crop.sweet_potato':  { en: 'sweet potatoes',   fr: 'patates douces',    sw: 'viazi vitamu',     ha: 'dankalin hausa',  tw: 'santom',          hi: 'शकरकंद' },
  'generatedTask.crop.peanut':        { en: 'peanuts',          fr: 'arachides',         sw: 'karanga',          ha: 'gyada',           tw: 'nkateɛ',          hi: 'मूँगफली' },
  'generatedTask.crop.sorghum':       { en: 'sorghum',          fr: 'sorgho',            sw: 'mtama',            ha: 'dawa',            tw: 'atoko',           hi: 'ज्वार' },
  'generatedTask.crop.corn':          { en: 'corn',             fr: 'maïs',              sw: 'mahindi',          ha: 'masara',          tw: 'aburoo',          hi: 'मक्का' },

  'generatedTask.timing.today':       { en: 'today',            fr: 'aujourd\'hui',      sw: 'leo',              ha: 'yau',             tw: 'nnɛ',             hi: 'आज' },
  'generatedTask.timing.this_week':   { en: 'this week',        fr: 'cette semaine',     sw: 'wiki hii',         ha: 'wannan mako',     tw: 'dapɛn yi',        hi: 'इस सप्ताह' },
  'generatedTask.timing.this_month':  { en: 'this month',       fr: 'ce mois-ci',        sw: 'mwezi huu',        ha: 'wannan wata',     tw: 'bosome yi',       hi: 'इस महीने' },

  // Watering
  'generatedTask.watering.title':     { en: 'Water {crop} {timing}', fr: 'Arroser {crop} {timing}', sw: 'Mwagilia {crop} {timing}', ha: 'Shayar da {crop} {timing}', tw: 'Gu {crop} nsuo {timing}', hi: '{timing} {crop} को पानी दें' },
  'generatedTask.watering.detail':    { en: 'Keep the top inch of soil damp — not soggy.', fr: 'Maintenez le sol humide sans être détrempé.', sw: 'Udongo wa juu uwe na unyevu, si maji.', ha: 'Ajiye ƙasa mai laima, ba ƙasa mai jiƙa ba.', tw: 'Ma asase no ani yɛ fɔkyee na ɛnnyɛ bɛtɛɛ.', hi: 'मिट्टी की ऊपरी परत नम रखें — ज्यादा गीली नहीं।' },
  'generatedTask.watering.eta':       { en: '15 min',           fr: '15 min',            sw: 'dakika 15',        ha: 'minti 15',        tw: 'simma 15',        hi: '15 मिनट' },

  // Planting
  'generatedTask.planting.title':     { en: 'Plant {crop} {timing}', fr: 'Planter {crop} {timing}', sw: 'Panda {crop} {timing}', ha: 'Shuka {crop} {timing}', tw: 'Dua {crop} {timing}', hi: '{timing} {crop} लगाएँ' },
  'generatedTask.planting.detail':    { en: 'Follow the spacing on the packet and water the row in gently.', fr: 'Respectez l\'espacement et arrosez doucement.', sw: 'Fuata nafasi za pakiti na mwagilia kwa upole.', ha: 'Bi jeri akan kunshin da a hankali a shayar.', tw: 'Di nkyerɛkyerɛmu akyi na gu nsuo a ɛyɛ brɛoo.', hi: 'पैकेट पर दी गई दूरी रखें और हल्के से पानी दें।' },
  'generatedTask.planting.eta':       { en: '30 min',           fr: '30 min',            sw: 'dakika 30',        ha: 'minti 30',        tw: 'simma 30',        hi: '30 मिनट' },

  // Pest inspection
  'generatedTask.pest_inspection.title':  { en: 'Inspect {crop} leaves for pests {timing}', fr: 'Inspecter les feuilles de {crop} {timing}', sw: 'Kagua majani ya {crop} kwa wadudu {timing}', ha: 'Duba ganyen {crop} don kwari {timing}', tw: 'Hwɛ {crop} nhahanam mu mmoawa {timing}', hi: '{timing} {crop} की पत्तियों पर कीट जाँचें' },
  'generatedTask.pest_inspection.detail': { en: 'Flip leaves and check undersides — catch pests before damage spreads.', fr: 'Retournez les feuilles — attrapez les ravageurs tôt.', sw: 'Geuza majani uangalie chini — shika wadudu mapema.', ha: 'Juya ganye ka duba ƙasa — kama kwari da wuri.', tw: 'Dan nhahanam so hwɛ — kyere mmoawa ntɛm.', hi: 'पत्तियों को पलटकर नीचे देखें — नुकसान फैलने से पहले पकड़ें।' },
  'generatedTask.pest_inspection.eta':    { en: '10 min',       fr: '10 min',            sw: 'dakika 10',        ha: 'minti 10',        tw: 'simma 10',        hi: '10 मिनट' },

  // Fertilizer
  'generatedTask.fertilizer.title':   { en: 'Feed {crop} {timing}', fr: 'Fertiliser {crop} {timing}', sw: 'Mbolea {crop} {timing}', ha: 'Shayar da takin {crop} {timing}', tw: 'Ma {crop} aduane {timing}', hi: '{timing} {crop} को खाद दें' },
  'generatedTask.fertilizer.detail':  { en: 'Side-dress with compost or a balanced feed. Water it in.', fr: 'Compost ou engrais équilibré — arrosez après.', sw: 'Weka mbolea pembeni, kisha mwagilia.', ha: 'Saka takin gefe sannan ka shayar.', tw: 'Fa aduane to ɛho na gu nsuo.', hi: 'खाद पास में डालें और पानी दें।' },
  'generatedTask.fertilizer.eta':     { en: '25 min',           fr: '25 min',            sw: 'dakika 25',        ha: 'minti 25',        tw: 'simma 25',        hi: '25 मिनट' },

  // Harvest
  'generatedTask.harvest.title':      { en: 'Harvest {crop} {timing}', fr: 'Récolter {crop} {timing}', sw: 'Vuna {crop} {timing}', ha: 'Girbi {crop} {timing}', tw: 'Twa {crop} {timing}', hi: '{timing} {crop} की कटाई करें' },
  'generatedTask.harvest.detail':     { en: 'Pick at the right size. Daily picking keeps the plant producing.', fr: 'Cueillez quand c\'est mûr.', sw: 'Chuma kwa ukubwa sahihi. Kuchuma kila siku kunasaidia.', ha: 'Ka girbi lokacin da ya dace.', tw: 'Twa berɛ a ɛfata — daa daa twa ma afudeɛ no kɔ so.', hi: 'सही आकार पर चुनें — रोज़ चुनने से पौधा फलता रहता है।' },
  'generatedTask.harvest.eta':        { en: '45 min',           fr: '45 min',            sw: 'dakika 45',        ha: 'minti 45',        tw: 'simma 45',        hi: '45 मिनट' },

  // Weed control
  'generatedTask.weed_control.title': { en: 'Weed {crop} rows {timing}', fr: 'Désherber {crop} {timing}', sw: 'Ng\'oa magugu katika {crop} {timing}', ha: 'Share ciyawa a {crop} {timing}', tw: 'Yi nwura fi {crop} mu {timing}', hi: '{timing} {crop} की पंक्तियाँ निराएँ' },
  'generatedTask.weed_control.detail':{ en: 'Catch weeds small — they steal water and food from the crop.', fr: 'Petites mauvaises herbes volent eau et nutriments.', sw: 'Ng\'oa magugu yakiwa madogo.', ha: 'Kama ciyawa lokacin suna ƙanana.', tw: 'Yi nwura a ɛyɛ nketewa fi hɔ.', hi: 'छोटे खरपतवार जल्दी निकालें — ये पानी और भोजन छीनते हैं।' },
  'generatedTask.weed_control.eta':   { en: '35 min',           fr: '35 min',            sw: 'dakika 35',        ha: 'minti 35',        tw: 'simma 35',        hi: '35 मिनट' },

  // Custom task fallback
  'generatedTask.custom.title':       { en: '{title}',          fr: '{title}',           sw: '{title}',           ha: '{title}',          tw: '{title}',         hi: '{title}' },
  'generatedTask.custom.detail':      { en: '{detail}',         fr: '{detail}',          sw: '{detail}',          ha: '{detail}',         tw: '{detail}',        hi: '{detail}' },
  'generatedTask.custom.eta':         { en: '15 min',           fr: '15 min',            sw: 'dakika 15',         ha: 'minti 15',         tw: 'simma 15',        hi: '15 मिनट' },

  // ─── Smart farmer onboarding ──────────────────────────
  'onboarding.progress':                 { en: '{current} of {total} steps complete',  fr: '{current} / {total} étapes',  sw: 'Hatua {current} ya {total}',  ha: 'Mataki {current} na {total}', tw: 'Anammɔn {current} wɔ {total}', hi: '{current} / {total} चरण पूर्ण' },

  // Validation error summary shown on onboarding when save fails.
  'onboarding.validation.title':         { en: 'Please fix these before continuing:', fr: 'Corrigez avant de continuer :', sw: 'Rekebisha kabla ya kuendelea:', ha: 'Gyara waɗannan kafin ku ci gaba:', tw: 'Siesie yeinom ansa na wotoa so:', hi: 'जारी रखने से पहले ठीक करें:' },
  'onboarding.fields.country':           { en: 'Country',        fr: 'Pays',       sw: 'Nchi',      ha: 'Ƙasa',      tw: 'Ɔman',      hi: 'देश' },
  'onboarding.fields.state':             { en: 'State / region', fr: 'Région',     sw: 'Mkoa',      ha: 'Jiha',      tw: 'Ɔmantam',   hi: 'राज्य' },
  'onboarding.fields.farmType':          { en: 'Farm type',      fr: 'Type de ferme', sw: 'Aina ya shamba', ha: 'Nau\'in gona', tw: 'Afuo su', hi: 'खेत का प्रकार' },
  'onboarding.fields.size':              { en: 'Farm size',      fr: 'Taille',     sw: 'Ukubwa',    ha: 'Girma',     tw: 'Kɛseɛ',     hi: 'आकार' },
  'onboarding.fields.sizeUnit':          { en: 'Size unit',      fr: 'Unité',      sw: 'Kipimo',    ha: 'Auna',      tw: 'Nsusuwii',  hi: 'इकाई' },
  'onboarding.fields.cropType':          { en: 'Crop',           fr: 'Culture',    sw: 'Zao',       ha: 'Amfani',    tw: 'Afudeɛ',    hi: 'फसल' },
  'onboarding.fields.growingStyle':      { en: 'Growing style',  fr: 'Mode de culture', sw: 'Njia ya kulima', ha: 'Hanyar shuka', tw: 'Afuoyɛ kwan', hi: 'बढ़ने की शैली' },
  'onboarding.fields.farmerName':        { en: 'Your name',      fr: 'Votre nom',  sw: 'Jina lako', ha: 'Sunanku',   tw: 'Wo din',    hi: 'आपका नाम' },
  'onboarding.fields.farmName':          { en: 'Farm name',      fr: 'Nom de la ferme', sw: 'Jina la shamba', ha: 'Sunan gona', tw: 'Afuo din', hi: 'खेत का नाम' },

  'onboarding.location.title':           { en: 'Where is your farm?',        fr: 'Où se trouve votre ferme ?',     sw: 'Shamba lako liko wapi?',      ha: 'Ina gonarku take?',           tw: 'Wo afuo wɔ he?',              hi: 'आपका खेत कहाँ है?' },
  'onboarding.location.subtitle':        { en: 'We use this to pick the right crops for your climate.', fr: "Pour choisir les bonnes cultures.", sw: 'Tutachagua mazao yanayofaa hapa.', ha: 'Za mu zaɓi amfanin gona mai dacewa.', tw: "Yɛbɛhwɛ afudeɛ a ɛfata.", hi: 'जलवायु के अनुसार फसलें चुनने के लिए।' },
  'onboarding.location.detect':          { en: 'Use my location',             fr: "Utiliser ma localisation",       sw: 'Tumia eneo langu',            ha: 'Yi amfani da wurina',         tw: 'Fa me baabi',                 hi: 'मेरा स्थान इस्तेमाल करें' },
  'onboarding.location.detecting':       { en: 'Detecting…',                   fr: 'Détection…',                     sw: 'Inatambua…',                  ha: 'Ana ganowa…',                 tw: 'Yɛrehwɛ…',                    hi: 'पता लगाया जा रहा है…' },
  'onboarding.location.city':            { en: 'City (optional)',              fr: 'Ville (facultatif)',             sw: 'Mji (hiari)',                 ha: 'Gari (zaɓi)',                 tw: 'Kuro (wopɛ a)',               hi: 'शहर (वैकल्पिक)' },

  'onboarding.experience.title':         { en: 'Are you new to farming?',      fr: 'Êtes-vous nouveau ?',            sw: 'Wewe ni mpya?',               ha: 'Kai sabon noma ne?',          tw: 'Wo yɛ foforɔ?',              hi: 'क्या आप खेती में नए हैं?' },
  'onboarding.experience.subtitle':      { en: "We'll tailor the recommendations to your level.", fr: 'Recommandations adaptées.',       sw: 'Tutarekebisha mapendekezo.',  ha: 'Za mu daidaita shawara.',     tw: 'Yɛbɛyɛ nhyehyɛeɛ.',          hi: 'हम आपके स्तर के अनुसार सुझाव देंगे।' },
  'onboarding.experience.new':           { en: "Yes, I'm new",                 fr: 'Oui, nouveau',                   sw: 'Ndiyo, mpya',                 ha: 'Ee, sabon',                   tw: 'Aane, foforɔ',                hi: 'हाँ, मैं नया हूँ' },
  'onboarding.experience.newDesc':       { en: 'Start with easier crops.',     fr: 'Cultures plus faciles.',         sw: 'Anza na mazao rahisi.',       ha: 'Fara da amfani mai sauƙi.',    tw: 'Fi aseɛ ne afudeɛ a ɛyɛ mmerɛw.', hi: 'आसान फसलों से शुरू करें।' },
  'onboarding.experience.experienced':   { en: 'No, I have experience',        fr: 'Non, expérimenté',               sw: 'Hapana, nina uzoefu',         ha: 'A\'a, ina da kwarewa',        tw: 'Dabi, mewɔ osuahunu',         hi: 'नहीं, मुझे अनुभव है' },
  'onboarding.experience.experiencedDesc':{en: 'See the full crop list.',      fr: 'Toutes les cultures.',           sw: 'Angalia orodha yote.',        ha: 'Duba duka amfani.',            tw: 'Hwɛ nyinaa.',                 hi: 'पूरी सूची देखें।' },

  'onboarding.size.title':               { en: 'How big is your farm?',        fr: 'Taille de la ferme ?',           sw: 'Ukubwa wa shamba?',           ha: 'Girman gonarku?',             tw: 'Wo afuo kɛseɛ?',              hi: 'आपका खेत कितना बड़ा है?' },
  'onboarding.size.subtitle':            { en: 'Used to pick crops that scale to your space.', fr: 'Pour adapter les cultures.',    sw: 'Tuchague mazao sahihi.',      ha: 'Don zaɓar amfani da ya dace.', tw: 'Yɛbɛhwɛ.',                    hi: 'जगह के अनुसार फसलें चुनने के लिए।' },
  'onboarding.size.exact':               { en: 'Exact size in acres (optional)', fr: 'Taille exacte (facultatif)',   sw: 'Ukubwa halisi (hiari)',       ha: 'Girman daidai (zaɓi)',         tw: 'Kɛseɛ pɛpɛɛpɛ (wopɛ a)',      hi: 'सटीक आकार (वैकल्पिक)' },

  'onboarding.farmType.title':           { en: 'What kind of farm?',            fr: 'Quel type de ferme ?',          sw: 'Aina gani ya shamba?',        ha: "Wane irin gona?",              tw: 'Afuo bɛn?',                    hi: 'कैसा खेत?' },
  'onboarding.farmType.subtitle':        { en: 'This changes which crop mix we suggest.', fr: 'Change le mélange de cultures.', sw: 'Hii hubadilisha mapendekezo.', ha: 'Wannan zai canza shawarwari.', tw: 'Yei sesa afudeɛ.',           hi: 'इससे सुझाई गई फसलें बदलेंगी।' },
  'onboarding.farmType.backyardDesc':    { en: 'Home gardens and containers.', fr: 'Jardins et pots.',               sw: 'Bustani ndogo.',              ha: 'Lambuna da tuluna.',           tw: 'Efie akyi.',                  hi: 'घरेलू बगीचे और कंटेनर।' },
  'onboarding.farmType.smallFarmDesc':   { en: '1–5 acres, mixed crops.',      fr: '1 à 5 acres, mixte.',            sw: 'Ekari 1–5.',                  ha: 'Ekari 1–5.',                  tw: 'Ekari 1–5.',                   hi: '1–5 एकड़, मिश्रित।' },
  'onboarding.farmType.commercialDesc':  { en: 'Row crops and larger fields.', fr: 'Grandes parcelles.',             sw: 'Mashamba makubwa.',           ha: 'Manyan filaye.',              tw: 'Mfuo akɛseɛ.',                hi: 'बड़े खेत और फ़सल पंक्तियाँ।' },

  'onboarding.crops.title':              { en: 'Best crops for your location',  fr: 'Meilleures cultures',           sw: 'Mazao bora kwako',            ha: 'Amfanin gona mafi dacewa',    tw: 'Afudeɛ pa ma wo',              hi: 'आपके क्षेत्र के लिए सबसे अच्छी फसलें' },
  'onboarding.crops.helper':             { en: 'Based on your location, farm size, and experience.', fr: 'Selon votre emplacement et taille.', sw: 'Kulingana na eneo, ukubwa, na uzoefu.', ha: 'Bisa wuri, girma, da kwarewa.', tw: 'Wo man, afuo kɛseɛ, ne osuahunu enti.', hi: 'आपके स्थान, आकार और अनुभव के आधार पर।' },
  'onboarding.crops.pickBest':           { en: 'Pick the best crop for me',     fr: 'Choisir pour moi',              sw: 'Nichagulie bora',             ha: "Zaɓi mini",                    tw: 'Yi ma me',                    hi: 'मेरे लिए सबसे अच्छी चुनें' },
  'onboarding.crops.best':               { en: 'Best for your area',            fr: 'Idéal pour vous',               sw: 'Bora kwa eneo lako',          ha: 'Mafi kyau a yankinku',        tw: 'Ɛyɛ ma wo man',                hi: 'आपके क्षेत्र के लिए सबसे अच्छी' },
  'onboarding.crops.possible':           { en: 'Also possible',                 fr: 'Aussi possible',                sw: 'Pia yawezekana',              ha: 'Suma suna yiwuwa',            tw: 'Ɛtumi yɛ',                     hi: 'ये भी संभव' },
  'onboarding.crops.notRecommended':     { en: 'Not recommended for your area', fr: 'Non recommandé',                sw: 'Haipendekezwi',               ha: 'Ba a ba da shawara ba',       tw: 'Wɔmfa',                        hi: 'अनुशंसित नहीं' },
  'onboarding.crops.seeMore':            { en: 'See harder crops',              fr: 'Voir plus difficiles',          sw: 'Angalia ngumu zaidi',         ha: 'Duba ƙarin masu wahala',       tw: 'Hwɛ nea ɛyɛ den',             hi: 'कठिन फसलें देखें' },
  'onboarding.crops.error':              { en: "We couldn't load recommendations. Try again.", fr: 'Chargement impossible.', sw: 'Hatukuweza kupakia.', ha: 'Ba a iya lodawa ba.', tw: 'Yɛantumi.',                    hi: 'सुझाव लोड नहीं हो सके।' },
  'onboarding.crops.offlineFallback':    { en: 'Offline — showing general picks for now.', fr: 'Hors ligne — sélection générale.', sw: 'Nje ya mtandao.', ha: 'Babu yanar gizo.',             tw: 'Wonni intanɛt.',               hi: 'ऑफ़लाइन — सामान्य विकल्प।' },

  // ─── Cross-screen fit + crop-trait labels ───────────────
  // These sit in the non-prefixed namespace so crop-plan, NGO, and
  // dashboard screens can reuse them. Hausa is not yet provided by
  // the reviewer; resolver falls back to English for locales not
  // declared here. Include es / pt / ar / id for the 9-language rollout.
  'fit.high':                            { en: 'High fit',   hi: 'उच्च उपयुक्तता',   tw: 'Ɛfata paa',      es: 'Alta compatibilidad',   pt: 'Alta compatibilidade',   fr: 'Très adapté',       ar: 'ملاءمة عالية',   sw: 'Ulinganifu wa juu',   id: 'Sangat cocok' },
  'fit.medium':                          { en: 'Medium fit', hi: 'मध्यम उपयुक्तता', tw: 'Ɛfata kakra',    es: 'Compatibilidad media',  pt: 'Compatibilidade média',  fr: 'Adaptation moyenne', ar: 'ملاءمة متوسطة', sw: 'Ulinganifu wa kati',  id: 'Cukup cocok' },
  'fit.low':                             { en: 'Low fit',    hi: 'कम उपयुक्तता',    tw: 'Ɛmfata paa',     es: 'Baja compatibilidad',   pt: 'Baixa compatibilidade',  fr: 'Faible adaptation',  ar: 'ملاءمة منخفضة', sw: 'Ulinganifu mdogo',    id: 'Kurang cocok' },
  'cropTraits.beginnerFriendly':         { en: 'Beginner-friendly', hi: 'शुरुआती के लिए उपयुक्त', tw: 'Ɛfata wɔn a wɔrefi ase', es: 'Apto para principiantes', pt: 'Bom para iniciantes', fr: 'Adapté aux débutants', ar: 'مناسب للمبتدئين', sw: 'Inafaa kwa wanaoanza', id: 'Cocok untuk pemula' },
  'cropTraits.lowWater':                 { en: 'Low water needs',   hi: 'कम पानी की जरूरत',       tw: 'Nsuo kakra na ehia',     es: 'Necesita poca agua',       pt: 'Precisa de pouca água', fr: 'Faible besoin en eau', ar: 'يحتاج ماء قليل', sw: 'Inahitaji maji kidogo', id: 'Kebutuhan air rendah' },
  'cropTraits.droughtTolerant':          { en: 'Drought tolerant',  hi: 'सूखा सहनशील',             tw: 'Egyina ɔpɛ so',           es: 'Resistente a la sequía',   pt: 'Tolerante à seca',      fr: 'Tolérant à la sécheresse', ar: 'يتحمل الجفاف', sw: 'Inastahimili ukame',     id: 'Tahan kekeringan' },
  'cropTraits.fastGrowing':              { en: 'Fast growing',           hi: 'तेजी से बढ़ने वाली',         tw: 'Ɛnyini ntɛm',                   es: 'Crecimiento rápido',           pt: 'Crescimento rápido',          fr: 'Croissance rapide',             ar: 'سريع النمو',          sw: 'Hukua haraka',                            id: 'Cepat tumbuh' },
  'cropTraits.smallFarmFriendly':        { en: 'Good for small farms',   hi: 'छोटे खेतों के लिए अच्छा',    tw: 'Ɛyɛ ma afuw nketewa',           es: 'Bueno para fincas pequeñas',   pt: 'Bom para pequenas fazendas',  fr: 'Bon pour les petites fermes',   ar: 'مناسب للمزارع الصغيرة', sw: 'Nzuri kwa mashamba madogo',               id: 'Cocok untuk lahan kecil' },
  'cropTraits.backyardFriendly':         { en: 'Good for backyard farming', hi: 'घर या पिछवाड़े की खेती के लिए अच्छा', tw: 'Ɛfata fie afuw mu',         es: 'Bueno para huertos caseros',   pt: 'Bom para quintais',           fr: 'Bon pour les jardins familiaux', ar: 'مناسب للزراعة المنزلية', sw: 'Nzuri kwa bustani ya nyumbani',         id: 'Cocok untuk kebun rumah' },
  'cropTraits.commercialFriendly':       { en: 'Good for commercial farms', hi: 'व्यावसायिक खेती के लिए अच्छा',  tw: 'Ɛfata aguadifo afuw mu',   es: 'Bueno para fincas comerciales', pt: 'Bom para fazendas comerciais', fr: 'Bon pour les fermes commerciales', ar: 'مناسب للمزارع التجارية', sw: 'Nzuri kwa mashamba ya kibiashara',  id: 'Cocok untuk pertanian komersial' },
  'cropTraits.heatTolerant':             { en: 'Heat tolerant',          hi: 'गर्मी सहनशील',               tw: 'Egyina ahuhuro/ɔhyew so',       es: 'Tolera el calor',              pt: 'Resistente ao calor',         fr: 'Tolère la chaleur',             ar: 'يتحمل الحرارة',      sw: 'Inastahimili joto',                       id: 'Tahan panas' },
  'cropTraits.coolSeason':               { en: 'Cool-season crop',       hi: 'ठंडे मौसम की फसल',         tw: 'Bere a ɛyɛ nwini mu afifideɛ',  es: 'Cultivo de clima fresco',      pt: 'Cultura de clima frio',       fr: 'Culture de saison fraîche',     ar: 'محصول موسم بارد',    sw: 'Zao la msimu wa baridi',                  id: 'Tanaman musim sejuk' },
  'cropTraits.warmSeason':               { en: 'Warm-season crop',       hi: 'गर्म मौसम की फसल',          tw: 'Bere a ɛyɛ hyew mu afifideɛ',   es: 'Cultivo de clima cálido',      pt: 'Cultura de clima quente',     fr: 'Culture de saison chaude',      ar: 'محصول موسم دافئ',    sw: 'Zao la msimu wa joto',                    id: 'Tanaman musim panas' },

  // ─── Recommendation confidence + support depth ────────
  'confidence.high':                     { en: 'High confidence',        hi: 'उच्च भरोसा',                  tw: 'Ahotɔ kɛse',                    es: 'Alta confianza',                pt: 'Alta confiança',               fr: 'Confiance élevée',              ar: 'ثقة عالية',           sw: 'Uhakika wa juu',                          id: 'Keyakinan tinggi' },
  'confidence.medium':                   { en: 'Medium confidence',      hi: 'मध्यम भरोसा',                tw: 'Ahotɔ kakra',                   es: 'Confianza media',               pt: 'Confiança média',              fr: 'Confiance moyenne',             ar: 'ثقة متوسطة',          sw: 'Uhakika wa kati',                         id: 'Keyakinan sedang' },
  'confidence.low':                      { en: 'Low confidence',         hi: 'कम भरोसा',                   tw: 'Ahotɔ sua',                     es: 'Baja confianza',                pt: 'Baixa confiança',              fr: 'Faible confiance',              ar: 'ثقة منخفضة',          sw: 'Uhakika mdogo',                           id: 'Keyakinan rendah' },
  'support.full':                        { en: 'Fully guided',           hi: 'पूरी मार्गदर्शिका उपलब्ध',     tw: 'Akwankyerɛ a edi mu',           es: 'Guía completa',                 pt: 'Orientação completa',          fr: 'Guidage complet',               ar: 'إرشاد كامل',          sw: 'Mwongozo kamili',                         id: 'Panduan lengkap' },
  'support.partial':                     { en: 'Partial guidance',       hi: 'आंशिक मार्गदर्शन',            tw: 'Akwankyerɛ kakra',              es: 'Guía parcial',                  pt: 'Orientação parcial',           fr: 'Guidage partiel',               ar: 'إرشاد جزئي',          sw: 'Mwongozo wa sehemu',                      id: 'Panduan sebagian' },
  'support.browse':                      { en: 'Browse only',            hi: 'केवल देखें',                  tw: 'Hwɛ nko ara',                   es: 'Solo explorar',                 pt: 'Somente explorar',             fr: 'Navigation seulement',          ar: 'تصفح فقط',            sw: 'Angalia tu',                              id: 'Lihat saja' },

  // ─── Recommendation reason chips + planting-status pills ──
  'recommendation.goodForRegion':        { en: 'Good for your region',   hi: 'आपके क्षेत्र के लिए उपयुक्त',   tw: 'Ɛfata wo mpɔtam hɔ',            es: 'Bueno para tu región',          pt: 'Bom para sua região',          fr: 'Bon pour votre région',         ar: 'مناسب لمنطقتك',       sw: 'Nzuri kwa eneo lako',                     id: 'Cocok untuk wilayah Anda' },
  'recommendation.goodForSmallFarms':    { en: 'Good for small farms in your region', hi: 'आपके क्षेत्र के छोटे खेतों के लिए अच्छा', tw: 'Ɛyɛ ma afuw nketewa wɔ wo mpɔtam hɔ', es: 'Bueno para fincas pequeñas en tu región', pt: 'Bom para pequenas fazendas na sua região', fr: 'Bon pour les petites fermes de votre région', ar: 'مناسب للمزارع الصغيرة في منطقتك', sw: 'Nzuri kwa mashamba madogo katika eneo lako', id: 'Cocok untuk lahan kecil di wilayah Anda' },
  'recommendation.goodForBackyard':      { en: 'Good for backyard growing', hi: 'घर या पिछवाड़े में उगाने के लिए अच्छा', tw: 'Ɛyɛ ma fie afuw mu',       es: 'Bueno para cultivo en casa',     pt: 'Bom para cultivo em casa',    fr: 'Bon pour la culture à domicile', ar: 'مناسب للزراعة المنزلية', sw: 'Nzuri kwa kilimo cha nyumbani',       id: 'Cocok untuk kebun rumah' },
  'recommendation.plantingOpen':         { en: 'Planting window is open now', hi: 'अभी बुवाई का सही समय है',   tw: 'Bere pa a wobɛdua no abue',     es: 'La ventana de siembra está abierta', pt: 'A janela de plantio está aberta', fr: 'La fenêtre de plantation est ouverte', ar: 'نافذة الزراعة مفتوحة الآن', sw: 'Dirisha la kupanda liko wazi',    id: 'Waktu tanam sedang terbuka' },
  'recommendation.beginnerReason':       { en: 'Suitable for beginners', hi: 'शुरुआती किसानों के लिए उपयुक्त', tw: 'Ɛfata wɔn a wɔrefi ase',        es: 'Adecuado para principiantes',   pt: 'Adequado para iniciantes',     fr: 'Convient aux débutants',        ar: 'مناسب للمبتدئين',     sw: 'Inafaa kwa wanaoanza',                    id: 'Cocok untuk pemula' },
  'recommendation.lowFitWarning':        { en: 'Not recommended for your area', hi: 'आपके क्षेत्र के लिए अनुशंसित नहीं', tw: 'Yɛnkamfo nkyerɛ mma wo mpɔtam hɔ', es: 'No recomendado para tu zona', pt: 'Não recomendado para sua área', fr: 'Non recommandé pour votre région', ar: 'غير موصى به لمنطقتك', sw: 'Haipendekezwi kwa eneo lako',  id: 'Tidak disarankan untuk wilayah Anda' },
  'recommendation.limitedSupport':       { en: 'Guidance is limited for this crop', hi: 'इस फसल के लिए मार्गदर्शन सीमित है', tw: 'Akwankyerɛ no sua ma saa afifideɛ yi', es: 'La guía para este cultivo es limitada', pt: 'A orientação para esta cultura é limitada', fr: 'Le guidage pour cette culture est limité', ar: 'الإرشاد لهذا المحصول محدود', sw: 'Mwongozo wa zao hili ni mdogo', id: 'Panduan untuk tanaman ini terbatas' },
  'recommendation.experimental':         { en: 'Experimental for your location', hi: 'आपके स्थान के लिए प्रयोगात्मक', tw: 'Wɔresɔ ahwɛ ama wo baabi',     es: 'Experimental para tu ubicación', pt: 'Experimental para sua localização', fr: 'Expérimental pour votre localisation', ar: 'تجريبي لموقعك',      sw: 'Ni ya majaribio kwa eneo lako',          id: 'Eksperimental untuk lokasi Anda' },

  'status.plantNow':                     { en: 'Plant now',              hi: 'अभी लगाएँ',                  tw: 'Dua seesei',                    es: 'Plantar ahora',                 pt: 'Plantar agora',                fr: 'Planter maintenant',            ar: 'ازرع الآن',           sw: 'Panda sasa',                               id: 'Tanam sekarang' },
  'status.plantSoon':                    { en: 'Plant soon',             hi: 'जल्द लगाएँ',                tw: 'Dua ntɛm ara',                  es: 'Plantar pronto',                pt: 'Plantar em breve',             fr: 'Planter bientôt',               ar: 'ازرع قريبًا',         sw: 'Panda karibuni',                          id: 'Tanam segera' },
  'status.wait':                         { en: 'Wait',                   hi: 'रुकें',                       tw: 'Twɛn',                           es: 'Esperar',                       pt: 'Esperar',                      fr: 'Attendre',                      ar: 'انتظر',               sw: 'Subiri',                                   id: 'Tunggu' },
  'status.avoid':                        { en: 'Avoid for now',          hi: 'अभी न लगाएँ',                tw: 'Mma nnɛyi',                     es: 'Evitar por ahora',              pt: 'Evitar por enquanto',          fr: 'Éviter pour le moment',         ar: 'تجنب الآن',           sw: 'Epuka kwa sasa',                           id: 'Hindari dulu' },

  'onboarding.fit.high':                 { en: 'High fit',       fr: 'Idéal',           sw: 'Inafaa sana',       ha: 'Ya dace sosai',     tw: 'Ɛyɛ pa paa',      hi: 'उत्तम मेल' },
  'onboarding.fit.medium':               { en: 'Medium fit',     fr: 'Moyen',           sw: 'Inafaa kiasi',      ha: 'Ya dace',           tw: 'Mfinimfini',      hi: 'मध्यम' },
  'onboarding.fit.low':                  { en: 'Low fit',        fr: 'Faible',          sw: 'Hafifu',            ha: 'Rauni',             tw: 'Ɛnyɛ pa',         hi: 'कमज़ोर' },
  'onboarding.fit.beginnerFriendly':     { en: 'Beginner-friendly', fr: 'Facile',       sw: 'Rahisi kwa wapya',  ha: 'Mai sauƙi',         tw: 'Ɛnyɛ den',        hi: 'शुरुआती अनुकूल' },

  'onboarding.status.plantNow':          { en: 'Plant now',      fr: 'Planter maintenant', sw: 'Panda sasa',    ha: 'Shuka yanzu',       tw: 'Dua seesei',      hi: 'अभी बोएँ' },
  'onboarding.status.plantSoon':         { en: 'Plant soon',     fr: 'Bientôt',         sw: 'Panda hivi karibuni', ha: 'Ba da daɗewa ba',  tw: 'Dua nkyɛ',        hi: 'जल्द बोएँ' },
  'onboarding.status.wait':              { en: 'Wait',           fr: 'Attendre',        sw: 'Subiri',            ha: 'Jira',              tw: 'Twɛn',             hi: 'प्रतीक्षा करें' },
  'onboarding.status.avoid':             { en: 'Avoid',          fr: 'Éviter',          sw: 'Epuka',             ha: 'Guji',              tw: 'Ntoa',            hi: 'टालें' },

  'onboarding.crops.showAll':            { en: 'Show low-fit / experimental crops', fr: 'Cultures expérimentales', sw: 'Onyesha mazao ya majaribio', ha: 'Nuna amfani na gwaji', tw: 'Kyerɛ afudeɛ a ɛnyɛ pa', hi: 'कम अनुकूल / प्रायोगिक फसलें दिखाएँ' },
  'onboarding.crops.lowConfidence':      { en: 'No strong crop match right now', fr: 'Pas de correspondance forte', sw: 'Hakuna zao linalofaa sana sasa', ha: 'Babu amfani mai dacewa sosai', tw: 'Afudeɛ pa nni hɔ seesei', hi: 'अभी कोई मजबूत फसल मेल नहीं' },
  'onboarding.crops.lowConfidenceHint':  { en: "Confirm your location for better recommendations, or browse all crops.", fr: "Confirmez votre lieu pour de meilleures recommandations.", sw: 'Thibitisha eneo kwa mapendekezo bora.', ha: 'Tabbatar da wuri don shawara mafi kyau.', tw: 'Si wo man pi ma nhyehyɛeɛ pa.', hi: 'बेहतर सुझाव के लिए स्थान की पुष्टि करें।' },
  'onboarding.fit.lowFitLabel':          { en: 'Low fit',        fr: 'Faible',          sw: 'Hafifu',            ha: 'Rauni',             tw: 'Ɛnyɛ pa',         hi: 'कमज़ोर' },

  // Recommendation reasons (used by getRecommendationReasons)
  'recReason.highFit':                   { en: 'Fits your climate and season.',      fr: 'Convient à votre climat.',   sw: 'Inafaa hali ya hewa na msimu.', ha: 'Ya dace da yanayinku.', tw: 'Ɛfata wo mu ewim ne berɛ.', hi: 'आपकी जलवायु और मौसम के अनुरूप।' },
  'recReason.highFitInRegion':           { en: 'Strong fit for {region}.',           fr: 'Idéal pour {region}.',        sw: 'Inafaa sana kwa {region}.',    ha: 'Ya dace sosai da {region}.',  tw: 'Ɛfata {region} yie.',     hi: '{region} के लिए उत्तम।' },
  'recReason.mediumFit':                 { en: 'Worth considering in your area.',    fr: 'À envisager chez vous.',      sw: 'Inafaa kuzingatia.',          ha: 'Yana da kyau a yi tunani.',  tw: 'Ɛyɛ nea wobɛsusu ho.',     hi: 'आपके क्षेत्र में विचारणीय।' },
  'recReason.plantNow':                  { en: 'Planting window is currently open.', fr: 'Fenêtre de plantation ouverte.', sw: 'Dirisha la kupanda liko wazi.', ha: 'Lokacin shuka ya buɗe.', tw: 'Dua berɛ abue.',          hi: 'बोवाई की अवधि अभी खुली है।' },
  'recReason.plantSoon':                 { en: 'Planting window opens soon.',         fr: 'Fenêtre bientôt.',            sw: 'Dirisha la kupanda litafunguka hivi karibuni.', ha: 'Lokacin shuka zai buɗe ba da daɗewa ba.', tw: 'Dua berɛ rebɛbue.', hi: 'बोवाई की अवधि जल्द खुलेगी।' },
  'recReason.beginnerFriendly':          { en: 'Beginner-friendly.',                  fr: 'Facile à débuter.',           sw: 'Rahisi kwa wapya.',            ha: 'Mai sauƙi.',                  tw: 'Ɛnyɛ den.',                hi: 'शुरुआती अनुकूल।' },
  'recReason.goodForSmallFarms':         { en: 'Good for small farms in your region.', fr: 'Bon pour petites fermes.',   sw: 'Nzuri kwa mashamba madogo.',   ha: 'Ya dace da ƙananan gonaki.',  tw: 'Ɛfata afuo ketewa.',       hi: 'आपके क्षेत्र के छोटे खेतों के लिए अच्छा।' },
  'recReason.strongMarket':              { en: 'Strong market demand in your region.', fr: 'Forte demande locale.',       sw: 'Soko imara katika eneo lako.', ha: 'Kasuwa mai ƙarfi.',           tw: 'Adwa a ɛyɛ den.',          hi: 'आपके क्षेत्र में मजबूत बाज़ार।' },
  'recReason.climateFit':                { en: 'Your climate suits this crop.',        fr: 'Climat adapté.',             sw: 'Hali ya hewa inafaa.',        ha: 'Yanayi ya dace.',             tw: 'W\'ewim fata.',            hi: 'आपकी जलवायु उपयुक्त है।' },
  'recReason.seasonFit':                 { en: 'In the typical planting window.',      fr: 'Bonne saison.',              sw: 'Ndani ya msimu.',              ha: 'A cikin lokacin shuka.',     tw: 'Dua berɛ mu.',             hi: 'सामान्य बोवाई की अवधि में।' },

  // Form validation
  'validation.required':                 { en: 'This field is required.', fr: 'Champ requis.', sw: 'Inahitajika.', ha: 'Ana buƙata.', tw: 'Ɛho hia.',        hi: 'यह फ़ील्ड आवश्यक है।' },
  'validation.stateRequiredForUs':       { en: 'Select a state for U.S. farms.', fr: 'État requis.', sw: 'Jimbo linahitajika.', ha: 'Ana buƙatar jiha.', tw: 'Man mu si hia.', hi: 'यू.एस. के लिए राज्य आवश्यक।' },
  'validation.growingStyleRequired':     { en: 'Pick a growing style for your backyard.', fr: 'Choisissez un style.', sw: 'Chagua mtindo wa kukua.', ha: 'Zaɓi salon girma.', tw: 'Yi dua kwan bi.', hi: 'उगाने का तरीका चुनें।' },
  'validation.invalidNumber':            { en: 'Enter a positive number.', fr: 'Nombre positif.', sw: 'Weka nambari zaidi ya sifuri.', ha: 'Sanya lamba mai inganci.', tw: 'Fa nsɛmma pa bɛto mu.', hi: 'एक सकारात्मक संख्या दर्ज करें।' },
  'validation.invalidUnit':              { en: 'Pick an allowed unit.', fr: 'Unité invalide.', sw: 'Chagua kizio sahihi.', ha: 'Zaɓi ma\'auni mai karba.', tw: 'Yi susudeɛ a ɛfata.', hi: 'मान्य इकाई चुनें।' },
  'validation.invalidChoice':            { en: 'Choose a valid option.', fr: 'Choix invalide.', sw: 'Chagua chaguo sahihi.', ha: 'Zaɓi madaidaici.', tw: 'Yi nea ɛfata.', hi: 'मान्य विकल्प चुनें।' },
  'validation.sizeTooLarge':             { en: 'Size looks unusually large — double-check.', fr: 'Taille trop grande.', sw: 'Ukubwa mkubwa sana.', ha: 'Girma ya yi yawa.', tw: 'Ɛkɛseɛ dodo.', hi: 'आकार बहुत बड़ा लगता है — जाँचें।' },
  'validation.countryRequired':          { en: 'Select your country.',          fr: 'Sélectionnez votre pays.',   sw: 'Chagua nchi yako.',           ha: 'Zaɓi ƙasarku.',                 tw: 'Yi wo man.',                hi: 'अपना देश चुनें।' },
  'validation.stateRequired':            { en: 'Select your state or region.',   fr: 'Sélectionnez un état ou région.', sw: 'Chagua jimbo au eneo.',  ha: 'Zaɓi jiha ko yanki.',          tw: 'Yi wo man mu si.',          hi: 'अपना राज्य या क्षेत्र चुनें।' },

  // Structured location UI
  'location.selectCountry':              { en: 'Select your country',            fr: 'Sélectionnez votre pays',    sw: 'Chagua nchi yako',            ha: 'Zaɓi ƙasarku',                 tw: 'Yi wo man',                 hi: 'अपना देश चुनें' },
  'location.selectState':                { en: 'Select your state or region',    fr: "Sélectionnez l'état",        sw: 'Chagua jimbo au eneo',        ha: 'Zaɓi jiha ko yanki',           tw: 'Yi wo man mu si',           hi: 'अपना राज्य या क्षेत्र चुनें' },
  'location.cityOptional':               { en: 'Enter your city (optional)',     fr: 'Entrez votre ville (facultatif)', sw: 'Andika mji wako (hiari)', ha: 'Sanya garinku (zaɓi)',       tw: 'Kyerɛw wo kurow (wopɛ a)',  hi: 'अपना शहर दर्ज करें (वैकल्पिक)' },
  'location.searchCountries':            { en: 'Search countries',               fr: 'Rechercher un pays',         sw: 'Tafuta nchi',                 ha: 'Nemi ƙasa',                    tw: 'Hwehwɛ man',                hi: 'देश खोजें' },
  'location.noMatches':                  { en: 'No matches',                     fr: 'Aucun résultat',             sw: 'Hakuna matokeo',              ha: 'Babu sakamako',                tw: 'Biribi nni hɔ',              hi: 'कोई मेल नहीं' },
  'location.popular':                    { en: 'Popular',                        fr: 'Populaire',                  sw: 'Maarufu',                     ha: 'Shahararrun',                 tw: 'Wogye dii',                  hi: 'लोकप्रिय' },
  'location.detectedLabel':              { en: 'Detected location',              fr: 'Localisation détectée',      sw: 'Eneo lililotambuliwa',        ha: 'Wurin da aka gano',            tw: 'Baabi a yɛahwɛ',            hi: 'पता लगाया गया स्थान' },
  'location.useThis':                    { en: 'Use this location',              fr: 'Utiliser ce lieu',           sw: 'Tumia eneo hili',             ha: 'Yi amfani da wannan wurin',    tw: 'Fa eyi',                     hi: 'यह स्थान इस्तेमाल करें' },
  'location.changeLocation':             { en: 'Change',                         fr: 'Changer',                    sw: 'Badilisha',                   ha: 'Canja',                        tw: 'Sesa',                       hi: 'बदलें' },
  'location.detecting':                  { en: 'Detecting your location…',       fr: 'Détection en cours…',         sw: 'Inatambua eneo lako…',        ha: 'Ana gano wurin ku…',           tw: 'Yɛrehwɛ wo baabi…',         hi: 'आपका स्थान पहचाना जा रहा है…' },
  'location.permissionDenied':           { en: 'Location permission denied',     fr: 'Permission refusée',         sw: 'Ruhusa imekataliwa',          ha: 'An hana izinin wuri',          tw: 'Wɔampɛ baabi',              hi: 'स्थान अनुमति अस्वीकृत' },
  'location.permissionDeniedHint':       { en: 'No problem — pick your country and state below to continue.', fr: 'Sélectionnez votre pays ci-dessous.', sw: 'Chagua nchi na jimbo hapa chini.', ha: 'Zaɓi ƙasa da jiha da ke ƙasa.', tw: 'Yi wo man wɔ aseɛ ha.', hi: 'कोई बात नहीं — नीचे देश और राज्य चुनें।' },
  'location.noDetectedLocation':         { en: 'Pick your location',             fr: 'Choisissez votre lieu',      sw: 'Chagua eneo',                 ha: 'Zaɓi wurinku',                 tw: 'Yi wo baabi',                hi: 'अपना स्थान चुनें' },
  'location.noDetectedLocationHint':     { en: 'Select your country and state below.', fr: 'Sélectionnez pays + état.', sw: 'Chagua nchi na jimbo.', ha: 'Zaɓi ƙasa da jiha.', tw: 'Yi man ne man mu si.', hi: 'नीचे देश और राज्य चुनें।' },
  'location.currentlySelected':          { en: 'Currently selected',             fr: 'Sélectionné',                sw: 'Umechagua sasa',              ha: 'An zaɓa',                      tw: 'Woayi',                      hi: 'वर्तमान में चयनित' },
  'location.noStateList':                { en: "We don't have a state list for this country yet — city is enough.", fr: "Pas de liste d'états — la ville suffit.", sw: 'Hakuna orodha ya majimbo — mji unatosha.', ha: 'Babu jerin jihohi — gari ya isa.', tw: 'Man mu si nni hɔ — kuro no dɔɔso.', hi: 'इस देश के लिए राज्य सूची नहीं — शहर पर्याप्त है।' },

  // ─── Country support tier + crop support depth ────────────
  'countrySupport.tier.full':            { en: 'Full',     fr: 'Complet',    sw: 'Kamili',     ha: 'Cikakke',     tw: 'Nyinaa',      hi: 'पूर्ण' },
  'countrySupport.tier.basic':           { en: 'Basic',    fr: 'Basique',    sw: 'Msingi',     ha: 'Asali',       tw: 'Titiriw',     hi: 'बुनियादी' },
  'countrySupport.tier.limited':         { en: 'Limited',  fr: 'Limité',     sw: 'Mdogo',      ha: 'Ƙarami',      tw: 'Kakra',       hi: 'सीमित' },
  'countrySupport.tier.comingSoon':      { en: 'Coming soon', fr: 'Bientôt', sw: 'Inakuja',    ha: 'Yana zuwa',   tw: 'Ɛreba',       hi: 'जल्द आ रहा' },

  'countrySupport.group.full':           { en: 'Fully supported',    fr: 'Entièrement pris en charge', sw: 'Imeungwa mkono kikamilifu', ha: 'An tallafa cikakke',    tw: 'Yɛsesa yie',  hi: 'पूरी तरह समर्थित' },
  'countrySupport.group.basic':          { en: 'Basic support',      fr: 'Support basique',            sw: 'Msaada wa msingi',           ha: 'Tallafi na asali',       tw: 'Titiriw',      hi: 'बुनियादी समर्थन' },
  'countrySupport.group.limited':        { en: 'Limited support',    fr: 'Support limité',             sw: 'Msaada mdogo',                ha: 'Tallafi ƙaramin',         tw: 'Boa kakra',    hi: 'सीमित समर्थन' },
  'countrySupport.group.comingSoon':     { en: 'Coming soon',        fr: 'Bientôt',                    sw: 'Inakuja',                    ha: 'Yana zuwa',              tw: 'Ɛreba',        hi: 'जल्द आ रहा' },

  'cropSupport.depth.fullyGuided':       { en: 'Fully guided',     fr: 'Guidage complet',   sw: 'Mwongozo kamili',   ha: 'Cikakken jagora',  tw: 'Akwankyerɛ nyinaa', hi: 'पूर्ण मार्गदर्शन' },
  'cropSupport.depth.partial':           { en: 'Partial guidance', fr: 'Guidage partiel',   sw: 'Mwongozo wa kiasi', ha: 'Jagora na ɓangare', tw: 'Akwankyerɛ fa',      hi: 'आंशिक मार्गदर्शन' },
  'cropSupport.depth.browseOnly':        { en: 'Browse only',      fr: 'Consultation',      sw: 'Kutazama tu',       ha: 'Duba kawai',        tw: 'Hwɛ pɛ',             hi: 'केवल देखें' },

  // Recommendation confidence
  'recConfidence.level.high':            { en: 'High confidence',    fr: 'Confiance élevée',  sw: 'Imani kubwa',      ha: 'Tabbas mai girma',   tw: 'Gyidie kɛse',      hi: 'उच्च विश्वास' },
  'recConfidence.level.medium':          { en: 'Medium confidence',  fr: 'Confiance moyenne', sw: 'Imani ya wastani', ha: 'Tabbas matsakaici',  tw: 'Gyidie mfinimfini', hi: 'मध्यम विश्वास' },
  'recConfidence.level.low':             { en: 'Limited confidence', fr: 'Confiance limitée', sw: 'Imani chache',     ha: 'Tabbas ƙarami',       tw: 'Gyidie kakra',      hi: 'सीमित विश्वास' },

  'recConfidence.wording.suggested':     { en: 'Suggested crops',     fr: 'Cultures suggérées', sw: 'Mazao yaliyopendekezwa', ha: 'Amfanin gona da aka ba da shawara', tw: 'Afudeɛ a yɛrebɔ ho kɔkɔ', hi: 'सुझाई गई फसलें' },
  'recConfidence.wording.limited':       { en: 'Limited confidence for your region', fr: 'Confiance limitée pour votre région', sw: 'Imani chache kwa eneo lako', ha: 'Tabbas ƙarami a yankinku', tw: 'Gyidie kakra wɔ wo man', hi: 'आपके क्षेत्र के लिए सीमित विश्वास' },
  'recConfidence.bannerBody':            { en: "These suggestions are less certain for your region. You can still browse all crops manually.", fr: "Suggestions moins sûres. Parcourez toutes les cultures.", sw: 'Mapendekezo haya si ya hakika sana kwa eneo lako.', ha: 'Waɗannan shawarwari ba su da tabbas sosai.', tw: 'Saa nhyehyɛeɛ yi nyɛ tebea koro.', hi: 'ये सुझाव आपके क्षेत्र के लिए कम निश्चित हैं। आप सभी फसलें देख सकते हैं।' },

  // Crop stage labels (used by getCropStage)
  'stage.planned':           { en: 'Planned',           fr: 'Planifié',     sw: 'Imepangwa',       ha: 'Tsara',         tw: 'Nhyehyɛe',      hi: 'योजना' },
  // Server uses `planning` (cropStages.js); kept distinct from
  // `stage.planned` so a farmer in the planning phase sees the
  // active-tense "Planning" rather than the past-tense "Planned".
  'stage.planning':          { en: 'Planning',          fr: 'Planification', sw: 'Kupanga',        ha: 'Shirye-shirye', tw: 'Nhyehyɛeɛ',     hi: 'योजना बनाना' },
  'stage.land_preparation':  { en: 'Land preparation',  fr: 'Préparation',  sw: 'Kuandaa ardhi',   ha: 'Shirya ƙasa',   tw: 'Asase siesieɛ', hi: 'भूमि तैयारी' },
  'stage.planting':          { en: 'Planting',          fr: 'Plantation',   sw: 'Kupanda',         ha: 'Shuki',         tw: 'Dua',           hi: 'रोपण' },
  'stage.germination':       { en: 'Germination',       fr: 'Germination',  sw: 'Kuota',           ha: 'Tsiro',         tw: 'Afifirie',      hi: 'अंकुरण' },
  'stage.early_growth':      { en: 'Early growth',      fr: 'Croissance précoce', sw: 'Ukuaji wa awali', ha: 'Girma na farko', tw: 'Nyin ahyɛaseɛ', hi: 'शुरुआती वृद्धि' },
  'stage.active_growth':     { en: 'Active growth',     fr: 'Croissance active', sw: 'Ukuaji amilifu', ha: 'Girma mai ƙarfi', tw: 'Nyin kɛseɛ', hi: 'सक्रिय वृद्धि' },
  'stage.flowering':         { en: 'Flowering',         fr: 'Floraison',    sw: 'Kuchanua',        ha: 'Fure',          tw: 'Nhwiren',        hi: 'फूल आना' },
  'stage.harvest_ready':     { en: 'Harvest ready',     fr: 'Prêt à récolter', sw: 'Tayari kuvuna', ha: 'A shirye girbi', tw: 'Yɛtumi atwa',   hi: 'कटाई के लिए तैयार' },
  'stage.harvested':         { en: 'Harvested',         fr: 'Récolté',      sw: 'Imevunwa',        ha: 'An girbe',      tw: 'Wɔatwa',         hi: 'कटाई हो गई' },
  'stage.post_harvest':      { en: 'Post-harvest',      fr: 'Post-récolte', sw: 'Baada ya kuvuna', ha: 'Bayan girbi',   tw: 'Otwa akyi',     hi: 'कटाई के बाद' },

  // Risk-alert one-liners (feed from buildRiskAlerts)
  'actionHome.risks.overdueCount':       { en: '{n} overdue tasks',           fr: '{n} tâches en retard',       sw: 'Kazi {n} zimechelewa',    ha: 'Ayyuka {n} sun makara',     tw: 'Adwuma {n} a atwam',         hi: '{n} कार्य समय से पीछे' },
  'actionHome.risks.overdue':            { en: 'You have overdue tasks',      fr: 'Tâches en retard',           sw: 'Una kazi zilizochelewa',  ha: 'Kuna da ayyukan da suka makara', tw: 'Adwuma bi atwam',       hi: 'आपके कुछ कार्य समय से पीछे हैं' },
  'actionHome.risks.inactive':           { en: "You haven't logged activity in a while", fr: 'Pas d\'activité récente.', sw: 'Haujasasisha kwa muda.', ha: 'Ba ku yi rajistar ayyuka ba na ɗan lokaci.', tw: 'Wontɔɔ adwuma biara wɔ berɛ tiaa.', hi: 'आपने कुछ समय से कोई गतिविधि दर्ज नहीं की' },
  'actionHome.risks.highSeverityIssue':  { en: 'You have an open serious issue', fr: 'Problème sérieux en cours', sw: 'Una tatizo zito linaloendelea', ha: 'Kuna da babbar matsala', tw: 'Wowɔ ɔhaw kɛseɛ bi a ahunahuna', hi: 'आपके पास एक गंभीर खुली समस्या है' },
  'actionHome.risks.missedWindow':       { en: 'You may have missed your planting window', fr: 'Fenêtre de plantation ratée', sw: 'Huenda umekosa dirisha la kupanda', ha: 'Kila ku kuskure lokacin shuka', tw: 'Ebia woatwa dua berɛ akyi', hi: 'आपने बोवाई की अवधि शायद गवां दी है' },

  // Task title translations used by TITLE_KEY_MAP
  'actionHome.task.prepBed':       { en: 'Prep the bed or container',  fr: 'Préparer le lit ou le pot',  sw: 'Tayarisha kitanda au chombo', ha: 'Shirya gado ko tulu',      tw: 'Siesie mpa anaa asenaa',      hi: 'क्यारी या कंटेनर तैयार करें' },
  'actionHome.task.plantSeeds':    { en: 'Plant seeds or seedlings',   fr: 'Planter les graines',        sw: 'Panda mbegu au miche',         ha: 'Shuka iri ko tsirrai',     tw: 'Dua aba anaa mfifire',        hi: 'बीज या पौधे लगाएँ' },
  'actionHome.task.checkMoisture': { en: 'Check moisture daily',       fr: 'Vérifier l\'humidité',       sw: 'Angalia unyevu kila siku',     ha: 'Duba laima kowace rana',   tw: 'Hwɛ asase nsuo da biara',     hi: 'रोज़ नमी जाँचें' },
  'actionHome.task.thinSeedlings': { en: 'Thin seedlings if crowded',  fr: 'Éclaircir les semis',        sw: 'Ng\'oa miche iliyozidi',       ha: 'Rage tsirrai',              tw: 'Te mfifire a ɛyɛ pii no',     hi: 'अगर भीड़ हो तो पौधों को कम करें' },
  'actionHome.task.pestScout':     { en: 'First pest scouting pass',   fr: 'Inspection des ravageurs',   sw: 'Ukaguzi wa kwanza wa wadudu',  ha: 'Binciken farko na kwari',  tw: 'Mmoawa ho nhwehwɛmu a edi kan', hi: 'पहली कीट जाँच' },
  'actionHome.task.feedMulch':     { en: 'Feed and mulch',             fr: 'Fertiliser et pailler',      sw: 'Weka mbolea na matandazo',     ha: 'Shayarwa da matsi',         tw: 'Mema aduane na katasoɔ',       hi: 'खाद और मल्च डालें' },
  'actionHome.task.weekWeeds':     { en: 'Weekly weed pass',           fr: 'Désherbage hebdo',           sw: 'Ng\'oa magugu kila wiki',      ha: 'Tsaftace ciyawa kowane mako', tw: 'Yi nwura fi hɔ dapɛn biara', hi: 'साप्ताहिक खरपतवार सफ़ाई' },
  'actionHome.task.harvestPrep':   { en: 'Prepare to harvest',         fr: 'Se préparer à la récolte',   sw: 'Jiandae kuvuna',               ha: 'Shirya don girbi',         tw: 'Siesie wo ho ma otwa',         hi: 'कटाई की तैयारी करें' },

  // ─── Farmer ID + copy button ───────────────────────
  'farmerId.copy':   { en: 'Copy',    fr: 'Copier',     sw: 'Nakili',      ha: 'Kwafi',         tw: 'Kɔpi',            hi: 'कॉपी करें' },
  'farmerId.copied': { en: 'Copied',  fr: 'Copié',      sw: 'Imenakiliwa', ha: 'An kwafa',      tw: 'Yɛakɔpi',         hi: 'कॉपी किया गया' },

  // ─── Crop-fit trust warning ────────────────────────
  'cropFit.warning.lowFit':   { en: "This crop isn't a strong fit for your area.", fr: 'Cette culture ne convient pas à votre région.', sw: 'Zao hili halifai eneo lako.', ha: 'Wannan amfani bai dace da yankinku ba.', tw: 'Saa afudeɛ yi mfa wo man ho.', hi: 'यह फसल आपके क्षेत्र के लिए उपयुक्त नहीं है' },
  'cropFit.warning.consider': { en: 'Consider these instead:', fr: 'Considérez plutôt :', sw: 'Zingatia haya badala yake:', ha: 'Ku yi tunanin waɗannan:', tw: 'Susuw wɔ yeinom ho:', hi: 'इसके बजाय ये फसलें देखें:' },
  'cropFit.warning.reason':   { en: 'Your climate is a weak match for this crop.', fr: 'Votre climat ne convient pas bien à cette culture.', sw: 'Hali ya hewa yako haifai zao hili.', ha: 'Yanayinku bai dace da wannan amfani ba.', tw: 'Wo mu ewim tebea mfa saa afudeɛ yi ho.', hi: 'आपकी जलवायु इस फसल के लिए कम अनुकूल है।' },

  // ─── First-launch confirmation modal ─────────────────
  'firstLaunch.title':     { en: "Let's set up Farroway for you", fr: 'Configurons Farroway pour vous', sw: 'Tuandae Farroway kwa ajili yako', ha: 'Bari mu shirya Farroway muku', tw: 'Ma yɛnhyehyɛ Farroway mma wo', hi: 'चलिए Farroway सेट करते हैं' },
  'firstLaunch.subtitle':  { en: 'Pick your language, country, and state.',  fr: 'Choisissez votre langue, votre pays et votre état.', sw: 'Chagua lugha, nchi, na jimbo lako.', ha: 'Zaɓi harshe, ƙasa da jiharku.', tw: 'Fa wo kasa, wo man, ne wo man mu si', hi: 'अपनी भाषा, देश और राज्य चुनें।' },
  'firstLaunch.language':  { en: 'Language',    fr: 'Langue',    sw: 'Lugha',    ha: 'Harshe',    tw: 'Kasa',    hi: 'भाषा' },
  'firstLaunch.country':   { en: 'Country',     fr: 'Pays',      sw: 'Nchi',     ha: 'Ƙasa',      tw: 'Ɔman',    hi: 'देश' },
  'firstLaunch.state':     { en: 'State',       fr: 'État',      sw: 'Jimbo',    ha: 'Jiha',      tw: 'Ɔman mu si', hi: 'राज्य' },
  'firstLaunch.confirm':   { en: 'Continue',    fr: 'Continuer', sw: 'Endelea',  ha: 'Ci gaba',   tw: 'Toa so',  hi: 'जारी रखें' },
  'firstLaunch.skip':      { en: 'Skip',        fr: 'Passer',    sw: 'Ruka',     ha: 'Tsallake',  tw: 'Twa mu',  hi: 'छोड़ें' },
  'firstLaunch.detecting': { en: 'Detecting…',  fr: 'Détection…', sw: 'Inatambua…', ha: 'Ana ganowa…', tw: 'Yɛrehwɛ…', hi: 'पहचान की जा रही है…' },

  // ─── Spec-named aliases (unprefixed) + auto-detect copy ──
  // The existing firstLaunch.* keys stay for back-compat; the
  // setup/FirstLaunchConfirm screen now reads from these too.
  'setup_title':           { en: "Let's set up Farroway for you", fr: 'Configurons Farroway pour vous', sw: 'Tuandae Farroway kwa ajili yako', ha: 'Bari mu shirya Farroway muku', tw: 'Ma yɛnhyehyɛ Farroway mma wo', hi: 'आइए Farroway को आपके लिए सेट करें', es: 'Configuremos Farroway para ti', pt: 'Vamos configurar o Farroway para você', ar: 'لنجهّز Farroway لك', id: 'Mari siapkan Farroway untuk Anda' },
  'setup_subtitle':        { en: 'Pick your language, country, and state', fr: 'Choisissez votre langue, votre pays et votre région', sw: 'Chagua lugha, nchi na jimbo lako', ha: 'Zaɓi harshe, ƙasa da jiharku', tw: 'Fa wo kasa, wo man, ne wo man mu si', hi: 'अपनी भाषा, देश और राज्य चुनें', es: 'Elige tu idioma, país y estado', pt: 'Escolha seu idioma, país e estado', ar: 'اختر لغتك وبلدك وولايتك', id: 'Pilih bahasa, negara, dan provinsi Anda' },
  'language':              { en: 'Language',    fr: 'Langue',    sw: 'Lugha',    ha: 'Harshe',    tw: 'Kasa',    hi: 'भाषा',         es: 'Idioma',    pt: 'Idioma',    ar: 'اللغة',     id: 'Bahasa' },
  'country':               { en: 'Country',     fr: 'Pays',      sw: 'Nchi',     ha: 'Ƙasa',      tw: 'Ɔman',    hi: 'देश',         es: 'País',      pt: 'País',      ar: 'البلد',     id: 'Negara' },
  'state':                 { en: 'State',       fr: 'État',      sw: 'Jimbo',    ha: 'Jiha',      tw: 'Ɔman mu si', hi: 'राज्य',      es: 'Estado',    pt: 'Estado',    ar: 'الولاية',   id: 'Provinsi' },
  'skip':                  { en: 'Skip',        fr: 'Passer',    sw: 'Ruka',     ha: 'Tsallake',  tw: 'Twa mu',  hi: 'छोड़ें',      es: 'Omitir',    pt: 'Pular',     ar: 'تخطي',      id: 'Lewati' },
  'continue':              { en: 'Continue',    fr: 'Continuer', sw: 'Endelea',  ha: 'Ci gaba',   tw: 'Toa so',  hi: 'जारी रखें',   es: 'Continuar', pt: 'Continuar', ar: 'متابعة',    id: 'Lanjut' },
  'detecting_location':    { en: 'Detecting your location', fr: 'Détection de votre emplacement', sw: 'Inatambua eneo lako', ha: 'Ana gane wurinku', tw: 'Yɛrehwɛ baabi a wowɔ', hi: 'आपका स्थान पता किया जा रहा है', es: 'Detectando tu ubicación', pt: 'Detectando sua localização', ar: 'جاري تحديد موقعك', id: 'Mendeteksi lokasi Anda' },
  'use_detected_location': { en: 'Use detected location',   fr: 'Utiliser la localisation détectée', sw: 'Tumia eneo lililogunduliwa', ha: "Yi amfani da wurin da aka gano", tw: 'Fa baabi a yɛahu no', hi: 'पता किया गया स्थान उपयोग करें', es: 'Usar ubicación detectada', pt: 'Usar localização detectada', ar: 'استخدم الموقع المكتشف', id: 'Gunakan lokasi terdeteksi' },
  'detect_location':       { en: 'Detect my location',      fr: 'Détecter ma localisation',        sw: 'Gundua eneo langu',          ha: 'Nemo wurina',                tw: 'Hwɛ me baabi',           hi: 'मेरा स्थान पता करें',        es: 'Detectar mi ubicación',    pt: 'Detectar minha localização', ar: 'حدد موقعي',     id: 'Deteksi lokasi saya' },
  'location_detected':     { en: 'We found your location',  fr: 'Nous avons trouvé votre emplacement', sw: 'Tumepata eneo lako',      ha: 'Mun sami wurinku',           tw: 'Yɛahu wo baabi',          hi: 'हमें आपका स्थान मिल गया',     es: 'Encontramos tu ubicación', pt: 'Encontramos sua localização', ar: 'وجدنا موقعك',    id: 'Kami menemukan lokasi Anda' },
  'location_detection_failed': { en: 'Could not detect your location', fr: "Impossible de détecter votre emplacement", sw: 'Haikuwezekana kupata eneo lako', ha: "Ba a iya gano wurinku ba", tw: 'Yɛantumi anhu wo baabi', hi: 'आपका स्थान पता नहीं चल सका', es: 'No se pudo detectar tu ubicación', pt: 'Não foi possível detectar sua localização', ar: 'تعذر تحديد موقعك', id: 'Tidak dapat mendeteksi lokasi Anda' },
  'choose_manually':       { en: 'Choose manually', fr: 'Choisir manuellement', sw: 'Chagua mwenyewe', ha: 'Zaɓi da kanku', tw: 'Fa wo ara kyerɛ', hi: 'खुद चुनें', es: 'Elegir manualmente', pt: 'Escolher manualmente', ar: 'اختر يدويًا', id: 'Pilih secara manual' },
  'country_detected':      { en: 'Detected country', fr: 'Pays détecté',  sw: 'Nchi iliyogunduliwa', ha: 'Ƙasar da aka gano', tw: 'Ɔman a yɛahu',        hi: 'पता किया गया देश',    es: 'País detectado',    pt: 'País detectado',   ar: 'البلد المكتشف',     id: 'Negara terdeteksi' },
  'state_detected':        { en: 'Detected state',   fr: 'État détecté',  sw: 'Jimbo lililogunduliwa', ha: 'Jihar da aka gano', tw: 'Ɔman mu si a yɛahu', hi: 'पता किया गया राज्य', es: 'Estado detectado',  pt: 'Estado detectado', ar: 'الولاية المكتشفة', id: 'Provinsi terdeteksi' },

  // Trust-gap confirmation + denial + offline
  'setup.confirmFarmLocation':       { en: 'Is this your farm location?', hi: 'क्या यह आपके खेत का स्थान है?', tw: 'Wo afuo no wɔ ha anaa?',   es: '¿Es esta tu ubicación de cultivo?', pt: 'Esta é a localização da sua fazenda?', fr: 'Est-ce l\'emplacement de votre ferme ?', ar: 'هل هذا موقع مزرعتك؟',      sw: 'Je, hii ni eneo la shamba lako?', id: 'Apakah ini lokasi pertanian Anda?' },
  'setup.locationPermissionDenied':  { en: 'Location access was not allowed', hi: 'स्थान की अनुमति नहीं मिली', tw: 'Wɔamma yɛn kwan sɛ yɛnhwɛ wo baabi', es: 'No se permitió el acceso a la ubicación', pt: 'Acesso à localização não permitido', fr: "L'accès à la localisation n'a pas été autorisé", ar: 'لم يُسمح بالوصول إلى الموقع', sw: 'Ruhusa ya eneo haikutolewa', id: 'Akses lokasi tidak diizinkan' },
  'setup.offlineHint':               { en: 'You\'re offline — choose manually',     hi: 'आप ऑफ़लाइन हैं — खुद चुनें',       tw: 'Wonkɔ intanɛt so — fa wo ara kyerɛ', es: 'Estás sin conexión — elige manualmente',   pt: 'Você está offline — escolha manualmente', fr: 'Vous êtes hors ligne — choisissez manuellement', ar: 'أنت غير متصل — اختر يدويًا', sw: 'Uko nje ya mtandao — chagua mwenyewe', id: 'Anda offline — pilih secara manual' },

  // ─── Confidence wording — key-driven tier variants ─────
  // task.titleKey = 'task.clearField' → tiered keys
  //   'task.clearField.high' / '.medium' / '.low'. Engine falls
  // back to the base key when a variant is missing.
  'confidence.checkFirst.title':     { en: 'Check your field before acting',      hi: 'कार्य करने से पहले खेत की जाँच करें',          tw: 'Hwɛ wo afuo ansa na woayɛ biribi',          es: 'Revisa tu campo antes de actuar',       pt: 'Verifique o campo antes de agir',          fr: 'Vérifiez votre champ avant d\'agir',       ar: 'افحص الحقل قبل اتخاذ أي إجراء',            sw: 'Kagua shamba lako kabla ya kuchukua hatua',     id: 'Periksa ladang Anda sebelum bertindak' },
  'task.clearField.high':            { en: 'Clear your field this week',          hi: 'इस सप्ताह अपने खेत की सफाई करें',             tw: 'Yi wo afuo mu ha dapɛn yi',                  es: 'Limpia tu campo esta semana',            pt: 'Limpe seu campo esta semana',               fr: 'Nettoyez votre champ cette semaine',       ar: 'نظّف حقلك هذا الأسبوع',                       sw: 'Safisha shamba lako wiki hii',                   id: 'Bersihkan ladang minggu ini' },
  'task.clearField.medium':          { en: 'Your field may need more clearing',   hi: 'आपके खेत को और सफाई की ज़रूरत हो सकती है',      tw: 'Ebetumi aba sɛ wo afuo hia nhohoro kakra',   es: 'Tu campo podría necesitar más limpieza', pt: 'Seu campo talvez precise de mais limpeza', fr: 'Votre champ pourrait nécessiter plus de nettoyage', ar: 'قد يحتاج حقلك إلى مزيد من التنظيف',      sw: 'Shamba lako linaweza kuhitaji usafi zaidi',     id: 'Ladang mungkin perlu dibersihkan lagi' },
  'task.clearField.low':             { en: 'Check whether your field still needs clearing', hi: 'देखें कि आपके खेत को और सफाई की ज़रूरत है या नहीं', tw: 'Hwɛ sɛ wo afuo da so hia nhohoro anaa', es: 'Revisa si tu campo todavía necesita limpieza', pt: 'Verifique se seu campo ainda precisa de limpeza', fr: 'Vérifiez si votre champ a encore besoin de nettoyage', ar: 'تحقق مما إذا كان حقلك لا يزال بحاجة إلى تنظيف', sw: 'Angalia kama shamba bado linahitaji usafi', id: 'Cek apakah ladang masih perlu dibersihkan' },
  'task.prepareDrainage.high':       { en: 'Prepare drainage before rain',        hi: 'बारिश से पहले जल-निकासी तैयार करें',          tw: 'Siesie nsuo tene berɛ ansa na osu atɔ',      es: 'Prepara el drenaje antes de la lluvia',   pt: 'Prepare a drenagem antes da chuva',        fr: 'Préparez le drainage avant la pluie',     ar: 'جهّز الصرف قبل المطر',                      sw: 'Tayarisha mfumo wa maji kabla ya mvua',        id: 'Siapkan drainase sebelum hujan' },
  'task.prepareDrainage.medium':     { en: 'Your field may need drainage before rain', hi: 'बारिश से पहले आपके खेत को जल-निकासी की ज़रूरत हो सकती है', tw: 'Wo afuo ebetumi ahia nsuo tene ansa na osu atɔ', es: 'Tu campo podría necesitar drenaje antes de la lluvia', pt: 'Seu campo talvez precise de drenagem antes da chuva', fr: 'Votre champ pourrait nécessiter un drainage avant la pluie', ar: 'قد يحتاج حقلك إلى الصرف قبل المطر', sw: 'Shamba linaweza kuhitaji mfumo wa maji kabla ya mvua', id: 'Ladang mungkin butuh drainase sebelum hujan' },
  'task.prepareDrainage.low':        { en: 'Check whether water may stay on your field after rain', hi: 'देखें कि बारिश के बाद खेत में पानी ठहर सकता है या नहीं', tw: 'Hwɛ sɛ nsuo bɛtena wo afuo mu wɔ osu akyi anaa', es: 'Comprueba si el agua puede quedarse en tu campo tras la lluvia', pt: 'Veja se a água pode ficar no campo após a chuva', fr: 'Vérifiez si l\'eau peut stagner dans votre champ après la pluie', ar: 'تحقق مما إذا كانت المياه قد تبقى في حقلك بعد المطر', sw: 'Kagua kama maji yanaweza kubaki shambani baada ya mvua', id: 'Cek apakah air bisa menggenang setelah hujan' },
  'task.plant.high':                 { en: 'Plant your seeds now',                hi: 'अभी अपने बीज बोएँ',                          tw: 'Dua wo aba seesei',                          es: 'Planta tus semillas ahora',              pt: 'Plante suas sementes agora',               fr: 'Plantez vos graines maintenant',           ar: 'ازرع بذورك الآن',                             sw: 'Panda mbegu zako sasa',                         id: 'Tanam benih Anda sekarang' },
  'task.plant.medium':               { en: 'It may be a good time to plant soon', hi: 'जल्द ही बुवाई का अच्छा समय हो सकता है',     tw: 'Ebetumi ayɛ bere pa sɛ wobɛdua ntɛm',        es: 'Podría ser un buen momento para plantar pronto', pt: 'Pode ser um bom momento para plantar em breve', fr: 'Ce sera peut-être bientôt un bon moment pour planter', ar: 'قد يكون وقت الزراعة قريبًا مناسبًا',      sw: 'Inaweza kuwa muda mzuri wa kupanda hivi karibuni', id: 'Mungkin waktu yang baik untuk menanam segera' },
  'task.plant.low':                  { en: 'Check if the soil is ready before planting', hi: 'बुवाई से पहले जाँचें कि मिट्टी तैयार है या नहीं', tw: 'Hwɛ sɛ asase no asiesie ansa na woadua', es: 'Comprueba si el suelo está listo antes de plantar', pt: 'Verifique se o solo está pronto antes de plantar', fr: 'Vérifiez si le sol est prêt avant de planter', ar: 'تحقق من جاهزية التربة قبل الزراعة', sw: 'Kagua kama udongo uko tayari kabla ya kupanda', id: 'Cek apakah tanah siap sebelum menanam' },
  'task.water.high':                 { en: 'Water your crop today',               hi: 'आज अपनी फसल को पानी दें',                    tw: 'Gugu wo afudeɛ nnɛ',                         es: 'Riega tu cultivo hoy',                   pt: 'Regue sua cultura hoje',                   fr: 'Arrosez votre culture aujourd\'hui',        ar: 'اسقِ محصولك اليوم',                          sw: 'Mwagilia zao lako leo',                         id: 'Siram tanaman Anda hari ini' },
  'task.water.medium':               { en: 'Your crop may need water today',      hi: 'आज आपकी फसल को पानी की ज़रूरत हो सकती है',     tw: 'Wo afudeɛ ebetumi ahia nsuo nnɛ',            es: 'Tu cultivo podría necesitar riego hoy',  pt: 'Sua cultura talvez precise de água hoje',   fr: 'Votre culture pourrait avoir besoin d\'eau aujourd\'hui', ar: 'قد يحتاج محصولك إلى الري اليوم',    sw: 'Zao lako linaweza kuhitaji maji leo',          id: 'Tanaman mungkin butuh disiram hari ini' },
  'task.water.low':                  { en: 'Check if your crop needs water today', hi: 'देखें कि आज आपकी फसल को पानी चाहिए या नहीं',  tw: 'Hwɛ sɛ wo afudeɛ hia nsuo nnɛ anaa',        es: 'Revisa si tu cultivo necesita riego hoy', pt: 'Verifique se sua cultura precisa de água hoje', fr: 'Vérifiez si votre culture a besoin d\'eau aujourd\'hui', ar: 'تحقق مما إذا كان محصولك يحتاج الماء اليوم', sw: 'Angalia kama zao linahitaji maji leo', id: 'Cek apakah tanaman perlu disiram hari ini' },
  'task.scoutPests.high':            { en: 'Check under leaves and remove pests today', hi: 'आज पत्तियों के नीचे देखें और कीट हटाएँ',      tw: 'Hwɛ nhaban ase na yi mmoawa no fi hɔ nnɛ',   es: 'Revisa debajo de las hojas y quita plagas hoy', pt: 'Verifique sob as folhas e retire pragas hoje', fr: 'Vérifiez sous les feuilles et retirez les ravageurs aujourd\'hui', ar: 'افحص أسفل الأوراق وأزل الآفات اليوم', sw: 'Kagua chini ya majani na uondoe wadudu leo', id: 'Periksa bawah daun dan singkirkan hama hari ini' },
  'task.scoutPests.medium':          { en: 'Check your plants for pests today',   hi: 'आज अपने पौधों में कीट की जाँच करें',         tw: 'Hwɛ wo nnua mu hwɛ mmoawa nnɛ',              es: 'Revisa tus plantas en busca de plagas hoy', pt: 'Verifique suas plantas por pragas hoje',  fr: 'Vérifiez vos plantes pour les ravageurs aujourd\'hui', ar: 'افحص نباتاتك بحثًا عن الآفات اليوم', sw: 'Kagua mimea yako kuhusu wadudu leo', id: 'Periksa tanaman Anda dari hama hari ini' },
  'task.scoutPests.low':             { en: 'Check your plants closely today',     hi: 'आज अपने पौधों को ध्यान से देखें',              tw: 'Hwɛ wo nnua mu yiye nnɛ',                    es: 'Revisa tus plantas con atención hoy',    pt: 'Observe suas plantas com atenção hoje',     fr: 'Observez vos plantes attentivement aujourd\'hui', ar: 'افحص نباتاتك بعناية اليوم',               sw: 'Kagua mimea yako kwa makini leo',               id: 'Amati tanaman Anda dengan saksama hari ini' },

  // Onboarding — U.S. farm-type step
  'wizard.usStep.title': {
    en: 'Tell us about your U.S. farm',
    fr: 'Parlez-nous de votre ferme américaine',
    sw: 'Tueleze kuhusu shamba lako la Marekani',
    ha: 'Faɗa mana game da gonarka ta Amurka',
    tw: 'Ka wo Amerika afuo ho asɛm',
    hi: 'अपने यू.एस. खेत के बारे में बताएं',
  },
  'wizard.usStep.subtitle': {
    en: 'We\'ll use your state and setup to rank the right crops.',
    fr: 'Nous utiliserons votre état pour classer les bonnes cultures.',
    sw: 'Tutatumia jimbo lako kuorodhesha mazao sahihi.',
    ha: 'Za mu yi amfani da jiharka don shirya amfanin gona.',
    tw: 'Yɛde wo man bɛto afudeɛ a ɛfata.',
    hi: 'हम आपके राज्य और सेटअप का उपयोग सही फसलों की रैंकिंग के लिए करेंगे।',
  },
  'wizard.usStep.chooseState': {
    en: 'Choose a state…',
    fr: 'Choisissez un état…',
    sw: 'Chagua jimbo…',
    ha: 'Zaɓi jiha…',
    tw: 'Yi ɔman bi…',
    hi: 'एक राज्य चुनें…',
  },
  'wizard.usStep.choose': {
    en: 'Choose…',
    fr: 'Choisir…',
    sw: 'Chagua…',
    ha: 'Zaɓi…',
    tw: 'Yi…',
    hi: 'चुनें…',
  },
  'offline.showingCachedStale': {
    en: 'Showing last saved tasks — may be outdated',
    fr: 'Affichage des dernières tâches — peut être obsolète',
    sw: 'Inaonyesha kazi zilizohifadhiwa mwisho — huenda zimepitwa na wakati',
    ha: 'Ana nuna ayyuka na ƙarshe — wataƙila sun tsufa',
    tw: 'Yɛrekyerɛ nnwuma a ɛtwa toɔ — ebia aberɛw',
    hi: 'अंतिम सहेजे गए कार्य दिखाए जा रहे हैं — पुराने हो सकते हैं',
  },

  // Context-aware offline fallback tasks (generated by buildOfflineFallbackTask)
  'offline.fallback.land_rest.title': {
    en: 'Rest and plan your next crop',
    fr: 'Reposez la terre et planifiez la prochaine culture',
    sw: 'Pumzisha ardhi na panga zao lijalo',
    ha: 'Ka huta ka shirya amfani na gaba',
    tw: 'Ma asase nhome na yɛ nhyehyɛeɛ ma afudeɛ foforɔ',
  },
  'offline.fallback.land_rest.why': {
    en: 'Your land is resting — this is the time to plan',
    fr: 'Votre terre se repose — c\'est le moment de planifier',
    sw: 'Ardhi yako inapumzika — huu ni wakati wa kupanga',
    ha: 'Gonarka tana hutawa — lokacin shirya ne',
    tw: 'Wo asase rehome — ɛyɛ bere a wo yɛ nhyehyɛeɛ',
  },
  'offline.fallback.land_rest.next': {
    en: 'Pick what to plant next and when',
    fr: 'Choisissez la prochaine culture et sa date',
    sw: 'Chagua cha kupanda baadaye na lini',
    ha: 'Zaɓi abin shuka na gaba da lokaci',
    tw: 'Yi deɛ wobɛdua bio ne bere a wobɛyɛ',
  },
  'offline.fallback.land_prep.title': {
    en: 'Prepare your land for planting',
    fr: 'Préparez votre terre pour les semis',
    sw: 'Tayarisha ardhi yako kwa kupanda',
    ha: 'Shirya gonarka don shuki',
    tw: 'Siesie w\'asase ma nnua',
  },
  'offline.fallback.land_prep.why': {
    en: 'Good soil prep sets up a strong season',
    fr: 'Un bon travail du sol lance une saison solide',
    sw: 'Utayarishaji mzuri huanzisha msimu imara',
    ha: 'Kyakkyawan shiri yana bayar da ƙarfi ga kakar',
    tw: 'Siesie asase yie na ɛbere no ayɛ papa',
  },
  'offline.fallback.land_prep.next': {
    en: 'Clear debris and check soil moisture',
    fr: 'Dégagez les débris et vérifiez l\'humidité',
    sw: 'Ondoa takataka na angalia unyevu wa udongo',
    ha: 'Share shara ka duba laima',
    tw: 'Yi nwura fi hɔ na hwɛ asase no mu nsuo',
  },
  'offline.fallback.maize_scout.title': {
    en: 'Scout your maize field',
    fr: 'Inspectez votre champ de maïs',
    sw: 'Kagua shamba lako la mahindi',
    ha: 'Bincika gonar masara',
    tw: 'Kɔhwɛ wo aburow afuo',
  },
  'offline.fallback.maize_scout.why': {
    en: 'Main growing season — pests move fast now',
    fr: 'Saison de croissance principale — les ravageurs se propagent vite',
    sw: 'Msimu mkuu wa ukuaji — wadudu husambaa haraka',
    ha: 'Babban lokacin girma — kwari suna yaɗuwa da sauri',
    tw: 'Aburow nyin berɛ — mmoawa nso mu ntɛm',
  },
  'offline.fallback.maize_scout.next': {
    en: 'Walk rows, look for leaf damage or wilting',
    fr: 'Marchez dans les rangs, cherchez dégâts ou flétrissement',
    sw: 'Tembea safu, angalia uharibifu wa majani au kunyauka',
    ha: 'Ka yi yawo ka duba lalacewar ganye ko bushewa',
    tw: 'Nantew sɛn mu, hwɛ nhahanam mu hwɛ sɛ ayɛ dɛm',
  },
  'offline.fallback.rice_water.title': {
    en: 'Check water level in your paddy',
    fr: 'Vérifiez le niveau d\'eau dans votre rizière',
    sw: 'Angalia kiwango cha maji shambani',
    ha: 'Duba matakin ruwa a cikin gonar shinkafa',
    tw: 'Hwɛ nsuo dodoɔ a ɛwɔ wo mogya afuo mu',
  },
  'offline.fallback.rice_water.why': {
    en: 'Monsoon window — water management matters most',
    fr: 'Mousson — la gestion de l\'eau est cruciale',
    sw: 'Msimu wa mvua — usimamizi wa maji ni muhimu',
    ha: 'Lokacin damina — sarrafa ruwa yana da muhimmanci',
    tw: 'Osutɔ berɛ — nsu hwɛsoɔ ho hia kɛseɛ',
  },
  'offline.fallback.rice_water.next': {
    en: 'Keep 2–5 cm above soil during tillering',
    fr: 'Maintenez 2–5 cm au-dessus du sol au tallage',
    sw: 'Dumisha sm 2–5 juu ya udongo wakati wa kuchanua',
    ha: 'Ajiye 2–5 cm sama da ƙasa lokacin reshe',
    tw: 'Ma nsuo no nkɔsoro 2–5 cm wɔ asase no so',
  },
  'offline.fallback.root_weed.title': {
    en: 'Weed around your root crops',
    fr: 'Désherbez autour de vos cultures de racines',
    sw: 'Ng\'oa magugu karibu na mazao ya mizizi',
    ha: 'Tsare ciyawa kewaye da amfanin tushe',
    tw: 'Yi nwura fi wo nhini afudeɛ ho',
  },
  'offline.fallback.root_weed.why': {
    en: 'Weeds steal nutrients from tubers all year',
    fr: 'Les mauvaises herbes volent les nutriments des tubercules',
    sw: 'Magugu huiba virutubisho kutoka kwa mizizi',
    ha: 'Ciyawa tana sata sinadarai daga tubers',
    tw: 'Nwura gye nhini afudeɛ mu aduane',
  },
  'offline.fallback.root_weed.next': {
    en: 'Clear weeds, loose soil gently at the base',
    fr: 'Enlevez mauvaises herbes, ameublissez le sol',
    sw: 'Ondoa magugu, lainisha udongo taratibu',
    ha: 'Share ciyawa, sassauta ƙasa a hankali',
    tw: 'Yi nwura fi hɔ, sɛe asase no brɛoo',
  },

  // Relative time — cache "Updated X ago" trust signal
  'time.updated_just_now': {
    en: 'Updated just now',
    fr: 'Mis à jour à l\'instant',
    sw: 'Imesasishwa sasa hivi',
    ha: 'An sabunta yanzun nan',
    tw: 'Wasesa no seesei ara',
  },
  'time.updated_minutes_ago': {
    en: 'Updated {n} min ago',
    fr: 'Mis à jour il y a {n} min',
    sw: 'Imesasishwa dakika {n} zilizopita',
    ha: 'An sabunta minti {n} da suka wuce',
    tw: 'Wasesa no mpɛn {n} a atwam',
  },
  'time.updated_hours_ago': {
    en: 'Updated {n} hours ago',
    fr: 'Mis à jour il y a {n} h',
    sw: 'Imesasishwa saa {n} zilizopita',
    ha: 'An sabunta awanni {n} da suka wuce',
    tw: 'Wasesa no nnɔnhwerew {n} a atwam',
  },
  'time.last_saved_yesterday': {
    en: 'Last saved yesterday',
    fr: 'Dernière sauvegarde hier',
    sw: 'Imehifadhiwa jana mwisho',
    ha: 'An ajiye jiya na ƙarshe',
    tw: 'Wɔakora ɛnnora',
  },
  'time.updated_days_ago': {
    en: 'Updated {n} days ago',
    fr: 'Mis à jour il y a {n} j',
    sw: 'Imesasishwa siku {n} zilizopita',
    ha: 'An sabunta kwanaki {n} da suka wuce',
    tw: 'Wasesa no nna {n} a atwam',
  },
  'time.updated_unknown': {
    en: 'Updated recently',
    fr: 'Mis à jour récemment',
    sw: 'Imesasishwa hivi karibuni',
    ha: 'An sabunta kwanan nan',
    tw: 'Wasesa no nkyɛe',
  },
  'common.next': {
    en: 'Next', fr: 'Suivant', sw: 'Ifuatayo', ha: 'Na gaba', tw: 'Nea edi so',
  },
  'common.back': {
    en: 'Back', fr: 'Retour', sw: 'Rudi', ha: 'Koma', tw: 'San bra',
  },
  'common.submit': {
    en: 'Submit', fr: 'Soumettre', sw: 'Wasilisha', ha: 'Aika', tw: 'Fa bra',
  },
  'common.retry': {
    en: 'Retry', fr: 'Réessayer', sw: 'Jaribu tena', ha: 'Sake gwadawa', tw: 'San hwehwe',
  },
  'common.skip': {
    en: 'Skip', fr: 'Passer', sw: 'Ruka', ha: 'Tsallake', tw: 'Twa mu',
  },
  'common.skipForNow': {
    en: 'Skip for now', fr: 'Passer pour l\'instant', sw: 'Ruka kwa sasa', ha: 'Tsallake a yanzu', tw: 'Twa mu seesei',
  },
  'common.cancel': {
    en: 'Cancel', fr: 'Annuler', sw: 'Ghairi', ha: 'Soke', tw: 'Gyae',
  },
  'common.logout': {
    en: 'Logout', fr: 'Déconnexion', sw: 'Ondoka', ha: 'Fita', tw: 'Fi mu',
  },
  'common.weather': {
    en: 'Weather', fr: 'Météo', sw: 'Hali ya hewa', ha: 'Yanayi', tw: 'Ewim tebea',
  },
  'settings.title': {
    en: 'Settings', fr: 'Paramètres', sw: 'Mipangilio', ha: 'Saiti', tw: 'Nhyehyɛeɛ',
  },

  // Weather chip labels (max 2 words)
  // Weather-task conflict overrides
  'wxConflict.skipWatering': { en: 'Skip watering — rain expected', fr: 'Pas d\'arrosage — pluie prévue', sw: 'Usimwagilie — mvua inatarajiwa', ha: 'Kada ka shayar — ruwan sama yana zuwa', tw: 'Nnye nsu ngu — nsuo reba' },
  'wxConflict.skipSpraying': { en: 'Skip spraying — too windy', fr: 'Pas de pulvérisation — trop de vent', sw: 'Usinyunyizie — upepo mkali', ha: 'Kada ka fesa — iska mai ƙarfi', tw: 'Nnye aduro ngu — mframa kɛse' },
  'wxConflict.skipDrying': { en: 'Move drying indoors — rain expected', fr: 'Séchage à l\'intérieur — pluie prévue', sw: 'Kaushia ndani — mvua inatarajiwa', ha: 'Bushewa a ciki — ruwan sama yana zuwa', tw: 'Fa nneɛma kɔ dan mu — nsuo reba' },
  'wxConflict.protectHarvest': { en: 'Protect your harvest', fr: 'Protéger la récolte', sw: 'Linda mazao yako', ha: 'Kare girbi', tw: 'Bɔ wo nnɔbae ho ban' },
  'wxConflict.protectHarvestReason': { en: 'Rain expected — cover or store your crop now.', fr: 'Mettez les grains sous abri avant la pluie.', sw: 'Mvua inatarajiwa — funika au hifadhi mazao yako sasa.', ha: 'Ruwan sama yana zuwa — rufe ko ajiye amfanin ku yanzu.', tw: 'Nsuo reba — kata anaasɛ sie wo nnɔbae no seesei.' },
  'wxConflict.protectHarvestVoice': { en: 'Rain is expected. Protect your harvest from rain.', fr: 'Il va pleuvoir. Protégez votre récolte de la pluie.', sw: 'Mvua inatarajiwa. Linda mazao yako kutokana na mvua.', ha: 'Ruwan sama yana zuwa. Kare girbi daga ruwan sama.', tw: 'Nsuo reba. Bɔ wo nnɔbae ho ban fi nsuo mu.' },
  'wxConflict.storeBefore': { en: 'Store harvest before rain', fr: 'Mettre les grains à l\'abri', sw: 'Hifadhi mazao kabla ya mvua', ha: 'Ajiye girbi kafin ruwa', tw: 'Sie wo nneɛma ansa na nsuo atɔ' },
  'wxConflict.storeBeforeReason': { en: 'Dry now — rain coming later. Finish drying and store.', fr: 'Sec maintenant — pluie après. Finissez le séchage et stockez.', sw: 'Kavu sasa — mvua baadaye. Maliza kukaushia na uhifadhi.', ha: 'Bushe yanzu — ruwa yana zuwa. Gama bushewa ku ajiye.', tw: 'Ɛyɛ hyew seesei — nsuo reba. Wie na sie.' },

  'wxChip.good': { en: 'Good', fr: 'Bon', sw: 'Nzuri', ha: 'Lafiya', tw: 'Eye' },
  'wxChip.rainLater': { en: 'Rain later', fr: 'Pluie après', sw: 'Mvua baadaye', ha: 'Ruwa daga baya', tw: 'Nsuo akyire' },
  'wxChip.risk': { en: 'Risk', fr: 'Risque', sw: 'Hatari', ha: 'Haɗari', tw: 'Asiane' },
  'wxChip.alert': { en: 'Alert', fr: 'Alerte', sw: 'Tahadhari', ha: 'Faɗakarwa', tw: 'Kɔkɔbɔ' },
  'wxChip.care': { en: 'Care', fr: 'Attention', sw: 'Angalia', ha: 'Hankali', tw: 'Hwɛ yie' },
  'wxChip.rain': { en: 'Rain', fr: 'Pluie', sw: 'Mvua', ha: 'Ruwa', tw: 'Nsuo' },
  'wxChip.wind': { en: 'Windy', fr: 'Venteux', sw: 'Upepo', ha: 'Iska', tw: 'Mframa' },
  'wxChip.dry': { en: 'Dry', fr: 'Sec', sw: 'Kavu', ha: 'Bushe', tw: 'Hyew' },
  'wxChip.hot': { en: 'Hot', fr: 'Chaud', sw: 'Joto', ha: 'Zafi', tw: 'Hyew pa' },
  'common.save': {
    en: 'Save', fr: 'Enregistrer', sw: 'Hifadhi', ha: 'Ajiye', tw: 'Kora so',
  },
  'common.done': {
    en: 'Done', fr: 'Terminé', sw: 'Imekamilika', ha: 'An gama', tw: 'Wie',
  },
  'common.yes': {
    en: 'Yes', fr: 'Oui', sw: 'Ndiyo', ha: 'Eh', tw: 'Aane',
  },
  'common.no': {
    en: 'No', fr: 'Non', sw: 'Hapana', ha: "A'a", tw: 'Daabi',
  },
  'common.ok': {
    en: 'Okay', fr: "D'accord", sw: 'Sawa', ha: 'To', tw: 'Yoo',
  },
  'common.close': {
    en: 'Close', fr: 'Fermer', sw: 'Funga', ha: 'Rufe', tw: 'To mu',
  },
  'common.help': {
    en: 'Help', fr: 'Aide', sw: 'Msaada', ha: 'Taimako', tw: 'Mmoa',
  },
  'common.signOut': {
    en: 'Sign Out', fr: 'Déconnexion', sw: 'Ondoka', ha: 'Fita', tw: 'Fi mu',
  },
  'common.listen': {
    en: 'Listen', fr: 'Écouter', sw: 'Sikiliza', ha: 'Saurara', tw: 'Tie',
  },
  'common.listenAgain': {
    en: 'Listen again', fr: 'Réécouter', sw: 'Sikiliza tena', ha: 'Sake saurara', tw: 'San tie',
  },
  'common.voice': {
    en: 'Voice', fr: 'Voix', sw: 'Sauti', ha: 'Murya', tw: 'Nne',
  },
  'common.enableVoice': {
    en: 'Enable Voice Guide', fr: 'Activer le guide vocal', sw: 'Washa mwongozo wa sauti', ha: 'Kunna jagoran murya', tw: 'Bue nne nkyerɛkyerɛ',
  },
  'common.loading': {
    en: 'Loading...', fr: 'Chargement...', sw: 'Inapakia...', ha: 'Ana lodi...', tw: 'Ɛreload...',
  },
  'common.saving': {
    en: 'Saving...', fr: 'Enregistrement...', sw: 'Inahifadhi...', ha: 'Ana ajiye...', tw: 'Ɛrekora...',
  },
  'common.creating': {
    en: 'Creating...', fr: 'Création...', sw: 'Inatengeneza...', ha: 'Ana ƙirƙira...', tw: 'Ɛreyɛ...',
  },
  'common.copy': {
    en: 'Copy', fr: 'Copier', sw: 'Nakili', ha: 'Kwafi', tw: 'Kɔpi',
  },
  'common.clear': {
    en: 'Clear', fr: 'Effacer', sw: 'Futa', ha: 'Share', tw: 'Pepa mu',
  },

  // ═══════════════════════════════════════════════════════════
  //  FARMER HOME / DASHBOARD
  // ═══════════════════════════════════════════════════════════

  'home.welcome': {
    en: 'Welcome,', fr: 'Bienvenue,', sw: 'Karibu,', ha: 'Barka da zuwa,', tw: 'Akwaaba,',
  },
  'home.myFarm': {
    en: 'My Farm', fr: 'Ma Ferme', sw: 'Shamba Langu', ha: 'Gonar ta', tw: 'Me Afuo',
  },
  'home.farmScore': {
    en: 'Farm Score', fr: 'Score Agricole', sw: 'Alama ya Shamba', ha: 'Maki Gona', tw: 'Afuo Akontaa',
  },
  'home.showingCached': {
    en: 'Showing saved data — connect to refresh', fr: 'Données sauvegardées — connectez-vous pour actualiser', sw: 'Data iliyohifadhiwa — unganisha kusasisha', ha: 'Bayanan da aka ajiye — haɗa don sabuntawa', tw: 'Data a wɔakora — fa ntam yɛ foforo',
  },
  'home.notReady': {
    en: 'Not ready yet', fr: 'Pas encore prêt', sw: 'Bado haiko tayari', ha: 'Bai shirya ba tukuna', tw: 'Ɛnnya so',
  },
  'home.seasonProgress': {
    en: 'Season Progress', fr: 'Progrès de saison', sw: 'Maendeleo ya Msimu', ha: "Ci gaban lokaci", tw: 'Bere mu Nkɔso',
  },
  'home.updatesLogged': {
    en: 'updates logged', fr: 'mises à jour', sw: 'masasisho yameandikwa', ha: 'sabuntawa an rubuta', tw: 'nsɛm a wɔakyerɛw',
  },
  'home.updateLogged': {
    en: 'update logged', fr: 'mise à jour', sw: 'sasisha limeandikwa', ha: 'sabuntawa an rubuta', tw: 'nsɛm a wɔakyerɛw',
  },
  'home.lastUpdate': {
    en: 'Last update', fr: 'Dernière mise à jour', sw: 'Sasisha la mwisho', ha: 'Sabuntawa na ƙarshe', tw: 'Nsɛm a etwa to',
  },
  'home.today': {
    en: 'Today', fr: "Aujourd'hui", sw: 'Leo', ha: 'Yau', tw: 'Ɛnnɛ',
  },
  'home.yesterday': {
    en: 'Yesterday', fr: 'Hier', sw: 'Jana', ha: 'Jiya', tw: 'Nnora',
  },
  'home.daysAgo': {
    en: 'days ago', fr: 'jours', sw: 'siku zilizopita', ha: 'kwanakin da suka gabata', tw: 'nnansa a atwam',
  },
  'home.overdue': {
    en: 'Overdue', fr: 'En retard', sw: 'Imecheleweshwa', ha: 'An wuce lokaci', tw: 'Atwam bere',
  },
  'home.noActiveSeason': {
    en: 'No Active Season', fr: 'Pas de saison active', sw: 'Hakuna Msimu', ha: 'Babu lokaci aiki', tw: 'Bere biara nni hɔ',
  },
  'home.startSeasonToTrack': {
    en: 'Start a season to track your progress', fr: 'Démarrez une saison pour suivre vos progrès', sw: 'Anza msimu kufuatilia maendeleo yako', ha: 'Fara lokaci don bin ci gaba', tw: 'Hyɛ bere ase na hua wo nkɔso',
  },
  'home.setupRequired': {
    en: 'Setup Required', fr: 'Configuration requise', sw: 'Usanidi Unahitajika', ha: 'Ana buƙatar saiti', tw: 'Setup hia',
  },
  'home.completeProfile': {
    en: 'Complete your farm profile to unlock tracking and scoring.', fr: 'Complétez votre profil pour activer le suivi et le score.', sw: 'Kamilisha profaili ya shamba lako ili kufuatilia na kupata alama.', ha: 'Cika bayanan gonar ka don samun maki.', tw: 'Wie wo afuo ho nsɛm na anya akontaa.',
  },
  'home.missing': {
    en: 'Missing:', fr: 'Manquant :', sw: 'Inakosekana:', ha: 'Babu:', tw: 'Ɛho hia:',
  },
  'home.pendingApproval': {
    en: 'Pending Approval', fr: 'En attente', sw: 'Inasubiri Idhini', ha: 'Ana jiran amincewar', tw: 'Ɛretwɛn apenimdie',
  },
  'home.registrationReview': {
    en: 'Your Registration is Under Review', fr: 'Votre inscription est en cours de révision', sw: 'Usajili wako unapitiwa', ha: 'Ana duba rajistar ku', tw: 'Wɔrehwehwɛ wo din kyerɛw mu',
  },
  'home.registrationDeclined': {
    en: 'Registration Declined', fr: 'Inscription refusée', sw: 'Usajili Umekataliwa', ha: 'An ƙi rajistar', tw: 'Wɔapo din kyerɛw no',
  },
  'home.loadingAccount': {
    en: 'Loading your account status...', fr: 'Chargement de votre compte...', sw: 'Inapakia hali ya akaunti yako...', ha: 'Ana lodi matsayin asusun ku...', tw: 'Wo akontabuo tebea reloadi...',
  },

  // ── Primary CTA buttons ──
  'home.setUpFarm': {
    en: 'Set Up Your Farm', fr: 'Configurez votre ferme', sw: 'Weka Shamba Lako', ha: 'Shirya Gonar ka', tw: 'Hyehyɛ wo Afuo',
  },
  'home.finishSetup': {
    en: 'Finish Farm Setup', fr: 'Finir la configuration', sw: 'Maliza Usanidi wa Shamba', ha: 'Kammala shirya gona', tw: 'Wie Afuo Setup',
  },
  'home.createProfileToStart': {
    en: 'Create your farm profile to start tracking and scoring.', fr: 'Créez votre profil pour commencer le suivi et le score.', sw: 'Tengeneza profaili ya shamba lako kuanza kufuatilia.', ha: 'Ƙirƙiri bayanan gona don fara bibiyar.', tw: 'Yɛ wo afuo ho nsɛm na hyɛ ase hua.',
  },
  'home.reportHarvest': {
    en: 'Report Harvest', fr: 'Signaler la récolte', sw: 'Ripoti Mavuno', ha: 'Rahoton girbi', tw: 'Twetwe otwa ho',
  },
  'home.startSeason': {
    en: 'Start Season', fr: 'Commencer la saison', sw: 'Anza Msimu', ha: 'Fara Lokaci', tw: 'Hyɛ Bere ase',
  },
  'home.addUpdate': {
    en: 'Add Update', fr: 'Ajouter une mise à jour', sw: 'Ongeza Sasishi', ha: 'Ƙara sabuntawa', tw: 'Fa nsɛm foforo ka ho',
  },
  'home.logActivity': {
    en: 'Log your latest farm activity.', fr: 'Notez votre dernière activité agricole.', sw: 'Andika shughuli yako ya hivi karibuni.', ha: 'Rubuta aikin gonar ku na baya-bayan nan.', tw: 'Kyerɛw wo afuo adwuma a etwa to.',
  },
  'home.noUpdateDays': {
    en: 'No update in {days} days — log an activity now.', fr: 'Pas de mise à jour depuis {days} jours.', sw: 'Hakuna sasishi kwa siku {days} — andika shughuli sasa.', ha: 'Babu sabuntawa cikin kwanaki {days} — rubuta yanzu.', tw: 'Nsɛm biara mmaeɛ nnansa {days} — kyerɛw bi seesei.',
  },
  'home.cropReadyHarvest': {
    en: 'Your crop is ready — submit your harvest report.', fr: 'Votre récolte est prête — soumettez votre rapport.', sw: 'Mazao yako yako tayari — wasilisha ripoti ya mavuno.', ha: 'Amfanin ku ya shirya — aika rahoton girbi.', tw: 'Wo afuom nnɔbae aboa — fa wo otwa ho amanneɛ bra.',
  },
  'home.setUpSeason': {
    en: 'Set up a new growing season to start tracking.', fr: 'Lancez une nouvelle saison pour commencer le suivi.', sw: 'Anza msimu mpya kufuatilia.', ha: 'Fara sabon lokaci don bibiyar.', tw: 'Hyɛ bere foforo ase na hua.',
  },
  'home.startNewSeason': {
    en: 'Start a new season to begin tracking your farm.', fr: 'Démarrez une saison pour suivre votre ferme.', sw: 'Anza msimu mpya kufuatilia shamba lako.', ha: 'Fara sabon lokaci don bin gonar ku.', tw: 'Hyɛ bere foforo ase na hua wo afuo.',
  },
  'home.atHarvestStage': {
    en: 'Your crop is at harvest stage — submit your report.', fr: 'Votre culture est au stade récolte — soumettez votre rapport.', sw: 'Mazao yako yapo hatua ya mavuno — wasilisha ripoti.', ha: 'Amfanin ku ya kai lokacin girbi — aika rahoton.', tw: 'Wo nnɔbae adu otwa bere — fa wo amanneɛ bra.',
  },

  // ── Expandable sections ──
  'home.farmDetails': {
    en: 'My Farm Details', fr: 'Détails de ma ferme', sw: 'Maelezo ya Shamba Langu', ha: 'Bayanan Gonar ta', tw: 'Me Afuo ho nsɛm',
  },
  'home.recommendations': {
    en: 'Recommendations', fr: 'Recommandations', sw: 'Mapendekezo', ha: 'Shawarwari', tw: 'Afotu',
  },
  'home.weatherDetails': {
    en: 'Weather Details', fr: 'Détails météo', sw: 'Maelezo ya Hali ya Hewa', ha: 'Bayanan yanayi', tw: 'Ewim tebea ho nsɛm',
  },
  'home.inviteFarmer': {
    en: 'Invite a Farmer', fr: 'Inviter un agriculteur', sw: 'Alika Mkulima', ha: 'Gayyaci manomi', tw: 'Frɛ okuafo bi',
  },
  'home.myApplications': {
    en: 'My Applications', fr: 'Mes demandes', sw: 'Maombi Yangu', ha: 'Aikace-aikacen ta', tw: 'Me Adesrɛ',
  },
  'home.notifications': {
    en: 'Notifications', fr: 'Notifications', sw: 'Arifa', ha: 'Sanarwa', tw: 'Nkra',
  },

  // ── Farm detail labels ──
  'home.farm': {
    en: 'Farm:', fr: 'Ferme :', sw: 'Shamba:', ha: 'Gona:', tw: 'Afuo:',
  },
  'home.location': {
    en: 'Location:', fr: 'Lieu :', sw: 'Eneo:', ha: 'Wuri:', tw: 'Beae:',
  },
  'home.size': {
    en: 'Size:', fr: 'Taille :', sw: 'Ukubwa:', ha: 'Girma:', tw: 'Kɛse:',
  },
  'home.stage': {
    en: 'Stage:', fr: 'Étape :', sw: 'Hatua:', ha: 'Mataki:', tw: 'Anammɔn:',
  },
  'home.planted': {
    en: 'Planted', fr: 'Planté', sw: 'Ilipandwa', ha: 'An shuka', tw: 'Wɔaduae',
  },
  'home.expectedHarvest': {
    en: 'Expected Harvest', fr: 'Récolte prévue', sw: 'Mavuno yanayotarajiwa', ha: 'Girbin da ake tsammani', tw: 'Otwa a wɔn hwɛ kwan',
  },
  'home.progressEntries': {
    en: 'Progress Entries', fr: 'Entrées de progrès', sw: 'Maingizo ya Maendeleo', ha: 'Shigar ci gaba', tw: 'Nkɔso nsɛm',
  },

  // ── Recommendation actions ──
  'home.helpful': {
    en: 'Helpful?', fr: 'Utile ?', sw: 'Inasaidia?', ha: 'Ya taimaka?', tw: 'Ɛboa?',
  },
  'home.thanksForFeedback': {
    en: 'Thanks for your feedback', fr: 'Merci pour votre avis', sw: 'Asante kwa maoni yako', ha: "Na gode da ra'ayin ku", tw: 'Yɛda wo ase',
  },
  'home.addNote': {
    en: 'Add a note...', fr: 'Ajouter une note...', sw: 'Ongeza maelezo...', ha: "Ƙara bayani...", tw: 'Fa nsɛm bi ka ho...',
  },
  'home.note': {
    en: 'Note', fr: 'Note', sw: 'Maelezo', ha: 'Bayani', tw: 'Nsɛm',
  },

  // ── Weather ──
  'home.temp': {
    en: 'Temp', fr: 'Temp', sw: 'Joto', ha: 'Zafi', tw: 'Hyew',
  },
  'home.rain3d': {
    en: 'Rain (3d)', fr: 'Pluie (3j)', sw: 'Mvua (siku 3)', ha: 'Ruwa (kwana 3)', tw: 'Nsuo (nnansa 3)',
  },
  'home.humidity': {
    en: 'Humidity', fr: 'Humidité', sw: 'Unyevunyevu', ha: 'Danshi', tw: 'Nsuo wɔ mframa mu',
  },
  'home.windKmh': {
    en: 'Wind km/h', fr: 'Vent km/h', sw: 'Upepo km/h', ha: 'Iska km/h', tw: 'Mframa km/h',
  },

  // ── Registration pending / rejected ──
  'home.whatToExpect': {
    en: 'What to expect:', fr: 'À quoi vous attendre :', sw: 'Nini cha kutarajia:', ha: 'Me za ka yi tsammani:', tw: 'Deɛ wobɛhwɛ kwan:',
  },
  'home.pending.thankYou': {
    en: 'Thank you for registering with Farroway. Our team is reviewing your information.',
    fr: 'Merci de vous être inscrit chez Farroway. Notre équipe examine vos informations.',
    sw: 'Asante kwa kujisajili Farroway. Timu yetu inakagua taarifa zako.',
    ha: 'Godiya da yin rajista da Farroway. Tawagar mu na duba bayananku.',
    tw: 'Meda wo ase sɛ woakyerɛw wo din wɔ Farroway. Yɛn adwumayɛfoɔ rehwɛ wo nsɛm no.',
  },
  'home.pending.timeline': {
    en: 'This usually takes 1–3 business days.',
    fr: 'Cela prend généralement 1 à 3 jours ouvrables.',
    sw: 'Kwa kawaida huchukua siku 1–3 za kazi.',
    ha: 'Yawanci yana ɗaukar kwanaki 1–3 na aiki.',
    tw: 'Ɛtaa gye adwumayɛ nna 1–3.',
  },
  'home.pending.expect.verify': {
    en: 'A field officer may contact you to verify your details',
    fr: 'Un agent de terrain pourra vous contacter pour vérifier vos informations',
    sw: 'Ofisa wa shambani anaweza kukuuliza ili kuthibitisha taarifa zako',
    ha: 'Jami\'in filin aiki na iya tuntuɓarka don tabbatar da bayananka',
    tw: 'Afuo so adwumayɛfoɔ bi bɛfrɛ wo ahwɛ sɛ wo nsɛm yɛ nokware',
  },
  'home.pending.expect.notify': {
    en: 'You will receive a notification when your account is approved',
    fr: 'Vous recevrez une notification lorsque votre compte sera approuvé',
    sw: 'Utapokea taarifa wakati akaunti yako itakapoidhinishwa',
    ha: 'Za ka sami sanarwa lokacin da aka amince da asusunka',
    tw: 'Wobɛnya bɔ bere a wɔapene w\'akawnt so',
  },
  'home.pending.expect.unlock': {
    en: 'Once approved, you can submit applications and access all farmer services',
    fr: 'Une fois approuvé, vous pouvez soumettre des demandes et accéder à tous les services',
    sw: 'Ukishaidhinishwa, unaweza kutuma maombi na kupata huduma zote za wakulima',
    ha: 'Da zarar an amince, za ka iya gabatar da aikace-aikace da samun duk hidimomin manoma',
    tw: 'Sɛ wɔpene so a, wobɛtumi de abisade ama na woanya akuafoɔ som adwuma nyinaa',
  },
  'home.rejected.explanation': {
    en: 'Unfortunately, your registration could not be approved at this time.',
    fr: 'Malheureusement, votre inscription n\'a pas pu être approuvée pour le moment.',
    sw: 'Kwa bahati mbaya, usajili wako haujaidhinishwa kwa wakati huu.',
    ha: 'Da sauri, rajistarka ba ta yi nasara ba a yanzu.',
    tw: 'Yɛn kɛ no, yɛantumi ampene wo din kyerɛw no so seesei.',
  },
  'home.rejected.reasonLabel': {
    en: 'Reason:', fr: 'Raison :', sw: 'Sababu:', ha: 'Dalili:', tw: 'Nnyinasoɔ:',
  },
  'home.rejected.contactHint': {
    en: 'If you believe this is an error, please contact your local Farroway office or field officer.',
    fr: 'Si vous pensez que c\'est une erreur, veuillez contacter votre bureau Farroway local ou un agent de terrain.',
    sw: 'Ikiwa unaamini hii ni hitilafu, tafadhali wasiliana na ofisi yako ya Farroway au ofisa wa shambani.',
    ha: 'Idan kun yi imanin wannan kuskure ne, don Allah a tuntuɓi ofishin Farroway na gida ko jami\'in filin aiki.',
    tw: 'Sɛ wugye di sɛ mfomsoɔ na ayɛ a, yɛsrɛ wo, frɛ wo mpɔtam Farroway asoɛeɛ anaa afuo so adwumayɛfoɔ.',
  },
  'home.farmerId': {
    en: 'Farmer ID', fr: 'ID agriculteur', sw: 'Kitambulisho cha Mkulima', ha: 'ID Manomi', tw: 'Okuafoɔ ID',
  },
  'home.registrationDetails': {
    en: 'Your Registration Details', fr: 'Détails de votre inscription', sw: 'Maelezo ya Usajili Wako', ha: 'Bayanan Rajistar ku', tw: 'Wo Din Kyerɛw ho nsɛm',
  },
  'home.name': {
    en: 'Name:', fr: 'Nom :', sw: 'Jina:', ha: 'Suna:', tw: 'Din:',
  },
  'home.phone': {
    en: 'Phone:', fr: 'Téléphone :', sw: 'Simu:', ha: 'Waya:', tw: 'Fon:',
  },
  'home.region': {
    en: 'Region:', fr: 'Région :', sw: 'Mkoa:', ha: 'Yanki:', tw: 'Mantam:',
  },
  'home.crop': {
    en: 'Crop:', fr: 'Culture :', sw: 'Mazao:', ha: 'Amfani:', tw: 'Nnɔbae:',
  },
  'home.farmSize': {
    en: 'Farm Size:', fr: 'Taille de la ferme :', sw: 'Ukubwa wa Shamba:', ha: 'Girman Gona:', tw: 'Afuo kɛseɛ:',
  },

  // ═══════════════════════════════════════════════════════════
  //  ONBOARDING WIZARD
  // ═══════════════════════════════════════════════════════════

  'onboarding.farmName': {
    en: 'Give your farm a name', fr: 'Donnez un nom à votre ferme', sw: 'Shamba lako jina gani?', ha: 'Ba gonar ku suna', tw: 'Ma wo afuo din',
  },
  'onboarding.selectCrop': {
    en: 'Select a crop', fr: 'Choisissez une culture', sw: 'Chagua mazao', ha: 'Zaɓi amfani', tw: 'Yi nnɔbae bi',
  },
  'onboarding.searchCrops': {
    en: 'Search crops...', fr: 'Chercher...', sw: 'Tafuta mazao...', ha: 'Nemo amfani...', tw: 'Hwehwɛ nnɔbae...',
  },
  'onboarding.currentStage': {
    en: 'Current stage', fr: 'Étape actuelle', sw: 'Hatua ya sasa', ha: 'Mataki na yanzu', tw: 'Anammɔn a ɛwɔ mu seesei',
  },
  'onboarding.other': {
    en: 'Other', fr: 'Autre', sw: 'Nyingine', ha: 'Wani', tw: 'Afoforo',
  },
  'onboarding.detectLocation': {
    en: 'Detect my location', fr: 'Détecter ma position', sw: 'Pata eneo langu', ha: 'Gano wurin ta', tw: 'Hwehwɛ me beae',
  },
  'onboarding.locationDetected': {
    en: 'Location detected — tap to update', fr: 'Position détectée — appuyez pour mettre à jour', sw: 'Eneo limegunduliwa — bonyeza kusasisha', ha: 'An gano wuri — matsa don sabuntawa', tw: 'Wɔahu beae no — mia na sesae',
  },
  'onboarding.typeLocation': {
    en: 'Or type: e.g. Nakuru, Kenya', fr: 'Ou tapez : ex. Bamako, Mali', sw: 'Au andika: mfano: Nakuru, Kenya', ha: 'Ko rubuta: misali Kano, Nigeria', tw: 'Anaa kyerɛw: sɛ Kumasi, Ghana',
  },
  'onboarding.changePhoto': {
    en: 'Change Photo', fr: 'Changer la photo', sw: 'Badilisha Picha', ha: 'Canja Hoto', tw: 'Sesa Mfonini',
  },
  'onboarding.takePhoto': {
    en: 'Take or Choose Photo', fr: 'Prendre ou choisir une photo', sw: 'Piga au Chagua Picha', ha: 'Ɗauki ko Zaɓi Hoto', tw: 'Twe anaa Yi Mfonini',
  },
  'onboarding.createFarm': {
    en: 'Create My Farm', fr: 'Créer ma ferme', sw: 'Tengeneza Shamba Langu', ha: 'Ƙirƙiri Gonar ta', tw: 'Yɛ Me Afuo',
  },
  'onboarding.skipCreate': {
    en: 'Skip & Create Farm', fr: 'Passer et créer', sw: 'Ruka na Utengeneze Shamba', ha: 'Tsallake ka Ƙirƙiri Gona', tw: 'Twa mu na Yɛ Afuo',
  },
  'onboarding.creatingProfile': {
    en: 'Creating your farm profile', fr: 'Création de votre profil', sw: 'Inatengeneza profaili ya shamba lako', ha: 'Ana ƙirƙiri bayanan gonar ku', tw: 'Ɛreyɛ wo afuo ho nsɛm',
  },
  'onboarding.settingUpTracking': {
    en: 'Setting up crop tracking', fr: 'Configuration du suivi', sw: 'Inasanidi ufuatiliaji wa mazao', ha: 'Ana shirya bibiyar amfani', tw: 'Ɛrehyehyɛ nnɔbae akyerɛ',
  },
  'onboarding.preparingRecs': {
    en: 'Preparing recommendations', fr: 'Préparation des recommandations', sw: 'Inaandaa mapendekezo', ha: 'Ana shirya shawarwari', tw: 'Ɛresiesie afotu',
  },
  'onboarding.noConnection': {
    en: 'No connection', fr: 'Pas de connexion', sw: 'Hakuna muunganisho', ha: 'Babu haɗi', tw: 'Connection biara nni hɔ',
  },
  'onboarding.somethingWrong': {
    en: 'Something went wrong', fr: "Quelque chose n'a pas marché", sw: 'Kuna tatizo fulani', ha: 'Wani abu ya faru', tw: 'Biribi kɔ basaa',
  },
  'onboarding.retryOnline': {
    en: 'Retry When Online', fr: 'Réessayer en ligne', sw: 'Jaribu tena ukiwa mtandaoni', ha: 'Sake gwadawa lokacin layi', tw: 'San hwehwɛ wokɔ intanɛt so a',
  },
  'onboarding.noInternetSaved': {
    en: 'No internet connection. Your data is saved — tap "Retry" when you\'re back online.', fr: 'Pas de connexion. Vos données sont enregistrées — appuyez sur "Réessayer" quand vous serez connecté.', sw: 'Hakuna mtandao. Data yako imehifadhiwa — bonyeza "Jaribu tena" ukirejea mtandaoni.', ha: 'Babu intanet. An ajiye bayanan ku — matsa "Sake gwadawa" idan kun dawo layi.', tw: 'Intanɛt biara nni hɔ. Wɔakora wo nsɛm — mia "San hwehwɛ" wokɔ intanɛt so a.',
  },
  'onboarding.selectImage': {
    en: 'Please select a JPEG, PNG, or WebP image.', fr: 'Veuillez choisir une image JPEG, PNG ou WebP.', sw: 'Tafadhali chagua picha ya JPEG, PNG, au WebP.', ha: 'Da fatan zaɓi hoton JPEG, PNG, ko WebP.', tw: 'Yɛsrɛ wo yi mfonini JPEG, PNG, anaa WebP.',
  },
  'onboarding.imageUnder5MB': {
    en: 'Image must be under 5 MB.', fr: "L'image doit faire moins de 5 Mo.", sw: 'Picha lazima iwe chini ya 5 MB.', ha: 'Hoton dole ya kasance ƙasa da 5 MB.', tw: 'Mfonini no nnsene 5 MB.',
  },

  // ── Gender options ──
  'onboarding.male': {
    en: 'Male', fr: 'Homme', sw: 'Mwanaume', ha: 'Namiji', tw: 'Ɔbarima',
  },
  'onboarding.female': {
    en: 'Female', fr: 'Femme', sw: 'Mwanamke', ha: 'Mace', tw: 'Ɔbaa',
  },
  'onboarding.otherGender': {
    en: 'Other', fr: 'Autre', sw: 'Nyingine', ha: 'Wani', tw: 'Afoforo',
  },
  'onboarding.preferNotSay': {
    en: 'Prefer not to say', fr: 'Préfère ne pas dire', sw: 'Sipendelei kusema', ha: "Ban so in faɗa ba", tw: 'Mempɛ sɛ meka',
  },

  // ── Age options ──
  'onboarding.under25': {
    en: 'Under 25', fr: 'Moins de 25', sw: 'Chini ya 25', ha: 'Ƙasa da 25', tw: 'Ase 25',
  },
  'onboarding.age25to35': {
    en: '25 – 35', fr: '25 – 35', sw: '25 – 35', ha: '25 – 35', tw: '25 – 35',
  },
  'onboarding.age36to50': {
    en: '36 – 50', fr: '36 – 50', sw: '36 – 50', ha: '36 – 50', tw: '36 – 50',
  },
  'onboarding.over50': {
    en: 'Over 50', fr: 'Plus de 50', sw: 'Zaidi ya 50', ha: 'Fiye da 50', tw: 'Ɛboro 50',
  },

  // ── Farm size options ──
  'onboarding.small': {
    en: 'Small', fr: 'Petit', sw: 'Ndogo', ha: 'Ƙarami', tw: 'Nketewa',
  },
  'onboarding.medium': {
    en: 'Medium', fr: 'Moyen', sw: 'Wastani', ha: 'Matsakaici', tw: 'Ntam',
  },
  'onboarding.large': {
    en: 'Large', fr: 'Grand', sw: 'Kubwa', ha: 'Babba', tw: 'Kɛse',
  },

  // ── Stage options ──
  'stage.planting': {
    en: 'Planting', fr: 'Plantation', sw: 'Kupanda', ha: 'Shuka', tw: 'Dua',
  },
  'stage.growing': {
    en: 'Growing', fr: 'Croissance', sw: 'Kukua', ha: 'Girma', tw: 'Nyin',
  },
  'stage.flowering': {
    en: 'Flowering', fr: 'Floraison', sw: 'Kuchanua', ha: 'Fure', tw: 'Nhwiren',
  },
  'stage.harvest': {
    en: 'Harvest', fr: 'Récolte', sw: 'Mavuno', ha: 'Girbi', tw: 'Otwa',
  },
  'stage.harvesting': {
    en: 'Harvesting', fr: 'Récolte en cours', sw: 'Kuvuna', ha: 'Ana girbi', tw: 'Ɛretwa',
  },

  // ═══════════════════════════════════════════════════════════
  //  QUICK UPDATE FLOW
  // ═══════════════════════════════════════════════════════════

  'update.addUpdate': {
    en: 'Add Update', fr: 'Ajouter une mise à jour', sw: 'Ongeza Sasishi', ha: 'Ƙara sabuntawa', tw: 'Fa nsɛm foforo ka ho',
  },
  'update.whatToDo': {
    en: 'What do you want to do?', fr: 'Que voulez-vous faire ?', sw: 'Unataka kufanya nini?', ha: 'Me kuke so ku yi?', tw: 'Deɛ wopɛ sɛ woyɛ?',
  },
  'update.cropProgress': {
    en: 'Crop Progress', fr: 'Progrès des cultures', sw: 'Maendeleo ya Mazao', ha: "Ci gaban amfani", tw: 'Nnɔbae Nkɔso',
  },
  'update.logStageCondition': {
    en: 'Log stage & condition', fr: 'Noter étape et état', sw: 'Andika hatua na hali', ha: 'Rubuta mataki da yanayi', tw: 'Kyerɛw anammɔn ne tebea',
  },
  'update.uploadPhoto': {
    en: 'Upload Photo', fr: 'Envoyer une photo', sw: 'Pakia Picha', ha: 'Ɗora Hoto', tw: 'Fa Mfonini bra',
  },
  'update.takeFarmPhoto': {
    en: 'Take a farm photo', fr: 'Prendre une photo', sw: 'Piga picha ya shamba', ha: 'Ɗauki hoton gona', tw: 'Twe afuo mfonini',
  },
  'update.reportIssue': {
    en: 'Report Issue', fr: 'Signaler un problème', sw: 'Ripoti Tatizo', ha: 'Rahoton matsala', tw: 'Ka ɔhaw ho',
  },
  'update.pestDiseaseWeather': {
    en: 'Pest, disease, weather', fr: 'Ravageurs, maladie, météo', sw: 'Wadudu, ugonjwa, hali ya hewa', ha: "Kwari, cuta, yanayi", tw: 'Mmoa a wɔsɛe nnɔbae, nyarewa, ewim tebea',
  },
  'update.cropStage': {
    en: 'Crop Stage', fr: 'Étape de culture', sw: 'Hatua ya Mazao', ha: 'Mataki amfani', tw: 'Nnɔbae Anammɔn',
  },
  'update.whatStage': {
    en: 'What stage is your crop?', fr: 'À quelle étape est votre culture ?', sw: 'Mazao yako yako hatua gani?', ha: 'Amfanin ku ya kai mataki wane?', tw: 'Wo nnɔbae wɔ anammɔn bɛn so?',
  },
  'update.condition': {
    en: 'Condition', fr: 'État', sw: 'Hali', ha: 'Yanayi', tw: 'Tebea',
  },
  'update.howLook': {
    en: 'How does your crop look?', fr: 'Comment va votre culture ?', sw: 'Mazao yako yanaonekanaje?', ha: 'Yaya amfanin ku ke gani?', tw: 'Wo nnɔbae te sɛn?',
  },
  'update.good': {
    en: 'Good', fr: 'Bien', sw: 'Nzuri', ha: 'Kyau', tw: 'Eye',
  },
  'update.okay': {
    en: 'Okay', fr: 'Moyen', sw: 'Sawa', ha: 'To', tw: 'Eye kakra',
  },
  'update.problem': {
    en: 'Problem', fr: 'Problème', sw: 'Tatizo', ha: 'Matsala', tw: 'Ɔhaw',
  },
  'update.photo': {
    en: 'Photo', fr: 'Photo', sw: 'Picha', ha: 'Hoto', tw: 'Mfonini',
  },
  'update.takePhotoOfFarm': {
    en: 'Take a photo of your farm', fr: 'Prenez une photo de votre ferme', sw: 'Piga picha ya shamba lako', ha: 'Ɗauki hoton gonar ku', tw: 'Twe wo afuo mfonini',
  },
  'update.addPhotoOptional': {
    en: 'Add a photo (optional)', fr: 'Ajouter une photo (facultatif)', sw: 'Ongeza picha (si lazima)', ha: 'Ƙara hoto (ba dole ba)', tw: 'Fa mfonini ka ho (wompɛ a gyae)',
  },
  'update.tapToTakePhoto': {
    en: 'Tap to take photo', fr: 'Appuyez pour photographier', sw: 'Bonyeza kupiga picha', ha: 'Matsa don ɗaukar hoto', tw: 'Mia na twe mfonini',
  },
  'update.remove': {
    en: 'Remove', fr: 'Supprimer', sw: 'Ondoa', ha: 'Cire', tw: 'Yi fi hɔ',
  },
  'update.savePhoto': {
    en: 'Save Photo', fr: 'Enregistrer la photo', sw: 'Hifadhi Picha', ha: 'Ajiye Hoto', tw: 'Kora Mfonini',
  },
  'update.submitWithPhoto': {
    en: 'Submit with Photo', fr: 'Envoyer avec photo', sw: 'Wasilisha na Picha', ha: 'Aika tare da Hoto', tw: 'Fa bra ne Mfonini',
  },
  'update.submitUpdate': {
    en: 'Submit Update', fr: 'Envoyer', sw: 'Wasilisha Sasishi', ha: 'Aika sabuntawa', tw: 'Fa bra',
  },
  'update.skipPhoto': {
    en: 'Skip photo', fr: 'Passer la photo', sw: 'Ruka picha', ha: 'Tsallake hoto', tw: 'Twa mfonini mu',
  },
  'update.savingUpdate': {
    en: 'Saving your update...', fr: 'Enregistrement en cours...', sw: 'Inahifadhi sasishi lako...', ha: 'Ana ajiye sabuntawar ku...', tw: 'Ɛrekora wo nsɛm...',
  },
  'update.saving': {
    en: 'Saving...', fr: 'Enregistrement...', sw: 'Inahifadhi...', ha: 'Ana ajiye...', tw: 'Ɛrekora...',
  },
  'update.saved': {
    en: 'Saved', fr: 'Enregistré', sw: 'Imehifadhiwa', ha: 'An ajiye', tw: 'Wɔakora',
  },
  'update.uploadingPhoto': {
    en: 'Uploading photo...', fr: 'Envoi de la photo...', sw: 'Inapakia picha...', ha: 'Ana ɗora hoto...', tw: 'Ɛreload foto...',
  },
  'update.photoUploaded': {
    en: 'Photo uploaded', fr: 'Photo envoyée', sw: 'Picha imepakiwa', ha: 'An ɗora hoto', tw: 'Wɔaload foto',
  },
  'update.photoFailed': {
    en: 'Photo upload failed', fr: "Échec de l'envoi de la photo", sw: 'Kupakia picha kumeshindwa', ha: 'Ɗora hoto ya gaza', tw: 'Foto load no ankasa',
  },
  'update.updateSaved': {
    en: 'Update Saved!', fr: 'Mise à jour enregistrée !', sw: 'Sasishi Limehifadhiwa!', ha: 'An ajiye sabuntawa!', tw: 'Wɔakora nsɛm no!',
  },
  'update.completedIn': {
    en: 'Completed in {seconds}s', fr: 'Terminé en {seconds}s', sw: 'Imekamilika kwa {seconds}s', ha: 'An gama cikin {seconds}s', tw: 'Wie wɔ {seconds}s mu',
  },
  'update.savedOffline': {
    en: 'Saved Offline', fr: 'Enregistré hors ligne', sw: 'Imehifadhiwa bila mtandao', ha: 'An ajiye ba tare da layi ba', tw: 'Wɔakora a intanɛt nni hɔ',
  },
  'update.willSyncReconnect': {
    en: 'Your update will sync when you reconnect.', fr: 'Votre mise à jour sera synchronisée à la reconnexion.', sw: 'Sasishi lako litasawazishwa ukirejea mtandaoni.', ha: 'Sabuntawar ku za ta daidaita idan kun dawo layi.', tw: 'Wo nsɛm bɛyɛ sɛnti wo de intanɛt a.',
  },
  'update.openingCamera': {
    en: 'Opening camera...', fr: 'Ouverture de la caméra...', sw: 'Inafungua kamera...', ha: 'Ana buɗe kyamara...', tw: 'Ɛrebue kamera...',
  },
  'update.retake': {
    en: 'Retake', fr: 'Reprendre', sw: 'Piga tena', ha: 'Sake ɗauka', tw: 'San twe',
  },
  'update.whatHappened': {
    en: 'What happened?', fr: 'Que s\'est-il passé ?', sw: 'Nini kimetokea?', ha: 'Me ya faru?', tw: 'Deɛ ɛsii?',
  },
  'update.suggested': {
    en: 'Suggested', fr: 'Suggéré', sw: 'Pendekezo', ha: 'Shawarar', tw: 'Afotu',
  },
  'update.updateSavedCheck': {
    en: 'Update saved ✅', fr: 'Mise à jour enregistrée ✅', sw: 'Sasishi limehifadhiwa ✅', ha: 'An ajiye sabuntawa ✅', tw: 'Wɔakora nsɛm no ✅',
  },
  'update.savedOfflineMsg': {
    en: 'Saved offline. Will send when online.', fr: 'Enregistré hors ligne. Envoi à la reconnexion.', sw: 'Imehifadhiwa. Itatumwa ukiwa mtandaoni.', ha: 'An ajiye. Za a aika idan layi ya dawo.', tw: 'Wɔakora. Wɔde bɛkɔ intanɛt bɛba a.',
  },
  'update.activity.progress': {
    en: 'Progress', fr: 'Progrès', sw: 'Maendeleo', ha: 'Ci gaba', tw: 'Nkɔso',
  },
  'update.activity.harvest': {
    en: 'Harvest', fr: 'Récolte', sw: 'Mavuno', ha: 'Girbi', tw: 'Twabɔ',
  },
  'update.activity.spray': {
    en: 'Spray', fr: 'Pulvériser', sw: 'Nyunyizia', ha: 'Fesa', tw: 'Pete aduro',
  },
  'update.activity.pesticide': {
    en: 'Pesticide', fr: 'Pesticide', sw: 'Dawa ya wadudu', ha: 'Maganin kwari', tw: 'Nnwura aduro',
  },
  'update.pesticideName': {
    en: 'Pesticide name', fr: 'Nom du pesticide', sw: 'Jina la dawa', ha: 'Sunan magani', tw: 'Aduro din',
  },
  'update.pesticideNameHint': {
    en: 'e.g. Neem oil', fr: 'ex. Huile de neem', sw: 'mf. Mafuta ya mwarobaini', ha: 'mis. Man darbejiya', tw: 'ss. Neem ngo',
  },
  'update.pesticideAmount': {
    en: 'Amount used', fr: 'Quantité utilisée', sw: 'Kiasi kilichotumika', ha: 'Adadin da aka yi amfani', tw: 'Dodow a wɔde yɛɛ adwuma',
  },
  'update.pesticideAmountHint': {
    en: 'e.g. 2 litres', fr: 'ex. 2 litres', sw: 'mf. Lita 2', ha: 'mis. Lita 2', tw: 'ss. Lita 2',
  },
  'buyer.title': {
    en: 'Farm Trust Overview', fr: 'Aperçu de confiance des fermes', sw: 'Muhtasari wa Uaminifu wa Mashamba', ha: 'Bayani Amintaccen Gona', tw: 'Afuom Gyidi Nhwɛso',
  },
  'buyer.safeToHarvest': {
    en: 'Safe to harvest', fr: 'Prêt pour la récolte', sw: 'Salama kuvuna', ha: 'Lafiya girbi', tw: 'Ɛyɛ safe sɛ wɔtwa',
  },
  'buyer.needsReview': {
    en: 'Needs review', fr: 'À vérifier', sw: 'Inahitaji ukaguzi', ha: 'Yana buƙatar dubawa', tw: 'Ɛhia nhwɛso',
  },
  'buyer.notSafe': {
    en: 'Not safe', fr: 'Non sûr', sw: 'Si salama', ha: 'Ba lafiya ba', tw: 'Ɛnyɛ safe',
  },
  'buyer.allFarms': {
    en: 'All farms', fr: 'Toutes les fermes', sw: 'Mashamba yote', ha: 'Gonakin duka', tw: 'Afuom nyinaa',
  },
  'buyer.safe': {
    en: 'Safe', fr: 'Sûr', sw: 'Salama', ha: 'Lafiya', tw: 'Safe',
  },
  'buyer.lastPesticide': {
    en: 'Last pesticide', fr: 'Dernier pesticide', sw: 'Dawa ya mwisho', ha: 'Maganin ƙwari na ƙarshe', tw: 'Nnwura a etwa to',
  },
  'buyer.safeHarvestDate': {
    en: 'Safe harvest date', fr: 'Date de récolte sûre', sw: 'Tarehe salama ya kuvuna', ha: 'Ranar girbi lafiya', tw: 'Da a wɔbɛtumi atwa',
  },
  'buyer.confidence': {
    en: 'Confidence', fr: 'Confiance', sw: 'Uhakika', ha: 'Tabbaci', tw: 'Gyidi',
  },
  'buyer.verified': {
    en: 'Verified', fr: 'Vérifié', sw: 'Imethibitishwa', ha: 'An tabbatar', tw: 'Wɔahwɛ so',
  },
  'buyer.selfReported': {
    en: 'Self-reported', fr: 'Auto-déclaré', sw: 'Kujitangaza', ha: 'Rahoto kansa', tw: 'Ɔno ankasa bɔɔ amanneɛ',
  },
  'buyer.timeline': {
    en: 'Activity timeline', fr: 'Chronologie des activités', sw: 'Ratiba ya shughuli', ha: 'Jadawalin ayyuka', tw: 'Dwumadie bere ahyɛnsoɛ',
  },
  'buyer.noFarms': {
    en: 'No farms found', fr: 'Aucune ferme trouvée', sw: 'Hakuna mashamba yaliyopatikana', ha: 'Babu gonaki da aka samu', tw: 'Wɔanhunu afuom biara',
  },
  'buyer.violations': {
    en: 'Violations', fr: 'Violations', sw: 'Ukiukaji', ha: 'Keta doka', tw: 'Mmara so buo',
  },
  'compliance.safeToHarvest': {
    en: 'Safe to harvest', fr: 'Prêt pour la récolte', sw: 'Salama kuvuna', ha: 'Lafiya girbi', tw: 'Ɛyɛ safe sɛ wɔtwa',
  },
  'compliance.checkDetails': {
    en: 'Check details', fr: 'Vérifiez les détails', sw: 'Angalia maelezo', ha: 'Duba bayani', tw: 'Hwɛ nsɛm no mu',
  },
  'compliance.waitBeforeHarvesting': {
    en: 'Wait before harvesting', fr: 'Attendez avant de récolter', sw: 'Subiri kabla ya kuvuna', ha: 'Jira kafin girbi', tw: 'Twen ansa na woatwa',
  },
  'update.activity.issue': {
    en: 'Problem', fr: 'Problème', sw: 'Tatizo', ha: 'Matsala', tw: 'Ɔhaw',
  },
  'update.activity.other': {
    en: 'Other', fr: 'Autre', sw: 'Nyingine', ha: 'Wani', tw: 'Afoforo',
  },

  // ═══════════════════════════════════════════════════════════
  //  ACTION FEEDBACK (guarantee layer)
  // ═══════════════════════════════════════════════════════════

  'feedback.saving': {
    en: 'Saving...', fr: 'Enregistrement...', sw: 'Inahifadhi...', ha: 'Ana ajiye...', tw: 'Ɛrekora...',
  },
  'feedback.done': {
    en: 'Done!', fr: 'Terminé !', sw: 'Imekamilika!', ha: 'An gama!', tw: 'Wie!',
  },
  'feedback.savedOffline': {
    en: 'Saved offline', fr: 'Enregistré hors ligne', sw: 'Imehifadhiwa bila mtandao', ha: 'An ajiye ba tare da layi ba', tw: 'Wɔakora a intanɛt nni hɔ',
  },
  'feedback.stillWorking': {
    en: 'Still working...', fr: 'Encore en cours...', sw: 'Bado inafanya kazi...', ha: 'Har yanzu ana aiki...', tw: 'Ɛreyɛ adwuma da...',
  },
  'feedback.pleaseWait': {
    en: 'Please wait a moment longer.', fr: 'Veuillez patienter un moment.', sw: 'Tafadhali subiri kidogo.', ha: 'Da fatan ku jira.', tw: 'Yɛsrɛ wo twɛn kakra.',
  },
  'feedback.continue': {
    en: 'Continue', fr: 'Continuer', sw: 'Endelea', ha: 'Ci gaba', tw: 'Toa so',
  },
  'feedback.willSync': {
    en: 'Will sync when you reconnect.', fr: 'Se synchronisera à la reconnexion.', sw: 'Itasawazishwa ukirejea mtandaoni.', ha: 'Za ta daidaita idan kun dawo layi.', tw: 'Ɛbɛyɛ sɛnti wo de intanɛt a.',
  },
  'feedback.okay': {
    en: 'Okay', fr: "D'accord", sw: 'Sawa', ha: 'To', tw: 'Yoo',
  },
  'feedback.couldNotComplete': {
    en: 'Could not complete', fr: "N'a pas pu terminer", sw: 'Haikuweza kukamilisha', ha: 'Ba a iya kammalawa ba', tw: 'Enntumi anwie',
  },
  'feedback.tryAgain': {
    en: 'Please try again.', fr: 'Veuillez réessayer.', sw: 'Tafadhali jaribu tena.', ha: 'Da fatan sake gwadawa.', tw: 'Yɛsrɛ wo san hwehwɛ.',
  },
  'feedback.somethingWrong': {
    en: 'Something went wrong', fr: "Quelque chose n'a pas marché", sw: 'Kuna tatizo fulani', ha: 'Wani abu ya faru', tw: 'Biribi kɔ basaa',
  },
  'feedback.goBack': {
    en: 'Go Back', fr: 'Retour', sw: 'Rudi nyuma', ha: 'Koma baya', tw: 'San bra',
  },

  // ═══════════════════════════════════════════════════════════
  //  SYNC STATUS
  // ═══════════════════════════════════════════════════════════

  // ─── Farmer Home ────────────────────────────────────────
  // ─── Avatar ─────────────────────────────────────────────
  'avatar.add': { en: 'Add photo', fr: 'Ajouter photo', sw: 'Ongeza picha', ha: 'Ƙara hoto', tw: 'Fa mfonini ka ho' },
  'avatar.change': { en: 'Change photo', fr: 'Changer photo', sw: 'Badilisha picha', ha: 'Canja hoto', tw: 'Sesa mfonini' },
  'avatar.remove': { en: 'Remove', fr: 'Supprimer', sw: 'Ondoa', ha: 'Cire', tw: 'Yi fi hɔ' },
  'avatar.uploading': { en: 'Uploading...', fr: 'Envoi...', sw: 'Inapakia...', ha: 'Ana aikawa...', tw: 'Ɛrede kɔ...' },
  'avatar.uploadFailed': { en: 'Upload failed', fr: 'Échec', sw: 'Imeshindikana', ha: 'Ba a yi nasara ba', tw: 'Ɛnyɛɛ yie' },
  'avatar.compressFailed': { en: 'Could not process image', fr: 'Image non traitée', sw: 'Haiwezi kusindika picha', ha: 'Ba a iya sarrafa hoto ba', tw: 'Ɛntumi nyɛ mfonini no' },

  'farmer.online': { en: 'Online', fr: 'En ligne', sw: 'Mtandaoni', ha: 'Kan layi', tw: 'Intanɛt wɔ hɔ' },
  'farmer.offline': { en: 'Offline', fr: 'Hors ligne', sw: 'Nje ya mtandao', ha: 'Babu intanet', tw: 'Intanɛt nni hɔ' },
  'farmer.taskDone': { en: 'Done!', fr: 'Terminé !', sw: 'Imekamilika!', ha: 'An gama!', tw: 'Awie!' },

  'sync.offline': {
    en: 'No internet — your work is saved here', fr: 'Pas d\'internet — votre travail est sauvegardé ici', sw: 'Hakuna mtandao — kazi yako imehifadhiwa hapa', ha: 'Babu intanet — aikin ku an ajiye a nan', tw: 'Intanɛt nni hɔ — wo adwuma akora ha',
  },
  'sync.pendingOne': {
    en: '{count} update waiting to send', fr: '{count} mise à jour en attente', sw: '{count} sasishi linasubiri kutumwa', ha: '{count} sabuntawa tana jiran aikawa', tw: '{count} nsɛm retwɛn ade',
  },
  'sync.pendingMany': {
    en: '{count} updates waiting to send', fr: '{count} mises à jour en attente', sw: '{count} masasisho yanasubiri kutumwa', ha: '{count} sabuntawa suna jiran aikawa', tw: '{count} nsɛm retwɛn ade',
  },
  'sync.syncNow': {
    en: 'Send Now', fr: 'Envoyer', sw: 'Tuma Sasa', ha: 'Aika Yanzu', tw: 'De kɔ seesei',
  },
  'sync.syncing': {
    en: 'Sending...', fr: 'Envoi en cours...', sw: 'Inatuma...', ha: 'Ana aikawa...', tw: 'Ɛrede...',
  },
  'sync.failedOne': {
    en: '{count} update not sent — tap to retry', fr: '{count} mise à jour non envoyée — réessayez', sw: '{count} sasishi halijatumwa — bonyeza kujaribu tena', ha: '{count} sabuntawa ba a aika ba — danna don gwadawa', tw: '{count} nsɛm ɛnkɔɛ — mia na san hwehwe',
  },
  'sync.failedMany': {
    en: '{count} updates not sent — tap to retry', fr: '{count} mises à jour non envoyées — réessayez', sw: '{count} masasisho hayajatumwa — bonyeza kujaribu tena', ha: '{count} sabuntawa ba a aika ba — danna don gwadawa', tw: '{count} nsɛm ɛnkɔɛ — mia na san hwehwe',
  },
  'sync.syncedOne': {
    en: '{count} update sent', fr: '{count} mise à jour envoyée', sw: '{count} sasishi limetumwa', ha: '{count} sabuntawa an aika', tw: '{count} nsɛm akɔ',
  },
  'sync.syncedMany': {
    en: '{count} updates sent', fr: '{count} mises à jour envoyées', sw: '{count} masasisho yametumwa', ha: '{count} sabuntawa an aika', tw: '{count} nsɛm akɔ',
  },

  // ═══════════════════════════════════════════════════════════
  //  ACCEPT INVITE
  // ═══════════════════════════════════════════════════════════

  'invite.activateAccount': {
    en: 'Activate Your Account', fr: 'Activer votre compte', sw: 'Washa Akaunti Yako', ha: 'Kunna Asusun ku', tw: 'Bue wo Akontabuo',
  },
  'invite.welcome': {
    en: 'Welcome,', fr: 'Bienvenue,', sw: 'Karibu,', ha: 'Barka,', tw: 'Akwaaba,',
  },
  'invite.profileSetUp': {
    en: 'Your farmer profile has been set up. Choose an email and password to complete your account.', fr: 'Votre profil a été créé. Choisissez un email et un mot de passe.', sw: 'Profaili yako ya mkulima imeundwa. Chagua email na nenosiri kukamilisha akaunti yako.', ha: 'An shirya bayanan ku na manomi. Zaɓi email da kalmar wucewa.', tw: 'Wɔahyehyɛ wo okuafo ho nsɛm. Yi email ne password.',
  },
  'invite.expiresOn': {
    en: 'This link expires on', fr: 'Ce lien expire le', sw: 'Kiungo hiki kinaisha tarehe', ha: 'Wannan hanyar za ta ƙare a', tw: 'Link yi bɛba awieɛ da',
  },
  'invite.yourProfile': {
    en: 'Your Profile (pre-filled by your institution)', fr: 'Votre profil (pré-rempli)', sw: 'Profaili Yako (imejazwa na taasisi yako)', ha: 'Bayanan ku (taasisi ta cika)', tw: 'Wo ho nsɛm (wo adesuafo ahyɛ ma)',
  },
  'invite.fullName': {
    en: 'Full Name', fr: 'Nom complet', sw: 'Jina Kamili', ha: 'Cikakken suna', tw: 'Din nyinaa',
  },
  'invite.phone': {
    en: 'Phone', fr: 'Téléphone', sw: 'Simu', ha: 'Waya', tw: 'Fon',
  },
  'invite.region': {
    en: 'Region', fr: 'Région', sw: 'Mkoa', ha: 'Yanki', tw: 'Mantam',
  },
  'invite.language': {
    en: 'Language', fr: 'Langue', sw: 'Lugha', ha: 'Harshe', tw: 'Kasa',
  },
  'invite.createCredentials': {
    en: 'Create Login Credentials', fr: 'Créer vos identifiants', sw: 'Tengeneza Kitambulisho', ha: 'Ƙirƙiri bayanan shiga', tw: 'Yɛ wo login nsɛm',
  },
  'invite.email': {
    en: 'Email Address', fr: 'Adresse email', sw: 'Barua pepe', ha: 'Email', tw: 'Email',
  },
  'invite.password': {
    en: 'Password', fr: 'Mot de passe', sw: 'Nenosiri', ha: 'Kalmar wucewa', tw: 'Password',
  },
  'invite.confirmPassword': {
    en: 'Confirm Password', fr: 'Confirmer le mot de passe', sw: 'Thibitisha Nenosiri', ha: 'Tabbatar da kalmar wucewa', tw: 'San kyerɛ Password',
  },
  'invite.min8chars': {
    en: 'Min 8 characters', fr: '8 caractères minimum', sw: 'Herufi 8 au zaidi', ha: 'Haruffa 8 ko fiye', tw: 'Nkyerɛwdeɛ 8 anaa ɛboro',
  },
  'invite.repeatPassword': {
    en: 'Repeat password', fr: 'Répétez le mot de passe', sw: 'Rudia nenosiri', ha: 'Sake rubuta kalmar wucewa', tw: 'San kyerɛw password',
  },
  'invite.activating': {
    en: 'Activating...', fr: 'Activation...', sw: 'Inawasha...', ha: 'Ana kunna...', tw: 'Ɛrebue...',
  },
  'invite.activate': {
    en: 'Activate Account', fr: 'Activer le compte', sw: 'Washa Akaunti', ha: 'Kunna Asusun', tw: 'Bue Akontabuo',
  },
  'invite.alreadyAccount': {
    en: 'Already have an account?', fr: 'Vous avez déjà un compte ?', sw: 'Tayari una akaunti?', ha: 'Kuna da asusu?', tw: 'Wo wɔ akontabuo dada?',
  },
  'invite.signIn': {
    en: 'Sign In', fr: 'Connexion', sw: 'Ingia', ha: 'Shiga', tw: 'Bra mu',
  },
  'invite.validating': {
    en: 'Validating your invite link...', fr: 'Validation de votre lien...', sw: 'Inathibitisha kiungo chako...', ha: 'Ana tabbatar da hanyar gayyata...', tw: 'Ɛresɔhwɛ wo link...',
  },
  'invite.connectionProblem': {
    en: 'Connection Problem', fr: 'Problème de connexion', sw: 'Tatizo la Muunganisho', ha: 'Matsalar haɗi', tw: 'Connection ɔhaw',
  },
  'invite.expired': {
    en: 'Invite Link Expired', fr: 'Lien expiré', sw: 'Kiungo Kimeisha', ha: 'Hanyar gayyata ta ƙare', tw: 'Link no aba awieɛ',
  },
  'invite.invalid': {
    en: 'Invalid Invite Link', fr: 'Lien invalide', sw: 'Kiungo Batili', ha: 'Hanyar gayyata mara inganci', tw: 'Link no nyɛ papa',
  },
  'invite.alreadyActivated': {
    en: 'Already Activated', fr: 'Déjà activé', sw: 'Tayari Imewashwa', ha: 'An riga an kunna', tw: 'Wɔabue dada',
  },
  'invite.goToLogin': {
    en: 'Go to Login', fr: 'Aller à la connexion', sw: 'Nenda Kuingia', ha: 'Je zuwa shiga', tw: 'Kɔ Login',
  },
  'invite.accountActivated': {
    en: 'Account Activated!', fr: 'Compte activé !', sw: 'Akaunti Imewashwa!', ha: 'An kunna asusun!', tw: 'Wɔabue Akontabuo!',
  },
  'invite.welcomeTo': {
    en: 'Welcome to Farroway,', fr: 'Bienvenue sur Farroway,', sw: 'Karibu Farroway,', ha: 'Barka da zuwa Farroway,', tw: 'Akwaaba Farroway,',
  },
  'invite.accountReady': {
    en: 'Your account is ready. You can now sign in with your email and password.', fr: 'Votre compte est prêt. Connectez-vous avec votre email et mot de passe.', sw: 'Akaunti yako iko tayari. Sasa unaweza kuingia kwa email na nenosiri yako.', ha: 'Asusun ku ya shirya. Yanzu za ku iya shiga da email da kalmar wucewa.', tw: 'Wo akontabuo aboa. Wobɛtumi de wo email ne password abra mu.',
  },
  'invite.whatNext': {
    en: 'What happens next:', fr: 'Prochaines étapes :', sw: 'Kinachofuata:', ha: 'Me za ya faru na gaba:', tw: 'Deɛ ɛbɛba:',
  },
  'invite.setupFarmDesc': {
    en: "After signing in you'll set up your farm profile — add your farm name, crop, and location. It takes about 2 minutes.", fr: "Après la connexion, vous configurerez votre profil — nom de ferme, culture et emplacement. Cela prend environ 2 minutes.", sw: "Baada ya kuingia utaweka profaili ya shamba lako — jina la shamba, mazao, na eneo. Inachukua dakika 2.", ha: "Bayan shiga za ku shirya bayanan gonar ku — sunan gona, amfani, da wuri. Zai ɗauki minti 2.", tw: "Wo de wo email abra mu no wobɛhyehyɛ wo afuo — din, nnɔbae, ne beae. Ɛbɛfa bɛyɛ simma 2.",
  },
  'invite.signInNow': {
    en: 'Sign In Now', fr: 'Se connecter maintenant', sw: 'Ingia Sasa', ha: 'Shiga Yanzu', tw: 'Bra Mu Seesei',
  },
  'invite.passwordMismatch': {
    en: 'Passwords do not match', fr: 'Les mots de passe ne correspondent pas', sw: 'Maneno ya siri hayalingani', ha: 'Kalmomin wucewa ba su dace ba', tw: 'Password no nyɛ pɛ',
  },
  'invite.passwordTooShort': {
    en: 'Password must be at least 8 characters', fr: 'Le mot de passe doit comporter au moins 8 caractères', sw: 'Nenosiri lazima liwe na herufi 8 au zaidi', ha: 'Kalmar wucewa dole ta kasance haruffa 8 ko fiye', tw: 'Password no bɛyɛ nkyerɛwdeɛ 8 anaa ɛboro',
  },
  'invite.takingTooLong': {
    en: 'Taking too long. Please check your connection and try again.', fr: 'Cela prend trop de temps. Vérifiez votre connexion.', sw: 'Inachukua muda mrefu. Tafadhali angalia muunganisho wako.', ha: 'Yana ɗaukar lokaci. Da fatan kallo haɗin ku.', tw: 'Ɛregyina. Yɛsrɛ wo hwɛ wo intanɛt.',
  },
  'invite.failedActivate': {
    en: 'Failed to activate account. Please try again.', fr: "Échec de l'activation. Veuillez réessayer.", sw: 'Imeshindwa kuwasha akaunti. Tafadhali jaribu tena.', ha: 'Ba a iya kunna asusun ba. Da fatan sake gwadawa.', tw: 'Enntumi anbue akontabuo. Yɛsrɛ wo san hwehwɛ.',
  },
  'invite.expiredContact': {
    en: 'This invite link has expired. Please contact your field officer or organization admin to request a new invite link.', fr: "Ce lien a expiré. Contactez votre agent ou administrateur.", sw: 'Kiungo hiki kimeisha. Tafadhali wasiliana na afisa wako kupata kiungo kipya.', ha: 'Wannan hanyar ta ƙare. Da fatan ku tuntuɓi jami\'in ku don sabuwar hanya.', tw: 'Link yi aba awieɛ. Yɛsrɛ wo ka kyerɛ wo officer na ɔmma wo link foforo.',
  },
  'invite.whatToDo': {
    en: 'What to do:', fr: 'Que faire :', sw: 'Nini cha kufanya:', ha: 'Me za a yi:', tw: 'Deɛ ɛsɛ sɛ woyɛ:',
  },

  // ═══════════════════════════════════════════════════════════
  //  OFFICER VALIDATION
  // ═══════════════════════════════════════════════════════════

  'validation.validateUpdates': {
    en: 'Validate Updates', fr: 'Valider les mises à jour', sw: 'Thibitisha Masasisho', ha: 'Tabbatar da sabuntawa', tw: 'Sɔ nsɛm mu hwɛ',
  },
  'validation.queueClear': {
    en: 'Queue Clear', fr: 'File vide', sw: 'Foleni Tupu', ha: 'Jerin aiki babu', tw: 'Nsɛm nyinaa wie',
  },
  'validation.noUpdatesNow': {
    en: 'No updates need validation right now.', fr: 'Aucune mise à jour à valider.', sw: 'Hakuna masasisho yanahitaji uthibitishaji sasa.', ha: 'Babu sabuntawa da ke buƙatar tabbatarwa yanzu.', tw: 'Nsɛm biara nhia sɔhwɛ seesei.',
  },
  'validation.refresh': {
    en: 'Refresh', fr: 'Rafraîchir', sw: 'Onyesha upya', ha: 'Sabunta', tw: 'Yɛ no foforo',
  },
  'validation.allDone': {
    en: 'All Done!', fr: 'Tout est fait !', sw: 'Yote Imekamilika!', ha: 'An gama duka!', tw: 'Wie nyinaa!',
  },
  'validation.updatesValidated': {
    en: 'updates validated.', fr: 'mises à jour validées.', sw: 'masasisho yamethibitishwa.', ha: 'sabuntawa an tabbatar.', tw: 'nsɛm a wɔasɔ mu ahwɛ.',
  },
  'validation.loadMore': {
    en: 'Load More', fr: 'Charger plus', sw: 'Pakia zaidi', ha: 'Loda ƙari', tw: 'Fa bi bra',
  },
  'validation.noPhoto': {
    en: 'No photo', fr: 'Pas de photo', sw: 'Hakuna picha', ha: 'Babu hoto', tw: 'Mfoni nni hɔ',
  },
  'validation.approve': {
    en: 'Approve', fr: 'Approuver', sw: 'Idhinisha', ha: 'Amince', tw: 'Pene so',
  },
  'validation.reject': {
    en: 'Reject', fr: 'Rejeter', sw: 'Kataa', ha: 'Ƙi', tw: 'Po',
  },
  'validation.flag': {
    en: 'Flag', fr: 'Signaler', sw: 'Weka alama', ha: 'Yi alama', tw: 'Hyɛ agyirae',
  },
  'validation.approved': {
    en: 'Approved', fr: 'Approuvé', sw: 'Imeidhinishwa', ha: 'An amince', tw: 'Wɔapene so',
  },
  'validation.rejected': {
    en: 'Rejected', fr: 'Rejeté', sw: 'Imekataliwa', ha: 'An ƙi', tw: 'Wɔapo',
  },
  'validation.flagged': {
    en: 'Flagged', fr: 'Signalé', sw: 'Imewekewa alama', ha: 'An yi alama', tw: 'Wɔahyɛ agyirae',
  },
  'validation.reasonReject': {
    en: 'Reason for rejection...', fr: 'Raison du rejet...', sw: 'Sababu ya kukataa...', ha: 'Dalilin ƙin...', tw: 'Sɛdeɛ nti a wɔapo...',
  },
  'validation.whyFlag': {
    en: 'Why are you flagging this?', fr: 'Pourquoi signalez-vous ceci ?', sw: 'Kwa nini unaweka alama?', ha: 'Me ya sa kuke yi alama?', tw: 'Adɛn nti na wohyɛ agyirae?',
  },
  'validation.prev': {
    en: 'Prev', fr: 'Préc', sw: 'Iliyopita', ha: 'Baya', tw: 'Kan',
  },
  'validation.next': {
    en: 'Next', fr: 'Suiv', sw: 'Ifuatayo', ha: 'Gaba', tw: 'Edi so',
  },
  'validation.left': {
    en: 'left', fr: 'restant', sw: 'zimebaki', ha: 'ya rage', tw: 'aka',
  },
  'validation.loading': {
    en: 'Loading validation queue...', fr: 'Chargement de la file de validation...', sw: 'Inapakia foleni ya uthibitishaji...', ha: 'Ana lodi jerin tabbatarwa...', tw: 'Nsɛm a ɛsɛ sɛ wɔhwɛ reloadi...',
  },

  // ═══════════════════════════════════════════════════════════
  //  ERROR / CONNECTION MESSAGES
  // ═══════════════════════════════════════════════════════════

  'error.loadProfile': {
    en: 'Could not load your profile. Please check your connection.', fr: 'Impossible de charger votre profil. Vérifiez votre connexion.', sw: 'Haiwezi kupakia profaili yako. Tafadhali angalia muunganisho wako.', ha: 'Ba a iya loda bayanan ku ba. Da fatan ku kalli haɗin ku.', tw: 'Enntumi anloadi wo ho nsɛm. Yɛsrɛ wo hwɛ wo intanɛt.',
  },
  'error.loadFarmData': {
    en: 'Could not load your farm data. Please check your connection and refresh.', fr: 'Impossible de charger vos données. Vérifiez votre connexion.', sw: 'Haiwezi kupakia data ya shamba lako. Angalia muunganisho na uonyeshe upya.', ha: 'Ba a iya loda bayanan gonar ku ba. Kalli haɗin ku.', tw: 'Enntumi anloadi wo afuo nsɛm. Hwɛ wo intanɛt.',
  },
  'error.createProfile': {
    en: 'Failed to create your farm profile. Please check your connection and try again.', fr: "Échec de la création du profil. Vérifiez votre connexion.", sw: 'Imeshindwa kutengeneza profaili ya shamba lako. Angalia muunganisho wako.', ha: 'Ba a iya ƙirƙiri bayanan gonar ku ba. Kalli haɗin ku.', tw: 'Enntumi anyɛ wo afuo ho nsɛm. Hwɛ wo intanɛt.',
  },
  'error.somethingWrong': {
    en: 'Something went wrong creating your profile. Please try again.', fr: "Erreur lors de la création de votre profil. Réessayez.", sw: 'Kuna tatizo kutengeneza profaili yako. Tafadhali jaribu tena.', ha: 'Wani abu ya faru yayin ƙirƙiri. Da fatan sake gwadawa.', tw: 'Biribi kɔ basaa. Yɛsrɛ wo san hwehwɛ.',
  },
  'error.photoNotUploaded': {
    en: 'Your farm was created, but the profile photo could not be uploaded. You can add it later from your profile.', fr: 'Votre ferme a été créée, mais la photo n\'a pas pu être envoyée. Vous pouvez l\'ajouter plus tard.', sw: 'Shamba lako limetengenezwa, lakini picha haiwezi kupakiwa. Unaweza kuiongeza baadaye.', ha: 'An ƙirƙiri gonar ku, amma ba a iya ɗora hoton ba. Za ku iya ƙara ta daga baya.', tw: 'Wɔayɛ wo afuo, nanso mfonini no antumi ankɔ. Wobɛtumi de aba akyire yi.',
  },

  // ═══════════════════════════════════════════════════════════
  //  PROFILE PHOTO UPLOAD
  // ═══════════════════════════════════════════════════════════

  'photo.profilePhoto': {
    en: 'Profile Photo', fr: 'Photo de profil', sw: 'Picha ya Profaili', ha: 'Hoton kai', tw: 'Mfonini',
  },
  'photo.choosePhoto': {
    en: 'Choose Photo', fr: 'Choisir une photo', sw: 'Chagua Picha', ha: 'Zaɓi Hoto', tw: 'Yi Mfonini',
  },
  'photo.chooseNew': {
    en: 'Choose New Photo', fr: 'Choisir une nouvelle photo', sw: 'Chagua Picha Mpya', ha: 'Zaɓi Sabuwar Hoto', tw: 'Yi Mfonini Foforo',
  },
  'photo.chooseDifferent': {
    en: 'Choose Different Photo', fr: 'Choisir une autre photo', sw: 'Chagua Picha Tofauti', ha: 'Zaɓi Wata Hoto', tw: 'Yi Mfonini Foforɔ',
  },
  'photo.upload': {
    en: 'Upload', fr: 'Envoyer', sw: 'Pakia', ha: 'Ɗora', tw: 'Fa bra',
  },
  'photo.uploading': {
    en: 'Uploading...', fr: 'Envoi en cours...', sw: 'Inapakia...', ha: 'Ana ɗora...', tw: 'Ɛreloadi...',
  },
  'photo.removePhoto': {
    en: 'Remove Photo', fr: 'Supprimer la photo', sw: 'Ondoa Picha', ha: 'Cire Hoto', tw: 'Yi Mfonini fi hɔ',
  },
  'photo.removing': {
    en: 'Removing...', fr: 'Suppression...', sw: 'Inaondoa...', ha: 'Ana cirewa...', tw: 'Ɛreyi fi hɔ...',
  },

  // ═══════════════════════════════════════════════════════════
  //  ONBOARDING WIZARD — JSX visible text
  // ═══════════════════════════════════════════════════════════

  'wizard.welcomeUser': {
    en: 'Welcome', fr: 'Bienvenue', sw: 'Karibu', ha: 'Barka da zuwa', tw: 'Akwaaba',
  },
  'wizard.setUpFarm': {
    en: 'Set up your farm in under a minute.\nJust tap to answer each question.', fr: 'Configurez votre ferme en moins d\'une minute.\nAppuyez pour répondre.', sw: 'Weka shamba lako kwa chini ya dakika moja.\nBonyeza kujibu kila swali.', ha: 'Shirya gonar ku cikin minti ɗaya.\nMatsa don amsa kowane tambaya.', tw: 'Hyehyɛ wo afuo wɔ simma biako mu.\nMia na bua nsɛm biara.',
  },
  'wizard.takesAbout60s': {
    en: 'Takes about 60 seconds', fr: 'Prend environ 60 secondes', sw: 'Inachukua sekunde 60 hivi', ha: 'Yana ɗaukar daƙiƙa 60', tw: 'Ɛfa bɛyɛ sɛkɛnd 60',
  },
  'wizard.getStarted': {
    en: 'Get Started', fr: 'Commencer', sw: 'Anza', ha: 'Fara', tw: 'Hyɛ ase',
  },
  'wizard.nameYourFarm': {
    en: 'Name your farm', fr: 'Nommez votre ferme', sw: 'Weka jina la shamba lako', ha: 'Ba gonar ku suna', tw: 'Ma wo afuo din',
  },
  'wizard.whatCallFarm': {
    en: 'What do you call your farm?', fr: 'Comment appelez-vous votre ferme ?', sw: 'Shamba lako unaliitaje?', ha: 'Me kuke kiran gonar ku?', tw: 'Wo afuo din de sɛn?',
  },
  'wizard.egSunriseFarm': {
    en: 'e.g. Sunrise Farm', fr: 'ex. Ferme Soleil', sw: 'mfano: Shamba la Jua', ha: 'misali: Gonar Alfijir', tw: 'sɛ Afuo Anɔpa',
  },
  'wizard.giveAName': {
    en: 'Give your farm a name', fr: 'Donnez un nom à votre ferme', sw: 'Weka jina la shamba lako', ha: 'Ba gonar ku suna', tw: 'Ma wo afuo din',
  },
  'wizard.whereAreYou': {
    en: 'Where are you?', fr: 'Où êtes-vous ?', sw: 'Uko wapi?', ha: 'Ina kuke?', tw: 'Wowɔ he?',
  },
  'wizard.searchCountry': {
    en: 'Search or scroll to find your country', fr: 'Cherchez ou faites défiler', sw: 'Tafuta au sogeza kupata nchi yako', ha: 'Nemo ko gungura don samun ƙasar ku', tw: 'Hwehwɛ anaa scroll na hu wo man',
  },
  'wizard.autoDetected': {
    en: 'Auto-detected — tap below to change', fr: 'Détecté automatiquement — appuyez pour changer', sw: 'Imegunduliwa — bonyeza kubadilisha', ha: 'An gano ta atomatik — matsa don canzawa', tw: 'Wɔahu no — mia ase ha na sesa',
  },
  'wizard.confirmOrChange': {
    en: 'We detected your location. Confirm or change it below.', fr: 'Nous avons détecté votre emplacement. Confirmez ou changez ci-dessous.', sw: 'Tumegundua mahali pako. Thibitisha au badilisha hapa chini.', ha: 'Mun gano wurin ku. Tabbatar ko canza a ƙasa.', tw: 'Yɛahu wo beaeɛ. Siesie anaa sesa no ase ha.',
  },
  'wizard.detectedViaGPS': {
    en: 'Detected via GPS', fr: 'Détecté par GPS', sw: 'Imegunduliwa kupitia GPS', ha: 'An gano ta GPS', tw: 'GPS de yɛahu',
  },
  'wizard.detectedViaNetwork': {
    en: 'Detected via network', fr: 'Détecté par réseau', sw: 'Imegunduliwa kupitia mtandao', ha: 'An gano ta hanyar sadarwa', tw: 'Network de yɛahu',
  },
  'wizard.confirmLocation': {
    en: 'Yes, this is correct', fr: 'Oui, c\'est correct', sw: 'Ndiyo, hii ni sahihi', ha: 'Ee, daidai ne', tw: 'Aane, ɛyɛ nokorɛ',
  },
  'wizard.changeLocation': {
    en: 'No, change it', fr: 'Non, changer', sw: 'Hapana, badilisha', ha: 'A\'a, canza shi', tw: 'Daabi, sesa',
  },
  'wizard.locationConfirmed': {
    en: 'Location confirmed', fr: 'Emplacement confirmé', sw: 'Mahali pamethibitishwa', ha: 'An tabbatar da wurin', tw: 'Beaeɛ adi mu dua',
  },
  'wizard.detectMyLocation': {
    en: 'Detect my location', fr: 'Détecter ma position', sw: 'Gundua mahali pangu', ha: 'Gano wurina', tw: 'Hu me beaeɛ',
  },
  'wizard.detectingLocation': {
    en: 'Finding your location...', fr: 'Recherche de votre position...', sw: 'Inatafuta mahali pako...', ha: 'Ana neman wurin ku...', tw: 'Rehwehwɛ wo beaeɛ...',
  },
  'wizard.gpsDetectFailed': {
    en: 'Could not detect location. Please select your country below.', fr: 'Impossible de détecter la position. Sélectionnez votre pays ci-dessous.', sw: 'Haikuweza kugundua mahali. Tafadhali chagua nchi yako hapa chini.', ha: 'Ba a iya gano wurin ba. Da fatan za a zaɓi ƙasar ku a ƙasa.', tw: 'Yɛantumi nhu beaeɛ no. Yɛsrɛ wo paw wo man ase ha.',
  },
  'wizard.orSelectManually': {
    en: 'Or select your country manually', fr: 'Ou sélectionnez votre pays manuellement', sw: 'Au chagua nchi yako mwenyewe', ha: 'Ko zaɓi ƙasar ku da hannu', tw: 'Anaa paw wo man wo ankasa',
  },
  'common.change': {
    en: 'Change', fr: 'Changer', sw: 'Badilisha', ha: 'Canza', tw: 'Sesa',
  },
  'wizard.typeToSearch': {
    en: 'You can type to search, or tap the dropdown to scroll', fr: 'Tapez pour chercher, ou appuyez sur le menu déroulant', sw: 'Andika kutafuta, au bonyeza orodha', ha: 'Rubuta don nema, ko matsa jerin zaɓi', tw: 'Kyerɛw na hwehwɛ, anaa mia dropdown no',
  },
  'wizard.whatDoYouGrow': {
    en: 'What do you grow?', fr: 'Que cultivez-vous ?', sw: 'Unalima nini?', ha: 'Me kuke nomawa?', tw: 'Deɛ wodu?',
  },
  'wizard.tapMainCrop': {
    en: 'Tap your main crop', fr: 'Appuyez sur votre culture principale', sw: 'Bonyeza zao lako kuu', ha: 'Matsa amfanin ku na farko', tw: 'Mia wo nnɔbae titiriw',
  },
  'wizard.otherCrop': {
    en: 'Other...', fr: 'Autre...', sw: 'Nyingine...', ha: 'Wani...', tw: 'Afoforo...',
  },
  'wizard.searchAll60': {
    en: 'Search all 60+ crops', fr: 'Chercher parmi 60+ cultures', sw: 'Tafuta mazao 60+', ha: 'Nemo amfani 60+', tw: 'Hwehwɛ nnɔbae 60+',
  },
  'wizard.backToTopCrops': {
    en: 'Back to top crops', fr: 'Retour aux cultures principales', sw: 'Rudi kwa mazao bora', ha: 'Koma ga manyan amfani', tw: 'San kɔ nnɔbae a edi kan',
  },
  'wizard.popularInArea': {
    en: 'Popular in your area', fr: 'Populaire dans votre région', sw: 'Maarufu katika eneo lako', ha: 'Shahararru a yankinku', tw: 'Ɛyɛ adwuma wɔ wo mpɔtam',
  },
  'wizard.moreCrops': {
    en: 'More crops', fr: 'Plus de cultures', sw: 'Mazao zaidi', ha: 'Ƙarin amfani', tw: 'Nnɔbae pii',
  },
  'wizard.selectCrop': {
    en: 'Select a crop', fr: 'Choisissez une culture', sw: 'Chagua zao', ha: 'Zaɓi amfani', tw: 'Yi nnɔbae bi',
  },
  'wizard.howBigFarm': {
    en: 'How big is your farm?', fr: 'Quelle est la taille de votre ferme ?', sw: 'Shamba lako ni kubwa kiasi gani?', ha: 'Gonar ku ta girma nawa?', tw: 'Wo afuo so kɛse sɛn?',
  },
  'wizard.chooseUnitThenTap': {
    en: 'Choose your unit, then tap a size or enter exact', fr: 'Choisissez votre unité, puis une taille', sw: 'Chagua kipimo, kisha bonyeza saizi', ha: 'Zaɓi ma\'aunin ku, sannan matsa girman', tw: 'Yi wo susu, na mia kɛseɛ bi',
  },
  'wizard.orEnterExact': {
    en: 'Or enter exact size:', fr: 'Ou entrez la taille exacte :', sw: 'Au weka saizi kamili:', ha: 'Ko shigar girman ainihi:', tw: 'Anaa kyerɛw kɛseɛ pɔtee:',
  },
  'wizard.hectares': {
    en: 'hectares', fr: 'hectares', sw: 'hekta', ha: 'hekta', tw: 'hekta',
  },
  'wizard.acres': {
    en: 'acres', fr: 'acres', sw: 'ekari', ha: 'eka', tw: 'eka',
  },
  'wizard.aboutYou': {
    en: 'About you', fr: 'À propos de vous', sw: 'Kuhusu wewe', ha: 'Game da ku', tw: 'Wo ho nsɛm',
  },
  'wizard.helpUnderstand': {
    en: 'This helps us understand our farmers better', fr: 'Cela nous aide à mieux comprendre nos agriculteurs', sw: 'Hii inatusaidia kuelewa wakulima wetu vizuri', ha: 'Wannan yana taimaka mu fahimci manoma mu', tw: 'Eyi boa yɛn te okuafo no ase yiye',
  },
  'wizard.yourAgeGroup': {
    en: 'Your age group', fr: 'Votre tranche d\'âge', sw: 'Kundi lako la umri', ha: 'Rukunin shekarun ku', tw: 'Wo mfeɛ kuw',
  },
  'wizard.tapAgeRange': {
    en: 'Tap your age range', fr: 'Appuyez sur votre tranche', sw: 'Bonyeza kundi lako la umri', ha: 'Matsa kewayon shekarun ku', tw: 'Mia wo mfeɛ nkyɛmu',
  },
  'wizard.farmLocation': {
    en: 'Farm location', fr: 'Emplacement de la ferme', sw: 'Eneo la shamba', ha: 'Wurin gona', tw: 'Afuo beae',
  },
  'wizard.tapDetectOrType': {
    en: 'Tap to detect or type your location', fr: 'Appuyez pour détecter ou tapez votre emplacement', sw: 'Bonyeza kugundua au andika eneo lako', ha: 'Matsa don gano ko rubuta wurin ku', tw: 'Mia na hu beae anaa kyerɛw',
  },
  'wizard.profilePhoto': {
    en: 'Profile photo', fr: 'Photo de profil', sw: 'Picha ya profaili', ha: 'Hoton kai', tw: 'Mfonini',
  },
  'wizard.optionalHelpsOfficer': {
    en: 'Optional — helps your field officer recognize you', fr: 'Facultatif — aide votre agent de terrain', sw: 'Si lazima — inamsaidia afisa wako kukutambua', ha: 'Ba dole ba — yana taimaka jami\'in ku gane ku', tw: 'Wompɛ a gyae — ɛboa wo officer hu wo',
  },
  'wizard.skipCreateFarm': {
    en: 'Skip & Create Farm', fr: 'Passer et créer la ferme', sw: 'Ruka na Utengeneze Shamba', ha: 'Tsallake ka Ƙirƙiri Gona', tw: 'Twa mu na Yɛ Afuo',
  },
  'wizard.createMyFarm': {
    en: 'Create My Farm', fr: 'Créer ma ferme', sw: 'Tengeneza Shamba Langu', ha: 'Ƙirƙiri Gonar ta', tw: 'Yɛ Me Afuo',
  },
  'wizard.settingUpFarm': {
    en: 'Setting up your farm...', fr: 'Configuration de votre ferme...', sw: 'Inaweka shamba lako...', ha: 'Ana shirya gonar ku...', tw: 'Ɛrehyehyɛ wo afuo...',
  },
  'wizard.farmCreated': {
    en: 'Farm created!', fr: 'Ferme créée !', sw: 'Shamba limetengenezwa!', ha: 'An ƙirƙiri gona!', tw: 'Wɔayɛ afuo!',
  },
  'wizard.isReady': {
    en: 'is ready.', fr: 'est prête.', sw: 'liko tayari.', ha: 'ya shirya.', tw: 'aboa.',
  },
  'wizard.willReceiveRecs': {
    en: "You'll start receiving personalised recommendations shortly.", fr: 'Vous recevrez bientôt des recommandations personnalisées.', sw: 'Utaanza kupokea mapendekezo yako hivi karibuni.', ha: 'Za ku fara samun shawarwari nan ba da jimawa ba.', tw: 'Wobɛhyɛ ase anya afotu a ɛfa wo ho ntɛm.',
  },
  'wizard.completedIn': {
    en: 'Completed in {seconds}s', fr: 'Terminé en {seconds}s', sw: 'Imekamilika kwa {seconds}s', ha: 'An gama cikin {seconds}s', tw: 'Wie wɔ {seconds}s mu',
  },
  'wizard.continueToDashboard': {
    en: 'Continue to Dashboard', fr: 'Continuer vers le tableau de bord', sw: 'Endelea kwenda Dashibodi', ha: 'Ci gaba zuwa Dashibod', tw: 'Toa so kɔ Dashboard',
  },
  'wizard.startOver': {
    en: 'Start over', fr: 'Recommencer', sw: 'Anza upya', ha: 'Fara daga farko', tw: 'Hyɛ ase foforo',
  },
  'wizard.clearAllStartOver': {
    en: 'Clear all data and start over?', fr: 'Effacer toutes les données et recommencer ?', sw: 'Futa data yote na uanze upya?', ha: 'Share dukkan bayanai ka fara daga farko?', tw: 'Pepa nsɛm nyinaa na hyɛ ase foforo?',
  },
  'wizard.yesStartOver': {
    en: 'Yes, start over', fr: 'Oui, recommencer', sw: 'Ndio, anza upya', ha: 'Eh, fara daga farko', tw: 'Aane, hyɛ ase foforo',
  },
  'wizard.draftRestored': {
    en: 'Draft restored', fr: 'Brouillon restauré', sw: 'Rasimu imerejeshwa', ha: 'An dawo da rubutun', tw: 'Wɔasan akyerɛw no aba',
  },
  'wizard.prevProgressSaved': {
    en: 'your previous progress was saved.', fr: 'votre progression précédente a été enregistrée.', sw: 'maendeleo yako ya awali yamehifadhiwa.', ha: 'an ajiye ci gaban ku na baya.', tw: 'wo nkɔso a edi kan no wɔakora.',
  },
  'wizard.dismiss': {
    en: 'Dismiss', fr: 'Fermer', sw: 'Ondoa', ha: 'Rufe', tw: 'Yi fi hɔ',
  },
  'wizard.draftSaved': {
    en: 'Draft saved', fr: 'Brouillon enregistré', sw: 'Rasimu imehifadhiwa', ha: 'An ajiye rubutu', tw: 'Wɔakora akyerɛw no',
  },
  'wizard.stepOf': {
    en: 'Step {step} of {total}', fr: 'Étape {step} sur {total}', sw: 'Hatua {step} kati ya {total}', ha: 'Mataki {step} cikin {total}', tw: 'Anammɔn {step} wɔ {total} mu',
  },
  'wizard.listen': {
    en: 'Listen', fr: 'Écouter', sw: 'Sikiliza', ha: 'Saurara', tw: 'Tie',
  },
  'wizard.takingLonger': {
    en: 'Taking longer than expected', fr: 'Prend plus de temps que prévu', sw: 'Inachukua muda zaidi', ha: 'Yana ɗaukar lokaci fiye da yadda aka zata', tw: 'Ɛregyina kyɛn sɛdeɛ na wɔn hwɛ kwan',
  },
  'wizard.dataSavedWaitOrBack': {
    en: 'Your data is saved. You can wait or go back and try again.', fr: 'Vos données sont enregistrées. Attendez ou revenez.', sw: 'Data yako imehifadhiwa. Unaweza kusubiri au urudi ujaribu tena.', ha: 'An ajiye bayanan ku. Za ku iya jira ko ku koma ku sake gwadawa.', tw: 'Wɔakora wo nsɛm. Wobɛtumi atwɛn anaa asan akɔ ahwehwɛ bio.',
  },
  'wizard.goBack': {
    en: 'Go Back', fr: 'Retour', sw: 'Rudi', ha: 'Koma', tw: 'San bra',
  },
  'wizard.pleaseComplete': {
    en: 'Please complete: {fields}. Go back to fill in missing fields.', fr: 'Veuillez compléter : {fields}. Revenez remplir les champs manquants.', sw: 'Tafadhali kamilisha: {fields}. Rudi ujaze sehemu zinazokosekana.', ha: 'Da fatan ku cika: {fields}. Ku koma ku cika wuraren da suka ɓace.', tw: 'Yɛsrɛ wo wie: {fields}. San kɔ na hyɛ nea aka no ma.',
  },

  // ═══════════════════════════════════════════════════════════
  //  EXPERIENCE LEVEL + NEW FARMER RECOMMENDATION
  // ═══════════════════════════════════════════════════════════

  'wizard.whatDescribesYou': {
    en: 'What best describes you?', fr: 'Comment vous décrivez-vous ?', sw: 'Nini kinakuelezea vizuri?', ha: 'Mene ne ya fi bayyana ku?', tw: 'Dɛn na ɛkyerɛ wo yiye?',
  },
  'wizard.experienceSubtitle': {
    en: 'This helps us guide you better.', fr: 'Cela nous aide à mieux vous guider.', sw: 'Hii inatusaidia kukuongoza vizuri.', ha: 'Wannan yana taimaka mana mu jagorance ku.', tw: 'Eyi bɛboa yɛn akyerɛ wo kwan pa.',
  },
  'wizard.imNewToFarming': {
    en: "I'm new to farming", fr: 'Je suis nouveau en agriculture', sw: 'Mimi ni mpya katika kilimo', ha: 'Sabon noma ne ni', tw: 'Meyɛ ɔfoforo wɔ adwumayɛ mu',
  },
  'wizard.imNewToFarmingDesc': {
    en: "I'd like help choosing what to grow.", fr: "J'aimerais de l'aide pour choisir quoi cultiver.", sw: 'Ningependa msaada wa kuchagua nini cha kupanda.', ha: 'Ina son taimako wajen zaɓar abinda zan noma.', tw: 'Mepɛ mmoa afa nea mɛdua ho.',
  },
  'wizard.iAlreadyFarm': {
    en: 'I already farm', fr: 'Je cultive déjà', sw: 'Tayari ninalima', ha: 'Ina noma ne', tw: 'Meyɛ adwuma dada',
  },
  'wizard.iAlreadyFarmDesc': {
    en: 'I know what I grow and want to get started.', fr: 'Je sais ce que je cultive et je veux commencer.', sw: 'Ninajua ninachopanda na nataka kuanza.', ha: 'Na san abinda nake noma kuma ina son in fara.', tw: 'Minim nea medua na mepɛ sɛ mehyɛ aseɛ.',
  },

  // ── New farmer recommendation flow ──
  'recommend.title': {
    en: 'Our suggestions for you', fr: 'Nos suggestions pour vous', sw: 'Mapendekezo yetu kwako', ha: 'Shawarwarinmu a gare ku', tw: 'Yɛn nkyerɛase ma wo',
  },
  'recommend.subtitle': {
    en: 'Based on your answers, these crops may work well for you.', fr: 'Selon vos réponses, ces cultures pourraient bien fonctionner pour vous.', sw: 'Kulingana na majibu yako, mazao haya yanaweza kukufaa.', ha: 'Bisa amsoshin ku, waɗannan amfanin gona na iya dacewa da ku.', tw: 'Sɛ wo mmuaeɛ te no, nnɔbaeɛ yi bɛyɛ adwuma ama wo.',
  },
  'recommend.bestMatch': {
    en: 'BEST MATCH', fr: 'MEILLEUR CHOIX', sw: 'BORA ZAIDI', ha: 'MAFI DACEWA', tw: 'EYƐ PAPA',
  },
  'recommend.useThisCrop': {
    en: 'Use this suggestion', fr: 'Utiliser cette suggestion', sw: 'Tumia pendekezo hili', ha: 'Yi amfani da wannan shawara', tw: 'Fa saa nkyerɛase yi di dwuma',
  },
  'recommend.chooseMyself': {
    en: 'I\'ll choose myself', fr: 'Je choisirai moi-même', sw: 'Nitachagua mwenyewe', ha: 'Zan zaɓa kaina', tw: 'Me ankasa na mɛpaw',
  },
  'recommend.skipGuide': {
    en: 'Skip this guide', fr: 'Passer ce guide', sw: 'Ruka mwongozo huu', ha: 'Tsallake wannan jagora', tw: 'Twa saa nkyerɛase yi mu',
  },
  'recommend.useThisPlan': {
    en: 'Use this plan', fr: 'Utiliser ce plan', sw: 'Tumia mpango huu', ha: 'Yi amfani da wannan shiri', tw: 'Fa nhyehyɛe yi di dwuma',
  },
  'recommend.recommendedForYou': {
    en: 'Recommended for you', fr: 'Recommandé pour vous', sw: 'Imependekezwa kwako', ha: 'An ba da shawara a gare ku', tw: 'Wɔakyerɛ wo eyi',
  },
  'recommend.alsoGoodOptions': {
    en: 'Also good options', fr: 'Aussi de bons choix', sw: 'Chaguo nzuri pia', ha: 'Zaɓuɓɓuka masu kyau kuma', tw: 'Nhyehyɛe pa bi nso',
  },
  'recommend.suggestedStartingSize': {
    en: 'Suggested starting size', fr: 'Taille de départ suggérée', sw: 'Ukubwa wa kuanza uliopendekezwa', ha: 'Girman farawa da aka ba da shawara', tw: 'Kɛseɛ a wɔkyerɛ sɛ wode hyɛ aseɛ',
  },

  // ── Structured recommendation reasons (shown as tags) ──
  'recommendReason.goalFit.home_food': {
    en: 'Feeds your family', fr: 'Nourrit votre famille', sw: 'Hulisha familia yako', ha: 'Ya ciyar da iyali', tw: 'Ɛma wo abusua aduane',
  },
  'recommendReason.goalFit.local_sales': {
    en: 'Sells at market', fr: 'Se vend au marché', sw: 'Huuzika sokoni', ha: 'Ana sayuwa a kasuwa', tw: 'Ɛtɔn wɔ dwam',
  },
  'recommendReason.goalFit.profit': {
    en: 'Good for business', fr: 'Bon pour le commerce', sw: 'Nzuri kwa biashara', ha: 'Mai kyau don kasuwanci', tw: 'Ɛyɛ papa ma adwumayɛ',
  },
  'recommendReason.sizeFit.small': {
    en: 'Works on small land', fr: 'Fonctionne sur petit terrain', sw: 'Inafaa kwa ardhi ndogo', ha: 'Ya dace da ƙaramin ƙasa', tw: 'Ɛyɛ adwuma wɔ asase ketewa so',
  },
  'recommendReason.sizeFit.medium': {
    en: 'Fits medium land', fr: 'Convient à un terrain moyen', sw: 'Inafaa ardhi ya wastani', ha: 'Ya dace da matsakaicin ƙasa', tw: 'Ɛfata asase ntam',
  },
  'recommendReason.sizeFit.large': {
    en: 'Good for large land', fr: 'Bon pour grand terrain', sw: 'Nzuri kwa ardhi kubwa', ha: 'Mai kyau don babban ƙasa', tw: 'Ɛyɛ papa ma asase kɛseɛ',
  },
  'recommendReason.budgetFit.low': {
    en: 'Low cost to start', fr: 'Faible coût de départ', sw: 'Gharama ndogo kuanza', ha: 'Ƙaramin farashi don farawa', tw: 'Ne bo nyɛ den',
  },
  'recommendReason.budgetFit.medium': {
    en: 'Moderate investment', fr: 'Investissement modéré', sw: 'Uwekezaji wa wastani', ha: 'Matsakaicin saka jari', tw: 'Sika a wobɛhyɛ mu nyɛ pii',
  },
  'recommendReason.budgetFit.high': {
    en: 'Worth the investment', fr: 'Vaut l\'investissement', sw: 'Inastahili uwekezaji', ha: 'Ya cancanta saka jari', tw: 'Ɛfata sɛ wode sika hyɛ mu',
  },
  'recommendReason.localCrop': {
    en: 'Grown in your area', fr: 'Cultivé dans votre région', sw: 'Hukuzwa eneo lako', ha: 'Ana noma shi a yankin ku', tw: 'Wɔdua no wɔ wo mpɔtam',
  },
  'recommendReason.beginnerFriendly': {
    en: 'Easy for beginners', fr: 'Facile pour débutants', sw: 'Rahisi kwa waanziaji', ha: 'Mai sauƙi ga masu farawa', tw: 'Ɛnyɛ den ma ahyɛasefoɔ',
  },
  'recommendReason.complexCrop': {
    en: 'Needs experience', fr: 'Nécessite de l\'expérience', sw: 'Inahitaji uzoefu', ha: 'Yana buƙatar kwarewa', tw: 'Ɛhia osuanfoɔ',
  },
  'recommendReason.preferredCrop': {
    en: 'Your preference', fr: 'Votre préférence', sw: 'Upendeleo wako', ha: 'Zaɓin ku', tw: 'Wo pɛsɛmenkomiadeɛ',
  },
  'recommendReason.stapleCrop': {
    en: 'Widely grown staple', fr: 'Culture de base répandue', sw: 'Zao kuu linalokuzwa sana', ha: 'Babban amfanin gona', tw: 'Nnɔbae titiriw a wɔdua no pii',
  },
  'recommendReason.startSmaller': {
    en: 'Start with a smaller area — you can expand as you learn.', fr: 'Commencez petit — vous pourrez agrandir en apprenant.', sw: 'Anza na eneo dogo — unaweza kupanua unapojifunza.', ha: 'Fara da ƙaramin ƙasa — za ku iya faɗaɗa yayin da kuke koyo.', tw: 'Hyɛ aseɛ ketewa — wobɛtumi atrɛw sɛ wosua.',
  },
  'recommendReason.homeFoodSmall': {
    en: 'A small plot is plenty to feed your family.', fr: 'Un petit terrain suffit pour nourrir votre famille.', sw: 'Shamba dogo linatosha kulisha familia yako.', ha: 'Ƙaramin gona ya isa don ciyar da iyali.', tw: 'Asase ketewa bɛso ama wo abusua.',
  },
  'recommendReason.matchesYourLand': {
    en: 'Matches the land you have.', fr: 'Correspond à votre terrain.', sw: 'Inalingana na ardhi yako.', ha: 'Ya dace da ƙasar ku.', tw: 'Ɛne wo asase hyia.',
  },
  'recommendReason.goodSeason': {
    en: 'Good time to plant', fr: 'Bon moment pour planter', sw: 'Wakati mzuri wa kupanda', ha: 'Lokaci mai kyau don shuka', tw: 'Bere pa sɛ wobɛdua',
  },
  'recommendReason.poorSeason': {
    en: 'Not the best time to plant', fr: 'Pas le meilleur moment', sw: 'Si wakati bora wa kupanda', ha: 'Ba lokacin da ya fi dacewa ba', tw: 'Ɛnyɛ bere pa sɛ wobɛdua',
  },

  // ── Season & profit guidance ──
  'seasonGuide.timingLabel': {
    en: 'Season timing', fr: 'Saison', sw: 'Msimu', ha: 'Yanayi', tw: 'Bere',
  },
  'seasonGuide.goodTimeHighProfit': {
    en: 'Good time to start this crop — strong profit potential this season.', fr: 'Bon moment pour cette culture — fort potentiel de profit cette saison.', sw: 'Wakati mzuri wa kuanza zao hili — uwezekano mkubwa wa faida msimu huu.', ha: 'Lokaci mai kyau don wannan amfanin gona — babban damar riba wannan yanayi.', tw: 'Bere pa sɛ wobɛhyɛ aseɛ — mfaso kɛseɛ wɔ saa bere yi.',
  },
  'seasonGuide.goodTimeMediumProfit': {
    en: 'Good time to plant — moderate chance of profit if managed well.', fr: 'Bon moment pour planter — chance modérée de profit avec bonne gestion.', sw: 'Wakati mzuri wa kupanda — nafasi ya wastani ya faida ukisimamiwa vizuri.', ha: 'Lokaci mai kyau don shuka — matsakaicin damar riba idan aka kula da shi.', tw: 'Bere pa sɛ wobɛdua — mfaso kakra bi sɛ woyɛ no yiye.',
  },
  'seasonGuide.goodTimeLowProfit': {
    en: 'Good time to plant — mostly for food, not a strong profit crop right now.', fr: 'Bon moment pour planter — surtout pour l\'alimentation, pas très rentable.', sw: 'Wakati mzuri wa kupanda — zaidi kwa chakula, si zao la faida sana sasa.', ha: 'Lokaci mai kyau don shuka — mafi yawa don abinci, ba amfanin gona mai riba sosai ba.', tw: 'Bere pa sɛ wobɛdua — ɛyɛ papa ma aduane, ɛnyɛ mfaso kɛseɛ seesei.',
  },
  'seasonGuide.okayTimeSomeProfit': {
    en: 'You can still plant now, but it is not the ideal season — moderate chance of success.', fr: 'Vous pouvez planter maintenant, mais ce n\'est pas la saison idéale.', sw: 'Unaweza kupanda sasa, lakini si msimu bora — nafasi ya wastani.', ha: 'Har yanzu za ku iya shuka, amma ba lokacin da ya fi dacewa ba.', tw: 'Wobɛtumi adua seesei, nanso ɛnyɛ bere a ɛfata paa.',
  },
  'seasonGuide.okayTimeLowProfit': {
    en: 'Planting now is possible but not ideal — profit may be limited. Consider alternatives below.', fr: 'Planter maintenant est possible mais pas idéal — le profit pourrait être limité.', sw: 'Kupanda sasa kunawezekana lakini si bora — faida inaweza kuwa ndogo.', ha: 'Shuka yanzu yana yiwuwa amma ba mafi kyau ba — riba na iya zama ƙarama.', tw: 'Wobɛtumi adua seesei nanso ɛnyɛ papa — mfaso bɛyɛ ketewa.',
  },
  'seasonGuide.poorTime': {
    en: 'Not the best time for this crop — better options may be available now.', fr: 'Pas le meilleur moment pour cette culture — de meilleures options existent.', sw: 'Si wakati bora kwa zao hili — chaguo bora zinaweza kupatikana sasa.', ha: 'Ba lokacin da ya fi dacewa ba don wannan amfanin gona.', tw: 'Ɛnyɛ bere pa ma nnɔbae yi — nhyehyɛe pa bi wɔ hɔ seesei.',
  },
  'seasonGuide.poorTimeNewFarmer': {
    en: 'Not the best time to start this crop. As a new farmer, starting with a well-timed crop gives you the best chance. Try one of these instead.', fr: 'Pas le meilleur moment pour commencer cette culture. En tant que nouveau fermier, choisir une culture bien synchronisée vous donne les meilleures chances.', sw: 'Si wakati bora wa kuanza zao hili. Kama mkulima mpya, kuanza na zao lenye msimu mzuri kunakupa nafasi bora.', ha: 'Ba lokacin da ya fi dacewa ba don fara wannan amfanin gona. A matsayin sabon manomi, fara da amfanin gona a lokacin da ya dace.', tw: 'Ɛnyɛ bere pa sɛ wobɛhyɛ aseɛ dua nnɔbae yi. Sɛ woyɛ okuafoɔ foforɔ a, hyɛ aseɛ dua nnɔbae a ɛbere fata.',
  },
  'seasonGuide.betterNow': {
    en: 'Better options for now:', fr: 'Meilleures options actuelles :', sw: 'Chaguo bora kwa sasa:', ha: 'Mafi kyawun zaɓuɓɓuka a yanzu:', tw: 'Nhyehyɛe pa a ɛwɔ hɔ seesei:',
  },
  'seasonGuide.fit.good': {
    en: 'Good timing', fr: 'Bon timing', sw: 'Wakati mzuri', ha: 'Lokaci mai kyau', tw: 'Bere pa',
  },
  'seasonGuide.fit.okay': {
    en: 'Moderate timing', fr: 'Timing moyen', sw: 'Wakati wa wastani', ha: 'Matsakaicin lokaci', tw: 'Bere a ɛfata kakra',
  },
  'seasonGuide.fit.poor': {
    en: 'Poor timing', fr: 'Mauvais timing', sw: 'Wakati mbaya', ha: 'Lokaci mara kyau', tw: 'Bere a ɛnfata',
  },
  'seasonGuide.profit.high': {
    en: 'High profit potential', fr: 'Fort potentiel de profit', sw: 'Faida kubwa', ha: 'Babban damar riba', tw: 'Mfaso kɛseɛ',
  },
  'seasonGuide.profit.medium': {
    en: 'Moderate profit', fr: 'Profit modéré', sw: 'Faida ya wastani', ha: 'Matsakaicin riba', tw: 'Mfaso kakra',
  },
  'seasonGuide.profit.low': {
    en: 'Low profit', fr: 'Faible profit', sw: 'Faida ndogo', ha: 'Ƙaramin riba', tw: 'Mfaso ketewa',
  },
  'seasonGuide.risk.low': {
    en: 'Low risk', fr: 'Risque faible', sw: 'Hatari ndogo', ha: 'Ƙaramin haɗari', tw: 'Asiane ketewa',
  },
  'seasonGuide.risk.medium': {
    en: 'Medium risk', fr: 'Risque moyen', sw: 'Hatari ya wastani', ha: 'Matsakaicin haɗari', tw: 'Asiane ntam',
  },
  'seasonGuide.risk.high': {
    en: 'High risk', fr: 'Risque élevé', sw: 'Hatari kubwa', ha: 'Babban haɗari', tw: 'Asiane kɛseɛ',
  },

  'recommend.suggestedSize': {
    en: 'Suggested starting size: {size}', fr: 'Taille de départ suggérée : {size}', sw: 'Ukubwa wa kuanza uliopendekezwa: {size}', ha: 'Girman farawa da aka ba da shawara: {size}', tw: 'Kɛseɛ a wɔkyerɛ sɛ wode hyɛ aseɛ: {size}',
  },
  'recommend.size.small': {
    en: 'Small (under 2 acres)', fr: 'Petit (moins de 2 acres)', sw: 'Ndogo (chini ya ekari 2)', ha: 'Ƙarami (ƙasa da eka 2)', tw: 'Ketewa (anka 2 ase)',
  },
  'recommend.size.medium': {
    en: 'Medium (2–10 acres)', fr: 'Moyen (2–10 acres)', sw: 'Wastani (ekari 2–10)', ha: 'Matsakaici (eka 2–10)', tw: 'Ntam (anka 2–10)',
  },
  'recommend.size.large': {
    en: 'Large (over 10 acres)', fr: 'Grand (plus de 10 acres)', sw: 'Kubwa (zaidi ya ekari 10)', ha: 'Babba (fiye da eka 10)', tw: 'Kɛseɛ (boro anka 10)',
  },

  // ── Recommendation questions ──
  'recommend.q.goal': {
    en: 'What is your farming goal?', fr: 'Quel est votre objectif ?', sw: 'Lengo lako la kilimo ni nini?', ha: 'Menene burin noman ku?', tw: 'Dɛn ne wo adwumayɛ botaeɛ?',
  },
  'recommend.q.goalHint': {
    en: 'This helps us suggest the right crop.', fr: 'Cela nous aide à suggérer la bonne culture.', sw: 'Hii inatusaidia kupendekeza zao sahihi.', ha: 'Wannan yana taimaka mana mu ba da shawarar amfanin gona daidai.', tw: 'Eyi boa yɛn kyerɛ nnɔbae a ɛfata.',
  },
  'recommend.q.landSize': {
    en: 'How much land do you have?', fr: 'Quelle surface avez-vous ?', sw: 'Una ardhi kiasi gani?', ha: 'Ƙasa nawa kuke da shi?', tw: 'Asase dodoɔ bɛn na wowɔ?',
  },
  'recommend.q.landSizeHint': {
    en: 'A rough estimate is fine.', fr: 'Une estimation approximative suffit.', sw: 'Makadirio ya takriban ni sawa.', ha: 'Ƙiyasin kusan ya isa.', tw: 'Nsusuwii bɛyɛ adwuma.',
  },
  'recommend.q.budget': {
    en: 'What is your budget level?', fr: 'Quel est votre budget ?', sw: 'Kiwango chako cha bajeti ni kipi?', ha: 'Menene matakin kasafin kuɗin ku?', tw: 'Wo sika dodoɔ bɛn?',
  },
  'recommend.q.budgetHint': {
    en: 'How much can you invest to start?', fr: 'Combien pouvez-vous investir pour commencer ?', sw: 'Unaweza kuwekeza kiasi gani kuanza?', ha: 'Nawa za ku iya saka jari don farawa?', tw: 'Sika dodoɔ bɛn na wobɛtumi de ahyɛ aseɛ?',
  },
  'recommend.q.preferredCrop': {
    en: 'Do you have a crop in mind?', fr: 'Avez-vous une culture en tête ?', sw: 'Una zao lolote akilini?', ha: 'Kuna da wani amfanin gona a cikin hankali?', tw: 'Wowɔ nnɔbae bi a ɛwɔ wo tirim?',
  },
  'recommend.q.preferredCropHint': {
    en: 'If not sure, tap "No preference" and we\'ll suggest one.', fr: 'Si pas sûr, tapez « Pas de préférence » et nous en suggérerons une.', sw: 'Ikiwa hujui, gusa "Hakuna upendeleo" na tutapendekeza.', ha: 'Idan ba ku da tabbas, danna "Babu zaɓi" mu ba da shawara.', tw: 'Sɛ wonnim a, mia "Mempɛ bi" na yɛbɛkyerɛ wo bi.',
  },

  // ── Recommendation option labels ──
  'recommend.opt.goal.home_food': {
    en: 'Grow food for my family', fr: 'Cultiver pour nourrir ma famille', sw: 'Kulima chakula kwa familia', ha: 'Noma abinci don iyali na', tw: 'Dua aduane ma me abusua',
  },
  'recommend.opt.goal.local_sales': {
    en: 'Sell at local market', fr: 'Vendre au marché local', sw: 'Kuuza sokoni', ha: 'Sayar a kasuwa', tw: 'Tɔn wɔ dwam hɔ',
  },
  'recommend.opt.goal.profit': {
    en: 'Build a farming business', fr: 'Créer une entreprise agricole', sw: 'Kujenga biashara ya kilimo', ha: 'Gina harkar noma', tw: 'Si adwumayɛ adwuma',
  },
  'recommend.opt.landSize.small': {
    en: 'Small (under 2 acres)', fr: 'Petit (moins de 2 acres)', sw: 'Ndogo (chini ya ekari 2)', ha: 'Ƙarami (ƙasa da eka 2)', tw: 'Ketewa (anka 2 ase)',
  },
  'recommend.opt.landSize.medium': {
    en: 'Medium (2–10 acres)', fr: 'Moyen (2–10 acres)', sw: 'Wastani (ekari 2–10)', ha: 'Matsakaici (eka 2–10)', tw: 'Ntam (anka 2–10)',
  },
  'recommend.opt.landSize.large': {
    en: 'Large (over 10 acres)', fr: 'Grand (plus de 10 acres)', sw: 'Kubwa (zaidi ya ekari 10)', ha: 'Babba (fiye da eka 10)', tw: 'Kɛseɛ (boro anka 10)',
  },
  'recommend.opt.budget.low': {
    en: 'Low budget', fr: 'Petit budget', sw: 'Bajeti ndogo', ha: 'Ƙaramin kasafi', tw: 'Sika kakra',
  },
  'recommend.opt.budget.medium': {
    en: 'Some to invest', fr: 'Un peu à investir', sw: 'Kiasi cha kuwekeza', ha: 'Wani abu don saka jari', tw: 'Sika kakra bi a wode bɛhyɛ mu',
  },
  'recommend.opt.budget.high': {
    en: 'Ready to invest', fr: 'Prêt à investir', sw: 'Tayari kuwekeza', ha: 'A shirye don saka jari', tw: 'Sika wɔ hɔ a wode bɛhyɛ mu',
  },
  'recommend.opt.preferredCrop.none': {
    en: 'No preference — suggest for me', fr: 'Pas de préférence — suggérez-moi', sw: 'Hakuna upendeleo — nipendekezee', ha: 'Babu zaɓi — ba ni shawara', tw: 'Mempɛ bi — kyerɛ me bi',
  },
  'recommend.opt.preferredCrop.MAIZE': {
    en: 'Maize / Corn', fr: 'Maïs', sw: 'Mahindi', ha: 'Masara', tw: 'Aburoɔ',
  },
  'recommend.opt.preferredCrop.BEAN': {
    en: 'Beans', fr: 'Haricots', sw: 'Maharage', ha: 'Wake', tw: 'Abɔso',
  },
  'recommend.opt.preferredCrop.CASSAVA': {
    en: 'Cassava', fr: 'Manioc', sw: 'Muhogo', ha: 'Rogo', tw: 'Bankye',
  },
  'recommend.opt.preferredCrop.TOMATO': {
    en: 'Tomato', fr: 'Tomate', sw: 'Nyanya', ha: 'Tumatir', tw: 'Ntomato',
  },
  'recommend.opt.preferredCrop.RICE': {
    en: 'Rice', fr: 'Riz', sw: 'Mchele', ha: 'Shinkafa', tw: 'Ɛmo',
  },

  // ── Crop recommendation reasons ──
  'recommend.whyMaize': {
    en: 'Easy to grow, feeds your family, and sells well at local markets.', fr: 'Facile à cultiver, nourrit votre famille et se vend bien au marché.', sw: 'Rahisi kupanda, hulisha familia yako, na huuzika vizuri sokoni.', ha: 'Sauki a noma, ya ciyar da iyali, kuma yana sayuwa a kasuwa.', tw: 'Ɛnyɛ den sɛ wobɛdua, ɛma wo abusua aduane, na ɛtɔn yiye wɔ dwam.',
  },
  'recommend.whyBean': {
    en: 'Grows fast, enriches soil, and pairs well with maize.', fr: 'Pousse vite, enrichit le sol et s\'associe bien au maïs.', sw: 'Inakua haraka, inaboresha udongo, na inafanya vizuri na mahindi.', ha: 'Yana girma cikin sauri, yana ƙara wa ƙasa albarka, kuma yana tafiya da masara.', tw: 'Ɛnyin ntɛm, ɛma asase mu yɛ, na ɛne aburoɔ yɛ adwuma.',
  },
  'recommend.whyCassava': {
    en: 'Very hardy, low cost, and grows even in poor soil.', fr: 'Très résistant, faible coût, et pousse même dans un sol pauvre.', sw: 'Sugu sana, gharama ndogo, na hukua hata kwenye udongo duni.', ha: 'Mai ƙarfin juriya, ƙaramin farashi, kuma yana girma ko a ƙasa mara albarka.', tw: 'Ɛyɛ den, ne bo nyɛ den, na ɛfifi wɔ asase bɔne so mpo.',
  },
  'recommend.whyTomato': {
    en: 'High market value — great for earning income if you have water access.', fr: 'Grande valeur marchande — idéal pour les revenus si vous avez accès à l\'eau.', sw: 'Thamani kubwa sokoni — nzuri kwa mapato ikiwa una maji.', ha: 'Yana da daraja a kasuwa — mai kyau don samun kuɗi idan kuna da ruwa.', tw: 'Ne boɔ yɛ kɛse wɔ dwam — ɛyɛ papa ma sika sɛ wowɔ nsuo.',
  },
  'recommend.whyRice': {
    en: 'Staple crop with steady demand — needs medium land and some water.', fr: 'Culture de base avec demande stable — nécessite un terrain moyen et de l\'eau.', sw: 'Zao kuu lenye mahitaji thabiti — linahitaji ardhi ya wastani na maji.', ha: 'Babban amfanin gona mai buƙata kullum — yana buƙatar matsakaicin ƙasa da ruwa.', tw: 'Nnɔbae titiriw a na ɛho hia daa — ɛhia asase ntam ne nsuo.',
  },
  'recommend.whyGroundnut': {
    en: 'Low maintenance, enriches soil, and easy to sell.', fr: 'Peu d\'entretien, enrichit le sol et facile à vendre.', sw: 'Matunzo kidogo, inaboresha udongo, na rahisi kuuza.', ha: 'Ƙaramin kulawa, yana ƙara wa ƙasa albarka, kuma mai sauƙin sayarwa.', tw: 'Ɛnhia nhwɛso pii, ɛma asase mu yɛ, na ɛtɔn nyɛ den.',
  },
  'recommend.whySweetPotato': {
    en: 'Grows quickly on small land, nutritious, and drought-tolerant.', fr: 'Pousse vite sur petit terrain, nutritif et résistant à la sécheresse.', sw: 'Inakua haraka kwenye ardhi ndogo, yenye lishe, na hustahimili ukame.', ha: 'Yana girma cikin sauri a ƙaramin ƙasa, mai gina jiki, kuma yana jure fari.', tw: 'Ɛnyin ntɛm wɔ asase ketewa so, aduane pa, na ɔpɛ nsuo kakra.',
  },
  'recommend.whySorghum': {
    en: 'Drought-resistant and great for drier regions.', fr: 'Résistant à la sécheresse et idéal pour les régions sèches.', sw: 'Hustahimili ukame na nzuri kwa maeneo kavu.', ha: 'Yana jure fari kuma mai kyau ga yankunan bushe-bushe.', tw: 'Ɔgyina ɔpɛ nsuo kakra mu na ɛyɛ papa ma nwowɔ a ɛyɛ hyew.',
  },
  'recommend.whyMillet': {
    en: 'Very hardy, grows well in poor soils with little rain.', fr: 'Très résistant, pousse bien en sols pauvres avec peu de pluie.', sw: 'Imara sana, hustawi katika udongo duni na mvua kidogo.', ha: 'Mai ƙarfi sosai, yana girma da kyau a ƙasa marar haihuwa.', tw: 'Ɛyɛ den, ɛfifi yiye wɔ asase bɔne so.',
  },
  'recommend.whyCowpea': {
    en: 'Fast-growing, fixes nitrogen, and the leaves are edible too.', fr: 'Croissance rapide, fixe l\'azote et les feuilles sont comestibles.', sw: 'Hukua haraka, hurekebisha nitrojeni, na majani yake yanaliwa.', ha: 'Yana girma da sauri, yana gyara ƙasa.', tw: 'Ɛnyini ntɛm, ɛma asase mu yɛ papa.',
  },
  'recommend.whyYam': {
    en: 'Staple food with good market demand — stores well after harvest.', fr: 'Aliment de base avec bonne demande — se conserve bien.', sw: 'Chakula kikuu chenye soko nzuri — huhifadhika vizuri.', ha: 'Abincin yau da kullun mai kyakkyawan kasuwa.', tw: 'Aduane titire a ɛwɔ aguadi so yiye.',
  },
  'recommend.whyPlantain': {
    en: 'Grows year-round, great for food and local sales.', fr: 'Pousse toute l\'année, idéal pour l\'alimentation et la vente locale.', sw: 'Hustawi mwaka mzima, nzuri kwa chakula na mauzo ya ndani.', ha: 'Yana girma duk shekara, mai kyau don abinci da siyarwa.', tw: 'Ɛfifi afe nyinaa, ɛyɛ papa ma aduane ne aguadi.',
  },
  'recommend.whyBanana': {
    en: 'Easy to grow, provides food and income throughout the year.', fr: 'Facile à cultiver, fournit nourriture et revenu toute l\'année.', sw: 'Rahisi kukuza, hutoa chakula na mapato mwaka mzima.', ha: 'Mai sauƙin shuka, yana ba da abinci da kuɗi.', tw: 'Ɛyɛ mmerɛ sɛ wobɛdua, ɛma aduane ne sika.',
  },
  'recommend.whyOkra': {
    en: 'Quick harvest, easy to grow, popular in local markets.', fr: 'Récolte rapide, facile à cultiver, populaire sur les marchés.', sw: 'Mavuno ya haraka, rahisi kukuza, maarufu sokoni.', ha: 'Girbi mai sauri, mai sauƙin noma, shahararru a kasuwa.', tw: 'Wotwa no ntɛm, na ɛyɛ mmerɛ sɛ wobɛyɛ.',
  },
  'recommend.whyPepper': {
    en: 'High demand, can sell fresh or dried for extra income.', fr: 'Forte demande, se vend frais ou séché.', sw: 'Mahitaji makubwa, unaweza kuuza mbichi au kavu.', ha: 'Buƙata mai yawa, za a iya siyar da shi danshe ko bushe.', tw: 'Atɔ no ntɛm, wobɛtɔn no mmerɛ anaa awɔ.',
  },
  'recommend.whyOnion': {
    en: 'Stores well and sells at good prices year-round.', fr: 'Se conserve bien et se vend à bon prix toute l\'année.', sw: 'Huhifadhika vizuri na huuzwa bei nzuri.', ha: 'Yana ajiye da kyau kuma ana siyar da shi da kyau.', tw: 'Ɛkora yiye na wobɛtɔn no bo pa.',
  },
  'recommend.whyPotato': {
    en: 'High yields and strong market demand in highland areas.', fr: 'Rendements élevés et forte demande en zones d\'altitude.', sw: 'Mazao mengi na soko nzuri katika maeneo ya milima.', ha: 'Amfani mai yawa da buƙata mai kyau a manyan wurare.', tw: 'Ɛma nnɔbae pii na aguadi mu ɛyɛ papa.',
  },
  'recommend.whyCabbage': {
    en: 'Popular vegetable, grows well in cooler conditions.', fr: 'Légume populaire, pousse bien en conditions fraîches.', sw: 'Mboga maarufu, hustawi vizuri katika hali ya baridi.', ha: 'Kayan lambu shahararru, yana girma da kyau a sanyi.', tw: 'Ɛyɛ mfifideɛ a ɛyɛ adwuma wɔ awia mu.',
  },
  'recommend.whyKale': {
    en: 'Fast-growing leafy green, great for home use and local sales.', fr: 'Légume-feuille à croissance rapide.', sw: 'Mboga ya majani inayokua haraka, nzuri kwa matumizi ya nyumbani.', ha: 'Ganyen kayan lambu mai girma da sauri.', tw: 'Ɛfifi ntɛm, ɛyɛ papa ma fie ne aguadi.',
  },
  'recommend.whyMango': {
    en: 'Low maintenance fruit tree with strong local demand.', fr: 'Arbre fruitier facile avec forte demande locale.', sw: 'Mti wa matunda rahisi na mahitaji makubwa.', ha: 'Itacen \'ya\'ya mai sauƙin kulawa da buƙata mai yawa.', tw: 'Ɛyɛ mmerɛ sɛ wobɛhwɛ no na ɛwɔ aguadi.',
  },
  'recommend.whyWheat': {
    en: 'Good returns in highland areas with reliable rainfall.', fr: 'Bons rendements en altitude avec pluies fiables.', sw: 'Faida nzuri katika maeneo ya milima yenye mvua za uhakika.', ha: 'Riba mai kyau a manyan wurare masu ruwan sama.', tw: 'Ɛma mfaso pa wɔ mmepɔw so.',
  },

  // ═══════════════════════════════════════════════════════════
  //  FARMER PROGRESS TAB
  // ═══════════════════════════════════════════════════════════

  'progress.loading': {
    en: 'Loading progress...', fr: 'Chargement...', sw: 'Inapakia maendeleo...', ha: 'Ana lodi ci gaba...', tw: 'Nkɔso reloadi...',
  },
  'progress.noActiveSeason': {
    en: 'No Active Season', fr: 'Pas de saison active', sw: 'Hakuna Msimu Hai', ha: 'Babu lokaci aiki', tw: 'Bere biara nni hɔ',
  },
  'progress.startNewSeasonDesc': {
    en: 'Start a new farming season to begin tracking your progress, activities, and harvest.', fr: 'Commencez une nouvelle saison pour suivre vos progrès, activités et récoltes.', sw: 'Anza msimu mpya wa kilimo kufuatilia maendeleo, shughuli, na mavuno yako.', ha: 'Fara sabon lokacin noma don bibiyar ci gaba, ayyuka, da girbi.', tw: 'Hyɛ bere foforo ase na hua wo nkɔso, adwuma, ne otwa.',
  },
  'progress.setupRequired': {
    en: 'Setup Required', fr: 'Configuration requise', sw: 'Usanidi Unahitajika', ha: 'Ana Buƙatar Saitin', tw: 'Setup Hia',
  },
  'progress.completeSetupFirst': {
    en: 'Complete your farm profile before starting a season.', fr: 'Complétez votre profil de ferme avant de commencer une saison.', sw: 'Kamilisha wasifu wa shamba lako kabla ya kuanza msimu.', ha: 'Kammala bayanan gonar ka kafin fara lokaci.', tw: 'Wie wo mfuw ho nsɛm ansa na woahyɛ bere foforo ase.',
  },
  'progress.startNewSeason': {
    en: 'Start New Season', fr: 'Nouvelle saison', sw: 'Anza Msimu Mpya', ha: 'Fara Sabon Lokaci', tw: 'Hyɛ Bere Foforo ase',
  },
  'progress.newSeasonSetup': {
    en: 'New Season Setup', fr: 'Nouvelle saison', sw: 'Usanidi wa Msimu Mpya', ha: 'Shirya Sabon Lokaci', tw: 'Bere Foforo Setup',
  },
  'progress.prefilledFromLast': {
    en: 'Prefilled from your last season — please review before submitting.', fr: 'Pré-rempli depuis votre dernière saison — vérifiez avant de soumettre.', sw: 'Imejazwa kutoka msimu wako uliopita — tafadhali kagua kabla ya kuwasilisha.', ha: 'An cika daga lokacin ku na ƙarshe — da fatan ku sake duba kafin aikawa.', tw: 'Wɔahyɛ mu fi wo bere a atwam no mu — yɛsrɛ wo hwɛ ansa na woafa ama.',
  },
  'progress.cropType': {
    en: 'Crop Type', fr: 'Type de culture', sw: 'Aina ya Mazao', ha: 'Irin Amfani', tw: 'Nnɔbae Mu',
  },
  'progress.farmSize': {
    en: 'Farm Size', fr: 'Taille de la ferme', sw: 'Ukubwa wa Shamba', ha: 'Girman Gona', tw: 'Afuo Kɛseɛ',
  },
  'progress.plantingDate': {
    en: 'Planting Date', fr: 'Date de plantation', sw: 'Tarehe ya Kupanda', ha: 'Ranar Shuka', tw: 'Dua Da',
  },
  'progress.seedType': {
    en: 'Seed Type', fr: 'Type de semence', sw: 'Aina ya Mbegu', ha: 'Irin Iri', tw: 'Aba Mu',
  },
  'progress.seedQuantity': {
    en: 'Seed Quantity (kg)', fr: 'Quantité de semences (kg)', sw: 'Kiasi cha Mbegu (kg)', ha: 'Yawan Iri (kg)', tw: 'Aba Dodow (kg)',
  },
  'progress.plantingIntent': {
    en: 'What I am planting this season', fr: 'Ce que je plante cette saison', sw: 'Ninachopanda msimu huu', ha: 'Abin da nake shuka wannan lokaci', tw: 'Deɛ medu bere yi',
  },
  'progress.startSeason': {
    en: 'Start Season', fr: 'Commencer', sw: 'Anza Msimu', ha: 'Fara Lokaci', tw: 'Hyɛ Bere ase',
  },
  'progress.season': {
    en: 'Season:', fr: 'Saison :', sw: 'Msimu:', ha: 'Lokaci:', tw: 'Bere:',
  },
  'progress.planted': {
    en: 'Planted', fr: 'Planté', sw: 'Ilipandwa', ha: 'An shuka', tw: 'Wɔaduae',
  },
  'progress.expectedHarvest': {
    en: 'Expected Harvest', fr: 'Récolte prévue', sw: 'Mavuno Yanayotarajiwa', ha: 'Girbin da Ake Tsammani', tw: 'Otwa a Wɔhwɛ Kwan',
  },
  'progress.progressEntries': {
    en: 'Progress Entries', fr: 'Entrées de progrès', sw: 'Maingizo ya Maendeleo', ha: 'Shigar Ci Gaba', tw: 'Nkɔso Nsɛm',
  },
  'progress.submitted': {
    en: 'Submitted', fr: 'Soumis', sw: 'Imewasilishwa', ha: 'An aika', tw: 'Wɔafa ama',
  },
  'progress.noEntriesYet': {
    en: 'No entries yet', fr: 'Pas encore d\'entrées', sw: 'Hakuna maingizo bado', ha: 'Babu shigarwa tukuna', tw: 'Nsɛm biara mmaeɛ da',
  },
  'progress.growthStage': {
    en: 'Growth Stage', fr: 'Étape de croissance', sw: 'Hatua ya Ukuaji', ha: 'Mataki Girma', tw: 'Nyin Anammɔn',
  },
  'progress.expected': {
    en: 'Expected:', fr: 'Prévu :', sw: 'Inatarajiwa:', ha: 'Ake tsammani:', tw: 'Wɔhwɛ kwan:',
  },
  'progress.actual': {
    en: 'Actual:', fr: 'Réel :', sw: 'Halisi:', ha: 'Na gaske:', tw: 'Ankasa:',
  },
  'progress.doesFarmLookLike': {
    en: 'Does your farm look like it is at the', fr: 'Votre ferme ressemble-t-elle à', sw: 'Je, shamba lako linaonekana kama liko hatua ya', ha: 'Shin gonar ku tana kama tana mataki', tw: 'Wo afuo te sɛ ɛwɔ',
  },
  'progress.confirmStage': {
    en: 'Confirm Stage', fr: 'Confirmer étape', sw: 'Thibitisha Hatua', ha: 'Tabbatar da Mataki', tw: 'Si Anammɔn mu dua',
  },
  'progress.dataQuality': {
    en: 'Data Quality:', fr: 'Qualité des données :', sw: 'Ubora wa Data:', ha: 'Ingancin Bayanai:', tw: 'Nsɛm Papa:',
  },
  'progress.strong': {
    en: 'Strong', fr: 'Bon', sw: 'Imara', ha: 'Mai ƙarfi', tw: 'Ɛyɛ den',
  },
  'progress.moderate': {
    en: 'Moderate', fr: 'Moyen', sw: 'Wastani', ha: 'Matsakaici', tw: 'Ntam',
  },
  'progress.needsAttention': {
    en: 'Needs Attention', fr: 'Attention requise', sw: 'Inahitaji Umakini', ha: 'Yana Buƙatar Kulawa', tw: 'Ɛhia Animdwuma',
  },
  'progress.howConsistent': {
    en: 'how consistent and complete your farm records look', fr: 'la cohérence et la complétude de vos données', sw: 'jinsi rekodi za shamba lako zinavyoonekana kamili', ha: 'yadda bayanan gonar ku ke cikakke', tw: 'sɛdeɛ wo afuo nsɛm yɛ pɛ',
  },
  'progress.itemsToReview': {
    en: '{count} item{s} to review', fr: '{count} élément{s} à vérifier', sw: '{count} kipengele{s} cha kukagua', ha: '{count} abu{s} don dubawa', tw: '{count} ade{s} a ɛsɛ sɛ wɔhwɛ',
  },
  'progress.tipImprove': {
    en: 'Tip: Log activities regularly, confirm your growth stage, and add photos to improve your data quality score.', fr: 'Conseil : Notez vos activités régulièrement pour améliorer votre score.', sw: 'Kidokezo: Andika shughuli mara kwa mara, thibitisha hatua ya ukuaji, na ongeza picha.', ha: 'Shawara: Rubuta ayyuka a kai a kai, tabbatar da mataki girma, ka ƙara hotuna.', tw: 'Afotu: Kyerɛw adwuma daa, si anammɔn mu dua, na fa mfonini ka ho.',
  },
  'progress.harvestOverdue': {
    en: 'Your expected harvest date was {days} day{s} ago. If you have harvested, submit a harvest report below. If the crop failed or harvest is delayed, use the options below.', fr: 'Votre date de récolte prévue était il y a {days} jour{s}.', sw: 'Tarehe ya mavuno yako ilikuwa siku {days} zilizopita.', ha: 'Ranar girbin ku ta wuce kwanaki {days} da suka gabata.', tw: 'Wo otwa da no twaam nnansa {days}.',
  },
  'progress.missingUpdateDays': {
    en: 'It has been {days} days since your last update. Regular updates help build a stronger track record.', fr: 'Cela fait {days} jours depuis votre dernière mise à jour.', sw: 'Imekuwa siku {days} tangu sasishi lako la mwisho.', ha: 'Kwanaki {days} ke nan tun sabuntawar ku ta ƙarshe.', tw: 'Nnansa {days} atwam fi wo nsɛm a etwa to.',
  },
  'progress.addUpdate': {
    en: 'Add Update', fr: 'Ajouter une mise à jour', sw: 'Ongeza Sasishi', ha: 'Ƙara Sabuntawa', tw: 'Fa nsɛm foforo ka ho',
  },
  'progress.logActivity': {
    en: 'Log Activity', fr: 'Noter une activité', sw: 'Andika Shughuli', ha: 'Rubuta Aiki', tw: 'Kyerɛw Adwuma',
  },
  'progress.updateCondition': {
    en: 'Update Condition', fr: 'Mettre à jour l\'état', sw: 'Sasisha Hali', ha: 'Sabunta Yanayi', tw: 'Sesa Tebea',
  },
  'progress.addPhoto': {
    en: 'Add Photo', fr: 'Ajouter photo', sw: 'Ongeza Picha', ha: 'Ƙara Hoto', tw: 'Fa Mfonini ka ho',
  },
  'progress.submitHarvestReport': {
    en: 'Submit Harvest Report', fr: 'Soumettre le rapport de récolte', sw: 'Wasilisha Ripoti ya Mavuno', ha: 'Aika Rahoton Girbi', tw: 'Fa Otwa Ho Amanneɛ bra',
  },
  'progress.reportCropFailure': {
    en: 'Report Crop Failure', fr: 'Signaler une perte de récolte', sw: 'Ripoti Kushindwa kwa Mazao', ha: 'Rahoton Gazawar Amfani', tw: 'Ka Nnɔbae Asɛeɛ Ho',
  },
  'progress.confirmCropFailure': {
    en: 'Confirm: report crop failure for this season?', fr: 'Confirmer : signaler la perte de récolte ?', sw: 'Thibitisha: ripoti kushindwa kwa mazao kwa msimu huu?', ha: 'Tabbatar: rahoton gazawar amfani na wannan lokaci?', tw: 'Si mu dua: ka nnɔbae asɛeɛ ho wɔ bere yi?',
  },
  'progress.yesReport': {
    en: 'Yes, Report', fr: 'Oui, signaler', sw: 'Ndio, Ripoti', ha: 'Eh, Rahoton', tw: 'Aane, Ka ho',
  },
  'progress.cropFailureReported': {
    en: 'Crop failure reported for this season', fr: 'Perte de récolte signalée pour cette saison', sw: 'Kushindwa kwa mazao kumeripotiwa kwa msimu huu', ha: 'An ba da rahoton gazawar amfani na wannan lokaci', tw: 'Wɔaka nnɔbae asɛeɛ ho wɔ bere yi',
  },
  'progress.confirmGrowthStage': {
    en: 'Confirm Growth Stage', fr: 'Confirmer l\'étape de croissance', sw: 'Thibitisha Hatua ya Ukuaji', ha: 'Tabbatar da Mataki Girma', tw: 'Si Nyin Anammɔn mu dua',
  },
  'progress.weExpectCropAt': {
    en: 'We expect your crop to be at:', fr: 'Nous pensons que votre culture est à :', sw: 'Tunatarajia mazao yako yako katika:', ha: 'Muna tsammanin amfanin ku ya kai:', tw: 'Yɛhwɛ kwan sɛ wo nnɔbae wɔ:',
  },
  'progress.whatStageActually': {
    en: 'What stage does your farm actually look like?', fr: 'À quelle étape votre ferme ressemble-t-elle ?', sw: 'Shamba lako linaonekanaje kweli?', ha: 'Yaya gonar ku take gaske?', tw: 'Wo afuo te sɛ anammɔn bɛn so ankasa?',
  },
  'progress.activityType': {
    en: 'Activity Type', fr: 'Type d\'activité', sw: 'Aina ya Shughuli', ha: 'Irin Aiki', tw: 'Adwuma Mu',
  },
  'progress.date': {
    en: 'Date', fr: 'Date', sw: 'Tarehe', ha: 'Kwanan wata', tw: 'Da',
  },
  'progress.notes': {
    en: 'Notes', fr: 'Notes', sw: 'Maelezo', ha: 'Bayani', tw: 'Nsɛm',
  },
  'progress.optional': {
    en: 'optional', fr: 'facultatif', sw: 'si lazima', ha: 'ba dole ba', tw: 'wompɛ a gyae',
  },
  'progress.whatDidYouDo': {
    en: 'What did you do? Any issues?', fr: 'Qu\'avez-vous fait ? Des problèmes ?', sw: 'Umefanya nini? Tatizo lolote?', ha: 'Me kuka yi? Matsala?', tw: 'Deɛ woyɛeɛ? Ɔhaw bi wɔ hɔ?',
  },
  'progress.moreDetails': {
    en: 'More details (quantity, unit, advice)', fr: 'Plus de détails (quantité, unité, conseil)', sw: 'Maelezo zaidi (kiasi, kipimo, ushauri)', ha: 'Ƙarin bayani (adadi, ma\'auni, shawara)', tw: 'Nsɛm pii (dodow, susu, afotu)',
  },
  'progress.quantity': {
    en: 'Quantity', fr: 'Quantité', sw: 'Kiasi', ha: 'Adadi', tw: 'Dodow',
  },
  'progress.unit': {
    en: 'Unit', fr: 'Unité', sw: 'Kipimo', ha: "Ma'auni", tw: 'Susu',
  },
  'progress.kgBagsLitres': {
    en: 'kg, bags, litres', fr: 'kg, sacs, litres', sw: 'kg, mifuko, lita', ha: 'kg, buhuna, lita', tw: 'kg, nkotoku, lita',
  },
  'progress.followedAdvice': {
    en: 'Followed advice?', fr: 'Suivi le conseil ?', sw: 'Umefuata ushauri?', ha: 'Kun bi shawara?', tw: 'Wodi afotu no so?',
  },
  'progress.saveActivity': {
    en: 'Save Activity', fr: 'Enregistrer l\'activité', sw: 'Hifadhi Shughuli', ha: 'Ajiye Aiki', tw: 'Kora Adwuma',
  },
  'progress.updateCropCondition': {
    en: 'Update Crop Condition', fr: 'Mettre à jour l\'état de la culture', sw: 'Sasisha Hali ya Mazao', ha: 'Sabunta Yanayin Amfani', tw: 'Sesa Nnɔbae Tebea',
  },
  'progress.good': {
    en: 'Good', fr: 'Bon', sw: 'Nzuri', ha: 'Kyau', tw: 'Eye',
  },
  'progress.average': {
    en: 'Average', fr: 'Moyen', sw: 'Wastani', ha: 'Matsakaici', tw: 'Ntam',
  },
  'progress.poor': {
    en: 'Poor', fr: 'Mauvais', sw: 'Mbaya', ha: 'Mara kyau', tw: 'Ɛnyɛ',
  },
  'progress.conditionNotes': {
    en: 'Notes (pests, drought, disease...)', fr: 'Notes (ravageurs, sécheresse, maladie...)', sw: 'Maelezo (wadudu, ukame, ugonjwa...)', ha: 'Bayani (kwari, fari, cuta...)', tw: 'Nsɛm (mmoa a wɔsɛe, ɔpɛ, nyarewa...)',
  },
  'progress.thisWillCloseSeason': {
    en: 'This will close the current season.', fr: 'Cela fermera la saison en cours.', sw: 'Hii itafunga msimu wa sasa.', ha: 'Wannan zai rufe lokacin yanzu.', tw: 'Eyi bɛto bere yi mu ato.',
  },
  'progress.cropFailureRecorded': {
    en: 'Crop failure is recorded — you may enter 0 kg if there was no harvest.', fr: 'Perte de récolte enregistrée — entrez 0 kg s\'il n\'y a pas eu de récolte.', sw: 'Kushindwa kwa mazao kumerekodiwa — unaweza kuingiza 0 kg ikiwa hakukuwa na mavuno.', ha: 'An rubuta gazawar amfani — za ku iya shigar 0 kg idan babu girbi.', tw: 'Wɔakyerɛw nnɔbae asɛeɛ — wobɛtumi de 0 kg sɛ otwa biara anba.',
  },
  'progress.totalHarvestKg': {
    en: 'Total Harvest (kg)', fr: 'Récolte totale (kg)', sw: 'Jumla ya Mavuno (kg)', ha: 'Jimlar Girbi (kg)', tw: 'Otwa Nyinaa (kg)',
  },
  'progress.salesAmount': {
    en: 'Sales Amount', fr: 'Montant des ventes', sw: 'Kiasi cha Mauzo', ha: 'Kuɗin Tallace', tw: 'Adeɛ a Wɔtɔn Sika',
  },
  'progress.qualityNotes': {
    en: 'Any notes about quality, storage, buyer...', fr: 'Notes sur la qualité, le stockage, l\'acheteur...', sw: 'Maelezo yoyote kuhusu ubora, uhifadhi, mnunuzi...', ha: 'Bayani game da inganci, adanawa, mai siya...', tw: 'Nsɛm biara fa papa, sie, otɔfo ho...',
  },
  'progress.submitting': {
    en: 'Submitting...', fr: 'Envoi en cours...', sw: 'Inatuma...', ha: 'Ana aikawa...', tw: 'Ɛrefa bra...',
  },
  'progress.addProgressPhoto': {
    en: 'Add Progress Photo', fr: 'Ajouter une photo de progression', sw: 'Ongeza Picha ya Maendeleo', ha: 'Ƙara Hoton Ci Gaba', tw: 'Fa Nkɔso Mfonini Ka Ho',
  },
  'progress.imageUrl': {
    en: 'Image URL', fr: 'URL de l\'image', sw: 'URL ya Picha', ha: 'URL Hoto', tw: 'Mfonini URL',
  },
  'progress.description': {
    en: 'Description', fr: 'Description', sw: 'Maelezo', ha: 'Bayani', tw: 'Nsɛm',
  },
  'progress.whatPhotoShow': {
    en: 'What does this photo show?', fr: 'Que montre cette photo ?', sw: 'Picha hii inaonyesha nini?', ha: 'Me wannan hoton ke nuna?', tw: 'Mfonini yi kyerɛ deɛn?',
  },
  'progress.photoLocation': {
    en: 'Photo Location', fr: 'Emplacement de la photo', sw: 'Eneo la Picha', ha: 'Wurin Hoto', tw: 'Mfonini Beae',
  },
  'progress.tagWithLocation': {
    en: 'Tag with current location', fr: 'Associer à la position actuelle', sw: 'Weka alama na eneo la sasa', ha: 'Yi alama da wurin yanzu', tw: 'Hyɛ beae a wowɔ seesei',
  },
  'progress.savePhoto': {
    en: 'Save Photo', fr: 'Enregistrer la photo', sw: 'Hifadhi Picha', ha: 'Ajiye Hoto', tw: 'Kora Mfonini',
  },
  'progress.progressComparison': {
    en: 'Progress Comparison', fr: 'Comparaison de progression', sw: 'Ulinganisho wa Maendeleo', ha: 'Kwatancen Ci Gaba', tw: 'Nkɔso Nsɛnhyɛase',
  },
  'progress.dimension': {
    en: 'Dimension', fr: 'Dimension', sw: 'Kipimo', ha: 'Ma\'auni', tw: 'Susu',
  },
  'progress.status': {
    en: 'Status', fr: 'Statut', sw: 'Hali', ha: 'Matsayi', tw: 'Tebea',
  },
  'progress.details': {
    en: 'Details', fr: 'Détails', sw: 'Maelezo', ha: 'Bayani', tw: 'Nsɛm',
  },
  'progress.recentProgressEntries': {
    en: 'Recent Progress Entries', fr: 'Entrées récentes', sw: 'Maingizo ya Hivi Karibuni', ha: 'Sabbin Shigar Ci Gaba', tw: 'Nkɔso Nsɛm Foforo',
  },
  'progress.type': {
    en: 'Type', fr: 'Type', sw: 'Aina', ha: 'Iri', tw: 'Mu',
  },
  'progress.activity': {
    en: 'Activity', fr: 'Activité', sw: 'Shughuli', ha: 'Aiki', tw: 'Adwuma',
  },
  'progress.condition': {
    en: 'Condition', fr: 'État', sw: 'Hali', ha: 'Yanayi', tw: 'Tebea',
  },
  'progress.advice': {
    en: 'Advice', fr: 'Conseil', sw: 'Ushauri', ha: 'Shawara', tw: 'Afotu',
  },
  'progress.pastSeasons': {
    en: 'Past Seasons', fr: 'Saisons passées', sw: 'Misimu Iliyopita', ha: 'Lokutan Da Suka Wuce', tw: 'Mmere a Atwam',
  },
  'progress.crop': {
    en: 'Crop', fr: 'Culture', sw: 'Mazao', ha: 'Amfani', tw: 'Nnɔbae',
  },
  'progress.harvest': {
    en: 'Harvest', fr: 'Récolte', sw: 'Mavuno', ha: 'Girbi', tw: 'Otwa',
  },
  'progress.score': {
    en: 'Score', fr: 'Score', sw: 'Alama', ha: 'Maki', tw: 'Akontaa',
  },
  'progress.reopen': {
    en: 'Reopen', fr: 'Rouvrir', sw: 'Fungua tena', ha: 'Sake buɗewa', tw: 'Bue bio',
  },
  'progress.admin': {
    en: 'Admin', fr: 'Admin', sw: 'Admin', ha: 'Admin', tw: 'Admin',
  },
  'progress.draftRestored': {
    en: 'Draft restored — your previous entry was saved.', fr: 'Brouillon restauré — votre entrée précédente a été enregistrée.', sw: 'Rasimu imerejeshwa — ingizo lako la awali limehifadhiwa.', ha: 'An dawo da rubutu — shigarwar ku ta baya an ajiye.', tw: 'Wɔasan akyerɛw no aba — wo nsɛm a edi kan no wɔakora.',
  },
  'progress.egHybrid': {
    en: 'e.g. hybrid, OPV', fr: 'ex. hybride, OPV', sw: 'mfano: mseto, OPV', ha: 'misali haɗe, OPV', tw: 'sɛ hybrid, OPV',
  },
  'progress.egMaizeForFood': {
    en: 'e.g. Maize for food and sale', fr: 'ex. Maïs pour consommation et vente', sw: 'mfano: Mahindi kwa chakula na mauzo', ha: 'misali Masara don ci da sayarwa', tw: 'sɛ Aburo adi ne tɔn',
  },
  'progress.stageLabel': {
    en: 'stage?', fr: 'étape ?', sw: 'hatua?', ha: 'mataki?', tw: 'anammɔn?',
  },

  // ── Stage labels (full set for FarmerProgressTab) ──
  'stage.prePlanting': {
    en: 'Pre-Planting', fr: 'Pré-plantation', sw: 'Kabla ya Kupanda', ha: 'Kafin Shuka', tw: 'Ansa Dua',
  },
  'stage.vegetative': {
    en: 'Vegetative', fr: 'Végétatif', sw: 'Mimea', ha: 'Girma', tw: 'Nyin',
  },
  'stage.postHarvest': {
    en: 'Post-Harvest', fr: 'Post-récolte', sw: 'Baada ya Mavuno', ha: 'Bayan Girbi', tw: 'Otwa Akyi',
  },

  // ── Classification labels ──
  'class.onTrack': {
    en: 'On Track', fr: 'En bonne voie', sw: 'Iko Sawa', ha: 'A kan hanya', tw: 'Ɛkɔ yiye',
  },
  'class.slightDelay': {
    en: 'Slight Delay', fr: 'Léger retard', sw: 'Kucheleweshwa Kidogo', ha: 'Jinkirin ɗan kaɗan', tw: 'Ɛtwaa kakra',
  },
  'class.atRisk': {
    en: 'At Risk', fr: 'À risque', sw: 'Hatarini', ha: 'Cikin haɗari', tw: 'Asiane mu',
  },
  'class.critical': {
    en: 'Critical', fr: 'Critique', sw: 'Mbaya sana', ha: 'Mai haɗari', tw: 'Ɛyɛ den pa ara',
  },

  // ── Activity types ──
  'activity.planting': {
    en: 'Planting', fr: 'Plantation', sw: 'Kupanda', ha: 'Shuka', tw: 'Dua',
  },
  'activity.spraying': {
    en: 'Spraying', fr: 'Pulvérisation', sw: 'Kunyunyizia', ha: 'Fesa', tw: 'Pete aduro',
  },
  'activity.fertilizing': {
    en: 'Fertilizing', fr: 'Fertilisation', sw: 'Kuweka mbolea', ha: 'Zuba taki', tw: 'Gu nkɔsoɔ aduro',
  },
  'activity.irrigation': {
    en: 'Irrigation', fr: 'Irrigation', sw: 'Umwagiliaji', ha: 'Ban ruwa', tw: 'Nsuo gu so',
  },
  'activity.weeding': {
    en: 'Weeding', fr: 'Désherbage', sw: 'Kupalilia', ha: 'Cire ciyawa', tw: 'Tu wura',
  },
  'activity.harvesting': {
    en: 'Harvesting', fr: 'Récolte', sw: 'Kuvuna', ha: 'Girbi', tw: 'Twa',
  },
  'activity.storage': {
    en: 'Storage', fr: 'Stockage', sw: 'Uhifadhi', ha: 'Adanawa', tw: 'Sie',
  },
  'activity.selling': {
    en: 'Selling', fr: 'Vente', sw: 'Kuuza', ha: 'Sayarwa', tw: 'Tɔn',
  },
  'activity.other': {
    en: 'Other', fr: 'Autre', sw: 'Nyingine', ha: 'Wani', tw: 'Afoforo',
  },

  // ── Image stages ──
  'imageStage.earlyGrowth': {
    en: 'Early Growth', fr: 'Début de croissance', sw: 'Ukuaji wa Mapema', ha: 'Farkon Girma', tw: 'Nyin Ahyɛase',
  },
  'imageStage.midStage': {
    en: 'Mid Stage', fr: 'Mi-parcours', sw: 'Katikati', ha: 'Tsakiyar Mataki', tw: 'Ntam Anammɔn',
  },
  'imageStage.preHarvest': {
    en: 'Pre-Harvest', fr: 'Pré-récolte', sw: 'Kabla ya Mavuno', ha: 'Kafin Girbi', tw: 'Ansa Otwa',
  },

  // ── Advice options ──
  'advice.yes': {
    en: 'Yes', fr: 'Oui', sw: 'Ndio', ha: 'Eh', tw: 'Aane',
  },
  'advice.partial': {
    en: 'Partial', fr: 'Partiel', sw: 'Nusu', ha: 'Wani ɓangare', tw: 'Fa bi',
  },
  'advice.no': {
    en: 'No', fr: 'Non', sw: 'Hapana', ha: "A'a", tw: 'Daabi',
  },
  'advice.na': {
    en: 'N/A', fr: 'N/A', sw: 'Haihusiki', ha: 'Babu', tw: 'Nni ho',
  },

  // ── Credibility flag labels ──
  'flag.burstSubmissions': {
    en: 'Several entries submitted in a single day — this can look like backfilling.', fr: 'Plusieurs entrées soumises le même jour.', sw: 'Maingizo mengi yamewasilishwa siku moja.', ha: 'An aika shigarwa da yawa rana ɗaya.', tw: 'Nsɛm pii baeɛ da koro.',
  },
  'flag.updateGap': {
    en: 'No updates for more than 4 weeks. Log activities regularly.', fr: 'Pas de mises à jour depuis plus de 4 semaines.', sw: 'Hakuna masasisho kwa wiki 4+. Andika shughuli mara kwa mara.', ha: 'Babu sabuntawa fiye da sati 4. Rubuta ayyuka a kai a kai.', tw: 'Nsɛm biara mmaeɛ nnawɔtwe 4+. Kyerɛw adwuma daa.',
  },
  'flag.noUpdates': {
    en: 'No activities logged yet. Start logging to build your record.', fr: 'Aucune activité enregistrée. Commencez à noter.', sw: 'Hakuna shughuli zilizoandikwa. Anza kuandika.', ha: 'Babu ayyukan da aka rubuta tukuna. Fara rubuta.', tw: 'Wɔnkyerɛwee adwuma biara da. Hyɛ ase kyerɛw.',
  },
  'flag.stageRegression': {
    en: 'Crop stage went backward — confirm your current stage.', fr: 'L\'étape de culture a reculé — confirmez votre étape actuelle.', sw: 'Hatua ya mazao imerudi nyuma — thibitisha hatua yako ya sasa.', ha: 'Matakin amfani ya koma baya — tabbatar da matakin ku na yanzu.', tw: 'Nnɔbae anammɔn asan akyi — si wo anammɔn a ɛwɔ mu seesei mu dua.',
  },
  'flag.fastProgression': {
    en: 'Stage progression was faster than expected.', fr: 'La progression a été plus rapide que prévu.', sw: 'Maendeleo ya hatua yalikuwa haraka kuliko ilivyotarajiwa.', ha: 'Ci gaban mataki ya yi sauri fiye da yadda aka zata.', tw: 'Anammɔn no kɔɔ ntɛm kyɛn sɛdeɛ na wɔn hwɛ kwan.',
  },
  'flag.highStageMismatch': {
    en: 'Your confirmed stages often differ from the expected stage.', fr: 'Vos étapes confirmées diffèrent souvent.', sw: 'Hatua zako zilizothibitishwa mara nyingi zinatofautiana na zilizotarajiwa.', ha: 'Matakan ku da aka tabbatar sau da yawa sun bambanta.', tw: 'Anammɔn a woasi mu dua no taa yɛ soronko.',
  },
  'flag.entriesBeforePlanting': {
    en: 'Some entries are dated before your planting date.', fr: 'Certaines entrées sont antérieures à la date de plantation.', sw: 'Baadhi ya maingizo yana tarehe kabla ya tarehe ya kupanda.', ha: 'Wasu shigarwa suna da kwanan wata kafin ranar shuka.', tw: 'Nsɛm bi da no di wo dua da kan.',
  },
  'flag.futureDatedEntries': {
    en: 'Entries with future dates were detected.', fr: 'Des entrées avec des dates futures ont été détectées.', sw: 'Maingizo yenye tarehe za siku zijazo yamegunduliwa.', ha: 'An gano shigarwa masu kwanan wata na nan gaba.', tw: 'Wɔahu nsɛm a da a ɛba no wɔ mu.',
  },
  'flag.harvestTooEarly': {
    en: 'Harvest was logged too early in the season.', fr: 'La récolte a été enregistrée trop tôt.', sw: 'Mavuno yameandikwa mapema sana katika msimu.', ha: 'An rubuta girbi da wuri sosai a cikin lokaci.', tw: 'Wɔakyerɛw otwa ntɛm dodo wɔ bere no mu.',
  },
  'flag.implausibleYield': {
    en: 'Reported yield is unusually high — please verify the amount.', fr: 'Le rendement signalé est inhabituellement élevé.', sw: 'Mavuno yaliyoripotiwa ni ya juu sana — tafadhali hakikisha kiasi.', ha: 'Girbin da aka ruwaito ya yi yawa ba daidai ba — da fatan tabbatar da adadin.', tw: 'Otwa a wɔakyerɛw no kɔ soro pa ara — yɛsrɛ wo hwɛ sɛ ɛyɛ nokware.',
  },
  'flag.veryLowYield': {
    en: 'Reported yield is unusually low.', fr: 'Le rendement signalé est inhabituellement bas.', sw: 'Mavuno yaliyoripotiwa ni ya chini sana.', ha: 'Girbin da aka ruwaito ya yi ƙasa ba daidai ba.', tw: 'Otwa a wɔakyerɛw no yɛ kakra pa ara.',
  },
  'flag.conditionRapidRecovery': {
    en: 'Crop condition improved from poor to good in less than a week.', fr: 'L\'état de la culture s\'est amélioré de mauvais à bon en moins d\'une semaine.', sw: 'Hali ya mazao imebadilika kutoka mbaya hadi nzuri katika wiki moja.', ha: 'Yanayin amfani ya inganta daga mara kyau zuwa kyau cikin mako ɗaya.', tw: 'Nnɔbae tebea fi bɔne kɔɔ papa wɔ nnawɔtwe koro mu.',
  },
  'flag.adviceAlwaysYes': {
    en: 'All advice marked as followed every time — vary your responses if accurate.', fr: 'Tous les conseils marqués comme suivis — variez vos réponses.', sw: 'Ushauri wote umewekwa kama ulioufuata kila wakati — badilisha majibu yako.', ha: 'Dukkan shawarwari an yiwa alama a matsayin an bi — bambanta amsoshin ku.', tw: 'Wɔahyɛ afotu nyinaa sɛ wɔadi so — sesa wo mmuae.',
  },
  'flag.adviceNeverFollowed': {
    en: 'Advice never marked as followed.', fr: 'Conseil jamais marqué comme suivi.', sw: 'Ushauri haujawekwa kama uliofuatwa.', ha: 'Ba a taɓa yin alamar bin shawara ba.', tw: 'Wɔnhyɛɛ afotu no sɛ wɔadi so da.',
  },
  'flag.cropFailure': {
    en: 'Crop failure was reported for this season.', fr: 'Une perte de récolte a été signalée.', sw: 'Kushindwa kwa mazao kumereipotiwa kwa msimu huu.', ha: 'An ba da rahoton gazawar amfani na wannan lokaci.', tw: 'Wɔaka nnɔbae asɛeɛ ho wɔ bere yi.',
  },
  'flag.partialHarvest': {
    en: 'Partial harvest was reported.', fr: 'Récolte partielle signalée.', sw: 'Mavuno ya sehemu yameripotiwa.', ha: 'An ba da rahoton girbi wani ɓangare.', tw: 'Wɔaka otwa fa bi ho.',
  },
  'flag.seasonAbandoned': {
    en: 'This season was abandoned.', fr: 'Cette saison a été abandonnée.', sw: 'Msimu huu umeachwa.', ha: 'An watsar da wannan lokaci.', tw: 'Wɔagyae bere yi.',
  },
  'flag.harvestImageTooEarly': {
    en: 'A harvest photo was added too early in the season.', fr: 'Une photo de récolte a été ajoutée trop tôt.', sw: 'Picha ya mavuno imeongezwa mapema sana katika msimu.', ha: 'An ƙara hoton girbi da wuri a cikin lokaci.', tw: 'Wɔde otwa mfonini baa ntɛm dodo wɔ bere no mu.',
  },
  'flag.earlyImagePostHarvest': {
    en: 'An early-growth photo was added during post-harvest.', fr: 'Une photo de début de croissance a été ajoutée après la récolte.', sw: 'Picha ya ukuaji wa mapema imeongezwa baada ya mavuno.', ha: 'An ƙara hoton farkon girma bayan girbi.', tw: 'Wɔde nyin ahyɛase mfonini baa otwa akyi bere mu.',
  },
  'flag.imageStageIncoherent': {
    en: 'Photo stages are inconsistent with the season timeline.', fr: 'Les étapes des photos sont incohérentes.', sw: 'Hatua za picha hazilingani na ratiba ya msimu.', ha: 'Matakan hotuna ba su dace da jadawalin lokaci ba.', tw: 'Mfonini anammɔn ne bere nkyerɛkyerɛ no nhyia.',
  },

  // ═══════════════════════════════════════════════════════════
  //  ADMIN PAGES — Organizations, Users, Issues, Control
  // ═══════════════════════════════════════════════════════════

  'admin.organizations': {
    en: 'Organizations', fr: 'Organisations', sw: 'Mashirika', ha: 'Ƙungiyoyi', tw: 'Nnipa Kuo',
  },
  'admin.newOrganization': {
    en: 'New Organization', fr: 'Nouvelle organisation', sw: 'Shirika Jipya', ha: 'Sabuwar Ƙungiya', tw: 'Kuo Foforo',
  },
  'admin.userManagement': {
    en: 'User Management', fr: 'Gestion des utilisateurs', sw: 'Usimamizi wa Watumiaji', ha: 'Gudanar da Masu Amfani', tw: 'Nipa a Wɔde Di Dwuma Nhyehyɛeɛ',
  },
  'admin.newUser': {
    en: 'New User', fr: 'Nouvel utilisateur', sw: 'Mtumiaji Mpya', ha: 'Sabon Mai Amfani', tw: 'Onipa Foforo',
  },
  'admin.issues': {
    en: 'Issues', fr: 'Problèmes', sw: 'Matatizo', ha: 'Matsaloli', tw: 'Nsɛm',
  },
  'admin.systemOverview': {
    en: 'System Overview', fr: 'Aperçu du système', sw: 'Muhtasari wa Mfumo', ha: 'Taƙaitaccen Tsari', tw: 'System ho nsɛm',
  },
  'admin.operationsHealth': {
    en: 'Operations Health', fr: 'Santé des opérations', sw: 'Afya ya Operesheni', ha: 'Lafiyar Ayyuka', tw: 'Adwuma Apomuden',
  },
  'admin.regionConfig': {
    en: 'Region Config', fr: 'Config région', sw: 'Usanidi wa Mkoa', ha: 'Saita Yanki', tw: 'Mantam Nhyehyɛeɛ',
  },
  'admin.demandIntelligence': {
    en: 'Demand Intelligence', fr: 'Intelligence de la demande', sw: 'Akili ya Mahitaji', ha: 'Ilimin Buƙata', tw: 'Ahiade Nimdeɛ',
  },
  'admin.languages': {
    en: 'Languages', fr: 'Langues', sw: 'Lugha', ha: 'Harsuna', tw: 'Kasa',
  },
  'admin.active': {
    en: 'Active', fr: 'Actif', sw: 'Hai', ha: 'Aiki', tw: 'Ɛyɛ adwuma',
  },
  'admin.inactive': {
    en: 'Inactive', fr: 'Inactif', sw: 'Haifanyi kazi', ha: 'Ba aiki', tw: 'Ɛnyɛ adwuma',
  },
  'admin.disabled': {
    en: 'Disabled', fr: 'Désactivé', sw: 'Imezimwa', ha: 'An kashe', tw: 'Wɔato mu',
  },
  'admin.archived': {
    en: 'Archived', fr: 'Archivé', sw: 'Imehifadhiwa', ha: 'An ajiye', tw: 'Wɔakora',
  },
  'admin.users': {
    en: 'Users', fr: 'Utilisateurs', sw: 'Watumiaji', ha: 'Masu amfani', tw: 'Wɔn a wɔde di dwuma',
  },
  'admin.farmers': {
    en: 'Farmers', fr: 'Agriculteurs', sw: 'Wakulima', ha: 'Manoma', tw: 'Akuafo',
  },
  'admin.applications': {
    en: 'Applications', fr: 'Candidatures', sw: 'Maombi', ha: 'Aikace-aikace', tw: 'Adesrɛ',
  },
  'admin.country': {
    en: 'Country:', fr: 'Pays :', sw: 'Nchi:', ha: 'Ƙasa:', tw: 'Ɔman:',
  },
  'admin.region': {
    en: 'Region:', fr: 'Région :', sw: 'Mkoa:', ha: 'Yanki:', tw: 'Mantam:',
  },
  'admin.created': {
    en: 'Created', fr: 'Créé', sw: 'Imeundwa', ha: 'An ƙirƙira', tw: 'Wɔayɛ',
  },
  'admin.edit': {
    en: 'Edit', fr: 'Modifier', sw: 'Hariri', ha: 'Gyara', tw: 'Sesa',
  },
  'admin.name': {
    en: 'Name', fr: 'Nom', sw: 'Jina', ha: 'Suna', tw: 'Din',
  },
  'admin.email': {
    en: 'Email', fr: 'Email', sw: 'Barua pepe', ha: 'Email', tw: 'Email',
  },
  'admin.role': {
    en: 'Role', fr: 'Rôle', sw: 'Jukumu', ha: 'Matsayi', tw: 'Dwuma',
  },
  'admin.organization': {
    en: 'Organization', fr: 'Organisation', sw: 'Shirika', ha: 'Ƙungiya', tw: 'Kuo',
  },
  'admin.actions': {
    en: 'Actions', fr: 'Actions', sw: 'Vitendo', ha: 'Ayyuka', tw: 'Adwuma',
  },
  'admin.save': {
    en: 'Save Changes', fr: 'Enregistrer', sw: 'Hifadhi Mabadiliko', ha: 'Ajiye Canje-canje', tw: 'Kora Nsɛm',
  },
  'admin.create': {
    en: 'Create', fr: 'Créer', sw: 'Unda', ha: 'Ƙirƙira', tw: 'Yɛ',
  },
  'admin.refresh': {
    en: 'Refresh', fr: 'Rafraîchir', sw: 'Onyesha upya', ha: 'Sabunta', tw: 'Yɛ no foforo',
  },
  'admin.noResults': {
    en: 'No results found.', fr: 'Aucun résultat trouvé.', sw: 'Hakuna matokeo.', ha: 'Ba a sami sakamako ba.', tw: 'Nsɛm biara nni hɔ.',
  },
  'admin.loading': {
    en: 'Loading...', fr: 'Chargement...', sw: 'Inapakia...', ha: 'Ana lodi...', tw: 'Ɛreloadi...',
  },
  'admin.all': {
    en: 'All', fr: 'Tous', sw: 'Zote', ha: 'Duka', tw: 'Nyinaa',
  },
  'admin.clearFilters': {
    en: 'Clear filters', fr: 'Effacer les filtres', sw: 'Futa vichujio', ha: 'Share tace', tw: 'Pepa nhwehwɛmu',
  },

  // ─── Admin Analytics ─────────────────────────────────────
  'admin.analytics': {
    en: 'Farmer Analytics', fr: 'Analytique agriculteurs', sw: 'Uchambuzi wa Wakulima', ha: 'Nazarin Manoma', tw: 'Akuafo Nsɛm Nhwehwɛmu',
  },
  'admin.totalFarmers': {
    en: 'Total Farmers', fr: 'Total agriculteurs', sw: 'Jumla ya Wakulima', ha: 'Jimlar Manoma', tw: 'Akuafo Nyinaa',
  },
  'admin.newToday': {
    en: 'New Today', fr: 'Nouveaux aujourd\'hui', sw: 'Wapya Leo', ha: 'Sabbin Yau', tw: 'Foforo Ɛnnɛ',
  },
  'admin.activeToday': {
    en: 'Active Today', fr: 'Actifs aujourd\'hui', sw: 'Hai Leo', ha: 'Masu Aiki Yau', tw: 'Wɔyɛ Adwuma Ɛnnɛ',
  },
  'admin.activeWeek': {
    en: 'Active This Week', fr: 'Actifs cette semaine', sw: 'Hai Wiki Hii', ha: 'Masu Aiki Wannan Mako', tw: 'Wɔyɛ Adwuma Dapɛn Yi',
  },
  'admin.onboardingRate': {
    en: 'Onboarding Rate', fr: 'Taux d\'intégration', sw: 'Kiwango cha Uandikishaji', ha: 'Adadin Shigarwa', tw: 'Ahyɛaseɛ Dodow',
  },
  'admin.newFarmersByDay': {
    en: 'New Farmers by Day', fr: 'Nouveaux agriculteurs par jour', sw: 'Wakulima Wapya kwa Siku', ha: 'Sabbin Manoma ta Rana', tw: 'Akuafo Foforo Da Biara',
  },
  'admin.eventCounts': {
    en: 'Event Counts', fr: 'Nombre d\'événements', sw: 'Hesabu za Matukio', ha: 'Ƙidayar Abubuwa', tw: 'Nsɛm Dodow',
  },
  'admin.recentActivity': {
    en: 'Recent Activity', fr: 'Activité récente', sw: 'Shughuli za Hivi Karibuni', ha: 'Ayyukan Kwanan nan', tw: 'Adwuma a Ɛyɛɛ Nnaansa Yi',
  },
  'admin.evtRegistered': {
    en: 'Registered', fr: 'Inscrit', sw: 'Amesajiliwa', ha: 'Ya yi rijista', tw: 'Wɔakyerɛw din',
  },
  'admin.evtOnboarded': {
    en: 'Onboarding Done', fr: 'Intégration terminée', sw: 'Uandikishaji Umekamilika', ha: 'Shigarwa ta Cika', tw: 'Ahyɛaseɛ Awie',
  },
  'admin.evtFarmCreated': {
    en: 'Farm Created', fr: 'Ferme créée', sw: 'Shamba Limeundwa', ha: 'An ƙirƙiri Gona', tw: 'Wɔayɛ Afuo',
  },
  'admin.evtStageUpdate': {
    en: 'Stage Updated', fr: 'Étape mise à jour', sw: 'Hatua Imesasishwa', ha: 'An sabunta Mataki', tw: 'Wɔasakra Anamɔntuo',
  },
  'admin.evtPestReport': {
    en: 'Pest Report', fr: 'Rapport ravageur', sw: 'Ripoti ya Wadudu', ha: 'Rahoton Ƙwari', tw: 'Nsusuananmu Ho Amanneɛ',
  },
  'admin.evtActionDone': {
    en: 'Action Completed', fr: 'Action terminée', sw: 'Kitendo Kimekamilika', ha: 'Aiki Ya Cika', tw: 'Adwuma Awie',
  },
  'admin.evtSeasonStart': {
    en: 'Season Started', fr: 'Saison commencée', sw: 'Msimu Umeanza', ha: 'Lokaci Ya Fara', tw: 'Bere Ahyɛ Aseɛ',
  },
  'admin.evtLogin': {
    en: 'Login', fr: 'Connexion', sw: 'Kuingia', ha: 'Shiga', tw: 'Bra mu',
  },
  // Section titles
  'admin.farmerGrowth': {
    en: 'Farmer Growth', fr: 'Croissance agriculteurs', sw: 'Ukuaji wa Wakulima', ha: 'Haɓakar Manoma', tw: 'Akuafo Nkɔso',
  },
  'admin.onboardingFunnel': {
    en: 'Onboarding Funnel', fr: 'Entonnoir d\'intégration', sw: 'Mfereji wa Uandikishaji', ha: 'Tsarin Shigarwa', tw: 'Ahyɛaseɛ Fanel',
  },
  'admin.activityOverview': {
    en: 'Activity Today', fr: 'Activité aujourd\'hui', sw: 'Shughuli za Leo', ha: 'Ayyukan Yau', tw: 'Ɛnnɛ Adwuma',
  },
  'admin.alertsRisk': {
    en: 'Alerts / Risk', fr: 'Alertes / Risques', sw: 'Tahadhari / Hatari', ha: 'Faɗakarwa / Haɗari', tw: 'Kɔkɔbɔ / Asiane',
  },
  'admin.cropBreakdown': {
    en: 'Farms by Crop', fr: 'Fermes par culture', sw: 'Mashamba kwa Mazao', ha: 'Gonaki ta Amfanin', tw: 'Mfuo Nnɔbaeɛ Mu',
  },
  'admin.actionsToday': {
    en: 'Actions Today', fr: 'Actions aujourd\'hui', sw: 'Vitendo Leo', ha: 'Ayyuka Yau', tw: 'Ɛnnɛ Adwuma',
  },
  // Growth periods
  'admin.periodToday': {
    en: 'Today', fr: 'Aujourd\'hui', sw: 'Leo', ha: 'Yau', tw: 'Ɛnnɛ',
  },
  'admin.periodWeek': {
    en: '7 Days', fr: '7 jours', sw: 'Siku 7', ha: 'Kwana 7', tw: 'Nnawɔtwe 7',
  },
  'admin.periodMonth': {
    en: '30 Days', fr: '30 jours', sw: 'Siku 30', ha: 'Kwana 30', tw: 'Nnawɔtwe 30',
  },
  // Risk labels
  'admin.riskNoFarm': {
    en: 'No Farm Created', fr: 'Pas de ferme', sw: 'Hakuna Shamba', ha: 'Babu Gona', tw: 'Afuo Biara Nni Hɔ',
  },
  'admin.riskNotOnboarded': {
    en: 'Not Onboarded', fr: 'Pas intégrés', sw: 'Hajaandikishwa', ha: 'Ba a Shigar ba', tw: 'Wɔnhyɛɛ Aseɛ',
  },
  'admin.riskNoPestCheck': {
    en: 'No Pest Check', fr: 'Pas de contrôle', sw: 'Hakuna Ukaguzi', ha: 'Babu Dubawa', tw: 'Wɔnhwɛɛ Nsusuananmu',
  },
  'admin.riskInactive': {
    en: 'Inactive (7d)', fr: 'Inactifs (7j)', sw: 'Haifanyi kazi (7s)', ha: 'Ba aiki (7k)', tw: 'Ɛnyɛ adwuma (7d)',
  },
  'admin.noRiskIssues': {
    en: 'No risk issues detected', fr: 'Aucun problème détecté', sw: 'Hakuna matatizo', ha: 'Babu matsala', tw: 'Asiane biara nni hɔ',
  },
  'admin.byGender': {
    en: 'Farmers by Gender', fr: 'Agriculteurs par genre', sw: 'Wakulima kwa Jinsia', ha: 'Manoma ta Jinsi', tw: 'Akuafo Nnipasuo Mu',
  },
  'admin.byAgeRange': {
    en: 'Farmers by Age Range', fr: 'Agriculteurs par âge', sw: 'Wakulima kwa Umri', ha: 'Manoma ta Shekaru', tw: 'Akuafo Mfeɛ Mu',
  },
  'admin.newByGender': {
    en: 'New Farmers by Gender', fr: 'Nouveaux par genre', sw: 'Wapya kwa Jinsia', ha: 'Sabbin ta Jinsi', tw: 'Foforo Nnipasuo Mu',
  },
  'admin.onboardingByAge': {
    en: 'Onboarding by Age Range', fr: 'Intégration par âge', sw: 'Uandikishaji kwa Umri', ha: 'Shigarwa ta Shekaru', tw: 'Ahyɛaseɛ Mfeɛ Mu',
  },

  // ═══════════════════════════════════════════════════════════
  //  GENDER — gender options (OnboardingWizard)
  // ═══════════════════════════════════════════════════════════

  'gender.male': {
    en: 'Male', fr: 'Homme', sw: 'Mwanaume', ha: 'Namiji', tw: 'Ɔbarima',
  },
  'gender.female': {
    en: 'Female', fr: 'Femme', sw: 'Mwanamke', ha: 'Mace', tw: 'Ɔbaa',
  },
  'gender.other': {
    en: 'Other', fr: 'Autre', sw: 'Nyingine', ha: 'Wani', tw: 'Foforo',
  },
  'gender.preferNotToSay': {
    en: 'Prefer not to say', fr: 'Préfère ne pas dire', sw: 'Sipendelei kusema', ha: 'Ban fi fadi ba', tw: 'Mempɛ sɛ meka',
  },

  // ═══════════════════════════════════════════════════════════
  //  AGE — age group options (OnboardingWizard)
  // ═══════════════════════════════════════════════════════════

  'age.under25': {
    en: 'Under 25', fr: 'Moins de 25', sw: 'Chini ya 25', ha: 'Ƙasa da 25', tw: 'Ase 25',
  },
  'age.25to35': {
    en: '25 – 35', fr: '25 – 35', sw: '25 – 35', ha: '25 – 35', tw: '25 – 35',
  },
  'age.36to50': {
    en: '36 – 50', fr: '36 – 50', sw: '36 – 50', ha: '36 – 50', tw: '36 – 50',
  },
  'age.over50': {
    en: 'Over 50', fr: 'Plus de 50', sw: 'Zaidi ya 50', ha: 'Sama da 50', tw: 'Boro 50',
  },
  // Extended age ranges (OnboardingSteps demographics)
  'age.under_25': {
    en: 'Under 25', fr: 'Moins de 25', sw: 'Chini ya 25', ha: 'Ƙasa da 25', tw: 'Ase 25',
  },
  'age.25_34': {
    en: '25 – 34', fr: '25 – 34', sw: '25 – 34', ha: '25 – 34', tw: '25 – 34',
  },
  'age.35_44': {
    en: '35 – 44', fr: '35 – 44', sw: '35 – 44', ha: '35 – 44', tw: '35 – 44',
  },
  'age.45_54': {
    en: '45 – 54', fr: '45 – 54', sw: '45 – 54', ha: '45 – 54', tw: '45 – 54',
  },
  'age.55_plus': {
    en: '55+', fr: '55+', sw: '55+', ha: '55+', tw: '55+',
  },
  'age.prefer_not_to_say': {
    en: 'Prefer not to say', fr: 'Pr\u00E9f\u00E8re ne pas dire', sw: 'Sipendelei kusema', ha: 'Ban fi fadi ba', tw: 'Memp\u025B s\u025B meka',
  },

  // ═══════════════════════════════════════════════════════════
  //  FARM SIZE — category labels and subtitles
  // ═══════════════════════════════════════════════════════════

  'farmSize.small': {
    en: 'Small', fr: 'Petit', sw: 'Ndogo', ha: 'Ƙarami', tw: 'Ketewa',
  },
  'farmSize.medium': {
    en: 'Medium', fr: 'Moyen', sw: 'Wastani', ha: 'Matsakaici', tw: 'Ntam',
  },
  'farmSize.large': {
    en: 'Large', fr: 'Grand', sw: 'Kubwa', ha: 'Babba', tw: 'Kɛse',
  },
  'farmSize.under2acres': {
    en: 'Under 2 acres', fr: 'Moins de 2 acres', sw: 'Chini ya ekari 2', ha: 'Ƙasa da kadada 2', tw: 'Ase acre 2',
  },
  'farmSize.under1hectare': {
    en: 'Under 1 hectare', fr: 'Moins de 1 hectare', sw: 'Chini ya hektari 1', ha: 'Ƙasa da hekta 1', tw: 'Ase hectare 1',
  },
  'farmSize.2to10acres': {
    en: '2 – 10 acres', fr: '2 – 10 acres', sw: 'Ekari 2 – 10', ha: 'Kadada 2 – 10', tw: 'Acre 2 – 10',
  },
  'farmSize.1to4hectares': {
    en: '1 – 4 hectares', fr: '1 – 4 hectares', sw: 'Hektari 1 – 4', ha: 'Hekta 1 – 4', tw: 'Hectare 1 – 4',
  },
  'farmSize.over10acres': {
    en: 'Over 10 acres', fr: 'Plus de 10 acres', sw: 'Zaidi ya ekari 10', ha: 'Sama da kadada 10', tw: 'Boro acre 10',
  },
  'farmSize.over4hectares': {
    en: 'Over 4 hectares', fr: 'Plus de 4 hectares', sw: 'Zaidi ya hektari 4', ha: 'Sama da hekta 4', tw: 'Boro hectare 4',
  },

  // ═══════════════════════════════════════════════════════════
  //  CROP STAGES — OnboardingWizard stage options
  // ═══════════════════════════════════════════════════════════

  'cropStage.planting': {
    en: 'Planting', fr: 'Plantation', sw: 'Kupanda', ha: 'Dasa', tw: 'Dua',
  },
  'cropStage.growing': {
    en: 'Growing', fr: 'Croissance', sw: 'Kukua', ha: 'Girma', tw: 'Nyin',
  },
  'cropStage.flowering': {
    en: 'Flowering', fr: 'Floraison', sw: 'Kuchanua', ha: 'Fure', tw: 'Nhwiren',
  },
  'cropStage.harvest': {
    en: 'Harvest', fr: 'Récolte', sw: 'Mavuno', ha: 'Girbi', tw: 'Twabere',
  },

  // ═══════════════════════════════════════════════════════════
  //  TOP CROPS — crop label translations
  // ═══════════════════════════════════════════════════════════

  'crop.maize': {
    en: 'Maize', fr: 'Maïs', sw: 'Mahindi', ha: 'Masara', tw: 'Aburo',
  },
  'crop.rice': {
    en: 'Rice', fr: 'Riz', sw: 'Mpunga', ha: 'Shinkafa', tw: 'Emo',
  },
  'crop.beans': {
    en: 'Beans', fr: 'Haricots', sw: 'Maharage', ha: 'Wake', tw: 'Adua',
  },
  'crop.coffee': {
    en: 'Coffee', fr: 'Café', sw: 'Kahawa', ha: 'Kofi', tw: 'Kɔfe',
  },
  'crop.cassava': {
    en: 'Cassava', fr: 'Manioc', sw: 'Muhogo', ha: 'Rogo', tw: 'Bankye',
  },
  'crop.banana': {
    en: 'Banana', fr: 'Banane', sw: 'Ndizi', ha: 'Ayaba', tw: 'Kwadu',
  },
  'crop.wheat': {
    en: 'Wheat', fr: 'Blé', sw: 'Ngano', ha: 'Alkama', tw: 'Atooko',
  },
  'crop.sorghum': {
    en: 'Sorghum', fr: 'Sorgho', sw: 'Mtama', ha: 'Dawa', tw: 'Atooko-kakraba',
  },
  'crop.tomato': {
    en: 'Tomato', fr: 'Tomate', sw: 'Nyanya', ha: 'Tumatir', tw: 'Ntosi',
  },
  'crop.potato': {
    en: 'Potato', fr: 'Pomme de terre', sw: 'Viazi', ha: 'Dankali', tw: 'Borɔdeɛ',
  },
  'crop.tea': {
    en: 'Tea', fr: 'Thé', sw: 'Chai', ha: 'Shayi', tw: 'Tii',
  },
  'crop.sweetPotato': {
    en: 'Sweet Potato', fr: 'Patate douce', sw: 'Viazi vitamu', ha: 'Dankali mai zaƙi', tw: 'Atadwe',
  },
  'crop.mango': {
    en: 'Mango', fr: 'Mangue', sw: 'Embe', ha: 'Mangwaro', tw: 'Mango',
  },
  'crop.groundnut': {
    en: 'Groundnut', fr: 'Arachide', sw: 'Karanga', ha: 'Gyada', tw: 'Nkatee',
  },
  'crop.sugarcane': {
    en: 'Sugarcane', fr: 'Canne à sucre', sw: 'Miwa', ha: 'Rake', tw: 'Ahwede',
  },
  'crop.cotton': {
    en: 'Cotton', fr: 'Coton', sw: 'Pamba', ha: 'Auduga', tw: 'Asaawa',
  },
  'crop.enterYourCrop': {
    en: 'Please enter your crop name', fr: 'Veuillez saisir le nom de votre culture', sw: 'Tafadhali andika jina la mazao yako', ha: 'Da fatan za a shigar da sunan amfanin gonarku', tw: 'Yɛsrɛ wo, hyɛ w\'nnɔbae din',
  },

  // ═══════════════════════════════════════════════════════════
  //  PROCESSING — OnboardingWizard ProcessingStep labels
  // ═══════════════════════════════════════════════════════════

  'processing.creatingProfile': {
    en: 'Creating your farm profile', fr: 'Création de votre profil', sw: 'Kuunda wasifu wa shamba', ha: 'Ana ƙirƙira bayanan gonarku', tw: 'Yɛ wo afuo ho nsɛm',
  },
  'processing.settingUpCrop': {
    en: 'Setting up crop tracking', fr: 'Configuration du suivi', sw: 'Kuweka ufuatiliaji mazao', ha: 'Saita bibiyar amfanin gona', tw: 'Fa nnɔbae akyerɛ so',
  },
  'processing.preparingRecs': {
    en: 'Preparing recommendations', fr: 'Préparation des conseils', sw: 'Kuandaa mapendekezo', ha: 'Shirya shawarwari', tw: 'Yɛ akwankyerɛ',
  },
  'processing.settingUp': {
    en: 'Setting up your farm...', fr: 'Configuration de votre ferme...', sw: 'Kuandaa shamba lako...', ha: 'Ana shirya gonarku...', tw: 'Yɛ wo afuo...',
  },
  'processing.takingLonger': {
    en: 'Taking longer than expected', fr: 'Prend plus de temps que prévu', sw: 'Inachukua muda zaidi', ha: 'Ana ɗaukar lokaci fiye da yadda aka zata', tw: 'Ɛregye bere pii',
  },
  'processing.dataSavedWait': {
    en: 'Your data is saved. You can wait or go back and try again.', fr: 'Vos données sont sauvegardées. Attendez ou réessayez.', sw: 'Data yako imehifadhiwa. Subiri au rudi ujaribu tena.', ha: 'An ajiye bayananku. Jira ko koma ka gwada.', tw: 'Wo nsɛm abodin. Twɛn anaasɛ san kɔ yɛ bio.',
  },
  'processing.goBack': {
    en: 'Go Back', fr: 'Retour', sw: 'Rudi', ha: 'Koma', tw: 'San kɔ',
  },
  'processing.noConnection': {
    en: 'No connection', fr: 'Pas de connexion', sw: 'Hakuna mtandao', ha: 'Babu haɗi', tw: 'Nkitahodi biara nni hɔ',
  },
  'processing.somethingWrong': {
    en: 'Something went wrong', fr: 'Une erreur est survenue', sw: 'Hitilafu imetokea', ha: 'Wani abu ya faru', tw: 'Biribi akɔ basaa',
  },
  'processing.retryWhenOnline': {
    en: 'Retry When Online', fr: 'Réessayer en ligne', sw: 'Jaribu tena ukiwa mtandaoni', ha: 'Gwada idan akwai haɗi', tw: 'Yɛ bio wɔ intanɛt so',
  },

  // ═══════════════════════════════════════════════════════════
  //  PROGRESS STAGES — FarmerProgressTab stage/class labels
  // ═══════════════════════════════════════════════════════════

  'stageLabel.prePlanting': {
    en: 'Pre-Planting', fr: 'Pré-plantation', sw: 'Kabla ya Kupanda', ha: 'Kafin Dasa', tw: 'Ansa Dua',
  },
  'stageLabel.planting': {
    en: 'Planting', fr: 'Plantation', sw: 'Kupanda', ha: 'Dasa', tw: 'Dua',
  },
  'stageLabel.vegetative': {
    en: 'Vegetative', fr: 'Végétatif', sw: 'Ukuaji', ha: 'Girma', tw: 'Nyin',
  },
  'stageLabel.flowering': {
    en: 'Flowering', fr: 'Floraison', sw: 'Kuchanua', ha: 'Fure', tw: 'Nhwiren',
  },
  'stageLabel.harvest': {
    en: 'Harvest', fr: 'Récolte', sw: 'Mavuno', ha: 'Girbi', tw: 'Twabere',
  },
  'stageLabel.postHarvest': {
    en: 'Post-Harvest', fr: 'Post-récolte', sw: 'Baada ya Mavuno', ha: 'Bayan Girbi', tw: 'Twabere Akyi',
  },
  'classLabel.onTrack': {
    en: 'On Track', fr: 'En bonne voie', sw: 'Njia sahihi', ha: 'A kan hanya', tw: 'Ɛrekɔ yie',
  },
  'classLabel.slightDelay': {
    en: 'Slight Delay', fr: 'Léger retard', sw: 'Ucheleweshaji kidogo', ha: 'Ɗan jinkiri', tw: 'Ɛretwe kakra',
  },
  'classLabel.atRisk': {
    en: 'At Risk', fr: 'À risque', sw: 'Hatarini', ha: 'Cikin haɗari', tw: 'Asiane mu',
  },
  'classLabel.critical': {
    en: 'Critical', fr: 'Critique', sw: 'Muhimu', ha: 'Mai mahimmanci', tw: 'Ɛho hia pa',
  },

  // ═══════════════════════════════════════════════════════════
  //  ACTIVITY — FarmerProgressTab activity options
  // ═══════════════════════════════════════════════════════════

  'activity.planting': {
    en: 'Planting', fr: 'Plantation', sw: 'Kupanda', ha: 'Dasa', tw: 'Dua',
  },
  'activity.spraying': {
    en: 'Spraying', fr: 'Pulvérisation', sw: 'Kunyunyizia', ha: 'Fesa', tw: 'Pete aduro',
  },
  'activity.fertilizing': {
    en: 'Fertilizing', fr: 'Fertilisation', sw: 'Kuweka mbolea', ha: 'Taki', tw: 'Fa sradeɛ gu so',
  },
  'activity.irrigation': {
    en: 'Irrigation', fr: 'Irrigation', sw: 'Umwagiliaji', ha: 'Ban ruwa', tw: 'Nsuo gu so',
  },
  'activity.weeding': {
    en: 'Weeding', fr: 'Désherbage', sw: 'Kupalilia', ha: 'Cire ciyawa', tw: 'Tu wura',
  },
  'activity.harvesting': {
    en: 'Harvesting', fr: 'Récolte', sw: 'Kuvuna', ha: 'Girbi', tw: 'Twa',
  },
  'activity.storage': {
    en: 'Storage', fr: 'Stockage', sw: 'Kuhifadhi', ha: 'Ajiye', tw: 'Kora',
  },
  'activity.selling': {
    en: 'Selling', fr: 'Vente', sw: 'Kuuza', ha: 'Sayarwa', tw: 'Tɔn',
  },
  'activity.other': {
    en: 'Other', fr: 'Autre', sw: 'Nyingine', ha: 'Wani', tw: 'Foforo',
  },

  // ═══════════════════════════════════════════════════════════
  //  IMAGE STAGE — FarmerProgressTab image stage options
  // ═══════════════════════════════════════════════════════════

  'imageStage.earlyGrowth': {
    en: 'Early Growth', fr: 'Croissance initiale', sw: 'Ukuaji mapema', ha: 'Farkon girma', tw: 'Mfitiase nyin',
  },
  'imageStage.midStage': {
    en: 'Mid Stage', fr: 'Milieu de cycle', sw: 'Katikati', ha: 'Tsakiya', tw: 'Mfimfini',
  },
  'imageStage.preHarvest': {
    en: 'Pre-Harvest', fr: 'Pré-récolte', sw: 'Kabla ya mavuno', ha: 'Kafin girbi', tw: 'Ansa twabere',
  },
  'imageStage.harvest': {
    en: 'Harvest', fr: 'Récolte', sw: 'Mavuno', ha: 'Girbi', tw: 'Twabere',
  },
  'imageStage.storage': {
    en: 'Storage', fr: 'Stockage', sw: 'Kuhifadhi', ha: 'Ajiye', tw: 'Kora',
  },

  // ═══════════════════════════════════════════════════════════
  //  ADVICE — FarmerProgressTab followed-advice options
  // ═══════════════════════════════════════════════════════════

  'advice.na': {
    en: 'N/A', fr: 'N/A', sw: 'H/H', ha: 'B/A', tw: 'N/A',
  },
  'advice.yes': {
    en: 'Yes', fr: 'Oui', sw: 'Ndiyo', ha: 'Eh', tw: 'Aane',
  },
  'advice.partial': {
    en: 'Partial', fr: 'Partiel', sw: 'Kiasi', ha: 'Wani ɓangare', tw: 'Fa bi',
  },
  'advice.no': {
    en: 'No', fr: 'Non', sw: 'Hapana', ha: "A'a", tw: 'Daabi',
  },

  // ═══════════════════════════════════════════════════════════
  //  REOPEN SEASON — ReopenSeasonModal
  // ═══════════════════════════════════════════════════════════

  'reopen.title': {
    en: 'Reopen Season', fr: 'Rouvrir la saison', sw: 'Fungua tena msimu', ha: 'Sake buɗe lokaci', tw: 'Bue bere no bio',
  },
  'reopen.sodRequired': {
    en: 'Separation of Duties required', fr: 'Séparation des fonctions requise', sw: 'Utengano wa kazi unahitajika', ha: 'Ana buƙatar rabuwar aiki', tw: 'Ɛsɛ sɛ adwuma mu nkyekyɛmu',
  },
  'reopen.sodExplain': {
    en: 'Reopening a season requires a second admin\'s approval.', fr: 'Rouvrir une saison nécessite l\'approbation d\'un second administrateur.', sw: 'Kufungua tena msimu kunahitaji idhini ya msimamizi mwingine.', ha: 'Sake buɗe lokaci yana buƙatar amincewar wani admin.', tw: 'Bere no bio bue hia admin foforo kɔɔ so.',
  },
  'reopen.createRequest': {
    en: 'Create Request', fr: 'Créer une demande', sw: 'Unda ombi', ha: 'Ƙirƙiri buƙata', tw: 'Yɛ abisadeɛ',
  },
  'reopen.executeHaveId': {
    en: 'Execute (have ID)', fr: 'Exécuter (avec ID)', sw: 'Tekeleza (nina ID)', ha: 'Aiwatar (ina ID)', tw: 'Di dwuma (wɔ ID)',
  },

  // ═══════════════════════════════════════════════════════════
  //  ADMIN USERS — sub-component labels
  // ═══════════════════════════════════════════════════════════

  'adminUser.archived': {
    en: 'Archived', fr: 'Archivé', sw: 'Imehifadhiwa', ha: 'An adana', tw: 'Wɔakora',
  },
  'adminUser.disabled': {
    en: 'Disabled', fr: 'Désactivé', sw: 'Imezimwa', ha: 'An kashe', tw: 'Wɔadum',
  },
  'adminUser.active': {
    en: 'Active', fr: 'Actif', sw: 'Inatumika', ha: 'Aiki', tw: 'Ɛdi adwuma',
  },
  'adminUser.createUser': {
    en: 'Create User', fr: 'Créer un utilisateur', sw: 'Unda mtumiaji', ha: 'Ƙirƙiri mai amfani', tw: 'Yɛ odwumayɛni',
  },
  'adminUser.editUser': {
    en: 'Edit User', fr: 'Modifier l\'utilisateur', sw: 'Hariri mtumiaji', ha: 'Gyara mai amfani', tw: 'Sesa odwumayɛni',
  },
  'adminUser.fullName': {
    en: 'Full Name', fr: 'Nom complet', sw: 'Jina kamili', ha: 'Cikakken suna', tw: 'Din nyinaa',
  },
  'adminUser.email': {
    en: 'Email', fr: 'E-mail', sw: 'Barua pepe', ha: 'Imel', tw: 'Email',
  },
  'adminUser.password': {
    en: 'Password', fr: 'Mot de passe', sw: 'Nywila', ha: 'Kalmar sirri', tw: 'Ahintasɛm',
  },
  'adminUser.role': {
    en: 'Role', fr: 'Rôle', sw: 'Jukumu', ha: 'Matsayi', tw: 'Dwuma',
  },
  'adminUser.language': {
    en: 'Language', fr: 'Langue', sw: 'Lugha', ha: 'Harshe', tw: 'Kasa',
  },
  'adminUser.resetPassword': {
    en: 'Reset Password', fr: 'Réinitialiser le mot de passe', sw: 'Weka upya nywila', ha: 'Sake saita kalmar sirri', tw: 'Fa ahintasɛm foforo',
  },
  'adminUser.newPassword': {
    en: 'New Password', fr: 'Nouveau mot de passe', sw: 'Nywila mpya', ha: 'Sabuwar kalmar sirri', tw: 'Ahintasɛm foforo',
  },
  'adminUser.archiveUser': {
    en: 'Archive User', fr: 'Archiver l\'utilisateur', sw: 'Hifadhi mtumiaji', ha: 'Adana mai amfani', tw: 'Kora odwumayɛni',
  },
  'adminUser.unarchiveUser': {
    en: 'Unarchive User', fr: 'Désarchiver', sw: 'Ondoa hifadhi', ha: 'Fitar da adana', tw: 'Yi odwumayɛni firi kora mu',
  },
  'adminUser.creating': {
    en: 'Creating...', fr: 'Création...', sw: 'Inaunda...', ha: 'Ana ƙirƙira...', tw: 'Ɛreyɛ...',
  },
  'adminUser.saving': {
    en: 'Saving...', fr: 'Enregistrement...', sw: 'Inahifadhi...', ha: 'Ana ajiye...', tw: 'Ɛrekora...',
  },
  'adminUser.confirm': {
    en: 'Confirm', fr: 'Confirmer', sw: 'Thibitisha', ha: 'Tabbatar', tw: 'Di nokware',
  },

  // ─── QuickUpdateFlow options ────────────────────────
  'quickUpdate.cropProgress': {
    en: 'Crop Progress', fr: 'Progrès culture', sw: 'Maendeleo ya mazao', ha: 'Ci gaban amfanin', tw: 'Nnɔbae nkɔso',
  },
  'quickUpdate.logStageCondition': {
    en: 'Log stage & condition', fr: 'Notez stade & état', sw: 'Rekodi hatua na hali', ha: 'Rubuta mataki da yanayi', tw: 'Kyerɛw bere ne tebea',
  },
  'quickUpdate.uploadPhoto': {
    en: 'Upload Photo', fr: 'Envoyer photo', sw: 'Pakia picha', ha: 'Ɗora hoto', tw: 'Fa foto',
  },
  'quickUpdate.takeAFarmPhoto': {
    en: 'Take a farm photo', fr: 'Prenez une photo', sw: 'Piga picha ya shamba', ha: 'Ɗauki hoton gona', tw: 'Fa mfuw foto',
  },
  'quickUpdate.reportIssue': {
    en: 'Report Issue', fr: 'Signaler problème', sw: 'Ripoti tatizo', ha: 'Rahoto matsala', tw: 'Ka asɛm',
  },
  'quickUpdate.pestDiseaseWeather': {
    en: 'Pest, disease, weather', fr: 'Ravageur, maladie, météo', sw: 'Wadudu, ugonjwa, hali ya hewa', ha: 'Kwari, cuta, yanayi', tw: 'Mmoa, yare, ewiem',
  },
  'quickUpdate.planting': {
    en: 'Planting', fr: 'Plantation', sw: 'Kupanda', ha: 'Shuka', tw: 'Dua',
  },
  'quickUpdate.growing': {
    en: 'Growing', fr: 'Croissance', sw: 'Inakua', ha: 'Girma', tw: 'Ɛrenyin',
  },
  'quickUpdate.flowering': {
    en: 'Flowering', fr: 'Floraison', sw: 'Kuchanua', ha: 'Fure', tw: 'Nhwiren',
  },
  'quickUpdate.harvesting': {
    en: 'Harvesting', fr: 'Récolte', sw: 'Kuvuna', ha: 'Girbi', tw: 'Twabere',
  },
  'quickUpdate.good': {
    en: 'Good', fr: 'Bon', sw: 'Nzuri', ha: 'Mai kyau', tw: 'Eye',
  },
  'quickUpdate.okay': {
    en: 'Okay', fr: 'Correct', sw: 'Sawa', ha: 'To', tw: 'Ɛyɛ',
  },
  'quickUpdate.problem': {
    en: 'Problem', fr: 'Problème', sw: 'Tatizo', ha: 'Matsala', tw: 'Ɔhaw',
  },

  // ─── FarmerProgressTab success/error messages ───────
  'progress.seasonCreated': {
    en: 'Season created. You can now start logging activities.', fr: 'Saison créée. Vous pouvez commencer les activités.', sw: 'Msimu umeundwa. Unaweza kuanza shughuli.', ha: 'An ƙirƙiri lokaci. Kuna iya fara ayyuka.', tw: 'Bere no ayɛ. Wubɛtumi ahyɛ adwuma ase.',
  },
  'progress.createSeasonError': {
    en: 'Failed to create season. Please check your details and try again.', fr: 'Erreur de création. Vérifiez vos données et réessayez.', sw: 'Imeshindikana kuunda msimu. Angalia taarifa na ujaribu tena.', ha: 'Ba a iya ƙirƙirar lokaci ba. Ka duba bayanai ka sake gwadawa.', tw: 'Ɛnyɛɛ yie. Hwɛ wo nsɛm na san bɔ mmɔden.',
  },
  'progress.firstActivityRecorded': {
    en: 'Update submitted — your first activity is recorded!', fr: 'Mise à jour soumise — première activité enregistrée !', sw: 'Sasisho limetumwa — shughuli yako ya kwanza imerekodiwa!', ha: 'An aika sabuntawa — an rubuta aikin ku na farko!', tw: 'Wɔde ama — w\'adwuma a edi kan no wɔakyerɛw!',
  },
  'progress.activityRecorded': {
    en: 'Update submitted. Activity recorded successfully.', fr: 'Mise à jour soumise. Activité enregistrée.', sw: 'Sasisho limetumwa. Shughuli imerekodiwa.', ha: 'An aika sabuntawa. An rubuta aiki.', tw: 'Wɔde ama. Wɔakyerɛw adwuma no.',
  },
  'progress.saveActivityError': {
    en: 'Failed to save activity. Your entry is saved locally — please try again.', fr: 'Erreur de sauvegarde. Vos données sont enregistrées localement — réessayez.', sw: 'Imeshindikana kuhifadhi. Data yako imehifadhiwa — jaribu tena.', ha: 'Ba a iya ajiyewa ba. An ajiye a cikin na\'ura — sake gwadawa.', tw: 'Ɛnyɛɛ yie. W\'asɛm no wɔ ha — san bɔ mmɔden.',
  },
  'progress.conditionSaved': {
    en: 'Condition update saved.', fr: 'État de la culture sauvegardé.', sw: 'Hali ya mazao imehifadhiwa.', ha: 'An ajiye yanayin amfanin.', tw: 'Wɔakora tebea no.',
  },
  'progress.conditionError': {
    en: 'Failed to save condition update. Please check your connection and try again.', fr: 'Erreur de sauvegarde. Vérifiez votre connexion et réessayez.', sw: 'Imeshindikana kuhifadhi hali. Angalia mtandao na ujaribu tena.', ha: 'Ba a iya ajiyewa ba. Ka duba haɗin ku ka sake gwadawa.', tw: 'Ɛnyɛɛ yie. Hwɛ wo ntam na san bɔ mmɔden.',
  },
  'progress.stageConfirmed': {
    en: 'Stage confirmed.', fr: 'Stade confirmé.', sw: 'Hatua imethibitishwa.', ha: 'An tabbatar da mataki.', tw: 'Wɔadi bere no nokware.',
  },
  'progress.stageError': {
    en: 'Failed to save stage confirmation. Please check your connection and try again.', fr: 'Erreur de confirmation. Vérifiez votre connexion et réessayez.', sw: 'Imeshindikana kuthibitisha hatua. Angalia mtandao na ujaribu tena.', ha: 'Ba a iya tabbatar ba. Ka duba haɗin ku ka sake gwadawa.', tw: 'Ɛnyɛɛ yie. Hwɛ wo ntam na san bɔ mmɔden.',
  },
  'progress.harvestSubmitted': {
    en: 'Harvest report submitted.', fr: 'Rapport de récolte soumis.', sw: 'Ripoti ya mavuno imetumwa.', ha: 'An aika rahoton girbi.', tw: 'Wɔde otwa ho amanneɛ ama.',
  },
  'progress.harvestError': {
    en: 'Failed to submit harvest report. Please check your connection and try again.', fr: 'Erreur de soumission du rapport. Vérifiez votre connexion et réessayez.', sw: 'Imeshindikana kutuma ripoti ya mavuno. Angalia mtandao na ujaribu tena.', ha: 'Ba a iya aika rahoton girbi ba. Ka duba haɗin ku ka sake gwadawa.', tw: 'Ɛnyɛɛ yie. Hwɛ wo ntam na san bɔ mmɔden.',
  },
  'progress.photoUploaded': {
    en: 'Photo uploaded. Your progress photo has been saved.', fr: 'Photo envoyée. Votre photo a été sauvegardée.', sw: 'Picha imepakiwa. Picha yako imehifadhiwa.', ha: 'An ɗora hoto. An ajiye hoton ku.', tw: 'Wɔde foto ama. Wɔakora wo foto.',
  },
  'progress.photoError': {
    en: 'Failed to save photo. Please check the image and try again.', fr: 'Erreur de sauvegarde de la photo. Vérifiez l\'image et réessayez.', sw: 'Imeshindikana kuhifadhi picha. Angalia picha na ujaribu tena.', ha: 'Ba a iya ajiye hoto ba. Ka duba hoto ka sake gwadawa.', tw: 'Ɛnyɛɛ yie. Hwɛ foto no na san bɔ mmɔden.',
  },
  'progress.loadError': {
    en: 'Failed to load season data. Check your connection.', fr: 'Erreur de chargement. Vérifiez votre connexion.', sw: 'Imeshindikana kupakia data. Angalia mtandao.', ha: 'Ba a iya ɗaukar bayanai ba. Ka duba haɗin ku.', tw: 'Ɛnyɛɛ yie. Hwɛ wo ntam.',
  },
  'progress.updateError': {
    en: 'Failed to update season. Please try again.', fr: 'Erreur de mise à jour. Réessayez.', sw: 'Imeshindikana kusasisha. Jaribu tena.', ha: 'Ba a iya sabuntawa ba. Sake gwadawa.', tw: 'Ɛnyɛɛ yie. San bɔ mmɔden.',
  },
  'progress.updateSavedOk': {
    en: 'Update saved successfully!', fr: 'Mise à jour enregistrée !', sw: 'Sasisho limehifadhiwa!', ha: 'An ajiye sabuntawa!', tw: 'Wɔakora nsakrae no!',
  },
  'progress.duplicateWarning': {
    en: 'You already logged this activity today. Tap save again to confirm.', fr: 'Vous avez déjà enregistré cette activité aujourd\'hui. Appuyez à nouveau pour confirmer.', sw: 'Tayari umerekodia shughuli hii leo. Bonyeza tena kuthibitisha.', ha: 'Kun riga kun rubuta wannan aiki a yau. Latsa sake don tabbatarwa.', tw: 'Woakyerɛw saa adwuma yi nnɛ dada. Mia bio de adi nokware.',
  },

  // ═══════════════════════════════════════════════════════════
  //  SETUP / ONBOARDING — farm setup flow
  // ═══════════════════════════════════════════════════════════

  'setup.banner': {
    en: 'Complete your farm setup to unlock all features', fr: 'Terminez la configuration de votre ferme pour débloquer toutes les fonctionnalités', sw: 'Kamilisha usanidi wa shamba lako ili kufungua vipengele vyote', ha: 'Kammala saita gonar ka don buɗe duk abubuwa', tw: 'Wie wo afuo no nhyehyɛe na bue nneɛma nyinaa',
  },
  'setup.complete': {
    en: 'Complete Setup', fr: 'Terminer la configuration', sw: 'Kamilisha Usanidi', ha: 'Kammala Saita', tw: 'Wie Nhyehyɛe',
  },
  'setup.whatsNeeded': {
    en: 'What\'s still needed:', fr: 'Ce qui reste à faire :', sw: 'Kinachohitajika bado:', ha: 'Abin da ake buƙata har yanzu:', tw: 'Nea ehia da:',
  },
  'setup.saveTimeout': {
    en: 'Save timed out. Your data is saved locally. Try again.', fr: 'Sauvegarde expirée. Vos données sont enregistrées localement. Réessayez.', sw: 'Muda wa kuhifadhi umeisha. Data yako imehifadhiwa kwenye simu. Jaribu tena.', ha: 'Lokacin ajiye ya ƙare. An ajiye bayanan ka a wayar ka. Sake gwadawa.', tw: 'Kora no abere. Wo data no akora wɔ wo fon so. San bɔ mmɔden.',
  },
  'setup.gpsSlow': {
    en: 'Location detection is slow. You can type your location instead.', fr: 'La détection de position est lente. Vous pouvez saisir votre emplacement.', sw: 'Kutambua eneo kunachelewa. Unaweza kuandika eneo lako badala yake.', ha: 'Gano wurin yana jinkiri. Za ka iya rubuta wurin ka a maimakon haka.', tw: 'Beae no hwehwɛ rekyɛ. Wobɛtumi atwerɛ wo beae no.',
  },
  'setup.saving': {
    en: 'Saving...', fr: 'Enregistrement...', sw: 'Inahifadhi...', ha: 'Ana ajiye...', tw: 'Ɛrekora...',
  },
  'setup.saved': {
    en: 'Saved successfully', fr: 'Enregistré avec succès', sw: 'Imehifadhiwa', ha: 'An ajiye cikin nasara', tw: 'Wɔakora no yie',
  },

  // ═══════════════════════════════════════════════════════════
  //  SEASON / TASKS — season start and task management
  // ═══════════════════════════════════════════════════════════

  'season.startFailed': {
    en: 'Could not start your season. Check your connection and try again.', fr: 'Impossible de démarrer votre saison. Vérifiez votre connexion et réessayez.', sw: 'Haikuweza kuanza msimu wako. Angalia mtandao na ujaribu tena.', ha: 'Ba a iya fara daminar ka ba. Ka duba haɗin ka ka sake gwadawa.', tw: 'Ɛntumi nhyɛ wo bere no ase. Hwɛ wo ntam na san bɔ mmɔden.',
  },
  'season.starting': {
    en: 'Starting...', fr: 'Démarrage...', sw: 'Inaanza...', ha: 'Ana farawa...', tw: 'Ɛrehyɛ ase...',
  },
  'tasks.completeFailed': {
    en: 'Could not save. Try again.', fr: 'Impossible d\'enregistrer. Réessayez.', sw: 'Haikuweza kuhifadhi. Jaribu tena.', ha: 'Ba a iya ajiyewa ba. Sake gwadawa.', tw: 'Ɛntumi ankora. San bɔ mmɔden.',
  },
  'tasks.setupFirst': {
    en: 'Complete your farm setup first to unlock tasks', fr: 'Terminez d\'abord la configuration de votre ferme pour débloquer les tâches', sw: 'Kamilisha usanidi wa shamba kwanza ili kufungua kazi', ha: 'Fara kammala saita gonar ka kafin a buɗe ayyuka', tw: 'Di kan wie wo afuo nhyehyɛe na bue adwuma ahorow',
  },
  'tasks.doToday': {
    en: 'Do today', fr: 'À faire aujourd\'hui', sw: 'Fanya leo', ha: 'Yi yau', tw: 'Yɛ nnɛ',
  },
  'tasks.doSoon': {
    en: 'Do soon', fr: 'À faire bientôt', sw: 'Fanya karibuni', ha: 'Yi ba da jimawa ba', tw: 'Yɛ ntɛm',
  },
  'tasks.checkLater': {
    en: 'Check later', fr: 'Vérifier plus tard', sw: 'Angalia baadaye', ha: 'Duba daga baya', tw: 'Hwɛ akyire',
  },

  // ═══════════════════════════════════════════════════════════
  //  OFFLINE / SYNC — connectivity and sync status
  // ═══════════════════════════════════════════════════════════

  'offline.savedLocally': {
    en: 'Offline — your work is saved locally', fr: 'Hors ligne — votre travail est enregistré localement', sw: 'Nje ya mtandao — kazi yako imehifadhiwa kwenye simu', ha: 'Babu yanar gizo — an ajiye aikin ka a wayar ka', tw: 'Wo nni intanɛt — wo adwuma akora wɔ wo fon so',
  },
  'offline.pendingSync': {
    en: '{count} unsaved changes waiting to sync', fr: '{count} modifications en attente de synchronisation', sw: '{count} mabadiliko yanasubiri kusawazishwa', ha: '{count} canje-canje suna jiran haɗawa', tw: '{count} nsakrae retwɛn sync',
  },
  'offline.willSync': {
    en: 'Changes will sync automatically when you reconnect', fr: 'Les modifications se synchroniseront automatiquement à la reconnexion', sw: 'Mabadiliko yatasawazishwa moja kwa moja utakapounganishwa tena', ha: 'Canje-canje za su haɗu da kansu idan ka sami haɗi', tw: 'Nsakrae no bɛyɛ sync ankasa sɛ wo san ka bom',
  },
  'offline.syncing': {
    en: 'Syncing...', fr: 'Synchronisation...', sw: 'Inasawazisha...', ha: 'Ana haɗawa...', tw: 'Ɛre-sync...',
  },
  'offline.synced': {
    en: 'All changes synced', fr: 'Toutes les modifications sont synchronisées', sw: 'Mabadiliko yote yamesawazishwa', ha: 'An haɗa duk canje-canje', tw: 'Nsakrae nyinaa ayɛ sync',
  },
  'offline.failed': {
    en: 'Sync failed. Your data is safe locally.', fr: 'Échec de synchronisation. Vos données sont en sécurité localement.', sw: 'Kusawazisha kumeshindikana. Data yako iko salama kwenye simu.', ha: 'Haɗawa ta gaza. Bayanan ka suna lafiya a wayar ka.', tw: 'Sync no annyɛ yie. Wo data no te asomdwoe wɔ wo fon so.',
  },
  'offline.retrying': {
    en: 'Retrying...', fr: 'Nouvelle tentative...', sw: 'Inajaribu tena...', ha: 'Ana sake gwadawa...', tw: 'Ɛresan ahwehwɛ...',
  },

  // ═══════════════════════════════════════════════════════════
  //  COMMON (continued) — additional shared labels
  // ═══════════════════════════════════════════════════════════

  'common.error': {
    en: 'Something went wrong', fr: 'Une erreur est survenue', sw: 'Kuna tatizo limetokea', ha: 'Wani abu bai dace ba', tw: 'Biribi akɔ basaa',
  },
  'common.success': {
    en: 'Success', fr: 'Succès', sw: 'Imefanikiwa', ha: 'Nasara', tw: 'Ɛyɛɛ yie',
  },

  // ═══════════════════════════════════════════════════════════
  //  ERRORS (continued) — additional error messages
  // ═══════════════════════════════════════════════════════════

  'error.network': {
    en: 'Check your internet connection', fr: 'Vérifiez votre connexion internet', sw: 'Angalia muunganisho wako wa intaneti', ha: 'Ka duba haɗin yanar gizon ka', tw: 'Hwɛ wo intanɛt so',
  },
  'error.uploadFailed': {
    en: 'Upload failed. Tap retry.', fr: 'Échec de l\'envoi. Appuyez sur réessayer.', sw: 'Kupakia kumeshindikana. Bonyeza jaribu tena.', ha: 'Ɗora ya gaza. Latsa sake gwadawa.', tw: 'Upload no annyɛ yie. Mia san hwehwe.',
  },
  'error.missingField': {
    en: 'This field is required', fr: 'Ce champ est obligatoire', sw: 'Sehemu hii inahitajika', ha: 'Wannan filin ana buƙata', tw: 'Saa beae yi ho hia',
  },
  'error.inviteExpired': {
    en: 'Invite expired. Ask for a new one.', fr: 'Invitation expirée. Demandez-en une nouvelle.', sw: 'Mwaliko umeisha muda. Omba mpya.', ha: 'Gayyatar ta ƙare. Ka nemi sabuwa.', tw: 'Akwankyerɛ no abere. Srɛ foforɔ.',
  },

  // ─── Land Boundary ────────────────────────────────────────────
  'boundary.title': {
    en: 'Map your farm boundary', fr: 'Cartographier les limites de votre ferme', sw: 'Weka mipaka ya shamba lako', ha: 'Zana iyakar gonarku', tw: 'Fa wo mfuo no hyɛ map so',
  },
  'boundary.desc': {
    en: 'Walk around your farm or drop points to mark the edges.', fr: 'Faites le tour de votre ferme ou placez des points pour marquer les bords.', sw: 'Tembea kuzunguka shamba lako au weka alama za mipaka.', ha: 'Yi yawo a gonarku ko sanya alamomi a gefenmu.', tw: 'Nante fa wo mfuo no ho anaa fa nsɛnkyerɛnne to ano.',
  },
  'boundary.methodWalk': {
    en: 'GPS walk', fr: 'Marche GPS', sw: 'Tembea na GPS', ha: 'Tafiya da GPS', tw: 'GPS nantew',
  },
  'boundary.methodPin': {
    en: 'Drop points', fr: 'Placer des points', sw: 'Weka alama', ha: 'Sanya alamomi', tw: 'Fa nsɛnkyerɛnne to hɔ',
  },
  'boundary.methodFallback': {
    en: 'Estimate', fr: 'Estimer', sw: 'Kadiria', ha: 'Kiyasta', tw: 'Susu',
  },
  'boundary.startWalk': {
    en: 'Start walking the boundary', fr: 'Commencer la marche', sw: 'Anza kutembea mipaka', ha: 'Fara tafiya iyaka', tw: 'Hyɛ ase nante',
  },
  'boundary.stopWalk': {
    en: 'Stop walk', fr: 'Arrêter', sw: 'Simama', ha: 'Tsaya', tw: 'Gyae',
  },
  'boundary.addPoint': {
    en: 'Add point at my location', fr: 'Ajouter un point à ma position', sw: 'Ongeza alama mahali pangu', ha: 'Ƙara alama a wurina', tw: 'Fa nsɛnkyerɛnne ka me beae ho',
  },
  'boundary.gettingGPS': {
    en: 'Getting your location...', fr: 'Obtention de votre position...', sw: 'Kupata eneo lako...', ha: 'Ana neman wurinku...', tw: 'Rehwehwe wo beae...',
  },
  'boundary.points': {
    en: 'points', fr: 'points', sw: 'alama', ha: 'alamomi', tw: 'nsɛnkyerɛnne',
  },
  'boundary.minPoints': {
    en: 'At least 3 points are needed.', fr: 'Au moins 3 points sont nécessaires.', sw: 'Angalau alama 3 zinahitajika.', ha: 'Aƙalla alamomi 3 ana buƙata.', tw: 'Nsɛnkyerɛnne 3 na ehia.',
  },
  'boundary.saving': {
    en: 'Saving boundary...', fr: 'Enregistrement des limites...', sw: 'Kuhifadhi mipaka...', ha: 'Ana adana iyaka...', tw: 'Rehyehyɛ boundary...',
  },
  'boundary.saveBoundary': {
    en: 'Save boundary', fr: 'Enregistrer les limites', sw: 'Hifadhi mipaka', ha: 'Adana iyaka', tw: 'Hyehyɛ boundary',
  },
  'boundary.saved': {
    en: 'Boundary saved successfully!', fr: 'Limites enregistrées!', sw: 'Mipaka imehifadhiwa!', ha: 'An adana iyaka!', tw: 'Wɔahyehyɛ boundary no!',
  },
  'boundary.saveFailed': {
    en: 'Failed to save boundary. Try again.', fr: 'Échec de l\'enregistrement. Réessayez.', sw: 'Imeshindwa kuhifadhi. Jaribu tena.', ha: 'Adanawa ya gaza. Sake gwadawa.', tw: 'Anhyehyɛ yie. San hwehwe.',
  },
  'boundary.mapped': {
    en: 'Farm boundary mapped', fr: 'Limites cartographiées', sw: 'Mipaka ya shamba imechorwa', ha: 'An zana iyakar gona', tw: 'Wɔakyerɛ mfuo no so',
  },
  'boundary.noGPS': {
    en: 'GPS not available on this device.', fr: 'GPS non disponible.', sw: 'GPS haipatikani.', ha: 'GPS ba ya samu ba.', tw: 'GPS nni saa kɔmputa yi so.',
  },
  'boundary.gpsFailed': {
    en: 'Could not get location. Move to an open area and try again.', fr: 'Impossible d\'obtenir la position. Déplacez-vous et réessayez.', sw: 'Imeshindwa kupata eneo. Nenda eneo wazi na jaribu tena.', ha: 'Ba a iya samu wuri ba. Je wuri mai sarari ka sake gwadawa.', tw: 'Antumi anya beae. Kɔ beae a abue na san hwehwe.',
  },

  // ─── Seed Scan ────────────────────────────────────────────────
  'seedScan.title': {
    en: 'Record your seeds', fr: 'Enregistrer vos semences', sw: 'Andika mbegu zako', ha: 'Rubuta irin ku', tw: 'Kyerɛw wo aba ho nsɛm',
  },
  'seedScan.desc': {
    en: 'Scan the packet or enter seed details to help verify quality.', fr: 'Scannez le paquet ou entrez les détails des semences.', sw: 'Scan pakiti au ingiza maelezo ya mbegu.', ha: 'Duba fakiti ko shigar da bayanin iri.', tw: 'Scan packet no anaasɛ kyerɛw aba no ho nsɛm.',
  },
  'seedScan.scanPacket': {
    en: 'Scan seed packet', fr: 'Scanner le paquet', sw: 'Scan pakiti ya mbegu', ha: 'Duba fakitin iri', tw: 'Scan aba packet',
  },
  'seedScan.or': {
    en: '— or —', fr: '— ou —', sw: '— au —', ha: '— ko —', tw: '— anaa —',
  },
  'seedScan.enterManually': {
    en: 'Enter seed details manually', fr: 'Saisir manuellement', sw: 'Ingiza kwa mikono', ha: 'Shigar da hannu', tw: 'Kyerɛw wo nsa so',
  },
  'seedScan.seedTypeLabel': {
    en: 'Seed type', fr: 'Type de semence', sw: 'Aina ya mbegu', ha: 'Irin iri', tw: 'Aba no ahorow',
  },
  'seedScan.selectSeed': {
    en: 'Select seed type...', fr: 'Sélectionner...', sw: 'Chagua aina ya mbegu...', ha: 'Zaɓi irin iri...', tw: 'Yi aba ahorow...',
  },
  'seedScan.varietyLabel': {
    en: 'Variety (optional)', fr: 'Variété (optionnel)', sw: 'Aina ndogo (si lazima)', ha: 'Nau\'i (ba dole ba)', tw: 'Ahorow (ɛnyɛ dɛ ɛsɛ)',
  },
  'seedScan.varietyPlaceholder': {
    en: 'e.g. ObaatanPa, WITA-9', fr: 'ex. ObaatanPa, WITA-9', sw: 'mf. ObaatanPa, WITA-9', ha: 'mis. ObaatanPa, WITA-9', tw: 'e.g. ObaatanPa, WITA-9',
  },
  'seedScan.supplierLabel': {
    en: 'Supplier (optional)', fr: 'Fournisseur (optionnel)', sw: 'Msambazaji (si lazima)', ha: 'Mai sayarwa (ba dole ba)', tw: 'Obi a ɔtɔn (ɛnyɛ dɛ ɛsɛ)',
  },
  'seedScan.supplierPlaceholder': {
    en: 'e.g. Agro dealer name', fr: 'ex. Nom du fournisseur', sw: 'mf. Jina la muuzaji', ha: 'mis. Sunan dillan noma', tw: 'e.g. Agro dealer din',
  },
  'seedScan.batchLabel': {
    en: 'Batch number (optional)', fr: 'Numéro de lot (optionnel)', sw: 'Nambari ya kundi (si lazima)', ha: 'Lambar fakiti (ba dole ba)', tw: 'Batch nɔma (ɛnyɛ dɛ ɛsɛ)',
  },
  'seedScan.batchPlaceholder': {
    en: 'e.g. LOT-2025-001', fr: 'ex. LOT-2025-001', sw: 'mf. LOT-2025-001', ha: 'mis. LOT-2025-001', tw: 'e.g. LOT-2025-001',
  },
  'seedScan.expiryLabel': {
    en: 'Expiry date (optional)', fr: 'Date d\'expiration (optionnel)', sw: 'Tarehe ya kuisha (si lazima)', ha: 'Ranar ƙarewa (ba dole ba)', tw: 'Da a ɛbɛba awieɛ (ɛnyɛ dɛ ɛsɛ)',
  },
  'seedScan.saving': {
    en: 'Saving...', fr: 'Enregistrement...', sw: 'Kuhifadhi...', ha: 'Ana adanawa...', tw: 'Rehyehyɛ...',
  },
  'seedScan.save': {
    en: 'Save seed record', fr: 'Enregistrer', sw: 'Hifadhi', ha: 'Adana', tw: 'Hyehyɛ',
  },
  'seedScan.saved': {
    en: 'Seed record saved!', fr: 'Semence enregistrée!', sw: 'Rekodi ya mbegu imehifadhiwa!', ha: 'An adana bayanan iri!', tw: 'Wɔahyehyɛ aba no ho nsɛm!',
  },
  'seedScan.saveFailed': {
    en: 'Failed to save. Try again.', fr: 'Échec. Réessayez.', sw: 'Imeshindwa. Jaribu tena.', ha: 'Ya gaza. Sake gwadawa.', tw: 'Anhyehyɛ yie. San hwehwe.',
  },
  'seedScan.seedTypeRequired': {
    en: 'Please select a seed type.', fr: 'Veuillez sélectionner un type.', sw: 'Tafadhali chagua aina ya mbegu.', ha: 'Da fatan zaɓi irin iri.', tw: 'Yɛsrɛ wo yi aba ahorow.',
  },
  'seedScan.scanAnother': {
    en: 'Record another seed', fr: 'Enregistrer un autre', sw: 'Andika mbegu nyingine', ha: 'Rubuta wani iri', tw: 'Kyerɛw aba foforɔ',
  },
  'seedScan.unknown': {
    en: 'Unknown', fr: 'Inconnu', sw: 'Haijulikani', ha: 'Ba a sani ba', tw: 'Wonnim',
  },
  'seedScan.skip': {
    en: 'Skip for now', fr: 'Passer pour le moment', sw: 'Ruka kwa sasa', ha: 'Tsallake yanzu', tw: 'Twa mu mprempren',
  },
  'seedScan.offlineHint': {
    en: 'You are offline. You can record seeds when internet returns.', fr: 'Vous êtes hors ligne. Enregistrez quand internet revient.', sw: 'Huna mtandao. Andika mbegu wakati mtandao utakapo rudi.', ha: 'Ba ku kan layi ba. Rubuta iri lokacin da intanet ta dawo.', tw: 'Wonnii intanɛt. Kyerɛw aba bere a intanɛt bɛsan aba.',
  },
  'seedScan.offlineSave': {
    en: 'Cannot save while offline. Try again when internet returns.', fr: 'Impossible hors ligne. Réessayez avec internet.', sw: 'Haiwezi kuhifadhi bila mtandao. Jaribu tena wakati mtandao utakapokuwepo.', ha: 'Ba za a adana ba tare da intanet. Sake gwadawa lokacin da intanet ta dawo.', tw: 'Entumi nhyehyɛ a wonnii intanɛt. San hwehwe bere a intanɛt bɛba.',
  },
  'seedScan.statusOk': {
    en: 'OK', fr: 'OK', sw: 'Sawa', ha: 'Lafiya', tw: 'Yɛ',
  },
  'seedScan.statusCheck': {
    en: 'Check', fr: 'Vérifier', sw: 'Angalia', ha: 'Duba', tw: 'Hwɛ',
  },
  'seedScan.statusProblem': {
    en: 'Problem', fr: 'Problème', sw: 'Tatizo', ha: 'Matsala', tw: 'Ɔhaw',
  },
  'seedScan.statusPending': {
    en: 'Pending', fr: 'En attente', sw: 'Inasubiri', ha: 'Ana jira', tw: 'Retwɛn',
  },

  // ─── Boundary — additional guardrail keys ─────────────────────
  'boundary.skip': {
    en: 'Skip for now', fr: 'Passer pour le moment', sw: 'Ruka kwa sasa', ha: 'Tsallake yanzu', tw: 'Twa mu mprempren',
  },
  'boundary.recorded': {
    en: 'recorded', fr: 'enregistrés', sw: 'zimerekodiwa', ha: 'an rubuta', tw: 'wɔakyerɛw',
  },
  'boundary.offlineHint': {
    en: 'You are offline. You can map your boundary when internet returns.', fr: 'Vous êtes hors ligne. Cartographiez quand internet revient.', sw: 'Huna mtandao. Weka mipaka wakati mtandao utakapo rudi.', ha: 'Ba ku kan layi ba. Zana iyaka lokacin da intanet ta dawo.', tw: 'Wonnii intanɛt. Fa wo mfuo hyɛ map so bere a intanɛt bɛsan aba.',
  },
  'boundary.offlineSave': {
    en: 'Cannot save while offline. Try again when internet returns.', fr: 'Impossible hors ligne. Réessayez avec internet.', sw: 'Haiwezi kuhifadhi bila mtandao. Jaribu tena wakati mtandao utakapokuwepo.', ha: 'Ba za a adana ba tare da intanet. Sake gwadawa lokacin da intanet ta dawo.', tw: 'Entumi nhyehyɛ a wonnii intanɛt. San hwehwe bere a intanɛt bɛba.',
  },

  // ═══════════════════════════════════════════════════════════
  //  SUPPLY READINESS — buyer-connection layer
  // ═══════════════════════════════════════════════════════════

  'supply.title': {
    en: 'Ready to Sell?', fr: 'Prêt à vendre ?', sw: 'Uko tayari kuuza?', ha: 'Ka shirya sayarwa?', tw: 'Woapɛ sɛ wotɔn?',
  },
  'supply.desc': {
    en: 'Tell us if your harvest is ready for buyers. This helps connect you to market.', fr: 'Dites-nous si votre récolte est prête pour les acheteurs.', sw: 'Tuambie kama mavuno yako yako tayari kwa wanunuzi.', ha: 'Gaya mana ko girbin ku ya shirya don masu saye.', tw: 'Ka kyerɛ yɛn sɛ wo nnɔbae asiesie ama atɔfoɔ.',
  },
  'supply.readyQuestion': {
    en: 'Is your harvest ready to sell?', fr: 'Votre récolte est-elle prête à vendre ?', sw: 'Mavuno yako yako tayari kuuzwa?', ha: 'Girbin ku ya shirya don sayarwa?', tw: 'Wo nnɔbae asiesie sɛ wotɔn?',
  },
  'supply.quantity': {
    en: 'How much?', fr: 'Combien ?', sw: 'Kiasi gani?', ha: 'Nawa?', tw: 'Sɛn?',
  },
  'supply.harvestDate': {
    en: 'Expected harvest date', fr: 'Date de récolte prévue', sw: 'Tarehe ya mavuno', ha: 'Ranar girbi', tw: 'Nnɔbae da',
  },
  'supply.qualityNotes': {
    en: 'Quality notes (optional)', fr: 'Notes qualité (optionnel)', sw: 'Maelezo ya ubora (hiari)', ha: 'Bayanan inganci (zaɓi)', tw: 'Nneɛma a ɛfa mu ho (nhyehyɛe)',
  },
  'supply.qualityPlaceholder': {
    en: 'e.g. dried, graded, packed', fr: 'ex: séché, trié, emballé', sw: 'mfano: kavu, kupangwa, kufungwa', ha: 'misali: busasshe, an zaɓa, an kunshe', tw: 'sɛ: awo, wɔakyekyere, wɔahyehyɛ',
  },
  'supply.saved': {
    en: 'Saved! We will connect you when a buyer is ready.', fr: 'Enregistré ! Nous vous connecterons quand un acheteur sera prêt.', sw: 'Imehifadhiwa! Tutakuunganisha mnunuzi atakapokuwa tayari.', ha: 'An ajiye! Za mu haɗa ku da mai saye idan ya shirya.', tw: 'Wɔakora so! Yɛde wo bɛhyia otɔfoɔ bere a ɔsiesie.',
  },
  'supply.saveFailed': {
    en: 'Could not save. Please try again.', fr: 'Échec. Veuillez réessayer.', sw: 'Imeshindikana kuhifadhi. Tafadhali jaribu tena.', ha: 'Ba a iya adanawa ba. Da fatan a sake gwadawa.', tw: 'Entumi ankora so. Yɛsrɛ wo san hwehwe.',
  },
  'supply.readyRequired': {
    en: 'Please answer: are you ready to sell?', fr: 'Répondez : êtes-vous prêt à vendre ?', sw: 'Tafadhali jibu: uko tayari kuuza?', ha: 'Da fatan a amsa: ka shirya sayarwa?', tw: 'Yɛsrɛ wo bua: woapɛ sɛ wotɔn?',
  },
  'supply.skip': {
    en: 'Skip for now', fr: 'Passer pour le moment', sw: 'Ruka kwa sasa', ha: 'Tsallake yanzu', tw: 'Twa mu mprempren',
  },
  'supply.offlineHint': {
    en: 'You are offline. You can update your sell readiness when internet returns.', fr: 'Vous êtes hors ligne. Mettez à jour quand internet revient.', sw: 'Huna mtandao. Sasisha utayari wako wa kuuza wakati mtandao utakapo rudi.', ha: 'Ba ku kan layi ba. Sabunta shirya sayarwa ku lokacin da intanet ta dawo.', tw: 'Wonnii intanɛt. Sesa wo tɔn ho nsɛm bere a intanɛt bɛsan aba.',
  },
  'supply.offlineSave': {
    en: 'Cannot save while offline. Try again when internet returns.', fr: 'Impossible hors ligne. Réessayez avec internet.', sw: 'Haiwezi kuhifadhi bila mtandao. Jaribu tena wakati mtandao utakapokuwepo.', ha: 'Ba za a adana ba tare da intanet. Sake gwadawa lokacin da intanet ta dawo.', tw: 'Entumi nhyehyɛ a wonnii intanɛt. San hwehwe bere a intanɛt bɛba.',
  },

  // ═══════════════════════════════════════════════════════════
  //  PROFILE SETUP
  // ═══════════════════════════════════════════════════════════

  'setup.loading': {
    en: 'Loading your profile...', fr: 'Chargement du profil...', sw: 'Inapakia wasifu wako...', ha: 'Ana lodi bayanan ka...', tw: 'Ɛreload wo ho nsɛm...',
  },
  'setup.title': {
    en: 'Set Up Your Farm', fr: 'Configurez votre ferme', sw: 'Weka shamba lako', ha: 'Saita gonar ka', tw: 'Siesie wo afuo',
  },
  'setup.subtitle': {
    en: 'Tell us about your farm so we can help you grow better.', fr: 'Parlez-nous de votre ferme pour mieux vous aider.', sw: 'Tuambie kuhusu shamba lako ili tukusaidie vizuri.', ha: 'Gaya mana game da gonar ka don mu taimake ka.', tw: 'Ka wo afuo ho asɛm na yɛmmoa wo.',
  },
  'setup.voiceWelcome': {
    en: 'Welcome! Let us set up your farm profile. Fill in each field below.', fr: 'Bienvenue ! Configurons votre profil de ferme.', sw: 'Karibu! Hebu tuweke wasifu wa shamba lako.', ha: 'Barka da zuwa! Mu saita bayanan gonar ka.', tw: 'Akwaaba! Ma yɛnsiesie wo afuo ho nsɛm.',
  },
  'setup.readAloud': {
    en: 'Read aloud', fr: 'Lire à voix haute', sw: 'Soma kwa sauti', ha: 'Karanta da babbar murya', tw: 'Kenkan dennen',
  },
  'setup.completed': {
    en: 'complete', fr: 'terminé', sw: 'imekamilika', ha: 'an kammala', tw: 'wie',
  },
  'setup.yourName': {
    en: 'Your Name', fr: 'Votre nom', sw: 'Jina lako', ha: 'Sunan ka', tw: 'Wo din',
  },
  'setup.farmName': {
    en: 'Farm Name', fr: 'Nom de la ferme', sw: 'Jina la shamba', ha: 'Sunan gona', tw: 'Afuo din',
  },
  'setup.country': {
    en: 'Country', fr: 'Pays', sw: 'Nchi', ha: 'Ƙasa', tw: 'Ɔman',
  },
  'setup.village': {
    en: 'Village / Region', fr: 'Village / Région', sw: 'Mahali pa shamba', ha: 'Ƙauye / Yanki', tw: 'Akuraa / Mantam',
  },
  'setup.location': {
    en: 'Enter your location', fr: 'Entrez votre emplacement', sw: 'Mahali pa shamba', ha: 'Shigar da wurin ka', tw: 'Hyɛ wo beae',
  },
  'setup.locationPlaceholder': {
    en: 'e.g. Accra, Kumasi, Tamale', fr: 'ex. Abidjan, Dakar, Lomé', sw: 'Andika mahali pa shamba lako', ha: 'misali Kano, Abuja, Lagos', tw: 'sɛ Accra, Kumasi, Tamale',
  },
  'setup.gpsOptional': {
    en: 'Add GPS for better weather advice (optional)', fr: 'Ajoutez le GPS pour de meilleurs conseils météo (optionnel)', sw: 'Weka eneo kwa ushauri bora wa hali ya hewa (si lazima)', ha: 'Ƙara GPS don ingantaccen shawarar yanayi (na zaɓi)', tw: 'Fa GPS ka ho ma wim tebea afutuɔ pa (nhyɛ da biara)',
  },
  'setup.farmSizePlaceholder': {
    en: 'e.g. 2', fr: 'ex. 2', sw: 'mfano: 2', ha: 'misali: 2', tw: 'sɛ 2',
  },
  'setup.farmSize': {
    en: 'Farm Size', fr: 'Taille de la ferme', sw: 'Ukubwa wa shamba', ha: 'Girman gona', tw: 'Afuo kɛseɛ',
  },
  'setup.hectares': {
    en: 'hectares', fr: 'hectares', sw: 'hekta', ha: 'hekta', tw: 'hekta',
  },
  'setup.mainCrop': {
    en: 'Main Crop', fr: 'Culture principale', sw: 'Zao kuu', ha: 'Babban amfanin gona', tw: 'Nnɔbae titiriw',
  },
  'setup.selectCrop': {
    en: 'Select a crop', fr: 'Choisir une culture', sw: 'Chagua zao', ha: 'Zaɓi amfanin gona', tw: 'Yi nnɔbae bi',
  },
  'setup.exactLocation': {
    en: 'Exact Location (GPS)', fr: 'Localisation exacte (GPS)', sw: 'Mahali halisi (GPS)', ha: 'Wuri daidai (GPS)', tw: 'Beae pɔtee (GPS)',
  },
  'setup.gpsDesc': {
    en: 'Get your exact farm location. This is optional — your village is enough.', fr: 'Obtenez la position exacte. Facultatif — le village suffit.', sw: 'Pata mahali halisi pa shamba lako. Hiari — kijiji kinatosha.', ha: 'Samu wurin gonar ka daidai. Zaɓi ne — ƙauye ya isa.', tw: 'Nya wo afuo beae pɔtee. Nhyehyɛe — wo akuraa bɛyɛ.',
  },
  'setup.gettingGPS': {
    en: 'Getting location...', fr: 'Obtention de la position...', sw: 'Inapata mahali...', ha: 'Ana samun wuri...', tw: 'Ɛrenya beae...',
  },
  'setup.getLocation': {
    en: 'Get My Location', fr: 'Obtenir ma position', sw: 'Pata mahali pangu', ha: 'Samu wurina', tw: 'Nya me beae',
  },
  'setup.latitude': {
    en: 'Latitude', fr: 'Latitude', sw: 'Latitudo', ha: 'Latitude', tw: 'Latitude',
  },
  'setup.longitude': {
    en: 'Longitude', fr: 'Longitude', sw: 'Longitudo', ha: 'Longitude', tw: 'Longitude',
  },
  'setup.gpsHint': {
    en: 'If GPS fails, just keep your village or region filled in.', fr: 'Si le GPS échoue, gardez votre village renseigné.', sw: 'GPS ikishindikana, kijiji chako kinatosha.', ha: 'Idan GPS ta gaza, ƙauyen ka ya isa.', tw: 'Sɛ GPS nyɛ adwuma a, wo akuraa bɛyɛ.',
  },
  'setup.gpsNotSupported': {
    en: 'GPS is not supported on this device.', fr: 'GPS non pris en charge sur cet appareil.', sw: 'GPS haitumiki kwenye kifaa hiki.', ha: 'Na\'urar nan ba ta tallafa GPS ba.', tw: 'GPS nnyɛ adwuma wɔ saa ɛkwan yi so.',
  },
  'setup.gpsSlow': {
    en: 'Still searching for GPS signal...', fr: 'Recherche du signal GPS en cours...', sw: 'Bado inatafuta ishara ya GPS...', ha: 'Har yanzu ana neman siginar GPS...', tw: 'Ɛresan ahwehwɛ GPS signal...',
  },
  'setup.gpsFailed': {
    en: 'Could not get GPS location. You can type your location instead.', fr: 'Impossible d\'obtenir la position GPS. Saisissez manuellement.', sw: 'Imeshindikana kupata GPS. Andika mahali pako badala yake.', ha: 'Ba a samu wurin GPS ba. Rubuta wurin ka a maimakon.', tw: 'Entumi anya GPS beae. Twerɛ wo beae mmom.',
  },
  'setup.gpsPermissionDenied': {
    en: 'Location permission denied. Please allow location access and try again.', fr: 'Permission refusée. Autorisez l\'accès et réessayez.', sw: 'Ruhusa ya mahali imekataliwa. Ruhusu na ujaribu tena.', ha: 'An hana izinin wuri. Da fatan a ba da izini sannan a sake gwadawa.', tw: 'Wɔapo beae ho kwan. Yɛsrɛ wo ma kwan na san hwehwe.',
  },
  'setup.gpsSignalWeak': {
    en: 'GPS signal is weak. Try again outside or in an open area.', fr: 'Signal GPS faible. Essayez dehors ou en zone ouverte.', sw: 'Ishara ya GPS ni dhaifu. Jaribu tena nje au sehemu wazi.', ha: 'Siginar GPS ba ta da ƙarfi. Gwada a waje ko fili.', tw: 'GPS signal yɛ mmerɛw. San hwehwe wɔ abɔnten.',
  },
  'setup.gpsTimeout': {
    en: 'GPS took too long. Try again or type your location.', fr: 'GPS trop long. Réessayez ou saisissez manuellement.', sw: 'GPS imechukua muda mrefu. Jaribu tena au andika mahali pako.', ha: 'GPS ta ɗauki lokaci. Sake gwadawa ko rubuta wurin ka.', tw: 'GPS kyɛɛ. San hwehwe anaasɛ twerɛ wo beae.',
  },
  'setup.saveTimeout': {
    en: 'Save is taking too long. Please try again.', fr: 'L\'enregistrement prend trop de temps. Réessayez.', sw: 'Kuhifadhi kunachukua muda mrefu. Tafadhali jaribu tena.', ha: 'Adanawa tana ɗaukar lokaci. Da fatan a sake gwadawa.', tw: 'Kora so rekyɛ. Yɛsrɛ wo san hwehwe.',
  },
  'setup.saveFailed': {
    en: 'Could not save. Please try again.', fr: 'Échec de l\'enregistrement. Réessayez.', sw: 'Imeshindikana kuhifadhi. Tafadhali jaribu tena.', ha: 'Ba a iya adanawa ba. Da fatan a sake gwadawa.', tw: 'Entumi ankora so. Yɛsrɛ wo san hwehwe.',
  },
  'setup.savedOffline': {
    en: 'Saved on your device. It will sync when you are back online.', fr: 'Enregistré sur votre appareil. Synchronisation au retour en ligne.', sw: 'Imehifadhiwa kwenye kifaa chako. Itasawazishwa mtandao ukipatikana.', ha: 'An ajiye a na\'urar ka. Za a daidaita lokacin da ka dawo kan layi.', tw: 'Wɔakora so wɔ wo phone so. Ɛbɛsync bere a intanɛt bɛba.',
  },
  'setup.savedSuccess': {
    en: 'Farm profile saved!', fr: 'Profil de ferme enregistré !', sw: 'Wasifu wa shamba umehifadhiwa!', ha: 'An ajiye bayanan gona!', tw: 'Wɔakora afuo ho nsɛm!',
  },
  'setup.syncRetry': {
    en: 'Saved locally. Will retry syncing soon.', fr: 'Enregistré localement. Nouvelle tentative bientôt.', sw: 'Imehifadhiwa. Itajaribu kusawazisha hivi karibuni.', ha: 'An ajiye a nan. Za a sake gwadawa ba da jimawa ba.', tw: 'Wɔakora so ha. Ɛbɛsan ahwehwɛ sync ntɛm.',
  },
  'setup.saving': {
    en: 'Saving...', fr: 'Enregistrement...', sw: 'Inahifadhi...', ha: 'Ana ajiye...', tw: 'Ɛrekora...',
  },
  'setup.saveFarm': {
    en: 'Save Farm Profile', fr: 'Enregistrer le profil', sw: 'Hifadhi wasifu wa shamba', ha: 'Ajiye bayanan gona', tw: 'Kora afuo ho nsɛm',
  },
  'setup.selectCountry': {
    en: 'Select country', fr: 'Sélectionner un pays', sw: 'Chagua nchi', ha: 'Zaɓi ƙasa', tw: 'Yi ɔman bi',
  },
  'setup.farmerNameRequired': {
    en: 'Farmer name is required.', fr: 'Le nom est obligatoire.', sw: 'Jina la mkulima linahitajika.', ha: 'Sunan manomi yana bukatar.', tw: 'Ɔkuafoɔ din no ho hia.',
  },
  'setup.farmNameRequired': {
    en: 'Farm name is required.', fr: 'Le nom de la ferme est obligatoire.', sw: 'Jina la shamba linahitajika.', ha: 'Sunan gona yana bukatar.', tw: 'Afuo din no ho hia.',
  },
  'setup.countryRequired': {
    en: 'Country is required.', fr: 'Le pays est obligatoire.', sw: 'Nchi inahitajika.', ha: 'Ƙasa yana bukatar.', tw: 'Ɔman no ho hia.',
  },
  'setup.locationRequired': {
    en: 'Location is required.', fr: "L'emplacement est obligatoire.", sw: 'Mahali panahitajika.', ha: 'Wuri yana bukatar.', tw: 'Beae no ho hia.',
  },
  'setup.sizeRequired': {
    en: 'Farm size is required.', fr: 'La taille est obligatoire.', sw: 'Ukubwa wa shamba unahitajika.', ha: 'Girman gona yana bukatar.', tw: 'Afuo kɛseɛ no ho hia.',
  },
  'setup.sizeInvalid': {
    en: 'Farm size must be greater than 0.', fr: 'La taille doit être supérieure à 0.', sw: 'Ukubwa lazima uwe zaidi ya 0.', ha: 'Girma ya zama fiye da 0.', tw: 'Kɛseɛ no nni sɛ ɛboro 0.',
  },
  'setup.cropRequired': {
    en: 'Main crop is required.', fr: 'La culture principale est obligatoire.', sw: 'Zao kuu linahitajika.', ha: 'Babban amfanin gona yana bukatar.', tw: 'Afifide titiriw no ho hia.',
  },

  // ═══════════════════════════════════════════════════════════
  //  FARMER TYPE — onboarding classification
  // ═══════════════════════════════════════════════════════════

  'farmerType.question': {
    en: 'What best describes you?', fr: 'Qu\'est-ce qui vous décrit le mieux ?', sw: 'Nini kinakuelezea vizuri?', ha: 'Mene ne ya fi bayyana ka?', tw: 'Dɛn na ɛkyerɛ wo yiye?',
  },
  'farmerType.subtitle': {
    en: 'This helps us personalize your farming journey.', fr: 'Cela nous aide à personnaliser votre parcours agricole.', sw: 'Hii inatusaidia kukupa uzoefu bora wa kilimo.', ha: 'Wannan yana taimaka mana mu daidaita tafiyar ku ta noma.', tw: 'Eyi boa yɛn sɛ yɛbɛyɛ wo akuadwuma kwan no soronko.',
  },
  'farmerType.new': {
    en: 'New to farming', fr: 'Nouveau en agriculture', sw: 'Mpya katika kilimo', ha: 'Sabon manomi', tw: 'Mefiri ase wɔ akuadwuma mu',
  },
  'farmerType.newDesc': {
    en: 'I am just starting or have very little farming experience.', fr: 'Je débute ou j\'ai très peu d\'expérience en agriculture.', sw: 'Ninaanza tu au nina uzoefu mdogo wa kilimo.', ha: 'Ina fara ko ne kuma na ɗan ƙaramin gogewar noma.', tw: 'Merefi ase anaa menni akuadwuma mu osuahu biara.',
  },
  'farmerType.experienced': {
    en: 'Existing farmer', fr: 'Agriculteur expérimenté', sw: 'Mkulima mwenye uzoefu', ha: 'Manomi mai gogewa', tw: 'Okuafoɔ a wahu mu',
  },
  'farmerType.experiencedDesc': {
    en: 'I already farm and want better planning, tracking, and decisions.', fr: 'Je suis déjà agriculteur et je veux une meilleure planification.', sw: 'Tayari nalima na nataka mipango bora na maamuzi.', ha: 'Ina noma kuma kuma ina son ingantaccen tsarawa.', tw: 'Meyɛ akuadwuma dada na mepɛ nhyehyɛe pa.',
  },
  'farmerType.saving': {
    en: 'Saving...', fr: 'Enregistrement...', sw: 'Inahifadhi...', ha: 'Ana ajiyewa...', tw: 'Ɛrekora...',
  },
  'farmerType.saveFailed': {
    en: 'Failed to save farmer type.', fr: 'Échec de l\'enregistrement.', sw: 'Imeshindwa kuhifadhi aina ya mkulima.', ha: 'An kasa ajiye nau\'in manomi.', tw: 'Anka yɛntumi ankora okuafoɔ no mu.',
  },

  // ═══════════════════════════════════════════════════════════
  //  STARTER GUIDE — beginner onboarding
  // ═══════════════════════════════════════════════════════════

  'starterGuide.title': {
    en: 'Welcome to Your Farm!', fr: 'Bienvenue sur votre ferme !', sw: 'Karibu kwenye Shamba Lako!', ha: 'Barka da zuwa Gonar ku!', tw: 'Akwaaba wɔ wo Afuo no so!',
  },
  'starterGuide.subtitle': {
    en: 'We will guide you through 5 simple steps to get your farm running. Each step has one clear action.', fr: 'Nous vous guiderons en 5 étapes simples. Chaque étape a une action claire.', sw: 'Tutakuongoza kupitia hatua 5 rahisi kuendesha shamba lako. Kila hatua ina kitendo kimoja.', ha: 'Za mu jagorance ku ta matakai 5 masu sauƙi don gudanar da gonar ku.', tw: 'Yɛbɛkyerɛ wo anammɔn 5 a ɛnyɛ den sɛ wo afuo no bɛkɔ yiye.',
  },
  'starterGuide.continue': {
    en: 'Get Started', fr: 'Commencer', sw: 'Anza', ha: 'Fara', tw: 'Fi ase',
  },

  // ═══════════════════════════════════════════════════════════
  //  AUTH — login, register, password
  // ═══════════════════════════════════════════════════════════

  'auth.welcomeBack': {
    en: 'Welcome Back', fr: 'Bon retour', sw: 'Karibu tena', ha: 'Barka da dawowar ka', tw: 'Akwaaba bio',
  },
  'auth.signInPrompt': {
    en: 'Sign in to your account', fr: 'Connectez-vous à votre compte', sw: 'Ingia kwenye akaunti yako', ha: 'Shiga asusun ka', tw: 'Hyɛn wo account mu',
  },
  'auth.email': {
    en: 'Email', fr: 'E-mail', sw: 'Barua pepe', ha: 'Imel', tw: 'Email',
  },
  'auth.password': {
    en: 'Password', fr: 'Mot de passe', sw: 'Nenosiri', ha: 'Kalmar sirri', tw: 'Password',
  },
  'auth.emailRequired': {
    en: 'Email is required', fr: 'L\'e-mail est requis', sw: 'Barua pepe inahitajika', ha: 'Ana buƙatar imel', tw: 'Ɛsɛ sɛ wode email ba',
  },
  'auth.passwordRequired': {
    en: 'Password is required', fr: 'Le mot de passe est requis', sw: 'Nenosiri linahitajika', ha: 'Ana buƙatar kalmar sirri', tw: 'Ɛsɛ sɛ wode password ba',
  },
  'auth.loginFailed': {
    en: 'Login failed. Please check your credentials.', fr: 'Échec de connexion. Vérifiez vos identifiants.', sw: 'Imeshindikana kuingia. Tafadhali angalia taarifa zako.', ha: 'Ba a iya shiga ba. Da fatan a duba bayanan ka.', tw: 'Entumi ahyɛn mu. Yɛsrɛ wo hwɛ wo nsɛm.',
  },
  'auth.forgotPassword': {
    en: 'Forgot password?', fr: 'Mot de passe oublié ?', sw: 'Umesahau nenosiri?', ha: 'Ka manta kalmar sirri?', tw: 'Wo werɛ afi password?',
  },
  'auth.signIn': {
    en: 'Sign In', fr: 'Connexion', sw: 'Ingia', ha: 'Shiga', tw: 'Hyɛn mu',
  },
  'auth.signingIn': {
    en: 'Signing in...', fr: 'Connexion en cours...', sw: 'Inaingia...', ha: 'Ana shiga...', tw: 'Ɛrehyɛn mu...',
  },
  'auth.noAccount': {
    en: "Don't have an account?", fr: "Pas de compte ?", sw: 'Huna akaunti?', ha: 'Ba ka da asusu ba?', tw: 'Wonni account?',
  },
  'auth.createOne': {
    en: 'Create one', fr: 'Créer un compte', sw: 'Tengeneza moja', ha: 'Ƙirƙiri ɗaya', tw: 'Yɛ bi',
  },

  // ─── Farmer Entry (Welcome gate — §2) ─────────────────────
  'entry.valueLine': {
    en: 'Know what to do on your farm every day',
    fr: 'Sachez quoi faire chaque jour sur votre ferme',
    sw: 'Jua cha kufanya shambani kwako kila siku',
    ha: 'San abin da za ka yi a gonarka kowace rana',
    tw: 'Hu nea wobɛyɛ wɔ w\'afuo so da biara',
  },
  'entry.startNewCrop': {
    en: 'Start a new crop',
    fr: 'Démarrer une culture',
    sw: 'Anza zao jipya',
    ha: 'Fara sabon amfani',
    tw: 'Fi foforɔ ase',
  },
  'entry.continueFarm': {
    en: 'Continue my farm',
    fr: 'Continuer ma ferme',
    sw: 'Endelea na shamba langu',
    ha: 'Ci gaba da gonata',
    tw: 'Toa m\'afuo so',
  },
  'entry.reassurance': {
    en: 'Simple, mobile-first, no long forms',
    fr: 'Simple, mobile, sans formulaires longs',
    sw: 'Rahisi, simu kwanza, hakuna fomu ndefu',
    ha: 'Mai sauƙi, wayar hannu da farko, babu dogayen fom',
    tw: 'Ɛyɛ mmerɛw, fon deɛ di kan, krataa tenten biara nni hɔ',
  },

  // ─── Beginner Reassurance screen (§3) ─────────────────────
  'reassurance.title': {
    en: 'New to farming?',
    fr: 'Nouveau dans l\'agriculture ?',
    sw: 'Mpya katika kilimo?',
    ha: 'Sabon noma?',
    tw: 'Woreyɛ kuayɛ foforɔ?',
  },
  'reassurance.guide': {
    en: 'We\'ll guide you step by step.',
    fr: 'Nous vous guiderons étape par étape.',
    sw: 'Tutakuongoza hatua kwa hatua.',
    ha: 'Za mu ja ka matakin-matakin.',
    tw: 'Yɛbɛkyerɛ wo ɔkwan anammɔn-anammɔn.',
  },
  'reassurance.noExperience': {
    en: 'No experience needed.',
    fr: 'Aucune expérience requise.',
    sw: 'Hakuna uzoefu unaohitajika.',
    ha: 'Babu bukatar ƙwarewa.',
    tw: 'Ɛho nhia suahu biara.',
  },

  // ─── Farmer-first auth (phone OTP, welcome screen) ────────
  'auth.welcomeFarmer': {
    en: 'Welcome, Farmer', fr: 'Bienvenue, Agriculteur', sw: 'Karibu, Mkulima', ha: 'Barka, Manomi', tw: 'Akwaaba, Okuafoɔ',
  },
  'auth.welcomeSubtitle': {
    en: 'Sign in to manage your farm', fr: 'Connectez-vous pour gérer votre ferme', sw: 'Ingia ili kudhibiti shamba lako', ha: 'Shiga don sarrafa gonar ka', tw: 'Hyɛn mu na hwɛ wo afuo',
  },
  'auth.phoneLabel': {
    en: 'Phone number', fr: 'Numéro de téléphone', sw: 'Nambari ya simu', ha: 'Lambar waya', tw: 'Fon nɔma',
  },
  'auth.phonePlaceholder': {
    en: '024 123 4567', fr: '024 123 4567', sw: '024 123 4567', ha: '024 123 4567', tw: '024 123 4567',
  },
  'auth.continueWithPhone': {
    en: 'Continue with Phone', fr: 'Continuer avec le téléphone', sw: 'Endelea na Simu', ha: 'Ci gaba da Waya', tw: 'Kɔ so wɔ Fon so',
  },
  'auth.sendingCode': {
    en: 'Sending code...', fr: 'Envoi du code...', sw: 'Inatuma msimbo...', ha: 'Ana aika lambar...', tw: 'Ɛrebrɛ kood...',
  },
  'auth.continueWithGoogle': {
    en: 'Continue with Google', fr: 'Continuer avec Google', sw: 'Endelea na Google', ha: 'Ci gaba da Google', tw: 'Kɔ so wɔ Google so',
  },
  'auth.continueOffline': {
    en: 'Continue Offline', fr: 'Continuer hors ligne', sw: 'Endelea bila mtandao', ha: 'Ci gaba ba tare da yanar gizo', tw: 'Kɔ so a wonni intanɛt',
  },
  'auth.or': {
    en: 'OR', fr: 'OU', sw: 'AU', ha: 'KO', tw: 'ANAA',
  },
  'auth.haveAccount': {
    en: 'Already have an account?', fr: 'Vous avez déjà un compte ?', sw: 'Tayari una akaunti?', ha: 'Ka riga ka na da asusu?', tw: 'Wowɔ account dada?',
  },
  'auth.signInEmail': {
    en: 'Sign in with email', fr: 'Se connecter par e-mail', sw: 'Ingia kwa barua pepe', ha: 'Shiga da imel', tw: 'Hyɛn mu wɔ email so',
  },
  'auth.otpRequestFailed': {
    en: 'Could not send code. Please try again.', fr: 'Impossible d\'envoyer le code. Réessayez.', sw: 'Imeshindikana kutuma msimbo. Jaribu tena.', ha: 'Ba a iya aika lambar ba. A sake gwadawa.', tw: 'Entumi mfrɛ kood no. Yɛsrɛ wo sɔ hwɛ bio.',
  },
  'auth.enterCode': {
    en: 'Enter Your Code', fr: 'Entrez votre code', sw: 'Ingiza Msimbo Wako', ha: 'Shigar da Lambar Ka', tw: 'Hyɛ Wo Kood',
  },
  'auth.codeSentTo': {
    en: 'Code sent to', fr: 'Code envoyé à', sw: 'Msimbo umetumwa kwa', ha: 'An aika lambar zuwa', tw: 'Wɔabrɛ kood akɔ',
  },
  'auth.verifyCode': {
    en: 'Verify Code', fr: 'Vérifier le code', sw: 'Thibitisha Msimbo', ha: 'Tabbatar da Lambar', tw: 'Hwɛ Kood no',
  },
  'auth.verifying': {
    en: 'Verifying...', fr: 'Vérification...', sw: 'Inathibitisha...', ha: 'Ana tabbatarwa...', tw: 'Ɛrehwɛ...',
  },
  'auth.resendCode': {
    en: 'Resend Code', fr: 'Renvoyer le code', sw: 'Tuma msimbo tena', ha: 'Sake aika lambar', tw: 'San brɛ kood no',
  },
  'auth.codeResent': {
    en: 'Code resent!', fr: 'Code renvoyé !', sw: 'Msimbo umetumwa tena!', ha: 'An sake aika lambar!', tw: 'Wɔasan abrɛ kood no!',
  },
  'auth.invalidCode': {
    en: 'Invalid code. Please try again.', fr: 'Code invalide. Réessayez.', sw: 'Msimbo batili. Jaribu tena.', ha: 'Lambar ba daidai ba. A sake gwadawa.', tw: 'Kood no nyɛ papa. Yɛsrɛ wo sɔ hwɛ bio.',
  },

  // ═══════════════════════════════════════════════════════════
  //  DASHBOARD
  // ═══════════════════════════════════════════════════════════

  'dashboard.loading': {
    en: 'Loading your farm dashboard...', fr: 'Chargement du tableau de bord...', sw: 'Inapakia dashibodi yako...', ha: 'Ana lodi shafin gona...', tw: 'Ɛreload wo dashboard...',
  },
  'dashboard.welcome': {
    en: 'Welcome', fr: 'Bienvenue', sw: 'Karibu', ha: 'Barka da zuwa', tw: 'Akwaaba',
  },
  'dashboard.hint': {
    en: 'What should you do today? Start with the next action below.', fr: 'Que faire aujourd\'hui ? Commencez par l\'action ci-dessous.', sw: 'Unafaa kufanya nini leo? Anza na hatua inayofuata.', ha: 'Me za ka yi yau? Fara da aikin da ke ƙasa.', tw: 'Dɛn na ɛsɛ sɛ woyɛ ɛnnɛ? Fi ase wɔ dwuma a edi so no.',
  },
  'dashboard.voiceGuide': {
    en: 'Welcome. Check your next action, today\'s work, and weather.', fr: 'Bienvenue. Vérifiez votre prochaine action et la météo.', sw: 'Karibu. Angalia hatua yako inayofuata na hali ya hewa.', ha: 'Barka. Duba aikin ka na gaba da yanayi.', tw: 'Akwaaba. Hwɛ wo dwuma a edi so ne wim tebea.',
  },
  'dashboard.playGuidance': {
    en: 'Play Guidance', fr: 'Écouter le guide', sw: 'Cheza mwongozo', ha: 'Kunna jagora', tw: 'Bɔ nkyerɛkyerɛ',
  },
  'dashboard.setupBanner': {
    en: 'Complete your farm setup to unlock all features', fr: 'Complétez la configuration pour débloquer toutes les fonctionnalités', sw: 'Kamilisha usanidi wa shamba lako ili kufungua vipengele vyote', ha: 'Kammala saita gonar ka don buɗe dukan fasaloli', tw: 'Wie wo afuo nhyehyɛe na wobue nneɛma nyinaa',
  },
  'dashboard.setupBannerDesc': {
    en: 'Weather, tasks, and recommendations need your farm details to work well.', fr: 'Météo, tâches et recommandations nécessitent vos détails.', sw: 'Hali ya hewa, kazi na mapendekezo yanahitaji maelezo yako.', ha: 'Yanayi, ayyuka da shawarwari suna buƙatar bayanan gonar ka.', tw: 'Wim tebea, adwuma ne nkɔmmɔbɔ hia wo afuo ho nsɛm.',
  },
  'dashboard.completeSetup': {
    en: 'Complete Setup', fr: 'Terminer la configuration', sw: 'Kamilisha usanidi', ha: 'Kammala saita', tw: 'Wie nhyehyɛe',
  },

  // ─── Farmer home — action-first dashboard ──────────────────
  'dashboard.hello': {
    en: 'Hello, {name}', fr: 'Bonjour, {name}', sw: 'Habari, {name}', ha: 'Sannu, {name}', tw: 'Maakye, {name}',
  },
  'dashboard.todaysTask': {
    en: "What should you do today?", fr: "Que faire aujourd'hui ?", sw: 'Ufanye nini leo?', ha: 'Me za ka yi yau?', tw: 'Dɛn na ɛsɛ sɛ woyɛ ɛnnɛ?',
  },
  'dashboard.doThisNow': {
    en: 'Do this now', fr: 'Fais-le maintenant', sw: 'Fanya sasa', ha: 'Yi wannan yanzu', tw: 'Yɛ eyi seesei',
  },
  'dashboard.todayOnFarm': {
    en: 'Today on your farm', fr: "Aujourd'hui sur votre ferme", sw: 'Leo shambani kwako', ha: 'Yau a gonar ka', tw: 'Ɛnnɛ wɔ wo afuo so',
  },
  'dashboard.addUpdate': {
    en: 'Add Update', fr: 'Ajouter', sw: 'Ongeza', ha: 'Ƙara sabon', tw: 'Fa nkɔ so',
  },
  'dashboard.myFarm': {
    en: 'My Farm', fr: 'Ma ferme', sw: 'Shamba langu', ha: 'Gonar ta', tw: 'Me afuo',
  },
  'dashboard.tasks': {
    en: 'Tasks', fr: 'Tâches', sw: 'Kazi', ha: 'Ayyuka', tw: 'Adwuma',
  },
  'dashboard.allTasks': {
    en: 'All Tasks', fr: 'Toutes les tâches', sw: 'Kazi Zote', ha: 'Duk Ayyuka', tw: 'Adwuma Nyinaa',
  },
  'dashboard.checkPests': {
    en: 'Check Pests', fr: 'Vérifier ravageurs', sw: 'Angalia Wadudu', ha: 'Duba Ƙwari', tw: 'Hwɛ Mmoa',
  },
  'dashboard.tapToUpdateStage': {
    en: 'Tap to update crop stage', fr: 'Appuyez pour mettre à jour', sw: 'Gusa kubadilisha hatua', ha: 'Taɓa don sabunta mataki', tw: 'Mia sɛ wobɛsesa anammɔn',
  },
  'dashboard.whatElse': {
    en: 'What else can you do?', fr: 'Que pouvez-vous faire aussi ?', sw: 'Nini kingine unaweza kufanya?', ha: 'Me kuma za ka iya yi?', tw: 'Dɛn bio na wubɛtumi ayɛ?',
  },
  'dashboard.quickActions': {
    en: 'Quick actions', fr: 'Actions rapides', sw: 'Vitendo vya haraka', ha: 'Ayyukan gaggawa', tw: 'Nneɛma a wubɛtumi ayɛ ntɛm',
  },

  // ─── Guided Next Action ─────────────────────────────────
  'guided.loading': { en: 'Finding your next step...', fr: 'Recherche de la prochaine étape...', sw: 'Inatafuta hatua yako inayofuata...', ha: 'Ana neman matakin ku na gaba...', tw: 'Ɛrehwehwɛ wo anammɔn a edi so...' },

  'guided.setupTitle': { en: 'Finish setting up your farm', fr: 'Terminez la configuration', sw: 'Maliza kusanidi shamba lako', ha: 'Kammala saita gonar ka', tw: 'Wie wo afuo nhyehyɛe' },
  'guided.setupReason': { en: 'We need your farm details to give you the right advice.', fr: 'Nous avons besoin de vos informations pour vous conseiller.', sw: 'Tunahitaji maelezo ya shamba lako ili kukupa ushauri sahihi.', ha: 'Muna buƙatar bayanan gonar ka don ba ka shawarar da ta dace.', tw: 'Yɛhia wo afuo ho nsɛm na yɛama wo afotu pa.' },
  'guided.setupCta': { en: 'Start setup', fr: 'Commencer', sw: 'Anza usanidi', ha: 'Fara saita', tw: 'Fi ase nhyehyɛe' },
  'guided.setupNext': { en: 'After this, Farroway will show your daily farm tasks.', fr: 'Ensuite, Farroway affichera vos tâches quotidiennes.', sw: 'Baada ya hii, Farroway itaonyesha kazi zako za kila siku.', ha: 'Bayan wannan, Farroway zai nuna maka ayyukan yau da kullun.', tw: 'Eyi akyi, Farroway bɛkyerɛ wo adwuma a ɛsɛ sɛ woyɛ da biara.' },

  'guided.stageTitle': { en: 'Update your crop stage', fr: 'Mettez à jour votre culture', sw: 'Sasisha hatua ya mazao yako', ha: 'Sabunta matakin amfanin ku', tw: 'Sesa wo nnɔbae anammɔn' },
  'guided.stageReason': { en: 'This helps us give you the right tasks and advice for today.', fr: 'Cela nous aide à vous donner les bons conseils.', sw: 'Hii inatusaidia kukupa kazi na ushauri sahihi wa leo.', ha: 'Wannan yana taimaka mana ba ka shawarar da ta dace na yau.', tw: 'Eyi boa yɛn ma yɛma wo afotu pa ɛnnɛ.' },
  'guided.stageCta': { en: 'Update crop stage', fr: 'Mettre à jour', sw: 'Sasisha hatua', ha: 'Sabunta mataki', tw: 'Sesa anammɔn' },
  'guided.stageNext': { en: 'After this, you will see today\'s farming advice.', fr: 'Ensuite, vous verrez les conseils du jour.', sw: 'Baada ya hii, utaona ushauri wa kilimo wa leo.', ha: 'Bayan wannan, za ka ga shawarar noma ta yau.', tw: 'Eyi akyi, wobɛhunu afuoyɛ afotu a ɛwɔ ɛnnɛ.' },

  'guided.stageOutdatedTitle': { en: 'Your crop may have changed', fr: 'Votre culture a peut-être changé', sw: 'Mazao yako yanaweza kuwa yamebadilika', ha: 'Amfanin gonar ka na iya canzawa', tw: 'Ebia wo nnɔbae no asesa' },
  'guided.stageOutdatedReason': { en: 'Last updated {days} days ago. Keeping this current gives you better advice.', fr: 'Dernière mise à jour il y a {days} jours.', sw: 'Ilisasishwa siku {days} zilizopita.', ha: 'An sabunta shi kwanaki {days} da suka wuce.', tw: 'Wɔsesaa no nnansa {days} a atwam\' no mu.' },
  'guided.stageOutdatedCta': { en: 'Refresh crop stage', fr: 'Actualiser', sw: 'Sasisha hatua', ha: 'Sabunta mataki', tw: 'Sesa anammɔn' },
  'guided.daysAgo': { en: '{days}d ago', fr: 'il y a {days}j', sw: 'siku {days} zilizopita', ha: 'kwanaki {days} da suka wuce', tw: 'nnansa {days} a atwam\'' },

  'guided.taskReason': { en: 'Based on your crop stage and today\'s conditions.', fr: 'Basé sur votre étape et les conditions du jour.', sw: 'Kulingana na hatua ya mazao yako na hali ya leo.', ha: 'Bisa ga matakin amfanin ku da halin yau.', tw: 'Egyina wo nnɔbae anammɔn ne ɛnnɛ tebea so.' },
  'guided.taskCta': { en: 'Start now', fr: 'Commencer', sw: 'Anza sasa', ha: 'Fara yanzu', tw: 'Fi ase seesei' },
  'guided.taskNext': { en: 'After this, Farroway will show your next farm task.', fr: 'Ensuite, Farroway montrera votre prochaine tâche.', sw: 'Baada ya hii, Farroway itaonyesha kazi yako inayofuata.', ha: 'Bayan wannan, Farroway zai nuna maka aikin ku na gaba.', tw: 'Eyi akyi, Farroway bɛkyerɛ wo adwuma a edi so.' },

  'guided.pestReason': { en: 'Pests or disease may be affecting your crop. Act quickly.', fr: 'Des ravageurs pourraient affecter votre culture. Agissez vite.', sw: 'Wadudu au ugonjwa unaweza kuathiri mazao yako. Chukua hatua haraka.', ha: 'Ƙwari ko cuta na iya shafar amfanin ku. Yi gaggawa.', tw: 'Ebia mmoa bɔne resia wo nnɔbae. Yɛ ntɛm.' },
  'guided.alertReason': { en: 'This needs your attention today.', fr: 'Ceci nécessite votre attention aujourd\'hui.', sw: 'Hii inahitaji umakini wako leo.', ha: 'Wannan yana buƙatar hankalin ku yau.', tw: 'Eyi hia wo adwene ɛnnɛ.' },
  'guided.alertCta': { en: 'Act now', fr: 'Agir maintenant', sw: 'Chukua hatua sasa', ha: 'Yi aiki yanzu', tw: 'Yɛ seesei' },

  'guided.doneTitle': { en: 'All done for today!', fr: 'Tout est fait !', sw: 'Umekamilisha yote leo!', ha: 'An gama duk na yau!', tw: 'Woawie nyinaa ɛnnɛ!' },
  'guided.doneReason': { en: 'Great work. Check back tomorrow for new tasks.', fr: 'Bon travail. Revenez demain.', sw: 'Kazi nzuri. Rudi kesho kwa kazi mpya.', ha: 'Aiki nagari. Ka dawo gobe don sabbin ayyuka.', tw: 'Adwuma pa. San ba ɔkyena ma adwuma foforo.' },
  'guided.doneCta': { en: 'Add farm update', fr: 'Ajouter une mise à jour', sw: 'Ongeza sasishio la shamba', ha: 'Ƙara sabon bayani', tw: 'Fa nsɛm foforo ka ho' },

  // Contextual reason variants (with crop name)
  'guided.stageReasonCrop': { en: 'Tell us where your {crop} is now so we can give you the right advice.', fr: 'Dites-nous où en est votre {crop} pour recevoir les bons conseils.', sw: 'Tuambie {crop} yako ipo wapi sasa ili tukupe ushauri sahihi.', ha: 'Gaya mana {crop} ku yana ina yanzu don mu ba ka shawara.', tw: 'Ka kyerɛ yɛn wo {crop} wɔ he seesei na yɛma wo afotu pa.' },
  'guided.stageOutdatedReasonCrop': { en: 'Your {crop} stage was last updated {days} days ago. It may have changed.', fr: 'Le stade de votre {crop} a été mis à jour il y a {days} jours.', sw: 'Hatua ya {crop} yako ilisasishwa siku {days} zilizopita.', ha: '{crop} ku an sabunta shi kwanaki {days} da suka wuce.', tw: 'Wo {crop} anammɔn no wɔsesaa no nnansa {days} a atwam\'.' },
  'guided.taskReasonCrop': { en: 'Based on your {crop} stage and today\'s conditions.', fr: 'Basé sur l\'étape de votre {crop} et les conditions du jour.', sw: 'Kulingana na hatua ya {crop} yako na hali ya leo.', ha: 'Bisa ga matakin {crop} ku da halin yau.', tw: 'Egyina wo {crop} anammɔn ne ɛnnɛ tebea so.' },

  // Check-in nudge (7-30 day gap)
  'guided.checkinTitle': { en: 'Time for a quick check-in', fr: 'C\'est le moment de faire le point', sw: 'Wakati wa ukaguzi wa haraka', ha: 'Lokaci ya duba halin gona', tw: 'Bere a ɛsɛ sɛ wohwɛ ntɛm' },
  'guided.checkinReason': { en: 'It\'s been {days} days since your last update. A quick check keeps things on track.', fr: 'Cela fait {days} jours depuis votre dernière mise à jour.', sw: 'Siku {days} zimepita tangu sasishio lako la mwisho.', ha: 'Kwanaki {days} sun wuce tun sabuntawar ku ta ƙarshe.', tw: 'Nnansa {days} atwam\' fi bere a wosesaa nsɛm no.' },
  'guided.checkinReasonCrop': { en: 'Your {crop} hasn\'t been updated in {days} days. Let\'s check how it\'s doing.', fr: 'Votre {crop} n\'a pas été mis à jour depuis {days} jours.', sw: '{crop} yako haijasasishwa kwa siku {days}.', ha: 'Ba a sabunta {crop} ku ba tun kwanaki {days}.', tw: 'Wɔnsesaa wo {crop} no nnansa {days}.' },
  'guided.checkinCta': { en: 'Quick check-in', fr: 'Faire le point', sw: 'Kagua haraka', ha: 'Duba da sauri', tw: 'Hwɛ ntɛm' },
  'guided.checkinNext': { en: 'After this, your advice will be up to date.', fr: 'Ensuite, vos conseils seront à jour.', sw: 'Baada ya hii, ushauri wako utakuwa wa sasa.', ha: 'Bayan wannan, shawarar ku za ta zama na yanzu.', tw: 'Eyi akyi, wo afotu bɛyɛ foforo.' },
  'guided.planCheckin': { en: 'Quick check-in', fr: 'Faire le point', sw: 'Kagua haraka', ha: 'Duba da sauri', tw: 'Hwɛ ntɛm' },

  // All-done plan steps
  'guided.planAllDone': { en: 'Tasks complete', fr: 'Tâches terminées', sw: 'Kazi zimekamilika', ha: 'Ayyuka sun kammala', tw: 'Adwuma awie' },
  'guided.planCheckTomorrow': { en: 'Check back tomorrow', fr: 'Revenez demain', sw: 'Rudi kesho', ha: 'Ka dawo gobe', tw: 'San ba ɔkyena' },

  'guided.staleTitle': { en: 'Your farm needs attention', fr: 'Votre ferme a besoin d\'attention', sw: 'Shamba lako linahitaji umakini', ha: 'Gonar ka tana buƙatar kulawa', tw: 'Wo afuo hia adwene' },
  'guided.staleReason': { en: 'No updates in a while. A quick check keeps things on track.', fr: 'Pas de mise à jour depuis un moment.', sw: 'Hakuna masasisho kwa muda. Angalia haraka.', ha: 'Babu sabuntawa tun lokaci. Duba da sauri.', tw: 'Nsɛm foforo nni hɔ bere tiawa yi. Hwɛ ntɛm.' },
  'guided.staleCta': { en: 'Add update', fr: 'Ajouter', sw: 'Ongeza sasishio', ha: 'Ƙara bayani', tw: 'Fa nkɔ so' },
  'guided.staleNext': { en: 'After this, your dashboard will refresh with new advice.', fr: 'Ensuite, votre tableau de bord sera actualisé.', sw: 'Baada ya hii, dashibodi yako itasasishwa na ushauri mpya.', ha: 'Bayan wannan, dashbod din ku zai sabunta da sabon shawara.', tw: 'Eyi akyi, wo dashboard bɛsesa ne afotu foforo.' },
  'guided.planStale': { en: 'Review farm status', fr: 'Vérifier l\'état de la ferme', sw: 'Kagua hali ya shamba', ha: 'Duba halin gona', tw: 'Hwɛ afuo tebea' },
  'guided.planTreat': { en: 'Apply treatment', fr: 'Appliquer le traitement', sw: 'Tumia dawa', ha: 'Yi magani', tw: 'Fa aduro to so' },

  // ─── Farm Status Labels ──────────────────────────────────
  'status.profile': { en: 'Profile', fr: 'Profil', sw: 'Wasifu', ha: 'Bayani', tw: 'Nsɛm' },
  'status.cropStage': { en: 'Crop stage', fr: 'Étape culture', sw: 'Hatua ya mazao', ha: 'Matakin amfani', tw: 'Nnɔbae anammɔn' },
  'status.tasks': { en: 'Tasks', fr: 'Tâches', sw: 'Kazi', ha: 'Ayyuka', tw: 'Adwuma' },
  'status.activity': { en: 'Activity', fr: 'Activité', sw: 'Shughuli', ha: 'Aiki', tw: 'Dwumadi' },
  'status.good': { en: 'Farm healthy', fr: 'Ferme en bonne santé', sw: 'Shamba zuri', ha: 'Gona lafiyayye', tw: 'Afuo apɔ mu yie' },

  // ─── Retention indicators ─────────────────────────────────
  'retention.urgent': { en: 'URGENT', fr: 'URGENT', sw: 'HARAKA', ha: 'GAGGAWA', tw: 'NTƐM' },
  'retention.overdue': { en: 'OVERDUE', fr: 'EN RETARD', sw: 'IMECHELEWA', ha: 'AN WUCE LOKACI', tw: 'ATWAM BERE' },
  'retention.lastUpdated': { en: 'Updated {days}d ago', fr: 'Mis à jour il y a {days}j', sw: 'Ilisasishwa siku {days} zilizopita', ha: 'An sabunta kwanaki {days} da suka wuce', tw: 'Wɔsesaa no nnansa {days} a atwam\'' },
  'retention.updatedToday': { en: 'Updated today', fr: 'Mis à jour aujourd\'hui', sw: 'Ilisasishwa leo', ha: 'An sabunta yau', tw: 'Wɔsesaa no ɛnnɛ' },
  'status.goodDesc': { en: 'All systems on track.', fr: 'Tout est en ordre.', sw: 'Kila kitu kiko sawa.', ha: 'Komai yana daidai.', tw: 'Biribiara kɔ yie.' },
  'status.onTrack': { en: 'On track', fr: 'En bonne voie', sw: 'Inakwenda vizuri', ha: 'Yana tafiya daidai', tw: 'Ɛkɔ yie' },
  'status.onTrackDesc': { en: 'Almost everything is up to date.', fr: 'Presque tout est à jour.', sw: 'Karibu kila kitu kimesasishwa.', ha: 'Kusan komai an sabunta.', tw: 'Biribiara sua sesa.' },
  'status.almostReady': { en: 'Almost ready', fr: 'Presque prêt', sw: 'Karibu tayari', ha: 'Kusan shirye', tw: 'Sua ayɛ krado' },
  'status.almostReadyDesc': { en: 'A few things need your attention.', fr: 'Quelques éléments nécessitent votre attention.', sw: 'Mambo machache yanahitaji umakini wako.', ha: 'Wasu abubuwa suna buƙatar hankalin ku.', tw: 'Nneɛma kakraa bi hia wo adwene.' },
  'status.needsWork': { en: 'Needs attention', fr: 'Nécessite attention', sw: 'Inahitaji umakini', ha: 'Yana buƙatar kulawa', tw: 'Ɛhia adwene' },
  'status.needsWorkDesc': { en: 'Several items need updating.', fr: 'Plusieurs éléments doivent être mis à jour.', sw: 'Mambo kadhaa yanahitaji kusasishwa.', ha: 'Abubuwa da yawa suna buƙatar sabuntawa.', tw: 'Nneɛma pii hia sɛ wɔsesa wɔn.' },

  'guided.todaysPlan': { en: "Today's plan", fr: "Plan du jour", sw: 'Mpango wa leo', ha: 'Tsarin yau', tw: 'Ɛnnɛ nhyehyɛe' },
  'guided.now': { en: 'NOW', fr: 'MAINTENANT', sw: 'SASA', ha: 'YANZU', tw: 'SEESEI' },
  'guided.planSetup': { en: 'Complete farm setup', fr: 'Terminer la configuration', sw: 'Kamilisha usanidi', ha: 'Kammala saita', tw: 'Wie nhyehyɛe' },
  'guided.planStage': { en: 'Update crop stage', fr: 'Mettre à jour le stade', sw: 'Sasisha hatua ya mazao', ha: 'Sabunta mataki', tw: 'Sesa anammɔn' },
  'guided.planTask': { en: 'Do today\'s task', fr: 'Faire la tâche du jour', sw: 'Fanya kazi ya leo', ha: 'Yi aikin yau', tw: 'Yɛ ɛnnɛ adwuma' },
  'guided.planPest': { en: 'Check for pests', fr: 'Vérifier les ravageurs', sw: 'Angalia wadudu', ha: 'Duba ƙwari', tw: 'Hwɛ mmoa' },
  'guided.planMore': { en: '{count} more tasks', fr: '{count} autres tâches', sw: 'Kazi {count} zaidi', ha: 'Ayyuka {count} ƙari', tw: 'Adwuma {count} a aka' },

  'dashboard.thisWeek': {
    en: 'This week', fr: 'Cette semaine', sw: 'Wiki hii', ha: 'Wannan mako', tw: 'Nnawɔtwe yi',
  },
  'dashboard.of': {
    en: 'of', fr: 'sur', sw: 'ya', ha: 'na', tw: 'wɔ mu',
  },
  'dashboard.tasksDoneWeek': {
    en: 'tasks done', fr: 'tâches terminées', sw: 'kazi zilizokamilika', ha: 'ayyuka da aka gama', tw: 'adwuma a wɔawie',
  },
  'dashboard.weatherUnknown': {
    en: 'Add GPS to your farm for weather', fr: 'Ajoutez le GPS pour la météo', sw: 'Ongeza GPS kwa hali ya hewa', ha: 'Ƙara GPS don yanayi', tw: 'Fa GPS ka ho ma wim tebea',
  },
  'dashboard.finishSetup': {
    en: 'Finish your farm setup', fr: 'Terminez la configuration', sw: 'Kamilisha usanidi', ha: 'Kammala saitin gonar ka', tw: 'Wie wo afuo nhyehyɛe',
  },
  'dashboard.finishSetupDesc': {
    en: 'Set up your farm to get daily tasks and advice.', fr: 'Configurez votre ferme pour recevoir tâches et conseils.', sw: 'Sanidi shamba lako kupata kazi na ushauri.', ha: 'Saita gonar ka don samun ayyuka da shawarwari.', tw: 'Hyehyɛ wo afuo na wunya adwuma ne afutuɔ.',
  },
  'dashboard.setCropStage': {
    en: 'Set your crop stage', fr: 'Définissez le stade de culture', sw: 'Weka hatua ya mazao', ha: 'Saita matakin amfanin ka', tw: 'Hyehyɛ wo nnɔbae atentenso',
  },
  'dashboard.setCropStageDesc': {
    en: 'This helps us give you the right tasks.', fr: 'Cela nous aide à vous donner les bonnes tâches.', sw: 'Hii inatusaidia kukupa kazi sahihi.', ha: 'Wannan yana taimaka mana ba ka ayyuka daidai.', tw: 'Eyi boa yɛn na yɛma wo adwuma a ɛfata.',
  },
  'dashboard.goToSetup': {
    en: 'Go to setup', fr: 'Aller à la configuration', sw: 'Nenda kwenye usanidi', ha: 'Je zuwa saita', tw: 'Kɔ nhyehyɛe',
  },
  'dashboard.setStage': {
    en: 'Set stage', fr: 'Définir le stade', sw: 'Weka hatua', ha: 'Saita mataki', tw: 'Hyehyɛ atentenso',
  },
  'dashboard.allDoneAddUpdate': {
    en: 'All tasks done! Add your first farm update', fr: 'Toutes les tâches terminées ! Ajoutez votre première mise à jour', sw: 'Kazi zote zimekamilika! Ongeza sasishio lako la kwanza', ha: 'An gama duk ayyuka! Ƙara sabon bayani', tw: 'Adwuma nyinaa awie! Fa nkɔ so foforo bi ka ho',
  },
  'dashboard.allDone': {
    en: 'All done for today!', fr: 'Tout est fait pour aujourd\'hui !', sw: 'Umekamilisha yote leo!', ha: 'An gama duk na yau!', tw: 'Woawie nyinaa ɛnnɛ!',
  },
  'dashboard.allDoneHint': {
    en: 'You can add a farm update or check back tomorrow.', fr: 'Vous pouvez ajouter une mise à jour ou revenir demain.', sw: 'Unaweza kuongeza sasishio au urudi kesho.', ha: 'Za ka ƙara bayani ko ka dawo gobe.', tw: 'Wobɛtumi de nkɔ so bi aka ho anaasɛ wosan ba ɔkyena.',
  },
  'dashboard.updateCropStage': {
    en: 'Update crop stage', fr: 'Mettre à jour l\'étape', sw: 'Sasisha hatua ya mazao', ha: 'Sabunta matakin amfani', tw: 'Sesa nnɔbae anammɔn',
  },
  'dashboard.updateCropStagePrompt': {
    en: 'Tell us where your crop is now', fr: 'Dites-nous où en est votre culture', sw: 'Tuambie mazao yako yapo wapi sasa', ha: 'Gaya mana amfanin gonar ka yana ina yanzu', tw: 'Ka kyerɛ yɛn wo nnɔbae wɔ he seesei',
  },
  'dashboard.harvest': {
    en: 'Harvest', fr: 'Récolte', sw: 'Mavuno', ha: 'Girbi', tw: 'Twabere',
  },
  'dashboard.money': {
    en: 'Money', fr: 'Argent', sw: 'Pesa', ha: 'Kuɗi', tw: 'Sika',
  },
  'dashboard.moreTools': {
    en: 'More tools', fr: 'Plus d\'outils', sw: 'Zana zaidi', ha: 'Ƙarin kayan aiki', tw: 'Nnwinnade pii',
  },
  'weather.supportRain': {
    en: 'Plan indoor work or wait.', fr: 'Prévoyez du travail intérieur.', sw: 'Panga kazi ya ndani au subiri.', ha: 'Tsara aikin gida ko jira.', tw: 'Hyehyɛ efie mu adwuma anaasɛ twɛn.',
  },
  'weather.supportWind': {
    en: 'Skip spraying, do other tasks.', fr: 'Pas de pulvérisation, autres tâches.', sw: 'Acha kupulizia, fanya kazi nyingine.', ha: "Guji fesa, yi wasu ayyuka.", tw: 'Gyae aduru pete, yɛ adwuma foforɔ.',
  },
  'weather.supportSafe': {
    en: 'Good conditions for field work.', fr: 'Bonnes conditions pour le terrain.', sw: 'Hali nzuri kwa kazi ya shambani.', ha: 'Yanayi mai kyau don aikin gona.', tw: 'Tebea papa ma afuo so adwuma.',
  },
  'weather.supportNoData': {
    en: 'Add GPS to your farm for forecasts.', fr: 'Ajoutez le GPS pour les prévisions.', sw: 'Ongeza GPS kwa utabiri wa hewa.', ha: 'Ƙara GPS don hasashen yanayi.', tw: 'Fa GPS ka ho ma nkɔmhyɛ.',
  },

  // ═══════════════════════════════════════════════════════════
  //  PRIMARY FARM ACTION
  // ═══════════════════════════════════════════════════════════

  'action.finishSetup': {
    en: 'Finish setup to get better farm advice', fr: 'Terminez la configuration pour de meilleurs conseils', sw: 'Maliza usanidi kupata ushauri bora', ha: 'Kammala saita don samun shawarwari mafi kyau', tw: 'Wie nhyehyɛe na wunya afutuɔ papa',
  },
  'action.finishSetupDesc': {
    en: 'Add the missing details below so Farroway can give you more accurate weather, better farming guidance, and stronger daily recommendations.', fr: 'Ajoutez les détails manquants pour que Farroway puisse vous donner des conseils plus précis.', sw: 'Ongeza maelezo yanayokosekana ili Farroway ikupe ushauri bora zaidi.', ha: 'Ƙara bayanan da suka ɓace don Farroway ta ba ka shawarwari mafi kyau.', tw: 'Fa nsɛm a aka no ka ho na Farroway ama wo afutuɔ papa.',
  },
  'action.uuidMissing': {
    en: 'Finish your farm setup to begin tracking your farming season.', fr: 'Terminez la configuration de votre ferme pour commencer à suivre votre saison agricole.', sw: 'Kamilisha usanidi wa shamba lako ili uanze kufuatilia msimu wako wa kilimo.', ha: 'Kammala saita gonar ku don fara bin diddigin lokacin nomar ku.', tw: 'Wie wo afuo nhyehyɛe na hyɛ ase di wo mfuom bere akyi.',
  },
  'action.betterWeather': {
    en: 'Better local weather', fr: 'Meilleure météo locale', sw: 'Hali bora ya hewa', ha: 'Yanayin gida mafi kyau', tw: 'Wim tebea papa',
  },
  'action.betterGuidance': {
    en: 'Better daily farming guidance', fr: 'Meilleurs conseils quotidiens', sw: 'Mwongozo bora wa kilimo', ha: 'Jagorar noma mafi kyau', tw: 'Afutuɔ papa da biara',
  },
  'action.betterPlanning': {
    en: 'Better season planning', fr: 'Meilleure planification saisonnière', sw: 'Mipango bora ya msimu', ha: 'Tsarin lokaci mafi kyau', tw: 'Bere nhyehyɛe papa',
  },
  'action.seasonActive': {
    en: 'Your farming season is active', fr: 'Votre saison est en cours', sw: 'Msimu wako wa kilimo unaendelea', ha: 'Lokacin gonar ka yana ci gaba', tw: 'Wo afuoyɛ bere refi ase',
  },
  'action.seasonActiveDesc': {
    en: 'Continue today\'s tasks and keep your season moving forward.', fr: 'Continuez les tâches du jour.', sw: 'Endelea na kazi za leo na uendeleze msimu wako.', ha: 'Ci gaba da ayyukan yau ka ci gaba da lokaci.', tw: 'Toa so yɛ ɛnnɛ adwuma na fa wo bere kɔ anim.',
  },
  'action.continueWork': {
    en: 'Continue Today\'s Work', fr: 'Continuer les tâches', sw: 'Endelea na kazi za leo', ha: 'Ci gaba da aikin yau', tw: 'Toa so yɛ ɛnnɛ adwuma',
  },
  'action.readyToStart': {
    en: 'Ready to start farming season', fr: 'Prêt à commencer la saison', sw: 'Tayari kuanza msimu wa kilimo', ha: 'Shirye don fara lokacin gona', tw: 'Wasiesie sɛ wobɛfi afuoyɛ bere ase',
  },
  'action.readyToStartDesc': {
    en: 'This will create your first farming tasks and help you track what to do next.', fr: 'Cela créera vos premières tâches agricoles.', sw: 'Hii itaunda kazi zako za kwanza za kilimo.', ha: 'Wannan zai ƙirƙiri ayyukan gonar ka na farko.', tw: 'Eyi bɛyɛ wo afuoyɛ adwuma a edi kan.',
  },
  'action.startSeason': {
    en: 'Start Farming Season', fr: 'Commencer la saison', sw: 'Anza msimu wa kilimo', ha: 'Fara lokacin gona', tw: 'Fi afuoyɛ bere ase',
  },

  // ═══════════════════════════════════════════════════════════
  //  NEXT ACTION — predictive next-step card
  // ═══════════════════════════════════════════════════════════

  'nextAction.title': {
    en: 'Your next step', fr: 'Prochaine étape', sw: 'Hatua yako inayofuata', ha: 'Mataki na gaba', tw: 'Wo anammɔn a edi so',
  },
  'nextAction.createProfile': {
    en: 'Create your farm profile', fr: 'Créez votre profil de ferme', sw: 'Unda wasifu wa shamba lako', ha: 'Ƙirƙiri bayanan gonar ka', tw: 'Yɛ wo afuo ho nsɛm',
  },
  'nextAction.createProfileReason': {
    en: 'Set up your farm to get personalized guidance.', fr: 'Configurez votre ferme pour obtenir des conseils.', sw: 'Weka shamba lako kupata mwongozo.', ha: 'Saita gonar ka don samun jagora.', tw: 'Hyehyɛ wo afuo nya nkyerɛkyerɛ.',
  },
  'nextAction.finishSetup': {
    en: 'Finish your farm setup', fr: 'Terminez la configuration', sw: 'Kamilisha usanidi wa shamba', ha: 'Kammala saita gonar', tw: 'Wie wo afuo nhyehyɛe',
  },
  'nextAction.finishSetupReason': {
    en: 'Add missing details: {fields}', fr: 'Ajoutez les détails manquants : {fields}', sw: 'Ongeza maelezo yanayokosekana: {fields}', ha: 'Ƙara bayanai da suka ɓace: {fields}', tw: 'Fa nsɛm a ehia ka ho: {fields}',
  },
  'nextAction.startSeason': {
    en: 'Start your farming season', fr: 'Commencez votre saison', sw: 'Anza msimu wako wa kilimo', ha: 'Fara lokacin gona', tw: 'Fi wo afuoyɛ bere ase',
  },
  'nextAction.startSeasonReason': {
    en: 'Your farm is ready. Begin tracking your crops.', fr: 'Votre ferme est prête. Commencez le suivi.', sw: 'Shamba lako liko tayari. Anza kufuatilia.', ha: 'Gonar ka a shirye. Fara bin diddigin.', tw: 'Wo afuo asiesie. Fi ase di akyi.',
  },
  'nextAction.overdueTask': {
    en: 'Complete overdue task', fr: 'Tâche en retard à terminer', sw: 'Kamilisha kazi iliyochelewa', ha: 'Kammala aikin da ya makara', tw: 'Wie adwuma a atwam',
  },
  'nextAction.overdueTaskReason': {
    en: '{task} is {days} days overdue.', fr: '{task} est en retard de {days} jours.', sw: '{task} imechelewa siku {days}.', ha: '{task} ya makara kwanaki {days}.', tw: '{task} atwam nnansa {days}.',
  },
  'nextAction.reportHarvest': {
    en: 'Report your harvest', fr: 'Déclarez votre récolte', sw: 'Ripoti mavuno yako', ha: 'Ba da rahoton girbi', tw: 'Ka wo twabere ho',
  },
  'nextAction.reportHarvestReason': {
    en: 'Your crop is at harvest stage. Record your results.', fr: 'Votre culture est au stade récolte.', sw: 'Mazao yako yako hatua ya mavuno.', ha: 'Amfanin gonar ka yana matakin girbi.', tw: 'Wo nnɔbae adu twa bere.',
  },
  'nextAction.addUpdate': {
    en: 'Add a farm update', fr: 'Ajoutez une mise à jour', sw: 'Ongeza taarifa ya shamba', ha: 'Ƙara sabuntawar gona', tw: 'Fa afuo nsɛm foforo bra',
  },
  'nextAction.addUpdateReason': {
    en: 'No update in {days} days. Log how your crops are doing.', fr: 'Aucune mise à jour depuis {days} jours.', sw: 'Hakuna taarifa kwa siku {days}.', ha: 'Babu sabuntawa cikin kwanaki {days}.', tw: 'Nsɛm foforo biara mmaa nnansa {days} mu.',
  },
  'nextAction.upcomingTask': {
    en: 'Complete your next task', fr: 'Terminez votre prochaine tâche', sw: 'Kamilisha kazi yako inayofuata', ha: 'Kammala aikin ka na gaba', tw: 'Wie wo adwuma a edi so',
  },
  'nextAction.upcomingTaskReason': {
    en: '{task} is due in {days} days.', fr: '{task} est à faire dans {days} jours.', sw: '{task} inapaswa kufanywa katika siku {days}.', ha: '{task} ya kamata a kwanaki {days}.', tw: '{task} ɛsɛ sɛ wowie wɔ nnansa {days} mu.',
  },
  'nextAction.weeklyCheck': {
    en: 'Take a photo of your farm', fr: 'Prenez une photo de votre ferme', sw: 'Piga picha ya shamba lako', ha: 'Ɗauki hoton gonar ka', tw: 'Twa wo afuo mfonini',
  },
  'nextAction.weeklyCheckReason': {
    en: 'It has been {days} days since your last update.', fr: 'Cela fait {days} jours depuis la dernière mise à jour.', sw: 'Imekuwa siku {days} tangu taarifa yako ya mwisho.', ha: 'Kwanaki {days} ne tun sabuntawa ta ƙarshe.', tw: 'Nnansa {days} afa fi wo nsɛm foforo a etwa to.',
  },
  'nextAction.monitorPlanting': {
    en: 'Check your planting', fr: 'Vérifiez vos semis', sw: 'Angalia upanzi wako', ha: 'Duba shukar ka', tw: 'Hwɛ wo duadua so',
  },
  'nextAction.monitorPlantingReason': {
    en: 'Check that seeds are germinating well.', fr: 'Vérifiez la bonne germination.', sw: 'Angalia mbegu zinaota vizuri.', ha: 'Duba tsiron suna tsirowa da kyau.', tw: 'Hwɛ sɛ aba no refifi yiye.',
  },
  'nextAction.monitorGrowth': {
    en: 'Check your crop growth', fr: 'Vérifiez la croissance', sw: 'Angalia ukuaji wa mazao', ha: 'Duba girman amfanin gona', tw: 'Hwɛ wo nnɔbae nyin',
  },
  'nextAction.monitorGrowthReason': {
    en: 'Look for pests, weeds, or signs of disease.', fr: 'Recherchez parasites, mauvaises herbes ou maladies.', sw: 'Tafuta wadudu, magugu au dalili za magonjwa.', ha: 'Nemi ƙwari, ciyawa, ko alamun cuta.', tw: 'Hwehwɛ mmoa, wura, anaa yare nsɛnkyerɛnne.',
  },
  'nextAction.monitorFlowering': {
    en: 'Watch your flowering crop', fr: 'Surveillez la floraison de votre culture', sw: 'Angalia maua ya zao lako', ha: 'Duba furen amfaninku', tw: 'Hwɛ wo nnɔbae nhwiren',
  },
  'nextAction.monitorFloweringReason': {
    en: 'Good pollination means better yield.', fr: 'Une bonne pollinisation signifie un meilleur rendement.', sw: 'Uchavushaji mzuri unamaanisha mavuno bora.', ha: 'Kyakkyawan pollination yana nufin ingantaccen amfanin gona.', tw: 'Adua yie kyerɛ sɛ aduane bɛba pii.',
  },
  'nextAction.onTrack': {
    en: 'Your farm is on track', fr: 'Votre ferme est sur la bonne voie', sw: 'Shamba lako linaendelea vizuri', ha: 'Gonar ka tana tafiya daidai', tw: 'Wo afuo rekɔ yiye',
  },
  'nextAction.onTrackReason': {
    en: 'Everything looks good. Keep checking regularly.', fr: 'Tout va bien. Continuez à vérifier.', sw: 'Kila kitu kinaonekana vizuri. Endelea kuangalia.', ha: 'Komai yana kyau. Ci gaba da duba.', tw: 'Biribiara yɛ. Toa so hwɛ daa.',
  },

  // ═══════════════════════════════════════════════════════════
  //  GUIDED FARMING — new farmer step-based workflow
  // ═══════════════════════════════════════════════════════════

  'guided.experienceQuestion': {
    en: 'Are you new to farming?', fr: 'Êtes-vous nouveau en agriculture ?', sw: 'Je, wewe ni mpya katika kilimo?', ha: 'Sabon kai ne a noma?', tw: 'Woyɛ afuoyɛ foforo?',
  },
  'guided.newFarmer': {
    en: "Yes, I'm new", fr: 'Oui, je débute', sw: 'Ndiyo, mimi ni mpya', ha: "Eh, sabon ni ne", tw: 'Aane, meyɛ foforo',
  },
  'guided.experienced': {
    en: 'No, I have experience', fr: "Non, j'ai de l'expérience", sw: 'Hapana, nina uzoefu', ha: "A'a, ina da kwarewa", tw: 'Daabi, mewɔ osuahu',
  },
  'guided.stepOf': {
    en: 'Step {current} of {total}', fr: 'Étape {current} sur {total}', sw: 'Hatua {current} ya {total}', ha: 'Mataki {current} daga {total}', tw: 'Anammɔn {current} wɔ {total} mu',
  },
  'guided.allDone': {
    en: 'Great work! You completed all steps.', fr: 'Excellent ! Toutes les étapes terminées.', sw: 'Vizuri sana! Hatua zote zimekamilika.', ha: 'Aiki mai kyau! Duk matakan sun kammala.', tw: 'Adwuma pa! Anammɔn nyinaa awie.',
  },
  'guided.reminder': {
    en: "Let's continue your farming steps", fr: 'Continuons vos étapes agricoles', sw: 'Tuendelee na hatua zako za kilimo', ha: 'Mu ci gaba da matakan noma', tw: 'Ma yɛnkɔ so wo afuoyɛ anammɔn',
  },
  'guided.step.prepare': {
    en: 'Prepare your land', fr: 'Préparez le terrain', sw: 'Andaa shamba lako', ha: 'Shirya gonar ka', tw: 'Siesie wo asase',
  },
  'guided.step.prepare.desc': {
    en: 'Clear and till the soil.', fr: 'Nettoyez et labourez le sol.', sw: 'Safisha na lima udongo.', ha: 'Share da noma ƙasa.', tw: 'Tew na funtum asase no.',
  },
  'guided.step.prepare.cta': {
    en: 'Land is ready', fr: 'Terrain prêt', sw: 'Shamba liko tayari', ha: 'Gona ta shirye', tw: 'Asase asiesie',
  },
  'guided.step.plant': {
    en: 'Plant your crop', fr: 'Plantez votre culture', sw: 'Panda mazao yako', ha: 'Shuka amfanin gona', tw: 'Dua wo nnɔbae',
  },
  'guided.step.plant.desc': {
    en: 'Put seeds in the ground.', fr: 'Mettez les semences en terre.', sw: 'Weka mbegu ardhini.', ha: 'Saka iri a ƙasa.', tw: 'Fa aba gu asase mu.',
  },
  'guided.step.plant.cta': {
    en: 'I planted', fr: "J'ai planté", sw: 'Nimepanda', ha: 'Na shuka', tw: 'Maduae',
  },
  'guided.step.water': {
    en: 'Water your crop', fr: 'Arrosez votre culture', sw: 'Mwagilia mazao', ha: 'Shayar da ruwa', tw: 'Pete nsuo',
  },
  'guided.step.water.desc': {
    en: 'Keep the soil moist.', fr: 'Gardez le sol humide.', sw: 'Weka udongo unyevu.', ha: 'Ajiye ƙasa da ɗanshi.', tw: 'Ma asase no nyɛ nsunsuanee.',
  },
  'guided.step.water.cta': {
    en: 'I watered', fr: "J'ai arrosé", sw: 'Nimemwagilia', ha: 'Na shayar', tw: 'Mapete nsuo',
  },
  'guided.step.maintain': {
    en: 'Check your farm', fr: 'Vérifiez votre ferme', sw: 'Angalia shamba lako', ha: 'Duba gonar ka', tw: 'Hwɛ wo afuo',
  },
  'guided.step.maintain.desc': {
    en: 'Remove weeds. Check for pests.', fr: 'Enlevez les herbes. Surveillez les nuisibles.', sw: 'Ondoa magugu. Angalia wadudu.', ha: 'Cire ciyawa. Duba ƙwari.', tw: 'Yi wura. Hwɛ mmoa.',
  },
  'guided.step.maintain.cta': {
    en: 'Farm checked', fr: 'Ferme vérifiée', sw: 'Shamba limeangaliwa', ha: 'An duba gona', tw: 'Wɔahwɛ afuo',
  },
  'guided.step.harvest': {
    en: 'Harvest your crop', fr: 'Récoltez', sw: 'Vuna mazao yako', ha: 'Girbe amfanin gona', tw: 'Twa wo nnɔbae',
  },
  'guided.step.harvest.desc': {
    en: 'Collect your crop.', fr: 'Récoltez votre culture.', sw: 'Vuna mazao yako.', ha: 'Tattara amfanin gona.', tw: 'Twa wo nnɔbae.',
  },
  'guided.step.harvest.cta': {
    en: 'I harvested', fr: "J'ai récolté", sw: 'Nimevuna', ha: 'Na girbe', tw: 'Matwa',
  },

  // ═══════════════════════════════════════════════════════════
  //  WEATHER DECISION
  // ═══════════════════════════════════════════════════════════

  'weather.title': {
    en: 'Weather for your farm', fr: 'Météo pour votre ferme', sw: 'Hali ya hewa ya shamba lako', ha: 'Yanayin gonar ka', tw: 'Wim tebea wɔ wo afuo',
  },
  'weather.loading': {
    en: 'Loading local weather...', fr: 'Chargement de la météo...', sw: 'Inapakia hali ya hewa...', ha: 'Ana lodi yanayi...', tw: 'Ɛreload wim tebea...',
  },
  'weather.unavailable': {
    en: 'Weather data unavailable. Check your connection and try again.', fr: 'Données météo indisponibles. Vérifiez votre connexion.', sw: 'Data ya hali ya hewa haipatikani. Angalia mtandao wako.', ha: 'Bayanin yanayi ba ya samu ba. Duba haɗin ka.', tw: 'Wim tebea nsɛm nni hɔ. Hwɛ wo intanɛt.',
  },
  'weather.usingLocation': {
    en: 'Using location:', fr: 'Position utilisée :', sw: 'Mahali:', ha: 'Wuri:', tw: 'Beae:',
  },
  'weather.addGps': {
    en: 'Add GPS or type your location to get local weather advice.', fr: 'Ajoutez le GPS ou saisissez votre position.', sw: 'Weka GPS au andika mahali pako kupata ushauri wa hewa.', ha: 'Ƙara GPS ko rubuta wurin ka don yanayi.', tw: 'Fa GPS anaa twerɛ wo beae nya wim tebea afutuɔ.',
  },
  'weather.rainLikely': {
    en: 'Today: Rain is likely. Plan farm work carefully.', fr: 'Aujourd\'hui : pluie probable. Planifiez avec soin.', sw: 'Leo: Mvua inatarajiwa. Panga kazi kwa makini.', ha: 'Yau: Ruwan sama mai yiwuwa. Tsara aiki da hankali.', tw: 'Ɛnnɛ: Nsuo bɛtɔ. Yɛ nhyehyɛe yiye.',
  },
  'weather.noSpray': {
    en: 'Today: Avoid spraying. Wind is strong.', fr: 'Aujourd\'hui : pas de pulvérisation. Vent fort.', sw: 'Leo: Epuka kupulizia. Upepo ni mkali.', ha: 'Yau: Guji fesa. Iska mai ƙarfi.', tw: 'Ɛnnɛ: Mfa aduru mpete. Mframa yɛ den.',
  },
  'weather.safeActivity': {
    en: 'Today: Safe for normal farm activity.', fr: 'Aujourd\'hui : activité normale sans risque.', sw: 'Leo: Salama kwa shughuli za kawaida.', ha: 'Yau: Lafiya don aikin gona na yau da kullun.', tw: 'Ɛnnɛ: Ɛyɛ sɛ woyɛ afuoyɛ adwuma.',
  },

  // ─── Weather badge + risk wording for the Today screen ──
  'weather.badge.low': {
    en: 'Weather looks calm', fr: 'Météo calme', sw: 'Hali ya hewa shwari', ha: 'Yanayi lafiya', tw: 'Wim tebea yɛ dwoodwoo', hi: 'मौसम शांत है',
  },
  'weather.badge.medium': {
    en: 'Weather needs attention', fr: 'Météo à surveiller', sw: 'Angalia hali ya hewa', ha: 'Kula da yanayi', tw: 'Hwɛ wim tebea yiye', hi: 'मौसम पर ध्यान दें',
  },
  'weather.badge.high': {
    en: 'Weather risk is high today', fr: 'Risque météo élevé', sw: 'Hatari kubwa ya hewa leo', ha: 'Haɗarin yanayi mai girma yau', tw: 'Wim tebea ho asiane yɛ kɛse ɛnnɛ', hi: 'आज मौसम का जोखिम अधिक है',
  },
  'weather.alert.heatHigh': {
    en: 'High heat expected today — keep crops watered and shaded.', fr: 'Forte chaleur — arrosez et ombragez.', sw: 'Joto kali leo — mwagilia na weka kivuli.', ha: 'Zafi mai yawa yau — shayar da kare rana.', tw: 'Ɛyɛ hyew ɛnnɛ — gugu na fa nyunu bɔ nnɔbae ho ban.', hi: 'आज तेज़ गर्मी रहेगी — फसलों को पानी दें और छाया करें।',
  },
  'weather.alert.rainHeavy': {
    en: 'Heavy rain expected — delay planting and protect harvested crops.', fr: 'Fortes pluies — retardez les plantations.', sw: 'Mvua kubwa — chelewesha kupanda, linda mavuno.', ha: 'Ruwan sama mai ƙarfi — jinkirta shuka.', tw: 'Nsuo bɛtɔ pa — twɛn na wo dua, bɔ wo nnɔbae ho ban.', hi: 'भारी बारिश की संभावना है — बुआई टालें और कटी फसल की रक्षा करें।',
  },
  'weather.alert.frost': {
    en: 'Frost possible overnight — cover sensitive seedlings.', fr: 'Gel possible — couvrez les plants sensibles.', sw: 'Theluji usiku — funika miche.', ha: 'Yiwuwar sanyi da dare — rufe tsire-tsire.', tw: 'Awɔw bɛba anadwo — kata nnɔbae foforɔ so.', hi: 'रात में पाला संभव है — कोमल पौधों को ढकें।',
  },
  'weather.alert.humidityPest': {
    en: 'Humidity is high — walk the rows and scout for disease.', fr: 'Humidité élevée — surveillez les maladies.', sw: 'Unyevu mkubwa — angalia magonjwa.', ha: 'Laima mai yawa — duba cututtuka.', tw: 'Nsu a ɛwɔ wim dɔɔso — hwɛ yadeɛ.', hi: 'नमी अधिक है — खेत में घूमकर रोगों की जाँच करें।',
  },
  'weather.alert.windHigh': {
    en: 'Windy day — skip spraying and stake tall plants.', fr: 'Vent fort — ne pulvérisez pas.', sw: 'Upepo mkali — usipulizie.', ha: 'Iska mai ƙarfi — kada ku fesa.', tw: 'Mframa yɛ den — mfa aduru mpete.', hi: 'तेज़ हवा है — छिड़काव न करें और ऊँचे पौधों को सहारा दें।',
  },

  // ─── Weather Intelligence (wx.*) ─────────────────────
  'wx.safe': { en: 'Safe for normal farm work', fr: 'Activité normale sans risque', sw: 'Salama kwa kazi ya shamba', ha: 'Lafiya don aikin gona', tw: 'Ɛyɛ sɛ woyɛ afuoyɛ adwuma' },
  'wx.safeReason': { en: 'Good conditions today.', fr: 'Bonnes conditions aujourd\'hui.', sw: 'Hali nzuri leo.', ha: 'Yanayi mai kyau yau.', tw: 'Tebea yɛ ɛnnɛ.' },
  'wx.safeVoice': { en: 'Safe for normal farm activity today.', fr: 'Activité normale sans risque aujourd\'hui.', sw: 'Salama kwa shughuli za shamba leo.', ha: 'Lafiya don aikin gona yau.', tw: 'Ɛnnɛ ɛyɛ sɛ woyɛ afuoyɛ adwuma.' },

  'wx.dry': { en: 'Dry today — water your crop', fr: 'Sec aujourd\'hui — arrosez', sw: 'Kavu leo — mwagilia mazao', ha: 'Bushe yau — shayar da amfani', tw: 'Ɛyɛ hyew ɛnnɛ — gugu wo nnɔbae' },
  'wx.dryReason': { en: 'Low humidity ({humidity}%). Your crop may need water.', fr: 'Humidité basse ({humidity}%).', sw: 'Unyevu mdogo ({humidity}%).', ha: 'Ƙarancin zafi ({humidity}%).', tw: 'Nsu a ɛwɔ wim no sua ({humidity}%).' },
  'wx.dryVoice': { en: 'Dry conditions today. Water your crop.', fr: 'Conditions sèches. Arrosez votre culture.', sw: 'Hali kavu leo. Mwagilia mazao yako.', ha: 'Bushe yau. Shayar da amfanin ku.', tw: 'Ɛyɛ hyew ɛnnɛ. Gugu wo nnɔbae.' },

  'wx.veryDry': { en: 'Very dry — water your crop now', fr: 'Très sec — arrosez maintenant', sw: 'Kavu sana — mwagilia sasa', ha: 'Bushe ƙwarai — shayar yanzu', tw: 'Ɛyɛ hyew pa — gugu ntɛm' },
  'wx.veryDryReason': { en: 'Very low humidity ({humidity}%). Crop stress risk.', fr: 'Humidité très basse ({humidity}%).', sw: 'Unyevu mdogo sana ({humidity}%).', ha: 'Zafi ƙarami ƙwarai ({humidity}%).', tw: 'Nsu a ɛwɔ wim no sua pa ({humidity}%).' },
  'wx.veryDryVoice': { en: 'Very dry today. Water your crop now.', fr: 'Très sec. Arrosez maintenant.', sw: 'Kavu sana leo. Mwagilia sasa.', ha: 'Bushe ƙwarai yau. Shayar yanzu.', tw: 'Ɛyɛ hyew pa ɛnnɛ. Gugu ntɛm.' },

  'wx.drySpell': { en: 'Dry spell risk — water urgently', fr: 'Risque de sécheresse — arrosez', sw: 'Hatari ya ukame — mwagilia haraka', ha: 'Haɗarin fari — shayar da gaggawa', tw: 'Awɔw bere mu — gugu ntɛm' },
  'wx.drySpellReason': { en: 'Extended dry period detected.', fr: 'Période sèche prolongée.', sw: 'Kipindi kirefu cha ukavu.', ha: 'An gano lokacin bushe.', tw: 'Wɔahu sɛ ɛyɛ hyew bere tenten.' },
  'wx.drySpellVoice': { en: 'Dry spell risk. Water your crop urgently.', fr: 'Risque de sécheresse. Arrosez votre culture.', sw: 'Hatari ya ukame. Mwagilia haraka.', ha: 'Haɗarin fari. Shayar da gaggawa.', tw: 'Awɔw bere mu. Gugu wo nnɔbae ntɛm.' },

  // Rain NOW — currently raining (measured precipitation or rain weather code)
  'wx.rainingNow': { en: 'Raining now — stay indoors', fr: 'Il pleut — restez à l\'abri', sw: 'Mvua sasa — kaa ndani', ha: 'Ruwan sama yana yi — zauna ciki', tw: 'Nsuo retɔ — tra dan mu' },
  'wx.rainingNowReason': { en: 'Rain detected. Avoid outdoor drying and spraying.', fr: 'Pluie détectée. Pas de séchage ni pulvérisation.', sw: 'Mvua imegunduliwa. Usikaushe nje.', ha: 'An gano ruwan sama. Kada ku bushe waje.', tw: 'Nsuo retɔ. Nnhwɛ nneɛma wɔ abɔnten.' },
  'wx.rainingNowVoice': { en: 'It is raining now. Protect your harvest.', fr: 'Il pleut maintenant. Protégez votre récolte.', sw: 'Mvua inanyesha sasa. Linda mazao yako.', ha: 'Ruwan sama yana sauka. Kare girbi.', tw: 'Nsuo retɔ seesei. Bɔ wo nnɔbae ho ban.' },

  // Rain LATER — dry now but rain likely later today (today forecast >= 2mm)
  'wx.rainLater': { en: 'Dry now — rain later today', fr: 'Sec maintenant — pluie prévue aujourd\'hui', sw: 'Kavu sasa — mvua baadaye', ha: 'Bushe yanzu — ruwan sama daga baya', tw: 'Ɛyɛ hyew seesei — nsuo bɛba akyire yi' },
  'wx.rainLaterReason': { en: 'Expect {rain}mm later. Store crops before rain.', fr: 'Pluie de {rain}mm prévue. Mettez les grains à l\'abri.', sw: 'Tarajia {rain}mm baadaye. Hifadhi mazao kabla ya mvua.', ha: 'Ana sa ran {rain}mm daga baya. Ajiye amfani kafin ruwa.', tw: 'Nsuo bɛtɔ {rain}mm akyire. Sie wo nneɛma ansa na nsuo atɔ.' },
  'wx.rainLaterVoice': { en: 'Dry now but rain expected later. Store your harvest before rain.', fr: 'Sec maintenant mais pluie prévue. Mettez les grains sous abri.', sw: 'Kavu sasa lakini mvua baadaye. Hifadhi mazao kabla ya mvua.', ha: 'Bushe yanzu amma ruwan sama yana zuwa. Ajiye amfani.', tw: 'Ɛyɛ hyew seesei nanso nsuo reba. Sie wo nneɛma.' },

  // Legacy key kept for backward compat — now points to "rain later" semantics
  'wx.rainExpected': { en: 'Dry now — rain later today', fr: 'Sec maintenant — pluie prévue aujourd\'hui', sw: 'Kavu sasa — mvua baadaye', ha: 'Bushe yanzu — ruwan sama daga baya', tw: 'Ɛyɛ hyew seesei — nsuo bɛba akyire yi' },
  'wx.rainExpectedReason': { en: 'Expect {rain}mm later. Store crops before rain.', fr: 'Pluie de {rain}mm prévue. Mettez les grains à l\'abri.', sw: 'Tarajia {rain}mm baadaye. Hifadhi mazao kabla ya mvua.', ha: 'Ana sa ran {rain}mm daga baya. Ajiye amfani kafin ruwa.', tw: 'Nsuo bɛtɔ {rain}mm akyire. Sie wo nneɛma ansa na nsuo atɔ.' },
  'wx.rainExpectedVoice': { en: 'Dry now but rain expected later. Store your harvest before rain.', fr: 'Sec maintenant mais pluie prévue. Mettez les grains sous abri.', sw: 'Kavu sasa lakini mvua baadaye. Hifadhi mazao kabla ya mvua.', ha: 'Bushe yanzu amma ruwan sama yana zuwa. Ajiye amfani.', tw: 'Ɛyɛ hyew seesei nanso nsuo reba. Sie wo nneɛma.' },

  'wx.heavyRain': { en: 'Heavy rain — protect your crop', fr: 'Fortes pluies — protégez vos cultures', sw: 'Mvua kubwa — linda mazao', ha: 'Ruwan sama mai ƙarfi — kare amfani', tw: 'Nsuo bɛtɔ pa — bɔ wo nnɔbae ho ban' },
  'wx.heavyRainReason': { en: 'Heavy rain expected ({rain}mm). Risk of crop damage.', fr: 'Fortes pluies prévues ({rain}mm).', sw: 'Mvua kubwa inatarajiwa ({rain}mm).', ha: 'Ruwan sama mai ƙarfi ({rain}mm).', tw: 'Nsuo bɛtɔ pa ({rain}mm).' },
  'wx.heavyRainVoice': { en: 'Heavy rain coming. Protect your crop and avoid field work.', fr: 'Fortes pluies. Protégez vos cultures.', sw: 'Mvua kubwa inakuja. Linda mazao yako.', ha: 'Ruwan sama mai ƙarfi. Kare amfanin ku.', tw: 'Nsuo bɛtɔ pa. Bɔ wo nnɔbae ho ban.' },

  'wx.highWind': { en: 'High wind — avoid spraying', fr: 'Vent fort — pas de pulvérisation', sw: 'Upepo mkali — usinyunyizie', ha: 'Iska mai ƙarfi — kada ka fesa', tw: 'Mframa kɛse — nnye aduro ngu' },
  'wx.highWindReason': { en: 'Wind at {wind} km/h. Unsafe for spraying.', fr: 'Vent à {wind} km/h.', sw: 'Upepo wa {wind} km/h.', ha: 'Iska {wind} km/h.', tw: 'Mframa {wind} km/h.' },
  'wx.highWindVoice': { en: 'Strong wind today. Do not spray.', fr: 'Vent fort. Ne pas pulvériser.', sw: 'Upepo mkali leo. Usinyunyizie.', ha: 'Iska mai ƙarfi yau. Kada ka fesa.', tw: 'Mframa kɛse ɛnnɛ. Nnye aduro ngu.' },

  'wx.hot': { en: 'Hot today — water in the morning', fr: 'Chaud — arrosez le matin', sw: 'Joto leo — mwagilia asubuhi', ha: 'Zafi yau — shayar da safe', tw: 'Ɛyɛ hyew ɛnnɛ — gugu anɔpa' },
  'wx.hotReason': { en: 'Temperature at {temp}°C. Avoid midday field work.', fr: 'Température de {temp}°C.', sw: 'Joto la {temp}°C.', ha: 'Zafin {temp}°C.', tw: 'Ahohyehye yɛ {temp}°C.' },
  'wx.hotVoice': { en: 'Hot today. Water early morning. Avoid midday work.', fr: 'Chaud. Arrosez tôt le matin.', sw: 'Joto leo. Mwagilia asubuhi mapema.', ha: 'Zafi yau. Shayar da safe.', tw: 'Ɛyɛ hyew ɛnnɛ. Gugu anɔpa tuatuaa.' },

  'wx.windyButSafe': { en: 'Breezy today — safe for most work', fr: 'Venteux — activité normale', sw: 'Upepo kidogo — kazi ya kawaida', ha: 'Iska kaɗan — aikin yau da kullun', tw: 'Mframa kakra — adwuma nyinaa yɛ' },
  'wx.windyButSafeReason': { en: 'Wind at {wind} km/h. Normal activity is fine.', fr: 'Vent à {wind} km/h.', sw: 'Upepo wa {wind} km/h.', ha: 'Iska {wind} km/h.', tw: 'Mframa {wind} km/h.' },
  'wx.windyButSafeVoice': { en: 'A bit windy but safe for farm work.', fr: 'Un peu de vent mais activité normale.', sw: 'Upepo kidogo lakini salama.', ha: 'Iska kaɗan amma lafiya.', tw: 'Mframa kakra nanso ɛyɛ.' },

  'wx.noData': { en: 'No weather alert today', fr: 'Pas d\'alerte météo', sw: 'Hakuna tahadhari ya hewa', ha: 'Babu sanarwar yanayi', tw: 'Wim ho nsɛm biara nni hɔ' },
  'wx.noDataReason': { en: 'Weather data unavailable.', fr: 'Données météo indisponibles.', sw: 'Data ya hewa haipatikani.', ha: 'Bayanin yanayi ba su samu ba.', tw: 'Wim ho nsɛm nni hɔ.' },
  'wx.noDataVoice': { en: 'No weather alert. Continue with your farm tasks.', fr: 'Pas d\'alerte. Continuez vos tâches.', sw: 'Hakuna tahadhari. Endelea na kazi.', ha: 'Babu sanarwa. Ci gaba da aiki.', tw: 'Nsɛm biara nni hɔ. Kɔ so yɛ adwuma.' },
  'wx.safeAction': { en: 'Safe for farm work today', fr: 'Travaux agricoles sans risque', sw: 'Salama kwa kazi ya shamba leo', ha: 'Lafiya don aikin gona yau', tw: 'Ɛnnɛ afuoyɛ adwuma yɛ' },

  // ─── Weather last-updated timestamps ─────────────
  'wx.updated.justNow': { en: 'Updated just now', fr: 'Mis à jour maintenant', sw: 'Imesasishwa sasa', ha: 'An sabunta yanzu', tw: 'Wɔayɛ no foforɔ seesei' },
  'wx.updated.1min': { en: 'Updated 1 min ago', fr: 'Mis à jour il y a 1 min', sw: 'Imesasishwa dakika 1 iliyopita', ha: 'An sabunta minti 1 da ya wuce', tw: 'Wɔayɛ no foforɔ simma 1 a atwam' },
  'wx.updated.mins': { en: 'Updated {mins} min ago', fr: 'Mis à jour il y a {mins} min', sw: 'Imesasishwa dakika {mins} zilizopita', ha: 'An sabunta minti {mins} da suka wuce', tw: 'Wɔayɛ no foforɔ simma {mins} a atwam' },
  'wx.updated.1hour': { en: 'Updated 1 hour ago', fr: 'Mis à jour il y a 1 heure', sw: 'Imesasishwa saa 1 iliyopita', ha: 'An sabunta awa 1 da ya wuce', tw: 'Wɔayɛ no foforɔ dɔnhwere 1 a atwam' },
  'wx.updated.hours': { en: 'Updated {hours} hours ago', fr: 'Mis à jour il y a {hours} heures', sw: 'Imesasishwa masaa {hours} yaliyopita', ha: 'An sabunta awanni {hours} da suka wuce', tw: 'Wɔayɛ no foforɔ dɔnhwere {hours} a atwam' },
  'wx.updated.never': { en: '', fr: '', sw: '', ha: '', tw: '' },

  // ─── Stale weather indicators ────────────────────
  'wx.stale': { en: 'Weather may be outdated', fr: 'Météo peut-être obsolète', sw: 'Hali ya hewa inaweza kuwa ya zamani', ha: 'Yanayi na iya zama tsoho', tw: 'Wim tebea ebia ayɛ dada' },
  'wx.staleVoice': { en: 'Weather information may be outdated. Check before acting.', fr: 'Les informations météo sont peut-être obsolètes.', sw: 'Habari ya hewa inaweza kuwa ya zamani.', ha: 'Bayanan yanayi na iya zama tsoho.', tw: 'Wim ho nsɛm ebia ayɛ dada.' },

  // ─── 7-day forecast signals (from Open-Meteo) ───────
  'wx.rainWeekHeavy': { en: 'Heavy rain expected this week ({mm}mm)', fr: 'Forte pluie prévue cette semaine ({mm}mm)', sw: 'Mvua kubwa inatarajiwa wiki hii ({mm}mm)', ha: 'Ana sa ran ruwan sama mai yawa a wannan mako ({mm}mm)', tw: 'Nsuo bɛtɔ pii nnawɔtwe yi mu ({mm}mm)' },
  'wx.rainWeekHeavyReason': { en: 'Plan around wet days. Protect stored crops.', fr: 'Planifiez autour des jours humides.', sw: 'Panga kuzunguka siku za mvua.', ha: 'Tsara aiki tare da ranakun ruwa.', tw: 'Yɛ nhyehyɛe wɔ nsuo nna ho.' },
  'wx.rainWeekHeavyVoice': { en: 'Heavy rain expected this week. Plan your work around wet days.', fr: 'Forte pluie prévue. Planifiez vos travaux.', sw: 'Mvua kubwa inatarajiwa. Panga kazi zako.', ha: 'Ana sa ran ruwan sama mai yawa. Tsara aikin ku.', tw: 'Nsuo bɛtɔ pii. Yɛ nhyehyɛe.' },
  'wx.rainWeekSome': { en: 'Some rain expected this week ({mm}mm)', fr: 'Pluie modérée prévue ({mm}mm)', sw: 'Mvua kidogo inatarajiwa ({mm}mm)', ha: 'Ana sa ran ruwan sama kaɗan ({mm}mm)', tw: 'Nsuo kakra bɛtɔ ({mm}mm)' },
  'wx.rainWeekSomeReason': { en: 'Good for planted crops. Check irrigation needs.', fr: 'Bon pour les cultures. Vérifiez l\'irrigation.', sw: 'Nzuri kwa mazao. Angalia umwagiliaji.', ha: 'Mai kyau ga amfanin gona. Duba ban ruwa.', tw: 'Ɛyɛ nnɔbae. Hwɛ nsuo a ɛhia.' },
  'wx.rainWeekSomeVoice': { en: 'Some rain expected this week. Good for your crops.', fr: 'Pluie modérée prévue. Bon pour vos cultures.', sw: 'Mvua kidogo inatarajiwa. Nzuri kwa mazao yako.', ha: 'Ruwan sama kaɗan ana sa ran shi. Mai kyau ga amfanin ku.', tw: 'Nsuo kakra bɛtɔ. Ɛyɛ ma wo nnɔbae.' },

  // ─── Rainfall forecast card ──────────────────────────
  'rainfall.title': { en: '7-Day Rain Forecast', fr: 'Prévision pluie 7 jours', sw: 'Utabiri wa mvua siku 7', ha: 'Hasashen ruwan sama kwana 7', tw: 'Nsuo a ɛbɛtɔ nnanson mu' },
  'rainfall.thisWeek': { en: 'this week', fr: 'cette semaine', sw: 'wiki hii', ha: 'wannan mako', tw: 'nnawɔtwe yi' },
  'rainfall.today': { en: 'Today', fr: 'Auj.', sw: 'Leo', ha: 'Yau', tw: 'Ɛnnɛ' },
  'rainfall.loading': { en: 'Loading forecast...', fr: 'Chargement des prévisions...', sw: 'Inapakia utabiri...', ha: 'Ana ɗaukar hasashe...', tw: 'Ɛreloadi...' },
  'rainfall.showMore': { en: 'Show daily detail', fr: 'Détail journalier', sw: 'Onyesha kwa siku', ha: 'Nuna daki-daki', tw: 'Kyerɛ nna mu nsɛm' },
  'rainfall.showLess': { en: 'Hide detail', fr: 'Masquer', sw: 'Ficha', ha: 'Ɓoye', tw: 'Fa sie' },
  'rainfall.noData': { en: 'No forecast data available', fr: 'Pas de prévision disponible', sw: 'Hakuna data ya utabiri', ha: 'Babu bayanan hasashe', tw: 'Nkɔmhyɛ nsɛm nni hɔ' },

  // ─── Rainfall summaries ──────────────────────────────
  'rainfall.summaryDry': { en: 'Mostly dry week ahead', fr: 'Semaine sèche à venir', sw: 'Wiki kavu mbele', ha: 'Mako bushe a gaba', tw: 'Nnawɔtwe a ɛreba no hyew' },
  'rainfall.summaryWet': { en: 'Rainy week ahead', fr: 'Semaine pluvieuse à venir', sw: 'Wiki ya mvua mbele', ha: 'Makon ruwan sama a gaba', tw: 'Nsuo bɛtɔ nnawɔtwe a ɛreba no' },
  'rainfall.summaryMixed': { en: 'Mixed week — some rain, some sun', fr: 'Semaine mixte — pluie et soleil', sw: 'Wiki changamano — mvua na jua', ha: 'Makon gauraya — ruwa da rana', tw: 'Nnawɔtwe a ɛrefra — nsuo ne awia' },

  // ─── Rainfall alerts ─────────────────────────────────
  'rainfall.heavyWeek': { en: 'Heavy rain this week ({totalMm}mm total). Protect your harvest and stored crops.', fr: 'Forte pluie cette semaine ({totalMm}mm). Protégez votre récolte.', sw: 'Mvua kubwa wiki hii ({totalMm}mm). Linda mazao yako.', ha: 'Ruwan sama mai yawa wannan mako ({totalMm}mm). Kare amfanin ku.', tw: 'Nsuo bɛtɔ pii nnawɔtwe yi ({totalMm}mm). Bɔ wo nnɔbae ho ban.' },
  'rainfall.rainTomorrow': { en: 'Rain expected tomorrow ({chance}% chance, ~{mm}mm). Plan indoor work.', fr: 'Pluie prévue demain ({chance}%, ~{mm}mm).', sw: 'Mvua inatarajiwa kesho ({chance}%, ~{mm}mm).', ha: 'Ana sa ran ruwan sama gobe ({chance}%, ~{mm}mm).', tw: 'Nsuo bɛtɔ ɔkyena ({chance}%, ~{mm}mm).' },
  'rainfall.rainLikelyTomorrow': { en: 'Rain likely tomorrow ({chance}% chance). Consider finishing outdoor tasks today.', fr: 'Pluie probable demain ({chance}%).', sw: 'Mvua inawezekana kesho ({chance}%).', ha: 'Ruwan sama mai yiwuwa gobe ({chance}%).', tw: 'Nsuo bɛtɔ ɔkyena ({chance}%).' },
  'rainfall.dryStretch': { en: 'Dry days ahead — plan irrigation or watering.', fr: 'Jours secs à venir — prévoyez l\'irrigation.', sw: 'Siku kavu mbele — panga umwagiliaji.', ha: 'Ranaku bushe a gaba — tsara ban ruwa.', tw: 'Nna a hyew reba — yɛ nsuo ho nhyehyɛe.' },
  'rainfall.droughtRisk': { en: '{days} dry days ahead — water your crops regularly.', fr: '{days} jours secs — arrosez régulièrement.', sw: 'Siku {days} kavu — mwagilia mara kwa mara.', ha: 'Ranaku {days} bushe — shayar da amfani kullum.', tw: 'Nna {days} a hyew — gugu wo nnɔbae daa.' },
  'rainfall.plantingWindow': { en: 'Rain expected in {day} days — good planting window coming.', fr: 'Pluie dans {day} jours — bon moment pour planter.', sw: 'Mvua siku {day} — wakati mzuri wa kupanda.', ha: 'Ruwan sama cikin kwana {day} — lokaci mai kyau na shuka.', tw: 'Nsuo bɛtɔ da {day} mu — bere pa a wɔbɛdua.' },
  'rainfall.delayPlanting': { en: 'Heavy rain tomorrow — delay planting to avoid seed washout.', fr: 'Forte pluie demain — reportez le semis.', sw: 'Mvua kubwa kesho — ahirisha kupanda.', ha: 'Ruwan sama mai yawa gobe — jinkirta shuka.', tw: 'Nsuo bɛtɔ pii ɔkyena — twɛn ansa na woadua.' },
  'rainfall.skipIrrigation': { en: 'Rain likely soon — skip irrigation to save water.', fr: 'Pluie prévue — reportez l\'irrigation.', sw: 'Mvua inakuja — ruka umwagiliaji.', ha: 'Ruwan sama yana zuwa — tsallake ban ruwa.', tw: 'Nsuo bɛtɔ ntɛm — gyae nsuo gu.' },
  'rainfall.goodToPlant': { en: 'Good weather this week for planting. Mixed rain and sun.', fr: 'Bon temps pour planter. Pluie et soleil.', sw: 'Hali nzuri ya kupanda. Mvua na jua.', ha: 'Yanayi mai kyau don shuka. Ruwa da rana.', tw: 'Wim tebea yɛ ma duane. Nsuo ne awia.' },
  'rainfall.harvestRainRisk': { en: 'Frequent rain this week — dry and store harvested crops quickly.', fr: 'Pluie fréquente — séchez et stockez rapidement.', sw: 'Mvua mara kwa mara — kausha na hifadhi haraka.', ha: 'Ruwan sama akai-akai — bushe da ajiye da sauri.', tw: 'Nsuo tɔ mpɛn pii — hwie na kora ntɛm.' },

  'weather.addGpsDetail': {
    en: 'Add GPS coordinates or your village/region to unlock local weather advice.', fr: 'Ajoutez les coordonnées GPS ou votre village pour la météo locale.', sw: 'Weka GPS au kijiji chako kupata ushauri wa hewa.', ha: 'Ƙara GPS ko ƙauyen ka don yanayin gida.', tw: 'Fa GPS anaa wo akuraa nya wim tebea afutuɔ.',
  },
  'weather.delayWork': {
    en: 'Delay field work that depends on dry conditions.', fr: 'Reportez le travail dépendant du temps sec.', sw: 'Ahirisha kazi inayotegemea hali kavu.', ha: 'Jinkirta aikin da ya dogara ga bushe.', tw: 'Twɛn afuoyɛ adwuma a ɛhia sɛ ɛyɛ hyew.',
  },
  'weather.noRain': {
    en: 'No immediate rain detected. Field movement looks okay.', fr: 'Pas de pluie imminente détectée. Tout va bien.', sw: 'Hakuna mvua iliyogunduliwa. Shughuli za shamba zinafaa.', ha: 'Ba a gano ruwan sama ba. Aikin gona ya yi.', tw: 'Nsuo biara nni hɔ. Afuoyɛ adwuma bɛyɛ.',
  },
  'weather.noSprayWind': {
    en: 'Do not spray chemicals in strong wind.', fr: 'Ne pas pulvériser par vent fort.', sw: 'Usipulizie kemikali upepo ukiwa mkali.', ha: 'Kada ku fesa magani a iska mai ƙarfi.', tw: 'Mfa aduru mpete sɛ mframa yɛ den.',
  },
  'weather.windOk': {
    en: 'Wind looks manageable for normal field activity.', fr: 'Vent acceptable pour l\'activité normale.', sw: 'Upepo unafaa kwa shughuli za kawaida.', ha: 'Iska ta yi don aikin gona na yau da kullun.', tw: 'Mframa yɛ sɛ ɛbɛyɛ afuoyɛ adwuma.',
  },
  'weather.heatHigh': {
    en: 'Heat is high. Protect workers and monitor moisture.', fr: 'Chaleur élevée. Protégez les travailleurs et surveillez l\'humidité.', sw: 'Joto kali. Linda wafanyakazi na fuatilia unyevu.', ha: 'Zafi mai yawa. Kare ma\'aikata ka lura da danshi.', tw: 'Ahohyehye yɛ den. Bɔ adwumayɛfoɔ ho ban na hwɛ nsuo.',
  },

  // ═══════════════════════════════════════════════════════════
  //  FARM READINESS
  // ═══════════════════════════════════════════════════════════

  'readiness.good': {
    en: 'Your setup looks good', fr: 'Votre configuration est bonne', sw: 'Usanidi wako unaonekana vizuri', ha: 'Saita ka tana da kyau', tw: 'Wo nhyehyɛe yɛ papa',
  },
  'readiness.goodDesc': {
    en: 'You\'re ready to receive stronger advice and use season tracking.', fr: 'Vous êtes prêt pour des conseils plus précis.', sw: 'Uko tayari kupokea ushauri bora na kufuatilia msimu.', ha: 'Ka shirye don samun shawarwari mafi kyau.', tw: 'Wasiesie sɛ wobɛnya afutuɔ papa.',
  },
  'readiness.incomplete': {
    en: 'Complete your setup', fr: 'Complétez votre configuration', sw: 'Kamilisha usanidi wako', ha: 'Kammala saita ka', tw: 'Wie wo nhyehyɛe',
  },
  'readiness.progress': {
    en: 'items done — add the rest to get better advice.', fr: 'éléments faits — ajoutez le reste pour de meilleurs conseils.', sw: 'vipengele vimekamilika — ongeza vingine kupata ushauri bora.', ha: 'abubuwa an gama — ƙara sauran don shawarwari mafi kyau.', tw: 'nneɛma awie — fa nea aka no ka ho nya afutuɔ papa.',
  },
  'readiness.stillNeeded': {
    en: 'What\'s still needed:', fr: 'Ce qui manque encore :', sw: 'Kinachohitajika bado:', ha: 'Abin da ake buƙata:', tw: 'Nea ehia da:',
  },

  // ═══════════════════════════════════════════════════════════
  //  ACTION RECOMMENDATIONS
  // ═══════════════════════════════════════════════════════════

  'recommend.title': {
    en: 'Improve your farm today', fr: 'Améliorez votre ferme aujourd\'hui', sw: 'Boresha shamba lako leo', ha: 'Inganta gonar ka yau', tw: 'Yɛ wo afuo papa ɛnnɛ',
  },
  'recommend.addGps': {
    en: 'Add GPS for better weather accuracy.', fr: 'Ajoutez le GPS pour une météo plus précise.', sw: 'Weka GPS kwa hali bora ya hewa.', ha: 'Ƙara GPS don yanayi daidai.', tw: 'Fa GPS nya wim tebea papa.',
  },
  'recommend.addCrop': {
    en: 'Add your crop type for better farming advice.', fr: 'Ajoutez votre type de culture pour de meilleurs conseils.', sw: 'Weka aina ya mazao yako kupata ushauri bora.', ha: 'Ƙara irin amfanin gonar ka don shawarwari mafi kyau.', tw: 'Fa wo nnɔbae mu nya afutuɔ papa.',
  },
  'recommend.reviewPlans': {
    en: 'Review today\'s plans before going to the field.', fr: 'Revoyez les plans avant d\'aller au champ.', sw: 'Pitia mipango ya leo kabla ya kwenda shambani.', ha: 'Duba tsarin yau kafin zuwa gona.', tw: 'Hwɛ ɛnnɛ nhyehyɛe ansa na woakɔ afuo.',
  },
  'recommend.normalWork': {
    en: 'Normal field work can continue today.', fr: 'Le travail normal peut continuer.', sw: 'Kazi za kawaida zinaweza kuendelea leo.', ha: 'Aikin gona na yau da kullun zai iya ci gaba.', tw: 'Afuoyɛ adwuma bɛtumi akɔ so ɛnnɛ.',
  },
  'recommend.noSpray': {
    en: 'Do not spray until wind reduces.', fr: 'Ne pas pulvériser tant que le vent ne faiblit pas.', sw: 'Usipulizie hadi upepo upungue.', ha: 'Kada ku fesa har sai iska ta ragu.', tw: 'Mfa aduru mpete kosi sɛ mframa bɛte ase.',
  },
  'recommend.allGood': {
    en: 'Your farm setup looks good. Continue your season tasks today.', fr: 'Votre configuration est bonne. Continuez vos tâches.', sw: 'Usanidi wako ni mzuri. Endelea na kazi za msimu leo.', ha: 'Saita gonar ka tana da kyau. Ci gaba da ayyukan lokaci.', tw: 'Wo afuo nhyehyɛe yɛ papa. Toa so yɛ bere adwuma ɛnnɛ.',
  },

  // ═══════════════════════════════════════════════════════════
  //  FARM SNAPSHOT
  // ═══════════════════════════════════════════════════════════

  'farm.myFarm': {
    en: 'My Farm', fr: 'Ma Ferme', sw: 'Shamba Langu', ha: 'Gonar ta', tw: 'Me Afuo',
  },
  'farm.edit': {
    en: 'Edit', fr: 'Modifier', sw: 'Hariri', ha: 'Gyara', tw: 'Sesa',
  },
  'farm.crop': {
    en: 'Crop:', fr: 'Culture :', sw: 'Mazao:', ha: 'Amfanin gona:', tw: 'Nnɔbae:',
  },
  'farm.size': {
    en: 'Size:', fr: 'Taille :', sw: 'Ukubwa:', ha: 'Girma:', tw: 'Kɛseɛ:',
  },
  'farm.acres': {
    en: 'acres', fr: 'hectares', sw: 'ekari', ha: 'eka', tw: 'eka',
  },
  'farm.location': {
    en: 'Location:', fr: 'Emplacement :', sw: 'Mahali:', ha: 'Wuri:', tw: 'Beae:',
  },
  'farm.country': {
    en: 'Country:', fr: 'Pays :', sw: 'Nchi:', ha: 'Ƙasa:', tw: 'Ɔman:',
  },
  'farm.gps': {
    en: 'GPS:', fr: 'GPS :', sw: 'GPS:', ha: 'GPS:', tw: 'GPS:',
  },
  'farm.gpsAdded': {
    en: 'Added', fr: 'Ajouté', sw: 'Imeongezwa', ha: 'An ƙara', tw: 'Wɔde aka ho',
  },
  'farm.gpsNotAdded': {
    en: 'Not added', fr: 'Non ajouté', sw: 'Haijaongezwa', ha: 'Ba a ƙara ba', tw: 'Wɔmfa anka ho',
  },

  // ─── Location display (farmer-friendly) ───────────────────
  'location.farmLocation': {
    en: 'Farm Location', fr: 'Emplacement de la ferme', sw: 'Mahali pa shamba', ha: 'Wurin gona', tw: 'Afuo beae',
  },
  'location.captured': {
    en: 'Location captured', fr: 'Emplacement enregistré', sw: 'Mahali pamehifadhiwa', ha: 'An adana wuri', tw: 'Wɔde beae ahyɛ',
  },
  'location.capturedCheck': {
    en: 'Location saved ✅', fr: 'Emplacement enregistré ✅', sw: 'Mahali pamehifadhiwa ✅', ha: 'An adana wuri ✅', tw: 'Wɔde beae ahyɛ ✅',
  },
  'location.detecting': {
    en: 'Detecting location...', fr: 'Détection en cours...', sw: 'Inatafuta mahali...', ha: 'Ana neman wuri...', tw: 'Rehwehwɛ beae...',
  },
  'location.captureGPS': {
    en: 'Capture Farm Location', fr: "Capturer l'emplacement", sw: 'Nasa mahali pa shamba', ha: 'Ɗauki wurin gona', tw: 'Fa afuo beae',
  },
  'location.update': {
    en: 'Update', fr: 'Mettre à jour', sw: 'Sasisha', ha: 'Sabunta', tw: 'Yi foforo',
  },
  'location.updating': {
    en: 'Updating...', fr: 'Mise à jour...', sw: 'Inasasisha...', ha: 'Ana sabuntawa...', tw: 'Ɛreyɛ foforo...',
  },
  'location.getMyLocation': {
    en: 'Get My Location', fr: 'Obtenir ma position', sw: 'Pata mahali pangu', ha: 'Samu wurina', tw: 'Nya me beae',
  },
  'location.gpsOptionalDesc': {
    en: 'This is optional. Your typed location is enough.', fr: "C'est facultatif. L'emplacement saisi suffit.", sw: 'Si lazima. Mahali uliloandika yanatosha.', ha: 'Na zaɓi ne. Wurin da ka rubuta ya isa.', tw: 'Nhyehyɛe. Beae a woakyerɛw no bɛyɛ.',
  },
  'location.gpsFallback': {
    en: "We couldn't get your exact location. You can continue with the location you typed.", fr: "Impossible d'obtenir votre position. Continuez avec l'emplacement que vous avez saisi.", sw: 'Hatukuweza kupata eneo lako sahihi. Unaweza kuendelea kwa kutumia mahali uliloandika.', ha: 'Ba mu samu wurin ka ba. Ci gaba da wurin da ka rubuta.', tw: 'Yɛantumi anya wo beae pɛpɛɛpɛ. Toa so fa beae a woakyerɛw no.',
  },
  'location.gpsSlow': {
    en: 'Still looking for your location...', fr: 'Recherche en cours...', sw: 'Bado inatafuta mahali pako...', ha: 'Har yanzu ana neman wurin ka...', tw: 'Ɛresan ahwehwɛ wo beae...',
  },

  // ═══════════════════════════════════════════════════════════
  //  SUPPORT
  // ═══════════════════════════════════════════════════════════

  'support.title': {
    en: 'Need Help?', fr: 'Besoin d\'aide ?', sw: 'Unahitaji msaada?', ha: 'Kana buƙatar taimako?', tw: 'Wohia mmoa?', hi: 'मदद चाहिए?',
  },
  'support.desc': {
    en: 'Send us a message and our team will respond as soon as possible.', fr: 'Envoyez-nous un message et notre équipe répondra rapidement.', sw: 'Tutumie ujumbe na timu yetu itajibu haraka.', ha: 'Aiko mana saƙo ƙungiyar mu za ta amsa da wuri.', tw: 'Fa nkra brɛ yɛn na yɛn kuw bɛyi ano ntɛm.', hi: 'हमें संदेश भेजें और हमारी टीम जल्द जवाब देगी।',
  },
  'support.sent': {
    en: 'Support request sent. We will get back to you soon.', fr: 'Demande envoyée. Nous reviendrons vers vous bientôt.', sw: 'Ombi la msaada limetumwa. Tutakujibu hivi karibuni.', ha: 'An aika buƙatun taimako. Za mu dawo maka ba da jimawa ba.', tw: 'Wɔde mmoa abisadeɛ akɔ. Yɛbɛsan wo nkyɛn ntɛm.', hi: 'अनुरोध भेज दिया गया। हम जल्द ही संपर्क करेंगे।',
  },
  'support.failed': {
    en: 'Failed to send request', fr: 'Échec de l\'envoi', sw: 'Imeshindikana kutuma ombi', ha: 'An kasa aika buƙata', tw: 'Entumi amfa abisadeɛ ankɔ', hi: 'अनुरोध भेजने में विफल',
  },
  'support.subject': {
    en: 'Subject', fr: 'Sujet', sw: 'Mada', ha: 'Batu', tw: 'Asɛm tiawa', hi: 'विषय',
  },
  'support.describe': {
    en: 'Describe your issue...', fr: 'Décrivez votre problème...', sw: 'Eleza tatizo lako...', ha: 'Bayyana matsalar ka...', tw: 'Ka wo ɔhaw ho nsɛm...', hi: 'अपनी समस्या बताएँ...',
  },
  'support.sending': {
    en: 'Sending...', fr: 'Envoi en cours...', sw: 'Inatuma...', ha: 'Ana aikawa...', tw: 'Ɛrede kɔ...', hi: 'भेजा जा रहा है...',
  },
  'support.sendRequest': {
    en: 'Send Request', fr: 'Envoyer', sw: 'Tuma ombi', ha: 'Aika buƙata', tw: 'Fa abisadeɛ kɔ', hi: 'अनुरोध भेजें',
  },

  // ═══════════════════════════════════════════════════════════
  //  SEASON TASKS
  // ═══════════════════════════════════════════════════════════

  'tasks.title': {
    en: 'What you should do today', fr: 'Ce que vous devez faire aujourd\'hui', sw: 'Unachopaswa kufanya leo', ha: 'Abin da za ka yi yau', tw: 'Nea ɛsɛ sɛ woyɛ ɛnnɛ',
  },
  'tasks.loading': {
    en: 'Loading season tasks...', fr: 'Chargement des tâches...', sw: 'Inapakia kazi za msimu...', ha: 'Ana lodi ayyukan lokaci...', tw: 'Ɛreload bere adwuma...',
  },
  'tasks.setupFirst': {
    en: 'Complete your farm setup first to unlock tasks and season tracking.', fr: 'Complétez la configuration pour débloquer les tâches.', sw: 'Kamilisha usanidi wa shamba lako kwanza.', ha: 'Kammala saita gonar ka da farko.', tw: 'Wie wo afuo nhyehyɛe kan.',
  },
  'tasks.startSeason': {
    en: 'Start your farming season to receive daily tasks.', fr: 'Commencez votre saison pour recevoir des tâches.', sw: 'Anza msimu wako wa kilimo kupata kazi za kila siku.', ha: 'Fara lokacin gonar ka don samun ayyuka.', tw: 'Fi wo afuoyɛ bere ase nya adwuma da biara.',
  },
  'tasks.pending': {
    en: 'pending', fr: 'en attente', sw: 'inasubiri', ha: 'yana jira', tw: 'ɛretwɛn',
  },
  'tasks.noTasks': {
    en: 'No tasks yet.', fr: 'Pas encore de tâches.', sw: 'Hakuna kazi bado.', ha: 'Babu ayyuka tukuna.', tw: 'Adwuma biara nni hɔ.',
  },
  'tasks.due': {
    en: 'Due:', fr: 'Échéance :', sw: 'Mwisho:', ha: 'Lokaci:', tw: 'Ɛbɛba:',
  },
  'tasks.markDone': {
    en: 'Mark Done', fr: 'Marquer terminé', sw: 'Weka imekamilika', ha: 'Alama an gama', tw: 'Hyɛ nsɔano sɛ awie',
  },
  'tasks.completed': {
    en: 'Completed', fr: 'Terminé', sw: 'Imekamilika', ha: 'An gama', tw: 'Wie',
  },

  // ═══════════════════════════════════════════════════════════
  //  FARMER ID
  // ═══════════════════════════════════════════════════════════

  'farmerUuid': {
    en: 'Farmer UUID', fr: 'UUID Agriculteur', sw: 'UUID ya Mkulima', ha: 'Farmer UUID', tw: 'Farmer UUID',
  },
  'farmerId.notAssigned': {
    en: 'Not assigned', fr: 'Non attribué', sw: 'Haijagawiwa', ha: 'Ba a sanya ba', tw: 'Wɔmfa amma',
  },
  'farmerId.copied': {
    en: 'Copied', fr: 'Copié', sw: 'Imenakiliwa', ha: 'An kwafa', tw: 'Wɔakɔpi',
  },

  // ═══════════════════════════════════════════════════════════
  //  PEST / INTELLIGENCE — crop health check, risk results
  // ═══════════════════════════════════════════════════════════

  'pest.title': {
    en: 'Crop Health Check', fr: 'Bilan Santé Culture', sw: 'Ukaguzi wa Afya ya Mazao', ha: 'Binciken Lafiyar Amfanin Gona', tw: 'Afuom Apomuden Nhwehwɛmu',
  },
  'pest.subtitle': {
    en: 'Answer a few questions to check your crop', fr: 'Répondez à quelques questions', sw: 'Jibu maswali machache', ha: 'Amsa tambayoyi kaɗan', tw: 'Bua nsɛm tiawa bi',
  },
  'pest.step1': {
    en: 'Crop Info', fr: 'Info Culture', sw: 'Taarifa za Mazao', ha: 'Bayanan Amfanin Gona', tw: 'Afuom Nsɛm',
  },
  'pest.step2': {
    en: 'Upload Photos', fr: 'Télécharger Photos', sw: 'Pakia Picha', ha: 'Ɗora Hotuna', tw: 'Fa Mfonini',
  },
  'pest.step3': {
    en: 'Answer Questions', fr: 'Répondre aux Questions', sw: 'Jibu Maswali', ha: 'Amsa Tambayoyi', tw: 'Bua Nsɛmmisa',
  },
  'pest.step4': {
    en: 'Review & Submit', fr: 'Vérifier et Soumettre', sw: 'Kagua na Wasilisha', ha: 'Duba kuma Aika', tw: 'Hwɛ na Fa Bra',
  },
  'pest.cropType': {
    en: 'Crop Type', fr: 'Type de Culture', sw: 'Aina ya Mazao', ha: 'Nau\'in Amfanin Gona', tw: 'Afuom Ahorow',
  },
  'pest.selectCrop': {
    en: 'Select crop', fr: 'Choisir culture', sw: 'Chagua mazao', ha: 'Zaɓi amfanin gona', tw: 'Yi afuom bi',
  },
  'pest.growthStage': {
    en: 'Growth Stage', fr: 'Stade de Croissance', sw: 'Hatua ya Ukuaji', ha: 'Matakin Girma', tw: 'Nkɔso Bere',
  },
  'pest.selectStage': {
    en: 'Select stage', fr: 'Choisir stade', sw: 'Chagua hatua', ha: 'Zaɓi mataki', tw: 'Yi bere bi',
  },
  'pest.photoLeaf': {
    en: 'Close-up of leaf', fr: 'Gros plan feuille', sw: 'Picha ya jani karibu', ha: 'Hoton ganye kusa', tw: 'Nhaban ho mfonini',
  },
  'pest.photoPlant': {
    en: 'Whole plant', fr: 'Plante entière', sw: 'Mmea mzima', ha: 'Dukan tsiro', tw: 'Afifide nyinaa',
  },
  'pest.photoField': {
    en: 'Wide field view', fr: 'Vue large du champ', sw: 'Mtazamo mpana wa shamba', ha: 'Kallon gona mai faɗi', tw: 'Afuom mu nhwɛmu',
  },
  'pest.photoHint': {
    en: 'Take clear photos in good light', fr: 'Prenez des photos claires', sw: 'Piga picha wazi', ha: 'Ɗauki hotuna masu haske', tw: 'Tɔ mfonini papa',
  },
  'pest.imageUrlPlaceholder': {
    en: 'Paste image URL', fr: 'Coller URL image', sw: 'Bandika URL ya picha', ha: 'Manna URL na hoto', tw: 'Fa mfonini URL',
  },
  'pest.uploaded': {
    en: 'Added', fr: 'Ajouté', sw: 'Imeongezwa', ha: 'An ƙara', tw: 'Wɔde aka ho',
  },
  'pest.verifyHint': {
    en: 'Answer honestly — helps us give better advice', fr: 'Répondez honnêtement', sw: 'Jibu kwa uaminifu', ha: 'Amsa da gaskiya', tw: 'Bua nokorɛ',
  },
  'pest.q.leavesEaten': {
    en: 'Are leaves being eaten or damaged?', fr: 'Les feuilles sont-elles endommagées?', sw: 'Je, majani yanaliwa?', ha: 'Ana cin ganye?', tw: 'Wɔredi nhaban no?',
  },
  'pest.q.spreading': {
    en: 'Is the problem spreading?', fr: 'Le problème se propage-t-il?', sw: 'Je, tatizo linaenea?', ha: 'Matsalar tana yaɗuwa?', tw: 'Ɔhaw no retrɛw?',
  },
  'pest.q.insectsVisible': {
    en: 'Can you see insects on the plant?', fr: 'Voyez-vous des insectes?', sw: 'Je, unaona wadudu?', ha: 'Kana ganin kwari?', tw: 'Wuhu mmoa wɔ so?',
  },
  'pest.q.widespread': {
    en: 'Is it affecting many plants?', fr: 'Cela affecte-t-il beaucoup de plantes?', sw: 'Je, inaathiri mimea mingi?', ha: 'Ya shafi tsirrai da yawa?', tw: 'Ɛka nnua pii?',
  },
  'pest.q.recentRain': {
    en: 'Has it rained recently?', fr: 'A-t-il plu récemment?', sw: 'Je, kumenyesha hivi karibuni?', ha: 'An yi ruwan sama kwanan nan?', tw: 'Nsuo atɔ nnansa yi?',
  },
  'pest.q.recentHeat': {
    en: 'Has it been very hot lately?', fr: 'Fait-il très chaud?', sw: 'Je, kumekuwa na joto kali?', ha: 'Zafi ne sosai?', tw: 'Ɛyɛ hyew paa?',
  },
  'pest.answer.yes': {
    en: 'Yes', fr: 'Oui', sw: 'Ndiyo', ha: 'Ee', tw: 'Aane',
  },
  'pest.answer.no': {
    en: 'No', fr: 'Non', sw: 'Hapana', ha: 'A\'a', tw: 'Daabi',
  },
  'pest.answer.unsure': {
    en: 'Not sure', fr: 'Pas sûr', sw: 'Sina uhakika', ha: 'Ban sani ba', tw: 'Mennim',
  },
  'pest.photos': {
    en: 'Photos', fr: 'Photos', sw: 'Picha', ha: 'Hotuna', tw: 'Mfonini',
  },
  'pest.questionsAnswered': {
    en: 'Questions answered', fr: 'Questions répondues', sw: 'Maswali yaliyojibiwa', ha: 'Tambayoyin da aka amsa', tw: 'Nsɛmmisa a wɔabuae',
  },
  'pest.analyzing': {
    en: 'Analyzing your crop...', fr: 'Analyse en cours...', sw: 'Tunachambua mazao yako...', ha: 'Ana nazarin amfanin gonarka...', tw: 'Yɛrehwehwɛ w\'afuom mu...',
  },
  'pest.back': {
    en: 'Back', fr: 'Retour', sw: 'Rudi', ha: 'Koma', tw: 'San bra',
  },
  'pest.next': {
    en: 'Next', fr: 'Suivant', sw: 'Ifuatayo', ha: 'Na gaba', tw: 'Nea edi so',
  },
  'pest.submit': {
    en: 'Submit', fr: 'Soumettre', sw: 'Wasilisha', ha: 'Aika', tw: 'Fa bra',
  },
  'pest.submitError': {
    en: 'Failed to submit. Try again.', fr: 'Échec. Réessayez.', sw: 'Imeshindikana. Jaribu tena.', ha: 'Ya gaza. Sake gwadawa.', tw: 'Ɛnyɛ yiye. Bɔ mmɔden bio.',
  },

  // ─── Pest results ─────────────────────────────────────────
  'pest.resultTitle': {
    en: 'Crop Health Results', fr: 'Résultats Santé Culture', sw: 'Matokeo ya Afya ya Mazao', ha: 'Sakamakon Lafiyar Amfanin Gona', tw: 'Afuom Apomuden Nsɛm',
  },
  'pest.backToScan': {
    en: 'Back to scan', fr: 'Retour au scan', sw: 'Rudi kwenye ukaguzi', ha: 'Koma zuwa bincike', tw: 'San kɔ nhwehwɛmu',
  },
  'pest.whatsNext': { en: 'What happens next', fr: 'Et ensuite', sw: 'Nini kinachofuata', ha: 'Me zai biyo baya', tw: 'Dɛn na ɛba so' },
  'pest.nextStep.treatNow': { en: 'Apply treatment as soon as possible', fr: 'Appliquez le traitement dès que possible', sw: 'Tumia dawa haraka iwezekanavyo', ha: 'Yi magani da wuri-wuri', tw: 'Fa aduro to so ntɛm' },
  'pest.nextStep.monitor': { en: 'Keep watching your crop for changes', fr: 'Continuez à surveiller votre culture', sw: 'Endelea kufuatilia mazao yako', ha: 'Ka ci gaba da lura da amfanin ku', tw: 'Kɔ so hwɛ wo nnɔbae' },
  'pest.nextStep.recheck': { en: 'Check again in {days} days', fr: 'Vérifiez de nouveau dans {days} jours', sw: 'Angalia tena baada ya siku {days}', ha: 'Sake dubawa bayan kwanaki {days}', tw: 'San hwɛ bio nnansa {days} akyi' },
  'pest.nextStep.dashboard': { en: 'Farroway will remind you with your next task', fr: 'Farroway vous rappellera avec votre prochaine tâche', sw: 'Farroway itakukumbusha na kazi yako inayofuata', ha: 'Farroway zai tuna maka da aikin ku na gaba', tw: 'Farroway bɛkae wo ne wo adwuma a edi so' },
  'pest.backToDashboard': { en: 'Back to dashboard', fr: 'Retour au tableau de bord', sw: 'Rudi kwenye dashibodi', ha: 'Koma zuwa dashbod', tw: 'San kɔ dashboard' },
  'pest.confidence': {
    en: 'Confidence', fr: 'Confiance', sw: 'Uhakika', ha: 'Tabbaci', tw: 'Gyidi',
  },
  'pest.severity': {
    en: 'Risk Level', fr: 'Niveau de Risque', sw: 'Kiwango cha Hatari', ha: 'Matakin Haɗari', tw: 'Asiane Kwan',
  },
  'pest.whatToDoNow': {
    en: 'What to do now', fr: 'Que faire maintenant', sw: 'Nini cha kufanya sasa', ha: 'Me za a yi yanzu', tw: 'Deɛ wɔyɛ seisei',
  },
  'pest.whatToInspect': {
    en: 'What to inspect', fr: 'Que vérifier', sw: 'Nini cha kukagua', ha: 'Me za a duba', tw: 'Deɛ wɔhwɛ',
  },
  'pest.noActionsYet': {
    en: 'No specific actions yet', fr: 'Pas encore d\'actions', sw: 'Hakuna hatua bado', ha: 'Babu mataki tukuna', tw: 'Anwɛn deɛ wɔyɛ',
  },
  'pest.inspectGeneral': {
    en: 'Check your field regularly for changes', fr: 'Vérifiez régulièrement votre champ', sw: 'Kagua shamba lako mara kwa mara', ha: 'Duba gonarka akai-akai', tw: 'Hwɛ w\'afuom daa',
  },
  'pest.followUp': {
    en: 'Follow Up', fr: 'Suivi', sw: 'Ufuatiliaji', ha: 'Bibiyar lamari', tw: 'Di Akyi',
  },
  'pest.followUpIn': {
    en: 'Check again in {days} days', fr: 'Revérifiez dans {days} jours', sw: 'Kagua tena baada ya siku {days}', ha: 'Sake dubawa bayan kwanaki {days}', tw: 'San hwɛ nnansa {days} akyi',
  },
  'pest.wasHelpful': {
    en: 'Was this helpful?', fr: 'Cela a-t-il aidé?', sw: 'Hii imesaidia?', ha: 'Wannan ya taimaka?', tw: 'Eyi aboa?',
  },
  'pest.feedbackThanks': {
    en: 'Thanks for your feedback!', fr: 'Merci pour votre retour!', sw: 'Asante kwa maoni yako!', ha: 'Na gode da ra\'ayinku!', tw: 'Yɛda wo ase!',
  },
  'pest.yes': {
    en: 'Yes', fr: 'Oui', sw: 'Ndiyo', ha: 'Ee', tw: 'Aane',
  },
  'pest.no': {
    en: 'No', fr: 'Non', sw: 'Hapana', ha: 'A\'a', tw: 'Daabi',
  },
  'pest.logTreatment': {
    en: 'Log Treatment Applied', fr: 'Enregistrer le Traitement', sw: 'Rekodi Tiba', ha: 'Rubuta Magani', tw: 'Kyerɛw Nnuro',
  },
  'pest.loadError': {
    en: 'Failed to load data', fr: 'Échec du chargement', sw: 'Imeshindikana kupakia', ha: 'Ya gaza lodi', tw: 'Ɛanyɛ yiye',
  },
  'pest.loadingResults': {
    en: 'Loading results...', fr: 'Chargement des résultats...', sw: 'Inapakia matokeo...', ha: 'Ana lodi sakamako...', tw: 'Ɛrelode nsɛm...',
  },
  'pest.retry': {
    en: 'Try Again', fr: 'Réessayer', sw: 'Jaribu Tena', ha: 'Sake Gwadawa', tw: 'Bɔ Mmɔden Bio',
  },
  'pest.checkAgain': {
    en: 'Check Again', fr: 'Vérifier à nouveau', sw: 'Angalia Tena', ha: 'Duba Sake', tw: 'Hwɛ Bio',
  },
  'pest.loading': {
    en: 'Loading...', fr: 'Chargement...', sw: 'Inapakia...', ha: 'Ana lodawa...', tw: 'Ɛrelode...',
  },
  'pest.likelyDamage': {
    en: 'Possible crop damage detected', fr: 'Dégâts possibles détectés', sw: 'Uharibifu wa mazao umegunduliwa', ha: 'An gano yiwuwar lalacewa', tw: 'Wɔahu sɛ afuom no asɛe',
  },

  // ─── Pest risk level messages ─────────────────────────────
  'pest.levelMsg.low': {
    en: 'Your crops look healthy.', fr: 'Vos cultures semblent saines.', sw: 'Mazao yako yanaonekana mazuri.', ha: 'Amfanin gonarka suna da kyau.', tw: 'Wo nnɔbae no yɛ pa.',
  },
  'pest.levelMsg.moderate': {
    en: 'Some signs to watch. Keep an eye on it.', fr: 'Quelques signes à surveiller. Restez attentif.', sw: 'Kuna dalili za kuangalia. Endelea kuchunguza.', ha: 'Wasu alamun da za a duba. Ci gaba da kula.', tw: 'Nsɛnkyerɛnne bi wɔ hɔ. Hwɛ so yiye.',
  },
  'pest.levelMsg.high': {
    en: 'Problem found. Follow advice below.', fr: 'Problème détecté. Suivez les conseils.', sw: 'Tatizo limepatikana. Fuata ushauri.', ha: 'An sami matsala. Bi shawara.', tw: 'Wɔahu asɛm bi. Di afotu so.',
  },
  'pest.levelMsg.urgent': {
    en: 'Urgent. Act now to protect your crops.', fr: 'Urgent. Agissez maintenant.', sw: 'Dharura. Chukua hatua sasa.', ha: 'Gaggawa. Yi wani abu yanzu.', tw: 'Ntɛm. Yɛ biribi seesei.',
  },

  // ─── Pest advice ──────────────────────────────────────────
  'pest.advice.low.1': {
    en: 'Continue regular monitoring', fr: 'Continuez à surveiller', sw: 'Endelea kufuatilia', ha: 'Ci gaba da lura', tw: 'Kɔ so hwɛ so',
  },
  'pest.advice.low.2': {
    en: 'Maintain crop hygiene', fr: 'Maintenez l\'hygiène des cultures', sw: 'Dumisha usafi wa mazao', ha: 'Kiyaye tsaftar amfani', tw: 'Hwɛ nnɔbae no ho te',
  },
  'pest.advice.moderate.1': {
    en: 'Increase inspection frequency', fr: 'Augmentez la fréquence d\'inspection', sw: 'Ongeza ukaguzi', ha: 'Ƙara dubawa', tw: 'Hwɛ mu mpɛn pii',
  },
  'pest.advice.moderate.2': {
    en: 'Consider preventive treatment', fr: 'Envisagez un traitement préventif', sw: 'Fikiria matibabu ya kuzuia', ha: 'Yi tunani kan maganin rigakafi', tw: 'Susuw ayaresa a edi kan',
  },
  'pest.advice.moderate.3': {
    en: 'Check neighboring fields', fr: 'Vérifiez les champs voisins', sw: 'Kagua mashamba jirani', ha: 'Duba gonakin makwabta', tw: 'Hwɛ mfuw a ɛbɛn ho',
  },
  'pest.advice.high.1': {
    en: 'Apply recommended treatment promptly', fr: 'Appliquez le traitement recommandé', sw: 'Tumia matibabu yaliyopendekezwa', ha: 'Yi amfani da maganin da aka ba da shawara', tw: 'Fa ayaresa a wɔhyɛ aseɛ no ntɛm',
  },
  'pest.advice.high.2': {
    en: 'Isolate affected areas if possible', fr: 'Isolez les zones touchées si possible', sw: 'Tenga maeneo yaliyoathirika', ha: 'Ware yankunan da abin ya shafa', tw: 'Twe beae a ɛasɛe no fi hɔ',
  },
  'pest.advice.high.3': {
    en: 'Document damage for records', fr: 'Documentez les dégâts', sw: 'Andika uharibifu', ha: 'Rubuta lalacewar', tw: 'Kyerɛw ɔsɛe no',
  },
  'pest.advice.urgent.1': {
    en: 'Treat immediately — crop at risk', fr: 'Traitez immédiatement — culture en danger', sw: 'Tibu mara moja — mazao hatarini', ha: 'Yi magani nan da nan', tw: 'Yɛ ayaresa ntɛm — nnɔbae wɔ asiane mu',
  },
  'pest.advice.urgent.2': {
    en: 'Seek expert assistance', fr: 'Demandez l\'aide d\'un expert', sw: 'Tafuta msaada wa mtaalamu', ha: 'Nemi taimakon kwararru', tw: 'Hwehwɛ obi a onim ade mmoa',
  },
  'pest.advice.urgent.3': {
    en: 'Consider emergency measures', fr: 'Envisagez des mesures d\'urgence', sw: 'Fikiria hatua za dharura', ha: 'Yi tunani kan matakin gaggawa', tw: 'Susuw nneɛma a ɛho hia ntɛm',
  },
  'pest.advice.urgent.4': {
    en: 'Report to local agricultural office', fr: 'Signalez au bureau agricole local', sw: 'Ripoti kwa ofisi ya kilimo', ha: 'Kai rahoto ga ofishin noma', tw: 'Ka kyerɛ kurom mu adwumayɛfo',
  },

  // ─── Pest check flow messages ─────────────────────────────
  'pest.imageError': {
    en: 'Failed to process image', fr: 'Échec du traitement de l\'image', sw: 'Imeshindikana kusindika picha', ha: 'Hoto ya kasa', tw: 'Mfonini no anyɛ yiye',
  },
  'pest.offlineError': {
    en: 'No internet connection. Try again when online.', fr: 'Pas de connexion. Réessayez en ligne.', sw: 'Hakuna mtandao. Jaribu unapokuwa mtandaoni.', ha: 'Babu intanet. Sake gwadawa.', tw: 'Wonni intanɛt. Bɔ mmɔden bio.',
  },
  'pest.offline': {
    en: 'No connection — you can fill the form, but submission requires internet.', fr: 'Pas de connexion — vous pouvez remplir, mais l\'envoi nécessite internet.', sw: 'Hakuna mtandao — unaweza kujaza, lakini kutuma kunahitaji mtandao.', ha: 'Babu intanet — za ka iya cikawa, amma aikawa na bukatar intanet.', tw: 'Wonni intanɛt — wubetumi hyɛ mu, nanso wohia intanɛt ansa na woasoma.',
  },
  'pest.checking': {
    en: 'Checking...', fr: 'Vérification...', sw: 'Inakagua...', ha: 'Ana dubawa...', tw: 'Ɛrehwɛ mu...',
  },
  'pest.lowQuality': {
    en: 'Image quality too low', fr: 'Qualité d\'image trop basse', sw: 'Ubora wa picha ni mdogo', ha: 'Ingancin hoto ya yi ƙasa', tw: 'Mfonini no mu nna hɔ',
  },
  'pest.retakePhoto': {
    en: 'Remove and retake this photo.', fr: 'Supprimez et reprenez cette photo.', sw: 'Ondoa na upige picha tena.', ha: 'Cire ka sake ɗaukar hoton.', tw: 'Yi mfonini no fi hɔ na fa bio.',
  },
  'pest.morePhotosNeeded': {
    en: 'More photos needed. All 3 types are required.', fr: 'Plus de photos nécessaires. Les 3 types sont requis.', sw: 'Picha zaidi zinahitajika. Aina 3 zote zinahitajika.', ha: 'Ana bukatar ƙarin hotuna. Duk nau\'ikan 3 ana bukata.', tw: 'Mfonini pii ho hia. Ahorow 3 no nyinaa ho hia.',
  },
  'pest.stillWorking': {
    en: 'Still working...', fr: 'En cours...', sw: 'Bado inafanya kazi...', ha: 'Har yanzu yana aiki...', tw: 'Ɛreyɛ adwuma da...',
  },

  // ─── Boundary warnings ────────────────────────────────────
  'boundary.warnFewPoints': {
    en: 'Too few points — walk more of the boundary for better accuracy.', fr: 'Trop peu de points — marchez plus.', sw: 'Alama chache — tembea zaidi kwa usahihi bora.', ha: 'Maki kaɗan — yi tafiya mai yawa.', tw: 'Tɔnk kakra dodo — nante nkyɛn pii.',
  },
  'boundary.warnLowAccuracy': {
    en: 'Some points have low GPS accuracy. Move to open sky and retry.', fr: 'Certains points ont une faible précision GPS. Allez à ciel ouvert.', sw: 'Baadhi ya alama zina usahihi mdogo wa GPS. Nenda mahali wazi.', ha: 'Wasu maki suna da ƙarancin daidaituwar GPS. Je bude sarari.', tw: 'Tɔnk bi GPS no nna hɔ yiye. Kɔ baabi a wim bue na bɔ mmɔden bio.',
  },
  'boundary.warnDuplicate': {
    en: 'Last point is very close to previous — move further before adding another.', fr: 'Le dernier point est très proche du précédent — éloignez-vous.', sw: 'Alama ya mwisho iko karibu — sogea mbali zaidi.', ha: 'Makin ƙarshe ya yi kusa da na baya — matsa gaba.', tw: 'Tɔnk a etwa to no bɛn paa — kɔ akyire kakra.',
  },
  'boundary.validationFailed': {
    en: 'Boundary validation failed — try redrawing with more points.', fr: 'Validation échouée — réessayez avec plus de points.', sw: 'Uthibitisho umeshindikana — jaribu tena na alama zaidi.', ha: 'Tabbatarwa ya kasa — sake gwadawa da ƙarin maki.', tw: 'Nhwɛso no anni yie — bɔ mmɔden bio ka tɔnk pii ho.',
  },

  // ─── Hotspot alerts ───────────────────────────────────────
  'pest.stressDetected': {
    en: 'Field Stress Detected', fr: 'Stress du Champ Détecté', sw: 'Mfadhaiko wa Shamba Umegunduliwa', ha: 'An Gano Damuwar Gona', tw: 'Afuom Ɔhaw Wɔahu',
  },
  'pest.stressSubtitle': {
    en: 'Satellite monitoring found areas that need attention', fr: 'Le suivi satellite a trouvé des zones à surveiller', sw: 'Ufuatiliaji wa setilaiti umegundua maeneo yanayohitaji umakini', ha: 'Sa\'a ta gano wuraren da ke buƙatar kulawa', tw: 'Soro nhwehwɛmu ahu nneɛma a ehia wɔn hwɛ',
  },
  'pest.affectedArea': {
    en: 'Affected Area', fr: 'Zone Affectée', sw: 'Eneo Lililoathirika', ha: 'Yankin da Abin Ya Shafa', tw: 'Beae a Ɛka',
  },
  'pest.unknownArea': {
    en: 'Area not specified', fr: 'Zone non précisée', sw: 'Eneo halijatajwa', ha: 'Ba a fayyace yankin ba', tw: 'Wɔnkyerɛɛ beae no',
  },
  'pest.inspectFirst': {
    en: 'Inspect This Area First', fr: 'Inspectez Cette Zone D\'abord', sw: 'Kagua Eneo Hili Kwanza', ha: 'Fara Dubawa A nan', tw: 'Di Kan Hwɛ Ha',
  },
  'pest.inspectFullField': {
    en: 'Walk the full field and check each section', fr: 'Parcourez tout le champ', sw: 'Tembea shamba lote', ha: 'Zagaya dukkan gonar', tw: 'Nante afuom no nyinaa mu',
  },
  'pest.fieldOverview': {
    en: 'Field overview', fr: 'Vue d\'ensemble', sw: 'Muhtasari wa shamba', ha: 'Taƙaitaccen gonar', tw: 'Afuom nhwɛmu',
  },
  'pest.zone': {
    en: 'Zone {n}', fr: 'Zone {n}', sw: 'Eneo {n}', ha: 'Yanki {n}', tw: 'Beae {n}',
  },
  'pest.riskTrend': {
    en: 'Risk Trend', fr: 'Tendance du Risque', sw: 'Mwenendo wa Hatari', ha: 'Yanayin Haɗari', tw: 'Asiane Kwan',
  },
  'pest.trend.up': {
    en: 'Increasing', fr: 'En hausse', sw: 'Inapanda', ha: 'Yana ƙaruwa', tw: 'Ɛrekɔ soro',
  },
  'pest.trend.down': {
    en: 'Decreasing', fr: 'En baisse', sw: 'Inapungua', ha: 'Yana raguwa', tw: 'Ɛretew ase',
  },
  'pest.trend.stable': {
    en: 'Stable', fr: 'Stable', sw: 'Imara', ha: 'A tsaye', tw: 'Egyina hɔ',
  },
  'pest.trendSinceLast': {
    en: 'Since last scan', fr: 'Depuis le dernier scan', sw: 'Tangu ukaguzi wa mwisho', ha: 'Tun binciken karshe', tw: 'Efi nhwehwɛmu a etwa to',
  },
  'pest.uploadFromArea': {
    en: 'Upload Photos from This Area', fr: 'Télécharger Photos de Cette Zone', sw: 'Pakia Picha Kutoka Eneo Hili', ha: 'Ɗora Hotuna Daga Wannan Yankin', tw: 'Fa Mfonini fi Ha',
  },
  'pest.alertLevel.watch': {
    en: 'Watch', fr: 'Surveiller', sw: 'Angalia', ha: 'Kula', tw: 'Hwɛ',
  },
  'pest.alertLevel.elevated': {
    en: 'Elevated', fr: 'Élevé', sw: 'Imeongezeka', ha: 'Ya tashi', tw: 'Ɛkɔ soro',
  },
  'pest.alertLevel.high-risk': {
    en: 'High Risk', fr: 'Risque Élevé', sw: 'Hatari Kubwa', ha: 'Haɗari Mai Girma', tw: 'Asiane Kɛse',
  },
  'pest.alertLevel.high_risk': {
    en: 'High Risk', fr: 'Risque Élevé', sw: 'Hatari Kubwa', ha: 'Haɗari Mai Girma', tw: 'Asiane Kɛse',
  },
  'pest.alertLevel.urgent': {
    en: 'Urgent', fr: 'Urgent', sw: 'Dharura', ha: 'Gaggawa', tw: 'Ɛhia ntɛm',
  },

  // ─── Regional watch ───────────────────────────────────────
  'regional.title': {
    en: 'Regional Alerts', fr: 'Alertes Régionales', sw: 'Tahadhari za Mkoa', ha: 'Faɗakarwar Yanki', tw: 'Ɔman mu Kɔkɔbɔ',
  },
  'regional.subtitle': {
    en: 'Pest and disease alerts near your farm', fr: 'Alertes ravageurs près de votre ferme', sw: 'Tahadhari za wadudu karibu na shamba lako', ha: 'Faɗakarwar kwari kusa da gonarka', tw: 'Mmoa ne nyarewa kɔkɔbɔ a ɛbɛn w\'afuom',
  },
  'regional.active': {
    en: 'Active Alerts', fr: 'Alertes Actives', sw: 'Tahadhari Hai', ha: 'Faɗakarwar Da Ke Aiki', tw: 'Kɔkɔbɔ a Ɛwɔ Mu',
  },
  'regional.past': {
    en: 'Past Alerts', fr: 'Alertes Passées', sw: 'Tahadhari Zilizopita', ha: 'Faɗakarwar Da Suka Wuce', tw: 'Kɔkɔbɔ a Atwam',
  },
  'regional.noAlerts': {
    en: 'No alerts in your area — your region looks clear', fr: 'Pas d\'alertes dans votre zone', sw: 'Hakuna tahadhari katika eneo lako', ha: 'Babu faɗakarwa a yankinku', tw: 'Kɔkɔbɔ biara nni w\'ɔman mu',
  },

  // ─── Treatment feedback ───────────────────────────────────
  'treatment.logTitle': {
    en: 'Log Treatment', fr: 'Enregistrer Traitement', sw: 'Rekodi Tiba', ha: 'Rubuta Magani', tw: 'Kyerɛw Nnuro',
  },
  'treatment.logSubtitle': {
    en: 'Record what you applied to your crop', fr: 'Enregistrez ce que vous avez appliqué', sw: 'Rekodi ulichoweka kwenye mazao yako', ha: 'Rubuta abin da ka zuba a gonar', tw: 'Kyerɛw deɛ wode guu w\'afuom so',
  },
  'treatment.outcomeTitle': {
    en: 'Treatment Outcome', fr: 'Résultat du Traitement', sw: 'Matokeo ya Tiba', ha: 'Sakamakon Magani', tw: 'Nnuro Ho Nsɛm',
  },
  'treatment.outcomeSubtitle': {
    en: 'How did the treatment work?', fr: 'Comment le traitement a-t-il fonctionné?', sw: 'Tiba ilifanyaje kazi?', ha: 'Yaya maganin ya yi aiki?', tw: 'Nnuro no ayɛ dɛn?',
  },
  'treatment.type': {
    en: 'Treatment Type', fr: 'Type de Traitement', sw: 'Aina ya Tiba', ha: 'Nau\'in Magani', tw: 'Nnuro Ahorow',
  },
  'treatment.type.chemical_spray': {
    en: 'Chemical Spray', fr: 'Pulvérisation Chimique', sw: 'Dawa ya Kemikali', ha: 'Fesa Sinadari', tw: 'Aduru Fɛfɛ',
  },
  'treatment.type.biological_control': {
    en: 'Biological Control', fr: 'Lutte Biologique', sw: 'Udhibiti wa Kibaiolojia', ha: 'Hanyar Halitta', tw: 'Abɔde mu Hwɛ',
  },
  'treatment.type.manual_removal': {
    en: 'Manual Removal', fr: 'Retrait Manuel', sw: 'Kuondoa kwa Mkono', ha: 'Cire da Hannu', tw: 'Fa Nsa Yi',
  },
  'treatment.type.organic_treatment': {
    en: 'Organic Treatment', fr: 'Traitement Bio', sw: 'Tiba ya Kikaboni', ha: 'Maganin Halitta', tw: 'Abɔde mu Nnuro',
  },
  'treatment.type.other': {
    en: 'Other', fr: 'Autre', sw: 'Nyingine', ha: 'Wani', tw: 'Afoforo',
  },
  'treatment.product': {
    en: 'Product Used', fr: 'Produit Utilisé', sw: 'Bidhaa Iliyotumika', ha: 'Kayan Da Aka Yi Amfani Da Su', tw: 'Ade a Wɔde Yɛe',
  },
  'treatment.productPlaceholder': {
    en: 'e.g. Neem oil, pesticide name', fr: 'ex: Huile de neem, nom du pesticide', sw: 'mf. Mafuta ya mwarobaini', ha: 'misali. Man neem', tw: 'sɛ nkuranhyɛ ngo',
  },
  'treatment.notes': {
    en: 'Notes', fr: 'Notes', sw: 'Maelezo', ha: 'Bayani', tw: 'Nsɛm',
  },
  'treatment.notesPlaceholder': {
    en: 'Any extra details...', fr: 'Détails supplémentaires...', sw: 'Maelezo zaidi...', ha: 'Ƙarin bayani...', tw: 'Nsɛm bi ka ho...',
  },
  'treatment.outcomeNotesPlaceholder': {
    en: 'Describe what you observed...', fr: 'Décrivez ce que vous avez observé...', sw: 'Eleza ulichoona...', ha: 'Bayyana abin da ka gani...', tw: 'Kyerɛw deɛ wuhui...',
  },
  'treatment.saving': {
    en: 'Saving...', fr: 'Enregistrement...', sw: 'Inahifadhi...', ha: 'Ana ajiyewa...', tw: 'Ɛrekora...',
  },
  'treatment.save': {
    en: 'Save Treatment', fr: 'Enregistrer Traitement', sw: 'Hifadhi Tiba', ha: 'Ajiye Magani', tw: 'Kora Nnuro',
  },
  'treatment.saveFailed': {
    en: 'Failed to save. Try again.', fr: 'Échec. Réessayez.', sw: 'Imeshindikana. Jaribu tena.', ha: 'Ya gaza. Sake gwadawa.', tw: 'Ɛanyɛ yiye. Bɔ mmɔden bio.',
  },
  'treatment.howDidItGo': {
    en: 'How did it go?', fr: 'Comment ça s\'est passé?', sw: 'Ilikuwaje?', ha: 'Yaya ya kasance?', tw: 'Na ɛkɔɔ dɛn?',
  },
  'treatment.outcome.improved': {
    en: 'Improved', fr: 'Amélioré', sw: 'Imeboreka', ha: 'Ya inganta', tw: 'Ɛayɛ yiye',
  },
  'treatment.outcome.same': {
    en: 'No Change', fr: 'Pas de Changement', sw: 'Hakuna Mabadiliko', ha: 'Babu Canji', tw: 'Ɛnsesae',
  },
  'treatment.outcome.worse': {
    en: 'Got Worse', fr: 'Pire', sw: 'Imezidi', ha: 'Ya tsananta', tw: 'Ɛayɛ bɔne',
  },
  'treatment.outcome.resolved': {
    en: 'Fully Resolved', fr: 'Résolu', sw: 'Imetatuliwa', ha: 'An warware', tw: 'Ɛwie',
  },
  'treatment.submitOutcome': {
    en: 'Submit Outcome', fr: 'Soumettre Résultat', sw: 'Wasilisha Matokeo', ha: 'Aika Sakamako', tw: 'Fa Nsɛm Bra',
  },
  'treatment.recorded': {
    en: 'Treatment Recorded', fr: 'Traitement Enregistré', sw: 'Tiba Imerekodiwa', ha: 'An Rubuta Magani', tw: 'Wɔakyerɛw Nnuro',
  },
  'treatment.viewReport': {
    en: 'View Report', fr: 'Voir le Rapport', sw: 'Tazama Ripoti', ha: 'Duba Rahoto', tw: 'Hwɛ Amanneɛbɔ',
  },
  'treatment.date': {
    en: 'Date Applied', fr: 'Date d\'Application', sw: 'Tarehe ya Kutumia', ha: 'Ranar Amfani', tw: 'Da a Wɔde Yɛɛ Adwuma',
  },
  'treatment.followupPhoto': {
    en: 'Follow-up Photo (optional)', fr: 'Photo de Suivi (facultatif)', sw: 'Picha ya Ufuatiliaji (si lazima)', ha: 'Hoton Biye (na zaɓi)', tw: 'Mfonini a Edi Akyi (nhyehyɛe)',
  },
  'treatment.addPhoto': {
    en: 'Tap to add photo', fr: 'Appuyez pour ajouter une photo', sw: 'Gonga kuongeza picha', ha: 'Danna don ƙara hoto', tw: 'Tɛ so de mfonini bɛka ho',
  },
  'treatment.recordedDesc': {
    en: 'Your treatment data helps improve advice for all farmers', fr: 'Vos données aident à améliorer les conseils', sw: 'Data yako inasaidia kuboresha ushauri', ha: 'Bayananku na taimaka wajen inganta shawara', tw: 'Wo nsɛm boa afuom fo nyinaa',
  },
  'treatment.backToDashboard': {
    en: 'Back to Dashboard', fr: 'Retour au Tableau de Bord', sw: 'Rudi kwenye Dashibodi', ha: 'Koma Shafin Farko', tw: 'San kɔ Dashboard',
  },
  'treatment.noReport': {
    en: 'No pest report selected. Go back and submit a check first.', fr: 'Aucun rapport sélectionné.', sw: 'Hakuna ripoti iliyochaguliwa.', ha: 'Ba a zaɓi rahoton ba.', tw: 'Wɔmpaw amanneɛbɔ biara.',
  },

  // ─── Crop names ───────────────────────────────────────────
  'crop.maize': { en: 'Maize', fr: 'Maïs', sw: 'Mahindi', ha: 'Masara', tw: 'Aburo' },
  'crop.cassava': { en: 'Cassava', fr: 'Manioc', sw: 'Muhogo', ha: 'Rogo', tw: 'Bankye' },
  'crop.rice': { en: 'Rice', fr: 'Riz', sw: 'Mchele', ha: 'Shinkafa', tw: 'Ɛmo' },
  'crop.tomato': { en: 'Tomato', fr: 'Tomate', sw: 'Nyanya', ha: 'Tumatir', tw: 'Ntɔɔs' },
  'crop.pepper': { en: 'Pepper', fr: 'Piment', sw: 'Pilipili', ha: 'Barkono', tw: 'Mako' },
  'crop.cocoa': { en: 'Cocoa', fr: 'Cacao', sw: 'Kakao', ha: 'Koko', tw: 'Kookoo' },
  'crop.yam': { en: 'Yam', fr: 'Igname', sw: 'Viazi', ha: 'Doya', tw: 'Bayerɛ' },
  'crop.plantain': { en: 'Plantain', fr: 'Plantain', sw: 'Ndizi', ha: 'Ayaba', tw: 'Brɔdɛ' },
  'crop.okra': { en: 'Okra', fr: 'Gombo', sw: 'Bamia', ha: 'Kubewa', tw: 'Nkruma' },
  'crop.ginger': { en: 'Ginger', fr: 'Gingembre', sw: 'Tangawizi', ha: 'Citta', tw: 'Akakaduro' },
  'crop.onion': { en: 'Onion', fr: 'Oignon', sw: 'Kitunguu', ha: 'Albasa', tw: 'Gyeene' },
  'crop.chili': { en: 'Chili', fr: 'Piment', sw: 'Pilipili kali', ha: 'Barkono mai tsami', tw: 'Mako kɔkɔɔ' },
  'crop.eggplant': { en: 'Eggplant', fr: 'Aubergine', sw: 'Biringanya', ha: 'Gauta', tw: 'Ntɔɔs tuntum' },
  'crop.spinach': { en: 'Spinach', fr: 'Épinard', sw: 'Mchicha', ha: 'Alayyahu', tw: 'Efre' },
  'crop.cucumber': { en: 'Cucumber', fr: 'Concombre', sw: 'Tango', ha: 'Kokwamba', tw: 'Ɛfere' },
  'crop.carrot': { en: 'Carrot', fr: 'Carotte', sw: 'Karoti', ha: 'Karas', tw: 'Karɔt' },
  'crop.watermelon': { en: 'Watermelon', fr: 'Pastèque', sw: 'Tikiti', ha: 'Kankana', tw: 'Ɛfrɛ' },
  'crop.papaya': { en: 'Papaya', fr: 'Papaye', sw: 'Papai', ha: 'Gwanda', tw: 'Bɔfrɛ' },
  'crop.sesame': { en: 'Sesame', fr: 'Sésame', sw: 'Ufuta', ha: 'Ridi', tw: 'Ɛnam' },
  'crop.soybean': { en: 'Soybean', fr: 'Soja', sw: 'Soya', ha: 'Waken soya', tw: 'Soya' },
  'crop.millet': { en: 'Millet', fr: 'Mil', sw: 'Uwele', ha: 'Gero', tw: 'Ayuo' },
  'crop.cowpea': { en: 'Cowpea', fr: 'Niébé', sw: 'Kunde', ha: 'Wake', tw: 'Adua' },

  // ─── Region labels ─────────────────────────────────────────
  'region.eastAfrica': { en: 'East Africa', fr: 'Afrique de l\'Est', sw: 'Afrika Mashariki', ha: 'Gabashin Afirka', tw: 'Apuei Afrika' },
  'region.westAfrica': { en: 'West Africa', fr: 'Afrique de l\'Ouest', sw: 'Afrika Magharibi', ha: 'Yammacin Afirka', tw: 'Atɔe Afrika' },
  'region.southernAfrica': { en: 'Southern Africa', fr: 'Afrique Australe', sw: 'Kusini mwa Afrika', ha: 'Kudancin Afirka', tw: 'Anafo Afrika' },
  'region.centralAfrica': { en: 'Central Africa', fr: 'Afrique Centrale', sw: 'Afrika ya Kati', ha: 'Tsakiyar Afirka', tw: 'Mfinimfini Afrika' },
  'region.midAtlanticUS': { en: 'Mid-Atlantic US', fr: 'États-Unis (Centre-Atlantique)', sw: 'Marekani ya Kati-Atlantiki', ha: 'Amurka Tsakiyar Atlantika', tw: 'America Mfinimfini' },

  // ─── New crops (US / global additions) ─────────────────────
  'crop.sweetCorn': { en: 'Sweet Corn', fr: 'Maïs sucré', sw: 'Mahindi tamu', ha: 'Masara mai zaƙi', tw: 'Aburo dɛ' },
  'crop.lettuce': { en: 'Lettuce', fr: 'Laitue', sw: 'Saladi', ha: 'Lettus', tw: 'Lettuce' },
  'crop.squash': { en: 'Squash', fr: 'Courge', sw: 'Maboga', ha: 'Kabewa', tw: 'Efere' },
  'crop.strawberry': { en: 'Strawberry', fr: 'Fraise', sw: 'Stroberi', ha: 'Strawberry', tw: 'Strawberry' },
  'crop.tobacco': { en: 'Tobacco', fr: 'Tabac', sw: 'Tumbaku', ha: 'Taba', tw: 'Taa' },

  // ─── Recommendation reason: local fit ──────────────────────
  'recommendReason.localFoodFit': {
    en: 'Great for feeding your household here', fr: 'Excellent pour nourrir votre famille ici', sw: 'Nzuri kwa kulisha familia yako hapa', ha: 'Mai kyau don ciyar da iyalin ku a nan', tw: 'Eye ma wo fiehyia aduane wɔ ha',
  },
  'recommendReason.localProfitFit': {
    en: 'Strong local market demand', fr: 'Forte demande sur le marché local', sw: 'Mahitaji makubwa ya soko la ndani', ha: 'Buƙata mai ƙarfi a kasuwar gida', tw: 'Aguadeɛ a ɛwɔ ha dwadeɛ mu yɛ den',
  },
  'recommendReason.priceRising': {
    en: 'Prices trending up this season', fr: 'Prix en hausse cette saison', sw: 'Bei zinapanda msimu huu', ha: 'Farashin yana hauhawa a wannan lokaci', tw: 'Boɔ rekɔ soro bere yi mu',
  },

  // ─── Market price signals ─────────────────────────────────
  'market.title': { en: 'Market Signals', fr: 'Signaux du marché', sw: 'Ishara za soko', ha: 'Alamun kasuwa', tw: 'Dwadeɛ nsɛnkyerɛnne' },
  'market.seasonal': { en: 'Seasonal', fr: 'Saisonnier', sw: 'Msimu', ha: 'Lokaci', tw: 'Bere mu' },
  'market.disclaimer': { en: 'Based on seasonal patterns, not live prices. Farming always carries risk.', fr: 'Basé sur des tendances saisonnières, pas des prix en temps réel.', sw: 'Kulingana na mifumo ya msimu, si bei za sasa.', ha: 'Dangane da yanayin lokaci, ba farashin yanzu ba.', tw: 'Egyina bere mu nhyehyɛe so, ɛnyɛ seesei boɔ.' },
  'market.trend.rising': { en: 'Rising', fr: 'En hausse', sw: 'Inapanda', ha: 'Yana hauhawa', tw: 'Ɛrekɔ soro' },
  'market.trend.stable': { en: 'Stable', fr: 'Stable', sw: 'Imara', ha: 'Daidai', tw: 'Ɛtim hɔ' },
  'market.trend.falling': { en: 'Falling', fr: 'En baisse', sw: 'Inashuka', ha: 'Yana sauka', tw: 'Ɛresian' },

  // ─── Market signal notes ──────────────────────────────────
  'market.note.leanSeasonRise': { en: 'Prices typically rise before harvest', fr: 'Les prix montent avant la récolte', sw: 'Bei huongezeka kabla ya mavuno', ha: 'Farashi yakan tashi kafin girbi', tw: 'Boɔ kɔ soro ansa twaberɛ' },
  'market.note.harvestGlut': { en: 'Harvest season — prices typically drop', fr: 'Saison de récolte — prix en baisse', sw: 'Msimu wa mavuno — bei hushuka', ha: 'Lokacin girbi — farashi yana sauka', tw: 'Twaberɛ — boɔ tɔ fam' },
  'market.note.stablePrices': { en: 'Prices steady this time of year', fr: 'Prix stables en ce moment', sw: 'Bei imara wakati huu', ha: 'Farashi daidai a wannan lokaci', tw: 'Boɔ yɛ pɛ bere yi mu' },
  'market.note.shortageRise': { en: 'Supply low — prices typically higher', fr: 'Offre faible — prix plus élevés', sw: 'Ugavi mdogo — bei juu', ha: 'Kayayyaki kaɗan — farashi ya yi yawa', tw: 'Nneɛma sua — boɔ kɔ soro' },
  'market.note.importBaseline': { en: 'Imported supply keeps prices steady', fr: 'Les importations stabilisent les prix', sw: 'Uagizaji hudumisha bei imara', ha: 'Shigo da kaya yana kiyaye farashi', tw: 'Aguadeɛ a ɛfiri abɔnten ma boɔ yɛ pɛ' },
  'market.note.stapleDemand': { en: 'Staple food — steady demand all year', fr: 'Aliment de base — demande stable', sw: 'Chakula kikuu — mahitaji imara', ha: 'Abincin yau da kullum — buƙata daidai', tw: 'Aduane titire — nhia daa' },
  'market.note.exportDemand': { en: 'Export demand supporting prices', fr: 'La demande d\'exportation soutient les prix', sw: 'Mahitaji ya usafirishaji yanaunga bei', ha: 'Buƙatar fitar da kaya tana tallafa farashi', tw: 'Amannɔne dwadeɛ boa boɔ' },
  'market.note.regulatedPrice': { en: 'Prices set by market board', fr: 'Prix fixés par le conseil du marché', sw: 'Bei zinawekwa na bodi ya soko', ha: 'Hukumar kasuwa ta saita farashi', tw: 'Dwadeɛ badwa na wɔhyɛ boɔ' },
  'market.note.seasonalShortage': { en: 'Seasonal shortage — prices higher than usual', fr: 'Pénurie saisonnière — prix élevés', sw: 'Uhaba wa msimu — bei juu kuliko kawaida', ha: 'Ƙarancin lokaci — farashi ya fi na yadda ake saba', tw: 'Bere mu hia — boɔ kɔ soro' },
  'market.note.drySeasonDemand': { en: 'High demand in dry season', fr: 'Forte demande en saison sèche', sw: 'Mahitaji makubwa katika kiangazi', ha: 'Buƙata mai yawa a lokacin rani', tw: 'Nhia pii wɔ awɔw bere mu' },
  'market.note.earlySeasonPremium': { en: 'Early season — premium prices at market', fr: 'Début de saison — prix premium', sw: 'Mwanzo wa msimu — bei ya juu', ha: 'Farkon lokaci — farashi mai tsada', tw: 'Bere mfiase — boɔ kɔ soro' },
  'market.note.peakSupply': { en: 'Peak supply season — prices moderate', fr: 'Haute saison — prix modérés', sw: 'Msimu wa wingi — bei wastani', ha: 'Lokacin kayan yawa — farashi matsakaici', tw: 'Nneɛma pii bere — boɔ yɛ pɛ' },
  'market.note.seasonalDemand': { en: 'Seasonal demand peak — good selling time', fr: 'Pic de demande — bon moment pour vendre', sw: 'Kilele cha mahitaji — wakati mzuri wa kuuza', ha: 'Kololuwar buƙata — lokaci mai kyau na sayarwa', tw: 'Nhia pii bere — bere pa a wɔtɔn' },
  'market.note.specialtyPremium': { en: 'Specialty crop — premium niche market', fr: 'Culture spécialisée — marché de niche', sw: 'Zao maalum — soko la kipekee', ha: 'Amfanin musamman — kasuwar musamman', tw: 'Nkɔsoɔ nnɔbae — dwadeɛ soronko' },
  'market.note.fallDemand': { en: 'Fall demand rising — fresh greens popular', fr: 'Demande d\'automne en hausse', sw: 'Mahitaji ya vuli yanaongezeka', ha: 'Buƙatar kaka tana ƙaruwa', tw: 'Bere a ɛresa no nhia rekɔ soro' },

  // ─── Growth stages ────────────────────────────────────────
  'stage.seedling': { en: 'Seedling', fr: 'Semis', sw: 'Mche', ha: 'Shuka', tw: 'Aba' },
  'stage.vegetative': { en: 'Vegetative', fr: 'Végétatif', sw: 'Ukuaji', ha: 'Girma', tw: 'Nkɔso' },
  'stage.flowering': { en: 'Flowering', fr: 'Floraison', sw: 'Maua', ha: 'Fure', tw: 'Nhwiren' },
  'stage.fruiting': { en: 'Fruiting', fr: 'Fructification', sw: 'Matunda', ha: 'Ɗan itace', tw: 'Aba' },
  'stage.maturity': { en: 'Maturity', fr: 'Maturité', sw: 'Kukomaa', ha: 'Balaguro', tw: 'Anyin' },

  // ─── Risk level badges ────────────────────────────────────
  'risk.low': { en: 'Low Risk', fr: 'Risque Faible', sw: 'Hatari Ndogo', ha: 'Ƙaramin Haɗari', tw: 'Asiane Ketewa' },
  'risk.moderate': { en: 'Moderate', fr: 'Modéré', sw: 'Wastani', ha: 'Matsakaici', tw: 'Ntam' },
  'risk.high': { en: 'High Risk', fr: 'Risque Élevé', sw: 'Hatari Kubwa', ha: 'Haɗari Mai Girma', tw: 'Asiane Kɛse' },
  'risk.urgent': { en: 'Urgent', fr: 'Urgent', sw: 'Dharura', ha: 'Gaggawa', tw: 'Ɛhia Ntɛm' },

  // ═══════════════════════════════════════════════════════════
  //  FARM SWITCHING — multi-farm support
  // ═══════════════════════════════════════════════════════════

  'farm.activeFarm': { en: 'My Farm', fr: 'Ma Ferme', sw: 'Shamba Langu', ha: 'Gonar ta', tw: 'Me Afuo' },
  'farm.unnamed': { en: 'Unnamed Farm', fr: 'Ferme sans nom', sw: 'Shamba bila Jina', ha: 'Gona marar Suna', tw: 'Afuo a enni Din' },
  'farm.addNew': { en: 'Add New Farm', fr: 'Ajouter une ferme', sw: 'Ongeza Shamba', ha: 'Ƙara Gona', tw: 'Fa Afuo Foforo Ka Ho' },
  'farm.switchFailed': { en: 'Could not switch farms. Try again.', fr: 'Impossible de changer de ferme.', sw: 'Imeshindikana kubadili shamba.', ha: 'Ba a iya canja gona ba.', tw: 'Yɛantumi ansesa afuo no.' },
  'farm.offlineSwitch': { en: 'Go online to switch farms', fr: 'Connectez-vous pour changer', sw: 'Ingia mtandaoni kubadilisha', ha: 'Shiga yanar gizo don canjawa', tw: 'Kɔ intanɛt so na sesa' },
  'farm.switchSuccess': { en: 'Switched to this farm', fr: 'Ferme activée', sw: 'Shamba limebadilishwa', ha: 'An canja zuwa wannan gona', tw: 'Wɔasesa akɔ saa afuo yi so' },
  'farm.archiveConfirm': { en: 'Archive this farm? History is kept.', fr: 'Archiver cette ferme?', sw: 'Hifadhi shamba hili?', ha: 'Adana wannan gona?', tw: 'Kora saa afuo yi? Nsɛm a atwam da so wɔ hɔ.' },
  'farm.defaultFarm': { en: 'Default Farm', fr: 'Ferme par défaut', sw: 'Shamba Kuu', ha: 'Babban Gona', tw: 'Afuo Titiriw' },
  'farm.default': { en: 'Default', fr: 'Par défaut', sw: 'Kuu', ha: 'Babba', tw: 'Titiriw' },
  'farm.farms': { en: 'farms', fr: 'fermes', sw: 'mashamba', ha: 'gonaki', tw: 'mfuw' },
  'farm.tapToSetDefault': { en: 'Tap to set as default', fr: 'Appuyer pour définir par défaut', sw: 'Bonyeza kuweka kuu', ha: 'Danna don sanya babba', tw: 'Mia so de yɛ titiriw' },
  'farm.tapToSwitch': { en: 'Tap to switch', fr: 'Appuyez pour changer', sw: 'Bonyeza kubadilisha', ha: 'Danna don sauya', tw: 'Mia so de sesa' },
  'farm.whichFarm': { en: 'Which farm?', fr: 'Quelle ferme?', sw: 'Shamba lipi?', ha: 'Wace gona?', tw: 'Afuo bɛn?' },
  'farm.myFarms': { en: 'My Farms', fr: 'Mes Fermes', sw: 'Mashamba Yangu', ha: 'Gonakin a', tw: 'Me Mfuw' },
  'farm.yourFarm': { en: 'Your Farm', fr: 'Votre Ferme', sw: 'Shamba Lako', ha: 'Gonar ka', tw: 'Wo Afuo' },
  'farm.noFarmsTitle': { en: 'No farms yet', fr: 'Pas encore de ferme', sw: 'Hakuna shamba bado', ha: 'Babu gona tukuna', tw: 'Afuo biara nni ha' },
  'farm.noFarmsDesc': { en: 'Set up your first farm to get started', fr: 'Configurez votre ferme pour commencer', sw: 'Weka shamba lako la kwanza kuanza', ha: 'Saita gonar ka ta farko don farawa', tw: 'Hyehyɛ wo afuo a edi kan na afi ase' },
  'farm.createFirst': { en: 'Create My Farm', fr: 'Créer ma ferme', sw: 'Unda Shamba Langu', ha: 'Ƙirƙiri Gona ta', tw: 'Yɛ Me Afuo' },
  'farm.editFarm': { en: 'Edit Farm', fr: 'Modifier la ferme', sw: 'Hariri Shamba', ha: 'Gyara Gona', tw: 'Sesa Afuo' },
  'farm.editFailed': { en: 'Could not save changes. Try again.', fr: 'Impossible de sauvegarder.', sw: 'Imeshindikana kuhifadhi.', ha: 'Ba a iya adanawa ba.', tw: 'Yɛantumi ankora nsakrae no.' },
  'farm.statusActive': { en: 'Active', fr: 'Actif', sw: 'Inatumika', ha: 'Aiki', tw: 'Di adwuma' },
  'farm.statusArchived': { en: 'Archived', fr: 'Archivé', sw: 'Imehifadhiwa', ha: 'An adana', tw: 'Wɔakora' },
  'farm.switchingFarm': { en: 'Switching farm...', fr: 'Changement de ferme...', sw: 'Inabadilisha shamba...', ha: 'Ana canza gona...', tw: 'Ɛresesa afuo...' },
  'farm.duplicateError': { en: 'A farm with the same name and location already exists.', fr: 'Une ferme avec le même nom et lieu existe déjà.', sw: 'Shamba lenye jina na mahali sawa tayari lipo.', ha: 'Gona mai wannan suna da wuri ta riga ta wanzu.', tw: 'Afuo a ne din koro ne baabi koro wɔ hɔ dada.' },
  'common.cancel': { en: 'Cancel', fr: 'Annuler', sw: 'Ghairi', ha: 'Soke', tw: 'Gyae' },
  'common.save': { en: 'Save', fr: 'Sauvegarder', sw: 'Hifadhi', ha: 'Adana', tw: 'Kora' },
  'common.saving': { en: 'Saving...', fr: 'Sauvegarde...', sw: 'Inahifadhi...', ha: 'Ana adanawa...', tw: 'Ɛrekora...' },

  // ─── Farm Tasks ──────────────────────────────────────────
  'farmTasks.title': { en: 'Farm Tasks', fr: 'Tâches agricoles', sw: 'Kazi za Shamba', ha: 'Ayyukan Gona', tw: 'Afuo Adwuma' },
  'farmTasks.loading': { en: 'Loading tasks...', fr: 'Chargement...', sw: 'Inapakia kazi...', ha: 'Ana lodi ayyuka...', tw: 'Ɛreloade adwuma...' },
  'farmTasks.noTasks': { en: 'No tasks yet for this farm', fr: 'Pas encore de tâches', sw: 'Hakuna kazi bado kwa shamba hili', ha: 'Babu ayyuka tukuna', tw: 'Adwuma biara nni ha' },
  'farmTasks.tasks': { en: 'tasks', fr: 'tâches', sw: 'kazi', ha: 'ayyuka', tw: 'adwuma' },
  'farmTasks.taskDone': { en: 'task done', fr: 'tâche terminée', sw: 'kazi imekamilika', ha: 'aikin da aka gama', tw: 'adwuma awie' },
  'farmTasks.tasksDone': { en: 'tasks done', fr: 'tâches terminées', sw: 'kazi zimekamilika', ha: 'ayyukan da aka gama', tw: 'adwuma awie' },
  'farmTasks.offline': { en: 'Offline — tasks will load when connected', fr: 'Hors ligne — les tâches se chargeront une fois connecté', sw: 'Nje ya mtandao — kazi zitapakia ukiunganishwa', ha: 'Ba kan layi — ayyuka za loda idan an haɗa', tw: 'Ɔffline — adwuma bɛloade sɛ wɔde bɔ ho' },
  'farmTasks.priorityHigh': { en: 'High', fr: 'Haute', sw: 'Juu', ha: 'Mai girma', tw: 'Kɛse' },
  'farmTasks.priorityMedium': { en: 'Medium', fr: 'Moyenne', sw: 'Wastani', ha: 'Matsakaici', tw: 'Ntam' },
  'farmTasks.priorityLow': { en: 'Low', fr: 'Basse', sw: 'Chini', ha: 'Ƙasa', tw: 'Kakra' },
  'farmTasks.setStagePrompt': { en: 'Set your crop stage for better tasks', fr: 'Définissez l\'étape pour de meilleures tâches', sw: 'Weka hatua ya mazao kupata kazi bora', ha: 'Saita matakin amfanin ku don samun ayyuka mafi kyau', tw: 'Hyehyɛ wo nnɔbae anammɔn na wunya adwuma pa' },
  'farmTasks.setStageHint': { en: 'Tap here to update your current crop stage', fr: 'Appuyez ici pour mettre à jour', sw: 'Bonyeza hapa kusasisha hatua yako', ha: 'Danna nan don sabunta matakin ku', tw: 'Mia ha so na sesa wo anammɔn' },

  // ─── Crop Stage Tracking ────────────────────────────────
  'cropStage.title': { en: 'Update Crop Stage', fr: 'Mettre à jour l\'étape', sw: 'Sasisha Hatua ya Mazao', ha: 'Sabunta Matakin Amfani', tw: 'Sesa Nnɔbae Anammɔn' },
  'cropStage.subtitle': { en: 'What stage is your crop at now?', fr: 'À quelle étape est votre culture ?', sw: 'Mazao yako yapo hatua gani sasa?', ha: 'Amfanin gonar ka yana wane mataki?', tw: 'Wo nnɔbae wɔ anammɔn bɛn mu seesei?' },
  'cropStage.label': { en: 'Crop Stage', fr: 'Étape de culture', sw: 'Hatua ya Mazao', ha: 'Matakin Amfani', tw: 'Nnɔbae Anammɔn' },
  'cropStage.update': { en: 'Update', fr: 'Modifier', sw: 'Sasisha', ha: 'Sabunta', tw: 'Sesa' },
  'cropStage.planning': { en: 'Planning', fr: 'Planification', sw: 'Kupanga', ha: 'Tsarawa', tw: 'Nhyehyɛe' },
  'cropStage.landPreparation': { en: 'Land Prep', fr: 'Préparation', sw: 'Kuandaa Ardhi', ha: 'Shirya Ƙasa', tw: 'Asase Nhyehyɛe' },
  'cropStage.planting': { en: 'Planting', fr: 'Plantation', sw: 'Kupanda', ha: 'Shuka', tw: 'Dua' },
  'cropStage.germination': { en: 'Germination', fr: 'Germination', sw: 'Kuota', ha: 'Tsiro', tw: 'Fifiri' },
  'cropStage.vegetative': { en: 'Vegetative', fr: 'Végétatif', sw: 'Ukuaji', ha: 'Girma', tw: 'Nyin' },
  'cropStage.flowering': { en: 'Flowering', fr: 'Floraison', sw: 'Kuchanua', ha: 'Fure', tw: 'Nhwiren' },
  'cropStage.fruiting': { en: 'Fruiting', fr: 'Fructification', sw: 'Matunda', ha: 'Ɗan itace', tw: 'Aba' },
  'cropStage.harvest': { en: 'Harvest', fr: 'Récolte', sw: 'Mavuno', ha: 'Girbi', tw: 'Otwa' },
  'cropStage.postHarvest': { en: 'Post-Harvest', fr: 'Post-récolte', sw: 'Baada ya Mavuno', ha: 'Bayan Girbi', tw: 'Otwa Akyi' },
  // Crop-specific lifecycle stages (Crop Intelligence Layer §3) —
  // these appear in the stage dropdown when a crop like cassava,
  // maize, tomato, rice, or groundnut is selected.
  'cropStage.establishment': { en: 'Establishment', fr: 'Établissement', sw: 'Kujisimamisha', ha: 'Kafuwa', tw: 'Ntetee' },
  'cropStage.bulking':       { en: 'Bulking',       fr: 'Grossissement', sw: 'Kujaza',        ha: 'Cikawa', tw: 'Nnyin' },
  'cropStage.maturation':    { en: 'Maturation',    fr: 'Maturation',   sw: 'Kukomaa',        ha: 'Nunawa', tw: 'Anyini' },
  'cropStage.seedling':      { en: 'Seedling',      fr: 'Semis',        sw: 'Mche',            ha: 'Tsire',  tw: 'Fifiri' },
  'cropStage.transplant':    { en: 'Transplant',    fr: 'Repiquage',    sw: 'Kupandikiza',     ha: 'Dasa',   tw: 'Yi dua' },
  'cropStage.tasseling':     { en: 'Tasseling',     fr: 'Floraison mâle', sw: 'Kutoa miche', ha: 'Fitar fure', tw: 'Nhwiren Pue' },
  'cropStage.grainFill':     { en: 'Grain fill',    fr: 'Remplissage du grain', sw: 'Kujaza nafaka', ha: 'Cika hatsi', tw: 'Aba Nhyɛso' },
  'cropStage.podFill':       { en: 'Pod fill',      fr: 'Remplissage des gousses', sw: 'Kujaza ganda', ha: 'Cika kwasfa', tw: 'Aba Nhyɛso' },
  'cropStage.pegging':       { en: 'Pegging',       fr: 'Enfoncement',  sw: 'Kuweka pembe',    ha: 'Sanya ƙaya', tw: 'Hyɛ fam' },

  'cropStage.plantedDate': { en: 'Date Planted (optional)', fr: 'Date de plantation (optionnel)', sw: 'Tarehe ya Kupanda (si lazima)', ha: 'Ranar Shuka (zaɓi)', tw: 'Da a duae (ɛnyɛ dɛ)' },
  'cropStage.plantedDateHint': { en: 'Helps estimate when to move to the next stage', fr: 'Aide à estimer le passage à l\'étape suivante', sw: 'Husaidia kukadirisha hatua inayofuata', ha: 'Yana taimakawa wajen kiyasin mataki na gaba', tw: 'Ɛboa sɛ wobɛhunu bere a wobɛkɔ anammɔn a edi so' },
  'cropStage.saveFailed': { en: 'Could not save stage. Try again.', fr: 'Impossible de sauvegarder.', sw: 'Imeshindikana kuhifadhi hatua.', ha: 'Ba a iya adana mataki ba.', tw: 'Yɛantumi ankora anammɔn no.' },
  'cropStage.saved': { en: 'Saved!', fr: 'Enregistré !', sw: 'Imehifadhiwa!', ha: 'An adana!', tw: 'Wɔakora!' },
  'cropStage.savedOffline': { en: 'Saved locally. Will sync when online.', fr: 'Enregistré localement.', sw: 'Imehifadhiwa. Itasawazisha mtandaoni.', ha: 'An adana a gida. Za a daidaita yayin da ake kan layi.', tw: 'Wɔakora ha. Ɛbɛsesa bere a wɔbɛba intanɛt so.' },

  // ─── Season Engine ──────────────────────────────────────
  'season.title': { en: 'Season Engine', fr: 'Moteur de saison', sw: 'Injini ya Msimu', ha: 'Injin Damina', tw: 'Bere Enjin' },
  'season.description': { en: 'Track your current season, complete daily tasks, and keep progress moving.', fr: 'Suivez votre saison en cours et accomplissez vos tâches.', sw: 'Fuatilia msimu wako wa sasa na ukamilishe kazi za kila siku.', ha: 'Bi sawun daminar ka kuma ka kammala ayyukan yau da kullun.', tw: 'Di wo bere a ɛkɔ so no akyi na wie wo adwuma.' },
  'season.crop': { en: 'Crop', fr: 'Culture', sw: 'Mazao', ha: 'Amfani', tw: 'Nnɔbae' },
  'season.stage': { en: 'Stage', fr: 'Étape', sw: 'Hatua', ha: 'Mataki', tw: 'Anammɔn' },
  'season.startDate': { en: 'Start Date', fr: 'Date de début', sw: 'Tarehe ya Kuanza', ha: 'Ranar Farawa', tw: 'Mfiase Da' },
  'season.status': { en: 'Status', fr: 'Statut', sw: 'Hali', ha: 'Matsayi', tw: 'Tebea' },
  'season.active': { en: 'Active', fr: 'Actif', sw: 'Hai', ha: 'Mai aiki', tw: 'Ɛkɔ so' },
  'season.completed': { en: 'Completed', fr: 'Terminé', sw: 'Imekamilika', ha: 'An kammala', tw: 'Wɔawie' },
  'season.completeSeason': { en: 'Complete Season', fr: 'Terminer la saison', sw: 'Maliza Msimu', ha: 'Kammala Damina', tw: 'Wie Bere' },

  // ─── Seasonal Timing ────────────────────────────────────
  'seasonal.title': { en: 'Seasonal Timing', fr: 'Calendrier saisonnier', sw: 'Muda wa Msimu', ha: 'Lokacin Damina', tw: 'Bere Nhyehyɛe' },
  'seasonal.subtitle': { en: 'When does your farm season run?', fr: 'Quand se déroule votre saison ?', sw: 'Msimu wako unaendelea lini?', ha: 'Yaushe lokacin gonar ku?', tw: 'Da bɛn na wo afuo bere fi ase?' },
  'seasonal.season': { en: 'Season', fr: 'Saison', sw: 'Msimu', ha: 'Damina', tw: 'Bere' },
  'seasonal.seasonRange': { en: 'Season months', fr: 'Mois de saison', sw: 'Miezi ya msimu', ha: 'Watannin damina', tw: 'Bere abosome' },
  'seasonal.plantingWindow': { en: 'Planting window', fr: 'Fenêtre de plantation', sw: 'Muda wa kupanda', ha: 'Lokacin shuka', tw: 'Dua bere' },
  'seasonal.start': { en: 'Start', fr: 'Début', sw: 'Mwanzo', ha: 'Farawa', tw: 'Mfiase' },
  'seasonal.end': { en: 'End', fr: 'Fin', sw: 'Mwisho', ha: 'Ƙarshe', tw: 'Awiei' },
  'seasonal.seasonLabel': { en: 'Season name (optional)', fr: 'Nom de saison (optionnel)', sw: 'Jina la msimu (si lazima)', ha: 'Sunan damina (zaɓi)', tw: 'Bere din (ɛnyɛ dɛ)' },
  'seasonal.seasonLabelPlaceholder': { en: 'e.g. Main Season 2026', fr: 'ex. Saison principale 2026', sw: 'mfano. Msimu Mkuu 2026', ha: 'misali Babban Damina 2026', tw: 'sɛ Bere Kɛse 2026' },
  'seasonal.lastRainy': { en: 'Last rainy season', fr: 'Dernière saison des pluies', sw: 'Msimu wa mvua uliopita', ha: 'Damina ta ƙarshe', tw: 'Nsuo bere a atwam' },
  'seasonal.lastDry': { en: 'Last dry season', fr: 'Dernière saison sèche', sw: 'Msimu wa kiangazi uliopita', ha: 'Bazara ta ƙarshe', tw: 'Ɔpɛ bere a atwam' },
  'seasonal.edit': { en: 'Edit', fr: 'Modifier', sw: 'Hariri', ha: 'Gyara', tw: 'Sesa' },
  'seasonal.setPrompt': { en: 'Set seasonal timing for better recommendations', fr: 'Définissez le calendrier pour de meilleurs conseils', sw: 'Weka muda wa msimu kupata mapendekezo bora', ha: 'Saita lokacin damina don samun shawarwari mafi kyau', tw: 'Hyehyɛ bere nhyehyɛe na wunya afotu pa' },
  'seasonal.saveFailed': { en: 'Could not save timing. Try again.', fr: 'Impossible de sauvegarder.', sw: 'Imeshindikana kuhifadhi muda.', ha: 'Ba a iya adana lokaci ba.', tw: 'Yɛantumi ankora bere no.' },

  // ─── Farm Weather ─────────────────────────────────────
  'farmWeather.title': { en: 'Farm Weather', fr: 'Météo de la ferme', sw: 'Hali ya hewa ya shamba', ha: 'Yanayin gona', tw: 'Afuo wim' },
  'farmWeather.loading': { en: 'Loading weather...', fr: 'Chargement météo...', sw: 'Inapakia hali ya hewa...', ha: 'Ana loda yanayi...', tw: 'Ɛreload wim...' },
  'farmWeather.noLocation': { en: 'Add farm location to see weather', fr: 'Ajoutez un emplacement pour voir la météo', sw: 'Ongeza eneo la shamba kuona hali ya hewa', ha: 'Saka wurin gona don ganin yanayi', tw: 'Fa afuo beaeɛ ka ho na hunu wim' },
  'farmWeather.temp': { en: 'Temp', fr: 'Temp', sw: 'Joto', ha: 'Zafi', tw: 'Ahohyehyɛ' },
  'farmWeather.humidity': { en: 'Humidity', fr: 'Humidité', sw: 'Unyevu', ha: 'Zafi dangi', tw: 'Nsuo wɔ wim' },
  'farmWeather.rain3d': { en: '3-day rain', fr: 'Pluie 3j', sw: 'Mvua siku 3', ha: 'Ruwan kwana 3', tw: 'Nsuo daa 3' },
  'farmWeather.rainExpected': { en: 'Rain expected', fr: 'Pluie prévue', sw: 'Mvua inatarajiwa', ha: 'Ana sa ruwan sama', tw: 'Nsuo reba' },
  'farmWeather.heavyRainRisk': { en: 'Heavy rain risk', fr: 'Risque de forte pluie', sw: 'Hatari ya mvua kubwa', ha: 'Hadarin ruwan sama mai yawa', tw: 'Nsuo kɛseɛ asiane' },
  'farmWeather.drySpellRisk': { en: 'Dry spell risk', fr: 'Risque de sécheresse', sw: 'Hatari ya ukame', ha: 'Hadarin fari', tw: 'Owia kɛseɛ asiane' },

  // ─── Pest & Disease Risks ─────────────────────────────
  'pestRisk.title': { en: 'Pest & Disease Risks', fr: 'Risques ravageurs et maladies', sw: 'Hatari za wadudu na magonjwa', ha: 'Hadarin kwari da cututtuka', tw: 'Mmoa ne nyarewa asiane' },
  'pestRisk.loading': { en: 'Checking risks...', fr: 'Vérification des risques...', sw: 'Inakagua hatari...', ha: 'Ana duba hadari...', tw: 'Ɛrehwehwɛ asiane...' },
  'pestRisk.noRisks': { en: 'No active pest or disease risks right now', fr: 'Aucun risque actif pour le moment', sw: 'Hakuna hatari za wadudu kwa sasa', ha: 'Babu hadarin kwari yanzu', tw: 'Asiane biara nni hɔ seesei' },
  'pestRisk.highAlerts': { en: 'high alerts', fr: 'alertes élevées', sw: 'tahadhari za juu', ha: 'gargadi mai girma', tw: 'kɔkɔbɔ a ɛso' },
  'pestRisk.severity.high': { en: 'High', fr: 'Élevé', sw: 'Juu', ha: 'Babba', tw: 'Kɛseɛ' },
  'pestRisk.severity.medium': { en: 'Medium', fr: 'Moyen', sw: 'Wastani', ha: 'Matsakaici', tw: 'Ntam' },
  'pestRisk.severity.low': { en: 'Low', fr: 'Faible', sw: 'Chini', ha: 'Ƙarami', tw: 'Kakraa' },
  'pestRisk.weatherAdjusted': { en: 'Adjusted for current weather', fr: 'Ajusté selon la météo actuelle', sw: 'Imerekebisha kulingana na hali ya hewa', ha: 'An daidaita da yanayin yanzu', tw: 'Wɔasakra ama seisei wim' },

  // ─── Input & Fertilizer Timing ────────────────────────
  'inputTiming.title': { en: 'Input & Fertilizer Timing', fr: 'Calendrier des intrants', sw: 'Muda wa pembejeo na mbolea', ha: 'Lokacin shigar taki', tw: 'Afidwuma ne sradeɛ bere' },
  'inputTiming.loading': { en: 'Loading recommendations...', fr: 'Chargement des recommandations...', sw: 'Inapakia mapendekezo...', ha: 'Ana loda shawarwari...', tw: 'Ɛreload akwankyerɛ...' },
  'inputTiming.noRecs': { en: 'No input recommendations for this stage', fr: 'Aucune recommandation pour cette étape', sw: 'Hakuna mapendekezo kwa hatua hii', ha: 'Babu shawarwari a wannan mataki', tw: 'Akwankyerɛ biara nni ma anammɔn yi' },
  'inputTiming.items': { en: 'items', fr: 'éléments', sw: 'vipengee', ha: 'abubuwa', tw: 'nneɛma' },
  'inputTiming.delayed': { en: 'Timing delayed due to weather', fr: 'Retardé en raison de la météo', sw: 'Imecheleweshwa na hali ya hewa', ha: 'An jinkirta saboda yanayi', tw: 'Agyina esiane wim' },
  'inputTiming.priority.high': { en: 'High', fr: 'Élevé', sw: 'Juu', ha: 'Babba', tw: 'Kɛseɛ' },
  'inputTiming.priority.medium': { en: 'Medium', fr: 'Moyen', sw: 'Wastani', ha: 'Matsakaici', tw: 'Ntam' },
  'inputTiming.priority.low': { en: 'Low', fr: 'Faible', sw: 'Chini', ha: 'Ƙarami', tw: 'Kakraa' },

  // ─── Harvest & Post-Harvest ─────────────────────────────
  'harvest.title': { en: 'Harvest & Post-Harvest', fr: 'Récolte et post-récolte', sw: 'Mavuno na baada ya mavuno', ha: 'Girbi da bayan girbi', tw: 'Otwa ne otwa akyi' },
  'harvest.loading': { en: 'Loading harvest guidance...', fr: 'Chargement des conseils de récolte...', sw: 'Inapakia mwongozo wa mavuno...', ha: 'Ana loda jagorar girbi...', tw: 'Ɛreload otwa akwankyerɛ...' },
  'harvest.noRecs': { en: 'No harvest recommendations for this stage', fr: 'Aucune recommandation de récolte pour cette étape', sw: 'Hakuna mapendekezo ya mavuno kwa hatua hii', ha: 'Babu shawarwarin girbi a wannan mataki', tw: 'Otwa akwankyerɛ biara nni ma anammɔn yi' },
  'harvest.items': { en: 'items', fr: 'éléments', sw: 'vipengee', ha: 'abubuwa', tw: 'nneɛma' },
  'harvest.priority.high': { en: 'High', fr: 'Élevé', sw: 'Juu', ha: 'Babba', tw: 'Kɛseɛ' },
  'harvest.priority.medium': { en: 'Medium', fr: 'Moyen', sw: 'Wastani', ha: 'Matsakaici', tw: 'Ntam' },
  'harvest.priority.low': { en: 'Low', fr: 'Faible', sw: 'Chini', ha: 'Ƙarami', tw: 'Kakraa' },
  'harvest.postHarvestTag': { en: 'POST-HARVEST', fr: 'POST-RÉCOLTE', sw: 'BAADA YA MAVUNO', ha: 'BAYAN GIRBI', tw: 'OTWA AKYI' },
  'harvest.weatherAdjusted': { en: 'Priority adjusted for current weather', fr: 'Priorité ajustée selon la météo', sw: 'Kipaumbele kimerekebishwa kwa hali ya hewa', ha: 'An daidaita fifiko bisa yanayi', tw: 'Wɔasakra botaeɛ wɔ wim nti' },

  // ─── Yield Records & Harvest Logging ─────────────────────
  'yield.title': { en: 'Yield & Records', fr: 'Rendement et registres', sw: 'Mavuno na rekodi', ha: 'Amfani da bayanan', tw: 'Aduane ne nkrataa' },
  'yield.loading': { en: 'Loading records...', fr: 'Chargement des registres...', sw: 'Inapakia rekodi...', ha: 'Ana loda bayanan...', tw: 'Ɛreload nkrataa...' },
  'yield.records': { en: 'records', fr: 'registres', sw: 'rekodi', ha: 'bayanan', tw: 'nkrataa' },
  'yield.noRecords': { en: 'No harvest records yet', fr: 'Aucun registre de récolte', sw: 'Hakuna rekodi za mavuno bado', ha: 'Babu bayanan girbi tukuna', tw: 'Otwa nkrataa biara nni ha' },
  'yield.noRecordsHint': { en: 'Log your harvest to track yield over time', fr: 'Enregistrez vos récoltes pour suivre le rendement', sw: 'Andika mavuno yako kufuatilia mazao', ha: 'Rubuta girbi don bibiyar amfani', tw: 'Kyerɛw wo otwa na hua aduane bere mu' },
  'yield.addRecord': { en: 'Log Harvest', fr: 'Enregistrer la récolte', sw: 'Andika mavuno', ha: 'Rubuta girbi', tw: 'Kyerɛw otwa' },
  'yield.formTitle': { en: 'Log Harvest Record', fr: 'Enregistrer un registre de récolte', sw: 'Andika rekodi ya mavuno', ha: 'Rubuta bayanan girbi', tw: 'Kyerɛw otwa nkrataa' },
  'yield.harvestDate': { en: 'Harvest Date', fr: 'Date de récolte', sw: 'Tarehe ya mavuno', ha: 'Ranar girbi', tw: 'Otwa da' },
  'yield.quantityHarvested': { en: 'Quantity Harvested', fr: 'Quantité récoltée', sw: 'Kiasi kilichovunwa', ha: 'Adadin girbi', tw: 'Aduane a wɔtwaa' },
  'yield.unit': { en: 'Unit', fr: 'Unité', sw: 'Kipimo', ha: 'Ma\'auni', tw: 'Susuw' },
  'yield.sold': { en: 'Sold', fr: 'Vendu', sw: 'Kuuzwa', ha: 'Sayarwa', tw: 'Tɔn' },
  'yield.stored': { en: 'Stored', fr: 'Stocké', sw: 'Kuhifadhiwa', ha: 'Adanawa', tw: 'Korae' },
  'yield.lost': { en: 'Lost', fr: 'Perdu', sw: 'Kupotea', ha: 'Asara', tw: 'Yera' },
  'yield.harvested': { en: 'Harvested', fr: 'Récolté', sw: 'Mavuno', ha: 'Girbi', tw: 'Otwa' },
  'yield.sellingPrice': { en: 'Avg Price per Unit', fr: 'Prix moyen par unité', sw: 'Bei ya wastani', ha: 'Matsakaicin farashi', tw: 'Bo a ɛwɔ biara so' },
  'yield.currency': { en: 'Currency', fr: 'Devise', sw: 'Sarafu', ha: 'Kudin', tw: 'Sika' },
  'yield.qualityGrade': { en: 'Quality', fr: 'Qualité', sw: 'Ubora', ha: 'Inganci', tw: 'Su papa' },
  'yield.notes': { en: 'Notes', fr: 'Notes', sw: 'Maelezo', ha: 'Bayanai', tw: 'Nsɛm' },
  'yield.notesPlaceholder': { en: 'Any observations...', fr: 'Observations...', sw: 'Maoni yoyote...', ha: 'Wani bayani...', tw: 'Biribi a wohuu...' },
  'yield.cancel': { en: 'Cancel', fr: 'Annuler', sw: 'Ghairi', ha: 'Soke', tw: 'Gyae' },
  'yield.save': { en: 'Save Record', fr: 'Enregistrer', sw: 'Hifadhi', ha: 'Ajiye', tw: 'Fa sie' },
  'yield.saving': { en: 'Saving...', fr: 'Enregistrement...', sw: 'Inahifadhi...', ha: 'Ana ajiye...', tw: 'Ɛresie...' },
  'yield.history': { en: 'History', fr: 'Historique', sw: 'Historia', ha: 'Tarihi', tw: 'Abakɔsɛm' },
  'yield.grade': { en: 'Grade', fr: 'Qualité', sw: 'Daraja', ha: 'Daraja', tw: 'Kwan' },
  'yield.estimatedRevenue': { en: 'Estimated Revenue', fr: 'Revenu estimé', sw: 'Mapato yanayokadiriwa', ha: 'Kudin da ake tsammani', tw: 'Sika a wɔsusuw' },
  'yield.errorQuantity': { en: 'Enter a valid quantity', fr: 'Entrez une quantité valide', sw: 'Weka kiasi halali', ha: 'Shigar adadi ingantacce', tw: 'Fa dodow pa hyɛ mu' },
  'yield.errorDate': { en: 'Enter a valid date', fr: 'Entrez une date valide', sw: 'Weka tarehe halali', ha: 'Shigar kwanan ingantacce', tw: 'Fa da pa hyɛ mu' },

  // ─── Farm Economics ──────────────────────────────────────
  'economics.title': { en: 'Farm Economics', fr: 'Finances de la ferme', sw: 'Uchumi wa shamba', ha: 'Tattalin gonar', tw: 'Afuw\u025B mu sika' },
  'economics.loading': { en: 'Loading economics...', fr: 'Chargement des finances...', sw: 'Inapakia uchumi...', ha: 'Ana loda tattalin...', tw: '\u0190reload sika...' },
  'economics.costs': { en: 'costs', fr: 'co\u00FBts', sw: 'gharama', ha: 'farashi', tw: 'abo' },
  'economics.revenue': { en: 'Revenue', fr: 'Recettes', sw: 'Mapato', ha: 'Kudin shiga', tw: 'Sika a \u025Bba' },
  'economics.totalCosts': { en: 'Costs', fr: 'Co\u00FBts', sw: 'Gharama', ha: 'Farashi', tw: 'Abo' },
  'economics.profit': { en: 'Profit', fr: 'B\u00E9n\u00E9fice', sw: 'Faida', ha: 'Riba', tw: 'Mfaso' },
  'economics.partial': { en: 'partial', fr: 'partiel', sw: 'sehemu', ha: 'wani bangare', tw: 'fa bi' },
  'economics.costBreakdown': { en: 'Cost Breakdown', fr: 'R\u00E9partition des co\u00FBts', sw: 'Mgawanyo wa gharama', ha: 'Rarraba farashi', tw: 'Abo mu nkyerɛaseɛ' },
  'economics.noRecords': { en: 'No cost records yet', fr: 'Aucun co\u00FBt enregistr\u00E9', sw: 'Hakuna rekodi za gharama bado', ha: 'Babu bayanan farashi tukuna', tw: 'Abo nkrataa biara nni ha' },
  'economics.noRecordsHint': { en: 'Log farm expenses to track profitability', fr: 'Enregistrez les d\u00E9penses pour suivre la rentabilit\u00E9', sw: 'Andika gharama kufuatilia faida', ha: 'Rubuta kashe-kashe don bibiyar riba', tw: 'Ky\u025Br\u025Bw abo na hua mfaso' },
  'economics.addCost': { en: 'Log Cost', fr: 'Enregistrer un co\u00FBt', sw: 'Andika gharama', ha: 'Rubuta farashi', tw: 'Ky\u025Br\u025Bw abo' },
  'economics.formTitle': { en: 'Log Farm Cost', fr: 'Enregistrer un co\u00FBt', sw: 'Andika gharama ya shamba', ha: 'Rubuta farashin gona', tw: 'Ky\u025Br\u025Bw afuw\u025B abo' },
  'economics.date': { en: 'Date', fr: 'Date', sw: 'Tarehe', ha: 'Kwanan', tw: 'Da' },
  'economics.category': { en: 'Category', fr: 'Cat\u00E9gorie', sw: 'Aina', ha: 'Rukunin', tw: 'Nkyeky\u025Bmu' },
  'economics.description': { en: 'Description', fr: 'Description', sw: 'Maelezo', ha: 'Bayani', tw: 'Ns\u025Bm mu' },
  'economics.descPlaceholder': { en: 'What did you spend on?', fr: 'Pour quoi avez-vous d\u00E9pens\u00E9?', sw: 'Ulitumia nini?', ha: 'Me kuka kashe a kai?', tw: 'D\u025Bn na wode sika y\u025B\u025B?' },
  'economics.amount': { en: 'Amount', fr: 'Montant', sw: 'Kiasi', ha: 'Adadi', tw: 'Sika dodow' },
  'economics.currency': { en: 'Currency', fr: 'Devise', sw: 'Sarafu', ha: 'Kudin', tw: 'Sika' },
  'economics.notes': { en: 'Notes', fr: 'Notes', sw: 'Maelezo', ha: 'Bayanai', tw: 'Ns\u025Bm' },
  'economics.notesPlaceholder': { en: 'Any details...', fr: 'D\u00E9tails...', sw: 'Maelezo yoyote...', ha: 'Wani bayani...', tw: 'Ns\u025Bm bi...' },
  'economics.cancel': { en: 'Cancel', fr: 'Annuler', sw: 'Ghairi', ha: 'Soke', tw: 'Gyae' },
  'economics.save': { en: 'Save Cost', fr: 'Enregistrer', sw: 'Hifadhi', ha: 'Ajiye', tw: 'Fa sie' },
  'economics.saving': { en: 'Saving...', fr: 'Enregistrement...', sw: 'Inahifadhi...', ha: 'Ana ajiye...', tw: '\u0190resie...' },
  'economics.showHistory': { en: 'Show Cost History', fr: 'Voir l\'historique', sw: 'Onyesha historia', ha: 'Nuna tarihi', tw: 'Kyerɛ abakɔsɛm' },
  'economics.hideHistory': { en: 'Hide Cost History', fr: 'Masquer l\'historique', sw: 'Ficha historia', ha: 'Boye tarihi', tw: 'Fa abakɔsɛm sie' },
  'economics.errorAmount': { en: 'Enter a valid amount', fr: 'Entrez un montant valide', sw: 'Weka kiasi halali', ha: 'Shigar adadi ingantacce', tw: 'Fa sika dodow pa hyɛ mu' },
  'economics.errorDate': { en: 'Enter a valid date', fr: 'Entrez une date valide', sw: 'Weka tarehe halali', ha: 'Shigar kwanan ingantacce', tw: 'Fa da pa hyɛ mu' },
  'economics.errorDescription': { en: 'Enter a description', fr: 'Entrez une description', sw: 'Weka maelezo', ha: 'Shigar bayani', tw: 'Fa nsɛm hyɛ mu' },
  // Cost categories
  'economics.cat.seeds': { en: 'Seeds', fr: 'Semences', sw: 'Mbegu', ha: 'Iri', tw: 'Aba' },
  'economics.cat.fertilizer': { en: 'Fertilizer', fr: 'Engrais', sw: 'Mbolea', ha: 'Taki', tw: 'Sradeɛ' },
  'economics.cat.pesticide': { en: 'Pesticide', fr: 'Pesticide', sw: 'Dawa ya wadudu', ha: 'Maganin kwari', tw: 'Mmoa aduro' },
  'economics.cat.herbicide': { en: 'Herbicide', fr: 'Herbicide', sw: 'Dawa ya magugu', ha: 'Maganin ciyawa', tw: 'Wura aduro' },
  'economics.cat.labor': { en: 'Labor', fr: 'Main-d\'oeuvre', sw: 'Kazi', ha: 'Aiki', tw: 'Adwuma' },
  'economics.cat.irrigation': { en: 'Irrigation', fr: 'Irrigation', sw: 'Umwagiliaji', ha: 'Ban ruwa', tw: 'Nsu a wɔde gu' },
  'economics.cat.transport': { en: 'Transport', fr: 'Transport', sw: 'Usafiri', ha: 'Sufuri', tw: 'Akwantu' },
  'economics.cat.storage': { en: 'Storage', fr: 'Stockage', sw: 'Hifadhi', ha: 'Ajiya', tw: 'Korabea' },
  'economics.cat.equipment': { en: 'Equipment', fr: '\u00C9quipement', sw: 'Vifaa', ha: 'Kayan aiki', tw: 'Nneɛma' },
  'economics.cat.land_preparation': { en: 'Land Prep', fr: 'Pr\u00E9p. terrain', sw: 'Kuandaa ardhi', ha: 'Shirya gona', tw: 'Asase ho nhyehyɛe' },
  'economics.cat.other': { en: 'Other', fr: 'Autre', sw: 'Nyingine', ha: 'Sauransu', tw: 'Afoforo' },

  // ─── Benchmarking / Performance Comparison ───────────────
  'benchmark.title': { en: 'Performance Comparison', fr: 'Comparaison de performance', sw: 'Ulinganisho wa utendaji', ha: 'Kwatancen aiki', tw: 'Adwumayɛ ahorow' },
  'benchmark.loading': { en: 'Loading comparison...', fr: 'Chargement de la comparaison...', sw: 'Inapakia ulinganisho...', ha: 'Ana loda kwatance...', tw: 'Ɛreload ahorow...' },
  'benchmark.noData': { en: 'Not enough historical data yet for benchmarking', fr: 'Pas assez de donn\u00E9es historiques pour comparer', sw: 'Hakuna data ya kutosha ya kulinganisha bado', ha: 'Babu isasshen bayanan tarihi don kwatance', tw: 'Data a ɛbɛyɛ ahorow nni hɔ' },
  'benchmark.noDataHint': { en: 'Keep logging harvest and costs to unlock this', fr: 'Continuez \u00E0 enregistrer pour d\u00E9bloquer', sw: 'Endelea kuandika ili kufungua hii', ha: 'Ci gaba da rubuta don buɗe wannan', tw: 'Kɔ so kyerɛw na bue eyi' },
  'benchmark.currentPeriod': { en: 'Current Period', fr: 'P\u00E9riode actuelle', sw: 'Kipindi cha sasa', ha: 'Lokaci na yanzu', tw: 'Mprempren bere' },
  'benchmark.yield': { en: 'Yield', fr: 'Rendement', sw: 'Mazao', ha: 'Amfani', tw: 'Aduane' },
  'benchmark.revenue': { en: 'Revenue', fr: 'Recettes', sw: 'Mapato', ha: 'Kudin shiga', tw: 'Sika a ɛba' },
  'benchmark.costs': { en: 'Costs', fr: 'Co\u00FBts', sw: 'Gharama', ha: 'Farashi', tw: 'Abo' },
  'benchmark.profit': { en: 'Profit', fr: 'B\u00E9n\u00E9fice', sw: 'Faida', ha: 'Riba', tw: 'Mfaso' },
  'benchmark.vs': { en: 'vs', fr: 'vs', sw: 'dhidi ya', ha: 'da', tw: 'ne' },
  'benchmark.prev': { en: 'Prev', fr: 'Pr\u00E9c', sw: 'Awali', ha: 'Baya', tw: 'Kan' },

  // ═══════════════════════════════════════════════════════════
  //  WEEKLY SUMMARY — decision digest per farm
  // ═══════════════════════════════════════════════════════════

  'weekly.title': {
    en: 'Weekly Summary', fr: 'R\u00E9sum\u00E9 hebdomadaire', sw: 'Muhtasari wa wiki', ha: 'Ta\u0199aitaccen mako', tw: 'Dap\u025Bn mu ns\u025Bm',
  },
  'weekly.loading': {
    en: 'Loading summary...', fr: 'Chargement du r\u00E9sum\u00E9...', sw: 'Inapakia muhtasari...', ha: 'Ana loda ta\u0199aitacce...', tw: '\u0190reload ns\u025Bm...',
  },
  'weekly.thisWeek': {
    en: 'This Week', fr: 'Cette semaine', sw: 'Wiki hii', ha: 'Wannan mako', tw: 'Dap\u025Bn yi',
  },
  'weekly.priorities': {
    en: 'Top Priorities', fr: 'Priorit\u00E9s', sw: 'Vipaumbele', ha: 'Manyan abubuwa', tw: 'Nne\u025Bma titiriw',
  },
  'weekly.riskAlerts': {
    en: 'Risk Alerts', fr: 'Alertes de risque', sw: 'Tahadhari za hatari', ha: 'Fa\u0257akarwar ha\u0257ari', tw: 'As\u025Bm a \u025Bho hia',
  },
  'weekly.nextSteps': {
    en: 'What To Do Next', fr: 'Prochaines actions', sw: 'Hatua za kufanya', ha: 'Me za a yi gaba', tw: 'De\u025B y\u025Bb\u025By\u025B akyire',
  },
  'weekly.viewDetails': {
    en: 'View Details', fr: 'Voir les d\u00E9tails', sw: 'Tazama maelezo', ha: 'Duba cikakkun bayani', tw: 'Hw\u025B ns\u025Bm no mu',
  },
  'weekly.hideDetails': {
    en: 'Hide Details', fr: 'Masquer les d\u00E9tails', sw: 'Ficha maelezo', ha: '\u0181oye bayani', tw: 'Fa ns\u025Bm no sie',
  },
  'weekly.inputNotes': {
    en: 'Input & Fertilizer', fr: 'Intrants et engrais', sw: 'Pembejeo na mbolea', ha: 'Kayan noma da taki', tw: 'Nne\u025Bma ne srade\u025B',
  },
  'weekly.harvestNotes': {
    en: 'Harvest & Post-Harvest', fr: 'R\u00E9colte', sw: 'Mavuno', ha: 'Girbi', tw: 'Twabere',
  },
  'weekly.economicsNote': {
    en: 'Economics & Performance', fr: '\u00C9conomie et performance', sw: 'Uchumi na utendaji', ha: 'Tattalin arziki', tw: 'Sika ne adwumay\u025B',
  },
  'weekly.missingData': {
    en: 'To Improve This Summary', fr: 'Pour am\u00E9liorer ce r\u00E9sum\u00E9', sw: 'Kuboresha muhtasari', ha: 'Don inganta ta\u0199aitacce', tw: 'Y\u025B ns\u025Bm yi yie',
  },

  // ═══════════════════════════════════════════════════════════
  //  ONBOARDING — new farmer setup flow
  // ═══════════════════════════════════════════════════════════

  'onboarding.newToFarming': {
    en: 'Are you new to farming?', fr: '\u00CAtes-vous nouveau dans l\'agriculture ?', sw: 'Je, u mpya katika kilimo?', ha: 'Sabon manomi ne kai?', tw: 'Woy\u025Bokuafo\u0254 foforo\u0254?',
  },
  'onboarding.yesNew': {
    en: "Yes, I'm new", fr: 'Oui, je suis nouveau', sw: 'Ndio, mimi ni mpya', ha: 'Eh, sabon zuwa ne', tw: 'Aane, mey\u025B foforo\u0254',
  },
  'onboarding.haveExperience': {
    en: 'I have experience', fr: "J'ai de l'exp\u00E9rience", sw: 'Nina uzoefu', ha: 'Ina da \u0199warewa', tw: 'Mew\u0254 osuahu',
  },
  'onboarding.whereIsFarm': {
    en: 'Where is your farm?', fr: 'O\u00F9 se trouve votre ferme ?', sw: 'Shamba lako liko wapi?', ha: 'Ina gonar ka?', tw: 'Wo afuo no w\u0254 he?',
  },
  'onboarding.useMyLocation': {
    en: 'Use my location', fr: 'Utiliser ma position', sw: 'Tumia eneo langu', ha: 'Yi amfani da wurin da nake', tw: 'Fa me beae\u025B',
  },
  'onboarding.detecting': {
    en: 'Finding your location...', fr: 'Recherche de votre position...', sw: 'Inatafuta eneo lako...', ha: 'Ana neman wurin ka...', tw: 'Rehwehw\u025B wo beae\u025B...',
  },
  'onboarding.locationFound': {
    en: 'Location found!', fr: 'Position trouv\u00E9e !', sw: 'Eneo limepatikana!', ha: 'An sami wurin!', tw: 'Y\u025Bahu beae\u025B no!',
  },
  'onboarding.locationFailed': {
    en: 'Could not detect location', fr: 'Impossible de d\u00E9tecter la position', sw: 'Imeshindwa kupata eneo', ha: 'Ba a iya gano wurin ba', tw: 'Y\u025Bantumi anhu beae\u025B no',
  },
  'onboarding.typeLocation': {
    en: 'Type your location', fr: 'Tapez votre emplacement', sw: 'Andika eneo lako', ha: 'Rubuta wurin ka', tw: 'Twer\u025B wo beae\u025B',
  },
  'onboarding.whatGrowing': {
    en: 'What are you growing?', fr: 'Que cultivez-vous ?', sw: 'Unalima nini?', ha: 'Me kake nomawa?', tw: 'De\u025Bn na wudua?',
  },
  'onboarding.other': {
    en: 'Other', fr: 'Autre', sw: 'Nyingine', ha: 'Wani', tw: 'Ebifoforo\u0254',
  },
  'onboarding.howBig': {
    en: 'How big is your farm?', fr: 'Quelle est la taille de votre ferme ?', sw: 'Shamba lako ni kubwa kiasi gani?', ha: 'Yaya girman gonar ka?', tw: 'Wo afuo no so d\u025Bn?',
  },
  'onboarding.small': {
    en: 'Small', fr: 'Petite', sw: 'Ndogo', ha: '\u0198arama', tw: 'Ketewa',
  },
  'onboarding.medium': {
    en: 'Medium', fr: 'Moyenne', sw: 'Wastani', ha: 'Matsakaici', tw: 'Ntam',
  },
  'onboarding.large': {
    en: 'Large', fr: 'Grande', sw: 'Kubwa', ha: 'Babba', tw: 'K\u025Bse\u025B',
  },
  'onboarding.underAcres': {
    en: 'Under 2 acres', fr: 'Moins de 2 acres', sw: 'Chini ya ekari 2', ha: '\u0198asa da eka 2', tw: 'Ase\u025B fa eka 2',
  },
  'onboarding.mediumAcres': {
    en: '2\u201310 acres', fr: '2\u201310 acres', sw: 'Ekari 2\u201310', ha: 'Eka 2\u201310', tw: 'Eka 2\u201310',
  },
  'onboarding.overAcres': {
    en: 'Over 10 acres', fr: 'Plus de 10 acres', sw: 'Zaidi ya ekari 10', ha: 'Fiye da eka 10', tw: '\u0190boro eka 10',
  },
  'onboarding.nameFarm': {
    en: 'Name your farm', fr: 'Nommez votre ferme', sw: 'Ipe shamba lako jina', ha: 'Sa wa gonar ka suna', tw: 'To wo afuo no din',
  },
  'onboarding.farmNamePlaceholder': {
    en: 'e.g. My Farm', fr: 'ex. Ma Ferme', sw: 'k.m. Shamba Langu', ha: 'misali. Gonar ta', tw: 's\u025B Me Afuo',
  },
  'onboarding.startFarming': {
    en: 'Start Farming', fr: 'Commencer', sw: 'Anza Kulima', ha: 'Fara Noma', tw: 'Hy\u025B Ase\u025B Adua',
  },
  // Demographics step (optional)
  'onboarding.demographics.title': {
    en: 'Help us support farmers better', fr: 'Aidez-nous \u00E0 mieux soutenir', sw: 'Tusaidie kusaidia wakulima', ha: 'Taimaka mana tallafin manoma', tw: 'Boa y\u025Bn na y\u025Bmmoa akuafo',
  },
  'onboarding.demographics.subtitle': {
    en: 'Optional — you can skip this', fr: 'Facultatif — vous pouvez passer', sw: 'Si lazima — unaweza ruka', ha: 'Na za\u0253i — za ka iya tsallakewa', tw: '\u0190ny\u025B dea \u025Bho h\u0129a — wobetumi ahur\u025B',
  },
  'onboarding.demographics.gender': {
    en: 'Gender', fr: 'Genre', sw: 'Jinsia', ha: 'Jinsi', tw: 'Nnipasuo',
  },
  'onboarding.demographics.ageRange': {
    en: 'Age range', fr: 'Tranche d\u2019\u00E2ge', sw: 'Kiwango cha umri', ha: 'Rukunin shekaru', tw: 'Mfe\u025B mu',
  },
  'onboarding.demographics.skip': {
    en: 'Skip for now', fr: 'Passer', sw: 'Ruka kwa sasa', ha: 'Tsallake yanzu', tw: 'Twa mu s\u025Bsei\u025B',
  },
  'onboarding.step': {
    en: 'Step', fr: '\u00C9tape', sw: 'Hatua', ha: 'Mataki', tw: 'Anamm\u0254n',
  },

  // ═══════════════════════════════════════════════════════════
  //  TASK ACTIONS — quick-complete buttons on task cards
  // ═══════════════════════════════════════════════════════════

  'taskAction.iWatered': {
    en: 'I watered \u2705', fr: "J'ai arros\u00E9 \u2705", sw: 'Nimemwagilia \u2705', ha: 'Na shayar \u2705', tw: 'Magugu so \u2705',
  },
  'taskAction.iPlanted': {
    en: 'I planted \u2705', fr: "J'ai plant\u00E9 \u2705", sw: 'Nimepanda \u2705', ha: 'Na shuka \u2705', tw: 'Maduae \u2705',
  },
  'taskAction.iSprayed': {
    en: 'I sprayed \u2705', fr: "J'ai pulv\u00E9ris\u00E9 \u2705", sw: 'Nimenyunyizia \u2705', ha: 'Na fesa \u2705', tw: 'Mapete aduro \u2705',
  },
  'taskAction.iHarvested': {
    en: 'I harvested \u2705', fr: "J'ai r\u00E9colt\u00E9 \u2705", sw: 'Nimevuna \u2705', ha: 'Na girbe \u2705', tw: 'Matwa bere \u2705',
  },
  'taskAction.markDone': {
    en: 'Mark done \u2705', fr: 'Marquer termin\u00E9 \u2705', sw: 'Weka imekamilika \u2705', ha: 'Yi alama an gama \u2705', tw: 'Hy\u025B ns\u0254 \u2705',
  },
  'taskAction.skip': {
    en: 'Skip for now', fr: 'Passer pour le moment', sw: 'Ruka kwa sasa', ha: 'Tsallake yanzu', tw: 'Twam seesei',
  },
  'taskAction.saved': {
    en: 'Saved!', fr: 'Enregistr\u00E9 !', sw: 'Imehifadhiwa!', ha: 'An ajiye!', tw: 'Y\u025Bakora!',
  },
  'taskAction.nextReady': {
    en: 'Next task ready', fr: 'T\u00E2che suivante pr\u00EAte', sw: 'Kazi inayofuata iko tayari', ha: 'Aikin gaba ya shirya', tw: 'Adwuma a \u025Bdi so aboa',
  },

  // ═══════════════════════════════════════════════════════════
  //  ALL TASKS — full task list page
  // ═══════════════════════════════════════════════════════════

  'allTasks.title': {
    en: 'All Tasks', fr: 'Toutes les t\u00E2ches', sw: 'Kazi Zote', ha: 'Duk Ayyuka', tw: 'Adwuma Nyinaa',
  },
  'allTasks.high': {
    en: 'High Priority', fr: 'Priorit\u00E9 haute', sw: 'Kipaumbele cha juu', ha: 'Muhimmanci mai girma', tw: '\u0190ho hia pa',
  },
  'allTasks.medium': {
    en: 'Medium Priority', fr: 'Priorit\u00E9 moyenne', sw: 'Kipaumbele cha kati', ha: 'Muhimmanci matsakaici', tw: '\u0190ho hia kakra',
  },
  'allTasks.low': {
    en: 'Low Priority', fr: 'Priorit\u00E9 basse', sw: 'Kipaumbele cha chini', ha: 'Muhimmanci \u0199arami', tw: '\u0190ho nhia dodo',
  },
  'allTasks.allDone': {
    en: 'All caught up!', fr: 'Tout est \u00E0 jour !', sw: 'Umekamilisha yote!', ha: 'An gama komai!', tw: 'Woawie nyinaa!',
  },
  'allTasks.backHome': {
    en: 'Back to home', fr: "Retour \u00E0 l'accueil", sw: 'Rudi nyumbani', ha: 'Koma gida', tw: 'K\u0254 fie',
  },

  // ═══════════════════════════════════════════════════════════
  //  MY FARM — farm profile & management page
  // ═══════════════════════════════════════════════════════════

  'myFarm.title': {
    en: 'My Farm', fr: 'Ma Ferme', sw: 'Shamba Langu', ha: 'Gonar Ta', tw: 'Me Afuo',
  },
  'myFarm.unnamedFarm': {
    en: 'My Farm', fr: 'Ma Ferme', sw: 'Shamba Langu', ha: 'Gonar Ta', tw: 'Me Afuo',
  },
  'myFarm.noFarm': {
    en: 'No farm yet. Set up your farm to get started.',
    fr: 'Pas encore de ferme. Configurez votre ferme pour commencer.',
    sw: 'Bado hakuna shamba. Sanidi shamba lako ili kuanza.',
    ha: 'Babu gona tukuna. Saita gonar ka don farawa.',
    tw: 'Afuo biara nni hɔ. Siesie w\'afuo na wohyɛ aseɛ.',
  },
  'myFarm.crop': {
    en: 'Crop', fr: 'Culture', sw: 'Mazao', ha: 'Amfanin gona', tw: 'Nn\u0254bae\u025B',
  },
  'myFarm.location': {
    en: 'Location', fr: 'Emplacement', sw: 'Eneo', ha: 'Wuri', tw: 'Beae\u025B',
  },
  'myFarm.size': {
    en: 'Farm Size', fr: 'Taille de la ferme', sw: 'Ukubwa wa shamba', ha: 'Girman gona', tw: 'Afuo no k\u025Bse\u025B',
  },
  'myFarm.stage': {
    en: 'Stage', fr: '\u00C9tape', sw: 'Hatua', ha: 'Mataki', tw: 'Anamm\u0254n',
  },
  'myFarm.country': {
    en: 'Country', fr: 'Pays', sw: 'Nchi', ha: '\u0198asa', tw: '\u0186man',
  },
  'myFarm.edit': {
    en: 'Edit Farm', fr: 'Modifier la ferme', sw: 'Hariri shamba', ha: 'Gyara gona', tw: 'Sesa afuo no',
  },
  'myFarm.switchFarm': {
    en: 'Switch Farm', fr: 'Changer de ferme', sw: 'Badilisha shamba', ha: 'Canja gona', tw: 'Sesa afuo',
  },
  'myFarm.addFarm': {
    en: 'Add New Farm', fr: 'Ajouter une ferme', sw: 'Ongeza shamba jipya', ha: '\u0198ara sabuwar gona', tw: 'Fa afuo foforo\u0254 ka ho',
  },

  // ═══════════════════════════════════════════════════════════
  //  USER MODE — mode switcher labels
  // ═══════════════════════════════════════════════════════════

  'mode.basic': {
    en: 'Simple', fr: 'Simple', sw: 'Rahisi', ha: 'Sauƙi', tw: 'Mmerɛw',
  },
  'mode.simple': {
    en: 'Simple', fr: 'Simple', sw: 'Rahisi', ha: 'Sauƙi', tw: 'Mmerɛw',
  },
  'mode.standard': {
    en: 'Standard', fr: 'Standard', sw: 'Kawaida', ha: 'Daidai', tw: 'Nhyehyɛe',
  },
  'mode.advanced': {
    en: 'Advanced', fr: 'Avancé', sw: 'Kwa kina', ha: 'Ci gaba', tw: 'Nea ɛkɔ anim',
  },
  'mode.switchToBasic': {
    en: 'Switch to simple view', fr: 'Vue simple', sw: 'Badilisha kuwa rahisi', ha: 'Canja zuwa sauƙi', tw: 'Sesa kɔ mmerɛw',
  },
  'mode.switchToStandard': {
    en: 'Switch to standard view', fr: 'Vue standard', sw: 'Badilisha kuwa kawaida', ha: 'Canja zuwa daidai', tw: 'Sesa kɔ nhyehyɛe',
  },

  // ═══════════════════════════════════════════════════════════
  //  TASK PRESENTATION — labels and voice prompts per type
  // ═══════════════════════════════════════════════════════════

  // Short labels (icon + text in standard mode)
  'task.label.watering': {
    en: 'Water crops', fr: 'Arroser', sw: 'Mwagilia', ha: 'Shayar da amfani', tw: 'Pete nnɔbae no nsuo',
  },
  'task.label.planting': {
    en: 'Plant seeds', fr: 'Planter', sw: 'Panda mbegu', ha: 'Shuka iri', tw: 'Dua aba',
  },
  'task.label.spraying': {
    en: 'Spray field', fr: 'Pulvériser', sw: 'Nyunyiza', ha: 'Fesa gona', tw: 'Pete aduro',
  },
  'task.label.fertilizing': {
    en: 'Apply fertilizer', fr: 'Fertiliser', sw: 'Weka mbolea', ha: 'Sa taki', tw: 'Gu nsɔhwɛ',
  },
  'task.label.weeding': {
    en: 'Remove weeds', fr: 'Désherber', sw: 'Ondoa magugu', ha: 'Cire ciyawa', tw: 'Tu wura',
  },
  'task.label.harvest': {
    en: 'Harvest', fr: 'Récolter', sw: 'Vuna', ha: 'Girbi', tw: 'Twa',
  },
  'task.label.pruning': {
    en: 'Prune plants', fr: 'Tailler', sw: 'Pogoa', ha: 'Yanke reshe', tw: 'Twa nnan',
  },
  'task.label.mulching': {
    en: 'Add mulch', fr: 'Pailler', sw: 'Weka matandiko', ha: 'Sa ciyawa', tw: 'De wura kata',
  },
  'task.label.scouting': {
    en: 'Check crops', fr: 'Inspecter', sw: 'Kagua mazao', ha: 'Duba amfani', tw: 'Hwɛ nnɔbae',
  },
  'task.label.soilTest': {
    en: 'Test soil', fr: 'Tester le sol', sw: 'Pima udongo', ha: 'Gwada ƙasa', tw: 'Sɔ asase hwɛ',
  },
  'task.label.irrigation': {
    en: 'Irrigate', fr: 'Irriguer', sw: 'Mwagilia', ha: 'Ban ruwa', tw: 'Pete nsuo',
  },
  'task.label.storage': {
    en: 'Store harvest', fr: 'Stocker', sw: 'Hifadhi mavuno', ha: 'Ajiye girbi', tw: 'Kora otwa',
  },
  'task.label.selling': {
    en: 'Sell produce', fr: 'Vendre', sw: 'Uza mazao', ha: 'Sayar da kayan', tw: 'Tɔn nnɔbae',
  },
  'task.label.farmTask': {
    en: 'Farm task', fr: 'Tâche agricole', sw: 'Kazi ya shamba', ha: 'Aikin gona', tw: 'Afuo adwuma',
  },

  // Voice prompts — short, spoken aloud by voice system
  'task.voice.watering': {
    en: 'Time to water your crops. Tap the button when done.',
    fr: 'Il est temps d\'arroser. Appuyez quand c\'est fait.',
    sw: 'Wakati wa kumwagilia. Bonyeza ukimaliza.',
    ha: 'Lokacin shayar da amfani. Danna idan ka gama.',
    tw: 'Bere aso sɛ wopete nsuo. Mia bɔtɔn no sɛ woawie.',
  },
  'task.voice.planting': {
    en: 'Time to plant. Tap the button when done.',
    fr: 'Il est temps de planter. Appuyez quand c\'est fait.',
    sw: 'Wakati wa kupanda. Bonyeza ukimaliza.',
    ha: 'Lokacin shuka. Danna idan ka gama.',
    tw: 'Bere aso sɛ wodua. Mia bɔtɔn no sɛ woawie.',
  },
  'task.voice.spraying': {
    en: 'Time to spray your field. Tap the button when done.',
    fr: 'Il est temps de pulvériser. Appuyez quand c\'est fait.',
    sw: 'Wakati wa kunyunyiza. Bonyeza ukimaliza.',
    ha: 'Lokacin fesa gona. Danna idan ka gama.',
    tw: 'Bere aso sɛ wopete aduro. Mia bɔtɔn no sɛ woawie.',
  },
  'task.voice.fertilizing': {
    en: 'Time to add fertilizer. Tap the button when done.',
    fr: 'Il est temps de fertiliser. Appuyez quand c\'est fait.',
    sw: 'Wakati wa kuweka mbolea. Bonyeza ukimaliza.',
    ha: 'Lokacin sa taki. Danna idan ka gama.',
    tw: 'Bere aso sɛ wogu nsɔhwɛ. Mia bɔtɔn no sɛ woawie.',
  },
  'task.voice.weeding': {
    en: 'Time to weed your farm. Tap the button when done.',
    fr: 'Il est temps de désherber. Appuyez quand c\'est fait.',
    sw: 'Wakati wa kupalilia. Bonyeza ukimaliza.',
    ha: 'Lokacin cire ciyawa. Danna idan ka gama.',
    tw: 'Bere aso sɛ wotu wura. Mia bɔtɔn no sɛ woawie.',
  },
  'task.voice.harvest': {
    en: 'Your crop is ready to harvest. Tap when done.',
    fr: 'Votre récolte est prête. Appuyez quand c\'est fait.',
    sw: 'Mazao yako yako tayari kuvunwa. Bonyeza ukimaliza.',
    ha: 'Amfanin ku ya shirya don girbi. Danna idan ka gama.',
    tw: 'Wo nnɔbae aboa sɛ wotwa. Mia bɔtɔn no sɛ woawie.',
  },
  'task.voice.pruning': {
    en: 'Time to prune your plants. Tap the button when done.',
    fr: 'Il est temps de tailler. Appuyez quand c\'est fait.',
    sw: 'Wakati wa kupogoa. Bonyeza ukimaliza.',
    ha: 'Lokacin yanke reshe. Danna idan ka gama.',
    tw: 'Bere aso sɛ wotwa nnan. Mia bɔtɔn no sɛ woawie.',
  },
  'task.voice.scouting': {
    en: 'Check your crops for any problems. Tap when done.',
    fr: 'Vérifiez vos cultures. Appuyez quand c\'est fait.',
    sw: 'Kagua mazao yako kwa matatizo. Bonyeza ukimaliza.',
    ha: 'Duba amfanin gona don matsaloli. Danna idan ka gama.',
    tw: 'Hwɛ wo nnɔbae sɛ asɛm bi wɔ mu. Mia bɔtɔn no sɛ woawie.',
  },
  'task.voice.default': {
    en: 'You have a task to do. Tap the button when done.',
    fr: 'Vous avez une tâche. Appuyez quand c\'est fait.',
    sw: 'Una kazi ya kufanya. Bonyeza ukimaliza.',
    ha: 'Kana da aiki. Danna idan ka gama.',
    tw: 'Wowɔ adwuma bi. Mia bɔtɔn no sɛ woawie.',
  },
  'task.voice.finishSetup': {
    en: 'Set up your farm first. Tap the button to start.',
    fr: 'Configurez votre ferme d\'abord. Appuyez pour commencer.',
    sw: 'Weka shamba lako kwanza. Bonyeza kuanza.',
    ha: 'Shirya gonar ka tukuna. Danna don fara.',
    tw: 'Hyehyɛ wo afuo kan. Mia bɔtɔn no na hyɛ ase.',
  },
  'task.voice.setStage': {
    en: 'Tell us what stage your crop is at. Tap the button.',
    fr: 'Dites-nous le stade de votre culture. Appuyez.',
    sw: 'Tuambie hatua ya mazao yako. Bonyeza.',
    ha: 'Gaya mana matakin amfanin ku. Danna.',
    tw: 'Ka kyerɛ yɛn wo nnɔbae anammɔn. Mia bɔtɔn no.',
  },
  'task.voice.allDone': {
    en: 'Great work! All tasks done. You can add a farm update.',
    fr: 'Bon travail ! Tout est fait. Ajoutez une mise à jour.',
    sw: 'Kazi nzuri! Kazi zote zimekamilika. Unaweza kuongeza sasishi.',
    ha: 'Kyakkyawan aiki! An gama komai. Zaka ƙara sabuntawa.',
    tw: 'Adwuma pa! Woawie nyinaa. Wobɛtumi de nsɛm foforo aka ho.',
  },

  // ═══════════════════════════════════════════════════════════
  //  FARMER SETTINGS — mode + voice controls
  // ═══════════════════════════════════════════════════════════

  'settings.viewMode': {
    en: 'View', fr: 'Vue', sw: 'Mwonekano', ha: 'Gani', tw: 'Hwɛ',
  },
  'settings.voiceGuide': {
    en: 'Voice', fr: 'Voix', sw: 'Sauti', ha: 'Murya', tw: 'Nne',
  },
  'settings.voiceOn': {
    en: 'On', fr: 'Activé', sw: 'Wazi', ha: 'A kunna', tw: 'Abue',
  },
  'settings.voiceOff': {
    en: 'Off', fr: 'Désactivé', sw: 'Imezimwa', ha: 'A kashe', tw: 'Adum',
  },

  // ═══════════════════════════════════════════════════════════
  //  NOTIFICATIONS — smart daily farmer alerts
  // ═══════════════════════════════════════════════════════════

  // ─── Settings card ─────────────────────────────
  'notification.settings.title': {
    en: 'Daily notifications', fr: 'Notifications quotidiennes', sw: 'Taarifa za kila siku', ha: 'Sanarwar yau da kullum', tw: 'Daa nkra',
  },
  'notification.settings.subtitle': {
    en: 'Useful guidance, not spam.', fr: 'Des conseils utiles, pas de spam.', sw: 'Mwongozo wa manufaa, si ghasia.', ha: 'Jagora mai fa\'ida, ba spam ba.', tw: 'Akwankyerɛ a ɛho hia, ɛnyɛ nkwanhyia.',
  },
  'notification.settings.daily': {
    en: 'Daily task reminder', fr: 'Rappel quotidien', sw: 'Kumbusho la kila siku', ha: 'Tunatarwa ta yau da kullum', tw: 'Daa adwuma nkae',
  },
  'notification.settings.dailyHint': {
    en: 'One morning nudge about what to do today', fr: 'Un rappel matinal sur ce qu\'il faut faire aujourd\'hui', sw: 'Ukumbusho mmoja asubuhi kuhusu cha kufanya leo', ha: 'Tunatarwa ɗaya da safe game da abin da za a yi yau', tw: 'Anɔpa nkae baako fa deɛ wobɛyɛ nnɛ ho',
  },
  'notification.settings.weather': {
    en: 'Weather alerts', fr: 'Alertes météo', sw: 'Tahadhari za hali ya hewa', ha: 'Sanarwar yanayi', tw: 'Ewim tebea kɔkɔbɔ',
  },
  'notification.settings.weatherHint': {
    en: 'Only when weather changes your next action', fr: 'Seulement si la météo change votre prochaine action', sw: 'Tu wakati hali ya hewa inabadilisha hatua yako', ha: 'Kawai lokacin da yanayi ya canza mataki na gaba', tw: 'Bere a ewim tebea sesa adeɛ a ɛdi hɔ nko ara',
  },
  'notification.settings.critical': {
    en: 'Critical risk alerts', fr: 'Alertes critiques', sw: 'Tahadhari muhimu', ha: 'Sanarwar haɗari', tw: 'Asiane kɔkɔbɔ',
  },
  'notification.settings.criticalHint': {
    en: 'Rare — only when delay could cause loss', fr: 'Rares — seulement si un retard peut causer une perte', sw: 'Nadra — tu wakati kuchelewa kunaweza kusababisha hasara', ha: 'Ba safai ba — kawai idan jinkiri zai iya haifar da asara', tw: 'Ɛnyɛ daa — bere a akyire-kyire bɛma wɔahwere nneɛma nko',
  },
  'notification.settings.time': {
    en: 'Morning time', fr: 'Heure du matin', sw: 'Wakati wa asubuhi', ha: 'Lokacin safe', tw: 'Anɔpa bere',
  },
  'notification.settings.timeHint': {
    en: 'When to receive your daily reminder', fr: 'Quand recevoir votre rappel quotidien', sw: 'Wakati wa kupokea ukumbusho wako', ha: 'Lokacin da za ku sami tunatarwa', tw: 'Bere a wobɛnya wo daa nkae',
  },
  'notification.settings.enableBrowser': {
    en: 'Enable phone notifications', fr: 'Activer les notifications', sw: 'Wezesha taarifa za simu', ha: 'Kunna sanarwar waya', tw: 'Ma fon nkra nyɛ adwuma',
  },
  'notification.settings.deniedHint': {
    en: 'Phone notifications are off. In-app reminders still work.', fr: 'Les notifications sont désactivées. Les rappels dans l\'app fonctionnent.', sw: 'Taarifa za simu zimezimwa. Vikumbusho vya ndani ya programu bado vinafanya kazi.', ha: 'An kashe sanarwar waya. Tunatarwa a cikin app na ci gaba.', tw: 'Fon nkra no adum. App mu nkae da so yɛ adwuma.',
  },
  'notification.settings.unsupportedHint': {
    en: 'Your phone does not support notifications. In-app reminders still work.', fr: 'Votre téléphone ne prend pas en charge les notifications.', sw: 'Simu yako haitumii taarifa. Vikumbusho vya ndani vinafanya kazi.', ha: 'Wayarku ba ta tallafawa sanarwa. Tunatarwa a app na ci gaba.', tw: 'Wo fon no nsusuw nkra so. App mu nkae da so yɛ adwuma.',
  },

  // ─── Daily notification copy ───────────────────
  'notification.daily.today.title': {
    en: 'Today\'s farm action', fr: 'Action du jour', sw: 'Hatua ya leo shambani', ha: 'Aikin gona na yau', tw: 'Afuo adwuma nnɛ',
  },
  'notification.daily.today.body': {
    en: '{task} — do today.', fr: '{task} — à faire aujourd\'hui.', sw: '{task} — fanya leo.', ha: '{task} — yi yau.', tw: '{task} — yɛ nnɛ.',
  },
  'notification.daily.week.title': {
    en: 'This week on your farm', fr: 'Cette semaine sur votre ferme', sw: 'Wiki hii shambani kwako', ha: 'Wannan mako a gonarka', tw: 'Nnawɔtwe yi wɔ w\'afuo',
  },
  'notification.daily.week.body': {
    en: '{task} — plan for this week.', fr: '{task} — à prévoir cette semaine.', sw: '{task} — panga wiki hii.', ha: '{task} — shirya a wannan mako.', tw: '{task} — siesie ma nnawɔtwe yi.',
  },
  'notification.daily.generic.title': {
    en: 'Next on your farm', fr: 'Prochaine tâche', sw: 'Ifuatayo shambani', ha: 'Na gaba a gonarka', tw: 'Nea ɛdi hɔ wɔ w\'afuo',
  },
  'notification.daily.generic.body': {
    en: '{task}', fr: '{task}', sw: '{task}', ha: '{task}', tw: '{task}',
  },

  // ─── Weather-triggered copy ────────────────────
  'notification.weather.water_heat.title': {
    en: 'Water your crop today', fr: 'Arrosez votre culture aujourd\'hui', sw: 'Mwagilia zao lako leo', ha: 'Shayar da amfanin gona yau', tw: 'Gugu wo nnɔbae nnɛ',
  },
  'notification.weather.water_heat.body': {
    en: 'Heat is high — water before noon.', fr: 'Forte chaleur — arrosez avant midi.', sw: 'Joto ni kali — mwagilia kabla ya mchana.', ha: 'Zafi yana da tsanani — shayar kafin tsakar rana.', tw: 'Ɛhyew ano yɛ den — gugu ansa na awia bedu awiei.',
  },
  'notification.weather.protect_harvest.title': {
    en: 'Protect your harvest today', fr: 'Protégez votre récolte aujourd\'hui', sw: 'Linda mavuno yako leo', ha: 'Kare girbin ku yau', tw: 'Bɔ wo twa no ho ban nnɛ',
  },
  'notification.weather.protect_harvest.body': {
    en: 'Rain is expected tomorrow.', fr: 'Pluie prévue demain.', sw: 'Mvua inatarajiwa kesho.', ha: 'Ana sa ran ruwan sama gobe.', tw: 'Wɔhwɛ kwan ma osu bɛtɔ ɔkyena.',
  },
  'notification.weather.delay_spray.title': {
    en: 'Delay spraying today', fr: 'Retardez la pulvérisation aujourd\'hui', sw: 'Ahirisha kunyunyizia leo', ha: 'Dakata da feshi yau', tw: 'Twɛn mma wonnpete aduro nnɛ',
  },
  'notification.weather.delay_spray.body': {
    en: 'Wind is too strong — try later this week.', fr: 'Vent trop fort — réessayez plus tard.', sw: 'Upepo una nguvu sana — jaribu baadaye wiki hii.', ha: 'Iska na da ƙarfi sosai — sake gwadawa daga baya.', tw: 'Mframa bo — sɔ hwɛ akyire yi.',
  },

  // ─── Critical copy ─────────────────────────────
  'notification.critical.rain_harvest.title': {
    en: 'Move your harvest under cover now', fr: 'Mettez votre récolte à l\'abri maintenant', sw: 'Hamisha mavuno yako chini ya hifadhi sasa', ha: 'Matsar da girbin ka ƙarƙashin rufi yanzu', tw: 'Fa wo twa no hyɛ baabi a ɛbɔ ho ban seesei',
  },
  'notification.critical.rain_harvest.body': {
    en: 'Rain is arriving — act now to avoid loss.', fr: 'La pluie arrive — agissez maintenant.', sw: 'Mvua inakuja — fanya sasa kuepuka hasara.', ha: 'Ruwan sama na zuwa — yi yanzu don guje wa asara.', tw: 'Osu reba — yɛ seesei na ɛhwere nnema.',
  },
  'notification.critical.generic.title': {
    en: 'Urgent — act on your farm now', fr: 'Urgent — agissez maintenant', sw: 'Haraka — fanya sasa shambani', ha: 'Gaggawa — yi aikin gona yanzu', tw: 'Ɛhia ntɛm — yɛ w\'afuo adwuma seesei',
  },
  'notification.critical.generic.body': {
    en: 'This task is time-sensitive today.', fr: 'Cette tâche est urgente aujourd\'hui.', sw: 'Kazi hii ni ya haraka leo.', ha: 'Wannan aiki na gaggawa yau.', tw: 'Adwuma yi hia ntɛm nnɛ.',
  },

  // ═══════════════════════════════════════════════════════════
  //  ACTION FEEDBACK — farmer-friendly save/sync states
  // ═══════════════════════════════════════════════════════════

  'feedback.saved': {
    en: 'Saved!', fr: 'Enregistré !', sw: 'Imehifadhiwa!', ha: 'An ajiye!', tw: 'Yɛakora!',
  },
  'feedback.next': {
    en: 'Next', fr: 'Suivant', sw: 'Ifuatayo', ha: 'Na gaba', tw: 'Nea edi so',
  },
  'feedback.savedOffline': {
    en: 'Saved offline', fr: 'Enregistré hors ligne', sw: 'Imehifadhiwa bila mtandao', ha: 'An ajiye ba tare da layi ba', tw: 'Yɛakora a intanɛt nni hɔ',
  },
  'feedback.syncing': {
    en: 'Sending...', fr: 'Envoi...', sw: 'Inatuma...', ha: 'Ana aikawa...', tw: 'Ɛrede...',
  },
  'feedback.synced': {
    en: 'Sent!', fr: 'Envoyé !', sw: 'Imetumwa!', ha: 'An aika!', tw: 'Yɛade akɔ!',
  },
  'feedback.failed': {
    en: 'Not sent', fr: 'Non envoyé', sw: 'Haijatumwa', ha: 'Ba a aika ba', tw: 'Ɛnkɔɛ',
  },
  'feedback.tapRetry': {
    en: 'Tap to retry', fr: 'Appuyez pour réessayer', sw: 'Bonyeza kujaribu tena', ha: 'Danna don sake gwadawa', tw: 'Mia na san hwehwe',
  },

  // ═══════════════════════════════════════════════════════════
  //  FIRST-TIME HINTS — one-time guidance overlays
  // ═══════════════════════════════════════════════════════════

  'hint.tapTask': {
    en: 'Tap here to do your task', fr: 'Appuyez ici pour votre tâche', sw: 'Bonyeza hapa kufanya kazi', ha: 'Danna nan don aikin ku', tw: 'Mia ha na yɛ wo adwuma',
  },
  'hint.tapSpeaker': {
    en: 'Tap to hear instructions', fr: 'Appuyez pour écouter', sw: 'Bonyeza kusikia maelekezo', ha: 'Danna don jin umurni', tw: 'Mia na tie nkyerɛkyerɛ',
  },

  // ═══════════════════════════════════════════════════════════
  //  VOICE — welcome message
  // ═══════════════════════════════════════════════════════════

  'voice.enableGuide': {
    en: 'Enable voice guide', fr: 'Activer le guide vocal', sw: 'Wezesha mwongozo wa sauti', ha: 'Kunna jagora na murya', tw: 'Ma nne akwankyerɛ nyɛ adwuma',
  },
  'voice.turnOn': {
    en: 'Turn on voice guide', fr: 'Activer le guide vocal', sw: 'Washa mwongozo wa sauti', ha: 'Kunna jagora na murya', tw: 'Sɔ nne akwankyerɛ',
  },
  'voice.welcome': {
    en: 'Welcome to your farm. Check your task for today.',
    fr: 'Bienvenue sur votre ferme. Vérifiez votre tâche du jour.',
    sw: 'Karibu shambani kwako. Angalia kazi yako ya leo.',
    ha: 'Barka da zuwa gonar ku. Duba aikin ku na yau.',
    tw: 'Akwaaba wo afuo so. Hwɛ wo ɛnnɛ adwuma.',
  },

  // ═══════════════════════════════════════════════════════════
  //  NAVIGATION — bottom tab labels
  // ═══════════════════════════════════════════════════════════

  'nav.home': { en: 'Home', fr: 'Accueil', sw: 'Nyumbani', ha: 'Gida', tw: 'Fie' },
  'nav.myFarm': { en: 'My Farm', fr: 'Ma ferme', sw: 'Shamba', ha: 'Gona', tw: 'Afuo' },
  'nav.tasks': { en: 'Tasks', fr: 'Tâches', sw: 'Kazi', ha: 'Ayyuka', tw: 'Adwuma' },
  'nav.progress': { en: 'Progress', fr: 'Progrès', sw: 'Maendeleo', ha: 'Ci gaba', tw: 'Nkɔso' },

  // ═══════════════════════════════════════════════════════════
  //  DASHBOARD — section labels (Home decision screen)
  // ═══════════════════════════════════════════════════════════

  'dashboard.currentTask': { en: 'Current task', fr: 'Tâche en cours', sw: 'Kazi ya sasa', ha: 'Aikin yanzu', tw: 'Adwuma a ɛwɔ hɔ' },
  'dashboard.progress': { en: 'Progress', fr: 'Progrès', sw: 'Maendeleo', ha: 'Ci gaba', tw: 'Nkɔso' },

  // ═══════════════════════════════════════════════════════════
  //  PROGRESS — page labels and insight blocks
  // ═══════════════════════════════════════════════════════════

  'progress.tasksCompleted': { en: 'Tasks completed', fr: 'Tâches terminées', sw: 'Kazi zilizokamilika', ha: 'Ayyukan da aka gama', tw: 'Adwuma a wɔawie' },
  'progress.weeklyActivity': { en: 'This week', fr: 'Cette semaine', sw: 'Wiki hii', ha: 'Wannan mako', tw: 'Nnawɔtwe yi' },
  'progress.insightGreat': { en: 'Great work!', fr: 'Excellent !', sw: 'Kazi nzuri!', ha: 'Aiki nagari!', tw: 'Adwuma pa!' },
  'progress.insightGood': { en: 'Keep it up!', fr: 'Continuez !', sw: 'Endelea!', ha: 'Ci gaba!', tw: 'Toa so!' },
  'progress.insightStart': { en: 'Getting started', fr: 'Début', sw: 'Kuanza', ha: 'Farawa', tw: 'Ahyɛase' },
  'progress.insightGreatDesc': { en: 'You\'re ahead of most farmers this week.', fr: 'Vous êtes en avance cette semaine.', sw: 'Uko mbele ya wakulima wengi wiki hii.', ha: 'Kuna gaban yawancin manoma wannan mako.', tw: 'Wodi kan nnawɔtwe yi.' },
  'progress.insightGoodDesc': { en: 'You\'re making good progress on your tasks.', fr: 'Vous avancez bien dans vos tâches.', sw: 'Unaendelea vizuri na kazi zako.', ha: 'Kuna ci gaba da kyau a ayyukan ku.', tw: 'Woyɛ adwuma pa.' },
  'progress.insightStartDesc': { en: 'Complete your tasks to keep your farm on track.', fr: 'Terminez vos tâches pour que tout soit en ordre.', sw: 'Kamilisha kazi zako ili shamba liendelee vizuri.', ha: 'Kammala ayyukan ku don gonar ku ta ci gaba.', tw: 'Wie wo adwuma na wo afuo akɔ so yie.' },

  // ═══════════════════════════════════════════════════════════
  //  ALL TASKS — filter labels and empty states
  // ═══════════════════════════════════════════════════════════

  'allTasks.filterToday': { en: 'Today', fr: 'Aujourd\'hui', sw: 'Leo', ha: 'Yau', tw: 'Ɛnnɛ' },
  'allTasks.filterUpcoming': { en: 'Upcoming', fr: 'À venir', sw: 'Zinazokuja', ha: 'Mai zuwa', tw: 'Nea ɛba' },
  'allTasks.filterCompleted': { en: 'Completed', fr: 'Terminé', sw: 'Zilizokamilika', ha: 'An gama', tw: 'Awie' },
  'allTasks.noCompleted': { en: 'No completed tasks yet', fr: 'Aucune tâche terminée', sw: 'Hakuna kazi zilizokamilika', ha: 'Babu ayyukan da aka gama', tw: 'Adwuma biara nni hɔ a wɔawie' },
  'allTasks.noUrgent': { en: 'No urgent tasks today', fr: 'Aucune tâche urgente aujourd\'hui', sw: 'Hakuna kazi ya haraka leo', ha: 'Babu aikin gaggawa yau', tw: 'Adwuma a ɛhia ɛnnɛ nni hɔ' },
  'allTasks.noUpcoming': { en: 'No upcoming tasks', fr: 'Aucune tâche à venir', sw: 'Hakuna kazi zinazokuja', ha: 'Babu ayyukan da za su zo', tw: 'Adwuma a ɛba nni hɔ' },

  // ═══════════════════════════════════════════════════════════
  //  DAILY LOOP — progress signal, next-task handoff, states
  // ═══════════════════════════════════════════════════════════

  'loop.next': { en: 'Next', fr: 'Suivant', sw: 'Ifuatayo', ha: 'Na gaba', tw: 'Nea edi so' },
  'loop.taskDone': { en: 'Task completed', fr: 'Tâche terminée', sw: 'Kazi imekamilika', ha: 'An gama aikin', tw: 'Wɔawie adwuma no' },
  'loop.nextReady': { en: 'Next task ready', fr: 'Tâche suivante prête', sw: 'Kazi ifuatayo iko tayari', ha: 'Aikin na gaba ya shirya', tw: 'Adwuma a edi so awie' },
  'loop.allDone': { en: 'All done for now', fr: 'Tout est fait', sw: 'Kazi zote zimekamilika', ha: 'An gama duka', tw: 'Wɔawie ne nyinaa' },
  'loop.comeBack': { en: 'Come back later for your next task', fr: 'Revenez plus tard', sw: 'Rudi baadaye kwa kazi', ha: 'Ku dawo daga baya', tw: 'San bra akyiri yi' },
  'loop.comeBackTomorrow': { en: 'Check back tomorrow', fr: 'Revenez demain', sw: 'Rudi kesho', ha: 'Ku dawo gobe', tw: 'San hwɛ ɔkyena' },
  'loop.savedOffline': { en: 'Saved offline — will sync later', fr: 'Enregistré hors-ligne', sw: 'Imehifadhiwa nje ya mtandao', ha: 'An ajiye a wajen layi', tw: 'Wɔakora no offline' },
  'loop.progressDone': { en: '{done} done', fr: '{done} terminé(s)', sw: '{done} imekamilika', ha: '{done} an gama', tw: '{done} awie' },
  'loop.progressLeft': { en: '{left} left', fr: '{left} restant(s)', sw: '{left} imebaki', ha: '{left} ya rage', tw: '{left} aka' },
  'loop.progressToday': { en: '{done} of {total} done today', fr: '{done} sur {total} aujourd\'hui', sw: '{done} kati ya {total} leo', ha: '{done} daga {total} yau', tw: '{done} a {total} mu ɛnnɛ' },
  'loop.onTrack': { en: 'On track', fr: 'En bonne voie', sw: 'Njia nzuri', ha: 'Kan hanya', tw: 'Ɛkwan so' },
  'loop.greatWork': { en: 'Great work!', fr: 'Bravo !', sw: 'Kazi nzuri!', ha: 'Kyakkyawa!', tw: 'Adwuma pa!' },
  'loop.keepGoing': { en: 'Keep going', fr: 'Continuez', sw: 'Endelea', ha: 'Ci gaba', tw: 'Toa so' },

  // ─── Completion flow (task completion card) ────────────────
  'completion.done': {
    en: 'Done', fr: 'Fait', sw: 'Imekamilika', ha: 'An gama', tw: 'Awie',
  },
  'completion.continue': {
    en: 'Continue', fr: 'Continuer', sw: 'Endelea', ha: 'Ci gaba', tw: 'Kɔ so',
  },
  'completion.later': {
    en: 'Later', fr: 'Plus tard', sw: 'Baadaye', ha: 'Daga baya', tw: 'Akyiri yi',
  },
  'completion.backToHome': {
    en: 'Back to Home', fr: 'Retour à l\'accueil', sw: 'Rudi Nyumbani', ha: 'Koma Gida', tw: 'San kɔ Fie',
  },
  'completion.nextStep': {
    en: 'Next step', fr: 'Prochaine étape', sw: 'Hatua inayofuata', ha: 'Mataki na gaba', tw: 'Anammɔn a edi so',
  },
  'completion.greatProgressToday': {
    en: 'Great progress today!', fr: 'Bon progrès aujourd\'hui !', sw: 'Maendeleo mazuri leo!', ha: 'Ci gaba mai kyau yau!', tw: 'Nkɔso pa ɛnnɛ!',
  },
  'completion.doneForNow': {
    en: 'You\'re all done for now', fr: 'Vous avez tout terminé', sw: 'Umekamilisha kwa sasa', ha: 'Ka gama duka yanzu', tw: 'Woawie ne nyinaa seesei',
  },
  'completion.oneLeft': {
    en: '1 task left', fr: '1 tâche restante', sw: 'Kazi 1 imebaki', ha: 'Aikin 1 ya rage', tw: 'Adwuma 1 aka',
  },
  'completion.tasksLeft': {
    en: '{count} tasks left', fr: '{count} tâches restantes', sw: 'Kazi {count} zimebaki', ha: 'Ayyuka {count} suka rage', tw: 'Adwuma {count} aka',
  },
  'completion.returnTomorrow': {
    en: 'Come back tomorrow — your next task will be ready.', fr: 'Revenez demain — votre prochaine tâche sera prête.', sw: 'Rudi kesho — kazi yako itakuwa tayari.', ha: 'Ku dawo gobe — aikin ka na gaba zai shirya.', tw: 'San bra ɔkyena — wo adwuma a edi so bɛsiesie.',
  },
  'completion.returnLater': {
    en: 'We\'ll show your next farm step when it\'s time.', fr: 'Nous afficherons la prochaine étape le moment venu.', sw: 'Tutaonyesha hatua yako inayofuata wakati utakapofika.', ha: 'Za mu nuna mataki na gaba lokacin da ya yi.', tw: 'Yɛbɛkyerɛ wo anammɔn a edi so bere a ɛsɛ.',
  },

  // ─── Outcome text (what was achieved) ─────────────────────
  'outcome.dryHarvest': {
    en: 'Grain is now safer from mold.', fr: 'Les grains sont protégés de la moisissure.', sw: 'Nafaka sasa iko salama kutokana na ukungu.', ha: 'Hatsi ya fi aminci daga ƙura.', tw: 'Aburow no ho atɔ wɔ afunfuo ho.',
  },
  'outcome.waterCrop': {
    en: 'Your crop has water for today.', fr: 'Votre culture a de l\'eau pour aujourd\'hui.', sw: 'Mazao yako yana maji ya leo.', ha: 'Amfanin gonar ka yana da ruwa na yau.', tw: 'Wo nnɔbae no anya nsuo ɛnnɛ.',
  },
  'outcome.checkPests': {
    en: 'Pest risk is now checked.', fr: 'Le risque de nuisibles est vérifié.', sw: 'Hatari ya wadudu imekaguliwa.', ha: 'An duba haɗarin ƙwari.', tw: 'Wɔahwɛ mmoa a ɛsɛe nnɔbae no.',
  },
  'outcome.sprayCrop': {
    en: 'Crop is now protected.', fr: 'La culture est maintenant protégée.', sw: 'Mazao yako yamelindwa sasa.', ha: 'An kare amfanin gona yanzu.', tw: 'Nnɔbae no ho atɔ seesei.',
  },
  'outcome.protectHarvest': {
    en: 'Harvest is protected from rain.', fr: 'La récolte est protégée de la pluie.', sw: 'Mavuno yamelindwa kutokana na mvua.', ha: 'An kare girbi daga ruwan sama.', tw: 'Wɔabɔ twa adeɛ no ho fi nsuo mu.',
  },
  'outcome.logHarvest': {
    en: 'Harvest data is now saved.', fr: 'Les données de récolte sont enregistrées.', sw: 'Data ya mavuno imehifadhiwa.', ha: 'An ajiye bayanan girbi.', tw: 'Wɔakora twa adeɛ ho nsɛm.',
  },
  'outcome.harvest': {
    en: 'Harvest secured.', fr: 'Récolte sécurisée.', sw: 'Mavuno yamehifadhiwa.', ha: 'An tabbatar da girbi.', tw: 'Wotwa adeɛ no awie yie.',
  },
  'outcome.weedField': {
    en: 'Field is cleaner — crop can grow better.', fr: 'Le champ est plus propre — la culture poussera mieux.', sw: 'Shamba ni safi — mazao yatakua vizuri.', ha: 'Gona ta fi tsabta — amfanin gona zai yi girma.', tw: 'Afuo no ho atɛ — nnɔbae no bɛnyini yie.',
  },
  'outcome.fertilize': {
    en: 'Nutrients added — your crop will benefit.', fr: 'Nutriments ajoutés — votre culture en profitera.', sw: 'Virutubisho vimeongezwa — mazao yatanufaika.', ha: 'An ƙara abinci — amfanin gonar ka zai amfana.', tw: 'Nkɔsoɔ aduro no akɔ mu — wo nnɔbae bɛnya mfasoɔ.',
  },
  'outcome.plantCrop': {
    en: 'Planted — growth starts now.', fr: 'Planté — la croissance commence.', sw: 'Imepandwa — ukuaji unaanza.', ha: 'An shuka — girma ya fara.', tw: 'Woadua — ɛrefi ase anyini.',
  },
  'outcome.landPrep': {
    en: 'Soil is ready for planting.', fr: 'Le sol est prêt pour la plantation.', sw: 'Udongo uko tayari kupanda.', ha: 'Ƙasa ta shirya don shuka.', tw: 'Asase no asiesie ama dua.',
  },
  'outcome.sortClean': {
    en: 'Produce sorted — better market value.', fr: 'Produits triés — meilleure valeur marchande.', sw: 'Mazao yamepangwa — thamani bora sokoni.', ha: 'An tsara kaya — daraja mai kyau a kasuwa.', tw: 'Nneɛma no apae mu — ne bo kɔ soro wɔ dwom.',
  },
  'outcome.storeHarvest': {
    en: 'Stored safely — quality preserved.', fr: 'Stocké en sécurité — qualité préservée.', sw: 'Imehifadhiwa salama — ubora umehifadhiwa.', ha: 'An ajiye lafiya — inganci ya ci gaba.', tw: 'Wɔakora yie — ne su da so yɛ papa.',
  },
  'outcome.updateStage': {
    en: 'Farm stage updated.', fr: 'Étape de la ferme mise à jour.', sw: 'Hatua ya shamba imesasishwa.', ha: 'An sabunta matakin gona.', tw: 'Wɔasakra afuo no dan.',
  },

  // ═══════════════════════════════════════════════════════════
  //  PROGRESS PAGE — farmer-friendly motivational copy
  // ═══════════════════════════════════════════════════════════

  'progress.title': { en: 'My Progress', fr: 'Mon progrès', sw: 'Maendeleo yangu', ha: 'Ci gaba na', tw: 'Me nkɔso' },
  'progress.complete': { en: 'complete', fr: 'terminé', sw: 'kamili', ha: 'an gama', tw: 'awie' },
  'progress.remaining': { en: 'still to do', fr: 'restant', sw: 'bado', ha: 'ya rage', tw: 'aka' },
  'progress.allDone': { en: 'All caught up!', fr: 'Tout est fait !', sw: 'Kazi zote zimekamilika!', ha: 'An gama duka!', tw: 'Wɔawie ne nyinaa!' },
  'progress.done': { en: 'Done', fr: 'Fait', sw: 'Imekamilika', ha: 'An gama', tw: 'Awie' },
  'progress.pending': { en: 'Left today', fr: 'Restant', sw: 'Bado leo', ha: 'Ya rage yau', tw: 'Aka ɛnnɛ' },
  'progress.rate': { en: 'Rate', fr: 'Taux', sw: 'Kiwango', ha: 'Adadi', tw: 'Dodow' },
  'progress.cropProgress': { en: 'Crop progress', fr: 'Avancement culture', sw: 'Maendeleo ya mazao', ha: 'Ci gaban amfanin gona', tw: 'Nnɔbae nkɔso' },
  'progress.offlineNote': { en: 'Some data may be outdated while offline.', fr: 'Certaines données peuvent ne pas être à jour hors ligne.', sw: 'Baadhi ya data inaweza kuwa ya zamani nje ya mtandao.', ha: 'Wasu bayanan na iya zama tsoho a wajen layi.', tw: 'Data bi bɛyɛ dada bere a wo nni intanɛt.' },
  'progress.statusGood': { en: 'You\'re on track', fr: 'Vous êtes en bonne voie', sw: 'Uko njia nzuri', ha: 'Kuna kan hanya', tw: 'Wowɔ ɛkwan pa so' },
  'progress.statusGreat': { en: 'Great progress!', fr: 'Excellent progrès !', sw: 'Maendeleo mazuri!', ha: 'Ci gaba nagari!', tw: 'Nkɔso pa!' },
  'progress.statusStart': { en: 'Good start — keep going', fr: 'Bon début — continuez', sw: 'Mwanzo mzuri — endelea', ha: 'Farawa mai kyau — ci gaba', tw: 'Mfitiaseɛ pa — toa so' },
  'progress.doneToday': { en: '{count} done today', fr: '{count} fait aujourd\'hui', sw: '{count} leo', ha: '{count} yau', tw: '{count} ɛnnɛ' },
  'progress.leftToday': { en: '{count} left today', fr: '{count} restant', sw: '{count} bado leo', ha: '{count} ya rage yau', tw: '{count} aka ɛnnɛ' },
  'progress.updatedToday': { en: 'Updated today', fr: 'Mis à jour aujourd\'hui', sw: 'Imesasishwa leo', ha: 'An sabunta yau', tw: 'Wɔafo ɛnnɛ' },

  // ─── Progress Engine — status bands, next best action, bridges ─
  'progress.on_track':          { en: 'On track',            fr: 'Sur la bonne voie',       sw: 'Unaendelea vizuri',           ha: 'Kuna kan hanya',              tw: 'Wowɔ ɛkwan pa so',             hi: 'सही रास्ते पर' },
  'progress.slight_delay':      { en: 'Slight delay',        fr: 'Léger retard',            sw: 'Kuchelewa kidogo',            ha: 'Jinkiri kaɗan',               tw: 'Akyi kakra',                   hi: 'थोड़ी देरी' },
  'progress.high_risk':         { en: 'Needs attention',     fr: 'Attention requise',       sw: 'Inahitaji uangalizi',         ha: 'Yana bukatar kulawa',         tw: 'Ɛhia hwɛ',                     hi: 'ध्यान देने की जरूरत' },
  'progress.next_best_action':  { en: 'Next best action',    fr: 'Prochaine action',        sw: 'Hatua inayofuata',            ha: 'Mataki na gaba',              tw: 'Adeyɛ a ɛdi hɔ',               hi: 'अगला सबसे अच्छा कदम' },
  'progress.completed_today':   { en: 'Completed today',     fr: 'Fait aujourd\'hui',       sw: 'Zimekamilika leo',            ha: 'An gama yau',                 tw: 'Wɔawie ɛnnɛ',                  hi: 'आज पूरा हुआ' },
  'progress.stage_progress':    { en: 'Stage progress',      fr: 'Avancement de l\'étape',  sw: 'Maendeleo ya hatua',          ha: 'Ci gaban mataki',             tw: 'Gyinaberɛ nkɔso',              hi: 'चरण की प्रगति' },
  'progress.check_tomorrow':    { en: 'Check tomorrow\'s task', fr: 'Voir la tâche de demain', sw: 'Angalia kazi ya kesho',     ha: 'Duba aikin gobe',             tw: 'Hwɛ ɔkyena adwuma',            hi: 'कल का काम देखें' },
  'progress.prepare_next_stage':{ en: 'Prepare for the next stage', fr: 'Préparer l\'étape suivante', sw: 'Jiandae kwa hatua ijayo', ha: 'Shirya mataki na gaba',   tw: 'Siesie gyinaberɛ a ɛdi hɔ',    hi: 'अगले चरण की तैयारी करें' },
  'progress.score':             { en: 'Progress score',      fr: 'Score de progression',    sw: 'Alama ya maendeleo',          ha: 'Makin ci gaba',               tw: 'Nkɔso akontaabuo',             hi: 'प्रगति स्कोर' },

  // ─── Task Engine — stage × action titles (spec §2) ─────────
  'tasks.land_prep.clear_land':        { en: 'Clear land',                    fr: 'Nettoyer le terrain',        sw: 'Safisha shamba',              ha: 'Share filin',                 tw: 'Pra asase no',                 hi: 'खेत साफ करें' },
  'tasks.land_prep.prepare_ridges':    { en: 'Prepare ridges',                fr: 'Préparer les buttes',        sw: 'Andaa matuta',                ha: 'Shirya kunuyi',               tw: 'Siesie amoa',                  hi: 'मेड़ तैयार करें' },
  'tasks.land_prep.check_drainage':    { en: 'Check drainage',                fr: 'Vérifier le drainage',       sw: 'Angalia mifereji',            ha: 'Duba magudanar ruwa',         tw: 'Hwɛ nsuosene',                 hi: 'जल निकासी जांचें' },
  'tasks.planting.plant_crop':         { en: 'Plant your crop',               fr: 'Semer la culture',           sw: 'Panda zao',                   ha: 'Shuka amfanin gona',          tw: 'Dua w\'afudeɛ',                hi: 'फसल बोएं' },
  'tasks.planting.confirm_spacing':    { en: 'Confirm plant spacing',         fr: 'Confirmer l\'espacement',    sw: 'Thibitisha nafasi ya mimea',  ha: 'Tabbatar da nisan tsakanin',  tw: 'Hwɛ sɛ afifideɛ mu ntam',      hi: 'पौधों की दूरी तय करें' },
  'tasks.planting.avoid_heavy_rain':   { en: 'Avoid planting in heavy rain',  fr: 'Éviter de semer sous forte pluie', sw: 'Epuka kupanda wakati wa mvua kubwa', ha: 'Kauce wa shuka a ruwan sama mai yawa', tw: 'Mmfa adua bere a osu akɛseɛ retɔ', hi: 'भारी बारिश में बुवाई से बचें' },
  'tasks.early_growth.inspect_growth': { en: 'Inspect crop growth',           fr: 'Inspecter la croissance',    sw: 'Kagua ukuaji',                ha: 'Duba ci gaban shuka',         tw: 'Hwɛ afifideɛ no nkɔso',        hi: 'फसल की वृद्धि देखें' },
  'tasks.early_growth.remove_weeds':   { en: 'Remove weeds',                  fr: 'Enlever les mauvaises herbes', sw: 'Ng\'oa magugu',              ha: 'Cire ciyayi',                 tw: 'Yi nhahan bɔne',               hi: 'खरपतवार हटाएं' },
  'tasks.early_growth.pest_check':     { en: 'Check for pests',               fr: 'Vérifier les ravageurs',     sw: 'Kagua wadudu',                ha: 'Duba kwari',                  tw: 'Hwɛ sɛ mmoawa wɔ hɔ',          hi: 'कीटों की जांच करें' },
  'tasks.maintain.monitor_moisture':   { en: 'Monitor soil moisture',         fr: 'Surveiller l\'humidité',     sw: 'Fuatilia unyevu wa udongo',   ha: 'Sa ido ga ɗanshi',            tw: 'Hwɛ asase no mu nsuo',         hi: 'मिट्टी की नमी जांचें' },
  'tasks.maintain.weed_control':       { en: 'Weed control',                  fr: 'Désherbage',                 sw: 'Udhibiti wa magugu',          ha: 'Sarrafa ciyayi',              tw: 'Yiyi nhahan bɔne',             hi: 'खरपतवार नियंत्रण' },
  'tasks.maintain.pest_check':         { en: 'Check for pests',               fr: 'Vérifier les ravageurs',     sw: 'Kagua wadudu',                ha: 'Duba kwari',                  tw: 'Hwɛ sɛ mmoawa wɔ hɔ',          hi: 'कीटों की जांच करें' },
  'tasks.harvest.prepare_harvest':     { en: 'Prepare for harvest',           fr: 'Préparer la récolte',        sw: 'Jiandae kwa mavuno',          ha: 'Shirya girbi',                tw: 'Siesie twa',                   hi: 'कटाई की तैयारी करें' },
  'tasks.harvest.protect_from_rain':   { en: 'Protect harvest from rain',     fr: 'Protéger la récolte de la pluie', sw: 'Linda mavuno kutokana na mvua', ha: 'Kare girbi daga ruwan sama', tw: 'Bɔ wotwa adeɛ no ho ban fri osutɔ ho', hi: 'फसल को बारिश से बचाएं' },
  'tasks.post_harvest.store_safely':   { en: 'Store harvest safely',          fr: 'Stocker la récolte en sécurité', sw: 'Hifadhi mavuno kwa usalama', ha: 'Adana girbi cikin aminci',    tw: 'Kora wotwa adeɛ no yie',       hi: 'फसल सुरक्षित रखें' },
  'tasks.post_harvest.prepare_next':   { en: 'Prepare for next cycle',        fr: 'Préparer le cycle suivant',  sw: 'Jiandae kwa msimu ujao',      ha: 'Shirya zagaye na gaba',       tw: 'Siesie afiri a ɛdi hɔ',        hi: 'अगले चक्र की तैयारी करें' },

  // ─── Task Engine — why lines (spec §2 + §4) ────────────────
  'tasks.why.clear_land':        { en: 'Clear debris so ridges sit well.',        fr: 'Nettoyer pour bien former les buttes.',   sw: 'Ondoa takataka ili matuta yashike.',     ha: 'Share don kunuyi ya dace.',              tw: 'Pra na amoa no bɛtumi si yie.',                    hi: 'मलबा हटाएं ताकि मेड़ सही बने।' },
  'tasks.why.prepare_ridges':    { en: 'Good ridges improve root growth.',        fr: 'De bonnes buttes favorisent les racines.', sw: 'Matuta bora huboresha mizizi.',         ha: 'Kunuyi mai kyau suna taimakawa tushe.',  tw: 'Amoa pa ma nhini di yiye.',                        hi: 'अच्छी मेड़ें जड़ वृद्धि बढ़ाती हैं।' },
  'tasks.why.check_drainage':    { en: 'Rain expected — check runoff.',           fr: 'Pluie prévue — vérifiez l\'écoulement.', sw: 'Mvua inatarajiwa — angalia mtiririko.', ha: 'Ana sa ran ruwan sama — duba magudanar.', tw: 'Osutɔ rebɛto — hwɛ nsuosene.',                    hi: 'बारिश की संभावना — बहाव जांचें।' },
  'tasks.why.plant_crop':        { en: 'Plant within the window for best yield.', fr: 'Semer dans la fenêtre optimale.',         sw: 'Panda ndani ya muda mzuri.',             ha: 'Shuka a lokacin da ya dace.',             tw: 'Dua wɔ bere pa mu.',                               hi: 'सही समय पर बोएं।' },
  'tasks.why.confirm_spacing':   { en: 'Correct spacing = stronger plants.',      fr: 'Bon espacement = plantes plus fortes.',   sw: 'Nafasi sahihi = mimea imara.',           ha: 'Daidaitaccen nisa = shuke-shuke masu ƙarfi.', tw: 'Ntam a ɛfata = afifideɛ a ɛyɛ den.',            hi: 'सही दूरी = मजबूत पौधे।' },
  'tasks.why.avoid_heavy_rain':  { en: 'Seedlings wash out in heavy rain.',       fr: 'Les plantules sont emportées par la forte pluie.', sw: 'Mbegu huondolewa na mvua kubwa.', ha: 'Ruwan sama mai yawa na iya wanke shuka.', tw: 'Osutɔ akɛseɛ bɛpra mfifideɛ no.',                  hi: 'भारी बारिश में अंकुर बह जाते हैं।' },
  'tasks.why.inspect_growth':    { en: 'Catch problems while still small.',       fr: 'Repérer les problèmes tôt.',              sw: 'Gundua matatizo mapema.',                ha: 'Gano matsaloli da wuri.',                tw: 'Hunu ɔhaw wɔ ɛnkɔɔ akyiri.',                       hi: 'समस्याएं जल्दी पकड़ें।' },
  'tasks.why.remove_weeds':      { en: 'Weeds steal water and nutrients.',        fr: 'Les mauvaises herbes volent l\'eau et les nutriments.', sw: 'Magugu yanaiba maji na virutubisho.', ha: 'Ciyayi suna satar ruwa da abinci.', tw: 'Nhahan bɔne gye nsuo ne aduane.',                     hi: 'खरपतवार पानी और पोषण चुराते हैं।' },
  'tasks.why.pest_check':        { en: 'Early spotting prevents losses.',         fr: 'Une détection précoce évite les pertes.', sw: 'Kugundua mapema kunazuia hasara.',       ha: 'Gano da wuri yana hana asara.',          tw: 'Sɛ wuhu ntɛm a, adehweredeɛ renyɛ kɛseɛ.',         hi: 'जल्दी पहचान नुकसान रोकती है।' },
  'tasks.why.monitor_moisture':  { en: 'Keep soil moisture steady.',              fr: 'Garder une humidité stable.',             sw: 'Dumisha unyevu wa udongo.',              ha: 'Kiyaye ɗanshin ƙasa.',                   tw: 'Ma asase no mu nsuo ntɔntɔm.',                      hi: 'मिट्टी की नमी बनाए रखें।' },
  'tasks.why.water_management_rice': { en: 'Rice needs careful water control.',    fr: 'Le riz exige un contrôle précis de l\'eau.', sw: 'Mpunga unahitaji usimamizi sahihi wa maji.', ha: 'Shinkafa na bukatar sarrafa ruwa a hankali.', tw: 'Ɛmo hwehwɛ nsuo so hwɛ pa.',                        hi: 'चावल को सावधानीपूर्वक पानी की जरूरत है।' },
  'tasks.why.weed_control':      { en: 'Keep weeds below the canopy.',            fr: 'Maintenir les mauvaises herbes basses.',  sw: 'Weka magugu chini ya zao.',              ha: 'Riƙe ciyayi ƙasa da shuka.',             tw: 'Ma nhahan bɔne nka afifideɛ no ase.',              hi: 'खरपतवार फसल से नीचे रखें।' },
  'tasks.why.prepare_harvest':   { en: 'Time harvest right for best quality.',    fr: 'Récoltez au bon moment.',                 sw: 'Vuna kwa wakati sahihi.',                ha: 'Girbe a lokacin da ya dace.',            tw: 'Twa wɔ bere pa mu.',                                hi: 'सर्वोत्तम समय पर कटाई करें।' },
  'tasks.why.protect_from_rain': { en: 'Wet harvest spoils quickly.',              fr: 'Une récolte mouillée se gâte vite.',      sw: 'Mavuno mabichi huharibika haraka.',      ha: 'Girbi da ya jiƙe ya lalata da sauri.',   tw: 'Sɛ wotwa adeɛ no fɔw a, ɛsɛe ntɛm.',               hi: 'भीगी फसल जल्दी खराब होती है।' },
  'tasks.why.store_safely':      { en: 'Dry, cool storage = long shelf life.',    fr: 'Stockage sec et frais = longue durée.',   sw: 'Hifadhi kavu na baridi = maisha marefu.', ha: 'Adana mai bushe mai sanyi = rayuwa mai tsawo.', tw: 'Faako a ɛho yɛ wɔ a na ɛyɛ fɛ ma kora.',            hi: 'सूखा, ठंडा भंडारण लंबी अवधि देता है।' },
  'tasks.why.prepare_next':      { en: 'Plan ahead for the next cycle.',          fr: 'Planifiez le prochain cycle.',            sw: 'Panga mbele kwa msimu ujao.',            ha: 'Shirya zagaye na gaba.',                 tw: 'Siesie afiri a ɛdi hɔ ho.',                         hi: 'अगले चक्र की पहले से योजना बनाएं।' },
  'tasks.why.weather_rain_soon':   { en: 'Rain expected soon.',                   fr: 'Pluie attendue bientôt.',                 sw: 'Mvua inatarajiwa hivi karibuni.',        ha: 'Ana sa ran ruwan sama nan ba da daɗewa ba.', tw: 'Osutɔ rebɛba bere tiawa mu.',                       hi: 'जल्द बारिश की संभावना।' },
  'tasks.why.weather_heavy_rain':  { en: 'Heavy rain expected — take care.',      fr: 'Forte pluie attendue — prudence.',        sw: 'Mvua kubwa inatarajiwa — kuwa mwangalifu.', ha: 'Ana sa ran ruwa mai yawa — kula.',   tw: 'Osutɔ kɛse rebɛba — yɛ asei.',                      hi: 'भारी बारिश संभावित — सावधान रहें।' },
  'tasks.why.weather_dry':         { en: 'Dry spell — watch moisture.',           fr: 'Période sèche — surveillez l\'humidité.', sw: 'Kipindi kikavu — angalia unyevu.',       ha: 'Lokacin bushewa — kula da ɗanshi.',      tw: 'Yuyu bere — hwɛ asase mu nsuo.',                    hi: 'सूखे का दौर — नमी देखें।' },
  'tasks.why.weather_severe':      { en: 'Severe weather alert — protect crops.', fr: 'Alerte météo sévère — protégez.',         sw: 'Onyo la hali mbaya ya hewa — linda mimea.', ha: 'Gargaɗin mummunan yanayi — kare amfanin gona.', tw: 'Ewiem tebea aba mu denden — bɔ w\'afudeɛ ho ban.', hi: 'गंभीर मौसम चेतावनी — फसलें बचाएं।' },

  // ═══════════════════════════════════════════════════════════
  //  TASKS PAGE — focused execution copy
  // ═══════════════════════════════════════════════════════════

  'tasks.currentTask': { en: 'Now', fr: 'Maintenant', sw: 'Sasa', ha: 'Yanzu', tw: 'Seesei' },
  'tasks.nextUp': { en: 'Next up', fr: 'Ensuite', sw: 'Kazi ifuatayo', ha: 'Na gaba', tw: 'Nea edi so' },
  'tasks.viewAll': { en: 'View all tasks', fr: 'Voir toutes les tâches', sw: 'Angalia kazi zote', ha: 'Duba duk ayyuka', tw: 'Hwɛ adwuma nyinaa' },
  'tasks.hideAll': { en: 'Hide', fr: 'Masquer', sw: 'Ficha', ha: 'Boye', tw: 'Fa sie' },
  'tasks.allCaughtUp': { en: 'All caught up!', fr: 'Tout est fait !', sw: 'Kazi zote zimekamilika!', ha: 'An gama duka!', tw: 'Wɔawie ne nyinaa!' },
  'tasks.noMoreTasks': { en: 'No more tasks for now', fr: 'Plus de tâches pour le moment', sw: 'Hakuna kazi zaidi kwa sasa', ha: 'Babu ƙarin ayyuka yanzu', tw: 'Adwuma nni hɔ mprempren' },
  'tasks.completed': { en: 'Completed', fr: 'Terminé', sw: 'Imekamilika', ha: 'An gama', tw: 'Awie' },
  'tasks.backHome': { en: 'Back to Home', fr: 'Retour', sw: 'Rudi nyumbani', ha: 'Koma gida', tw: 'San kɔ fie' },

  // ═══════════════════════════════════════════════════════════
  //  AUTOPILOT — why / risk / next / success text
  // ═══════════════════════════════════════════════════════════

  // ─── WHY lines (one sentence, practical) ──────────────────
  'why.drying.preventMold': { en: 'Dry grain now to prevent mold.', fr: 'Séchez les grains pour éviter la moisissure.', sw: 'Kausha nafaka sasa kuzuia ukungu.', ha: 'Bushe hatsi yanzu don hana naman gwari.', tw: 'Hwie aburow no awo seesei na ɛbɛbɔ nkasɛe.' },
  'why.rain.avoidDamage': { en: 'Protect harvest now before rain.', fr: 'Protégez la récolte avant la pluie.', sw: 'Linda mavuno kabla ya mvua.', ha: 'Kare girbi kafin ruwan sama.', tw: 'Bɔ wotwa adeɛ no ho ban ansa na osu atɔ.' },
  'why.rain.protectBeforeDry': { en: 'Cover harvest — rain is falling.', fr: 'Couvrez la récolte — il pleut.', sw: 'Funika mavuno — mvua inanyesha.', ha: 'Rufe girbi — ana ruwan sama.', tw: 'Kata wotwa adeɛ no so — osu retɔ.' },
  'why.water.reduceCropStress': { en: 'Water today to reduce crop stress.', fr: 'Arrosez aujourd\'hui pour réduire le stress.', sw: 'Mwagilia leo kupunguza msongo wa mimea.', ha: 'Ka ruwa yau don rage damuwa ga amfani.', tw: 'Gu nsu ɛnnɛ na ɛbɛma nnɔbae no ayɛ yie.' },
  'why.water.supportGrowth': { en: 'Water crop to support healthy growth.', fr: 'Arrosez pour une bonne croissance.', sw: 'Mwagilia kwa ukuaji bora.', ha: 'Ka ruwa don tallafin girma.', tw: 'Gu nsu ma nnɔbae no nyini yie.' },
  'why.pest.catchEarly': { en: 'Check pests early to avoid spread.', fr: 'Vérifiez les ravageurs tôt pour éviter la propagation.', sw: 'Angalia wadudu mapema kuzuia kuenea.', ha: 'Bincika kwari da wuri don hana yaduwa.', tw: 'Hwɛ mmoa a wɔsɛe nnɔbae ntɛm na wɔatrɛw.' },
  'why.spray.protectCrop': { en: 'Spray to protect your crop.', fr: 'Pulvérisez pour protéger votre culture.', sw: 'Nyunyiza kulinda mazao yako.', ha: 'Fesa don kare amfanin gonarka.', tw: 'Pete aduro so bɔ wo nnɔbae ho ban.' },
  'why.weed.reduceCompetition': { en: 'Remove weeds to reduce competition.', fr: 'Désherbez pour réduire la concurrence.', sw: 'Ondoa magugu kupunguza ushindani.', ha: 'Cire ciyawa don rage gasa.', tw: 'Yi wura no na ɛremfa nnɔbae no aduan.' },
  'why.fertilize.boostNutrients': { en: 'Fertilize now to boost nutrients.', fr: 'Fertilisez maintenant pour stimuler les nutriments.', sw: 'Weka mbolea sasa kuongeza virutubisho.', ha: 'Sa taki yanzu don ƙara abinci.', tw: 'Fa nkɔsoɔ aduro gu so seesei.' },
  'why.harvest.beforeRain': { en: 'Harvest now before rain starts.', fr: 'Récoltez avant la pluie.', sw: 'Vuna sasa kabla ya mvua.', ha: 'Girba yanzu kafin ruwan sama.', tw: 'Twa adeɛ seesei ansa na osu atɔ.' },
  'why.harvest.preserveQuality': { en: 'Harvest now to preserve quality.', fr: 'Récoltez pour préserver la qualité.', sw: 'Vuna sasa kuhifadhi ubora.', ha: 'Girba yanzu don adana inganci.', tw: 'Twa adeɛ seesei na emu papa akɔ.' },
  'why.plant.rightTiming': { en: 'Plant now for best timing.', fr: 'Plantez maintenant au bon moment.', sw: 'Panda sasa kwa wakati mzuri.', ha: 'Shuka yanzu a lokaci mai kyau.', tw: 'Dua seesei na bere pa mu.' },
  'why.landPrep.readySoil': { en: 'Prepare soil for planting.', fr: 'Préparez le sol pour la plantation.', sw: 'Andaa udongo kwa kupanda.', ha: 'Shirya ƙasa don shuka.', tw: 'Siesie asase no ma dua.' },
  'why.sort.betterPrice': { en: 'Sort produce for a better price.', fr: 'Triez pour un meilleur prix.', sw: 'Panga mazao kwa bei bora.', ha: 'Tsara kayan girbi don samun farashi mai kyau.', tw: 'Pae nneɛma no mu na woanya bo pa.' },
  'why.store.preventLoss': { en: 'Store properly to prevent loss.', fr: 'Stockez correctement pour éviter les pertes.', sw: 'Hifadhi vizuri kuzuia upotevu.', ha: 'Ajiye daidai don hana asara.', tw: 'Kora yie na biribiara anyane.' },

  // ─── RISK lines (plain language, not scary) ───────────────
  'risk.drying.spoilageIfDelayed': { en: 'Risk: harvest may spoil if left damp.', fr: 'Risque : la récolte peut pourrir si elle reste humide.', sw: 'Hatari: mavuno yanaweza kuoza yakiachwa unyevu.', ha: 'Haɗari: girbi zai iya lalacewa idan ya kasance a jike.', tw: 'Asiane: wotwa adeɛ no bɛporɔw sɛ ɛtena fũ mu.' },
  'risk.rain.uncoveredHarvest': { en: 'Risk: rain may damage uncovered grain.', fr: 'Risque : la pluie peut endommager les grains non couverts.', sw: 'Hatari: mvua inaweza kuharibu nafaka zisizofunikwa.', ha: 'Haɗari: ruwan sama zai iya lalata hatsi maras rufi.', tw: 'Asiane: osu bɛsɛe aburow a wɔnkatae so no.' },
  'risk.rain.dampHarvest': { en: 'Risk: rain will make harvest damp.', fr: 'Risque : la pluie va mouiller la récolte.', sw: 'Hatari: mvua itafanya mavuno kuwa unyevu.', ha: 'Haɗari: ruwan sama zai sa girbi ya yi jike.', tw: 'Asiane: osu bɛma wotwa adeɛ no ayɛ fũ.' },
  'risk.water.yieldDropIfDry': { en: 'Risk: yield may drop if crop stays dry.', fr: 'Risque : le rendement peut baisser si la culture reste sèche.', sw: 'Hatari: mavuno yanaweza kushuka zao likibaki kavu.', ha: 'Haɗari: amfani zai iya raguwa idan amfanin gona ya bushe.', tw: 'Asiane: nnɔbae no sua bɛte sɛ ɛtena wo mu.' },
  'risk.water.stuntedGrowth': { en: 'Risk: growth may slow without water.', fr: 'Risque : la croissance peut ralentir sans eau.', sw: 'Hatari: ukuaji unaweza kupungua bila maji.', ha: 'Haɗari: girma zai iya raguwa ba tare da ruwa ba.', tw: 'Asiane: nyini no bɛyɛ brɛoo sɛ wonnya nsu.' },
  'risk.pest.spreadFast': { en: 'Risk: pests can spread quickly.', fr: 'Risque : les ravageurs peuvent se propager rapidement.', sw: 'Hatari: wadudu wanaweza kuenea haraka.', ha: 'Haɗari: kwari na iya yaɗuwa cikin sauri.', tw: 'Asiane: mmoa a wɔsɛe nnɔbae no bɛtrɛw ntɛm.' },
  'risk.spray.driftInWind': { en: 'Risk: wind may carry spray off target.', fr: 'Risque : le vent peut emporter le produit.', sw: 'Hatari: upepo unaweza kubeba dawa.', ha: 'Haɗari: iska na iya ɗaukar maganin.', tw: 'Asiane: mframa bɛma aduro no akɔ baabi foforo.' },
  'risk.spray.damageSpread': { en: 'Risk: damage can spread without treatment.', fr: 'Risque : les dégâts peuvent s\'étendre sans traitement.', sw: 'Hatari: uharibifu unaweza kuenea bila matibabu.', ha: 'Haɗari: lalacewa na iya yaɗuwa ba tare da magani ba.', tw: 'Asiane: sɛe no bɛtrɛw sɛ wɔanhyɛ aduro.' },
  'risk.weed.yieldReduction': { en: 'Risk: weeds take nutrients from crop.', fr: 'Risque : les mauvaises herbes prennent les nutriments.', sw: 'Hatari: magugu yanachukua virutubisho vya mazao.', ha: 'Haɗari: ciyawa na ɗaukar abincin amfanin gona.', tw: 'Asiane: wura no gye nnɔbae no aduan.' },
  'risk.fertilize.poorGrowth': { en: 'Risk: poor growth without nutrients.', fr: 'Risque : mauvaise croissance sans nutriments.', sw: 'Hatari: ukuaji duni bila virutubisho.', ha: 'Haɗari: rashin girma ba tare da abinci ba.', tw: 'Asiane: ɛrennyini yie sɛ wonnya nkɔsoɔ aduro.' },
  'risk.harvest.rainDamage': { en: 'Risk: rain may damage crop in field.', fr: 'Risque : la pluie peut endommager la culture au champ.', sw: 'Hatari: mvua inaweza kuharibu mazao shambani.', ha: 'Haɗari: ruwan sama zai iya lalata amfanin gona a gona.', tw: 'Asiane: osu bɛsɛe nnɔbae a ɛwɔ afuo no so.' },
  'risk.harvest.overRipening': { en: 'Risk: crop may over-ripen if left.', fr: 'Risque : la culture peut trop mûrir.', sw: 'Hatari: mazao yanaweza kuiva kupita kiasi.', ha: 'Haɗari: amfanin gona zai iya nuna fiye da kima.', tw: 'Asiane: nnɔbae no bɛbere dodo sɛ wɔgyae.' },
  'risk.plant.missWindow': { en: 'Risk: planting window may close.', fr: 'Risque : la période de plantation peut se terminer.', sw: 'Hatari: wakati wa kupanda unaweza kupita.', ha: 'Haɗari: lokacin shuka na iya wucewa.', tw: 'Asiane: dua bere no bɛtwam.' },
  'risk.landPrep.delayedPlanting': { en: 'Risk: planting delayed if soil not ready.', fr: 'Risque : plantation retardée si le sol n\'est pas prêt.', sw: 'Hatari: kupanda kuchelewa udongo usipokuwa tayari.', ha: 'Haɗari: shuka zai yi latti idan ƙasa ba ta shirya ba.', tw: 'Asiane: dua no bɛkyɛ sɛ asase no nsiesie.' },
  'risk.sort.qualityLoss': { en: 'Risk: unsorted produce loses value.', fr: 'Risque : les produits non triés perdent de la valeur.', sw: 'Hatari: mazao yasiyopangwa yanapoteza thamani.', ha: 'Haɗari: kayan da ba a tsara ba na rasa daraja.', tw: 'Asiane: nneɛma a wɔmpae mu no bo bɛte.' },
  'risk.store.postHarvestLoss': { en: 'Risk: poor storage causes loss.', fr: 'Risque : un mauvais stockage cause des pertes.', sw: 'Hatari: uhifadhi mbaya husababisha upotevu.', ha: 'Haɗari: rashin ajiyar daidai na haifar da asara.', tw: 'Asiane: sɛ wonkora yie a wobɛhwere.' },

  // ─── Crop-specific risk patterns (Crop Intelligence Layer §5) ──
  // These messageKeys are produced by src/config/crops/cropRiskPatterns.js
  // and rendered on crop-aware risk cards in the farm dashboard.

  // Cassava
  'risk.cassava.whitefly_mosaic': { en: 'Watch for whitefly and cassava mosaic virus.', fr: 'Surveillez la mouche blanche et la mosaïque du manioc.', sw: 'Angalia inzi-weupe na ugonjwa wa mosaic wa muhogo.', ha: 'Kula da ƙudaje-farare da cutar mosaic na rogo.', tw: 'Hwɛ nwansena fitaa ne bankye yadeɛ.' },
  'risk.cassava.root_rot':        { en: 'Root rot risk — keep fields well drained.', fr: 'Risque de pourriture des racines — drainez bien le champ.', sw: 'Hatari ya kuoza kwa mizizi — hakikisha maji yanaondoka.', ha: 'Haɗarin ruɓewar saiwa — tabbatar ruwa na tafiya daga gona.', tw: 'Nhini porɔwee asiane — ma nsu nkɔ afuo no mu.' },
  'risk.cassava.leaf_yellowing':  { en: 'Leaf yellowing may signal nutrient stress.', fr: 'Le jaunissement peut signaler un manque de nutriments.', sw: 'Majani ya manjano yanaweza kuonyesha ukosefu wa virutubisho.', ha: 'Yellowar ganye na iya nuna rashin abinci.', tw: 'Ahahan kɔkɔɔ kyerɛ sɛ aduan asa.' },

  // Maize
  'risk.maize.drought_tasseling': { en: 'Drought at tasseling hits yield hardest.', fr: 'La sécheresse à la floraison affecte le plus le rendement.', sw: 'Ukame wakati wa kutoa miche huathiri mavuno zaidi.', ha: 'Fari lokacin fitar fure yana rage amfani sosai.', tw: 'Osukɔm wɔ nhwiren bere mu sɛe aba kɛse.' },
  'risk.maize.fall_armyworm':     { en: 'Scout for fall armyworm on leaves and whorl.', fr: 'Inspectez la chenille légionnaire sur les feuilles.', sw: 'Angalia funza wa maize kwenye majani.', ha: 'Duba tsutsar soja a kan ganye.', tw: 'Hwehwɛ nwansena a wɔdidi ahahan so.' },
  'risk.maize.heat_grainfill':    { en: 'Heat stress at grain fill cuts kernel weight.', fr: 'La chaleur au remplissage réduit le poids des grains.', sw: 'Joto wakati wa kujaza nafaka hupunguza uzito.', ha: 'Zafi lokacin cika hatsi na rage nauyi.', tw: 'Ahuhuro wɔ aba nhyɛso mu te aba mu.' },

  // Rice
  'risk.rice.blast':        { en: 'Rice blast risk — monitor for grey-green lesions.', fr: 'Risque de pyriculariose — surveillez les taches grises.', sw: 'Hatari ya blast — angalia madoa ya kijivu.', ha: 'Haɗarin blast — duba alamun ganye.', tw: 'Mpunga blast asiane — hwɛ ahahan ntokwa.' },
  'risk.rice.stem_borer':   { en: 'Check for stem borer — look for dead hearts.', fr: 'Inspectez le foreur de tige — cherchez les cœurs morts.', sw: 'Angalia funza wa shina — tafuta mioyo iliyokufa.', ha: 'Duba tsutsar tushe — nemo masu mutu.', tw: 'Hwehwɛ dua mu nwansena — hwɛ dua a awu.' },
  'risk.rice.water_stress': { en: 'Water stress — keep bunds sealed and refilled.', fr: 'Stress hydrique — maintenez les diguettes étanches.', sw: 'Ukosefu wa maji — funga kingo za paddy.', ha: 'Rashin ruwa — rufe dikokin paddy.', tw: 'Nsu sua — to paddy bund mu.' },

  // Tomato
  'risk.tomato.late_blight':       { en: 'Late blight risk — avoid overhead watering.', fr: 'Mildiou — évitez d\'arroser par le dessus.', sw: 'Blight ya baadaye — epuka kumwagilia kutoka juu.', ha: 'Blight daga sama — guji shayar da shi daga sama.', tw: 'Late blight asiane — mma ɛnnhyia ahahan no so.' },
  'risk.tomato.fruitworm':         { en: 'Watch fruits for worm entry holes.', fr: 'Vérifiez les trous d\'entrée sur les fruits.', sw: 'Angalia matunda kwa mashimo ya funza.', ha: 'Duba \u0257an itace don ramukan tsutsotsi.', tw: 'Hwɛ aduaba so hwɛ nwansena tokuro.' },
  'risk.tomato.blossom_end_rot':   { en: 'Uneven watering can cause blossom-end rot.', fr: 'L\'arrosage irrégulier peut causer la nécrose apicale.', sw: 'Kumwagilia kusiko sawasawa husababisha kuoza.', ha: 'Shayarwa da ba daidai ba na haifar da ruɓewa.', tw: 'Sɛ wogu nsu mpɛ mpɛ a ɛma aduaba porɔwee.' },

  // Onion
  'risk.onion.purple_blotch': { en: 'Purple blotch risk in humid conditions.', fr: 'Taches pourpres en conditions humides.', sw: 'Hatari ya madoa ya zambarau katika unyevu.', ha: 'Haɗarin tabo shunayya cikin damina.', tw: 'Kɔbene ntokwa asiane wɔ fũ bere mu.' },
  'risk.onion.wet_bulking':   { en: 'Avoid heavy watering as bulbs mature.', fr: 'Évitez l\'arrosage excessif à la bulbaison.', sw: 'Epuka maji mengi wakati wa kukomaa kwa balbu.', ha: 'Kauce yawan ruwa lokacin da bulb ya nuna.', tw: 'Mma ɛnnhyia nsu pii wɔ bulbs anyini bere mu.' },

  // Okra
  'risk.okra.shoot_fruit_borer': { en: 'Scout for shoot and fruit borer.', fr: 'Inspectez le foreur des pousses et fruits.', sw: 'Angalia funza wa matawi na matunda.', ha: 'Duba tsutsar reshe da \u0257an itace.', tw: 'Hwɛ mmran ne aduaba mu nwansena.' },
  'risk.okra.yellow_vein':       { en: 'Yellow vein mosaic — spread by whitefly.', fr: 'Mosaïque des nervures jaunes — propagée par la mouche blanche.', sw: 'Mosaic ya mishipa ya njano — huenezwa na inzi-weupe.', ha: 'Yellow vein mosaic — ta hanyar ƙudaje-farare.', tw: 'Ahahan kɔkɔɔ mmoaba yadeɛ — nwansena na ɛtrɛw.' },

  // Pepper
  'risk.pepper.anthracnose': { en: 'Anthracnose — dark sunken spots on fruit.', fr: 'Anthracnose — taches foncées sur les fruits.', sw: 'Anthracnose — madoa meusi kwenye matunda.', ha: 'Anthracnose — baƙar tabo a kan \u0257an itace.', tw: 'Anthracnose — ntokwa tuntum wɔ aduaba so.' },
  'risk.pepper.thrips':      { en: 'Check leaves for thrips damage.', fr: 'Vérifiez les dégâts de thrips sur les feuilles.', sw: 'Angalia uharibifu wa thrips kwenye majani.', ha: 'Duba lalacewar thrips a ganyayyaki.', tw: 'Hwɛ thrips sɛe wɔ ahahan so.' },

  // Potato
  'risk.potato.late_blight': { en: 'Late blight watch — inspect leaves weekly.', fr: 'Surveillance du mildiou — inspectez chaque semaine.', sw: 'Angalia blight — kagua majani kila wiki.', ha: 'Duba late blight — bincika ganye sati-sati.', tw: 'Hwehwɛ late blight — hwɛ ahahan kwasida biara.' },
  'risk.potato.aphids':      { en: 'Monitor aphids on new growth.', fr: 'Surveillez les pucerons sur les jeunes pousses.', sw: 'Fuatilia vidukari kwenye ukuaji mpya.', ha: 'Bibiyar aphid akan sabon girma.', tw: 'Hwɛ aphids wɔ foforo nhyin so.' },

  // Banana
  'risk.banana.black_sigatoka': { en: 'Black Sigatoka — remove dead leaves weekly.', fr: 'Sigatoka noire — retirez les feuilles mortes.', sw: 'Black Sigatoka — ondoa majani yaliyokufa.', ha: 'Black Sigatoka — cire matattun ganye.', tw: 'Black Sigatoka — yi ahahan a awu.' },
  'risk.banana.weevil':         { en: 'Check pseudostems for banana weevil holes.', fr: 'Vérifiez les trous de charançon sur les pseudo-troncs.', sw: 'Angalia mashimo ya mdudu kwenye shina.', ha: 'Duba ramuka a kan kututture.', tw: 'Hwɛ kwadu dua mu nwansena tokuro.' },

  // Plantain
  'risk.plantain.black_sigatoka': { en: 'Black Sigatoka — sanitise the field weekly.', fr: 'Sigatoka noire — assainissez le champ chaque semaine.', sw: 'Black Sigatoka — safisha shamba kila wiki.', ha: 'Black Sigatoka — tsaftace gona sati-sati.', tw: 'Black Sigatoka — siesie afuo no kwasida.' },
  'risk.plantain.wind':           { en: 'Fruiting plants tip over in wind — stake them.', fr: 'Les plants fructifiants tombent au vent — tuteurez-les.', sw: 'Mimea inayozaa huanguka upeponi — iunge.', ha: 'Tsire-tsire masu \u0257an itace na fa\u0257uwa cikin iska — ka tallafa.', tw: 'Aba a ɛwɔ dua so twa gu mframa mu — sɔ mu.' },

  // Cocoa
  'risk.cocoa.black_pod': { en: 'Black pod rot — remove diseased pods weekly.', fr: 'Pourriture brune — retirez les cabosses malades.', sw: 'Kuoza kwa maganda — ondoa maganda magonjwa.', ha: 'Baƙar ruɓe — cire kwasfa masu cuta.', tw: 'Kookoo porɔwee — yi abɛ a ayare.' },
  'risk.cocoa.mirids':    { en: 'Scout for capsid (mirid) damage on pods and shoots.', fr: 'Inspectez les dégâts de mirides sur cabosses et pousses.', sw: 'Angalia uharibifu wa mirids kwenye maganda.', ha: 'Duba lalacewar mirids a kan kwasfa.', tw: 'Hwehwɛ mirids sɛe wɔ abɛ so.' },

  // Mango
  'risk.mango.powdery_mildew': { en: 'Powdery mildew on flowers reduces fruit set.', fr: 'L\'oïdium sur les fleurs réduit la nouaison.', sw: 'Powdery mildew kwenye maua hupunguza matunda.', ha: 'Powdery mildew akan furen na rage \u0257an itace.', tw: 'Powdery mildew wɔ nhwiren so te aduaba so.' },
  'risk.mango.fruit_fly':      { en: 'Fruit fly — bag or trap around ripening fruit.', fr: 'Mouche des fruits — ensachez ou piégez.', sw: 'Inzi wa matunda — funika au weka mtego.', ha: 'Ƙudar \u0257an itace — ka rufe ko sa wata.', tw: 'Aduaba nwansena — katakata anaa yɛ atiridii.' },

  // Generic fallback (used when a crop has no bespoke patterns)
  'risk.generic.dry_stress':   { en: 'Dry conditions — plan irrigation windows.', fr: 'Conditions sèches — planifiez l\'arrosage.', sw: 'Hali ya ukavu — panga nyakati za umwagiliaji.', ha: 'Bushewa — tsara lokutan ban ruwa.', tw: 'Nsu sua — hyɛ nsu gu bere.' },
  'risk.generic.wet_disease':  { en: 'Wet weather raises foliar disease pressure.', fr: 'Le temps humide augmente les maladies foliaires.', sw: 'Hali ya mvua huongeza magonjwa ya majani.', ha: 'Yanayin ruwa na ƙara cututtukan ganye.', tw: 'Fũ bere ma ahahan yadeɛ.' },

  // ─── Crop Intelligence v2: photo capture UI (spec C) ───────────
  'cropPhoto.title':          { en: 'Identify your crop', fr: 'Identifier votre culture', sw: 'Tambua mazao yako', ha: 'Gane amfaninka', tw: 'Hunu wo nnɔbae' },
  'cropPhoto.sub':            { en: 'Take or upload a clear photo of a single plant or field row.', fr: 'Prenez ou téléchargez une photo nette d\'une plante ou d\'une rangée.', sw: 'Piga au pakia picha wazi ya mmea mmoja au safu.', ha: 'Dauki ko loda hoton shuka daya ko layin gona.', tw: 'Twa anaa fa mfonini pa fi dua baako anaa afuo mu nhyekyere.' },
  'cropPhoto.takePhoto':      { en: 'Take a photo', fr: 'Prendre une photo', sw: 'Piga picha', ha: 'Dauki hoto', tw: 'Twa mfonini' },
  'cropPhoto.upload':         { en: 'Upload from device', fr: 'Télécharger depuis l\'appareil', sw: 'Pakia kutoka kifaa', ha: 'Loda daga na\'ura', tw: 'Fa fi wo nsa so' },
  'cropPhoto.detecting':      { en: 'Looking at your photo…', fr: 'Analyse de la photo…', sw: 'Inaangalia picha yako…', ha: 'Ana duban hotonka…', tw: 'Rehwɛ wo mfonini…' },
  'cropPhoto.looksLike':      { en: 'Looks like:', fr: 'On dirait :', sw: 'Inaonekana kama:', ha: 'Yana kama:', tw: 'Ɛte sɛ:' },
  'cropPhoto.lowConfidence':  { en: 'Low confidence — please confirm or pick a different crop.', fr: 'Faible confiance — confirmez ou choisissez une autre culture.', sw: 'Uhakika mdogo — tafadhali thibitisha au chagua mazao mengine.', ha: 'Ƙarancin tabbaci — tabbatar ko zaɓi amfani dabam.', tw: 'Nkyinhyim sua — si so dua anaa paw nnɔbae foforɔ.' },
  'cropPhoto.confirm':        { en: 'Yes, that\u2019s my crop', fr: 'Oui, c\'est ma culture', sw: 'Ndio, hii ni mazao yangu', ha: 'Eh, wannan ne amfanina', tw: 'Aane, me nnɔbae ni' },
  'cropPhoto.pickDifferent':  { en: 'Pick a different crop', fr: 'Choisir une autre culture', sw: 'Chagua mazao mengine', ha: 'Zaɓi wani amfani', tw: 'Paw nnɔbae foforɔ' },
  'cropPhoto.retake':         { en: 'Take another photo', fr: 'Prendre une autre photo', sw: 'Piga picha nyingine', ha: 'Sake daukar hoto', tw: 'Twa mfonini foforɔ' },
  'cropPhoto.pickYours':      { en: 'Pick your crop from the list:', fr: 'Choisissez votre culture :', sw: 'Chagua mazao yako:', ha: 'Zaɓi amfaninka:', tw: 'Paw wo nnɔbae:' },
  'cropPhoto.pickInsteadOf':  { en: 'Pick your crop:', fr: 'Choisissez votre culture :', sw: 'Chagua mazao yako:', ha: 'Zaɓi amfaninka:', tw: 'Paw wo nnɔbae:' },
  'cropPhoto.err.type':       { en: 'Unsupported image type. Use JPEG, PNG, or WebP.', fr: 'Format non pris en charge. Utilisez JPEG, PNG ou WebP.', sw: 'Aina isiyoshikiliwa. Tumia JPEG, PNG, au WebP.', ha: 'Nau\'i ba a tallafawa. Yi amfani da JPEG, PNG ko WebP.', tw: 'Mfonini suban yi nyɛ yie. Fa JPEG, PNG anaa WebP.' },
  'cropPhoto.err.size':       { en: 'Image is too large (8 MB max).', fr: 'Image trop grande (8 Mo max).', sw: 'Picha kubwa sana (MB 8 upeo).', ha: 'Hoton ya fi girma (MB 8 iyaka).', tw: 'Mfonini no kɛse dodo (MB 8 nkyɛn so).' },
  'cropPhoto.err.detect':     { en: 'Could not analyse the photo. Pick your crop manually.', fr: 'Impossible d\'analyser la photo. Choisissez manuellement.', sw: 'Imeshindwa kuchambua picha. Chagua mazao kwa mkono.', ha: 'An kasa bincika hoton. Zaɓi amfaninka da hannu.', tw: 'Yɛantumi anhwɛ mfonini no. Paw nnɔbae wo nsa so.' },

  // ─── Crop Intelligence v2: yield engine extras (spec B) ────────
  'yield.isEstimate':         { en: 'Estimated range — actual yield depends on weather, inputs, and care.', fr: 'Fourchette estimée — le rendement réel dépend du temps et des soins.', sw: 'Makadirio — mavuno halisi hutegemea hali ya hewa na utunzaji.', ha: 'Ƙiyasi — amfani na gaskiya ya dogara da yanayi da kulawa.', tw: 'Akontabu — aba kann gyina ewiem ne mmɔborɔhunu so.' },
  'yield.riskFactors':        { en: 'Top risks to watch', fr: 'Principaux risques à surveiller', sw: 'Hatari kuu za kuzingatia', ha: 'Manyan haɗari da za a kula', tw: 'Asiane akɛseɛ a wobɛhwɛ' },
  'yield.recommendations':    { en: 'What to do to lift the yield', fr: 'Que faire pour améliorer le rendement', sw: 'Cha kufanya ili kuongeza mavuno', ha: 'Abin yi don ƙara amfani', tw: 'Nea wobɛyɛ ama aba aboa' },
  'yield.rec.irrigate':       { en: 'Irrigate the driest rows today — dry spells at growth stages cap yield fast.', fr: 'Arrosez les rangs les plus secs — les sécheresses plafonnent vite le rendement.', sw: 'Mwagilia safu kavu leo — ukame hupunguza mavuno haraka.', ha: 'Shayar da layin mafi bushewa yau — fari na rage amfani cikin sauri.', tw: 'Gu nsu wɔ nhyekyere a ayɛ wo mu ɛnnɛ — nsu sua te aba ntɛm.' },
  'yield.rec.shade':          { en: 'Water early morning and mulch the root zone — heat stress slices the top end.', fr: 'Arrosez tôt le matin et paillez — la chaleur réduit le haut de la fourchette.', sw: 'Mwagilia asubuhi mapema na funga mizizi — joto hupunguza mavuno.', ha: 'Shayar da safe da wuri da sa mulch — zafi na rage amfani.', tw: 'Gu nsu anɔpatutuutu na kata ntini ho — ahuhuro te aba atifi.' },
  'yield.rec.plantingDate':   { en: 'Save the planting date to sharpen the yield estimate week-over-week.', fr: 'Enregistrez la date de plantation pour affiner l\'estimation chaque semaine.', sw: 'Hifadhi tarehe ya kupanda ili kuboresha makadirio kila wiki.', ha: 'Adana ranar shuka don daidaita ƙiyasin kowane mako.', tw: 'Kora dua da no na ama akontabu no akɔ mu.' },

  // ─── Crop Intelligence v3: Your Farm Plan (decision timeline) ──
  'farmPlan.title':             { en: 'Your Farm Plan', fr: 'Votre plan de ferme', sw: 'Mpango Wako wa Shamba', ha: 'Shirin Gonar Ka', tw: 'Wo Afuo Nhyehyɛe' },
  'farmPlan.empty':             { en: 'Your farm plan will fill in as you add a crop, stage, and planting date.', fr: 'Votre plan se remplira quand vous ajouterez culture, étape et date.', sw: 'Mpango utajaa ukisajili mazao, hatua, na tarehe ya kupanda.', ha: 'Shirin zai cika lokacin da ka saka amfani, mataki, da ranar shuka.', tw: 'Wo nhyehyɛe bɛhyɛ ma sɛ wo saa nnɔbae, anammɔn, ne dua da a.' },
  'farmPlan.now':               { en: 'Now', fr: 'Maintenant', sw: 'Sasa', ha: 'Yanzu', tw: 'Seesei' },
  'farmPlan.nowSub':            { en: 'What to do today', fr: 'À faire aujourd\'hui', sw: 'Cha kufanya leo', ha: 'Abin da za a yi yau', tw: 'Nea wobɛyɛ ɛnnɛ' },
  'farmPlan.thisWeek':          { en: 'This Week', fr: 'Cette semaine', sw: 'Wiki Hii', ha: 'Wannan Mako', tw: 'Nnawɔtwe Yi' },
  'farmPlan.thisWeekSub':       { en: 'Coming up at this stage', fr: 'Prochaines actions à cette étape', sw: 'Zinakuja katika hatua hii', ha: 'Na gaba a wannan mataki', tw: 'Nea ɛreba wɔ saa anammɔn yi mu' },
  'farmPlan.comingUp':          { en: 'Coming Up', fr: 'À venir', sw: 'Inakuja', ha: 'Mai Zuwa', tw: 'Nea Ɛreba' },
  'farmPlan.comingUpSub':       { en: 'The next stage of your crop', fr: 'La prochaine étape de votre culture', sw: 'Hatua ijayo ya mazao yako', ha: 'Matakin gaba na amfaninka', tw: 'Wo nnɔbae anammɔn a ɛdi hɔ' },
  'farmPlan.riskWatch':         { en: 'Risk Watch', fr: 'Risques à surveiller', sw: 'Tahadhari za Hatari', ha: 'Kiyayye Haɗari', tw: 'Asiane a Ɛwɔ Hɔ' },
  'farmPlan.riskWatchSub':      { en: 'Watch for these in your area', fr: 'Surveillez ceci dans votre région', sw: 'Angalia haya katika eneo lako', ha: 'Kula da waɗannan a yankinka', tw: 'Hwɛ yeinom wɔ wo man mu' },
  'farmPlan.recommendations':   { en: 'What most affects your yield', fr: 'Ce qui pèse le plus sur votre rendement', sw: 'Kinachoathiri zaidi mavuno yako', ha: 'Abin da ya fi shafar amfaninka', tw: 'Nea ɛka wo aba kɛse' },
  'farmPlan.recommendationsSub':{ en: 'One or two small changes that lift the harvest', fr: 'Un ou deux gestes qui augmentent la récolte', sw: 'Mabadiliko madogo moja au mawili ya kuongeza mavuno', ha: 'Sauye-sauye ƙanana guda ɗaya ko biyu da ke ƙara girbi', tw: 'Nsesaeɛ kakra baako anaa mmienu a ɛma aba boro so' },
  'farmPlan.priorityHigh':      { en: 'Do this first', fr: 'À faire en priorité', sw: 'Fanya hili kwanza', ha: 'Yi wannan tukuna', tw: 'Yɛ yei kane', hi: 'इसे पहले करें' },
  // farmPlan.undo / farmPlan.done — referenced by FarmActionPlan
  // ActionRow chips. Previously had no entry, so tSafe(...,'') was
  // returning '' in every non-English UI (chip invisible). Filled
  // for all 6 launch languages.
  'farmPlan.undo':              { en: 'Undo',          fr: 'Annuler',             sw: 'Tendua',            ha: 'Soke',             tw: 'San yɛ',  hi: 'पूर्ववत' },
  'farmPlan.done':              { en: 'Done',          fr: 'Fait',                sw: 'Imekamilika',       ha: 'An gama',          tw: 'Awie',    hi: 'हो गया' },
  'farmPlan.why':               { en: 'Why this plan?', fr: 'Pourquoi ce plan ?', sw: 'Kwa nini mpango huu?', ha: 'Me ya sa wannan shiri?', tw: 'Deɛn nti saa nhyehyɛe yi?' },
  'farmPlan.conf.high':         { en: 'High confidence', fr: 'Confiance élevée', sw: 'Uhakika mkubwa', ha: 'Babban tabbaci', tw: 'Nkyinhyim kɛse' },
  'farmPlan.conf.medium':       { en: 'Medium confidence', fr: 'Confiance moyenne', sw: 'Uhakika wa wastani', ha: 'Matsakaicin tabbaci', tw: 'Nkyinhyim ntam' },
  'farmPlan.conf.low':          { en: 'Low confidence', fr: 'Faible confiance', sw: 'Uhakika mdogo', ha: 'Ƙarancin tabbaci', tw: 'Nkyinhyim sua' },

  // ─── Marketplace v1 ───────────────────────────────────────────
  'marketplace.browse.title':    { en: 'Available crops', fr: 'Cultures disponibles', sw: 'Mazao yanayopatikana', ha: 'Amfanin da ake da shi', tw: 'Nnɔbae a ɛwɔ hɔ' },
  'marketplace.list.title':      { en: 'Mark crop ready for sale', fr: 'Déclarer la culture prête à la vente', sw: 'Weka mazao kuwa tayari kuuza', ha: 'Sa amfani a shirye don sayarwa', tw: 'Kyerɛ sɛ nnɔbae asi sɛ wɔbɛtɔn' },
  'marketplace.submit':          { en: 'Mark ready for sale', fr: 'Déclarer prêt à la vente', sw: 'Weka tayari kuuza', ha: 'Sa a shirye', tw: 'Kyerɛ sɛ asi' },
  'marketplace.saving':          { en: 'Saving…', fr: 'Enregistrement…', sw: 'Inahifadhi…', ha: 'Ana adanawa…', tw: 'Rekora…' },
  'marketplace.created':         { en: 'Your listing is live — buyers can now find it.', fr: 'Votre annonce est publiée — les acheteurs peuvent la voir.', sw: 'Orodha yako imewekwa — wanunuzi wanaweza kuipata.', ha: 'An saka bayananka — masu siye za su same su.', tw: 'Wo nkrataa no akɔ so — atɔfoɔ bɛhunu.' },
  'marketplace.request':         { en: 'Request', fr: 'Demander', sw: 'Omba', ha: 'Nema', tw: 'Bisa' },
  'marketplace.requesting':      { en: 'Requesting…', fr: 'Envoi…', sw: 'Inaomba…', ha: 'Ana nema…', tw: 'Rebisa…' },
  'marketplace.loading':         { en: 'Loading listings…', fr: 'Chargement…', sw: 'Inapakia…', ha: 'Ana lodawa…', tw: 'Reload…' },
  'marketplace.empty':           { en: 'No active listings matching your filters yet.', fr: 'Aucune annonce active ne correspond aux filtres.', sw: 'Hakuna orodha hai inayolingana.', ha: 'Babu bayanan da suka dace.', tw: 'Nnɔbae biara nni hɔ a ɛne wo nhwehwɛmu yi hyia.' },
  'marketplace.filter.cropPlaceholder':   { en: 'Filter by crop', fr: 'Filtrer par culture', sw: 'Chuja kwa mazao', ha: 'Tace ta amfani', tw: 'Yiyi nnɔbae' },
  'marketplace.filter.regionPlaceholder': { en: 'Filter by region', fr: 'Filtrer par région', sw: 'Chuja kwa eneo', ha: 'Tace ta yanki', tw: 'Yiyi man' },
  'marketplace.field.crop':     { en: 'Crop', fr: 'Culture', sw: 'Mazao', ha: 'Amfani', tw: 'Nnɔbae' },
  'marketplace.field.quantity': { en: 'Quantity (kg)', fr: 'Quantité (kg)', sw: 'Kiasi (kg)', ha: 'Yawa (kg)', tw: 'Dodoɔ (kg)' },
  'marketplace.field.price':    { en: 'Price per kg (optional)', fr: 'Prix par kg (optionnel)', sw: 'Bei kwa kg (si lazima)', ha: 'Farashi kowace kg (zaɓi)', tw: 'Bo wɔ kg biara ho (ɛnyɛ dɛ)' },
  'marketplace.field.region':   { en: 'Region', fr: 'Région', sw: 'Eneo', ha: 'Yanki', tw: 'Man' },
  'marketplace.field.location': { en: 'Location', fr: 'Localisation', sw: 'Mahali', ha: 'Wuri', tw: 'Baabi' },
  'marketplace.err.generic':          { en: 'Something went wrong. Try again.', fr: 'Une erreur est survenue.', sw: 'Kuna tatizo. Jaribu tena.', ha: 'Akwai matsala. Sake gwadawa.', tw: 'Biribi anyɛ yie. Sɔ bio.' },
  'marketplace.err.missing_crop':     { en: 'Please enter the crop.', fr: 'Veuillez saisir la culture.', sw: 'Tafadhali weka mazao.', ha: 'Da fatan shigar da amfani.', tw: 'Yɛsrɛ sɛ ka nnɔbae.' },
  'marketplace.err.invalid_quantity': { en: 'Quantity must be a positive number.', fr: 'La quantité doit être un nombre positif.', sw: 'Kiasi lazima kiwe nambari chanya.', ha: 'Yawa ya zama lamba tabbatacce.', tw: 'Dodoɔ ɛsɛ sɛ ɛyɛ nɔma a ɛsɔre.' },
  'marketplace.err.invalid_price':    { en: 'Price must be a non-negative number.', fr: 'Le prix doit être positif.', sw: 'Bei lazima iwe namba chanya.', ha: 'Farashi ya zama lamba tabbatacce.', tw: 'Bo ɛsɛ sɛ ɛyɛ nɔma a ɛnyɛ ɔgyenkontoɔ.' },
  'marketplace.err.not_available':    { en: 'This listing is no longer available.', fr: 'Cette annonce n\'est plus disponible.', sw: 'Orodha hii haipatikani tena.', ha: 'Wannan bayani ba ya nan yanzu.', tw: 'Nkrataa yi nni hɔ bio.' },
  'marketplace.err.listing_not_found':{ en: 'Listing not found.', fr: 'Annonce introuvable.', sw: 'Orodha haikupatikana.', ha: 'Ba a sami bayani ba.', tw: 'Wɔanhu nkrataa no.' },
  'marketplace.err.request_failed':   { en: 'Could not send the request. Try again.', fr: 'Impossible d\'envoyer la demande.', sw: 'Ombi halikufaulu. Jaribu tena.', ha: 'Ba a iya aikawa ba. Sake gwadawa.', tw: 'Wɔantumi anto abisadeɛ. Sɔ bio.' },
  'marketplace.err.load_failed':      { en: 'Could not load listings.', fr: 'Impossible de charger.', sw: 'Imeshindwa kupakia.', ha: 'Ba a iya lodawa ba.', tw: 'Yɛantumi anload.' },
  'marketplace.err.create_failed':    { en: 'Could not create the listing.', fr: 'Impossible de créer l\'annonce.', sw: 'Imeshindwa kuunda orodha.', ha: 'Ba a iya ƙirƙiri ba.', tw: 'Yɛantumi anyɛ nkrataa no.' },
  'marketplace.err.action_failed':    { en: 'Could not update. Try again.', fr: 'Impossible de mettre à jour.', sw: 'Imeshindwa kusasisha.', ha: 'Ba a iya sabuntawa ba.', tw: 'Yɛantumi ansesa.' },
  'marketplace.err.missing_farmer_id':{ en: 'Sign in as a farmer to see requests.', fr: 'Connectez-vous comme agriculteur.', sw: 'Ingia kama mkulima kuona maombi.', ha: 'Shigar da manomi don ganin buƙatu.', tw: 'Kɔ mu sɛ okuafoɔ na w\u2019ahunu.' },
  // Incoming requests inbox (farmer)
  'marketplace.inbox.title':          { en: 'Buyer requests', fr: 'Demandes des acheteurs', sw: 'Maombi ya wanunuzi', ha: 'Buƙatun masu siye', tw: 'Atɔfoɔ abisadeɛ' },
  'marketplace.inbox.empty':          { en: 'No buyer requests yet. Your active listings are visible to buyers.', fr: 'Aucune demande pour le moment. Vos annonces sont visibles.', sw: 'Hakuna maombi bado. Orodha zako zinaonekana.', ha: 'Babu buƙatu tukuna. Bayananka suna bayyana.', tw: 'Abisadeɛ biara nni hɔ.' },
  'marketplace.inbox.from':           { en: 'From', fr: 'De', sw: 'Kutoka', ha: 'Daga', tw: 'Fi' },
  'marketplace.inbox.fromAnonymous':  { en: 'From a buyer', fr: 'D\'un acheteur', sw: 'Kutoka kwa mnunuzi', ha: 'Daga mai siye', tw: 'Fi ɔtɔni bi' },
  'marketplace.inbox.moreCount':      { en: '+{{n}} more — open full list to see all', fr: '+{{n}} de plus', sw: '+{{n}} zaidi', ha: '+{{n}} ƙari', tw: '+{{n}} bebree' },
  // Buyer "my requests"
  'marketplace.myRequests.title':     { en: 'My requests', fr: 'Mes demandes', sw: 'Maombi yangu', ha: 'Buƙatuna', tw: 'M\u2019abisadeɛ' },
  'marketplace.myRequests.empty':     { en: 'No requests yet. Browse available crops and tap Request to connect with a farmer.', fr: 'Aucune demande. Parcourez et appuyez sur Demander.', sw: 'Hakuna maombi bado. Vinjari mazao na gonga Omba.', ha: 'Babu buƙatu. Bincika amfani da danna Nema.', tw: 'Abisadeɛ biara nni hɔ.' },
  // Action verbs + status labels
  'marketplace.accept':               { en: 'Accept', fr: 'Accepter', sw: 'Kubali', ha: 'Karɓa', tw: 'Gye to mu' },
  'marketplace.decline':              { en: 'Decline', fr: 'Refuser', sw: 'Kataa', ha: 'Ki', tw: 'Nnyae' },
  'marketplace.working':              { en: 'Working…', fr: 'En cours…', sw: 'Inafanya…', ha: 'Ana aiki…', tw: 'Reyɛ…' },
  'marketplace.more':                 { en: 'more', fr: 'autres', sw: 'zaidi', ha: 'ƙari', tw: 'bebree' },
  'marketplace.status.pending':       { en: 'Pending', fr: 'En attente', sw: 'Inasubiri', ha: 'Jiran', tw: 'Retwɛn' },
  'marketplace.status.accepted':      { en: 'Accepted', fr: 'Acceptée', sw: 'Imekubaliwa', ha: 'An karɓi', tw: 'Wɔagye' },
  'marketplace.status.declined':      { en: 'Declined', fr: 'Refusée', sw: 'Imekataliwa', ha: 'An ƙi', tw: 'Wɔannyae' },

  // ─── Smart Alerts (Crop Intelligence v4) ──────────────────────
  'alerts.title':                   { en: 'Smart alerts', fr: 'Alertes intelligentes', sw: 'Arifa mahiri', ha: 'Faɗakarwa ta gaggauta', tw: 'Kɔkɔbɔ pa' },
  'alerts.empty':                   { en: 'No alerts right now. We\u2019ll ping you when something needs action.', fr: 'Aucune alerte. Nous vous préviendrons si nécessaire.', sw: 'Hakuna arifa sasa. Tutakujulisha ikibidi.', ha: 'Babu faɗakarwa yanzu. Za mu gaya maka idan akwai bukata.', tw: 'Kɔkɔbɔ biara nni hɔ seesei.' },
  'alerts.showWhy':                 { en: 'Why this?', fr: 'Pourquoi ?', sw: 'Kwa nini?', ha: 'Me ya sa?', tw: 'Deɛn nti?' },
  'alerts.hideWhy':                 { en: 'Hide details', fr: 'Masquer', sw: 'Ficha', ha: 'Boye', tw: 'Fa ho' },
  'alerts.reason':                  { en: 'Reason', fr: 'Raison', sw: 'Sababu', ha: 'Dalili', tw: 'Nea enti' },
  'alerts.consequence':             { en: 'If ignored', fr: 'Si ignoré', sw: 'Kama ikipuuzwa', ha: 'Idan aka watsar', tw: 'Sɛ wogyae' },
  'alerts.dismiss':                 { en: 'Dismiss', fr: 'Ignorer', sw: 'Futa', ha: 'Soke', tw: 'Yi fi hɔ' },
  'alerts.moreAlerts':              { en: 'more alerts', fr: 'alertes de plus', sw: 'arifa zaidi', ha: 'ƙarin faɗakarwa', tw: 'kɔkɔbɔ bebree' },

  // Specific alert bodies (i18n fallbacks — engine copy wins when
  // the key isn't registered in the active language)
  'alerts.weather.delay_fertilizer':{ en: 'Delay fertilizer application until after the rain.', fr: 'Reporter l\'application d\'engrais après la pluie.', sw: 'Ahirisha mbolea hadi baada ya mvua.', ha: 'Jinkirta takin har ruwa ya tsaya.', tw: 'Twɛn sɛ osu ntɔ ansa na woato aduro.' },
  'alerts.weather.irrigate':        { en: 'Irrigate the driest rows today.', fr: 'Arrosez les rangs les plus secs.', sw: 'Mwagilia safu zilizo kavu leo.', ha: 'Shayar da layukan da suka fi bushewa yau.', tw: 'Gu nsu wɔ nhyekyere a ayɛ wo mu.' },
  'alerts.weather.heat_morning':    { en: 'Water early morning and mulch the root zone.', fr: 'Arrosez tôt et paillez.', sw: 'Mwagilia asubuhi na funga mizizi.', ha: 'Shayar da safe da wuri da sa mulch.', tw: 'Gu nsu anɔpatutuutu na kata ntini ho.' },
  'alerts.task.missed_critical':    { en: 'Top task still pending — it\u2019s flagged high priority for a reason.', fr: 'Tâche prioritaire encore en attente.', sw: 'Kazi muhimu bado haijakamilika.', ha: 'Babban aiki har yanzu baka yi ba.', tw: 'Adwuma titire wo so.' },
  'alerts.planting.window_closing': { en: 'Plant now or shift to a shorter-cycle variety.', fr: 'Plantez maintenant ou choisissez une variété plus courte.', sw: 'Panda sasa au chagua aina ya muda mfupi.', ha: 'Shuka yanzu ko zaɓi iri-iri mai gajeren lokaci.', tw: 'Dua seesei anaa paw suban a ɛfa bere tiaa.' },
  'alerts.yield.weather_drag':      { en: 'Protect the crop — current weather is trimming yield.', fr: 'Protégez la culture — la météo rogne le rendement.', sw: 'Linda mazao — hali ya hewa inapunguza mavuno.', ha: 'Kare amfanin gona — yanayi yana rage amfani.', tw: 'Bɔ nnɔbae no ho ban — ewiem te aba so.' },
  'alerts.stage.transition':        { en: 'Next growth stage is coming — prepare this week.', fr: 'Prochaine étape bientôt — préparez-vous.', sw: 'Hatua ijayo inakuja — jiandae.', ha: 'Matakin gaba yana zuwa — ka shirya.', tw: 'Anammɔn a ɛdi hɔ reba — siesie wo ho.' },

  // ─── Farroway Score (Crop Intelligence v5) ────────────────────
  'score.title':             { en: 'Farroway Score', fr: 'Score Farroway', sw: 'Alama ya Farroway', ha: 'Matsayi na Farroway', tw: 'Farroway Nkyerɛwdeɛ' },
  'score.sub':               { en: 'How well you\u2019re managing this farm today', fr: 'Comment vous gérez votre ferme aujourd\u2019hui', sw: 'Jinsi unavyosimamia shamba hili leo', ha: 'Yadda kake sarrafa gonar ka yau', tw: 'Sɛdeɛ woredi wo afuo yi ho dwuma ɛnnɛ' },
  'score.suggestions':       { en: 'How to lift your score', fr: 'Comment améliorer votre score', sw: 'Jinsi ya kuboresha alama yako', ha: 'Yadda za ka ƙara matsayinka', tw: 'Sɛdeɛ wobɛma wo nkyerɛwdeɛ akɔ soro' },
  'score.why':               { en: 'Why this score?', fr: 'Pourquoi ce score ?', sw: 'Kwa nini alama hii?', ha: 'Me ya sa wannan matsayi?', tw: 'Deɛn nti saa nkyerɛwdeɛ yi?' },
  // Bands
  'score.band.excellent':    { en: 'Excellent', fr: 'Excellent', sw: 'Bora kabisa', ha: 'Mai kyau sosai', tw: 'Pa ara' },
  'score.band.strong':       { en: 'Strong', fr: 'Bon', sw: 'Imara', ha: 'Karfi', tw: 'Den' },
  'score.band.improving':    { en: 'Improving', fr: 'En progrès', sw: 'Inaboresha', ha: 'Tana haɓaka', tw: 'Ɛreyɛ yie' },
  'score.band.needs_help':   { en: 'Needs help', fr: 'Besoin d\u2019aide', sw: 'Inahitaji msaada', ha: 'Yana buƙatar taimako', tw: 'Ɛhia mmoa' },
  // Confidence
  'score.conf.high':         { en: 'High confidence', fr: 'Confiance élevée', sw: 'Uhakika mkubwa', ha: 'Babban tabbaci', tw: 'Nkyinhyim kɛse' },
  'score.conf.medium':       { en: 'Medium confidence', fr: 'Confiance moyenne', sw: 'Uhakika wa wastani', ha: 'Matsakaicin tabbaci', tw: 'Nkyinhyim ntam' },
  'score.conf.low':          { en: 'Low confidence', fr: 'Faible confiance', sw: 'Uhakika mdogo', ha: 'Ƙarancin tabbaci', tw: 'Nkyinhyim sua' },
  // Trend
  'score.trend.up':          { en: 'Improving', fr: 'En hausse', sw: 'Inaboresha', ha: 'Tana hauhawa', tw: 'Ɛrekɔ soro' },
  'score.trend.down':        { en: 'Slipping', fr: 'En baisse', sw: 'Inashuka', ha: 'Tana faɗuwa', tw: 'Ɛrete' },
  'score.trend.flat':        { en: 'Steady', fr: 'Stable', sw: 'Imara', ha: 'A tsaye', tw: 'Hyɛ mu' },
  // Category names
  'score.cat.execution':     { en: 'Execution', fr: 'Exécution', sw: 'Utekelezaji', ha: 'Aiwatarwa', tw: 'Nneyɛe' },
  'score.cat.timing':        { en: 'Timing', fr: 'Ponctualité', sw: 'Wakati', ha: 'Lokaci', tw: 'Bere' },
  'score.cat.riskMgmt':      { en: 'Risk Management', fr: 'Gestion des risques', sw: 'Usimamizi wa Hatari', ha: 'Sarrafa Haɗari', tw: 'Asiane Dwumadie' },
  'score.cat.cropFit':       { en: 'Crop Fit', fr: 'Adéquation culture', sw: 'Mazao Yanafaa', ha: 'Dacewar Amfani', tw: 'Nnɔbae Fata' },
  'score.cat.yieldAlign':    { en: 'Yield Alignment', fr: 'Alignement rendement', sw: 'Mlinganisho wa Mavuno', ha: 'Daidaita Amfani', tw: 'Aba Nhyehyɛe' },
  // Suggestions
  'score.suggestion.execution': { en: 'Mark today\u2019s top task done as soon as you finish it.', fr: 'Marquez la tâche principale terminée dès qu\u2019elle est finie.', sw: 'Weka kazi kuu ya leo kama imekamilika mara tu unapomaliza.', ha: 'Nuna an kammala babban aikin yau nan da nan.', tw: 'Kyerɛ sɛ woawie ɛnnɛ adwuma titire ntɛm.' },
  'score.suggestion.timing':    { en: 'Tackle the high-priority task first, not last.', fr: 'Faites d\u2019abord la tâche prioritaire.', sw: 'Anza kwa kazi ya kipaumbele cha juu.', ha: 'Fara da aiki mafi muhimmanci.', tw: 'Yɛ adwuma titire no kane.' },
  'score.suggestion.riskMgmt':  { en: 'Act on the top Smart Alert for your crop today.', fr: 'Agissez sur l\u2019alerte principale aujourd\u2019hui.', sw: 'Chukua hatua kuhusu arifa kuu leo.', ha: 'Ɗauki mataki kan babban faɗakarwa yau.', tw: 'Yɛ ɛnnɛ kɔkɔbɔ kɛseɛ no ho biribi.' },
  'score.suggestion.cropFit':   { en: 'Next season, consider a higher-fit crop for your region.', fr: 'La saison prochaine, envisagez une culture plus adaptée.', sw: 'Msimu ujao, fikiria mazao yanayofaa zaidi.', ha: 'Damina mai zuwa, tuna amfani da ya fi dacewa.', tw: 'Bere a ɛreba no, dwene nnɔbae a ɛfata wo man.' },
  'score.suggestion.yieldAlign':{ en: 'Save your planting date + keep the stage current.', fr: 'Enregistrez la date de plantation et tenez l\u2019étape à jour.', sw: 'Hifadhi tarehe ya kupanda na sasisha hatua.', ha: 'Adana ranar shuka kuma sabunta mataki.', tw: 'Kora dua da no na ma anammɔn no nkɔ so.' },

  // ─── Price Intelligence (Crop Intelligence v6) ─────────────────
  'priceInsight.title':              { en: 'Price trends in your region', fr: 'Tendances des prix dans votre région', sw: 'Mwelekeo wa bei katika eneo lako', ha: 'Yanayin farashi a yankinka', tw: 'Bo no nkɔso wɔ wo man mu' },
  'priceInsight.window30':           { en: 'Last 30 days', fr: '30 derniers jours', sw: 'Siku 30 zilizopita', ha: 'Kwanaki 30 da suka wuce', tw: 'Nna 30 a atwam' },
  'priceInsight.loading':            { en: 'Loading prices…', fr: 'Chargement des prix…', sw: 'Inapakia bei…', ha: 'Ana lodin farashi…', tw: 'Rehwɛ abɔdeɛ no bo…' },
  'priceInsight.empty':              { en: 'Market prices aren\u2019t available yet for your crops.', fr: 'Les prix du marché ne sont pas encore disponibles.', sw: 'Bei za soko bado hazipatikani kwa mazao yako.', ha: 'Farashin kasuwa bai samu ba tukuna.', tw: 'Ɛdwa mu bo nni hɔ tukuna.' },
  'priceInsight.suggestedShort':     { en: 'Market range', fr: 'Fourchette marché', sw: 'Kipengele cha soko', ha: 'Iyakar kasuwa', tw: 'Ɛdwa bo mu' },
  'priceInsight.listings':           { en: 'listings', fr: 'annonces', sw: 'orodha', ha: 'bayanai', tw: 'nkrataa' },
  'priceInsight.yourCrop':           { en: 'Your crop', fr: 'Votre culture', sw: 'Mazao yako', ha: 'Amfaninka', tw: 'Wo nnɔbae' },

  // Scope (data source)
  'priceInsight.scope.local':        { en: 'Your region', fr: 'Votre région', sw: 'Eneo lako', ha: 'Yankinka', tw: 'Wo man' },
  'priceInsight.scope.country':      { en: 'Country average', fr: 'Moyenne nationale', sw: 'Wastani wa nchi', ha: 'Matsakaicin ƙasa', tw: 'Man mu akontaabuo' },
  'priceInsight.scope.global':       { en: 'Global benchmark', fr: 'Référence globale', sw: 'Kigezo cha kimataifa', ha: 'Ma\u2019aunin duniya', tw: 'Wiase no nyinaa nhyehyɛe' },
  'priceInsight.scope.fallback':     { en: 'Generic estimate', fr: 'Estimation générique', sw: 'Makadirio ya jumla', ha: 'Ƙiyasi na gama gari', tw: 'Akontabu bi' },

  // Trend labels
  'priceInsight.trend.up':           { en: 'Up this week', fr: 'En hausse cette semaine', sw: 'Juu wiki hii', ha: 'Saman a wannan mako', tw: 'Ɛkɔ soro nnawɔtwe yi' },
  'priceInsight.trend.down':         { en: 'Down this week', fr: 'En baisse cette semaine', sw: 'Chini wiki hii', ha: 'Ƙasa a wannan mako', tw: 'Ɛsi fam nnawɔtwe yi' },
  'priceInsight.trend.stable':       { en: 'Steady this week', fr: 'Stable cette semaine', sw: 'Imara wiki hii', ha: 'A tsaye wannan mako', tw: 'Hyɛ mu nnawɔtwe yi' },

  // Confidence labels
  'priceInsight.conf.high':          { en: 'High confidence', fr: 'Confiance élevée', sw: 'Uhakika mkubwa', ha: 'Babban tabbaci', tw: 'Nkyinhyim kɛse' },
  'priceInsight.conf.medium':        { en: 'Medium', fr: 'Moyen', sw: 'Wastani', ha: 'Matsakaici', tw: 'Ntam' },
  'priceInsight.conf.low':           { en: 'Low', fr: 'Faible', sw: 'Mdogo', ha: 'Ƙaramin', tw: 'Sua' },

  // ─── Bulk lots (marketplace aggregation) ──────────────────────
  'bulk.title':               { en: 'Bulk lots near you', fr: 'Lots groupés près de chez vous', sw: 'Mikupuo ya pamoja karibu nawe', ha: 'Bulk lots kusa da kai', tw: 'Bulk lot a ɛbɛn wo' },
  'bulk.loading':             { en: 'Finding bulk lots\u2026', fr: 'Recherche des lots\u2026', sw: 'Inatafuta mikupuo\u2026', ha: 'Ana neman bulk lots\u2026', tw: 'Rehwehwɛ bulk lot\u2026' },
  'bulk.empty':               { en: 'No bulk lots right now \u2014 farmers still need to post individual listings for aggregation to kick in.', fr: 'Aucun lot groupé pour le moment.', sw: 'Hakuna mikupuo ya pamoja sasa.', ha: 'Babu bulk lots yanzu.', tw: 'Bulk lot biara nni hɔ seesei.' },
  'bulk.filter.crop':         { en: 'Filter by crop', fr: 'Filtrer par culture', sw: 'Chuja kwa mazao', ha: 'Tace ta amfani', tw: 'Yiyi nnɔbae' },
  'bulk.filter.region':       { en: 'Filter by region', fr: 'Filtrer par région', sw: 'Chuja kwa eneo', ha: 'Tace ta yanki', tw: 'Yiyi man' },
  'bulk.contributors':        { en: 'farmers', fr: 'agriculteurs', sw: 'wakulima', ha: 'manoma', tw: 'akuafoɔ' },
  'bulk.pickup':              { en: 'Pickup', fr: 'Collecte', sw: 'Ukusanyaji', ha: 'Ɗauka', tw: 'Kɔfa' },
  'bulk.request':             { en: 'Request lot', fr: 'Demander le lot', sw: 'Omba mkupuo', ha: 'Nema bulk lot', tw: 'Bisa lot' },
  'bulk.requesting':          { en: 'Requesting\u2026', fr: 'Demande en cours\u2026', sw: 'Inaomba\u2026', ha: 'Ana nema\u2026', tw: 'Rebisa\u2026' },
  'bulk.err.generic':         { en: 'Something went wrong. Try again.', fr: 'Une erreur est survenue.', sw: 'Kuna tatizo. Jaribu tena.', ha: 'Akwai matsala.', tw: 'Biribi anyɛ yie.' },
  'bulk.err.lot_not_found':   { en: 'This lot is no longer available.', fr: 'Ce lot n\u2019est plus disponible.', sw: 'Mkupuo huu haipatikani tena.', ha: 'Wannan lot ba ya nan yanzu.', tw: 'Saa lot yi nni hɔ bio.' },
  'bulk.err.load_failed':     { en: 'Could not load bulk lots.', fr: 'Impossible de charger les lots.', sw: 'Imeshindwa kupakia.', ha: 'Ba a iya lodawa ba.', tw: 'Yɛantumi anload.' },
  'bulk.err.request_failed':  { en: 'Could not send the request. Try again.', fr: 'Impossible d\u2019envoyer la demande.', sw: 'Ombi halikufaulu.', ha: 'Ba a iya aikawa ba.', tw: 'Wɔantumi anto.' },

  // Farmer inbox — bulk context
  'marketplace.inbox.bulkPill':     { en: 'Bulk lot', fr: 'Lot groupé', sw: 'Mkupuo', ha: 'Bulk', tw: 'Bulk lot' },
  'marketplace.inbox.bulkShare':    { en: 'Your share', fr: 'Votre part', sw: 'Fungu lako', ha: 'Rabonka', tw: 'Wo kyɛfa' },
  'marketplace.inbox.bulkOf':       { en: 'across', fr: 'sur', sw: 'katika', ha: 'tsakanin', tw: 'wɔ' },
  'marketplace.inbox.bulkFarmers':  { en: 'farmers', fr: 'agriculteurs', sw: 'wakulima', ha: 'manoma', tw: 'akuafoɔ' },
  'marketplace.inbox.pickupAt':     { en: 'Pickup at', fr: 'Collecte à', sw: 'Chukua kutoka', ha: 'Ɗauka a', tw: 'Fa fi' },
  // Bulk v2 — pickup point input + buyer rollup
  'bulk.pickupPointLabel':         { en: 'Pickup point (where should farmers meet you?)', fr: 'Point de collecte (où les agriculteurs vous rencontrent)', sw: 'Mahali pa kuchukulia (wapi wakulima wakutane nawe?)', ha: 'Wurin ɗauka (ina manoma za su sadu da kai?)', tw: 'Fa baabi (ɛhe na akuafoɔ behyia wo?)' },
  'bulk.pickupPointPlaceholder':   { en: 'Enter a market, depot, or meeting point', fr: 'Entrez un marché ou point de rencontre', sw: 'Ingiza soko au mahali pa kukutana', ha: 'Shigar kasuwa ko wurin haɗuwa', tw: 'Kyerɛ ɛdwa anaa nhyiamu baabi' },
  'bulk.confirmRequest':           { en: 'Send request', fr: 'Envoyer la demande', sw: 'Tuma ombi', ha: 'Aika buƙata', tw: 'Soma abisadeɛ' },
  'bulk.myRequest.acceptedOf':     { en: 'farmers accepted', fr: 'agriculteurs acceptés', sw: 'wakulima wamekubali', ha: 'manoma sun karɓa', tw: 'akuafoɔ agye to mu' },
  'bulk.myRequest.declined':       { en: 'declined', fr: 'refusé', sw: 'walikataa', ha: 'sun ki', tw: 'annyae' },
  'bulk.myRequest.pending':        { en: 'still deciding', fr: 'en attente', sw: 'bado wanaamua', ha: 'har yanzu ba a yanke ba', tw: 'reyɛ adwene' },
  'common.cancel':                 { en: 'Cancel', fr: 'Annuler', sw: 'Ghairi', ha: 'Soke', tw: 'Gyae' },
  'common.back':                   { en: 'Back', fr: 'Retour', sw: 'Rudi', ha: 'Baya', tw: 'San kɔ akyi' },

  // ─── Organization Dashboard ───────────────────────────────────
  'orgDashboard.title':             { en: 'Organization dashboard', fr: 'Tableau de bord', sw: 'Dashibodi ya shirika', ha: 'Dashboard na ƙungiya', tw: 'Ahyehyɛdeɛ dashboard' },
  'orgDashboard.loading':           { en: 'Loading dashboard\u2026', fr: 'Chargement\u2026', sw: 'Inapakia\u2026', ha: 'Ana lodawa\u2026', tw: 'Rehwehwɛ\u2026' },
  'orgDashboard.loadingFarmers':    { en: 'Loading farmers\u2026', fr: 'Chargement des agriculteurs\u2026', sw: 'Inapakia wakulima\u2026', ha: 'Ana lodin manoma\u2026', tw: 'Rehwehwɛ akuafoɔ\u2026' },
  'orgDashboard.error':             { en: 'Could not load the dashboard. You might not have access to this organization.', fr: 'Impossible de charger.', sw: 'Imeshindwa kupakia.', ha: 'Ba a iya lodawa ba.', tw: 'Yɛantumi anload.' },
  'orgDashboard.noFarmers':         { en: 'No farmers match these filters.', fr: 'Aucun agriculteur ne correspond aux filtres.', sw: 'Hakuna wakulima.', ha: 'Babu manoma.', tw: 'Akuafoɔ biara nni hɔ.' },
  'orgDashboard.exportDashboard':   { en: 'Export summary', fr: 'Exporter résumé', sw: 'Hamisha muhtasari', ha: 'Fitar da taƙaitawa', tw: 'Yi summary no fi' },
  'orgDashboard.exportFarmers':     { en: 'Export farmers', fr: 'Exporter agriculteurs', sw: 'Hamisha wakulima', ha: 'Fitar da manoma', tw: 'Yi akuafoɔ no fi' },

  'orgDashboard.window.7':          { en: 'Last 7 days', fr: '7 derniers jours', sw: 'Siku 7', ha: 'Kwanaki 7', tw: 'Nna 7' },
  'orgDashboard.window.30':         { en: 'Last 30 days', fr: '30 derniers jours', sw: 'Siku 30', ha: 'Kwanaki 30', tw: 'Nna 30' },
  'orgDashboard.window.90':         { en: 'Last 90 days', fr: '90 derniers jours', sw: 'Siku 90', ha: 'Kwanaki 90', tw: 'Nna 90' },

  'orgDashboard.tile.total':        { en: 'Total farmers', fr: 'Agriculteurs totaux', sw: 'Wakulima jumla', ha: 'Jimillar manoma', tw: 'Akuafoɔ nyinaa' },
  'orgDashboard.tile.active':       { en: 'Active', fr: 'Actifs', sw: 'Wanafanya kazi', ha: 'Masu aiki', tw: 'Wɔreyɛ adwuma' },
  'orgDashboard.tile.inactive':     { en: 'Inactive', fr: 'Inactifs', sw: 'Hawafanyi kazi', ha: 'Ba sa aiki', tw: 'Wɔnnyɛ adwuma' },
  'orgDashboard.tile.avgScore':     { en: 'Avg Farroway Score', fr: 'Score Farroway moyen', sw: 'Wastani wa alama', ha: 'Matsakaicin matsayi', tw: 'Nkyerɛwdeɛ ntam' },
  'orgDashboard.tile.yield':        { en: 'Projected yield', fr: 'Rendement prévu', sw: 'Mavuno yaliyokadiriwa', ha: 'Amfani da aka ƙiyasta', tw: 'Aba a wɔbɛfa' },
  'orgDashboard.tile.risk':         { en: 'Farmers with alerts', fr: 'Agriculteurs avec alertes', sw: 'Wakulima walio na arifa', ha: 'Manoma masu faɗakarwa', tw: 'Akuafoɔ a wɔwɔ kɔkɔbɔ' },
  'orgDashboard.tile.from':         { en: 'from', fr: 'sur', sw: 'kutoka', ha: 'daga', tw: 'fi' },
  'orgDashboard.tile.noScores':     { en: 'no scores yet', fr: 'pas encore de scores', sw: 'bado hakuna alama', ha: 'babu matsayi tukuna', tw: 'nkyerɛwdeɛ biara nni hɔ' },
  'orgDashboard.tile.yieldSource':  { en: 'estimated', fr: 'estimé', sw: 'kadirio', ha: 'ƙiyasin', tw: 'akontabu' },

  'orgDashboard.cropDist':          { en: 'Crop distribution', fr: 'Répartition des cultures', sw: 'Mgawanyo wa mazao', ha: 'Rarraba amfani', tw: 'Nnɔbae mu nhyehyɛe' },
  'orgDashboard.farmers':           { en: 'Farmers', fr: 'Agriculteurs', sw: 'Wakulima', ha: 'Manoma', tw: 'Akuafoɔ' },

  'orgDashboard.filter.region':     { en: 'Filter by region', fr: 'Filtrer par région', sw: 'Chuja kwa eneo', ha: 'Tace ta yanki', tw: 'Yiyi man' },
  'orgDashboard.filter.crop':       { en: 'Filter by crop', fr: 'Filtrer par culture', sw: 'Chuja kwa mazao', ha: 'Tace ta amfani', tw: 'Yiyi nnɔbae' },
  'orgDashboard.filter.scoreMin':   { en: 'Score \u2265', fr: 'Score \u2265', sw: 'Alama \u2265', ha: 'Matsayi \u2265', tw: 'Nkyerɛwdeɛ \u2265' },
  'orgDashboard.filter.scoreMax':   { en: 'Score \u2264', fr: 'Score \u2264', sw: 'Alama \u2264', ha: 'Matsayi \u2264', tw: 'Nkyerɛwdeɛ \u2264' },

  'orgDashboard.col.name':          { en: 'Farmer', fr: 'Agriculteur', sw: 'Mkulima', ha: 'Manomi', tw: 'Okuafoɔ' },
  'orgDashboard.col.region':        { en: 'Region', fr: 'Région', sw: 'Eneo', ha: 'Yanki', tw: 'Man' },
  'orgDashboard.col.crop':          { en: 'Crop', fr: 'Culture', sw: 'Mazao', ha: 'Amfani', tw: 'Nnɔbae' },
  'orgDashboard.col.score':         { en: 'Score', fr: 'Score', sw: 'Alama', ha: 'Matsayi', tw: 'Nkyerɛwdeɛ' },
  'orgDashboard.col.status':        { en: 'Status', fr: 'Statut', sw: 'Hali', ha: 'Matsayi', tw: 'Tebea' },

  'admin.viewDashboard':            { en: 'View dashboard \u2192', fr: 'Voir le tableau de bord \u2192', sw: 'Tazama dashibodi \u2192', ha: 'Duba dashboard \u2192', tw: 'Hwɛ dashboard \u2192' },

  // ─── Trust / verification badges ─────────────────────────────
  'trust.level.high':           { en: 'High trust', fr: 'Confiance élevée', sw: 'Uaminifu mkubwa', ha: 'Babban amincewa', tw: 'Gyidie kɛse' },
  'trust.level.medium':         { en: 'Medium trust', fr: 'Confiance moyenne', sw: 'Uaminifu wa wastani', ha: 'Matsakaicin amincewa', tw: 'Gyidie ntam' },
  'trust.level.low':            { en: 'Low trust', fr: 'Faible confiance', sw: 'Uaminifu mdogo', ha: 'Karancin amincewa', tw: 'Gyidie sua' },
  'trust.check.profileComplete':  { en: 'Profile completed', fr: 'Profil complet', sw: 'Wasifu umekamilika', ha: 'An kammala bayani', tw: 'Nsɛm awie' },
  'trust.check.phoneVerified':    { en: 'Phone verified', fr: 'Téléphone vérifié', sw: 'Simu imethibitishwa', ha: 'An tabbatar da waya', tw: 'Ahama a ahina' },
  'trust.check.emailVerified':    { en: 'Email verified', fr: 'Email vérifié', sw: 'Barua pepe imethibitishwa', ha: 'An tabbatar da imel', tw: 'Email ahina' },
  'trust.check.locationCaptured': { en: 'Location captured', fr: 'Localisation enregistrée', sw: 'Eneo limepatikana', ha: 'An kama wuri', tw: 'Baabi no ahi' },
  'trust.check.cropSelected':     { en: 'Crop selected', fr: 'Culture sélectionnée', sw: 'Mazao yamechaguliwa', ha: 'An zaɓi amfani', tw: 'Nnɔbae a wɔapaw' },
  'trust.check.recentActivity':   { en: 'Recent activity present', fr: 'Activité récente présente', sw: 'Shughuli za hivi karibuni', ha: 'Aikin kwanan nan', tw: 'Adeyɛ a ɛreba' },
  'trust.check.photoUploaded':    { en: 'Photo evidence on file', fr: 'Photo en dossier', sw: 'Picha iko kwenye faili', ha: 'Akwai hoto a fayil', tw: 'Mfonini wɔ hɔ' },

  // Organization dashboard trust tile + column
  'orgDashboard.tile.trust':      { en: 'Verified farmers', fr: 'Agriculteurs vérifiés', sw: 'Wakulima waliothibitishwa', ha: 'Manoma da aka tabbatar', tw: 'Akuafoɔ a wɔakyerɛ' },
  'orgDashboard.tile.trustEmpty': { en: 'no trust data yet', fr: 'pas encore de données', sw: 'bado hakuna data', ha: 'babu bayanai tukuna', tw: 'data nni hɔ' },
  'orgDashboard.col.trust':       { en: 'Trust', fr: 'Confiance', sw: 'Uaminifu', ha: 'Amincewa', tw: 'Gyidie' },

  // ─── Offline listing + admin sync queue ─────────────────────
  'marketplace.listingQueued':    { en: 'Saved offline \u2014 we\u2019ll publish this listing the moment you reconnect.', fr: 'Enregistr\u00e9 hors ligne \u2014 publication d\u00e8s la reconnexion.', sw: 'Imehifadhiwa nje ya mtandao \u2014 itachapishwa ukirudi mtandaoni.', ha: 'An adana \u2014 za a buga idan ka dawo kan layi.', tw: 'Yɛakora \u2014 yɛbɛto sɛ wobɛba intanɛt so a.' },
  'common.refresh':               { en: 'Refresh', fr: 'Actualiser', sw: 'Onyesha upya', ha: 'Sabunta', tw: 'Yɛ foforo' },
  'admin.syncQueue.title':        { en: 'Sync queue', fr: 'File de synchronisation', sw: 'Foleni ya usawazishaji', ha: 'Layin sync', tw: 'Sync bampuo' },
  'admin.syncQueue.drainAll':     { en: 'Drain all pending', fr: 'Tout synchroniser', sw: 'Sawazisha zote', ha: 'Daidaita duka', tw: 'Yi nyinaa' },
  'admin.syncQueue.draining':     { en: 'Draining\u2026', fr: 'Synchronisation\u2026', sw: 'Inasawazisha\u2026', ha: 'Ana daidaitawa\u2026', tw: 'Reyɛ\u2026' },
  'admin.syncQueue.retryFailed':  { en: 'Retry failed', fr: 'R\u00e9essayer les \u00e9chou\u00e9s', sw: 'Jaribu tena zilizoshindikana', ha: 'Sake gwada wad\u0257a ba su yi ba', tw: 'Sɔ a anyɛ yie bio' },
  'admin.syncQueue.retrying':     { en: 'Retrying\u2026', fr: 'Nouvelle tentative\u2026', sw: 'Inajaribu\u2026', ha: 'Ana sake gwadawa\u2026', tw: 'Resɔ hwɛ\u2026' },
  'admin.syncQueue.retry':        { en: 'Retry', fr: 'R\u00e9essayer', sw: 'Jaribu', ha: 'Sake gwada', tw: 'Sɔ hwɛ' },
  'admin.syncQueue.dismiss':      { en: 'Dismiss', fr: 'Ignorer', sw: 'Futa', ha: 'Soke', tw: 'Yi fi hɔ' },
  'admin.syncQueue.confirmDismiss': { en: 'Remove this entry from the queue? It will not be retried.', fr: 'Retirer cette entr\u00e9e ? Elle ne sera pas r\u00e9essay\u00e9e.', sw: 'Futa kiingilio hiki? Hakitajaribiwa tena.', ha: 'Cire wannan shigarwa? Ba za a sake gwada ba.', tw: 'Yi nkrataa yi fi hɔ? Yɛrensɔn bio.' },
  'admin.syncQueue.byType':       { en: 'Pending by type', fr: 'En attente par type', sw: 'Kulingana na aina', ha: 'Jiran bisa nau\u2019i', tw: 'Wɔretwɛn mmu mu' },
  'admin.syncQueue.pending':      { en: 'pending', fr: 'en attente', sw: 'inasubiri', ha: 'jiran', tw: 'retwɛn' },
  'admin.syncQueue.failed':       { en: 'failed', fr: '\u00e9chou\u00e9', sw: 'imeshindikana', ha: 'ya kasa', tw: 'anyɛ yie' },
  'admin.syncQueue.lastReport':   { en: 'Last run result', fr: 'Dernier r\u00e9sultat', sw: 'Matokeo ya mwisho', ha: 'Sakamakon kar\u0257e', tw: 'Nea edi so' },
  'admin.syncQueue.entries':      { en: 'Entries', fr: 'Entr\u00e9es', sw: 'Vitu', ha: 'Shigarwa', tw: 'Nkrataa' },
  'admin.syncQueue.empty':        { en: 'No entries match this filter.', fr: 'Aucune entr\u00e9e ne correspond.', sw: 'Hakuna kiingilio.', ha: 'Babu shigarwa.', tw: 'Nkrataa biara nni hɔ.' },
  'admin.syncQueue.tile.total':   { en: 'Total entries', fr: 'Entr\u00e9es totales', sw: 'Jumla ya vitu', ha: 'Jimillar shigarwa', tw: 'Nkrataa nyinaa' },
  'admin.syncQueue.tile.pending': { en: 'Pending', fr: 'En attente', sw: 'Inasubiri', ha: 'Jiran', tw: 'Retwɛn' },
  'admin.syncQueue.tile.failed':  { en: 'Failed', fr: '\u00c9chou\u00e9s', sw: 'Vilivyoshindikana', ha: 'Wad\u0257a suka kasa', tw: 'A anyɛ yie' },
  'admin.syncQueue.tile.synced':  { en: 'Synced', fr: 'Synchronis\u00e9s', sw: 'Vilivyosawazishwa', ha: 'An daidaita', tw: 'Wɔayɛ' },
  'admin.syncQueue.tile.oldest':  { en: 'Oldest pending', fr: 'Plus ancien en attente', sw: 'Cha zamani zaidi', ha: 'Mafi tsufa', tw: 'Dadaw koraa' },
  'admin.syncQueue.col.type':     { en: 'Type', fr: 'Type', sw: 'Aina', ha: 'Nau\u2019i', tw: 'Suban' },
  'admin.syncQueue.col.farm':     { en: 'Farm', fr: 'Ferme', sw: 'Shamba', ha: 'Gona', tw: 'Afuo' },
  'admin.syncQueue.col.createdAt':{ en: 'Queued at', fr: 'Mis en file', sw: 'Wakati wa kuongeza', ha: 'Lokacin saka', tw: 'Bere a yɛde kaa ho' },
  'admin.syncQueue.col.attempts': { en: 'Attempts', fr: 'Tentatives', sw: 'Majaribio', ha: 'Gwadawa', tw: 'Nsɔ hwɛ' },
  'admin.syncQueue.col.status':   { en: 'Status', fr: 'Statut', sw: 'Hali', ha: 'Matsayi', tw: 'Tebea' },
  'admin.syncQueue.col.actions':  { en: 'Actions', fr: 'Actions', sw: 'Hatua', ha: 'Ayyuka', tw: 'Adwuma' },
  'admin.syncQueue.statuses.synced':  { en: 'synced', fr: 'synchronis\u00e9', sw: 'imesawazishwa', ha: 'an daidaita', tw: 'wɔayɛ' },
  'admin.syncQueue.statuses.failed':  { en: 'failed', fr: '\u00e9chou\u00e9', sw: 'imeshindikana', ha: 'ya kasa', tw: 'anyɛ yie' },
  'admin.syncQueue.statuses.pending': { en: 'pending', fr: 'en attente', sw: 'inasubiri', ha: 'jiran', tw: 'retwɛn' },
  'admin.syncQueue.filter.all':     { en: 'All', fr: 'Toutes', sw: 'Zote', ha: 'Duka', tw: 'Nyinaa' },
  'admin.syncQueue.filter.pending': { en: 'Pending', fr: 'En attente', sw: 'Zinasubiri', ha: 'Jiran', tw: 'Retwɛn' },
  'admin.syncQueue.filter.failed':  { en: 'Failed', fr: '\u00c9chou\u00e9es', sw: 'Zilizoshindikana', ha: 'Da suka kasa', tw: 'A anyɛ yie' },
  'admin.syncQueue.filter.synced':  { en: 'Synced', fr: 'Synchronis\u00e9es', sw: 'Zilizosawazishwa', ha: 'An daidaita', tw: 'Wɔayɛ' },

  // ─── Pilot metrics ───────────────────────────────────────────
  'pilotMetrics.title':             { en: 'Pilot metrics', fr: 'M\u00e9triques pilote', sw: 'Vipimo vya majaribio', ha: 'Ma\u2019aunin pilot', tw: 'Pilot nsusuwiie' },
  'pilotMetrics.exportCsv':         { en: 'Export metrics CSV', fr: 'Exporter m\u00e9triques CSV', sw: 'Hamisha vipimo', ha: 'Fitar da ma\u2019aunin', tw: 'Yi nsusuwiie fi' },
  'pilotMetrics.activeWeekly':      { en: 'Active this week', fr: 'Actifs cette semaine', sw: 'Hai wiki hii', ha: 'Masu aiki wannan mako', tw: 'Wɔreyɛ adwuma nnawɔtwe yi' },
  'pilotMetrics.activeMonthlyTail': { en: 'this month', fr: 'ce mois-ci', sw: 'mwezi huu', ha: 'wannan wata', tw: 'bosome yi' },
  'pilotMetrics.adoptionRate':      { en: 'Adoption rate', fr: 'Taux d\u2019adoption', sw: 'Kiwango cha matumizi', ha: 'Yawan karba', tw: 'Fasoɔ a wogye' },
  'pilotMetrics.newThisPeriod':     { en: 'new this period', fr: 'nouveaux cette p\u00e9riode', sw: 'wapya kipindi hiki', ha: 'sababbi wannan lokaci', tw: 'foforɔ bere yi' },
  'pilotMetrics.tasksPerWeek':      { en: 'Tasks / week', fr: 'T\u00e2ches / semaine', sw: 'Kazi / wiki', ha: 'Ayyuka / mako', tw: 'Adwuma / nnawɔtwe' },
  'pilotMetrics.onTime':            { en: 'on time', fr: '\u00e0 temps', sw: 'kwa wakati', ha: 'a kan lokaci', tw: 'bere pa' },
  'pilotMetrics.noTasks':           { en: 'no tasks yet', fr: 'pas encore de t\u00e2ches', sw: 'hakuna kazi bado', ha: 'babu ayyuka tukuna', tw: 'adwuma biara nni hɔ' },
  'pilotMetrics.listings':          { en: 'Listings', fr: 'Annonces', sw: 'Orodha', ha: 'Bayanai', tw: 'Nkrataa' },
  'pilotMetrics.requests':          { en: 'requests', fr: 'demandes', sw: 'maombi', ha: 'bu\u0199atu', tw: 'abisadeɛ' },
  'pilotMetrics.accepted':          { en: 'accepted', fr: 'accept\u00e9es', sw: 'zimekubaliwa', ha: 'an karba', tw: 'wɔagye to mu' },
  'pilotMetrics.weeklyTrends':      { en: 'Last 6 weeks', fr: '6 derni\u00e8res semaines', sw: 'Wiki 6 zilizopita', ha: 'Makonni 6 da suka wuce', tw: 'Nnawɔtwe 6 a atwam' },
  'pilotMetrics.topRegions':        { en: 'Top regions', fr: 'Principales r\u00e9gions', sw: 'Maeneo bora', ha: 'Manyan yankuna', tw: 'Amansan a edi kan' },
  'pilotMetrics.atRisk':            { en: 'At-risk farmers', fr: 'Agriculteurs \u00e0 risque', sw: 'Wakulima hatarini', ha: 'Manoma cikin hadari', tw: 'Akuafoɔ a wɔwɔ asiane mu' },
  'pilotMetrics.previousWindow':    { en: 'vs', fr: 'vs', sw: 'dhidi ya', ha: 'da', tw: 'ne' },
  'pilotMetrics.completionSource.events': { en: 'Task completion from real events', fr: 'Ach\u00e8vement des t\u00e2ches \u00e0 partir d\u2019\u00e9v\u00e9nements r\u00e9els', sw: 'Ukamilishaji wa kazi kutoka matukio halisi', ha: 'Kammala ayyuka daga abubuwan da suka faru', tw: 'Adwuma a wɔawie firi nokwafoɔ mu' },
  'pilotMetrics.completionSource.proxy':  { en: 'Task completion estimated from alert read-state', fr: 'Ach\u00e8vement estim\u00e9 \u00e0 partir de la lecture des alertes', sw: 'Ukamilishaji unakadiriwa kutoka hali ya kusoma arifa', ha: 'An kiyasta kammala ayyuka daga yanayin karanta gargadi', tw: 'Wɔde akɔkɔbɔ akenkan tebea ayɛ nkontaabuo' },

  // ─── NEXT task labels (after completion) ──────────────────
  'next.sortClean': { en: 'Next: Sort and clean your harvest.', fr: 'Suivant : Triez et nettoyez votre récolte.', sw: 'Kazi ifuatayo: Panga na safisha mavuno.', ha: 'Na gaba: Tsara da tsaftace girbi.', tw: 'Nea edi so: Pae na hohoro wotwa adeɛ no.' },
  'next.dryWhenSafe': { en: 'Next: Dry harvest when rain stops.', fr: 'Suivant : Séchez quand la pluie s\'arrête.', sw: 'Kazi ifuatayo: Kausha mvua ikiisha.', ha: 'Na gaba: Bushe idan ruwan sama ya tsaya.', tw: 'Nea edi so: Hwie awo sɛ osu no gyae a.' },
  'next.dryHarvest': { en: 'Next: Dry your harvest.', fr: 'Suivant : Séchez votre récolte.', sw: 'Kazi ifuatayo: Kausha mavuno.', ha: 'Na gaba: Bushe girbi.', tw: 'Nea edi so: Hwie wotwa adeɛ no awo.' },
  'next.checkCrop': { en: 'Next: Check your crop tomorrow.', fr: 'Suivant : Vérifiez demain.', sw: 'Kazi ifuatayo: Angalia mazao kesho.', ha: 'Na gaba: Bincika amfanin gona gobe.', tw: 'Nea edi so: Hwɛ wo nnɔbae ɔkyena.' },
  'next.updatePestStatus': { en: 'Next: Update pest status.', fr: 'Suivant : Mettez à jour l\'état des ravageurs.', sw: 'Kazi ifuatayo: Sasisha hali ya wadudu.', ha: 'Na gaba: Sabunta yanayin kwari.', tw: 'Nea edi so: Fa mmoa a wɔsɛe nnɔbae tebea foforo bɛka.' },
  'next.waterCrop': { en: 'Next: Water your crop.', fr: 'Suivant : Arrosez votre culture.', sw: 'Kazi ifuatayo: Mwagilia mazao.', ha: 'Na gaba: Ka ruwa amfanin gona.', tw: 'Nea edi so: Gu nsu wɔ wo nnɔbae so.' },
  'next.plantCrop': { en: 'Next: Plant your crop.', fr: 'Suivant : Plantez votre culture.', sw: 'Kazi ifuatayo: Panda mazao.', ha: 'Na gaba: Shuka amfanin gona.', tw: 'Nea edi so: Dua wo nnɔbae.' },
  'next.storeHarvest': { en: 'Next: Store your harvest.', fr: 'Suivant : Stockez votre récolte.', sw: 'Kazi ifuatayo: Hifadhi mavuno.', ha: 'Na gaba: Ajiye girbi.', tw: 'Nea edi so: Kora wotwa adeɛ no.' },

  // ─── SUCCESS lines (after completion) ─────────────────────
  'success.drying': { en: 'Grain is safer now.', fr: 'Les grains sont protégés.', sw: 'Nafaka iko salama sasa.', ha: 'Hatsi ya fi aminci yanzu.', tw: 'Aburow no ho tɔ seesei.' },
  'success.rain': { en: 'Harvest is protected.', fr: 'La récolte est protégée.', sw: 'Mavuno yamelindwa.', ha: 'An kare girbi.', tw: 'Wotwa adeɛ no ho atɔ.' },
  'success.water': { en: 'Crop will grow better now.', fr: 'La culture va mieux pousser.', sw: 'Mazao yatakua vizuri sasa.', ha: 'Amfanin gona zai girma sosai.', tw: 'Nnɔbae no bɛnyini yie seesei.' },
  'success.pest': { en: 'Good — stay ahead of pests.', fr: 'Bien — gardez une longueur d\'avance.', sw: 'Vizuri — endelea kuwa makini.', ha: 'Da kyau — ci gaba da sa ido.', tw: 'Eye — toa so hwɛ yie.' },
  'success.spray': { en: 'Crop is protected now.', fr: 'La culture est protégée.', sw: 'Mazao yamelindwa sasa.', ha: 'An kare amfanin gona yanzu.', tw: 'Nnɔbae no ho atɔ seesei.' },
  'success.weed': { en: 'Field is cleaner now.', fr: 'Le champ est plus propre.', sw: 'Shamba ni safi zaidi sasa.', ha: 'Gona ya fi tsabta yanzu.', tw: 'Afuo no ho atɛ seesei.' },
  'success.fertilize': { en: 'Nutrients added — crop will benefit.', fr: 'Nutriments ajoutés — la culture en profitera.', sw: 'Virutubisho vimeongezwa — mazao yatanufaika.', ha: 'An ƙara abinci — amfanin gona zai amfana.', tw: 'Nkɔsoɔ aduro no akɔ mu — nnɔbae no bɛnya mfasoɔ.' },
  'success.harvest': { en: 'Harvest secured.', fr: 'Récolte sécurisée.', sw: 'Mavuno yamehifadhiwa.', ha: 'An tabbatar da girbi.', tw: 'Wotwa adeɛ no awie yie.' },
  'success.plant': { en: 'Planted — growth starts now.', fr: 'Planté — la croissance commence.', sw: 'Imepandwa — ukuaji unaanza sasa.', ha: 'An shuka — girma ya fara.', tw: 'Woadua — ɛrefi ase anyini.' },
  'success.landPrep': { en: 'Soil is ready for planting.', fr: 'Le sol est prêt.', sw: 'Udongo uko tayari kupanda.', ha: 'Ƙasa ta shirya don shuka.', tw: 'Asase no asiesie ama dua.' },
  'success.sort': { en: 'Produce sorted — better value.', fr: 'Produits triés — meilleure valeur.', sw: 'Mazao yamepangwa — thamani bora.', ha: 'An tsara kaya — daraja mai kyau.', tw: 'Nneɛma no apae mu — ɛso bo.' },
  'success.store': { en: 'Stored safely.', fr: 'Stocké en sécurité.', sw: 'Imehifadhiwa salama.', ha: 'An ajiye lafiya.', tw: 'Wɔakora yie.' },
  'success.general': { en: 'Good work — your crop is getting better.', fr: 'Bon travail — votre culture s\'améliore.', sw: 'Kazi nzuri — zao lako linaboreshwa.', ha: 'Aikin kirki — amfaninku yana samun sauƙi.', tw: 'Adwuma pa — wo nnɔbae rekɔ so yie.', hi: 'बढ़िया काम — आपकी फसल बेहतर हो रही है।' },

  // ─── AUTOPILOT labels ─────────────────────────────────────
  'autopilot.confidence.high': { en: 'Recommended', fr: 'Recommandé', sw: 'Inapendekezwa', ha: 'An ba da shawara', tw: 'Wɔakamfo' },
  'autopilot.confidence.medium': { en: 'Suggested', fr: 'Suggéré', sw: 'Inapendekezwa', ha: 'An ba da shawara', tw: 'Wɔakyerɛ' },
  'autopilot.nextReady': { en: 'Next task ready', fr: 'Tâche suivante prête', sw: 'Kazi ifuatayo iko tayari', ha: 'Aikin gaba ya shirya', tw: 'Adwuma a edi so asiesie' },
  'autopilot.continue': { en: 'Continue', fr: 'Continuer', sw: 'Endelea', ha: 'Ci gaba', tw: 'Toa so' },
  'autopilot.savedOffline': { en: 'Saved offline', fr: 'Sauvegardé hors ligne', sw: 'Imehifadhiwa nje ya mtandao', ha: 'An adana a wajen layi', tw: 'Wɔakora a intanɛt nni hɔ' },

  // ═══════════════════════════════════════════════════════════
  //  STARTER GUIDE — crop fit entry point
  // ═══════════════════════════════════════════════════════════
  'starterGuide.findBestCrop': { en: 'Find My Best Crop', fr: 'Trouver ma meilleure culture', sw: 'Tafuta Zao Langu Bora', ha: 'Nemo Amfanin Gona na Mafi Kyau', tw: 'Hwehwɛ Me Nnɔbae Pa' },
  'myFarm.findBestCrop': { en: 'Find My Best Crop', fr: 'Trouver ma meilleure culture', sw: 'Tafuta Zao Langu Bora', ha: 'Nemo Amfanin Gona na Mafi Kyau', tw: 'Hwehwɛ Me Nnɔbae Pa' },

  // ═══════════════════════════════════════════════════════════
  //  CROP FIT — intake questions
  // ═══════════════════════════════════════════════════════════
  'cropFit.q.experience': { en: 'Have you farmed before?', fr: 'Avez-vous déjà cultivé ?', sw: 'Umewahi kulima hapo awali?', ha: 'Ka taɓa noma a baya?', tw: 'Woayɛ afuo pɛn?' },
  'cropFit.q.landSize': { en: 'How much land do you have?', fr: 'Quelle est la taille de votre terrain ?', sw: 'Una ardhi kiasi gani?', ha: 'Kana da filaye nawa?', tw: 'Asase dodoɔ bɛn na wowɔ?' },
  'cropFit.q.waterAccess': { en: 'What is your water source?', fr: 'Quelle est votre source d\'eau ?', sw: 'Chanzo chako cha maji ni kipi?', ha: 'Menene tushen ruwan ku?', tw: 'Wo nsu fibea ne deɛn?' },
  'cropFit.q.budget': { en: 'What is your budget level?', fr: 'Quel est votre budget ?', sw: 'Bajeti yako ni kiasi gani?', ha: 'Menene matakin kasafin ku?', tw: 'Wo sika dodoɔ bɛn?' },
  'cropFit.q.goal': { en: 'What is your main goal?', fr: 'Quel est votre objectif principal ?', sw: 'Lengo lako kuu ni nini?', ha: 'Menene babban burin ku?', tw: 'Wo botaeɛ titiriw ne deɛn?' },
  'cropFit.q.preferredCrop': { en: 'Do you have a crop preference?', fr: 'Avez-vous une préférence de culture ?', sw: 'Una upendeleo wa zao?', ha: 'Kuna da zaɓin amfanin gona?', tw: 'Wowɔ nnɔbae bi a wopɛ paa?' },

  'cropFit.hint.experience': { en: 'Be honest — we\'ll match you with the right crops.', fr: 'Soyez honnête — on trouvera les bonnes cultures.', sw: 'Kuwa mkweli — tutakupatia mazao yanayofaa.', ha: 'Ka gaskiya — za mu sami amfanin gona masu dacewa.', tw: 'Ka nokorɛ — yɛbɛhwehwɛ nnɔbae a ɛfata wo.' },
  'cropFit.hint.landSize': { en: 'Estimate is fine.', fr: 'Une estimation suffit.', sw: 'Makadirio yanafaa.', ha: 'Kiyasi ya isa.', tw: 'Nsusuwii bɛyɛ.' },
  'cropFit.hint.waterAccess': { en: 'This affects which crops will grow well.', fr: 'Cela influence quelles cultures pousseront bien.', sw: 'Hii inaathiri mazao yatakayokua vizuri.', ha: 'Wannan yana tasiri wane amfanin gona za su yi kyau.', tw: 'Eyi bɛhyɛ nnɔbae a ɛbɛyɛ yie no.' },
  'cropFit.hint.budget': { en: 'Some crops need more investment to start.', fr: 'Certaines cultures demandent plus d\'investissement.', sw: 'Baadhi ya mazao yanahitaji uwekezaji zaidi.', ha: 'Wasu amfanin gona suna buƙatar ƙarin jari.', tw: 'Nnɔbae bi hia sika pii ansa na woahyɛ ase.' },
  'cropFit.hint.goal': { en: 'This helps us pick the most useful crops for you.', fr: 'Ça nous aide à choisir les meilleures cultures.', sw: 'Hii inatusaidia kuchagua mazao yanayofaa zaidi.', ha: 'Wannan yana taimaka mana zaɓar amfanin gona masu amfani.', tw: 'Eyi boa yɛn hwehwɛ nnɔbae a ɛho wɔ mfasoɔ ma wo.' },
  'cropFit.hint.preferredCrop': { en: 'Optional — skip if unsure.', fr: 'Facultatif — passez si vous hésitez.', sw: 'Si lazima — ruka kama huna uhakika.', ha: 'Zaɓi ne — tsallake idan ba ka da tabbaci.', tw: 'Ɛnyɛ dɛ ɛsɛ — twa mu sɛ wonnim.' },

  // ─── Experience options ──
  'cropFit.exp.none': { en: 'No, I\'m just starting', fr: 'Non, je débute', sw: 'Hapana, ninaanza sasa', ha: 'A\'a, ina farawa', tw: 'Dabi, mefiri aseɛ seesei' },
  'cropFit.exp.some': { en: 'Yes, I already farm', fr: 'Oui, je cultive déjà', sw: 'Ndiyo, tayari ninalima', ha: 'Ee, ina noma', tw: 'Aane, meyɛ afuo dada' },
  'cropFit.exp.experienced': { en: 'Yes, I farm regularly', fr: 'Oui, je cultive régulièrement', sw: 'Ndiyo, ninalima mara kwa mara', ha: 'Ee, ina noma kullum', tw: 'Aane, meyɛ afuoyɛ daa' },

  // ─── Land size options ──
  'cropFit.land.small': { en: 'Small (backyard / under 1 acre)', fr: 'Petit (jardin / moins de 0,5 ha)', sw: 'Ndogo (nyumbani / chini ya ekari 1)', ha: 'Ƙarami (bayan gida / ƙasa da eka 1)', tw: 'Ketewa (efie akyi / ɛnsen eka 1)' },
  'cropFit.land.medium': { en: 'Medium (1–5 acres)', fr: 'Moyen (0,5–2 ha)', sw: 'Wastani (ekari 1–5)', ha: 'Matsakaici (eka 1–5)', tw: 'Ntam (eka 1–5)' },
  'cropFit.land.large': { en: 'Large (5+ acres)', fr: 'Grand (plus de 2 ha)', sw: 'Kubwa (ekari 5+)', ha: 'Babba (eka 5+)', tw: 'Kɛse (eka 5+)' },

  // ─── Water access options ──
  'cropFit.water.rainOnly': { en: 'Rain only', fr: 'Pluie uniquement', sw: 'Mvua tu', ha: 'Ruwan sama kaɗai', tw: 'Nsuo a ɛtɔ nko' },
  'cropFit.water.wellRiver': { en: 'Well or river nearby', fr: 'Puits ou rivière à proximité', sw: 'Kisima au mto karibu', ha: 'Rijiya ko kogi kusa', tw: 'Abura anaa nsu a ɛbɛn' },
  'cropFit.water.irrigation': { en: 'I have irrigation', fr: 'J\'ai l\'irrigation', sw: 'Nina umwagiliaji', ha: 'Ina ban ruwa', tw: 'Mewɔ nsu a mede gu' },

  // ─── Budget options ──
  'cropFit.budget.low': { en: 'Low — minimal spending', fr: 'Faible — dépenses minimales', sw: 'Ndogo — matumizi kidogo', ha: 'Ƙarami — ƙaramin kashe kuɗi', tw: 'Kakra — sika kakra' },
  'cropFit.budget.medium': { en: 'Medium — some investment', fr: 'Moyen — un peu d\'investissement', sw: 'Wastani — uwekezaji kiasi', ha: 'Matsakaici — wasu jari', tw: 'Ntam — sika bi' },
  'cropFit.budget.high': { en: 'High — ready to invest', fr: 'Élevé — prêt à investir', sw: 'Kubwa — tayari kuwekeza', ha: 'Babba — a shirye jari', tw: 'Kɛse — masiesie ato sika mu' },

  // ─── Goal options ──
  'cropFit.goal.homeFood': { en: 'Feed my family', fr: 'Nourrir ma famille', sw: 'Kulisha familia yangu', ha: 'Ciyar da iyalina', tw: 'Ma me fifo aduan' },
  'cropFit.goal.localSales': { en: 'Sell at local market', fr: 'Vendre au marché local', sw: 'Kuuza sokoni', ha: 'Sayar a kasuwa', tw: 'Tɔn wɔ gua so' },
  'cropFit.goal.profit': { en: 'Maximize profit', fr: 'Maximiser le profit', sw: 'Kuongeza faida', ha: 'Samun riba mai yawa', tw: 'Nya mfasoɔ kɛse' },

  // ─── Preferred crop options ──
  'cropFit.pref.noPref': { en: 'No preference — suggest for me', fr: 'Pas de préférence — suggérez', sw: 'Sina upendeleo — nipendekezee', ha: 'Babu zaɓi — ba ni shawara', tw: 'Menni nea mepɛ — kyerɛ me bi' },
  'cropFit.pref.maize': { en: 'Maize (corn)', fr: 'Maïs', sw: 'Mahindi', ha: 'Masara', tw: 'Aburoɔ' },
  'cropFit.pref.bean': { en: 'Beans', fr: 'Haricots', sw: 'Maharage', ha: 'Wake', tw: 'Abɛmmerɛ' },
  'cropFit.pref.cassava': { en: 'Cassava', fr: 'Manioc', sw: 'Mihogo', ha: 'Rogo', tw: 'Bankye' },
  'cropFit.pref.tomato': { en: 'Tomato', fr: 'Tomate', sw: 'Nyanya', ha: 'Tumatir', tw: 'Ntomato' },
  'cropFit.pref.rice': { en: 'Rice', fr: 'Riz', sw: 'Mpunga', ha: 'Shinkafa', tw: 'Ɛmo' },

  // ═══════════════════════════════════════════════════════════
  //  CROP FIT — results screen
  // ═══════════════════════════════════════════════════════════
  'cropFit.results.title': { en: 'Your Top Crops', fr: 'Vos meilleures cultures', sw: 'Mazao Yako Bora', ha: 'Amfanin Gonan ku Mafi Kyau', tw: 'Wo Nnɔbae Pa' },
  'cropFit.results.subtitle': { en: 'Works well in your area right now.', fr: 'Convient bien à votre région en ce moment.', sw: 'Inafaa vizuri katika eneo lako kwa sasa.', ha: 'Ya dace da yankinku a yanzu.', tw: 'Ɛkɔ yie wɔ wo mantam seesei.' },
  'cropFit.results.bestFit': { en: 'Best Fit', fr: 'Meilleur choix', sw: 'Bora Zaidi', ha: 'Mafi Dacewa', tw: 'Nea Ɛfata Paa' },
  'cropFit.results.bestForYou': { en: 'Best for you', fr: 'Idéal pour vous', sw: 'Bora kwako', ha: 'Mafi dacewa a gareka', tw: 'Ɛfata wo paa' },
  'cropFit.results.viewPlan': { en: 'View plan', fr: 'Voir le plan', sw: 'Angalia mpango', ha: 'Duba shiri', tw: 'Hwɛ nhyehyɛeɛ' },
  'cropFit.results.alsoConsider': { en: 'Also consider', fr: 'À considérer aussi', sw: 'Pia fikiria', ha: 'Kuma yi la\'akari', tw: 'Hwɛ eyinom nso' },
  'cropFit.results.noResults': { en: 'No crops matched. Try different answers.', fr: 'Aucune culture trouvée. Essayez d\'autres réponses.', sw: 'Hakuna mazao yaliyopatikana. Jaribu majibu tofauti.', ha: 'Babu amfanin gona. Gwada amsoshi daban.', tw: 'Nnɔbae biara anhyia. Sɔ mmuaeɛ foforɔ hwɛ.' },
  'cropFit.results.tryAgain': { en: 'Try Again', fr: 'Réessayer', sw: 'Jaribu Tena', ha: 'Sake Gwadawa', tw: 'San Hwehwɛ' },

  // ─── Difficulty labels ──
  'cropFit.diff.beginner': { en: 'Beginner', fr: 'Débutant', sw: 'Anayeanza', ha: 'Sabon farawa', tw: 'Ɔfoforɔ' },
  'cropFit.diff.moderate': { en: 'Moderate', fr: 'Intermédiaire', sw: 'Wastani', ha: 'Matsakaici', tw: 'Ntam' },
  'cropFit.diff.advanced': { en: 'Advanced', fr: 'Avancé', sw: 'Ngumu', ha: 'Mai wahala', tw: 'Ɛyɛ den' },

  // ─── Level labels (water, cost, effort, market) ──
  'cropFit.level.low': { en: 'Low', fr: 'Faible', sw: 'Chini', ha: 'Ƙarami', tw: 'Kakra' },
  'cropFit.level.moderate': { en: 'Moderate', fr: 'Moyen', sw: 'Wastani', ha: 'Matsakaici', tw: 'Ntam' },
  'cropFit.level.high': { en: 'High', fr: 'Élevé', sw: 'Juu', ha: 'Babba', tw: 'Kɛse' },

  // ─── Weeks label ──
  'cropFit.weeks': { en: 'weeks', fr: 'semaines', sw: 'wiki', ha: 'makonni', tw: 'nnawɔtwe' },

  // ─── Fit reasons (chips on recommendation cards) ──
  'cropFit.reason.beginnerFriendly': { en: 'Beginner-friendly', fr: 'Facile pour débutants', sw: 'Rahisi kwa wanaoanza', ha: 'Mai sauƙi ga sabbin farawa', tw: 'Ɛyɛ mmerɛ ma afoforɔ' },
  'cropFit.reason.lowWater': { en: 'Low water needs', fr: 'Peu d\'eau nécessaire', sw: 'Haitaji maji mengi', ha: 'Ba ta buƙatar ruwa da yawa', tw: 'Ɛnhia nsu pii' },
  'cropFit.reason.droughtTolerant': { en: 'Drought tolerant', fr: 'Résiste à la sécheresse', sw: 'Inavumilia ukame', ha: 'Tana jure fari', tw: 'Ɛtumi gyina ɔpɛ mu' },
  'cropFit.reason.lowCost': { en: 'Low cost to start', fr: 'Faible coût de démarrage', sw: 'Gharama ndogo kuanza', ha: 'Ƙaramin farashi don farawa', tw: 'Ɛnhia sika pii' },
  'cropFit.reason.goodForFood': { en: 'Good for home food', fr: 'Bon pour nourrir la famille', sw: 'Nzuri kwa chakula nyumbani', ha: 'Mai kyau don abinci gida', tw: 'Eye ma efie aduan' },
  'cropFit.reason.goodForSales': { en: 'Good for local sales', fr: 'Bon pour vente locale', sw: 'Nzuri kwa kuuza sokoni', ha: 'Mai kyau don sayar a kasuwa', tw: 'Eye ma gua so tɔn' },
  'cropFit.reason.goodForProfit': { en: 'High profit potential', fr: 'Fort potentiel de profit', sw: 'Uwezekano mkubwa wa faida', ha: 'Damar riba mai yawa', tw: 'Mfasoɔ kɛse wɔ mu' },
  'cropFit.reason.goodTiming': { en: 'Good timing to plant now', fr: 'Bon moment pour planter', sw: 'Wakati mzuri wa kupanda sasa', ha: 'Lokaci mai kyau don shuka yanzu', tw: 'Ɛyɛ bere pa sɛ wuadua seesei' },
  'cropFit.reason.fitsSmallFarm': { en: 'Fits small farms', fr: 'Adapté aux petites fermes', sw: 'Inafaa mashamba madogo', ha: 'Ya dace da ƙananan gonaki', tw: 'Ɛfata mfuw nketewa' },
  'cropFit.reason.yourChoice': { en: 'Your preferred crop', fr: 'Votre culture préférée', sw: 'Zao lako unalopendelea', ha: 'Amfanin gonan da kuka zaɓa', tw: 'Nnɔbae a wopɛ' },

  // ─── Warnings ──
  'cropFit.warning.moderate': { en: 'Needs some care', fr: 'Demande un peu de soin', sw: 'Inahitaji uangalifu kiasi', ha: 'Yana buƙatar wasu kulawa', tw: 'Ɛhia nhwɛsoɔ kakra' },
  'cropFit.warning.advanced': { en: 'Challenging for beginners', fr: 'Difficile pour débutants', sw: 'Ngumu kwa wanaoanza', ha: 'Mai wahala ga sabbin farawa', tw: 'Ɛyɛ den ma afoforɔ' },
  'cropFit.warning.needsIrrigation': { en: 'Needs irrigation', fr: 'Nécessite l\'irrigation', sw: 'Inahitaji umwagiliaji', ha: 'Yana buƙatar ban ruwa', tw: 'Ɛhia nsu a wɔde gu' },
  'cropFit.warning.highCost': { en: 'Higher startup cost', fr: 'Coût de démarrage élevé', sw: 'Gharama kubwa ya kuanza', ha: 'Tsadar farawa mai yawa', tw: 'Ɛhia sika pii ansa na woahyɛ ase' },

  // ─── Timing signals ──
  'cropFit.timing.goodNow': { en: 'Good time to plant now', fr: 'Bon moment pour planter', sw: 'Wakati mzuri kupanda sasa', ha: 'Lokaci mai kyau don shuka', tw: 'Ɛyɛ bere pa sɛ wuadua' },
  'cropFit.timing.needsIrrigation': { en: 'Needs irrigation setup', fr: 'Nécessite installation d\'irrigation', sw: 'Inahitaji mfumo wa umwagiliaji', ha: 'Yana buƙatar tsarin ban ruwa', tw: 'Ɛhia nsu a wɔde gu nhyehyɛeɛ' },
  'cropFit.timing.waitForRains': { en: 'Wait for rainy season', fr: 'Attendez la saison des pluies', sw: 'Subiri msimu wa mvua', ha: 'Jira daminar ruwa', tw: 'Twɛn osu bere' },
  'cropFit.timing.notIdealNow': { en: 'Not ideal now — plan ahead', fr: 'Pas idéal maintenant — planifiez', sw: 'Si bora sasa — panga mapema', ha: 'Ba shine ba yanzu — shirya gaba', tw: 'Ɛnyɛ bere pa seesei — hyɛ nsa' },

  // ─── Top Crops engine (registry-driven recommendation) ──
  'topCrops.reason.regionMatch':      { en: 'Grows well in your region', fr: 'Pousse bien dans votre région',       sw: 'Inakua vizuri katika eneo lako',      ha: 'Tana girma sosai a yankinku',       tw: 'Ɛsi yie wɔ w\u2019amantoɔ mu' },
  'topCrops.reason.beginnerFriendly': { en: 'Good for beginners',        fr: 'Bon pour les débutants',               sw: 'Nzuri kwa wanaoanza',                 ha: 'Mai kyau ga sabbin farawa',         tw: 'Ɛyɛ mmerɛ ma afoforɔ' },
  'topCrops.reason.fitsBackyard':     { en: 'Works in small backyards',  fr: 'Convient aux petits jardins',          sw: 'Inafaa kwa bustani ndogo',            ha: 'Tana aiki a ƙananan lambuna',        tw: 'Ɛsi yie wɔ fie afuw ketewa mu' },
  'topCrops.reason.goodMarket':       { en: 'Strong local market',       fr: 'Marché local solide',                  sw: 'Soko nzuri la ndani',                 ha: 'Kasuwar gida mai ƙarfi',             tw: 'Kuro mu gua a ɛyɛ den' },
  'topCrops.reason.lowWater':         { en: 'Low water needs',           fr: 'Peu d\u2019eau nécessaire',             sw: 'Haitaji maji mengi',                  ha: 'Ba ta buƙatar ruwa da yawa',         tw: 'Ɛnhia nsu pii' },
  'topCrops.reason.droughtTolerant':  { en: 'Drought tolerant',          fr: 'Résiste à la sécheresse',               sw: 'Inavumilia ukame',                    ha: 'Tana jure fari',                     tw: 'Ɛtumi gyina ɔpɛ mu' },
  'topCrops.reason.lowCost':          { en: 'Low cost to start',         fr: 'Faible coût de démarrage',             sw: 'Gharama ndogo kuanza',                ha: 'Ƙaramin farashi don farawa',         tw: 'Ɛnhia sika pii' },
  'topCrops.reason.goodTiming':       { en: 'Good time to plant now',    fr: 'Bon moment pour planter',               sw: 'Wakati mzuri wa kupanda sasa',        ha: 'Lokaci mai kyau don shuka yanzu',    tw: 'Ɛyɛ bere pa sɛ wuadua seesei' },
  'topCrops.reason.yourChoice':       { en: 'Your preferred crop',       fr: 'Votre culture préférée',                sw: 'Zao lako unalopendelea',              ha: 'Amfanin gonan da kuka zaɓa',         tw: 'Nnɔbae a wopɛ' },
  'topCrops.badge.beginnerFriendly':  { en: 'Beginner',                  fr: 'Débutant',                              sw: 'Mwanzo',                              ha: 'Mafari',                             tw: 'Afoforɔ' },
  'topCrops.badge.lowWater':          { en: 'Low water',                 fr: 'Peu d\u2019eau',                        sw: 'Maji kidogo',                         ha: 'Ruwa kaɗan',                         tw: 'Nsu kakra' },
  'topCrops.badge.droughtTolerant':   { en: 'Drought-tolerant',          fr: 'Résistant à la sécheresse',             sw: 'Huvumilia ukame',                     ha: 'Mai jurewa fari',                    tw: 'Gyina ɔpɛ mu' },
  'topCrops.badge.lowCost':           { en: 'Low cost',                  fr: 'Faible coût',                           sw: 'Gharama ndogo',                       ha: 'Ƙaramin farashi',                    tw: 'Ɛnhia sika' },
  'topCrops.badge.goodMarket':        { en: 'Strong market',             fr: 'Bon marché',                            sw: 'Soko zuri',                           ha: 'Kasuwa mai ƙarfi',                   tw: 'Gua a ɛyɛ den' },
  'topCrops.badge.goodTiming':        { en: 'Plant now',                 fr: 'Planter maintenant',                    sw: 'Panda sasa',                          ha: 'Shuka yanzu',                        tw: 'Dua seesei' },
  'topCrops.warning.advancedCrop':    { en: 'Advanced crop',             fr: 'Culture avancée',                       sw: 'Zao la ngazi ya juu',                 ha: 'Amfanin gona na ci gaba',            tw: 'Nnɔbae a ɛyɛ den' },
  'topCrops.warning.heavyForBackyard':{ en: 'May be too heavy for backyards', fr: 'Peut-être trop pour un jardin',    sw: 'Inaweza kuwa nzito kwa bustani ndogo', ha: 'Na iya yin nauyi ga ƙananan lambuna', tw: 'Ɛbɛtumi ayɛ den ma fie afuw' },
  'topCrops.warning.needsIrrigation': { en: 'Needs irrigation',          fr: 'Nécessite l\u2019irrigation',           sw: 'Inahitaji umwagiliaji',               ha: 'Yana buƙatar ban ruwa',              tw: 'Ɛhia nsu a wɔde gu' },
  'topCrops.warning.highCost':        { en: 'Higher startup cost',       fr: 'Coût de démarrage élevé',               sw: 'Gharama kubwa ya kuanza',             ha: 'Tsadar farawa mai yawa',             tw: 'Ɛhia sika pii' },
  'topCrops.warning.longCycle':       { en: 'Long growing cycle',        fr: 'Cycle de croissance long',              sw: 'Mzunguko mrefu wa ukuaji',            ha: 'Tsawon lokacin girma',               tw: 'Ne nyin bere ware' },
  'topCrops.warning.outOfSeason':     { en: 'Not the usual planting season', fr: 'Hors de la saison habituelle',       sw: 'Si msimu wa kawaida wa kupanda',      ha: 'Ba lokacin shuka na yau da kullun ba', tw: 'Ɛnyɛ bere a wɔtaa dua' },

  // ─── Seasonal intelligence — dynamic planting messages ──
  'seasonal.msg.goodTimeToPlant':     { en: 'Good time to plant now',            fr: 'Bon moment pour planter',                sw: 'Wakati mzuri wa kupanda sasa',           ha: 'Lokaci mai kyau don shuka yanzu',      tw: 'Ɛyɛ bere pa sɛ wuadua seesei' },
  'seasonal.msg.conditionsFavorable': { en: 'Conditions look favorable for planting', fr: 'Les conditions semblent favorables', sw: 'Hali zinaonekana nzuri kwa kupanda',   ha: 'Yanayi na da kyau don shuka',           tw: 'Tebea no yɛ ma afuw' },
  'seasonal.msg.possibleButLessIdeal':{ en: 'Can grow now, but conditions are less ideal', fr: 'Possible maintenant, mais conditions moins idéales', sw: 'Inawezekana sasa, lakini hali si bora', ha: 'Mai yiwuwa yanzu, amma yanayi ba mai kyau ba', tw: 'Ɛbɛtumi ayɛ seesei, nanso tebea no nyɛ pa' },
  'seasonal.msg.usuallyPlantedLater': { en: 'Usually planted later in your area', fr: 'Habituellement planté plus tard dans votre région', sw: 'Hupandwa baadaye katika eneo lako',     ha: 'Ana yawan shukawa daga baya a yankinku', tw: 'Wɔtaa dua akyire wɔ w\u2019amantoɔ mu' },
  'seasonal.msg.betterAnotherSeason': { en: 'Better suited to another season',   fr: 'Mieux adapté à une autre saison',         sw: 'Inafaa zaidi msimu mwingine',            ha: 'Ya fi dacewa da wani lokaci',           tw: 'Ɛfata bere foforɔ' },
  'seasonal.msg.suitableManyRegions': { en: 'Suitable in many regions',          fr: 'Adapté à de nombreuses régions',          sw: 'Inafaa katika maeneo mengi',             ha: 'Ya dace da yankuna da yawa',            tw: 'Ɛfata amantoɔ pii mu' },
  'seasonal.msg.checkLocalConditions':{ en: 'Check local conditions before planting', fr: 'Vérifiez les conditions locales avant de planter', sw: 'Kagua hali za mtaa kabla ya kupanda', ha: 'Duba yanayin wurinku kafin ku shuka',  tw: 'Hwɛ w\u2019abɔdwese tebea ansa na woadua' },

  // ─── Seasonal explanation reasons ──
  'seasonal.reason.preferredMonth':   { en: 'In the main planting window',       fr: 'Dans la fenêtre principale de plantation', sw: 'Katika dirisha kuu la kupanda',           ha: 'A cikin babban lokacin shuka',         tw: 'Adua bere titire mu' },
  'seasonal.reason.acceptableMonth':  { en: 'Acceptable planting time',          fr: 'Période de plantation acceptable',        sw: 'Wakati unaokubalika wa kupanda',          ha: 'Lokaci mai karɓuwa na shuka',          tw: 'Adua bere a ɛyɛ' },
  'seasonal.reason.outOfWindow':      { en: 'Outside the usual planting window', fr: 'Hors de la fenêtre de plantation habituelle', sw: 'Nje ya dirisha la kawaida la kupanda', ha: 'Bayan lokacin shuka na yau da kullun', tw: 'Ɛwɔ adua bere a wɔtaa mu akyi' },
  'seasonal.reason.rainSupports':     { en: 'Current rains support planting',    fr: 'Les pluies actuelles soutiennent la plantation', sw: 'Mvua za sasa zinasaidia kupanda',   ha: 'Ruwan sama na yanzu ya tallafi shuka', tw: 'Osu a ɛreba no boa adua' },
  'seasonal.reason.drySlowsEstablishment': { en: 'Dry conditions may slow establishment', fr: 'Les conditions sèches peuvent ralentir l\u2019enracinement', sw: 'Ukavu unaweza kupunguza kustawi', ha: 'Busasshen yanayi na iya rage farawa', tw: 'Ɔpɛ tebea bɛtumi atɛ adwumayɛ no so' },
  'seasonal.reason.heavyRainRisk':    { en: 'Heavy rain may affect early growth', fr: 'Les fortes pluies peuvent affecter la croissance', sw: 'Mvua nyingi zinaweza kuathiri ukuaji wa mapema', ha: 'Ruwan sama mai yawa na iya shafar girma na farko', tw: 'Osu a ɛba pii bɛtumi adane nyin bere' },
  'seasonal.reason.heatStress':       { en: 'Heat stress may reduce yield',      fr: 'La chaleur peut réduire le rendement',   sw: 'Joto kali linaweza kupunguza mavuno',     ha: 'Zafi mai yawa na iya rage amfanin gona', tw: 'Ɔhyeɛ bɛtumi ateɛ nneɛma a ɛbɛba' },

  // ─── Rainfall intelligence (rainfallFitEngine) ──
  'rainfall.msg.goodForCurrentRain':  { en: 'Good time to plant with current rainfall', fr: 'Bon moment pour planter avec les pluies actuelles', sw: 'Wakati mzuri kupanda kwa mvua za sasa', ha: 'Lokaci mai kyau don shuka da ruwan saman yanzu', tw: 'Ɛyɛ bere pa sɛ wuadua wɔ osu a ɛreba no mu' },
  'rainfall.msg.manageable':          { en: 'Conditions are manageable but not ideal',  fr: 'Les conditions sont gérables mais pas idéales',     sw: 'Hali zinaweza kushughulikiwa lakini si bora', ha: 'Yanayi yana iya sarrafawa amma ba mai kyau ba', tw: 'Tebea no yɛ yie nanso ɛnyɛ pa koraa' },
  'rainfall.msg.drySlowsEstablishment':{ en: 'Dry conditions may slow establishment',   fr: 'Les conditions sèches peuvent ralentir la croissance', sw: 'Ukavu unaweza kupunguza kustawi',         ha: 'Busasshen yanayi na iya rage farawa',   tw: 'Ɔpɛ tebea bɛtumi atɛ adwumayɛ no so' },
  'rainfall.msg.heavyRainDamage':     { en: 'Heavy rainfall may damage this crop',     fr: 'Les fortes pluies peuvent endommager cette culture', sw: 'Mvua nyingi zinaweza kuharibu zao hili', ha: 'Ruwan sama mai yawa na iya lalata wannan amfanin', tw: 'Osu a ɛba pii bɛtumi asɛe nnɔbae yi' },
  'rainfall.msg.currentConditionsMayAffect': { en: 'Current conditions may affect growth', fr: 'Les conditions actuelles peuvent affecter la croissance', sw: 'Hali za sasa zinaweza kuathiri ukuaji', ha: 'Yanayin yanzu na iya shafar girma', tw: 'Tebea no bɛtumi adane ne nyin' },
  'rainfall.msg.checkLocalConditions':{ en: 'Check local conditions before planting',   fr: 'Vérifiez les conditions locales avant de planter', sw: 'Kagua hali za mtaa kabla ya kupanda',   ha: 'Duba yanayin wurinku kafin ku shuka', tw: 'Hwɛ w\u2019abɔdwese tebea ansa na woadua' },
  'rainfall.reason.rainSupportsCrop': { en: 'Current rainfall supports this crop',      fr: 'Les pluies actuelles soutiennent cette culture',  sw: 'Mvua za sasa zinasaidia zao hili',         ha: 'Ruwan saman yanzu yana tallafawa amfanin nan', tw: 'Osu a ɛreba no boa nnɔbae yi' },
  'rainfall.reason.manageable':       { en: 'Rainfall is workable for this crop',       fr: 'Les pluies sont gérables pour cette culture',       sw: 'Mvua inaweza kushughulikiwa kwa zao hili', ha: 'Ruwan sama na iya yiwuwa ga wannan amfanin', tw: 'Osu no yɛ ma nnɔbae yi' },
  'rainfall.reason.dryHurtsCrop':     { en: 'Dry conditions hurt this crop',            fr: 'Les conditions sèches nuisent à cette culture',     sw: 'Ukavu unadhuru zao hili',                  ha: 'Busasshen yanayi yana cutar da amfanin', tw: 'Ɔpɛ tebea bɔne ma nnɔbae yi' },
  'rainfall.reason.heavyRainHurtsCrop':{ en: 'Heavy rainfall damages this crop',        fr: 'Les fortes pluies endommagent cette culture',       sw: 'Mvua nyingi zinaharibu zao hili',          ha: 'Ruwan sama mai yawa yana lalata amfanin', tw: 'Osu a ɛba pii sɛe nnɔbae yi' },
  'rainfall.reason.conditionsMayAffect':{ en: 'Current conditions may affect this crop', fr: 'Les conditions actuelles peuvent affecter cette culture', sw: 'Hali za sasa zinaweza kuathiri zao hili', ha: 'Yanayin yanzu na iya shafar amfanin nan', tw: 'Tebea no bɛtumi adane nnɔbae yi' },
  'rainfall.risk.waterStress':        { en: 'Water stress risk',                        fr: 'Risque de stress hydrique',                         sw: 'Hatari ya mkazo wa maji',                 ha: 'Hadarin rashin ruwa',                 tw: 'Nsu a ɛnnɔɔso asiane' },
  'rainfall.risk.floodOrRootRot':     { en: 'Flooding or root rot risk',                fr: 'Risque d\u2019inondation ou de pourriture des racines', sw: 'Hatari ya mafuriko au kuoza kwa mizizi', ha: 'Hadarin ambaliya ko lalacewar tushen shuka', tw: 'Nsu a ɛhyɛ ma anaa ntini a ɛporɔ asiane' },
  'rainfall.task.planIrrigation':     { en: 'Plan irrigation or water conservation',    fr: 'Prévoir l\u2019irrigation ou la conservation de l\u2019eau', sw: 'Panga umwagiliaji au uhifadhi wa maji',   ha: 'Tsara ban ruwa ko adana ruwa',       tw: 'Hyɛ nsu gu ho nhyehyɛeɛ' },
  'rainfall.task.checkDrainage':      { en: 'Check drainage and watch for disease',     fr: 'Vérifiez le drainage et surveillez les maladies',   sw: 'Kagua mfereji na angalia magonjwa',       ha: 'Duba magudanan ruwa ka lura da cututtuka', tw: 'Hwɛ nsu no kwan na hwɛ yadeɛ so' },

  // ─── Progress / streak / milestone (Fix P4.11) ──────
  'progress.label.low':           { en: 'Low',                                       fr: 'Faible',                                  sw: 'Chini',                                       ha: 'Ƙasa',                                  tw: 'Sua' },
  'progress.label.fair':          { en: 'Fair',                                      fr: 'Correct',                                  sw: 'Wastani',                                     ha: 'Matsakaici',                            tw: 'Pa kakra' },
  'progress.label.good':          { en: 'Good',                                      fr: 'Bon',                                      sw: 'Nzuri',                                       ha: 'Mai kyau',                              tw: 'Pa' },
  'progress.label.strong':        { en: 'Strong',                                    fr: 'Excellent',                                sw: 'Imara',                                       ha: 'Mai ƙarfi',                              tw: 'Den' },
  'progress.explain.low':         { en: 'Light farm activity — log one task today',  fr: 'Faible activité — enregistrez une tâche',   sw: 'Shughuli kidogo shambani — andika kazi moja leo', ha: 'Ƙaramin aiki — yi rikodin aiki ɗaya yau',  tw: 'Adwumayɛ kakra — twerɛ adwuma baako' },
  'progress.explain.fair':        { en: 'Progress underway — finish another task',    fr: 'Progrès en cours — terminez une autre tâche', sw: 'Maendeleo yanaendelea — kamilisha kazi nyingine', ha: 'Ana ci gaba — kammala wani aiki',           tw: 'Adwuma rekɔ so — wie biako bio' },
  'progress.explain.good':        { en: 'Great work — keep the momentum going',       fr: 'Excellent travail — continuez',             sw: 'Kazi nzuri — endelea hivyo',                   ha: 'Aiki mai kyau — ci gaba',                  tw: 'Adwuma pa — kɔ so' },
  'progress.explain.strong':      { en: 'Excellent farming — top tier today',         fr: 'Excellent — vous êtes au top',              sw: 'Kilimo bora — kiwango cha juu',                ha: 'Noma mai kyau — matakin sama',             tw: 'Adwuma pa paa — mu soro' },
  'progress.streak.none':         { en: 'No streak yet',                              fr: 'Aucune série',                              sw: 'Hakuna mfululizo',                             ha: 'Babu jeri',                              tw: 'Saa biara nni' },
  'progress.streak.one':          { en: '1 day active',                               fr: '1 jour actif',                              sw: 'Siku 1 hai',                                   ha: 'Yini 1 mai aiki',                       tw: 'Da koro' },
  'progress.streak.early':        { en: '{count} days started',                       fr: '{count} jours entamés',                     sw: 'Siku {count} zimeanza',                        ha: 'Kwanaki {count} sun fara',               tw: 'Nna {count} ahyɛ aseɛ' },
  'progress.streak.building':     { en: '{count} days — building momentum',           fr: '{count} jours — momentum en hausse',        sw: 'Siku {count} — kasi inajenga',                 ha: 'Kwanaki {count} — yana ƙaruwa',          tw: 'Nna {count} — kɔ soɔ' },
  'progress.streak.grace':        { en: '{count} days — check in today',              fr: '{count} jours — connectez-vous aujourd\u2019hui', sw: 'Siku {count} — angalia leo',          ha: 'Kwanaki {count} — duba yau',             tw: 'Nna {count} — hwɛ ɛnnɛ' },
  'progress.streak.strong':       { en: '{count}-day streak going',                   fr: 'Série de {count} jours',                    sw: 'Mfululizo wa siku {count}',                    ha: 'Jerin kwanaki {count}',                  tw: 'Nna {count} mu kɔ so' },
  'progress.today.empty':         { en: 'No tasks for today',                         fr: 'Aucune tâche aujourd\u2019hui',             sw: 'Hakuna kazi leo',                              ha: 'Babu aiki yau',                          tw: 'Adwuma biara nni hɔ ɛnnɛ' },
  'progress.today.allDone':       { en: 'All tasks complete',                         fr: 'Toutes les tâches terminées',               sw: 'Kazi zote zimekamilika',                       ha: 'An kammala duk ayyuka',                  tw: 'Adwuma nyinaa awie' },
  'progress.today.start':         { en: 'Start your day',                             fr: 'Commencez votre journée',                   sw: 'Anza siku yako',                               ha: 'Fara ranar ka',                          tw: 'Hyɛ wo da no aseɛ' },
  'progress.today.partial':       { en: '{done} of {total} tasks done',               fr: '{done} / {total} tâches terminées',         sw: 'Kazi {done} / {total} zimekamilika',           ha: 'An kammala {done} cikin {total}',        tw: '{done} / {total} a aw' },
  'progress.motivation.allDone':  { en: 'Great work — done for today',                fr: 'Bravo — fini pour aujourd\u2019hui',         sw: 'Kazi nzuri — leo umemaliza',                   ha: 'Madalla — kammala yau',                  tw: 'Adwuma pa — ɛnnɛ awie' },
  'progress.motivation.task':     { en: 'Next: {title}',                              fr: 'Suivant : {title}',                         sw: 'Inayofuata: {title}',                          ha: 'Na gaba: {title}',                       tw: 'Nea ɛdi hɔ: {title}' },
  'progress.next.bridge':         { en: 'Coming up',                                  fr: 'À venir',                                   sw: 'Kinachofuata',                                 ha: 'Mai zuwa',                              tw: 'Nea ɛrebɛba' },
  'progress.next.tomorrow':       { en: 'Tomorrow\u2019s plan',                       fr: 'Plan de demain',                            sw: 'Mpango wa kesho',                              ha: 'Tsarin gobe',                            tw: 'Ɔkyena nhyehyɛeɛ' },
  'progress.score.low':           { en: 'Low',                                        fr: 'Faible',                                    sw: 'Chini',                                        ha: 'Ƙasa',                                  tw: 'Sua' },
  'progress.score.fair':          { en: 'Fair',                                       fr: 'Correct',                                   sw: 'Wastani',                                      ha: 'Matsakaici',                            tw: 'Pa kakra' },
  'progress.score.good':          { en: 'Good',                                       fr: 'Bon',                                       sw: 'Nzuri',                                        ha: 'Mai kyau',                              tw: 'Pa' },
  'progress.score.strong':        { en: 'Strong',                                     fr: 'Excellent',                                 sw: 'Imara',                                        ha: 'Mai ƙarfi',                              tw: 'Den' },

  'streak.none':                  { en: 'No streak yet',                              fr: 'Aucune série',                              sw: 'Hakuna mfululizo',                             ha: 'Babu jeri',                              tw: 'Saa biara nni' },
  'streak.one':                   { en: '1 day active',                               fr: '1 jour',                                    sw: 'Siku 1',                                       ha: 'Yini 1',                                tw: 'Da koro' },
  'streak.day':                   { en: '{count} day',                                fr: '{count} jour',                              sw: 'Siku {count}',                                 ha: 'Kwana {count}',                         tw: 'Da {count}' },
  'streak.days':                  { en: '{count} days',                               fr: '{count} jours',                             sw: 'Siku {count}',                                 ha: 'Kwanaki {count}',                       tw: 'Nna {count}' },
  'streak.title':                 { en: 'Streak',                                     fr: 'Série',                                     sw: 'Mfululizo',                                    ha: 'Jeri',                                  tw: 'Saa' },
  'streak.celebrate':             { en: '{count}-day streak!',                        fr: 'Série de {count} jours !',                  sw: 'Mfululizo wa siku {count}!',                   ha: 'Jerin kwanaki {count}!',                tw: 'Nna {count} saa!' },
  'milestone.firstTask':          { en: 'First task complete',                        fr: 'Première tâche terminée',                   sw: 'Kazi ya kwanza imekamilika',                   ha: 'Aiki na farko an kammala',               tw: 'Adwuma a edi kan awie' },
  'milestone.firstHarvest':       { en: 'First harvest recorded',                     fr: 'Première récolte enregistrée',              sw: 'Mavuno ya kwanza yamerekodiwa',                ha: 'An rubuta girbi na farko',               tw: 'Otwa a edi kan a wɔatwerɛ' },
  'milestone.streak7':            { en: '7-day streak!',                              fr: 'Série de 7 jours !',                        sw: 'Mfululizo wa siku 7!',                         ha: 'Jerin kwanaki 7!',                       tw: 'Nna 7 saa!' },
  'milestone.streak30':           { en: '30-day streak!',                             fr: 'Série de 30 jours !',                       sw: 'Mfululizo wa siku 30!',                        ha: 'Jerin kwanaki 30!',                      tw: 'Nna 30 saa!' },

  // ─── Offline banner (Fix P4.11) ─────────────────────
  'offline.banner.offline':       { en: 'Offline — changes are queued',               fr: 'Hors ligne — modifications en file',         sw: 'Nje ya mtandao — mabadiliko yanasubiri',      ha: 'Ba haɗi — canje-canje a layi',           tw: 'Wonni intanɛt — nsesaeɛ retwɛn' },
  'offline.banner.syncing':       { en: 'Syncing…',                                    fr: 'Synchronisation…',                          sw: 'Inasawazisha…',                                ha: 'Ana daidaitawa…',                        tw: 'Ɛrekɔ so…' },
  'offline.banner.synced':        { en: 'All synced',                                 fr: 'Tout synchronisé',                          sw: 'Vyote vimesawazishwa',                         ha: 'An daidaita duka',                       tw: 'Nyinaa awie' },
  'offline.banner.failed':        { en: 'Some syncs failed — tap to retry',           fr: 'Échec — toucher pour réessayer',             sw: 'Baadhi haijasawazishwa — gusa upya',          ha: 'Wasu sun gaza — danna sake gwadawa',     tw: 'Bi annwie — fa wo nsa ka so' },
  'offline.banner.retry':         { en: 'Retry',                                      fr: 'Réessayer',                                 sw: 'Jaribu tena',                                  ha: 'Sake gwadawa',                           tw: 'Sɔ hwɛ' },

  // ─── Farm economics (yield + value + profit) ──
  'econ.label.estimatedYield':        { en: 'Estimated yield',            fr: 'Rendement estimé',             sw: 'Mavuno yanayokadiriwa',           ha: 'Ƙididdigar amfanin gona',              tw: 'Mfasoɔ a yɛhwɛ anim' },
  'econ.label.estimatedValue':        { en: 'Estimated value',            fr: 'Valeur estimée',               sw: 'Thamani inayokadiriwa',           ha: 'Ƙididdigar ƙima',                      tw: 'Boɔ a yɛhwɛ anim' },
  'econ.label.estimatedProfit':       { en: 'Estimated profit',           fr: 'Bénéfice estimé',              sw: 'Faida inayokadiriwa',             ha: 'Ƙididdigar riba',                      tw: 'Mfasoɔ a yɛhwɛ anim' },
  'econ.label.estimatedCost':        { en: 'Estimated cost',              fr: 'Coût estimé',                  sw: 'Gharama inayokadiriwa',           ha: 'Ƙididdigar kuɗi',                      tw: 'Sika a yɛhwɛ anim' },
  'econ.label.confidence':            { en: 'Confidence',                 fr: 'Confiance',                     sw: 'Uhakika',                         ha: 'Tabbas',                               tw: 'Gyidie' },
  'econ.confidence.low':              { en: 'Low',                        fr: 'Faible',                        sw: 'Chini',                           ha: 'Ƙasa',                                 tw: 'Ketewa' },
  'econ.confidence.medium':           { en: 'Medium',                     fr: 'Moyenne',                       sw: 'Wastani',                         ha: 'Matsakaici',                           tw: 'Ntam' },
  'econ.confidence.high':             { en: 'High',                       fr: 'Élevée',                        sw: 'Juu',                             ha: 'Babba',                                tw: 'Kɛseɛ' },
  // Yield reasons (seasonal/rainfall/stage drivers)
  'econ.reason.seasonFitHigh':        { en: 'Good seasonal conditions improve expected yield', fr: 'De bonnes conditions saisonnières améliorent le rendement', sw: 'Hali nzuri za msimu zinaboresha mavuno', ha: 'Yanayi mai kyau na lokaci yana ƙara amfanin gona', tw: 'Bere no tebea pa bɛma nneɛma aba pii' },
  'econ.reason.seasonFitLow':         { en: 'Current month is less ideal for this crop',       fr: 'Le mois actuel est moins idéal pour cette culture',           sw: 'Mwezi huu si bora kwa zao hili',         ha: 'Watan nan ba shi da kyau ga amfanin nan', tw: 'Bosome yi nsɔ nnɔbae yi ho' },
  'econ.reason.rainfallFitHigh':      { en: 'Current rainfall supports strong yield',          fr: 'Les pluies actuelles soutiennent un bon rendement',          sw: 'Mvua za sasa zinasaidia mavuno mazuri', ha: 'Ruwan saman yanzu yana tallafawa amfanin gona mai yawa', tw: 'Osu a ɛreba no boa nneɛma aba pii' },
  'econ.reason.rainfallFitLow':       { en: 'Current rainfall may reduce yield',               fr: 'Les pluies actuelles peuvent réduire le rendement',         sw: 'Mvua za sasa zinaweza kupunguza mavuno', ha: 'Ruwan saman yanzu na iya rage amfanin gona', tw: 'Osu a ɛreba no bɛtumi ateɛ nneɛma aba so' },
  'econ.reason.stagePlanningBuffer':  { en: 'Early stage — numbers are aspirational',          fr: 'Stade précoce — chiffres indicatifs',                        sw: 'Hatua ya mapema — nambari ni ya matumaini', ha: 'Farkon mataki — lambobi na fata',        tw: 'Ahyɛaseɛ — akontaabuo no yɛ anidasoɔ' },
  'econ.reason.stagePlantedBuffer':   { en: 'Just planted — wide uncertainty',                 fr: 'Vient d\u2019être planté — forte incertitude',               sw: 'Imepandwa karibuni — kutokuwa na uhakika', ha: 'An shuka kwanan nan — rashin tabbas',   tw: 'Yɛadua seesei — nnim ankasa' },
  'econ.reason.stageGrowingBuffer':   { en: 'Mid-cycle — estimates firming up',                fr: 'Mi-cycle — estimations qui se précisent',                    sw: 'Katikati ya mzunguko — makadirio yanakazi', ha: 'Tsakiyar lokaci — ƙididdiga na tabbatuwa', tw: 'Nnawɔtwe no mfimfini — akontaabuo rebu' },
  'econ.reason.stageHarvestReady':    { en: 'Harvest window — estimate is close to final',     fr: 'Fenêtre de récolte — estimation quasi finale',               sw: 'Dirisha la mavuno — makadirio yako karibu ya mwisho', ha: 'Lokacin girbi — ƙididdiga na kusa ga na ƙarshe', tw: 'Otwa bere — akontaabuo abɛn awieɛ' },
  'econ.reason.stagePostHarvest':     { en: 'Post-harvest — figures are locked in',            fr: 'Après récolte — chiffres verrouillés',                       sw: 'Baada ya mavuno — nambari zimewekwa',   ha: 'Bayan girbi — lambobi sun tabbata',      tw: 'Otwa akyi — akontaabuo no adi nsɛm' },
  'econ.reason.stageUnknown':         { en: 'Crop stage unknown — using a generic buffer',     fr: 'Stade de culture inconnu — utilise une marge générique',      sw: 'Hatua ya mazao haijulikani — matumizi ya marudio ya jumla', ha: 'Matakin amfanin gona bai sani ba — ana amfani da buffer na gama gari', tw: 'Nnɔbae nkɔso nnim — yɛde nsenkyerɛneɛ abu' },
  'econ.reason.farmTypeBackyard':     { en: 'Backyard plot — small-scale estimate',            fr: 'Parcelle de jardin — estimation à petite échelle',            sw: 'Shamba la nyuma ya nyumba — makadirio ya ukubwa mdogo', ha: 'Lambun gida — ƙididdiga ƙarami',         tw: 'Fie afuw ketewa — nsusuwiie ketewa' },
  'econ.reason.farmTypeCommercial':   { en: 'Commercial operation — higher-end of the band',   fr: 'Exploitation commerciale — haut de la fourchette',            sw: 'Shughuli ya kibiashara — upande wa juu wa bendi', ha: 'Kasuwanci — saman iyaka',              tw: 'Dwadibɔ — ɛsoro paa' },
  // Value / price reasons
  'econ.reason.localPrice':           { en: 'Estimate uses local market pricing',              fr: 'Estimation basée sur les prix du marché local',              sw: 'Makadirio yanatumia bei za soko la ndani', ha: 'Ƙididdigar na amfani da farashin kasuwa na gida', tw: 'Nsusuwiie gyina kuro mu gua boɔ so' },
  'econ.reason.globalUsdFallback':    { en: 'Using global USD price band — approximate',       fr: 'Utilise la fourchette mondiale en USD — approximatif',       sw: 'Inatumia bei ya USD ya kimataifa — takriban', ha: 'Ana amfani da farashin USD na duniya — kusan', tw: 'Yɛde wiase USD boɔ rehwɛ — bɛyɛ' },
  'econ.reason.genericPriceFallback': { en: 'No catalogued price — using a conservative default', fr: 'Aucun prix catalogué — valeur par défaut prudente',      sw: 'Hakuna bei iliyoorodheshwa — chaguo-msingi la tahadhari', ha: 'Babu farashin da aka tattara — tsoho mai kula', tw: 'Boɔ biara nni hɔ — yɛde mmra biara' },
  // Cost reasons
  'econ.reason.costConvertedLocal':   { en: 'Costs converted to your local currency',          fr: 'Coûts convertis dans votre monnaie locale',                   sw: 'Gharama zimebadilishwa kwa sarafu yako ya ndani', ha: 'An canza farashi zuwa kuɗin ku na gida', tw: 'Yɛadane sika no akɔ w\u2019abɔdwese sika mu' },
  'econ.reason.costUsdFallback':      { en: 'Cost shown in USD — no local conversion',         fr: 'Coût affiché en USD — pas de conversion locale',              sw: 'Gharama inaonyeshwa kwa USD — hakuna ubadilishaji wa ndani', ha: 'An nuna farashi a USD — babu canji na gida', tw: 'Yɛkyerɛ sika no wɔ USD mu' },
  'econ.reason.costUsdBase':          { en: 'Cost shown in USD (engine default)',              fr: 'Coût affiché en USD (valeur par défaut)',                    sw: 'Gharama inaonyeshwa kwa USD (chaguo-msingi)', ha: 'An nuna farashi a USD (tsoho)',        tw: 'Yɛkyerɛ sika no wɔ USD mu' },
  'econ.reason.profitInUsdFallback':  { en: 'Profit shown in USD — local FX unavailable',       fr: 'Bénéfice affiché en USD — taux de change local indisponible', sw: 'Faida inaonyeshwa kwa USD — ubadilishaji wa sarafu haijapatikana', ha: 'An nuna riba a USD — musayar kuɗin gida ba a samu ba', tw: 'Mfasoɔ wɔ USD mu — amantoɔ sika no nni hɔ' },
  'econ.reason.profitUnavailable':    { en: 'Profit estimate unavailable for this crop/location', fr: 'Estimation du bénéfice indisponible pour cette culture/localisation', sw: 'Makadirio ya faida hayapatikani', ha: 'Ba a samun ƙididdigar riba', tw: 'Mfasoɔ ho nsusuwiie nni hɔ' },
  'econ.reason.commercialOverhead':   { en: 'Commercial operations carry more overhead',       fr: 'Exploitations commerciales ont plus de frais généraux',       sw: 'Shughuli za kibiashara zina gharama zaidi',  ha: 'Kasuwanci yana da ƙarin kashe kuɗi',    tw: 'Dwadibɔ sika ka pii' },
  'econ.reason.backyardLowInput':     { en: 'Backyard plots need fewer inputs',                fr: 'Les petits jardins nécessitent moins d\u2019intrants',         sw: 'Mashamba madogo yanahitaji pembejeo kidogo', ha: 'Ƙananan lambuna suna buƙatar ƙaramin kayan aiki', tw: 'Fie afuw ketewa hia nneɛma kakra' },
  'econ.reason.costProfileFallback':  { en: 'No catalogued cost — using conservative defaults', fr: 'Aucun coût catalogué — valeur par défaut prudente',         sw: 'Hakuna gharama iliyoorodheshwa — chaguo-msingi la tahadhari', ha: 'Babu farashin da aka tattara — tsoho mai kula', tw: 'Sika biara nni hɔ — yɛde nnaaho abu' },
  'econ.reason.profitNegativeWarning':{ en: 'Market price may not cover costs at the low end', fr: 'Le prix du marché peut ne pas couvrir les coûts bas',         sw: 'Bei ya soko inaweza isitoshe gharama chini',  ha: 'Farashin kasuwa na iya ƙin ɗaukar farashi', tw: 'Gua so boɔ ntumi nkata sika no' },
  'econ.reason.profitRangeWide':      { en: 'Profit range is broad because market price can vary', fr: 'La fourchette de bénéfice est large — les prix varient', sw: 'Mbao ya faida ni pana kwa sababu bei ya soko inaweza kubadilika', ha: 'Faffadar tazarar riba — farashi yana canzawa', tw: 'Mfasoɔ no ntrɛmu wɔ soronko — gua boɔ bɔ' },

  // Highlight badges (secondary signal on Top Crops + farm card)
  'econ.highlight.positiveProfitRange': { en: 'Profitable expected range', fr: 'Fourchette rentable attendue',            sw: 'Mbao ya faida inayotarajiwa',           ha: 'Tazarar riba mai yiwuwa',              tw: 'Mfasoɔ pa a yɛhwɛ anim' },
  'econ.highlight.localPrice':          { en: 'Local market pricing',      fr: 'Prix du marché local',                    sw: 'Bei ya soko la ndani',                  ha: 'Farashin kasuwa na gida',              tw: 'Kuro mu gua boɔ' },
  'econ.highlight.lowCostToStart':      { en: 'Low cost to start',         fr: 'Faible coût de démarrage',                sw: 'Gharama ndogo kuanza',                  ha: 'Ƙaramin farashi don farawa',           tw: 'Ɛnhia sika pii' },
  'econ.highlight.higherValuePotential':{ en: 'Higher value potential',    fr: 'Potentiel de valeur plus élevée',         sw: 'Uwezo wa thamani kubwa',                ha: 'Damar ƙima mai yawa',                  tw: 'Boɔ kɛseɛ hokwan' },

  // ─── Dashboard insights ────────────────────────────────
  'insights.title':                       { en: 'Today\u2019s Insights',                fr: 'Insights du jour',                       sw: 'Maarifa ya Leo',                          ha: 'Fahimtar Yau',                          tw: 'Ɛnnɛ nkyerɛkyerɛmu' },
  // Weather-based
  'insight.water.stress.msg':             { en: 'Water stress risk',                    fr: 'Risque de stress hydrique',              sw: 'Hatari ya mkazo wa maji',                 ha: 'Hadarin rashin ruwa',                   tw: 'Nsu a ɛnnɔɔso asiane' },
  'insight.water.stress.reason':          { en: 'Current dry conditions may slow establishment', fr: 'Les conditions sèches peuvent ralentir la croissance', sw: 'Ukavu unaweza kupunguza kustawi', ha: 'Busasshen yanayi na iya rage farawa', tw: 'Ɔpɛ tebea bɛtumi atɛ adwumayɛ no so' },
  'insight.water.stress.action':          { en: 'Plan irrigation or water conservation today', fr: 'Prévoir l\u2019irrigation ou la conservation de l\u2019eau', sw: 'Panga umwagiliaji au uhifadhi wa maji leo', ha: 'Tsara ban ruwa ko adana ruwa yau', tw: 'Hyɛ nsu gu ho nhyehyɛeɛ ɛnnɛ' },
  'insight.water.stress.action.simple':   { en: 'Water plants in the cool of morning',  fr: 'Arrosez les plantes tôt le matin',        sw: 'Mwagilia mimea asubuhi baridi',          ha: 'Shayar da shuke-shuke da safe',          tw: 'Gu nsu wɔ anɔpa sakra' },
  'insight.flood.risk.msg':               { en: 'Flooding risk',                        fr: 'Risque d\u2019inondation',                sw: 'Hatari ya mafuriko',                     ha: 'Hadarin ambaliya',                      tw: 'Nsu a ɛhyɛ ma asiane' },
  'insight.flood.risk.reason':            { en: 'Heavy rain may cause root rot or wash-out', fr: 'Les fortes pluies peuvent causer la pourriture ou l\u2019érosion', sw: 'Mvua nyingi zinaweza kusababisha kuoza kwa mizizi', ha: 'Ruwan sama mai yawa na iya haifar da lalacewar tushen', tw: 'Osu a ɛba pii bɛtumi asɛe ntini' },
  'insight.flood.risk.action':            { en: 'Clear drainage channels and watch for disease', fr: 'Dégagez le drainage et surveillez les maladies', sw: 'Safisha mifereji na angalia magonjwa', ha: 'Share magudanan ruwa ka lura da cututtuka', tw: 'Yi nsu no kwan ne hwɛ yadeɛ so' },
  'insight.rainfall.supports.msg':        { en: 'Current rainfall supports this crop',   fr: 'Les pluies actuelles soutiennent cette culture', sw: 'Mvua za sasa zinasaidia zao hili',      ha: 'Ruwan saman yanzu yana tallafawa amfanin nan', tw: 'Osu a ɛreba no boa nnɔbae yi' },
  // Seasonal mismatch
  'insight.season.mismatch.msg':          { en: 'Current timing is less ideal for this crop', fr: 'Le moment actuel est moins idéal pour cette culture', sw: 'Wakati wa sasa si bora kwa zao hili', ha: 'Lokacin yanzu ba shi da kyau ga amfanin nan', tw: 'Seesei bere nsɔ nnɔbae yi ho' },
  'insight.season.mismatch.reason':       { en: 'Usually planted earlier or later in your area', fr: 'Habituellement planté plus tôt ou plus tard dans votre région', sw: 'Kawaida hupandwa mapema au baadaye katika eneo lako', ha: 'Akan shuka da wuri ko daga baya a yankinku', tw: 'Wɔtaa dua ntɛm anaa akyire wɔ w\u2019amantoɔ mu' },
  'insight.season.mismatch.action':       { en: 'Plan for a better window next cycle',  fr: 'Planifier une meilleure fenêtre au prochain cycle',  sw: 'Panga dirisha bora kipindi kijacho',     ha: 'Shirya lokaci mai kyau na gaba',         tw: 'Hyɛ bere pa nsa mma bere foforɔ' },
  // Yield opportunity
  'insight.yield.opportunity.msg':        { en: 'Favorable conditions may improve yield', fr: 'Des conditions favorables peuvent améliorer le rendement', sw: 'Hali nzuri zinaweza kuongeza mavuno', ha: 'Yanayi mai kyau na iya ƙara amfanin gona', tw: 'Tebea pa bɛtumi ama nneɛma aba pii' },
  'insight.yield.opportunity.reason':     { en: 'Both season and rainfall look supportive', fr: 'La saison et les pluies semblent favorables', sw: 'Msimu na mvua zinaonekana kusaidia',    ha: 'Lokaci da ruwan sama duka suna tallafawa', tw: 'Bere ne osu nyinaa yɛ pa' },
  'insight.yield.favorable.msg':          { en: 'Conditions are favorable for planting',  fr: 'Les conditions sont favorables à la plantation', sw: 'Hali ni nzuri kwa kupanda',            ha: 'Yanayi na da kyau don shuka',            tw: 'Tebea no yɛ ma adua' },
  // Profit outlook
  'insight.profit.strong.msg':            { en: 'High-value crop under good conditions',  fr: 'Culture à forte valeur dans de bonnes conditions', sw: 'Zao la thamani kubwa chini ya hali nzuri', ha: 'Amfanin gona mai ƙima a yanayi mai kyau', tw: 'Nnɔbae a ne boɔ kɔ soro wɔ tebea pa mu' },
  'insight.profit.strong.msg.commercial': { en: 'Strong gross-margin range under current conditions', fr: 'Fourchette de marge brute solide dans les conditions actuelles', sw: 'Mbao imara ya faida chini ya hali za sasa', ha: 'Ingantaccen tazarar ribar kasuwanci a yanayin yanzu', tw: 'Mfasoɔ a ɛyɛ den wɔ tebea yi mu' },
  'insight.profit.tight.msg':             { en: 'Market price may not cover costs at current scale', fr: 'Le prix du marché peut ne pas couvrir les coûts', sw: 'Bei ya soko inaweza isitoshe gharama',   ha: 'Farashin kasuwa na iya ƙin ɗaukar farashi', tw: 'Gua so boɔ ntumi nkata sika no' },
  'insight.profit.tight.reason':          { en: 'Consider a higher-value crop or larger plot', fr: 'Envisagez une culture à plus forte valeur ou une parcelle plus grande', sw: 'Fikiria zao la thamani kubwa au shamba kubwa', ha: 'Yi la\u2019akari da amfanin gona mai ƙima ko babban gona', tw: 'Dwene nnɔbae a ne boɔ kɔ soro anaa afuw kɛseɛ ho' },
  // Confidence
  'insight.confidence.low.msg':           { en: 'Limited data — estimates may vary',     fr: 'Données limitées — les estimations peuvent varier', sw: 'Data ndogo — makadirio yanaweza kubadilika', ha: 'Ƙarancin bayanai — ƙididdiga na iya bambanta', tw: 'Nsɛm a ɛyɛ ketewa — akontaabuo bɛsesa' },
  'insight.confidence.low.reason':        { en: 'Fill in farm details to sharpen recommendations', fr: 'Remplissez les détails de la ferme pour affiner', sw: 'Jaza maelezo ya shamba ili kuboresha mapendekezo', ha: 'Cika bayanan gona don inganta shawarwari', tw: 'Kyerɛ afuw ho nsɛm na nyansakyerɛ no yɛ yie' },
  // Stage-based — one key per stage, plus .simple + .commercial variants fall back automatically
  'insight.stage.planting.msg':           { en: 'Planting stage — prepare soil and plant cleanly', fr: 'Plantation — préparez le sol et plantez proprement', sw: 'Hatua ya kupanda — tayarisha udongo', ha: 'Matakin shuka — shirya ƙasa sosai',      tw: 'Adua anammɔn — siesie asaase' },
  'insight.stage.planting.action':        { en: 'Check seed depth and spacing',           fr: 'Vérifiez la profondeur et l\u2019espacement',       sw: 'Kagua kina cha mbegu na nafasi',        ha: 'Duba zurfin iri da nisa',              tw: 'Hwɛ aba no mu ne ne ntam' },
  'insight.stage.seedling.msg':           { en: 'Seedling stage — keep beds moist and weed-free', fr: 'Stade semis — gardez les lits humides et sans mauvaises herbes', sw: 'Hatua ya mbegu — weka vitanda vyenye unyevu bila magugu', ha: 'Matakin \u2019ya\u2019yan shuka — kiyaye gadaje da danshi', tw: 'Nhwiren anammɔn — ma nsuo nka ho' },
  'insight.stage.seedling.action':        { en: 'Thin weak seedlings so strong ones thrive', fr: 'Éclaircissez les semis faibles',          sw: 'Punguza mbegu dhaifu',                   ha: 'Rage \u2019ya\u2019yan shuka masu rauni', tw: 'Yi nhwiren a ɛnyɛ den no firi ho' },
  'insight.stage.germination.msg':        { en: 'Germination — guard young plants from birds and pests', fr: 'Germination — protégez des oiseaux et ravageurs', sw: 'Kuota — linda mimea michanga', ha: 'Tsiro — kare \u2019ya\u2019yan shuka daga tsuntsaye da kwari', tw: 'Afifire — bɔ nhwiren mmɔfra ho ban' },
  'insight.stage.germination.action':     { en: 'Walk the field early; cover emerged rows', fr: 'Parcourez le champ tôt',                 sw: 'Tembea shambani mapema',                  ha: 'Yi yawo a gona da wuri',                tw: 'Nantew wo afuw so anɔpa' },
  'insight.stage.establishment.msg':      { en: 'Establishment — keep weeds down and gaps filled', fr: 'Établissement — contrôlez les mauvaises herbes', sw: 'Kustawi — ondoa magugu',            ha: 'Kafuwa — sarrafa ciyawa',              tw: 'Nyinasoɔ — yi mfuw' },
  'insight.stage.establishment.action':   { en: 'Replant gaps and shallow-hoe between rows', fr: 'Replantez les trous',                    sw: 'Panda sehemu zilizokosa',                ha: 'Sake shuka inda aka manta',            tw: 'San dua bea a ɛho da hɔ' },
  'insight.stage.vegetative.msg':         { en: 'Vegetative stage — focus on healthy leaf growth', fr: 'Stade végétatif — concentrez-vous sur la croissance des feuilles', sw: 'Hatua ya mimea — lenga ukuaji wa majani', ha: 'Matakin girma — mayar da hankali kan ganye', tw: 'Afifire anammɔn — hwɛ nhahan ba pa so' },
  'insight.stage.vegetative.action':      { en: 'Check leaf colour and control weeds early', fr: 'Vérifiez la couleur des feuilles et contrôlez les mauvaises herbes', sw: 'Angalia rangi ya majani na ondoa magugu', ha: 'Duba launin ganye kuma sarrafa ciyawa', tw: 'Hwɛ nhahan kɔla' },
  'insight.stage.tasseling.msg':          { en: 'Tasseling — keep moisture steady',       fr: 'Floraison mâle — maintenez une humidité stable',   sw: 'Kutupa — hifadhi unyevu',             ha: 'Tasal — kiyaye danshi',               tw: 'Tasseling — ma nsu nka ho' },
  'insight.stage.tasseling.action':       { en: 'Water stress now hits yield hardest',    fr: 'Le stress hydrique ici réduit le plus le rendement', sw: 'Mkazo wa maji sasa hupunguza mavuno', ha: 'Rashin ruwa yanzu yana cutar da amfanin gona', tw: 'Nsu a ɛyera seesei dane nneɛma aba paa' },
  'insight.stage.flowering.msg':          { en: 'Flowering — water evenly; scout for pests', fr: 'Floraison — arrosez uniformément',        sw: 'Maua — mwagilia sawasawa',               ha: 'Furanni — shayar da ruwa daidai',       tw: 'Anhyehyɛ anammɔn — gu nsu pɛpɛɛpɛ' },
  'insight.stage.flowering.action':       { en: 'Uneven water at flowering drops fruit set', fr: 'Une eau inégale à la floraison réduit la nouaison', sw: 'Maji yasiyo sawa wakati wa maua yanapunguza uzalishaji', ha: 'Ruwa mara daidai a lokacin furanni yana cutar da \u2019ya\u2019ya', tw: 'Nsu a ɛnyɛ pɛpɛɛpɛ anhyehyɛ bere bɔ aba so' },
  'insight.stage.fruiting.msg':           { en: 'Fruiting — support plants; watch for disease', fr: 'Fructification — soutenez les plantes',     sw: 'Kuzaa — tegemeza mimea',                ha: 'Yin \u2019ya\u2019ya — tallafa wa shuke-shuke', tw: 'Aba bere — fa nneɛma foa mmerɛ' },
  'insight.stage.fruiting.action':        { en: 'Tie stems and pick fruit regularly',     fr: 'Attachez les tiges et récoltez régulièrement', sw: 'Funga mashina na vuna mara kwa mara', ha: 'Ɗaure kututture da ɗebo \u2019ya\u2019ya', tw: 'Kyekyere ne dua na twa aba bere ne bere' },
  'insight.stage.bulking.msg':            { en: 'Bulking stage — avoid waterlogging; top-dress if planned', fr: 'Tubérisation — évitez l\u2019engorgement', sw: 'Hatua ya kuongezeka — epuka kufurika', ha: 'Matakin kumbura — guje wa ruwa da yawa', tw: 'Obulking anammɔn — twe nsu a ɛdɔɔso ho' },
  'insight.stage.bulking.action':         { en: 'Clear drainage channels',                fr: 'Dégagez les canaux de drainage',          sw: 'Safisha mifereji',                       ha: 'Share magudanan ruwa',                  tw: 'Yi nsu no kwan' },
  'insight.stage.pod_fill.msg':           { en: 'Pod fill — scout for borers and leaf spot', fr: 'Remplissage des gousses — surveillez',     sw: 'Kujaza ganda — angalia wadudu na madoa', ha: 'Cikakken furanni — bincika kwari',    tw: 'Pod fill — hwɛ mmoa na ahinanim' },
  'insight.stage.pod_fill.action':        { en: 'Check lower leaves weekly',              fr: 'Inspectez les feuilles inférieures chaque semaine', sw: 'Kagua majani ya chini kila wiki',   ha: 'Bincika ganye na ƙasa kowace mako',     tw: 'Hwɛ nhahan a ɛwɔ ase nnawɔtwe biara' },
  'insight.stage.grain_fill.msg':         { en: 'Grain fill — monitor ears for damage',   fr: 'Remplissage du grain — inspectez les épis', sw: 'Kujaza nafaka — angalia masikio',     ha: 'Cika hatsin — bincika kuraye',        tw: 'Aburoo mu hyɛ — hwɛ asin' },
  'insight.stage.grain_fill.action':      { en: 'Peel back a few husks to inspect',       fr: 'Retirez quelques enveloppes pour inspecter', sw: 'Toa maganda machache uchunguze',     ha: 'Tuɓe \u2019yan bawo don dubawa',         tw: 'Yi ntokuro kakra fa hwɛ' },
  'insight.stage.maturation.msg':         { en: 'Maturation — plan harvest logistics',    fr: 'Maturation — planifiez la récolte',       sw: 'Kukomaa — panga ujazaji mavuno',         ha: 'Balagaggu — shirya girbi',             tw: 'Nyinakyɛ — hyɛ otwa ho nsa' },
  'insight.stage.maturation.action':      { en: 'Line up bags, buyers, and transport',    fr: 'Préparez sacs, acheteurs et transport',   sw: 'Andaa mifuko, wanunuzi, na usafirishaji', ha: 'Shirya buhuna, masu siye, da sufuri', tw: 'Siesie nkotokuo ne nnipa a wɔtɔ' },
  'insight.stage.harvest.msg':            { en: 'Harvest window — cut on dry days; dry + store quickly', fr: 'Fenêtre de récolte — coupez par temps sec', sw: 'Dirisha la mavuno — vuna siku kavu', ha: 'Lokacin girbi — girba a ranakun bushe', tw: 'Otwa bere — twa wɔ bere a ɛwoɔ' },
  'insight.stage.harvest.action':         { en: 'Record harvest weight so estimates stay calibrated', fr: 'Enregistrez le poids pour calibrer les estimations', sw: 'Rekodi uzito wa mavuno', ha: 'Rubuta nauyin girbi', tw: 'Twerɛ otwa duru' },
  'insight.stage.generic.msg':            { en: 'Check your crop daily and keep notes',   fr: 'Inspectez votre culture chaque jour',     sw: 'Angalia zao lako kila siku',             ha: 'Duba amfanin gonar ka kowace rana',     tw: 'Hwɛ wo nnɔbae da biara' },
  'insight.generic.checkDaily.msg':       { en: 'Check your crop daily and keep short notes', fr: 'Inspectez votre culture et notez brièvement', sw: 'Angalia zao lako kila siku na andika maelezo mafupi', ha: 'Duba amfanin gona kowace rana kuma rubuta gajerun bayanai', tw: 'Hwɛ wo nnɔbae da biara na twerɛ nsɛm tiaa' },

  // ═══════════════════════════════════════════════════════════
  //  CROP SUMMARY — A-Z crop plan screen
  // ═══════════════════════════════════════════════════════════
  'cropSummary.harvestTime': { en: 'Harvest', fr: 'Récolte', sw: 'Mavuno', ha: 'Girbi', tw: 'Otwa bere' },
  'cropSummary.waterNeed': { en: 'Water', fr: 'Eau', sw: 'Maji', ha: 'Ruwa', tw: 'Nsu' },
  'cropSummary.effort': { en: 'Effort', fr: 'Effort', sw: 'Juhudi', ha: 'Ƙoƙari', tw: 'Mmɔden' },
  'cropSummary.stages': { en: 'Main Stages', fr: 'Étapes principales', sw: 'Hatua Kuu', ha: 'Matakai Muhimmai', tw: 'Anammɔn Titiriw' },
  'cropSummary.whatYouNeed': { en: 'What You Need', fr: 'Ce dont vous avez besoin', sw: 'Unachohitaji', ha: 'Abin da kuke buƙata', tw: 'Nea Wohia' },
  'cropSummary.mainRisks': { en: 'Main Risks', fr: 'Risques principaux', sw: 'Hatari Kuu', ha: 'Haɗurra Muhimmai', tw: 'Asiane Titiriw' },
  'cropSummary.economics': { en: 'Simple Economics', fr: 'Économie simple', sw: 'Uchumi Rahisi', ha: 'Tattalin Arzikin Sauƙi', tw: 'Sika Ho Nsɛm' },
  'cropSummary.costLevel': { en: 'Startup cost', fr: 'Coût de démarrage', sw: 'Gharama ya kuanza', ha: 'Kudin farawa', tw: 'Sika a ɛhia' },
  'cropSummary.laborLevel': { en: 'Labor needed', fr: 'Main d\'oeuvre', sw: 'Kazi inayohitajika', ha: 'Aikin da ake buƙata', tw: 'Adwumayɛfoɔ a ɛhia' },
  'cropSummary.marketPotential': { en: 'Market potential', fr: 'Potentiel de marché', sw: 'Uwezekano wa soko', ha: 'Damar kasuwa', tw: 'Aguadeɛ mu mfasoɔ' },
  'cropSummary.whyFits': { en: 'Why This Crop Fits You', fr: 'Pourquoi cette culture vous convient', sw: 'Kwa Nini Zao Hili Linakufaa', ha: 'Me Ya Sa Wannan Amfanin Gona Ya Dace', tw: 'Deɛn Nti na Nnɔbae Yi Fata Wo' },
  'cropSummary.startPlan': { en: 'Start Growing This Crop', fr: 'Commencer cette culture', sw: 'Anza Kulima Zao Hili', ha: 'Fara Noman Wannan Amfanin Gona', tw: 'Hyɛ Nnɔbae Yi Ase' },
  'cropSummary.starting': { en: 'Setting up...', fr: 'Configuration...', sw: 'Inasanidi...', ha: 'Ana shirya...', tw: 'Ɛresiesie...' },
  'cropSummary.startHint': { en: 'This sets your crop and starts daily guidance.', fr: 'Cela configure votre culture et lance le guidage quotidien.', sw: 'Hii inaweka zao lako na kuanza mwongozo wa kila siku.', ha: 'Wannan zai saita amfanin gonan ku kuma fara jagora na yau da kullum.', tw: 'Eyi de wo nnɔbae to hɔ na ɛhyɛ daa nkyerɛkyerɛ ase.' },
  'cropSummary.startError': { en: 'Could not start the plan. Please try again.', fr: 'Impossible de démarrer le plan. Veuillez réessayer.', sw: 'Haikuweza kuanza mpango. Tafadhali jaribu tena.', ha: 'Ba a iya fara shirin ba. Don Allah sake gwadawa.', tw: 'Yɛantumi amfi adwuma no ase. Yɛsrɛ wo, san hwehwe.' },

  // ─── Stage names ──
  'cropSummary.stage.land_prep': { en: 'Prepare your land', fr: 'Préparer le terrain', sw: 'Tayarisha ardhi yako', ha: 'Shirya ƙasar ku', tw: 'Siesie wo asase' },
  'cropSummary.stage.planting': { en: 'Plant your crop', fr: 'Planter votre culture', sw: 'Panda zao lako', ha: 'Shuka amfanin gona', tw: 'Dua wo nnɔbae' },
  'cropSummary.stage.early_growth': { en: 'Early growth care', fr: 'Soins de début de croissance', sw: 'Utunzaji wa ukuaji wa mapema', ha: 'Kulawa lokacin farkon girma', tw: 'Mfitiaseɛ mu nhwɛsoɔ' },
  'cropSummary.stage.maintenance': { en: 'Protect and maintain', fr: 'Protéger et entretenir', sw: 'Linda na utunze', ha: 'Kare da kuma kula', tw: 'Bɔ ho ban na hwɛ so' },
  'cropSummary.stage.harvest': { en: 'Harvest your crop', fr: 'Récolter votre culture', sw: 'Vuna zao lako', ha: 'Girbe amfanin gona', tw: 'Twa wo nnɔbae' },
  'cropSummary.stage.post_harvest': { en: 'Dry, store, or sell', fr: 'Sécher, stocker ou vendre', sw: 'Kausha, hifadhi, au uza', ha: 'Bushe, ajiye, ko sayar', tw: 'Hwie awo, kora, anaa tɔn' },

  // ─── Need items ──
  'cropSummary.need.seeds': { en: 'Seeds', fr: 'Semences', sw: 'Mbegu', ha: 'Iri', tw: 'Aba' },
  'cropSummary.need.cuttings': { en: 'Stem cuttings', fr: 'Boutures', sw: 'Vipandikizi', ha: 'Yankan kara', tw: 'Dua ntwanoo' },
  'cropSummary.need.vine_cuttings': { en: 'Vine cuttings', fr: 'Boutures de vigne', sw: 'Vipandikizi vya mzabibu', ha: 'Yankan kara', tw: 'Ntwanoo' },
  'cropSummary.need.suckers': { en: 'Suckers', fr: 'Rejets', sw: 'Machipukizi', ha: 'Keɓaɓɓun itace', tw: 'Nsono' },
  'cropSummary.need.seedlings': { en: 'Seedlings', fr: 'Plants', sw: 'Miche', ha: 'Shuke-shuke', tw: 'Nfifideɛ' },
  'cropSummary.need.seed_potatoes': { en: 'Seed potatoes', fr: 'Semences de pomme de terre', sw: 'Mbegu za viazi', ha: 'Irin dankali', tw: 'Aborɔdeɛ aba' },
  'cropSummary.need.fertilizer': { en: 'Fertilizer', fr: 'Engrais', sw: 'Mbolea', ha: 'Taki', tw: 'Asase aduro' },
  'cropSummary.need.water': { en: 'Water', fr: 'Eau', sw: 'Maji', ha: 'Ruwa', tw: 'Nsu' },
  'cropSummary.need.labor': { en: 'Labor / help', fr: 'Main d\'oeuvre', sw: 'Vibarua / msaada', ha: 'Ma\'aikata / taimako', tw: 'Adwumayɛfoɔ / mmoa' },
  'cropSummary.need.basic_tools': { en: 'Basic tools (hoe, machete)', fr: 'Outils de base (houe, machette)', sw: 'Vifaa vya msingi (jembe, panga)', ha: 'Kayan aiki na farko (fartanya, adda)', tw: 'Nnwinnade (sɔsɔ, sekan)' },
  'cropSummary.need.pesticide': { en: 'Pesticide / spray', fr: 'Pesticide / pulvérisateur', sw: 'Dawa ya wadudu', ha: 'Maganin kwari', tw: 'Nnɔbae aduro' },
  'cropSummary.need.stakes': { en: 'Stakes / supports', fr: 'Tuteurs / supports', sw: 'Fito / vitegemeo', ha: 'Sanda / goyon baya', tw: 'Nnua a wɔde si so' },
  'cropSummary.need.shade_trees': { en: 'Shade trees', fr: 'Arbres d\'ombre', sw: 'Miti ya kivuli', ha: 'Itatuwan inuwa', tw: 'Nnua a ɛyɛ nwini' },
  'cropSummary.need.transport': { en: 'Transport', fr: 'Transport', sw: 'Usafiri', ha: 'Sufuri', tw: 'Akwantu' },

  // ─── Risk items ──
  'cropSummary.risk.drought': { en: 'Drought can damage crop', fr: 'La sécheresse peut endommager', sw: 'Ukame unaweza kuharibu zao', ha: 'Fari na iya lalata amfani', tw: 'Ɔpɛ bɛtumi asɛe nnɔbae' },
  'cropSummary.risk.pests': { en: 'Watch for pests', fr: 'Attention aux ravageurs', sw: 'Angalia wadudu', ha: 'Lura da kwari', tw: 'Hwɛ mmoa a wɔsɛe nnɔbae' },
  'cropSummary.risk.disease': { en: 'Risk of crop disease', fr: 'Risque de maladie', sw: 'Hatari ya magonjwa ya mazao', ha: 'Haɗarin cutar amfani', tw: 'Nnɔbae yareɛ ho asiane' },
  'cropSummary.risk.poor_storage': { en: 'Store properly to avoid loss', fr: 'Bien stocker pour éviter les pertes', sw: 'Hifadhi vizuri kuepuka hasara', ha: 'Ajiye da kyau don guje asara', tw: 'Kora yie na woammɔne' },
  'cropSummary.risk.low_market_price': { en: 'Market price can drop', fr: 'Le prix du marché peut baisser', sw: 'Bei ya soko inaweza kushuka', ha: 'Farashin kasuwa na iya faɗuwa', tw: 'Aguadeɛ bo bɛtumi atɔ fam' },

  // ═══════════════════════════════════════════════════════════
  //  LOCATION — intake question options
  // ═══════════════════════════════════════════════════════════
  'cropFit.q.location': { en: 'Where is your farm?', fr: 'Où est votre ferme ?', sw: 'Shamba lako liko wapi?', ha: 'Ina gonar ku take?', tw: 'Wo afuo wɔ he?' },
  'cropFit.hint.location': { en: 'This helps us give you the right daily tasks.', fr: 'Cela nous aide à vous donner les bonnes tâches quotidiennes.', sw: 'Hii inasaidia kukupa kazi sahihi za kila siku.', ha: 'Wannan zai taimaka mana ba ka aikin yau da kullum daidai.', tw: 'Eyi boa yɛn ma yɛma wo daa adwuma a ɛfata.' },
  'cropFit.q.country': { en: 'Select your country', fr: 'Sélectionnez votre pays', sw: 'Chagua nchi yako', ha: 'Zaɓi ƙasarka', tw: 'Paw wo ɔman' },
  'cropFit.hint.country': { en: 'Pick the country your farm is in.', fr: 'Choisissez le pays de votre ferme.', sw: 'Chagua nchi ambapo shamba lako liko.', ha: 'Zaɓi ƙasar da gonarka take.', tw: 'Paw ɔman a w\'afuo wɔ mu.' },
  'cropFit.q.land': { en: 'Tell us about your land', fr: 'Parlez-nous de votre terrain', sw: 'Tuambie kuhusu ardhi yako', ha: 'Gaya mana game da ƙasarka', tw: 'Ka w\'asase ho asɛm kyerɛ yɛn' },
  'cropFit.hint.land': { en: 'This helps us guide you better. You can skip this.', fr: 'Cela nous aide à mieux vous guider. Vous pouvez passer.', sw: 'Hii inatusaidia kukuongoza vizuri zaidi. Unaweza kuruka.', ha: 'Wannan zai taimaka mana jagorarka sosai. Za ka iya tsallake.', tw: 'Eyi boa yɛn ma yɛkyerɛ wo ɔkwan yiye. Wobɛtumi atwa mu.' },
  'cropFit.land.cleared':    { en: 'Already cleared', fr: 'Déjà dégagé', sw: 'Imesafishwa', ha: 'An tsabtace', tw: 'Atwitwa ho dada' },
  'cropFit.land.notCleared': { en: 'Not cleared yet', fr: 'Pas encore dégagé', sw: 'Bado haijasafishwa', ha: 'Ba a tsabtace ba tukuna', tw: 'Wontwitwaa ho' },
  'cropFit.loc.eastAfrica': { en: 'East Africa (Kenya, Tanzania, Uganda...)', fr: 'Afrique de l\'Est (Kenya, Tanzanie, Ouganda...)', sw: 'Afrika Mashariki (Kenya, Tanzania, Uganda...)', ha: 'Gabashin Afrika (Kenya, Tanzania, Uganda...)', tw: 'Apueeɛ Afrika (Kenya, Tanzania, Uganda...)' },
  'cropFit.loc.westAfrica': { en: 'West Africa (Nigeria, Ghana, Senegal...)', fr: 'Afrique de l\'Ouest (Nigéria, Ghana, Sénégal...)', sw: 'Afrika Magharibi (Nigeria, Ghana, Senegal...)', ha: 'Yammacin Afrika (Nijeriya, Ghana, Senegal...)', tw: 'Atɔeɛ Afrika (Nigeria, Ghana, Senegal...)' },
  'cropFit.loc.southernAfrica': { en: 'Southern Africa (Zambia, Malawi, Zimbabwe...)', fr: 'Afrique australe (Zambie, Malawi, Zimbabwe...)', sw: 'Kusini mwa Afrika (Zambia, Malawi, Zimbabwe...)', ha: 'Kudancin Afrika (Zambia, Malawi, Zimbabwe...)', tw: 'Anafoɔ Afrika (Zambia, Malawi, Zimbabwe...)' },
  'cropFit.loc.centralAfrica': { en: 'Central Africa (DRC, Cameroon, Congo...)', fr: 'Afrique centrale (RDC, Cameroun, Congo...)', sw: 'Afrika ya Kati (DRC, Kamerun, Kongo...)', ha: 'Tsakiyar Afrika (DRC, Kamaru, Kongo...)', tw: 'Mfinimfini Afrika (DRC, Cameroon, Congo...)' },
  'cropFit.loc.other': { en: 'My country is not listed', fr: 'Mon pays n\'est pas listé', sw: 'Nchi yangu haijaorodheshwa', ha: 'Ƙasata ba ta cikin jerin', tw: 'Me ɔman nni nkyerɛmu yi mu' },

  // ═══════════════════════════════════════════════════════════
  //  BEGINNER PROMPT — dashboard entry
  // ═══════════════════════════════════════════════════════════
  'beginner.title': { en: 'New to farming?', fr: 'Nouveau en agriculture ?', sw: 'Mpya katika kilimo?', ha: 'Sabon shiga noma?', tw: 'Afuoyɛ yɛ wo foforɔ?' },
  'beginner.subtitle': { en: 'We\'ll help you choose the right crop and guide you every day.', fr: 'On vous aide à choisir la bonne culture et on vous guide chaque jour.', sw: 'Tutakusaidia kuchagua zao sahihi na kukuongoza kila siku.', ha: 'Za mu taimake ku zaɓi amfanin gona mai kyau kuma mu jagorance ku kowace rana.', tw: 'Yɛbɛboa wo apaw nnɔbae pa na yɛakyerɛ wo kwan daa.' },
  'beginner.cta': { en: 'Find My Best Crop', fr: 'Trouver ma meilleure culture', sw: 'Tafuta Zao Langu Bora', ha: 'Nemo Amfanin Gona na Mafi Kyau', tw: 'Hwehwɛ Me Nnɔbae Pa' },
  'beginner.findCrop': { en: 'Find My Best Crop', fr: 'Trouver ma meilleure culture', sw: 'Tafuta Zao Langu Bora', ha: 'Nemo Amfanin Gona na Mafi Kyau', tw: 'Hwehwɛ Me Nnɔbae Pa' },

  // ═══════════════════════════════════════════════════════════
  //  CROP TASKS — stage-to-task mapping labels
  // ═══════════════════════════════════════════════════════════
  'cropTask.gatherInputs': { en: 'Gather seeds, tools, and inputs', fr: 'Rassembler semences, outils et intrants', sw: 'Kusanya mbegu, zana na pembejeo', ha: 'Tattara iri, kayan aiki da abubuwan amfani', tw: 'Boaboa aba, nnwinnade ne nneɛma ano' },

  // ─── MAIZE-specific lifecycle tasks (V2 reference crop) ──
  'cropTask.maize.clearField': { en: 'Clear your maize field', fr: 'Défricher votre champ de maïs', sw: 'Safisha shamba la mahindi', ha: 'Share gonar masara', tw: 'Twitwa wo aburo afuo' },
  'cropTask.maize.prepareLand': { en: 'Loosen the soil for maize', fr: 'Ameublir le sol pour le maïs', sw: 'Laini udongo kwa mahindi', ha: 'Sassauta ƙasa don masara', tw: 'Dwodwo asase no ma aburo' },
  'cropTask.maize.markRows': { en: 'Mark planting rows with proper spacing', fr: 'Marquer les lignes avec bon espacement', sw: 'Weka alama za mistari kwa nafasi sahihi', ha: 'Alama layukan shuka da tazara mai kyau', tw: 'Yɛ ntam a wobɛdua no nkyekyɛmu' },
  'cropTask.maize.gatherInputs': { en: 'Gather seeds, fertilizer, and tools', fr: 'Rassembler semences, engrais, outils', sw: 'Kusanya mbegu, mbolea, na zana', ha: 'Tattara iri, taki, da kayan aiki', tw: 'Boaboa aba, nkwansuade, ne nnwinnade' },
  'cropTask.maize.plantSeeds': { en: 'Plant your maize seeds', fr: 'Semer le maïs', sw: 'Panda mbegu za mahindi', ha: 'Shuka irin masara', tw: 'Dua aburo aba' },
  'cropTask.maize.waterAfterPlanting': { en: 'Water the seeds', fr: 'Arroser les semences', sw: 'Mwagilia mbegu', ha: 'Shayar irin', tw: 'Gu nsu gu aba no so' },
  'cropTask.maize.confirmSpacing': { en: 'Check row and seed spacing', fr: 'Vérifier l\'espacement des semences', sw: 'Angalia nafasi ya mistari', ha: 'Bincika tazarar layuka', tw: 'Hwɛ ntam a ɛda nnua no ntam' },
  'cropTask.maize.checkGermination': { en: 'Check that maize is sprouting', fr: 'Vérifier la levée du maïs', sw: 'Angalia mahindi yanamea', ha: 'Bincika ko masara na tsirowa', tw: 'Hwɛ sɛ aburo refifiri' },
  'cropTask.maize.firstWeeding': { en: 'First weeding — clear early weeds', fr: 'Premier désherbage', sw: 'Palizi ya kwanza', ha: 'Cire na farko', tw: 'Wura titiriw a ɛdi kan' },
  'cropTask.maize.monitorWater': { en: 'Check soil moisture for maize', fr: 'Vérifier l\'humidité du sol', sw: 'Angalia unyevu wa udongo', ha: 'Bincika danshin ƙasa', tw: 'Hwɛ asase no fɔmu' },
  'cropTask.maize.applyFertilizer': { en: 'Apply fertilizer to your maize', fr: 'Appliquer l\'engrais au maïs', sw: 'Weka mbolea kwa mahindi', ha: 'Zuba taki ga masara', tw: 'Gu nkwansuade gu aburo so' },
  'cropTask.maize.weedField': { en: 'Weed around your maize', fr: 'Désherber autour du maïs', sw: 'Palilia karibu na mahindi', ha: 'Cire ciyawa kusa da masara', tw: 'Popa aburo no ho wura' },
  'cropTask.maize.checkPests': { en: 'Scout maize for pests', fr: 'Vérifier les ravageurs sur le maïs', sw: 'Kagua wadudu kwa mahindi', ha: 'Bincika kwari a masara', tw: 'Hwɛ mmoawa wɔ aburo no so' },
  'cropTask.maize.monitorWaterFlower': { en: 'Keep soil moist during tasseling', fr: 'Maintenir le sol humide à la floraison', sw: 'Hifadhi unyevu wakati wa kutoa vitofani', ha: 'Kiyaye ƙasa da laima lokacin yin furanni', tw: 'Ma asase no nyɛ fɔmu bere a ɛyɛ nhwiren' },
  'cropTask.maize.topDress': { en: 'Top-dress with fertilizer', fr: 'Apport supplémentaire d\'engrais', sw: 'Weka mbolea ya juu', ha: 'Sake zuba taki', tw: 'Gu nkwansuade bio' },
  'cropTask.maize.harvest': { en: 'Harvest your maize', fr: 'Récolter le maïs', sw: 'Vuna mahindi', ha: 'Girbe masara', tw: 'Twa aburo' },
  'cropTask.maize.sortHarvest': { en: 'Sort and clean the ears', fr: 'Trier et nettoyer les épis', sw: 'Panga na safisha masuke', ha: 'Tsara kuma tsaftace gawayen masara', tw: 'Hyehyɛ na popa aburo no' },
  'cropTask.maize.protectFromRain': { en: 'Protect the harvest from rain', fr: 'Protéger la récolte de la pluie', sw: 'Linda mavuno kutoka mvua', ha: 'Kare girbi daga ruwan sama', tw: 'Bɔ twa no ho ban fi osu ho' },
  'cropTask.maize.dryHarvest': { en: 'Dry the maize until hard', fr: 'Sécher le maïs jusqu\'à dur', sw: 'Kausha mahindi yawe magumu', ha: 'Bushe masara har ta taurare', tw: 'Hyew aburo no ma ɛnyɛ den' },
  'cropTask.maize.storeHarvest': { en: 'Store maize in a dry place', fr: 'Stocker le maïs au sec', sw: 'Hifadhi mahindi mahali pakavu', ha: 'Ajiye masara a busasshen wuri', tw: 'Kora aburo wɔ beaeɛ a ɛyɛ hye' },
  'cropTask.maize.logHarvest': { en: 'Log your maize harvest weight', fr: 'Enregistrer la récolte de maïs', sw: 'Rekodi uzito wa mavuno', ha: 'Rubuta nauyin girbin masara', tw: 'Kyerɛw aburo twa no mu duru' },
  'cropTask.maize.prepareForSale': { en: 'Prepare maize for sale', fr: 'Préparer le maïs pour la vente', sw: 'Andaa mahindi kwa kuuza', ha: 'Shirya masara don sayarwa', tw: 'Siesie aburo ma tɔn' },

  // ─── MAIZE adaptive-repetition title variants (spec §6) ──
  'cropTask.maize.finishClearField': { en: 'Finish clearing your field', fr: 'Terminer le défrichage', sw: 'Maliza kusafisha shamba', ha: 'Gama share gonar', tw: 'Wie wo afuo no so twitwa' },
  'cropTask.maize.finishLoosenSoil': { en: 'Finish loosening the soil', fr: 'Terminer l\'ameublissement du sol', sw: 'Maliza kulainisha udongo', ha: 'Gama sassauta ƙasa', tw: 'Wie asase no dwodwoɔ' },
  'cropTask.maize.finishMarkRows': { en: 'Finish marking rows', fr: 'Terminer le traçage des lignes', sw: 'Maliza kuweka alama za mistari', ha: 'Gama alama layuka', tw: 'Wie ntam yɛ' },

  // Adaptive wording — day-3+ urgency tier (spec §1)
  'cropTask.maize.completeNowClearField': { en: 'Complete your field clearing now', fr: 'Terminez le défrichage maintenant', sw: 'Kamilisha kusafisha shamba sasa', ha: 'Gama share gonar yanzu', tw: 'Wie afuo no mu twitwa seesei' },
  'cropTask.maize.completeNowLoosenSoil': { en: 'Complete loosening the soil now', fr: 'Terminez l\'ameublissement du sol maintenant', sw: 'Kamilisha kulainisha udongo sasa', ha: 'Gama sassauta ƙasa yanzu', tw: 'Wie asase no dwodwoɔ seesei' },
  'cropTask.maize.completeNowMarkRows': { en: 'Complete marking your rows now', fr: 'Terminez le traçage des lignes maintenant', sw: 'Kamilisha kuweka alama za mistari sasa', ha: 'Gama alama layuka yanzu', tw: 'Wie ntam yɛ seesei' },

  // ─── MAIZE task outcomes (success line after completion) ──
  'outcome.maize.cleared': { en: 'Your field is now clear.', fr: 'Votre champ est dégagé.', sw: 'Shamba lako limesafishwa.', ha: 'Gonarku ta tsaftace.', tw: 'Wo afuo no mu ayɛ krɔnkrɔn.' },
  'outcome.maize.soilLoose': { en: 'Soil is loose and ready.', fr: 'Le sol est meuble et prêt.', sw: 'Udongo umelegea tayari.', ha: 'Ƙasa ta sassauta ta shirya.', tw: 'Asase no adwodwo na ayɛ krado.' },
  'outcome.maize.rowsMarked': { en: 'Rows are marked.', fr: 'Les lignes sont marquées.', sw: 'Mistari imewekewa alama.', ha: 'An yi alama layuka.', tw: 'Woayɛ ntam no.' },
  'outcome.maize.inputsReady': { en: 'Inputs are ready.', fr: 'Les intrants sont prêts.', sw: 'Pembejeo ziko tayari.', ha: 'Abubuwan amfani sun shirya.', tw: 'Nneɛma a wohia no asiesie.' },
  'outcome.maize.planted': { en: 'Maize is planted.', fr: 'Le maïs est semé.', sw: 'Mahindi yamepandwa.', ha: 'An shuka masara.', tw: 'Wɔadua aburo.' },
  'outcome.maize.watered': { en: 'Seeds are watered.', fr: 'Les semences sont arrosées.', sw: 'Mbegu zimemwagiliwa.', ha: 'An shayar irin.', tw: 'Wɔagu aba no nsu.' },
  'outcome.maize.spacingGood': { en: 'Spacing looks good.', fr: 'L\'espacement est correct.', sw: 'Nafasi ni nzuri.', ha: 'Tazara tana da kyau.', tw: 'Ntam no yɛ fɛ.' },
  'outcome.maize.germinated': { en: 'Maize is sprouting.', fr: 'Le maïs germe.', sw: 'Mahindi yanamea.', ha: 'Masara na tsirowa.', tw: 'Aburo refifiri.' },
  'outcome.maize.weedCleared': { en: 'Weeds are cleared.', fr: 'Les mauvaises herbes sont éliminées.', sw: 'Magugu yameondolewa.', ha: 'An cire ciyawa.', tw: 'Wɔayi wura no.' },
  'outcome.maize.moistureOk': { en: 'Soil moisture is good.', fr: 'L\'humidité est bonne.', sw: 'Unyevu ni mzuri.', ha: 'Danshi yana da kyau.', tw: 'Asase fɔmu yɛ fɛ.' },
  'outcome.maize.fertilized': { en: 'Fertilizer is applied.', fr: 'L\'engrais est appliqué.', sw: 'Mbolea imewekwa.', ha: 'An zuba taki.', tw: 'Wɔde nkwansuade aka ho.' },
  'outcome.maize.pestOk': { en: 'No pest issues today.', fr: 'Pas de ravageurs.', sw: 'Hakuna wadudu leo.', ha: 'Babu kwari yau.', tw: 'Mmoawa biara nni hɔ nnɛ.' },
  'outcome.maize.harvested': { en: 'Harvest is in.', fr: 'La récolte est rentrée.', sw: 'Mavuno yameingia.', ha: 'An yi girbi.', tw: 'Wɔatwa no.' },
  'outcome.maize.sorted': { en: 'Harvest is sorted.', fr: 'La récolte est triée.', sw: 'Mavuno yamepangwa.', ha: 'An tsara girbin.', tw: 'Wɔahyehyɛ twa no.' },
  'outcome.maize.protected': { en: 'Harvest is protected.', fr: 'La récolte est protégée.', sw: 'Mavuno yamelindwa.', ha: 'An kare girbi.', tw: 'Wɔabɔ twa no ho ban.' },
  'outcome.maize.dried': { en: 'Grain is drying well.', fr: 'Le grain sèche bien.', sw: 'Nafaka inakauka vizuri.', ha: 'Hatsin na bushewa da kyau.', tw: 'Aburo no rehyew yiye.' },
  'outcome.maize.stored': { en: 'Grain is stored safely.', fr: 'Le grain est stocké en sécurité.', sw: 'Nafaka imehifadhiwa salama.', ha: 'An adana hatsi lafiya.', tw: 'Wɔakora aburo no dwoodwoo.' },
  'outcome.maize.logged': { en: 'Harvest is logged.', fr: 'Récolte enregistrée.', sw: 'Mavuno yamerekodiwa.', ha: 'An rubuta girbi.', tw: 'Wɔakyerɛw twa no.' },
  'outcome.maize.readyForSale': { en: 'Ready for sale.', fr: 'Prêt pour la vente.', sw: 'Tayari kwa kuuza.', ha: 'Shirye don sayarwa.', tw: 'Krado ma tɔn.' },

  // ─── MAIZE step lists (pipe-separated so UI can split) ──
  'steps.maize.clearField': { en: 'Cut weeds and grasses | Remove stones and debris | Clear dry plants', fr: 'Couper les mauvaises herbes | Enlever pierres et débris | Dégager les plantes sèches', sw: 'Kata magugu na nyasi | Ondoa mawe na taka | Safisha mimea kavu', ha: 'Yanke ciyayi da ciyawa | Cire duwatsu da datti | Share tsoffin tsire-tsire', tw: 'Twa nwura ne sare | Yi aboɔ ne fi | Yi nnua a ɛawoɔ no' },
  'steps.maize.loosenSoil': { en: 'Dig or plough the soil | Break hard soil lumps | Remove roots left in soil', fr: 'Bêcher ou labourer | Casser les mottes | Retirer les racines', sw: 'Chimba au lima | Vunja madongo magumu | Ondoa mizizi', ha: 'Haƙa ko nome | Fasa kullen ƙasa | Cire saiwoyi', tw: 'Tu anaa funtum asase | Paapae asase bu den | Yi nhini a aka' },
  'steps.maize.markRows': { en: 'Mark straight lines | Leave proper row spacing | Keep spacing even', fr: 'Tracer des lignes droites | Garder le bon écartement | Maintenir l\'espacement', sw: 'Weka mistari iliyonyooka | Acha nafasi sahihi | Weka nafasi sawa', ha: 'Yi layuka masu mike | Bar daidai tazara | Riƙe tazara daidai', tw: 'Twa ntam a ɛte tee | Ma ntam no nkyekyɛmu pa | Ma ntam no nyɛ pɛ' },
  'steps.maize.gatherInputs': { en: 'Collect seeds | Get fertilizer | Prepare tools', fr: 'Préparer les semences | Préparer l\'engrais | Préparer les outils', sw: 'Kusanya mbegu | Leta mbolea | Andaa zana', ha: 'Tara iri | Samu taki | Shirya kayan aiki', tw: 'Boaboa aba | Fa nkwansuade | Siesie nnwinnade' },
  'steps.maize.plantSeeds': { en: 'Make small planting holes | Drop 2–3 seeds per hole | Cover lightly with soil', fr: 'Faire des trous | Mettre 2-3 graines par trou | Couvrir légèrement', sw: 'Chimba mashimo madogo | Weka mbegu 2–3 kila shimo | Funika kidogo', ha: 'Huda ƙananan ramuka | Sa iri 2-3 a kowace rama | Rufe kaɗan', tw: 'Tu ntokuro nketewa | Gu aba 2-3 wɔ ntokuro biara mu | Kata so kakra' },
  'steps.maize.waterAfterPlanting': { en: 'Water gently after planting | Do not flood | Keep soil moist', fr: 'Arroser doucement | Éviter l\'inondation | Garder le sol humide', sw: 'Mwagilia taratibu | Usifurike | Hifadhi unyevu', ha: 'Shayar a hankali | Kada a cika da ruwa | Kiyaye danshi', tw: 'Gu nsu brɛoo | Mma nsu mmu | Ma asase no nyɛ fɔmu' },
  'steps.maize.confirmSpacing': { en: 'Walk the rows | Check spacing | Note any gaps', fr: 'Parcourir les rangées | Vérifier l\'espacement | Noter les manques', sw: 'Tembea katika mistari | Angalia nafasi | Onyesha mapengo', ha: 'Taka layuka | Bincika tazara | Lura da raunuka', tw: 'Nantew ntam no mu | Hwɛ ntam no | Kyerɛ baabi a ɛsɛe' },
  'steps.maize.checkGermination': { en: 'Walk the field | Count sprouted seedlings | Replant gaps if many', fr: 'Parcourir le champ | Compter les jeunes plants | Resemer si nécessaire', sw: 'Tembea shambani | Hesabu miche iliyochipua | Panda tena mapengo', ha: 'Taka gona | Ƙirga tsirrai | Sake shuka rauni', tw: 'Nantew afuo no mu | Kan nnua a afifiri | Dua baabi a ɛfe' },
  'steps.maize.firstWeeding': { en: 'Remove young weeds | Clear between rows | Avoid damaging seedlings', fr: 'Enlever les jeunes herbes | Dégager entre les rangs | Épargner les plants', sw: 'Ondoa magugu machanga | Safisha kati ya mistari | Usidhuru miche', ha: 'Cire sabbin ciyayi | Share tsakanin layuka | Kauce wa lalata tsirrai', tw: 'Yi wura foforɔ | Popa ntam no mu | Nyɛ nnua no ho asɛm' },
  'steps.maize.monitorWater': { en: 'Feel soil with hand | Water if dry 2 cm deep | Avoid overwatering', fr: 'Toucher le sol | Arroser si sec sur 2 cm | Éviter l\'excès', sw: 'Gusa udongo | Mwagilia kama kavu 2 cm | Usipitishe maji', ha: 'Taɓa ƙasa | Shayar idan busasshe 2 cm | Kauce wa yawa', tw: 'Fa nsa ka asase no | Gu nsu sɛ ɛyɛ kuro 2 cm | Mma nsu nnɔso' },
  'steps.maize.applyFertilizer': { en: 'Spread fertilizer along rows | Keep away from stems | Water lightly after', fr: 'Épandre le long des rangs | Éloigner des tiges | Arroser légèrement', sw: 'Tawanya mbolea kando ya mistari | Usiguse mashina | Mwagilia kidogo baada', ha: 'Watsa taki tare da layuka | Kauce wa kara | Shayar kaɗan', tw: 'Gu nkwansuade no gu ntam no ano | Mma mma aburo no ho | Gu nsu kakra' },
  'steps.maize.harvest': { en: 'Check kernels are hard | Pick dry cobs | Place in clean bags', fr: 'Vérifier la dureté | Cueillir les épis secs | Mettre en sacs propres', sw: 'Angalia mbegu zimekauka | Vuna masuke makavu | Weka kwenye magunia safi', ha: 'Bincika ƙyaurenje sun taurare | Tara gawaye busasshe | Saka cikin buhunan tsafta', tw: 'Hwɛ sɛ aba no awoɔ | Twa aburo a awoɔ | Fa gu nkotokuo krɔnkrɔn' },
  'steps.maize.protectFromRain': { en: 'Move bags under cover | Use tarp or shed | Keep off bare ground', fr: 'Abriter les sacs | Utiliser bâche ou abri | Éviter le sol nu', sw: 'Hamisha magunia ndani | Tumia turubai | Usiweke chini', ha: 'Matsar da buhuna a rufi | Yi amfani da turbale | Kada ka sa a ƙasa', tw: 'Fa nkotokuo no hyɛ ase | Fa turubai anaa dan | Mma ɛnnka fam' },
  'steps.maize.dryHarvest': { en: 'Spread kernels thin | Dry in sunlight | Turn regularly', fr: 'Étaler les grains | Sécher au soleil | Tourner régulièrement', sw: 'Tawanya nafaka | Kausha juani | Geuza mara nyingi', ha: 'Baza hatsi sirara | Bushe a rana | Juya kullum', tw: 'Trɛ aba no mu tiaa | Hyew wɔ owia mu | Dan no daa' },
  'steps.maize.storeHarvest': { en: 'Use clean dry bags | Stack off the floor | Check for pests monthly', fr: 'Utiliser sacs secs propres | Stocker hors sol | Vérifier les ravageurs', sw: 'Tumia magunia safi makavu | Paanya juu ya sakafu | Kagua wadudu kila mwezi', ha: 'Yi amfani da buhuna masu tsafta | Ɗora sama da ƙasa | Bincika kwari kowane wata', tw: 'Fa nkotokuo a ɛho te na ahyew | Hyehyɛ gu so fam | Hwɛ mmoawa bosome biara' },

  // ─── MAIZE farmer tips ─────────────────────────────────
  'tips.maize.clearField': { en: 'Clear when soil is dry. Work early if heat is high.', fr: 'Défricher quand sec. Travailler tôt par chaleur.', sw: 'Safisha udongo kavu. Fanya asubuhi joto likiwa kali.', ha: 'Share lokacin ƙasa ta bushe. Yi aiki da safe idan zafi ya tsananta.', tw: 'Twitwa bere a asase awoɔ. Yɛ adwuma anɔpa sɛ ɛhyew a.' },
  'tips.maize.loosenSoil': { en: 'Do not work waterlogged soil.', fr: 'Ne pas travailler un sol gorgé d\'eau.', sw: 'Usilime udongo uliojaa maji.', ha: 'Kada ka yi aikin ƙasa mai ruwa.', tw: 'Nyɛ asase a nsu ayɛ no mu adwuma.' },
  'tips.maize.markRows': { en: 'Standard spacing: 75 cm between rows, 25 cm in row.', fr: 'Espacement standard : 75 cm entre rangs, 25 cm dans le rang.', sw: 'Nafasi: cm 75 kati ya mistari, cm 25 mstari.', ha: 'Tazara: 75 cm tsakanin layuka, 25 cm a layi.', tw: 'Ntam: 75 cm ntam biara ntam, 25 cm ntam no mu.' },
  'tips.maize.gatherInputs': { en: 'Buy certified seeds if possible.', fr: 'Privilégier les semences certifiées.', sw: 'Nunua mbegu zilizothibitishwa ikiwezekana.', ha: 'Sayi iri masu takardar shaida idan za ka iya.', tw: 'Tɔ aba a wɔagye atom sɛ wobɛtumi a.' },
  'tips.maize.plantSeeds': { en: 'Plant after first good rain.', fr: 'Semer après la première bonne pluie.', sw: 'Panda baada ya mvua ya kwanza nzuri.', ha: 'Shuka bayan ruwan sama na farko mai kyau.', tw: 'Dua wɔ osutɔ pa a ɛdi kan no akyi.' },
  'tips.maize.waterAfterPlanting': { en: 'Light regular watering beats heavy occasional watering.', fr: 'Arroser peu et souvent.', sw: 'Mwagilia kidogo kwa kawaida.', ha: 'Shayar kaɗan-kaɗan kullum.', tw: 'Nsu kakra daa ye sen nsu pii ɛtɔ so.' },
  'tips.maize.applyFertilizer': { en: 'Apply after rain or water lightly after.', fr: 'Appliquer après la pluie ou arroser légèrement.', sw: 'Weka baada ya mvua au mwagilia kidogo.', ha: 'Zuba bayan ruwan sama ko shayar kaɗan.', tw: 'Gu osutɔ akyi anaa gu nsu kakra.' },
  'tips.maize.checkPests': { en: 'Look under leaves — pests hide there.', fr: 'Regarder sous les feuilles.', sw: 'Angalia chini ya majani.', ha: 'Duba ƙarƙashin ganyaye.', tw: 'Hwɛ nhaban no ase.' },
  'tips.maize.harvest': { en: 'Harvest in the dry part of the day.', fr: 'Récolter pendant le sec.', sw: 'Vuna wakati wa kavu wa siku.', ha: 'Girbe lokacin bushewar yini.', tw: 'Twa wɔ bere a ewim yɛ hye.' },
  'tips.maize.dryHarvest': { en: 'Well-dried grain stores longer and sells for more.', fr: 'Un grain bien sec se conserve et se vend mieux.', sw: 'Nafaka kavu huhifadhiwa vizuri na huuzwa zaidi.', ha: 'Hatsi mai kyau bushewa yana jimawa kuma yana biya sosai.', tw: 'Aburo a ahyew yiye no kora kyɛ na ne boɔ yɛ den.' },

  // ═══════════════════════════════════════════════════════════
  //  BETA CROP LABELS, WARNING + FEEDBACK
  // ═══════════════════════════════════════════════════════════
  'beta.label': { en: 'Testing', fr: 'Test', sw: 'Majaribio', ha: 'Gwaji', tw: 'Sɔhwɛ' },
  'beta.warning.title': { en: 'Testing guidance for this crop', fr: 'Conseils en test pour cette culture', sw: 'Mwongozo wa majaribio wa zao hili', ha: 'Jagora a gwaji don wannan amfani', tw: 'Yɛresɔ nnɔbae yi akwankyerɛ' },
  'beta.warning.body1': { en: 'Daily guidance is available and improving for your area.', fr: 'Des conseils quotidiens sont disponibles et s\'améliorent pour votre région.', sw: 'Mwongozo wa kila siku upo na unaboreshwa kwa eneo lako.', ha: 'Jagora ta yau da kullum tana nan, tana ci gaba da ingantawa a yankinku.', tw: 'Daa akwankyerɛ wɔ hɔ na ɛrekɔ so yɛ yie wɔ wo mantam.' },
  'beta.warning.body2': { en: 'Help us improve this crop with your feedback.', fr: 'Aidez-nous à améliorer cette culture grâce à vos retours.', sw: 'Tusaidie kuboresha zao hili kwa maoni yako.', ha: 'Ka taimaka mana inganta wannan amfani da ra\'ayinka.', tw: 'Boa yɛn na yɛma nnɔbae yi akɔ so yɛ yie wɔ w\'adwene so.' },
  'beta.warning.continue': { en: 'Start with this crop', fr: 'Commencer avec cette culture', sw: 'Anza na zao hili', ha: 'Fara da wannan amfani', tw: 'Fi nnɔbae yi ase' },
  'beta.warning.chooseAnother': { en: 'Choose another crop', fr: 'Choisir une autre culture', sw: 'Chagua zao lingine', ha: 'Zaɓi wani amfanin gona', tw: 'Paw nnɔbae foforɔ' },
  'beta.feedback.question': { en: 'Is this guidance helpful?', fr: 'Ces conseils sont-ils utiles ?', sw: 'Je, mwongozo huu unasaidia?', ha: 'Shin wannan jagora tana da taimako?', tw: 'Akwankyerɛ yi ho hia anaa?' },
  'beta.feedback.yes': { en: 'Yes', fr: 'Oui', sw: 'Ndiyo', ha: 'Ee', tw: 'Aane' },
  'beta.feedback.partly': { en: 'Partly', fr: 'En partie', sw: 'Sehemu', ha: 'Ɗan kaɗan', tw: 'Kakraa' },
  'beta.feedback.no': { en: 'No', fr: 'Non', sw: 'Hapana', ha: 'A\'a', tw: 'Dabi' },

  // ─── Crop labels for beta crops ─────────────────────────
  'crop.tomato': { en: 'Tomato', fr: 'Tomate', sw: 'Nyanya', ha: 'Tumatir', tw: 'Ntoosi' },
  'crop.pepper': { en: 'Pepper', fr: 'Piment', sw: 'Pilipili', ha: 'Barkono', tw: 'Mako' },
  'crop.onion': { en: 'Onion', fr: 'Oignon', sw: 'Kitunguu', ha: 'Albasa', tw: 'Gyeene' },

  // ═══════════════════════════════════════════════════════════
  //  TOMATO beta task library
  // ═══════════════════════════════════════════════════════════
  'task.tomato.clear_land.title': { en: 'Clear your tomato plot', fr: 'Défricher votre parcelle de tomates', sw: 'Safisha kiwanja cha nyanya', ha: 'Share filin tumatir', tw: 'Twitwa wo ntoosi afuo' },
  'task.tomato.clear_land.why': { en: 'A clean plot helps seedlings settle', fr: 'Un terrain propre aide les plants', sw: 'Kiwanja safi husaidia miche', ha: 'Filin mai tsafta na taimaka wa tsirrai', tw: 'Afuo a ɛho te boa nnua no' },
  'task.tomato.clear_land.timing': { en: 'Do this week', fr: 'À faire cette semaine', sw: 'Fanya wiki hii', ha: 'Yi a wannan mako', tw: 'Yɛ nnawɔtwe yi' },
  'task.tomato.clear_land.steps': { en: 'Cut weeds and grasses | Remove stones and debris | Clear old plant roots', fr: 'Couper mauvaises herbes | Enlever pierres et débris | Retirer vieilles racines', sw: 'Kata magugu na nyasi | Ondoa mawe na taka | Ondoa mizizi ya zamani', ha: 'Yanke ciyayi | Cire duwatsu da datti | Cire tsofaffin saiwoyi', tw: 'Twa nwura | Yi aboɔ ne fi | Yi nhini dada' },
  'task.tomato.clear_land.tips': { en: 'Clear when soil is dry', fr: 'Défricher quand le sol est sec', sw: 'Safisha udongo ukiwa kavu', ha: 'Share lokacin ƙasa ta bushe', tw: 'Twitwa bere a asase awoɔ' },
  'task.tomato.clear_land.outcome': { en: 'Your plot is ready.', fr: 'Votre parcelle est prête.', sw: 'Kiwanja kiko tayari.', ha: 'Filin ya shirya.', tw: 'Wo afuo asiesie.' },

  'task.tomato.prepare_soil.title': { en: 'Prepare the soil', fr: 'Préparer le sol', sw: 'Tayarisha udongo', ha: 'Shirya ƙasa', tw: 'Siesie asase' },
  'task.tomato.prepare_soil.why': { en: 'Loose soil helps roots grow', fr: 'Un sol meuble aide les racines', sw: 'Udongo mwepesi husaidia mizizi', ha: 'Ƙasa sassauta na taimakon saiwa', tw: 'Asase a ɛdwodwoɔ boa nhini' },
  'task.tomato.prepare_soil.timing': { en: 'Do today', fr: 'À faire aujourd\'hui', sw: 'Fanya leo', ha: 'Yi yau', tw: 'Yɛ nnɛ' },
  'task.tomato.prepare_soil.steps': { en: 'Loosen the soil | Break large soil clumps | Mix in compost if available', fr: 'Ameublir le sol | Casser les mottes | Ajouter du compost si possible', sw: 'Lainisha udongo | Vunja madongo | Ongeza mboji ikiwezekana', ha: 'Sassauta ƙasa | Fasa manyan kulli | Haɗa takin ƙwayoyi idan akwai', tw: 'Dwodwo asase | Paapae asase bu den | Fa compost bɔ mu sɛ ɛwɔ hɔ a' },
  'task.tomato.prepare_soil.tips': { en: 'Do not work very wet soil', fr: 'Ne pas travailler un sol gorgé', sw: 'Usilime udongo uliolowa sana', ha: 'Kada ka yi aiki ƙasa mai ruwa sosai', tw: 'Nyɛ asase a nsu ayɛ so' },
  'task.tomato.prepare_soil.outcome': { en: 'Soil is ready.', fr: 'Le sol est prêt.', sw: 'Udongo tayari.', ha: 'Ƙasa ta shirya.', tw: 'Asase asiesie.' },

  'task.tomato.plant_seedlings.title': { en: 'Plant your tomato seedlings', fr: 'Repiquer vos plants de tomate', sw: 'Panda miche ya nyanya', ha: 'Dasa shuke-shuken tumatir', tw: 'Dua wo ntoosi nfifideɛ' },
  'task.tomato.plant_seedlings.why': { en: 'Seedlings establish best in prepared soil', fr: 'Les plants s\'installent mieux en sol préparé', sw: 'Miche hukaa vizuri katika udongo uliotayarishwa', ha: 'Tsirrai na daidaitawa a ƙasar da aka shirya', tw: 'Nnua no te ase yiye wɔ asase a wɔasiesie' },
  'task.tomato.plant_seedlings.timing': { en: 'Do this week', fr: 'À faire cette semaine', sw: 'Fanya wiki hii', ha: 'Yi a wannan mako', tw: 'Yɛ nnawɔtwe yi' },
  'task.tomato.plant_seedlings.steps': { en: 'Dig small holes | Place seedlings gently | Cover roots with soil | Press soil lightly', fr: 'Creuser petits trous | Placer les plants | Couvrir les racines | Tasser légèrement', sw: 'Chimba mashimo madogo | Weka miche | Funika mizizi | Bonyeza udongo kidogo', ha: 'Huda ƙananan ramuka | Sa tsirrai | Rufe saiwa | Latse ƙasa kaɗan', tw: 'Tu ntokuro nketewa | Fa nfifideɛ no to mu | Kata nhini no so | Mia asase no so kakra' },
  'task.tomato.plant_seedlings.tips': { en: 'Leave space between plants', fr: 'Laisser de l\'espace entre les plants', sw: 'Acha nafasi kati ya mimea', ha: 'Bar tazara tsakanin tsirrai', tw: 'Gyae ntam wɔ nnua no ntam' },
  'task.tomato.plant_seedlings.outcome': { en: 'Seedlings are planted.', fr: 'Les plants sont en place.', sw: 'Miche imepandwa.', ha: 'An dasa tsirrai.', tw: 'Woadua nfifideɛ.' },

  'task.tomato.water.title': { en: 'Water your tomato plants', fr: 'Arroser vos tomates', sw: 'Mwagilia nyanya zako', ha: 'Shayar da tumatir', tw: 'Gu nsu gu wo ntoosi so' },
  'task.tomato.water.why': { en: 'Tomatoes need steady moisture', fr: 'Les tomates ont besoin d\'humidité régulière', sw: 'Nyanya zinahitaji unyevu wa mara kwa mara', ha: 'Tumatir na buƙatar danshi akai-akai', tw: 'Ntoosi hia nsu daa' },
  'task.tomato.water.timing': { en: 'Do today', fr: 'À faire aujourd\'hui', sw: 'Fanya leo', ha: 'Yi yau', tw: 'Yɛ nnɛ' },
  'task.tomato.water.steps': { en: 'Water at the base of the plant | Avoid wetting leaves | Keep soil moist', fr: 'Arroser à la base | Éviter de mouiller les feuilles | Garder le sol humide', sw: 'Mwagilia chini ya mmea | Epuka kulowesha majani | Weka udongo unyevu', ha: 'Shayar a gindin shuka | Kauce danye ganyaye | Kiyaye danshin ƙasa', tw: 'Gu nsu gu dua no ase | Mma nhaban no nnɔ | Ma asase no nyɛ fɔmu' },
  'task.tomato.water.tips': { en: 'Water early morning or evening', fr: 'Arroser tôt ou en soirée', sw: 'Mwagilia asubuhi au jioni', ha: 'Shayar da safe ko yamma', tw: 'Gu nsu anɔpahan anaa anwummere' },
  'task.tomato.water.outcome': { en: 'Plants are watered.', fr: 'Les plants sont arrosés.', sw: 'Mimea imemwagiliwa.', ha: 'An shayar tsirrai.', tw: 'Woagu nnua no nsu.' },

  'task.tomato.pests.title': { en: 'Check tomato plants for pests', fr: 'Vérifier les ravageurs sur les tomates', sw: 'Kagua wadudu kwenye nyanya', ha: 'Bincika kwari a tumatir', tw: 'Hwɛ ntoosi so hwehwɛ mmoawa' },
  'task.tomato.pests.why': { en: 'Early detection prevents loss', fr: 'Une détection précoce évite les pertes', sw: 'Kugundua mapema huzuia hasara', ha: 'Gano da wuri na hana asara', tw: 'Sɛ wuhu ntɛm a, wo nkwasoɔ nnyɛ den' },
  'task.tomato.pests.timing': { en: 'Do today', fr: 'À faire aujourd\'hui', sw: 'Fanya leo', ha: 'Yi yau', tw: 'Yɛ nnɛ' },
  'task.tomato.pests.risk': { en: 'Pests can spread and damage fruits', fr: 'Les ravageurs peuvent abîmer les fruits', sw: 'Wadudu wanaweza kuharibu matunda', ha: 'Kwari na iya yaɗuwa su lalata \'ya\'yan itace', tw: 'Mmoawa tumi trɛ na ɛsɛe aba' },
  'task.tomato.pests.steps': { en: 'Check leaves closely | Look under leaves | Remove visible pests', fr: 'Regarder les feuilles de près | Regarder dessous | Retirer les ravageurs', sw: 'Angalia majani kwa makini | Angalia chini ya majani | Ondoa wadudu', ha: 'Duba ganyaye a hankali | Duba ƙarƙashin ganyaye | Cire kwari', tw: 'Hwɛ nhaban no yiye | Hwɛ nhaban no ase | Yi mmoawa no' },
  'task.tomato.pests.outcome': { en: 'Pests are under control.', fr: 'Les ravageurs sont maîtrisés.', sw: 'Wadudu wanadhibitiwa.', ha: 'An shawo kan kwari.', tw: 'Mmoawa no wɔ nsa ase.' },

  'task.tomato.harvest.title': { en: 'Harvest your tomatoes', fr: 'Récolter vos tomates', sw: 'Vuna nyanya zako', ha: 'Girbe tumatir', tw: 'Twa wo ntoosi' },
  'task.tomato.harvest.why': { en: 'Ripe tomatoes sell best', fr: 'Les tomates mûres se vendent mieux', sw: 'Nyanya zilizoiva zinauzwa vizuri', ha: 'Tumatir da suka nuna na sayarwa mafi kyau', tw: 'Ntoosi a abere tɔn ye paa' },
  'task.tomato.harvest.timing': { en: 'When ripe', fr: 'Quand mûres', sw: 'Zikishaiva', ha: 'Lokacin da suka nuna', tw: 'Sɛ abere a' },
  'task.tomato.harvest.steps': { en: 'Pick ripe tomatoes gently | Avoid damaging the plant | Store in a container', fr: 'Cueillir délicatement | Éviter d\'abîmer la plante | Mettre en caisse', sw: 'Chuma nyanya zilizoiva kwa upole | Usiharibu mmea | Hifadhi kwenye chombo', ha: 'Tara tumatir da suka nuna a hankali | Kauce lalata shuka | Ajiye a akwati', tw: 'Twa ntoosi a abere brɛoo | Nyɛ dua no ho asɛm | Kora wɔ biribi mu' },
  'task.tomato.harvest.tips': { en: 'Harvest regularly', fr: 'Récolter régulièrement', sw: 'Vuna mara kwa mara', ha: 'Girbe akai-akai', tw: 'Twa no daa' },
  'task.tomato.harvest.outcome': { en: 'Harvest is done.', fr: 'La récolte est faite.', sw: 'Mavuno yamekwisha.', ha: 'An girbi.', tw: 'Wɔatwa no.' },

  // ═══════════════════════════════════════════════════════════
  //  PEPPER beta task library
  // ═══════════════════════════════════════════════════════════
  'task.pepper.clear_land.title': { en: 'Clear your pepper plot', fr: 'Défricher votre parcelle de piments', sw: 'Safisha kiwanja cha pilipili', ha: 'Share filin barkono', tw: 'Twitwa wo mako afuo' },
  'task.pepper.clear_land.why': { en: 'A clean plot helps young plants', fr: 'Un terrain propre aide les jeunes plants', sw: 'Kiwanja safi husaidia mimea michanga', ha: 'Filin mai tsafta na taimaka wa sabbin tsirrai', tw: 'Afuo krɔnkrɔn boa nnua foforɔ' },
  'task.pepper.clear_land.timing': { en: 'Do this week', fr: 'À faire cette semaine', sw: 'Fanya wiki hii', ha: 'Yi a wannan mako', tw: 'Yɛ nnawɔtwe yi' },
  'task.pepper.clear_land.steps': { en: 'Remove weeds and grasses | Clear stones and debris | Prepare a clean planting area', fr: 'Enlever mauvaises herbes | Déblayer pierres et débris | Préparer une zone propre', sw: 'Ondoa magugu | Ondoa mawe na taka | Andaa eneo safi la kupanda', ha: 'Cire ciyayi | Share duwatsu da datti | Shirya wurin shuka mai tsafta', tw: 'Yi wura | Yi aboɔ ne fi | Siesie baabi a ɛyɛ krɔnkrɔn' },
  'task.pepper.clear_land.outcome': { en: 'Your plot is ready.', fr: 'Votre parcelle est prête.', sw: 'Kiwanja tayari.', ha: 'Filin ya shirya.', tw: 'Wo afuo asiesie.' },

  'task.pepper.plant.title': { en: 'Plant your pepper seedlings', fr: 'Repiquer vos plants de piment', sw: 'Panda miche ya pilipili', ha: 'Dasa shuke-shuken barkono', tw: 'Dua mako nfifideɛ' },
  'task.pepper.plant.why': { en: 'Proper planting sets up strong growth', fr: 'Une bonne plantation favorise la croissance', sw: 'Kupanda vizuri husaidia ukuaji', ha: 'Dasa mai kyau na taimakon girma', tw: 'Dua pa ma nnyineɛ' },
  'task.pepper.plant.timing': { en: 'Do this week', fr: 'À faire cette semaine', sw: 'Fanya wiki hii', ha: 'Yi a wannan mako', tw: 'Yɛ nnawɔtwe yi' },
  'task.pepper.plant.steps': { en: 'Dig small holes | Place seedlings carefully | Cover roots with soil', fr: 'Creuser des trous | Placer les plants | Couvrir les racines', sw: 'Chimba mashimo | Weka miche | Funika mizizi', ha: 'Huda ramuka | Sa tsirrai | Rufe saiwa', tw: 'Tu ntokuro | Fa nfifideɛ no to mu | Kata nhini no so' },
  'task.pepper.plant.tips': { en: 'Leave enough space between plants', fr: 'Laisser assez d\'espace', sw: 'Acha nafasi kati ya mimea', ha: 'Bar isasshen tazara', tw: 'Gyae ntam pii' },
  'task.pepper.plant.outcome': { en: 'Seedlings are planted.', fr: 'Les plants sont en place.', sw: 'Miche imepandwa.', ha: 'An dasa tsirrai.', tw: 'Woadua nfifideɛ.' },

  'task.pepper.water.title': { en: 'Water your pepper plants', fr: 'Arroser vos piments', sw: 'Mwagilia pilipili zako', ha: 'Shayar da barkono', tw: 'Gu nsu gu mako so' },
  'task.pepper.water.why': { en: 'Peppers need steady moisture', fr: 'Les piments ont besoin d\'humidité', sw: 'Pilipili zinahitaji unyevu', ha: 'Barkono na buƙatar danshi', tw: 'Mako hia nsu' },
  'task.pepper.water.timing': { en: 'Do today', fr: 'À faire aujourd\'hui', sw: 'Fanya leo', ha: 'Yi yau', tw: 'Yɛ nnɛ' },
  'task.pepper.water.steps': { en: 'Water near the base | Avoid overwatering | Keep soil moist', fr: 'Arroser près de la base | Éviter l\'excès | Garder le sol humide', sw: 'Mwagilia karibu na chini | Usipitishe maji | Weka udongo unyevu', ha: 'Shayar kusa da gindi | Kauce wa yawan ruwa | Kiyaye danshin ƙasa', tw: 'Gu nsu bɛn dua no ase | Mma nsu nnɔso | Ma asase no nyɛ fɔmu' },
  'task.pepper.water.outcome': { en: 'Plants are watered.', fr: 'Les plants sont arrosés.', sw: 'Mimea imemwagiliwa.', ha: 'An shayar tsirrai.', tw: 'Woagu nnua no nsu.' },

  'task.pepper.weed.title': { en: 'Weed around your peppers', fr: 'Désherber autour des piments', sw: 'Palilia karibu na pilipili', ha: 'Cire ciyawa kusa da barkono', tw: 'Popa mako no ho' },
  'task.pepper.weed.why': { en: 'Weeds steal water and nutrients', fr: 'Les mauvaises herbes volent eau et nutriments', sw: 'Magugu huchukua maji na virutubisho', ha: 'Ciyayi na cin ruwa da abinci', tw: 'Wura gye nsu ne aduan' },
  'task.pepper.weed.timing': { en: 'Do today', fr: 'À faire aujourd\'hui', sw: 'Fanya leo', ha: 'Yi yau', tw: 'Yɛ nnɛ' },
  'task.pepper.weed.steps': { en: 'Pull weeds by hand | Clear around plant base | Keep soil loose', fr: 'Arracher à la main | Dégager autour de la base | Garder le sol meuble', sw: 'Vuta magugu kwa mkono | Safisha karibu na shina | Weka udongo laini', ha: 'Ciri ciyayi da hannu | Share kusa da gindi | Kiyaye ƙasa sassauta', tw: 'Twe wura no fi nsa | Popa dua no ho | Ma asase no ndwodwo' },
  'task.pepper.weed.outcome': { en: 'Plot is weeded.', fr: 'La parcelle est désherbée.', sw: 'Kiwanja kimepaliliwa.', ha: 'An cire ciyawa.', tw: 'Woapopa afuo no.' },

  'task.pepper.harvest.title': { en: 'Harvest your peppers', fr: 'Récolter vos piments', sw: 'Vuna pilipili zako', ha: 'Girbe barkono', tw: 'Twa wo mako' },
  'task.pepper.harvest.why': { en: 'Timely harvest keeps plants producing', fr: 'Une récolte à temps maintient la production', sw: 'Kuvuna kwa wakati huhimiza uzalishaji', ha: 'Girbin lokaci na ci gaba da samar', tw: 'Twa bere mu ma adɔe kɔ so' },
  'task.pepper.harvest.timing': { en: 'When ripe', fr: 'Quand mûrs', sw: 'Zikishaiva', ha: 'Lokacin da suka nuna', tw: 'Sɛ abere a' },
  'task.pepper.harvest.steps': { en: 'Pick peppers carefully | Avoid pulling the plant | Store in a cool place', fr: 'Cueillir avec soin | Éviter d\'arracher la plante | Stocker au frais', sw: 'Chuma pilipili kwa uangalifu | Usinyunyue mmea | Hifadhi mahali pa baridi', ha: 'Tara barkono a hankali | Kada ka ja shukar | Ajiye a wuri mai sanyi', tw: 'Twa mako brɛoo | Mma dua no nntwe | Kora wɔ beaeɛ a ɛyɛ nwunu' },
  'task.pepper.harvest.outcome': { en: 'Peppers are harvested.', fr: 'Les piments sont récoltés.', sw: 'Pilipili zimevunwa.', ha: 'An girbi barkono.', tw: 'Wɔatwa mako no.' },

  // ═══════════════════════════════════════════════════════════
  //  ONION beta task library
  // ═══════════════════════════════════════════════════════════
  'task.onion.prepare_soil.title': { en: 'Prepare the onion bed', fr: 'Préparer le lit d\'oignon', sw: 'Tayarisha kitalu cha kitunguu', ha: 'Shirya gadon albasa', tw: 'Siesie gyeene mpie' },
  'task.onion.prepare_soil.why': { en: 'Fine soil helps bulbs form well', fr: 'Un sol fin aide la formation des bulbes', sw: 'Udongo laini husaidia mizizi', ha: 'Ƙasa mai laushi na taimakon ƙwai', tw: 'Asase a ɛyɛ fɛ boa dua no' },
  'task.onion.prepare_soil.timing': { en: 'Do this week', fr: 'À faire cette semaine', sw: 'Fanya wiki hii', ha: 'Yi a wannan mako', tw: 'Yɛ nnawɔtwe yi' },
  'task.onion.prepare_soil.steps': { en: 'Loosen the soil well | Break all soil clumps | Level the surface evenly', fr: 'Bien ameublir | Casser les mottes | Niveler la surface', sw: 'Lainisha udongo vizuri | Vunja madongo yote | Sawazisha uso', ha: 'Sassauta ƙasa sosai | Fasa dukkan kulli | Daidaita saman ƙasa', tw: 'Dwodwo asase yiye | Paapae kulli nyinaa | Siesie asase no so pɛ' },
  'task.onion.prepare_soil.tips': { en: 'Soil should be soft and fine', fr: 'Le sol doit être fin', sw: 'Udongo uwe laini na mwembamba', ha: 'Ƙasa ta zama mai laushi', tw: 'Asase no nyɛ brɛoo' },
  'task.onion.prepare_soil.outcome': { en: 'Bed is ready.', fr: 'Le lit est prêt.', sw: 'Kitalu tayari.', ha: 'Gadon ya shirya.', tw: 'Mpie no asiesie.' },

  'task.onion.plant.title': { en: 'Plant your onions', fr: 'Planter vos oignons', sw: 'Panda kitunguu', ha: 'Shuka albasa', tw: 'Dua gyeene' },
  'task.onion.plant.why': { en: 'Good spacing gives larger bulbs', fr: 'Un bon espacement donne des bulbes plus gros', sw: 'Nafasi nzuri hutoa mizizi mikubwa', ha: 'Tazara mai kyau na ba ƙwai manya', tw: 'Ntam pa ma gyeene kɛseɛ' },
  'task.onion.plant.timing': { en: 'Do this week', fr: 'À faire cette semaine', sw: 'Fanya wiki hii', ha: 'Yi a wannan mako', tw: 'Yɛ nnawɔtwe yi' },
  'task.onion.plant.steps': { en: 'Place bulbs or seeds | Cover lightly with soil | Keep spacing even', fr: 'Placer bulbes ou graines | Couvrir légèrement | Maintenir l\'espacement', sw: 'Weka mbegu au balbu | Funika kwa udongo | Weka nafasi sawa', ha: 'Sa ƙwai ko iri | Rufe kaɗan da ƙasa | Riƙe tazara daidai', tw: 'Fa aba anaa dua | Kata so kakra | Ma ntam no nyɛ pɛ' },
  'task.onion.plant.tips': { en: 'Do not plant too deep', fr: 'Ne pas planter trop profond', sw: 'Usipande kirefu sana', ha: 'Kada ka shuka da zurfi sosai', tw: 'Nnua ne mu nnɔ' },
  'task.onion.plant.outcome': { en: 'Onions are planted.', fr: 'Les oignons sont plantés.', sw: 'Vitunguu vimepandwa.', ha: 'An shuka albasa.', tw: 'Woadua gyeene.' },

  'task.onion.water.title': { en: 'Water your onions', fr: 'Arroser vos oignons', sw: 'Mwagilia kitunguu', ha: 'Shayar da albasa', tw: 'Gu nsu gu gyeene so' },
  'task.onion.water.why': { en: 'Steady moisture forms good bulbs', fr: 'Une humidité régulière forme de bons bulbes', sw: 'Unyevu wa kawaida huunda mizizi', ha: 'Danshi akai-akai na kafa ƙwai', tw: 'Nsu daa ma gyeene yɛ yiye' },
  'task.onion.water.timing': { en: 'Do today', fr: 'À faire aujourd\'hui', sw: 'Fanya leo', ha: 'Yi yau', tw: 'Yɛ nnɛ' },
  'task.onion.water.steps': { en: 'Water lightly | Keep soil moist | Avoid waterlogging', fr: 'Arroser légèrement | Garder humide | Éviter l\'excès', sw: 'Mwagilia kidogo | Weka udongo unyevu | Usifurike', ha: 'Shayar kaɗan | Kiyaye danshi | Kauce wa ruwa mai yawa', tw: 'Gu nsu kakra | Ma asase no nyɛ fɔmu | Mma nsu nnɔso' },
  'task.onion.water.outcome': { en: 'Onions are watered.', fr: 'Les oignons sont arrosés.', sw: 'Kitunguu kimemwagiliwa.', ha: 'An shayar albasa.', tw: 'Woagu gyeene nsu.' },

  'task.onion.weed.title': { en: 'Weed the onion bed', fr: 'Désherber le lit d\'oignon', sw: 'Palilia kitalu cha kitunguu', ha: 'Cire ciyawa daga gadon albasa', tw: 'Popa gyeene mpie no' },
  'task.onion.weed.why': { en: 'Onions compete poorly with weeds', fr: 'Les oignons supportent mal la concurrence', sw: 'Vitunguu haviendani na magugu', ha: 'Albasa bai iya fafatawa da ciyayi ba', tw: 'Gyeene ne wura ntumi goru' },
  'task.onion.weed.timing': { en: 'Do this week', fr: 'À faire cette semaine', sw: 'Fanya wiki hii', ha: 'Yi a wannan mako', tw: 'Yɛ nnawɔtwe yi' },
  'task.onion.weed.steps': { en: 'Pull weeds carefully | Avoid disturbing roots | Keep the bed clean', fr: 'Arracher avec soin | Ne pas déranger les racines | Garder le lit propre', sw: 'Vuta magugu kwa uangalifu | Usisumbue mizizi | Weka kitalu safi', ha: 'Ciri ciyayi a hankali | Kada ka tayar da saiwa | Kiyaye gadon tsafta', tw: 'Twe wura brɛoo | Mma nhini no nhirim | Ma mpie no ho nte' },
  'task.onion.weed.outcome': { en: 'Bed is weeded.', fr: 'Le lit est désherbé.', sw: 'Kitalu kimepaliliwa.', ha: 'An cire ciyawa.', tw: 'Woapopa mpie no.' },

  'task.onion.harvest.title': { en: 'Harvest your onions', fr: 'Récolter vos oignons', sw: 'Vuna kitunguu', ha: 'Girbe albasa', tw: 'Twa wo gyeene' },
  'task.onion.harvest.why': { en: 'Pulled onions need to dry before storage', fr: 'Les oignons doivent sécher avant stockage', sw: 'Vitunguu vinahitaji kukauka kabla ya kuhifadhi', ha: 'Albasa na buƙatar bushewa kafin adanawa', tw: 'Gyeene hia sɛ ɛhyew ansa na yɛakora' },
  'task.onion.harvest.timing': { en: 'When tops fall over', fr: 'Quand les tiges se couchent', sw: 'Wakati vichwa vinaanguka', ha: 'Lokacin da saman ya fadi', tw: 'Sɛ atifi no hwe fam a' },
  'task.onion.harvest.steps': { en: 'Loosen soil around onions | Pull gently | Shake off dirt', fr: 'Ameublir autour des oignons | Tirer doucement | Secouer la terre', sw: 'Lainisha udongo karibu nao | Vuta taratibu | Tikisa udongo', ha: 'Sassauta ƙasa kusa da albasa | Ciro a hankali | Girgiza ƙasa', tw: 'Dwodwo asase wɔ gyeene no ho | Twe brɛoo | Woso fi no' },
  'task.onion.harvest.outcome': { en: 'Onions are harvested.', fr: 'Les oignons sont récoltés.', sw: 'Vitunguu vimevunwa.', ha: 'An girbi albasa.', tw: 'Wɔatwa gyeene no.' },

  'task.onion.dry.title': { en: 'Dry your onions', fr: 'Sécher vos oignons', sw: 'Kausha vitunguu vyako', ha: 'Bushe albasa', tw: 'Hyew wo gyeene' },
  'task.onion.dry.why': { en: 'Dry onions store much longer', fr: 'Bien secs, ils se conservent longtemps', sw: 'Vitunguu vikavu huhifadhiwa kwa muda mrefu', ha: 'Albasa bushe na jimawa', tw: 'Gyeene a ahyew kora kyɛ' },
  'task.onion.dry.timing': { en: 'Do today', fr: 'À faire aujourd\'hui', sw: 'Fanya leo', ha: 'Yi yau', tw: 'Yɛ nnɛ' },
  'task.onion.dry.steps': { en: 'Spread onions in a dry place | Allow airflow | Let skins dry fully', fr: 'Étaler au sec | Laisser l\'air circuler | Sécher les pelures', sw: 'Tawanya mahali pakavu | Ruhusu hewa kupita | Acha ngozi zikauke', ha: 'Baza albasa a busasshen wuri | Bari iska ta shiga | Bari fatar ta bushe', tw: 'Trɛ gyeene wɔ beaeɛ a ɛyɛ hye | Ma mframa nfa mu | Ma ne ho nhonam nhyew' },
  'task.onion.dry.tips': { en: 'Keep out of rain', fr: 'Garder à l\'abri de la pluie', sw: 'Weka mbali na mvua', ha: 'Kiyaye daga ruwan sama', tw: 'Mma osu nntɔ so' },
  'task.onion.dry.outcome': { en: 'Onions are drying.', fr: 'Les oignons sèchent.', sw: 'Vitunguu vinakauka.', ha: 'Albasa na bushewa.', tw: 'Gyeene no rehyew.' },

  // ═══════════════════════════════════════════════════════════
  //  NGO / PARTNER FARMER IMPORT
  // ═══════════════════════════════════════════════════════════
  'import.title': { en: 'Import farmers', fr: 'Importer des agriculteurs', sw: 'Leta wakulima', ha: 'Shigo da manoma', tw: 'De akuafoɔ bra' },
  'import.subtitle': { en: 'Upload a CSV from your system. We\'ll validate, preview, and confirm before creating records.', fr: 'Téléchargez un CSV. Nous validerons et demanderons confirmation avant de créer les enregistrements.', sw: 'Pakia CSV kutoka mfumo wako. Tutathibitisha na kuhakikisha kabla ya kuunda rekodi.', ha: 'Loda CSV daga tsarin ku. Za mu tabbatar kafin ƙirƙirar bayanai.', tw: 'Fa CSV fi wo system mu. Yɛbɛhwɛ na yɛama wo hwɛ ansa na yɛakyerɛw nsɛm no.' },
  'import.validating': { en: 'Checking your file...', fr: 'Vérification du fichier...', sw: 'Inakagua faili yako...', ha: 'Ana duba fayil...', tw: 'Yɛrehwɛ wo fayel no...' },
  'import.importing': { en: 'Importing farmers...', fr: 'Importation en cours...', sw: 'Inaleta wakulima...', ha: 'Ana shigo da manoma...', tw: 'Yɛde akuafoɔ reba...' },

  // Entry phase
  'import.entry.title': { en: 'Upload farmer file', fr: 'Envoyer le fichier', sw: 'Pakia faili ya wakulima', ha: 'Loda fayil na manoma', tw: 'Fa akuafoɔ fayel bra' },
  'import.entry.body': { en: 'Supported: CSV. XLSX support is coming soon.', fr: 'Formats pris en charge : CSV. XLSX bientôt.', sw: 'Zinazotumika: CSV. XLSX itapatikana hivi karibuni.', ha: 'Ana tallafawa: CSV. XLSX za ta zo nan ba da daɗewa ba.', tw: 'Ɛsɛ: CSV. XLSX reba.' },
  'import.entry.organizationId': { en: 'Organization ID', fr: 'ID de l\'organisation', sw: 'Kitambulisho cha shirika', ha: 'ID na Ƙungiya', tw: 'Kuo ID' },
  'import.entry.organizationIdHint': { en: 'Optional — tags the batch to your org', fr: 'Optionnel — lie le lot à votre organisation', sw: 'Si lazima — huunganisha kundi na shirika lako', ha: 'Ba dole ba — tana alaƙar batch da ƙungiyar ku', tw: 'Ɛho nhia — ɛde batch ka wo kuo ho' },
  'import.entry.mode': { en: 'Import mode', fr: 'Mode d\'importation', sw: 'Hali ya kuleta', ha: 'Yanayin shigo da', tw: 'Shigiri kwan' },
  'import.entry.modeCreateUpdate': { en: 'Create new + update matched farmers', fr: 'Créer + mettre à jour les correspondances', sw: 'Unda wapya + sasisha wanaoendana', ha: 'Ƙirƙira sabbin + sabunta daidai-daiye', tw: 'Yɛ foforɔ + sesa deɛ ɛhyia' },
  'import.entry.modeCreateOnly': { en: 'Create new only (skip matches)', fr: 'Créer uniquement (ignorer les correspondances)', sw: 'Unda wapya tu (ruka wanaoendana)', ha: 'Kawai ƙirƙira sabbin (tsallake daidai)', tw: 'Yɛ foforɔ nkoaa (twa mu deɛ ɛhyia)' },
  'import.entry.downloadTemplate': { en: 'Download template', fr: 'Télécharger le modèle', sw: 'Pakua kiolezo', ha: 'Sauke samfuri', tw: 'Yi template' },
  'import.entry.uploadFile': { en: 'Upload file', fr: 'Envoyer un fichier', sw: 'Pakia faili', ha: 'Loda fayil', tw: 'Fa fayel bra' },
  'import.entry.formatHint': { en: 'CSV up to 5 MB / 10,000 rows.', fr: 'CSV jusqu\'à 5 Mo / 10 000 lignes.', sw: 'CSV hadi MB 5 / safu 10,000.', ha: 'CSV har 5 MB / layuka 10,000.', tw: 'CSV kɔsi 5 MB / nkyerɛmu 10,000.' },

  // Preview phase counts
  'import.preview.title': { en: 'Validation summary', fr: 'Résumé de validation', sw: 'Muhtasari wa uthibitishaji', ha: 'Taƙaitaccen tantancewa', tw: 'Nhwehwɛmu nsɛm tiaa' },
  'import.preview.total': { en: 'Total rows', fr: 'Lignes totales', sw: 'Jumla ya safu', ha: 'Jimlar layuka', tw: 'Nkyerɛmu nyinaa' },
  'import.preview.newCount': { en: 'New', fr: 'Nouveaux', sw: 'Wapya', ha: 'Sabbin', tw: 'Foforɔ' },
  'import.preview.updateCount': { en: 'Update', fr: 'Mise à jour', sw: 'Sasisha', ha: 'Sabunta', tw: 'Sesa' },
  'import.preview.duplicateInFile': { en: 'Duplicates', fr: 'Doublons', sw: 'Marudiwa', ha: 'Kwafin', tw: 'Mprɛnu' },
  'import.preview.invalid': { en: 'Invalid', fr: 'Invalides', sw: 'Batili', ha: 'Ba su da inganci', tw: 'Ɛntu' },
  'import.preview.warnings': { en: 'Warnings', fr: 'Avertissements', sw: 'Onyo', ha: 'Gargaɗi', tw: 'Kɔkɔbɔ' },
  'import.preview.tableTitle': { en: 'Preview', fr: 'Aperçu', sw: 'Onyesho la awali', ha: 'Misali', tw: 'Hwɛ di kan' },
  'import.preview.col.row': { en: 'Row', fr: 'Ligne', sw: 'Safu', ha: 'Layi', tw: 'Nkyerɛmu' },
  'import.preview.col.name': { en: 'Name', fr: 'Nom', sw: 'Jina', ha: 'Suna', tw: 'Din' },
  'import.preview.col.phone': { en: 'Phone', fr: 'Téléphone', sw: 'Simu', ha: 'Waya', tw: 'Fon' },
  'import.preview.col.location': { en: 'Location', fr: 'Lieu', sw: 'Mahali', ha: 'Wuri', tw: 'Baabi' },
  'import.preview.col.crop': { en: 'Crop', fr: 'Culture', sw: 'Zao', ha: 'Amfanin gona', tw: 'Nnɔbae' },
  'import.preview.col.status': { en: 'Status', fr: 'Statut', sw: 'Hali', ha: 'Yanayi', tw: 'Tebea' },
  'import.preview.truncated': { en: 'Showing {shown} of {total} rows', fr: 'Affichage de {shown} sur {total} lignes', sw: 'Inaonyesha {shown} kati ya {total}', ha: 'Ana nuna {shown} cikin {total}', tw: 'Yɛrekyerɛ {shown} wɔ {total} mu' },
  'import.preview.confirm': { en: 'Import {count} farmers', fr: 'Importer {count} agriculteurs', sw: 'Leta wakulima {count}', ha: 'Shigo da manoma {count}', tw: 'De akuafoɔ {count} bra' },
  'import.preview.exportErrors': { en: 'Export errors', fr: 'Exporter les erreurs', sw: 'Hamisha makosa', ha: 'Fitar da kurakurai', tw: 'Yi mfomsoɔ' },

  // Row import statuses
  'import.status.new': { en: 'New', fr: 'Nouveau', sw: 'Mpya', ha: 'Sabo', tw: 'Foforɔ' },
  'import.status.update_existing': { en: 'Update', fr: 'Mise à jour', sw: 'Sasisha', ha: 'Sabunta', tw: 'Sesa' },
  'import.status.duplicate_in_file': { en: 'Duplicate', fr: 'Doublon', sw: 'Marudio', ha: 'Kwafi', tw: 'Mprɛnu' },
  'import.status.invalid': { en: 'Invalid', fr: 'Invalide', sw: 'Batili', ha: 'Ba shi da inganci', tw: 'Ɛntu' },

  // Issue messages
  'import.issue.missingName': { en: 'Missing full name', fr: 'Nom complet manquant', sw: 'Jina kamili halipo', ha: 'Babu cikakken suna', tw: 'Din anhye' },
  'import.issue.missingPhone': { en: 'Missing phone number', fr: 'Numéro manquant', sw: 'Nambari ya simu haipo', ha: 'Babu lambar waya', tw: 'Fon nɔma anhye' },
  'import.issue.invalidPhone': { en: 'Phone number looks too short', fr: 'Numéro trop court', sw: 'Nambari ni fupi mno', ha: 'Lambar waya ta yi gajeru', tw: 'Fon nɔma tia dodo' },
  'import.issue.missingCountry': { en: 'Missing country', fr: 'Pays manquant', sw: 'Nchi haipo', ha: 'Babu ƙasa', tw: 'Ɔman anhye' },
  'import.issue.missingRegion': { en: 'Missing region/state', fr: 'Région/État manquant', sw: 'Mkoa haupo', ha: 'Babu yanki', tw: 'Mantam anhye' },
  'import.issue.unknownCrop': { en: 'Crop not recognized', fr: 'Culture non reconnue', sw: 'Zao halitambuliki', ha: 'Amfanin gonar ba a gane ba', tw: 'Yɛnhu nnɔbae no' },
  'import.issue.unknownLanguage': { en: 'Language not supported', fr: 'Langue non prise en charge', sw: 'Lugha haitumiki', ha: 'Ba a tallafawa harshen ba', tw: 'Yɛmma kasa yi ho kwan' },
  'import.issue.duplicateInFile': { en: 'Already in this file', fr: 'Déjà dans le fichier', sw: 'Tayari kwenye faili', ha: 'Tuni a cikin fayil', tw: 'Ɛwɔ fayel yi mu dada' },

  // Result phase
  'import.result.title': { en: 'Import complete', fr: 'Importation terminée', sw: 'Kuleta kumekamilika', ha: 'An gama shigo da', tw: 'Ɔdebra no awie' },
  'import.result.created': { en: 'Created', fr: 'Créés', sw: 'Imeundwa', ha: 'An ƙirƙira', tw: 'Woayɛ' },
  'import.result.updated': { en: 'Updated', fr: 'Mises à jour', sw: 'Imesasishwa', ha: 'An sabunta', tw: 'Woasesa' },
  'import.result.skipped': { en: 'Skipped', fr: 'Ignorés', sw: 'Yameachwa', ha: 'An tsallake', tw: 'Woatwa mu' },
  'import.result.invalid': { en: 'Rejected', fr: 'Rejetés', sw: 'Yamekataliwa', ha: 'An ƙi', tw: 'Woapo' },
  'import.result.batchId': { en: 'Batch ID: {id}', fr: 'ID de lot : {id}', sw: 'Kitambulisho cha kundi: {id}', ha: 'ID na batch: {id}', tw: 'Batch ID: {id}' },
  'import.result.errorsTitle': { en: 'Issues to review', fr: 'Problèmes à examiner', sw: 'Masuala ya kukagua', ha: 'Al\'amura don bita', tw: 'Nsɛm a ɛsɛ sɛ wohwɛ' },
  'import.result.rowLabel': { en: 'Row', fr: 'Ligne', sw: 'Safu', ha: 'Layi', tw: 'Nkyerɛmu' },
  'import.result.done': { en: 'Done', fr: 'Terminé', sw: 'Imeisha', ha: 'An gama', tw: 'Awie' },

  // File-level errors
  'import.error.noFile': { en: 'No file selected', fr: 'Aucun fichier sélectionné', sw: 'Hakuna faili lililochaguliwa', ha: 'Ba a zaɓi fayil ba', tw: 'Wonpaw fayel biara' },
  'import.error.fileTooLarge': { en: 'File is too large (max 5 MB)', fr: 'Fichier trop grand (5 Mo max)', sw: 'Faili ni kubwa mno (kiwango 5 MB)', ha: 'Fayil ya yi girma sosai (iyakar 5 MB)', tw: 'Fayel no sõ dodo (5 MB)' },
  'import.error.unsupportedFormat': { en: 'Unsupported file format', fr: 'Format non supporté', sw: 'Muundo wa faili hautumiki', ha: 'Tsarin fayil ba a tallafawa ba', tw: 'Fayel format no nnyɛ' },
  'import.error.xlsxNotYet': { en: 'XLSX is coming soon — please upload CSV for now', fr: 'XLSX bientôt — veuillez envoyer un CSV', sw: 'XLSX inakuja hivi karibuni — tafadhali tuma CSV kwa sasa', ha: 'XLSX za ta zo nan ba da daɗewa ba — don Allah aika CSV a yanzu', tw: 'XLSX reba — fa CSV bra seesei' },
  'import.error.emptyFile': { en: 'File is empty', fr: 'Fichier vide', sw: 'Faili liko tupu', ha: 'Fayil yana fanko', tw: 'Fayel no mu da mpan' },
  'import.error.tooManyRows': { en: 'File has too many rows (max 10,000)', fr: 'Trop de lignes (max 10 000)', sw: 'Faili lina safu nyingi mno (10,000)', ha: 'Fayil yana da layuka da yawa (iyakar 10,000)', tw: 'Fayel no nkyerɛmu dɔɔso (10,000)' },
  'import.error.generic': { en: 'Something went wrong', fr: 'Une erreur est survenue', sw: 'Kuna tatizo limetokea', ha: 'Wani kuskure ya faru', tw: 'Biribi akɔ mfomso' },
  'import.error.noErrorsToExport': { en: 'No errors to export', fr: 'Aucune erreur à exporter', sw: 'Hakuna makosa ya kuhamisha', ha: 'Babu kurakurai don fitarwa', tw: 'Mfomsoɔ biara nni hɔ' },
  'import.error.missingSaver': { en: 'Import is not configured — contact support', fr: 'Importation non configurée — contactez le support', sw: 'Uingizaji haujawekwa — wasiliana na msaada', ha: 'Ba a saita shigo da ba — tuntuɓi goyon baya', tw: 'Wɔnsiesie ɔdebra — frɛ boafoɔ' },

  // ─── Hardening labels (confidence, possible dup, fallback) ──
  'import.status.possible_duplicate': { en: 'Possible duplicate', fr: 'Doublon possible', sw: 'Huenda ni marudio', ha: 'Mai yiwuwa kwafi', tw: 'Ebia mprɛnu' },
  'import.confidence.high': { en: 'High', fr: 'Élevée', sw: 'Juu', ha: 'Babba', tw: 'Kɛse' },
  'import.confidence.medium': { en: 'Medium', fr: 'Moyenne', sw: 'Wastani', ha: 'Matsakaici', tw: 'Ntam' },
  'import.confidence.low': { en: 'Low', fr: 'Faible', sw: 'Chini', ha: 'Ƙaramin', tw: 'Ketewa' },
  'import.issue.fieldConflict': { en: 'Existing value differs — import will not overwrite', fr: 'Valeur existante différente — non écrasée', sw: 'Thamani iliyopo inatofautiana — haitabadilishwa', ha: 'Wanda ke can ya bambanta — ba za a canza ba', tw: 'Nea ɛwɔ hɔ no sesa — yɛrensesa' },
  'fallback.tellUs.title': { en: 'Tell us about your farm', fr: 'Parlez-nous de votre ferme', sw: 'Tuambie kuhusu shamba lako', ha: 'Gaya mana game da gonarka', tw: 'Ka wo afuo ho asɛm kyerɛ yɛn' },
  'fallback.tellUs.why': { en: 'We need this to guide you better.', fr: 'Cela nous aide à mieux vous guider.', sw: 'Tunahitaji hii ili kukuongoza vizuri zaidi.', ha: 'Muna buƙatar wannan don jagorarka sosai.', tw: 'Yɛhia eyi na yɛatumi akyerɛ wo kwan yiye.' },
  'fallback.tellUs.cta': { en: 'Continue setup', fr: 'Continuer la configuration', sw: 'Endelea na usanidi', ha: 'Ci gaba da saitawa', tw: 'Toa siesieɛ no so' },

  // ═══════════════════════════════════════════════════════════
  //  CAMERA DIAGNOSIS
  // ═══════════════════════════════════════════════════════════
  'camera.pageTitle': { en: 'Scan your crop', fr: 'Scanner votre culture', sw: 'Chukua picha ya zao', ha: 'Duba amfaninku', tw: 'Twa wo nnɔbae mfonini' },
  'camera.entry.title': { en: 'Scan your crop', fr: 'Scanner votre culture', sw: 'Piga picha ya zao lako', ha: 'Duba amfanin gonarku', tw: 'Twa wo nnɔbae mfonini' },
  'camera.entry.body': { en: 'Take a photo to get simple advice on what to do.', fr: 'Prenez une photo pour obtenir des conseils simples.', sw: 'Piga picha kupata ushauri rahisi.', ha: 'Ɗauki hoto don samun shawara mai sauƙi.', tw: 'Twa mfonini na wo bɛnya akwankyerɛ a ɛyɛ mmerɛw.' },
  'camera.entry.cta': { en: 'Take a photo', fr: 'Prendre une photo', sw: 'Piga picha', ha: 'Ɗauki hoto', tw: 'Twa mfonini' },
  'camera.entry.homeCta': { en: 'Scan crop issue', fr: 'Scanner un problème', sw: 'Angalia tatizo la zao', ha: 'Duba matsalar amfani', tw: 'Hwɛ nnɔbae asɛm' },
  'camera.entry.tasksCta': { en: 'Having a problem? Scan', fr: 'Un problème ? Scannez', sw: 'Una tatizo? Piga picha', ha: 'Kana da matsala? Duba', tw: 'Wowɔ ɔhaw? Twa' },
  'camera.loading': { en: 'Analyzing your crop...', fr: 'Analyse de votre culture...', sw: 'Inachambua zao lako...', ha: 'Ana bincika amfani...', tw: 'Yɛrehwɛ wo nnɔbae...' },
  'camera.loading.sub': { en: 'This helps you know what to do next', fr: 'Cela vous aide à savoir quoi faire ensuite', sw: 'Hii inakusaidia kujua cha kufanya baadaye', ha: 'Wannan zai taimaka ka san abin da za ka yi na gaba', tw: 'Eyi bɛboa wo na wo ahu deɛ wo bɛyɛ' },

  // ─── Home hero polish (spec §2, §6, §8) ─────────────────────
  'home.hero.todaysAction': {
    en: "Today's action", fr: "Action du jour", sw: 'Hatua ya leo', ha: 'Aikin yau', tw: 'Ɛnnɛ adeyɛ',
  },
  'home.hero.why': {
    en: 'Why:', fr: 'Pourquoi :', sw: 'Kwa nini:', ha: 'Me yasa:', tw: 'Adɛn:',
  },
  'home.cta.fixToday': {
    en: 'Fix this today', fr: 'Réglez ça aujourd\'hui', sw: 'Shughulikia leo', ha: 'Gyara yau', tw: 'Siesie nnɛ', hi: 'आज ठीक करें',
  },
  'home.cta.actNow': {
    en: 'Act now', fr: 'Agir maintenant', sw: 'Chukua hatua sasa', ha: 'Yi yanzu', tw: 'Yɛ seesei',
  },
  'home.nextUp': {
    en: 'Next up', fr: 'Ensuite', sw: 'Inayofuata', ha: 'Na gaba', tw: 'Nea ɛdi hɔ',
  },
  'home.cameraDone.reveal': {
    en: '✓ Good work — your crop is getting better',
    fr: '✓ Bon travail — votre culture s\'améliore',
    sw: '✓ Kazi nzuri — zao lako linaboreshwa',
    ha: '✓ Aikin kirki — amfaninku yana samun sauƙi',
    tw: '✓ Adwuma pa — wo nnɔbae rekɔ so yie',
  },

  // ─── Off-season fallback (spec §9) ─────────────────────────
  'offSeason.title': {
    en: 'Plan your next crop',
    fr: 'Planifiez votre prochaine culture',
    sw: 'Panga zao lako lijalo',
    ha: 'Shirya amfani na gaba',
    tw: 'Siesie wo nnɔbae a ɛdi hɔ',
    hi: 'अगली फसल की योजना बनाएं',
  },
  'offSeason.why': {
    en: 'This is not the main season now',
    fr: 'Ce n\'est pas la saison principale',
    sw: 'Hii sio msimu mkuu kwa sasa',
    ha: 'Wannan ba babban lokaci bane yanzu',
    tw: 'Ɛnyɛ bere titiriw no seesei',
  },
  'offSeason.cta': {
    en: 'Continue', fr: 'Continuer', sw: 'Endelea', ha: 'Ci gaba', tw: 'Kɔ so', hi: 'जारी रखें',
  },
  'offSeason.steps': {
    en: 'Prepare your land early | Gather seeds and inputs | Watch for upcoming rains',
    fr: 'Préparez votre terrain tôt | Rassemblez semences et intrants | Surveillez les prochaines pluies',
    sw: 'Andaa ardhi yako mapema | Kusanya mbegu na pembejeo | Angalia mvua zinazokuja',
    ha: 'Shirya gonar da wuri | Tattara iri da abubuwan amfani | Duba ruwan sama mai zuwa',
    tw: 'Siesie w\'asase ntɛm | Boaboa aba ne nneɛma | Hwɛ osu a ɛbɛba',
  },

  // ─── Weather adjustments (spec §1) ─────────────────────────
  'weatherAdj.plant.rainSoon.title': {
    en: 'Plant your crop now',
    fr: 'Plantez votre culture maintenant',
    sw: 'Panda zao lako sasa',
    ha: 'Shuka amfaninku yanzu',
    tw: 'Dua wo nnɔbae seesei',
  },
  'weatherAdj.plant.rainSoon.why': {
    en: 'Rain is expected soon',
    fr: 'La pluie arrive bientôt',
    sw: 'Mvua inatarajiwa hivi karibuni',
    ha: 'Ana sa ran ruwan sama nan ba da daɗewa ba',
    tw: 'Osu reba ntɛm',
  },
  'weatherAdj.plant.waitDry.title': {
    en: 'Wait before planting',
    fr: 'Attendez avant de planter',
    sw: 'Subiri kabla ya kupanda',
    ha: 'Dakata kafin shuka',
    tw: 'Twɛn ansa na woadua',
  },
  'weatherAdj.plant.waitDry.why': {
    en: 'Soil may be too dry',
    fr: 'Le sol est peut-être trop sec',
    sw: 'Udongo unaweza kuwa mkavu sana',
    ha: 'Ƙasa na iya zama busasshe sosai',
    tw: 'Asase no bɛyɛ kuro dodo',
  },
  'weatherAdj.water.heat.title': {
    en: 'Water your crop today',
    fr: 'Arrosez votre culture aujourd\'hui',
    sw: 'Mwagilia zao lako leo',
    ha: 'Shayar da amfaninku yau',
    tw: 'Gu wo nnɔbae nsu nnɛ',
  },
  'weatherAdj.water.heat.why': {
    en: 'Heat is high today',
    fr: 'La chaleur est forte aujourd\'hui',
    sw: 'Joto ni kali leo',
    ha: 'Zafi yana da yawa yau',
    tw: 'Ɛhyew ano yɛ den nnɛ',
  },

  // ─── Task correction flow (spec §1, §2, §3) ────────────────
  'correction.undo': {
    en: 'Undo', fr: 'Annuler', sw: 'Tendua', ha: 'Soke', tw: 'San yi', hi: 'पूर्ववत करें',
  },
  'correction.somethingWrong': {
    en: 'Something is wrong', fr: 'Quelque chose ne va pas', sw: 'Kuna tatizo', ha: 'Akwai matsala', tw: 'Biribi nyɛ yie', hi: 'कुछ गलत है',
  },
  'correction.markNotDone': {
    en: 'Mark as not done', fr: 'Marquer comme non fait', sw: 'Weka kama haijakamilika', ha: 'Sanya ba a gama ba', tw: 'Kyerɛ sɛ wunyɛɛ ɛ', hi: 'अधूरा चिह्नित करें',
  },
  'correction.title': {
    en: 'What\'s wrong with this task?',
    fr: 'Quel est le problème avec cette tâche ?',
    sw: 'Shida ni nini kwenye kazi hii?',
    ha: 'Mene ne matsalar wannan aiki?',
    tw: 'Dɛn na ɛnyɛ yie wɔ adwuma yi ho?',
  },
  'correction.subtitle': {
    en: 'Pick one — we\'ll fix it safely.',
    fr: 'Choisissez une option — on corrige sans risque.',
    sw: 'Chagua moja — tutarekebisha kwa usalama.',
    ha: 'Zaɓi ɗaya — za mu gyara da aminci.',
    tw: 'Paw baako — yɛbɛsiesie no dwoodwoo.',
  },
  'correction.reason.didntDo': {
    en: "I didn't do this yet",
    fr: "Je ne l'ai pas encore fait",
    sw: 'Bado sijafanya hii',
    ha: 'Ban yi wannan ba tukuna',
    tw: 'Minyɛɛ yei ɛ',
  },
  'correction.reason.tapByMistake': {
    en: 'I tapped by mistake',
    fr: "J'ai appuyé par erreur",
    sw: 'Niligusa kwa bahati mbaya',
    ha: 'Na danna kuskure',
    tw: 'Mekaa no mfomsoɔ mu',
  },
  'correction.reason.notApplicable': {
    en: 'This does not apply to me',
    fr: 'Cela ne me concerne pas',
    sw: 'Hii haitumiki kwangu',
    ha: 'Wannan bai shafe ni ba',
    tw: 'Eyi mfa me ho',
  },
  'correction.reason.needHelp': {
    en: 'I need help',
    fr: "J'ai besoin d'aide",
    sw: 'Ninahitaji msaada',
    ha: 'Ina buƙatar taimako',
    tw: 'Mehia mmoa',
  },
  'correction.restored': {
    en: 'Restored — you can continue this task',
    fr: 'Restauré — vous pouvez continuer cette tâche',
    sw: 'Imerejeshwa — unaweza kuendelea na kazi hii',
    ha: 'An maido — za ka iya ci gaba da wannan aiki',
    tw: 'Wɔasan de aba — wobɛtumi atoa adwuma yi so',
  },
  'correction.flagged': {
    en: 'Thanks — we\'ll use this to improve guidance',
    fr: 'Merci — nous améliorerons les conseils',
    sw: 'Asante — tutatumia kuboresha mwongozo',
    ha: 'Godiya — za mu yi amfani da wannan don inganta jagora',
    tw: 'Yɛda wo ase — yɛde eyi bɛyɛ akwankyerɛ no yiye',
  },
  'correction.helpMarked': {
    en: 'We\'ll note this — keep the task visible',
    fr: 'Nous notons cela — gardez la tâche visible',
    sw: 'Tutaona — hifadhi kazi ionekane',
    ha: 'Za mu lura — sa aikin ya bayyana',
    tw: 'Yɛbɛhwɛ eyi so — ma adwuma no nna adi',
  },

  // ═══════════════════════════════════════════════════════════
  //  LAND INTELLIGENCE (spec §§1–10)
  // ═══════════════════════════════════════════════════════════

  // Entry
  'land.entry.title': {
    en: 'Check your land', fr: 'Vérifier votre terrain', sw: 'Angalia ardhi yako', ha: 'Duba ƙasarka', tw: 'Hwɛ w\'asase',
  },
  'land.entry.body': {
    en: 'Tell us about your land to get better guidance today.',
    fr: 'Parlez-nous de votre terrain pour de meilleurs conseils.',
    sw: 'Tuambie kuhusu ardhi yako ili upate mwongozo bora leo.',
    ha: 'Gaya mana game da ƙasarka don jagora mafi kyau yau.',
    tw: 'Ka w\'asase ho asɛm kyerɛ yɛn na wo nya akwankyerɛ pa nnɛ.',
  },
  'land.entry.cta': {
    en: 'Begin', fr: 'Commencer', sw: 'Anza', ha: 'Fara', tw: 'Fi ase',
  },
  'land.entry.homeCta': {
    en: 'Check your land', fr: 'Vérifier votre terrain', sw: 'Angalia ardhi yako', ha: 'Duba ƙasarka', tw: 'Hwɛ w\'asase',
  },

  // Questions
  'land.q.cleared': {
    en: 'Is the land already cleared?',
    fr: 'Le terrain est-il déjà dégagé ?',
    sw: 'Je, ardhi imeshasafishwa?',
    ha: 'Ƙasar ta riga ta tsabtace?',
    tw: 'Wɔatwitwa asase no dada anaa?',
  },
  'land.q.weeds': {
    en: 'Are weeds present?',
    fr: 'Y a-t-il des mauvaises herbes ?',
    sw: 'Je, kuna magugu?',
    ha: 'Akwai ciyayi?',
    tw: 'Wura wɔ hɔ anaa?',
  },
  'land.q.soilMoisture': {
    en: 'How does the soil feel?',
    fr: 'Comment est le sol ?',
    sw: 'Udongo unaonekanaje?',
    ha: 'Yaya ƙasa take?',
    tw: 'Sɛn na asase no teɛ?',
  },
  'land.q.drainage': {
    en: 'Does water stay on the land after rain?',
    fr: 'L\'eau reste-t-elle sur le terrain après la pluie ?',
    sw: 'Je, maji hukaa shambani baada ya mvua?',
    ha: 'Ruwa yakan tsaya a ƙasa bayan ruwan sama?',
    tw: 'Nsu tena asase no so osu tɔ akyi anaa?',
  },
  'land.q.slope': {
    en: 'Is the land flat or sloped?',
    fr: 'Le terrain est-il plat ou en pente ?',
    sw: 'Je, ardhi ni tambarare au ina mteremko?',
    ha: 'Ƙasar daidai take ko tana gangare?',
    tw: 'Asase no yɛ tamaa anaa ɛkɔ soro?',
  },
  'land.q.irrigation': {
    en: 'Do you have irrigation?',
    fr: 'Avez-vous de l\'irrigation ?',
    sw: 'Je, una umwagiliaji?',
    ha: 'Kana da banruwa?',
    tw: 'Wowɔ nsu gu?',
  },

  // Answer labels (soil moisture, slope)
  'land.soil.dry':     { en: 'Dry',      fr: 'Sec',     sw: 'Kavu',     ha: 'Busasshe', tw: 'Kuro' },
  'land.soil.moist':   { en: 'Moist',    fr: 'Humide',  sw: 'Majimaji', ha: 'Mai laima', tw: 'Fɔmu' },
  'land.soil.wet':     { en: 'Wet',      fr: 'Mouillé', sw: 'Mvua',     ha: 'Jikakke',   tw: 'Nsu ayɛ so' },
  'land.soil.unknown': { en: 'Not sure', fr: 'Pas sûr', sw: 'Sijui',    ha: 'Ban tabbata ba', tw: 'Minnim' },
  'land.slope.flat':    { en: 'Flat',           fr: 'Plat',              sw: 'Tambarare',       ha: 'Daidai',       tw: 'Tamaa' },
  'land.slope.gentle':  { en: 'Slightly sloped', fr: 'Légère pente',      sw: 'Mteremko kidogo', ha: 'Gangare kadan', tw: 'Ɛkɔ soro kakra' },
  'land.slope.steep':   { en: 'Steep',          fr: 'Forte pente',       sw: 'Mteremko mkali',  ha: 'Mai gangare',  tw: 'Ɛkɔ soro kɛse' },
  'land.slope.unknown': { en: 'Not sure',       fr: 'Pas sûr',           sw: 'Sijui',           ha: 'Ban tabbata ba', tw: 'Minnim' },

  // Optional extras
  'land.optional':        { en: 'Optional — add more detail', fr: 'Optionnel — plus de détails', sw: 'Hiari — ongeza taarifa zaidi', ha: 'Ba tilas ba — ƙara cikakken bayani', tw: 'Wopɛ a — fa nsɛm foforɔ ka ho' },
  'land.addPhoto':        { en: 'Add a photo',                fr: 'Ajouter une photo',          sw: 'Ongeza picha',                ha: 'Ƙara hoto',                     tw: 'Fa mfonini ka ho' },
  'land.retakePhoto':     { en: 'Retake photo',               fr: 'Reprendre la photo',         sw: 'Chukua picha upya',           ha: 'Sake ɗaukar hoto',              tw: 'San twa mfonini' },
  'land.saveGps':         { en: 'Save field location',        fr: 'Enregistrer la localisation', sw: 'Hifadhi eneo la shamba',     ha: 'Ajiye wurin filin',             tw: 'Kora afuo baabi' },
  'land.gpsSaved':        { en: 'Location saved',             fr: 'Localisation enregistrée',   sw: 'Eneo limehifadhiwa',          ha: 'An adana wurin',                tw: 'Woakora baabi' },
  'land.areaPlaceholder': { en: 'Area (number)',              fr: 'Superficie (nombre)',        sw: 'Eneo (nambari)',              ha: 'Girman (lamba)',                tw: 'Nsase kɛseɛ (nɔma)' },
  'land.unit.acre':       { en: 'acre',    fr: 'acre',    sw: 'ekari',   ha: 'eka',  tw: 'ekɛ' },
  'land.unit.hectare':    { en: 'hectare', fr: 'hectare', sw: 'hekta',   ha: 'hekta', tw: 'hekta' },

  // Result screen copy
  'land.result.noIssueTitle': {
    en: 'Your field looks ready',
    fr: 'Votre terrain semble prêt',
    sw: 'Shamba lako linaonekana tayari',
    ha: 'Filin ka yana a shirye',
    tw: 'W\'afuo no ayɛ krado',
  },
  'land.result.noIssueBody': {
    en: 'Keep following your crop plan.',
    fr: 'Continuez votre plan de culture.',
    sw: 'Endelea na mpango wako wa kilimo.',
    ha: 'Ci gaba da shirin amfaninku.',
    tw: 'Toa wo nnɔbae nhyehyɛeɛ so.',
  },
  'land.checkAgain': {
    en: 'Check the land again', fr: 'Revérifier le terrain', sw: 'Angalia ardhi tena', ha: 'Sake duba ƙasar', tw: 'San hwɛ asase no',
  },

  // Land-aware tasks (spec §7)
  'land.task.clearLand.title': {
    en: 'Clear your field this week',
    fr: 'Défrichez votre champ cette semaine',
    sw: 'Safisha shamba lako wiki hii',
    ha: 'Share gonarka wannan mako',
    tw: 'Twitwa w\'afuo nnawɔtwe yi',
  },
  'land.task.clearLand.why': {
    en: 'The land is not ready for planting yet',
    fr: 'Le terrain n\'est pas encore prêt à planter',
    sw: 'Ardhi bado haijawa tayari kwa kupanda',
    ha: 'Ƙasar ba a shirye take don shuka ba tukuna',
    tw: 'Asase no nna ahyɛ da a wodua',
  },
  'land.task.clearLand.steps': {
    en: 'Cut weeds and grasses | Remove stones and debris | Clear dry plants',
    fr: 'Couper les mauvaises herbes | Enlever pierres et débris | Dégager les plantes sèches',
    sw: 'Kata magugu na nyasi | Ondoa mawe na taka | Ondoa mimea kavu',
    ha: 'Yanke ciyayi | Cire duwatsu da datti | Cire busasshen shuke-shuke',
    tw: 'Twa nwura ne sare | Yi aboɔ ne fi | Yi nnua a awoɔ',
  },
  'land.task.clearLand.tip': {
    en: 'Work early when it is cool',
    fr: 'Travaillez tôt à la fraîche',
    sw: 'Fanya kazi mapema wakati ni baridi',
    ha: 'Yi aiki da safe lokacin yanayi sanyi',
    tw: 'Yɛ adwuma anɔpa bere a ewim dwodwo',
  },
  'land.task.removeWeeds.title': {
    en: 'Remove weeds from your field today',
    fr: 'Retirez les mauvaises herbes aujourd\'hui',
    sw: 'Ondoa magugu shambani leo',
    ha: 'Cire ciyayi daga gonar yau',
    tw: 'Yi wura fi w\'afuo no so nnɛ',
  },
  'land.task.removeWeeds.why': {
    en: 'Weeds take water and nutrients from your crop',
    fr: 'Les mauvaises herbes prennent l\'eau et les nutriments',
    sw: 'Magugu hunyang\'anya mazao maji na virutubisho',
    ha: 'Ciyayi suna ɗaukar ruwa da abinci daga amfanin',
    tw: 'Wura gye nsu ne aduan fi wo nnɔbae hɔ',
  },
  'land.task.removeWeeds.steps': {
    en: 'Pull weeds by hand | Clear between rows | Keep soil loose',
    fr: 'Arracher à la main | Dégager entre les rangs | Garder le sol meuble',
    sw: 'Vuta magugu kwa mkono | Safisha kati ya mistari | Weka udongo laini',
    ha: 'Ciri ciyayi da hannu | Share tsakanin layuka | Kiyaye ƙasa sassauta',
    tw: 'Twe wura no fi nsa | Popa ntam no mu | Ma asase no ndwodwo',
  },
  'land.task.removeWeeds.tip': {
    en: 'Pull when the soil is slightly moist',
    fr: 'Arrachez quand le sol est légèrement humide',
    sw: 'Vuta wakati udongo una unyevu kidogo',
    ha: 'Ciri lokacin da ƙasa take da ɗan laima',
    tw: 'Twe bere a asase no yɛ fɔmu kakra',
  },
  'land.task.waitTilling.title': {
    en: 'Wait before tilling',
    fr: 'Attendez avant de labourer',
    sw: 'Subiri kabla ya kulima',
    ha: 'Dakata kafin nomewa',
    tw: 'Twɛn ansa na woafuntum asase',
  },
  'land.task.waitTilling.why': {
    en: 'Wet soil can be damaged if worked now',
    fr: 'Un sol mouillé peut être abîmé en le travaillant',
    sw: 'Udongo mvua unaweza kuharibika ukilimwa sasa',
    ha: 'Ƙasa mai jiki na iya lalacewa idan aka noma yanzu',
    tw: 'Sɛ wofuntum asase a nsu ayɛ so seesei a ɛbɛsɛe',
  },
  'land.task.waitTilling.steps': {
    en: 'Let the soil dry | Check again in 1–2 days | Avoid heavy field work for now',
    fr: 'Laissez sécher le sol | Revérifiez dans 1–2 jours | Évitez les gros travaux',
    sw: 'Acha udongo ukauke | Angalia tena baada ya siku 1–2 | Epuka kazi nzito shambani',
    ha: 'Bar ƙasa ta bushe | Sake duba bayan kwanaki 1–2 | Kauce ga aiki mai nauyi yanzu',
    tw: 'Ma asase no nhyew | San hwɛ nnansa 1–2 akyi | Mma adwuma kɛse nnyɛ afuo seesei',
  },
  'land.task.waitTilling.tip': {
    en: 'Dry soil keeps its structure when worked',
    fr: 'Un sol sec garde sa structure',
    sw: 'Udongo kavu huhifadhi muundo wake',
    ha: 'Ƙasa busasshe na riƙe tsarinta',
    tw: 'Asase a awoɔ kora ne nhyehyɛeɛ',
  },
  'land.task.prepareDrainage.title': {
    en: 'Prepare drainage before rain',
    fr: 'Préparez le drainage avant la pluie',
    sw: 'Andaa mifereji kabla ya mvua',
    ha: 'Shirya magudanar ruwa kafin ruwan sama',
    tw: 'Siesie nsu kwan ansa na osu atɔ',
  },
  'land.task.prepareDrainage.why': {
    en: 'Water may stay on your field after rain',
    fr: 'L\'eau pourrait rester sur le terrain après la pluie',
    sw: 'Maji yanaweza kubaki shambani baada ya mvua',
    ha: 'Ruwa na iya tsayawa a gonarka bayan ruwan sama',
    tw: 'Nsu bɛtena w\'afuo so osu tɔ akyi',
  },
  'land.task.prepareDrainage.steps': {
    en: 'Clear blocked runoff paths | Open shallow drainage lines | Check low areas in the field',
    fr: 'Déboucher les écoulements | Ouvrir de petits fossés | Vérifier les zones basses',
    sw: 'Safisha njia za maji | Fungua mifereji midogo | Angalia sehemu za chini shambani',
    ha: 'Share hanyoyin magudanar ruwa | Buɗe ƙananan layukan ruwa | Duba ƙananan wurare',
    tw: 'Popa nsu kwan a ayera | Bue nsu kwan nketewa | Hwɛ baabi a ɛwɔ ase',
  },
  'land.task.prepareDrainage.tip': {
    en: 'Start before the rain arrives',
    fr: 'Commencez avant que la pluie n\'arrive',
    sw: 'Anza kabla mvua haijafika',
    ha: 'Fara kafin ruwan sama ya zo',
    tw: 'Fi ase ansa na osu aba',
  },
  'land.task.waitPlanting.title': {
    en: 'Wait before planting',
    fr: 'Attendez avant de planter',
    sw: 'Subiri kabla ya kupanda',
    ha: 'Dakata kafin shuka',
    tw: 'Twɛn ansa na woadua',
  },
  'land.task.waitPlanting.why': {
    en: 'Soil is too dry and rain is not expected',
    fr: 'Le sol est trop sec et aucune pluie prévue',
    sw: 'Udongo ni mkavu sana na hakuna mvua inayotarajiwa',
    ha: 'Ƙasa ta bushe sosai kuma ba a sa ran ruwan sama ba',
    tw: 'Asase awoɔ dodo na osu mma',
  },
  'land.task.waitPlanting.steps': {
    en: 'Gather your seeds and inputs | Check again in 1–2 days | Plant once the soil is moist',
    fr: 'Préparez semences et intrants | Revérifiez dans 1–2 jours | Semez quand le sol est humide',
    sw: 'Kusanya mbegu na pembejeo | Angalia tena baada ya siku 1–2 | Panda udongo ukiwa na unyevu',
    ha: 'Tattara iri da abubuwan amfani | Sake duba bayan kwanaki 1–2 | Shuka lokacin da ƙasa take da laima',
    tw: 'Boaboa aba ne nneɛma | San hwɛ nnansa 1–2 akyi | Dua bere a asase no yɛ fɔmu',
  },
  'land.task.waitPlanting.tip': {
    en: 'Planting into dry soil hurts germination',
    fr: 'Semer dans un sol sec nuit à la germination',
    sw: 'Kupanda katika udongo kavu huathiri kuota',
    ha: 'Shuka a ƙasa busasshe na lalata tsiro',
    tw: 'Sɛ wudua wɔ asase a awoɔ so a ɛsɛe afifideɛ',
  },

  // Common yes/no for the binary steps
  'common.yes': { en: 'Yes', fr: 'Oui', sw: 'Ndiyo', ha: 'Ee', tw: 'Aane' },
  'common.no':  { en: 'No',  fr: 'Non', sw: 'Hapana', ha: 'A\'a', tw: 'Dabi' },

  // ─── Regional step/tip overrides (spec §10) ────────────────
  // Mechanized temperate tone — no "by hand" wording.
  'region.steps.clearField.mechanized': {
    en: 'Clear vegetation from the field | Remove stones and stubble | Open access for equipment',
    fr: 'Dégager la végétation | Enlever pierres et chaumes | Ouvrir l\'accès pour les engins',
    sw: 'Safisha mimea shambani | Ondoa mawe na mabaki | Fungua njia kwa mashine',
    ha: 'Share ciyayi daga gona | Cire duwatsu da ragowar amfani | Buɗe hanyar injina',
    tw: 'Yi wura no wɔ afuo no mu | Yi aboɔ ne mfuo ase | Bue kwan ma mfidie',
  },
  'region.tip.clearField.mechanized': {
    en: 'Work when soil is firm — not waterlogged',
    fr: 'Travaillez quand le sol est ferme, pas détrempé',
    sw: 'Fanya kazi udongo ukiwa imara, siyo umelowa',
    ha: 'Yi aiki lokacin da ƙasa ta ƙanƙanta, ba lokacin da ta jiƙe ba',
    tw: 'Yɛ adwuma bere a asase no awoɔ, ɛnyɛ bere a nsu ayɛ so',
  },
  'region.steps.prepareLand.mechanized': {
    en: 'Prepare the field with equipment | Set up straight rows | Check drainage is clear',
    fr: 'Préparer le champ avec des engins | Tracer des rangs droits | Vérifier le drainage',
    sw: 'Andaa shamba kwa mashine | Weka mistari iliyonyooka | Hakikisha mifereji iko wazi',
    ha: 'Shirya gona da injin noma | Kafa layuka masu mike | Tabbatar magudanar ruwa tana buɗe',
    tw: 'Fa mfidie siesie afuo no | Yɛ ntam a ɛte tee | Hwɛ sɛ nsu kwan mu yɛ krɔnkrɔn',
  },
  'region.tip.prepareLand.mechanized': {
    en: 'Avoid heavy equipment on wet soil',
    fr: 'Évitez les engins lourds sur sol humide',
    sw: 'Epuka mashine nzito kwenye udongo mvua',
    ha: 'Kauce injina masu nauyi a ƙasa mai jiki',
    tw: 'Mma mfidie a emu yɛ duru nnka asase a ɛmu yɛ fɔmu so',
  },
  'region.steps.plantSeeds.mechanized': {
    en: 'Calibrate the seed drill | Plant in even rows | Check seed depth',
    fr: 'Calibrer le semoir | Semer en rangs réguliers | Vérifier la profondeur',
    sw: 'Sanidi mashine ya kupanda | Panda kwa mistari sawa | Angalia kina cha mbegu',
    ha: 'Saita injin shuka | Shuka a layuka daidai | Duba zurfin iri',
    tw: 'Hyehyɛ aba dua mfidie | Dua wɔ ntam a ɛpɛpɛ | Hwɛ aba no mu tenten',
  },
  'region.tip.weedField.mechanized': {
    en: 'Use equipment when rows are dry and firm',
    fr: 'Utilisez l\'équipement quand les rangs sont secs et fermes',
    sw: 'Tumia mashine wakati mistari imekauka na imara',
    ha: 'Yi amfani da injin lokacin da layuka suka bushe',
    tw: 'Fa mfidie no bere a ntam no awoɔ na emu yɛ den',
  },

  // Tropical manual tone.
  'region.steps.clearField.manual': {
    en: 'Cut weeds and grasses by hand | Pick out stones and debris | Clear old plant roots',
    fr: 'Couper herbes et mauvaises herbes à la main | Enlever pierres et débris | Retirer les vieilles racines',
    sw: 'Kata magugu na nyasi kwa mkono | Okota mawe na taka | Ondoa mizizi ya zamani',
    ha: 'Yanke ciyayi da hannu | Cire duwatsu da datti | Cire tsoffin saiwoyi',
    tw: 'Twa nwura ne sare fi nsa | Yi aboɔ ne fi | Yi nhini dada',
  },
  'region.tip.clearField.manual': {
    en: 'Work early in the morning when it is cool',
    fr: 'Travaillez tôt le matin à la fraîche',
    sw: 'Fanya kazi asubuhi mapema wakati kuna baridi',
    ha: 'Yi aiki da safe lokacin da yanayi ke sanyi',
    tw: 'Yɛ adwuma anɔpatuutuu bere a ewim dwodwo',
  },
  'region.steps.prepareLand.manual': {
    en: 'Loosen the soil with a hoe | Break up big soil clumps | Level the bed evenly',
    fr: 'Ameublir le sol à la houe | Casser les grosses mottes | Niveler la planche',
    sw: 'Lainisha udongo kwa jembe | Vunja madongo makubwa | Sawazisha kitalu vizuri',
    ha: 'Sassauta ƙasa da fartanya | Fasa manyan kulli | Daidaita gadon',
    tw: 'Dwodwo asase de asɔsɔ | Paapae kulli akɛseɛ | Siesie mpie no so pɛ',
  },
  'region.tip.prepareLand.manual': {
    en: 'Do not work waterlogged soil',
    fr: 'Ne travaillez pas un sol gorgé d\'eau',
    sw: 'Usilime udongo uliolowa',
    ha: 'Kada ka yi aiki ƙasa mai ruwa',
    tw: 'Nyɛ asase a nsu ayɛ so mu adwuma',
  },

  // Tropical mixed tone.
  'region.steps.prepareLand.mixed': {
    en: 'Till the soil | Mark planting rows | Remove any remaining roots',
    fr: 'Travailler le sol | Tracer les rangs | Retirer les racines restantes',
    sw: 'Lima udongo | Weka alama za mistari | Ondoa mizizi iliyobaki',
    ha: 'Nome ƙasa | Yi alama layuka | Cire saiwoyin da suka rage',
    tw: 'Funtum asase | Yɛ ntam a wobɛdua | Yi nhini a aka',
  },

  // Monsoon mixed tone.
  'region.steps.prepareLand.monsoon': {
    en: 'Build drainage bunds | Level the planting area | Align with rain timing',
    fr: 'Monter les diguettes | Niveler la zone | Aligner avec les pluies',
    sw: 'Tengeneza tuta la kumwaga maji | Sawazisha eneo | Linganisha na mvua',
    ha: 'Gina tungar magudanar ruwa | Daidaita wurin shuka | Daidaita da lokacin ruwan sama',
    tw: 'Yɛ nsu kwan ntrɛmu | Siesie baabi a wobɛdua | Fa ne osutɔ bere to mu',
  },
  'region.tip.prepareLand.monsoon': {
    en: 'Start before the monsoon sets in',
    fr: 'Commencez avant la mousson',
    sw: 'Anza kabla ya monsuni',
    ha: 'Fara kafin lokacin damina',
    tw: 'Fi ase ansa na osutɔ kɛseɛ mmra',
  },
  'region.tip.plantSeeds.monsoon': {
    en: 'Plant once the rains are steady',
    fr: 'Semez quand les pluies sont régulières',
    sw: 'Panda wakati mvua zimetulia',
    ha: 'Shuka lokacin da ruwan sama ya yi tsayin daka',
    tw: 'Dua bere a osu retɔ daa',
  },

  // Dry / irrigated tone.
  'region.steps.prepareLand.dry': {
    en: 'Shape ridges or basins to hold water | Loosen the soil | Check the irrigation line',
    fr: 'Former des billons ou cuvettes pour retenir l\'eau | Ameublir | Vérifier l\'irrigation',
    sw: 'Tengeneza matuta au mabonde kuhifadhi maji | Lainisha udongo | Angalia mfereji',
    ha: 'Yi kududdufai ko manyan matsugunan ruwa | Sassauta ƙasa | Duba bututun ruwa',
    tw: 'Yɛ ntrɛmu anaa amena a ɛbɛkora nsu | Dwodwo asase | Hwɛ nsu kwan no',
  },
  'region.tip.waterAfterPlanting.dry': {
    en: 'Irrigate soon after planting — rainfall is sparse',
    fr: 'Irriguez peu après le semis — les pluies sont rares',
    sw: 'Nyunyizia mbegu baada ya kupanda — mvua ni chache',
    ha: 'Ba da ruwa jim kaɗan bayan shuka — ruwan sama kaɗan ne',
    tw: 'Gu nsu ntɛm bere a woadua wie — osu nni hɔ pii',
  },

  // Result chrome
  'camera.result.todaysAction': { en: "Today's action", fr: "Action du jour", sw: 'Hatua ya leo', ha: 'Aikin yau', tw: 'Ɛnnɛ adeyɛ' },
  'camera.result.why': { en: 'Why', fr: 'Pourquoi', sw: 'Kwa nini', ha: 'Me yasa', tw: 'Adɛn' },
  'camera.result.steps': { en: 'Steps', fr: 'Étapes', sw: 'Hatua', ha: 'Matakai', tw: 'Anammɔn' },
  'camera.result.addToTasks': { en: 'Add to my tasks', fr: 'Ajouter à mes tâches', sw: 'Ongeza kwenye kazi zangu', ha: 'Ƙara cikin ayyukana', tw: 'Fa ka me nnwuma ho' },
  'camera.result.markDone': { en: 'Mark as done', fr: 'Marquer comme fait', sw: 'Weka kama imekamilika', ha: 'Sanya an kammala', tw: 'Kyerɛ sɛ woawie' },
  'camera.result.later': { en: 'Save for later', fr: 'Garder pour plus tard', sw: 'Hifadhi kwa baadaye', ha: 'Ajiye don baya', tw: 'Kora ma akyire' },
  'camera.result.taskAdded': { en: 'Added — do this today', fr: 'Ajouté — à faire aujourd\'hui', sw: 'Imeongezwa — fanya leo', ha: 'An ƙara — yi yau', tw: 'Woafa — yɛ nnɛ', hi: 'जोड़ा गया — आज करें' },
  'camera.result.rescan': { en: 'Scan another photo', fr: 'Scanner une autre photo', sw: 'Piga picha nyingine', ha: 'Ɗauki wani hoto', tw: 'Twa mfonini foforɔ' },

  // History
  'camera.history.title': { en: 'Recent scans', fr: 'Scans récents', sw: 'Picha za hivi karibuni', ha: 'Binciken kwanan nan', tw: 'Mfonini a ɛbɛn' },

  // Action: pest
  'camera.action.pest.title': { en: 'Check under leaves and remove pests today', fr: 'Vérifiez sous les feuilles et retirez les ravageurs', sw: 'Angalia chini ya majani na uondoe wadudu leo', ha: 'Duba ƙarƙashin ganyaye ka cire kwari yau', tw: 'Hwɛ nhaban ase na yi mmoawa nnɛ' },
  'camera.action.pest.why': { en: 'Pests spread fast and can damage your crop', fr: 'Les ravageurs se propagent vite et peuvent abîmer la culture', sw: 'Wadudu huenea haraka na wanaweza kuharibu zao', ha: 'Kwari suna yaɗuwa da sauri kuma suna iya lalata amfani', tw: 'Mmoawa trɛ ntɛm na wɔbɛtumi asɛe wo nnɔbae' },
  'camera.action.pest.steps': { en: 'Look under the leaves | Remove any insects you see | Remove badly damaged leaves', fr: 'Regardez sous les feuilles | Retirez les insectes que vous voyez | Retirez les feuilles très abîmées', sw: 'Angalia chini ya majani | Ondoa wadudu wowote uwaonao | Ondoa majani yaliyoharibika sana', ha: 'Duba ƙarƙashin ganyaye | Cire duk wasu kwari da ka gani | Cire ganyaye da suka lalace sosai', tw: 'Hwɛ nhaban no ase | Yi mmoawa biara a wo hunu | Yi nhaban a asɛe pii' },

  // Action: leaf damage
  'camera.action.leaf.title': { en: 'Remove damaged leaves today', fr: 'Retirez les feuilles abîmées aujourd\'hui', sw: 'Ondoa majani yaliyoharibika leo', ha: 'Cire ganyaye da suka lalace yau', tw: 'Yi nhaban a asɛe nnɛ' },
  'camera.action.leaf.why': { en: 'Damaged leaves can weaken the plant', fr: 'Des feuilles abîmées affaiblissent la plante', sw: 'Majani yaliyoharibika yanaweza kudhoofisha mmea', ha: 'Ganyaye da suka lalace na iya raunana shukar', tw: 'Nhaban a asɛe tumi ma dua no yɛ mmerɛw' },
  'camera.action.leaf.steps': { en: 'Find the most damaged leaves | Remove the worst affected ones | Check nearby leaves too', fr: 'Repérez les feuilles les plus abîmées | Retirez les plus touchées | Vérifiez aussi les voisines', sw: 'Tafuta majani yaliyoharibika zaidi | Ondoa yaliyoathirika vibaya | Kagua na majani ya karibu', ha: 'Nemi ganyayen da suka fi lalacewa | Cire wanda suka fi lalata | Duba ganyayen da ke kusa ma', tw: 'Hwehwɛ nhaban a asɛe kyɛn | Yi deɛ asɛe paa no | Hwɛ nhaban a ɛbɛn ho nso' },

  // Action: discoloration
  'camera.action.color.title': { en: 'Check soil and watering today', fr: 'Vérifiez le sol et l\'arrosage aujourd\'hui', sw: 'Angalia udongo na umwagiliaji leo', ha: 'Duba ƙasa da shayarwa yau', tw: 'Hwɛ asase ne nsugu nnɛ' },
  'camera.action.color.why': { en: 'Leaf color changes may mean the crop is stressed', fr: 'Un changement de couleur signale souvent un stress', sw: 'Mabadiliko ya rangi ya majani yanaweza kuonyesha shida', ha: 'Canjin launi na ganye na iya nuna damuwa', tw: 'Nhaban kɔlɔ nsakraeɛ tumi kyerɛ sɛ nnɔbae wɔ haw mu' },
  'camera.action.color.steps': { en: 'Check if the soil is too dry or too wet | Water if the soil is dry | Watch for color changes tomorrow', fr: 'Vérifiez si le sol est trop sec ou trop humide | Arrosez si sec | Surveillez les changements demain', sw: 'Angalia kama udongo ni kavu sana au mvua sana | Mwagilia kama ni kavu | Angalia mabadiliko ya rangi kesho', ha: 'Duba ko ƙasar ta bushe sosai ko ta jike sosai | Shayar idan ta bushe | Duba canjin launi gobe', tw: 'Hwɛ sɛ asase no awoɔ dodo anaa nsu ayɛ so dodo | Gu nsu sɛ ayɛ kuro a | Hwɛ kɔlɔ nsakraeɛ ɔkyena' },

  // Action: unknown
  'camera.action.unknown.title': { en: 'Check your plants closely today', fr: 'Vérifiez vos plants de près aujourd\'hui', sw: 'Angalia mimea yako kwa makini leo', ha: 'Duba shuke-shuke sosai yau', tw: 'Hwɛ wo nnua no yiye nnɛ' },
  'camera.action.unknown.why': { en: 'Early problems are easier to fix', fr: 'Les problèmes précoces se règlent plus facilement', sw: 'Matatizo ya mapema ni rahisi kurekebisha', ha: 'Matsalolin farko sun fi sauƙin gyara', tw: 'Nsɛm a wo hunu ntɛm no, yɛ mmerɛw sɛ wo siesie' },
  'camera.action.unknown.steps': { en: 'Check leaves and stems | Look under leaves for pests | Watch for changes tomorrow', fr: 'Vérifiez feuilles et tiges | Regardez sous les feuilles | Surveillez les changements demain', sw: 'Angalia majani na shina | Angalia chini ya majani kwa wadudu | Angalia mabadiliko kesho', ha: 'Duba ganyaye da kara | Duba ƙarƙashin ganyaye don kwari | Duba canje-canjen gobe', tw: 'Hwɛ nhaban ne dua | Hwɛ nhaban ase hwehwɛ mmoawa | Hwɛ nsakraeɛ ɔkyena' },

  // Action: healthy
  'camera.action.healthy.title': { en: 'Keep caring for your crop', fr: 'Continuez à soigner votre culture', sw: 'Endelea kutunza zao lako', ha: 'Ci gaba da kula da amfaninku', tw: 'Kɔ so hwɛ wo nnɔbae so' },
  'camera.action.healthy.why': { en: 'Your plants look healthy right now', fr: 'Vos plants semblent sains pour le moment', sw: 'Mimea yako inaonekana salama kwa sasa', ha: 'Shuke-shuke na lafiya a yanzu', tw: 'Wo nnua ho tɔ wɔn seesei' },
  'camera.action.healthy.cta': { en: 'Continue daily care', fr: 'Poursuivre les soins quotidiens', sw: 'Endelea na utunzaji wa kila siku', ha: 'Ci gaba da kulawa ta kullum', tw: 'Toa daa hwɛ so' },

  // Failure
  'camera.fail.title': { en: 'Could not analyze image', fr: 'Impossible d\'analyser l\'image', sw: 'Haikuweza kuchambua picha', ha: 'Ba a iya bincika hoton ba', tw: 'Yɛantumi anhwɛ mfonini no' },
  'camera.fail.why': { en: 'Try again with clearer lighting', fr: 'Réessayez avec un meilleur éclairage', sw: 'Jaribu tena na taa nzuri', ha: 'Sake gwada da kyakkyawan haske', tw: 'Sɔ hwɛ wɔ baabi a hann wɔ ho' },
  'camera.fail.steps': { en: 'Try again with clearer image | Ensure good lighting | Hold phone steady', fr: 'Réessayez avec une image plus nette | Assurez un bon éclairage | Tenez le téléphone stable', sw: 'Jaribu tena na picha iliyo wazi | Hakikisha taa nzuri | Shika simu imara', ha: 'Sake gwada da hoto mai tsafta | Tabbatar da haske mai kyau | Riƙe wayar sosai', tw: 'Sɔ twa mfonini foforɔ | Ma hann mmra baabi | Sɔ fon no mu yiye' },

  // ─── Camera: primary CTAs + result chrome additions ─────
  'camera.cta.addToToday': { en: "Add to today's tasks", fr: "Ajouter aux tâches du jour", sw: 'Ongeza kwenye kazi za leo', ha: "Ƙara cikin ayyukan yau", tw: "Fa ka nnɛ nnwuma ho" },
  'camera.cta.continueCare': { en: 'Continue daily care', fr: 'Poursuivre les soins quotidiens', sw: 'Endelea na utunzaji wa kila siku', ha: 'Ci gaba da kulawa ta kullum', tw: 'Toa daa hwɛ so' },
  'camera.cta.scanAgain': { en: 'Scan again', fr: 'Scanner à nouveau', sw: 'Piga picha tena', ha: 'Sake daukar hoto', tw: 'San twa mfonini' },
  'camera.result.lookFor': { en: 'What to look for', fr: 'Ce qu\'il faut chercher', sw: 'Cha kutafuta', ha: 'Abin da za ku nema', tw: 'Deɛ wo bɛhwɛ' },
  'camera.result.whatToDo': { en: 'What to do', fr: 'Ce qu\'il faut faire', sw: 'Cha kufanya', ha: 'Abin da za ku yi', tw: 'Deɛ wo bɛyɛ' },

  // ─── Camera: "what to look for" lists (pipe-separated) ──
  'camera.action.pest.lookFor': { en: 'Small holes in leaves | Insects under leaves | Damaged leaf edges', fr: 'Petits trous dans les feuilles | Insectes sous les feuilles | Bords abîmés', sw: 'Matundu madogo kwenye majani | Wadudu chini ya majani | Kingo za majani zilizoharibika', ha: 'Ƙananan ramuka a ganyaye | Kwari a ƙarƙashin ganyaye | Gefen ganyaye da suka lalace', tw: 'Ntokuro nketewa wɔ nhaban mu | Mmoawa wɔ nhaban ase | Nhaban afaafaa a asɛe' },
  'camera.action.leaf.lookFor': { en: 'Torn leaves | Dry edges | Visible spots', fr: 'Feuilles déchirées | Bords secs | Taches visibles', sw: 'Majani yaliyopasuka | Kingo kavu | Madoa yanayoonekana', ha: 'Ganyaye masu yagewa | Gefen busasshe | Tabo bayyananne', tw: 'Nhaban a atete | Nhaban afaafaa a awoɔ | Adwamma a ɛda adi' },
  'camera.action.color.lookFor': { en: 'Yellow leaves | Pale green leaves | Uneven leaf color', fr: 'Feuilles jaunes | Feuilles vert pâle | Couleur inégale des feuilles', sw: 'Majani ya manjano | Majani ya kijani hafifu | Rangi isiyo sawa ya majani', ha: 'Ganyaye masu rawaya | Ganyaye kore mara ƙarfi | Launin ganye mara daidaito', tw: 'Nhaban a ayɛ akokɔsrade | Nhaban a nsɛso asɛe | Nhaban kɔlɔ a ɛnyɛ pɛ' },
  'camera.action.unknown.lookFor': { en: 'Yellow or pale leaves | Spots or marks | Weak or drooping stems', fr: 'Feuilles jaunes ou pâles | Taches ou marques | Tiges faibles ou affaissées', sw: 'Majani ya manjano au hafifu | Madoa au alama | Mashina dhaifu au yanayoinama', ha: 'Ganyaye rawaya ko fari | Tabo ko alamomi | Kara masu rauni ko masu lankwasawa', tw: 'Nhaban a ɛyɛ akokɔsrade anaa asɛe | Adwamma wɔ nhaban so | Dua a ayɛ mmerɛw anaa akotow' },
  'camera.action.healthy.lookFor': { en: 'Water when needed | Check again tomorrow | Watch for any changes', fr: 'Arroser quand il faut | Vérifier demain | Surveiller tout changement', sw: 'Mwagilia inapohitajika | Angalia tena kesho | Angalia mabadiliko yoyote', ha: 'Shayar lokacin da ya dace | Sake duba gobe | Lura da duk wani canji', tw: 'Gu nsu bere a ɛhia | San hwɛ ɔkyena | Hwɛ nsakraeɛ biara' },

  // ─── Camera: tips (one line each) ────────────────────────
  'camera.action.pest.tip': { en: 'Check early in the morning', fr: 'Vérifier tôt le matin', sw: 'Kagua asubuhi mapema', ha: 'Duba da safe', tw: 'Hwɛ anɔpa' },
  'camera.action.leaf.tip': { en: 'Do not remove too many healthy leaves', fr: 'Ne retirez pas trop de feuilles saines', sw: 'Usiondoe majani mengi yenye afya', ha: 'Kada ka cire ganyaye masu lafiya da yawa', tw: 'Mma nhaban a ɛwɔ apɔmuden pii nnkɔ' },
  'camera.action.color.tip': { en: 'Compare with nearby healthy plants', fr: 'Comparer avec les plants sains voisins', sw: 'Linganisha na mimea yenye afya karibu', ha: 'Kwatanta da shuke-shuke masu lafiya kusa', tw: 'Fa toto nnua apɔmuden a ɛbɛn ho' },
  'camera.action.unknown.tip': { en: 'Compare with a healthy plant nearby if possible', fr: 'Comparer avec un plant sain voisin si possible', sw: 'Linganisha na mmea wenye afya karibu ikiwezekana', ha: 'Idan zai yiwu, kwatanta da shukar lafiya kusa', tw: 'Sɛ wubetumi a, fa toto dua apɔmuden ho' },
  'camera.action.healthy.tip': { en: 'Healthy crops still need daily care', fr: 'Une culture saine a besoin de soins quotidiens', sw: 'Zao lenye afya linahitaji utunzaji wa kila siku', ha: 'Amfani mai lafiya na buƙatar kulawa ta kullum', tw: 'Nnɔbae a ɛwɔ apɔmuden hia daa nhwɛsoɔ' },

  // ─── Camera follow-up (next-day recheck) ─────────────────
  'camera.followup.title': { en: 'Check the same plants you scanned yesterday', fr: 'Vérifiez les mêmes plants scannés hier', sw: 'Kagua mimea ileile uliyopiga picha jana', ha: 'Duba wadannan shuke-shuken da ka ɗauki hoto jiya', tw: 'San hwɛ nnua korɔ a wo twa wɔn mfonini ɛnnera' },
  'camera.followup.why': { en: 'You had a possible issue yesterday', fr: 'Vous aviez un problème possible hier', sw: 'Ulikuwa na tatizo linaloweza kutokea jana', ha: 'Kana da matsala mai yiwuwa jiya', tw: 'Ɛnnera, na biribi a ɛyɛ haw ba' },
  'camera.followup.lookFor': { en: 'New leaf damage | Insects or pests | Changes in plant color', fr: 'Nouveau dégât sur feuilles | Insectes ou ravageurs | Changements de couleur', sw: 'Uharibifu mpya wa majani | Wadudu | Mabadiliko ya rangi', ha: 'Sabuwar lalacewar ganyaye | Kwari | Canjin launi', tw: 'Nhaban a ɛsɛe foforɔ | Mmoawa | Kɔlɔ nsakraeɛ' },
  'camera.followup.steps': { en: 'Look under leaves | Check for new damage | Remove any pests found', fr: 'Regardez sous les feuilles | Vérifiez les nouveaux dégâts | Retirez les ravageurs trouvés', sw: 'Angalia chini ya majani | Angalia uharibifu mpya | Ondoa wadudu utaokutana nao', ha: 'Duba ƙarƙashin ganyaye | Duba sabuwar lalacewa | Cire kowane kwari da ka gani', tw: 'Hwɛ nhaban no ase | Hwɛ nsɛm foforɔ a asɛe | Yi mmoawa biara a wo hunu' },
  'camera.followup.tip': { en: 'Daily checks help stop problems early', fr: 'Des vérifications quotidiennes stoppent les problèmes tôt', sw: 'Ukaguzi wa kila siku huzuia matatizo mapema', ha: 'Binciken yau da kullum na hana matsaloli da wuri', tw: 'Daa nhwɛsoɔ boa ma nsɛm ntwa so ntɛm' },

  // ─── Region-flavoured task title variants (V2 spec §5) ──
  'cropTask.region.clearFieldManual': { en: 'Cut weeds and clear by hand', fr: 'Couper les mauvaises herbes à la main', sw: 'Kata magugu kwa mkono', ha: 'Yanke ciyawa da hannu', tw: 'Twa wura no fi nsa' },
  'cropTask.region.prepareLandManualTropical': { en: 'Loosen the soil with a hoe', fr: 'Ameublir le sol à la houe', sw: 'Laini udongo kwa jembe', ha: 'Sassauta ƙasa da fartanya', tw: 'Dwodwo asase no de asɔsɔ' },
  'cropTask.region.prepareLandMixedTropical': { en: 'Till the soil and mark your rows', fr: 'Labourer et tracer les lignes', sw: 'Lima udongo na weka alama za mistari', ha: 'Nome ƙasa ka yi alama layuka', tw: 'Funtum asase no na yɛ ntam' },
  'cropTask.region.prepareLandMonsoon': { en: 'Prepare field and build drainage bunds', fr: 'Préparer et aménager drainage et diguettes', sw: 'Andaa shamba na tengeneza tuta', ha: 'Shirya gona ka gina tungar ruwa', tw: 'Siesie afuo no na yɛ nsu kwan' },
  'cropTask.region.prepareLandDry': { en: 'Prepare ridges to hold water', fr: 'Former des billons pour retenir l\'eau', sw: 'Tengeneza matuta ya kuhifadhi maji', ha: 'Yi kududdufai na kiyaye ruwa', tw: 'Yɛ ntrɛmu a ɛbɛkora nsu' },
  'cropTask.region.prepareLandMechanized': { en: 'Prepare field with equipment', fr: 'Préparer le champ avec des équipements', sw: 'Andaa shamba kwa mashine', ha: 'Shirya gona da injin noma', tw: 'Fa mfidie siesie afuo no' },
  'cropTask.region.plantSeedsRainFed': { en: 'Plant before the rainy window closes', fr: 'Semer avant la fin de la saison des pluies', sw: 'Panda kabla msimu wa mvua kumalizika', ha: 'Shuka kafin lokacin ruwan sama ya ƙare', tw: 'Dua ansa na osutɔ bere no akɔ' },
  'cropTask.region.plantSeedsMonsoon': { en: 'Plant aligned with monsoon rains', fr: 'Semer en phase avec la mousson', sw: 'Panda kulingana na mvua za monsuni', ha: 'Shuka bisa ga ruwan sama na lokacin damina', tw: 'Dua a ɛne osutɔ bere ba' },
  'cropTask.region.floodFieldMonsoon': { en: 'Flood the field for rice planting', fr: 'Inonder le champ pour le riz', sw: 'Jaza maji shamba kwa mpunga', ha: 'Cika gona da ruwa don shinkafa', tw: 'Hyɛ afuo no nsu ma ɛmo' },
  'cropTask.region.waterAfterPlantingDry': { en: 'Irrigate the seeds — rainfall is sparse', fr: 'Irriguer les semences — peu de pluie', sw: 'Nyunyizia mbegu — mvua ni chache', ha: 'Ban ruwa ga iri — ruwan sama kaɗan ne', tw: 'Gu nsu gu aba no so — osu nni hɔ pii' },
  'cropTask.region.monitorWaterManual': { en: 'Check soil moisture by feel', fr: 'Vérifier l\'humidité au toucher', sw: 'Angalia unyevu kwa kugusa', ha: 'Bincika danshi ta taɓawa', tw: 'Sɔ asase no fɔmu' },
  'cropTask.region.monitorWaterIrrigated': { en: 'Schedule irrigation as needed', fr: 'Planifier l\'irrigation', sw: 'Panga umwagiliaji inapohitajika', ha: 'Tsara banruwa idan ana buƙata', tw: 'Hyehyɛ nsugu bere' },
  'cropTask.region.weedFieldManual': { en: 'Weed by hand — little and often', fr: 'Désherber à la main — peu et souvent', sw: 'Palilia kwa mkono — kidogo kwa kawaida', ha: 'Cire da hannu — kaɗan-kaɗan', tw: 'Popa wura no fi nsa' },
  'cropTask.region.weedFieldMechanized': { en: 'Weed with equipment when dry', fr: 'Désherber avec équipement quand sec', sw: 'Palilia kwa mashine wakati ni kavu', ha: 'Cire da injin lokacin da ya bushe', tw: 'Fa mfidie popa wura no bere a ewim yɛ hye' },
  'cropTask.region.applyFertilizerMixed': { en: 'Apply fertilizer close to the plant', fr: 'Appliquer l\'engrais près de la plante', sw: 'Weka mbolea karibu na mmea', ha: 'Zuba taki kusa da shuka', tw: 'Gu nkwansuade bɛn nnɔbae no' },

  // ─── Region labels ──────────────────────────────────────
  'region.tropicalManual': { en: 'Tropical, manual', fr: 'Tropical, manuel', sw: 'Tropiki, mikono', ha: 'Wurare masu zafi, hannu', tw: 'Ɔhyew fam, nsayɛ' },
  'region.tropicalMixed': { en: 'Tropical, mixed tools', fr: 'Tropical, outils mixtes', sw: 'Tropiki, zana mchanganyiko', ha: 'Wurare masu zafi, haɗaɗɗun kayan aiki', tw: 'Ɔhyew fam, nnwinnade ahodoɔ' },
  'region.monsoonMixed': { en: 'Monsoon zone', fr: 'Zone de mousson', sw: 'Eneo la monsuni', ha: 'Yankin damina', tw: 'Osutɔ kɛseɛ mantam' },
  'region.dryIrrigated': { en: 'Dry, irrigation-led', fr: 'Sec, irrigation', sw: 'Kavu, umwagiliaji', ha: 'Busasshe, banruwa', tw: 'Kuro, nsugu' },
  'region.temperateMechanized': { en: 'Temperate, mechanized', fr: 'Tempéré, mécanisé', sw: 'Wastani, mashine', ha: 'Matsakaici, injin noma', tw: 'Ewim dwodwo, mfidie' },
  'region.default': { en: 'General', fr: 'Général', sw: 'Kawaida', ha: 'Gabaɗaya', tw: 'Nkwasoɔ' },
  'cropTask.prepareLand': { en: 'Prepare your land for planting', fr: 'Préparer votre terrain', sw: 'Tayarisha ardhi yako kwa kupanda', ha: 'Shirya ƙasar ku don shuka', tw: 'Siesie wo asase ma dua' },
  'cropTask.clearField': { en: 'Clear your field', fr: 'Défricher votre champ', sw: 'Safisha shamba lako', ha: 'Share gonar ku', tw: 'Twitwa wo afuo' },
  'cropTask.plantSeeds': { en: 'Plant your seeds', fr: 'Planter vos semences', sw: 'Panda mbegu zako', ha: 'Shuka irin ku', tw: 'Dua wo aba' },
  'cropTask.plantCuttings': { en: 'Plant stem cuttings', fr: 'Planter les boutures', sw: 'Panda vipandikizi', ha: 'Shuka yankan kara', tw: 'Dua ntwanoo' },
  'cropTask.plantSeedlings': { en: 'Plant your seedlings', fr: 'Planter vos plants', sw: 'Panda miche yako', ha: 'Shuka shuke-shuken ku', tw: 'Dua wo nfifideɛ' },
  'cropTask.waterAfterPlanting': { en: 'Water after planting', fr: 'Arroser après plantation', sw: 'Mwagilia baada ya kupanda', ha: 'Shayar da ruwa bayan shuka', tw: 'Gu nsu bere a woadua no akyi' },
  'cropTask.confirmSpacing': { en: 'Check seed spacing', fr: 'Vérifier l\'espacement', sw: 'Angalia nafasi ya mbegu', ha: 'Bincika tazarar iri', tw: 'Hwɛ aba no ntam' },
  'cropTask.checkGermination': { en: 'Check if seeds are sprouting', fr: 'Vérifier la germination', sw: 'Angalia kama mbegu zinamea', ha: 'Bincika ko irin suna tsirowa', tw: 'Hwɛ sɛ aba no refifiri' },
  'cropTask.firstWeeding': { en: 'First weeding', fr: 'Premier désherbage', sw: 'Palizi ya kwanza', ha: 'Cire na farko', tw: 'Wura titiriw dotɛ' },
  'cropTask.monitorWater': { en: 'Check water level', fr: 'Vérifier le niveau d\'eau', sw: 'Angalia kiwango cha maji', ha: 'Bincika matakin ruwa', tw: 'Hwɛ nsu dodow' },
  'cropTask.applyFertilizer': { en: 'Apply fertilizer', fr: 'Appliquer l\'engrais', sw: 'Weka mbolea', ha: 'Sa taki', tw: 'Fa asase aduro gu so' },
  'cropTask.weedField': { en: 'Weed your field', fr: 'Désherber votre champ', sw: 'Palilia shamba lako', ha: 'Cire gonar ku', tw: 'Dote wo afuo' },
  'cropTask.checkPests': { en: 'Check for pests', fr: 'Vérifier les ravageurs', sw: 'Angalia wadudu', ha: 'Bincika kwari', tw: 'Hwɛ mmoa a wɔsɛe nnɔbae' },
  'cropTask.sprayCrop': { en: 'Spray your crop', fr: 'Pulvériser votre culture', sw: 'Nyunyizia mazao yako', ha: 'Fesa amfanin gona', tw: 'Pete aduro wɔ wo nnɔbae so' },
  'cropTask.monitorWeatherRisk': { en: 'Check weather risk', fr: 'Vérifier les risques météo', sw: 'Angalia hatari ya hali ya hewa', ha: 'Bincika haɗarin yanayi', tw: 'Hwɛ wim tebea asiane' },
  'cropTask.harvestCrop': { en: 'Harvest your crop', fr: 'Récolter votre culture', sw: 'Vuna zao lako', ha: 'Girbe amfanin gona', tw: 'Twa wo nnɔbae' },
  'cropTask.sortHarvest': { en: 'Sort your harvest', fr: 'Trier votre récolte', sw: 'Panga mavuno yako', ha: 'Tsara girbin ku', tw: 'Pae wotwa adeɛ no mu' },
  'cropTask.protectHarvestFromRain': { en: 'Protect harvest from rain', fr: 'Protéger la récolte de la pluie', sw: 'Linda mavuno dhidi ya mvua', ha: 'Kare girbi daga ruwan sama', tw: 'Bɔ wotwa adeɛ no ho ban fi osu mu' },
  'cropTask.dryHarvest': { en: 'Dry your harvest', fr: 'Sécher votre récolte', sw: 'Kausha mavuno yako', ha: 'Bushe girbin ku', tw: 'Hwie wotwa adeɛ no awo' },
  'cropTask.storeHarvest': { en: 'Store your harvest safely', fr: 'Stocker votre récolte en sécurité', sw: 'Hifadhi mavuno yako salama', ha: 'Ajiye girbin ku lafiya', tw: 'Kora wotwa adeɛ no yie' },
  'cropTask.logHarvest': { en: 'Log your harvest amount', fr: 'Enregistrer la quantité récoltée', sw: 'Andika kiasi cha mavuno', ha: 'Rubuta adadin girbi', tw: 'Kyerɛw wotwa adeɛ dodow' },
  'cropTask.prepareForSale': { en: 'Prepare for market', fr: 'Préparer pour le marché', sw: 'Andaa kwa soko', ha: 'Shirya don kasuwa', tw: 'Siesie ma gua so' },
  'cropTask.setUpStakes': { en: 'Set up stakes / supports', fr: 'Installer les tuteurs', sw: 'Weka fito / vitegemeo', ha: 'Kafa sanda / goyon baya', tw: 'Si nnua a wɔde si so' },
  'cropTask.floodField': { en: 'Flood the paddy field', fr: 'Inonder la rizière', sw: 'Mwaga maji shambani', ha: 'Tafasa gonar shinkafa da ruwa', tw: 'Fa nsu hyɛ afuo no ma' },
  'cropTask.setUpShade': { en: 'Set up shade trees', fr: 'Planter des arbres d\'ombre', sw: 'Weka miti ya kivuli', ha: 'Kafa itatuwan inuwa', tw: 'Si nnua a ɛyɛ nwini' },

  // ═══════════════════════════════════════════════════════════
  //  TIMING — why this task matters NOW (spec §2)
  // ═══════════════════════════════════════════════════════════
  'timing.whileConditionsDry': { en: 'Good time now — conditions are dry.', fr: 'Bon moment — temps sec.', sw: 'Wakati mzuri — hali ni kavu.', ha: 'Lokaci mai kyau — busasshe ne.', tw: 'Bere pa — ewim yɛ hye.' },
  'timing.beforeRainArrives': { en: 'Do this before rain arrives.', fr: 'À faire avant la pluie.', sw: 'Fanya kabla mvua ifike.', ha: 'Yi wannan kafin ruwan sama.', tw: 'Yɛ eyi ansa na osu aba.' },
  'timing.waitForDryWeather': { en: 'Wait for dry weather to dry properly.', fr: 'Attendez un temps sec pour sécher.', sw: 'Subiri hali ya hewa kavu.', ha: 'Jira busasshen yanayi.', tw: 'Twɛn ma ewim yɛ hye.' },
  'timing.heatIsHighToday': { en: 'Heat is high today — watering matters more.', fr: 'Forte chaleur — arrosage important.', sw: 'Joto ni kali leo — kumwagilia ni muhimu.', ha: 'Zafi mai tsanani — shayarwa na da muhimmanci.', tw: 'Ɛhyew nnɛ — nsu guo ho hia pa ara.' },
  'timing.earlyThisWeek': { en: 'Do this early this week.', fr: 'À faire tôt cette semaine.', sw: 'Fanya mapema wiki hii.', ha: 'Yi da wuri a wannan mako.', tw: 'Yɛ eyi nnawɔtwe yi mfiase.' },
  'timing.actNowBeforeSpread': { en: 'Act now before it spreads.', fr: 'Agissez vite avant propagation.', sw: 'Fanya sasa kabla kuenea.', ha: 'Yi yanzu kafin ya yaɗu.', tw: 'Yɛ no ntɛm ansa na atrɛw.' },
  'timing.regularCheckProtects': { en: 'Regular checks protect your crop.', fr: 'Vérifications régulières protègent la culture.', sw: 'Ukaguzi wa kawaida hulinda mazao.', ha: 'Bincike na yau da kullum na kare amfanin.', tw: 'Nhwehwɛmu daa bɔ wo nnɔbae ho ban.' },
  'timing.waitForCalmWind': { en: 'Wait for calm wind to spray.', fr: 'Attendez un vent calme pour pulvériser.', sw: 'Subiri upepo utulie kunyunyizia.', ha: 'Jira iskar ta kwanta kafin fesa.', tw: 'Twɛn ma mframa dwodwo ansa na wopete aduro.' },
  'timing.bestInCalmConditions': { en: 'Best done in calm conditions.', fr: 'Mieux par temps calme.', sw: 'Bora katika hali tulivu.', ha: 'Gara a yi a cikin kwanciyar hankali.', tw: 'Eye sɛ woyɛ no bere a ewim yɛ dinn.' },
  'timing.beforeWeedsGrow': { en: 'Clear before weeds take over.', fr: 'Désherber avant que les mauvaises herbes ne dominent.', sw: 'Safisha kabla magugu yakue.', ha: 'Share kafin ciyayi su rufe.', tw: 'Popa ansa na wura adu.' },
  'timing.feedDuringGrowth': { en: 'Best time to feed during active growth.', fr: 'Meilleur moment pour nourrir pendant la croissance.', sw: 'Wakati bora wa kulisha wakati wa ukuaji.', ha: 'Lokaci mafi kyau don ciyar da amfani.', tw: 'Bere pa a wobɛma nkwan wɔ nyin bere mu.' },
  'timing.beforePlantingWindow': { en: 'Do before planting window closes.', fr: 'À faire avant la fin de la saison de semis.', sw: 'Fanya kabla dirisha la kupanda lifungwe.', ha: 'Yi kafin lokacin shuka ya ƙare.', tw: 'Yɛ ansa na dua bere no akɔ.' },
  'timing.beforeRainTomorrow': { en: 'Best done today before rain tomorrow.', fr: 'À faire aujourd\'hui avant la pluie demain.', sw: 'Bora kufanya leo kabla ya mvua kesho.', ha: 'Gara a yi yau kafin ruwan gobe.', tw: 'Eye sɛ woyɛ nnɛ ansa osu atɔ ɔkyena.' },
  'timing.harvestWhenReady': { en: 'Harvest when crop is ready.', fr: 'Récoltez quand la culture est prête.', sw: 'Vuna wakati mazao yako tayari.', ha: 'Girbe lokacin amfanin ya nuna.', tw: 'Twa bere a nnɔbae no abɛre.' },
  'timing.soonAfterHarvest': { en: 'Best done soon after harvest.', fr: 'À faire rapidement après la récolte.', sw: 'Bora kufanya baada ya kuvuna.', ha: 'Gara a yi ba\'an girbe.', tw: 'Eye sɛ woyɛ no ntɛm wɔ twa ase.' },
  'timing.beforeQualityDrops': { en: 'Store before quality drops.', fr: 'Stocker avant que la qualité ne baisse.', sw: 'Hifadhi kabla ubora kupungua.', ha: 'Ajiye kafin ingancin ya ragu.', tw: 'Kora ansa na ne su abɛhwe ase.' },

  // ─── Smart timing (weather-aware) — day/date phrases ───
  'timing.doNow': { en: 'Do now.', fr: 'À faire maintenant.', sw: 'Fanya sasa.', ha: 'Yi yanzu.', tw: 'Yɛ no seesei.' },
  'timing.doToday': { en: 'Do today.', fr: 'À faire aujourd\'hui.', sw: 'Fanya leo.', ha: 'Yi yau.', tw: 'Yɛ no nnɛ.' },
  'timing.doThisWeek': { en: 'Do this week.', fr: 'À faire cette semaine.', sw: 'Fanya wiki hii.', ha: 'Yi a wannan mako.', tw: 'Yɛ no nnawɔtwe yi.' },
  'timing.beforeRainOnDay': { en: 'Before rain on {day}.', fr: 'Avant la pluie de {day}.', sw: 'Kabla mvua ya {day}.', ha: 'Kafin ruwan sama na {day}.', tw: 'Ansa osu atɔ {day}.' },
  'timing.doBeforeRainOnDay': { en: 'Finish before rain on {day}.', fr: 'Finir avant la pluie de {day}.', sw: 'Maliza kabla mvua ya {day}.', ha: 'Gama kafin ruwan sama na {day}.', tw: 'Wie ansa osu atɔ {day}.' },
  'timing.dryStartsTomorrow': { en: 'Dry weather starts tomorrow.', fr: 'Temps sec à partir de demain.', sw: 'Hali ya hewa kavu itaanza kesho.', ha: 'Busasshen yanayi zai fara gobe.', tw: 'Ewim bɛyɛ hye ɔkyena.' },
  'timing.dryStartsOnDay': { en: 'Dry weather returns {day}.', fr: 'Temps sec de retour {day}.', sw: 'Hali ya hewa kavu itarudi {day}.', ha: 'Busasshen yanayi zai dawo {day}.', tw: 'Ewim bɛyɛ hye {day}.' },

  // ─── Date / day names (short) ──────────────────────────
  'date.day.sun': { en: 'Sun', fr: 'Dim', sw: 'Jpi', ha: 'Lah', tw: 'Kwa' },
  'date.day.mon': { en: 'Mon', fr: 'Lun', sw: 'Jtt', ha: 'Lit', tw: 'Dwo' },
  'date.day.tue': { en: 'Tue', fr: 'Mar', sw: 'Jnn', ha: 'Tal', tw: 'Ben' },
  'date.day.wed': { en: 'Wed', fr: 'Mer', sw: 'Jtn', ha: 'Lar', tw: 'Wuk' },
  'date.day.thu': { en: 'Thu', fr: 'Jeu', sw: 'Alh', ha: 'Alh', tw: 'Yaw' },
  'date.day.fri': { en: 'Fri', fr: 'Ven', sw: 'Iju', ha: 'Jum', tw: 'Fi' },
  'date.day.sat': { en: 'Sat', fr: 'Sam', sw: 'Jms', ha: 'Asa', tw: 'Mem' },
  'date.month.jan': { en: 'Jan', fr: 'janv.', sw: 'Jan', ha: 'Jan', tw: 'Ɔpɛ' },
  'date.month.feb': { en: 'Feb', fr: 'févr.', sw: 'Feb', ha: 'Fab', tw: 'Ogya' },
  'date.month.mar': { en: 'Mar', fr: 'mars', sw: 'Mac', ha: 'Mar', tw: 'Bɛn' },
  'date.month.apr': { en: 'Apr', fr: 'avr.', sw: 'Apr', ha: 'Afi', tw: 'Oforisuo' },
  'date.month.may': { en: 'May', fr: 'mai', sw: 'Mei', ha: 'May', tw: 'Kɔt' },
  'date.month.jun': { en: 'Jun', fr: 'juin', sw: 'Jun', ha: 'Yun', tw: 'Ayɛ' },
  'date.month.jul': { en: 'Jul', fr: 'juil.', sw: 'Jul', ha: 'Yul', tw: 'Kit' },
  'date.month.aug': { en: 'Aug', fr: 'août', sw: 'Ago', ha: 'Agu', tw: 'Ɔsa' },
  'date.month.sep': { en: 'Sep', fr: 'sept.', sw: 'Sep', ha: 'Sat', tw: 'Ɛbɔ' },
  'date.month.oct': { en: 'Oct', fr: 'oct.', sw: 'Okt', ha: 'Okt', tw: 'Ahi' },
  'date.month.nov': { en: 'Nov', fr: 'nov.', sw: 'Nov', ha: 'Nuw', tw: 'Obu' },
  'date.month.dec': { en: 'Dec', fr: 'déc.', sw: 'Des', ha: 'Dis', tw: 'Ɔpɛ' },
  'date.today': { en: 'Today', fr: 'Aujourd\'hui', sw: 'Leo', ha: 'Yau', tw: 'Ɛnnɛ' },
  'date.tomorrow': { en: 'Tomorrow', fr: 'Demain', sw: 'Kesho', ha: 'Gobe', tw: 'Ɔkyena' },
  'date.yesterday': { en: 'Yesterday', fr: 'Hier', sw: 'Jana', ha: 'Jiya', tw: 'Nnɛra' },

  // ═══════════════════════════════════════════════════════════
  //  URGENCY — labels for urgency levels (spec §3)
  // ═══════════════════════════════════════════════════════════
  'urgency.critical': { en: 'Urgent', fr: 'Urgent', sw: 'Haraka', ha: 'Gaggawa', tw: 'Ɛhia ntɛm' },
  'urgency.today': { en: 'Today', fr: 'Aujourd\'hui', sw: 'Leo', ha: 'Yau', tw: 'Ɛnnɛ' },
  'urgency.thisWeek': { en: 'This week', fr: 'Cette semaine', sw: 'Wiki hii', ha: 'Wannan mako', tw: 'Nnawɔtwe yi' },
  'urgency.optional': { en: 'Optional', fr: 'Optionnel', sw: 'Hiari', ha: 'Na so', tw: 'Wopɛ a' },

  // ═══════════════════════════════════════════════════════════
  //  FOLLOW-UP — lightweight completion feedback (spec §4)
  // ═══════════════════════════════════════════════════════════
  'followup.didYouFinish': { en: 'Did you finish this task?', fr: 'Avez-vous terminé cette tâche ?', sw: 'Umekamilisha kazi hii?', ha: 'Kun gama wannan aiki?', tw: 'Woawie adwuma yi?' },
  'followup.anyIssue': { en: 'Any issue?', fr: 'Un problème ?', sw: 'Tatizo lolote?', ha: 'Wata matsala?', tw: 'Ɔhaw bi wɔ hɔ?' },
  'followup.yes': { en: 'Yes', fr: 'Oui', sw: 'Ndiyo', ha: 'Eh', tw: 'Aane' },
  'followup.partly': { en: 'Partly', fr: 'En partie', sw: 'Kwa sehemu', ha: 'Wani ɓangare', tw: 'Fa bi' },
  'followup.no': { en: 'No', fr: 'Non', sw: 'Hapana', ha: 'A\'a', tw: 'Daabi' },
  'followup.noIssue': { en: 'No issue', fr: 'Pas de problème', sw: 'Hakuna tatizo', ha: 'Babu matsala', tw: 'Ɔhaw biara nni hɔ' },
  'followup.needHelp': { en: 'Need help', fr: 'Besoin d\'aide', sw: 'Nahitaji msaada', ha: 'Ina buƙatar taimako', tw: 'Mehia mmoa' },
  'followup.weatherBlocked': { en: 'Weather blocked', fr: 'Météo défavorable', sw: 'Hali ya hewa ilizuia', ha: 'Yanayi ya hana', tw: 'Ewim tebea asiannɛ' },
  'followup.noTools': { en: 'No tools / inputs', fr: 'Pas d\'outils', sw: 'Hakuna zana', ha: 'Babu kayan aiki', tw: 'Nnwinnade biara nni hɔ' },

  // ═══════════════════════════════════════════════════════════
  //  COMPLETION STATUS / OUTCOME — post-completion feedback (spec §5)
  // ═══════════════════════════════════════════════════════════
  'completionStatus.done': { en: 'Task completed', fr: 'Tâche terminée', sw: 'Kazi imekamilika', ha: 'An gama aiki', tw: 'Adwuma no awie' },
  'completionStatus.partial': { en: 'Partly done — we\'ll keep it in mind.', fr: 'Partiellement fait — nous gardons ça en tête.', sw: 'Imefanywa kwa sehemu — tutakumbuka.', ha: 'Wani ɓangare — za mu tuna.', tw: 'Woyɛɛ bi — yɛbɛkae.' },
  'completionStatus.blocked': { en: 'We\'ll try again when conditions improve.', fr: 'Nous réessaierons quand les conditions s\'amélioreront.', sw: 'Tutajaribu tena hali zitakapokuwa nzuri.', ha: 'Za mu sake gwadawa idan yanayi ya gyaru.', tw: 'Yɛbɛsan ahwɛ bere a nneɛma bɛyɛ yie.' },
  'completionStatus.rescheduled': { en: 'Rescheduled for better conditions.', fr: 'Reporté pour de meilleures conditions.', sw: 'Imepangwa upya kwa hali bora.', ha: 'An sake tsarawa don yanayi mafi kyau.', tw: 'Wɔasakra bere no ama bere pa.' },
  'completionStatus.needsResources': { en: 'Noted — you need tools or inputs.', fr: 'Noté — vous avez besoin d\'outils.', sw: 'Tumesikia — unahitaji zana.', ha: 'An lura — kuna buƙatar kayan aiki.', tw: 'Yɛahu — wohia nnwinnade.' },
  'completionOutcome.weatherBlocked': { en: 'Weather prevented this task. We\'ll adjust.', fr: 'La météo a empêché cette tâche. Nous ajusterons.', sw: 'Hali ya hewa ilizuia kazi hii. Tutarekebisha.', ha: 'Yanayi ta hana wannan aiki. Za mu daidaita.', tw: 'Ewim tebea amma woannyɛ adwuma yi. Yɛbɛsakra.' },
  'completionOutcome.noTools': { en: 'Missing tools or inputs. Consider getting them ready.', fr: 'Outils ou intrants manquants. Pensez à les préparer.', sw: 'Zana au pembejeo zinakosekana. Ziandae.', ha: 'Kayan aiki sun yi ƙaranci. A yi la\'akari da shirya su.', tw: 'Nnwinnade bi te hɔ. Siesie wɔn.' },
  'completionOutcome.partial': { en: 'Good progress. Finish when you can.', fr: 'Bon progrès. Terminez quand possible.', sw: 'Maendeleo mazuri. Kamilisha ukiweza.', ha: 'Kyakkyawan ci gaba. Gama idan ka iya.', tw: 'Wokɔ wɔn anim yie. Wie bere a wubetumi.' },
  'completionOutcome.blocked': { en: 'No worries. We\'ll suggest it again later.', fr: 'Pas de souci. Nous le proposerons plus tard.', sw: 'Usijali. Tutapendekeza tena baadaye.', ha: 'Babu damuwa. Za mu ba da shawarar nan gaba.', tw: 'Ɛnyɛ hwee. Yɛbɛka akyerɛ wo bio akyiri.' },

  // ═══════════════════════════════════════════════════════════
  //  MOMENTUM — farmer confidence signals (spec §7)
  // ═══════════════════════════════════════════════════════════
  'momentum.strongToday': { en: 'Strong start today!', fr: 'Bon début aujourd\'hui !', sw: 'Mwanzo mzuri leo!', ha: 'Fara mai ƙarfi yau!', tw: 'Wohyɛɛ ase yie nnɛ!' },
  'momentum.streak': { en: '{days}-day activity streak!', fr: 'Série de {days} jours !', sw: 'Mfululizo wa siku {days}!', ha: 'Jerin kwanaki {days}!', tw: 'Nna {days} a wodi so ayɛ adwuma!' },
  'momentum.onTrack': { en: 'You\'re on track.', fr: 'Vous êtes sur la bonne voie.', sw: 'Uko sawa.', ha: 'Kuna kan hanya.', tw: 'Wowɔ kwan pa so.' },
  'momentum.allDone': { en: 'All done for today!', fr: 'Tout est fait pour aujourd\'hui !', sw: 'Kazi zote zimekamilika leo!', ha: 'An gama duka na yau!', tw: 'Woawie ne nyinaa nnɛ!' },
  'momentum.getStarted': { en: 'Ready to get started.', fr: 'Prêt à commencer.', sw: 'Tayari kuanza.', ha: 'A shirye don farawa.', tw: 'Wasiesie wo ho sɛ wobɛhyɛ ase.' },
  'momentum.idle': { en: 'Check in when you\'re ready.', fr: 'Revenez quand vous êtes prêt.', sw: 'Rudi ukiwa tayari.', ha: 'Dawo idan ka shirya.', tw: 'Bra bere a woasiesie wo ho.' },
  'momentum.goodProgressForStage': { en: 'Good progress for this stage.', fr: 'Bon progrès pour cette étape.', sw: 'Maendeleo mazuri kwa hatua hii.', ha: 'Kyakkyawan ci gaba a wannan mataki.', tw: 'Wokɔ wɔn anim yie wɔ saa bere yi mu.' },
  'momentum.keepGoing': { en: 'Keep going!', fr: 'Continuez !', sw: 'Endelea!', ha: 'Ci gaba!', tw: 'Kɔ so!' },
  'momentum.doneToday': { en: '{count} done today', fr: '{count} terminé(s) aujourd\'hui', sw: '{count} zimekamilika leo', ha: '{count} an gama yau', tw: '{count} awie nnɛ' },
  'momentum.leftToday': { en: '{count} left today', fr: '{count} restant(s)', sw: '{count} zimebaki leo', ha: '{count} ya rage yau', tw: '{count} aka nnɛ' },

  // ═══════════════════════════════════════════════════════════
  //  ECONOMICS — simple signals (spec §6)
  // ═══════════════════════════════════════════════════════════
  'economics.cost.low': { en: 'Low cost', fr: 'Coût faible', sw: 'Gharama ndogo', ha: 'Ƙaramin farashi', tw: 'Ka kakra' },
  'economics.cost.medium': { en: 'Medium cost', fr: 'Coût moyen', sw: 'Gharama ya wastani', ha: 'Matsakaicin farashi', tw: 'Ka a ɛwɔ mfinimfini' },
  'economics.cost.high': { en: 'High cost', fr: 'Coût élevé', sw: 'Gharama kubwa', ha: 'Babban farashi', tw: 'Ka kɛse' },
  'economics.labor.low': { en: 'Low labor', fr: 'Peu de main-d\'œuvre', sw: 'Kazi ndogo', ha: 'Ƙaramin aiki', tw: 'Adwuma kakra' },
  'economics.labor.medium': { en: 'Medium labor', fr: 'Main-d\'œuvre moyenne', sw: 'Kazi ya wastani', ha: 'Matsakaicin aiki', tw: 'Adwuma a ɛwɔ mfinimfini' },
  'economics.labor.high': { en: 'High labor', fr: 'Beaucoup de main-d\'œuvre', sw: 'Kazi kubwa', ha: 'Babban aiki', tw: 'Adwuma kɛse' },
  'economics.market.moderate': { en: 'Moderate market potential', fr: 'Potentiel de marché moyen', sw: 'Fursa ya soko ya wastani', ha: 'Matsakaicin damar kasuwa', tw: 'Gua so kwan a ɛwɔ mfinimfini' },
  'economics.market.good': { en: 'Good market potential', fr: 'Bon potentiel de marché', sw: 'Fursa nzuri ya soko', ha: 'Kyakkyawan damar kasuwa', tw: 'Gua so kwan pa' },
  'economics.tip.planAhead': { en: 'Planning saves cost later.', fr: 'Planifier économise plus tard.', sw: 'Kupanga kunapunguza gharama baadaye.', ha: 'Tsarawa na rage farashi nan gaba.', tw: 'Nhyehyɛe tumi gye sika akyiri.' },
  'economics.tip.clearingInvestment': { en: 'Good clearing helps reduce loss later.', fr: 'Un bon nettoyage réduit les pertes.', sw: 'Usafishaji mzuri hupunguza hasara baadaye.', ha: 'Share mai kyau na rage asara nan gaba.', tw: 'Popa a woyɛ no yie tumi tɔɔ sɛe nkakra.' },
  'economics.tip.seedInvestment': { en: 'Good seeds are a worthy investment.', fr: 'Les bonnes semences sont un bon investissement.', sw: 'Mbegu nzuri ni uwekezaji mzuri.', ha: 'Iri mai kyau saka ne mai kyau.', tw: 'Aba pa yɛ sika a wode bɔ mu yie.' },
  'economics.tip.fertilizeForYield': { en: 'Right nutrients boost your harvest.', fr: 'Les bons nutriments augmentent la récolte.', sw: 'Virutubisho sahihi vinaboresha mavuno.', ha: 'Takin da ya dace na ƙara girbi.', tw: 'Nkwan pa ma wo nnɔbae dɔɔso.' },
  'economics.tip.protectForQuality': { en: 'Protection now preserves crop quality.', fr: 'La protection maintenant préserve la qualité.', sw: 'Kulinda sasa kunahifadhi ubora.', ha: 'Kariya yanzu na kiyaye inganci.', tw: 'Bɔ ho ban seesei na ɛhwɛ su yie so.' },
  'economics.tip.nearHarvest': { en: 'Your investment is almost ready to pay off.', fr: 'Votre investissement est presque prêt.', sw: 'Uwekezaji wako unakaribia kutoa matunda.', ha: 'Jarin ku na kusa da bayarwa.', tw: 'Wo sika a wode bɔɔ mu no rebɛba mfaso.' },
  'economics.tip.harvestCarefully': { en: 'Careful harvest protects sale quality.', fr: 'Une récolte soignée protège la qualité.', sw: 'Kuvuna kwa uangalifu hulinda ubora wa kuuza.', ha: 'Girbe da hankali na kare ingancin sayarwa.', tw: 'Twa yie na ɛhwɛ ne su yie ma wuton.' },
  'economics.tip.dryAndStoreWell': { en: 'Drying well protects your profit.', fr: 'Bien sécher protège vos bénéfices.', sw: 'Kukausha vizuri hulinda faida yako.', ha: 'Bushewa da kyau na kare riba.', tw: 'Hwie yie na ɛhwɛ wo mfaso so.' },
  'economics.task.clearReducesLoss': { en: 'Good clearing helps reduce loss.', fr: 'Un bon désherbage réduit les pertes.', sw: 'Usafishaji hupunguza hasara.', ha: 'Share na rage asara.', tw: 'Popa yie tumi tɔɔ sɛe nkakra.' },
  'economics.task.dryProtectsQuality': { en: 'Drying protects sale quality.', fr: 'Le séchage protège la qualité.', sw: 'Kukausha hulinda ubora.', ha: 'Bushewa na kare inganci.', tw: 'Ahwie yie hwɛ ne su so.' },
  'economics.task.harvestTracksProfit': { en: 'Logging harvest helps track profit.', fr: 'Enregistrer aide à suivre les bénéfices.', sw: 'Kurekodi husaidia kufuatilia faida.', ha: 'Rubuta na taimaka wajen bin diddigin riba.', tw: 'Kyerɛw ma woahu wo mfaso.' },
  'economics.task.storeReducesWaste': { en: 'Good storage reduces waste.', fr: 'Un bon stockage réduit le gaspillage.', sw: 'Hifadhi nzuri hupunguza upotevu.', ha: 'Ajiyewa mai kyau na rage ɓarnatar.', tw: 'Kora yie na ɛtɔɔ sɛe nkakra.' },
  'economics.task.protectInvestment': { en: 'Protecting your crop protects your investment.', fr: 'Protéger votre culture protège votre investissement.', sw: 'Kulinda mazao yako hulinda uwekezaji wako.', ha: 'Kare amfanin ku na kare jarin ku.', tw: 'Bɔ wo nnɔbae ho ban na ɛhwɛ wo sika so.' },
  'economics.task.nutrientsBoostYield': { en: 'Right nutrients boost your yield.', fr: 'Les bons nutriments augmentent le rendement.', sw: 'Virutubisho sahihi vinaboresha mavuno.', ha: 'Takin da ya dace na ƙara amfani.', tw: 'Nkwan pa ma wo nnɔbae dɔɔso.' },
  'economics.task.qualitySeedMatters': { en: 'Quality seeds give better harvest.', fr: 'Les semences de qualité donnent une meilleure récolte.', sw: 'Mbegu bora hutoa mavuno bora.', ha: 'Iri mai inganci na ba da girbi mafi kyau.', tw: 'Aba pa ma wotwa adeɛ pii.' },
  'economics.task.sortingRaisesPrice': { en: 'Sorting raises your selling price.', fr: 'Le tri augmente votre prix de vente.', sw: 'Kupanga kunaongeza bei ya kuuza.', ha: 'Tsarawa na ƙara farashin sayarwa.', tw: 'Pae mu ma wo bo kɔ soro.' },

  // ── i18n gap-fill: keys called via t() but previously undefined.
  //    Audit pass found these on src/components/DailyProgressCard.jsx
  //    and src/pages/AllTasksPage.jsx. Adding them here so non-Hindi
  //    languages don't fall through to humanizeKey output.
  'progress.next.label':            { en: 'Next',                fr: 'Suivant',           sw: 'Inayofuata',          ha: 'Na gaba',                tw: 'Nea ɛdi hɔ',          hi: 'अगला' },
  'progress.today.label':           { en: 'Today',               fr: 'Aujourd\'hui',     sw: 'Leo',                 ha: 'Yau',                    tw: 'Nnɛ',                 hi: 'आज' },
  'progress.score.farmStatus':      { en: 'Farm status',         fr: 'État de la ferme',  sw: 'Hali ya shamba',      ha: 'Yanayin gona',           tw: 'Afuom tebea',         hi: 'खेत की स्थिति' },
  'progress.streak.noneShort':      { en: 'No streak yet',       fr: 'Aucune série',      sw: 'Hakuna mfululizo',    ha: 'Babu jeri tukuna',       tw: 'Saa biara nni hɔ',    hi: 'अभी कोई स्ट्रीक नहीं' },
  'tasks.loadSafeResult':           { en: 'Loaded safely from cache.', fr: 'Chargé depuis le cache.', sw: 'Imepakuliwa kutoka kwa cache.', ha: 'An ɗora daga ma\'aji.', tw: 'Wɔde aba so firi sika so.', hi: 'कैश से सुरक्षित रूप से लोड किया गया।' },

  // ─── Low-literacy farmer UI layer (icon-first action cards, voice
  //    buttons, mic input, simple-mode toggle). All strings kept short
  //    and action-first so a single 🔊 playback finishes in under
  //    ~2 seconds across all 6 languages.
  'common.listen':                  { en: 'Listen',              fr: 'Écouter',           sw: 'Sikiliza',            ha: 'Saurara',                tw: 'Tie',                 hi: 'सुनें' },
  'common.startVoiceInput':         { en: 'Speak to type',       fr: 'Parlez pour saisir', sw: 'Sema ili uandike',   ha: 'Yi magana don rubutawa', tw: 'Kasa kyerɛw',         hi: 'बोलकर लिखें' },
  'common.voiceInputUnsupported':   { en: 'Voice input not available on this device', fr: 'Saisie vocale indisponible sur cet appareil', sw: 'Sauti haipatikani kwenye kifaa hiki', ha: 'Shigar da murya ba ya samuwa a wannan na\'urar', tw: 'Nne fa adi nyɛ adwuma wɔ saa afidie yi so', hi: 'इस डिवाइस पर वॉइस इनपुट उपलब्ध नहीं' },
  'common.voiceInputFailed':        { en: 'Could not hear you, try again', fr: 'Impossible de vous entendre, réessayez', sw: 'Hatukukusikia, jaribu tena', ha: 'Ba mu ji ka ba, sake gwadawa', tw: 'Yɛante wo, san hwehwɛ', hi: 'आपको सुन नहीं सके, दोबारा कोशिश करें' },

  'farmerActions.home':             { en: 'Home',                fr: 'Accueil',           sw: 'Nyumbani',            ha: 'Gida',                   tw: 'Fie',                 hi: 'घर' },
  'farmerActions.myFarm':           { en: 'My farm',             fr: 'Ma ferme',          sw: 'Shamba langu',        ha: 'Gonata',                 tw: 'M\'afuo',             hi: 'मेरा खेत' },
  'farmerActions.tasks':            { en: 'Tasks',               fr: 'Tâches',            sw: 'Kazi',                ha: 'Ayyuka',                 tw: 'Nnwuma',              hi: 'कार्य' },
  'farmerActions.progress':         { en: 'Progress',            fr: 'Progrès',           sw: 'Maendeleo',           ha: 'Cigaba',                 tw: 'Nkɔanim',             hi: 'प्रगति' },
  'farmerActions.weather':          { en: 'Weather',             fr: 'Météo',             sw: 'Hali ya hewa',        ha: 'Yanayi',                 tw: 'Ewiem tebea',         hi: 'मौसम' },
  'farmerActions.scanCrop':         { en: 'Scan crop',           fr: 'Scanner la culture', sw: 'Skani zao',          ha: 'Duba shuka',             tw: 'Hwehwɛ aduane',       hi: 'फसल जाँचें' },
  'farmerActions.recordHarvest':    { en: 'Record harvest',      fr: 'Saisir la récolte', sw: 'Andika mavuno',       ha: 'Rubuta girbi',           tw: 'Kyerɛw nnɔbae',       hi: 'फसल दर्ज करें' },
  'farmerActions.readyToSell':      { en: 'Ready to sell',       fr: 'Prêt à vendre',     sw: 'Tayari kuuza',        ha: 'Shirye don sayarwa',     tw: 'Krado sɛ wɔbɛtɔn',    hi: 'बेचने के लिए तैयार' },
  'farmerActions.reminders':        { en: 'Reminders',           fr: 'Rappels',           sw: 'Vikumbusho',          ha: 'Tunatarwa',              tw: 'Nkae',                hi: 'अनुस्मारक' },
  'farmerActions.help':             { en: 'Help',                fr: 'Aide',              sw: 'Msaada',              ha: 'Taimako',                tw: 'Mmoa',                hi: 'सहायता' },

  'farmerActions.addFarm':          { en: 'Add farm',            fr: 'Ajouter une ferme', sw: 'Ongeza shamba',       ha: 'Ƙara gona',              tw: 'Fa afuo ka ho',       hi: 'खेत जोड़ें' },
  'farmerActions.changeFarm':       { en: 'Change farm',         fr: 'Changer de ferme',  sw: 'Badilisha shamba',    ha: 'Canza gona',             tw: 'Sesa afuo',           hi: 'खेत बदलें' },
  'farmerActions.nextAction':       { en: 'Next action',         fr: 'Action suivante',   sw: 'Hatua inayofuata',    ha: 'Mataki na gaba',         tw: 'Ade a edi hɔ',        hi: 'अगला कदम' },
  'farmerActions.viewTomorrowTask': { en: 'See tomorrow\'s task', fr: 'Voir la tâche de demain', sw: 'Ona kazi ya kesho', ha: 'Duba aikin gobe',     tw: 'Hwɛ ɔkyena adwuma',   hi: 'कल का काम देखें' },
  'farmerActions.cropStarting':     { en: 'Your crop is just starting', fr: 'Votre culture commence à peine', sw: 'Zao lako linaanza tu', ha: 'Shukarka tana farawa kawai', tw: 'W\'aduane refi ase', hi: 'आपकी फसल अभी शुरू हो रही है' },
  'farmerActions.completeTasksToday': { en: 'Finish today\'s tasks', fr: 'Terminez les tâches du jour', sw: 'Maliza kazi za leo', ha: 'Kammala ayyukan yau', tw: 'Wie nnɛ nnwuma', hi: 'आज के काम पूरे करें' },
  'farmerActions.takePhoto':        { en: 'Take photo',          fr: 'Prendre une photo', sw: 'Piga picha',          ha: 'Ɗauki hoto',             tw: 'Twa mfoni',           hi: 'फोटो लें' },
  'farmerActions.checkWeather':     { en: 'Check weather',       fr: 'Voir la météo',     sw: 'Angalia hali ya hewa', ha: 'Duba yanayi',           tw: 'Hwɛ ewiem tebea',     hi: 'मौसम देखें' },

  'farmerActions.simpleMode':       { en: 'Simple',              fr: 'Simple',            sw: 'Rahisi',              ha: 'Mai sauƙi',              tw: 'Ɔkwan tiawa',         hi: 'आसान' },
  'farmerActions.standardMode':     { en: 'Standard',            fr: 'Standard',          sw: 'Kawaida',             ha: 'Na yau da kullum',       tw: 'Daa daa',             hi: 'मानक' },
  'farmerActions.switchToSimple':   { en: 'Use simple mode',     fr: 'Passer en mode simple', sw: 'Tumia hali rahisi', ha: 'Yi amfani da sauƙi',   tw: 'Fa ɔkwan tiawa di dwuma', hi: 'आसान मोड का उपयोग करें' },
  'farmerActions.switchToStandard': { en: 'Use standard mode',   fr: 'Passer en mode standard', sw: 'Tumia hali ya kawaida', ha: 'Yi amfani da daidaitacce', tw: 'Fa daa daa di dwuma', hi: 'मानक मोड का उपयोग करें' },

  // ─── Voice-first navigation (VoiceAssistant.jsx) ─────────────
  // Spoken prompts MUST stay short — recognition starts ~2s after
  // playback begins. The "notUnderstood" line is the only string
  // the spec explicitly requires; the rest are status chip labels
  // that appear briefly above the floating button.
  'voiceNav.prompt':         { en: 'What do you want to do?',     fr: 'Que voulez-vous faire ?',          sw: 'Unataka kufanya nini?',                 ha: 'Me kake son yi?',                     tw: 'Dɛn na wopɛ sɛ woyɛ?',         hi: 'आप क्या करना चाहते हैं?' },
  'voiceNav.notUnderstood':  { en: "I didn't understand. Try saying tasks or farm.", fr: "Je n'ai pas compris. Dites tâches ou ferme.", sw: 'Sikuelewa. Sema kazi au shamba.', ha: 'Ban gane ba. Ka ce ayyuka ko gona.', tw: 'Mante aseɛ. Ka nnwuma anaa afuo.', hi: 'मैं समझा नहीं। काम या खेत बोलें।' },
  'voiceNav.tap':            { en: 'Voice assistant',             fr: 'Assistant vocal',                  sw: 'Msaidizi wa sauti',                     ha: 'Mai taimakon murya',                  tw: 'Nne mmoa',                     hi: 'वॉइस सहायक' },
  'voiceNav.prompting':      { en: 'Speaking…',                   fr: 'Je parle…',                        sw: 'Inazungumza…',                          ha: 'Ana magana…',                         tw: 'Yɛrekasa…',                    hi: 'बोल रहा है…' },
  'voiceNav.listening':      { en: 'Listening… speak now',        fr: 'J’écoute… parlez',                 sw: 'Inasikiliza… sema sasa',                ha: 'Ina saurara… yi magana yanzu',        tw: 'Yɛretie… kasa seesei',         hi: 'सुन रहा है… अब बोलें' },
  'voiceNav.resolving':      { en: 'One moment…',                 fr: 'Un instant…',                      sw: 'Subiri kidogo…',                        ha: 'Ɗan jira…',                           tw: 'Twɛn kakra…',                  hi: 'एक पल…' },

  // ─── Lightweight offline queue banner (OfflineSyncBanner.jsx) ─
  // Distinct from the heavy `offline.*` namespace already used by
  // OfflineBanner — these strings are deliberately short so the
  // pill fits at the top-right of the screen.
  'offlineSync.offline':     { en: 'Offline mode: changes will sync',          fr: 'Mode hors ligne : les changements se synchroniseront', sw: 'Hali ya nje ya mtandao: mabadiliko yataoanishwa', ha: 'Yanayin babu yanar gizo: canje-canje za su daidaita', tw: 'Intanɛt nni hɔ: nsesaeɛ bɛkɔ so', hi: 'ऑफ़लाइन मोड: बदलाव बाद में सिंक होंगे' },
  'offlineSync.syncing':     { en: 'Back online. Syncing…',                    fr: 'De retour en ligne. Synchronisation…',                              sw: 'Umerudi mtandaoni. Inaoanisha…',              ha: 'Ka koma yanar gizo. Ana daidaitawa…',         tw: 'Wo san ba intanɛt so. Yɛrekora…',           hi: 'फिर से ऑनलाइन। सिंक हो रहा है…' },
  'offlineSync.abandoned':   { en: 'Some actions could not sync. Please check your connection.', fr: 'Certaines actions n’ont pas pu se synchroniser. Vérifiez votre connexion.', sw: 'Vitendo kadhaa havijaweza kuoanishwa. Angalia muunganisho.', ha: 'Wasu ayyuka ba su daidaita ba. Duba haɗin yanar gizo.', tw: 'Nneyɛeɛ bi antumi ankɔ. Hwɛ wo intanɛt no.', hi: 'कुछ क्रियाएँ सिंक नहीं हो सकीं। कनेक्शन जाँचें।' },

  // ─── Admin "Key Insights" section (KeyInsightsSection.jsx) ────
  // {pct}/{count} are interpolated by the component before the
  // string is rendered, so translators only need to keep the
  // placeholder tokens intact. Strings stay short and declarative.
  'admin.insights.sectionTitle':              { en: 'Key Insights',           fr: 'Insights clés',                       sw: 'Maarifa Muhimu',                            ha: 'Mabuɗin Fahimta',                          tw: 'Nsɛm Titriw',                          hi: 'मुख्य अंतर्दृष्टि' },
  'admin.insights.highRisk.title':            { en: 'High Risk Alert',        fr: 'Alerte risque élevé',                 sw: 'Onyo la Hatari Kubwa',                      ha: 'Faɗakarwar Babban Haɗari',                 tw: 'Asiane Kɛseɛ Kɔkɔbɔ',                 hi: 'उच्च जोखिम चेतावनी' },
  'admin.insights.highRisk.body':             { en: '{pct}% of farmers may underperform due to low activity', fr: '{pct}% des agriculteurs pourraient sous-performer en raison d’une faible activité', sw: 'Asilimia {pct} ya wakulima wanaweza kufanya vibaya kutokana na shughuli ndogo', ha: 'Kashi {pct} na manoma na iya yin rauni saboda ƙarancin aiki', tw: 'Akuafoɔ {pct}% bɛtumi ayɛ adwuma kakra ɛsiane sɛ wɔnyɛ adwuma pii', hi: '{pct}% किसान कम गतिविधि के कारण कमज़ोर प्रदर्शन कर सकते हैं' },
  'admin.insights.market.title':              { en: 'Market Opportunity',     fr: 'Opportunité de marché',               sw: 'Fursa ya Soko',                             ha: 'Damar Kasuwa',                             tw: 'Adwadie Akwannya',                     hi: 'बाज़ार अवसर' },
  'admin.insights.market.body':               { en: '{count} farms are ready to sell within 2 weeks', fr: '{count} fermes sont prêtes à vendre dans les 2 semaines', sw: 'Mashamba {count} yako tayari kuuza ndani ya wiki 2', ha: 'Gonaki {count} sun shirya sayarwa cikin makonni 2', tw: 'Mfuo {count} akrado sɛ wɔbɛtɔn wɔ adapɛn 2 mu', hi: '{count} खेत 2 हफ्तों में बेचने को तैयार हैं' },
  'admin.insights.performance.title':         { en: 'Performance Insight',    fr: 'Aperçu de performance',               sw: 'Maarifa ya Utendaji',                       ha: 'Fahimtar Aiki',                            tw: 'Adwumayɛ Nsɛm',                        hi: 'प्रदर्शन अंतर्दृष्टि' },
  'admin.insights.performance.bodyLift':      { en: 'Farmers completing tasks have {pct}% higher success rate', fr: 'Les agriculteurs qui terminent leurs tâches ont {pct}% de réussite en plus', sw: 'Wakulima wanaomaliza kazi wana kiwango cha mafanikio {pct}% cha juu', ha: 'Manoman da suke kammala ayyuka suna da nasara {pct}% sama', tw: 'Akuafoɔ a wɔwie nnwuma no nya nkonimdie {pct}% ɛboro', hi: 'काम पूरा करने वाले किसानों की सफलता दर {pct}% अधिक है' },
  'admin.insights.performance.bodyCompletion': { en: 'Farmers completing tasks have a {pct}% completion rate', fr: 'Les agriculteurs ont un taux d’achèvement de {pct}%',                          sw: 'Wakulima wana kiwango cha kumaliza cha {pct}%',                ha: 'Manoma suna da kashi {pct} na kammala ayyuka',          tw: 'Akuafoɔ wie wɔn nnwuma {pct}%',                        hi: 'किसानों की कार्य पूर्ण दर {pct}% है' },

  // ─── NGO decision-layer: risk band labels (RiskBadge.jsx) ────
  // Bands: high (<40), medium (40–59), low (60+).
  'risk.label.high':         { en: 'High Risk',  fr: 'Risque élevé',  sw: 'Hatari Kubwa',     ha: 'Babban Haɗari',     tw: 'Asiane Kɛseɛ',   hi: 'उच्च जोखिम' },
  'risk.label.medium':       { en: 'Medium',     fr: 'Moyen',         sw: 'Wastani',          ha: 'Matsakaici',        tw: 'Mfimfini',       hi: 'मध्यम' },
  'risk.label.low':          { en: 'Low',        fr: 'Faible',        sw: 'Chini',            ha: 'Ƙananan',           tw: 'Akakraa',        hi: 'कम' },

  // ─── Farmer Intelligence Summary (FarmerIntelligenceSummary) ─
  'admin.intelligence.title':   { en: 'Farmer Intelligence Summary', fr: 'Synthèse intelligence agriculteurs', sw: 'Muhtasari wa Maarifa ya Wakulima', ha: 'Taƙaitaccen Bayanai na Manoma', tw: 'Akuafoɔ Nimdeɛ Tiawa', hi: 'किसान इंटेलिजेंस सारांश' },
  'admin.summary.totalFarmers': { en: 'Total Farmers',           fr: 'Total agriculteurs', sw: 'Jumla ya Wakulima',     ha: 'Jimillar Manoma',         tw: 'Akuafoɔ Nyinaa',          hi: 'कुल किसान' },
  'admin.summary.activePct':    { en: 'Active %',                fr: 'Actifs %',           sw: 'Hai %',                  ha: 'Masu Aiki %',             tw: 'Wɔn a wɔreyɛ adwuma %',   hi: 'सक्रिय %' },
  'admin.summary.highRisk':     { en: 'High Risk',               fr: 'Risque élevé',       sw: 'Hatari Kubwa',           ha: 'Babban Haɗari',           tw: 'Asiane Kɛseɛ',            hi: 'उच्च जोखिम' },
  'admin.summary.readyToSell':  { en: 'Ready to Sell',           fr: 'Prêts à vendre',     sw: 'Tayari Kuuza',           ha: 'Shirye don Sayarwa',      tw: 'Krado sɛ wɔbɛtɔn',        hi: 'बेचने को तैयार' },
  'admin.summary.estTotalYield':{ en: 'Est. Total Yield',        fr: 'Rendement total est.', sw: 'Mavuno Yote (Tathmini)', ha: 'Jimillar Girbi (Kiyasi)', tw: 'Nnɔbae Nyinaa (Akontaabuo)', hi: 'अनुमानित कुल उपज' },

  // ─── Intervention list (InterventionList.jsx) ────────────────
  'admin.intervention.title':           { en: 'Farmers Needing Intervention', fr: 'Agriculteurs nécessitant un suivi', sw: 'Wakulima Wanaohitaji Msaada', ha: 'Manoman da ke Bukatar Taimako', tw: 'Akuafoɔ a Wɔhia Mmoa', hi: 'सहायता की आवश्यकता वाले किसान' },
  'admin.intervention.reason.missedTasks': { en: 'Missed tasks',     fr: 'Tâches manquées',   sw: 'Kazi zilizokosa',      ha: 'Ayyukan da aka rasa',    tw: 'Nnwuma a wɔato',         hi: 'छूटे हुए कार्य' },
  'admin.intervention.reason.lowActivity': { en: 'Low activity',     fr: 'Faible activité',   sw: 'Shughuli ndogo',        ha: 'Ƙarancin aiki',          tw: 'Adwumayɛ Sua',           hi: 'कम गतिविधि' },
  'admin.intervention.reason.server':      { en: 'Follow up with farmer', fr: 'Suivi avec l’agriculteur', sw: 'Fuatilia mkulima', ha: 'Bi diddigin manomi',  tw: 'Kɔ akyiri ne okuafoɔ no', hi: 'किसान से संपर्क करें' },

  // ─── Priority supply list (PrioritySupplyList.jsx) ───────────
  'admin.prioritySupply.title': { en: 'Priority Supply (Ready & High Score)', fr: 'Approvisionnement prioritaire (prêts et bien notés)', sw: 'Ugavi wa Kipaumbele (Tayari & Alama Juu)', ha: 'Babban Tanadi (Shirye & Maki Sama)', tw: 'Adwadie Titriw (Akrado & Maki Sɔronko)', hi: 'प्राथमिक आपूर्ति (तैयार और उच्च स्कोर)' },

  // Existing scoring table just got a new "Risk" column header.
  'admin.dashboard.col.risk':   { en: 'Risk', fr: 'Risque', sw: 'Hatari', ha: 'Haɗari', tw: 'Asiane', hi: 'जोखिम' },

  // ─── Voice-nav target: "buyers" (Market Access) ──────────────
  // Spoken / displayed when the floating mic resolves the keyword
  // "buyers" / "market" to the /buyers route.
  'farmerActions.buyers':       { en: 'Market Access', fr: 'Accès au marché', sw: 'Ufikiaji wa Soko', ha: 'Samun Kasuwa', tw: 'Adwadie Akwannya', hi: 'बाज़ार पहुँच' },

  // ─── Decision-dashboard provenance copy (spec §8) ────────────
  // Two short strings used in place of placeholder-admitting copy
  // ("coming soon", "TODO:", "demo data") on dashboard tiles.
  // Keep them generic so a tile can drop one in regardless of metric.
  'admin.live.computed':        { en: 'Computed from live data',  fr: 'Calculé à partir de données en direct', sw: 'Imehesabiwa kutoka data hai',     ha: 'An yi lissafin daga rayayyun bayanai', tw: 'Wɔayɛ ho akontaabu firi nokware nsɛm so', hi: 'लाइव डेटा से गणना' },
  'admin.live.realtime':        { en: 'Updated in real-time',     fr: 'Mis à jour en temps réel',              sw: 'Imesasishwa kwa wakati halisi',   ha: 'An sabunta a ainihin lokaci',           tw: 'Yɛasakra no seesei ara',                hi: 'रीयल-टाइम में अपडेट' },

  // ─── Final language cleanup §2 — required key map ────────────
  // Keys requested by the cleanup spec. Short, farmer-friendly
  // copy in every launch language. Twi / Hausa are deliberate
  // simple approximations where polished phrasing is unavailable —
  // strict rule: never an English string in a non-English UI.

  // progress.*
  'progress.cropStartingMessage': { en: 'Your crop is just getting started', fr: 'Votre culture commence à peine',          sw: 'Zao lako linaanza tu',          ha: 'Shukarka tana farawa kawai',         tw: 'W\'aduane refi ase',          hi: 'आपकी फसल अभी शुरू हो रही है' },
  'progress.nextAction':          { en: 'Next action',                       fr: 'Action suivante',                          sw: 'Hatua inayofuata',              ha: 'Mataki na gaba',                     tw: 'Ade a edi hɔ',                hi: 'अगला कदम' },
  'progress.viewTomorrowTask':    { en: 'See tomorrow\'s task',              fr: 'Voir la tâche de demain',                  sw: 'Ona kazi ya kesho',             ha: 'Duba aikin gobe',                    tw: 'Hwɛ ɔkyena adwuma',           hi: 'कल का काम देखें' },
  'progress.stageProgress':       { en: 'Stage progress',                    fr: 'Progrès de l\'étape',                      sw: 'Maendeleo ya hatua',            ha: 'Cigaban mataki',                     tw: 'Anammɔn nkɔanim',             hi: 'चरण प्रगति' },
  'progress.cropProgress':        { en: 'Crop progress',                     fr: 'Progrès de la culture',                    sw: 'Maendeleo ya zao',              ha: 'Cigaban shuka',                      tw: 'Aduane nkɔanim',              hi: 'फसल प्रगति' },
  'progress.completedToday':      { en: 'Completed today',                   fr: 'Terminé aujourd\'hui',                     sw: 'Imekamilika leo',               ha: 'An kammala yau',                     tw: 'Wie nnɛ',                     hi: 'आज पूरा हुआ' },
  'progress.remainingToday':      { en: 'Remaining today',                   fr: 'Restant aujourd\'hui',                     sw: 'Iliyobaki leo',                 ha: 'Sauran yau',                         tw: 'Aka nnɛ',                     hi: 'आज शेष' },
  'progress.updatedToday':        { en: 'Updated today',                     fr: 'Mis à jour aujourd\'hui',                  sw: 'Imesasishwa leo',               ha: 'An sabunta yau',                     tw: 'Yɛasakra nnɛ',                hi: 'आज अद्यतन' },
  'progress.allDone':             { en: 'All done',                          fr: 'Tout est fait',                            sw: 'Yote yamekamilika',             ha: 'An gama duka',                       tw: 'Ne nyinaa awie',              hi: 'सब हो गया' },
  'progress.excellent':           { en: 'Excellent',                         fr: 'Excellent',                                sw: 'Bora kabisa',                   ha: 'Mai kyau ƙwarai',                    tw: 'Eye paa',                     hi: 'उत्कृष्ट' },
  'progress.aheadThisWeek':       { en: 'Ahead this week',                   fr: 'En avance cette semaine',                  sw: 'Mbele wiki hii',                ha: 'A gaba wannan mako',                 tw: 'Anim wɔ saa nnawɔtwe yi',     hi: 'इस हफ्ते आगे' },

  // farm.*
  'farm.addFarm':                 { en: 'Add farm',                          fr: 'Ajouter une ferme',                        sw: 'Ongeza shamba',                 ha: 'Ƙara gona',                          tw: 'Fa afuo ka ho',               hi: 'खेत जोड़ें' },
  'farm.changeFarm':              { en: 'Change farm',                       fr: 'Changer de ferme',                         sw: 'Badilisha shamba',              ha: 'Canza gona',                         tw: 'Sesa afuo',                   hi: 'खेत बदलें' },
  'farm.timelineTitle':           { en: 'Crop timeline',                     fr: 'Chronologie de la culture',                sw: 'Ratiba ya zao',                 ha: 'Jadawalin shuka',                    tw: 'Aduane mmerɛ',                hi: 'फसल समयरेखा' },
  'farm.estimated':               { en: 'Estimated',                         fr: 'Estimé',                                   sw: 'Inakadiriwa',                   ha: 'An kiyasta',                         tw: 'Akontaabuo',                  hi: 'अनुमानित' },
  'farm.journey':                 { en: 'Journey',                           fr: 'Parcours',                                 sw: 'Safari',                        ha: 'Tafiya',                             tw: 'Akwantuo',                    hi: 'यात्रा' },
  'farm.stageNow':                { en: 'Stage now',                         fr: 'Étape actuelle',                           sw: 'Hatua sasa',                    ha: 'Mataki yanzu',                       tw: 'Anammɔn seesei',              hi: 'अभी का चरण' },
  'farm.nextStage':               { en: 'Next stage',                        fr: 'Étape suivante',                           sw: 'Hatua inayofuata',              ha: 'Mataki na gaba',                     tw: 'Anammɔn a edi hɔ',            hi: 'अगला चरण' },
  'farm.planting':                { en: 'Planting',                          fr: 'Plantation',                               sw: 'Upandaji',                      ha: 'Shuka',                              tw: 'Aduadua',                     hi: 'रोपण' },
  'farm.establishment':           { en: 'Establishment',                     fr: 'Établissement',                            sw: 'Uthibitisho',                   ha: 'Kafawa',                             tw: 'Ntoɔ',                        hi: 'स्थापना' },
  'farm.myProgress':              { en: 'My progress',                       fr: 'Mes progrès',                              sw: 'Maendeleo yangu',               ha: 'Ci gaban da',                        tw: 'Me nkɔso',                    hi: 'मेरी प्रगति' },
  'farm.noStreak':                { en: 'No streak yet',                     fr: 'Pas encore de série',                      sw: 'Hakuna mfululizo bado',         ha: 'Babu jeri tukuna',                   tw: 'Saa biara nni hɔ',            hi: 'अभी कोई स्ट्रीक नहीं' },
  'farm.farmStatus':              { en: 'Farm status',                       fr: 'État de la ferme',                         sw: 'Hali ya shamba',                ha: 'Yanayin gona',                       tw: 'Afuom tebea',                 hi: 'खेत की स्थिति' },
  'farm.correct':                 { en: 'Correct',                           fr: 'Correct',                                  sw: 'Sahihi',                        ha: 'Daidai',                             tw: 'Eye',                         hi: 'सही' },
  'farm.progressInMotion':        { en: 'Progress in motion',                fr: 'Progrès en cours',                         sw: 'Maendeleo yanaendelea',         ha: 'Ci gaba yana ci gaba',               tw: 'Nkɔso rekɔ so',               hi: 'प्रगति जारी' },
  'farm.startYourDay':            { en: 'Start your day',                    fr: 'Commencez votre journée',                  sw: 'Anza siku yako',                ha: 'Fara ranarka',                       tw: 'Hyɛ wo da no ase',            hi: 'अपना दिन शुरू करें' },
  'farm.sowToday':                { en: 'Sow today',                         fr: 'Semez aujourd\'hui',                       sw: 'Panda leo',                     ha: 'Shuka yau',                          tw: 'Dua nnɛ',                     hi: 'आज बोएँ' },

  // settings.*
  'settings.weather':             { en: 'Weather',                           fr: 'Météo',                                    sw: 'Hali ya hewa',                  ha: 'Yanayi',                             tw: 'Ewiem tebea',                 hi: 'मौसम' },
  'settings.weatherHelper':       { en: 'Get weather updates for your area', fr: 'Recevez la météo pour votre région',       sw: 'Pata habari za hali ya hewa',   ha: 'Karɓi sabuntawa game da yanayi',     tw: 'Nya ewiem tebea ho nsɛm',     hi: 'अपने क्षेत्र की मौसम जानकारी पाएँ' },
  'settings.risk':                { en: 'Risk alerts',                       fr: 'Alertes de risque',                        sw: 'Maonyo ya hatari',              ha: 'Faɗakarwar haɗari',                  tw: 'Asiane kɔkɔbɔ',               hi: 'जोखिम चेतावनी' },
  'settings.riskHelper':          { en: 'Get warnings about pests and risks', fr: 'Recevez des alertes ravageurs et risques', sw: 'Pata maonyo ya wadudu na hatari', ha: 'Sami gargadi game da kwari',       tw: 'Nya kɔkɔbɔ fa nkekaboa ho',   hi: 'कीटों और जोखिमों की चेतावनी' },
  'settings.missed':              { en: 'Missed task reminders',             fr: 'Rappels de tâches manquées',               sw: 'Vikumbusho vya kazi zilizokosa', ha: 'Tunatarwar ayyukan da aka rasa',    tw: 'Adwuma a wɔato no nkae',      hi: 'छूटे कार्यों के अनुस्मारक' },
  'settings.missedHelper':        { en: 'Reminders for tasks you missed',    fr: 'Rappels pour les tâches manquées',         sw: 'Vikumbusho vya kazi ulizokosa', ha: 'Tunatarwa don ayyukan da kuka rasa', tw: 'Nkae a ɛfa nnwuma a woto ho', hi: 'जो काम छूट गए, उनके अनुस्मारक' },
  'settings.email':               { en: 'Email',                             fr: 'E-mail',                                   sw: 'Barua pepe',                    ha: 'Imel',                               tw: 'Email',                       hi: 'ईमेल' },
  'settings.sms':                 { en: 'SMS',                               fr: 'SMS',                                      sw: 'SMS',                           ha: 'SMS',                                tw: 'SMS',                         hi: 'एसएमएस' },
  'settings.smsHelper':           { en: 'Receive reminders by SMS',          fr: 'Recevez des rappels par SMS',              sw: 'Pokea vikumbusho kwa SMS',      ha: 'Karɓi tunatarwa ta SMS',             tw: 'Nya nkae denam SMS so',       hi: 'एसएमएस से अनुस्मारक पाएँ' },
  'settings.reminderTime':        { en: 'Reminder time',                     fr: 'Heure du rappel',                          sw: 'Saa ya kikumbusho',             ha: 'Lokacin tunatarwa',                  tw: 'Nkae berɛ',                   hi: 'अनुस्मारक समय' },
  'settings.reminderTimeHelper':  { en: 'When to send reminders each day',   fr: 'Quand envoyer les rappels chaque jour',    sw: 'Wakati wa kutuma vikumbusho',   ha: 'Lokacin aika tunatarwa kowace rana', tw: 'Berɛ a yɛde nkae bɛkɔ ɛda biara', hi: 'हर दिन अनुस्मारक कब भेजें' },

  // support.*
  'support.needHelp':             { en: 'Need help?',                        fr: 'Besoin d\'aide ?',                         sw: 'Unahitaji msaada?',             ha: 'Kana bukatar taimako?',              tw: 'Wohia mmoa?',                 hi: 'मदद चाहिए?' },
  'support.helpText':             { en: 'Contact our support team',          fr: 'Contactez notre équipe de support',        sw: 'Wasiliana na timu yetu',        ha: 'Tuntuɓi tawagar tallafi',            tw: 'Frɛ yɛn mmoa kuo',            hi: 'सहायता टीम से संपर्क करें' },
  'support.subject':              { en: 'Subject',                           fr: 'Sujet',                                    sw: 'Mada',                          ha: 'Batun',                              tw: 'Asɛm no',                     hi: 'विषय' },
  'support.describeProblem':      { en: 'Describe your problem',             fr: 'Décrivez votre problème',                  sw: 'Eleza tatizo lako',             ha: 'Bayyana matsalarka',                 tw: 'Ka wo haw no',                hi: 'अपनी समस्या बताएँ' },
  'support.send':                 { en: 'Send',                              fr: 'Envoyer',                                  sw: 'Tuma',                          ha: 'Aika',                               tw: 'Soma',                        hi: 'भेजें' },

  // actions.* — short namespace aliases requested by the spec.
  // The existing farmerActions.* keys remain valid; these aliases
  // make the cleanup spec match call-site verbatim.
  'actions.readyToSell':          { en: 'Ready to sell',                     fr: 'Prêt à vendre',                            sw: 'Tayari kuuza',                  ha: 'Shirye don sayarwa',                 tw: 'Krado sɛ wɔbɛtɔn',            hi: 'बेचने के लिए तैयार' },
  'actions.scanCrop':             { en: 'Scan crop',                         fr: 'Scanner la culture',                       sw: 'Skani zao',                     ha: 'Duba shuka',                         tw: 'Hwehwɛ aduane',               hi: 'फसल जाँचें' },
  'actions.recordHarvest':        { en: 'Record harvest',                    fr: 'Saisir la récolte',                        sw: 'Andika mavuno',                 ha: 'Rubuta girbi',                       tw: 'Kyerɛw nnɔbae',               hi: 'फसल दर्ज करें' },
  'actions.takePhoto':            { en: 'Take photo',                        fr: 'Prendre une photo',                        sw: 'Piga picha',                    ha: 'Ɗauki hoto',                         tw: 'Twa mfoni',                   hi: 'फोटो लें' },
  'actions.checkWeather':         { en: 'Check weather',                     fr: 'Voir la météo',                            sw: 'Angalia hali ya hewa',          ha: 'Duba yanayi',                        tw: 'Hwɛ ewiem tebea',             hi: 'मौसम देखें' },

  // ─── Strict cleanup patch — task / priority / status / weather
  //    helpers required by src/data/taskLibrary.js + the rendering
  //    contract in the spec. All 6 launch languages populated. Twi
  //    / Hausa values are deliberately short approximations where
  //    polished phrasing isn't available; strict no-leak rule.
  'tasks.generic.title':          { en: 'Today\'s task',                       fr: 'Tâche du jour',                       sw: 'Kazi ya leo',                  ha: 'Aikin yau',                          tw: 'Nnɛ adwuma',                  hi: 'आज का काम' },
  'tasks.generic.desc':           { en: 'Check your farm today',               fr: 'Vérifiez votre ferme aujourd\'hui',   sw: 'Angalia shamba lako leo',      ha: 'Duba gonarka yau',                   tw: 'Hwɛ w\'afuo nnɛ',             hi: 'आज अपना खेत देखें' },
  'tasks.generic.why':            { en: 'Daily check keeps your crop healthy', fr: 'Une vérification quotidienne garde la culture en bonne santé', sw: 'Ukaguzi wa kila siku huweka zao lako salama', ha: 'Duba na yau da kullum yana kiyaye amfanin gona', tw: 'Daa daa nhwehwɛmu boa wo nnɔbae', hi: 'दैनिक जाँच फसल स्वस्थ रखती है' },

  'tasks.scout.title':            { en: 'Scout the field',                     fr: 'Inspecter le champ',                  sw: 'Kagua shamba',                 ha: 'Bincika gona',                       tw: 'Hwehwɛ afuo no mu',           hi: 'खेत की जाँच करें' },
  'tasks.scout.desc':             { en: 'Walk the rows and look for pests or damage', fr: 'Parcourez les rangs pour chercher ravageurs ou dégâts', sw: 'Tembea katika mistari ukitafuta wadudu au uharibifu', ha: 'Yi tafiya cikin layuka don neman kwari ko lalacewa', tw: 'Nantenante hwɛ nnoboa anaa ɔsɛeɛ', hi: 'पंक्तियों में चलें और कीट या नुकसान देखें' },
  'tasks.scout.why':              { en: 'Early spotting prevents bigger damage', fr: 'Une détection précoce évite des dégâts plus grands', sw: 'Kugundua mapema huzuia uharibifu mkubwa', ha: 'Gano da wuri yana hana lalacewa mai girma', tw: 'Sɛ wo hu ntɛm a, ɛsi ɔsɛeɛ kɛseɛ ano', hi: 'जल्दी पहचान बड़े नुकसान से बचाती है' },

  'tasks.weed.title':             { en: 'Weed the rows',                       fr: 'Désherber les rangs',                 sw: 'Palilia mistari',              ha: 'Cire ciyawa daga layuka',            tw: 'Tu wura firi nfuoɔ no mu',    hi: 'पंक्तियों की निराई करें' },
  'tasks.weed.desc':              { en: 'Remove the most crowded weeds first', fr: 'Enlevez d\'abord les mauvaises herbes les plus denses', sw: 'Toa magugu yenye wengi kwanza', ha: 'Cire ciyawa mafi yawa da farko',   tw: 'Tu wura a ɛyɛ pii kane',      hi: 'पहले सबसे घनी खरपतवार हटाएँ' },
  'tasks.weed.why':               { en: 'Weeds steal water and nutrients',     fr: 'Les mauvaises herbes volent eau et nutriments', sw: 'Magugu hunyang\'anya maji na virutubisho', ha: 'Ciyawa tana sace ruwa da abinci mai gina jiki', tw: 'Wura wia nsuo ne aduane', hi: 'खरपतवार पानी और पोषक तत्व चुराती है' },

  'tasks.moisture.title':         { en: 'Check soil moisture',                 fr: 'Vérifier l\'humidité du sol',         sw: 'Angalia unyevu wa udongo',     ha: 'Duba zafi na ƙasa',                  tw: 'Hwɛ asase mu nsuo',           hi: 'मिट्टी की नमी जाँचें' },
  'tasks.moisture.desc':          { en: 'Squeeze a handful — it should crumble', fr: 'Pressez une poignée — elle doit s\'émietter', sw: 'Bonyeza mkono mmoja — udongo ufunguke', ha: 'Matse hannu ɗaya — ya kamata ya rabu', tw: 'Mia asase wɔ wo nsa mu — ɛsɛ sɛ ɛsɛe', hi: 'मुट्ठी भर लें — उसे टूटना चाहिए' },
  'tasks.moisture.why':           { en: 'Plants need moist, not soggy soil',   fr: 'Les plantes veulent un sol humide, pas détrempé', sw: 'Mimea inahitaji udongo wenye unyevu, sio uliojaa maji', ha: 'Tsiro suna bukatar ƙasa mai laima, ba mai jika ba', tw: 'Aduane hia asase a ɛyɛ fɔm, na ɛnyɛ asase a nsuo ahyɛ mu ma', hi: 'पौधे नम मिट्टी चाहते हैं, गीली नहीं' },

  'tasks.sow.title':              { en: 'Sow today',                           fr: 'Semer aujourd\'hui',                   sw: 'Panda leo',                    ha: 'Shuka yau',                          tw: 'Dua nnɛ',                     hi: 'आज बोएँ' },
  'tasks.sow.desc':               { en: 'Plant the next section of seed',      fr: 'Plantez la section suivante de semences', sw: 'Panda sehemu inayofuata ya mbegu', ha: 'Shuka sashe na gaba na iri',         tw: 'Dua aba a edi hɔ no',         hi: 'बीज का अगला भाग बोएँ' },
  'tasks.sow.why':                { en: 'Staggered sowing keeps harvest steady', fr: 'Semer en plusieurs fois lisse la récolte', sw: 'Kupanda kwa awamu hutoa mavuno endelevu', ha: 'Shuka a matakai yana sa girbi ya zama mai daidaitawa', tw: 'Sɛ wodua mmerɛ-mmerɛ a, otwa berɛ no kɔ so', hi: 'चरणबद्ध बुआई फसल स्थिर रखती है' },

  // priority chips on task cards
  'priority.high':                { en: 'High',                                fr: 'Élevée',                              sw: 'Juu',                          ha: 'Babba',                              tw: 'Kɛseɛ',                       hi: 'उच्च' },
  'priority.medium':              { en: 'Medium',                              fr: 'Moyenne',                             sw: 'Wastani',                      ha: 'Matsakaici',                         tw: 'Mfimfini',                    hi: 'मध्यम' },
  'priority.low':                 { en: 'Low',                                 fr: 'Faible',                              sw: 'Chini',                        ha: 'Ƙananan',                            tw: 'Akakraa',                     hi: 'कम' },

  // shared labels
  'labels.why':                   { en: 'Why',                                 fr: 'Pourquoi',                            sw: 'Kwa nini',                     ha: 'Me yasa',                            tw: 'Adɛn',                        hi: 'क्यों' },

  // additional progress / actions strings spec'd for task cards
  'actions.markDone':             { en: 'Mark done',                           fr: 'Marquer fait',                        sw: 'Weka alama imekamilika',       ha: 'Yi alama an gama',                   tw: 'De ho nsɛnkyerɛnneɛ — awie',  hi: 'पूरा चिह्नित करें' },
  'actions.skip':                 { en: 'Skip',                                fr: 'Passer',                              sw: 'Ruka',                         ha: 'Tsallake',                           tw: 'Bu so',                       hi: 'छोड़ें' },
  'actions.send':                 { en: 'Send',                                fr: 'Envoyer',                             sw: 'Tuma',                         ha: 'Aika',                               tw: 'Soma',                        hi: 'भेजें' },

  // weather chips on the home / today surfaces
  'weather.rain':                 { en: 'Rain',                                fr: 'Pluie',                               sw: 'Mvua',                         ha: 'Ruwan sama',                         tw: 'Nsuo',                        hi: 'बारिश' },
  'weather.mixed':                { en: 'Mixed weather',                       fr: 'Météo variable',                      sw: 'Hali ya hewa mchanganyiko',    ha: 'Yanayi mai gauraya',                 tw: 'Ewiem tebea adi afra',        hi: 'मिश्रित मौसम' },
  'weather.good':                 { en: 'Good',                                fr: 'Bonne',                               sw: 'Nzuri',                        ha: 'Mai kyau',                           tw: 'Eye',                         hi: 'अच्छा' },
  'weather.updatedJustNow':       { en: 'Updated just now',                    fr: 'Mis à jour à l\'instant',             sw: 'Imesasishwa sasa hivi',        ha: 'An sabunta yanzun nan',              tw: 'Yɛasakra no seesei ara',      hi: 'अभी अपडेट किया गया' },
  'weather.more':                 { en: 'More',                                fr: 'Plus',                                sw: 'Zaidi',                        ha: 'Ƙari',                               tw: 'Bebree',                      hi: 'अधिक' },
  'weather.today':                { en: 'Today',                               fr: 'Aujourd\'hui',                        sw: 'Leo',                          ha: 'Yau',                                tw: 'Nnɛ',                         hi: 'आज' },

  // status chips
  'status.good':                  { en: 'Good',                                fr: 'Bon',                                 sw: 'Vyema',                        ha: 'Mai kyau',                           tw: 'Eye',                         hi: 'अच्छा' },
  'status.correct':               { en: 'On track',                            fr: 'Sur la bonne voie',                   sw: 'Kwenye njia sahihi',           ha: 'A kan hanya',                        tw: 'Ɛkwan pa so',                 hi: 'सही दिशा में' },
  'status.needsAttention':        { en: 'Needs attention',                     fr: 'Demande de l\'attention',             sw: 'Inahitaji uangalifu',          ha: 'Yana bukatar kulawa',                tw: 'Hia hwɛ',                     hi: 'ध्यान चाहिए' },

  // progress.allDone* (referenced by spec §5)
  'progress.allDoneTitle':        { en: 'All done for now',                    fr: 'Terminé pour l\'instant',             sw: 'Imeisha kwa sasa',             ha: 'An gama a yanzu',                    tw: 'Awie seesei',                 hi: 'अभी सब हो गया' },
  'progress.allDoneSubtitle':     { en: 'Great work — come back tomorrow',     fr: 'Beau travail — revenez demain',       sw: 'Kazi nzuri — rudi kesho',      ha: 'Aiki mai kyau — ka dawo gobe',       tw: 'Adwuma pa — bra ɔkyena',      hi: 'बहुत अच्छा — कल वापस आएँ' },

  // ─── Final-leak global patch — spec key shape ────────────────
  // Generic section / label / helper namespaces used by future
  // call sites that route through tSafe(key, '') with strict no-leak.
  // Twi/Hausa kept short and simple — strict rule: never English.
  'labels.title':                 { en: 'Title',           fr: 'Titre',                 sw: 'Kichwa',                 ha: 'Take',                       tw: 'Nsɛm tiawa',              hi: 'शीर्षक' },
  'labels.subtitle':              { en: 'Subtitle',        fr: 'Sous-titre',            sw: 'Kichwa kidogo',          ha: 'Ƙaramin take',               tw: 'Nsɛm a edi hɔ',           hi: 'उपशीर्षक' },

  'sections.daily':               { en: 'Daily',           fr: 'Quotidien',             sw: 'Kila siku',              ha: 'Kowace rana',                tw: 'Da biara',                hi: 'दैनिक' },
  'sections.weather':             { en: 'Weather',         fr: 'Météo',                 sw: 'Hali ya hewa',           ha: 'Yanayi',                     tw: 'Ewiem tebea',             hi: 'मौसम' },
  'sections.risk':                { en: 'Risk',            fr: 'Risque',                sw: 'Hatari',                 ha: 'Haɗari',                     tw: 'Asiane',                  hi: 'जोखिम' },
  'sections.missed':              { en: 'Missed',          fr: 'Manqué',                sw: 'Imekosa',                ha: 'An rasa',                    tw: 'Atomi',                   hi: 'छूटा' },

  // helpers.* — the spec's clean-UI rule says short/empty hints
  // are better than long English fallbacks. helpers.generic is
  // intentionally empty across languages so a missing context
  // hint renders nothing rather than visible noise.
  'helpers.sms':                  { en: 'Receive reminders by SMS', fr: 'Recevoir les rappels par SMS', sw: 'Pokea vikumbusho kwa SMS', ha: 'Karɓi tunatarwa ta SMS', tw: 'Nya nkae denam SMS so', hi: 'एसएमएस से अनुस्मारक पाएँ' },
  'helpers.reminder':             { en: 'When to send reminders',   fr: 'Quand envoyer les rappels',   sw: 'Wakati wa kutuma vikumbusho', ha: 'Lokacin aika tunatarwa', tw: 'Berɛ a yɛde nkae bɛkɔ', hi: 'अनुस्मारक कब भेजें' },
  'helpers.generic':              { en: '',                fr: '',                      sw: '',                       ha: '',                            tw: '',                        hi: '' },
};

export default T;
