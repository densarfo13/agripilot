/**
 * localization.js — canonical alias → key normalisers for crops,
 * growth stages and farm statuses.
 *
 * Many older records in the Farroway store persist the DISPLAY
 * string ("Cassava", "Bankye", "Manioc") instead of the canonical
 * key ("cassava"). These normalisers accept any of those legacy
 * display strings (in any supported language), trim + lowercase,
 * and return the canonical JSON key used in the new locale files
 * (src/i18n/locales/*).
 *
 * Usage:
 *   const cropKey = normalizeCropKey(farm.cropKey || farm.cropName || farm.crop);
 *   t(`crops.${cropKey}`)
 *
 * The "existing records must keep rendering" rule (spec §14 +
 * acceptance §6) is satisfied here — any legacy value still lands
 * on the right locale row.
 */

export const cropAliasToKey = {
  cassava: 'cassava',
  bankye: 'cassava',
  manioc: 'cassava',
  yuca: 'cassava',
  mandioca: 'cassava',
  muhogo: 'cassava',

  maize: 'maize',
  aburo: 'maize',
  maïs: 'maize',
  mais: 'maize',
  maiz: 'maize',
  'maíz': 'maize',
  milho: 'maize',
  mahindi: 'maize',
  corn: 'maize',

  rice: 'rice',
  emo: 'rice',
  riz: 'rice',
  arroz: 'rice',
  mchele: 'rice',

  tomato: 'tomato',
  ntomaa: 'tomato',
  tomate: 'tomato',
  nyanya: 'tomato',

  pepper: 'pepper',
  mako: 'pepper',
  piment: 'pepper',
  pimiento: 'pepper',
  pimenta: 'pepper',
  pilipili: 'pepper',

  onion: 'onion',
  gyene: 'onion',
  oignon: 'onion',
  cebolla: 'onion',
  cebola: 'onion',
  kitunguu: 'onion',

  okra: 'okra',
  nkruma: 'okra',
  gombo: 'okra',
  'quimbombó': 'okra',
  quimbombo: 'okra',
  quiabo: 'okra',
  bamia: 'okra',

  yam: 'yam',
  bayere: 'yam',
  igname: 'yam',
  'ñame': 'yam',
  name: 'yam',
  inhame: 'yam',
  'viazi vikuu': 'yam',

  plantain: 'plantain',
  'borɔdeɛ': 'plantain',
  'banane plantain': 'plantain',
  'plátano': 'plantain',
  plátano: 'plantain',
  platano: 'plantain',
  'banana-da-terra': 'plantain',
  'ndizi za kupika': 'plantain',

  cocoa: 'cocoa',
  kookoo: 'cocoa',
  cacao: 'cocoa',
  cacau: 'cocoa',
  kakao: 'cocoa',

  groundnut: 'groundnut',
  'nkateɛ': 'groundnut',
  nkatee: 'groundnut',
  arachide: 'groundnut',
  cacahuete: 'groundnut',
  amendoim: 'groundnut',
  karanga: 'groundnut',
  peanut: 'groundnut',

  beans: 'beans',
  bean: 'beans',
  'aduane aba': 'beans',
  haricots: 'beans',
  frijoles: 'beans',
  'feijão': 'beans',
  feijao: 'beans',
  maharage: 'beans',
};

export const stageAliasToKey = {
  planting: 'planting',
  dua: 'planting',
  plantation: 'planting',
  siembra: 'planting',
  plantio: 'planting',
  kupanda: 'planting',

  establishment: 'establishment',
  'agyina pintinn': 'establishment',
  installation: 'establishment',
  establecimiento: 'establishment',
  estabelecimento: 'establishment',
  'kuota na kushika': 'establishment',

  vegetative: 'vegetative',
  'nhaban mu mpuntuo': 'vegetative',
  'végétatif': 'vegetative',
  vegetatif: 'vegetative',
  vegetativo: 'vegetative',
  'ukuaji wa majani': 'vegetative',

  bulking: 'bulking',
  'nsono mu mpuntuo': 'bulking',
  grossissement: 'bulking',
  engrosamiento: 'bulking',
  engrossamento: 'bulking',
  'kuongezeka ukubwa': 'bulking',

  maturation: 'maturation',
  'akwanhyia': 'maturation',
  akwanhyia: 'maturation',
  'maduración': 'maturation',
  maduracion: 'maturation',
  'maturação': 'maturation',
  maturacao: 'maturation',
  kukomaa: 'maturation',

  harvest: 'harvest',
  twabere: 'harvest',
  'récolte': 'harvest',
  recolte: 'harvest',
  cosecha: 'harvest',
  colheita: 'harvest',
  mavuno: 'harvest',
};

export const statusAliasToKey = {
  fair: 'fair',
  'ɛyɛ kakra': 'fair',
  moyen: 'fair',
  regular: 'fair',
  wastani: 'fair',

  good: 'good',
  'ɛyɛ': 'good',
  bon: 'good',
  bueno: 'good',
  bom: 'good',
  nzuri: 'good',

  excellent: 'excellent',
  'ɛyɛ paa': 'excellent',
  excelente: 'excellent',
  'bora sana': 'excellent',

  poor: 'poor',
  'ɛnyɛ yiye': 'poor',
  faible: 'poor',
  deficiente: 'poor',
  fraco: 'poor',
  dhaifu: 'poor',
};

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

/**
 * normalizeCropKey — any legacy crop string → canonical JSON key.
 * Falls back to 'cassava' only when nothing matches (spec-mandated
 * safe default so UI always finds a translation row).
 */
export function normalizeCropKey(value) {
  const raw = normalize(value);
  return cropAliasToKey[raw] || raw || 'cassava';
}

export function normalizeStageKey(value) {
  const raw = normalize(value);
  return stageAliasToKey[raw] || raw || 'planting';
}

export function normalizeStatusKey(value) {
  const raw = normalize(value);
  return statusAliasToKey[raw] || raw || 'fair';
}
