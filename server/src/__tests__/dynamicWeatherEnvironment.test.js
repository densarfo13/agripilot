/**
 * dynamicWeatherEnvironment.test.js — pins the May 2026 dynamic
 * realistic weather environment system contract.
 *
 *   • resolveLighting maps hour → phase + tuned overlay.
 *   • regionEnvironment maps country → climate cluster + hemisphere.
 *   • resolveSeason flips by hemisphere.
 *   • resolveScene picks region + weather + time-aware slot from
 *     the manifest; falls back through generic → placeholder.
 *   • Garden mode wins over region; uses garden vocabulary.
 *   • Transition window stays in 400–800ms.
 *   • The legacy synthetic-green CSS gradient on .weather-hero is
 *     gone — index.css declares background: transparent.
 *   • WeatherHeroActionCard imports DynamicWeatherBackdrop +
 *     resolveScene from the new environment module.
 *
 * Failures here are regression-meaningful: anyone re-introducing
 * the static dark-green gradient or removing the dynamic-scene
 * wiring fails CI.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(process.cwd(), '..');
function read(rel) { return readFileSync(resolve(ROOT, rel), 'utf8'); }

describe('Dynamic Realistic Weather Environment — May 2026', () => {

  describe('TimeAwareLighting (lighting.js)', () => {
    it('maps hours to the documented phase boundaries', async () => {
      const { phaseForHour, resolveLighting, LIGHTING_PHASES } =
        await import('../../../src/features/weather/environment/lighting.js');
      expect(phaseForHour(2)).toBe('night');
      expect(phaseForHour(6)).toBe('sunrise');
      expect(phaseForHour(9)).toBe('morning');
      expect(phaseForHour(12)).toBe('midday');
      expect(phaseForHour(15)).toBe('afternoon');
      expect(phaseForHour(18)).toBe('sunset');
      expect(phaseForHour(20)).toBe('dusk');
      expect(phaseForHour(23)).toBe('night');
      // Bad input falls through to midday.
      expect(phaseForHour(NaN)).toBe('midday');
      // Catalogue is non-empty + all phases produce a tuned overlay.
      expect(LIGHTING_PHASES.length).toBeGreaterThan(5);
      for (const p of LIGHTING_PHASES) {
        const lit = resolveLighting({ phase: p });
        expect(lit.phase).toBe(p);
        expect(typeof lit.overlay).toBe('string');
        expect(lit.overlay).toMatch(/linear-gradient/);
        expect(['warm','cool','neutral']).toContain(lit.tone);
      }
    });

    it('returns frozen lighting objects', async () => {
      const { resolveLighting } =
        await import('../../../src/features/weather/environment/lighting.js');
      const lit = resolveLighting({ hour: 17 });
      expect(Object.isFrozen(lit)).toBe(true);
    });
  });

  describe('RegionEnvironmentMapper (region.js)', () => {
    it('maps representative countries to climate clusters', async () => {
      const { climateClusterFor, regionEnvironment } =
        await import('../../../src/features/weather/environment/region.js');
      expect(climateClusterFor('GH')).toBe('tropical');
      expect(climateClusterFor('IN')).toBe('monsoon');
      expect(climateClusterFor('US')).toBe('temperate');
      expect(climateClusterFor('EG')).toBe('arid');
      expect(climateClusterFor('ET')).toBe('highland');
      // Unknown → temperate fallback.
      expect(climateClusterFor('ZZ')).toBe('temperate');
      // Bad input → temperate.
      expect(climateClusterFor(null)).toBe('temperate');
    });

    it('flips hemisphere for southern-hemisphere countries', async () => {
      const { regionEnvironment } =
        await import('../../../src/features/weather/environment/region.js');
      expect(regionEnvironment({ country: 'AU' }).hemisphere).toBe('south');
      expect(regionEnvironment({ country: 'BR' }).hemisphere).toBe('south');
      expect(regionEnvironment({ country: 'GH' }).hemisphere).toBe('north');
      expect(regionEnvironment({ country: 'US' }).hemisphere).toBe('north');
    });
  });

  describe('SeasonalEnvironmentSelector (season.js)', () => {
    it('flips season by hemisphere', async () => {
      const { resolveSeason } =
        await import('../../../src/features/weather/environment/season.js');
      expect(resolveSeason({ month: 1, hemisphere: 'north' })).toBe('winter');
      expect(resolveSeason({ month: 1, hemisphere: 'south' })).toBe('summer');
      expect(resolveSeason({ month: 7, hemisphere: 'north' })).toBe('summer');
      expect(resolveSeason({ month: 7, hemisphere: 'south' })).toBe('winter');
      expect(resolveSeason({ month: 99 })).toBe('spring'); // bad input
    });
  });

  describe('EnvironmentSceneResolver (sceneResolver.js)', () => {
    it('picks region + weather + time-aware farm slots', async () => {
      const { resolveScene } =
        await import('../../../src/features/weather/environment/sceneResolver.js');
      // Tropical rain at sunset → tropical-rain scene.
      const a = resolveScene({
        weather: { weatherType: 'rain' },
        hour: 17, country: 'GH', mode: 'farm',
      });
      expect(a.sceneSlot).toBe('hero-tropical-rain');
      expect(a.region.cluster).toBe('tropical');
      expect(a.lighting.phase).toBe('sunset');
      expect(a.weatherType).toBe('rain');

      // Monsoon rain at midday in India.
      const b = resolveScene({
        weather: { weatherType: 'rain' },
        hour: 12, country: 'IN', mode: 'farm',
      });
      expect(b.sceneSlot).toBe('hero-monsoon-rain');

      // Temperate sunrise — wheat / corn vocabulary.
      const c = resolveScene({
        weather: { weatherType: 'sunny' },
        hour: 6, country: 'US', mode: 'farm',
      });
      expect(c.sceneSlot).toBe('hero-temperate-sunrise');

      // Arid sunset — desert horizon.
      const d = resolveScene({
        weather: { weatherType: 'sunny' },
        hour: 18, country: 'EG', mode: 'farm',
      });
      expect(d.sceneSlot).toBe('hero-arid-sunset');
    });

    it('garden mode wins over region', async () => {
      const { resolveScene } =
        await import('../../../src/features/weather/environment/sceneResolver.js');
      const g1 = resolveScene({
        weather: { weatherType: 'rain' },
        hour: 12, country: 'IN', mode: 'garden',
      });
      expect(g1.sceneSlot).toBe('hero-garden-rainy');
      expect(g1.mode).toBe('garden');
      // No region prefix — small-scale vocabulary.
      expect(g1.sceneSlot.startsWith('hero-garden')).toBe(true);

      const g2 = resolveScene({
        weather: { weatherType: 'sunny' },
        hour: 6, country: 'GH', mode: 'garden',
      });
      expect(g2.sceneSlot).toBe('hero-garden-sunrise');
    });

    it('clamps transition to 400-800ms', async () => {
      const { resolveScene } =
        await import('../../../src/features/weather/environment/sceneResolver.js');
      expect(resolveScene({ transitionMs: 100 }).transitionMs).toBe(400);
      expect(resolveScene({ transitionMs: 5000 }).transitionMs).toBe(800);
      expect(resolveScene({ transitionMs: 600 }).transitionMs).toBe(600);
      // Default in spec window.
      const def = resolveScene({});
      expect(def.transitionMs).toBeGreaterThanOrEqual(400);
      expect(def.transitionMs).toBeLessThanOrEqual(800);
    });

    it('falls through to a generic slot when nothing more specific applies', async () => {
      const { resolveScene } =
        await import('../../../src/features/weather/environment/sceneResolver.js');
      const s = resolveScene({
        weather: { weatherType: 'sunny' },
        hour: 12, country: 'ZZ', mode: 'farm', // unknown country
      });
      // Falls through to temperate-daylight (cluster default).
      expect(s.sceneSlot).toBe('hero-temperate-daylight');
    });

    it('returns frozen scene + lighting objects', async () => {
      const { resolveScene } =
        await import('../../../src/features/weather/environment/sceneResolver.js');
      const s = resolveScene({ hour: 12 });
      expect(Object.isFrozen(s)).toBe(true);
      expect(Object.isFrozen(s.lighting)).toBe(true);
    });
  });

  describe('Manifest expanded with new scene slots', () => {
    it('contains the new region + garden slot keys', async () => {
      const { PHOTO_SLOTS } =
        await import('../../../src/assets/realism/photography/manifest.js');
      // Region-aware
      expect(PHOTO_SLOTS.HERO_TROPICAL_DAYLIGHT).toBe('hero-tropical-daylight');
      expect(PHOTO_SLOTS.HERO_MONSOON_RAIN).toBe('hero-monsoon-rain');
      expect(PHOTO_SLOTS.HERO_TEMPERATE_SUNRISE).toBe('hero-temperate-sunrise');
      expect(PHOTO_SLOTS.HERO_ARID_SUNSET).toBe('hero-arid-sunset');
      // Garden vocabulary
      expect(PHOTO_SLOTS.HERO_GARDEN_DAYLIGHT).toBe('hero-garden-daylight');
      expect(PHOTO_SLOTS.HERO_GARDEN_RAINY).toBe('hero-garden-rainy');
      expect(PHOTO_SLOTS.HERO_GARDEN_BALCONY).toBe('hero-garden-balcony');
      // Weather variants
      expect(PHOTO_SLOTS.HERO_NIGHT_FIELD).toBe('hero-night-field');
      expect(PHOTO_SLOTS.HERO_FOG_FIELD).toBe('hero-fog-field');
      expect(PHOTO_SLOTS.HERO_STORM_FIELD).toBe('hero-storm-field');
    });
  });

  describe('Synthetic dark-green gradient removed', () => {
    it('index.css no longer paints the legacy 0B1F2A → 123D34 wash', () => {
      const css = read('src/index.css');
      // Anchor on the .weather-hero rule body.
      const idx = css.indexOf('.weather-hero {');
      expect(idx).toBeGreaterThan(0);
      const block = css.slice(idx, idx + 800);
      expect(block).toMatch(/background:\s*transparent/);
      // The legacy synthetic dark-green wash is gone.
      expect(block).not.toMatch(/#0B1F2A/i);
      expect(block).not.toMatch(/#123D34/i);
    });
  });

  describe('WeatherHeroActionCard wired to the dynamic backdrop', () => {
    it('imports resolveScene + DynamicWeatherBackdrop', () => {
      const src = read('src/components/WeatherHeroActionCard.jsx');
      expect(src).toMatch(/from\s+'\.\.\/features\/weather\/environment/);
      expect(src).toMatch(/resolveScene/);
      expect(src).toMatch(/DynamicWeatherBackdrop/);
      // The static synthetic wash that used to live on the section
      // wrapper is gone — `wrapperStyle` is no longer constructed.
      expect(src).not.toMatch(/rgba\(15,28,22,0\.32\)\s*0%/);
    });

    it('renders the section inside the DynamicWeatherBackdrop', () => {
      const src = read('src/components/WeatherHeroActionCard.jsx');
      // The component returns the backdrop wrapping the section.
      const idx = src.indexOf('<DynamicWeatherBackdrop');
      expect(idx).toBeGreaterThan(0);
      expect(src).toMatch(/<\/DynamicWeatherBackdrop>/);
    });
  });
});
