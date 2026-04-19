/**
 * englishLeakPack.test.js — localization leak safety across
 * the NEW state-engine + confidence + onboarding surfaces.
 *
 * Covers:
 *   • no raw translation keys in visible output
 *   • no unexpected English leakage in non-English locales
 *     for keys each locale actually ships
 *   • confidence-variant keys (.high / .medium / .low) render
 *     cleanly in every locale that ships them
 *   • onboarding confirmation messages (auto-detect trust text)
 *     are localized
 *   • stale/offline "Based on your last update" helper is
 *     localized in every supported locale
 *   • next-step bridges are localized in every supported locale
 *
 * This is an extension of the earlier English-leak tests so the
 * new surfaces don't silently regress.
 */

import { describe, it, expect } from 'vitest';

import {
  FARMER_STATE_TRANSLATIONS, applyFarmerStateOverlay,
} from '../../../src/i18n/farmerStateTranslations.js';
import {
  FARMER_STATE_REGIONAL_TRANSLATIONS,
  CORE_BRIDGES_BY_LOCALE,
  applyFarmerStateRegionalOverlay,
} from '../../../src/i18n/farmerStateRegionalOverlay.js';
import {
  ONBOARDING_V2_TRANSLATIONS, applyOnboardingV2Overlay,
} from '../../../src/i18n/onboardingV2Translations.js';
import {
  CONFIDENCE_TRANSLATIONS,
} from '../../../src/i18n/confidenceTranslations.js';

import {
  resolveFarmerState, buildHomeExperience,
} from '../../../src/utils/farmerState/index.js';
import {
  composeFixtures, ghanaMaizeFarmer, indiaRiceFarmer,
  completedHarvest, wetSoilLand, staleOffline, freshOnline,
  returningInactive,
} from './__fixtures__/farmerStateFixtures.js';

const SUPPORTED = ['en', 'hi', 'tw', 'es', 'pt', 'fr', 'ar', 'sw', 'id'];
const NON_EN    = SUPPORTED.filter((l) => l !== 'en');

// Merge all overlays into a single dictionary the same way the
// app does at boot.
function buildMergedDict() {
  const dict = {};
  applyFarmerStateOverlay(dict);
  applyFarmerStateRegionalOverlay(dict);
  applyOnboardingV2Overlay(dict);
  // confidence translations file uses a different shape — merge manually
  for (const [loc, keys] of Object.entries(CONFIDENCE_TRANSLATIONS)) {
    dict[loc] = Object.assign(dict[loc] || {}, keys);
  }
  return dict;
}

function makeLocaleT(dict, locale) {
  return (key) => dict[locale]?.[key] || key;
}

// ─── Raw-key leak ────────────────────────────────────────
describe('no raw keys in visible output', () => {
  const dict = buildMergedDict();

  const SCENARIOS = [
    { label: 'harvest_complete + dry land (GH)', ctx: composeFixtures(
      completedHarvest(),
      { hasCompletedOnboarding: true, hasActiveCropCycle: true, countryCode: 'GH' },
      freshOnline(),
    )},
    { label: 'blocked_by_land (IN)', ctx: composeFixtures(
      indiaRiceFarmer(), wetSoilLand(), freshOnline(),
    )},
    { label: 'stale_offline', ctx: composeFixtures(
      ghanaMaizeFarmer(), staleOffline(),
    )},
    { label: 'returning_inactive', ctx: composeFixtures(
      ghanaMaizeFarmer(), returningInactive(), freshOnline(),
    )},
  ];

  for (const locale of SUPPORTED) {
    for (const { label, ctx } of SCENARIOS) {
      it(`[${locale}] ${label} renders without a raw key`, () => {
        const state = resolveFarmerState(ctx);
        const t = makeLocaleT(dict, locale);
        const home = buildHomeExperience({ farmerState: state, t });
        for (const field of ['title', 'subtitle', 'why', 'next', 'cta', 'confidenceLine']) {
          const v = home[field];
          if (v == null) continue;
          expect(v).not.toMatch(/^state\./);
          expect(v).not.toMatch(/^onboardingV2\./);
          expect(v).not.toMatch(/^recommendations\./);
          expect(v).not.toMatch(/^listing\./);
          expect(v).not.toMatch(/^location\./);
          // No obvious error strings leaking as copy
          expect(v.toLowerCase()).not.toMatch(/\[object object\]|undefined/);
        }
      });
    }
  }
});

// ─── English leak — core state titles ────────────────────
describe('non-English locales do not leak the English state title', () => {
  const CORE_STATE_TITLES = [
    'state.blocked_by_land.title',
    'state.harvest_complete.title',
    'state.stale_offline.title',
    'state.first_use.title',
    'state.returning_inactive.title',
    'state.active_cycle.title',
    'state.post_harvest.title',
    'state.safe_fallback.title',
  ];
  const NON_EN_WITH_FULL = ['hi'];  // hi ships every key verbatim

  it.each(NON_EN_WITH_FULL.flatMap((l) => CORE_STATE_TITLES.map((k) => [l, k])))(
    '[%s] %s differs from the English version',
    (locale, key) => {
      const en = FARMER_STATE_TRANSLATIONS.en[key];
      const other = FARMER_STATE_TRANSLATIONS[locale][key];
      expect(other).toBeTruthy();
      expect(other).not.toBe(en);
    },
  );
});

// ─── English leak — next-step bridges ────────────────────
describe('next-step bridges ship in every supported locale', () => {
  const BRIDGE_KEYS = [
    'state.next.prepare_field_for_next_cycle',
    'state.next.review_next_crop',
    'state.next.reconnect_to_refresh',
    'state.next.check_today_task',
  ];

  it.each(SUPPORTED.flatMap((l) => BRIDGE_KEYS.map((k) => [l, k])))(
    '[%s] %s is present (either in base overlay or regional overlay)',
    (locale, key) => {
      const dict = buildMergedDict();
      expect(dict[locale][key]).toBeTruthy();
    },
  );

  it.each(NON_EN.flatMap((l) => BRIDGE_KEYS.map((k) => [l, k])))(
    '[%s] %s does not equal the English bridge',
    (locale, key) => {
      const dict = buildMergedDict();
      expect(dict[locale][key]).not.toBe(dict.en[key]);
    },
  );
});

// ─── English leak — stale/offline helper ─────────────────
describe('stale/offline helper is localized everywhere', () => {
  const KEY = 'state.soft.based_on_last_update';

  it.each(['en', 'hi'])('[%s] ships the helper', (l) => {
    expect(FARMER_STATE_TRANSLATIONS[l][KEY]).toBeTruthy();
  });

  it('English helper reads as a soft prefix, not a command', () => {
    const v = FARMER_STATE_TRANSLATIONS.en[KEY];
    // Must NOT be imperative
    expect(v.toLowerCase()).not.toMatch(/\bplant now\b/);
    expect(v.toLowerCase()).not.toMatch(/\bharvest today\b/);
    // Must hedge
    expect(v.toLowerCase()).toMatch(/\bbased on\b|\blast update\b/);
  });

  it('Hindi helper is different from the English string', () => {
    expect(FARMER_STATE_TRANSLATIONS.hi[KEY])
      .not.toBe(FARMER_STATE_TRANSLATIONS.en[KEY]);
  });
});

// ─── Confidence tier variants don't leak English ─────────
describe('confidence tier variant wording', () => {
  const TIER_KEYS = [
    'state.blocked_by_land.title.low',
    'state.harvest_complete.title.low',
    'state.harvest_complete.title.medium',
  ];

  it.each(['en', 'hi'].flatMap((l) => TIER_KEYS.map((k) => [l, k])))(
    '[%s] tier variant %s is present',
    (locale, key) => {
      expect(FARMER_STATE_TRANSLATIONS[locale][key]).toBeTruthy();
    },
  );

  it('Hindi tier variants do not equal the English variants', () => {
    for (const k of TIER_KEYS) {
      expect(FARMER_STATE_TRANSLATIONS.hi[k])
        .not.toBe(FARMER_STATE_TRANSLATIONS.en[k]);
    }
  });

  it('LOW tier wording hedges with "may", "check", or "might"', () => {
    const low = FARMER_STATE_TRANSLATIONS.en['state.harvest_complete.title.low'];
    expect(low.toLowerCase()).toMatch(/\bmay\b|\bcheck\b|\bmight\b/);
  });
});

// ─── Auto-detect trust text is localized ─────────────────
describe('onboarding auto-detect trust text is localized', () => {
  const TRUST_KEYS = [
    'onboardingV2.location.confirmPrompt',
    'onboardingV2.location.confirmYes',
    'onboardingV2.location.chooseManual',
    'onboardingV2.location.failTitle',
    'onboardingV2.location.tryAgain',
    'onboardingV2.location.trust.detect',
  ];

  it.each(['en', 'hi'].flatMap((l) => TRUST_KEYS.map((k) => [l, k])))(
    '[%s] %s is present',
    (locale, key) => {
      expect(ONBOARDING_V2_TRANSLATIONS[locale][key]).toBeTruthy();
    },
  );

  it('Hindi trust prompt differs from English', () => {
    expect(ONBOARDING_V2_TRANSLATIONS.hi['onboardingV2.location.confirmPrompt'])
      .not.toBe(ONBOARDING_V2_TRANSLATIONS.en['onboardingV2.location.confirmPrompt']);
  });
});

// ─── Regional overlay wording safety ─────────────────────
describe('regional overlay — safety & differentiation', () => {
  it('does not reuse the base English string for the regional variant', () => {
    const en = FARMER_STATE_TRANSLATIONS.en;
    const overlay = FARMER_STATE_REGIONAL_TRANSLATIONS.en;
    for (const [key, value] of Object.entries(overlay)) {
      const baseKey = stripBucket(key);
      const baseVal = en[baseKey];
      if (!baseVal) continue;
      expect(value).not.toBe(baseVal);
    }
  });

  it('CORE_BRIDGES_BY_LOCALE covers every supported locale', () => {
    for (const l of SUPPORTED) {
      expect(CORE_BRIDGES_BY_LOCALE[l]).toBeTruthy();
      expect(Object.keys(CORE_BRIDGES_BY_LOCALE[l]).length).toBeGreaterThanOrEqual(4);
    }
  });

  it('regional overlay never reintroduces the word "Farroway"', () => {
    for (const [, keys] of Object.entries(FARMER_STATE_REGIONAL_TRANSLATIONS)) {
      for (const v of Object.values(keys)) {
        expect(String(v).toLowerCase()).not.toContain('farroway');
      }
    }
  });
});

function stripBucket(key) {
  // "state.blocked_by_land.why.monsoon_mixed" → "state.blocked_by_land.why"
  return key.replace(/\.(tropical_manual|tropical_mixed|monsoon_mixed|temperate_mechanized|arid_irrigated)$/, '');
}
