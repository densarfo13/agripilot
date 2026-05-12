/**
 * multiFarmIntelligence.test.js — pins the §11 contract.
 *
 *   1. Single-farm users get visibleToUser:false (no clutter).
 *   2. Ranking model puts the highest-urgency farm first.
 *   3. Summary respects calm language ("needs attention" / "looks
 *      stable") and never quotes a score.
 *   4. Tied scores preserve input order (stable sort).
 *   5. Never throws on null / garbage / missing snapshots.
 */

import { describe, it, expect } from 'vitest';
import { computeMultiFarmIntelligence } from '../../../src/intelligence/invisible/multiFarmIntelligence.js';

const NOW = Date.parse('2026-05-12T12:00:00Z');
const HOUR = 60 * 60 * 1000;

function _snap(over = {}) {
  return {
    scanHistory: [],
    scanTasks:   [],
    weather:     null,
    healthScore: { score: 75, band: 'good', factors: [] },
    pattern:     null,
    risks:       [],
    topAction:   null,
    nextBestAction: {
      kind: 'encouragement', title: 'Walk the field', reason: '...',
      urgency: 'low', confidence: 'low', dedupeKey: 'nba_fallback_walk',
    },
    ...over,
  };
}

describe('computeMultiFarmIntelligence — visibility', () => {
  it('hides for single-farm users', () => {
    const r = computeMultiFarmIntelligence({ farms: [{ farmId: 'a', snapshot: _snap() }] });
    expect(r.visibleToUser).toBe(false);
    expect(r.summary).toBe('');
    expect(r.farms).toEqual([]);
  });

  it('hides for zero-farm input', () => {
    expect(computeMultiFarmIntelligence({ farms: [] }).visibleToUser).toBe(false);
    expect(computeMultiFarmIntelligence({}).visibleToUser).toBe(false);
  });

  it('never throws on null / garbage', () => {
    expect(() => computeMultiFarmIntelligence(null)).not.toThrow();
    expect(() => computeMultiFarmIntelligence({ farms: 'not-an-array' })).not.toThrow();
  });

  it('shows for 2+ farms when at least one has signal', () => {
    const r = computeMultiFarmIntelligence({
      nowMs: NOW,
      farms: [
        { farmId: 'a', name: 'North', snapshot: _snap({
          nextBestAction: { kind: 'crop_health', urgency: 'high', title: 'Fungal' },
          healthScore: { score: 30, band: 'urgent' },
        })},
        { farmId: 'b', name: 'South', snapshot: _snap() },
      ],
    });
    expect(r.visibleToUser).toBe(true);
  });
});

describe('computeMultiFarmIntelligence — ranking', () => {
  it('puts high-urgency NBA farm first', () => {
    const r = computeMultiFarmIntelligence({
      nowMs: NOW,
      farms: [
        { farmId: 'low',  name: 'Low',  snapshot: _snap() },
        { farmId: 'high', name: 'High', snapshot: _snap({
          nextBestAction: { kind: 'crop_health', urgency: 'high', title: 'Fungal' },
        })},
      ],
    });
    expect(r.farms[0].farmId).toBe('high');
    expect(r.mostUrgentFarmId).toBe('high');
  });

  it('health-urgent band lifts a farm above one with stable NBA', () => {
    const r = computeMultiFarmIntelligence({
      nowMs: NOW,
      farms: [
        { farmId: 'stable',    name: 'Stable',    snapshot: _snap() },
        { farmId: 'unhealthy', name: 'Unhealthy', snapshot: _snap({
          healthScore: { score: 25, band: 'urgent' },
        })},
      ],
    });
    expect(r.farms[0].farmId).toBe('unhealthy');
  });

  it('high-level risks contribute to ranking', () => {
    const r = computeMultiFarmIntelligence({
      nowMs: NOW,
      farms: [
        { farmId: 'clean', name: 'Clean', snapshot: _snap() },
        { farmId: 'risky', name: 'Risky', snapshot: _snap({
          risks: [
            { kind: 'fungal',  level: 'high' },
            { kind: 'drought', level: 'high' },
          ],
        })},
      ],
    });
    expect(r.farms[0].farmId).toBe('risky');
  });

  it('overdue tasks contribute to ranking', () => {
    const r = computeMultiFarmIntelligence({
      nowMs: NOW,
      farms: [
        { farmId: 'caught_up', name: 'Caught Up', snapshot: _snap() },
        { farmId: 'busy', name: 'Busy', snapshot: _snap({
          scanTasks: [
            { urgency: 'high', completed: false, dueAt: new Date(NOW - 3 * HOUR).toISOString() },
            { urgency: 'high', completed: false, dueAt: new Date(NOW - 6 * HOUR).toISOString() },
            { urgency: 'medium', completed: false, dueAt: new Date(NOW - HOUR).toISOString() },
          ],
        })},
      ],
    });
    expect(r.farms[0].farmId).toBe('busy');
  });

  it('tied farms preserve input order (stable sort)', () => {
    const r = computeMultiFarmIntelligence({
      nowMs: NOW,
      farms: [
        { farmId: 'first',  name: 'First',  snapshot: _snap() },
        { farmId: 'second', name: 'Second', snapshot: _snap() },
        { farmId: 'third',  name: 'Third',  snapshot: _snap() },
      ],
    });
    expect(r.farms.map((f) => f.farmId)).toEqual(['first', 'second', 'third']);
  });
});

describe('computeMultiFarmIntelligence — summary language', () => {
  it('emits "needs attention" + "looks stable" framing for clear winner', () => {
    const r = computeMultiFarmIntelligence({
      nowMs: NOW,
      farms: [
        { farmId: 'a', name: 'North Field', snapshot: _snap({
          nextBestAction: { kind: 'crop_health', urgency: 'high', title: 'Fungal pressure' },
          healthScore: { score: 25, band: 'urgent' },
          risks: [{ kind: 'fungal', level: 'high' }],
        })},
        { farmId: 'b', name: 'South Field', snapshot: _snap() },
      ],
    });
    expect(r.summary.toLowerCase()).toContain('needs attention');
    expect(r.summary.toLowerCase()).toContain('looks stable');
    expect(r.summary).toContain('North Field');
    expect(r.summary).toContain('South Field');
  });

  it('emits "all stable" when everyone is calm', () => {
    const r = computeMultiFarmIntelligence({
      nowMs: NOW,
      farms: [
        { farmId: 'a', snapshot: _snap() },
        { farmId: 'b', snapshot: _snap() },
      ],
    });
    expect(r.summary.toLowerCase()).toContain('all your farms');
  });

  it('NEVER quotes the priorityScore in summary or per-farm entries', () => {
    const r = computeMultiFarmIntelligence({
      nowMs: NOW,
      farms: [
        { farmId: 'a', name: 'A', snapshot: _snap({
          healthScore: { score: 30, band: 'urgent' },
          risks: [{ kind: 'fungal', level: 'high' }],
        })},
        { farmId: 'b', name: 'B', snapshot: _snap() },
      ],
    });
    expect(r.summary).not.toMatch(/\d+/);                 // no numeric scores
    expect(r.farms[0].statusLabel).not.toMatch(/\d/);
  });
});

describe('computeMultiFarmIntelligence — fallback safety', () => {
  it('drops entries without a farmId', () => {
    const r = computeMultiFarmIntelligence({
      nowMs: NOW,
      farms: [
        { name: 'no id', snapshot: _snap() },
        { farmId: 'b', snapshot: _snap() },
      ],
    });
    // Only one valid entry → falls below the 2-farm visibility threshold.
    expect(r.visibleToUser).toBe(false);
  });

  it('tolerates entries with no snapshot', () => {
    const r = computeMultiFarmIntelligence({
      nowMs: NOW,
      farms: [
        { farmId: 'a', name: 'A' },
        { farmId: 'b', name: 'B', snapshot: _snap() },
      ],
    });
    expect(r.farms).toHaveLength(2);
  });

  it('uses fallback "Farm <id>" name when name is missing', () => {
    const r = computeMultiFarmIntelligence({
      nowMs: NOW,
      farms: [
        { farmId: 'plot7', snapshot: _snap({
          healthScore: { score: 25, band: 'urgent' },
        })},
        { farmId: 'plot8', snapshot: _snap() },
      ],
    });
    expect(r.summary).toContain('Farm plot7');
  });
});
