/**
 * invisibleIntelligenceLayer.test.js — pins the May 2026 invisible-
 * intelligence layer contract:
 *
 *   • toFarmerGuidance produces the calm farmer-facing envelope
 *     and NEVER leaks raw scores / NDVI / fraud / chemical doses.
 *   • Bad input falls through to the safe fallback.
 *   • Forbidden risk words are sanitised out.
 *   • The 6 spec feature flags are present + default OFF.
 *   • Flags honour both server (process.env.<FLAG>) and client
 *     (VITE_<FLAG>) variants.
 *   • The intelligence barrel exposes toFarmerGuidance + flags.
 *
 * Failures here are regression-meaningful: anyone shipping raw
 * model output / NDVI numbers / fraud scores to the farmer-
 * facing envelope, or removing the opt-in flag gating, fails CI.
 */

import { describe, it, expect, beforeEach } from 'vitest';

const FA = '../../../src/intelligence/farmerAdapter.js';
const FF = '../../../src/intelligence/featureFlags.js';
const IX = '../../../src/intelligence/index.js';

function snapshotEnv() {
  const before = { ...process.env };
  return () => {
    for (const k of Object.keys(process.env)) {
      if (!(k in before)) delete process.env[k];
    }
    for (const k of Object.keys(before)) process.env[k] = before[k];
  };
}

describe('Invisible Intelligence Layer — May 2026', () => {

  describe('toFarmerGuidance — calm conduit', () => {
    it('returns the safe-fallback envelope on null / undefined / non-object', async () => {
      const { toFarmerGuidance, _internal } = await import('../../../src/intelligence/farmerAdapter.js');
      for (const bad of [null, undefined, 7, 'oops', []]) {
        const g = toFarmerGuidance(bad);
        expect(g.title).toBe(_internal.DEFAULT_FALLBACK.title);
        expect(g.actionRoute).toMatch(/^\//);
        expect(g.tone).toBe('calm');
        expect(Object.isFrozen(g)).toBe(true);
      }
    });

    it('strips internal fields (NDVI / fraudScore / pesticideDosage / etc.)', async () => {
      const { toFarmerGuidance, _internal } = await import('../../../src/intelligence/farmerAdapter.js');
      const g = toFarmerGuidance({
        titleFb: 'Inspect lower leaves',
        messageFb: 'Humidity may increase leaf issues.',
        actionLabel: 'actions.inspectLeaves',
        actionLabelFb: 'Inspect leaves',
        actionRoute: '/scan',
        ndvi:           0.71,
        rawScore:       42,
        fraudScore:     0.13,
        modelVersion:   'gpt-X',
        pesticideDosage: '50ml/L',
        yieldKg:        180,
        sourceSignals:  { weather: {} },
      });
      // No internal field appears in the emitted envelope.
      for (const k of _internal.INTERNAL_FIELDS) {
        expect(g[k]).toBeUndefined();
      }
      expect(g.titleFb).toBe('Inspect lower leaves');
    });

    it('sanitises forbidden risk words to the calm fallback', async () => {
      const { toFarmerGuidance, _internal } = await import('../../../src/intelligence/farmerAdapter.js');
      for (const bad of ['DANGER!! Spray now', 'URGENT crop fraud',
                         '100% guaranteed yield', 'CRITICAL pest']) {
        const g = toFarmerGuidance({ titleFb: bad, actionLabel: 'actions.startCheck' });
        expect(g.titleFb).toBe(_internal.DEFAULT_FALLBACK.titleFb);
      }
    });

    it('rejects external URLs in actionRoute (internal routes only)', async () => {
      const { toFarmerGuidance } = await import('../../../src/intelligence/farmerAdapter.js');
      const g = toFarmerGuidance({ actionRoute: 'https://evil.example/grant' });
      // Falls through to default '/scan' — never an outbound URL.
      expect(g.actionRoute).toBe('/scan');
    });

    it('maps urgency hint → tone band (calm / attentive / reassuring)', async () => {
      const { toFarmerGuidance } = await import('../../../src/intelligence/farmerAdapter.js');
      expect(toFarmerGuidance({ urgency: 'high' }).tone).toBe('attentive');
      expect(toFarmerGuidance({ urgency: 'low' }).tone).toBe('reassuring');
      expect(toFarmerGuidance({ urgency: 'normal' }).tone).toBe('calm');
      // Explicit tone wins over hint.
      expect(toFarmerGuidance({ tone: 'calm', urgency: 'high' }).tone).toBe('calm');
    });

    it('formats numeric minutes as "<N> min"', async () => {
      const { toFarmerGuidance } = await import('../../../src/intelligence/farmerAdapter.js');
      expect(toFarmerGuidance({ estimatedMinutes: 5 }).timeEstimate).toBe('5 min');
      expect(toFarmerGuidance({ estimatedMinutes: 0 }).timeEstimate).toBe('0 min');
      expect(toFarmerGuidance({ estimatedMinutes: -1 }).timeEstimate).toBe(null);
      expect(toFarmerGuidance({ timeEstimate: '2 min' }).timeEstimate).toBe('2 min');
    });

    it('is idempotent — re-feeding the adapter its own output yields a stable shape', async () => {
      const { toFarmerGuidance } = await import('../../../src/intelligence/farmerAdapter.js');
      const first  = toFarmerGuidance({ titleFb: 'Quick check', urgency: 'high' });
      const second = toFarmerGuidance(first);
      expect(second.title).toBe(first.title);
      expect(second.message).toBe(first.message);
      expect(second.actionRoute).toBe(first.actionRoute);
      expect(second.tone).toBe(first.tone);
    });
  });

  describe('Intelligence feature flags — six opt-in switches', () => {
    let restoreEnv;
    beforeEach(() => { restoreEnv = snapshotEnv(); });

    it('catalogue is the documented 6-flag set', async () => {
      const { INTELLIGENCE_FLAGS } = await import('../../../src/intelligence/featureFlags.js');
      expect(INTELLIGENCE_FLAGS).toEqual([
        'ENABLE_ANALYTICS_ENGINE',
        'ENABLE_PREDICTION_ENGINE',
        'ENABLE_AI_ADAPTER',
        'ENABLE_SATELLITE_ENGINE',
        'ENABLE_SCORING_ENGINE',
        'ENABLE_RISK_ENGINE',
      ]);
      expect(Object.isFrozen(INTELLIGENCE_FLAGS)).toBe(true);
    });

    it('every flag defaults to OFF when no env override is set', async () => {
      const { INTELLIGENCE_FLAGS, isIntelligenceFlagEnabled,
              intelligenceFlagsSnapshot } = await import('../../../src/intelligence/featureFlags.js');
      for (const k of INTELLIGENCE_FLAGS) delete process.env[k];
      for (const k of INTELLIGENCE_FLAGS) {
        expect(isIntelligenceFlagEnabled(k)).toBe(false);
      }
      const snap = intelligenceFlagsSnapshot();
      for (const k of INTELLIGENCE_FLAGS) expect(snap[k]).toBe(false);
      restoreEnv();
    });

    it('truthy env values flip the flag on; falsy keep it off', async () => {
      const { isIntelligenceFlagEnabled } = await import('../../../src/intelligence/featureFlags.js');
      for (const truthy of ['1', 'true', 'on', 'yes', 'enabled']) {
        process.env.ENABLE_AI_ADAPTER = truthy;
        expect(isIntelligenceFlagEnabled('ENABLE_AI_ADAPTER')).toBe(true);
      }
      for (const falsy of ['0', 'false', 'off', 'no', 'disabled', '']) {
        process.env.ENABLE_AI_ADAPTER = falsy;
        expect(isIntelligenceFlagEnabled('ENABLE_AI_ADAPTER')).toBe(false);
      }
      restoreEnv();
    });

    it('unknown flag names always return false (safe default)', async () => {
      const { isIntelligenceFlagEnabled } = await import('../../../src/intelligence/featureFlags.js');
      expect(isIntelligenceFlagEnabled('ENABLE_NUCLEAR_LAUNCH')).toBe(false);
      expect(isIntelligenceFlagEnabled(null)).toBe(false);
      expect(isIntelligenceFlagEnabled(123)).toBe(false);
    });
  });

  describe('Intelligence barrel exposes the new surface', () => {
    it('src/intelligence/index.js re-exports toFarmerGuidance + flags', async () => {
      const mod = await import('../../../src/intelligence/index.js');
      expect(typeof mod.toFarmerGuidance).toBe('function');
      expect(typeof mod.isIntelligenceFlagEnabled).toBe('function');
      expect(typeof mod.intelligenceFlagsSnapshot).toBe('function');
      expect(Array.isArray(mod.INTELLIGENCE_FLAGS)).toBe(true);
      expect(mod.INTELLIGENCE_FLAGS.length).toBe(6);
    });
  });
});
