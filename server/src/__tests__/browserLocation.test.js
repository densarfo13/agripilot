/**
 * browserLocation.test.js — production geolocation wrapper contract.
 *
 * Covers the error branches the Farroway onboarding UI maps to
 * localized strings:
 *   • insecure_context     — HTTP origin
 *   • unsupported          — navigator.geolocation missing
 *   • permission_denied    — PositionError.code === 1
 *   • position_unavailable — PositionError.code === 2 or empty coords
 *   • timeout              — PositionError.code === 3
 *   • unknown              — unclassified throws
 *   • success              — returns { latitude, longitude, accuracy }
 */

import { describe, it, expect, afterEach } from 'vitest';

import {
  getBrowserCoords, BrowserLocationError, _internal,
} from '../../../src/lib/location/browserLocation.js';

function setSecureContext(value) {
  globalThis.window = { ...(globalThis.window || {}), isSecureContext: value };
}
function clearWindow() {
  try { delete globalThis.window; } catch { /* ignore */ }
}

function mockGeo({ success, error }) {
  return {
    getCurrentPosition: (ok, fail /*, options */) => {
      if (success !== undefined) ok(success);
      else if (error !== undefined) fail(error);
      else throw new Error('no-stub');
    },
  };
}

afterEach(clearWindow);

// ─── Success ───────────────────────────────────────────────────────
describe('getBrowserCoords — success', () => {
  it('resolves with latitude / longitude / accuracy', async () => {
    setSecureContext(true);
    const geo = mockGeo({
      success: { coords: { latitude: 5.55, longitude: -0.2, accuracy: 25 } },
    });
    const r = await getBrowserCoords({ geolocation: geo });
    expect(r.latitude).toBe(5.55);
    expect(r.longitude).toBe(-0.2);
    expect(r.accuracy).toBe(25);
  });

  it('defaults to secure when window is missing (tests / SSR)', async () => {
    clearWindow();
    const geo = mockGeo({
      success: { coords: { latitude: 0, longitude: 0, accuracy: null } },
    });
    const r = await getBrowserCoords({ geolocation: geo });
    expect(r).toBeTruthy();
  });
});

// ─── Secure-context gate ──────────────────────────────────────────
describe('getBrowserCoords — insecure_context', () => {
  it('rejects with code=insecure_context on HTTP origin', async () => {
    setSecureContext(false);
    await expect(getBrowserCoords({ geolocation: mockGeo({}) }))
      .rejects.toMatchObject({ code: 'insecure_context' });
  });
});

// ─── Unsupported ──────────────────────────────────────────────────
describe('getBrowserCoords — unsupported', () => {
  it('rejects with code=unsupported when geolocation missing', async () => {
    setSecureContext(true);
    await expect(getBrowserCoords({ geolocation: null }))
      .rejects.toMatchObject({ code: 'unsupported' });
  });
  it('rejects when geolocation is not the expected shape', async () => {
    setSecureContext(true);
    await expect(getBrowserCoords({ geolocation: { nope: true } }))
      .rejects.toMatchObject({ code: 'unsupported' });
  });
});

// ─── Permission / timeout / position errors ───────────────────────
describe('getBrowserCoords — classified error codes', () => {
  it('code 1 → permission_denied', async () => {
    setSecureContext(true);
    const geo = mockGeo({ error: { code: 1, message: 'denied' } });
    await expect(getBrowserCoords({ geolocation: geo }))
      .rejects.toMatchObject({ code: 'permission_denied' });
  });

  it('code 2 → position_unavailable', async () => {
    setSecureContext(true);
    const geo = mockGeo({ error: { code: 2 } });
    await expect(getBrowserCoords({ geolocation: geo }))
      .rejects.toMatchObject({ code: 'position_unavailable' });
  });

  it('code 3 → timeout', async () => {
    setSecureContext(true);
    const geo = mockGeo({ error: { code: 3 } });
    await expect(getBrowserCoords({ geolocation: geo }))
      .rejects.toMatchObject({ code: 'timeout' });
  });

  it('non-finite coords → position_unavailable', async () => {
    setSecureContext(true);
    const geo = mockGeo({
      success: { coords: { latitude: NaN, longitude: NaN, accuracy: 0 } },
    });
    await expect(getBrowserCoords({ geolocation: geo }))
      .rejects.toMatchObject({ code: 'position_unavailable' });
  });

  it('constructor throw → code=unknown, never swallowed', async () => {
    setSecureContext(true);
    const boomy = {
      getCurrentPosition: () => { throw new Error('boom'); },
    };
    await expect(getBrowserCoords({ geolocation: boomy }))
      .rejects.toMatchObject({ code: 'unknown' });
  });
});

// ─── Spec options forwarded ───────────────────────────────────────
describe('getBrowserCoords — positionOptions', () => {
  it('passes enableHighAccuracy / timeout / maximumAge by default', () => {
    expect(_internal.DEFAULT_OPTS.enableHighAccuracy).toBe(true);
    expect(_internal.DEFAULT_OPTS.timeout).toBe(15000);
    expect(_internal.DEFAULT_OPTS.maximumAge).toBe(0);
  });

  it('forwards caller-supplied overrides', async () => {
    setSecureContext(true);
    let received = null;
    const geo = {
      getCurrentPosition: (ok, _f, options) => {
        received = options;
        ok({ coords: { latitude: 1, longitude: 2, accuracy: 1 } });
      },
    };
    await getBrowserCoords({
      geolocation: geo,
      positionOptions: { timeout: 3000 },
    });
    expect(received.timeout).toBe(3000);
    expect(received.enableHighAccuracy).toBe(true);
    expect(received.maximumAge).toBe(0);
  });
});

describe('BrowserLocationError', () => {
  it('carries a stable .code', () => {
    const e = new BrowserLocationError('permission_denied', 'no');
    expect(e.name).toBe('BrowserLocationError');
    expect(e.code).toBe('permission_denied');
    expect(e).toBeInstanceOf(Error);
  });
});
