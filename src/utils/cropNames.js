/**
 * cropNames.js — canonical multi-language crop-name config.
 *
 * Structure (crop-first for reviewability — all translations of one
 * crop live together):
 *
 *   cropNames[cropKey][lang] = {
 *     label:     string,     // localized label shown on the card
 *     english?:  string,     // English cross-reference (for bilingual)
 *     bilingual?: boolean,   // default-render "label (english)" when true
 *   }
 *
 * The `bilingual` flag is opt-in per (crop × language) pair. This is
 * the right grain: e.g. we want "ज्वार (Sorghum)" in Hindi because
 * the Hindi name is unfamiliar, but plain "टमाटर" for tomato. We also
 * keep "Muhogo (Cassava)" in Swahili so field officers can read
 * across languages — but "Nyanya" stays plain.
 *
 * Fallback: any missing entry falls through to English. Never leak a
 * raw snake_case crop key to the UI — humanize() does the final
 * safety net for crops outside this config.
 */

export const SUPPORTED_LANGUAGES = Object.freeze([
  'en', 'hi', 'tw', 'es', 'pt', 'fr', 'ar', 'sw', 'id',
]);

export const CROP_KEYS = Object.freeze([
  'tomato', 'pepper', 'lettuce', 'beans', 'corn', 'maize',
  'peanut', 'groundnut', 'sorghum', 'wheat', 'rice', 'onion',
  'potato', 'cassava', 'banana', 'cocoa', 'coffee', 'sweet_potato',
  'soybean', 'cucumber', 'okra', 'yam', 'millet',
]);

export const cropNames = Object.freeze({
  tomato: {
    en: { label: 'Tomato' },
    hi: { label: 'टमाटर' },
    tw: { label: 'Tomato', english: 'Tomato', bilingual: false },
    es: { label: 'Tomate' },
    pt: { label: 'Tomate' },
    fr: { label: 'Tomate' },
    ar: { label: 'طماطم' },
    sw: { label: 'Nyanya' },
    id: { label: 'Tomat' },
  },

  pepper: {
    en: { label: 'Pepper' },
    hi: { label: 'मिर्च' },
    tw: { label: 'Pepper', english: 'Pepper', bilingual: false },
    es: { label: 'Pimiento' },
    pt: { label: 'Pimenta' },
    fr: { label: 'Poivron' },
    ar: { label: 'فلفل' },
    sw: { label: 'Pilipili' },
    id: { label: 'Cabai' },
  },

  lettuce: {
    en: { label: 'Lettuce' },
    hi: { label: 'लेट्यूस' },
    tw: { label: 'Lettuce', english: 'Lettuce', bilingual: false },
    es: { label: 'Lechuga' },
    pt: { label: 'Alface' },
    fr: { label: 'Laitue' },
    ar: { label: 'خس' },
    sw: { label: 'Lettuce', english: 'Lettuce', bilingual: false },
    id: { label: 'Selada' },
  },

  beans: {
    en: { label: 'Beans' },
    hi: { label: 'बीन्स' },
    tw: { label: 'Beans', english: 'Beans', bilingual: false },
    es: { label: 'Frijoles' },
    pt: { label: 'Feijão' },
    fr: { label: 'Haricots' },
    ar: { label: 'فاصوليا' },
    sw: { label: 'Maharage' },
    id: { label: 'Kacang' },
  },

  corn: {
    en: { label: 'Corn' },
    hi: { label: 'मक्का' },
    tw: { label: 'Corn', english: 'Corn', bilingual: false },
    es: { label: 'Maíz' },
    pt: { label: 'Milho' },
    fr: { label: 'Maïs' },
    ar: { label: 'ذرة' },
    sw: { label: 'Mahindi' },
    id: { label: 'Jagung' },
  },

  maize: {
    en: { label: 'Maize' },
    hi: { label: 'मक्का' },
    tw: { label: 'Aburo', english: 'Maize', bilingual: true },
    es: { label: 'Maíz' },
    pt: { label: 'Milho' },
    fr: { label: 'Maïs' },
    ar: { label: 'ذرة' },
    sw: { label: 'Mahindi' },
    id: { label: 'Jagung' },
  },

  peanut: {
    en: { label: 'Peanut' },
    hi: { label: 'मूंगफली', english: 'Peanut', bilingual: true },
    tw: { label: 'Groundnut', english: 'Peanut', bilingual: true },
    es: { label: 'Cacahuate' },
    pt: { label: 'Amendoim' },
    fr: { label: 'Arachide' },
    ar: { label: 'فول سوداني' },
    sw: { label: 'Karanga' },
    id: { label: 'Kacang Tanah' },
  },

  groundnut: {
    en: { label: 'Groundnut' },
    hi: { label: 'मूंगफली', english: 'Groundnut', bilingual: true },
    tw: { label: 'Groundnut', english: 'Groundnut', bilingual: false },
    es: { label: 'Maní' },
    pt: { label: 'Amendoim' },
    fr: { label: 'Arachide' },
    ar: { label: 'فول سوداني' },
    sw: { label: 'Karanga' },
    id: { label: 'Kacang Tanah' },
  },

  sorghum: {
    en: { label: 'Sorghum' },
    hi: { label: 'ज्वार', english: 'Sorghum', bilingual: true },
    tw: { label: 'Sorghum', english: 'Sorghum', bilingual: false },
    es: { label: 'Sorgo' },
    pt: { label: 'Sorgo' },
    fr: { label: 'Sorgho' },
    ar: { label: 'الذرة الرفيعة' },
    sw: { label: 'Mtama', english: 'Sorghum', bilingual: true },
    id: { label: 'Sorgum' },
  },

  wheat: {
    en: { label: 'Wheat' },
    hi: { label: 'गेहूं' },
    tw: { label: 'Wheat', english: 'Wheat', bilingual: false },
    es: { label: 'Trigo' },
    pt: { label: 'Trigo' },
    fr: { label: 'Blé' },
    ar: { label: 'قمح' },
    sw: { label: 'Ngano' },
    id: { label: 'Gandum' },
  },

  rice: {
    en: { label: 'Rice' },
    hi: { label: 'चावल' },
    tw: { label: 'Rice', english: 'Rice', bilingual: false },
    es: { label: 'Arroz' },
    pt: { label: 'Arroz' },
    fr: { label: 'Riz' },
    ar: { label: 'أرز' },
    sw: { label: 'Mchele' },
    id: { label: 'Padi' },
  },

  onion: {
    en: { label: 'Onion' },
    hi: { label: 'प्याज' },
    tw: { label: 'Onion', english: 'Onion', bilingual: false },
    es: { label: 'Cebolla' },
    pt: { label: 'Cebola' },
    fr: { label: 'Oignon' },
    ar: { label: 'بصل' },
    sw: { label: 'Kitunguu' },
    id: { label: 'Bawang' },
  },

  potato: {
    en: { label: 'Potato' },
    hi: { label: 'आलू' },
    tw: { label: 'Potato', english: 'Potato', bilingual: false },
    es: { label: 'Papa' },
    pt: { label: 'Batata' },
    fr: { label: 'Pomme de terre' },
    ar: { label: 'بطاطس' },
    sw: { label: 'Viazi' },
    id: { label: 'Kentang' },
  },

  cassava: {
    en: { label: 'Cassava' },
    hi: { label: 'कसावा', english: 'Cassava', bilingual: true },
    tw: { label: 'Bankye', english: 'Cassava', bilingual: true },
    es: { label: 'Yuca', english: 'Cassava', bilingual: true },
    pt: { label: 'Mandioca', english: 'Cassava', bilingual: true },
    fr: { label: 'Manioc', english: 'Cassava', bilingual: true },
    ar: { label: 'كسافا' },
    sw: { label: 'Muhogo', english: 'Cassava', bilingual: true },
    id: { label: 'Singkong', english: 'Cassava', bilingual: true },
  },

  banana: {
    en: { label: 'Banana' },
    hi: { label: 'केला' },
    tw: { label: 'Borɔdeɛ', english: 'Banana', bilingual: true },
    es: { label: 'Banano' },
    pt: { label: 'Banana' },
    fr: { label: 'Banane' },
    ar: { label: 'موز' },
    sw: { label: 'Ndizi' },
    id: { label: 'Pisang' },
  },

  cocoa: {
    en: { label: 'Cocoa' },
    hi: { label: 'कोकोआ', english: 'Cocoa', bilingual: true },
    tw: { label: 'Cocoa', english: 'Cocoa', bilingual: false },
    es: { label: 'Cacao' },
    pt: { label: 'Cacau' },
    fr: { label: 'Cacao' },
    ar: { label: 'كاكاو' },
    sw: { label: 'Kakao' },
    id: { label: 'Kakao' },
  },

  coffee: {
    en: { label: 'Coffee' },
    hi: { label: 'कॉफी' },
    tw: { label: 'Coffee', english: 'Coffee', bilingual: false },
    es: { label: 'Café' },
    pt: { label: 'Café' },
    fr: { label: 'Café' },
    ar: { label: 'قهوة' },
    sw: { label: 'Kahawa' },
    id: { label: 'Kopi' },
  },

  sweet_potato: {
    en: { label: 'Sweet Potato' },
    hi: { label: 'शकरकंद', english: 'Sweet Potato', bilingual: true },
    tw: { label: 'Sweet Potato', english: 'Sweet Potato', bilingual: false },
    es: { label: 'Batata', english: 'Sweet Potato', bilingual: true },
    pt: { label: 'Batata-doce', english: 'Sweet Potato', bilingual: true },
    fr: { label: 'Patate douce', english: 'Sweet Potato', bilingual: true },
    ar: { label: 'بطاطا حلوة' },
    sw: { label: 'Viazi vitamu', english: 'Sweet Potato', bilingual: true },
    id: { label: 'Ubi Jalar', english: 'Sweet Potato', bilingual: true },
  },

  soybean: {
    en: { label: 'Soybean' },
    hi: { label: 'सोयाबीन' },
    tw: { label: 'Soybean', english: 'Soybean', bilingual: false },
    es: { label: 'Soja' },
    pt: { label: 'Soja' },
    fr: { label: 'Soja' },
    ar: { label: 'فول الصويا' },
    sw: { label: 'Soya', english: 'Soybean', bilingual: true },
    id: { label: 'Kedelai' },
  },

  cucumber: {
    en: { label: 'Cucumber' },
    hi: { label: 'खीरा' },
    tw: { label: 'Cucumber', english: 'Cucumber', bilingual: false },
    es: { label: 'Pepino' },
    pt: { label: 'Pepino' },
    fr: { label: 'Concombre' },
    ar: { label: 'خيار' },
    sw: { label: 'Tango' },
    id: { label: 'Mentimun' },
  },

  okra: {
    en: { label: 'Okra' },
    hi: { label: 'भिंडी', english: 'Okra', bilingual: true },
    tw: { label: 'Okro', english: 'Okra', bilingual: true },
    es: { label: 'Okra', english: 'Okra', bilingual: false },
    pt: { label: 'Quiabo', english: 'Okra', bilingual: true },
    fr: { label: 'Gombo', english: 'Okra', bilingual: true },
    ar: { label: 'بامية' },
    sw: { label: 'Bamia', english: 'Okra', bilingual: true },
    id: { label: 'Okra' },
  },

  yam: {
    en: { label: 'Yam' },
    hi: { label: 'रतालू', english: 'Yam', bilingual: true },
    tw: { label: 'Bayere', english: 'Yam', bilingual: true },
    es: { label: 'Ñame', english: 'Yam', bilingual: true },
    pt: { label: 'Inhame', english: 'Yam', bilingual: true },
    fr: { label: 'Igname', english: 'Yam', bilingual: true },
    ar: { label: 'يام' },
    sw: { label: 'Yam', english: 'Yam', bilingual: false },
    id: { label: 'Ubi Yam', english: 'Yam', bilingual: true },
  },

  millet: {
    en: { label: 'Millet' },
    hi: { label: 'बाजरा', english: 'Millet', bilingual: true },
    tw: { label: 'Millet', english: 'Millet', bilingual: false },
    es: { label: 'Mijo', english: 'Millet', bilingual: true },
    pt: { label: 'Milheto', english: 'Millet', bilingual: true },
    fr: { label: 'Mil', english: 'Millet', bilingual: true },
    ar: { label: 'دخن' },
    sw: { label: 'Mtama', english: 'Millet', bilingual: true },
    id: { label: 'Millet' },
  },
});

// ─── Coverage metadata (self-documentation for an admin panel) ──
export const LANGUAGE_COVERAGE = Object.freeze({
  en: { tier: 'full',    reviewedBy: 'core',     notes: 'Source of truth.' },
  hi: { tier: 'full',    reviewedBy: 'reviewer', notes: 'All 23 canonical crops covered.' },
  tw: { tier: 'partial', reviewedBy: 'reviewer', notes: 'Reviewed-friendly subset; uncommon crops fall back to English.' },
  es: { tier: 'partial', reviewedBy: 'reviewer', notes: 'Staple + produce coverage.' },
  pt: { tier: 'partial', reviewedBy: 'reviewer', notes: 'Staple + produce coverage.' },
  fr: { tier: 'partial', reviewedBy: 'reviewer', notes: 'Staple + produce coverage.' },
  ar: { tier: 'partial', reviewedBy: 'reviewer', notes: 'Staple food crops covered.' },
  sw: { tier: 'partial', reviewedBy: 'reviewer', notes: 'East Africa staples covered.' },
  id: { tier: 'partial', reviewedBy: 'reviewer', notes: 'Southeast Asia staples covered.' },
});

export const SUPPORTED_UI_LANGUAGES = SUPPORTED_LANGUAGES;

export function getCoverageTier(lang) {
  return LANGUAGE_COVERAGE[String(lang || '').toLowerCase()]?.tier || 'placeholder';
}

export function hasLocalName(lang, cropKey) {
  const code = String(lang || '').toLowerCase();
  const key = String(cropKey || '').toLowerCase();
  return !!cropNames[key]?.[code]?.label;
}

// ─── Backward-compat exports ──────────────────────────────
// The pre-existing API exposed EN_NAMES, LOCAL_NAMES, and
// BILINGUAL_HINTED. We derive them from `cropNames` so there's one
// source of truth; callers written against the old API keep working.
const _en = {};
for (const [k, m] of Object.entries(cropNames)) _en[k] = m.en?.label || k;
export const EN_NAMES = Object.freeze(_en);

const _local = {};
for (const lang of SUPPORTED_LANGUAGES) {
  if (lang === 'en') continue;
  const inner = {};
  for (const [k, m] of Object.entries(cropNames)) {
    const entry = m[lang];
    if (entry?.label) inner[k] = entry.label;
  }
  _local[lang] = Object.freeze(inner);
}
export const LOCAL_NAMES = Object.freeze(_local);

const _hinted = {};
for (const lang of SUPPORTED_LANGUAGES) {
  if (lang === 'en') continue;
  const set = new Set();
  for (const [k, m] of Object.entries(cropNames)) {
    if (m[lang]?.bilingual) set.add(k);
  }
  _hinted[lang] = set;
}
export const BILINGUAL_HINTED = Object.freeze(_hinted);
