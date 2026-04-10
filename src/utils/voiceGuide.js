/**
 * Voice Guide — TTS utility for low-literacy farmers
 *
 * Uses browser speechSynthesis API. Supports English, French, Swahili, Hausa, Twi.
 * Falls back to English when a translation is missing.
 * Gracefully no-ops when speechSynthesis is unavailable.
 *
 * Covers: Onboarding wizard, Farmer Home, Add Update flow.
 */

// ─── Voice map: keyed by step, then language ────────────────────
// Each value is the spoken prompt for that screen.

const VOICE_MAP = {
  welcome: {
    en: 'Welcome! Let us set up your farm. It takes about one minute. Tap Get Started to begin.',
    fr: 'Bienvenue ! Configurons votre ferme. Cela prend environ une minute. Appuyez sur Commencer.',
    sw: 'Karibu! Hebu tuanzishe shamba lako. Inachukua dakika moja tu. Bonyeza Anza.',
    ha: 'Barka da zuwa! Mu saita gonarku. Zai dauki minti daya. Danna Fara.',
    tw: 'Akwaaba! Ma yen set wo afuo. Ebeye simma biara. Mia Get Started.',
  },
  farmName: {
    en: 'What do you call your farm? Type a name for your farm, then tap Next.',
    fr: 'Comment appelez-vous votre ferme ? Tapez un nom, puis appuyez sur Suivant.',
    sw: 'Shamba lako linaitwaje? Andika jina la shamba lako, kisha bonyeza Endelea.',
    ha: 'Menene sunan gonarku? Rubuta sunan gona, sannan ku danna Gaba.',
    tw: 'Deen na wofre wo afuo? Hyehye din bi ma wo afuo, na mia Next.',
  },
  country: {
    en: 'Where are you farming? Search or scroll to find your country, then tap Next.',
    fr: 'Ou cultivez-vous ? Cherchez ou faites defiler pour trouver votre pays, puis Suivant.',
    sw: 'Unalima wapi? Tafuta au sogeza kupata nchi yako, kisha bonyeza Endelea.',
    ha: 'Ina kuke noma? Nema ko juya don nemo kasarku, sannan ku danna Gaba.',
    tw: 'Woyoo he? Hwehwe wo man, na mia Next.',
  },
  crop: {
    en: 'What do you grow? Tap your main crop. You can also search for more crops.',
    fr: 'Que cultivez-vous ? Appuyez sur votre culture principale. Vous pouvez aussi chercher.',
    sw: 'Unalima nini? Bonyeza zao lako kuu. Unaweza pia kutafuta mazao zaidi.',
    ha: 'Menene kuke nomawa? Danna amfanin gonarku. Kuna iya neman karin amfanin gona.',
    tw: 'Deen na wudua? Mia wo nnoba titiriw. Wubetumi ahwehwe nnoba foforo.',
  },
  farmSize: {
    en: 'How big is your farm? Choose your unit, then tap a size or enter the exact number.',
    fr: 'Quelle est la taille de votre ferme ? Choisissez une unite, puis tapez la taille.',
    sw: 'Shamba lako lina ukubwa gani? Chagua kipimo, kisha bonyeza ukubwa au andika nambari.',
    ha: 'Gonarku ta girma nawa? Zabi ma aunin, sannan danna girma ko rubuta adadi.',
    tw: 'Wo afuo so kese sen? Yi wo unit, na mia size anaa hyehye noma no.',
  },
  gender: {
    en: 'Tell us about yourself. Tap your gender, or skip if you prefer.',
    fr: 'Parlez-nous de vous. Appuyez sur votre genre, ou passez si vous preferez.',
    sw: 'Tuambie kuhusu wewe. Bonyeza jinsia yako, au ruka ukipenda.',
    ha: 'Gaya mana game da kanku. Danna jinsinku, ko ku tsallake.',
    tw: 'Ka wo ho asem kyere yen. Mia wo gender, anaase mia Skip.',
  },
  age: {
    en: 'What is your age group? Tap your age range, or skip.',
    fr: 'Quel est votre groupe d\'age ? Appuyez sur votre tranche d\'age, ou passez.',
    sw: 'Kundi lako la umri ni lipi? Bonyeza kiwango cha umri wako, au ruka.',
    ha: 'Menene rukunin shekarunka? Danna shekarunka, ko ku tsallake.',
    tw: 'Wo mfe mu kuw yen? Mia wo mfe kuw, anaase mia Skip.',
  },
  location: {
    en: 'Where is your farm? Tap detect my location, or type the name of your area.',
    fr: 'Ou se trouve votre ferme ? Appuyez sur detecter, ou tapez le nom de votre zone.',
    sw: 'Shamba lako liko wapi? Bonyeza kutambua eneo langu, au andika jina la eneo lako.',
    ha: 'Ina gonarku take? Danna gano wurina, ko rubuta sunan yankinku.',
    tw: 'Wo afuo wo he? Mia detect my location, anaase hyehye wo beae din.',
  },
  photo: {
    en: 'Almost done! You can take a profile photo, or skip and create your farm now.',
    fr: 'Presque fini ! Prenez une photo de profil, ou passez et creez votre ferme.',
    sw: 'Karibu kumaliza! Unaweza kupiga picha, au ruka na uunde shamba lako sasa.',
    ha: 'Kusan an gama! Kuna dauki hoton kai, ko ku tsallake ku kirkiri gonarku.',
    tw: 'Aye awie! Wobetumi afa foto, anaase mia Skip na create wo afuo.',
  },
  processing: {
    en: 'We are creating your farm. Please wait a moment.',
    fr: 'Nous creons votre ferme. Veuillez patienter un instant.',
    sw: 'Tunaunda shamba lako. Tafadhali subiri kidogo.',
    ha: 'Muna kirkiran gonarku. Da fatan za a jira kadan.',
    tw: 'Yereye wo afuo. Mesrewoo kakra.',
  },

  // ─── Farmer Home ───────────────────────────────────────────
  home_welcome: {
    en: 'Welcome to your farm. You can see your crop status and weather here. Tap the green button to add an update.',
    fr: 'Bienvenue sur votre ferme. Vous pouvez voir votre culture et la meteo ici. Appuyez sur le bouton vert pour ajouter une mise a jour.',
    sw: 'Karibu kwenye shamba lako. Unaweza kuona hali ya mazao na hali ya hewa hapa. Bonyeza kitufe kijani kuongeza taarifa.',
    ha: 'Barka da zuwa gonarku. Kuna iya ganin halin amfanin gona da yanayi anan. Danna maballin kore don kara sabuntawa.',
    tw: 'Akwaaba wo afuo. Wubetumi ahu wo nnoba ne wim tenten ha. Mia button ahabanbere no de beka nkyerease.',
  },
  home_status: {
    en: 'This shows your crop and current stage. Check it often to stay on track.',
    fr: 'Ceci montre votre culture et son stade actuel. Verifiez souvent pour rester sur la bonne voie.',
    sw: 'Hii inaonyesha mazao yako na hatua ya sasa. Angalia mara kwa mara ili kuendelea vizuri.',
    ha: 'Wannan yana nuna amfanin gonarku da matakin yanzu. Ku duba sau da yawa don ku ci gaba.',
    tw: 'Eyi kyere wo nnoba ne n\'aberease a ewo mu. Hwehwe mu mpem mpem.',
  },
  home_action: {
    en: 'Tap the big green button to log your latest farm activity.',
    fr: 'Appuyez sur le grand bouton vert pour enregistrer votre derniere activite.',
    sw: 'Bonyeza kitufe kikubwa kijani kurekodi shughuli yako ya hivi karibuni.',
    ha: 'Danna babban maballin kore don rubuta aikin gonarku na baya-bayan nan.',
    tw: 'Mia button kese ahabanbere no de kyerew wo adwumayede foforo.',
  },
  home_next_step: {
    en: 'Follow the suggestion below the button. It tells you what to do next.',
    fr: 'Suivez la suggestion sous le bouton. Elle vous dit quoi faire ensuite.',
    sw: 'Fuata pendekezo chini ya kitufe. Inakuambia la kufanya baadaye.',
    ha: 'Bi shawarar da ke kasan maballin. Tana fadan muku abin da za ku yi na gaba.',
    tw: 'Di afotu a ewo button no ase. Eka wo nea wobegye adi.',
  },
  home_help: {
    en: 'Need help? Tap the blue question mark button at the bottom of the screen.',
    fr: 'Besoin d\'aide ? Appuyez sur le bouton bleu avec un point d\'interrogation en bas de l\'ecran.',
    sw: 'Unahitaji msaada? Bonyeza kitufe cha buluu chenye alama ya kuuliza chini ya skrini.',
    ha: 'Kuna bukatar taimako? Danna maballin shudin tambaya a kasan allon.',
    tw: 'Wohia mmoa? Mia button blue asemmisa no wo screen no ase.',
  },

  // ─── Add Update Flow ──────────────────────────────────────
  update_start: {
    en: 'What do you want to do? Tap Crop Progress, Upload Photo, or Report Issue.',
    fr: 'Que voulez-vous faire ? Appuyez sur Progres, Photo, ou Signaler un probleme.',
    sw: 'Unataka kufanya nini? Bonyeza Maendeleo ya Mazao, Pakia Picha, au Ripoti Tatizo.',
    ha: 'Menene kuke so ku yi? Danna Ci gaban amfanin gona, Dora Hoto, ko Rahoto Matsala.',
    tw: 'Deen na wope se woye? Mia Crop Progress, Upload Photo, anaa Report Issue.',
  },
  update_choose_type: {
    en: 'Choose what kind of update you want to share.',
    fr: 'Choisissez le type de mise a jour que vous souhaitez partager.',
    sw: 'Chagua aina ya taarifa unayotaka kushiriki.',
    ha: 'Zabi irin sabuntawar da kuke so ku raba.',
    tw: 'Yi nkyerease no mu ade a wope se wode bema.',
  },
  update_stage: {
    en: 'What stage is your crop? Tap Planting, Growing, Flowering, or Harvesting.',
    fr: 'A quel stade est votre culture ? Appuyez sur Plantation, Croissance, Floraison, ou Recolte.',
    sw: 'Mazao yako yako katika hatua gani? Bonyeza Kupanda, Kukua, Kuchanua, au Kuvuna.',
    ha: 'Amfanin gonarku ya kai wane mataki? Danna Shuka, Girma, Fure, ko Girbi.',
    tw: 'Wo nnoba aduane adu he? Mia Planting, Growing, Flowering, anaa Harvesting.',
  },
  update_condition: {
    en: 'How does your crop look? Tap Good, Okay, or Problem.',
    fr: 'Comment va votre culture ? Appuyez sur Bien, Correct, ou Probleme.',
    sw: 'Mazao yako yanaonekanaje? Bonyeza Nzuri, Sawa, au Tatizo.',
    ha: 'Yaya amfanin gonarku yake? Danna Mai kyau, Da kyau, ko Matsala.',
    tw: 'Wo nnoba te sen? Mia Good, Okay, anaa Problem.',
  },
  update_photo: {
    en: 'You can take a photo of your farm. Tap the camera button, or skip.',
    fr: 'Vous pouvez prendre une photo. Appuyez sur le bouton appareil, ou passez.',
    sw: 'Unaweza kupiga picha ya shamba lako. Bonyeza kitufe cha kamera, au ruka.',
    ha: 'Kuna iya daukan hoton gonarku. Danna maballin kyamara, ko ku tsallake.',
    tw: 'Wubetumi afa wo afuo foto. Mia camera button no, anaase mia Skip.',
  },
  update_note: {
    en: 'You can add a note about any problem. This is optional.',
    fr: 'Vous pouvez ajouter une note sur un probleme. C\'est optionnel.',
    sw: 'Unaweza kuongeza maelezo kuhusu tatizo lolote. Hii si lazima.',
    ha: 'Kuna iya kara bayani game da matsala. Wannan ba dole ba ne.',
    tw: 'Wubetumi de nsem bi ka ho fa asem biara ho. Eyi nye dede.',
  },
  update_submitting: {
    en: 'Saving your update. Please wait.',
    fr: 'Enregistrement de votre mise a jour. Veuillez patienter.',
    sw: 'Tunahifadhi taarifa yako. Tafadhali subiri.',
    ha: 'Ana adana sabuntawarku. Da fatan za a jira.',
    tw: 'Yekora wo nkyerease. Mesrewoo kakra.',
  },
  update_success: {
    en: 'Your update was saved! Tap Done to go back.',
    fr: 'Votre mise a jour a ete enregistree ! Appuyez sur Termine pour revenir.',
    sw: 'Taarifa yako imehifadhiwa! Bonyeza Imekamilika kurudi.',
    ha: 'An adana sabuntawarku! Danna Gama don komawa.',
    tw: 'Wo nkyerease akora! Mia Done san ko.',
  },
  update_offline: {
    en: 'No internet connection. Your update is saved and will send when you reconnect.',
    fr: 'Pas de connexion. Votre mise a jour est enregistree et sera envoyee quand vous vous reconnecterez.',
    sw: 'Hakuna mtandao. Taarifa yako imehifadhiwa na itatumwa utakapounganisha tena.',
    ha: 'Babu intanet. An adana sabuntawarku kuma za a aika idan kun sake haduwa.',
    tw: 'Internet nni ho. Wo nkyerease akora na wobema no afe internet ba.',
  },
  update_failed: {
    en: 'Something went wrong. Tap Retry to try again, or Cancel.',
    fr: 'Quelque chose s\'est mal passe. Appuyez sur Reessayer ou Annuler.',
    sw: 'Kuna tatizo. Bonyeza Jaribu Tena, au Ghairi.',
    ha: 'Wani abu ya faru. Danna Sake gwadawa, ko Soke.',
    tw: 'Biribi aye nea enye. Mia Retry bio, anaa Cancel.',
  },

  // ─── Officer Validation ────────────────────────────────────
  officer_queue: {
    en: 'Your validation queue. Review each farmer update and tap Approve, Reject, or Flag.',
    fr: 'Votre file de validation. Examinez chaque mise a jour et appuyez sur Approuver, Rejeter ou Signaler.',
    sw: 'Foleni yako ya uthibitisho. Kagua kila taarifa ya mkulima na bonyeza Kubali, Kataa, au Weka Alama.',
    ha: 'Jerin tabbatarwa. Duba kowane sabuntawar manomi sannan danna Amince, Ki, ko Alama.',
    tw: 'Wo validation queue. Hwehwe nnipa biara nkyerease na mia Approve, Reject, anaa Flag.',
  },
  officer_open_item: {
    en: 'Look at the photo and crop details. Then choose Approve, Reject, or Flag below.',
    fr: 'Regardez la photo et les details. Puis choisissez Approuver, Rejeter ou Signaler.',
    sw: 'Angalia picha na maelezo ya mazao. Kisha chagua Kubali, Kataa, au Weka Alama hapo chini.',
    ha: 'Dubi hoton da bayanan amfanin gona. Sannan zabi Amince, Ki, ko Alama a kasa.',
    tw: 'Hwe foto ne nnoba ho nsem. Afei yi Approve, Reject, anaa Flag wo ase ho.',
  },
  officer_action: {
    en: 'Tap Approve to confirm, Reject if wrong, or Flag to mark for review.',
    fr: 'Appuyez sur Approuver pour confirmer, Rejeter si incorrect, ou Signaler pour examen.',
    sw: 'Bonyeza Kubali kuthibitisha, Kataa ikiwa si sahihi, au Weka Alama kwa ukaguzi.',
    ha: 'Danna Amince don tabbatarwa, Ki idan ba daidai ba, ko Alama don dubawa.',
    tw: 'Mia Approve de confirm, Reject se enye, anaa Flag ma review.',
  },
  officer_next_item: {
    en: 'Moving to the next update. Swipe or tap the arrows to navigate.',
    fr: 'Passage a la prochaine mise a jour. Balayez ou appuyez sur les fleches.',
    sw: 'Kuendelea na taarifa inayofuata. Sogeza au bonyeza mishale kupitia.',
    ha: 'Ci gaba zuwa sabuntawa na gaba. Goga ko danna kibiyoyi don tafiya.',
    tw: 'Rekoo update foforo. Swipe anaa mia arrows no de navigate.',
  },
  officer_empty: {
    en: 'Queue is clear. No updates need validation. Tap Refresh to check again.',
    fr: 'File vide. Aucune mise a jour a valider. Appuyez sur Actualiser pour verifier.',
    sw: 'Foleni iko tupu. Hakuna taarifa zinazohitaji uthibitisho. Bonyeza Sasisha kuangalia tena.',
    ha: 'Jerin ya cika. Babu sabuntawa da ke bukatar tabbatarwa. Danna Sabunta don sake dubawa.',
    tw: 'Queue no ho kwan. Nkyerease biara nhia validation. Mia Refresh hwe bio.',
  },

  // ─── Admin Dashboard ──────────────────────────────────────
  admin_overview: {
    en: 'Your dashboard overview. See total farmers, active count, and items needing attention.',
    fr: 'Apercu du tableau de bord. Voyez le total des agriculteurs, les actifs et les elements a traiter.',
    sw: 'Muhtasari wa dashibodi yako. Tazama jumla ya wakulima, hai, na vitu vinavyohitaji uangalifu.',
    ha: 'Bayanin dashboard. Ganin jimlar manoma, masu aiki, da abubuwan da ke bukatar kulawa.',
    tw: 'Wo dashboard summary. Hwe afuofuo nyinaa, nea woye active, ne nea ehia attention.',
  },
  admin_active_farmers: {
    en: 'These are your active farmers. Tap to see the full farmer list.',
    fr: 'Voici vos agriculteurs actifs. Appuyez pour voir la liste complete.',
    sw: 'Hawa ni wakulima wako hai. Bonyeza kuona orodha kamili ya wakulima.',
    ha: 'Wadannan su ne manomanku masu aiki. Danna don ganin jerin manoman.',
    tw: 'Eyinom ne wo afuofuo a woye active. Mia hwe nnipa no nyinaa.',
  },
  admin_needs_attention: {
    en: 'These items need your action. Tap each one to resolve it.',
    fr: 'Ces elements necessitent votre action. Appuyez sur chacun pour le resoudre.',
    sw: 'Vitu hivi vinahitaji hatua yako. Bonyeza kila kimoja kutatua.',
    ha: 'Wadannan abubuwa suna bukatar aikinku. Danna kowanne don warwarewa.',
    tw: 'Eyinom hia wo action. Mia biara resolve no.',
  },
  admin_actions: {
    en: 'Quick actions. Invite a farmer, assign an officer, or validate updates.',
    fr: 'Actions rapides. Invitez un agriculteur, assignez un agent, ou validez les mises a jour.',
    sw: 'Hatua za haraka. Alika mkulima, teua afisa, au thibitisha taarifa.',
    ha: 'Ayyukan gaggawa. Gayyaci manomi, sanya jami\'i, ko tabbatar da sabuntawa.',
    tw: 'Quick actions. Fre afuoyeni, de officer, anaa validate nkyerease.',
  },
};

// ─── BCP-47 language tags for speechSynthesis voice matching ─────
const LANG_TAGS = {
  en: 'en',
  fr: 'fr',
  sw: 'sw',
  ha: 'ha',
  tw: 'ak', // Twi → Akan
};

// ─── Availability check ─────────────────────────────────────────

export function isVoiceAvailable() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

// ─── Stop any current speech ────────────────────────────────────

export function stopSpeech() {
  if (isVoiceAvailable()) {
    window.speechSynthesis.cancel();
  }
}

// ─── Main speak function ────────────────────────────────────────

/**
 * Speak the prompt for a given voice key.
 * @param {string} stepKey  — voice map key (e.g. 'welcome', 'home_welcome', 'update_start')
 * @param {string} lang     — language code: 'en', 'fr', 'sw', 'ha', 'tw'
 * @returns {boolean} true if speech was initiated
 */
export function speak(stepKey, lang = 'en') {
  if (!isVoiceAvailable()) return false;

  const stepTexts = VOICE_MAP[stepKey];
  if (!stepTexts) return false;

  // Fallback chain: requested lang → English
  const text = stepTexts[lang] || stepTexts.en;
  if (!text) return false;

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.85;   // Slightly slower for comprehension
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  // Try to match a voice for the target language
  const langTag = LANG_TAGS[lang] || lang;
  const voices = window.speechSynthesis.getVoices();
  const matchedVoice = voices.find(v => v.lang.startsWith(langTag))
    || voices.find(v => v.lang.startsWith('en')); // fallback to English voice

  if (matchedVoice) {
    utterance.voice = matchedVoice;
  }
  utterance.lang = langTag;

  window.speechSynthesis.speak(utterance);
  return true;
}

// ─── Get supported languages list ───────────────────────────────

export const VOICE_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Francais' },
  { code: 'sw', label: 'Kiswahili' },
  { code: 'ha', label: 'Hausa' },
  { code: 'tw', label: 'Twi' },
];

export default { speak, stopSpeech, isVoiceAvailable, VOICE_LANGUAGES };
