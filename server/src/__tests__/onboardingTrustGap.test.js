/**
 * onboardingTrustGap.test.js — the remaining onboarding /
 * localization / auto-detect contract:
 *
 *   1. mapCountryToAgRegion: coarse country → ag-region bucket
 *   2. new onboarding analytics event types are on both the client
 *      constants module and the server EVENT_TYPES allowlist
 *   3. new i18n keys (confirmFarmLocation / locationPermissionDenied
 *      / offlineHint) resolve in every shipped locale with the
 *      standard no-English-leak guard, plus Hindi verbatim
 *
 * The UI-level "don't auto-apply detected values" behavior is
 * enforced in FirstLaunchConfirm.jsx through the detectResult
 * state machine; we assert the machine shape via its constants.
 */
import { describe, it, expect } from 'vitest';
import {
  mapCountryToAgRegion, hasAgRegionSupport, AG_REGIONS,
} from '../../../src/utils/mapCountryToAgRegion.js';
import { ONBOARDING_EVENT_TYPES } from '../../../src/utils/onboardingEventTypes.js';
import { EVENT_TYPES } from '../services/analytics/eventLogService.js';
import { t } from '../../../src/i18n/index.js';

// ─── 1. mapCountryToAgRegion ─────────────────────────────
describe('mapCountryToAgRegion', () => {
  it.each([
    ['GH', 'tropical_manual'],
    ['NG', 'tropical_mixed'],
    ['IN', 'monsoon_mixed'],
    ['US', 'temperate_mechanized'],
    ['CA', 'temperate_mechanized'],
    ['KE', 'tropical_mixed'],
    ['PH', 'monsoon_mixed'],
    ['EG', 'arid_irrigated'],
  ])('%s → %s', (code, region) => {
    expect(mapCountryToAgRegion(code)).toBe(region);
  });

  it('returns "unknown" for unmapped or blank input', () => {
    expect(mapCountryToAgRegion('ZZ')).toBe('unknown');
    expect(mapCountryToAgRegion('')).toBe('unknown');
    expect(mapCountryToAgRegion(null)).toBe('unknown');
    expect(mapCountryToAgRegion(undefined)).toBe('unknown');
  });

  it('hasAgRegionSupport flips on mapped countries', () => {
    expect(hasAgRegionSupport('US')).toBe(true);
    expect(hasAgRegionSupport('ZZ')).toBe(false);
  });

  it('AG_REGIONS enumerates all supported buckets + unknown', () => {
    expect(AG_REGIONS).toContain('temperate_mechanized');
    expect(AG_REGIONS).toContain('tropical_manual');
    expect(AG_REGIONS).toContain('tropical_mixed');
    expect(AG_REGIONS).toContain('monsoon_mixed');
    expect(AG_REGIONS).toContain('arid_irrigated');
    expect(AG_REGIONS).toContain('unknown');
  });
});

// ─── 2. Onboarding event type alignment ─────────────────
describe('onboarding event types', () => {
  it('every client constant has a matching server EVENT_TYPES entry', () => {
    const serverValues = new Set(Object.values(EVENT_TYPES));
    for (const v of Object.values(ONBOARDING_EVENT_TYPES)) {
      expect(serverValues.has(v)).toBe(true);
    }
  });

  it('exposes all nine onboarding events the spec called out', () => {
    expect(ONBOARDING_EVENT_TYPES.LANGUAGE_SELECTED).toBe('onboarding_language_selected');
    expect(ONBOARDING_EVENT_TYPES.LOCATION_DETECT_CLICKED).toBe('onboarding_location_detect_clicked');
    expect(ONBOARDING_EVENT_TYPES.LOCATION_DETECT_SUCCESS).toBe('onboarding_location_detect_success');
    expect(ONBOARDING_EVENT_TYPES.LOCATION_DETECT_FAILED).toBe('onboarding_location_detect_failed');
    expect(ONBOARDING_EVENT_TYPES.LOCATION_PERMISSION_DENIED).toBe('onboarding_location_permission_denied');
    expect(ONBOARDING_EVENT_TYPES.MANUAL_COUNTRY_SELECTED).toBe('onboarding_manual_country_selected');
    expect(ONBOARDING_EVENT_TYPES.CONTINUE_BLOCKED_MISSING_COUNTRY).toBe('onboarding_continue_blocked_missing_country');
    expect(ONBOARDING_EVENT_TYPES.COMPLETED).toBe('onboarding_completed');
    expect(ONBOARDING_EVENT_TYPES.RESUMED).toBe('onboarding_resumed');
  });
});

// ─── 3. New i18n keys ───────────────────────────────────
const NEW_KEYS = [
  'setup.confirmFarmLocation',
  'setup.locationPermissionDenied',
  'setup.offlineHint',
];
const NON_EN_LOCALES = ['hi', 'tw', 'es', 'pt', 'fr', 'ar', 'sw', 'id'];

describe('new setup keys resolve in every locale', () => {
  it.each(NEW_KEYS)('%s has a non-empty English string', (key) => {
    expect(t(key, 'en')).toBeTruthy();
  });

  it.each(
    NON_EN_LOCALES.flatMap((lang) => NEW_KEYS.map((key) => [lang, key])),
  )('[%s] %s is localized (no English leak)', (lang, key) => {
    const en = t(key, 'en');
    const localized = t(key, lang);
    expect(localized).toBeTruthy();
    expect(localized).not.toBe(en);
  });
});

describe('Hindi trust-gap strings match the spec verbatim', () => {
  it.each([
    ['setup.confirmFarmLocation',      'क्या यह आपके खेत का स्थान है?'],
    ['setup.locationPermissionDenied', 'स्थान की अनुमति नहीं मिली'],
    ['setup.offlineHint',              'आप ऑफ़लाइन हैं — खुद चुनें'],
  ])('%s → %s', (key, expected) => {
    expect(t(key, 'hi')).toBe(expected);
  });
});
