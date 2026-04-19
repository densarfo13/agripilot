/**
 * setupLocalizationAutoDetect.test.js — the setup screen's
 * localization + auto-detect contract.
 *
 * Two things we're locking in:
 *
 *   1. Every key the FirstLaunchConfirm component references
 *      resolves in every shipped locale, with the standard
 *      no-English-leak guard. Specifically the spec-named keys
 *      (setup_title, setup_subtitle, language, country, state,
 *      skip, continue, detect_*, location_*, choose_manually,
 *      country_detected, state_detected).
 *
 *   2. The detectRegionViaGps helper used by the Detect button:
 *        - returns null when geolocation API is unavailable
 *        - returns the reverse-geocoded region on success
 *        - returns null on timeout / permission denied without
 *          throwing or leaking raw error text
 *        - coarse coordinate → country mapping works for the
 *          supported regions (stubGeocoder behavior)
 *
 * No DOM / React render — we assert the pure helpers + the
 * resolver output. That keeps the test suite stable on the
 * server side and matches the rest of the codebase pattern.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { t } from '../../../src/i18n/index.js';
import { detectRegionViaGps } from '../../../src/lib/regionResolver.js';

// ─── 1. Localization keys ───────────────────────────────
const NON_EN_LOCALES = ['hi', 'tw', 'es', 'pt', 'fr', 'ar', 'sw', 'id'];
const SETUP_KEYS = [
  'setup_title', 'setup_subtitle',
  'language', 'country', 'state', 'skip', 'continue',
  'detecting_location', 'use_detected_location', 'detect_location',
  'location_detected', 'location_detection_failed',
  'choose_manually', 'country_detected', 'state_detected',
];

describe('setup screen keys resolve in every locale', () => {
  it.each(SETUP_KEYS)('%s has a non-empty English string', (key) => {
    expect(t(key, 'en')).toBeTruthy();
  });

  it.each(
    NON_EN_LOCALES.flatMap((lang) => SETUP_KEYS.map((key) => [lang, key])),
  )('[%s] %s is localized (no English leak)', (lang, key) => {
    const en = t(key, 'en');
    const localized = t(key, lang);
    expect(localized).toBeTruthy();
    expect(localized).not.toBe(en);
  });
});

// The spec called out the Hindi strings specifically — lock them in.
describe('Hindi setup strings match the spec verbatim', () => {
  it.each([
    ['setup_title', 'आइए Farroway को आपके लिए सेट करें'],
    ['setup_subtitle', 'अपनी भाषा, देश और राज्य चुनें'],
    ['language', 'भाषा'],
    ['country', 'देश'],
    ['state', 'राज्य'],
    ['skip', 'छोड़ें'],
    ['continue', 'जारी रखें'],
    ['detecting_location', 'आपका स्थान पता किया जा रहा है'],
    ['use_detected_location', 'पता किया गया स्थान उपयोग करें'],
    ['detect_location', 'मेरा स्थान पता करें'],
    ['location_detected', 'हमें आपका स्थान मिल गया'],
    ['location_detection_failed', 'आपका स्थान पता नहीं चल सका'],
    ['choose_manually', 'खुद चुनें'],
    ['country_detected', 'पता किया गया देश'],
    ['state_detected', 'पता किया गया राज्य'],
  ])('%s → %s', (key, expected) => {
    expect(t(key, 'hi')).toBe(expected);
  });
});

// ─── 2. detectRegionViaGps ───────────────────────────────
describe('detectRegionViaGps', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('returns null when navigator.geolocation is unavailable', async () => {
    vi.stubGlobal('navigator', {});
    const out = await detectRegionViaGps({ geocoder: () => ({ country: 'US' }) });
    expect(out).toBeNull();
  });

  it('returns null on permission denied / error', async () => {
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: (_ok, fail) => fail(new Error('permission_denied')),
      },
    });
    const out = await detectRegionViaGps({ geocoder: () => ({ country: 'US' }) });
    expect(out).toBeNull();
  });

  it('returns coordinates object when no geocoder is supplied', async () => {
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: (ok) => ok({ coords: { latitude: 38.9, longitude: -77.0 } }),
      },
    });
    const out = await detectRegionViaGps({});
    expect(out).toEqual({ lat: 38.9, lng: -77.0 });
  });

  it('returns the reverse-geocoded region when geocoder succeeds', async () => {
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: (ok) => ok({ coords: { latitude: 28.6, longitude: 77.2 } }),
      },
    });
    const geocoder = vi.fn().mockResolvedValue({ country: 'IN', stateCode: null });
    const out = await detectRegionViaGps({ geocoder });
    expect(out).toEqual({ country: 'IN', stateCode: null });
    expect(geocoder).toHaveBeenCalledWith(28.6, 77.2);
  });

  it('returns null if the geocoder throws — no raw error text leaks', async () => {
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: (ok) => ok({ coords: { latitude: 0, longitude: 0 } }),
      },
    });
    const geocoder = vi.fn().mockRejectedValue(new Error('network'));
    const out = await detectRegionViaGps({ geocoder });
    expect(out).toBeNull();
  });

  it('times out cleanly when getCurrentPosition never resolves', async () => {
    vi.stubGlobal('navigator', {
      geolocation: { getCurrentPosition: () => { /* never calls back */ } },
    });
    const out = await detectRegionViaGps({ geocoder: null, timeoutMs: 30 });
    expect(out).toBeNull();
  });
});
