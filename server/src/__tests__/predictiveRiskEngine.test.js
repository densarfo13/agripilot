/**
 * predictiveRiskEngine.test.js — pre-symptom risk forecasts.
 */

import { describe, it, expect } from 'vitest';

import {
  runPredictiveRisk, _internal,
} from '../../../src/core/intelligence/predictiveRiskEngine.js';

describe('runPredictiveRisk — envelope shape', () => {
  it('empty input returns the calm fallback', () => {
    const v = runPredictiveRisk({});
    expect(v.engineVersion).toBe('predictive-risk-v1');
    expect(Array.isArray(v.risks)).toBe(true);
    expect(v.risks.length).toBe(0);
    expect(v.anyHigh).toBe(false);
    expect(v.anyMedium).toBe(false);
    expect(typeof v.summary.key).toBe('string');
  });

  it('null / garbage never throws', () => {
    expect(() => runPredictiveRisk(null)).not.toThrow();
    expect(() => runPredictiveRisk('x')).not.toThrow();
    expect(() => runPredictiveRisk(undefined)).not.toThrow();
  });
});

describe('fungal pressure', () => {
  it('fires at humidity 80% + temp 24°C + upcoming rain 70%', () => {
    const c = _internal._makeFungalRisk({
      weather: { humidityPct: 80, temp: 24, rainProbability24hPct: 70 },
    });
    expect(c).toBeTruthy();
    expect(c.kind).toBe('fungal');
    expect(c.severity).toBe('medium');
  });

  it('escalates to high at humidity 88% + ideal temp + wet leaves', () => {
    const c = _internal._makeFungalRisk({
      weather: { humidityPct: 88, temp: 24, recentRainHours: 6 },
    });
    expect(c.severity).toBe('high');
  });

  it('does not fire below 70% humidity', () => {
    const c = _internal._makeFungalRisk({
      weather: { humidityPct: 60, temp: 24, rainProbability24hPct: 80 },
    });
    expect(c).toBeNull();
  });

  it('does not fire without wet leaves', () => {
    const c = _internal._makeFungalRisk({
      weather: { humidityPct: 90, temp: 24 },
    });
    expect(c).toBeNull();
  });
});

describe('water stress', () => {
  it('fires when heat + dry + missed watering all align', () => {
    const c = _internal._makeWaterStressRisk({
      weather: { temp: 31, daysWithoutRain: 6 },
      wateringHistory: { daysSinceLastWatering: 4 },
    });
    expect(c).toBeTruthy();
    expect(c.severity).toBe('high');
  });

  it('fires at medium when only two factors align', () => {
    const c = _internal._makeWaterStressRisk({
      weather: { temp: 30, daysWithoutRain: 5 },
    });
    expect(c).toBeTruthy();
    expect(c.severity).toBe('medium');
  });

  it('does not fire when only one factor is present', () => {
    const c = _internal._makeWaterStressRisk({
      weather: { temp: 30 },
    });
    expect(c).toBeNull();
  });
});

describe('heat stress', () => {
  it('fires high at temp ≥ 38°C', () => {
    const c = _internal._makeHeatStressRisk({ weather: { temp: 39 } });
    expect(c.severity).toBe('high');
  });

  it('fires medium at temp ≥ 34°C', () => {
    const c = _internal._makeHeatStressRisk({ weather: { temp: 35 } });
    expect(c.severity).toBe('medium');
  });

  it('fires medium when heat days are ahead even with mild current temp', () => {
    const c = _internal._makeHeatStressRisk({
      weather: { temp: 28 },
      weatherForecast: { heatDaysAhead: 3 },
    });
    expect(c).toBeTruthy();
    expect(c.severity).toBe('medium');
  });

  it('does not fire when comfortable', () => {
    const c = _internal._makeHeatStressRisk({ weather: { temp: 24 } });
    expect(c).toBeNull();
  });
});

describe('recurrence', () => {
  it('fires when farmMemory has worsening trend', () => {
    const c = _internal._makeRecurrenceRisk({
      farmMemory: { activeFlags: { hasWorseningTrend: true } },
    });
    expect(c).toBeTruthy();
    expect(c.severity).toBe('high');
  });

  it('fires medium on recurring issue alone', () => {
    const c = _internal._makeRecurrenceRisk({
      farmMemory: {
        activeFlags: { hasRecurringIssue: true },
        recurringIssues: [{ category: 'leaf_spots', count: 3 }],
      },
    });
    expect(c.severity).toBe('medium');
  });

  it('does not fire without memory flags', () => {
    const c = _internal._makeRecurrenceRisk({
      farmMemory: { activeFlags: {} },
    });
    expect(c).toBeNull();
  });
});

describe('quality decline', () => {
  it('fires when crop is in fruiting + temperature is hot', () => {
    const c = _internal._makeQualityDeclineRisk({
      cropLifecycle: { currentStage: 'fruiting' },
      weather: { temp: 34 },
    });
    expect(c).toBeTruthy();
    expect(c.severity).toBe('medium');
  });

  it('does not fire at vegetative stage', () => {
    const c = _internal._makeQualityDeclineRisk({
      cropLifecycle: { currentStage: 'vegetative' },
      weather: { temp: 34 },
    });
    expect(c).toBeNull();
  });
});

describe('wind damage', () => {
  it('fires high at wind ≥ 50 km/h on tall-stage crop', () => {
    const c = _internal._makeWindDamageRisk({
      weather: { windSpeedKph: 55 },
      cropLifecycle: { currentStage: 'flowering' },
    });
    expect(c.severity).toBe('high');
  });

  it('fires medium at 35-49 km/h on tall-stage crop', () => {
    const c = _internal._makeWindDamageRisk({
      weather: { windSpeedKph: 40 },
      cropLifecycle: { currentStage: 'fruiting' },
    });
    expect(c.severity).toBe('medium');
  });

  it('does not fire at germination stage even at high wind', () => {
    const c = _internal._makeWindDamageRisk({
      weather: { windSpeedKph: 60 },
      cropLifecycle: { currentStage: 'germination' },
    });
    expect(c).toBeNull();
  });
});

describe('runPredictiveRisk — composition', () => {
  it('sorts highest severity first', () => {
    const v = runPredictiveRisk({
      weather: { humidityPct: 88, temp: 24, recentRainHours: 6, windSpeedKph: 55 },
      cropLifecycle: { currentStage: 'flowering' },
    });
    expect(v.risks.length).toBeGreaterThanOrEqual(2);
    expect(v.risks[0].severity).toBe('high');
  });

  it('summary reflects highest severity', () => {
    const v = runPredictiveRisk({
      weather: { temp: 39 },
    });
    expect(v.anyHigh).toBe(true);
    expect(v.summary.key).toBe('predictiveRisk.summary.high');
  });

  it('calm summary when no risks fire', () => {
    const v = runPredictiveRisk({
      weather: { temp: 22, humidityPct: 40 },
    });
    expect(v.risks.length).toBe(0);
    expect(v.summary.key).toBe('predictiveRisk.summary.calm');
  });
});
