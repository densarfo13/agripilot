/**
 * regionalTonePack.test.js — verifies the region tone adapter
 * actually changes wording across buckets AND preserves action
 * clarity (no garbled output from over-zealous adaptation).
 *
 * Buckets covered:
 *   • tropical_manual      (e.g. Ghana, Togo)
 *   • monsoon_mixed        (e.g. India, Philippines)
 *   • temperate_mechanized (e.g. USA, Canada)
 *
 * The adapter attaches `toneKeys` to every resolved state.
 * buildHomeExperience then tries the region-suffixed key
 * FIRST, falling back to the base key. So the region-flavored
 * overlay ships a few variants we assert on explicitly.
 */

import { describe, it, expect } from 'vitest';

import {
  resolveFarmerState,
  buildHomeExperience,
  STATE_TYPES,
  applyStateToneByRegion,
  resolveRegionBucket,
} from '../../../src/utils/farmerState/index.js';
import {
  FARMER_STATE_TRANSLATIONS,
  applyFarmerStateOverlay,
} from '../../../src/i18n/farmerStateTranslations.js';
import {
  FARMER_STATE_REGIONAL_TRANSLATIONS,
  applyFarmerStateRegionalOverlay,
} from '../../../src/i18n/farmerStateRegionalOverlay.js';

import {
  composeFixtures, wetSoilLand, unclearedLand, tidyLand,
  indiaRiceFarmer, ghanaMaizeFarmer, usaCornFarmer,
  completedHarvest, postHarvestUncleared,
  freshOnline,
} from './__fixtures__/farmerStateFixtures.js';

// Build a single merged dictionary then a t() that resolves keys
// from it. This mirrors how the app's i18n system works after
// applying the two overlays at boot.
function makeLocaleT(locale) {
  const dict = { [locale]: {} };
  applyFarmerStateOverlay(dict);
  applyFarmerStateRegionalOverlay(dict);
  return (key) => dict[locale]?.[key] || key;
}

// ─── regionBucket resolution ─────────────────────────────
describe('resolveRegionBucket', () => {
  it('maps ISO codes to buckets', () => {
    expect(resolveRegionBucket('GH')).toBe('tropical_manual');
    expect(resolveRegionBucket('IN')).toBe('monsoon_mixed');
    expect(resolveRegionBucket('US')).toBe('temperate_mechanized');
    expect(resolveRegionBucket('EG')).toBe('arid_irrigated');
  });
  it('accepts already-bucketed strings', () => {
    expect(resolveRegionBucket('monsoon_mixed')).toBe('monsoon_mixed');
  });
  it('falls back to unknown', () => {
    expect(resolveRegionBucket('ZZ')).toBe('unknown');
  });
});

// ─── tone adapter mechanism ──────────────────────────────
describe('applyStateToneByRegion — adapter mechanics', () => {
  it('attaches a per-field toneKeys bag to any state', () => {
    const out = applyStateToneByRegion(
      {
        titleKey:    'state.blocked_by_land.title',
        subtitleKey: 'state.blocked_by_land.subtitle',
        whyKey:      'state.blocked_by_land.why',
        nextKey:     'state.next.fix_blocker.wet_soil',
      },
      'monsoon_mixed',
    );
    expect(out.toneKeys.title).toBe('state.blocked_by_land.title.monsoon_mixed');
    expect(out.toneKeys.why).toBe('state.blocked_by_land.why.monsoon_mixed');
    expect(out.toneKeys.next).toBe('state.next.fix_blocker.wet_soil.monsoon_mixed');
    expect(out.regionBucket).toBe('monsoon_mixed');
  });
});

// ─── buildHomeExperience — region-flavored "why" differs ──
describe('region-flavored copy on blocked_by_land', () => {
  function resolveFor(farmerFixture) {
    return resolveFarmerState(composeFixtures(
      farmerFixture(),
      wetSoilLand(),
      freshOnline(),
    ));
  }

  it('Ghana (tropical_manual) uses manual-prep wording', () => {
    const state = resolveFor(ghanaMaizeFarmer);
    expect(state.regionBucket).toBe('tropical_manual');
    const home = buildHomeExperience({
      farmerState: state, t: makeLocaleT('en'),
    });
    expect(home.why).toMatch(/hand preparation/i);
  });

  it('India (monsoon_mixed) uses rain-aware wording', () => {
    const state = resolveFor(indiaRiceFarmer);
    expect(state.regionBucket).toBe('monsoon_mixed');
    const home = buildHomeExperience({
      farmerState: state, t: makeLocaleT('en'),
    });
    expect(home.why).toMatch(/rain/i);
    // Ghana's manual-prep phrasing should NOT leak here.
    expect(home.why).not.toMatch(/hand preparation/i);
  });

  it('USA (temperate_mechanized) uses drainage/tilth wording', () => {
    const state = resolveFor(usaCornFarmer);
    expect(state.regionBucket).toBe('temperate_mechanized');
    const home = buildHomeExperience({
      farmerState: state, t: makeLocaleT('en'),
    });
    expect(home.why).toMatch(/drainage|tilth/i);
    // Manual-only wording must NOT leak into the mechanized tone.
    expect(home.why).not.toMatch(/\bby hand\b|hand preparation/i);
    expect(home.why).not.toMatch(/\bcut weeds by hand\b/i);
  });

  it('three regions produce three different why texts', () => {
    const gh = buildHomeExperience({
      farmerState: resolveFor(ghanaMaizeFarmer), t: makeLocaleT('en'),
    }).why;
    const inw = buildHomeExperience({
      farmerState: resolveFor(indiaRiceFarmer), t: makeLocaleT('en'),
    }).why;
    const us = buildHomeExperience({
      farmerState: resolveFor(usaCornFarmer), t: makeLocaleT('en'),
    }).why;
    expect(gh).toBeTruthy();
    expect(inw).toBeTruthy();
    expect(us).toBeTruthy();
    expect(new Set([gh, inw, us]).size).toBe(3);
  });
});

// ─── region-specific next-step bridges differ ────────────
describe('region-specific next-step bridges', () => {
  it('monsoon_mixed wet-soil bridge is rain-aware', () => {
    const state = resolveFarmerState(composeFixtures(
      indiaRiceFarmer(),
      wetSoilLand(),
      freshOnline(),
    ));
    const home = buildHomeExperience({ farmerState: state, t: makeLocaleT('en') });
    expect(home.next).toMatch(/rain/i);
  });

  it('temperate_mechanized wet-soil bridge is drainage-aware', () => {
    const state = resolveFarmerState(composeFixtures(
      usaCornFarmer(),
      wetSoilLand(),
      freshOnline(),
    ));
    const home = buildHomeExperience({ farmerState: state, t: makeLocaleT('en') });
    expect(home.next).toMatch(/drainage/i);
    expect(home.next).not.toMatch(/\bby hand\b/i);
  });

  it('tropical_manual uncleared bridge is hand-prep-aware', () => {
    const state = resolveFarmerState(composeFixtures(
      ghanaMaizeFarmer(),
      unclearedLand(),
      { cropProfile: { stage: 'planting' } },
      freshOnline(),
    ));
    const home = buildHomeExperience({ farmerState: state, t: makeLocaleT('en') });
    expect(home.next).toMatch(/hand/i);
  });
});

// ─── action clarity preserved across regions ─────────────
describe('tone adaptation does not break action clarity', () => {
  it('every region produces a non-empty title, why, next where expected', () => {
    for (const fixture of [ghanaMaizeFarmer, indiaRiceFarmer, usaCornFarmer]) {
      const state = resolveFarmerState(composeFixtures(
        fixture(), wetSoilLand(), freshOnline(),
      ));
      const home = buildHomeExperience({ farmerState: state, t: makeLocaleT('en') });
      expect(home.title).toBeTruthy();
      expect(home.why).toBeTruthy();
      expect(home.next).toBeTruthy();
      // No raw key leakage.
      expect(home.title).not.toMatch(/^state\./);
      expect(home.why).not.toMatch(/^state\./);
      expect(home.next).not.toMatch(/^state\./);
    }
  });

  it('region-less states (safe_fallback / generic) still render cleanly', () => {
    const state = resolveFarmerState({});
    const home = buildHomeExperience({ farmerState: state, t: makeLocaleT('en') });
    expect(home.title).toBeTruthy();
    expect(home.title).not.toMatch(/^state\./);
  });
});

// ─── regional overlay shape / coverage ───────────────────
describe('farmerStateRegionalOverlay shape', () => {
  it('English ships wet-soil variants for all three target buckets', () => {
    const en = FARMER_STATE_REGIONAL_TRANSLATIONS.en;
    expect(en['state.blocked_by_land.why.tropical_manual']).toBeTruthy();
    expect(en['state.blocked_by_land.why.monsoon_mixed']).toBeTruthy();
    expect(en['state.blocked_by_land.why.temperate_mechanized']).toBeTruthy();
  });

  it('three target buckets have distinct English text', () => {
    const en = FARMER_STATE_REGIONAL_TRANSLATIONS.en;
    const s = new Set([
      en['state.blocked_by_land.why.tropical_manual'],
      en['state.blocked_by_land.why.monsoon_mixed'],
      en['state.blocked_by_land.why.temperate_mechanized'],
    ]);
    expect(s.size).toBe(3);
  });
});
