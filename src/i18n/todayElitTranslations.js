/**
 * todayElitTranslations.js — i18n overlay for the elite-UX
 * Today screen.
 *
 *   src/pages/Today.jsx
 *   src/components/MainTaskCard.jsx
 *   src/components/TaskActions.jsx
 *   src/components/ProgressBar.jsx
 *   src/components/ScanCropCta.jsx
 *   src/core/farroway/taskDetails.js
 *
 * Empty-slot fill via mergeManyOverlays — translator-authored
 * values still win.
 *
 * Strict-rule audit
 *   * Six launch locales (en/fr/sw/ha/tw/hi).
 *   * Every key carries a calibrated, supportive English fallback
 *     so a missing locale renders correct calm copy, never
 *     "[MISSING:key]" or a humanized leak.
 *   * {crop} and {count} placeholders are interpolated by the
 *     caller via a simple .replace — locale strings should keep
 *     the placeholder verbatim so the substitution lands in the
 *     right grammatical position.
 *   * Mobile-first: short phrasing per row so the translation
 *     fits on one phone-width line in most locales.
 */

export const TODAY_ELITE_TRANSLATIONS = Object.freeze({
  en: {
    // Header + chrome
    'today.task.instruction.label':  'How',
    'today.task.timing.label':       'When',
    'today.task.risk.label':         'Why it matters',
    'today.doneNow':                 'Done now',
    'today.feedback.body':           'Good work. Progress updated.',
    'today.scan.cta':                'See something wrong? Scan your crop',

    // Progress
    'today.progress.tasksDoneToday':     '{count} tasks done today',
    'today.progress.tasksDoneSingular':  '1 task done today',
    'today.progress.statusGreat':        'Great pace, keep going.',
    'today.progress.statusOnTrack':      'You\u2019re on track.',
    'today.progress.statusStart':        'Pick one task to start.',
    'today.progress.streak':             '{count} day streak',

    // Task details — prepare_rows
    'today.task.prepareRows.title':       'Prepare rows for {crop}',
    'today.task.prepareRows.instruction': 'Make rows ~75cm apart.',
    'today.task.prepareRows.timing':      'Do this before rain starts today.',
    'today.task.prepareRows.risk':        'If you skip this, planting may be delayed.',

    // Task details — weed_rows
    'today.task.weedRows.title':       'Weed your rows for {crop}',
    'today.task.weedRows.instruction': 'Pull weeds between rows with your hand or a hoe.',
    'today.task.weedRows.timing':      'Do this in the morning before the heat.',
    'today.task.weedRows.risk':        'If you skip this, weeds will steal water and food from your crops.',

    // Task details — scout_pests
    'today.task.scoutPests.title':       'Check for pests on your {crop}',
    'today.task.scoutPests.instruction': 'Look at the leaves and stems closely. Check the underside of leaves.',
    'today.task.scoutPests.timing':      'Do this today \u2014 pests spread fast.',
    'today.task.scoutPests.risk':        'If you skip this, pests can damage your harvest.',

    // Task details — check_moisture
    'today.task.checkMoisture.title':       'Check soil moisture for {crop}',
    'today.task.checkMoisture.instruction': 'Push your finger into the soil. It should be damp, not dry.',
    'today.task.checkMoisture.timing':      'Do this before watering today.',
    'today.task.checkMoisture.risk':        'If the soil is too dry, your crops will stress and grow slowly.',

    // Task details — prepare_harvest
    'today.task.prepareHarvest.title':       'Prepare for harvesting {crop}',
    'today.task.prepareHarvest.instruction': 'Get bags or baskets ready and clear a dry storage spot.',
    'today.task.prepareHarvest.timing':      'Do this in the next day or two.',
    'today.task.prepareHarvest.risk':        'If you wait too long, your harvest may spoil or get pests.',

    // Task details — check_farm (default fallback)
    'today.task.checkFarm.title':       'Check your farm today',
    'today.task.checkFarm.instruction': 'Walk through your field and look at your crops.',
    'today.task.checkFarm.timing':      'A short check anytime today is enough.',
    'today.task.checkFarm.risk':        'A daily look helps you catch problems early.',
  },

  fr: {
    'today.task.instruction.label':  'Comment',
    'today.task.timing.label':       'Quand',
    'today.task.risk.label':         'Pourquoi c\u2019est important',
    'today.doneNow':                 'Termin\u00E9',
    'today.feedback.body':           'Bon travail. Progression mise \u00E0 jour.',
    'today.scan.cta':                'Vous voyez un probl\u00E8me\u00A0? Scannez votre culture',

    'today.progress.tasksDoneToday':     '{count} t\u00E2ches faites aujourd\u2019hui',
    'today.progress.tasksDoneSingular':  '1 t\u00E2che faite aujourd\u2019hui',
    'today.progress.statusGreat':        'Excellent rythme, continuez.',
    'today.progress.statusOnTrack':      'Vous \u00EAtes sur la bonne voie.',
    'today.progress.statusStart':        'Choisissez une t\u00E2che pour commencer.',
    'today.progress.streak':             '{count} jours d\u2019affil\u00E9e',

    'today.task.prepareRows.title':       'Pr\u00E9parer les rangs pour {crop}',
    'today.task.prepareRows.instruction': 'Espacez les rangs d\u2019environ 75\u00A0cm.',
    'today.task.prepareRows.timing':      'Faites-le avant que la pluie ne commence aujourd\u2019hui.',
    'today.task.prepareRows.risk':        'Si vous l\u2019ignorez, le semis pourrait \u00EAtre retard\u00E9.',

    'today.task.weedRows.title':       'D\u00E9sherber les rangs pour {crop}',
    'today.task.weedRows.instruction': 'Arrachez les mauvaises herbes \u00E0 la main ou avec une houe.',
    'today.task.weedRows.timing':      'Faites-le le matin avant la chaleur.',
    'today.task.weedRows.risk':        'Sinon, les mauvaises herbes voleront l\u2019eau et la nourriture de vos cultures.',

    'today.task.scoutPests.title':       'Cherchez des nuisibles sur votre {crop}',
    'today.task.scoutPests.instruction': 'Regardez les feuilles et les tiges de pr\u00E8s. V\u00E9rifiez le dessous des feuilles.',
    'today.task.scoutPests.timing':      'Faites-le aujourd\u2019hui \u2014 les nuisibles se propagent vite.',
    'today.task.scoutPests.risk':        'Sinon, les nuisibles peuvent ab\u00EEmer votre r\u00E9colte.',

    'today.task.checkMoisture.title':       'V\u00E9rifiez l\u2019humidit\u00E9 du sol pour {crop}',
    'today.task.checkMoisture.instruction': 'Enfoncez votre doigt dans le sol. Il doit \u00EAtre humide, pas sec.',
    'today.task.checkMoisture.timing':      'Faites-le avant d\u2019arroser aujourd\u2019hui.',
    'today.task.checkMoisture.risk':        'Si le sol est trop sec, vos cultures pousseront lentement.',

    'today.task.prepareHarvest.title':       'Pr\u00E9parez la r\u00E9colte de {crop}',
    'today.task.prepareHarvest.instruction': 'Pr\u00E9parez sacs et paniers et nettoyez un coin sec pour le stockage.',
    'today.task.prepareHarvest.timing':      'Faites-le dans un jour ou deux.',
    'today.task.prepareHarvest.risk':        'Si vous attendez trop, votre r\u00E9colte peut s\u2019ab\u00EEmer.',

    'today.task.checkFarm.title':       'V\u00E9rifiez votre ferme aujourd\u2019hui',
    'today.task.checkFarm.instruction': 'Marchez dans votre champ et regardez vos cultures.',
    'today.task.checkFarm.timing':      'Une br\u00E8ve visite aujourd\u2019hui suffit.',
    'today.task.checkFarm.risk':        'Une visite quotidienne vous aide \u00E0 d\u00E9tecter les probl\u00E8mes t\u00F4t.',
  },

  sw: {
    'today.task.instruction.label':  'Jinsi',
    'today.task.timing.label':       'Lini',
    'today.task.risk.label':         'Kwa nini ni muhimu',
    'today.doneNow':                 'Imekamilika',
    'today.feedback.body':           'Kazi nzuri. Maendeleo yamesasishwa.',
    'today.scan.cta':                'Umeona tatizo? Skani mazao yako',

    'today.progress.tasksDoneToday':     'Kazi {count} zimekamilika leo',
    'today.progress.tasksDoneSingular':  'Kazi 1 imekamilika leo',
    'today.progress.statusGreat':        'Kasi nzuri, endelea.',
    'today.progress.statusOnTrack':      'Uko kwenye njia sahihi.',
    'today.progress.statusStart':        'Chagua kazi moja kuanza.',
    'today.progress.streak':             'Siku {count} mfululizo',

    'today.task.prepareRows.title':       'Andaa mistari kwa ajili ya {crop}',
    'today.task.prepareRows.instruction': 'Weka mistari umbali wa takriban sm 75.',
    'today.task.prepareRows.timing':      'Fanya hivi kabla mvua haijaanza leo.',
    'today.task.prepareRows.risk':        'Ukikosa hili, kupanda kunaweza kuchelewa.',

    'today.task.weedRows.title':       'Palilia mistari ya {crop}',
    'today.task.weedRows.instruction': 'Ng\u02BCoa magugu kati ya mistari kwa mkono au jembe.',
    'today.task.weedRows.timing':      'Fanya hivi asubuhi kabla ya joto.',
    'today.task.weedRows.risk':        'Ukikosa hili, magugu yataiba maji na chakula cha mazao yako.',

    'today.task.scoutPests.title':       'Tafuta wadudu kwenye {crop}',
    'today.task.scoutPests.instruction': 'Angalia majani na mashina kwa makini. Pia chini ya majani.',
    'today.task.scoutPests.timing':      'Fanya hivi leo \u2014 wadudu husambaa haraka.',
    'today.task.scoutPests.risk':        'Ukikosa hili, wadudu wanaweza kuharibu mavuno.',

    'today.task.checkMoisture.title':       'Angalia unyevu wa udongo kwa {crop}',
    'today.task.checkMoisture.instruction': 'Sukuma kidole chako udongoni. Unapaswa kuwa na unyevu, si mkavu.',
    'today.task.checkMoisture.timing':      'Fanya hivi kabla ya kumwagilia leo.',
    'today.task.checkMoisture.risk':        'Udongo mkavu sana hudhoofisha mazao yako.',

    'today.task.prepareHarvest.title':       'Jiandae kuvuna {crop}',
    'today.task.prepareHarvest.instruction': 'Andaa mifuko au vikapu na safisha mahali pakavu pa kuhifadhi.',
    'today.task.prepareHarvest.timing':      'Fanya hivi siku moja au mbili zijazo.',
    'today.task.prepareHarvest.risk':        'Ukisubiri muda mrefu, mavuno yanaweza kuharibika.',

    'today.task.checkFarm.title':       'Angalia shamba lako leo',
    'today.task.checkFarm.instruction': 'Tembea shambani na uangalie mazao yako.',
    'today.task.checkFarm.timing':      'Ukaguzi mfupi wakati wowote leo unatosha.',
    'today.task.checkFarm.risk':        'Ukaguzi wa kila siku husaidia kugundua matatizo mapema.',
  },

  ha: {
    'today.task.instruction.label':  'Yadda',
    'today.task.timing.label':       'Lokacin',
    'today.task.risk.label':         'Don me yake da muhimmanci',
    'today.doneNow':                 'An kammala',
    'today.feedback.body':           'Aiki nagari. An sabunta ci gaba.',
    'today.scan.cta':                'Ka ga matsala? Duba amfanin gonarka',

    'today.progress.tasksDoneToday':     'Ayyuka {count} an gama yau',
    'today.progress.tasksDoneSingular':  'Aiki 1 an gama yau',
    'today.progress.statusGreat':        'Sauri mai kyau, ci gaba.',
    'today.progress.statusOnTrack':      'Kana kan turba.',
    'today.progress.statusStart':        'Zabi aiki guda don farawa.',
    'today.progress.streak':             'Kwanaki {count} jere',

    'today.task.prepareRows.title':       'Shirya layuka don {crop}',
    'today.task.prepareRows.instruction': 'Yi layuka kusan sm 75 nesa.',
    'today.task.prepareRows.timing':      'Yi haka kafin ruwa ya fara yau.',
    'today.task.prepareRows.risk':        'Idan ka tsallake wannan, shukar na iya jinkirta.',

    'today.task.weedRows.title':       'Ciyawa layukan {crop}',
    'today.task.weedRows.instruction': 'Cire ciyawa tsakanin layuka da hannu ko fartanya.',
    'today.task.weedRows.timing':      'Yi haka da safe kafin zafi.',
    'today.task.weedRows.risk':        'Idan ka tsallake, ciyawa za ta sace ruwa da abinci.',

    'today.task.scoutPests.title':       'Bincika kwari a {crop}',
    'today.task.scoutPests.instruction': 'Duba ganye da kara da kyau. Duba kasan ganye.',
    'today.task.scoutPests.timing':      'Yi haka yau \u2014 kwari na yaduwa da sauri.',
    'today.task.scoutPests.risk':        'Idan ka tsallake, kwari na iya lalata girbi.',

    'today.task.checkMoisture.title':       'Duba ruwan kasa don {crop}',
    'today.task.checkMoisture.instruction': 'Sa yatsa cikin kasa. Ya kamata ta zama m\u0257oye, ba bushe ba.',
    'today.task.checkMoisture.timing':      'Yi haka kafin ban ruwa yau.',
    'today.task.checkMoisture.risk':        'Idan kasa ta yi bushe sosai, amfani zai girma a hankali.',

    'today.task.prepareHarvest.title':       'Shirya don girbin {crop}',
    'today.task.prepareHarvest.instruction': 'Shirya buhuna ko kwanduna ka tsabtace wuri busasshen ajiya.',
    'today.task.prepareHarvest.timing':      'Yi haka cikin kwana \u0257aya ko biyu masu zuwa.',
    'today.task.prepareHarvest.risk':        'Idan ka jira da yawa, girbinka na iya lalacewa.',

    'today.task.checkFarm.title':       'Duba gonarka yau',
    'today.task.checkFarm.instruction': 'Tafi cikin gona ka duba amfaninka.',
    'today.task.checkFarm.timing':      'Dubawa gajere lokacin da kake so yau ya isa.',
    'today.task.checkFarm.risk':        'Dubawa kullum yana taimakawa wajen gano matsaloli da wuri.',
  },

  tw: {
    'today.task.instruction.label':  '\u0186kwan',
    'today.task.timing.label':       'B\u025Br\u025B b\u025Bn',
    'today.task.risk.label':         'D\u025Bn nti na \u025Bh\u025B',
    'today.doneNow':                 'Aw\u02BDie',
    'today.feedback.body':           'Adwuma pa. Anidaso\u025B nso.',
    'today.scan.cta':                'Wo h\u02BC asɛm? Hw\u025B w\u02BCafoa',

    'today.progress.tasksDoneToday':     'Adwuma {count} aw\u02BDie nn\u025B',
    'today.progress.tasksDoneSingular':  'Adwuma 1 aw\u02BDie nn\u025B',
    'today.progress.statusGreat':        '\u0186kwan pa, k\u0254 so.',
    'today.progress.statusOnTrack':      'Wo wɔ \u0254kwan pa so.',
    'today.progress.statusStart':        'Yi adwuma baako fi ase.',
    'today.progress.streak':             'Nna {count} a w\u02BCa to',

    'today.task.prepareRows.title':       'Si\u025Bs\u025B nsen ma {crop}',
    'today.task.prepareRows.instruction': 'Yɛ nsen no sm 75 nsensan ne ho.',
    'today.task.prepareRows.timing':      'Y\u025B no ansa na nsuo de aba nn\u025B.',
    'today.task.prepareRows.risk':        'S\u025B woaka eyi a, dua bere b\u025By\u025B akyiri.',

    'today.task.weedRows.title':       'Worɔ {crop} nsen mu',
    'today.task.weedRows.instruction': 'Twa nwura wɔ nsen ntam de wo nsa anaa\u02BCas\u025Bma.',
    'today.task.weedRows.timing':      'Y\u025B no anɔpa ansa na hyew aba.',
    'today.task.weedRows.risk':        'S\u025B woaka, nwura b\u025Bw\u02BCia wo afoa nsuo ne aduane.',

    'today.task.scoutPests.title':       'Hw\u025B mmoawa wɔ wo {crop} so',
    'today.task.scoutPests.instruction': 'Hw\u025B nhwiren ne nnu\u025B yiye. Hw\u025B nhwiren ase nso.',
    'today.task.scoutPests.timing':      'Y\u025B no nn\u025B \u2014 mmoawa tu trew ntɛm.',
    'today.task.scoutPests.risk':        'S\u025B woaka eyi a, mmoawa b\u025Bs\u025Be wo otwa.',

    'today.task.checkMoisture.title':       'Hw\u025B fa\u02BD ho dɔm ma {crop}',
    'today.task.checkMoisture.instruction': 'Fa wo nsateaa hy\u025B fa\u02BD mu. \u0190s\u025By\u025B fa, na \u025Bnny\u025Bk\u0254.',
    'today.task.checkMoisture.timing':      'Y\u025B no ansa na woagugu nsuo nn\u025B.',
    'today.task.checkMoisture.risk':        'S\u025B fa\u02BD k\u0254 dɔm dodow a, w\u02BCafoa b\u025Bnyini ka kakra.',

    'today.task.prepareHarvest.title':       'Si\u025Bs\u025B sɛ wo betwa {crop}',
    'today.task.prepareHarvest.instruction': 'Boa nkotoku ne mpaem ho na pra dabea a awo nsuo.',
    'today.task.prepareHarvest.timing':      'Y\u025B no nn\u025B anaa \u0254kyena.',
    'today.task.prepareHarvest.risk':        'S\u025B wotw\u025Bn aky\u025Bn so a, otwa no b\u025Bs\u025Be.',

    'today.task.checkFarm.title':       'Hw\u025B w\u02BCafuo nn\u025B',
    'today.task.checkFarm.instruction': 'N\u025Bnt\u025B wo afoa mu na hw\u025B wo afodu\u025B.',
    'today.task.checkFarm.timing':      'Hw\u025B kakra wɔ b\u025Br\u025B biara nn\u025B b\u025Bso.',
    'today.task.checkFarm.risk':        'Hw\u025Bhw\u025Bmu daa boa wo huu nsɛm ntɛm.',
  },

  hi: {
    'today.task.instruction.label':  'कैसे',
    'today.task.timing.label':       'कब',
    'today.task.risk.label':         'क्यों ज़रूरी है',
    'today.doneNow':                 'अभी हो गया',
    'today.feedback.body':           'अच्छा काम। प्रगति अपडेट हो गई।',
    'today.scan.cta':                'कुछ गलत दिख रहा है? अपनी फसल स्कैन करें',

    'today.progress.tasksDoneToday':     'आज {count} काम पूरे',
    'today.progress.tasksDoneSingular':  'आज 1 काम पूरा',
    'today.progress.statusGreat':        'बढ़िया गति, जारी रखें।',
    'today.progress.statusOnTrack':      'आप सही रास्ते पर हैं।',
    'today.progress.statusStart':        'शुरू करने के लिए एक काम चुनें।',
    'today.progress.streak':             '{count} दिन की स्ट्रीक',

    'today.task.prepareRows.title':       '{crop} के लिए क्यारियाँ तैयार करें',
    'today.task.prepareRows.instruction': 'क्यारियाँ लगभग 75 सेमी अलग बनाएँ।',
    'today.task.prepareRows.timing':      'आज बारिश शुरू होने से पहले यह करें।',
    'today.task.prepareRows.risk':        'यदि आप यह छोड़ दें, तो बुवाई में देरी हो सकती है।',

    'today.task.weedRows.title':       '{crop} की पंक्तियों से खरपतवार निकालें',
    'today.task.weedRows.instruction': 'पंक्तियों के बीच से खरपतवार हाथ या कुदाल से निकालें।',
    'today.task.weedRows.timing':      'गर्मी से पहले सुबह यह करें।',
    'today.task.weedRows.risk':        'यदि आप छोड़ दें, खरपतवार आपकी फसल का पानी और भोजन ले लेंगे।',

    'today.task.scoutPests.title':       '{crop} पर कीट खोजें',
    'today.task.scoutPests.instruction': 'पत्तियों और तनों को ध्यान से देखें। पत्तियों के नीचे भी देखें।',
    'today.task.scoutPests.timing':      'आज ही करें — कीट तेज़ी से फैलते हैं।',
    'today.task.scoutPests.risk':        'यदि छोड़ दें, कीट आपकी फसल को नुकसान पहुँचा सकते हैं।',

    'today.task.checkMoisture.title':       '{crop} के लिए मिट्टी की नमी जाँचें',
    'today.task.checkMoisture.instruction': 'अपनी उँगली मिट्टी में डालें। यह नम होनी चाहिए, सूखी नहीं।',
    'today.task.checkMoisture.timing':      'आज सिंचाई से पहले यह करें।',
    'today.task.checkMoisture.risk':        'मिट्टी बहुत सूखी होने पर फसल धीरे बढ़ेगी।',

    'today.task.prepareHarvest.title':       '{crop} की कटाई की तैयारी करें',
    'today.task.prepareHarvest.instruction': 'बोरियाँ या टोकरियाँ तैयार रखें और सूखा भंडारण साफ करें।',
    'today.task.prepareHarvest.timing':      'अगले एक-दो दिन में यह करें।',
    'today.task.prepareHarvest.risk':        'बहुत देर करने पर फसल खराब हो सकती है।',

    'today.task.checkFarm.title':       'आज अपने खेत की जाँच करें',
    'today.task.checkFarm.instruction': 'अपने खेत में चलें और फसलों को देखें।',
    'today.task.checkFarm.timing':      'आज कभी भी एक छोटी जाँच पर्याप्त है।',
    'today.task.checkFarm.risk':        'रोज़ाना देखने से आप समस्याएँ जल्दी पकड़ सकते हैं।',
  },
});

export default TODAY_ELITE_TRANSLATIONS;
