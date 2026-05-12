/**
 * farmTimeline.test.js — pins the §4 + §5 aggregator contract:
 *   1. Timeline merges scans + tasks + extras in chronological
 *      (newest-first) order.
 *   2. Empty inputs return empty arrays — never throws.
 *   3. Field memory summarises top diseases by frequency.
 *   4. Crop performance includes the recovery trend for each crop.
 *   5. Seasonal pattern only fires when a month has 2+ hits.
 */

import { describe, it, expect } from 'vitest';
import { buildFarmTimeline, buildFieldMemory } from '../../../src/lib/farmTimeline.js';

const NOW = Date.parse('2026-05-12T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

describe('buildFarmTimeline — contract', () => {
  it('returns [] on empty input', () => {
    expect(buildFarmTimeline({})).toEqual([]);
  });

  it('does not throw on null', () => {
    expect(() => buildFarmTimeline(null)).not.toThrow();
  });

  it('merges scans + tasks + extras newest first', () => {
    const r = buildFarmTimeline({
      scanHistory: [
        { id: 's1', createdAt: new Date(NOW - 3 * DAY).toISOString(), noticed: 'leaf rust', severity: 'medium' },
      ],
      scanTasks: [
        { id: 't1', createdAt: new Date(NOW - 1 * DAY).toISOString(), title: 'spray copper' },
      ],
      extra: [
        { at: new Date(NOW - 2 * DAY).toISOString(), kind: 'rainfall', label: 'Heavy rain (35mm)' },
      ],
    });
    expect(r).toHaveLength(3);
    expect(r[0].kind).toBe('task_created');
    expect(r[1].kind).toBe('rainfall');
    expect(r[2].kind).toBe('scan');
  });

  it('emits a task_completed event when the task is marked done', () => {
    const r = buildFarmTimeline({
      scanTasks: [
        {
          id: 't1',
          createdAt:   new Date(NOW - 2 * DAY).toISOString(),
          completed:   true,
          completedAt: new Date(NOW - 1 * DAY).toISOString(),
          title: 'spray copper',
        },
      ],
    });
    expect(r).toHaveLength(2);
    expect(r[0].kind).toBe('task_completed');
    expect(r[1].kind).toBe('task_created');
  });
});

describe('buildFieldMemory — contract', () => {
  it('returns a stable empty shape on no input', () => {
    const r = buildFieldMemory({});
    expect(r.pastDiseases).toEqual([]);
    expect(r.treatmentWins).toEqual([]);
    expect(r.seasonalPattern.dryMonths).toEqual([]);
    expect(r.seasonalPattern.wetMonths).toEqual([]);
    expect(r.cropPerformance).toEqual([]);
  });

  it('does not throw on garbage input', () => {
    expect(() => buildFieldMemory(null)).not.toThrow();
    expect(() => buildFieldMemory({ scanHistory: 'not-array' })).not.toThrow();
  });

  it('counts past diseases and reports the most frequent first', () => {
    const r = buildFieldMemory({
      scanHistory: [
        { noticed: 'leaf rust', createdAt: new Date(NOW - 30 * DAY).toISOString() },
        { noticed: 'leaf rust', createdAt: new Date(NOW - 20 * DAY).toISOString() },
        { noticed: 'leaf rust', createdAt: new Date(NOW - 10 * DAY).toISOString() },
        { noticed: 'pest damage', createdAt: new Date(NOW - 5 * DAY).toISOString() },
      ],
    });
    expect(r.pastDiseases[0].name).toBe('leaf rust');
    expect(r.pastDiseases[0].count).toBe(3);
    expect(r.pastDiseases[1].name).toBe('pest damage');
    expect(r.pastDiseases[1].count).toBe(1);
  });

  it('counts treatment wins (completed scan-tasks)', () => {
    const r = buildFieldMemory({
      scanTasks: [
        { actionType: 'spray', completed: true,  completedAt: new Date(NOW - 5 * DAY).toISOString() },
        { actionType: 'spray', completed: true,  completedAt: new Date(NOW - 2 * DAY).toISOString() },
        { actionType: 'inspect', completed: false },
      ],
    });
    expect(r.treatmentWins[0].category).toBe('spray');
    expect(r.treatmentWins[0].count).toBe(2);
  });

  it('only fires seasonal pattern when month has 2+ hits', () => {
    const r = buildFieldMemory({
      scanHistory: [
        { weatherCaution: 'dry spell', createdAt: '2026-01-15T12:00:00Z' },
        // only 1 in January → does not qualify
        { weatherCaution: 'humidity high', createdAt: '2026-05-01T12:00:00Z' },
        { weatherCaution: 'rain expected', createdAt: '2026-05-20T12:00:00Z' },
        // 2 in May → wetMonth fires
      ],
    });
    expect(r.seasonalPattern.dryMonths).not.toContain(0);   // January single hit
    expect(r.seasonalPattern.wetMonths).toContain(4);       // May has 2 hits
  });

  it('computes per-crop performance with trend direction', () => {
    const r = buildFieldMemory({
      scanHistory: [
        { crop: 'maize', severity: 'low',  createdAt: new Date(NOW - 1 * DAY).toISOString() },
        { crop: 'maize', severity: 'high', createdAt: new Date(NOW - 7 * DAY).toISOString() },
      ],
    });
    const maize = r.cropPerformance.find((c) => c.crop === 'maize');
    expect(maize).toBeDefined();
    expect(maize.scans).toBe(2);
    expect(maize.trend).toBe('improving');
  });
});
