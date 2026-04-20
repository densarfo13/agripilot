/**
 * featureFlagsGuard.test.js — contract for the feature-flag
 * config + Express guard that 404s every disabled-feature route.
 *
 * Covers:
 *   • isFeatureEnabled defaults (marketplace=false)
 *   • env-override truthy / falsy mapping
 *   • unknown feature → false (never throws)
 *   • FEATURES snapshot shape
 *   • requireFeature middleware calls next() when on, 404s when off
 *   • predicate is injectable for tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import featuresPkg, { FEATURES, isFeatureEnabled, featuresSnapshot }
  from '../../../server/src/config/features.js';
import featureGuardPkg, { requireFeature }
  from '../../../server/src/core/featureGuard.js';

// ─── isFeatureEnabled defaults ──────────────────────────────
describe('isFeatureEnabled — defaults', () => {
  let origMkt;
  beforeEach(() => {
    origMkt = process.env.FARROWAY_FEATURE_MARKETPLACE;
    delete process.env.FARROWAY_FEATURE_MARKETPLACE;
  });
  afterEach(() => {
    if (origMkt === undefined) delete process.env.FARROWAY_FEATURE_MARKETPLACE;
    else process.env.FARROWAY_FEATURE_MARKETPLACE = origMkt;
  });

  it('marketplace is disabled by default', () => {
    expect(isFeatureEnabled('marketplace')).toBe(false);
  });

  it('unknown feature → false (never throws)', () => {
    expect(isFeatureEnabled('nonexistent')).toBe(false);
    expect(isFeatureEnabled('')).toBe(false);
    expect(isFeatureEnabled(null)).toBe(false);
    expect(isFeatureEnabled(undefined)).toBe(false);
  });
});

describe('isFeatureEnabled — env override', () => {
  let orig;
  beforeEach(() => { orig = process.env.FARROWAY_FEATURE_MARKETPLACE; });
  afterEach(() => {
    if (orig === undefined) delete process.env.FARROWAY_FEATURE_MARKETPLACE;
    else process.env.FARROWAY_FEATURE_MARKETPLACE = orig;
  });

  it('FARROWAY_FEATURE_MARKETPLACE=1 enables', () => {
    process.env.FARROWAY_FEATURE_MARKETPLACE = '1';
    expect(isFeatureEnabled('marketplace')).toBe(true);
  });

  it('FARROWAY_FEATURE_MARKETPLACE=true enables', () => {
    process.env.FARROWAY_FEATURE_MARKETPLACE = 'true';
    expect(isFeatureEnabled('marketplace')).toBe(true);
  });

  it('FARROWAY_FEATURE_MARKETPLACE=on enables', () => {
    process.env.FARROWAY_FEATURE_MARKETPLACE = 'on';
    expect(isFeatureEnabled('marketplace')).toBe(true);
  });

  it('FARROWAY_FEATURE_MARKETPLACE=0 disables explicitly', () => {
    process.env.FARROWAY_FEATURE_MARKETPLACE = '0';
    expect(isFeatureEnabled('marketplace')).toBe(false);
  });

  it('unknown string values ignore override → fall back to default', () => {
    process.env.FARROWAY_FEATURE_MARKETPLACE = 'maybe';
    expect(isFeatureEnabled('marketplace')).toBe(false);
  });

  it('empty string → no override', () => {
    process.env.FARROWAY_FEATURE_MARKETPLACE = '';
    expect(isFeatureEnabled('marketplace')).toBe(false);
  });
});

// ─── featuresSnapshot / FEATURES ────────────────────────────
describe('featuresSnapshot / FEATURES', () => {
  it('snapshot exposes every declared feature', () => {
    const s = featuresSnapshot();
    expect('marketplace' in s).toBe(true);
    expect(Object.isFrozen(s)).toBe(true);
  });

  it('FEATURES is frozen', () => {
    expect(Object.isFrozen(FEATURES)).toBe(true);
    expect('marketplace' in FEATURES).toBe(true);
  });

  it('default export surface', () => {
    expect(typeof featuresPkg.isFeatureEnabled).toBe('function');
    expect(typeof featuresPkg.FEATURES).toBe('object');
  });
});

// ─── requireFeature middleware ──────────────────────────────
describe('requireFeature middleware', () => {
  function makeRes() {
    return {
      statusCode: 200, body: null,
      status(c) { this.statusCode = c; return this; },
      json(b)   { this.body = b;       return this; },
    };
  }

  it('calls next() when feature is enabled', () => {
    const mw = requireFeature('marketplace', { isEnabled: () => true });
    const res = makeRes();
    let called = false;
    mw({}, res, () => { called = true; });
    expect(called).toBe(true);
    expect(res.statusCode).toBe(200);
  });

  it('404s when feature is disabled', () => {
    const mw = requireFeature('marketplace', { isEnabled: () => false });
    const res = makeRes();
    mw({}, res, () => { throw new Error('next must not be called'); });
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({
      success: false,
      error: 'Feature not available',
      feature: 'marketplace',
    });
  });

  it('predicate throw → safe 404 (fails closed)', () => {
    const mw = requireFeature('marketplace', { isEnabled: () => { throw new Error('x'); } });
    const res = makeRes();
    mw({}, res, () => { throw new Error('next must not be called'); });
    expect(res.statusCode).toBe(404);
  });

  it('uses the real isFeatureEnabled when no predicate override', () => {
    // By default marketplace is disabled — guard should 404.
    const orig = process.env.FARROWAY_FEATURE_MARKETPLACE;
    delete process.env.FARROWAY_FEATURE_MARKETPLACE;
    const mw = requireFeature('marketplace');
    const res = makeRes();
    let called = false;
    mw({}, res, () => { called = true; });
    expect(called).toBe(false);
    expect(res.statusCode).toBe(404);
    if (orig === undefined) delete process.env.FARROWAY_FEATURE_MARKETPLACE;
    else process.env.FARROWAY_FEATURE_MARKETPLACE = orig;
  });

  it('default export surface', () => {
    expect(typeof featureGuardPkg.requireFeature).toBe('function');
  });
});

// ─── Integration: a marketplace route returns 404 when gated ─
describe('marketplace router behaves invisible when flag is off', () => {
  it('isEnabled override is passed through router opts so we can force-off in prod too', async () => {
    // We import the router factory and run its first middleware
    // synchronously against a fake req/res pair. The very first
    // middleware in the chain is the feature guard.
    const { createMarketplaceRouter } = await import(
      '../../../server/src/modules/marketplace/routes.js');
    const router = createMarketplaceRouter({
      prisma: null,
      isEnabled: () => false,
    });
    // Express Router is a function — but easier to assert via its
    // layer stack structure: the first use() we added is the guard.
    // Pull the first middleware and invoke it.
    const firstLayer = router.stack[0];
    expect(firstLayer).toBeTruthy();
    const res = {
      statusCode: 200, body: null,
      status(c) { this.statusCode = c; return this; },
      json(b)   { this.body = b; return this; },
    };
    firstLayer.handle({}, res, () => {});
    expect(res.statusCode).toBe(404);
    expect(res.body?.error).toBe('Feature not available');
  });

  it('when enabled, the first layer calls next() normally', async () => {
    const { createMarketplaceRouter } = await import(
      '../../../server/src/modules/marketplace/routes.js');
    const router = createMarketplaceRouter({
      prisma: null,
      isEnabled: () => true,
    });
    const firstLayer = router.stack[0];
    const res = { status: vi.fn(), json: vi.fn() };
    let called = false;
    firstLayer.handle({}, res, () => { called = true; });
    expect(called).toBe(true);
    expect(res.status).not.toHaveBeenCalled();
  });
});
