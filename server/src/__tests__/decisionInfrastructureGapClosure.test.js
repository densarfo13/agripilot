/**
 * decisionInfrastructureGapClosure.test.js — verifies the
 * spec-named alias at src/core/decision/ re-exports the existing
 * daily-decision implementation, and that the surface contract
 * the spec requires is intact.
 */

import { describe, it, expect } from 'vitest';
import {
  computeDailyDecision as fromDecision,
  EXPERIENCE_LEVEL,
  CONFIDENCE_TONE,
} from '../../../src/core/decision/dailyDecisionAssistant.js';
import {
  computeDailyDecision as fromLifecycle,
} from '../../../src/core/lifecycle/dailyDecisionAssistant.js';

describe('src/core/decision alias — single implementation', () => {
  it('the alias and the lifecycle path expose the SAME function', () => {
    expect(fromDecision).toBe(fromLifecycle);
  });

  it('exposes EXPERIENCE_LEVEL + CONFIDENCE_TONE through the alias', () => {
    expect(EXPERIENCE_LEVEL.NEW).toBe('new');
    expect(EXPERIENCE_LEVEL.EXPERIENCED).toBe('experienced');
    expect(['gentle','firm','urgent']).toContain(CONFIDENCE_TONE.GENTLE);
  });

  it('returns the documented contract — primary action with reason + tone', () => {
    const d = fromDecision({
      crop: 'tomato',
      weather: { temperatureC: 24 },
      experienceLevel: 'new',
    });
    expect(d.bestAction).toBeTruthy();
    expect(d.reason).toBeTruthy();
    expect(['low','normal','high']).toContain(d.urgency);
    expect(['gentle','firm','urgent']).toContain(d.confidenceTone);
  });
});
