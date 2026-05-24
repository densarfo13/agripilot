/**
 * invisibleIntelligenceAliases.test.js — verifies the three
 * spec-named modules that close the re-run gaps: the daily
 * decision engine alias at src/core/intelligence/, the
 * marketReadinessEngine at src/core/market/, and the
 * growerMemoryEngine at src/core/memory/.
 */

// localStorage shim for the journal / retention reads.
const _s = new Map();
const _ls = {
  getItem:    (k) => (_s.has(k) ? _s.get(k) : null),
  setItem:    (k, v) => { _s.set(k, String(v)); },
  removeItem: (k) => { _s.delete(k); },
  clear:      () => { _s.clear(); },
};
if (typeof globalThis.window === 'undefined') globalThis.window = { localStorage: _ls };
else if (!globalThis.window.localStorage) globalThis.window.localStorage = _ls;

import { describe, it, expect } from 'vitest';
import {
  computeDailyDecision as fromIntelligence,
  computeTodayTop3,
  EXPERIENCE_LEVEL,
} from '../../../src/core/intelligence/dailyDecisionEngine.js';
import {
  computeDailyDecision as fromLifecycle,
} from '../../../src/core/lifecycle/dailyDecisionAssistant.js';
import {
  computeMarketReadiness, buildBasicListingDraft, READINESS_STATE,
} from '../../../src/core/market/marketReadinessEngine.js';
import {
  getGrowerMemorySnapshot,
} from '../../../src/core/memory/growerMemoryEngine.js';

const NOW = Date.UTC(2026, 4, 24);
const DAY = 86400000;

// ─── §2 alias — src/core/intelligence/dailyDecisionEngine ─

describe('intelligence/dailyDecisionEngine alias', () => {
  it('exposes the SAME computeDailyDecision as the lifecycle module', () => {
    expect(fromIntelligence).toBe(fromLifecycle);
  });

  it('exposes computeTodayTop3 + EXPERIENCE_LEVEL through the alias', () => {
    expect(typeof computeTodayTop3).toBe('function');
    expect(EXPERIENCE_LEVEL.NEW).toBe('new');
  });
});

// ─── §5 market readiness ─────────────────────────────────

describe('marketReadinessEngine — harvest-to-market transition', () => {
  it('returns ok:false on missing crop', () => {
    expect(computeMarketReadiness({}).ok).toBe(false);
    expect(computeMarketReadiness({}).state).toBe(READINESS_STATE.UNKNOWN);
  });

  it('tomato planted 80 days ago → ready or approaching state', () => {
    const r = computeMarketReadiness({
      crop: 'tomato',
      plantingDate: new Date(NOW - 80 * DAY).toISOString(),
      nowMs: NOW,
    });
    expect(r.ok).toBe(true);
    expect([
      READINESS_STATE.READY, READINESS_STATE.APPROACHING, READINESS_STATE.PAST,
    ]).toContain(r.state);
    expect(r.isEstimate).toBe(true);
    expect(r.disclaimer).toMatch(/no price guarantee|confirm details|estimate/i);
  });

  it('ready state flips readyForListing true', () => {
    const r = computeMarketReadiness({
      crop: 'tomato',
      plantingDate: new Date(NOW - 75 * DAY).toISOString(),
      nowMs: NOW,
    });
    if (r.state === READINESS_STATE.READY || r.state === READINESS_STATE.APPROACHING) {
      expect(r.readyForListing).toBe(true);
    }
  });

  it('buildBasicListingDraft fills only what the caller knows — never suggests a price', () => {
    const d = buildBasicListingDraft({
      crop: 'tomato',
      estimatedQuantityKg: 12.5,
      location: 'Accra',
    });
    expect(d.title).toMatch(/tomato/i);
    expect(d.cropType).toBe('tomato');
    expect(d.quantity).toMatch(/12\.5 kg/i);
    expect(d.location).toBe('Accra');
    // CRITICAL: no price suggestion. Farmer fills it.
    expect(d.price).toBe('');
    expect(d.photo).toBe('');
  });

  it('listing draft always carries the disclaimer', () => {
    const d = buildBasicListingDraft({ crop: 'tomato' });
    expect(d.disclaimer).toBeTruthy();
    expect(d.disclaimer.toLowerCase()).toMatch(/not a quality guarantee|confirm details/);
  });

  it('never throws on garbage input', () => {
    expect(() => computeMarketReadiness(null)).not.toThrow();
    expect(() => buildBasicListingDraft(null)).not.toThrow();
  });
});

// ─── §9 grower memory ────────────────────────────────────

describe('growerMemoryEngine — read-only persistent memory facade', () => {
  it('returns the typed snapshot shape with empty inputs', () => {
    const m = getGrowerMemorySnapshot({});
    expect(m.ok).toBe(true);
    expect(m.scan).toBeTruthy();
    expect(m.scan.total).toBe(0);
    expect(m.watering).toBeTruthy();
    expect(m.harvests).toBeTruthy();
    expect(typeof m.disclaimer).toBe('string');
  });

  it('summarises scan history including disease counts', () => {
    const m = getGrowerMemorySnapshot({
      crop: 'tomato',
      scanHistory: [
        { issueCategory: 'fungal_risk', at: '2026-05-20' },
        { issueCategory: 'fungal_risk', at: '2026-05-21' },
        { issueCategory: 'healthy',     at: '2026-05-22' },
      ],
    });
    expect(m.scan.total).toBe(3);
    expect(m.scan.lastCategory).toBe('healthy');
    const fungal = m.scan.diseaseHistory.find((d) => d.category === 'fungal_risk');
    expect(fungal).toBeTruthy();
    expect(fungal.count).toBe(2);
  });

  it('summarises journal harvests + yield totals', () => {
    const m = getGrowerMemorySnapshot({
      journal: [
        { kind: 'harvest', yieldKg: 12.4, at: '2026-04-15' },
        { kind: 'note',    at: '2026-04-16' },
        { kind: 'harvest', yieldKg: 8.6,  at: '2026-04-20' },
      ],
    });
    expect(m.harvests.totalHarvests).toBe(2);
    expect(m.harvests.totalYieldKg).toBe(21);
  });

  it('always includes the read-only disclaimer', () => {
    const m = getGrowerMemorySnapshot({});
    expect(m.disclaimer).toMatch(/read-only|informs guidance|not promises/i);
  });

  it('never throws on garbage input', () => {
    expect(() => getGrowerMemorySnapshot(null)).not.toThrow();
  });
});
