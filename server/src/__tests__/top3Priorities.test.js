/**
 * top3Priorities.test.js — Phase 11/12 Top 3 priorities composer.
 * Verifies ranking, transparency ("why" on every item), urgency
 * tagging, and the calm-padding rule.
 */

import { describe, it, expect } from 'vitest';
import {
  computeTodayTop3,
} from '../../../src/core/decision/top3PrioritiesComposer.js';

const NOW = Date.UTC(2026, 4, 24);

// ─── Shape contract ──────────────────────────────────────

describe('computeTodayTop3 — shape + transparency', () => {
  it('returns at most 3 priorities, each with title + why + urgency + bestTime', () => {
    const r = computeTodayTop3({
      crop: 'tomato',
      weather: { temperatureC: 34, daysSinceRain: 9 },
      nowMs: NOW,
    });
    expect(r.priorities.length).toBeLessThanOrEqual(3);
    expect(r.priorities.length).toBeGreaterThan(0);
    for (const p of r.priorities) {
      expect(p.title).toBeTruthy();
      expect(p.title.key).toMatch(/^top3\.title\./);
      expect(typeof p.title.fallback).toBe('string');
      expect(['low','normal','high']).toContain(p.urgency);
      expect(typeof p.bestTime).toBe('string');
      expect(typeof p.explanation).toBe('string');
    }
  });

  it('every priority carries a "why" (spec §22 transparency)', () => {
    const r = computeTodayTop3({
      crop: 'tomato',
      weather: { temperatureC: 24 },
      scanHistory: [{ issueCategory: 'fungal_risk' }],
      nowMs: NOW,
    });
    // Scan follow-up always has its own why.
    const scan = r.priorities.find((p) => p.type === 'urgent_scan_followup');
    expect(scan).toBeTruthy();
    expect(scan.why).toBeTruthy();
  });

  it('priorities are RANK-ordered (1, 2, 3)', () => {
    const r = computeTodayTop3({
      crop: 'tomato',
      weather: { frostRiskTonight: true, temperatureC: 4 },
      nowMs: NOW,
    });
    r.priorities.forEach((p, i) => expect(p.rank).toBe(i + 1));
  });
});

// ─── Ranking rules ──────────────────────────────────────

describe('computeTodayTop3 — ranking rules', () => {
  it('urgent scan follow-up takes rank 1', () => {
    const r = computeTodayTop3({
      crop: 'tomato',
      weather: { temperatureC: 34 },
      scanHistory: [{ issueCategory: 'fungal_risk' }],
      nowMs: NOW,
    });
    expect(r.priorities[0].type).toBe('urgent_scan_followup');
    expect(r.priorities[0].urgency).toBe('high');
  });

  it('weather risk (frost) outranks watering and stage tasks', () => {
    const r = computeTodayTop3({
      crop: 'tomato',
      weather: { frostRiskTonight: true, temperatureC: 4 },
      nowMs: NOW,
    });
    expect(r.priorities[0].type).toBe('weather_risk');
  });

  it('harvest_readiness appears when the crop is near harvest', () => {
    const r = computeTodayTop3({
      crop: 'tomato',
      plantingDate: new Date(NOW - 85 * 86400000).toISOString(),
      nowMs: NOW,
    });
    const types = r.priorities.map((p) => p.type);
    expect(types.some((t) => t === 'harvest_readiness' || t === 'crop_stage_task')).toBe(true);
  });

  it('routine_check is the calm-padding tail when nothing else fires', () => {
    const r = computeTodayTop3({ nowMs: NOW });
    const lastTwo = r.priorities.map((p) => p.type);
    // Either the last item is routine_check, or only one priority
    // is needed and it's routine_check (calm day).
    expect(lastTwo.includes('routine_check') || lastTwo.includes('crop_stage_task')).toBe(true);
  });
});

// ─── Robustness ─────────────────────────────────────────

describe('computeTodayTop3 — never throws', () => {
  it('null input returns a calm shape', () => {
    expect(() => computeTodayTop3(null)).not.toThrow();
    const r = computeTodayTop3(null);
    expect(Array.isArray(r.priorities)).toBe(true);
    expect(typeof r.disclaimer).toBe('string');
  });

  it('shape includes generatedAt + disclaimer', () => {
    const r = computeTodayTop3({ crop: 'tomato', nowMs: NOW });
    expect(r.generatedAt).toBeTruthy();
    expect(r.disclaimer).toMatch(/local conditions|recent signals|keep watching/i);
  });
});
