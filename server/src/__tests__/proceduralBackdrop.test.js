/**
 * proceduralBackdrop.test.js — pins the phase + cluster aware
 * procedural backdrop contract (May 2026 §8 photography-gap fix).
 *
 *   • Each phase produces a recognisably different sky band.
 *   • Each cluster produces a recognisably different ground band.
 *   • Garden mode collapses cluster differences (warm soil base).
 *   • Weather wash layers on top of the gradient ('rain' / 'storm'
 *     / 'fog' / 'snow' included; unknown weather → no wash).
 *   • Output is a frozen object with a CSS `backgroundImage`
 *     value containing a linear-gradient.
 *   • DynamicWeatherBackdrop renders the procedural canvas as the
 *     base layer (z-index 0) so it bleeds through the calm photo
 *     placeholder when the slot's .webp is missing.
 *
 * Failures here are regression-meaningful: anyone collapsing
 * the per-phase or per-cluster tones into a single static wash
 * fails CI.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(process.cwd(), '..');
function read(rel) { return readFileSync(resolve(ROOT, rel), 'utf8'); }

describe('Procedural sky/horizon backdrop — May 2026', () => {

  it('emits a layered linear-gradient backgroundImage', async () => {
    const { proceduralCanvas } =
      await import('../../../src/features/weather/environment/procedural.js');
    const out = proceduralCanvas({
      phase: 'sunset', cluster: 'tropical', weather: '', mode: 'farm',
    });
    expect(out.backgroundImage).toMatch(/linear-gradient\(/);
    expect(Object.isFrozen(out)).toBe(true);
  });

  it('each phase emits a distinct sky band', async () => {
    const { proceduralCanvas, PROCEDURAL_PHASES } =
      await import('../../../src/features/weather/environment/procedural.js');
    const seen = new Set();
    for (const p of PROCEDURAL_PHASES) {
      const out = proceduralCanvas({ phase: p, cluster: 'temperate' });
      seen.add(out.skyBand);
    }
    // 7 phases (the lighting `morning` and `afternoon` collide
    // with neither sunrise nor sunset because each table entry
    // is unique), so the sky-band catalogue must be ≥ 7 distinct.
    expect(seen.size).toBeGreaterThanOrEqual(7);
  });

  it('each cluster emits a distinct ground band (farm mode)', async () => {
    const { proceduralCanvas, PROCEDURAL_CLUSTERS } =
      await import('../../../src/features/weather/environment/procedural.js');
    const seen = new Set();
    for (const c of PROCEDURAL_CLUSTERS) {
      const out = proceduralCanvas({ phase: 'midday', cluster: c, mode: 'farm' });
      seen.add(out.groundBand);
    }
    expect(seen.size).toBe(PROCEDURAL_CLUSTERS.length); // 5 unique
  });

  it('garden mode collapses cluster differences', async () => {
    const { proceduralCanvas } =
      await import('../../../src/features/weather/environment/procedural.js');
    const a = proceduralCanvas({ phase: 'midday', cluster: 'tropical', mode: 'garden' });
    const b = proceduralCanvas({ phase: 'midday', cluster: 'arid',     mode: 'garden' });
    const c = proceduralCanvas({ phase: 'midday', cluster: 'temperate',mode: 'garden' });
    expect(a.groundBand).toBe(b.groundBand);
    expect(b.groundBand).toBe(c.groundBand);
  });

  it('weather wash layers on top of the base gradient', async () => {
    const { proceduralCanvas } =
      await import('../../../src/features/weather/environment/procedural.js');
    const dry  = proceduralCanvas({ phase: 'midday', cluster: 'arid', weather: '' });
    const rain = proceduralCanvas({ phase: 'midday', cluster: 'arid', weather: 'rain' });
    const fog  = proceduralCanvas({ phase: 'midday', cluster: 'arid', weather: 'fog' });
    const storm= proceduralCanvas({ phase: 'midday', cluster: 'arid', weather: 'storm' });

    expect(dry.weatherWash).toBe('');
    expect(rain.weatherWash).toMatch(/linear-gradient/);
    expect(fog.weatherWash).toMatch(/linear-gradient/);
    expect(storm.weatherWash).toMatch(/linear-gradient/);
    // Rain / storm / fog get DIFFERENT washes.
    expect(rain.weatherWash).not.toBe(storm.weatherWash);
    expect(rain.weatherWash).not.toBe(fog.weatherWash);
    // Layered backgroundImage starts with the wash, then comma,
    // then the base gradient.
    expect(rain.backgroundImage.indexOf(rain.weatherWash)).toBe(0);
    expect(rain.backgroundImage).toMatch(/,\s*linear-gradient/);
  });

  it('bad input falls through to safe defaults', async () => {
    const { proceduralCanvas } =
      await import('../../../src/features/weather/environment/procedural.js');
    const out = proceduralCanvas({});
    expect(out.backgroundImage).toMatch(/linear-gradient/);
    expect(out.phase).toBe('midday');
    expect(out.cluster).toBe('temperate');
    // Unknown phase / cluster also fall back without throwing.
    const out2 = proceduralCanvas({ phase: 'martian', cluster: 'lunar' });
    expect(out2.backgroundImage).toMatch(/linear-gradient/);
  });

  it('DynamicWeatherBackdrop renders the procedural canvas as base layer', () => {
    const src = read('src/features/weather/environment/DynamicWeatherBackdrop.jsx');
    expect(src).toMatch(/from\s+'\.\/procedural\.js'/);
    expect(src).toMatch(/proceduralCanvas/);
    // Base layer carries the procedural-test data-testid.
    expect(src).toMatch(/-procedural/);
    // Base layer sits at z-index 0 — below the photo (z 1/2),
    // below the lighting wash (z 3), below the content (z 4).
    expect(src).toMatch(/zIndex:\s*0/);
  });
});
