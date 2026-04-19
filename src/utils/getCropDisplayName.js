/**
 * getCropDisplayName(cropKey, language) — consistent crop naming
 * across languages.
 *
 * Rules:
 *   - English returns the canonical capitalized name.
 *   - Non-English returns the native label + "(English)" in parens
 *     when the two differ, so a farmer reading Hindi UI still sees
 *     "कसावा (Cassava)" and doesn't lose the cross-reference.
 *   - Unknown crop keys humanize cleanly ("swiss_chard" →
 *     "Swiss chard") instead of leaking the raw key.
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
  corn: 'Corn', sweet_corn: 'Sweet Corn', soybean: 'Soybean',
  wheat: 'Wheat', sorghum: 'Sorghum', cotton: 'Cotton',
  peanut: 'Peanut', oats: 'Oats', alfalfa: 'Alfalfa',
  barley: 'Barley', rice: 'Rice', sunflower: 'Sunflower',
  potato: 'Potato', apple: 'Apple', blueberry: 'Blueberry',
  raspberry: 'Raspberry', grapes: 'Grapes', almonds: 'Almonds',
  pecan: 'Pecan', citrus: 'Citrus', sugarcane: 'Sugarcane',
  taro: 'Taro', banana: 'Banana', papaya: 'Papaya',
  pineapple: 'Pineapple', cassava: 'Cassava',
});

/** Native-language labels. Anything not listed falls back to the English name. */
const LOCAL_NAMES = Object.freeze({
  hi: {
    tomato: 'टमाटर', pepper: 'मिर्च', chili_pepper: 'मिर्च',
    lettuce: 'लेट्यूस', spinach: 'पालक', kale: 'केल',
    onion: 'प्याज़', garlic: 'लहसुन',
    beans: 'सेम', bush_beans: 'बुश सेम', pole_beans: 'लता सेम',
    cucumber: 'खीरा', squash: 'स्क्वैश', zucchini: 'तोरी',
    herbs: 'जड़ी-बूटियाँ', okra: 'भिंडी',
    sweet_potato: 'शकरकंद', strawberry: 'स्ट्रॉबेरी',
    eggplant: 'बैंगन', carrot: 'गाजर', radish: 'मूली',
    beets: 'चुकंदर', cabbage: 'पत्तागोभी', broccoli: 'ब्रोकली',
    peas: 'मटर', collards: 'कॉलर्ड',
    pumpkin: 'कद्दू', melon: 'खरबूजा',
    corn: 'मक्का', sweet_corn: 'मीठा मक्का', soybean: 'सोयाबीन',
    wheat: 'गेहूँ', sorghum: 'ज्वार', cotton: 'कपास',
    peanut: 'मूँगफली', oats: 'जई', rice: 'चावल',
    potato: 'आलू', apple: 'सेब', blueberry: 'ब्लूबेरी',
    grapes: 'अंगूर', almonds: 'बादाम', citrus: 'नींबू जाति',
    sugarcane: 'गन्ना', banana: 'केला', papaya: 'पपीता',
    pineapple: 'अनानास', cassava: 'कसावा',
  },
  tw: {
    tomato: 'Ntɔs', pepper: 'Mako',
    lettuce: 'Letus', kale: 'Kale',
    beans: 'Adua', cucumber: 'Kukuma',
    herbs: 'Nhaban', okra: 'Nkruma',
    sweet_potato: 'Santom', eggplant: 'Nyaadewa',
    cabbage: 'Cabbage', peas: 'Asedua',
    corn: 'Aburoo', soybean: 'Asopopro',
    peanut: 'Nkateɛ', rice: 'Emo',
    potato: 'Ɔborɔde', cassava: 'Bankye',
    banana: 'Kwaduo', pineapple: 'Abrɔbɛ',
  },
});

function humanize(cropKey) {
  if (!cropKey) return '';
  const tail = String(cropKey).split('.').pop() || cropKey;
  const spaced = tail.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  if (!spaced) return '';
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

export function getCropDisplayName(cropKey, language = 'en') {
  if (!cropKey) return '';
  const key = String(cropKey).toLowerCase();
  const english = EN_NAMES[key] || humanize(key);
  const lang = String(language || 'en').toLowerCase();
  if (lang === 'en') return english;

  const local = LOCAL_NAMES[lang]?.[key];
  if (!local) return english;
  if (local === english) return english;
  // Farmer-friendly cross-reference: native name + English in parens.
  return `${local} (${english})`;
}

export const _internal = { EN_NAMES, LOCAL_NAMES, humanize };
