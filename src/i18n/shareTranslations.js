/**
 * shareTranslations.js — Garden Mode share-card overlay.
 *
 * Covers every key emitted by:
 *   • encouragementCaptions.pickCaption  → 18 caption rows
 *   • ShareCardModal                     → modal title, action labels,
 *                                            toast statuses, safety
 *                                            note, hashtag, share-CTA
 *
 * Coverage: en, fr, sw, ha, tw, hi (all six locales registered in
 * SUPPORTED_LANGUAGES).
 *
 * Shape: `{ key: { locale: value } }`. Merged via the empty-slot
 * fill in src/i18n/index.js — translator-authored values in T
 * always win.
 */

export const SHARE_TRANSLATIONS = Object.freeze({
  // ── Encouragement captions ────────────────────────────────
  'share.caption.general.steady': {
    en: 'Steady care makes a difference.',
    fr: 'Des soins constants font la différence.',
    sw: 'Utunzaji thabiti unaleta tofauti.',
    ha: 'Kulawa akai-akai tana yin tasiri.',
    tw: 'Daa ɔhwɛ no boa.',
    hi: 'नियमित देखभाल फर्क करती है।',
  },
  'share.caption.general.adds': {
    en: 'Small daily care adds up.',
    fr: 'De petits soins quotidiens font la différence.',
    sw: 'Utunzaji mdogo wa kila siku unalimbikiza.',
    ha: 'Kulawa kaɗan ta yau da kullum tana ƙaruwa.',
    tw: 'Daa ɔhwɛ kakra na ɛboro so.',
    hi: 'रोज़ की छोटी देखभाल जुड़ती जाती है।',
  },
  'share.caption.general.patience': {
    en: 'Growth takes patience.',
    fr: 'La croissance demande de la patience.',
    sw: 'Ukuaji unahitaji uvumilivu.',
    ha: 'Girma yana buƙatar haƙuri.',
    tw: 'Nyini hia abotare.',
    hi: 'विकास में धैर्य चाहिए।',
  },

  'share.caption.flowering.started': {
    en: 'Flowering started — exciting times.',
    fr: 'La floraison a commencé — un beau moment.',
    sw: 'Maua yameanza — wakati wa furaha.',
    ha: 'Furannin sun fara — lokaci mai daɗi.',
    tw: 'Nhwiren afi ase — anigye bere.',
    hi: 'फूल आना शुरू — खुशी का समय।',
  },
  'share.caption.flowering.steady': {
    en: 'Keep watering steady through flowering.',
    fr: 'Maintenez un arrosage régulier pendant la floraison.',
    sw: 'Endelea kumwagilia kwa utaratibu wakati wa maua.',
    ha: 'Ci gaba da shayarwa akai-akai a lokacin furannin.',
    tw: 'Ma nsuo nko so wɔ nhwiren bere mu.',
    hi: 'फूल आने के दौरान नियमित पानी दें।',
  },

  'share.caption.fruiting.start': {
    en: 'First fruit on the way.',
    fr: 'Premier fruit en route.',
    sw: 'Tunda la kwanza linakuja.',
    ha: 'Yan itacen farko na zuwa.',
    tw: 'Aba a ɛdi kan reba.',
    hi: 'पहला फल आ रहा है।',
  },
  'share.caption.fruiting.steady': {
    en: 'Steady moisture helps fruit develop.',
    fr: 'Une humidité régulière aide les fruits à se développer.',
    sw: 'Unyevu thabiti husaidia matunda kukua.',
    ha: 'Damshi akai-akai yana taimakawa yan itace girma.',
    tw: 'Daa nsuo boa ma aba renyini.',
    hi: 'स्थिर नमी फलों को विकसित करने में मदद करती है।',
  },

  'share.caption.harvest.first': {
    en: 'First harvest — daily care paid off.',
    fr: 'Première récolte — les soins quotidiens ont porté leurs fruits.',
    sw: 'Mavuno ya kwanza — utunzaji wa kila siku umelipa.',
    ha: 'Girbi na farko — kulawar yau da kullum ta ba da sakamako.',
    tw: 'Adwumayɛ a ɛdi kan — daa ɔhwɛ no abrɛ aba.',
    hi: 'पहली फसल — रोज़ की देखभाल काम आई।',
  },
  'share.caption.harvest.steady': {
    en: 'Pick at peak colour and size.',
    fr: 'Cueillez à la couleur et la taille optimales.',
    sw: 'Vuna wakati wa rangi na ukubwa kamili.',
    ha: 'Girbi a lokacin launi da girma mafi kyau.',
    tw: 'Tew wɔ ahosu ne kɛse a ɛyɛ pɛ no.',
    hi: 'सही रंग और आकार पर तोड़ें।',
  },

  'share.caption.recovery.steady': {
    en: 'Steady care helped this plant recover.',
    fr: 'Des soins constants ont aidé cette plante à se rétablir.',
    sw: 'Utunzaji thabiti umesaidia mmea huu kupona.',
    ha: 'Kulawa akai-akai ta taimaki wannan tsiron warkewa.',
    tw: 'Daa ɔhwɛ na ɛboaa saa afifideɛ yi ma ɔnyaa ahoɔden.',
    hi: 'नियमित देखभाल ने इस पौधे को ठीक होने में मदद की।',
  },
  'share.caption.recovery.healthier': {
    en: 'Looking healthier after some attention.',
    fr: 'En meilleure santé après un peu d\'attention.',
    sw: 'Inaonekana yenye afya zaidi baada ya umakini.',
    ha: 'Tana kama mai lafiya bayan kulawa kaɗan.',
    tw: 'Apɔw kakra wɔ nnyinaeɛ kakra akyi.',
    hi: 'थोड़े ध्यान के बाद ज़्यादा स्वस्थ दिख रहा।',
  },

  'share.caption.streak.3': {
    en: 'Three days of care this week.',
    fr: 'Trois jours de soins cette semaine.',
    sw: 'Siku tatu za utunzaji wiki hii.',
    ha: 'Kwanaki uku na kulawa wannan makon.',
    tw: 'Nna mmiɛnsa ɔhwɛ nnawɔtwe yi.',
    hi: 'इस सप्ताह तीन दिन देखभाल।',
  },
  'share.caption.streak.7': {
    en: 'A full week of steady care.',
    fr: 'Une semaine complète de soins constants.',
    sw: 'Wiki nzima ya utunzaji thabiti.',
    ha: 'Mako ɗaya cikakke na kulawa akai-akai.',
    tw: 'Nnawɔtwe a ɔhwɛ ka so.',
    hi: 'पूरा सप्ताह नियमित देखभाल।',
  },

  'share.caption.progress.advance': {
    en: 'Your plant is progressing well.',
    fr: 'Votre plante progresse bien.',
    sw: 'Mmea wako unaendelea vizuri.',
    ha: 'Tsironka yana ci gaba sosai.',
    tw: 'Wʼafifideɛ rekɔ so yiye.',
    hi: 'आपका पौधा अच्छी प्रगति कर रहा है।',
  },
  'share.caption.progress.healthier': {
    en: 'Looking healthier this week.',
    fr: 'En meilleure santé cette semaine.',
    sw: 'Inaonekana yenye afya zaidi wiki hii.',
    ha: 'Tana kama mai lafiya wannan makon.',
    tw: 'Apɔw kakra nnawɔtwe yi.',
    hi: 'इस सप्ताह ज़्यादा स्वस्थ दिख रहा।',
  },

  'share.caption.firstScan.saved': {
    en: 'First plant scan saved.',
    fr: 'Premier scan de plante enregistré.',
    sw: 'Skana ya kwanza ya mmea imehifadhiwa.',
    ha: 'An adana sikan na farko na tsiro.',
    tw: 'Yɛakora afifideɛ scan a ɛdi kan no.',
    hi: 'पहला पौधा स्कैन सहेजा गया।',
  },

  // ── Modal title + chrome ──────────────────────────────────
  'share.modal.title': {
    en: 'Share your plant moment',
    fr: 'Partagez le moment de votre plante',
    sw: 'Shiriki wakati wa mmea wako',
    ha: 'Raba lokacin tsironka',
    tw: 'Kyɛ wʼafifideɛ bere',
    hi: 'अपने पौधे का पल साझा करें',
  },
  'share.modal.openCta': {
    en: 'Share',
    fr: 'Partager',
    sw: 'Shiriki',
    ha: 'Raba',
    tw: 'Kyɛ',
    hi: 'साझा करें',
  },
  'share.action.share': {
    en: 'Share',
    fr: 'Partager',
    sw: 'Shiriki',
    ha: 'Raba',
    tw: 'Kyɛ',
    hi: 'साझा करें',
  },
  'share.action.shareUnsupported': {
    en: 'Share',
    fr: 'Partager',
    sw: 'Shiriki',
    ha: 'Raba',
    tw: 'Kyɛ',
    hi: 'साझा करें',
  },
  'share.action.copy': {
    en: 'Copy text',
    fr: 'Copier le texte',
    sw: 'Nakili maandishi',
    ha: 'Kwafi rubutu',
    tw: 'Kɔpi nsɛm',
    hi: 'पाठ कॉपी करें',
  },

  // ── Toast statuses ────────────────────────────────────────
  'share.toast.shared': {
    en: 'Shared.',
    fr: 'Partagé.',
    sw: 'Imeshirikishwa.',
    ha: 'An raba.',
    tw: 'Yɛakyɛ.',
    hi: 'साझा किया गया।',
  },
  'share.toast.copied': {
    en: 'Copied to clipboard.',
    fr: 'Copié dans le presse-papiers.',
    sw: 'Imenakiliwa kwenye ubao wa kunakili.',
    ha: 'An kwafe zuwa allon kwafi.',
    tw: 'Yɛakopi.',
    hi: 'क्लिपबोर्ड पर कॉपी किया गया।',
  },
  'share.toast.cancelled': {
    en: 'Share cancelled.',
    fr: 'Partage annulé.',
    sw: 'Imeghairishwa.',
    ha: 'An soke rabawa.',
    tw: 'Yɛatwa kyene.',
    hi: 'साझा रद्द।',
  },
  'share.toast.failed': {
    en: 'Could not share — try again.',
    fr: 'Impossible de partager — réessayez.',
    sw: 'Haikuweza kushiriki — jaribu tena.',
    ha: 'Ba a iya raba ba — sake gwadawa.',
    tw: 'Yɛantumi ankyɛ — sɔ hwɛ bio.',
    hi: 'साझा नहीं कर सका — फिर प्रयास करें।',
  },

  // ── Safety footer + hashtag ──────────────────────────────
  'share.safetyNote': {
    en: 'Only the card text and a Farroway link are shared — never your location, photos, or contact details.',
    fr: 'Seul le texte de la carte et un lien Farroway sont partagés — jamais votre localisation, vos photos ou vos coordonnées.',
    sw: 'Maandishi ya kadi na kiungo cha Farroway tu hushirikishwa — kamwe si eneo lako, picha, au mawasiliano.',
    ha: 'Rubutun katin da hanyar haɗin Farroway kawai ake rabawa — ba wurinka, hotuna, ko bayanan tuntuɓarka ba.',
    tw: 'Card no nsɛm ne Farroway link nko ara na yɛkyɛ — yɛnkyɛ wo baabi, mfoni, anaa wʼɛkwan.',
    hi: 'केवल कार्ड का पाठ और Farroway लिंक साझा किया जाता है — कभी आपका स्थान, फ़ोटो, या संपर्क विवरण नहीं।',
  },
  'share.hashtag': {
    en: '#FarrowayGarden',
    fr: '#JardinFarroway',
    sw: '#BustaniYaFarroway',
    ha: '#LambunFarroway',
    tw: '#FarrowayTuro',
    hi: '#FarrowayGarden',
  },
});

export default SHARE_TRANSLATIONS;
