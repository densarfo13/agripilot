/**
 * getCropDisplayName(cropKey, language, options?) — consistent crop
 * naming across languages.
 *
 * Default behavior:
 *   - English UI  → English canonical name (e.g. "Cassava")
 *   - Hindi UI    → Hindi name ONLY (e.g. "कसावा")
 *   - Twi UI      → Twi name, with English fallback
 *   - Unknown crop keys humanize cleanly
 *     ("swiss_chard" → "Swiss chard" / "स्विस चार्ड" etc.)
 *
 * Bilingual mode — show "कसावा (Cassava)" — is opt-in:
 *   getCropDisplayName('cassava', 'hi')                → "कसावा"
 *   getCropDisplayName('cassava', 'hi', { bilingual: true })
 *                                                     → "कसावा (Cassava)"
 *   getCropDisplayName('cassava', 'hi', { bilingual: 'auto' })
 *                                                     → "कसावा (Cassava)"  // in BILINGUAL_HINTED
 *   getCropDisplayName('tomato',  'hi', { bilingual: 'auto' })
 *                                                     → "टमाटर"             // not in BILINGUAL_HINTED
 *
 * BILINGUAL_HINTED lists crops whose native name is likely unfamiliar
 * to a typical Hindi speaker (imported global crops, niche tropical
 * cash crops). Keep the list small — most staple crops should stay
 * native-only so the UI feels native.
 */

/** English canonical names — single source of truth. */
const EN_NAMES = Object.freeze({
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
 * Native-language labels. Anything not listed falls back to the
 * English name so we never leak a raw crop key to the UI.
 *
 * Hindi spelling follows the spec's requested forms where they
 * differ from everyday transliteration (e.g. गेहूं vs गेहूँ).
 */
const LOCAL_NAMES = Object.freeze({
  hi: {
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
  },
  tw: {
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
  },
});

/**
 * Crops that should auto-show bilingual when `options.bilingual === 'auto'`.
 * Intentionally short: crops whose native-language name is the same
 * transliteration as the English one, or that a farmer might not
 * recognize by the native label in everyday speech.
 */
const BILINGUAL_HINTED = Object.freeze({
  hi: new Set(['cassava', 'sorghum', 'groundnut', 'taro', 'cocoa', 'coffee', 'barley', 'soybean', 'alfalfa']),
  tw: new Set(['cassava', 'groundnut', 'cocoa', 'coffee']),
});

function humanize(cropKey) {
  if (!cropKey) return '';
  const tail = String(cropKey).split('.').pop() || cropKey;
  const spaced = tail.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  if (!spaced) return '';
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

/**
 * @param {string} cropKey
 * @param {string} [language='en']
 * @param {{bilingual?: boolean | 'auto'}} [options]
 */
export function getCropDisplayName(cropKey, language = 'en', options = {}) {
  if (!cropKey) return '';
  const key = String(cropKey).toLowerCase();
  const english = EN_NAMES[key] || humanize(key);
  const lang = String(language || 'en').toLowerCase();
  if (lang === 'en') return english;

  const local = LOCAL_NAMES[lang]?.[key];
  // No native label → English fallback (so we never render a raw key).
  if (!local) return english;
  // Native label happens to match English → no point adding parens.
  if (local === english) return english;

  const bilingual = options?.bilingual;
  const shouldBilingual =
    bilingual === true
    || (bilingual === 'auto' && BILINGUAL_HINTED[lang]?.has(key));

  return shouldBilingual ? `${local} (${english})` : local;
}

export const _internal = { EN_NAMES, LOCAL_NAMES, BILINGUAL_HINTED, humanize };
