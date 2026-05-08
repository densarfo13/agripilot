/**
 * intelligenceTranslations.js — translation overlay for the
 * Weather AI + Crop Stage Intelligence Engine outputs.
 *
 * Covers the new crop-specific task titles + reasons emitted by
 * src/lib/intelligence/contextEngine.js:_cropSpecific(). Engine
 * carries an English fallback alongside each titleKey so any
 * locale missing a row collapses to readable English instead of
 * blanking the UI.
 *
 * Coverage: en, fr, sw, ha, tw, hi (all six locales registered
 * in SUPPORTED_LANGUAGES).
 *
 * Shape: `{ key: { locale: value } }` — matches the main T
 * dictionary; merged via the briefing/scan overlay slot in
 * src/i18n/index.js.
 */

export const INTELLIGENCE_TRANSLATIONS = Object.freeze({
  // ── Tomato ───────────────────────────────────────────────
  'intel.crop.tomato.leafSpot.title': {
    en: 'Watch tomato for leaf spots today',
    fr: 'Surveillez les taches sur les feuilles de la tomate',
    sw: 'Angalia madoa kwenye majani ya nyanya leo',
    ha: 'Duba tabo a ganyen tumatir yau',
    tw: 'Hwɛ ntɔmate aba so akɔla ɛnnɛ',
    hi: 'आज टमाटर पर पत्तियों के धब्बों पर नज़र रखें',
  },
  'intel.crop.tomato.leafSpot.reason': {
    en: 'Humid weather during flowering can raise leaf-spot pressure. Check lower leaves and remove any with spreading marks.',
    fr: 'L\'humidité pendant la floraison peut augmenter la pression des taches foliaires. Vérifiez les feuilles inférieures et retirez celles présentant des marques.',
    sw: 'Hali ya unyevu wakati wa maua inaweza kuongeza shinikizo la madoa kwenye majani. Kagua majani ya chini na uondoe yenye alama zinazoenea.',
    ha: 'Yanayin damshi a lokacin furannin na iya kara matsalar tabon ganye. Duba ganyayen kasa kuma cire wadanda ke da alamomi masu yaduwa.',
    tw: 'Sɛ ahumɔ wɔ hɔ wɔ nhwiren bere mu a, ɛtumi ma aba so akɔla yɛ kɛse. Hwɛ aba a ɛwɔ ase no na yi nea akɔla atrɛw mu no fi mu.',
    hi: 'फूल आने के समय नमी से पत्ती के धब्बे बढ़ सकते हैं। निचली पत्तियों की जाँच करें और फैलते निशान वाली पत्तियाँ हटा दें।',
  },
  'intel.crop.tomato.heat.title': {
    en: 'Avoid midday watering for your tomato',
    fr: 'Évitez l\'arrosage de midi pour vos tomates',
    sw: 'Epuka kumwagilia maji wakati wa adhuhuri kwa nyanya yako',
    ha: 'Kauce wa shayar da tumatir lokacin tsakar rana',
    tw: 'Mma nsuo nngu wo ntɔmate awia bere mu',
    hi: 'अपनी टमाटर को दोपहर के समय पानी न दें',
  },
  'intel.crop.tomato.heat.reason': {
    en: 'Tomato roots stress in midday heat. Water early morning or after sunset, not in direct sun.',
    fr: 'Les racines de tomate stressent à la chaleur de midi. Arrosez tôt le matin ou après le coucher du soleil, pas en plein soleil.',
    sw: 'Mizizi ya nyanya hupata mfadhaiko katika joto la mchana. Mwagilia maji mapema asubuhi au baada ya jua kuchwa, sio juani moja kwa moja.',
    ha: 'Tushen tumatir na samun matsala a zafin tsakar rana. Yi shayarwa da safe ko bayan faduwar rana, ba a karkashin rana ba.',
    tw: 'Awia hyew haw ntɔmate ntini. Gugu nsuo anɔpa anaa anwummerɛ, na nyɛ awia yi mu.',
    hi: 'दोपहर की गर्मी में टमाटर की जड़ों पर तनाव पड़ता है। सुबह जल्दी या सूर्यास्त के बाद पानी दें, सीधी धूप में नहीं।',
  },

  // ── Pepper ───────────────────────────────────────────────
  'intel.crop.pepper.heat.title': {
    en: 'Check pepper for leaf curl in the heat',
    fr: 'Vérifiez si les feuilles de poivron s\'enroulent dans la chaleur',
    sw: 'Angalia pilipili kwa kujikunja kwa majani katika joto',
    ha: 'Duba ganyen barkono don dunkulewa a zafi',
    tw: 'Hwɛ pɛpɛ aba sɛ akakra wɔ ahohuru mu',
    hi: 'गर्मी में मिर्च की पत्तियाँ मुड़ने की जाँच करें',
  },
  'intel.crop.pepper.heat.reason': {
    en: 'Pepper leaves curl when stressed by heat or low moisture. Check soil moisture and provide shade if leaves curl tightly.',
    fr: 'Les feuilles de poivron s\'enroulent en cas de stress dû à la chaleur ou au manque d\'humidité. Vérifiez l\'humidité du sol et apportez de l\'ombre si les feuilles s\'enroulent fortement.',
    sw: 'Majani ya pilipili hujikunja yanapopata mfadhaiko wa joto au unyevu mdogo. Kagua unyevu wa udongo na utoe kivuli ikiwa majani yanajikunja sana.',
    ha: 'Ganyen barkono na dunkulewa idan suka samu matsala daga zafi ko karancin damshi. Duba damshin kasa kuma ka ba da inuwa idan ganyaye sun dunkule sosai.',
    tw: 'Pɛpɛ aba kakra sɛ ahohuru anaa nsuo kakra ha no a. Hwɛ asase mu nsuo na bɔ no nyunu sɛ aba no kakra ka so a.',
    hi: 'गर्मी या कम नमी के कारण मिर्च की पत्तियाँ मुड़ जाती हैं। मिट्टी की नमी जाँचें और अगर पत्तियाँ कसकर मुड़ रही हों तो छाया दें।',
  },
  'intel.crop.pepper.flowering.title': {
    en: 'Keep pepper watering steady during flowering',
    fr: 'Maintenez un arrosage régulier du poivron pendant la floraison',
    sw: 'Endelea kumwagilia pilipili kwa utaratibu wakati wa maua',
    ha: 'Ci gaba da shayar da barkono akai-akai a lokacin furannin',
    tw: 'Ma pɛpɛ nsuo nko so daa wɔ nhwiren bere mu',
    hi: 'फूल आने के दौरान मिर्च को नियमित पानी दें',
  },
  'intel.crop.pepper.flowering.reason': {
    en: 'Pepper drops flowers when watering swings between dry and wet. Aim for steady moisture.',
    fr: 'Le poivron perd ses fleurs lorsque l\'arrosage oscille entre sec et humide. Visez une humidité constante.',
    sw: 'Pilipili huangusha maua wakati kumwagilia kunabadilika kati ya ukavu na unyevunyevu. Lengo ni unyevu thabiti.',
    ha: 'Barkono na zubar da furanni idan shayarwa ta canza tsakanin bushewa da jika. Ku yi nufin damshi mai daidaito.',
    tw: 'Pɛpɛ nhwiren tu sɛ nsuo gugu no firi awo kɔ ɛsuom. Pɛ nsuo a ɛyɛ daa.',
    hi: 'सूखे और गीले के बीच पानी देने में उतार-चढ़ाव से मिर्च फूल गिरा देती है। स्थिर नमी रखें।',
  },

  // ── Maize ─────────────────────────────────────────────────
  'intel.crop.maize.wind.title': {
    en: 'Check maize stalks for wind damage',
    fr: 'Vérifiez les tiges de maïs pour des dommages dus au vent',
    sw: 'Kagua mashina ya mahindi kwa uharibifu wa upepo',
    ha: 'Duba kara na masara don lalacewa daga iska',
    tw: 'Hwɛ aburoo dua a mframa abɔ',
    hi: 'मक्के के तनों की हवा से नुकसान की जाँच करें',
  },
  'intel.crop.maize.wind.reason': {
    en: 'Maize is prone to lodging in strong wind. Inspect tall stalks and stake or hill the base if leaning.',
    fr: 'Le maïs est sujet à la verse en cas de vent fort. Inspectez les tiges hautes et tuteurez ou buttez la base si elles penchent.',
    sw: 'Mahindi yana hatari ya kuanguka katika upepo mkali. Kagua mashina marefu na uunge mkono au ujiviringe msingi ikiwa yanainama.',
    ha: 'Masara na fuskantar fadowa a iska mai karfi. Duba dogayen kara kuma ka tallafa wa ko ka taru ginshikin idan suna karkata.',
    tw: 'Mframa kɛse ma aburoo dua tumi hwe ase. Hwɛ aburoo dua tenten na soa anaa fa fam san sɛ ɛrekontonkron a.',
    hi: 'तेज़ हवा में मक्का गिर सकती है। लम्बे तनों की जाँच करें और झुक रहे हैं तो सहारा या मिट्टी चढ़ाएँ।',
  },
  'intel.crop.maize.vegDry.title': {
    en: 'Check maize root-zone moisture',
    fr: 'Vérifiez l\'humidité de la zone racinaire du maïs',
    sw: 'Kagua unyevu wa eneo la mizizi ya mahindi',
    ha: 'Duba damshin yankin tushen masara',
    tw: 'Hwɛ aburoo ntini ho asase mu nsuo',
    hi: 'मक्के की जड़-क्षेत्र की नमी जाँचें',
  },
  'intel.crop.maize.vegDry.reason': {
    en: 'Vegetative-stage maize needs steady root moisture. Feel the soil 5 cm down and water if dry.',
    fr: 'Le maïs en phase végétative a besoin d\'une humidité racinaire constante. Tâtez la terre à 5 cm de profondeur et arrosez si elle est sèche.',
    sw: 'Mahindi katika hatua ya ukuaji yanahitaji unyevu thabiti wa mizizi. Gusa udongo 5 cm chini na umwagilie ikiwa ni mkavu.',
    ha: 'Masara a lokacin girma yana bukatar damshin tushe akai-akai. Taba kasa 5 cm zuwa kasa kuma ka shayar idan ya bushe.',
    tw: 'Aburoo a ɛrenyini hia ntini ho nsuo daa. Fa wo nsa to asase no mu cm 5 na gugu nsuo sɛ awo a.',
    hi: 'विकास अवस्था में मक्के को स्थिर जड़-नमी चाहिए। 5 सेमी नीचे मिट्टी छूएँ और सूखी हो तो पानी दें।',
  },

  // ── Rice ──────────────────────────────────────────────────
  'intel.crop.rice.rain.title': {
    en: 'Check rice field drainage',
    fr: 'Vérifiez le drainage de la rizière',
    sw: 'Kagua mfumo wa kutoa maji wa shamba la mpunga',
    ha: 'Duba zubewar ruwa daga gonar shinkafa',
    tw: 'Hwɛ ɛmo afuo no nsuo nteneneeɛ',
    hi: 'धान के खेत की जल निकासी जाँचें',
  },
  'intel.crop.rice.rain.reason': {
    en: 'Heavy rain can flood the paddy beyond optimal depth. Check drainage outlets and bunds.',
    fr: 'Une forte pluie peut inonder la rizière au-delà de la profondeur optimale. Vérifiez les sorties de drainage et les diguettes.',
    sw: 'Mvua kubwa inaweza kufurika shamba la mpunga zaidi ya kina kinachofaa. Kagua njia za kutoa maji na kingo.',
    ha: 'Ruwan sama mai yawa na iya cika shinkafa fiye da zurfin da ya dace. Duba mafita na ruwa da iyaka.',
    tw: 'Nsuo bebree tumi yiri ɛmo afuo no boro emu nsuo dodo. Hwɛ nsuo nteneneeɛ kwan ne ano.',
    hi: 'भारी बारिश से धान के खेत में अनुकूल गहराई से अधिक पानी भर सकता है। निकासी और मेढ़ों की जाँच करें।',
  },
  'intel.crop.rice.dry.title': {
    en: 'Check rice water level',
    fr: 'Vérifiez le niveau d\'eau du riz',
    sw: 'Kagua kiwango cha maji ya mpunga',
    ha: 'Duba matakin ruwa na shinkafa',
    tw: 'Hwɛ ɛmo nsuo a ɛwɔ afuo no mu',
    hi: 'धान का जल स्तर जाँचें',
  },
  'intel.crop.rice.dry.reason': {
    en: 'Rice needs careful water control. Avoid letting the field dry out for long.',
    fr: 'Le riz nécessite un contrôle minutieux de l\'eau. Évitez de laisser le champ s\'assécher longtemps.',
    sw: 'Mpunga unahitaji udhibiti makini wa maji. Epuka kuruhusu shamba lipungue maji kwa muda mrefu.',
    ha: 'Shinkafa na bukatar mai da hankali da kula da ruwa. Kauce wa barin gonar ta bushe na dadewa.',
    tw: 'Ɛmo hia nsuo a yɛhwɛ no yiye. Mma afuo no nwo bere tenten.',
    hi: 'धान को सावधानीपूर्वक जल नियंत्रण चाहिए। खेत को लंबे समय तक सूखने न दें।',
  },

  // ── Okra ──────────────────────────────────────────────────
  'intel.crop.okra.pest.title': {
    en: 'Inspect okra leaves for holes or insects',
    fr: 'Inspectez les feuilles de gombo pour des trous ou des insectes',
    sw: 'Kagua majani ya bamia kwa matundu au wadudu',
    ha: 'Duba ganyen kubewa don rami ko kwari',
    tw: 'Hwɛ nkruma aba ase sɛ tokuro anaa mmoawa wɔ so',
    hi: 'भिंडी की पत्तियों में छेद या कीटों की जाँच करें',
  },
  'intel.crop.okra.pest.reason': {
    en: 'Young okra leaves and pods attract pests. Check under leaves and along stems.',
    fr: 'Les jeunes feuilles et gousses de gombo attirent les ravageurs. Vérifiez sous les feuilles et le long des tiges.',
    sw: 'Majani na maganda mapya ya bamia huvutia wadudu. Kagua chini ya majani na kwenye mashina.',
    ha: 'Sabbin ganye da kwadagon kubewa na jawo kwari. Duba kasan ganye da bisa kara.',
    tw: 'Mmoawa ba nkruma aba foforɔ ne ne aba so. Hwɛ aba no ase ne ne dua no nyinaa.',
    hi: 'भिंडी की कोमल पत्तियाँ और फलियाँ कीट आकर्षित करती हैं। पत्तियों के नीचे और तनों पर जाँचें।',
  },

  // ── Cassava ───────────────────────────────────────────────
  'intel.crop.cassava.rain.title': {
    en: 'Check drainage around cassava',
    fr: 'Vérifiez le drainage autour du manioc',
    sw: 'Kagua mfumo wa kutoa maji karibu na mihogo',
    ha: 'Duba zubewar ruwa kewaye da rogo',
    tw: 'Hwɛ bankye ho nsuo nteneneeɛ',
    hi: 'कसावा के आसपास जल निकासी जाँचें',
  },
  'intel.crop.cassava.rain.reason': {
    en: 'Cassava roots rot in waterlogged soil. Check drainage and clear water around the base.',
    fr: 'Les racines de manioc pourrissent en sol gorgé d\'eau. Vérifiez le drainage et évacuez l\'eau autour de la base.',
    sw: 'Mizizi ya mihogo huoza katika udongo ulio na maji mengi. Kagua mfumo wa kutoa maji na uondoe maji karibu na shina.',
    ha: 'Tushen rogo na ruba a kasa mai cike da ruwa. Duba zubewar ruwa kuma a share ruwa kewaye da gindi.',
    tw: 'Bankye ntini porɔ wɔ asase a nsuo ahyɛ mu mu. Hwɛ nsuo nteneneeɛ na pra nsuo no fi ne ase.',
    hi: 'जलजमाव वाली मिट्टी में कसावा की जड़ें सड़ जाती हैं। निकासी जाँचें और जड़ के आसपास पानी हटाएँ।',
  },
  'intel.crop.cassava.general.title': {
    en: 'Inspect cassava leaves for yellowing',
    fr: 'Inspectez les feuilles de manioc pour le jaunissement',
    sw: 'Kagua majani ya mihogo kwa kuwa ya manjano',
    ha: 'Duba ganyen rogo don zama rawaya',
    tw: 'Hwɛ bankye aba sɛ akɔ akokɔsradeɛ',
    hi: 'कसावा की पत्तियों के पीलेपन की जाँच करें',
  },
  'intel.crop.cassava.general.reason': {
    en: 'Yellowing cassava leaves can signal cassava mosaic or stressed roots. A quick visual check helps catch it early.',
    fr: 'Les feuilles jaunissantes de manioc peuvent signaler la mosaïque du manioc ou un stress racinaire. Un contrôle visuel rapide aide à le détecter tôt.',
    sw: 'Majani ya manjano ya mihogo yanaweza kuashiria ugonjwa wa mosaic au mizizi iliyo na mfadhaiko. Ukaguzi wa haraka husaidia kuugundua mapema.',
    ha: 'Ganyen rawaya na rogo na iya nuna alamar cutar mosaic ko tushen da ke fama da matsala. Bincike na sauri yana taimakawa wajen gano shi da wuri.',
    tw: 'Bankye aba akokɔsradeɛ tumi kyerɛ cassava mosaic anaa ntini ha. Hwɛ no ntɛm a ɛboa ma yehu no ntɛm.',
    hi: 'पीली होती कसावा की पत्तियाँ कसावा मोज़ेक या तनावग्रस्त जड़ों का संकेत हो सकती हैं। शीघ्र दृश्य जाँच जल्दी पकड़ने में मदद करती है।',
  },

  // ── Leafy greens ──────────────────────────────────────────
  'intel.crop.leafy.heat.title': {
    en: 'Shade or water leafy greens early today',
    fr: 'Ombragez ou arrosez les légumes-feuilles tôt aujourd\'hui',
    sw: 'Toa kivuli au mwagilia mboga za majani mapema leo',
    ha: 'Ba da inuwa ko shayar da ganyaye da safe yau',
    tw: 'Bɔ aba a wodi nyunu anaa gugu nsuo ntɛm ɛnnɛ',
    hi: 'आज पत्तेदार सब्जियों को जल्दी छाया दें या पानी दें',
  },
  'intel.crop.leafy.heat.reason': {
    en: 'Leafy greens wilt fast in heat. Provide partial shade or water before 9 am to keep leaves crisp.',
    fr: 'Les légumes-feuilles flétrissent vite à la chaleur. Apportez une ombre partielle ou arrosez avant 9 h pour garder les feuilles croquantes.',
    sw: 'Mboga za majani hunyauka haraka katika joto. Toa kivuli sehemu au mwagilia kabla ya saa tatu asubuhi ili kuweka majani makavu.',
    ha: 'Ganyaye na bushewa da sauri a zafi. Ka ba da inuwa kadan ko ka shayar kafin karfe 9 na safe don kiyaye ganyayen da sabo.',
    tw: 'Aba a wodi nyunu wu ntɛm wɔ ahohuru mu. Bɔ no nyunu kakra anaa gugu nsuo ansa na mmerɛ 9 anɔpa.',
    hi: 'गर्मी में पत्तेदार सब्जियाँ जल्दी मुरझाती हैं। पत्तियाँ कुरकुरी रखने के लिए सुबह 9 बजे से पहले छाया दें या पानी दें।',
  },
  'intel.crop.leafy.pest.title': {
    en: 'Check under leafy greens for pests',
    fr: 'Vérifiez sous les légumes-feuilles pour les ravageurs',
    sw: 'Kagua chini ya mboga za majani kwa wadudu',
    ha: 'Duba kasan ganyaye don kwari',
    tw: 'Hwɛ aba a wodi nyunu ase sɛ mmoawa wɔ so',
    hi: 'पत्तेदार सब्जियों के नीचे कीटों की जाँच करें',
  },
  'intel.crop.leafy.pest.reason': {
    en: 'Leafy greens attract aphids and caterpillars. Lift a few outer leaves and check for damage.',
    fr: 'Les légumes-feuilles attirent les pucerons et les chenilles. Soulevez quelques feuilles extérieures et vérifiez les dégâts.',
    sw: 'Mboga za majani huvutia vidukari na viwavi. Inua majani machache ya nje na uangalie uharibifu.',
    ha: 'Ganyaye na jawo kwarkwata da tsutsotsi. Daga ʼyan ganyayen waje kuma ka duba lalacewa.',
    tw: 'Aba a wodi nyunu ba mmoawa ne nsansono. Pagya aba a ɛwɔ akyi kakra na hwɛ sɛe.',
    hi: 'पत्तेदार सब्जियाँ माहू और इल्लियाँ आकर्षित करती हैं। कुछ बाहरी पत्तियाँ उठाकर नुकसान की जाँच करें।',
  },

  // ── Onion ─────────────────────────────────────────────────
  'intel.crop.onion.rain.title': {
    en: 'Improve drainage around onions',
    fr: 'Améliorez le drainage autour des oignons',
    sw: 'Boresha mfumo wa kutoa maji karibu na vitunguu',
    ha: 'Inganta zubewar ruwa kewaye da albasa',
    tw: 'Ma gyeene ho nsuo nteneneeɛ nyɛ yie',
    hi: 'प्याज के आसपास जल निकासी सुधारें',
  },
  'intel.crop.onion.rain.reason': {
    en: 'Onions rot in waterlogged soil. Check that water drains away from the bulbs.',
    fr: 'Les oignons pourrissent en sol gorgé d\'eau. Vérifiez que l\'eau s\'évacue loin des bulbes.',
    sw: 'Vitunguu huoza katika udongo ulio na maji mengi. Hakikisha maji yanatoka mbali na balbu.',
    ha: 'Albasa na ruba a kasa mai cike da ruwa. Tabbatar ruwa yana zuba nesa da kawunan albasar.',
    tw: 'Gyeene porɔ wɔ asase a nsuo ahyɛ mu mu. Hwɛ sɛ nsuo no firi gyeene aba ho kɔ.',
    hi: 'जलजमाव वाली मिट्टी में प्याज सड़ जाती है। सुनिश्चित करें कि पानी कंदों से दूर बहे।',
  },
  'intel.crop.onion.general.title': {
    en: 'Watch onion leaf tips for browning',
    fr: 'Surveillez le brunissement des extrémités des feuilles d\'oignon',
    sw: 'Angalia ncha za majani ya vitunguu kwa kuwa kahawia',
    ha: 'Duba bakin ganyen albasa don zama launin ruwan kasa',
    tw: 'Hwɛ gyeene aba ti sɛ akɔ tuntum',
    hi: 'प्याज की पत्ती के सिरों के भूरे होने पर नज़र रखें',
  },
  'intel.crop.onion.general.reason': {
    en: 'Onion leaf-tip browning can signal water or nutrient stress. A quick check today helps catch it early.',
    fr: 'Le brunissement des extrémités des feuilles d\'oignon peut signaler un stress hydrique ou nutritionnel. Une vérification rapide aujourd\'hui aide à le détecter tôt.',
    sw: 'Ncha za majani ya vitunguu zinazokuwa kahawia zinaweza kuashiria mfadhaiko wa maji au virutubisho. Ukaguzi wa haraka leo husaidia kuugundua mapema.',
    ha: 'Bakin ganyen albasa da ke zama launin ruwan kasa na iya nuna matsalar ruwa ko abinci. Bincike na sauri yau yana taimakawa wajen gano shi da wuri.',
    tw: 'Sɛ gyeene aba ti yɛ tuntum a, ɛtumi kyerɛ nsuo anaa nuhuro ha. Hwɛ no ntɛm a ɛboa ma yehu no ntɛm.',
    hi: 'प्याज की पत्ती के सिरों का भूरा होना पानी या पोषक तत्व तनाव का संकेत हो सकता है। आज जल्दी जाँच जल्दी पकड़ने में मदद करती है।',
  },
});

export default INTELLIGENCE_TRANSLATIONS;
