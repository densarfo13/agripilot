/**
 * simpleModeEngine.test.js — pins the Simple Mode contract.
 *
 *   1. Brand-new users default to SIMPLE.
 *   2. Mode store persists explicit choices + records setBy origin.
 *   3. isFeatureVisible enforces the spec's hidden-in-SIMPLE list.
 *   4. Navigation config matches spec §3 (farmer + gardener variants).
 *   5. Adaptive promotion respects manual override + abandonment cap.
 *   6. shouldSimplify steps user DOWN when struggling.
 */

import { describe, it, expect, beforeEach } from 'vitest';

function _installLocalStorage() {
  const store = new Map();
  globalThis.localStorage = {
    getItem:    (k) => (store.has(k) ? store.get(k) : null),
    setItem:    (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
    clear:      () => { store.clear(); },
  };
}

beforeEach(() => {
  _installLocalStorage();
});

// ─── Mode store ─────────────────────────────────────────────────

describe('simpleModeEngine — mode store', () => {
  it('defaults brand-new users to SIMPLE', async () => {
    const mod = await import('../../../src/lib/simpleModeEngine.js');
    expect(mod.getSimpleMode()).toBe('SIMPLE');
  });

  it('setSimpleMode persists + roundtrips', async () => {
    const mod = await import('../../../src/lib/simpleModeEngine.js');
    expect(mod.setSimpleMode('ADVANCED')).toBe(true);
    expect(mod.getSimpleMode()).toBe('ADVANCED');
  });

  it('rejects invalid mode strings', async () => {
    const mod = await import('../../../src/lib/simpleModeEngine.js');
    expect(mod.setSimpleMode('PRO')).toBe(false);
    expect(mod.setSimpleMode(null)).toBe(false);
    expect(mod.getSimpleMode()).toBe('SIMPLE');
  });

  it('accepts case-insensitive input', async () => {
    const mod = await import('../../../src/lib/simpleModeEngine.js');
    mod.setSimpleMode('standard');
    expect(mod.getSimpleMode()).toBe('STANDARD');
  });

  it('isModeUserSet distinguishes manual vs adaptive', async () => {
    const mod = await import('../../../src/lib/simpleModeEngine.js');
    expect(mod.isModeUserSet()).toBe(false);
    mod.setSimpleMode('STANDARD', 'adaptive');
    expect(mod.isModeUserSet()).toBe(false);
    mod.setSimpleMode('STANDARD', 'user');
    expect(mod.isModeUserSet()).toBe(true);
  });

  it('clearSimpleMode resets to default', async () => {
    const mod = await import('../../../src/lib/simpleModeEngine.js');
    mod.setSimpleMode('ADVANCED');
    mod.clearSimpleMode();
    expect(mod.getSimpleMode()).toBe('SIMPLE');
  });

  it('does not throw without localStorage (SSR)', async () => {
    delete globalThis.localStorage;
    const mod = await import('../../../src/lib/simpleModeEngine.js');
    expect(() => mod.getSimpleMode()).not.toThrow();
    expect(() => mod.setSimpleMode('STANDARD')).not.toThrow();
  });
});

// ─── Feature visibility ─────────────────────────────────────────

describe('simpleModeEngine — feature visibility', () => {
  it('operational core is visible in every mode', async () => {
    const mod = await import('../../../src/lib/simpleModeEngine.js');
    for (const m of ['SIMPLE', 'STANDARD', 'ADVANCED']) {
      expect(mod.isFeatureVisible('home',     m)).toBe(true);
      expect(mod.isFeatureVisible('scan',     m)).toBe(true);
      expect(mod.isFeatureVisible('tasks',    m)).toBe(true);
      expect(mod.isFeatureVisible('progress', m)).toBe(true);
      expect(mod.isFeatureVisible('journal',  m)).toBe(true);
    }
  });

  it('commercial surfaces are hidden in SIMPLE (spec §3)', async () => {
    const mod = await import('../../../src/lib/simpleModeEngine.js');
    expect(mod.isFeatureVisible('funding',            'SIMPLE')).toBe(false);
    expect(mod.isFeatureVisible('sell',               'SIMPLE')).toBe(false);
    expect(mod.isFeatureVisible('market_opportunity', 'SIMPLE')).toBe(false);
    expect(mod.isFeatureVisible('buyer_ecosystem',    'SIMPLE')).toBe(false);
  });

  it('commercial surfaces appear in STANDARD + ADVANCED', async () => {
    const mod = await import('../../../src/lib/simpleModeEngine.js');
    expect(mod.isFeatureVisible('funding', 'STANDARD')).toBe(true);
    expect(mod.isFeatureVisible('funding', 'ADVANCED')).toBe(true);
    expect(mod.isFeatureVisible('sell',    'STANDARD')).toBe(true);
  });

  it('detail surfaces hidden until STANDARD', async () => {
    const mod = await import('../../../src/lib/simpleModeEngine.js');
    expect(mod.isFeatureVisible('daily_briefing', 'SIMPLE')).toBe(false);
    expect(mod.isFeatureVisible('crop_trends',    'SIMPLE')).toBe(false);
    expect(mod.isFeatureVisible('daily_briefing', 'STANDARD')).toBe(true);
  });

  it('advanced-only surfaces hidden until ADVANCED', async () => {
    const mod = await import('../../../src/lib/simpleModeEngine.js');
    expect(mod.isFeatureVisible('operational_dash', 'SIMPLE')).toBe(false);
    expect(mod.isFeatureVisible('operational_dash', 'STANDARD')).toBe(false);
    expect(mod.isFeatureVisible('operational_dash', 'ADVANCED')).toBe(true);
    expect(mod.isFeatureVisible('ngo_admin',        'SIMPLE')).toBe(false);
    expect(mod.isFeatureVisible('ngo_admin',        'ADVANCED')).toBe(true);
  });

  it('unknown features default to visible (so we never silently hide)', async () => {
    const mod = await import('../../../src/lib/simpleModeEngine.js');
    expect(mod.isFeatureVisible('totally_new_thing', 'SIMPLE')).toBe(true);
  });

  it('falls back to stored mode when mode argument missing', async () => {
    const mod = await import('../../../src/lib/simpleModeEngine.js');
    mod.setSimpleMode('STANDARD');
    expect(mod.isFeatureVisible('funding')).toBe(true);
  });

  it('matrix is exposed for a future settings UI', async () => {
    const mod = await import('../../../src/lib/simpleModeEngine.js');
    const matrix = mod.getFeatureVisibilityMatrix();
    expect(matrix.length).toBeGreaterThan(0);
    const funding = matrix.find((m) => m.feature === 'funding');
    expect(funding.SIMPLE).toBe(false);
    expect(funding.STANDARD).toBe(true);
  });
});

// ─── Navigation gating ──────────────────────────────────────────

describe('simpleModeEngine — navigation gating', () => {
  it('farmer SIMPLE nav = Home/Tasks/Scan/Progress (spec §3)', async () => {
    const mod = await import('../../../src/lib/simpleModeEngine.js');
    expect(mod.getSimpleModeNavConfig('farmer', 'SIMPLE'))
      .toEqual(['home', 'tasks', 'scan', 'progress']);
  });

  it('gardener SIMPLE nav = Home/Care/Scan/Journal (spec §3)', async () => {
    const mod = await import('../../../src/lib/simpleModeEngine.js');
    expect(mod.getSimpleModeNavConfig('gardener', 'SIMPLE'))
      .toEqual(['home', 'care', 'scan', 'journal']);
  });

  it('STANDARD farmer adds sell + funding', async () => {
    const mod = await import('../../../src/lib/simpleModeEngine.js');
    const nav = mod.getSimpleModeNavConfig('farmer', 'STANDARD');
    expect(nav).toContain('sell');
    expect(nav).toContain('funding');
  });

  it('STANDARD gardener does NOT add sell / funding (gardeners are commercial-gated by default)', async () => {
    const mod = await import('../../../src/lib/simpleModeEngine.js');
    const nav = mod.getSimpleModeNavConfig('gardener', 'STANDARD');
    expect(nav).not.toContain('sell');
    expect(nav).not.toContain('funding');
  });

  it('falls back to farmer when userType is unknown', async () => {
    const mod = await import('../../../src/lib/simpleModeEngine.js');
    expect(mod.getSimpleModeNavConfig('alien', 'SIMPLE'))
      .toEqual(['home', 'tasks', 'scan', 'progress']);
  });
});

// ─── Adaptive promotion ─────────────────────────────────────────

describe('simpleModeEngine — adaptive promotion', () => {
  it('shouldPromote returns null when thresholds unmet', async () => {
    const mod = await import('../../../src/lib/simpleModeEngine.js');
    expect(mod.shouldPromote({
      scanCount: 1, completedTaskCount: 1, accountAgeDays: 1,
    })).toBeNull();
  });

  it('promotes SIMPLE → STANDARD when all thresholds met', async () => {
    const mod = await import('../../../src/lib/simpleModeEngine.js');
    const r = mod.shouldPromote({
      scanCount: 5, completedTaskCount: 6, accountAgeDays: 14, abandonedFlows: 0,
    });
    expect(r).not.toBeNull();
    expect(r.from).toBe('SIMPLE');
    expect(r.to).toBe('STANDARD');
  });

  it('promotes STANDARD → ADVANCED when deeper thresholds met', async () => {
    const mod = await import('../../../src/lib/simpleModeEngine.js');
    mod.setSimpleMode('STANDARD', 'adaptive');
    const r = mod.shouldPromote({
      scanCount: 20, completedTaskCount: 25, accountAgeDays: 60, abandonedFlows: 0,
    });
    expect(r).not.toBeNull();
    expect(r.to).toBe('ADVANCED');
  });

  it('NEVER promotes when user manually set the mode (respects user choice)', async () => {
    const mod = await import('../../../src/lib/simpleModeEngine.js');
    mod.setSimpleMode('SIMPLE', 'user');
    expect(mod.shouldPromote({
      scanCount: 50, completedTaskCount: 50, accountAgeDays: 100,
    })).toBeNull();
  });

  it('NEVER promotes when abandonment cap is hit', async () => {
    const mod = await import('../../../src/lib/simpleModeEngine.js');
    expect(mod.shouldPromote({
      scanCount: 50, completedTaskCount: 50, accountAgeDays: 100,
      abandonedFlows: 3,
    })).toBeNull();
  });

  it('NEVER promotes past ADVANCED', async () => {
    const mod = await import('../../../src/lib/simpleModeEngine.js');
    mod.setSimpleMode('ADVANCED', 'adaptive');
    expect(mod.shouldPromote({
      scanCount: 999, completedTaskCount: 999, accountAgeDays: 999,
    })).toBeNull();
  });
});

// ─── Adaptive simplify ──────────────────────────────────────────

describe('simpleModeEngine — adaptive simplify', () => {
  it('shouldSimplify returns null in SIMPLE (already lowest)', async () => {
    const mod = await import('../../../src/lib/simpleModeEngine.js');
    expect(mod.shouldSimplify({ abandonedFlows: 5 })).toBeNull();
  });

  it('shouldSimplify steps STANDARD → SIMPLE when abandonment hit', async () => {
    const mod = await import('../../../src/lib/simpleModeEngine.js');
    mod.setSimpleMode('STANDARD', 'adaptive');
    const r = mod.shouldSimplify({ abandonedFlows: 3 });
    expect(r).not.toBeNull();
    expect(r.from).toBe('STANDARD');
    expect(r.to).toBe('SIMPLE');
  });

  it('shouldSimplify steps ADVANCED → STANDARD (one tier at a time)', async () => {
    const mod = await import('../../../src/lib/simpleModeEngine.js');
    mod.setSimpleMode('ADVANCED', 'adaptive');
    const r = mod.shouldSimplify({ abandonedFlows: 4 });
    expect(r.to).toBe('STANDARD');
  });

  it('NEVER simplifies when user manually set the mode', async () => {
    const mod = await import('../../../src/lib/simpleModeEngine.js');
    mod.setSimpleMode('ADVANCED', 'user');
    expect(mod.shouldSimplify({ abandonedFlows: 99 })).toBeNull();
  });
});
