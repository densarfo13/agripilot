/**
 * cropTraitI18n.test.js — verifies the 6 new crop-trait + fit keys
 * resolve correctly per language, and that missing locales fall
 * back to English rather than breaking the UI.
 *
 * Keys covered:
 *   fit.high / fit.medium / fit.low
 *   cropTraits.beginnerFriendly
 *   cropTraits.lowWater
 *   cropTraits.droughtTolerant
 *
 * Hausa ('ha') is intentionally absent from these entries — the
 * reviewer hasn't supplied it yet — so every `ha` lookup should
 * fall back to English without breaking.
 */
import { describe, it, expect } from 'vitest';
import { t } from '../../../src/i18n/index.js';

const EXPECTED = {
  'fit.high': {
    en: 'High fit',
    hi: 'उच्च उपयुक्तता',
    tw: 'Ɛfata paa',
    es: 'Alta compatibilidad',
    pt: 'Alta compatibilidade',
    fr: 'Très adapté',
    ar: 'ملاءمة عالية',
    sw: 'Ulinganifu wa juu',
    id: 'Sangat cocok',
  },
  'fit.medium': {
    en: 'Medium fit',
    hi: 'मध्यम उपयुक्तता',
    tw: 'Ɛfata kakra',
    es: 'Compatibilidad media',
    pt: 'Compatibilidade média',
    fr: 'Adaptation moyenne',
    ar: 'ملاءمة متوسطة',
    sw: 'Ulinganifu wa kati',
    id: 'Cukup cocok',
  },
  'fit.low': {
    en: 'Low fit',
    hi: 'कम उपयुक्तता',
    tw: 'Ɛmfata paa',
    es: 'Baja compatibilidad',
    pt: 'Baixa compatibilidade',
    fr: 'Faible adaptation',
    ar: 'ملاءمة منخفضة',
    sw: 'Ulinganifu mdogo',
    id: 'Kurang cocok',
  },
  'cropTraits.beginnerFriendly': {
    en: 'Beginner-friendly',
    hi: 'शुरुआती के लिए उपयुक्त',
    tw: 'Ɛfata wɔn a wɔrefi ase',
    es: 'Apto para principiantes',
    pt: 'Bom para iniciantes',
    fr: 'Adapté aux débutants',
    ar: 'مناسب للمبتدئين',
    sw: 'Inafaa kwa wanaoanza',
    id: 'Cocok untuk pemula',
  },
  'cropTraits.lowWater': {
    en: 'Low water needs',
    hi: 'कम पानी की जरूरत',
    tw: 'Nsuo kakra na ehia',
    es: 'Necesita poca agua',
    pt: 'Precisa de pouca água',
    fr: 'Faible besoin en eau',
    ar: 'يحتاج ماء قليل',
    sw: 'Inahitaji maji kidogo',
    id: 'Kebutuhan air rendah',
  },
  'cropTraits.droughtTolerant': {
    en: 'Drought tolerant',
    hi: 'सूखा सहनशील',
    tw: 'Egyina ɔpɛ so',
    es: 'Resistente a la sequía',
    pt: 'Tolerante à seca',
    fr: 'Tolérant à la sécheresse',
    ar: 'يتحمل الجفاف',
    sw: 'Inastahimili ukame',
    id: 'Tahan kekeringan',
  },
};

describe('crop trait + fit keys — all 9 locales resolve correctly', () => {
  for (const [key, map] of Object.entries(EXPECTED)) {
    describe(key, () => {
      for (const [lang, expected] of Object.entries(map)) {
        it(`${lang} → ${expected}`, () => {
          expect(t(key, lang)).toBe(expected);
        });
      }
    });
  }
});

describe('Hausa fallback', () => {
  it('falls back to English for every new trait key', () => {
    for (const key of Object.keys(EXPECTED)) {
      expect(t(key, 'ha')).toBe(EXPECTED[key].en);
    }
  });
});

describe('Unknown locale fallback', () => {
  it.each(['zz', '', null, undefined])(
    'locale %p falls back to English',
    (lang) => {
      expect(t('fit.high', lang)).toBe('High fit');
      expect(t('cropTraits.beginnerFriendly', lang)).toBe('Beginner-friendly');
    },
  );
});
