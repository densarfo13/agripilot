/**
 * cropDisplayName.test.js — language-aware crop naming across the
 * 23-crop config and 9 supported languages.
 *
 * Default behavior (no options): each entry's own `bilingual` flag
 * decides whether to render "native (English)" or pure native.
 * Staples like tomato/rice/onion stay native-only because their
 * entries have no flag; less-familiar crops like cassava/sorghum
 * render bilingual because their entries opt in.
 */
import { describe, it, expect } from 'vitest';
import {
  getCropDisplayName,
  BILINGUAL_HINTED,
  SUPPORTED_LANGUAGES,
  CROP_KEYS,
} from '../../../src/utils/getCropDisplayName.js';

// ─── English ──────────────────────────────────────────────
describe('getCropDisplayName — English', () => {
  it('returns canonical English names', () => {
    expect(getCropDisplayName('tomato', 'en')).toBe('Tomato');
    expect(getCropDisplayName('sweet_potato', 'en')).toBe('Sweet Potato');
    expect(getCropDisplayName('cocoa', 'en')).toBe('Cocoa');
  });

  it('humanizes unknown keys without leaking underscores', () => {
    expect(getCropDisplayName('dragon_fruit', 'en')).toBe('Dragon fruit');
  });

  it('returns empty string for empty input', () => {
    expect(getCropDisplayName('', 'en')).toBe('');
    expect(getCropDisplayName(null, 'en')).toBe('');
  });
});

// ─── Hindi — staples (default native only) ────────────────
describe('Hindi — staples default to native only', () => {
  const stapleNative = [
    ['tomato',  'टमाटर'],
    ['pepper',  'मिर्च'],
    ['lettuce', 'लेट्यूस'],
    ['beans',   'बीन्स'],
    ['corn',    'मक्का'],
    ['maize',   'मक्का'],
    ['wheat',   'गेहूं'],
    ['rice',    'चावल'],
    ['onion',   'प्याज'],
    ['potato',  'आलू'],
    ['banana',  'केला'],
    ['coffee',  'कॉफी'],
    ['soybean', 'सोयाबीन'],
    ['cucumber','खीरा'],
  ];
  it.each(stapleNative)('%s → %s (pure Hindi, no Latin)', (key, expected) => {
    const out = getCropDisplayName(key, 'hi');
    expect(out).toBe(expected);
    expect(/[A-Za-z]/.test(out)).toBe(false);
  });
});

// ─── Hindi — less-familiar crops default to bilingual ─────
describe('Hindi — unfamiliar crops default to bilingual', () => {
  it.each([
    ['peanut',       'मूंगफली (Peanut)'],
    ['groundnut',    'मूंगफली (Groundnut)'],
    ['sorghum',      'ज्वार (Sorghum)'],
    ['cassava',      'कसावा (Cassava)'],
    ['cocoa',        'कोकोआ (Cocoa)'],
    ['sweet_potato', 'शकरकंद (Sweet Potato)'],
    ['okra',         'भिंडी (Okra)'],
    ['yam',          'रतालू (Yam)'],
    ['millet',       'बाजरा (Millet)'],
  ])('%s → %s (entry flag triggers bilingual)', (key, expected) => {
    expect(getCropDisplayName(key, 'hi')).toBe(expected);
  });
});

// ─── Options override ─────────────────────────────────────
describe('Options override the entry default', () => {
  it('bilingual:false forces native even for flagged entries', () => {
    expect(getCropDisplayName('cassava', 'hi', { bilingual: false })).toBe('कसावा');
    expect(getCropDisplayName('sorghum', 'hi', { bilingual: false })).toBe('ज्वार');
  });

  it('bilingual:true forces bilingual on unflagged entries', () => {
    expect(getCropDisplayName('tomato', 'hi', { bilingual: true })).toBe('टमाटर (Tomato)');
    expect(getCropDisplayName('rice',   'hi', { bilingual: true })).toBe('चावल (Rice)');
  });

  it('bilingual:"auto" (compat) defers to the entry flag', () => {
    expect(getCropDisplayName('cassava', 'hi', { bilingual: 'auto' })).toBe('कसावा (Cassava)');
    expect(getCropDisplayName('tomato',  'hi', { bilingual: 'auto' })).toBe('टमाटर');
  });
});

// ─── Twi ──────────────────────────────────────────────────
describe('Twi — reviewed subset', () => {
  it('uses confident Twi names where available', () => {
    expect(getCropDisplayName('cassava', 'tw')).toBe('Bankye (Cassava)');
    expect(getCropDisplayName('maize',   'tw')).toBe('Aburo (Maize)');
    expect(getCropDisplayName('peanut',  'tw')).toBe('Groundnut (Peanut)');
    expect(getCropDisplayName('yam',     'tw')).toBe('Bayere (Yam)');
  });

  it('returns English placeholder for unconfident names', () => {
    // lettuce entry is explicitly { label: 'Lettuce', bilingual: false }
    expect(getCropDisplayName('lettuce', 'tw')).toBe('Lettuce');
    expect(getCropDisplayName('rice',    'tw')).toBe('Rice');
  });
});

// ─── Spanish / Portuguese / French / Arabic / Swahili / Indonesian ──
describe('Spanish (es) staple coverage', () => {
  it.each([
    ['tomato', 'Tomate'],
    ['rice', 'Arroz'],
    ['maize', 'Maíz'],
    ['peanut', 'Cacahuate'],
    ['onion', 'Cebolla'],
    ['potato', 'Papa'],
    ['banana', 'Banano'],
  ])('%s → %s (native only)', (k, v) => {
    expect(getCropDisplayName(k, 'es')).toBe(v);
  });
  it('cassava is bilingual by default', () => {
    expect(getCropDisplayName('cassava', 'es')).toBe('Yuca (Cassava)');
  });
  it('falls back to English for crops not in the config', () => {
    expect(getCropDisplayName('blueberry', 'es')).toBe('Blueberry');
  });
});

describe('Portuguese (pt) staple coverage', () => {
  it.each([
    ['tomato', 'Tomate'],
    ['maize',  'Milho'],
    ['peanut', 'Amendoim'],
    ['rice',   'Arroz'],
  ])('%s → %s (native only)', (k, v) => {
    expect(getCropDisplayName(k, 'pt')).toBe(v);
  });
  it('cassava is bilingual by default', () => {
    expect(getCropDisplayName('cassava', 'pt')).toBe('Mandioca (Cassava)');
  });
});

describe('French (fr) staple coverage', () => {
  it.each([
    ['tomato', 'Tomate'],
    ['maize',  'Maïs'],
    ['peanut', 'Arachide'],
    ['wheat',  'Blé'],
  ])('%s → %s (native only)', (k, v) => {
    expect(getCropDisplayName(k, 'fr')).toBe(v);
  });
  it('cassava is bilingual by default', () => {
    expect(getCropDisplayName('cassava', 'fr')).toBe('Manioc (Cassava)');
  });
});

describe('Arabic (ar) staple coverage', () => {
  it.each([
    ['tomato',  'طماطم'],
    ['rice',    'أرز'],
    ['cassava', 'كسافا'],    // no bilingual flag in ar
  ])('%s → %s (native only)', (k, v) => {
    expect(getCropDisplayName(k, 'ar')).toBe(v);
  });
  it('falls back to English for unsupported Arabic crops', () => {
    expect(getCropDisplayName('blueberry', 'ar')).toBe('Blueberry');
  });
});

describe('Swahili (sw) staple coverage', () => {
  it.each([
    ['tomato', 'Nyanya'],
    ['maize',  'Mahindi'],
    ['peanut', 'Karanga'],
    ['beans',  'Maharage'],
  ])('%s → %s (native only)', (k, v) => {
    expect(getCropDisplayName(k, 'sw')).toBe(v);
  });
  it('cassava / sorghum / sweet_potato are bilingual by default', () => {
    expect(getCropDisplayName('cassava',      'sw')).toBe('Muhogo (Cassava)');
    expect(getCropDisplayName('sorghum',      'sw')).toBe('Mtama (Sorghum)');
    expect(getCropDisplayName('sweet_potato', 'sw')).toBe('Viazi vitamu (Sweet Potato)');
  });
});

describe('Indonesian (id) staple coverage', () => {
  it.each([
    ['tomato',  'Tomat'],
    ['rice',    'Padi'],
    ['maize',   'Jagung'],
  ])('%s → %s (native only)', (k, v) => {
    expect(getCropDisplayName(k, 'id')).toBe(v);
  });
  it('cassava is bilingual by default', () => {
    expect(getCropDisplayName('cassava', 'id')).toBe('Singkong (Cassava)');
  });
});

// ─── Language switching + fallback ────────────────────────
describe('Unknown language codes fall back to English', () => {
  it.each(['', 'zz', 'klingon'])('%p → English', (lang) => {
    expect(getCropDisplayName('tomato',  lang)).toBe('Tomato');
    expect(getCropDisplayName('cassava', lang)).toBe('Cassava');
  });
});

describe('Language switching — same key, different label per language', () => {
  it('cassava resolves per the active language', () => {
    expect(getCropDisplayName('cassava', 'en')).toBe('Cassava');
    expect(getCropDisplayName('cassava', 'hi')).toBe('कसावा (Cassava)');
    expect(getCropDisplayName('cassava', 'tw')).toBe('Bankye (Cassava)');
    expect(getCropDisplayName('cassava', 'es')).toBe('Yuca (Cassava)');
    expect(getCropDisplayName('cassava', 'fr')).toBe('Manioc (Cassava)');
    expect(getCropDisplayName('cassava', 'sw')).toBe('Muhogo (Cassava)');
  });
});

// ─── Coverage metadata ────────────────────────────────────
describe('LANGUAGE_COVERAGE + SUPPORTED_LANGUAGES + CROP_KEYS', () => {
  it('SUPPORTED_LANGUAGES includes all 9 locales', () => {
    expect(SUPPORTED_LANGUAGES).toEqual(['en','hi','tw','es','pt','fr','ar','sw','id']);
  });

  it('CROP_KEYS covers the 23 canonical crops', () => {
    expect(CROP_KEYS.length).toBeGreaterThanOrEqual(23);
    for (const k of ['tomato','pepper','cassava','sorghum','yam','millet']) {
      expect(CROP_KEYS.includes(k)).toBe(true);
    }
  });

  it('BILINGUAL_HINTED is derived correctly from entry flags', () => {
    expect(BILINGUAL_HINTED.hi.has('cassava')).toBe(true);
    expect(BILINGUAL_HINTED.hi.has('tomato')).toBe(false);
  });

  it('Twi fallback: crops without confident native name render English only', () => {
    // The entry has label='Lettuce', english='Lettuce', bilingual:false
    // so rendering should NOT double up as "Lettuce (Lettuce)".
    expect(getCropDisplayName('lettuce', 'tw')).toBe('Lettuce');
    // Even when forced bilingual, the label===english guard protects us.
    expect(getCropDisplayName('lettuce', 'tw', { bilingual: true })).toBe('Lettuce');
  });
});

// ─── Backward-compat: CropRecommendationStep usage ────────
describe('back-compat with onboarding card', () => {
  it('bilingual:"auto" keeps the existing onboarding caller working', () => {
    // CropRecommendationStep passes { bilingual: 'auto' }.
    // That means defer to the entry flag.
    expect(getCropDisplayName('tomato',  'hi', { bilingual: 'auto' })).toBe('टमाटर');
    expect(getCropDisplayName('cassava', 'hi', { bilingual: 'auto' })).toBe('कसावा (Cassava)');
  });
});
