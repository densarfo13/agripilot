import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  resolveIdentificationState,
  getIdentificationThresholds,
} from '../ml/scanDecision/resolveIdentificationState.js';

const ENV_KEYS = [
  'SCAN_IDENTIFICATION_CONFIRMED_THRESHOLD',
  'SCAN_IDENTIFICATION_PROVISIONAL_THRESHOLD',
  'SCAN_IDENTIFICATION_MARGIN_THRESHOLD',
  'SCAN_IS_PLANT_THRESHOLD',
];
function clearEnv() { ENV_KEYS.forEach((k) => { delete process.env[k]; }); }

describe('resolveIdentificationState — env-tunable confidence bands + margin', () => {
  beforeEach(clearEnv);
  afterEach(clearEnv);

  const cand = (score) => ({ commonName: 'Tomato', scientificName: 'Solanum lycopersicum', score });

  it('CONFIRMED — top ≥ confirmed, clear margin, is_plant ok', () => {
    const r = resolveIdentificationState({
      isPlantProbability: 0.95,
      candidates: [cand(0.82), cand(0.40)],
      providerStatus: 'ok',
    });
    expect(r.identificationState).toBe('CONFIRMED');
    expect(r.reasonCode).toBe('confirmed');
    expect(r.margin).toBeCloseTo(0.42, 5);
  });

  it('PROVISIONAL — top in [provisional, confirmed)', () => {
    const r = resolveIdentificationState({
      isPlantProbability: 0.9,
      candidates: [cand(0.55), cand(0.30)],
      providerStatus: 'ok',
    });
    expect(r.identificationState).toBe('PROVISIONAL');
    expect(r.reasonCode).toBe('provisional');
  });

  it('ambiguous close candidates — high confidence but margin too small → PROVISIONAL (not auto-confirmed)', () => {
    const r = resolveIdentificationState({
      isPlantProbability: 0.9,
      candidates: [cand(0.85), cand(0.82)],   // margin 0.03 < 0.10
      providerStatus: 'ok',
    });
    expect(r.identificationState).toBe('PROVISIONAL');
    expect(r.reasonCode).toBe('confirmed_but_margin_too_close');
  });

  it('below provisional → LOW_CONFIDENCE', () => {
    const r = resolveIdentificationState({
      isPlantProbability: 0.9,
      candidates: [cand(0.30), cand(0.10)],
      providerStatus: 'ok',
    });
    expect(r.identificationState).toBe('LOW_CONFIDENCE');
    expect(r.reasonCode).toBe('below_provisional');
  });

  it('NOT_A_PLANT — explicit is_plant below threshold (candidates ignored)', () => {
    const r = resolveIdentificationState({
      isPlantProbability: 0.2,
      candidates: [cand(0.85)],
      providerStatus: 'ok',
    });
    expect(r.identificationState).toBe('NOT_A_PLANT');
  });

  it('unknown is_plant (null) is never asserted as NOT_A_PLANT', () => {
    const r = resolveIdentificationState({
      isPlantProbability: null,
      candidates: [cand(0.82), cand(0.30)],
      providerStatus: 'ok',
    });
    expect(r.identificationState).toBe('CONFIRMED');
  });

  it('PROVIDER_ERROR — failed status + no candidates', () => {
    const r = resolveIdentificationState({ candidates: [], providerStatus: 'timeout' });
    expect(r.identificationState).toBe('PROVIDER_ERROR');
  });

  it('no candidates on an ok call → LOW_CONFIDENCE(no_candidates)', () => {
    const r = resolveIdentificationState({ isPlantProbability: 0.9, candidates: [], providerStatus: 'ok' });
    expect(r.identificationState).toBe('LOW_CONFIDENCE');
    expect(r.reasonCode).toBe('no_candidates');
  });

  it('single candidate with no competitor still confirms when strong', () => {
    const r = resolveIdentificationState({ isPlantProbability: 0.9, candidates: [cand(0.9)], providerStatus: 'ok' });
    expect(r.identificationState).toBe('CONFIRMED');
  });
});

describe('getIdentificationThresholds — safe defaults + validation', () => {
  beforeEach(clearEnv);
  afterEach(clearEnv);

  it('defaults when env is unset', () => {
    expect(getIdentificationThresholds()).toEqual({ confirmed: 0.70, provisional: 0.40, margin: 0.10, isPlant: 0.50 });
  });

  it('invalid values fall back to safe defaults', () => {
    process.env.SCAN_IDENTIFICATION_CONFIRMED_THRESHOLD = 'abc';
    process.env.SCAN_IDENTIFICATION_PROVISIONAL_THRESHOLD = '1.5';    // out of range
    process.env.SCAN_IS_PLANT_THRESHOLD = '-0.2';                     // out of range
    const th = getIdentificationThresholds();
    expect(th.confirmed).toBe(0.70);
    expect(th.provisional).toBe(0.40);
    expect(th.isPlant).toBe(0.50);
  });

  it('valid overrides are applied and change the decision', () => {
    process.env.SCAN_IDENTIFICATION_CONFIRMED_THRESHOLD = '0.50';
    const r = resolveIdentificationState({
      isPlantProbability: 0.9,
      candidates: [{ score: 0.55 }, { score: 0.20 }],
      providerStatus: 'ok',
    });
    expect(r.thresholds.confirmed).toBe(0.50);
    expect(r.identificationState).toBe('CONFIRMED');   // 0.55 ≥ 0.50, margin 0.35 ≥ 0.10
  });

  it('margin threshold may be disabled with 0 (confidence thresholds may not)', () => {
    process.env.SCAN_IDENTIFICATION_MARGIN_THRESHOLD = '0';
    process.env.SCAN_IDENTIFICATION_CONFIRMED_THRESHOLD = '0';        // zero not allowed → default
    const th = getIdentificationThresholds();
    expect(th.margin).toBe(0);
    expect(th.confirmed).toBe(0.70);
  });
});
