/**
 * Swahili Language Consistency — source-code enforcement tests.
 *
 * Verifies:
 * 1. Location labels use "Mahali pa shamba" (not English)
 * 2. GPS labels don't use raw "GPS" term
 * 3. "mfano" always has colon ("mfano:")
 * 4. No hardcoded English in farmer-facing Swahili strings
 * 5. Error messages are in proper Swahili
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const root = join(import.meta.dirname, '..', '..', '..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf-8');
}

// ═══════════════════════════════════════════════════════════
//  LOCATION LABELS — Swahili consistency
// ═══════════════════════════════════════════════════════════

describe('Swahili — location labels', () => {
  const translations = read('src/i18n/translations.js');

  it('setup.location sw is "Mahali pa shamba"', () => {
    const match = translations.match(/'setup\.location':\s*\{[^}]*sw:\s*'([^']*)'/);
    expect(match).toBeTruthy();
    expect(match[1]).toBe('Mahali pa shamba');
  });

  it('setup.locationPlaceholder sw is "Andika mahali pa shamba lako"', () => {
    const match = translations.match(/'setup\.locationPlaceholder':\s*\{[^}]*sw:\s*'([^']*)'/);
    expect(match).toBeTruthy();
    expect(match[1]).toBe('Andika mahali pa shamba lako');
  });

  it('setup.village sw is "Mahali pa shamba"', () => {
    const match = translations.match(/'setup\.village':\s*\{[^}]*sw:\s*'([^']*)'/);
    expect(match).toBeTruthy();
    expect(match[1]).toBe('Mahali pa shamba');
  });
});

// ═══════════════════════════════════════════════════════════
//  GPS SECTION — Swahili no raw "GPS" or English
// ═══════════════════════════════════════════════════════════

describe('Swahili — GPS section labels', () => {
  const translations = read('src/i18n/translations.js');

  it('setup.gpsOptional sw does not start with "Ongeza GPS"', () => {
    const match = translations.match(/'setup\.gpsOptional':\s*\{[^}]*sw:\s*'([^']*)'/);
    expect(match).toBeTruthy();
    expect(match[1]).not.toMatch(/^Ongeza GPS/);
  });

  it('location.gpsFallback sw has proper Swahili error message', () => {
    const match = translations.match(/'location\.gpsFallback':\s*\{[^}]*sw:\s*'([^']*)'/);
    expect(match).toBeTruthy();
    expect(match[1]).toContain('Hatukuweza kupata eneo lako sahihi');
    expect(match[1]).toContain('mahali uliloandika');
  });

  it('location.gpsFallback en does not mention "village or region"', () => {
    // en value uses double quotes (contains apostrophe in "couldn't")
    const match = translations.match(/'location\.gpsFallback':\s*\{[^}]*en:\s*"([^"]*)"/);
    expect(match).toBeTruthy();
    expect(match[1]).not.toContain('village or region');
    expect(match[1]).toContain('the location you typed');
  });
});

// ═══════════════════════════════════════════════════════════
//  "mfano:" — colon consistency
// ═══════════════════════════════════════════════════════════

describe('Swahili — "mfano:" colon consistency', () => {
  const translations = read('src/i18n/translations.js');

  it('no sw values have "mfano " without colon', () => {
    // Extract all sw: '...' values and check none have "mfano " without colon
    const swValues = [...translations.matchAll(/sw:\s*'([^']*)'/g)].map(m => m[1]);
    const badMfano = swValues.filter(v => v.match(/mfano\s+[^:]/));
    expect(badMfano).toEqual([]);
  });

  it('progress.egHybrid sw uses "mfano:"', () => {
    const match = translations.match(/'progress\.egHybrid':\s*\{[^}]*sw:\s*'([^']*)'/);
    expect(match).toBeTruthy();
    expect(match[1]).toContain('mfano:');
  });

  it('progress.egMaizeForFood sw uses "mfano:"', () => {
    const match = translations.match(/'progress\.egMaizeForFood':\s*\{[^}]*sw:\s*'([^']*)'/);
    expect(match).toBeTruthy();
    expect(match[1]).toContain('mfano:');
  });

  it('wizard.egSunriseFarm sw uses "mfano:"', () => {
    const match = translations.match(/'wizard\.egSunriseFarm':\s*\{[^}]*sw:\s*'([^']*)'/);
    expect(match).toBeTruthy();
    expect(match[1]).toContain('mfano:');
  });

  it('setup.farmSizePlaceholder sw uses "mfano:"', () => {
    const match = translations.match(/'setup\.farmSizePlaceholder':\s*\{[^}]*sw:\s*'([^']*)'/);
    expect(match).toBeTruthy();
    expect(match[1]).toContain('mfano:');
  });
});

// ═══════════════════════════════════════════════════════════
//  NO HARDCODED ENGLISH — ProfileSetup
// ═══════════════════════════════════════════════════════════

describe('ProfileSetup — no hardcoded English in farmer-facing text', () => {
  const src = read('src/pages/ProfileSetup.jsx');

  it('farm size placeholder uses i18n (not hardcoded "e.g.")', () => {
    expect(src).not.toContain('placeholder="e.g.');
    expect(src).toContain("t('setup.farmSizePlaceholder')");
  });

  it('location label uses i18n', () => {
    expect(src).toContain("t('setup.location')");
  });

  it('GPS optional label uses i18n', () => {
    expect(src).toContain("t('setup.gpsOptional')");
  });
});
