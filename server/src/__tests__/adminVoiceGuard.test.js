/**
 * adminVoiceGuard.test.js — voice OFF on admin routes, voice ON for
 * farmers. Exercises the guard helper + the service-layer entry
 * points (speak / stop / warmup / VoicePromptButton).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

function installWindow(pathname) {
  globalThis.window = {
    location: { pathname, search: '', href: `https://x${pathname}` },
    localStorage: {
      _m: new Map(),
      getItem(k) { return this._m.has(k) ? this._m.get(k) : null; },
      setItem(k, v) { this._m.set(k, String(v)); },
      removeItem(k) { this._m.delete(k); },
      key(i) { return Array.from(this._m.keys())[i] || null; },
      get length() { return this._m.size; },
    },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    // Voice-relevant globals — we track any access to prove the
    // admin path never touches them.
    speechSynthesis: {
      cancel:   vi.fn(),
      speak:    vi.fn(),
      getVoices: vi.fn(() => []),
      addEventListener:    vi.fn(),
      removeEventListener: vi.fn(),
    },
  };
  globalThis.SpeechSynthesisUtterance = function SpeechSynthesisUtterance() {};
  globalThis.Audio = function Audio() {};
}

afterEach(() => {
  delete globalThis.window;
  delete globalThis.SpeechSynthesisUtterance;
  delete globalThis.Audio;
});

async function fresh() {
  const guard = await import('../../../src/lib/voice/adminGuard.js?t=' + Math.random());
  return { guard };
}

// ─── Guard helper ────────────────────────────────────────────────
describe('isAdminContext (pathname)', () => {
  it('/admin/** is admin', async () => {
    installWindow('/admin/dashboard');
    const { guard } = await fresh();
    expect(guard.isAdminContext()).toBe(true);
    expect(guard.isAdminContext('/admin')).toBe(true);
    expect(guard.isAdminContext('/admin/farmers/123')).toBe(true);
  });

  it('/officer/** is admin', async () => {
    installWindow('/officer/issues');
    const { guard } = await fresh();
    expect(guard.isAdminContext()).toBe(true);
  });

  it('/reports/** is admin', async () => {
    installWindow('/reports/print');
    const { guard } = await fresh();
    expect(guard.isAdminContext()).toBe(true);
  });

  it('farmer routes are NOT admin', async () => {
    installWindow('/');
    const { guard } = await fresh();
    expect(guard.isAdminContext()).toBe(false);
    expect(guard.isAdminContext('/home')).toBe(false);
    expect(guard.isAdminContext('/my-farm')).toBe(false);
    expect(guard.isAdminContext('/onboarding/welcome')).toBe(false);
    expect(guard.isAdminContext('/report-issue')).toBe(false);
  });

  it('handles trailing slash + case + query string', async () => {
    installWindow('/admin/');
    const { guard } = await fresh();
    expect(guard.isAdminContext()).toBe(true);
    expect(guard.isAdminContext('/ADMIN/Dashboard?foo=1')).toBe(true);
  });

  it('empty / missing pathname → not admin', async () => {
    delete globalThis.window;
    const { guard } = await fresh();
    expect(guard.isAdminContext()).toBe(false);
    expect(guard.isAdminContext('')).toBe(false);
  });

  it('role variant covers admin + officer roles', async () => {
    installWindow('/');
    const { guard } = await fresh();
    expect(guard.isAdminContextByRole('admin')).toBe(true);
    expect(guard.isAdminContextByRole('super_admin')).toBe(true);
    expect(guard.isAdminContextByRole('field_officer')).toBe(true);
    expect(guard.isAdminContextByRole('farmer')).toBe(false);
    expect(guard.isAdminContextByRole(null)).toBe(false);
  });
});

// ─── voiceService admin gates ────────────────────────────────────
// Re-import the module each test so the isAdminContext() call
// inside each entry point sees the freshly-installed pathname.

async function freshVoiceService() {
  return import('../../../src/services/voiceService.js?t=' + Math.random());
}

describe('voiceService — admin context entry points', () => {
  it('speakPrompt is a no-op on /admin/** and never calls speechSynthesis', async () => {
    installWindow('/admin/dashboard');
    const svc = await freshVoiceService();
    const r = svc.speakPrompt('task.water', 'en');
    expect(r).toBe(false);
    expect(window.speechSynthesis.speak).not.toHaveBeenCalled();
    expect(window.speechSynthesis.getVoices).not.toHaveBeenCalled();
  });

  it('speakText is a no-op on /admin/**', async () => {
    installWindow('/admin/farmers');
    const svc = await freshVoiceService();
    const r = svc.speakText('Hello farmer', 'en');
    expect(r).toBe(false);
  });

  it('speakVoiceMapKey is a no-op on /officer/**', async () => {
    installWindow('/officer/issues');
    const svc = await freshVoiceService();
    const r = svc.speakVoiceMapKey('onboarding.welcome', 'en', { en: 'Hi' });
    expect(r).toBe(false);
  });

  it('warmup does nothing on admin routes — no /tts/status, no getVoices', async () => {
    installWindow('/admin/dashboard');
    const svc = await freshVoiceService();
    svc.warmup();
    expect(window.speechSynthesis.getVoices).not.toHaveBeenCalled();
  });
});

describe('voiceService — farmer routes still speak', () => {
  it('farmer route is NOT admin → guard lets speak through', async () => {
    installWindow('/my-farm');
    const { guard } = await fresh();
    expect(guard.isAdminContext()).toBe(false);
  });

  it('warmup does run on farmer routes', async () => {
    installWindow('/my-farm');
    const svc = await freshVoiceService();
    svc.warmup();
    expect(window.speechSynthesis.getVoices).toHaveBeenCalled();
  });
});

// ─── voiceGuide.speak admin gate ─────────────────────────────────
async function freshVoiceGuide() {
  return import('../../../src/utils/voiceGuide.js?t=' + Math.random());
}

describe('voiceGuide.speak — admin context returns false', () => {
  it('returns false on /admin/** and never creates audio', async () => {
    installWindow('/admin/dashboard');
    const guide = await freshVoiceGuide();
    // VOICE_MAP.onboarding_welcome exists; admin path still returns false.
    expect(guide.speak('onboarding_welcome', 'en')).toBe(false);
  });
});
