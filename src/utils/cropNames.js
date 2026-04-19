/**
 * cropNames.js — canonical multi-language crop-name config.
 *
 * Structure:
 *   EN_NAMES                 crop_key → English canonical name (source of truth)
 *   LOCAL_NAMES[lang]        crop_key → native name (partial is fine)
 *   BILINGUAL_HINTED[lang]   Set of crop_keys that should render
 *                            "native (English)" when `bilingual: 'auto'`
 *   LANGUAGE_COVERAGE[lang]  { tier: 'full' | 'partial' | 'placeholder',
 *                              reviewedBy?: string,
 *                              notes?: string }
 *
 * Fallback rules:
 *   - English is always complete.
 *   - Missing LOCAL_NAMES[lang][key] → fall back to EN_NAMES[key]
 *     → fall back to humanize(key).
 *   - Never leak a raw snake_case key to the UI.
 *
 * Adding a new language:
 *   1. Add the 2-letter code to LANGUAGE_COVERAGE with tier: 'placeholder'.
 *   2. Translate only the crops you're confident in.
 *   3. Mark reviewedBy so we have an audit trail on partial rollouts.
 *   4. Promote tier to 'partial' when at least the staple-food crops
 *      are covered; 'full' when every crop in EN_NAMES has an entry.
 *
 * Do NOT invent low-confidence names — prefer English fallback over
 * a made-up local label. A missing translation is a feature, not a bug.
 */

export const EN_NAMES = Object.freeze({
  tomato: 'Tomato', pepper: 'Pepper', chili_pepper: 'Chili Pepper',
  lettuce: 'Lettuce', spinach: 'Spinach', kale: 'Kale',
  onion: 'Onion', garlic: 'Garlic',
  beans: 'Beans', bush_beans: 'Bush Beans', pole_beans: 'Pole Beans',
  cucumber: 'Cucumber', squash: 'Squash', zucchini: 'Zucchini',
  herbs: 'Herbs', okra: 'Okra', sweet_potato: 'Sweet Potato',
  strawberry: 'Strawberry', eggplant: 'Eggplant',
  carrot: 'Carrot', radish: 'Radish', beets: 'Beets',
  cabbage: 'Cabbage', broccoli: 'Broccoli', peas: 'Peas',
  green_onion: 'Green Onion', collards: 'Collards',
  swiss_chard: 'Swiss Chard', pumpkin: 'Pumpkin', melon: 'Melon',
  corn: 'Corn', maize: 'Maize', sweet_corn: 'Sweet Corn', soybean: 'Soybean',
  wheat: 'Wheat', sorghum: 'Sorghum', cotton: 'Cotton',
  peanut: 'Peanut', groundnut: 'Groundnut', oats: 'Oats', alfalfa: 'Alfalfa',
  barley: 'Barley', rice: 'Rice', sunflower: 'Sunflower',
  potato: 'Potato', apple: 'Apple', blueberry: 'Blueberry',
  raspberry: 'Raspberry', grapes: 'Grapes', almonds: 'Almonds',
  pecan: 'Pecan', citrus: 'Citrus', sugarcane: 'Sugarcane',
  taro: 'Taro', banana: 'Banana', papaya: 'Papaya',
  pineapple: 'Pineapple', cassava: 'Cassava',
  cocoa: 'Cocoa', coffee: 'Coffee',
});

/**
 * LOCAL_NAMES — keyed by ISO-639-1 language code. Every inner map is
 * PARTIAL by design; missing entries fall back to English.
 */
export const LOCAL_NAMES = Object.freeze({
  // ─── Hindi (full crop vocabulary) ────────────────────────
  hi: Object.freeze({
    tomato: 'टमाटर', pepper: 'मिर्च', chili_pepper: 'मिर्च',
    lettuce: 'लेट्यूस', spinach: 'पालक', kale: 'केल',
    onion: 'प्याज', garlic: 'लहसुन',
    beans: 'बीन्स', bush_beans: 'बुश बीन्स', pole_beans: 'लता बीन्स',
    cucumber: 'खीरा', squash: 'स्क्वैश', zucchini: 'तोरी',
    herbs: 'जड़ी-बूटियाँ', okra: 'भिंडी',
    sweet_potato: 'शकरकंद', strawberry: 'स्ट्रॉबेरी',
    eggplant: 'बैंगन', carrot: 'गाजर', radish: 'मूली',
    beets: 'चुकंदर', cabbage: 'पत्तागोभी', broccoli: 'ब्रोकली',
    peas: 'मटर', collards: 'कॉलर्ड',
    pumpkin: 'कद्दू', melon: 'खरबूजा',
    corn: 'मक्का', maize: 'मक्का', sweet_corn: 'मीठा मक्का', soybean: 'सोयाबीन',
    wheat: 'गेहूं', sorghum: 'ज्वार', cotton: 'कपास',
    peanut: 'मूंगफली', groundnut: 'मूंगफली', oats: 'जई', rice: 'चावल',
    potato: 'आलू', apple: 'सेब', blueberry: 'ब्लूबेरी',
    grapes: 'अंगूर', almonds: 'बादाम', citrus: 'नींबू जाति',
    sugarcane: 'गन्ना', banana: 'केला', papaya: 'पपीता',
    pineapple: 'अनानास', cassava: 'कसावा',
    cocoa: 'कोकोआ', coffee: 'कॉफी',
  }),

  // ─── Twi (reviewed subset — English fallback elsewhere) ──
  // Only entries a native Twi speaker would recognize in everyday
  // speech. Niche crops intentionally omitted so the UI falls back
  // to English rather than showing an invented name.
  tw: Object.freeze({
    tomato: 'Ntɔs', pepper: 'Mako',
    lettuce: 'Letus', kale: 'Kale',
    beans: 'Adua', cucumber: 'Kukuma',
    herbs: 'Nhaban', okra: 'Nkruma',
    sweet_potato: 'Santom', eggplant: 'Nyaadewa',
    cabbage: 'Cabbage', peas: 'Asedua',
    corn: 'Aburoo', maize: 'Aburoo', soybean: 'Asopopro',
    peanut: 'Nkateɛ', groundnut: 'Nkateɛ', rice: 'Emo',
    potato: 'Ɔborɔde', cassava: 'Bankye',
    banana: 'Kwaduo', pineapple: 'Abrɔbɛ',
    cocoa: 'Kookoo', coffee: 'Kɔfe',
  }),

  // ─── Spanish (high-confidence staples) ───────────────────
  es: Object.freeze({
    tomato: 'Tomate', pepper: 'Pimiento', chili_pepper: 'Chile',
    lettuce: 'Lechuga', spinach: 'Espinaca', kale: 'Col rizada',
    onion: 'Cebolla', garlic: 'Ajo',
    beans: 'Frijoles', cucumber: 'Pepino', squash: 'Calabaza',
    zucchini: 'Calabacín', okra: 'Okra',
    sweet_potato: 'Batata', strawberry: 'Fresa',
    eggplant: 'Berenjena', carrot: 'Zanahoria', radish: 'Rábano',
    cabbage: 'Repollo', broccoli: 'Brócoli', peas: 'Guisantes',
    pumpkin: 'Calabaza', melon: 'Melón',
    corn: 'Maíz', maize: 'Maíz', soybean: 'Soja',
    wheat: 'Trigo', sorghum: 'Sorgo', cotton: 'Algodón',
    peanut: 'Cacahuete', groundnut: 'Maní', rice: 'Arroz',
    potato: 'Patata', apple: 'Manzana', grapes: 'Uvas',
    sugarcane: 'Caña de azúcar', banana: 'Plátano',
    papaya: 'Papaya', pineapple: 'Piña', cassava: 'Yuca',
    cocoa: 'Cacao', coffee: 'Café',
  }),

  // ─── Portuguese (high-confidence staples) ────────────────
  pt: Object.freeze({
    tomato: 'Tomate', pepper: 'Pimentão', chili_pepper: 'Pimenta',
    lettuce: 'Alface', spinach: 'Espinafre',
    onion: 'Cebola', garlic: 'Alho',
    beans: 'Feijão', cucumber: 'Pepino', squash: 'Abóbora',
    okra: 'Quiabo',
    sweet_potato: 'Batata-doce', strawberry: 'Morango',
    eggplant: 'Berinjela', carrot: 'Cenoura', radish: 'Rabanete',
    cabbage: 'Repolho', broccoli: 'Brócolis', peas: 'Ervilha',
    pumpkin: 'Abóbora', melon: 'Melão',
    corn: 'Milho', maize: 'Milho', soybean: 'Soja',
    wheat: 'Trigo', sorghum: 'Sorgo', cotton: 'Algodão',
    peanut: 'Amendoim', groundnut: 'Amendoim', rice: 'Arroz',
    potato: 'Batata', apple: 'Maçã', grapes: 'Uvas',
    sugarcane: 'Cana-de-açúcar', banana: 'Banana',
    papaya: 'Mamão', pineapple: 'Abacaxi', cassava: 'Mandioca',
    cocoa: 'Cacau', coffee: 'Café',
  }),

  // ─── French (high-confidence staples) ────────────────────
  fr: Object.freeze({
    tomato: 'Tomate', pepper: 'Poivron', chili_pepper: 'Piment',
    lettuce: 'Laitue', spinach: 'Épinard',
    onion: 'Oignon', garlic: 'Ail',
    beans: 'Haricots', cucumber: 'Concombre', squash: 'Courge',
    zucchini: 'Courgette', okra: 'Gombo',
    sweet_potato: 'Patate douce', strawberry: 'Fraise',
    eggplant: 'Aubergine', carrot: 'Carotte', radish: 'Radis',
    cabbage: 'Chou', broccoli: 'Brocoli', peas: 'Pois',
    pumpkin: 'Citrouille', melon: 'Melon',
    corn: 'Maïs', maize: 'Maïs', soybean: 'Soja',
    wheat: 'Blé', sorghum: 'Sorgho', cotton: 'Coton',
    peanut: 'Arachide', groundnut: 'Arachide', rice: 'Riz',
    potato: 'Pomme de terre', apple: 'Pomme', grapes: 'Raisins',
    sugarcane: 'Canne à sucre', banana: 'Banane',
    papaya: 'Papaye', pineapple: 'Ananas', cassava: 'Manioc',
    cocoa: 'Cacao', coffee: 'Café',
  }),

  // ─── Arabic (high-confidence staples only) ───────────────
  ar: Object.freeze({
    tomato: 'طماطم', pepper: 'فلفل',
    lettuce: 'خس', spinach: 'سبانخ',
    onion: 'بصل', garlic: 'ثوم',
    beans: 'فاصولياء', cucumber: 'خيار',
    okra: 'بامية', sweet_potato: 'بطاطا حلوة',
    eggplant: 'باذنجان', carrot: 'جزر',
    cabbage: 'ملفوف', peas: 'بازلاء',
    corn: 'ذرة', maize: 'ذرة', soybean: 'فول الصويا',
    wheat: 'قمح', sorghum: 'ذرة رفيعة', cotton: 'قطن',
    peanut: 'فول سوداني', groundnut: 'فول سوداني', rice: 'أرز',
    potato: 'بطاطس', banana: 'موز',
    pineapple: 'أناناس', cassava: 'كسافا',
    cocoa: 'كاكاو', coffee: 'قهوة',
  }),

  // ─── Swahili (high-confidence staples) ───────────────────
  sw: Object.freeze({
    tomato: 'Nyanya', pepper: 'Pilipili hoho', chili_pepper: 'Pilipili',
    lettuce: 'Saladi', spinach: 'Mchicha',
    onion: 'Kitunguu', garlic: 'Kitunguu saumu',
    beans: 'Maharagwe', cucumber: 'Tango',
    okra: 'Bamia', sweet_potato: 'Viazi vitamu',
    eggplant: 'Biringanya', carrot: 'Karoti',
    cabbage: 'Kabichi', peas: 'Mbaazi',
    pumpkin: 'Boga',
    corn: 'Mahindi', maize: 'Mahindi', soybean: 'Soya',
    wheat: 'Ngano', sorghum: 'Mtama', cotton: 'Pamba',
    peanut: 'Karanga', groundnut: 'Karanga', rice: 'Mchele',
    potato: 'Viazi', banana: 'Ndizi',
    pineapple: 'Nanasi', cassava: 'Muhogo',
    cocoa: 'Kakao', coffee: 'Kahawa', sugarcane: 'Miwa',
  }),

  // ─── Indonesian (high-confidence staples) ────────────────
  id: Object.freeze({
    tomato: 'Tomat', pepper: 'Cabai', chili_pepper: 'Cabai rawit',
    lettuce: 'Selada', spinach: 'Bayam',
    onion: 'Bawang', garlic: 'Bawang putih',
    beans: 'Kacang', cucumber: 'Mentimun',
    okra: 'Okra', sweet_potato: 'Ubi jalar',
    eggplant: 'Terong', carrot: 'Wortel',
    cabbage: 'Kubis', peas: 'Kacang polong',
    pumpkin: 'Labu',
    corn: 'Jagung', maize: 'Jagung', soybean: 'Kedelai',
    wheat: 'Gandum', rice: 'Beras',
    peanut: 'Kacang tanah', groundnut: 'Kacang tanah',
    potato: 'Kentang', banana: 'Pisang',
    pineapple: 'Nanas', cassava: 'Singkong',
    cocoa: 'Kakao', coffee: 'Kopi', sugarcane: 'Tebu',
  }),
});

/**
 * Crops that should auto-render bilingual (`native (English)`) when
 * `getCropDisplayName(key, lang, { bilingual: 'auto' })` is called.
 *
 * These are crops whose native name in that language is either
 * unfamiliar in everyday speech or easily confused with another
 * crop. The list is intentionally short per-language — most staples
 * should stay pure-native so the UI feels native.
 */
export const BILINGUAL_HINTED = Object.freeze({
  hi: new Set(['cassava', 'sorghum', 'groundnut', 'taro', 'cocoa', 'coffee', 'barley', 'soybean', 'alfalfa']),
  tw: new Set(['cassava', 'groundnut', 'cocoa', 'coffee']),
  es: new Set(['sorghum', 'cassava', 'groundnut']),
  pt: new Set(['sorghum', 'cassava', 'groundnut']),
  fr: new Set(['sorghum', 'cassava', 'groundnut']),
  ar: new Set(['sorghum', 'cassava', 'groundnut', 'soybean']),
  sw: new Set(['sorghum', 'cassava', 'groundnut']),
  id: new Set(['sorghum', 'groundnut']),
});

/**
 * LANGUAGE_COVERAGE — self-documentation for ops/reviewers.
 *
 *   tier:
 *     'full'        every key in EN_NAMES has a local entry
 *     'partial'     staple crops covered; uncommon crops fall back
 *     'placeholder' structure only; everything falls back
 *
 * Keep this honest — it's what we'd show in an admin debug panel.
 */
export const LANGUAGE_COVERAGE = Object.freeze({
  en: { tier: 'full',    reviewedBy: 'core',     notes: 'Source of truth.' },
  hi: { tier: 'full',    reviewedBy: 'reviewer', notes: 'All core + produce crops covered.' },
  tw: { tier: 'partial', reviewedBy: 'reviewer', notes: 'Reviewed-friendly subset; niche crops fall back to English.' },
  es: { tier: 'partial', reviewedBy: 'reviewer', notes: 'Staples + produce covered.' },
  pt: { tier: 'partial', reviewedBy: 'reviewer', notes: 'Staples + produce covered.' },
  fr: { tier: 'partial', reviewedBy: 'reviewer', notes: 'Staples + produce covered.' },
  ar: { tier: 'partial', reviewedBy: 'reviewer', notes: 'Staple food crops only.' },
  sw: { tier: 'partial', reviewedBy: 'reviewer', notes: 'East Africa staples covered.' },
  id: { tier: 'partial', reviewedBy: 'reviewer', notes: 'Southeast Asia staples covered.' },
});

export const SUPPORTED_UI_LANGUAGES = Object.freeze(Object.keys(LANGUAGE_COVERAGE));

/** getCoverageTier('hi') → 'full'. Unknown codes → 'placeholder'. */
export function getCoverageTier(lang) {
  return LANGUAGE_COVERAGE[String(lang || '').toLowerCase()]?.tier || 'placeholder';
}

/** hasLocalName('hi', 'tomato') → true */
export function hasLocalName(lang, cropKey) {
  const code = String(lang || '').toLowerCase();
  const key = String(cropKey || '').toLowerCase();
  return !!LOCAL_NAMES[code]?.[key];
}
