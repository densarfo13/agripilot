/**
 * regionTranslations.js — region-aware insight + season copy.
 *
 * Covers every i18n key the regionIntelligence layer can emit:
 *   • Season labels (rainy / dry / harmattan / hot / frost / transitional / unknown)
 *   • Insight chips (driven by guidanceModifiers tags)
 *   • Caution notes (cropSuggestions cautionNotes)
 *
 * Coverage: en, fr, sw, ha, tw, hi.
 * Shape: `{ key: { locale: value } }` — same as prior overlays.
 */

export const REGION_TRANSLATIONS = Object.freeze({
  // ── Season labels ─────────────────────────────────────────
  'region.season.rainy': {
    en: 'rainy season',
    fr: 'saison des pluies',
    sw: 'msimu wa mvua',
    ha: 'lokacin damana',
    tw: 'osutɔ bere',
    hi: 'बरसात का मौसम',
  },
  'region.season.dry': {
    en: 'dry season',
    fr: 'saison sèche',
    sw: 'msimu wa kiangazi',
    ha: 'lokacin rani',
    tw: 'opɛ bere',
    hi: 'सूखा मौसम',
  },
  'region.season.harmattan': {
    en: 'Harmattan / dry winds',
    fr: 'Harmattan / vents secs',
    sw: 'Harmattan / upepo mkavu',
    ha: 'Harmattan / iska bushe',
    tw: 'Harmattan / mframa awo',
    hi: 'हरमट्टन / सूखी हवाएँ',
  },
  'region.season.hot': {
    en: 'hot season',
    fr: 'saison chaude',
    sw: 'msimu wa joto',
    ha: 'lokacin zafi',
    tw: 'ahohuru bere',
    hi: 'गर्म मौसम',
  },
  'region.season.frost': {
    en: 'cold / frost season',
    fr: 'saison froide / gel',
    sw: 'msimu wa baridi',
    ha: 'lokacin sanyi',
    tw: 'awɔw bere',
    hi: 'ठंड / पाला का मौसम',
  },
  'region.season.transitional': {
    en: 'transitional season',
    fr: 'saison de transition',
    sw: 'msimu wa mpito',
    ha: 'lokacin canji',
    tw: 'nsakraeɛ bere',
    hi: 'संक्रमणकालीन मौसम',
  },
  'region.season.unknown': {
    en: 'current season',
    fr: 'saison actuelle',
    sw: 'msimu wa sasa',
    ha: 'lokacin yanzu',
    tw: 'mmerɛ a yɛwɔ mu yi',
    hi: 'मौजूदा मौसम',
  },

  // ── Insight chips (guidance modifier tags → copy) ─────────
  'region.insight.rainySeason': {
    en: 'Rainy-season conditions. Watch drainage and avoid waterlogging.',
    fr: 'Conditions de saison des pluies. Surveillez le drainage et évitez l\'engorgement.',
    sw: 'Hali ya msimu wa mvua. Angalia mfumo wa kutoa maji na epuka kufurika.',
    ha: 'Yanayin lokacin damana. Duba zubewar ruwa kuma ka guji ambaliya.',
    tw: 'Osutɔ bere tebea. Hwɛ nsuo nteneneeɛ na mma nsuo nyiri.',
    hi: 'बरसाती मौसम। जल निकासी देखें और जलभराव से बचें।',
  },
  'region.insight.drySeason': {
    en: 'Dry-season conditions. Check soil moisture often.',
    fr: 'Conditions de saison sèche. Vérifiez l\'humidité du sol souvent.',
    sw: 'Hali ya msimu wa kiangazi. Kagua unyevu wa udongo mara kwa mara.',
    ha: 'Yanayin lokacin rani. Duba damshin ƙasa akai-akai.',
    tw: 'Opɛ bere tebea. Hwɛ asase mu nsuo daa.',
    hi: 'शुष्क मौसम। मिट्टी की नमी बार-बार जाँचें।',
  },
  'region.insight.harmattan': {
    en: 'Harmattan dryness may stress young plants. Check soil moisture.',
    fr: 'La sécheresse du Harmattan peut stresser les jeunes plantes. Vérifiez l\'humidité du sol.',
    sw: 'Ukame wa Harmattan unaweza kuathiri mimea changa. Kagua unyevu wa udongo.',
    ha: 'Bushewar Harmattan na iya damun ƙananan tsire-tsire. Duba damshin ƙasa.',
    tw: 'Harmattan awo betumi aha afifideɛ nkumaa. Hwɛ asase mu nsuo.',
    hi: 'हरमट्टन की शुष्कता युवा पौधों पर तनाव डाल सकती है। मिट्टी की नमी जाँचें।',
  },
  'region.insight.heat': {
    en: 'Hot-season conditions. Water early or late, not midday.',
    fr: 'Conditions de saison chaude. Arrosez tôt ou tard, pas à midi.',
    sw: 'Hali ya msimu wa joto. Mwagilia maji mapema au usiku, sio mchana.',
    ha: 'Yanayin lokacin zafi. Yi shayarwa da safe ko da dare, ba tsakar rana ba.',
    tw: 'Ahohuru bere tebea. Gugu nsuo anɔpa anaa anwummerɛ, na nyɛ awia.',
    hi: 'गर्म मौसम। सुबह या शाम पानी दें, दोपहर में नहीं।',
  },
  'region.insight.frost': {
    en: 'Frost risk this period. Protect sensitive plants or move pots indoors.',
    fr: 'Risque de gel cette période. Protégez les plantes sensibles ou rentrez les pots à l\'intérieur.',
    sw: 'Hatari ya baridi katika kipindi hiki. Linda mimea nyeti au hamishia vyungu ndani.',
    ha: 'Hadarin sanyi a wannan lokacin. Kare tsire-tsire masu sauƙin lalacewa ko motsa tukwane gida.',
    tw: 'Awɔw asiane wɔ saa bere yi. Bɔ afifideɛ a ɛnyɛ den ho ban anaa fa nkuruwa kɔ fie.',
    hi: 'इस अवधि में पाले का जोखिम। संवेदनशील पौधों को बचाएँ या गमले अंदर लाएँ।',
  },
  'region.insight.monsoon': {
    en: 'Monsoon season. Avoid overwatering and watch for leaf spots.',
    fr: 'Saison de la mousson. Évitez le sur-arrosage et surveillez les taches foliaires.',
    sw: 'Msimu wa monsuni. Epuka kumwagilia kupita kiasi na angalia madoa kwenye majani.',
    ha: 'Lokacin monsuni. Kauce wa shayar da yawa kuma duba tabo a ganye.',
    tw: 'Monsoon bere. Mma nsuo bebree nngu na hwɛ aba so akɔla.',
    hi: 'मानसून का मौसम। अधिक पानी न दें और पत्ती के धब्बों पर नज़र रखें।',
  },
  'region.insight.flooding': {
    en: 'Heavy rain can cause flooding. Clear drains and check water flow.',
    fr: 'Les fortes pluies peuvent provoquer des inondations. Dégagez les drains et vérifiez l\'écoulement.',
    sw: 'Mvua kubwa inaweza kusababisha mafuriko. Safisha mifereji na ukague mtiririko wa maji.',
    ha: 'Ruwan sama mai yawa na iya haifar da ambaliya. Tsabtace magudana kuma duba kwararar ruwa.',
    tw: 'Nsuo bebree betumi ama nsuo ayiri. Pra nsuo nteneneeɛ akwan na hwɛ nsuo a ɛrekɔ no.',
    hi: 'भारी बारिश से बाढ़ आ सकती है। नालियाँ साफ़ करें और पानी का बहाव देखें।',
  },
  'region.insight.heavyRainWaterlogging': {
    en: 'Heavy rain expected. Check drainage to prevent waterlogging.',
    fr: 'Fortes pluies attendues. Vérifiez le drainage pour éviter l\'engorgement.',
    sw: 'Mvua kubwa inatarajiwa. Kagua mfumo wa kutoa maji ili kuzuia kufurika.',
    ha: 'Ana sa ran ruwan sama mai yawa. Duba zubewar ruwa don hana ambaliya.',
    tw: 'Nsuo bebree bɛtɔ. Hwɛ nsuo nteneneeɛ na ɛnnsa.',
    hi: 'भारी बारिश की उम्मीद। जलभराव रोकने के लिए जल निकासी जाँचें।',
  },
  'region.insight.harmattanDryAir': {
    en: 'Dry Harmattan air on top of heat. Water gently in early morning.',
    fr: 'Air sec du Harmattan combiné à la chaleur. Arrosez doucement tôt le matin.',
    sw: 'Hewa kavu ya Harmattan pamoja na joto. Mwagilia kwa upole asubuhi mapema.',
    ha: 'Iska bushe ta Harmattan tare da zafi. Shayar a hankali da safe.',
    tw: 'Harmattan mframa awo ne ahohuru. Gugu nsuo brɛoo anɔpa.',
    hi: 'गर्मी के साथ हरमट्टन की शुष्क हवा। सुबह जल्दी धीरे पानी दें।',
  },
  'region.insight.monsoonLeafSpot': {
    en: 'Monsoon humidity raises leaf-spot risk. Inspect leaves and improve airflow.',
    fr: 'L\'humidité de la mousson augmente le risque de taches foliaires. Inspectez les feuilles et améliorez la circulation d\'air.',
    sw: 'Unyevu wa monsuni huongeza hatari ya madoa kwenye majani. Kagua majani na boresha mtiririko wa hewa.',
    ha: 'Damshin monsuni yana ƙara haɗarin tabon ganye. Duba ganyaye kuma ka inganta kwararar iska.',
    tw: 'Monsoon ahumɔ ma aba so akɔla nyɛ kɛse. Hwɛ aba na ma mframa nko mu yiye.',
    hi: 'मानसून की नमी से पत्ती के धब्बे का खतरा। पत्तियाँ जाँचें और हवा का प्रवाह सुधारें।',
  },
  'region.insight.coverContainersIndoor': {
    en: 'Frost expected. Move containers indoors or cover overnight.',
    fr: 'Gel attendu. Rentrez les pots à l\'intérieur ou couvrez la nuit.',
    sw: 'Baridi inatarajiwa. Hamishia vyungu ndani au funika usiku.',
    ha: 'Ana sa ran sanyi. Motsa tukwane gida ko rufe da daddare.',
    tw: 'Awɔw bɛba. Fa nkuruwa kɔ fie anaa kata so anadwo.',
    hi: 'पाला अपेक्षित। गमले अंदर लाएँ या रात भर ढँकें।',
  },
  'region.insight.smallPotWaterEarly': {
    en: 'Small pots may dry quickly today. Water before noon.',
    fr: 'Les petits pots peuvent sécher rapidement aujourd\'hui. Arrosez avant midi.',
    sw: 'Vyungu vidogo vinaweza kukauka haraka leo. Mwagilia kabla ya saa sita.',
    ha: 'Ƙananan tukwane na iya bushewa da sauri yau. Yi shayarwa kafin tsakar rana.',
    tw: 'Nkuruwa nketewa betumi awo ntɛm ɛnnɛ. Gugu nsuo ansa na awia.',
    hi: 'छोटे गमले आज जल्दी सूख सकते हैं। दोपहर से पहले पानी दें।',
  },
  'region.insight.gardenContainer': {
    en: 'Container care matters this season. Check pot drainage and moisture.',
    fr: 'Le soin des récipients compte cette saison. Vérifiez le drainage et l\'humidité du pot.',
    sw: 'Utunzaji wa vyombo ni muhimu msimu huu. Kagua mfumo wa kutoa maji na unyevu wa chungu.',
    ha: 'Kulawa da akwati yana da muhimmanci wannan lokacin. Duba zubewar ruwa da damshin tukunya.',
    tw: 'Adaka ho hwɛ ho hia saa bere yi. Hwɛ kuruwa nsuo nteneneeɛ ne nsuo.',
    hi: 'इस मौसम में पात्र देखभाल महत्वपूर्ण। गमले की निकासी और नमी जाँचें।',
  },
  'region.insight.containerCare': {
    en: 'Watch container moisture closely in this climate.',
    fr: 'Surveillez l\'humidité des récipients dans ce climat.',
    sw: 'Angalia kwa karibu unyevu wa vyombo katika hali hii.',
    ha: 'Duba damshin akwati a hankali a wannan yanayin.',
    tw: 'Hwɛ adaka mu nsuo yiye wɔ saa wim tebea yi.',
    hi: 'इस जलवायु में पात्र की नमी पर ध्यान दें।',
  },
  'region.insight.altitudeFrost': {
    en: 'Highland areas can see overnight frost. Cover sensitive plants.',
    fr: 'Les zones d\'altitude peuvent connaître du gel nocturne. Couvrez les plantes sensibles.',
    sw: 'Maeneo ya juu yanaweza kupata baridi ya usiku. Funika mimea nyeti.',
    ha: 'Yankunan tudu na iya samun sanyi da daddare. Rufe tsire-tsire masu sauƙin lalacewa.',
    tw: 'Mmepɔw mu beae tumi nya awɔw anadwo. Kata afifideɛ a ɛnyɛ den so.',
    hi: 'ऊँचाई वाले क्षेत्रों में रात को पाला पड़ सकता है। संवेदनशील पौधों को ढँकें।',
  },
  'region.insight.temperateSeasons': {
    en: 'Four-season climate. Plan plantings around frost dates.',
    fr: 'Climat à quatre saisons. Planifiez les plantations autour des dates de gel.',
    sw: 'Hali ya hewa ya misimu mine. Panga upandaji kuzunguka tarehe za baridi.',
    ha: 'Yanayin lokuta huɗu. Tsara shukar da kewaye da ranakun sanyi.',
    tw: 'Wim tebea a ɛyɛ mmerɛ nan. Yɛ ndua nhyehyɛeɛ wɔ awɔw bere ho.',
    hi: 'चार-ऋतु जलवायु। पाले की तारीखों के अनुसार रोपण की योजना बनाएँ।',
  },

  // ── Caution notes (crop suggestions) ──────────────────────
  'region.caution.frostSensitive': {
    en: 'Frost-sensitive — watch overnight temperatures.',
    fr: 'Sensible au gel — surveillez les températures nocturnes.',
    sw: 'Hupata madhara ya baridi — angalia joto la usiku.',
    ha: 'Mai sauƙin lalacewa daga sanyi — duba zafin daddare.',
    tw: 'Awɔw kete kakra — hwɛ anadwo ahohuru.',
    hi: 'पाला-संवेदनशील — रात के तापमान पर नज़र रखें।',
  },
  'region.caution.heatStress': {
    en: 'Heat-stress risk — water during cooler hours.',
    fr: 'Risque de stress thermique — arrosez pendant les heures fraîches.',
    sw: 'Hatari ya mfadhaiko wa joto — mwagilia wakati wa baridi.',
    ha: 'Hadarin matsalar zafi — yi shayarwa lokacin sanyi.',
    tw: 'Ahohuru ha asiane — gugu nsuo nyunu bere mu.',
    hi: 'गर्मी तनाव जोखिम — ठंडे समय में पानी दें।',
  },
  'region.caution.drainage': {
    en: 'Improve drainage during heavy rain periods.',
    fr: 'Améliorez le drainage pendant les périodes de fortes pluies.',
    sw: 'Boresha mfumo wa kutoa maji wakati wa mvua kubwa.',
    ha: 'Inganta zubewar ruwa lokacin ruwan sama mai yawa.',
    tw: 'Yɛ nsuo nteneneeɛ yiye wɔ nsuo bebree bere mu.',
    hi: 'भारी बारिश में जल निकासी सुधारें।',
  },
  'region.caution.harmattanMoisture': {
    en: 'Harmattan air dries soil quickly — water gently.',
    fr: 'L\'air du Harmattan sèche le sol rapidement — arrosez doucement.',
    sw: 'Hewa ya Harmattan hukausha udongo haraka — mwagilia kwa upole.',
    ha: 'Iskar Harmattan tana bushe ƙasa da sauri — shayar a hankali.',
    tw: 'Harmattan mframa ma asase wo ntɛm — gugu nsuo brɛoo.',
    hi: 'हरमट्टन हवा जल्दी मिट्टी सुखाती है — धीरे पानी दें।',
  },
  'region.caution.smallContainer': {
    en: 'Small containers may need water more than once a day.',
    fr: 'Les petits récipients peuvent nécessiter de l\'eau plus d\'une fois par jour.',
    sw: 'Vyombo vidogo vinaweza kuhitaji maji zaidi ya mara moja kwa siku.',
    ha: 'Ƙananan akwati na iya buƙatar ruwa fiye da sau ɗaya a rana.',
    tw: 'Adaka nketewa hia nsuo bɛboro pɛnkoro da koro mu.',
    hi: 'छोटे पात्रों को दिन में एक से अधिक बार पानी चाहिए।',
  },

  // ── RegionSettingsCard ───────────────────────────────────
  'region.settings.title': {
    en: 'Region',     fr: 'Région',     sw: 'Eneo',     ha: 'Yanki',    tw: 'Mantam',   hi: 'क्षेत्र',
  },
  'region.settings.subtitle': {
    en: 'Helps Farroway match local seasons, crops, and units.',
    fr: 'Aide Farroway à adapter les saisons, cultures et unités locales.',
    sw: 'Husaidia Farroway kulingana na misimu, mazao, na vipimo vya eneo.',
    ha: 'Yana taimaka wa Farroway daidaita lokutan yanki, amfanin gona, da raka’oji.',
    tw: 'Ɛboa Farroway ma ɛhwehwɛ wʼadi mmerɛ, nnɔbae, ne nsusudeɛ.',
    hi: 'Farroway को स्थानीय मौसम, फसलें और इकाइयाँ मिलाने में मदद करता है।',
  },
  'region.settings.countryLabel': {
    en: 'Country',    fr: 'Pays',       sw: 'Nchi',     ha: 'Ƙasa',     tw: 'Ɔman',     hi: 'देश',
  },
  'region.settings.autoDetect': {
    en: 'Auto-detect (recommended)',
    fr: 'Détection automatique (recommandé)',
    sw: 'Tambua kiotomatiki (inapendekezwa)',
    ha: 'Gano kai tsaye (an ba da shawara)',
    tw: 'Hwehwɛ no ɔno ara (yɛkamfo kyerɛ)',
    hi: 'स्वचालित पहचान (अनुशंसित)',
  },
  'region.settings.preview.climate': {
    en: 'Climate', fr: 'Climat', sw: 'Hali ya hewa', ha: 'Yanayi', tw: 'Wim tebea', hi: 'जलवायु',
  },
  'region.settings.preview.season': {
    en: 'This month', fr: 'Ce mois-ci', sw: 'Mwezi huu', ha: 'Wannan watan',
    tw: 'Bosome yi', hi: 'इस माह',
  },
  'region.settings.preview.units': {
    en: 'Units', fr: 'Unités', sw: 'Vipimo', ha: 'Raka’oji', tw: 'Nsusudeɛ', hi: 'इकाइयाँ',
  },
  'region.settings.preview.commonCrops': {
    en: 'Common crops', fr: 'Cultures courantes', sw: 'Mazao ya kawaida',
    ha: 'Amfanin gona na kowa', tw: 'Nnɔbae a ɛtaa wɔ hɔ', hi: 'सामान्य फसलें',
  },
  'region.settings.clear': {
    en: 'Reset to auto-detect',
    fr: 'Réinitialiser à la détection automatique',
    sw: 'Rudisha kwa utambuzi kiotomatiki',
    ha: 'Sake saita zuwa gano kai tsaye',
    tw: 'San kɔ no ɔno ara hwehwɛ so',
    hi: 'स्वचालित पहचान पर रीसेट करें',
  },
  'region.settings.privacy': {
    en: 'Region picks are kept on this device. Farroway never asks for your exact location.',
    fr: 'Les choix de région restent sur cet appareil. Farroway ne demande jamais votre localisation exacte.',
    sw: 'Chaguzi za eneo huhifadhiwa kwenye kifaa hiki. Farroway haombi mahali pako halisi.',
    ha: 'An adana zaɓuɓɓukan yanki a wannan na’urar. Farroway ba ya tambayar ainihin wurinka.',
    tw: 'Mantam a wopaw no tena saa afidie yi so. Farroway mmisa wo baabi pɔtee da.',
    hi: 'क्षेत्र चयन इस डिवाइस पर रहते हैं। Farroway कभी आपका सटीक स्थान नहीं माँगता।',
  },

  // ── Plant type group labels (PlantEditModal region-aware select) ──
  'plant.field.type.regional': {
    en: 'Suggested for your region',
    fr: 'Suggéré pour votre région',
    sw: 'Imependekezwa kwa eneo lako',
    ha: 'An shawarta don yankinka',
    tw: 'Yɛkamfo kyerɛ wʼadi',
    hi: 'आपके क्षेत्र के लिए सुझाया',
  },
  'plant.field.type.allPlants': {
    en: 'All plants', fr: 'Toutes les plantes', sw: 'Mimea yote',
    ha: 'Dukkan tsire-tsire', tw: 'Afifideɛ nyinaa', hi: 'सभी पौधे',
  },
});

export default REGION_TRANSLATIONS;
