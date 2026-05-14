/**
 * produceIntelligence.test.js — Produce Market Intelligence Upgrade
 *
 * Verifies the engine contract:
 *   • envelope shape (frozen, all required keys)
 *   • ripeness classification across all crops
 *   • soft grading (excellent / good / fair / needs_sorting)
 *   • market readiness states (5 buckets)
 *   • buyer trust phrasing — calm only, no certification claims
 *   • sell-flow autofill activates only when market_ready / sell_soon
 *   • longitudinal trend (improving / stable / declining / first_scan)
 *   • publishProduceMarketSignals fires HARVEST_READY at the right time
 *   • never throws on malformed input
 *   • safety: no harsh/certifying/scientific wording in any output
 */

import { describe, it, expect } from 'vitest';
import {
  computeProduceIntelligence,
  publishProduceMarketSignals,
  RIPENESS_STATES,
  QUALITY_STATES,
  MARKET_READINESS,
} from '../../../src/features/scan/ProduceIntelligenceEngine/index.js';
import * as bus from '../../../src/lib/farmEventBus.js';

const FORBIDDEN_WORDS = [
  'certified',
  'certification',
  'laboratory',
  'lab-grade',
  'export-grade',
  'guaranteed',
  'guarantee',
  'scientifically',
];

function assertSafeWording(envelope) {
  const blob = JSON.stringify(envelope).toLowerCase();
  for (const w of FORBIDDEN_WORDS) {
    expect(blob).not.toContain(w);
  }
}

describe('envelope shape + freezing', () => {
  it('returns a frozen envelope with the spec-shaped keys', () => {
    const out = computeProduceIntelligence({
      crop: 'tomato',
      scan: { ripenessStage: 'ready', confidence: 'likely' },
    });
    expect(out).toHaveProperty('ripenessState');
    expect(out).toHaveProperty('qualityState');
    expect(out).toHaveProperty('marketReadiness');
    expect(out).toHaveProperty('buyerTrustSignal');
    expect(out).toHaveProperty('handlingRecommendation');
    expect(out).toHaveProperty('urgency');
    expect(out).toHaveProperty('confidenceTone');
    expect(out).toHaveProperty('copy');
    expect(out).toHaveProperty('sellFlow');
    expect(out).toHaveProperty('history');
    expect(Object.isFrozen(out)).toBe(true);
    expect(Object.isFrozen(out.sellFlow)).toBe(true);
    expect(Object.isFrozen(out.history)).toBe(true);
  });

  it('never exposes a raw numeric AI score', () => {
    const out = computeProduceIntelligence({
      crop: 'tomato',
      scan: { ripenessStage: 'ready', confidence: 'high_likelihood', score: 0.92, rawProb: 0.87 },
    });
    const blob = JSON.stringify(out);
    expect(blob).not.toMatch(/0\.9\d/);
    expect(blob).not.toMatch(/\bscore\b/);
    expect(blob).not.toMatch(/rawProb/);
  });
});

describe('ripeness classification', () => {
  it.each([
    ['overripe',     RIPENESS_STATES.OVERRIPE],
    ['ready',        RIPENESS_STATES.READY],
    ['mature',       RIPENESS_STATES.READY],
    ['near ripe',    RIPENESS_STATES.NEARLY_READY],
    ['approaching',  RIPENESS_STATES.NEARLY_READY],
    ['unripe',       RIPENESS_STATES.UNRIPE],
    ['immature',     RIPENESS_STATES.UNRIPE],
    ['',             RIPENESS_STATES.UNKNOWN],
  ])('"%s" → %s', (input, expected) => {
    const out = computeProduceIntelligence({
      crop: 'tomato',
      scan: { ripenessStage: input },
    });
    expect(out.ripenessState).toBe(expected);
  });
});

describe('soft quality grading', () => {
  it('rot or mold → needs_sorting', () => {
    const out = computeProduceIntelligence({
      crop: 'mango',
      scan: { ripenessStage: 'ready', defects: ['mold patches on skin'] },
    });
    expect(out.qualityState).toBe(QUALITY_STATES.NEEDS_SORTING);
    expect(out.urgency).toBe('high');
  });

  it('bruise alone → good (mild)', () => {
    const out = computeProduceIntelligence({
      crop: 'tomato',
      scan: { ripenessStage: 'ready', defects: ['some bruising'] },
    });
    expect(out.qualityState).toBe(QUALITY_STATES.GOOD);
  });

  it('crack + insect damage → fair', () => {
    const out = computeProduceIntelligence({
      crop: 'pepper',
      scan: { ripenessStage: 'ready', defects: ['crack visible', 'insect bite marks'] },
    });
    expect(out.qualityState).toBe(QUALITY_STATES.FAIR);
  });

  it('no defects → excellent', () => {
    const out = computeProduceIntelligence({
      crop: 'tomato',
      scan: { ripenessStage: 'ready' },
    });
    expect(out.qualityState).toBe(QUALITY_STATES.EXCELLENT);
  });

  it('overripe → quality capped at fair (even with no defects)', () => {
    const out = computeProduceIntelligence({
      crop: 'banana',
      scan: { ripenessStage: 'overripe' },
    });
    expect(out.qualityState).toBe(QUALITY_STATES.FAIR);
  });
});

describe('market readiness — 5 states', () => {
  it('ready + excellent → market_ready', () => {
    const out = computeProduceIntelligence({
      crop: 'tomato',
      scan: { ripenessStage: 'ready' },
    });
    expect(out.marketReadiness).toBe(MARKET_READINESS.MARKET_READY);
  });

  it('ready + fair → sell_soon', () => {
    const out = computeProduceIntelligence({
      crop: 'mango',
      scan: { ripenessStage: 'ready', defects: ['crack', 'insect bite'] },
    });
    expect(out.marketReadiness).toBe(MARKET_READINESS.SELL_SOON);
  });

  it('nearly ripe → nearly_ready', () => {
    const out = computeProduceIntelligence({
      crop: 'pepper',
      scan: { ripenessStage: 'nearly ready' },
    });
    expect(out.marketReadiness).toBe(MARKET_READINESS.NEARLY_READY);
  });

  it('unripe → not_ready', () => {
    const out = computeProduceIntelligence({
      crop: 'banana',
      scan: { ripenessStage: 'unripe' },
    });
    expect(out.marketReadiness).toBe(MARKET_READINESS.NOT_READY);
  });

  it('rot → quality_declining (regardless of ripeness)', () => {
    const out = computeProduceIntelligence({
      crop: 'mango',
      scan: { ripenessStage: 'ready', defects: ['rot at base'] },
    });
    expect(out.marketReadiness).toBe(MARKET_READINESS.QUALITY_DECLINING);
  });

  it('overripe → quality_declining', () => {
    const out = computeProduceIntelligence({
      crop: 'banana',
      scan: { ripenessStage: 'overripe' },
    });
    expect(out.marketReadiness).toBe(MARKET_READINESS.QUALITY_DECLINING);
  });
});

describe('buyer trust signal — calm phrasing only', () => {
  it('market_ready + excellent → suitable for local buyers', () => {
    const out = computeProduceIntelligence({
      crop: 'tomato',
      scan: { ripenessStage: 'ready' },
    });
    expect(out.buyerTrustSignal.toLowerCase()).toContain('suitable for local buyers');
  });

  it('quality_declining → freshness may decline', () => {
    const out = computeProduceIntelligence({
      crop: 'banana',
      scan: { ripenessStage: 'overripe' },
    });
    expect(out.buyerTrustSignal.toLowerCase()).toContain('freshness');
    expect(out.buyerTrustSignal.toLowerCase()).toContain('decline');
  });

  it('fair quality → minor surface damage detected', () => {
    const out = computeProduceIntelligence({
      crop: 'pepper',
      scan: { ripenessStage: 'ready', defects: ['crack', 'bite'] },
    });
    expect(out.buyerTrustSignal.toLowerCase()).toContain('minor surface damage');
  });

  it('never uses harsh/certifying/scientific wording', () => {
    const inputs = [
      { crop: 'tomato', scan: { ripenessStage: 'ready' } },
      { crop: 'mango',  scan: { ripenessStage: 'overripe' } },
      { crop: 'pepper', scan: { ripenessStage: 'ready', defects: ['crack', 'bite'] } },
      { crop: 'banana', scan: { ripenessStage: 'unripe' } },
      { crop: 'mango',  scan: { ripenessStage: 'ready', defects: ['rot'] } },
    ];
    for (const input of inputs) {
      assertSafeWording(computeProduceIntelligence(input));
    }
  });
});

describe('sell-flow integration', () => {
  it('market_ready → suggestListing true + window 3 days', () => {
    const out = computeProduceIntelligence({
      crop: 'tomato',
      scan: { ripenessStage: 'ready' },
    });
    expect(out.sellFlow.suggestListing).toBe(true);
    expect(out.sellFlow.crop).toBe('tomato');
    expect(out.sellFlow.estimatedReadiness).toBe(RIPENESS_STATES.READY);
    expect(out.sellFlow.qualityState).toBe(QUALITY_STATES.EXCELLENT);
    expect(out.sellFlow.suggestedWindowDays).toBe(3);
  });

  it('sell_soon → suggestListing true + tighter window', () => {
    const out = computeProduceIntelligence({
      crop: 'mango',
      scan: { ripenessStage: 'ready', defects: ['crack', 'bite'] },
    });
    expect(out.sellFlow.suggestListing).toBe(true);
    expect(out.sellFlow.suggestedWindowDays).toBe(2);
  });

  it('nearly_ready → suggestListing false', () => {
    const out = computeProduceIntelligence({
      crop: 'pepper',
      scan: { ripenessStage: 'near' },
    });
    expect(out.sellFlow.suggestListing).toBe(false);
    expect(out.sellFlow.suggestedWindowDays).toBe(0);
  });

  it('quality_declining → suggestListing false (no harsh prompt)', () => {
    const out = computeProduceIntelligence({
      crop: 'banana',
      scan: { ripenessStage: 'overripe' },
    });
    expect(out.sellFlow.suggestListing).toBe(false);
  });
});

describe('longitudinal trend (scan history)', () => {
  const TWO_DAYS_AGO = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

  it('first_scan when no history', () => {
    const out = computeProduceIntelligence({
      crop: 'tomato',
      scan: { ripenessStage: 'ready' },
      scanHistory: [],
    });
    expect(out.history.trend).toBe('first_scan');
    expect(out.history.daysSinceLastScan).toBeNull();
  });

  it('declining when current quality is lower than last', () => {
    const out = computeProduceIntelligence({
      crop: 'tomato',
      scan: { ripenessStage: 'ready', defects: ['crack', 'bite'] }, // fair
      scanHistory: [
        { crop: 'tomato', qualityState: QUALITY_STATES.EXCELLENT, at: TWO_DAYS_AGO },
      ],
    });
    expect(out.history.trend).toBe('declining');
    expect(out.history.daysSinceLastScan).toBe(2);
  });

  it('improving when current quality is higher than last', () => {
    const out = computeProduceIntelligence({
      crop: 'tomato',
      scan: { ripenessStage: 'ready' }, // excellent
      scanHistory: [
        { crop: 'tomato', qualityState: QUALITY_STATES.FAIR, at: TWO_DAYS_AGO },
      ],
    });
    expect(out.history.trend).toBe('improving');
  });

  it('stable when quality is unchanged', () => {
    const out = computeProduceIntelligence({
      crop: 'tomato',
      scan: { ripenessStage: 'ready' }, // excellent
      scanHistory: [
        { crop: 'tomato', qualityState: QUALITY_STATES.EXCELLENT, at: TWO_DAYS_AGO },
      ],
    });
    expect(out.history.trend).toBe('stable');
  });

  it('ignores history entries for other crops', () => {
    const out = computeProduceIntelligence({
      crop: 'tomato',
      scan: { ripenessStage: 'ready' },
      scanHistory: [
        { crop: 'mango',  qualityState: QUALITY_STATES.FAIR, at: TWO_DAYS_AGO },
        { crop: 'pepper', qualityState: QUALITY_STATES.FAIR, at: TWO_DAYS_AGO },
      ],
    });
    expect(out.history.trend).toBe('first_scan');
  });
});

describe('per-crop coverage — calm wording across the catalogue', () => {
  const CROPS = ['tomato', 'pepper', 'banana', 'mango'];
  const STAGES = ['unripe', 'near', 'ready', 'overripe'];
  it.each(CROPS.flatMap((c) => STAGES.map((s) => [c, s])))(
    '%s @ %s — calm, frozen, safe wording',
    (crop, stage) => {
      const out = computeProduceIntelligence({ crop, scan: { ripenessStage: stage } });
      expect(Object.isFrozen(out)).toBe(true);
      expect(typeof out.copy).toBe('string');
      expect(out.copy.length).toBeLessThan(160);
      assertSafeWording(out);
    },
  );
});

describe('mixed-quality baskets (multi-defect inputs)', () => {
  it('handles a mixed basket with mild + medium defects without crashing', () => {
    const out = computeProduceIntelligence({
      crop: 'tomato',
      scan: {
        ripenessStage: 'ready',
        defects: ['some bruising on one side', 'crack on stem', 'small insect bite'],
      },
    });
    expect(out.qualityState).toBe(QUALITY_STATES.FAIR);
    expect(out.marketReadiness).toBe(MARKET_READINESS.SELL_SOON);
  });
});

describe('safety guards — never throws', () => {
  it.each([
    [null],
    [undefined],
    [{}],
    [{ crop: 'tomato' }],
    [{ scan: 'not-an-object' }],
    [{ scan: null }],
    [{ scan: { ripenessStage: 42 } }],
  ])('input %o', (input) => {
    expect(() => computeProduceIntelligence(input)).not.toThrow();
    const out = computeProduceIntelligence(input);
    expect(out).toBeTruthy();
    expect(Object.isFrozen(out)).toBe(true);
  });
});

describe('publishProduceMarketSignals — bus integration', () => {
  it('publishes HARVEST_READY when marketReadiness is market_ready', () => {
    bus._resetBus();
    const heard = [];
    bus.subscribe(bus.FarmEvents.HARVEST_READY, (p) => heard.push(p));

    const intel = computeProduceIntelligence({
      crop: 'tomato',
      scan: { ripenessStage: 'ready' },
    });
    publishProduceMarketSignals(intel, { scanId: 'scan_123' });
    expect(heard.length).toBe(1);
    expect(heard[0].crop).toBe('tomato');
    expect(heard[0].marketReadiness).toBe(MARKET_READINESS.MARKET_READY);
    expect(heard[0].scanId).toBe('scan_123');
  });

  it('does NOT publish HARVEST_READY when not_ready', () => {
    bus._resetBus();
    const heard = [];
    bus.subscribe(bus.FarmEvents.HARVEST_READY, (p) => heard.push(p));
    const intel = computeProduceIntelligence({
      crop: 'tomato',
      scan: { ripenessStage: 'unripe' },
    });
    publishProduceMarketSignals(intel, { scanId: 'scan_124' });
    expect(heard.length).toBe(0);
  });

  it('never throws on malformed intel', () => {
    expect(() => publishProduceMarketSignals(null)).not.toThrow();
    expect(() => publishProduceMarketSignals({})).not.toThrow();
    expect(() => publishProduceMarketSignals('garbage')).not.toThrow();
  });
});
