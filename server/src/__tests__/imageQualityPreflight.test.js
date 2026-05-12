/**
 * imageQualityPreflight.test.js — pins the Stage-1 preflight contract:
 *   1. Never throws — every code path resolves to a report object.
 *   2. SSR-safe — returns ok:true when document / Image are missing.
 *   3. Returns the documented shape every time
 *      ({ ok, hint, stats: { luminance, sharpness, width, height } }).
 *   4. Accepts null / undefined / unsupported inputs gracefully.
 *
 * We deliberately do NOT exercise the canvas math here (that requires
 * a real browser DOM). The wrapper's *contract* — never throw, always
 * return the right shape — is what the scan-capture flow depends on,
 * and what would silently regress on a future refactor.
 */

import { describe, it, expect } from 'vitest';
import {
  scoreImageQuality,
  PREFLIGHT_THRESHOLDS,
} from '../../../src/lib/imageQualityPreflight.js';

describe('scoreImageQuality — contract', () => {
  it('returns the documented shape for null input', async () => {
    const r = await scoreImageQuality(null);
    expect(r).toBeTypeOf('object');
    expect(r).toHaveProperty('ok');
    expect(r).toHaveProperty('hint');
    expect(r).toHaveProperty('stats');
    expect(r.stats).toHaveProperty('luminance');
    expect(r.stats).toHaveProperty('sharpness');
    expect(r.stats).toHaveProperty('width');
    expect(r.stats).toHaveProperty('height');
  });

  it('returns ok:true when input is missing', async () => {
    const r = await scoreImageQuality(undefined);
    expect(r.ok).toBe(true);
    expect(r.hint).toBeNull();
  });

  it('never throws on garbage primitive input', async () => {
    // The helper is called from a click-handler — if it throws once
    // the camera flow is dead. Hit every shape a misbehaving caller
    // might pass.
    for (const bad of [0, '', false, 42, 'not-a-blob', {}, []]) {
      const r = await scoreImageQuality(bad);
      expect(r).toBeTypeOf('object');
      expect(r.ok).toBe(true);
    }
  });

  it('is SSR-safe — no document means no work, but the contract holds', async () => {
    // Node's vitest env has no `document`. The helper detects that
    // up front and short-circuits with the empty-stats shape.
    const r = await scoreImageQuality({ size: 1, type: 'image/jpeg' });
    expect(r.ok).toBe(true);
    expect(r.hint).toBeNull();
    expect(r.stats.luminance).toBeNull();
    expect(r.stats.sharpness).toBeNull();
  });

  it('exposes frozen tunable thresholds', () => {
    expect(Object.isFrozen(PREFLIGHT_THRESHOLDS)).toBe(true);
    expect(PREFLIGHT_THRESHOLDS.MIN_LUMINANCE).toBeLessThan(PREFLIGHT_THRESHOLDS.MAX_LUMINANCE);
    expect(PREFLIGHT_THRESHOLDS.MIN_SHARPNESS).toBeGreaterThan(0);
    expect(PREFLIGHT_THRESHOLDS.MIN_SHARPNESS).toBeLessThan(1);
    expect(PREFLIGHT_THRESHOLDS.CANVAS_SIDE).toBeGreaterThan(0);
  });
});
