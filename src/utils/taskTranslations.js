/**
 * Task Title Translations — maps server task IDs to localized short titles.
 *
 * Server tasks come in English. This map provides localized overrides
 * for the farmer home. Tasks not in this map fall back to the server title.
 *
 * Short titles only (2-4 words). Descriptions go to voice.
 */

const TASK_TITLES = {
  // ─── Planning ─────────────
  'plan-select-seed': {
    en: 'Choose seeds', fr: 'Choisir semences', sw: 'Chagua mbegu', ha: 'Zaɓi iri', tw: 'Yi aba',
  },
  'plan-budget': {
    en: 'Plan budget', fr: 'Planifier budget', sw: 'Panga bajeti', ha: 'Tsara kasafin kuɗi', tw: 'Hyehyɛ sika',
  },
  'plan-soil-test': {
    en: 'Test soil', fr: 'Tester le sol', sw: 'Pima udongo', ha: 'Gwada ƙasa', tw: 'Sɔ asase hwɛ',
  },
  // ─── Land prep ────────────
  'landprep-clear': {
    en: 'Clear field', fr: 'Défricher le champ', sw: 'Safisha shamba', ha: 'Share gona', tw: 'Popa afuo',
  },
  'landprep-till-maize': {
    en: 'Till field', fr: 'Labourer le champ', sw: 'Lima shamba', ha: 'Noma gona', tw: 'Tu asase',
  },
  'landprep-beds-tomato': {
    en: 'Prepare beds', fr: 'Préparer les planches', sw: 'Andaa vitalu', ha: 'Shirya gadaje', tw: 'Yɛ mfuom',
  },
  'landprep-mound-cassava': {
    en: 'Make mounds', fr: 'Faire des buttes', sw: 'Fanya matuta', ha: 'Yi tudu', tw: 'Yɛ nkoko',
  },
  'landprep-shade-cocoa': {
    en: 'Set up shade', fr: 'Installer l\'ombrage', sw: 'Weka kivuli', ha: 'Shirya inuwa', tw: 'Yɛ suwusiw',
  },
  'landprep-level-rice': {
    en: 'Level paddy', fr: 'Niveler rizière', sw: 'Sawazisha shamba', ha: 'Daidaita gona', tw: 'Tɛ asase',
  },
  // ─── Planting ─────────────
  'plant-seeds': {
    en: 'Plant seeds', fr: 'Semer les graines', sw: 'Panda mbegu', ha: 'Shuka iri', tw: 'Dua aba',
  },
  'plant-first-water': {
    en: 'Water seeds', fr: 'Arroser les semis', sw: 'Mwagilia mbegu', ha: 'Shayar da iri', tw: 'Gugu aba',
  },
  'plant-cassava-cuttings': {
    en: 'Plant cuttings', fr: 'Planter boutures', sw: 'Panda vipandikizi', ha: 'Dasa saiwa', tw: 'Dua ntwaso',
  },
  'plant-cocoa-seedlings': {
    en: 'Plant seedlings', fr: 'Planter les plants', sw: 'Panda miche', ha: 'Dasa shuki', tw: 'Dua nhaban',
  },
  'plant-tomato-transplant': {
    en: 'Transplant', fr: 'Repiquer', sw: 'Pandikiza', ha: 'Dasawa', tw: 'Tu kɔdua',
  },
  // ─── Germination ──────────
  'germ-check-emergence': {
    en: 'Check sprouts', fr: 'Vérifier germination', sw: 'Angalia miche', ha: 'Duba tsiro', tw: 'Hwɛ nhyiren',
  },
  'germ-moisture': {
    en: 'Check moisture', fr: 'Vérifier humidité', sw: 'Angalia unyevu', ha: 'Duba zafi', tw: 'Hwɛ nsuo',
  },
  'germ-check-cassava': {
    en: 'Check cuttings', fr: 'Vérifier boutures', sw: 'Angalia vipandikizi', ha: 'Duba saiwa', tw: 'Hwɛ ntwaso',
  },
  // ─── Vegetative ───────────
  'veg-weed': {
    en: 'Remove weeds', fr: 'Désherber', sw: 'Palilia', ha: 'Cire ciyawa', tw: 'Tu wura',
  },
  'veg-fertilize-maize': {
    en: 'Apply fertilizer', fr: 'Appliquer engrais', sw: 'Weka mbolea', ha: 'Sa taki', tw: 'Gu ayaresa',
  },
  'veg-fertilize-rice': {
    en: 'Apply fertilizer', fr: 'Appliquer engrais', sw: 'Weka mbolea', ha: 'Sa taki', tw: 'Gu ayaresa',
  },
  'veg-pest-check': {
    en: 'Check for pests', fr: 'Vérifier ravageurs', sw: 'Angalia wadudu', ha: 'Duba ƙwari', tw: 'Hwɛ mmoa',
  },
  'veg-prune-cocoa': {
    en: 'Prune trees', fr: 'Élaguer les arbres', sw: 'Pogoa miti', ha: 'Sare bishiyoyi', tw: 'Twa nnua',
  },
  // ─── Flowering ────────────
  'flower-water': {
    en: 'Water crop', fr: 'Arroser culture', sw: 'Mwagilia mazao', ha: 'Shayar da amfani', tw: 'Gugu nnɔbae',
  },
  'flower-second-fert': {
    en: 'Apply fertilizer', fr: 'Appliquer engrais', sw: 'Weka mbolea', ha: 'Sa taki', tw: 'Gu ayaresa',
  },
  'flower-pest-tomato': {
    en: 'Check for pests', fr: 'Vérifier ravageurs', sw: 'Angalia wadudu', ha: 'Duba ƙwari', tw: 'Hwɛ mmoa',
  },
  'flower-pollination-cocoa': {
    en: 'Check pollination', fr: 'Vérifier pollinisation', sw: 'Angalia uchavushaji', ha: 'Duba haɗuwa', tw: 'Hwɛ nhyiren',
  },
  // ─── Fruiting ─────────────
  'fruit-monitor': {
    en: 'Monitor crop', fr: 'Surveiller culture', sw: 'Fuatilia mazao', ha: 'Lura da amfani', tw: 'Hwɛ nnɔbae',
  },
  'fruit-grain-fill': {
    en: 'Check grain fill', fr: 'Vérifier remplissage', sw: 'Angalia kujaa', ha: 'Duba cikawa', tw: 'Hwɛ aba',
  },
  'fruit-support-tomato': {
    en: 'Support plants', fr: 'Tuteurer les plants', sw: 'Tegemeza mimea', ha: 'Tallafa shuki', tw: 'Boa nnɔbae',
  },
  'fruit-cassava-tuber': {
    en: 'Check tubers', fr: 'Vérifier tubercules', sw: 'Angalia mizizi', ha: 'Duba dankali', tw: 'Hwɛ ase',
  },
  // ─── Harvest ──────────────
  'harvest-readiness': {
    en: 'Check harvest', fr: 'Vérifier récolte', sw: 'Angalia mavuno', ha: 'Duba girbi', tw: 'Hwɛ otwabere',
  },
  'harvest-tools': {
    en: 'Prepare tools', fr: 'Préparer outils', sw: 'Andaa zana', ha: 'Shirya kayan aiki', tw: 'Yɛ nnwinnade',
  },
  'harvest-storage': {
    en: 'Prepare storage', fr: 'Préparer stockage', sw: 'Andaa hifadhi', ha: 'Shirya ajiya', tw: 'Yɛ adekoradan',
  },
  // ─── Post-harvest ─────────
  'post-dry': {
    en: 'Dry harvest', fr: 'Sécher la récolte', sw: 'Kausha mazao', ha: 'Bushewa girbi', tw: 'Hwɛ otwa mu',
  },
  'post-sort': {
    en: 'Sort harvest', fr: 'Trier la récolte', sw: 'Panga mazao', ha: 'Tantance girbi', tw: 'Paw otwa mu',
  },
  'post-market': {
    en: 'Sell harvest', fr: 'Vendre la récolte', sw: 'Uza mazao', ha: 'Sayar da girbi', tw: 'Tɔn otwa mu',
  },
  'post-process-cassava': {
    en: 'Process cassava', fr: 'Transformer manioc', sw: 'Sindika muhogo', ha: 'Sarrafa rogo', tw: 'Yɛ bankye',
  },
  'post-process-cocoa': {
    en: 'Ferment cocoa', fr: 'Fermenter cacao', sw: 'Chacha kakao', ha: 'Haɗa koko', tw: 'Yɛ koko',
  },
};

// ─── Localized short descriptions ─────────────────────────────
// Farmer-friendly, 1-sentence action descriptions per task.
// Voice handles full explanation — these are for display only.
const TASK_DESCRIPTIONS = {
  // Planning
  'plan-select-seed': {
    en: 'Pick the best seeds for your soil and season.',
    fr: 'Choisissez les meilleures semences pour votre sol.',
    sw: 'Chagua mbegu bora kwa udongo wako.',
    ha: 'Zaɓi iri mafi kyau don ƙasarka.',
    tw: 'Yi aba a eye ma wʼasase.',
  },
  'plan-budget': {
    en: 'Plan how much to spend this season.',
    fr: 'Planifiez vos dépenses pour la saison.',
    sw: 'Panga matumizi ya msimu huu.',
    ha: 'Tsara yadda za ka kashe kuɗi.',
    tw: 'Hyehyɛ wo sika ma mberɛ yi.',
  },
  'plan-soil-test': {
    en: 'Check if your soil needs nutrients.',
    fr: 'Vérifiez si votre sol a besoin d\'engrais.',
    sw: 'Angalia kama udongo wako unahitaji rutuba.',
    ha: 'Duba ko ƙasarka tana buƙatar taki.',
    tw: 'Hwɛ sɛ wʼasase hia aduane.',
  },
  // Land prep
  'landprep-clear': {
    en: 'Remove old plants and debris from the field.',
    fr: 'Enlevez les vieilles plantes du champ.',
    sw: 'Ondoa mimea ya zamani shambani.',
    ha: 'Cire tsofaffin shuke daga gona.',
    tw: 'Yi nneɛma dada fi afuo no mu.',
  },
  'landprep-till-maize': {
    en: 'Turn the soil to prepare for planting.',
    fr: 'Retournez le sol pour préparer le semis.',
    sw: 'Geuza udongo kuandaa kupanda.',
    ha: 'Juya ƙasa don shirya shuka.',
    tw: 'Dan asase no yɛ nkrado.',
  },
  'landprep-beds-tomato': {
    en: 'Build raised beds for your seedlings.',
    fr: 'Préparez des planches surélevées.',
    sw: 'Andaa vitalu vya juu kwa miche.',
    ha: 'Shirya gadaje don shuki.',
    tw: 'Yɛ mfuom a ɛkɔ soro.',
  },
  'landprep-mound-cassava': {
    en: 'Build mounds for cassava cuttings.',
    fr: 'Faites des buttes pour le manioc.',
    sw: 'Fanya matuta ya muhogo.',
    ha: 'Yi tudu don rogo.',
    tw: 'Yɛ nkoko ma bankye.',
  },
  'landprep-shade-cocoa': {
    en: 'Set up shade trees for young cocoa.',
    fr: 'Installez des arbres d\'ombrage pour le cacao.',
    sw: 'Weka miti ya kivuli kwa kakao.',
    ha: 'Shirya bishiyoyin inuwa don koko.',
    tw: 'Yɛ suwusiw nnua ma koko.',
  },
  'landprep-level-rice': {
    en: 'Level the paddy field for even water.',
    fr: 'Nivelez la rizière pour une irrigation égale.',
    sw: 'Sawazisha shamba la mpunga.',
    ha: 'Daidaita gonar shinkafa.',
    tw: 'Tɛ asase no ma nsuo akɔ pɛpɛɛpɛ.',
  },
  // Planting
  'plant-seeds': {
    en: 'Sow seeds at the right depth and spacing.',
    fr: 'Semez à la bonne profondeur et distance.',
    sw: 'Panda mbegu kwa kina na nafasi sahihi.',
    ha: 'Shuka iri a zurfin da tazarar da ya dace.',
    tw: 'Dua aba wɔ anamɔn pa mu.',
  },
  'plant-first-water': {
    en: 'Water newly planted seeds gently.',
    fr: 'Arrosez doucement les graines semées.',
    sw: 'Mwagilia mbegu mpya kwa upole.',
    ha: 'Shayar da sabon iri a hankali.',
    tw: 'Gugu aba foforɔ no brɛoo.',
  },
  'plant-cassava-cuttings': {
    en: 'Plant healthy stem cuttings in mounds.',
    fr: 'Plantez des boutures saines dans les buttes.',
    sw: 'Panda vipandikizi vizuri kwenye matuta.',
    ha: 'Dasa saiwa masu lafiya a tudu.',
    tw: 'Dua ntwaso pa wɔ nkoko no mu.',
  },
  'plant-cocoa-seedlings': {
    en: 'Plant seedlings in prepared holes.',
    fr: 'Plantez les plants dans les trous préparés.',
    sw: 'Panda miche kwenye mashimo yaliyoandaliwa.',
    ha: 'Dasa shuki cikin ramuka da aka shirya.',
    tw: 'Dua nhaban wɔ tokuro a wɔayɛ mu.',
  },
  'plant-tomato-transplant': {
    en: 'Move seedlings to the main field.',
    fr: 'Transplantez les plants au champ.',
    sw: 'Hamisha miche kwenda shambani.',
    ha: 'Dasawa shuki zuwa gona.',
    tw: 'Fa nhaban no kɔ afuo kɛse no mu.',
  },
  // Germination
  'germ-check-emergence': {
    en: 'Look for new sprouts coming up.',
    fr: 'Vérifiez la levée des semis.',
    sw: 'Tazama miche mpya ikiibuka.',
    ha: 'Duba sabon tsiro yana fitowa.',
    tw: 'Hwɛ nhyiren foforɔ a ɛrefifiri.',
  },
  'germ-moisture': {
    en: 'Check if soil is moist enough.',
    fr: 'Vérifiez que le sol est assez humide.',
    sw: 'Angalia kama udongo una unyevu wa kutosha.',
    ha: 'Duba ko ƙasa tana da isasshen zafi.',
    tw: 'Hwɛ sɛ asase no yɛ nsuo.',
  },
  'germ-check-cassava': {
    en: 'Check that cuttings are sprouting.',
    fr: 'Vérifiez que les boutures germent.',
    sw: 'Angalia kama vipandikizi vinachipua.',
    ha: 'Duba ko saiwa suna fitowa.',
    tw: 'Hwɛ sɛ ntwaso no refifiri.',
  },
  // Vegetative
  'veg-weed': {
    en: 'Remove weeds around your plants.',
    fr: 'Enlevez les mauvaises herbes autour des plants.',
    sw: 'Ondoa magugu karibu na mimea.',
    ha: 'Cire ciyawa kusa da shuke.',
    tw: 'Tu wura a ɛwɔ nnɔbae no ho.',
  },
  'veg-fertilize-maize': {
    en: 'Apply fertilizer to boost growth.',
    fr: 'Appliquez l\'engrais pour stimuler la croissance.',
    sw: 'Weka mbolea kuongeza ukuaji.',
    ha: 'Sa taki don haɓaka girma.',
    tw: 'Gu ayaresa ma ɛnyini yie.',
  },
  'veg-fertilize-rice': {
    en: 'Apply fertilizer to boost growth.',
    fr: 'Appliquez l\'engrais pour stimuler la croissance.',
    sw: 'Weka mbolea kuongeza ukuaji.',
    ha: 'Sa taki don haɓaka girma.',
    tw: 'Gu ayaresa ma ɛnyini yie.',
  },
  'veg-pest-check': {
    en: 'Look for insects or damage on leaves.',
    fr: 'Cherchez des insectes ou dégâts sur les feuilles.',
    sw: 'Tafuta wadudu au uharibifu kwenye majani.',
    ha: 'Nema ƙwari ko lalacewar ganye.',
    tw: 'Hwɛ mmoa anaa sɛe wɔ ahaban so.',
  },
  'veg-prune-cocoa': {
    en: 'Cut dead branches for better airflow.',
    fr: 'Coupez les branches mortes pour l\'aération.',
    sw: 'Kata matawi yaliyokufa kwa hewa bora.',
    ha: 'Yanke rassan da suka mutu don iska.',
    tw: 'Twa mman a awu ama mframa akɔ.',
  },
  // Flowering
  'flower-water': {
    en: 'Water plants during flowering stage.',
    fr: 'Arrosez les plants en période de floraison.',
    sw: 'Mwagilia mimea wakati wa maua.',
    ha: 'Shayar da shuke lokacin fure.',
    tw: 'Gugu nnɔbae wɔ nhwiren berɛ mu.',
  },
  'flower-second-fert': {
    en: 'Apply second round of fertilizer.',
    fr: 'Appliquez la deuxième dose d\'engrais.',
    sw: 'Weka mbolea ya pili.',
    ha: 'Sa taki na karo na biyu.',
    tw: 'Gu ayaresa ne mprenu so.',
  },
  'flower-pest-tomato': {
    en: 'Check flowers for pest damage.',
    fr: 'Vérifiez les fleurs pour les dégâts d\'insectes.',
    sw: 'Angalia maua kwa uharibifu wa wadudu.',
    ha: 'Duba fure don lalacewar ƙwari.',
    tw: 'Hwɛ nhwiren so ma mmoa sɛe.',
  },
  'flower-pollination-cocoa': {
    en: 'Check that flowers are being pollinated.',
    fr: 'Vérifiez que les fleurs sont bien pollinisées.',
    sw: 'Angalia kama maua yanachavushwa.',
    ha: 'Duba ko fure suna haɗuwa.',
    tw: 'Hwɛ sɛ nhwiren no yɛ adwuma.',
  },
  // Fruiting
  'fruit-monitor': {
    en: 'Watch crop health as fruits develop.',
    fr: 'Surveillez la santé des plants en fructification.',
    sw: 'Fuatilia afya ya mimea wakati wa matunda.',
    ha: 'Lura da lafiyar shuke lokacin \'ya\'ya.',
    tw: 'Hwɛ nnɔbae mu apɔmuden bere a aba ba.',
  },
  'fruit-grain-fill': {
    en: 'Check that grains are filling properly.',
    fr: 'Vérifiez que les grains se remplissent bien.',
    sw: 'Angalia kama nafaka zinajaa vizuri.',
    ha: 'Duba ko hatsi suna cikawa sosai.',
    tw: 'Hwɛ sɛ aba no reyɛ ma yie.',
  },
  'fruit-support-tomato': {
    en: 'Stake plants to support heavy fruit.',
    fr: 'Tuteurez les plants pour soutenir les fruits.',
    sw: 'Weka nguzo kusaidia matunda mazito.',
    ha: 'Tallafa shuke don ɗaukar \'ya\'ya masu nauyi.',
    tw: 'Boa nnɔbae no so ma aba no.',
  },
  'fruit-cassava-tuber': {
    en: 'Check tuber size underground.',
    fr: 'Vérifiez la taille des tubercules sous terre.',
    sw: 'Angalia ukubwa wa mizizi chini ya ardhi.',
    ha: 'Duba girman dankali a ƙarƙashin ƙasa.',
    tw: 'Hwɛ nea ɛwɔ asase ase no kɛse.',
  },
  // Harvest
  'harvest-readiness': {
    en: 'Check if crop is ready to harvest.',
    fr: 'Vérifiez si la récolte est prête.',
    sw: 'Angalia kama mazao yako tayari kuvunwa.',
    ha: 'Duba ko amfanin gona ya shirya girbi.',
    tw: 'Hwɛ sɛ ɛberɛ a wobɛtwa no adue.',
  },
  'harvest-tools': {
    en: 'Get your harvest tools ready.',
    fr: 'Préparez vos outils de récolte.',
    sw: 'Andaa zana zako za mavuno.',
    ha: 'Shirya kayan aikin girbi.',
    tw: 'Yɛ wo nnwinnade a wode bɛtwa no yie.',
  },
  'harvest-storage': {
    en: 'Prepare a clean, dry storage area.',
    fr: 'Préparez un endroit de stockage propre et sec.',
    sw: 'Andaa eneo safi na kavu la kuhifadhi.',
    ha: 'Shirya wurin ajiya mai tsabta.',
    tw: 'Yɛ baabi a ɛyɛ hyew na ɛso.',
  },
  // Post-harvest
  'post-dry': {
    en: 'Dry your harvest in the sun safely.',
    fr: 'Séchez votre récolte au soleil en toute sécurité.',
    sw: 'Kausha mazao yako juani kwa usalama.',
    ha: 'Bushe girbi a rana cikin aminci.',
    tw: 'Hwɛ wo nneɛma no wɔ owia mu yie.',
  },
  'post-sort': {
    en: 'Sort harvest by quality — keep the best.',
    fr: 'Triez la récolte par qualité — gardez le meilleur.',
    sw: 'Panga mazao kwa ubora — weka bora.',
    ha: 'Tantance girbi — ajiye mafi kyau.',
    tw: 'Paw wo nneɛma no — fa papa no sie.',
  },
  'post-market': {
    en: 'Find the best price and sell your harvest.',
    fr: 'Trouvez le meilleur prix et vendez votre récolte.',
    sw: 'Tafuta bei nzuri na uuze mavuno yako.',
    ha: 'Nemi farashi mafi kyau ka sayar.',
    tw: 'Hwehwɛ boɔ pa na tɔn wo nneɛma.',
  },
  'post-process-cassava': {
    en: 'Peel and process cassava for storage.',
    fr: 'Épluchez et transformez le manioc pour le stockage.',
    sw: 'Menya na usindike muhogo kwa kuhifadhi.',
    ha: 'Ɓare kuma sarrafa rogo don ajiya.',
    tw: 'Wɔ na yɛ bankye no ma woasie.',
  },
  'post-process-cocoa': {
    en: 'Ferment and dry cocoa beans properly.',
    fr: 'Fermentez et séchez les fèves de cacao correctement.',
    sw: 'Chacha na ukaushe kakao vizuri.',
    ha: 'Haɗa kuma bushe ƙwayar koko sosai.',
    tw: 'Yɛ koko no na hwɛ no wɔ owia mu yie.',
  },
};

/**
 * Get the localized task title if available, else return original.
 * @param {string} taskId - Server task ID
 * @param {string} originalTitle - Original English title from server
 * @param {string} lang - Current language code (en, fr, sw, ha, tw)
 * @returns {string} Localized title or original
 */
export function getLocalizedTaskTitle(taskId, originalTitle, lang) {
  const entry = TASK_TITLES[taskId];
  if (entry && entry[lang]) return entry[lang];
  if (entry && entry.en) return entry.en; // fallback to our short English
  return originalTitle || '';
}

/**
 * Get the localized task description if available, else shorten original.
 * @param {string} taskId - Server task ID
 * @param {string} originalDesc - Original English description from server
 * @param {string} lang - Current language code (en, fr, sw, ha, tw)
 * @returns {string} Localized description or shortened original
 */
export function getLocalizedTaskDescription(taskId, originalDesc, lang) {
  const entry = TASK_DESCRIPTIONS[taskId];
  if (entry && entry[lang]) return entry[lang];
  if (entry && entry.en) return entry.en;
  return shortenDescription(originalDesc, 60);
}

/**
 * Truncate a description to a short form (max ~60 chars, sentence boundary).
 * For standard mode — voice handles full explanation.
 * @param {string} text
 * @param {number} maxLen
 * @returns {string}
 */
export function shortenDescription(text, maxLen = 60) {
  if (!text || text.length <= maxLen) return text || '';
  // Cut at last sentence boundary before maxLen
  const cut = text.slice(0, maxLen);
  const lastDot = cut.lastIndexOf('.');
  if (lastDot > 20) return cut.slice(0, lastDot + 1);
  // No good sentence break — cut at last space + ellipsis
  const lastSpace = cut.lastIndexOf(' ');
  return cut.slice(0, lastSpace > 10 ? lastSpace : maxLen) + '…';
}
