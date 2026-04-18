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

  'common.continue': {
    en: 'Continue', fr: 'Continuer', sw: 'Endelea', ha: 'Ci gaba', tw: 'Toa so',
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
    en: 'Monitor your planting', fr: 'Surveillez vos semis', sw: 'Fuatilia upanzi wako', ha: 'Lura da shukar ka', tw: 'Hwɛ wo duadua so',
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
    en: 'Monitor flowering progress', fr: 'Suivez la floraison', sw: 'Fuatilia maendeleo ya maua', ha: 'Lura da ci gaban fure', tw: 'Hwɛ nhwiren nkɔsoɔ',
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
    en: 'Need Help?', fr: 'Besoin d\'aide ?', sw: 'Unahitaji msaada?', ha: 'Kana buƙatar taimako?', tw: 'Wohia mmoa?',
  },
  'support.desc': {
    en: 'Send us a message and our team will respond as soon as possible.', fr: 'Envoyez-nous un message et notre équipe répondra rapidement.', sw: 'Tutumie ujumbe na timu yetu itajibu haraka.', ha: 'Aiko mana saƙo ƙungiyar mu za ta amsa da wuri.', tw: 'Fa nkra brɛ yɛn na yɛn kuw bɛyi ano ntɛm.',
  },
  'support.sent': {
    en: 'Support request sent. We will get back to you soon.', fr: 'Demande envoyée. Nous reviendrons vers vous bientôt.', sw: 'Ombi la msaada limetumwa. Tutakujibu hivi karibuni.', ha: 'An aika buƙatun taimako. Za mu dawo maka ba da jimawa ba.', tw: 'Wɔde mmoa abisadeɛ akɔ. Yɛbɛsan wo nkyɛn ntɛm.',
  },
  'support.failed': {
    en: 'Failed to send request', fr: 'Échec de l\'envoi', sw: 'Imeshindikana kutuma ombi', ha: 'An kasa aika buƙata', tw: 'Entumi amfa abisadeɛ ankɔ',
  },
  'support.subject': {
    en: 'Subject', fr: 'Sujet', sw: 'Mada', ha: 'Batu', tw: 'Asɛm tiawa',
  },
  'support.describe': {
    en: 'Describe your issue...', fr: 'Décrivez votre problème...', sw: 'Eleza tatizo lako...', ha: 'Bayyana matsalar ka...', tw: 'Ka wo ɔhaw ho nsɛm...',
  },
  'support.sending': {
    en: 'Sending...', fr: 'Envoi en cours...', sw: 'Inatuma...', ha: 'Ana aikawa...', tw: 'Ɛrede kɔ...',
  },
  'support.sendRequest': {
    en: 'Send Request', fr: 'Envoyer', sw: 'Tuma ombi', ha: 'Aika buƙata', tw: 'Fa abisadeɛ kɔ',
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
    en: 'Some signs to watch. Monitor closely.', fr: 'Quelques signes à surveiller.', sw: 'Dalili za kufuatilia. Endelea kuangalia.', ha: 'Wasu alamun da za a lura. Ci gaba da kula.', tw: 'Nsɛnkyerɛnne bi wɔ hɔ. Hwɛ so yiye.',
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
  'success.general': { en: 'Done — good work.', fr: 'Fait — bon travail.', sw: 'Imekamilika — kazi nzuri.', ha: 'An gama — aikin kirki.', tw: 'Awie — adwuma pa.' },

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
  'cropFit.q.experience': { en: 'How much farming experience do you have?', fr: 'Quelle est votre expérience agricole ?', sw: 'Una uzoefu kiasi gani wa kilimo?', ha: 'Kana da ƙwarewar noma nawa?', tw: 'Wowɔ adwumayɛ mu nimdeɛ dodoɔ bɛn wɔ afuoyɛ mu?' },
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
  'cropFit.exp.none': { en: 'I\'m completely new', fr: 'Je suis débutant', sw: 'Mimi ni mpya kabisa', ha: 'Ni sabon shiga ne', tw: 'Meyɛ ɔfoforɔ koraa' },
  'cropFit.exp.some': { en: 'I\'ve grown something before', fr: 'J\'ai déjà cultivé', sw: 'Nimeshawahi kulima', ha: 'Na taɓa noma', tw: 'Madua biribi bi da' },
  'cropFit.exp.experienced': { en: 'I farm regularly', fr: 'Je cultive régulièrement', sw: 'Ninalima mara kwa mara', ha: 'Ina noma kullum', tw: 'Meyɛ afuoyɛ daa' },

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
  'cropFit.results.subtitle': { en: 'Based on your answers, here are our recommendations.', fr: 'Voici nos recommandations selon vos réponses.', sw: 'Kulingana na majibu yako, hizi ndizo mapendekezo yetu.', ha: 'Bisa ga amsoshin ku, ga shawarwarinmu.', tw: 'Sɛ wo mmuaeɛ te no, yei ne yɛn nkamfo.' },
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
  'cropFit.hint.location': { en: 'This helps us match crops to your climate.', fr: 'Cela aide à trouver les cultures adaptées à votre climat.', sw: 'Hii inasaidia kupata mazao yanayofaa hali ya hewa yako.', ha: 'Wannan yana taimaka mana samun amfanin gona masu dacewa da yanayin ku.', tw: 'Eyi boa yɛn hwehwɛ nnɔbae a ɛfata wo wim tebea.' },
  'cropFit.loc.eastAfrica': { en: 'East Africa (Kenya, Tanzania, Uganda...)', fr: 'Afrique de l\'Est (Kenya, Tanzanie, Ouganda...)', sw: 'Afrika Mashariki (Kenya, Tanzania, Uganda...)', ha: 'Gabashin Afrika (Kenya, Tanzania, Uganda...)', tw: 'Apueeɛ Afrika (Kenya, Tanzania, Uganda...)' },
  'cropFit.loc.westAfrica': { en: 'West Africa (Nigeria, Ghana, Senegal...)', fr: 'Afrique de l\'Ouest (Nigéria, Ghana, Sénégal...)', sw: 'Afrika Magharibi (Nigeria, Ghana, Senegal...)', ha: 'Yammacin Afrika (Nijeriya, Ghana, Senegal...)', tw: 'Atɔeɛ Afrika (Nigeria, Ghana, Senegal...)' },
  'cropFit.loc.southernAfrica': { en: 'Southern Africa (Zambia, Malawi, Zimbabwe...)', fr: 'Afrique australe (Zambie, Malawi, Zimbabwe...)', sw: 'Kusini mwa Afrika (Zambia, Malawi, Zimbabwe...)', ha: 'Kudancin Afrika (Zambia, Malawi, Zimbabwe...)', tw: 'Anafoɔ Afrika (Zambia, Malawi, Zimbabwe...)' },
  'cropFit.loc.centralAfrica': { en: 'Central Africa (DRC, Cameroon, Congo...)', fr: 'Afrique centrale (RDC, Cameroun, Congo...)', sw: 'Afrika ya Kati (DRC, Kamerun, Kongo...)', ha: 'Tsakiyar Afrika (DRC, Kamaru, Kongo...)', tw: 'Mfinimfini Afrika (DRC, Cameroon, Congo...)' },
  'cropFit.loc.other': { en: 'Other region', fr: 'Autre région', sw: 'Eneo lingine', ha: 'Wani yanki', tw: 'Beaeɛ foforɔ' },

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
};

export default T;
