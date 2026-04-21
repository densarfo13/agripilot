/**
 * Voice Guide — Multilingual TTS system for low-literacy farmers, officers, and admins.
 *
 * Uses browser speechSynthesis API. Supports English, French, Swahili, Hausa, Twi.
 * Falls back to English when a translation is missing.
 * Gracefully no-ops when speechSynthesis is unavailable.
 *
 * Voice quality features:
 * - Smart voice selection: prefers natural-sounding voices
 * - Tuned rate (0.85) + pitch (0.9) for warmth and clarity
 * - Pre-recorded audio support with TTS fallback (future-ready)
 *
 * Key structure uses dot-notation (e.g. "onboarding.welcome", "update.success")
 * so prompts can be mapped 1:1 to future recorded audio files.
 */

// ─── Pre-recorded audio support (future-ready) ─────────────────
// Map of promptKey → { lang → audioUrl }. When a recording exists,
// we play it via <audio>. Falls back to TTS if missing or failed.
// To add recordings: place files in /public/audio/{lang}/ and add entries here.

const AUDIO_MAP = {
  // Example: 'onboarding.welcome': { en: '/audio/en/onboarding-welcome.mp3' },
};

let _audioEl = null;

function getAudioElement() {
  if (!_audioEl && typeof Audio !== 'undefined') {
    _audioEl = new Audio();
    _audioEl.preload = 'auto';
  }
  return _audioEl;
}

async function tryPlayAudio(stepKey, lang) {
  const urls = AUDIO_MAP[stepKey];
  if (!urls) return false;
  const url = urls[lang] || urls.en;
  if (!url) return false;
  const audio = getAudioElement();
  if (!audio) return false;
  return new Promise((resolve) => {
    audio.src = url;
    audio.oncanplaythrough = () => {
      audio.play().then(() => resolve(true)).catch(() => resolve(false));
    };
    audio.onerror = () => resolve(false);
    setTimeout(() => resolve(false), 3000);
  });
}

function stopAudio() {
  if (_audioEl) { _audioEl.pause(); _audioEl.currentTime = 0; }
}

// ═══════════════════════════════════════════════════════════════
// VOICE MAP — structured script pack for all screens
// ═══════════════════════════════════════════════════════════════

const VOICE_MAP = {
  // ─── Onboarding ─────────────────────────────────────────────
  'onboarding.welcome': {
    en: "Welcome. Let's set up your farm.",
    fr: 'Bienvenue. Configurons votre ferme.',
    sw: 'Karibu. Tuandae shamba lako.',
    ha: 'Barka da zuwa. Mu shirya gonarka.',
    tw: 'Akwaaba. Ma yɛnhyehyɛ wo kurom.',
  },
  'onboarding.language': {
    en: 'Choose your language.',
    fr: 'Choisissez votre langue.',
    sw: 'Chagua lugha yako.',
    ha: 'Zaɓi harshenka.',
    tw: 'Fa kasa a wopɛ.',
  },
  'onboarding.farmName': {
    en: 'Give your farm a name.',
    fr: 'Donnez un nom à votre ferme.',
    sw: 'Weka jina la shamba lako.',
    ha: 'Ba gonarka suna.',
    tw: 'Ma wo kurom din.',
  },
  'onboarding.country': {
    en: 'Choose your country.',
    fr: 'Choisissez votre pays.',
    sw: 'Chagua nchi yako.',
    ha: 'Zaɓi ƙasarka.',
    tw: 'Fa wo man.',
  },
  'onboarding.crop': {
    en: 'Tap the crop you are growing.',
    fr: 'Choisissez la culture que vous cultivez.',
    sw: 'Chagua zao unalolima.',
    ha: 'Zaɓi amfanin da kake nomawa.',
    tw: 'Fa aduan a woreyɛ.',
  },
  'onboarding.otherCrop': {
    en: 'Type the crop name.',
    fr: 'Entrez le nom de la culture.',
    sw: 'Andika jina la zao.',
    ha: 'Rubuta sunan amfanin gona.',
    tw: 'Kyerɛw aduan no din.',
  },
  'onboarding.landSize': {
    en: 'Enter your farm size.',
    fr: 'Entrez la taille de votre ferme.',
    sw: 'Weka ukubwa wa shamba lako.',
    ha: 'Shigar da girman gonarka.',
    tw: 'Kyerɛ wo kurom kɛse.',
  },
  'onboarding.landUnit': {
    en: 'Choose acre or hectare.',
    fr: 'Choisissez acre ou hectare.',
    sw: 'Chagua ekari au hekta.',
    ha: 'Zaɓi acre ko hectare.',
    tw: 'Fa acre anaa hectare.',
  },
  'onboarding.gender': {
    en: 'Choose your gender.',
    fr: 'Choisissez votre sexe.',
    sw: 'Chagua jinsia yako.',
    ha: 'Zaɓi jinsinka.',
    tw: 'Fa wo bɔbea.',
  },
  'onboarding.ageGroup': {
    en: 'Choose your age group.',
    fr: "Choisissez votre tranche d'âge.",
    sw: 'Chagua kundi lako la umri.',
    ha: 'Zaɓi rukunin shekarunka.',
    tw: 'Fa wo mfe kuw.',
  },
  'onboarding.region': {
    en: 'Choose your region.',
    fr: 'Choisissez votre région.',
    sw: 'Chagua eneo lako.',
    ha: 'Zaɓi yankinka.',
    tw: 'Fa wo mantam.',
  },
  'onboarding.confirmLocation': {
    en: 'We found your location. Tap confirm or change it.',
    fr: 'Nous avons trouvé votre position. Appuyez pour confirmer ou modifier.',
    sw: 'Tumepata eneo lako. Bonyeza kuthibitisha au kubadilisha.',
    ha: 'Mun gano wurinka. Danna ka tabbatar ko ka canza.',
    tw: 'Yɛahu wo beae. Fa pene so anaa sesa no.',
  },
  'onboarding.photoOptional': {
    en: 'You can add your photo now, or skip.',
    fr: 'Vous pouvez ajouter votre photo maintenant ou passer.',
    sw: 'Unaweza kuongeza picha yako sasa au kuruka.',
    ha: 'Za ka iya saka hotonka yanzu ko ka tsallake.',
    tw: 'Wubetumi de wo mfonini aka ho seesei anaasɛ wugyae.',
  },
  'onboarding.processing': {
    en: 'Creating your farm now. Please wait.',
    fr: 'Création de votre ferme en cours. Veuillez patienter.',
    sw: 'Tunaunda shamba lako sasa. Tafadhali subiri.',
    ha: 'Muna kirkiran gonarka yanzu. Da fatan za a jira.',
    tw: 'Yɛreye wo kurom seesei. Meserɛ wo twɛn kakra.',
  },
  'onboarding.success': {
    en: 'Your farm is ready. Tap continue.',
    fr: 'Votre ferme est prête. Appuyez sur continuer.',
    sw: 'Shamba lako liko tayari. Bonyeza kuendelea.',
    ha: 'Gonarka ta shirya. Danna ci gaba.',
    tw: 'Wo kurom ayɛ krado. Kɔ so.',
  },

  // ─── Farmer Home ────────────────────────────────────────────
  'home.welcome': {
    en: 'Welcome back.',
    fr: 'Bon retour.',
    sw: 'Karibu tena.',
    ha: 'Barka da dawowa.',
    tw: 'Akwaaba bio.',
  },
  'home.status.onTrack': {
    en: 'Your farm is on track.',
    fr: 'Votre ferme est sur la bonne voie.',
    sw: 'Shamba lako linaendelea vizuri.',
    ha: 'Gonarka na tafiya da kyau.',
    tw: 'Wo kurom rekɔ yiye.',
  },
  'home.status.needsUpdate': {
    en: 'Your farm needs an update.',
    fr: "Votre ferme a besoin d'une mise à jour.",
    sw: 'Shamba lako linahitaji taarifa mpya.',
    ha: 'Gonarka na bukatar sabuntawa.',
    tw: 'Wo kurom hia nsakrae.',
  },
  'home.primaryAction.addUpdate': {
    en: 'Tap add update.',
    fr: 'Appuyez sur ajouter une mise à jour.',
    sw: 'Bonyeza ongeza taarifa.',
    ha: 'Danna ƙara sabuntawa.',
    tw: 'Fa ka ho nsakrae.',
  },
  'home.nextStep.photo': {
    en: 'Next step. Upload a photo of your farm.',
    fr: 'Étape suivante. Téléchargez une photo de votre ferme.',
    sw: 'Hatua inayofuata. Pakia picha ya shamba lako.',
    ha: 'Mataki na gaba. Loda hoton gonarka.',
    tw: 'Anamɔn a edi hɔ. Fa wo kurom mfonini.',
  },
  'home.nextStep.stage': {
    en: 'Next step. Confirm your crop stage.',
    fr: 'Étape suivante. Confirmez le stade de votre culture.',
    sw: 'Hatua inayofuata. Thibitisha hatua ya zao lako.',
    ha: 'Mataki na gaba. Tabbatar da matakin amfanin gonarka.',
    tw: 'Anamɔn a edi hɔ. Si wo aduan no gyinabea so dua.',
  },
  'home.help': {
    en: 'Tap help if you need support.',
    fr: "Appuyez sur aide si vous avez besoin d'assistance.",
    sw: 'Bonyeza msaada kama unahitaji usaidizi.',
    ha: 'Danna taimako idan kana bukatar tallafi.',
    tw: 'Fa mmoa so sɛ wohia boafo.',
  },

  // ─── Add Update Flow ───────────────────────────────────────
  'update.start': {
    en: "Let's update your farm.",
    fr: 'Mettons votre ferme à jour.',
    sw: 'Tusasishe shamba lako.',
    ha: 'Mu sabunta gonarka.',
    tw: 'Ma yɛn nsesa wo kurom.',
  },
  'update.chooseType': {
    en: 'Choose what you want to update.',
    fr: 'Choisissez ce que vous voulez mettre à jour.',
    sw: 'Chagua unachotaka kusasisha.',
    ha: 'Zaɓi abin da kake son sabuntawa.',
    tw: 'Fa nea wopɛ sɛ wosesa.',
  },
  'update.option.progress': {
    en: 'Tap crop progress.',
    fr: 'Appuyez sur progression de la culture.',
    sw: 'Bonyeza maendeleo ya zao.',
    ha: 'Danna ci gaban amfanin gona.',
    tw: 'Fa aduan no nkɔso.',
  },
  'update.option.photo': {
    en: 'Tap upload photo.',
    fr: 'Appuyez sur télécharger une photo.',
    sw: 'Bonyeza pakia picha.',
    ha: 'Danna loda hoto.',
    tw: 'Fa mfonini so.',
  },
  'update.option.issue': {
    en: 'Tap report problem.',
    fr: 'Appuyez sur signaler un problème.',
    sw: 'Bonyeza ripoti tatizo.',
    ha: 'Danna kai rahoton matsala.',
    tw: 'Fa ka ho amanehunu.',
  },
  'update.takePhoto': {
    en: 'Take a photo of your farm.',
    fr: 'Prenez une photo de votre ferme.',
    sw: 'Piga picha ya shamba lako.',
    ha: 'Ɗauki hoton gonarka.',
    tw: 'Fa wo kurom mfonini.',
  },
  'update.uploadPhoto': {
    en: 'Upload a photo from your phone.',
    fr: 'Téléchargez une photo depuis votre téléphone.',
    sw: 'Pakia picha kutoka kwenye simu yako.',
    ha: 'Loda hoto daga wayarka.',
    tw: 'Fa mfonini fi wo telefon mu.',
  },
  'update.chooseStage': {
    en: 'Choose your crop stage.',
    fr: 'Choisissez le stade de votre culture.',
    sw: 'Chagua hatua ya zao lako.',
    ha: 'Zaɓi matakin amfanin gonarka.',
    tw: 'Fa wo aduan no gyinabea.',
  },
  'update.condition': {
    en: 'How is your farm today?',
    fr: "Comment va votre ferme aujourd'hui ?",
    sw: 'Shamba lako likoje leo?',
    ha: 'Yaya gonarka take yau?',
    tw: 'Ɛte sɛn wɔ wo kurom nnɛ?',
  },
  'update.problemNote': {
    en: 'You can add a short note.',
    fr: 'Vous pouvez ajouter une courte note.',
    sw: 'Unaweza kuongeza maelezo mafupi.',
    ha: 'Za ka iya ƙara gajeren bayani.',
    tw: 'Wubetumi de asɛm tiawa aka ho.',
  },
  'update.submit': {
    en: 'Tap send update.',
    fr: "Appuyez sur envoyer la mise à jour.",
    sw: 'Bonyeza tuma taarifa.',
    ha: 'Danna aika sabuntawa.',
    tw: 'Fa soma nsakrae no.',
  },
  'update.success': {
    en: 'Your update was sent.',
    fr: 'Votre mise à jour a été envoyée.',
    sw: 'Taarifa yako imetumwa.',
    ha: 'An aika sabuntawarka.',
    tw: 'Wɔde wo nsakrae akɔ.',
  },
  'update.pendingValidation': {
    en: 'Your update is waiting for review.',
    fr: 'Votre mise à jour attend une vérification.',
    sw: 'Taarifa yako inasubiri kuhakikiwa.',
    ha: 'Sabuntawarka na jiran dubawa.',
    tw: 'Wo nsakrae no retwɛn nhwehwɛmu.',
  },
  'update.savedOffline': {
    en: 'Saved offline. It will send when the network returns.',
    fr: "Enregistré hors ligne. L'envoi se fera quand le réseau reviendra.",
    sw: 'Imehifadhiwa nje ya mtandao. Itatumwa mtandao ukirudi.',
    ha: 'An adana ba tare da intanet ba. Za a aika idan network ya dawo.',
    tw: 'Wɔakora so a wonni intanɛt so. Wɔbɛsoma bere a network aba bio.',
  },
  'update.failed': {
    en: 'Update failed. Tap retry.',
    fr: 'Échec de la mise à jour. Appuyez pour réessayer.',
    sw: 'Kutuma taarifa kumeshindikana. Bonyeza ujaribu tena.',
    ha: 'Sabuntawa ya kasa. Danna sake gwadawa.',
    tw: 'Nsakrae no anni yie. Fa so bio.',
  },

  // ─── Officer Validation ────────────────────────────────────
  'officer.queue': {
    en: 'New updates are ready for review.',
    fr: 'De nouvelles mises à jour sont prêtes à être vérifiées.',
    sw: 'Taarifa mpya ziko tayari kuhakikiwa.',
    ha: 'Sabbin sabuntawa suna shirye don dubawa.',
    tw: 'Nsakrae foforo wɔ hɔ sɛ wubetumi ahwehwɛ.',
  },
  'officer.openItem': {
    en: 'Check this farm update.',
    fr: 'Vérifiez cette mise à jour.',
    sw: 'Angalia taarifa hii ya shamba.',
    ha: 'Duba wannan sabuntawar gonar.',
    tw: 'Hwɛ wo kurom nsakrae yi.',
  },
  'officer.imageFocus': {
    en: 'Look at the photo and decide.',
    fr: 'Regardez la photo et décidez.',
    sw: 'Angalia picha na uamue.',
    ha: 'Duba hoton ka yanke shawara.',
    tw: 'Hwɛ mfonini no na si gyinae.',
  },
  'officer.approve': {
    en: 'Tap approve to confirm.',
    fr: 'Appuyez pour approuver.',
    sw: 'Bonyeza kuthibitisha.',
    ha: 'Danna amincewa.',
    tw: 'Fa pene so.',
  },
  'officer.reject': {
    en: 'Tap reject if this is not correct.',
    fr: "Appuyez pour rejeter si ce n'est pas correct.",
    sw: 'Bonyeza kukataa kama si sahihi.',
    ha: 'Danna ƙi idan ba daidai ba.',
    tw: 'Fa gye ntom sɛ ɛnyɛ nokware.',
  },
  'officer.flag': {
    en: 'Tap flag for issues.',
    fr: 'Appuyez pour signaler un problème.',
    sw: 'Bonyeza kuripoti tatizo.',
    ha: 'Danna don nuna matsala.',
    tw: 'Fa kyerɛ sɛ asɛm wɔ hɔ.',
  },
  'officer.next': {
    en: 'Moving to next update.',
    fr: 'Passage à la mise à jour suivante.',
    sw: 'Inaenda kwenye taarifa inayofuata.',
    ha: 'Ana matsawa zuwa sabuntawa na gaba.',
    tw: 'Rekɔ nsakrae a edi hɔ.',
  },
  'officer.empty': {
    en: 'No updates left to review.',
    fr: 'Aucune mise à jour à vérifier.',
    sw: 'Hakuna taarifa zilizobaki.',
    ha: 'Babu sauran sabuntawa.',
    tw: 'Nsakrae biara nka.',
  },

  // ─── Admin Dashboard ──────────────────────────────────────
  'admin.overview': {
    en: 'Here is your program overview.',
    fr: 'Voici un aperçu de votre programme.',
    sw: 'Huu ni muhtasari wa programu yako.',
    ha: 'Ga bayanin shirin ka.',
    tw: 'Wo nhyehyɛe no mu nsɛm ni.',
  },
  'admin.needsAttention': {
    en: 'Some farmers need attention.',
    fr: 'Certains agriculteurs nécessitent une attention.',
    sw: 'Baadhi ya wakulima wanahitaji uangalizi.',
    ha: 'Wasu manoma suna bukatar kulawa.',
    tw: 'Akuafoɔ bi hia nhwɛsoɔ.',
  },
  'admin.openIssues': {
    en: 'Tap to fix issues.',
    fr: 'Appuyez pour corriger les problèmes.',
    sw: 'Bonyeza kurekebisha matatizo.',
    ha: 'Danna don gyara matsaloli.',
    tw: 'Fa na siesie nsɛm no.',
  },
  'admin.invite': {
    en: 'Invite new farmers here.',
    fr: 'Invitez de nouveaux agriculteurs ici.',
    sw: 'Alika wakulima wapya hapa.',
    ha: 'Gayyaci sabbin manoma nan.',
    tw: 'Frɛ akuafoɔ foforo wɔ ha.',
  },
  'admin.assign': {
    en: 'Assign officers to farmers.',
    fr: 'Assignez des agents aux agriculteurs.',
    sw: 'Wape maafisa wakulima.',
    ha: "Sanya jami'ai ga manoma.",
    tw: 'Ma akuafoɔ no nkɔma wɔn a wɔhwɛ wɔn.',
  },
  'admin.report': {
    en: 'Download your report.',
    fr: 'Téléchargez votre rapport.',
    sw: 'Pakua ripoti yako.',
    ha: 'Sauke rahoton ka.',
    tw: 'Twe wo report no.',
  },

  // ─── Pest Risk Check ─────────────────────────────────────────
  'pest.start': {
    en: 'Let us check your crops for problems.',
    fr: 'Vérifions vos cultures pour détecter des problèmes.',
    sw: 'Tuangalie mazao yako kwa matatizo.',
    ha: 'Mu bincika amfanin gonarka don matsaloli.',
    tw: 'Ma yɛnhwɛ wo nnɔbae mu hɔ sɛ asɛm bi wɔ hɔ.',
  },
  'pest.chooseCrop': {
    en: 'Tap your crop and growth stage.',
    fr: 'Choisissez votre culture et le stade de croissance.',
    sw: 'Chagua zao lako na hatua ya ukuaji.',
    ha: 'Zaɓi amfanin gonarka da matakin girma.',
    tw: 'Fa wo aduan ne nkɔso gyinabea.',
  },
  'pest.takePhotos': {
    en: 'Take three photos. A leaf close-up, the whole plant, and a wide field view.',
    fr: 'Prenez trois photos. Un gros plan de feuille, la plante entière, et une vue large du champ.',
    sw: 'Piga picha tatu. Picha ya karibu ya jani, mmea mzima, na mtazamo mpana wa shamba.',
    ha: 'Ɗauki hotuna uku. Hoton ganyen da ke kusa, dukan tsiro, da fadin gonar.',
    tw: 'Fa mfonini mmiɛnsa. Nhahan mu mfonini, dua no nyinaa, ne afuw no mu mfonini tɛtrɛtɛ.',
  },
  'pest.photoRetake': {
    en: 'This photo was not clear. Please take it again.',
    fr: 'Cette photo n\'est pas nette. Veuillez la reprendre.',
    sw: 'Picha hii haikuwa wazi. Tafadhali piga tena.',
    ha: 'Wannan hoton bai bayyana ba. Da fatan za a sake ɗauka.',
    tw: 'Saa mfonini yi mu nna hɔ. Meserɛ wo fa bio.',
  },
  'pest.answerQuestions': {
    en: 'Answer these questions about your crops. Tap yes, no, or unsure.',
    fr: 'Répondez à ces questions sur vos cultures. Appuyez oui, non, ou pas sûr.',
    sw: 'Jibu maswali haya kuhusu mazao yako. Bonyeza ndiyo, hapana, au sina uhakika.',
    ha: 'Amsa waɗannan tambayoyi game da amfanin gonarka. Danna eh, a\'a, ko ban tabbata ba.',
    tw: 'Bua nsɛmmisa yi fa wo nnɔbae ho. Fa aane, dabi, anaa mennim.',
  },
  'pest.submit': {
    en: 'Tap submit to send your pest report.',
    fr: 'Appuyez sur envoyer pour soumettre votre rapport.',
    sw: 'Bonyeza tuma kutuma ripoti yako ya wadudu.',
    ha: 'Danna aika don tura rahoton ƙwari.',
    tw: 'Fa soma de bɛma wo mmoa ho amanneɛ akɔ.',
  },
  'pest.submitting': {
    en: 'Sending your report now. Please wait.',
    fr: 'Envoi de votre rapport en cours. Veuillez patienter.',
    sw: 'Inatuma ripoti yako sasa. Tafadhali subiri.',
    ha: 'Ana tura rahotonka yanzu. Da fatan za a jira.',
    tw: 'Wɔresoma wo amanneɛ no seesei. Meserɛ wo twɛn kakra.',
  },

  // ─── Pest Risk Result ────────────────────────────────────────
  'pest.result': {
    en: 'Here is what we found on your farm.',
    fr: 'Voici ce que nous avons trouvé sur votre ferme.',
    sw: 'Hiki ndicho tulichopata kwenye shamba lako.',
    ha: 'Ga abin da muka gano a gonarka.',
    tw: 'Nea yɛhuu wɔ wo kurom no ni.',
  },
  'pest.result.low': {
    en: 'Your crops look healthy. Keep monitoring.',
    fr: 'Vos cultures semblent saines. Continuez à surveiller.',
    sw: 'Mazao yako yanaonekana mazuri. Endelea kufuatilia.',
    ha: 'Amfanin gonarka suna da kyau. Ci gaba da lura.',
    tw: 'Wo nnɔbae no yɛ pa. Kɔ so hwɛ so.',
  },
  'pest.result.high': {
    en: 'We found a problem. Follow the treatment advice below.',
    fr: 'Nous avons trouvé un problème. Suivez les conseils de traitement ci-dessous.',
    sw: 'Tumepata tatizo. Fuata ushauri wa matibabu hapo chini.',
    ha: 'Mun sami matsala. Bi shawarar magani da ke ƙasa.',
    tw: 'Yɛahu asɛm bi. Di ayaresa no afotu a ɛwɔ aseɛ no so.',
  },
  'pest.result.uncertain': {
    en: 'We are not sure yet. Please send more photos or wait for a field officer visit.',
    fr: 'Nous ne sommes pas encore sûrs. Envoyez plus de photos ou attendez la visite d\'un agent.',
    sw: 'Hatuna uhakika bado. Tafadhali tuma picha zaidi au subiri ziara ya afisa.',
    ha: 'Ba mu da tabbas ba tukuna. Tura ƙarin hotuna ko ka jira ziyarar jami\'i.',
    tw: 'Yɛnnim pɛpɛɛpɛ da. Meserɛ wo fa mfonini foforo anaa twɛn ɔfesɛ no.',
  },

  // ─── Land Boundary Capture ───────────────────────────────────
  'boundary.start': {
    en: 'Let us map your farm boundary.',
    fr: 'Cartographions les limites de votre ferme.',
    sw: 'Tuandae mpaka wa shamba lako.',
    ha: 'Mu zana iyakar gonarka.',
    tw: 'Ma yɛnhyɛ wo kurom ahyeɛ no aseɛ.',
  },
  'boundary.chooseMethod': {
    en: 'Choose GPS walk to trace your farm, or place points on the map.',
    fr: 'Choisissez la marche GPS pour tracer votre ferme, ou placez des points sur la carte.',
    sw: 'Chagua kutembea kwa GPS kutambua shamba lako, au weka alama kwenye ramani.',
    ha: 'Zaɓi tafiya da GPS don bin iyakar gonarka, ko sanya maki a taswira.',
    tw: 'Fa GPS nantew de bɛhyɛ wo kurom aseɛ, anaa fa tɔnk wo map no so.',
  },
  'boundary.walking': {
    en: 'Walk around your farm boundary now. We are recording your path.',
    fr: 'Faites le tour de votre ferme maintenant. Nous enregistrons votre chemin.',
    sw: 'Tembea kuzunguka mpaka wa shamba lako sasa. Tunarekodi njia yako.',
    ha: 'Yi tafiya a gefen gonarka yanzu. Muna yin rikodin hanyarka.',
    tw: 'Nante fa wo kurom ahyeɛ no ho seesei. Yɛrekyerɛw wo kwan no.',
  },
  'boundary.addPoint': {
    en: 'Tap to add a point. You need at least three points.',
    fr: 'Appuyez pour ajouter un point. Il faut au moins trois points.',
    sw: 'Bonyeza kuongeza alama. Unahitaji angalau alama tatu.',
    ha: 'Danna don ƙara maki. Kuna bukata aƙalla maki uku.',
    tw: 'Fa pene so de bɛka tɔnk bi ho. Wohia tɔnk mmiɛnsa pɛ.',
  },
  'boundary.saved': {
    en: 'Your farm boundary has been saved.',
    fr: 'Les limites de votre ferme ont été enregistrées.',
    sw: 'Mpaka wa shamba lako umehifadhiwa.',
    ha: 'An adana iyakar gonarka.',
    tw: 'Wɔakora wo kurom ahyeɛ no.',
  },
  'boundary.warning': {
    en: 'The boundary has a problem. Please check and try again.',
    fr: 'La limite a un problème. Veuillez vérifier et réessayer.',
    sw: 'Mpaka una tatizo. Tafadhali angalia na ujaribu tena.',
    ha: 'Iyakar tana da matsala. Da fatan za a duba ka sake gwadawa.',
    tw: 'Ahyeɛ no wɔ asɛm bi. Meserɛ wo hwɛ na bɔ mmɔden bio.',
  },

  // ─── Progress / Harvest ──────────────────────────────────────
  'progress.start': {
    en: 'Update your crop progress.',
    fr: 'Mettez à jour la progression de votre culture.',
    sw: 'Sasisha maendeleo ya zao lako.',
    ha: 'Sabunta ci gaban amfanin gonarka.',
    tw: 'Sesa wo aduan nkɔso.',
  },
  'progress.chooseStage': {
    en: 'Tap your current crop stage.',
    fr: 'Appuyez sur le stade actuel de votre culture.',
    sw: 'Bonyeza hatua ya sasa ya zao lako.',
    ha: 'Danna matakin amfanin gonarka na yanzu.',
    tw: 'Fa wo aduan gyinabea a ɛwɔ seesei.',
  },
  'progress.condition': {
    en: 'How is your crop doing? Tap good, average, or poor.',
    fr: 'Comment va votre culture ? Appuyez bon, moyen ou mauvais.',
    sw: 'Zao lako likoje? Bonyeza nzuri, wastani, au mbaya.',
    ha: 'Yaya amfanin gonarka? Danna mai kyau, matsakaici, ko mara kyau.',
    tw: 'Ɛte sɛn wo aduan no te? Fa eye, ɛyɛ kakra, anaa ɛnyɛ.',
  },
  'progress.harvest': {
    en: 'Record your harvest details.',
    fr: 'Enregistrez les détails de votre récolte.',
    sw: 'Rekodi maelezo ya mavuno yako.',
    ha: 'Yi rikodin cikakken bayanin girbin ka.',
    tw: 'Kyerɛw wo twabere no mu nsɛm.',
  },
  'progress.saved': {
    en: 'Your crop progress has been saved.',
    fr: 'La progression de votre culture a été enregistrée.',
    sw: 'Maendeleo ya zao lako yamehifadhiwa.',
    ha: 'An adana ci gaban amfanin gonarka.',
    tw: 'Wɔakora wo aduan nkɔso no.',
  },

  // ─── Treatment Feedback ──────────────────────────────────────
  'treatment.start': {
    en: 'Tell us how the treatment went.',
    fr: 'Dites-nous comment le traitement s\'est passé.',
    sw: 'Tuambie matibabu yalikuwaje.',
    ha: 'Gaya mana yadda maganin ya tafi.',
    tw: 'Ka kyerɛ yɛn sɛnea ayaresa no kɔeɛ.',
  },
  'treatment.chooseType': {
    en: 'What treatment did you use? Tap to choose.',
    fr: 'Quel traitement avez-vous utilisé ? Appuyez pour choisir.',
    sw: 'Ulitumia matibabu gani? Bonyeza kuchagua.',
    ha: 'Wane magani ka yi amfani da shi? Danna don zaɓa.',
    tw: 'Ayaresa bɛn na wode diiɛ? Fa pene so de bɛfa.',
  },
  'treatment.outcome': {
    en: 'How did it work? Tap resolved, improved, same, or worse.',
    fr: 'Comment ça a marché ? Appuyez résolu, amélioré, pareil, ou pire.',
    sw: 'Ilifanyaje kazi? Bonyeza imetatuliwa, imeboreshwa, sawa, au mbaya zaidi.',
    ha: 'Yaya ya yi aiki? Danna an warware, ya inganta, iri ɗaya, ko ya tsananta.',
    tw: 'Ɛyɛɛ dɛn? Fa ewie, ɛyɛɛ yie, ɛyɛ saa ara, anaa ɛyɛɛ bɔne.',
  },
  'treatment.saved': {
    en: 'Your treatment feedback has been saved. Thank you.',
    fr: 'Votre retour sur le traitement a été enregistré. Merci.',
    sw: 'Maoni yako ya matibabu yamehifadhiwa. Asante.',
    ha: 'An adana ra\'ayin ka game da maganin. Na gode.',
    tw: 'Wɔakora wo ayaresa ho nsɛm. Meda wo ase.',
  },

  // ─── Seed Scan ───────────────────────────────────────────────
  'seedScan.start': {
    en: 'Let us check your seeds.',
    fr: 'Vérifions vos semences.',
    sw: 'Tuangalie mbegu zako.',
    ha: 'Mu bincika iririnku.',
    tw: 'Ma yɛnhwɛ wo aba no.',
  },
  'seedScan.takePhoto': {
    en: 'Take a photo of the seed packet label.',
    fr: 'Prenez une photo de l\'étiquette du paquet de semences.',
    sw: 'Piga picha ya lebo ya pakiti ya mbegu.',
    ha: 'Ɗauki hoton lakabi a fakitin iri.',
    tw: 'Fa aba no pakɛt nhyɛsoɔ no mfonini.',
  },
  'seedScan.result': {
    en: 'Here is what we found about your seeds.',
    fr: 'Voici ce que nous avons trouvé sur vos semences.',
    sw: 'Hiki ndicho tulichopata kuhusu mbegu zako.',
    ha: 'Ga abin da muka gano game da iririnku.',
    tw: 'Nea yɛhuu fa wo aba no ho ni.',
  },

  // ─── Error / Offline States ──────────────────────────────────
  'error.general': {
    en: 'Something went wrong. Please try again.',
    fr: 'Quelque chose s\'est mal passé. Veuillez réessayer.',
    sw: 'Kuna tatizo limetokea. Tafadhali jaribu tena.',
    ha: 'Wani abu ya faru. Da fatan za a sake gwadawa.',
    tw: 'Biribi akɔ basaa. Meserɛ wo bɔ mmɔden bio.',
  },
  'error.offline': {
    en: 'You are offline. Your data is saved and will send when the network returns.',
    fr: 'Vous êtes hors ligne. Vos données sont enregistrées et seront envoyées quand le réseau reviendra.',
    sw: 'Huna mtandao. Data yako imehifadhiwa na itatumwa mtandao ukirudi.',
    ha: 'Ba ka da intanet. An adana bayananku kuma za a aika idan network ya dawo.',
    tw: 'Wonni intanɛt. Wɔakora wo data na wɔbɛsoma bere a network aba bio.',
  },
  'error.retry': {
    en: 'That did not work. Tap retry to try again.',
    fr: 'Cela n\'a pas fonctionné. Appuyez réessayer.',
    sw: 'Haijafanya kazi. Bonyeza jaribu tena.',
    ha: 'Bai yi aiki ba. Danna sake gwadawa.',
    tw: 'Ɛanyɛ adwuma. Fa so bio.',
  },

  // ─── Profile Setup ───────────────────────────────────────────
  'setup.welcome': {
    en: 'Let us set up your profile.',
    fr: 'Configurons votre profil.',
    sw: 'Tuandae wasifu wako.',
    ha: 'Mu shirya bayananku.',
    tw: 'Ma yɛnhyehyɛ wo ho nsɛm.',
  },
  'setup.saved': {
    en: 'Your profile has been saved.',
    fr: 'Votre profil a été enregistré.',
    sw: 'Wasifu wako umehifadhiwa.',
    ha: 'An adana bayananku.',
    tw: 'Wɔakora wo ho nsɛm.',
  },
};

// ─── BCP-47 language tags ───────────────────────────────────────
const LANG_TAGS = {
  en: 'en',
  fr: 'fr',
  sw: 'sw',
  ha: 'ha',
  tw: 'ak', // Twi → Akan
};

// ─── Voice quality settings ─────────────────────────────────────
const VOICE_RATE = 0.85;
const VOICE_PITCH = 0.9;
const VOICE_VOLUME = 1.0;

// ─── Smart voice selection ──────────────────────────────────────

const PREFERRED_VOICE_PATTERNS = [
  /google.*natural/i,
  /google.*wavenet/i,
  /google.*neural/i,
  /samantha/i,
  /daniel/i,
  /thomas/i,
  /amelie/i,
  /neural/i,
  /online.*natural/i,
  /microsoft.*online/i,
  /enhanced/i,
  /premium/i,
  /natural/i,
  /hd$/i,
];

let _voiceCache = new Map();
let _voiceListVersion = 0;

function scoreVoice(voice) {
  let score = 0;
  const name = voice.name || '';
  if (voice.localService) score += 5;
  for (let i = 0; i < PREFERRED_VOICE_PATTERNS.length; i++) {
    if (PREFERRED_VOICE_PATTERNS[i].test(name)) { score += 20 - i; break; }
  }
  if (/compact/i.test(name)) score -= 10;
  if (/espeak/i.test(name)) score -= 15;
  return score;
}

function selectBestVoice(langTag) {
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const version = voices.length;
  if (version !== _voiceListVersion) { _voiceCache = new Map(); _voiceListVersion = version; }
  if (_voiceCache.has(langTag)) return _voiceCache.get(langTag);
  const langVoices = voices.filter(v => v.lang.startsWith(langTag));
  let best = null;
  if (langVoices.length > 0) {
    best = langVoices.reduce((a, b) => scoreVoice(b) > scoreVoice(a) ? b : a);
  } else {
    const enVoices = voices.filter(v => v.lang.startsWith('en'));
    if (enVoices.length > 0) best = enVoices.reduce((a, b) => scoreVoice(b) > scoreVoice(a) ? b : a);
  }
  if (best) _voiceCache.set(langTag, best);
  return best;
}

// ─── Availability check ─────────────────────────────────────────

export function isVoiceAvailable() {
  return typeof window !== 'undefined' && (
    'speechSynthesis' in window || typeof Audio !== 'undefined'
  );
}

// ─── Voice Service integration ──────────────────────────────────
// All playback now routes through voiceService.js for the 3-tier
// fallback: prerecorded clip → provider TTS → browser TTS.

import voiceService from '../services/voiceService.js';
import { isAdminContext } from '../lib/voice/adminGuard.js';

// ─── Stop any current speech ────────────────────────────────────

export function stopSpeech() {
  // Admin context: nothing to stop — we never start in admin.
  if (isAdminContext()) return;
  voiceService.stop();
}

// Aliases matching the spec utility names
export const stopVoicePrompt = stopSpeech;
export const canUseTTS = isVoiceAvailable;

// ─── Main speak function ────────────────────────────────────────

/**
 * Speak the prompt for a given voice key.
 *
 * Routes through voiceService for 3-tier fallback:
 *   1. Prerecorded clip (if prompt maps to a voicePrompts entry)
 *   2. Provider TTS (neural, server-side — en, fr, sw)
 *   3. Browser speechSynthesis (last resort)
 *
 * @param {string} stepKey  — dot-notation key (e.g. 'onboarding.welcome')
 * @param {string} lang     — 'en', 'fr', 'sw', 'ha', 'tw'
 * @returns {boolean} true if speech was initiated
 */
export function speak(stepKey, lang = 'en') {
  // Voice is OFF on admin surfaces. Returning false here means
  // callers that check the boolean get a clean "did not speak"
  // answer, and no AudioContext / SpeechSynthesisUtterance is
  // constructed downstream.
  if (isAdminContext()) return false;
  if (!isVoiceAvailable()) return false;
  const stepTexts = VOICE_MAP[stepKey];
  if (!stepTexts) return false;
  const text = stepTexts[lang] || stepTexts.en;
  if (!text) return false;

  // Route through voiceService — it handles prerecorded → provider → browser fallback
  return voiceService.speakVoiceMapKey(stepKey, lang, stepTexts);
}

// Alias matching the spec utility name
export const speakVoicePrompt = speak;

// ─── Pre-warm voice list + provider status ──────────────────────
voiceService.warmup();

// ─── Supported languages ────────────────────────────────────────

export const VOICE_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'sw', label: 'Kiswahili' },
  { code: 'ha', label: 'Hausa' },
  { code: 'tw', label: 'Twi' },
];

// ─── Exports for testing / advanced usage ───────────────────────
export { VOICE_MAP, AUDIO_MAP, VOICE_RATE, VOICE_PITCH };

export default { speak, stopSpeech, isVoiceAvailable, speakVoicePrompt, stopVoicePrompt, canUseTTS, VOICE_LANGUAGES };
