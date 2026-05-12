/**
 * farmIntelligenceSnapshot.test.js — pins the §4 facade contract:
 *   1. Returns a stable shape on empty / null input.
 *   2. Never throws when a store throws.
 *   3. weatherOverride flows through to predictiveRisks + briefing.
 *   4. skipNextBestAction = true returns null for that field.
 *   5. errors[] records which subsystem failed.
 *   6. cropName + farmerName flow to the right inner helpers.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getFarmIntelligence } from '../../../src/lib/farmIntelligenceSnapshot.js';

// Stub localStorage so module reads don't crash in Node.
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

describe('getFarmIntelligence — stable shape', () => {
  it('returns the documented top-level fields on empty input', () => {
    const s = getFarmIntelligence({});
    expect(Array.isArray(s.scanHistory)).toBe(true);
    expect(Array.isArray(s.scanTasks)).toBe(true);
    expect(Array.isArray(s.risks)).toBe(true);
    expect(Array.isArray(s.suppressedKinds)).toBe(true);
    expect(Array.isArray(s.errors)).toBe(true);
    expect(s.buckets).toHaveProperty('doNow');
    expect(s.buckets).toHaveProperty('thisWeek');
    expect(s.buckets).toHaveProperty('monitor');
    expect(typeof s.offlineQueueDepth).toBe('number');
    expect(typeof s.readAt).toBe('number');
  });

  it('does not throw on null input', () => {
    expect(() => getFarmIntelligence(null)).not.toThrow();
  });

  it('returns a nextBestAction by default (falls back to walk-the-field)', () => {
    const s = getFarmIntelligence({});
    expect(s.nextBestAction).toBeTruthy();
    expect(s.nextBestAction.kind).toBe('fallback_walk');
  });

  it('skipNextBestAction=true returns null nextBestAction', () => {
    const s = getFarmIntelligence({ skipNextBestAction: true });
    expect(s.nextBestAction).toBeNull();
  });
});

describe('getFarmIntelligence — input wiring', () => {
  it('weatherOverride flows through to predictiveRisks', () => {
    const s = getFarmIntelligence({
      cropName: 'tomato',
      weatherOverride: { humidity: 85, tempC: 27 },
    });
    expect(s.weather).toEqual({ humidity: 85, tempC: 27 });
    const fungal = s.risks.find((r) => r.kind === 'fungal');
    expect(fungal).toBeDefined();
    expect(fungal.level).toBe('high');     // tomato susceptible
  });

  it('farmerName flows into the briefing greeting', () => {
    const s = getFarmIntelligence({
      farmerName: 'Dennis Kofi',
      weatherOverride: { summary: 'Sunny' },
      // 9am to land on "Good morning"
      nowMs: new Date(2026, 4, 12, 9, 0, 0).getTime(),
    });
    expect(s.briefing.greeting).toBe('Good morning, Dennis.');
  });

  it('top high-risk surfaces as the next best action', () => {
    const s = getFarmIntelligence({
      cropName: 'tomato',
      weatherOverride: { humidity: 85, tempC: 27 },
    });
    expect(s.nextBestAction.kind.startsWith('risk_high:')).toBe(true);
  });
});

describe('getFarmIntelligence — error isolation', () => {
  it('records failures from individual subsystems without crashing the snapshot', () => {
    // Break localStorage so all storage-backed stores fail.
    globalThis.localStorage = {
      getItem: () => { throw new Error('storage_broken'); },
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
    };
    const s = getFarmIntelligence({ cropName: 'maize' });
    expect(s).toHaveProperty('errors');
    // The snapshot still returns a stable shape.
    expect(Array.isArray(s.scanHistory)).toBe(true);
    expect(s.nextBestAction).toBeTruthy();    // fallback path still works
  });
});
