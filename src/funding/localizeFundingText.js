/**
 * localizeFundingText — UI-layer phrase localizer for funding
 * eligibility reasons + benefit lines.
 *
 * The funding matcher (`src/funding/fundingMatcher.js`) and the
 * sample-opportunity dataset (`src/funding/sampleOpportunities.js`)
 * push English literals into the rendered output (e.g.
 * "Available in your country", "Open to all regions",
 * "Free training + certificate of completion"). Modifying the
 * matcher to emit translation keys would touch business logic,
 * which is out of scope for the i18n sweep — this UI helper
 * intercepts the literal at render time and returns the
 * localised value when one is known.
 *
 * Pure function. Returns the input unchanged when:
 *   • lang is missing or 'en'
 *   • the input string isn't in the phrase map (unknown server
 *     opportunity titles, custom benefit lines, etc.)
 *
 * Usage at the call site:
 *   import { localizeFundingText } from '../funding/localizeFundingText.js';
 *   <span>{localizeFundingText(reason, lang)}</span>
 */

const PHRASES = Object.freeze({
  // fundingMatcher.js reasons
  'Available in your country': {
    fr: 'Disponible dans votre pays',
    sw: 'Inapatikana katika nchi yako',
    ha: 'Akwai a ƙasarka',
    tw: 'Ɛwɔ wo ɔman mu',
    hi: 'आपके देश में उपलब्ध',
  },
  'Open to all regions': {
    fr: 'Ouvert à toutes les régions',
    sw: 'Iko wazi kwa maeneo yote',
    ha: 'A buɗe ga dukkan yankuna',
    tw: 'Bue ma mantam nyinaa',
    hi: 'सभी क्षेत्रों के लिए खुला',
  },
  'Open to any crop': {
    fr: 'Ouvert à toutes les cultures',
    sw: 'Iko wazi kwa zao lolote',
    ha: 'A buɗe ga kowane shuka',
    tw: 'Bue ma aduane biara',
    hi: 'किसी भी फसल के लिए खुला',
  },
  // sampleOpportunities.js benefit lines
  'Free training + certificate of completion': {
    fr: 'Formation gratuite + certificat de fin de formation',
    sw: 'Mafunzo bure + cheti cha kumaliza',
    ha: 'Horo kyauta + takardar shaidar kammalawa',
    tw: 'Adesua a wontua hwee + adansedie krataa',
    hi: 'मुफ़्त प्रशिक्षण + पूर्णता प्रमाणपत्र',
  },
  'Subsidised seed and fertiliser package': {
    fr: 'Semences et engrais subventionnés',
    sw: 'Mbegu na mbolea kwa bei nafuu',
    ha: 'Iririn da taki mai tallafi',
    tw: 'Aba ne nsɔhwɛ a wɔatua so ka',
    hi: 'सब्सिडी वाला बीज और उर्वरक पैकेज',
  },
  'Cash transfer to support productivity': {
    fr: 'Transfert d\u2019argent pour soutenir la productivité',
    sw: 'Uhamishaji wa pesa kuongeza uzalishaji',
    ha: 'Tura kuɗi don tallafawa yawan amfani',
    tw: 'Sika a yɛde boa adwumayɛ',
    hi: 'उत्पादकता बढ़ाने के लिए नकद सहायता',
  },
});

/**
 * @param {string} text  raw English literal
 * @param {string} lang  active short language code
 * @returns {string} localised string, or `text` unchanged when
 *                  no mapping exists / lang is en/missing
 */
export function localizeFundingText(text, lang) {
  if (!text || typeof text !== 'string') return text || '';
  if (!lang || lang === 'en') return text;
  const trimmed = text.trim();
  const row = PHRASES[trimmed];
  if (row && row[lang]) return row[lang];
  return text;
}

export default localizeFundingText;

// Test seam.
export const _internal = Object.freeze({ PHRASES });
