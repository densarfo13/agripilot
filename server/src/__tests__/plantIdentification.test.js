import { describe, it, expect } from 'vitest';

/**
 * Plant Identification v1.1 — normalizer contract tests.
 *
 * Covers the full envelope the route's verdictV3 ships:
 *   { plantIdentification: { detectedName, commonName, confidence, alternatives },
 *     healthAnalysis:      { status, issueType, confidence, explanation, action, timing } }
 *
 * Strict contract guarantees verified:
 *   • Pure + sync; never throws on partial input.
 *   • Confidence enum stays in { low, medium, high }.
 *   • Alternatives capped at 3.
 *   • forceLowConfidence clamps identification confidence to 'low'.
 *   • selectedCropOrPlant is honoured when inference doesn't identify.
 *   • Unknown / null inputs produce the documented fallback shape.
 *   • SPEC_FALLBACK_FULL is shape-stable for the route's error path.
 */

import {
  normalizeToFullSpecShape,
  SPEC_FALLBACK_VERDICT,
  SPEC_FALLBACK_FULL,
  _internal,
} from '../ml/scanResultNormalizer.js';

describe('normalizeToFullSpecShape — plantIdentification', () => {
  it('returns the full envelope shape', () => {
    const r = normalizeToFullSpecShape({});
    expect(r).toHaveProperty('plantIdentification');
    expect(r).toHaveProperty('healthAnalysis');
    const p = r.plantIdentification;
    expect(p).toHaveProperty('detectedName');
    expect(p).toHaveProperty('commonName');
    expect(p).toHaveProperty('confidence');
    expect(p).toHaveProperty('alternatives');
  });

  it('uses inference detectedPlant when supplied', () => {
    const r = normalizeToFullSpecShape({
      detectedPlant: 'Tomato',
      identificationConfidence: 'high',
      alternatives: ['Pepper', 'Eggplant'],
    });
    expect(r.plantIdentification.detectedName).toBe('Tomato');
    expect(r.plantIdentification.commonName).toBe('Tomato');
    expect(r.plantIdentification.confidence).toBe('high');
    expect(r.plantIdentification.alternatives).toEqual(['Pepper', 'Eggplant']);
  });

  it('falls back to selectedCropOrPlant when inference omits detection', () => {
    const r = normalizeToFullSpecShape(
      { /* no detectedPlant */ },
      { selectedCropOrPlant: 'Pepper' },
    );
    expect(r.plantIdentification.detectedName).toBe('Pepper');
    expect(r.plantIdentification.commonName).toBe('Pepper');
    // Spec rule 2 — caller-supplied identification clamps to medium.
    expect(r.plantIdentification.confidence).toBe('medium');
  });

  it('returns null shape when neither inference nor caller has a name', () => {
    const r = normalizeToFullSpecShape({});
    expect(r.plantIdentification.detectedName).toBeNull();
    expect(r.plantIdentification.commonName).toBeNull();
    expect(r.plantIdentification.confidence).toBe('low');
    expect(r.plantIdentification.alternatives).toEqual([]);
  });

  it('caps alternatives at 3', () => {
    const r = normalizeToFullSpecShape({
      detectedPlant: 'Tomato',
      alternatives: ['Pepper', 'Eggplant', 'Squash', 'Zucchini', 'Cucumber'],
    });
    expect(r.plantIdentification.alternatives.length).toBe(3);
  });

  it('skips empty / non-string alternatives', () => {
    const r = normalizeToFullSpecShape({
      detectedPlant: 'Tomato',
      alternatives: ['Pepper', '', null, undefined, 'Eggplant', 42],
    });
    expect(r.plantIdentification.alternatives).toEqual(['Pepper', 'Eggplant']);
  });

  it('forceLowConfidence clamps identification to low even on a confident inference', () => {
    const r = normalizeToFullSpecShape(
      { detectedPlant: 'Tomato', identificationConfidence: 'high' },
      { forceLowConfidence: true },
    );
    expect(r.plantIdentification.confidence).toBe('low');
  });

  it('reads top-level safe.confidence as the identification confidence when identificationConfidence is absent', () => {
    const r = normalizeToFullSpecShape({
      detectedPlant: 'Maize',
      confidence: 'medium',  // top-level health-style confidence
    });
    expect(r.plantIdentification.confidence).toBe('medium');
  });

  it('passes invalid confidence values through to default (medium when name present)', () => {
    const r = normalizeToFullSpecShape({
      detectedPlant: 'Tomato',
      identificationConfidence: 'extremely_high',  // not in enum
    });
    expect(r.plantIdentification.confidence).toBe('medium');
  });

  it('uses safe.plantName as a synonym for detectedPlant', () => {
    const r = normalizeToFullSpecShape({ plantName: 'Cassava' });
    expect(r.plantIdentification.detectedName).toBe('Cassava');
  });

  it('does not throw on null / undefined / non-object input', () => {
    expect(() => normalizeToFullSpecShape(null)).not.toThrow();
    expect(() => normalizeToFullSpecShape(undefined)).not.toThrow();
    expect(() => normalizeToFullSpecShape('garbage')).not.toThrow();
    expect(() => normalizeToFullSpecShape(42)).not.toThrow();
  });
});

describe('normalizeToFullSpecShape — healthAnalysis re-exposed', () => {
  it('healthAnalysis stays in lock-step with the legacy 6-field shape', () => {
    const r = normalizeToFullSpecShape({
      possibleIssue: 'Aphid damage',
      confidence: 'medium',
      recommendedActions: ['Wipe leaves with soapy water'],
    });
    const h = r.healthAnalysis;
    expect(h).toHaveProperty('status');
    expect(h).toHaveProperty('issueType');
    expect(h).toHaveProperty('confidence');
    expect(h).toHaveProperty('explanation');
    expect(h).toHaveProperty('action');
    expect(h).toHaveProperty('timing');
    expect(h.issueType).toBe('pest');
  });

  it('forceLowConfidence on the envelope cascades to healthAnalysis', () => {
    const r = normalizeToFullSpecShape(
      { possibleIssue: 'Aphid damage', confidence: 'high' },
      { forceLowConfidence: true },
    );
    expect(r.healthAnalysis.confidence).toBe('low');
  });
});

describe('SPEC_FALLBACK_FULL', () => {
  it('exports a frozen, shape-stable fallback', () => {
    expect(SPEC_FALLBACK_FULL).toHaveProperty('plantIdentification');
    expect(SPEC_FALLBACK_FULL).toHaveProperty('healthAnalysis');
    expect(SPEC_FALLBACK_FULL.plantIdentification.detectedName).toBeNull();
    expect(SPEC_FALLBACK_FULL.plantIdentification.confidence).toBe('low');
    expect(SPEC_FALLBACK_FULL.healthAnalysis).toBe(SPEC_FALLBACK_VERDICT);
  });

  it('is frozen — accidental mutation does not silently land', () => {
    expect(Object.isFrozen(SPEC_FALLBACK_FULL)).toBe(true);
    expect(Object.isFrozen(SPEC_FALLBACK_FULL.plantIdentification)).toBe(true);
  });
});

describe('safe-language rule (spec §3 — never claim certainty)', () => {
  // The normalizer doesn't render strings; it emits enum
  // values. Confidence-based wording lives at the FRONTEND
  // render layer (PlantIdentificationCard). What we verify
  // here is that the normalizer NEVER promotes a low-signal
  // input to a 'high' confidence value — that would let the
  // frontend display "Likely X" when it should say "This may
  // be X".

  it('inference with no detection returns confidence=low', () => {
    const r = normalizeToFullSpecShape({});
    expect(r.plantIdentification.confidence).toBe('low');
  });

  it('inference fallback path forces low', () => {
    const r = normalizeToFullSpecShape(
      { detectedPlant: 'Tomato', identificationConfidence: 'high' },
      { forceLowConfidence: true },
    );
    expect(r.plantIdentification.confidence).toBe('low');
  });

  it('caller-supplied selectedCropOrPlant is medium, never high', () => {
    const r = normalizeToFullSpecShape(
      {},
      { selectedCropOrPlant: 'Pepper' },
    );
    expect(r.plantIdentification.confidence).not.toBe('high');
  });
});

describe('internals exposed for advanced testing', () => {
  it('_buildPlantIdentification is exported via _internal', () => {
    expect(typeof _internal._buildPlantIdentification).toBe('function');
  });

  it('_buildPlantIdentification returns the empty shape on null input', () => {
    const p = _internal._buildPlantIdentification(null);
    expect(p.detectedName).toBeNull();
    expect(p.confidence).toBe('low');
  });
});
