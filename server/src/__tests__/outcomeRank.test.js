/**
 * outcomeRank.test.js — locks the recommendation-ranking fix. Vitest.
 *
 * Bug: the ranking comparator used `(b.successRate || -1) - (a.successRate || -1)`. A
 * proven 0% success rate (real data, enough samples) became `0 || -1 = -1`, tying it with
 * an UNKNOWN (null) rate — so "this approach never worked" was indistinguishable from "we
 * have no data". _rankBySuccess uses ?? so a known 0 ranks ABOVE an unknown.
 */
import { describe, it, expect } from 'vitest';
import { _internal } from '../ml/outcomeIntelligenceEngine.js';

const { _rankBySuccess } = _internal;
// comparator(a, b) < 0 ⇒ a sorts before b (a ranks higher).

describe('_rankBySuccess', () => {
  it('THE FIX: a proven 0% rate ranks ABOVE an unknown (null)', () => {
    expect(_rankBySuccess({ successRate: 0 }, { successRate: null }) < 0).toBe(true);
    expect(_rankBySuccess({ successRate: null }, { successRate: 0 }) > 0).toBe(true);
  });

  it('does not tie 0 with null (the old || bug)', () => {
    expect(_rankBySuccess({ successRate: 0 }, { successRate: null })).not.toBe(0);
  });

  it('higher success rate ranks first (descending)', () => {
    expect(_rankBySuccess({ successRate: 50 }, { successRate: 0 }) < 0).toBe(true);
    expect(_rankBySuccess({ successRate: 80 }, { successRate: 50 }) < 0).toBe(true);
  });

  it('full sort orders [null, 0, 50] → [50, 0, null]', () => {
    const rows = [{ successRate: null }, { successRate: 0 }, { successRate: 50 }];
    const sorted = rows.slice().sort(_rankBySuccess).map((r) => r.successRate);
    expect(sorted).toEqual([50, 0, null]);
  });

  it('two unknowns are equal', () => {
    expect(_rankBySuccess({ successRate: null }, { successRate: null })).toBe(0);
  });
});
