/**
 * scanOrchestrator.test.js — verifies the Multi-Intent Scan
 * Upgrade contract:
 *   • 7 intents + their canonical labels
 *   • Each intent emits the normalized envelope shape
 *   • Confidence tones map correctly from legacy values
 *   • sanitizeScanText scrubs forbidden phrases
 *   • Missing image / null analyzer output → 'needs_closer_photo'
 *   • Frozen envelope (caller cannot mutate)
 *   • Never throws on malformed input
 */

import { describe, it, expect, vi } from 'vitest';
import {
  SCAN_INTENTS,
  SCAN_INTENT_LABELS,
  runScan,
  normalizeScanResult,
} from '../../../src/features/scan/ScanOrchestrator/index.js';

describe('SCAN_INTENTS catalog', () => {
  it('exposes the 7 spec-mandated intents', () => {
    expect(SCAN_INTENTS.CROP_HEALTH).toBe('crop_health');
    expect(SCAN_INTENTS.FRUIT_RIPENESS).toBe('fruit_ripeness');
    expect(SCAN_INTENTS.PRODUCE_QUALITY).toBe('produce_quality');
    expect(SCAN_INTENTS.INSECT_PEST).toBe('insect_pest');
    expect(SCAN_INTENTS.SOIL_CONDITION).toBe('soil_condition');
    expect(SCAN_INTENTS.PLANT_IDENTIFICATION).toBe('plant_identification');
    expect(SCAN_INTENTS.GROWTH_STAGE).toBe('growth_stage');
  });

  it('labels every intent with title + hint', () => {
    for (const v of Object.values(SCAN_INTENTS)) {
      expect(SCAN_INTENT_LABELS[v]).toBeTruthy();
      expect(SCAN_INTENT_LABELS[v].title).toBeTruthy();
      expect(SCAN_INTENT_LABELS[v].hint).toBeTruthy();
    }
  });
});

describe('normalizeScanResult — envelope shape', () => {
  it('returns the spec-shaped frozen object on empty input', () => {
    const out = normalizeScanResult({});
    expect(out).toHaveProperty('scanType');
    expect(out).toHaveProperty('subjectDetected');
    expect(out).toHaveProperty('confidenceTone');
    expect(out).toHaveProperty('urgency');
    expect(out).toHaveProperty('summary');
    expect(out).toHaveProperty('recommendation');
    expect(out).toHaveProperty('nextCheck');
    expect(out).toHaveProperty('relatedTasks');
    expect(out).toHaveProperty('followUpSuggested');
    expect(out).toHaveProperty('marketImpact');
    expect(out).toHaveProperty('weatherContext');
    expect(Object.isFrozen(out)).toBe(true);
  });

  it('defaults scanType to CROP_HEALTH when missing', () => {
    expect(normalizeScanResult({}).scanType).toBe('crop_health');
  });

  it('maps legacy confidence values to canonical tones', () => {
    expect(normalizeScanResult({ confidenceTone: 'low' }).confidenceTone)
      .toBe('needs_closer_photo');
    expect(normalizeScanResult({ confidenceTone: 'medium' }).confidenceTone)
      .toBe('possible');
    expect(normalizeScanResult({ confidenceTone: 'high' }).confidenceTone)
      .toBe('likely');
    expect(normalizeScanResult({ confidenceTone: 'very_high' }).confidenceTone)
      .toBe('high_likelihood');
  });

  it('clamps unknown urgency to medium', () => {
    expect(normalizeScanResult({ urgency: 'wildly_severe' }).urgency).toBe('medium');
    expect(normalizeScanResult({ urgency: 'high' }).urgency).toBe('high');
    expect(normalizeScanResult({ urgency: 'low' }).urgency).toBe('low');
  });

  it('coerces non-array relatedTasks to empty array', () => {
    expect(normalizeScanResult({ relatedTasks: 'not-an-array' }).relatedTasks).toEqual([]);
    expect(normalizeScanResult({ relatedTasks: null }).relatedTasks).toEqual([]);
  });

  it('caps relatedTasks at 5 entries', () => {
    const out = normalizeScanResult({
      relatedTasks: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'],
    });
    expect(out.relatedTasks.length).toBe(5);
  });
});

describe('runScan — intent routing', () => {
  it('routes CROP_HEALTH and emits an envelope', async () => {
    const fakeAnalyze = vi.fn(async () => ({
      possibleIssue: 'leaf yellowing',
      confidence:    'medium',
      urgency:       'medium',
    }));
    const out = await runScan({
      intent: SCAN_INTENTS.CROP_HEALTH,
      context: { crop: 'tomato' },
      analyzeFn: fakeAnalyze,
    });
    expect(out.scanType).toBe('crop_health');
    expect(out.subjectDetected).toBe('tomato');
    expect(out.summary.toLowerCase()).toContain('tomato');
    expect(fakeAnalyze).toHaveBeenCalledOnce();
  });

  it('FRUIT_RIPENESS uses ripeness-stage wording', async () => {
    const fakeAnalyze = vi.fn(async () => ({
      ripenessStage: 'ready',
      confidence:    'likely',
    }));
    const out = await runScan({
      intent: SCAN_INTENTS.FRUIT_RIPENESS,
      context: { crop: 'tomato' },
      analyzeFn: fakeAnalyze,
    });
    expect(out.scanType).toBe('fruit_ripeness');
    expect(out.summary.toLowerCase()).toContain('harvest readiness');
    expect(out.urgency).toBe('low');
  });

  it('FRUIT_RIPENESS overripe → urgency high + harvest today copy', async () => {
    const fakeAnalyze = vi.fn(async () => ({
      ripenessStage: 'overripe',
      confidence:    'likely',
    }));
    const out = await runScan({
      intent: SCAN_INTENTS.FRUIT_RIPENESS,
      context: { crop: 'banana' },
      analyzeFn: fakeAnalyze,
    });
    expect(out.urgency).toBe('high');
    expect(out.nextCheck.toLowerCase()).toContain('today');
  });

  it('PRODUCE_QUALITY rot → high urgency + reject from market', async () => {
    const fakeAnalyze = vi.fn(async () => ({
      qualityFlag: 'rot',
      confidence:  'likely',
    }));
    const out = await runScan({
      intent: SCAN_INTENTS.PRODUCE_QUALITY,
      context: { crop: 'mango' },
      analyzeFn: fakeAnalyze,
    });
    expect(out.urgency).toBe('high');
    expect(out.marketImpact.toLowerCase()).toContain('not suitable');
  });

  it('INSECT_PEST emits cautious wording on high confidence', async () => {
    const fakeAnalyze = vi.fn(async () => ({
      pestType:   'aphid',
      confidence: 'high',
    }));
    const out = await runScan({
      intent: SCAN_INTENTS.INSECT_PEST,
      context: { crop: 'pepper' },
      analyzeFn: fakeAnalyze,
    });
    expect(out.scanType).toBe('insect_pest');
    expect(out.subjectDetected).toBe('aphid');
    expect(out.summary.toLowerCase()).toContain('aphid');
    expect(out.followUpSuggested).toBe(true);
  });

  it('INSECT_PEST low confidence → needs closer inspection wording', async () => {
    const fakeAnalyze = vi.fn(async () => ({
      pestType:   'unidentified',
      confidence: 'low',  // → needs_closer_photo
    }));
    const out = await runScan({
      intent: SCAN_INTENTS.INSECT_PEST,
      context: { crop: 'pepper' },
      analyzeFn: fakeAnalyze,
    });
    expect(out.summary.toLowerCase()).toContain('closer');
  });

  it('SOIL_CONDITION dry → water guidance', async () => {
    const fakeAnalyze = vi.fn(async () => ({
      soilCondition: 'dry cracked',
      confidence:    'likely',
    }));
    const out = await runScan({
      intent:    SCAN_INTENTS.SOIL_CONDITION,
      context:   { crop: 'maize', weather: { condition: 'sunny' } },
      analyzeFn: fakeAnalyze,
    });
    expect(out.summary.toLowerCase()).toMatch(/dry|water/);
    expect(out.weatherContext).toContain('sunny');
  });

  it('SOIL_CONDITION flood → high urgency', async () => {
    const fakeAnalyze = vi.fn(async () => ({
      soilCondition: 'standing water flood',
    }));
    const out = await runScan({
      intent: SCAN_INTENTS.SOIL_CONDITION,
      context: {},
      analyzeFn: fakeAnalyze,
    });
    expect(out.urgency).toBe('high');
    expect(out.followUpSuggested).toBe(true);
  });

  it('PLANT_IDENTIFICATION emits a likely-guess', async () => {
    const fakeAnalyze = vi.fn(async () => ({
      likelyPlant: 'tomato',
      confidence:  'likely',
    }));
    const out = await runScan({
      intent: SCAN_INTENTS.PLANT_IDENTIFICATION,
      context: {},
      analyzeFn: fakeAnalyze,
    });
    expect(out.subjectDetected).toBe('tomato');
    expect(out.summary.toLowerCase()).toContain('tomato');
  });

  it('GROWTH_STAGE maps each stage word to copy', async () => {
    const stages = [
      ['seedling',   'seedling'],
      ['vegetative', 'vegetative growth'],
      ['flowering',  'flowering'],
      ['fruiting',   'fruiting'],
      ['harvest',    'harvest stage'],
    ];
    for (const [input, expected] of stages) {
      const out = await runScan({
        intent: SCAN_INTENTS.GROWTH_STAGE,
        context: { crop: 'maize' },
        analyzeFn: vi.fn(async () => ({ growthStage: input, confidence: 'likely' })),
      });
      expect(out.summary.toLowerCase()).toContain(expected);
    }
  });
});

describe('runScan — safety guards', () => {
  it('uses crop_health as default when intent is unknown', async () => {
    const out = await runScan({
      intent: 'not_a_real_intent',
      analyzeFn: vi.fn(async () => ({ possibleIssue: 'test', confidence: 'medium' })),
    });
    expect(out.scanType).toBe('crop_health');
  });

  it('emits needs_closer_photo when analyzer returns null', async () => {
    const out = await runScan({
      intent: SCAN_INTENTS.CROP_HEALTH,
      analyzeFn: vi.fn(async () => null),
    });
    expect(out.confidenceTone).toBe('needs_closer_photo');
    expect(out.summary.toLowerCase()).toContain('closer photo');
  });

  it('emits needs_closer_photo when analyzeFn throws', async () => {
    const out = await runScan({
      intent: SCAN_INTENTS.CROP_HEALTH,
      analyzeFn: vi.fn(async () => { throw new Error('network'); }),
    });
    expect(out.confidenceTone).toBe('needs_closer_photo');
  });

  it('never throws on malformed input', async () => {
    await expect(runScan(null)).resolves.toBeTruthy();
    await expect(runScan(undefined)).resolves.toBeTruthy();
    await expect(runScan({})).resolves.toBeTruthy();
    await expect(runScan({ intent: 42 })).resolves.toBeTruthy();
  });

  it('sanitizeScanText scrubs the word "confirmed" via the policy layer', async () => {
    // The orchestrator's _softenIssueWord lowercases + drops
    // "confirmed". The summary template inlines the softened
    // word.
    const out = await runScan({
      intent: SCAN_INTENTS.CROP_HEALTH,
      context: { crop: 'tomato' },
      analyzeFn: vi.fn(async () => ({
        possibleIssue: 'confirmed leaf blight',
        confidence:    'high',
      })),
    });
    expect(out.summary.toLowerCase()).not.toContain('confirmed');
  });
});
