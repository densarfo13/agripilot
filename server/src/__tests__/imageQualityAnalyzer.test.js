/**
 * imageQualityAnalyzer.test.js — locks the REAL pre-scan image-quality
 * analyzer (src/lib/imageQualityPreflight.js `measureImageQuality` +
 * its pure metric helpers). The full analyzer needs a browser canvas;
 * these tests exercise the underlying CV math on synthetic pixel
 * buffers (headless) so the measured values can't silently drift, and
 * assert the SSR-safe contract the scan pipeline relies on.
 */
import { describe, it, expect } from 'vitest';
import {
  measureImageQuality, ANALYZER, _internal,
} from '../../../src/lib/imageQualityPreflight.js';

const { _luminanceStats, _vegetationStats, _bandScore, _laplacianSharpness } = _internal;

// Build a side×side RGBA buffer from a per-pixel [r,g,b] function (0..255).
function buildData(side, fn) {
  const d = new Uint8ClampedArray(side * side * 4);
  for (let y = 0; y < side; y += 1) {
    for (let x = 0; x < side; x += 1) {
      const [r, g, b] = fn(x, y);
      const i = (y * side + x) * 4;
      d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
    }
  }
  return d;
}

const S = 32;

describe('measureImageQuality — SSR-safe contract', () => {
  it('returns measured:false and never throws with no input', async () => {
    const q = await measureImageQuality(null);
    expect(q.measured).toBe(false);
    expect(q.overall).toBe('unknown');
    expect(q.brightness).toBe(null);
    expect(q.retakeNeeded).toBe(false);
  });
  it('degrades gracefully (measured:false) when there is no DOM canvas', async () => {
    const q = await measureImageQuality('data:image/png;base64,AAAA');
    expect(q.measured).toBe(false);   // node has no document → graceful NA
  });
  it('exposes calibration constants for ops tuning', () => {
    expect(ANALYZER.SIDE).toBeGreaterThanOrEqual(64);
    expect(ANALYZER.EXG_VEG).toBeGreaterThan(0);
  });
});

describe('luminance metrics (real pixel math)', () => {
  it('a bright field → high mean luminance, no dark/over pixels', () => {
    const st = _luminanceStats(buildData(S, () => [220, 220, 220]), S);
    expect(st.meanLum).toBeGreaterThan(0.8);
    expect(st.darkFrac).toBe(0);
    expect(st.overFrac).toBe(0);
  });
  it('a dark field → low mean luminance, all pixels dark', () => {
    const st = _luminanceStats(buildData(S, () => [10, 10, 10]), S);
    expect(st.meanLum).toBeLessThan(0.1);
    expect(st.darkFrac).toBe(1);
  });
  it('a blown-out field → flagged over-exposed', () => {
    const st = _luminanceStats(buildData(S, () => [252, 252, 252]), S);
    expect(st.overFrac).toBeGreaterThan(0.9);
  });
  it('uniform lighting → ~0 regional unevenness', () => {
    const st = _luminanceStats(buildData(S, () => [140, 140, 140]), S);
    expect(st.unevenness).toBeLessThan(0.02);
  });
});

describe('vegetation (Excess-Green) metric', () => {
  it('a green field → high vegetation fraction, centered', () => {
    const v = _vegetationStats(buildData(S, () => [40, 200, 40]), S);
    expect(v.fraction).toBeGreaterThan(0.9);
    expect(v.centerOffset).toBeLessThan(0.1);
  });
  it('bare soil (brown) → near-zero vegetation, centroid not measurable', () => {
    const v = _vegetationStats(buildData(S, () => [150, 110, 70]), S);
    expect(v.fraction).toBeLessThan(0.05);
    expect(v.centerOffset).toBe(null);   // no subject → honest null, not a fake score
  });
});

describe('sharpness (Laplacian variance) metric', () => {
  it('flat image ≈ 0 sharpness; high-frequency checkerboard is sharp', () => {
    const flat  = buildData(S, () => [128, 128, 128]);
    const check = buildData(S, (x, y) => (((x + y) % 2) ? [255, 255, 255] : [0, 0, 0]));
    expect(_laplacianSharpness(flat, S)).toBeLessThan(0.05);
    expect(_laplacianSharpness(check, S)).toBeGreaterThan(0.5);
  });
});

describe('_bandScore — 100 inside band, decays outside, null passthrough', () => {
  it('scores the ideal band at 100 and falls off linearly', () => {
    expect(_bandScore(0.5, 0.28, 0.82, 0.28)).toBe(100);
    expect(_bandScore(0.0, 0.28, 0.82, 0.28)).toBe(0);   // exactly one span below → 0
    expect(_bandScore(0.15, 0.28, 0.82, 0.28)).toBeGreaterThan(0);
    expect(_bandScore(0.15, 0.28, 0.82, 0.28)).toBeLessThan(100);
    expect(_bandScore(null, 0, 1, 1)).toBe(null);
  });
});
