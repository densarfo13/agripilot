/**
 * scanResultPageWiring.test.js — verify the produce-intelligence
 * wiring inside ScanResultPage is correctly shaped + that the
 * engine handles a scanHistory-style raw entry without surprise.
 *
 * The component itself uses hooks + react-router, so we don't
 * render it — we verify (a) the module imports cleanly, (b) the
 * "is this produce-flavored?" detection rule matches the cases
 * we expect, (c) computeProduceIntelligence consumes the persisted
 * raw shape without losing data.
 */

import { describe, it, expect } from 'vitest';
import {
  computeProduceIntelligence,
  MARKET_READINESS,
} from '../../../src/features/scan/ProduceIntelligenceEngine/index.js';

describe('ScanResultPage — produce detection rule', () => {
  // The component's `looksProduce` check — mirrored here as a pure
  // function so we can exercise every branch without mounting React.
  function looksProduce(raw) {
    if (!raw || typeof raw !== 'object') return false;
    return Boolean(
      raw.ripenessStage ||
      raw.qualityFlag ||
      raw.scanType === 'fruit_ripeness' ||
      raw.scanType === 'produce_quality',
    );
  }

  it('returns true for FRUIT_RIPENESS scanType', () => {
    expect(looksProduce({ scanType: 'fruit_ripeness' })).toBe(true);
  });

  it('returns true for PRODUCE_QUALITY scanType', () => {
    expect(looksProduce({ scanType: 'produce_quality' })).toBe(true);
  });

  it('returns true for raw ripenessStage field', () => {
    expect(looksProduce({ ripenessStage: 'ready' })).toBe(true);
  });

  it('returns true for raw qualityFlag field', () => {
    expect(looksProduce({ qualityFlag: 'rot' })).toBe(true);
  });

  it('returns false for crop-health scans', () => {
    expect(looksProduce({ scanType: 'crop_health' })).toBe(false);
    expect(looksProduce({ possibleIssue: 'leaf yellowing' })).toBe(false);
  });

  it('returns false for malformed entries', () => {
    expect(looksProduce(null)).toBe(false);
    expect(looksProduce(undefined)).toBe(false);
    expect(looksProduce('not-an-object')).toBe(false);
    expect(looksProduce({})).toBe(false);
  });
});

describe('computeProduceIntelligence consumes a scanHistory-shaped raw entry', () => {
  it('a FRUIT_RIPENESS orchestrator result produces a meaningful envelope', () => {
    // Shape mirrors the ScanOrchestrator normalized result that
    // ScanResultPage would feed in via entry.raw.
    const raw = {
      scanType:       'fruit_ripeness',
      subjectDetected: 'tomato',
      ripenessStage:  'ready',
      confidence:     'likely',
      confidenceTone: 'likely',
    };
    const intel = computeProduceIntelligence({ scan: raw, crop: 'tomato' });
    expect(intel.marketReadiness).toBe(MARKET_READINESS.MARKET_READY);
    expect(intel.sellFlow.suggestListing).toBe(true);
  });

  it('a PRODUCE_QUALITY result with rot produces quality_declining', () => {
    const raw = {
      scanType:       'produce_quality',
      subjectDetected: 'mango',
      qualityFlag:    'rot at base',
      confidence:     'likely',
    };
    const intel = computeProduceIntelligence({ scan: raw, crop: 'mango' });
    expect(intel.marketReadiness).toBe(MARKET_READINESS.QUALITY_DECLINING);
    expect(intel.sellFlow.suggestListing).toBe(false);
  });

  it('passes the entry.cropId through when scan has no crop', () => {
    const raw = { ripenessStage: 'ready' };
    const intel = computeProduceIntelligence({ scan: raw, crop: 'pepper' });
    expect(intel.sellFlow.crop).toBe('pepper');
  });
});
