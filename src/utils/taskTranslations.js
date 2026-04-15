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
