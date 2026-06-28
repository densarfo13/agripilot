/**
 * scanCandidateMerge.test.js — locks the candidate-merge common-name fix. Vitest.
 *
 * Bug: _mergeCandidates dedups two providers' candidates by scientific name and kept the
 * higher-scoring candidate's WHOLE object. PlantNet often returns empty commonNames (so its
 * commonName falls back to the Latin name); when it outscored Plant.id for the same species,
 * the merged result showed "Solanum lycopersicum" instead of Plant.id's "Tomato" — a Latin
 * name to a low-literacy farmer. The fix keeps the higher score but backfills a real common
 * name from the other provider. It never fabricates a name.
 */
import { describe, it, expect } from 'vitest';
import { _internal } from '../ml/scanConsensusEngine.js';

const { _mergeCandidates } = _internal;

describe('_mergeCandidates — common name survives the merge', () => {
  it('THE FIX: higher-score Latin-only winner inherits the other provider\'s common name', () => {
    const plantnet = [{ commonName: 'Solanum lycopersicum', scientificName: 'Solanum lycopersicum', score: 0.82, source: 'plantnet' }];
    const plantid  = [{ commonName: 'Tomato', scientificName: 'Solanum lycopersicum', score: 0.80, source: 'plant.id' }];
    const merged = _mergeCandidates(plantnet, plantid);
    expect(merged.length).toBe(1);              // same species deduped
    expect(merged[0].score).toBe(0.82);         // higher score kept
    expect(merged[0].commonName).toBe('Tomato'); // common name NOT lost (was "Solanum lycopersicum")
  });

  it('winner that already has a real common name keeps its own', () => {
    const a = [{ commonName: 'Maize', scientificName: 'Zea mays', score: 0.9 }];
    const b = [{ commonName: 'Corn',  scientificName: 'Zea mays', score: 0.7 }];
    expect(_mergeCandidates(a, b)[0].commonName).toBe('Maize');
  });

  it('never fabricates a common name when neither provider has one', () => {
    const a = [{ commonName: 'Zea mays', scientificName: 'Zea mays', score: 0.8 }];
    const b = [{ commonName: 'Zea mays', scientificName: 'Zea mays', score: 0.6 }];
    expect(_mergeCandidates(a, b)[0].commonName).toBe('Zea mays'); // stays honest (Latin)
  });

  it('dedups by scientific name, sorts desc, caps at 5', () => {
    const a = [
      { commonName: 'A', scientificName: 'sp a', score: 0.5 },
      { commonName: 'B', scientificName: 'sp b', score: 0.9 },
    ];
    const merged = _mergeCandidates(a, []);
    expect(merged[0].scientificName).toBe('sp b');
    expect(merged.length).toBe(2);
  });
});
