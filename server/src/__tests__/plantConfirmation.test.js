import { describe, it, expect } from 'vitest';
import {
  taxonIdFor, normalizeCandidates, buildProvisionalContract,
  findConfirmableCandidate, deriveScanHealth, recommendationLevel, PROVISIONAL_ACTIONS,
} from '../ml/scanDecision/plantConfirmation.js';

describe('plantConfirmation — provisional contract + candidate validation (P0/P2)', () => {
  const raw = [
    { commonName: 'Tomato', scientificName: 'Solanum lycopersicum', score: 0.58 },
    { commonName: 'Potato', scientificName: 'Solanum tuberosum', score: 0.31 },
    { commonName: 'Eggplant', scientificName: 'Solanum melongena', score: 0.06 },
    { commonName: 'Pepper', scientificName: 'Capsicum annuum', score: 0.03 },
  ];

  it('normalizeCandidates caps at 3, derives a stable taxonId, keeps real confidence', () => {
    const c = normalizeCandidates(raw, 3);
    expect(c.length).toBe(3);
    expect(c[0].taxonId).toBe(taxonIdFor('Solanum lycopersicum'));
    expect(c[0].commonName).toBe('Tomato');
    expect(c[0].providerConfidence).toBe(0.58);
  });

  it('drops candidates with no usable name; never fabricates', () => {
    const c = normalizeCandidates([{ score: 0.9 }, { commonName: '', scientificName: '' }, ...raw], 3);
    expect(c.every((x) => x.commonName || x.scientificName)).toBe(true);
  });

  it('buildProvisionalContract returns the P0 block for PROVISIONAL and LOW_IDENTIFICATION_CONFIDENCE', () => {
    const p = buildProvisionalContract('PROVISIONAL', raw);
    expect(p.requiresConfirmation).toBe(true);
    expect(p.candidates.length).toBe(3);
    expect(p.allowedActions).toEqual(PROVISIONAL_ACTIONS);
    // Scan Intelligence §2 — a valid photo with sub-provisional candidates
    // surfaces the SAME ranked-candidates contract (no threshold change).
    // CRITICAL literal: the server resolver emits 'LOW_CONFIDENCE' (the client
    // renames it LOW_IDENTIFICATION_CONFIDENCE). v1 of this test asserted only
    // the client spelling, so the real runtime path silently returned null and
    // the device showed the dead-end — field screenshot 2026-07-16.
    const low = buildProvisionalContract('LOW_CONFIDENCE', raw);   // ← the REAL server literal
    expect(low.requiresConfirmation).toBe(true);
    expect(low.candidates.length).toBe(3);
    const lowAlias = buildProvisionalContract('LOW_IDENTIFICATION_CONFIDENCE', raw);
    expect(lowAlias.requiresConfirmation).toBe(true);              // rename-safe
    expect(buildProvisionalContract('CONFIRMED', raw)).toBeNull();
    expect(buildProvisionalContract('NOT_A_PLANT', raw)).toBeNull();
    expect(buildProvisionalContract('PROVISIONAL', [])).toBeNull();
    expect(buildProvisionalContract('LOW_CONFIDENCE', [])).toBeNull(); // never invents
  });

  it('findConfirmableCandidate matches a stored taxonId and REJECTS arbitrary ones', () => {
    const stored = normalizeCandidates(raw, 3);
    expect(findConfirmableCandidate(stored, stored[0].taxonId).commonName).toBe('Tomato');
    expect(findConfirmableCandidate(stored, 'taxon:zea_mays')).toBeNull();  // not in the result
    expect(findConfirmableCandidate(stored, '')).toBeNull();
    expect(findConfirmableCandidate(null, 'taxon:solanum_lycopersicum')).toBeNull();
  });
});

describe('plantConfirmation — gated health (P4) + safe recommendation levels (P6)', () => {
  it('ISSUE_POSSIBLE when a disease clears the evidence floor', () => {
    const h = deriveScanHealth({
      diseaseCandidates: [{ name: 'Early blight', score: 0.62 }, { name: 'Leaf spot', score: 0.2 }],
      healthStatus: 'attention_needed',
    });
    expect(h.state).toBe('ISSUE_POSSIBLE');
    expect(h.conditions[0].category).toBe('disease');
    expect(h.conditions[0].treatmentGrade).toBe(false); // 0.62 < 0.70 default
  });

  it('HEALTHY when healthStatus healthy and no disease evidence', () => {
    expect(deriveScanHealth({ diseaseCandidates: [], healthStatus: 'healthy' }).state).toBe('HEALTHY');
  });

  it('HEALTH_UNCERTAIN when there is no clear signal', () => {
    expect(deriveScanHealth({ diseaseCandidates: [{ name: 'x', score: 0.1 }], healthStatus: 'unclear' }).state)
      .toBe('HEALTH_UNCERTAIN');
  });

  it('PROVIDER_ERROR is preserved — NEVER remapped to HEALTH_UNCERTAIN (P4)', () => {
    const h = deriveScanHealth({ diseaseCandidates: [{ name: 'Rust', score: 0.9 }], providerError: true });
    expect(h.state).toBe('PROVIDER_ERROR');
    expect(h.conditions.length).toBe(0);
  });

  it('recommendationLevel: 1 unconfirmed · 1 uncertain · 2 confirmed non-treatment · 3 confirmed treatment-grade', () => {
    expect(recommendationLevel({ confirmed: false, healthState: 'ISSUE_POSSIBLE' })).toBe(1);
    expect(recommendationLevel({ confirmed: true, healthState: 'HEALTH_UNCERTAIN' })).toBe(1);
    expect(recommendationLevel({ confirmed: true, healthState: 'PROVIDER_ERROR' })).toBe(1);
    expect(recommendationLevel({ confirmed: true, healthState: 'ISSUE_POSSIBLE',
      conditions: [{ treatmentGrade: false }] })).toBe(2);
    expect(recommendationLevel({ confirmed: true, healthState: 'ISSUE_POSSIBLE',
      conditions: [{ treatmentGrade: true }] })).toBe(3);
  });

  it('treatment (LEVEL 3) is blocked below the treatment threshold', () => {
    const h = deriveScanHealth({ diseaseCandidates: [{ name: 'Blight', score: 0.55 }], healthStatus: 'attention_needed' });
    // 0.55 < 0.70 → not treatment-grade → confirmed lands at LEVEL 2, never 3.
    expect(recommendationLevel({ confirmed: true, healthState: h.state, conditions: h.conditions })).toBe(2);
  });
});
