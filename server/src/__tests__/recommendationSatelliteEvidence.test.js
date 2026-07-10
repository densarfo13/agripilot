/**
 * recommendationSatelliteEvidence.test.js — locks the LIVE satellite
 * (Sentinel Hub NDVI) → recommendation-evidence contract.
 *
 * Why this exists: Sentinel Hub NDVI went live in production
 * (2026-07-09). The field-level recommendation engine
 * (recommendationPriorityEngine._fromSatellite) already cites the live
 * NDVI as evidence — e.g. reason: ['NDVI = 0.26', <interpretation>].
 * Nothing pinned that behavior to the ACTUAL fetchFieldHealth output
 * shape, so a future rename of ndvi / stressScore / stressLevel /
 * vegetationTrend would silently drop the NDVI citation with no test
 * failing. This test runs the REAL provider (only the Sentinel network
 * is mocked) and feeds its real envelope straight into the real
 * recommendation engine, asserting the NDVI evidence line survives
 * end-to-end.
 *
 * Scope note: the ScanMythos post-scan "Why" card DELIBERATELY excludes
 * satellite (honesty invariant satelliteUsed:false, gate
 * check:scan-evidence-fusion) — a 30-day field NDVI is not evidence for
 * a single-leaf disease ID. This test therefore targets ONLY the
 * field-level /api/recommendations/today engine, where NDVI is valid
 * evidence. It neither touches nor weakens that gate.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fetchFieldHealth } from '../ml/providers/fieldHealthProvider.js';
import { invalidateToken } from '../services/satellite/sentinelHubService.js';
import computeUnifiedRecommendations, { _internal }
  from '../ml/recommendationPriorityEngine.js';

const { _fromSatellite } = _internal;

// Mock the Sentinel Hub OAuth + Statistical API so the REAL
// fetchFieldHealth runs its real derivation on a chosen NDVI mean.
// (Same fetch-mock shape as sentinelHubService.test.js.)
function mockSentinel(ndviMean) {
  globalThis.fetch = vi.fn(async (url) => {
    const u = String(url);
    if (u.includes('/oauth/token')) {
      return { ok: true, status: 200,
        json: async () => ({ access_token: 'tok', expires_in: 3600 }) };
    }
    if (u.includes('/api/v1/statistics')) {
      return { ok: true, status: 200,
        json: async () => ({ data: [{ outputs: { default:
          { bands: { B0: { stats: { mean: ndviMean } } } } } }] }) };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  });
}

beforeEach(() => {
  process.env.SENTINEL_HUB_CLIENT_ID = 'test-client-id';
  process.env.SENTINEL_HUB_CLIENT_SECRET = 'test-client-secret';
  invalidateToken();               // reset module-level OAuth token cache
});
afterEach(() => { vi.restoreAllMocks(); });

describe('live satellite NDVI → recommendation evidence (end-to-end)', () => {
  it('a stressed field yields a satellite action citing the real NDVI', async () => {
    mockSentinel(0.2626313117968375);            // the real prod reading (maize)
    // distinct coords → 0 priors → trend null, deterministic
    const fh = await fetchFieldHealth({ latitude: 6.51, longitude: -1.61, cropName: 'maize' });

    // 1) the provider produced the exact live shape the engine depends on
    expect(fh.ok).toBe(true);
    expect(fh.ndvi).toBeCloseTo(0.2626, 4);
    expect(fh.stressScore).toBe(58);
    expect(fh.cropVigor).toBe('moderate');
    expect(fh.stressLevel).toBe('medium');
    expect(fh.vegetationTrend).toBe(null);

    // 2) the recommendation engine cites that live NDVI as evidence
    const action = _fromSatellite(fh);
    expect(action).not.toBe(null);
    expect(action.source).toBe('satellite');
    expect(action.reason).toContain('NDVI = 0.26');
    expect(action.reason).toContain(fh.interpretation);

    // 3) and it surfaces through the unified envelope growers see
    const env = computeUnifiedRecommendations({ satellite: fh });
    expect(env.ok).toBe(true);
    expect(env.sources.satellite).toBe(true);
    const satAction = env.topThree.find((a) => a.category === 'satellite');
    expect(satAction).toBeTruthy();
    expect(satAction.reason.some((r) => r.startsWith('NDVI = '))).toBe(true);
  });

  it('a healthy field produces NO satellite action (never a fabricated scout)', async () => {
    mockSentinel(0.78);                          // lush canopy → low stress
    const fh = await fetchFieldHealth({ latitude: 7.02, longitude: -1.02, cropName: 'maize' });
    expect(fh.ok).toBe(true);
    expect(fh.stressLevel).toBe('low');
    expect(_fromSatellite(fh)).toBe(null);
    const env = computeUnifiedRecommendations({ satellite: fh });
    expect(env.topThree.find((a) => a.category === 'satellite')).toBeFalsy();
  });

  it('missing credentials → ok:false, null NDVI, no action, nothing fabricated', async () => {
    delete process.env.SENTINEL_HUB_CLIENT_ID;
    delete process.env.SENTINEL_HUB_CLIENT_SECRET;
    const fh = await fetchFieldHealth({ latitude: 7.03, longitude: -1.03, cropName: 'maize' });
    expect(fh.ok).toBe(false);
    expect(fh.ndvi).toBe(null);
    // this is exactly the route's guard: satellite && satellite.ok ? satellite : null
    const satellite = fh && fh.ok ? fh : null;
    expect(_fromSatellite(satellite)).toBe(null);
    const env = computeUnifiedRecommendations({ satellite });
    expect(env.sources.satellite).toBe(false);
  });

  it('reading present but NDVI absent → no fabricated NDVI number', async () => {
    mockSentinel(undefined);                     // Statistical API returns no mean
    const fh = await fetchFieldHealth({ latitude: 7.04, longitude: -1.04, cropName: 'maize' });
    expect(fh.ok).toBe(true);
    expect(fh.ndvi).toBe(null);
    expect(fh.stressScore).toBe(null);
    // no stress signal → no action, and crucially no "NDVI = ?" surfaced
    expect(_fromSatellite(fh)).toBe(null);
  });
});
