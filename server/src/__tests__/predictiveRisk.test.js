/**
 * predictiveRisk.test.js — pins the §2 contract:
 *   1. Pure function — never throws on null / garbage.
 *   2. Empty inputs return [].
 *   3. Fungal risk fires on humidity + warm temp + susceptible crop.
 *   4. Drought / heat / flood thresholds each fire as documented.
 *   5. Recent severe scan surfaces as a `recent_issue` risk.
 *   6. Crops not on the susceptible list still get medium fungal
 *      (not high) when weather signals say so.
 */

import { describe, it, expect } from 'vitest';
import {
  computePredictiveRisks,
  RISK_THRESHOLDS,
} from '../../../src/lib/predictiveRisk.js';

const NOW = Date.parse('2026-05-12T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

describe('computePredictiveRisks — contract', () => {
  it('returns [] for empty input', () => {
    expect(computePredictiveRisks({})).toEqual([]);
  });

  it('does not throw on null / garbage input', () => {
    expect(() => computePredictiveRisks(null)).not.toThrow();
    expect(() => computePredictiveRisks({ weather: 'string' })).not.toThrow();
    expect(() => computePredictiveRisks({ scanHistory: 42 })).not.toThrow();
  });

  it('fires HIGH fungal risk for tomatoes when humidity + temp are elevated', () => {
    const r = computePredictiveRisks({
      cropName: 'tomato',
      weather:  { humidity: 82, tempC: 26 },
    });
    const fungal = r.find((x) => x.kind === 'fungal');
    expect(fungal).toBeDefined();
    expect(fungal.level).toBe('high');
    expect(fungal.headline).toMatch(/tomato/i);
    expect(fungal.action).toMatch(/Delay irrigation/i);
  });

  it('fires MEDIUM fungal risk for unknown crops on same weather', () => {
    const r = computePredictiveRisks({
      cropName: 'something_obscure',
      weather:  { humidity: 80, tempC: 24 },
    });
    const fungal = r.find((x) => x.kind === 'fungal');
    expect(fungal).toBeDefined();
    expect(fungal.level).toBe('medium');
  });

  it('does NOT fire fungal risk below the threshold', () => {
    const r = computePredictiveRisks({
      cropName: 'tomato',
      weather:  { humidity: 60, tempC: 22 },
    });
    expect(r.find((x) => x.kind === 'fungal')).toBeUndefined();
  });

  it('fires drought when days without rain >= threshold', () => {
    const r = computePredictiveRisks({
      weather: { daysNoRain: RISK_THRESHOLDS.DROUGHT_DAYS_NO_RAIN },
    });
    const d = r.find((x) => x.kind === 'drought');
    expect(d).toBeDefined();
    expect(d.level).toBe('medium');
  });

  it('escalates drought to HIGH at 14+ days', () => {
    const r = computePredictiveRisks({
      weather: { daysNoRain: 21 },
    });
    expect(r.find((x) => x.kind === 'drought').level).toBe('high');
  });

  it('fires heat stress when maxTemp crosses the threshold', () => {
    const r = computePredictiveRisks({
      weather: { maxTempC: 35, consecutiveHotDays: 2 },
    });
    const h = r.find((x) => x.kind === 'heat');
    expect(h).toBeDefined();
    expect(h.level).toBe('high');
  });

  it('fires flood risk when 24h rainfall crosses the threshold', () => {
    const r = computePredictiveRisks({
      weather: { rainfallNext24h: 60 },
    });
    const f = r.find((x) => x.kind === 'flood');
    expect(f).toBeDefined();
    expect(f.level).toBe('high');
  });

  it('surfaces a recent severe scan as a recent_issue risk', () => {
    const r = computePredictiveRisks({
      nowMs: NOW,
      scanHistory: [
        { id: 'p1', createdAt: new Date(NOW - 2 * DAY).toISOString(), severity: 'high', noticed: 'leaf rust', crop: 'maize' },
      ],
    });
    const ri = r.find((x) => x.kind === 'recent_issue');
    expect(ri).toBeDefined();
    expect(ri.headline).toMatch(/leaf rust/);
    expect(ri.factors.some((f) => f.includes('recent_scan_id:p1'))).toBe(true);
  });

  it('does not flag old severe scans outside the 7-day window', () => {
    const r = computePredictiveRisks({
      nowMs: NOW,
      scanHistory: [
        { id: 'p1', createdAt: new Date(NOW - 30 * DAY).toISOString(), severity: 'high', noticed: 'leaf rust' },
      ],
    });
    expect(r.find((x) => x.kind === 'recent_issue')).toBeUndefined();
  });

  it('exposes frozen thresholds', () => {
    expect(Object.isFrozen(RISK_THRESHOLDS)).toBe(true);
    expect(RISK_THRESHOLDS.FUNGAL_HUMIDITY_MIN).toBeGreaterThan(0);
  });
});
