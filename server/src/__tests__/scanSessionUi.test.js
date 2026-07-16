import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  createScanSession, addScanSessionPhoto, getScanSession, completeScanSession, escalateScanSession,
  emitScanUiEvent, rememberSessionId, recallSessionId, forgetSessionId,
} from '../../../src/runtime/scanSession/scanSessionClient.js';
import { guidedScanAccess } from '../../../src/runtime/scanSession/guidedScanAccess.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = (rel) => fs.readFileSync(path.resolve(ROOT, rel), 'utf-8');

// ── Session API client (functional, fetch mocked) ──
describe('scanSessionClient — API calls (§client)', () => {
  let calls;
  beforeEach(() => {
    calls = [];
    globalThis.fetch = vi.fn(async (url, opts) => { calls.push({ url, opts }); return { ok: true, status: 200, json: async () => ({ sessionId: 's1', state: 'SESSION_CREATED' }) }; });
    globalThis.window = globalThis.window || {};
    const store = {};
    globalThis.sessionStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
  });
  afterEach(() => { delete globalThis.fetch; });

  it('#3 first photo POSTs to the session photo endpoint with the declared view + body', async () => {
    await addScanSessionPhoto('s1', { imageBase64: 'QUJD', viewType: 'LEAF_UNDERSIDE', idempotencyKey: 'k1' });
    expect(calls[0].url).toBe('/api/scan/sessions/s1/photos');
    expect(calls[0].opts.method).toBe('POST');
    const body = JSON.parse(calls[0].opts.body);
    expect(body.viewType).toBe('LEAF_UNDERSIDE');
    expect(body.idempotencyKey).toBe('k1');
    expect(calls[0].opts.credentials).toBe('include');
  });
  it('create / get / complete / escalate hit the right routes', async () => {
    await createScanSession({}); await getScanSession('s1'); await completeScanSession('s1'); await escalateScanSession('s1');
    expect(calls.map((c) => c.url)).toEqual([
      '/api/scan/sessions', '/api/scan/sessions/s1', '/api/scan/sessions/s1/complete', '/api/scan/sessions/s1/escalate',
    ]);
  });
  it('returns { ok, status, data } (so the UI can render 409/429 states)', async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: false, status: 409, json: async () => ({ error: 'session_expired' }) }));
    const out = await addScanSessionPhoto('s1', {});
    expect(out).toEqual({ ok: false, status: 409, data: { error: 'session_expired' } });
  });
  it('§12 analytics records sessionId + state ONLY (never image data)', () => {
    globalThis.window.__scanUiEvents = [];
    emitScanUiEvent('scan_ui_photo_submitted', 's1', 'MORE_EVIDENCE_REQUIRED');
    const rec = globalThis.window.__scanUiEvents[0];
    expect(rec).toEqual({ event: 'scan_ui_photo_submitted', sessionId: 's1', state: 'MORE_EVIDENCE_REQUIRED' });
    expect(JSON.stringify(rec)).not.toMatch(/base64|image/i);
  });
  it('§1/§19 session id is remembered / recalled / forgotten for recovery', () => {
    rememberSessionId('s9'); expect(recallSessionId()).toBe('s9');
    forgetSessionId(); expect(recallSessionId()).toBeNull();
  });
});

// ── Component contract (source-verified — full render needs a jsdom harness) ──
describe('GuidedScanSession — server-owned state contract', () => {
  const code = read('src/components/scan/GuidedScanSession.jsx');
  const app = read('src/App.jsx');

  it('#1/#2 creates the session exactly once (ref guard, survives re-render)', () => {
    expect(code).toContain('startedRef');
    expect(code).toMatch(/if\s*\(\s*!startedRef\.current\s*\)/);
  });
  it('#7 never derives state from raw confidence (no threshold / confidencePct logic)', () => {
    expect(code).not.toMatch(/confidencePct/);
    expect(code).not.toMatch(/resolveScanGuidance/);
    expect(code).not.toMatch(/TRUST_CONFIDENCE|>=\s*70|<\s*70/);
  });
  it('#4/#5 renders the SERVER-requested next view + progress (not a generic "Scan Again")', () => {
    expect(code).toContain('session.nextView'); // reads server field
    expect(code).toContain('nv.instructionKey');
    expect(code).toContain('photoProgress');
    // never falls back to the generic single-photo "scan again" key
    expect(code).not.toContain('scan.guidance.scanAgain');
  });
  it('#8 renders ONLY server allowedActions', () => {
    expect(code).toMatch(/session\.allowedActions/);
    expect(code).toMatch(/actions\.map/);
  });
  it('#15 stale/refresh recovery refetches from the server (never reconstructs locally)', () => {
    expect(code).toContain('recallSessionId');
    expect(code).toContain('getScanSession');
  });
  it('idempotency key is sent with each photo', () => {
    expect(code).toContain('idempotencyKey');
  });
  it('the guided route is flag-gated + PILOT-gated (admin OR allowlist, not RoleRoute-admin-only)', () => {
    expect(app).toContain('path="/scan/guided"');
    expect(app).toContain('feature="guidedScanSession"');
    expect(app).toContain('<GuidedScanGate>');   // widened gate so the pilot farmer can enter
  });
  it('emits the spec-named guided_scan client events', () => {
    for (const e of ['guided_scan_loaded', 'scan_session_create_started', 'scan_session_create_success',
      'scan_photo_upload_started', 'scan_photo_upload_success', 'scan_provider_started', 'scan_result_received']) {
      expect(code).toContain(e);
    }
  });
  it('renders the admin-only debug overlay (sid / api / provider / decision)', () => {
    expect(code).toContain('gs-debug');
    expect(code).toMatch(/sid=.*api=.*provider=.*decision=/s);
  });
});

// The pilot access decision — the fix for NO_SESSION_REACHED_SERVER (the route
// was admin-only; the pilot farmer was blocked before the UI could call the API).
describe('guidedScanAccess — admin OR pilot allowlist (regular farmers disabled)', () => {
  it('admin roles enabled', () => {
    expect(guidedScanAccess({ role: 'super_admin', id: 'x' }).enabled).toBe(true);
    expect(guidedScanAccess({ role: 'institutional_admin', id: 'x' }).reason).toBe('admin_role');
  });
  it('allowlisted user id enabled (even as a farmer)', () => {
    const a = guidedScanAccess({ role: 'farmer', id: 'u-42' }, { pilotIds: ['u-42', 'u-99'] });
    expect(a.enabled).toBe(true);
    expect(a.reason).toBe('pilot_allowlist');
  });
  it('regular farmer NOT in the allowlist is disabled', () => {
    const a = guidedScanAccess({ role: 'farmer', id: 'u-7' }, { pilotIds: ['u-42'] });
    expect(a.enabled).toBe(false);
    expect(a.reason).toBe('not_admin_or_pilot');
  });
  it('no user → disabled, never throws', () => {
    expect(guidedScanAccess(null).enabled).toBe(false);
    expect(guidedScanAccess(null).reason).toBe('no_user');
  });
});
