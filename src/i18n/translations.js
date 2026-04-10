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
  'common.cancel': {
    en: 'Cancel', fr: 'Annuler', sw: 'Ghairi', ha: 'Soke', tw: 'Gyae',
  },
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
    en: 'Or type: e.g. Nakuru, Kenya', fr: 'Ou tapez : ex. Bamako, Mali', sw: 'Au andika: mfano Nakuru, Kenya', ha: 'Ko rubuta: misali Kano, Nigeria', tw: 'Anaa kyerɛw: sɛ Kumasi, Ghana',
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

  'sync.offline': {
    en: 'You are offline — changes will sync when reconnected', fr: 'Vous êtes hors ligne — les changements se synchroniseront', sw: 'Uko nje ya mtandao — mabadiliko yatasawazishwa ukirejea', ha: 'Ba ku da layi — canje-canje za su daidaita idan kun dawo', tw: 'Intanɛt nni hɔ — nsɛm no bɛyɛ sɛnti wo de intanɛt a',
  },
  'sync.pendingOne': {
    en: '{count} update waiting to sync', fr: '{count} mise à jour en attente', sw: '{count} sasishi linasubiri kusawazishwa', ha: '{count} sabuntawa tana jiran daidaitawa', tw: '{count} nsɛm retwɛn sɛnti',
  },
  'sync.pendingMany': {
    en: '{count} updates waiting to sync', fr: '{count} mises à jour en attente', sw: '{count} masasisho yanasubiri kusawazishwa', ha: '{count} sabuntawa suna jiran daidaitawa', tw: '{count} nsɛm retwɛn sɛnti',
  },
  'sync.syncNow': {
    en: 'Sync Now', fr: 'Synchroniser', sw: 'Sawazisha Sasa', ha: 'Daidaita Yanzu', tw: 'Yɛ sɛnti seesei',
  },
  'sync.syncing': {
    en: 'Syncing changes...', fr: 'Synchronisation en cours...', sw: 'Inasawazisha mabadiliko...', ha: 'Ana daidaita canje-canje...', tw: 'Ɛreyɛ sɛnti...',
  },
  'sync.failedOne': {
    en: '{count} update failed to sync', fr: '{count} mise à jour a échoué', sw: '{count} sasishi limeshindwa kusawazishwa', ha: '{count} sabuntawa ta gaza', tw: '{count} nsɛm antumi anyɛ sɛnti',
  },
  'sync.failedMany': {
    en: '{count} updates failed to sync', fr: '{count} mises à jour ont échoué', sw: '{count} masasisho yameshindwa kusawazishwa', ha: '{count} sabuntawa sun gaza', tw: '{count} nsɛm antumi anyɛ sɛnti',
  },
  'sync.syncedOne': {
    en: '{count} update synced', fr: '{count} mise à jour synchronisée', sw: '{count} sasishi limesawazishwa', ha: '{count} sabuntawa an daidaita', tw: '{count} nsɛm ayɛ sɛnti',
  },
  'sync.syncedMany': {
    en: '{count} updates synced', fr: '{count} mises à jour synchronisées', sw: '{count} masasisho yamesawazishwa', ha: '{count} sabuntawa an daidaita', tw: '{count} nsɛm ayɛ sɛnti',
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
    en: 'e.g. Sunrise Farm', fr: 'ex. Ferme Soleil', sw: 'mfano Shamba la Jua', ha: 'misali Gonar Alfijir', tw: 'sɛ Afuo Anɔpa',
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
    en: 'e.g. hybrid, OPV', fr: 'ex. hybride, OPV', sw: 'mfano mseto, OPV', ha: 'misali haɗe, OPV', tw: 'sɛ hybrid, OPV',
  },
  'progress.egMaizeForFood': {
    en: 'e.g. Maize for food and sale', fr: 'ex. Maïs pour consommation et vente', sw: 'mfano Mahindi kwa chakula na mauzo', ha: 'misali Masara don ci da sayarwa', tw: 'sɛ Aburo adi ne tɔn',
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
};

export default T;
