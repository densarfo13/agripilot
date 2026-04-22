/**
 * trustSignals.test.js — locks the verification / trust engine
 * (server mirror) + frontend parity spot-checks.
 *
 * The server + frontend engines are deliberately independent
 * modules (no cross-boundary import) but they follow the same
 * weights + band thresholds. These tests exercise the server
 * version and a handful of frontend invariants to keep them
 * aligned.
 */

import { describe, it, expect } from 'vitest';

import {
  computeTrustLevel as computeServer,
  summariseTrustLevels,
  _internal as serverInternal,
} from '../modules/verification/trustSignalsService.js';

import {
  computeTrustLevel as computeClient,
  trustColor, trustLabel,
  _internal as clientInternal,
} from '../../../src/lib/verification/trustSignals.js';

// ═══════════════════════════════════════════════════════════════
// Parity: server + client share weights + band thresholds
// ═══════════════════════════════════════════════════════════════
describe('server/client parity', () => {
  it('same weights map', () => {
    expect(serverInternal.WEIGHTS).toEqual(clientInternal.WEIGHTS);
  });

  it('weights sum to 100', () => {
    let sum = 0;
    for (const w of Object.values(serverInternal.WEIGHTS)) sum += w;
    expect(sum).toBe(100);
  });

  it('levelFor bands match across server + client', () => {
    for (const score of [0, 30, 49, 50, 79, 80, 100]) {
      expect(serverInternal.levelFor(score)).toBe(clientInternal.levelFor(score));
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// Server engine — rule coverage
// ═══════════════════════════════════════════════════════════════
describe('computeTrustLevel (server)', () => {
  it('empty context → low with score 0', () => {
    const out = computeServer({});
    expect(out.level).toBe('low');
    expect(out.score).toBe(0);
    expect(out.passedCount).toBe(0);
    expect(out.totalCount).toBe(7);
  });

  it('profile signal requires both name + country', () => {
    expect(computeServer({ farmer: { fullName: 'A' } }).signals.profileComplete).toBe(false);
    expect(computeServer({ farmer: { fullName: 'A', country: 'GH' } }).signals.profileComplete).toBe(true);
  });

  it('phoneVerified detects phoneVerifiedAt or boolean', () => {
    expect(computeServer({ farmer: { phoneVerifiedAt: '2026-01-01' } }).signals.phoneVerified).toBe(true);
    expect(computeServer({ farmer: { phoneVerified: true } }).signals.phoneVerified).toBe(true);
    expect(computeServer({ farmer: { phoneNumber: '+233', phoneVerificationPassed: true } }).signals.phoneVerified).toBe(true);
    expect(computeServer({ farmer: { phoneNumber: '+233' } }).signals.phoneVerified).toBe(false);
  });

  it('locationCaptured passes on coords OR region', () => {
    expect(computeServer({ farm: { latitude: 5.6, longitude: -0.2 } }).signals.locationCaptured).toBe(true);
    expect(computeServer({ farm: { region: 'Ashanti' } }).signals.locationCaptured).toBe(true);
    expect(computeServer({ farm: { latitude: 0, longitude: 0 } }).signals.locationCaptured).toBe(false);
    expect(computeServer({}).signals.locationCaptured).toBe(false);
  });

  it('cropSelected passes when crop OR cropType present', () => {
    expect(computeServer({ farm: { crop: 'maize' } }).signals.cropSelected).toBe(true);
    expect(computeServer({ farm: { cropType: 'RICE' } }).signals.cropSelected).toBe(true);
    expect(computeServer({ farm: { } }).signals.cropSelected).toBe(false);
  });

  it('recentActivity passes on fresh farm/farmer updatedAt', () => {
    const now = new Date();
    expect(computeServer({ farm: { updatedAt: now } }).signals.recentActivity).toBe(true);
    expect(computeServer({ farmer: { updatedAt: now } }).signals.recentActivity).toBe(true);
    const old = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    expect(computeServer({ farm: { updatedAt: old } }).signals.recentActivity).toBe(false);
  });

  it('photoUploaded detects any profile/farm photo OR photo-upload event', () => {
    expect(computeServer({ farmer: { profileImageUrl: 'https://x/y.jpg' } })
      .signals.photoUploaded).toBe(true);
    expect(computeServer({ farm:   { photoUrl: 'https://x/y.jpg' } })
      .signals.photoUploaded).toBe(true);
    expect(computeServer({ recentActivity: { events: [{ action: 'photo.uploaded' }] } })
      .signals.photoUploaded).toBe(true);
    expect(computeServer({}).signals.photoUploaded).toBe(false);
  });

  it('fully-populated farmer + farm hits high band', () => {
    const out = computeServer({
      farmer: {
        fullName: 'Amina',
        country: 'GH',
        phoneVerifiedAt: '2026-05-01',
        profileImageUrl: 'https://x/1.jpg',
        updatedAt: new Date(),
      },
      farm: {
        crop: 'maize', region: 'Ashanti',
        latitude: 5.6, longitude: -0.2,
        updatedAt: new Date(),
      },
    });
    expect(out.level).toBe('high');
    expect(out.score).toBeGreaterThanOrEqual(80);
    expect(out.passedCount).toBeGreaterThanOrEqual(6);
  });

  it('partial data lands in the medium band', () => {
    const out = computeServer({
      farmer: { fullName: 'A', country: 'GH' },
      farm:   { crop: 'maize', region: 'Ashanti', updatedAt: new Date() },
    });
    expect(out.level).toBe('medium');
  });

  it('return value is frozen', () => {
    const out = computeServer({});
    expect(Object.isFrozen(out)).toBe(true);
    expect(Object.isFrozen(out.signals)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// summariseTrustLevels — org-dashboard roll-up
// ═══════════════════════════════════════════════════════════════
describe('summariseTrustLevels', () => {
  it('zero shape on empty input', () => {
    expect(summariseTrustLevels([])).toEqual(
      { low: 0, medium: 0, high: 0, average: 0, count: 0 });
  });

  it('counts per level + computes average', () => {
    const out = summariseTrustLevels([
      { level: 'high',   score: 90 },
      { level: 'high',   score: 82 },
      { level: 'medium', score: 60 },
      { level: 'low',    score: 20 },
    ]);
    expect(out.high).toBe(2);
    expect(out.medium).toBe(1);
    expect(out.low).toBe(1);
    expect(out.count).toBe(4);
    expect(out.average).toBe(Math.round((90 + 82 + 60 + 20) / 4));
  });

  it('ignores null entries', () => {
    const out = summariseTrustLevels([null, { level: 'high', score: 80 }, undefined]);
    expect(out.count).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════
// Client helpers (spot checks)
// ═══════════════════════════════════════════════════════════════
describe('client helpers', () => {
  it('computeClient matches server result for identical input', () => {
    const ctx = {
      farmer: { fullName: 'A', country: 'GH', phoneVerifiedAt: '2026-01-01',
                profileImageUrl: 'x', updatedAt: new Date() },
      farm:   { crop: 'rice', region: 'Lagos', latitude: 1, longitude: 1,
                updatedAt: new Date() },
    };
    const s = computeServer(ctx);
    const c = computeClient(ctx);
    expect(s.score).toBe(c.score);
    expect(s.level).toBe(c.level);
    expect(s.passedCount).toBe(c.passedCount);
    // Signal keys match.
    expect(Object.keys(s.signals).sort()).toEqual(Object.keys(c.signals).sort());
  });

  it('trustColor maps levels', () => {
    expect(trustColor('high')).toMatch(/^#/);
    expect(trustColor('medium')).toMatch(/^#/);
    expect(trustColor('low')).toMatch(/^#/);
    expect(trustColor('unknown')).toMatch(/^#/);
  });

  it('trustLabel falls back to English when no t fn', () => {
    expect(trustLabel('high')).toBe('High trust');
    expect(trustLabel('medium')).toBe('Medium trust');
    expect(trustLabel('low')).toBe('Low trust');
  });
});
