/**
 * Phone + Country Integration Tests
 *
 * Covers:
 * - normalizePhoneForStorage (server utility)
 * - validatePhone (server utility)
 * - Country dataset integrity via src/utils/countries.js
 * - getCountry / getCountryName / getDialCode helper functions
 *
 * Kept practical and maintainable — no HTTP layer, no mocks needed.
 */

import { describe, it, expect } from 'vitest';
import { normalizePhoneForStorage, validatePhone } from '../utils/phoneUtils.js';

// ─── normalizePhoneForStorage ─────────────────────────────

describe('normalizePhoneForStorage', () => {
  it('strips surrounding whitespace', () => {
    expect(normalizePhoneForStorage('  +254712345678  ')).toBe('+254712345678');
  });

  it('strips internal spaces', () => {
    expect(normalizePhoneForStorage('+254 712 345 678')).toBe('+254712345678');
  });

  it('strips dashes', () => {
    expect(normalizePhoneForStorage('+44-20-7946-0958')).toBe('+442079460958');
  });

  it('strips parentheses and dots', () => {
    expect(normalizePhoneForStorage('+1 (555) 867.5309')).toBe('+15558675309');
  });

  it('leaves already-clean E.164 number unchanged', () => {
    expect(normalizePhoneForStorage('+255712345678')).toBe('+255712345678');
  });

  it('handles national-format number with no + (no dial prepending)', () => {
    // Server does NOT prepend dial code — that is the frontend's job
    expect(normalizePhoneForStorage('0712345678')).toBe('0712345678');
  });

  it('returns falsy input as-is', () => {
    expect(normalizePhoneForStorage('')).toBe('');
    expect(normalizePhoneForStorage(null)).toBe(null);
    expect(normalizePhoneForStorage(undefined)).toBe(undefined);
  });
});

// ─── validatePhone ────────────────────────────────────────

describe('validatePhone', () => {
  it('accepts a full E.164 Kenyan number', () => {
    expect(validatePhone('+254712345678').valid).toBe(true);
  });

  it('accepts a full E.164 Nigerian number', () => {
    expect(validatePhone('+2348012345678').valid).toBe(true);
  });

  it('accepts a short 7-digit local number', () => {
    expect(validatePhone('1234567').valid).toBe(true);
  });

  it('rejects a number with fewer than 7 digits', () => {
    const r = validatePhone('12345');
    expect(r.valid).toBe(false);
    expect(r.message).toBeTruthy();
  });

  it('rejects a number with more than 15 digits', () => {
    const r = validatePhone('+12345678901234567'); // 17 digits
    expect(r.valid).toBe(false);
  });

  it('rejects empty string', () => {
    expect(validatePhone('').valid).toBe(false);
  });

  it('rejects null/undefined', () => {
    expect(validatePhone(null).valid).toBe(false);
    expect(validatePhone(undefined).valid).toBe(false);
  });

  it('strips non-digit chars when counting — e.g. "+254 712 345 678" passes', () => {
    // After normalizePhoneForStorage this would be "+254712345678", but even raw it passes
    expect(validatePhone('+254 712 345 678').valid).toBe(true);
  });
});

// ─── Country dataset integrity ────────────────────────────
// Import the shared frontend dataset — plain data module with no browser deps.

import COUNTRIES, { getCountry, getCountryName, getDialCode } from '../../../src/utils/countries.js';

describe('COUNTRIES dataset', () => {
  it('contains at least 190 countries', () => {
    expect(COUNTRIES.length).toBeGreaterThanOrEqual(190);
  });

  it('every entry has iso2, name, and dialCode', () => {
    for (const c of COUNTRIES) {
      expect(c.iso2).toBeTruthy();
      expect(c.name).toBeTruthy();
      expect(c.dialCode).toBeTruthy();
    }
  });

  it('iso2 codes are exactly 2 uppercase characters', () => {
    for (const c of COUNTRIES) {
      expect(c.iso2).toMatch(/^[A-Z]{2}$/);
    }
  });

  it('dialCode values start with "+"', () => {
    for (const c of COUNTRIES) {
      expect(c.dialCode.startsWith('+')).toBe(true);
    }
  });

  it('no duplicate iso2 codes', () => {
    const seen = new Set();
    for (const c of COUNTRIES) {
      expect(seen.has(c.iso2)).toBe(false);
      seen.add(c.iso2);
    }
  });
});

// ─── Core African markets present ────────────────────────

describe('Core market countries', () => {
  const coreMarkets = [
    { iso2: 'KE', name: 'Kenya',    dialCode: '+254' },
    { iso2: 'TZ', name: 'Tanzania', dialCode: '+255' },
    { iso2: 'UG', name: 'Uganda',   dialCode: '+256' },
    { iso2: 'GH', name: 'Ghana',    dialCode: '+233' },
    { iso2: 'NG', name: 'Nigeria',  dialCode: '+234' },
    { iso2: 'ET', name: 'Ethiopia', dialCode: '+251' },
    { iso2: 'RW', name: 'Rwanda',   dialCode: '+250' },
  ];

  for (const { iso2, name, dialCode } of coreMarkets) {
    it(`${name} (${iso2}) is present with correct dial code ${dialCode}`, () => {
      const c = getCountry(iso2);
      expect(c).toBeTruthy();
      expect(c.name).toBe(name);
      expect(c.dialCode).toBe(dialCode);
    });
  }
});

// ─── Helper functions ─────────────────────────────────────

describe('getCountryName', () => {
  it('returns country name for valid ISO2', () => {
    expect(getCountryName('KE')).toBe('Kenya');
    expect(getCountryName('NG')).toBe('Nigeria');
  });

  it('is case-insensitive', () => {
    expect(getCountryName('ke')).toBe('Kenya');
  });

  it('returns the ISO2 code itself as fallback for unknown code', () => {
    expect(getCountryName('XX')).toBe('XX');
  });

  it('returns em-dash for null/empty', () => {
    expect(getCountryName('')).toBe('—');
    expect(getCountryName(null)).toBe('—');
  });
});

describe('getDialCode', () => {
  it('returns dial code for valid ISO2', () => {
    expect(getDialCode('KE')).toBe('+254');
    expect(getDialCode('TZ')).toBe('+255');
    expect(getDialCode('NG')).toBe('+234');
  });

  it('is case-insensitive', () => {
    expect(getDialCode('ke')).toBe('+254');
  });

  it('returns empty string for unknown ISO2', () => {
    expect(getDialCode('XX')).toBe('');
  });

  it('returns empty string for null/undefined', () => {
    expect(getDialCode(null)).toBe('');
    expect(getDialCode(undefined)).toBe('');
  });
});

// ─── countryCode storage consistency ────────────────────

describe('countryCode storage', () => {
  it('DEFAULT_COUNTRY_CODE KE resolves to a known country', () => {
    const DEFAULT = 'KE';
    const c = getCountry(DEFAULT);
    expect(c).toBeTruthy();
    expect(c.iso2).toBe('KE');
  });

  it('ISO2 codes are stable storage keys (no display names stored)', () => {
    // Confirm dataset stores iso2 as the storage key, not display names
    const ke = COUNTRIES.find(c => c.name === 'Kenya');
    expect(ke.iso2).toBe('KE');
    const tz = COUNTRIES.find(c => c.name === 'Tanzania');
    expect(tz.iso2).toBe('TZ');
  });
});
