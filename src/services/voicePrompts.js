/**
 * Voice Prompt Library — production phrase map for farmer voice guidance.
 *
 * Stable key namespaces:
 *   task.*      Farm work actions (water, spray, harvest, etc.)
 *   weather.*   Weather-driven guidance (rain, wind, heat, etc.)
 *   status.*    Farm status updates (on track, needs update, saved, etc.)
 *   nav.*       Navigation & onboarding (welcome, choose crop, etc.)
 *   help.*      Help & error states (retry, offline, support, etc.)
 *
 * Each prompt has:
 *   text:  { en, fr, sw, ha, tw } — spoken text per language
 *   clip:  { tw: '/audio/tw/...' } — prerecorded native speaker audio
 *
 * Twi clips: /public/audio/tw/*.mp3 (native speaker, not synthesized)
 * Fr/Sw/En:  provider neural TTS via /api/v2/tts/synthesize
 * Ha:        browser TTS fallback (no provider support)
 *
 * All text is SHORT and ACTION-FIRST — written for low-literacy farmers.
 * Maximum ~15 words per prompt. Lead with the verb.
 */

// ═══════════════════════════════════════════════════════════════
//  VOICE PROMPTS
// ═══════════════════════════════════════════════════════════════

const VOICE_PROMPTS = {

  // ─── task.* — Farm work actions ─────────────────────────────

  'task.water': {
    text: {
      en: 'Water your crop now. Use clean water.',
      fr: 'Arrosez votre culture maintenant.',
      sw: 'Mwagilia mazao yako sasa. Tumia maji safi.',
      ha: 'Shayar da amfanin ku yanzu.',
      tw: 'Gugu wo nnɔbae seesei. Fa nsuo a ɛho tew.',
    },
    clip: { tw: '/audio/tw/task-water.mp3' },
  },

  'task.plant': {
    text: {
      en: 'Plant your seeds now.',
      fr: 'Plantez vos semences maintenant.',
      sw: 'Panda mbegu zako sasa.',
      ha: 'Shuka iririnku yanzu.',
      tw: 'Dua wo aba no seesei.',
    },
    clip: { tw: '/audio/tw/task-plant.mp3' },
  },

  'task.spray': {
    text: {
      en: 'Spray your field now.',
      fr: 'Pulvérisez votre champ maintenant.',
      sw: 'Nyunyiza shamba lako sasa.',
      ha: 'Fesa gonar ku yanzu.',
      tw: 'Pete aduro gu wo afuo no so seesei.',
    },
    clip: { tw: '/audio/tw/task-spray.mp3' },
  },

  'task.fertilize': {
    text: {
      en: 'Add fertilizer to your crop.',
      fr: 'Ajoutez de l\'engrais à votre culture.',
      sw: 'Weka mbolea kwenye mazao yako.',
      ha: 'Sa taki a gonar ku.',
      tw: 'Gu nsɔhwɛ wo nnɔbae no so.',
    },
    clip: { tw: '/audio/tw/task-fertilize.mp3' },
  },

  'task.weed': {
    text: {
      en: 'Remove weeds from your farm.',
      fr: 'Enlevez les mauvaises herbes.',
      sw: 'Palilia magugu shambani.',
      ha: 'Cire ciyawa daga gona.',
      tw: 'Tu wura fi wo afuo no mu.',
    },
    clip: { tw: '/audio/tw/task-weed.mp3' },
  },

  'task.harvest': {
    text: {
      en: 'Harvest your crop now.',
      fr: 'Récoltez maintenant.',
      sw: 'Vuna mazao yako sasa.',
      ha: 'Girbe amfanin ku yanzu.',
      tw: 'Twa wo nnɔbae no seesei.',
    },
    clip: { tw: '/audio/tw/task-harvest.mp3' },
  },

  'task.prune': {
    text: {
      en: 'Prune your plants. Cut dead branches.',
      fr: 'Taillez vos plantes. Coupez les branches mortes.',
      sw: 'Pogoa mimea yako. Kata matawi yaliyokufa.',
      ha: 'Yanke reshen tsiro. Cire busassun da suka mutu.',
      tw: 'Twa wo nnɔbae no nnan. Twa nnan a awuwu no.',
    },
    clip: { tw: '/audio/tw/task-prune.mp3' },
  },

  'task.scout': {
    text: {
      en: 'Check your crop for problems. Look under the leaves.',
      fr: 'Vérifiez vos cultures. Regardez sous les feuilles.',
      sw: 'Angalia mazao yako kwa matatizo.',
      ha: 'Duba amfanin gona don matsaloli.',
      tw: 'Hwɛ wo nnɔbae mu sɛ asɛm bi wɔ mu. Hwɛ nhahan no ase.',
    },
    clip: { tw: '/audio/tw/task-scout.mp3' },
  },

  'task.clearField': {
    text: {
      en: 'Clear the field. Remove weeds and old plants.',
      fr: 'Nettoyez le champ. Enlevez les mauvaises herbes.',
      sw: 'Safisha shamba. Ondoa magugu na mimea ya zamani.',
      ha: 'Share gona. Cire ciyawa da tsofaffin tsire-tsire.',
      tw: 'Twitwa afuo no mu. Yi nwura ne nnɔbae dedaw no.',
    },
    clip: { tw: '/audio/tw/task-clear-field.mp3' },
  },

  'task.dontWater': {
    text: {
      en: 'Don\'t water now. Rain is coming.',
      fr: 'N\'arrosez pas maintenant. La pluie arrive.',
      sw: 'Usimwagilie sasa. Mvua inakuja.',
      ha: 'Kada ku shayar yanzu. Ruwan sama yana zuwa.',
      tw: 'Ngugu seesei. Nsuo retɔ.',
    },
    clip: { tw: '/audio/tw/task-dont-water.mp3' },
  },

  'task.skipWatering': {
    text: {
      en: 'Skip watering today. Rain will do the job.',
      fr: 'Pas d\'arrosage aujourd\'hui. La pluie s\'en charge.',
      sw: 'Usimwagilie leo. Mvua itafanya kazi.',
      ha: 'Kada ku shayar yau. Ruwan sama zai yi aikin.',
      tw: 'Ngugu ɛnnɛ. Nsuo bɛtɔ ama nnɔbae no.',
    },
    clip: { tw: '/audio/tw/task-skip-watering.mp3' },
  },

  'task.skipSpraying': {
    text: {
      en: 'Don\'t spray now. Too much wind or rain.',
      fr: 'Ne pulvérisez pas maintenant. Trop de vent ou de pluie.',
      sw: 'Usinyunyize sasa. Upepo au mvua nyingi.',
      ha: 'Kada ku fesa yanzu. Iska ko ruwan sama.',
      tw: 'Mfa aduru mfra seesei. Mframa anaa nsuo dɔɔso.',
    },
    clip: { tw: '/audio/tw/task-skip-spraying.mp3' },
  },

  'task.protectHarvest': {
    text: {
      en: 'Protect your harvest from rain. Move grain under cover.',
      fr: 'Protégez la récolte. Mettez les grains à l\'abri.',
      sw: 'Linda mavuno yako. Hamisha nafaka mahali salama.',
      ha: 'Kare girbi daga ruwan sama. Kai hatsi cikin rumbu.',
      tw: 'Bɔ wo nnɔbae ho ban firi nsuo mu. Fa aburow no kɔ baabi a ɛwɔ hɔ.',
    },
    clip: { tw: '/audio/tw/task-protect-harvest.mp3' },
  },

  'task.checkPests': {
    text: {
      en: 'Check your crop for pests. Look under the leaves.',
      fr: 'Vérifiez les ravageurs. Regardez sous les feuilles.',
      sw: 'Angalia wadudu kwenye mazao yako.',
      ha: 'Duba kwari a gonar ku.',
      tw: 'Hwɛ wo nnɔbae so mmoa. Hwɛ nhahan no ase.',
    },
    clip: { tw: '/audio/tw/task-check-pests.mp3' },
  },

  'task.completed': {
    text: {
      en: 'Task completed. Well done!',
      fr: 'Tâche terminée. Bien fait !',
      sw: 'Kazi imekamilika. Umefanya vizuri!',
      ha: 'An gama aikin. An yi kyau!',
      tw: 'Wɔayɛ adwuma no. Mo!',
    },
    clip: { tw: '/audio/tw/task-completed.mp3' },
  },

  'task.default': {
    text: {
      en: 'You have a task to do. Tap when done.',
      fr: 'Vous avez une tâche. Appuyez quand c\'est fait.',
      sw: 'Una kazi ya kufanya. Bonyeza ukimaliza.',
      ha: 'Kana da aiki. Danna idan ka gama.',
      tw: 'Wowɔ adwuma bi. Mia bɔtɔn no sɛ woawie.',
    },
    clip: { tw: '/audio/tw/task-default.mp3' },
  },

  'task.finishSetup': {
    text: {
      en: 'Set up your farm first. Tap the button to start.',
      fr: 'Configurez votre ferme d\'abord. Appuyez pour commencer.',
      sw: 'Weka shamba lako kwanza. Bonyeza kuanza.',
      ha: 'Shirya gonar ka tukuna. Danna don fara.',
      tw: 'Hyehyɛ wo afuo kan. Mia bɔtɔn no na hyɛ ase.',
    },
    clip: { tw: '/audio/tw/task-finish-setup.mp3' },
  },

  'task.setStage': {
    text: {
      en: 'Tell us your crop stage. Tap the button.',
      fr: 'Dites-nous le stade de votre culture. Appuyez.',
      sw: 'Tuambie hatua ya mazao yako. Bonyeza.',
      ha: 'Gaya mana matakin amfanin ku. Danna.',
      tw: 'Ka kyerɛ yɛn wo nnɔbae anammɔn. Mia bɔtɔn no.',
    },
    clip: { tw: '/audio/tw/task-set-stage.mp3' },
  },

  'task.allDone': {
    text: {
      en: 'All tasks done. Well done! You can add an update.',
      fr: 'Tout est fait. Bon travail ! Ajoutez une mise à jour.',
      sw: 'Kazi zote zimekamilika. Unaweza kuongeza sasishi.',
      ha: 'An gama komai. Kyakkyawan aiki!',
      tw: 'Woawie nyinaa. Adwuma pa! Wobɛtumi de nsɛm foforo aka ho.',
    },
    clip: { tw: '/audio/tw/task-all-done.mp3' },
  },

  // ─── weather.* — Weather-driven guidance ────────────────────

  'weather.safe': {
    text: {
      en: 'Weather is good. Safe for all farm work.',
      fr: 'Le temps est bon. Travaillez normalement.',
      sw: 'Hali ya hewa ni nzuri. Salama kwa kazi zote.',
      ha: 'Yanayi ya yi kyau. Lafiya don duk aiki.',
      tw: 'Ewiem yɛ. Wotumi yɛ adwuma biara.',
    },
    clip: { tw: '/audio/tw/weather-safe.mp3' },
  },

  'weather.rainingNow': {
    text: {
      en: 'It is raining now. Protect your harvest. Don\'t spray or dry.',
      fr: 'Il pleut maintenant. Protégez votre récolte.',
      sw: 'Mvua inanyesha sasa. Linda mavuno yako.',
      ha: 'Ana ruwan sama yanzu. Kare girbi.',
      tw: 'Nsuo retɔ seesei. Bɔ wo nnɔbae ho ban.',
    },
    clip: { tw: '/audio/tw/weather-raining-now.mp3' },
  },

  'weather.rainLater': {
    text: {
      en: 'Dry now but rain coming later. Store harvest before rain.',
      fr: 'Sec maintenant mais pluie plus tard. Mettez les grains à l\'abri.',
      sw: 'Kavu sasa lakini mvua inakuja. Hifadhi mavuno.',
      ha: 'Bushe yanzu amma ruwan sama yana zuwa. Ajiye girbi.',
      tw: 'Ɛyɛ hyew seesei nanso nsuo bɛtɔ. Kora wo nnɔbae.',
    },
    clip: { tw: '/audio/tw/weather-rain-later.mp3' },
  },

  'weather.heavyRain': {
    text: {
      en: 'Heavy rain coming. Protect your crop. Stay safe.',
      fr: 'Forte pluie prévue. Protégez votre récolte.',
      sw: 'Mvua kubwa inakuja. Linda mazao yako.',
      ha: 'Ruwan sama mai yawa yana zuwa. Kare amfanin ku.',
      tw: 'Nsuo kɛse reba. Bɔ wo nnɔbae ho ban. Yɛ nwanwa.',
    },
    clip: { tw: '/audio/tw/weather-heavy-rain.mp3' },
  },

  'weather.highWind': {
    text: {
      en: 'Strong wind today. Don\'t spray.',
      fr: 'Vent fort aujourd\'hui. Ne pulvérisez pas.',
      sw: 'Upepo mkali leo. Usinyunyize.',
      ha: 'Iska mai ƙarfi yau. Kada ku fesa.',
      tw: 'Mframa kɛse ɛnnɛ. Mpete aduro.',
    },
    clip: { tw: '/audio/tw/weather-high-wind.mp3' },
  },

  'weather.windySafe': {
    text: {
      en: 'A bit windy but safe for farm work.',
      fr: 'Un peu de vent mais vous pouvez travailler.',
      sw: 'Upepo kidogo lakini salama.',
      ha: 'Dan iska amma lafiya.',
      tw: 'Mframa kakra nanso wotumi yɛ adwuma.',
    },
    clip: { tw: '/audio/tw/weather-windy-safe.mp3' },
  },

  'weather.dry': {
    text: {
      en: 'Dry conditions. Water your crop today.',
      fr: 'Temps sec. Arrosez votre culture aujourd\'hui.',
      sw: 'Hali kavu. Mwagilia mazao yako leo.',
      ha: 'Fari. Shayar da amfanin ku yau.',
      tw: 'Ɛyɛ hyew. Gugu wo nnɔbae ɛnnɛ.',
    },
    clip: { tw: '/audio/tw/weather-dry.mp3' },
  },

  'weather.veryDry': {
    text: {
      en: 'Very dry. Water your crop now.',
      fr: 'Très sec. Arrosez immédiatement.',
      sw: 'Kavu sana. Mwagilia sasa.',
      ha: 'Fari sosai. Shayar da amfanin yanzu.',
      tw: 'Ɛyɛ hyew paa. Gugu wo nnɔbae seesei.',
    },
    clip: { tw: '/audio/tw/weather-very-dry.mp3' },
  },

  'weather.drySpell': {
    text: {
      en: 'Dry spell risk. Water urgently.',
      fr: 'Risque de sécheresse. Arrosez d\'urgence.',
      sw: 'Hatari ya ukame. Mwagilia haraka.',
      ha: 'Haɗarin fari. Shayar da gaggawa.',
      tw: 'Ɔpɛ bɛba. Gugu ntɛm.',
    },
    clip: { tw: '/audio/tw/weather-dry-spell.mp3' },
  },

  'weather.hot': {
    text: {
      en: 'Hot today. Water early morning. Avoid midday sun.',
      fr: 'Chaud aujourd\'hui. Arrosez tôt le matin.',
      sw: 'Joto kali leo. Mwagilia asubuhi.',
      ha: 'Zafi yau. Shayar da safe.',
      tw: 'Ɛyɛ hyew ɛnnɛ. Gugu anɔpa ntɛm. Mfa wo ho mma owia mu.',
    },
    clip: { tw: '/audio/tw/weather-hot.mp3' },
  },

  'weather.noData': {
    text: {
      en: 'No weather data. Continue your normal tasks.',
      fr: 'Pas de données météo. Continuez vos tâches.',
      sw: 'Hakuna data ya hali ya hewa. Endelea kazi.',
      ha: 'Babu bayanan yanayi. Ci gaba da aikinku.',
      tw: 'Yɛnni wim ho nsɛm. Kɔ so yɛ wo adwuma.',
    },
    clip: { tw: '/audio/tw/weather-no-data.mp3' },
  },

  'weather.stale': {
    text: {
      en: 'Weather info may be outdated. Check before you start.',
      fr: 'Données météo peut-être anciennes. Vérifiez avant.',
      sw: 'Taarifa ya hewa inaweza kuwa ya zamani.',
      ha: 'Bayanan yanayi na iya zama tsoho.',
      tw: 'Wim ho nsɛm no ebia atwam. Hwɛ kan ansa na woahyɛ ase.',
    },
    clip: { tw: '/audio/tw/weather-stale.mp3' },
  },

  // ─── status.* — Farm status & confirmations ────────────────

  'status.onTrack': {
    text: {
      en: 'Your farm is on track. Keep going.',
      fr: 'Votre ferme est sur la bonne voie.',
      sw: 'Shamba lako linaendelea vizuri.',
      ha: 'Gonarka na tafiya da kyau.',
      tw: 'Wo kurom rekɔ yiye. Kɔ so.',
    },
    clip: { tw: '/audio/tw/status-on-track.mp3' },
  },

  'status.needsUpdate': {
    text: {
      en: 'Your farm needs an update. Tap add update.',
      fr: 'Votre ferme a besoin d\'une mise à jour.',
      sw: 'Shamba lako linahitaji taarifa mpya.',
      ha: 'Gonarka na bukatar sabuntawa.',
      tw: 'Wo kurom hia nsakrae. Fa ka ho nsakrae.',
    },
    clip: { tw: '/audio/tw/status-needs-update.mp3' },
  },

  'status.needsSetup': {
    text: {
      en: 'Set up your farm to get started.',
      fr: 'Configurez votre ferme pour commencer.',
      sw: 'Andaa shamba lako kuanza.',
      ha: 'Shirya gonar ku don farawa.',
      tw: 'Hyehyɛ wo afuo na hyɛ ase.',
    },
    clip: { tw: '/audio/tw/status-needs-setup.mp3' },
  },

  'status.stageOutdated': {
    text: {
      en: 'Your crop stage is outdated. Update it now.',
      fr: 'Le stade de votre culture est ancien. Mettez à jour.',
      sw: 'Hatua ya zao lako ni ya zamani. Sasisha sasa.',
      ha: 'Matakin amfanin gonarka ya tsufa. Sabunta yanzu.',
      tw: 'Wo nnɔbae anammɔn no atwam. Sesa no seesei.',
    },
    clip: { tw: '/audio/tw/status-stage-outdated.mp3' },
  },

  'status.saved': {
    text: {
      en: 'Saved. Your data is safe.',
      fr: 'Enregistré. Vos données sont en sécurité.',
      sw: 'Imehifadhiwa. Data yako iko salama.',
      ha: 'An adana. Bayananku suna lafiya.',
      tw: 'Wɔakora so. Wo data no wɔ hɔ yiye.',
    },
    clip: { tw: '/audio/tw/status-saved.mp3' },
  },

  'status.savedOffline': {
    text: {
      en: 'Saved offline. Will send when network returns.',
      fr: 'Enregistré hors ligne. Envoi au retour du réseau.',
      sw: 'Imehifadhiwa. Itatumwa mtandao ukirudi.',
      ha: 'An adana. Za a aika idan network ya dawo.',
      tw: 'Wɔakora so. Wɔbɛsoma bere a network aba bio.',
    },
    clip: { tw: '/audio/tw/status-saved-offline.mp3' },
  },

  'status.pending': {
    text: {
      en: 'Your update is waiting for review.',
      fr: 'Votre mise à jour attend vérification.',
      sw: 'Taarifa yako inasubiri kuhakikiwa.',
      ha: 'Sabuntawarka na jiran dubawa.',
      tw: 'Wo nsakrae no retwɛn nhwehwɛmu.',
    },
    clip: { tw: '/audio/tw/status-pending.mp3' },
  },

  'status.failed': {
    text: {
      en: 'That did not work. Try again.',
      fr: 'Échec. Réessayez.',
      sw: 'Haijafanya kazi. Jaribu tena.',
      ha: 'Bai yi aiki ba. Sake gwadawa.',
      tw: 'Ɛanyɛ adwuma. Bɔ mmɔden bio.',
    },
    clip: { tw: '/audio/tw/status-failed.mp3' },
  },

  // ─── nav.* — Navigation & onboarding ────────────────────────

  'nav.welcome': {
    text: {
      en: 'Welcome to your farm.',
      fr: 'Bienvenue sur votre ferme.',
      sw: 'Karibu kwenye shamba lako.',
      ha: 'Barka da zuwa gonar ku.',
      tw: 'Akwaaba wo kurom.',
    },
    clip: { tw: '/audio/tw/nav-welcome.mp3' },
  },

  'nav.welcomeBack': {
    text: {
      en: 'Welcome back.',
      fr: 'Bon retour.',
      sw: 'Karibu tena.',
      ha: 'Barka da dawowa.',
      tw: 'Akwaaba bio.',
    },
    clip: { tw: '/audio/tw/nav-welcome-back.mp3' },
  },

  'nav.setupFarm': {
    text: {
      en: 'Set up your farm. Tell us what you grow.',
      fr: 'Configurez votre ferme. Dites-nous ce que vous cultivez.',
      sw: 'Andaa shamba lako. Tuambie unalima nini.',
      ha: 'Shirya gonar ku. Gaya mana abin da kuke nomawa.',
      tw: 'Yɛ wo afuo ho. Ka aduan a woreyɛ kyerɛ yɛn.',
    },
    clip: { tw: '/audio/tw/nav-setup-farm.mp3' },
  },

  'nav.chooseLanguage': {
    text: {
      en: 'Choose your language.',
      fr: 'Choisissez votre langue.',
      sw: 'Chagua lugha yako.',
      ha: 'Zaɓi harshenka.',
      tw: 'Fa kasa a wopɛ.',
    },
    clip: { tw: '/audio/tw/nav-choose-language.mp3' },
  },

  'nav.chooseCrop': {
    text: {
      en: 'Tap the crop you are growing.',
      fr: 'Choisissez la culture que vous cultivez.',
      sw: 'Chagua zao unalolima.',
      ha: 'Zaɓi amfanin da kake nomawa.',
      tw: 'Fa aduan a woreyɛ.',
    },
    clip: { tw: '/audio/tw/nav-choose-crop.mp3' },
  },

  'nav.chooseStage': {
    text: {
      en: 'Choose your crop stage.',
      fr: 'Choisissez le stade de votre culture.',
      sw: 'Chagua hatua ya zao lako.',
      ha: 'Zaɓi matakin amfanin gonarka.',
      tw: 'Fa wo aduan no gyinabea.',
    },
    clip: { tw: '/audio/tw/nav-choose-stage.mp3' },
  },

  'nav.takePhoto': {
    text: {
      en: 'Take a photo of your farm.',
      fr: 'Prenez une photo de votre ferme.',
      sw: 'Piga picha ya shamba lako.',
      ha: 'Ɗauki hoton gonarka.',
      tw: 'Fa wo kurom mfonini.',
    },
    clip: { tw: '/audio/tw/nav-take-photo.mp3' },
  },

  'nav.tapContinue': {
    text: {
      en: 'Tap continue.',
      fr: 'Appuyez sur continuer.',
      sw: 'Bonyeza kuendelea.',
      ha: 'Danna ci gaba.',
      tw: 'Kɔ so.',
    },
    clip: { tw: '/audio/tw/nav-tap-continue.mp3' },
  },

  'nav.farmReady': {
    text: {
      en: 'Your farm is ready.',
      fr: 'Votre ferme est prête.',
      sw: 'Shamba lako liko tayari.',
      ha: 'Gonarka ta shirya.',
      tw: 'Wo kurom ayɛ krado.',
    },
    clip: { tw: '/audio/tw/nav-farm-ready.mp3' },
  },

  'nav.addUpdate': {
    text: {
      en: 'Tap add update.',
      fr: 'Appuyez ajouter une mise à jour.',
      sw: 'Bonyeza ongeza taarifa.',
      ha: 'Danna ƙara sabuntawa.',
      tw: 'Fa ka ho nsakrae.',
    },
    clip: { tw: '/audio/tw/nav-add-update.mp3' },
  },

  'nav.sendUpdate': {
    text: {
      en: 'Tap send to submit your update.',
      fr: 'Appuyez envoyer.',
      sw: 'Bonyeza tuma.',
      ha: 'Danna aika.',
      tw: 'Fa soma wo nsakrae no.',
    },
    clip: { tw: '/audio/tw/nav-send-update.mp3' },
  },

  // ─── help.* — Help, errors, & guidance ──────────────────────

  'help.needSupport': {
    text: {
      en: 'Tap help if you need support.',
      fr: 'Appuyez aide si vous avez besoin d\'assistance.',
      sw: 'Bonyeza msaada kama unahitaji usaidizi.',
      ha: 'Danna taimako idan kana bukatar tallafi.',
      tw: 'Fa mmoa so sɛ wohia boafo.',
    },
    clip: { tw: '/audio/tw/help-need-support.mp3' },
  },

  'help.retry': {
    text: {
      en: 'That did not work. Tap retry.',
      fr: 'Ça n\'a pas marché. Appuyez réessayer.',
      sw: 'Haijafanya kazi. Bonyeza jaribu tena.',
      ha: 'Bai yi aiki ba. Danna sake gwadawa.',
      tw: 'Ɛanyɛ adwuma. Fa so bio.',
    },
    clip: { tw: '/audio/tw/help-retry.mp3' },
  },

  'help.offline': {
    text: {
      en: 'You are offline. Data is saved and will send later.',
      fr: 'Hors ligne. Données enregistrées, envoi au retour du réseau.',
      sw: 'Huna mtandao. Data imehifadhiwa.',
      ha: 'Ba ka da intanet. An adana bayananku.',
      tw: 'Wonni intanɛt. Wɔakora wo data na wɔbɛsoma akyire.',
    },
    clip: { tw: '/audio/tw/help-offline.mp3' },
  },

  'help.error': {
    text: {
      en: 'Something went wrong. Please try again.',
      fr: 'Quelque chose s\'est mal passé. Réessayez.',
      sw: 'Kuna tatizo. Tafadhali jaribu tena.',
      ha: 'Wani abu ya faru. Da fatan sake gwadawa.',
      tw: 'Biribi akɔ basaa. Meserɛ wo bɔ mmɔden bio.',
    },
    clip: { tw: '/audio/tw/help-error.mp3' },
  },

  'help.photoTip': {
    text: {
      en: 'Take a clear photo. Hold the phone steady.',
      fr: 'Prenez une photo nette. Tenez le téléphone stable.',
      sw: 'Piga picha wazi. Shika simu vizuri.',
      ha: 'Ɗauki hoto mai kyau. Riƙe wayar sosai.',
      tw: 'Fa mfonini a ɛda hɔ. Sɔ telefon no pintinn.',
    },
    clip: { tw: '/audio/tw/help-photo-tip.mp3' },
  },
};

// ═══════════════════════════════════════════════════════════════
//  BRIDGE MAP — maps legacy key systems to prompt IDs
// ═══════════════════════════════════════════════════════════════
//
// Three legacy systems converge here:
//   1. VOICE_MAP keys (voiceGuide.js)    e.g. 'onboarding.welcome'
//   2. task.voice.* i18n keys            e.g. 'task.voice.watering'
//   3. wx.* voice keys (weatherEngine)   e.g. 'wx.safeVoice'
//
// Any key NOT listed here falls through to text-based TTS.

const KEY_TO_PROMPT = {
  // ─── VOICE_MAP keys → prompt IDs ────────────────────────────

  // Onboarding
  'onboarding.welcome':         'nav.welcome',
  'onboarding.language':        'nav.chooseLanguage',
  'onboarding.crop':            'nav.chooseCrop',
  'onboarding.success':         'nav.farmReady',
  'onboarding.photoOptional':   'nav.takePhoto',

  // Farmer home
  'home.welcome':               'nav.welcomeBack',
  'home.status.onTrack':        'status.onTrack',
  'home.status.needsUpdate':    'status.needsUpdate',
  'home.primaryAction.addUpdate': 'nav.addUpdate',
  'home.nextStep.photo':        'nav.takePhoto',
  'home.nextStep.stage':        'nav.chooseStage',
  'home.help':                  'help.needSupport',

  // Update flow
  'update.start':               'status.needsUpdate',
  'update.chooseStage':         'nav.chooseStage',
  'update.takePhoto':           'nav.takePhoto',
  'update.submit':              'nav.sendUpdate',
  'update.success':             'status.saved',
  'update.pendingValidation':   'status.pending',
  'update.savedOffline':        'status.savedOffline',
  'update.failed':              'status.failed',

  // Progress
  'progress.chooseStage':       'nav.chooseStage',
  'progress.saved':             'status.saved',

  // Treatment
  'treatment.saved':            'status.saved',

  // Pest
  'pest.start':                 'task.scout',
  'pest.result.low':            'status.onTrack',

  // Setup
  'setup.welcome':              'nav.setupFarm',
  'setup.saved':                'status.saved',
  'profile.welcome':            'nav.setupFarm',

  // Errors
  'error.general':              'help.error',
  'error.offline':              'help.offline',
  'error.retry':                'help.retry',

  // ─── task.voice.* i18n keys → prompt IDs ────────────────────

  'task.voice.watering':        'task.water',
  'task.voice.planting':        'task.plant',
  'task.voice.spraying':        'task.spray',
  'task.voice.fertilizing':     'task.fertilize',
  'task.voice.weeding':         'task.weed',
  'task.voice.harvest':         'task.harvest',
  'task.voice.pruning':         'task.prune',
  'task.voice.scouting':        'task.scout',
  'task.voice.default':         'task.default',
  'task.voice.finishSetup':     'task.finishSetup',
  'task.voice.setStage':        'task.setStage',
  'task.voice.allDone':         'task.allDone',

  // ─── wx.* voice keys → prompt IDs ──────────────────────────

  'wx.safeVoice':               'weather.safe',
  'wx.rainingNowVoice':         'weather.rainingNow',
  'wx.rainLaterVoice':          'weather.rainLater',
  'wx.heavyRainVoice':          'weather.heavyRain',
  'wx.highWindVoice':           'weather.highWind',
  'wx.windyButSafeVoice':       'weather.windySafe',
  'wx.dryVoice':                'weather.dry',
  'wx.veryDryVoice':            'weather.veryDry',
  'wx.drySpellVoice':           'weather.drySpell',
  'wx.hotVoice':                'weather.hot',
  'wx.noDataVoice':             'weather.noData',
  'wx.staleVoice':              'weather.stale',

  // ─── wxConflict.* voice keys → prompt IDs ──────────────────

  'wxConflict.protectHarvestVoice': 'task.protectHarvest',
  'wxConflict.skipWateringVoice':   'task.skipWatering',
  'wxConflict.skipSprayingVoice':   'task.skipSpraying',

  // ─── farmerActions.* (low-literacy farmer hub tiles) ────────
  // Each mapping points at the closest existing prompt id so that
  // VoiceButton / IconActionCard can hit the prerecorded native-
  // speaker Twi clip + provider neural TTS for en/fr/sw without
  // shipping new audio assets. Mappings are intentionally
  // approximate — the prompts already had short action-first
  // wording compatible with the new keys.
  'farmerActions.home':             'nav.welcomeBack',
  'farmerActions.myFarm':           'nav.farmReady',
  'farmerActions.tasks':            'nav.addUpdate',
  'farmerActions.progress':         'status.onTrack',
  'farmerActions.scanCrop':         'task.scout',
  'farmerActions.takePhoto':        'nav.takePhoto',
  'farmerActions.recordHarvest':    'task.harvest',
  'farmerActions.checkWeather':     'weather.safe',
  'farmerActions.help':             'help.needSupport',
  // Extended bridge: each mapping unlocks the prerecorded Twi clip
  // (when the target prompt ships one) for additional UI keys that
  // VoiceButton / IconActionCard / VoiceAssistant render. The
  // semantic match is deliberate — short imperative phrasing on
  // the prompt side, short imperative phrasing on the i18n side.
  'farmerActions.readyToSell':      'task.harvest',
  'farmerActions.reminders':        'status.needsUpdate',
  'farmerActions.weather':          'weather.safe',
  'farmerActions.addFarm':          'nav.setupFarm',
  'farmerActions.changeFarm':       'nav.chooseStage',
  'farmerActions.nextAction':       'nav.addUpdate',
  'farmerActions.viewTomorrowTask': 'nav.addUpdate',
  'farmerActions.cropStarting':     'status.needsSetup',
  'farmerActions.completeTasksToday': 'task.allDone',
  'farmerActions.checkWeather':     'weather.safe',
  'farmerActions.simpleMode':       'nav.tapContinue',
  'farmerActions.standardMode':     'nav.tapContinue',
  // Voice navigator prompts — speak the floating-mic prompts
  // through the prerecorded path where one exists.
  'voiceNav.prompt':                'nav.tapContinue',
  'voiceNav.notUnderstood':         'help.retry',
  'voiceNav.listening':             'nav.tapContinue',
  // Common controls heard during the low-literacy flows.
  'common.listen':                  'nav.tapContinue',
  'common.startVoiceInput':         'nav.tapContinue',
};

// ═══════════════════════════════════════════════════════════════
//  PUBLIC API
// ═══════════════════════════════════════════════════════════════

/**
 * Resolve any key (legacy or prompt ID) to a canonical prompt ID.
 * Returns the prompt ID if found, or null if no mapping exists.
 *
 * @param {string} key — prompt ID, VOICE_MAP key, task.voice.* key, or wx.* key
 * @returns {string|null}
 */
export function resolvePromptId(key) {
  if (!key) return null;
  // Direct prompt ID match
  if (VOICE_PROMPTS[key]) return key;
  // Bridge lookup
  return KEY_TO_PROMPT[key] || null;
}

/**
 * Get a voice prompt by its ID.
 * @param {string} promptId - e.g. 'task.water'
 * @returns {object|null} { text: {en, fr, sw, ha, tw}, clip: {tw: '...'} }
 */
export function getVoicePrompt(promptId) {
  return VOICE_PROMPTS[promptId] || null;
}

/**
 * Get the text for a prompt in a specific language.
 * Falls back to English if language not available.
 * @param {string} promptId
 * @param {string} lang - 'en'|'fr'|'sw'|'ha'|'tw'
 * @returns {string|null}
 */
export function getPromptText(promptId, lang = 'en') {
  const prompt = VOICE_PROMPTS[promptId];
  if (!prompt) return null;
  return prompt.text[lang] || prompt.text.en || null;
}

/**
 * Get the prerecorded clip URL for a prompt in a specific language.
 * @param {string} promptId
 * @param {string} lang
 * @returns {string|null} URL path like '/audio/tw/task-water.mp3'
 */
export function getPromptClip(promptId, lang = 'tw') {
  const prompt = VOICE_PROMPTS[promptId];
  if (!prompt || !prompt.clip) return null;
  return prompt.clip[lang] || null;
}

/**
 * Get all prompt IDs.
 * @returns {string[]}
 */
export function getAllPromptIds() {
  return Object.keys(VOICE_PROMPTS);
}

/**
 * Get all prompt IDs in a namespace (e.g. 'task', 'weather').
 * @param {string} namespace
 * @returns {string[]}
 */
export function getPromptsByNamespace(namespace) {
  const prefix = namespace + '.';
  return Object.keys(VOICE_PROMPTS).filter(k => k.startsWith(prefix));
}

/**
 * Map a legacy key to a prompt ID.
 * @deprecated Use resolvePromptId() instead.
 */
export function mapVoiceKeyToPrompt(key) {
  return resolvePromptId(key);
}

export { VOICE_PROMPTS, KEY_TO_PROMPT };
