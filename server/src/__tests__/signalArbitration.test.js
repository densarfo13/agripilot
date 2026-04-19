/**
 * signalArbitration.test.js — verifies the conflict resolution
 * contract:
 *   • priority order is respected
 *   • higher priority wins over lower even with less data —
 *     unless its confidence is very low (fallthrough rule)
 *   • agreeing signals reinforce; disagreeing signals are
 *     recorded in overriddenSignals[]
 *   • no signals → no_signals result, never throws
 */

import { describe, it, expect } from 'vitest';
import {
  resolveSignalConflict,
  getDecisionPriority,
  buildArbitrationResult,
  scoreAllContexts,
  scoreSignalWithConfidence,
  PRIORITY_ORDER,
} from '../services/decision/signalArbitration.js';

function sig(signalType, direction, confidenceScore = 0.6, sourceCount = 5) {
  return { signalType, direction, confidenceScore, sourceCount };
}

describe('getDecisionPriority', () => {
  it('harvest_outcome is the top-priority signal', () => {
    expect(getDecisionPriority('harvest_outcome')).toBe(0);
    expect(PRIORITY_ORDER[0]).toBe('harvest_outcome');
  });
  it('unknown types fall to the weak-engagement tier', () => {
    expect(getDecisionPriority('definitely_not_real')).toBe(PRIORITY_ORDER.length);
  });
});

describe('resolveSignalConflict — priority wins', () => {
  it('harvest failure overrides recommendation acceptance', () => {
    const r = resolveSignalConflict([
      sig('recommendation_acceptance', +1, 0.7, 20),
      sig('harvest_outcome', -1, 0.6, 4),
    ]);
    expect(r.winningSignal).toBe('harvest_outcome');
    expect(r.winnerDirection).toBe(-1);
    expect(r.overriddenSignals).toContain('recommendation_acceptance');
    expect(r.decisionReason).toMatch(/harvest_outcome_overrides/);
  });

  it('repeated issue severity overrides task completion pattern', () => {
    const r = resolveSignalConflict([
      sig('task_behavior_pattern', +1, 0.8, 12),
      sig('repeated_issue_severity', -1, 0.6, 4),
    ]);
    expect(r.winningSignal).toBe('repeated_issue_severity');
    expect(r.overriddenSignals).toContain('task_behavior_pattern');
  });

  it('listing_conversion beats weak_engagement', () => {
    const r = resolveSignalConflict([
      sig('weak_engagement', +1, 0.6),
      sig('listing_conversion', -1, 0.5),
    ]);
    expect(r.winningSignal).toBe('listing_conversion');
  });
});

describe('resolveSignalConflict — fallthrough when top is weak', () => {
  it('a top-priority signal below the floor yields to the next tier', () => {
    const r = resolveSignalConflict([
      sig('harvest_outcome', +1, 0.10, 1),               // below HIGH_OVERRIDE_MIN (0.25)
      sig('repeated_issue_severity', -1, 0.7, 6),
    ]);
    expect(r.winningSignal).toBe('repeated_issue_severity');
  });

  it('within a tier, the higher confidence wins', () => {
    const r = resolveSignalConflict([
      sig('harvest_outcome', +1, 0.4, 3),
      sig('harvest_outcome', -1, 0.7, 5),
    ]);
    expect(r.winningSignal).toBe('harvest_outcome');
    expect(r.winnerDirection).toBe(-1);
  });
});

describe('resolveSignalConflict — reinforcement', () => {
  it('agreeing signals are kept in winningSignals[], not overridden', () => {
    const r = resolveSignalConflict([
      sig('harvest_outcome', +1, 0.8, 8),
      sig('task_behavior_pattern', +1, 0.7, 10),
      sig('recommendation_acceptance', -1, 0.6, 4),
    ]);
    expect(r.winningSignal).toBe('harvest_outcome');
    expect(r.winningSignals).toContain('task_behavior_pattern');
    expect(r.overriddenSignals).toContain('recommendation_acceptance');
  });

  it('finalDecisionWeight averages the winning group', () => {
    const r = resolveSignalConflict([
      sig('harvest_outcome', +1, 0.9),
      sig('repeated_issue_severity', +1, 0.5),
    ]);
    expect(r.finalDecisionWeight).toBeCloseTo(0.7, 2);
  });
});

describe('resolveSignalConflict — edge cases', () => {
  it('no signals returns no_signals decisionReason without throwing', () => {
    const r = resolveSignalConflict([], { contextKey: 'gh:maize' });
    expect(r.decisionReason).toBe('no_signals');
    expect(r.winningSignal).toBeNull();
    expect(r.finalDecisionWeight).toBe(0);
  });

  it('single signal decides with no overrides', () => {
    const r = resolveSignalConflict([sig('harvest_outcome', +1, 0.6)]);
    expect(r.overriddenSignals).toEqual([]);
    expect(r.decisionReason).toMatch(/no_conflicts/);
  });

  it('contextKey round-trips into the result', () => {
    const r = resolveSignalConflict([sig('harvest_outcome', +1, 0.6)],
                                    { contextKey: 'gh:maize' });
    expect(r.contextKey).toBe('gh:maize');
  });
});

describe('buildArbitrationResult factory', () => {
  it('produces a stable shape', () => {
    const r = buildArbitrationResult({
      contextKey: 'gh:maize',
      winner: sig('harvest_outcome', +1, 0.8),
      winners: [sig('harvest_outcome', +1, 0.8)],
      overridden: [sig('recommendation_acceptance', -1, 0.5)],
      explanation: 'winner',
      decisionReason: 'harvest_outcome',
      finalDecisionWeight: 0.8,
    });
    expect(r.winningSignal).toBe('harvest_outcome');
    expect(r.overriddenSignals).toEqual(['recommendation_acceptance']);
    expect(r.finalDecisionWeight).toBe(0.8);
  });
});

describe('scoreAllContexts', () => {
  it('returns sorted results across multiple contexts', () => {
    const results = scoreAllContexts({
      'gh:maize':  [sig('harvest_outcome', +1, 0.9)],
      'gh:cassava':[sig('recommendation_acceptance', -1, 0.3)],
    });
    expect(results[0].contextKey).toBe('gh:maize');
    expect(results[0].finalDecisionWeight).toBeGreaterThan(results[1].finalDecisionWeight);
  });
});

describe('scoreSignalWithConfidence convenience', () => {
  it('produces a signal ready for resolveSignalConflict', () => {
    const now = Date.now();
    const s = scoreSignalWithConfidence({
      signalType: 'harvest_outcome',
      samples: [
        { timestamp: now - 1 * 24 * 60 * 60 * 1000, direction: +1, weight: 1 },
        { timestamp: now - 2 * 24 * 60 * 60 * 1000, direction: +1, weight: 1 },
      ],
      direction: +1,
    });
    expect(s.signalType).toBe('harvest_outcome');
    expect(s.confidenceScore).toBeGreaterThan(0);
  });
});
