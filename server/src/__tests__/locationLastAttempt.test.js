/**
 * locationLastAttempt.test.js — the admin location-debug recorder. Vitest.
 * Proves it captures the whitelisted attempt fields AND that, by construction, it can never
 * store a precise position or a secret (redaction by whitelist), and keeps a bounded ring.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { recordLocationDebug, getLocationDebug, clearLocationDebug } from '../ml/locationLastAttempt.js';

describe('locationLastAttempt', () => {
  beforeEach(() => clearLocationDebug());

  it('captures the whitelisted attempt fields', () => {
    recordLocationDebug({
      outcome: 'error', code: 'TIMEOUT', permission: 'prompt',
      isSecureContext: true, hasGeolocation: true, browser: 'chrome', platform: 'android',
      latencyMs: 15000, accuracyM: 42, userId: 'u1', errorMessage: 'took too long',
    }, '2026-06-29T10:00:00Z');
    const { last } = getLocationDebug();
    expect(last.code).toBe('TIMEOUT');
    expect(last.outcome).toBe('error');
    expect(last.browser).toBe('chrome');
    expect(last.userId).toBe('u1');
    expect(last.at).toBe('2026-06-29T10:00:00Z');
  });

  it('REDACTS — a precise position or secret can never be stored', () => {
    recordLocationDebug({
      outcome: 'success',
      latitude: 5.6037123, longitude: -0.1869876,   // precise — must NOT be stored
      coarseLat: 5.6037123, coarseLng: -0.1869876,  // coarse — rounded to ~1km
      apiKey: 'SECRET', Authorization: 'Bearer x', imageBase64: 'AAAA',
    }, 'now');
    const { last } = getLocationDebug();
    const json = JSON.stringify(last);
    expect(json).not.toMatch(/SECRET|Bearer|AAAA/);     // no secrets / image
    expect(last.latitude).toBeUndefined();              // precise coords never kept
    expect(last.longitude).toBeUndefined();
    expect(last.coarseLat).toBe(5.604);                 // only coarse (3dp ≈ 1km)
    expect(last.coarseLng).toBe(-0.187);
  });

  it('coerces bad types + never throws', () => {
    expect(() => recordLocationDebug(null, 'now')).not.toThrow();
    recordLocationDebug({ accuracyM: 'nope', isSecureContext: 'yes' }, 'now');
    const { last } = getLocationDebug();
    expect(last.accuracyM).toBeNull();
    expect(last.isSecureContext).toBeNull();
  });

  it('keeps a bounded ring (most recent first, max 20)', () => {
    for (let i = 0; i < 25; i++) recordLocationDebug({ code: 'C' + i }, 'now');
    const { last, recent } = getLocationDebug();
    expect(last.code).toBe('C24');        // newest first
    expect(recent.length).toBe(20);       // capped
  });
});
