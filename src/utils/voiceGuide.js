/**
 * Voice Guide — Natural TTS utility for low-literacy farmers
 *
 * Uses browser speechSynthesis API. Supports English, French, Swahili, Hausa, Twi.
 * Falls back to English when a translation is missing.
 * Gracefully no-ops when speechSynthesis is unavailable.
 *
 * Voice quality features:
 * - Smart voice selection: prefers high-quality, natural-sounding voices
 * - Slower rate (0.82) + lower pitch (0.92) for warmth and clarity
 * - Natural pauses via commas and ellipses in prompt text
 * - Simple wording optimised for low-literacy comprehension
 * - Pre-recorded audio support with TTS fallback
 *
 * Covers: Onboarding wizard, Farmer Home, Add Update flow,
 *         Officer Validation, Admin Dashboard.
 */

// ─── Pre-recorded audio support ────────────────────────────────
// Map of promptKey → { lang → audioUrl }. When a recording exists,
// we play it through an <audio> element for maximum quality.
// Falls back to TTS if the file fails to load or isn't listed.

const AUDIO_MAP = {
  // Example entry — add real recordings as they become available:
  // welcome: { en: '/audio/en/welcome.mp3', fr: '/audio/fr/welcome.mp3' },
};

let _audioEl = null; // reusable Audio element

function getAudioElement() {
  if (!_audioEl && typeof Audio !== 'undefined') {
    _audioEl = new Audio();
    _audioEl.preload = 'auto';
  }
  return _audioEl;
}

/**
 * Try to play a pre-recorded audio file.
 * @returns {Promise<boolean>} true if playback started, false otherwise
 */
async function tryPlayAudio(stepKey, lang) {
  const urls = AUDIO_MAP[stepKey];
  if (!urls) return false;
  const url = urls[lang] || urls.en; // fallback to English recording
  if (!url) return false;

  const audio = getAudioElement();
  if (!audio) return false;

  return new Promise((resolve) => {
    audio.src = url;
    audio.oncanplaythrough = () => {
      audio.play().then(() => resolve(true)).catch(() => resolve(false));
    };
    audio.onerror = () => resolve(false);
    // Safety timeout — don't wait forever for a recording to load
    setTimeout(() => resolve(false), 3000);
  });
}

/**
 * Stop any playing pre-recorded audio.
 */
function stopAudio() {
  if (_audioEl) {
    _audioEl.pause();
    _audioEl.currentTime = 0;
  }
}

// ─── Voice map: keyed by step, then language ────────────────────
// Commas and ellipses create natural breathing pauses.
// Wording is short, direct, and avoids jargon.

const VOICE_MAP = {
  welcome: {
    en: 'Welcome! Let us set up your farm together. It takes about one minute. Tap, Get Started, to begin.',
    fr: 'Bienvenue! Configurons votre ferme ensemble. Cela prend environ une minute. Appuyez sur, Commencer.',
    sw: 'Karibu! Hebu tuanzishe shamba lako. Inachukua dakika moja tu. Bonyeza, Anza.',
    ha: 'Barka da zuwa! Mu saita gonarku. Zai dauki minti daya. Danna, Fara.',
    tw: 'Akwaaba! Ma yen set wo afuo. Ebeye simma biara. Mia, Get Started.',
  },
  farmName: {
    en: 'Give your farm a name. Type it in the box, then tap, Next.',
    fr: 'Donnez un nom a votre ferme. Tapez-le, puis appuyez sur, Suivant.',
    sw: 'Shamba lako linaitwaje? Andika jina, kisha bonyeza, Endelea.',
    ha: 'Menene sunan gonarku? Rubuta sunan gona, sannan ku danna, Gaba.',
    tw: 'Deen na wofre wo afuo? Hyehye din bi, na mia, Next.',
  },
  country: {
    en: 'Where is your farm? Find your country in the list, then tap, Next.',
    fr: 'Ou se trouve votre ferme? Trouvez votre pays dans la liste, puis, Suivant.',
    sw: 'Unalima wapi? Tafuta nchi yako kwenye orodha, kisha bonyeza, Endelea.',
    ha: 'Ina kuke noma? Nemo kasarku a cikin jerin, sannan ku danna, Gaba.',
    tw: 'Woyoo he? Hwehwe wo man wo list no mu, na mia, Next.',
  },
  crop: {
    en: 'What do you grow? Tap your main crop. You can also search for more.',
    fr: 'Que cultivez-vous? Appuyez sur votre culture. Vous pouvez aussi chercher.',
    sw: 'Unalima nini? Bonyeza zao lako kuu. Unaweza pia kutafuta zaidi.',
    ha: 'Menene kuke nomawa? Danna amfanin gonarku. Kuna iya neman kari.',
    tw: 'Deen na wudua? Mia wo nnoba titiriw. Wubetumi ahwehwe foforo.',
  },
  farmSize: {
    en: 'How big is your farm? Choose your unit first, then pick a size, or type the number.',
    fr: 'Quelle taille fait votre ferme? Choisissez une unite, puis la taille.',
    sw: 'Shamba lako lina ukubwa gani? Chagua kipimo, kisha bonyeza ukubwa.',
    ha: 'Gonarku ta girma nawa? Zabi ma aunin, sannan danna girma ko rubuta adadi.',
    tw: 'Wo afuo so kese sen? Yi wo unit, na mia size anaa hyehye noma no.',
  },
  gender: {
    en: 'Tell us about yourself. Tap your gender, or skip if you like.',
    fr: 'Parlez-nous de vous. Appuyez sur votre genre, ou passez.',
    sw: 'Tuambie kuhusu wewe. Bonyeza jinsia yako, au ruka.',
    ha: 'Gaya mana game da kanku. Danna jinsinku, ko ku tsallake.',
    tw: 'Ka wo ho asem kyere yen. Mia wo gender, anaase mia, Skip.',
  },
  age: {
    en: 'What is your age group? Tap your age range, or skip.',
    fr: 'Quel est votre groupe d\'age? Appuyez sur votre tranche d\'age, ou passez.',
    sw: 'Kundi lako la umri ni lipi? Bonyeza kiwango cha umri, au ruka.',
    ha: 'Menene rukunin shekarunka? Danna shekarunka, ko ku tsallake.',
    tw: 'Wo mfe mu kuw yen? Mia wo mfe kuw, anaase mia, Skip.',
  },
  location: {
    en: 'Where is your farm? Tap, detect my location, or type the name of your area.',
    fr: 'Ou se trouve votre ferme? Appuyez sur, detecter, ou tapez le nom de votre zone.',
    sw: 'Shamba lako liko wapi? Bonyeza, kutambua eneo, au andika jina la eneo lako.',
    ha: 'Ina gonarku take? Danna, gano wurina, ko rubuta sunan yankinku.',
    tw: 'Wo afuo wo he? Mia, detect my location, anaase hyehye wo beae din.',
  },
  photo: {
    en: 'Almost done! You can take a photo now, or skip and create your farm.',
    fr: 'Presque fini! Prenez une photo, ou passez et creez votre ferme.',
    sw: 'Karibu kumaliza! Piga picha, au ruka na uunde shamba lako.',
    ha: 'Kusan an gama! Dauki hoton kai, ko ku tsallake ku kirkiri gonarku.',
    tw: 'Aye awie! Fa foto, anaase mia Skip na create wo afuo.',
  },
  processing: {
    en: 'We are creating your farm now. Please wait a moment.',
    fr: 'Nous creons votre ferme maintenant. Veuillez patienter.',
    sw: 'Tunaunda shamba lako sasa. Tafadhali subiri kidogo.',
    ha: 'Muna kirkiran gonarku yanzu. Da fatan za a jira kadan.',
    tw: 'Yereye wo afuo seesei. Mesrewoo kakra.',
  },

  // ─── Farmer Home ───────────────────────────────────────────
  home_welcome: {
    en: 'Welcome to your farm. Here you can see your crop, and the weather. Tap the green button, to add an update.',
    fr: 'Bienvenue sur votre ferme. Voyez votre culture et la meteo. Appuyez sur le bouton vert, pour ajouter.',
    sw: 'Karibu kwenye shamba lako. Hapa unaona mazao na hali ya hewa. Bonyeza kitufe kijani, kuongeza taarifa.',
    ha: 'Barka da zuwa gonarku. Anan kuna ganin amfanin gona da yanayi. Danna maballin kore, don kara sabuntawa.',
    tw: 'Akwaaba wo afuo. Wubetumi ahu wo nnoba ne wim tenten. Mia button ahabanbere no, de beka nkyerease.',
  },
  home_status: {
    en: 'This shows your crop, and what stage it is at. Check it often.',
    fr: 'Ceci montre votre culture et son stade. Verifiez souvent.',
    sw: 'Hii inaonyesha mazao yako na hatua yake. Angalia mara kwa mara.',
    ha: 'Wannan yana nuna amfanin gonarku da matakin yanzu. Ku duba sau da yawa.',
    tw: 'Eyi kyere wo nnoba ne n\'aberease. Hwehwe mu mpem mpem.',
  },
  home_action: {
    en: 'Tap the big green button, to write down what you did on your farm today.',
    fr: 'Appuyez sur le grand bouton vert, pour noter votre activite.',
    sw: 'Bonyeza kitufe kikubwa kijani, kurekodi shughuli yako ya leo.',
    ha: 'Danna babban maballin kore, don rubuta aikin gonarku na yau.',
    tw: 'Mia button kese ahabanbere no, de kyerew wo adwumayede foforo.',
  },
  home_next_step: {
    en: 'Look below the button. It tells you, what to do next on your farm.',
    fr: 'Regardez sous le bouton. Il vous dit, quoi faire ensuite.',
    sw: 'Angalia chini ya kitufe. Inakuambia, la kufanya baadaye.',
    ha: 'Dubi kasan maballin. Tana fadan muku, abin da za ku yi na gaba.',
    tw: 'Hwe button no ase. Eka wo, nea wobegye adi.',
  },
  home_help: {
    en: 'Need help? Tap the blue question mark, at the bottom of the screen.',
    fr: 'Besoin d\'aide? Appuyez sur le point d\'interrogation bleu, en bas.',
    sw: 'Unahitaji msaada? Bonyeza alama ya kuuliza ya buluu, chini ya skrini.',
    ha: 'Kuna bukatar taimako? Danna maballin shudin tambaya, a kasan allon.',
    tw: 'Wohia mmoa? Mia button blue asemmisa no, wo screen no ase.',
  },

  // ─── Add Update Flow ──────────────────────────────────────
  update_start: {
    en: 'What do you want to do? Tap, Crop Progress, Upload Photo, or, Report Issue.',
    fr: 'Que voulez-vous faire? Appuyez sur, Progres, Photo, ou, Signaler.',
    sw: 'Unataka kufanya nini? Bonyeza, Maendeleo, Pakia Picha, au, Ripoti Tatizo.',
    ha: 'Menene kuke so ku yi? Danna, Ci gaba, Dora Hoto, ko, Rahoto Matsala.',
    tw: 'Deen na wope se woye? Mia, Crop Progress, Upload Photo, anaa, Report Issue.',
  },
  update_choose_type: {
    en: 'Pick the kind of update you want to share.',
    fr: 'Choisissez le type de mise a jour.',
    sw: 'Chagua aina ya taarifa unayotaka kushiriki.',
    ha: 'Zabi irin sabuntawar da kuke so ku raba.',
    tw: 'Yi nkyerease no mu ade a wope se wode bema.',
  },
  update_stage: {
    en: 'What stage is your crop at? Tap, Planting, Growing, Flowering, or, Harvesting.',
    fr: 'A quel stade est votre culture? Appuyez sur, Plantation, Croissance, Floraison, ou, Recolte.',
    sw: 'Mazao yako yako hatua gani? Bonyeza, Kupanda, Kukua, Kuchanua, au, Kuvuna.',
    ha: 'Amfanin gonarku ya kai wane mataki? Danna, Shuka, Girma, Fure, ko, Girbi.',
    tw: 'Wo nnoba aduane adu he? Mia, Planting, Growing, Flowering, anaa, Harvesting.',
  },
  update_condition: {
    en: 'How does your crop look? Tap, Good, Okay, or, Problem.',
    fr: 'Comment va votre culture? Appuyez sur, Bien, Correct, ou, Probleme.',
    sw: 'Mazao yako yanaonekanaje? Bonyeza, Nzuri, Sawa, au, Tatizo.',
    ha: 'Yaya amfanin gonarku yake? Danna, Mai kyau, Da kyau, ko, Matsala.',
    tw: 'Wo nnoba te sen? Mia, Good, Okay, anaa, Problem.',
  },
  update_photo: {
    en: 'You can take a photo of your farm. Tap the camera, or skip this step.',
    fr: 'Prenez une photo de votre ferme. Appuyez sur la camera, ou passez.',
    sw: 'Piga picha ya shamba lako. Bonyeza kamera, au ruka hatua hii.',
    ha: 'Dauki hoton gonarku. Danna kyamara, ko ku tsallake.',
    tw: 'Fa wo afuo foto. Mia camera no, anaase mia Skip.',
  },
  update_note: {
    en: 'You can add a note about any problem. This is not required.',
    fr: 'Ajoutez une note sur un probleme. C\'est optionnel.',
    sw: 'Ongeza maelezo kuhusu tatizo. Hii si lazima.',
    ha: 'Kara bayani game da matsala. Wannan ba dole ba ne.',
    tw: 'De nsem bi ka ho fa asem biara ho. Eyi nye dede.',
  },
  update_submitting: {
    en: 'Saving your update now. Please wait.',
    fr: 'Enregistrement en cours. Veuillez patienter.',
    sw: 'Tunahifadhi taarifa yako. Tafadhali subiri.',
    ha: 'Ana adana sabuntawarku. Da fatan za a jira.',
    tw: 'Yekora wo nkyerease. Mesrewoo kakra.',
  },
  update_success: {
    en: 'Done! Your update was saved. Tap, Done, to go back.',
    fr: 'C\'est fait! Mise a jour enregistree. Appuyez sur, Termine.',
    sw: 'Imefanikiwa! Taarifa imehifadhiwa. Bonyeza, Imekamilika.',
    ha: 'An gama! An adana sabuntawarku. Danna, Gama.',
    tw: 'Aye wie! Wo nkyerease akora. Mia, Done.',
  },
  update_offline: {
    en: 'No internet right now. Your update is saved here, and will send when you are back online.',
    fr: 'Pas de connexion. Votre mise a jour est gardee ici, et sera envoyee quand vous serez en ligne.',
    sw: 'Hakuna mtandao sasa. Taarifa yako imehifadhiwa hapa, na itatumwa baadaye.',
    ha: 'Babu intanet yanzu. An adana sabuntawarku anan, za a aika idan intanet ta dawo.',
    tw: 'Internet nni ho seesei. Wo nkyerease akora ha, na wobema no internet ba a.',
  },
  update_failed: {
    en: 'Something went wrong. Tap, Retry, to try again. Or tap, Cancel.',
    fr: 'Quelque chose s\'est mal passe. Appuyez sur, Reessayer. Ou, Annuler.',
    sw: 'Kuna tatizo. Bonyeza, Jaribu Tena. Au, Ghairi.',
    ha: 'Wani abu ya faru. Danna, Sake gwadawa. Ko, Soke.',
    tw: 'Biribi aye nea enye. Mia, Retry. Anaa, Cancel.',
  },

  // ─── Officer Validation ────────────────────────────────────
  officer_queue: {
    en: 'Your validation list. Look at each farmer update, and tap, Approve, Reject, or, Flag.',
    fr: 'Votre liste de validation. Examinez chaque mise a jour, puis, Approuver, Rejeter, ou, Signaler.',
    sw: 'Orodha yako ya uthibitisho. Kagua kila taarifa, na bonyeza, Kubali, Kataa, au, Alama.',
    ha: 'Jerin tabbatarwa. Duba kowane sabuntawar, sannan danna, Amince, Ki, ko, Alama.',
    tw: 'Wo validation list. Hwehwe nnipa biara nkyerease, na mia, Approve, Reject, anaa, Flag.',
  },
  officer_open_item: {
    en: 'Look at the photo and the details. Then choose, Approve, Reject, or, Flag.',
    fr: 'Regardez la photo et les details. Puis choisissez, Approuver, Rejeter, ou, Signaler.',
    sw: 'Angalia picha na maelezo. Kisha chagua, Kubali, Kataa, au, Alama.',
    ha: 'Dubi hoton da bayanai. Sannan zabi, Amince, Ki, ko, Alama.',
    tw: 'Hwe foto ne nsem no. Afei yi, Approve, Reject, anaa, Flag.',
  },
  officer_action: {
    en: 'Tap, Approve, to confirm. Tap, Reject, if something is wrong. Or tap, Flag, to mark for review.',
    fr: 'Appuyez sur, Approuver, pour confirmer. Rejeter, si incorrect. Ou, Signaler.',
    sw: 'Bonyeza, Kubali, kuthibitisha. Kataa, ikiwa si sahihi. Au, Alama, kwa ukaguzi.',
    ha: 'Danna, Amince, don tabbatarwa. Ki, idan ba daidai ba. Ko, Alama, don dubawa.',
    tw: 'Mia, Approve, de confirm. Mia, Reject, se enye. Anaa, Flag, ma review.',
  },
  officer_next_item: {
    en: 'Moving to the next one. Swipe or tap the arrows.',
    fr: 'Passage au suivant. Balayez ou appuyez sur les fleches.',
    sw: 'Kuendelea na inayofuata. Sogeza au bonyeza mishale.',
    ha: 'Ci gaba zuwa na gaba. Goga ko danna kibiyoyi.',
    tw: 'Rekoo foforo. Swipe anaa mia arrows no.',
  },
  officer_empty: {
    en: 'All done! No updates to review right now. Tap, Refresh, to check again later.',
    fr: 'Termine! Aucune mise a jour a valider. Appuyez sur, Actualiser.',
    sw: 'Imeisha! Hakuna taarifa za kuthibitisha sasa. Bonyeza, Sasisha, kuangalia baadaye.',
    ha: 'An gama! Babu sabuntawa yanzu. Danna, Sabunta, don sake dubawa.',
    tw: 'Awie! Nkyerease biara nni ho seesei. Mia, Refresh, hwe bio.',
  },

  // ─── Admin Dashboard ──────────────────────────────────────
  admin_overview: {
    en: 'Your dashboard. Here you see, total farmers, active count, and things that need attention.',
    fr: 'Votre tableau de bord. Voyez, le total des agriculteurs, les actifs, et les elements a traiter.',
    sw: 'Dashibodi yako. Hapa unaona, jumla ya wakulima, waliopo hai, na vitu vinavyohitaji uangalifu.',
    ha: 'Bayanin dashboard. Anan kuna ganin, jimlar manoma, masu aiki, da abubuwan da ke bukatar kulawa.',
    tw: 'Wo dashboard. Wuhu, afuofuo nyinaa, nea woye active, ne nea ehia attention.',
  },
  admin_active_farmers: {
    en: 'These are your active farmers. Tap to see the full list.',
    fr: 'Voici vos agriculteurs actifs. Appuyez pour voir la liste.',
    sw: 'Hawa ni wakulima wako waliopo hai. Bonyeza kuona orodha.',
    ha: 'Wadannan su manomanku masu aiki. Danna don ganin jerin.',
    tw: 'Eyinom ne wo afuofuo a woye active. Mia hwe nnipa no.',
  },
  admin_needs_attention: {
    en: 'These things need your action. Tap each one to handle it.',
    fr: 'Ces elements necessitent votre action. Appuyez sur chacun.',
    sw: 'Vitu hivi vinahitaji hatua yako. Bonyeza kila kimoja.',
    ha: 'Wadannan abubuwa suna bukatar aikinku. Danna kowanne.',
    tw: 'Eyinom hia wo action. Mia biara resolve no.',
  },
  admin_actions: {
    en: 'Quick actions. Invite a farmer, assign an officer, or check updates.',
    fr: 'Actions rapides. Invitez un agriculteur, assignez un agent, ou verifiez.',
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

// ─── Voice quality settings ─────────────────────────────────────
const VOICE_RATE = 0.82;    // Slower for clarity — natural conversation pace
const VOICE_PITCH = 0.92;   // Slightly lower — warmer, less robotic
const VOICE_VOLUME = 1.0;

// ─── Smart voice selection ──────────────────────────────────────
// Prefer high-quality, natural-sounding voices. Browser vendors ship
// premium voices under various naming conventions.

const PREFERRED_VOICE_PATTERNS = [
  // Google high-quality voices (Chrome / Android)
  /google.*natural/i,
  /google.*wavenet/i,
  /google.*neural/i,
  // Apple premium voices (Safari / iOS / macOS)
  /samantha/i,    // en-US female (macOS/iOS premium)
  /daniel/i,      // en-GB male (macOS/iOS premium)
  /thomas/i,      // fr-FR male
  /amelie/i,      // fr-CA female
  // Microsoft neural voices (Edge / Windows)
  /neural/i,
  /online.*natural/i,
  /microsoft.*online/i,
  // Generic high-quality markers
  /enhanced/i,
  /premium/i,
  /natural/i,
  /hd$/i,
];

/** Cached voice selections — refreshed when voices change */
let _voiceCache = new Map(); // langTag → SpeechSynthesisVoice
let _voiceListVersion = 0;

function scoreVoice(voice) {
  let score = 0;
  const name = voice.name || '';

  // Prefer local (not remote/network) voices for lower latency
  if (voice.localService) score += 5;

  // Bonus for matching preferred patterns (higher patterns = higher priority)
  for (let i = 0; i < PREFERRED_VOICE_PATTERNS.length; i++) {
    if (PREFERRED_VOICE_PATTERNS[i].test(name)) {
      score += 20 - i; // earlier patterns score higher
      break;
    }
  }

  // Penalise voices with "compact" or "espeak" — typically lower quality
  if (/compact/i.test(name)) score -= 10;
  if (/espeak/i.test(name)) score -= 15;

  return score;
}

function selectBestVoice(langTag) {
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  // Check if cache is still valid
  const version = voices.length; // crude but effective
  if (version !== _voiceListVersion) {
    _voiceCache = new Map();
    _voiceListVersion = version;
  }
  if (_voiceCache.has(langTag)) return _voiceCache.get(langTag);

  // Find all voices that match the language
  const langVoices = voices.filter(v => v.lang.startsWith(langTag));

  let best = null;
  if (langVoices.length > 0) {
    // Score and pick the best
    best = langVoices.reduce((a, b) => scoreVoice(b) > scoreVoice(a) ? b : a);
  } else {
    // No voice for this language — fall back to best English voice
    const enVoices = voices.filter(v => v.lang.startsWith('en'));
    if (enVoices.length > 0) {
      best = enVoices.reduce((a, b) => scoreVoice(b) > scoreVoice(a) ? b : a);
    }
  }

  if (best) _voiceCache.set(langTag, best);
  return best;
}

// ─── Availability check ─────────────────────────────────────────

export function isVoiceAvailable() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

// ─── Stop any current speech ────────────────────────────────────

export function stopSpeech() {
  stopAudio();
  if (isVoiceAvailable()) {
    window.speechSynthesis.cancel();
  }
}

// ─── Main speak function ────────────────────────────────────────

/**
 * Speak the prompt for a given voice key.
 * Tries pre-recorded audio first, falls back to TTS.
 *
 * @param {string} stepKey  — voice map key (e.g. 'welcome', 'home_welcome')
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

  // Cancel any ongoing speech or audio
  stopSpeech();

  // Try pre-recorded audio first (async — TTS is synchronous fallback)
  tryPlayAudio(stepKey, lang).then((played) => {
    if (played) return; // audio is playing, skip TTS

    // ── TTS fallback ──
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = VOICE_RATE;
    utterance.pitch = VOICE_PITCH;
    utterance.volume = VOICE_VOLUME;

    // Smart voice selection
    const langTag = LANG_TAGS[lang] || lang;
    const bestVoice = selectBestVoice(langTag);
    if (bestVoice) {
      utterance.voice = bestVoice;
    }
    utterance.lang = langTag;

    // Chrome bug workaround: voices may not be loaded yet on first call.
    // If no voices, wait for onvoiceschanged and retry once.
    if (window.speechSynthesis.getVoices().length === 0) {
      const retry = () => {
        window.speechSynthesis.removeEventListener('voiceschanged', retry);
        const voice = selectBestVoice(langTag);
        if (voice) utterance.voice = voice;
        window.speechSynthesis.speak(utterance);
      };
      window.speechSynthesis.addEventListener('voiceschanged', retry);
      // Safety: if voiceschanged never fires, speak anyway after 500ms
      setTimeout(() => {
        window.speechSynthesis.removeEventListener('voiceschanged', retry);
        if (window.speechSynthesis.speaking) return; // retry already fired
        window.speechSynthesis.speak(utterance);
      }, 500);
    } else {
      window.speechSynthesis.speak(utterance);
    }
  });

  return true;
}

// ─── Pre-warm voice list ────────────────────────────────────────
// Chrome requires getVoices() to be called once before voices are available.
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.getVoices();
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.addEventListener('voiceschanged', () => {
      window.speechSynthesis.getVoices(); // populate cache
    }, { once: true });
  }
}

// ─── Get supported languages list ───────────────────────────────

export const VOICE_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Francais' },
  { code: 'sw', label: 'Kiswahili' },
  { code: 'ha', label: 'Hausa' },
  { code: 'tw', label: 'Twi' },
];

// ─── Exports for testing / advanced usage ───────────────────────
export { VOICE_MAP, AUDIO_MAP, VOICE_RATE, VOICE_PITCH };

export default { speak, stopSpeech, isVoiceAvailable, VOICE_LANGUAGES };
