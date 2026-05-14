/**
 * produceWiring.test.js — wires the gaps closed:
 *   • context-aware grading (weather + storage-time downgrades)
 *   • produceIntelMemory store (save/read/dedup/cap)
 *   • ProduceQualityBadge structural render
 *   • HarvestReadyPrompt honors the latest scan intel
 *
 * Component tests use the React-element-tree pattern from
 * adminPolish.test.js — no DOM required.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import {
  computeProduceIntelligence,
  QUALITY_STATES,
  MARKET_READINESS,
} from '../../../src/features/scan/ProduceIntelligenceEngine/index.js';
import {
  saveProduceIntel,
  readProduceIntel,
  readLatestProduceIntel,
  clearProduceIntel,
} from '../../../src/features/scan/produceIntelMemory.js';
import ProduceQualityBadge from '../../../src/components/produce/ProduceQualityBadge.jsx';
import HarvestReadyPrompt from '../../../src/components/activation/HarvestReadyPrompt.jsx';

function makeStorage() {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(String(k), String(v)); },
    removeItem: (k) => { store.delete(String(k)); },
    clear: () => { store.clear(); },
  };
}

beforeEach(() => {
  globalThis.localStorage = makeStorage();
});

// ───────────────────────────────────────────────────────────────
// Engine — weather + storage-time context downgrade
// ───────────────────────────────────────────────────────────────

describe('engine — weather + storage-time downgrade', () => {
  it('hot weather (>= 32C) downgrades excellent → good', () => {
    const out = computeProduceIntelligence({
      crop: 'tomato',
      scan: { ripenessStage: 'ready' },
      weather: { condition: 'sunny', temp: 34 },
    });
    expect(out.qualityState).toBe(QUALITY_STATES.GOOD);
  });

  it('rainy + 48h+ storage downgrades excellent → fair', () => {
    const out = computeProduceIntelligence({
      crop: 'mango',
      scan: { ripenessStage: 'ready' },
      weather: { condition: 'heavy rain', temp: 26 },
      storageHoursSinceHarvest: 72,
    });
    expect(out.qualityState).toBe(QUALITY_STATES.FAIR);
  });

  it('moderate weather + fresh storage keeps excellent', () => {
    const out = computeProduceIntelligence({
      crop: 'pepper',
      scan: { ripenessStage: 'ready' },
      weather: { condition: 'cloudy', temp: 24 },
      storageHoursSinceHarvest: 4,
    });
    expect(out.qualityState).toBe(QUALITY_STATES.EXCELLENT);
  });

  it('context never demotes past FAIR (severe defects are the only path to needs_sorting)', () => {
    const out = computeProduceIntelligence({
      crop: 'tomato',
      scan: { ripenessStage: 'ready', defects: ['crack on stem'] }, // base = fair
      weather: { condition: 'humid rain', temp: 34 },
      storageHoursSinceHarvest: 96,
    });
    expect(out.qualityState).toBe(QUALITY_STATES.FAIR);
    // Severe path: rot defect still wins regardless of context.
    const rotten = computeProduceIntelligence({
      crop: 'mango',
      scan: { ripenessStage: 'ready', defects: ['rot at base'] },
    });
    expect(rotten.qualityState).toBe(QUALITY_STATES.NEEDS_SORTING);
  });

  it('weather context never PROMOTES quality', () => {
    const out = computeProduceIntelligence({
      crop: 'tomato',
      scan: { ripenessStage: 'ready', defects: ['some bruising'] }, // good
      weather: { condition: 'cool', temp: 18 },
    });
    // Cool weather doesn't make bruised produce excellent.
    expect(out.qualityState).toBe(QUALITY_STATES.GOOD);
  });
});

// ───────────────────────────────────────────────────────────────
// produceIntelMemory
// ───────────────────────────────────────────────────────────────

describe('produceIntelMemory', () => {
  it('save + read round-trips a single envelope', () => {
    const intel = computeProduceIntelligence({
      crop: 'tomato',
      scan: { ripenessStage: 'ready' },
    });
    saveProduceIntel('tomato', intel, { scanId: 'abc' });
    const got = readProduceIntel('tomato');
    expect(got).toBeTruthy();
    expect(got.marketReadiness).toBe(MARKET_READINESS.MARKET_READY);
  });

  it('returns null for crops with no stored intel', () => {
    expect(readProduceIntel('mango')).toBeNull();
  });

  it('lowercases the crop key (tomato == TOMATO)', () => {
    const intel = computeProduceIntelligence({
      crop: 'tomato',
      scan: { ripenessStage: 'ready' },
    });
    saveProduceIntel('Tomato', intel);
    expect(readProduceIntel('tomato')).toBeTruthy();
    expect(readProduceIntel('TOMATO')).toBeTruthy();
  });

  it('readLatestProduceIntel picks the most-recently-saved crop', async () => {
    const i1 = computeProduceIntelligence({ crop: 'tomato', scan: { ripenessStage: 'ready' } });
    const i2 = computeProduceIntelligence({ crop: 'mango',  scan: { ripenessStage: 'ready' } });
    saveProduceIntel('tomato', i1);
    await new Promise((r) => setTimeout(r, 5)); // separate timestamps
    saveProduceIntel('mango',  i2);
    const latest = readLatestProduceIntel();
    expect(latest.crop).toBe('mango');
  });

  it('clearProduceIntel wipes everything', () => {
    const intel = computeProduceIntelligence({ crop: 'tomato', scan: { ripenessStage: 'ready' } });
    saveProduceIntel('tomato', intel);
    clearProduceIntel();
    expect(readProduceIntel('tomato')).toBeNull();
    expect(readLatestProduceIntel()).toBeNull();
  });

  it('save/read never throw on malformed input', () => {
    expect(() => saveProduceIntel(null, null)).not.toThrow();
    expect(() => saveProduceIntel('', { foo: 'bar' })).not.toThrow();
    expect(() => readProduceIntel(null)).not.toThrow();
    expect(() => readProduceIntel('')).not.toThrow();
  });

  it('survives SSR (no localStorage)', () => {
    delete globalThis.localStorage;
    expect(() => saveProduceIntel('tomato', { foo: 'bar' })).not.toThrow();
    expect(readProduceIntel('tomato')).toBeNull();
    expect(readLatestProduceIntel()).toBeNull();
  });
});

// ───────────────────────────────────────────────────────────────
// ProduceQualityBadge — structural inspection
// ───────────────────────────────────────────────────────────────

describe('ProduceQualityBadge', () => {
  it('renders null when intel is missing', () => {
    expect(ProduceQualityBadge({ intel: null })).toBeNull();
    expect(ProduceQualityBadge({ intel: undefined })).toBeNull();
    expect(ProduceQualityBadge({ intel: 'garbage' })).toBeNull();
  });

  it('renders the quality + readiness label for a market-ready envelope', () => {
    const intel = computeProduceIntelligence({
      crop: 'tomato', scan: { ripenessStage: 'ready' },
    });
    const el = ProduceQualityBadge({ intel });
    const blob = JSON.stringify(el);
    expect(blob).toMatch(/Excellent/);
    expect(blob).toMatch(/Market ready/);
  });

  it('seller variant includes the trend line; buyer variant hides it', () => {
    const intel = {
      qualityState:    QUALITY_STATES.GOOD,
      marketReadiness: MARKET_READINESS.MARKET_READY,
      buyerTrustSignal: 'Looks suitable for local buyers.',
      history:         { trend: 'declining', daysSinceLastScan: 1, note: '' },
    };
    const sellerEl = ProduceQualityBadge({ intel, variant: 'seller' });
    expect(JSON.stringify(sellerEl)).toMatch(/Worse than the previous scan/);
    const buyerEl = ProduceQualityBadge({ intel, variant: 'buyer' });
    expect(JSON.stringify(buyerEl)).not.toMatch(/Worse than the previous scan/);
  });

  it('never leaks raw numeric scores', () => {
    const intel = computeProduceIntelligence({
      crop: 'tomato',
      scan: { ripenessStage: 'ready', confidence: 'high_likelihood', score: 0.94 },
    });
    const blob = JSON.stringify(ProduceQualityBadge({ intel }));
    expect(blob).not.toMatch(/0\.9\d/);
    expect(blob).not.toMatch(/score/);
  });

  it('emits a calm signal phrase for quality_declining', () => {
    const intel = computeProduceIntelligence({
      crop: 'banana', scan: { ripenessStage: 'overripe' },
    });
    const blob = JSON.stringify(ProduceQualityBadge({ intel }));
    expect(blob.toLowerCase()).toContain('freshness');
  });
});

// ───────────────────────────────────────────────────────────────
// HarvestReadyPrompt — scan-trigger path
// ───────────────────────────────────────────────────────────────

describe('HarvestReadyPrompt — scan-aware trigger', () => {
  it('renders null when no stage AND no scan intel signals readiness', () => {
    const el = HarvestReadyPrompt({ profile: { cropStage: 'vegetative' } });
    expect(el).toBeNull();
  });

  it('renders when stage is harvest-ready (legacy trigger)', () => {
    const el = HarvestReadyPrompt({ profile: { cropStage: 'harvest' } });
    expect(el).not.toBeNull();
    const blob = JSON.stringify(el);
    expect(blob).toMatch(/Ready to sell\?|market ready|sell soon/i);
  });

  it('renders scan-driven copy when latest intel says market_ready', () => {
    const intel = computeProduceIntelligence({
      crop: 'tomato', scan: { ripenessStage: 'ready' },
    });
    saveProduceIntel('tomato', intel, { scanId: 'sx' });
    const el = HarvestReadyPrompt({ profile: { cropStage: 'vegetative' } });
    expect(el).not.toBeNull();
    const blob = JSON.stringify(el);
    expect(blob.toLowerCase()).toContain('market ready');
  });

  it('renders scan-driven copy when latest intel says sell_soon', () => {
    const intel = computeProduceIntelligence({
      crop: 'pepper',
      scan: { ripenessStage: 'ready', defects: ['crack', 'bite'] }, // sell_soon
    });
    saveProduceIntel('pepper', intel);
    const el = HarvestReadyPrompt({ profile: { cropStage: 'vegetative' } });
    expect(el).not.toBeNull();
    const blob = JSON.stringify(el);
    expect(blob.toLowerCase()).toContain('sell soon');
  });

  it('does NOT render when scan intel says quality_declining (no harsh prompt)', () => {
    const intel = computeProduceIntelligence({
      crop: 'banana', scan: { ripenessStage: 'overripe' },
    });
    saveProduceIntel('banana', intel);
    const el = HarvestReadyPrompt({ profile: { cropStage: 'vegetative' } });
    expect(el).toBeNull();
  });

  it('never throws on missing profile + missing storage', () => {
    delete globalThis.localStorage;
    expect(() => HarvestReadyPrompt({})).not.toThrow();
    expect(() => HarvestReadyPrompt({ profile: null })).not.toThrow();
  });
});
