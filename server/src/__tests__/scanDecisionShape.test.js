/**
 * scanDecisionShape.test.js — pins the May 2026 Scan Decision
 * Intelligence contract.
 *
 * The normalizer must produce a tight 12-field action-oriented
 * envelope from the safe verdict + caller context, with safe
 * neutral values whenever the input is missing. Every scan flow
 * (success, low-confidence, fallback, total-failure) must surface
 * a non-null actionToday so the UI never renders information-only.
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeToDecisionShape,
  SPEC_FALLBACK_DECISION,
} from '../ml/scanResultNormalizer.js';

const REQUIRED_FIELDS = [
  'cropDetected', 'issueDetected', 'confidenceTone', 'severityTone',
  'whatItMeans', 'actionToday', 'nextCheck', 'weatherCaution',
  'regionContext', 'taskSuggestion', 'saveableSummary', 'providerStatus',
];

describe('normalizeToDecisionShape — shape contract', () => {
  it('always returns the 12 spec fields, even on empty input', () => {
    const d = normalizeToDecisionShape();
    for (const k of REQUIRED_FIELDS) {
      expect(d).toHaveProperty(k);
    }
    expect(Object.keys(d).length).toBe(REQUIRED_FIELDS.length);
  });

  it('never throws on garbage input', () => {
    expect(() => normalizeToDecisionShape(null)).not.toThrow();
    expect(() => normalizeToDecisionShape(undefined, null)).not.toThrow();
    expect(() => normalizeToDecisionShape('not-an-object')).not.toThrow();
    expect(() => normalizeToDecisionShape({ foo: 'bar' }, { weather: 'oops' })).not.toThrow();
  });

  it('every string field is non-empty on a fresh empty-input call', () => {
    const d = normalizeToDecisionShape();
    // The four load-bearing strings the action card always renders.
    expect(typeof d.issueDetected).toBe('string');
    expect(d.issueDetected.length).toBeGreaterThan(0);
    expect(typeof d.whatItMeans).toBe('string');
    expect(d.whatItMeans.length).toBeGreaterThan(0);
    expect(typeof d.actionToday).toBe('string');
    expect(d.actionToday.length).toBeGreaterThan(0);
    expect(typeof d.saveableSummary).toBe('string');
    expect(d.saveableSummary.length).toBeGreaterThan(0);
  });
});

describe('normalizeToDecisionShape — derivations', () => {
  it('confidenceTone maps from safe.confidence', () => {
    expect(normalizeToDecisionShape({ confidence: 'high' }).confidenceTone).toBe('high');
    expect(normalizeToDecisionShape({ confidence: 'medium' }).confidenceTone).toBe('medium');
    expect(normalizeToDecisionShape({ confidence: 'low' }).confidenceTone).toBe('low');
    expect(normalizeToDecisionShape({ confidence: 'garbage' }).confidenceTone).toBe('low');
    expect(normalizeToDecisionShape({}).confidenceTone).toBe('low');
  });

  it('severityTone maps urgency → calm label', () => {
    expect(normalizeToDecisionShape({ urgency: 'Today' }).severityTone).toBe('Needs attention');
    expect(normalizeToDecisionShape({ urgency: 'This week' }).severityTone).toBe('Watch');
    expect(normalizeToDecisionShape({ urgency: 'Monitor' }).severityTone).toBe('Looks stable');
    expect(normalizeToDecisionShape({}).severityTone).toBe('Watch');
  });

  it('cropDetected prefers caller selectedCropOrPlant over verdict fields', () => {
    const d = normalizeToDecisionShape(
      { cropName: 'tomato' },
      { selectedCropOrPlant: 'pepper' },
    );
    expect(d.cropDetected).toBe('pepper');
  });

  it('actionToday prefers tierPolicy.recommendedActions[0]', () => {
    const d = normalizeToDecisionShape(
      { recommendedActions: ['ignored from safe'] },
      { tierPolicy: { recommendedActions: ['Check leaves at sunset.'] } },
    );
    expect(d.actionToday).toBe('Check leaves at sunset.');
  });

  it('actionToday falls back when nothing is available', () => {
    const d = normalizeToDecisionShape({}, {});
    // Must be non-empty even with no signal — UI never renders blank.
    expect(d.actionToday.length).toBeGreaterThan(0);
    expect(d.actionToday).toMatch(/scan again|clearer photo|local expert/i);
  });

  it('weatherCaution surfaces on high rain probability', () => {
    const d = normalizeToDecisionShape({}, { weather: { rainProbability: 0.8 } });
    expect(d.weatherCaution).toBeTruthy();
    expect(d.weatherCaution).toMatch(/rain/i);
  });

  it('weatherCaution surfaces on hot afternoon', () => {
    const d = normalizeToDecisionShape({}, { weather: { tempC: 34 } });
    expect(d.weatherCaution).toBeTruthy();
    expect(d.weatherCaution).toMatch(/warm|cooler hours|soil moisture/i);
  });

  it('weatherCaution is null when weather is calm', () => {
    const d = normalizeToDecisionShape({}, { weather: { tempC: 22, rainProbability: 0.1 } });
    expect(d.weatherCaution).toBeNull();
  });

  it('regionContext mentions land-health stress when present', () => {
    const d = normalizeToDecisionShape({}, {
      region: 'Frederick',
      landHealth: { stressLevel: 'high' },
    });
    expect(d.regionContext).toMatch(/stress|Frederick/);
  });

  it('regionContext mentions drought signal explicitly', () => {
    const d = normalizeToDecisionShape({}, {
      country: 'KE',
      landHealth: { droughtSignal: true },
    });
    expect(d.regionContext).toMatch(/[Dd]rought/);
  });

  it('regionContext is null when no region + no stress', () => {
    const d = normalizeToDecisionShape({}, {});
    expect(d.regionContext).toBeNull();
  });

  it('providerStatus marks fallback when forceLowConfidence is true', () => {
    const d = normalizeToDecisionShape({}, { forceLowConfidence: true });
    expect(d.providerStatus).toBe('fallback');
  });

  it("providerStatus marks 'live' for a real provider", () => {
    const d = normalizeToDecisionShape({}, { providerName: 'plantnet' });
    expect(d.providerStatus).toBe('live');
  });

  it("providerStatus marks 'fallback' when providerName is 'rule'", () => {
    const d = normalizeToDecisionShape({}, { providerName: 'rule' });
    expect(d.providerStatus).toBe('fallback');
  });

  it('taskSuggestion mirrors followUpTask when present', () => {
    const d = normalizeToDecisionShape({
      followUpTask: { title: 'Check the lower leaves tomorrow', urgency: 'medium' },
    });
    expect(d.taskSuggestion).toEqual({
      title: 'Check the lower leaves tomorrow',
      urgency: 'medium',
    });
  });

  it('saveableSummary composes crop · issue → action', () => {
    const d = normalizeToDecisionShape(
      { possibleIssue: 'Possible water stress' },
      {
        selectedCropOrPlant: 'tomato',
        tierPolicy: { recommendedActions: ['Water before noon.'] },
      },
    );
    expect(d.saveableSummary).toContain('tomato');
    expect(d.saveableSummary).toContain('Possible water stress');
    expect(d.saveableSummary).toContain('Water before noon.');
  });

  it('nextCheck prefers verificationQuestions[0]', () => {
    const d = normalizeToDecisionShape({}, {
      verificationQuestions: [
        { question: 'Are the spots only on lower leaves?' },
        { question: 'Has the area been rainy?' },
      ],
    });
    expect(d.nextCheck).toBe('Are the spots only on lower leaves?');
  });

  it('nextCheck falls back to followUpTask.title', () => {
    const d = normalizeToDecisionShape({
      followUpTask: { title: 'Rescan in 48h.', urgency: 'low' },
    });
    expect(d.nextCheck).toBe('Rescan in 48h.');
  });

  it('nextCheck is null when both sources empty', () => {
    expect(normalizeToDecisionShape({}, {}).nextCheck).toBeNull();
  });
});

describe('SPEC_FALLBACK_DECISION — error-path constant', () => {
  it('matches the 12-field shape', () => {
    for (const k of REQUIRED_FIELDS) {
      expect(SPEC_FALLBACK_DECISION).toHaveProperty(k);
    }
  });

  it('has a non-empty actionToday (UI never renders information-only)', () => {
    expect(typeof SPEC_FALLBACK_DECISION.actionToday).toBe('string');
    expect(SPEC_FALLBACK_DECISION.actionToday.length).toBeGreaterThan(0);
  });

  it('is frozen — error paths cannot mutate the shared constant', () => {
    expect(Object.isFrozen(SPEC_FALLBACK_DECISION)).toBe(true);
  });

  it('confidenceTone === "low" — never claims certainty on failure', () => {
    expect(SPEC_FALLBACK_DECISION.confidenceTone).toBe('low');
  });

  it('providerStatus === "unknown" — honest about the failure', () => {
    expect(SPEC_FALLBACK_DECISION.providerStatus).toBe('unknown');
  });
});
