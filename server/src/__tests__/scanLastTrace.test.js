/**
 * scanLastTrace.test.js — the admin last-scan trace recorder. Vitest.
 * Proves it captures the trace fields AND that, by construction, it can never store
 * secrets or image bytes (redaction by whitelist).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { recordScanTrace, getLastScanTrace, clearLastScanTrace } from '../ml/scanLastTrace.js';

describe('scanLastTrace', () => {
  beforeEach(() => clearLastScanTrace());

  it('captures the whitelisted trace fields', () => {
    recordScanTrace({
      scanId: 's1', imageMime: 'image/jpeg', imageBytes: 12345,
      imageDims: { width: 800, height: 600 }, qualityScore: 0.82,
      providers: [{ name: 'plant.id', status: 'READY', latencyMs: 1200, httpStatus: 200 }],
      rawCandidateCount: 5, normalizedCandidateCount: 3,
      topScientificName: 'Zea mays', topCommonName: 'Maize', topConfidence: 88,
      cropHealthStatus: 'READY', rejectionReason: null, finalVerdict: 'Maize',
    }, '2026-06-26T10:00:00Z');
    const t = getLastScanTrace();
    expect(t.scanId).toBe('s1');
    expect(t.imageBytes).toBe(12345);
    expect(t.imageDims).toEqual({ width: 800, height: 600 });
    expect(t.providers[0]).toEqual({ name: 'plant.id', status: 'READY', latencyMs: 1200, httpStatus: 200 });
    expect(t.rawCandidateCount).toBe(5);
    expect(t.normalizedCandidateCount).toBe(3);
    expect(t.topScientificName).toBe('Zea mays');
    expect(t.finalVerdict).toBe('Maize');
    expect(t.at).toBe('2026-06-26T10:00:00Z');
  });

  it('REDACTS — secrets and image bytes can never be stored', () => {
    recordScanTrace({
      scanId: 's2',
      imageBase64: 'AAAABBBBCCCC_this_is_image_data',
      imageUrl: 'https://x/secret.jpg',
      apiKey: 'PLANT_ID_SECRET_KEY',
      Authorization: 'Bearer secret',
      rawProviderResponse: { huge: 'body' },
    }, '2026-06-26T10:00:00Z');
    const t = getLastScanTrace();
    const json = JSON.stringify(t);
    expect(json).not.toMatch(/AAAABBBB/);            // no image bytes
    expect(json).not.toMatch(/SECRET_KEY|Bearer/);   // no secrets
    expect(t.imageBase64).toBeUndefined();
    expect(t.apiKey).toBeUndefined();
    expect(t.rawProviderResponse).toBeUndefined();
    expect(t.scanId).toBe('s2');                      // but the real trace field is kept
  });

  it('coerces bad types to null and never throws', () => {
    recordScanTrace({ scanId: 123, imageBytes: 'not-a-number', topConfidence: NaN }, 'now');
    const t = getLastScanTrace();
    expect(t.scanId).toBe('123');
    expect(t.imageBytes).toBeNull();
    expect(t.topConfidence).toBeNull();
    expect(() => recordScanTrace(null, 'now')).not.toThrow();
    expect(() => recordScanTrace(undefined)).not.toThrow();
  });

  it('keeps only the LAST scan', () => {
    recordScanTrace({ scanId: 'first' }, 'now');
    recordScanTrace({ scanId: 'second' }, 'now');
    expect(getLastScanTrace().scanId).toBe('second');
  });
});
