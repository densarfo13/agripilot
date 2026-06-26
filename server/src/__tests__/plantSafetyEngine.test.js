/**
 * plantSafetyEngine.test.js — unit + integration coverage for the server-side
 * Plant Safety Engine. Vitest. Proves: confident known plants classify into the
 * structured taxonomy with real evidence; low-confidence / unlisted plants return
 * UNKNOWN and never fabricate; the disclaimer is always present; the response is only
 * augmented when the feature flag is on (backward compatible).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  classifyPlantSafety, attachSafety, plantSafetyEngineHealth,
  SAFETY_CATEGORY, SAFETY_SEVERITY, SAFETY_DISCLAIMER,
} from '../ml/safety/plantSafetyEngine.js';
import { SAFETY_REFERENCE } from '../ml/safety/plantSafetyReference.js';
import { isFeatureEnabled } from '../config/features.js';

const CATEGORIES = Object.values(SAFETY_CATEGORY);
const SEVERITIES = Object.values(SAFETY_SEVERITY);

describe('classifyPlantSafety — confident known plants', () => {
  it('cassava → PROCESS_BEFORE_EATING / WARNING (cyanogenic, needs processing)', () => {
    const s = classifyPlantSafety('cassava', 'high');
    expect(s.category).toBe('PROCESS_BEFORE_EATING');
    expect(s.severity).toBe('WARNING');
    expect(s.confident).toBe(true);
    expect(/raw/i.test(s.recommendedAction)).toBe(true);
  });

  it('groundnut → ALLERGEN_RISK', () => {
    expect(classifyPlantSafety('peanut', 'high').category).toBe('ALLERGEN_RISK');
  });

  it('maize → EDIBLE / INFO with no warnings (toxicity: none known)', () => {
    const s = classifyPlantSafety('maize', 'high');
    expect(s.category).toBe('EDIBLE');
    expect(s.severity).toBe('INFO');
    expect(s.warnings.length).toBe(0);
  });

  it('tomato → EDIBLE but CAUTION with a "parts not edible" warning (solanine leaves)', () => {
    const s = classifyPlantSafety('tomato', 'high');
    expect(s.category).toBe('EDIBLE');
    expect(s.severity).toBe('CAUTION');
    expect(s.warnings.some((w) => /parts_not_edible/.test(w.key))).toBe(true);
  });

  it('onion / cocoa → carry a toxic-to-animals warning', () => {
    expect(classifyPlantSafety('onion', 'high').warnings.some((w) => /toxic_to_animals/.test(w.key))).toBe(true);
    expect(classifyPlantSafety('cocoa', 'high').warnings.some((w) => /toxic_to_animals/.test(w.key))).toBe(true);
  });
});

describe('classifyPlantSafety — structured evidence', () => {
  it('a confident match carries scientific name, reference id, confidence, source, lastReviewed, certainty', () => {
    const s = classifyPlantSafety('cassava', 95);
    expect(s.evidence.scientificName).toBe('Manihot esculenta');
    expect(s.evidence.referenceId).toBe('cassava');
    expect(s.evidence.confidence).toBe(95);
    expect(s.evidence.source).toBe('curated_plant_reference');
    expect(typeof s.evidence.lastReviewed).toBe('string');
    expect(s.evidence.certainty).toBe('HIGH');
  });
  it('certainty is MEDIUM at moderate confidence', () => {
    expect(classifyPlantSafety('cassava', 75).evidence.certainty).toBe('MEDIUM');
  });
});

describe('classifyPlantSafety — honesty (never fabricate)', () => {
  it('low confidence → UNKNOWN, certainty NONE, not confident', () => {
    const s = classifyPlantSafety('cassava', 'low');
    expect(s.category).toBe('UNKNOWN');
    expect(s.confident).toBe(false);
    expect(s.evidence.certainty).toBe('NONE');
  });
  it('low % confidence → UNKNOWN', () => {
    expect(classifyPlantSafety('cassava', 40).category).toBe('UNKNOWN');
  });
  it('unlisted plant → UNKNOWN with null evidence (no fabricated reference)', () => {
    const s = classifyPlantSafety('made-up-plant-xyz', 'high');
    expect(s.category).toBe('UNKNOWN');
    expect(s.evidence.scientificName).toBeNull();
    expect(s.evidence.referenceId).toBeNull();
    expect(s.warnings.length).toBe(0);
  });
  it('empty / null name → UNKNOWN, never throws', () => {
    expect(classifyPlantSafety('', 'high').category).toBe('UNKNOWN');
    expect(classifyPlantSafety(null, 'high').category).toBe('UNKNOWN');
    expect(classifyPlantSafety(undefined, undefined).category).toBe('UNKNOWN');
  });
});

describe('classifyPlantSafety — contract invariants (every result)', () => {
  const names = [...SAFETY_REFERENCE.map((r) => r.id), 'made-up-xyz', ''];
  for (const name of names) {
    it(`"${name || '(empty)'}" yields a valid, fully-keyed, disclaimer-bearing envelope`, () => {
      const s = classifyPlantSafety(name, 'high');
      expect(CATEGORIES).toContain(s.category);
      expect(SEVERITIES).toContain(s.severity);
      // Translation keys present (language-neutral business logic).
      expect(s.categoryKey).toBe('scan.safety.category.' + s.category);
      expect(s.severityKey).toBe('scan.safety.severity.' + s.severity);
      expect(s.recommendedActionKey).toBe('scan.safety.action.' + s.category);
      expect(s.disclaimerKey).toBe('scan.safety.disclaimer');
      // Disclaimer ALWAYS present with the exact required text.
      expect(s.disclaimer).toBe(SAFETY_DISCLAIMER);
      // Warnings only ever derive from real reference text → each has a key + text.
      for (const w of s.warnings) { expect(typeof w.key).toBe('string'); expect(typeof w.text).toBe('string'); }
    });
  }
  it('the disclaimer is the exact required wording', () => {
    expect(SAFETY_DISCLAIMER).toContain('Safety guidance is based only on verified plant matches');
    expect(SAFETY_DISCLAIMER).toContain('do not consume the plant');
  });
});

describe('attachSafety — Scan API integration seam (feature-flag gated)', () => {
  let orig;
  beforeEach(() => { orig = process.env.FARROWAY_FEATURE_PLANTSAFETYENGINE; });
  afterEach(() => {
    if (orig === undefined) delete process.env.FARROWAY_FEATURE_PLANTSAFETYENGINE;
    else process.env.FARROWAY_FEATURE_PLANTSAFETYENGINE = orig;
  });

  it('flag OFF (default) → response is untouched (backward compatible)', () => {
    delete process.env.FARROWAY_FEATURE_PLANTSAFETYENGINE;
    expect(isFeatureEnabled('plantSafetyEngine')).toBe(false);
    const res = { ok: true, plantName: 'cassava' };
    attachSafety(res, 'cassava', 'high', isFeatureEnabled('plantSafetyEngine'));
    expect(res.safety).toBeUndefined();
  });

  it('flag ON → response gains a well-formed safety envelope', () => {
    process.env.FARROWAY_FEATURE_PLANTSAFETYENGINE = '1';
    expect(isFeatureEnabled('plantSafetyEngine')).toBe(true);
    const res = { ok: true, plantName: 'cassava' };
    attachSafety(res, 'cassava', 'high', isFeatureEnabled('plantSafetyEngine'));
    expect(res.safety).toBeDefined();
    expect(res.safety.category).toBe('PROCESS_BEFORE_EATING');
    expect(res.safety.evidence.referenceId).toBe('cassava');
    expect(res.safety.disclaimer).toBe(SAFETY_DISCLAIMER);
  });

  it('attachSafety never throws on a bad response object', () => {
    expect(() => attachSafety(null, 'cassava', 'high', true)).not.toThrow();
    expect(() => attachSafety(undefined, 'cassava', 'high', true)).not.toThrow();
  });
});

describe('plantSafetyEngineHealth', () => {
  it('attests classification + honesty invariants', () => {
    const h = plantSafetyEngineHealth();
    expect(h.confidentMatchClassifies).toBe(true);
    expect(h.unknownNeverFabricates).toBe(true);
    expect(h.lowConfidenceUnknown).toBe(true);
    expect(h.disclaimerAlwaysPresent).toBe(true);
    expect(h.referenceCount).toBeGreaterThan(0);
  });
});
