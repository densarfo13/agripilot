import { describe, it, expect } from 'vitest';
import { buildScanRecoveryEnvelope } from '../ml/scanRecoveryEnvelope.js';

// ROOT-CAUSE REGRESSION (2026-07): the headline scan confidence was derived
// from the consensus `confidencePct`, which is band-quantized (low→25) AND, in
// the single-provider path, computed from the DISEASE probability — so a
// validly-identified plant reported ~25% and was mapped to the low-confidence
// "clearer photo" card. The envelope must instead use the REAL top
// identification candidate probability.
describe('scanRecoveryEnvelope — real identification confidence (root-cause fix)', () => {
  it('uses the top identification score (82%), NOT the band-quantized 25%', () => {
    const consensus = {
      ok: true,
      consensusMode: 'single',
      identification: { commonName: 'Tomato', scientificName: 'Solanum lycopersicum', score: 0.82 },
      candidates: [{ commonName: 'Tomato', scientificName: 'Solanum lycopersicum', score: 0.82, source: 'plantid' }],
      confidence: 'low',        // ← the corrupted band
      confidencePct: 25,        // ← what the old code trusted
      disease: null,
      sources: [],
    };
    const env = buildScanRecoveryEnvelope({ consensus });
    expect(env.confidence).toBe(82);
    expect(env.confidenceBand).toBe('high');
    expect(env.plantName).toBe('Tomato');
  });

  it('falls back to the top CANDIDATE score when identification is absent', () => {
    const consensus = {
      ok: true,
      consensusMode: 'single',
      identification: null,
      candidates: [{ commonName: 'Maize', scientificName: 'Zea mays', score: 0.62, source: 'plantid' }],
      confidence: 'low',
      confidencePct: 25,
      sources: [],
    };
    const env = buildScanRecoveryEnvelope({ consensus });
    expect(env.confidence).toBe(62);   // real candidate probability, not 25
  });

  it('a genuinely weak identification (0.30) still reads low — the fix is honest, not inflating', () => {
    const consensus = {
      ok: true,
      consensusMode: 'single',
      identification: { commonName: 'Maize', scientificName: 'Zea mays', score: 0.30 },
      candidates: [{ commonName: 'Maize', scientificName: 'Zea mays', score: 0.30, source: 'plantid' }],
      confidence: 'low',
      confidencePct: 25,
      sources: [],
    };
    const env = buildScanRecoveryEnvelope({ consensus });
    expect(env.confidence).toBe(30);
    expect(env.confidenceBand).toBe('low');
  });

  it('with NO candidates and no scores, falls back to the safe-verdict band (never fabricates a score)', () => {
    const env = buildScanRecoveryEnvelope({
      consensus: { ok: false, consensusMode: 'rule', identification: null, candidates: [], sources: [] },
      safe: { confidence: 'medium' },
    });
    expect(env.confidence).toBe(55);   // band fallback, unchanged behaviour
    expect(Array.isArray(env.topCandidates)).toBe(true);
    expect(env.topCandidates.length).toBe(0);
  });
});
