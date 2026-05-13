/**
 * fcmRegistration.test.js — pins the frontend registration contract.
 *
 *   1. Unsupported browser → ok:false silently
 *   2. Missing messaging SDK → ok:false silently
 *   3. Missing vapidKey → ok:false silently
 *   4. Permission denied → ok:false silently
 *   5. getToken throws → ok:false silently
 *   6. Empty token → ok:false silently
 *   7. Happy path → ok:true with token
 *   8. persistToken throws → ok:true with reason 'persist_failed'
 *      (local registration still useful)
 *   9. NEVER throws on any path
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  registerForPush,
  getCurrentPushPermission,
  isPushCapable,
} from '../../../src/lib/notifications/fcmRegistration.js';

function _installSupportedEnv(initialPermission = 'default') {
  const Notif = vi.fn();
  Notif.permission = initialPermission;
  Notif.requestPermission = vi.fn(async () => 'granted');
  vi.stubGlobal('Notification', Notif);
  vi.stubGlobal('window', { Notification: Notif });
  vi.stubGlobal('navigator', {
    serviceWorker: { ready: Promise.resolve(), register: vi.fn(async () => ({})) },
  });
}

function _installUnsupportedEnv() {
  vi.stubGlobal('Notification', undefined);
  vi.stubGlobal('window', undefined);
  vi.stubGlobal('navigator', {});
}

beforeEach(() => {
  _installUnsupportedEnv();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ─── Capability gates ────────────────────────────────────────

describe('registerForPush — capability gates', () => {
  it('unsupported browser → ok:false reason:unsupported_browser', async () => {
    _installUnsupportedEnv();
    const r = await registerForPush({
      messaging: { getToken: vi.fn() },
      vapidKey:  'vk',
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('unsupported_browser');
  });

  it('missing messaging SDK → reason:messaging_unavailable', async () => {
    _installSupportedEnv('granted');
    const r = await registerForPush({ vapidKey: 'vk' });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('messaging_unavailable');
  });

  it('missing vapidKey → reason:missing_vapid_key', async () => {
    _installSupportedEnv('granted');
    const r = await registerForPush({ messaging: { getToken: vi.fn() } });
    expect(r.reason).toBe('missing_vapid_key');
  });
});

// ─── Permission flow ─────────────────────────────────────────

describe('registerForPush — permission flow', () => {
  it('denied permission → reason:permission_denied (no prompt)', async () => {
    _installSupportedEnv('denied');
    const getTokenSpy = vi.fn();
    const r = await registerForPush({
      messaging: { getToken: getTokenSpy },
      vapidKey:  'vk',
    });
    expect(r.reason).toBe('permission_denied');
    expect(getTokenSpy).not.toHaveBeenCalled();
    // Critically: should NOT re-prompt on denied (spec rule).
    expect(globalThis.Notification.requestPermission).not.toHaveBeenCalled();
  });

  it('default permission triggers a request; granted → proceeds', async () => {
    _installSupportedEnv('default');
    globalThis.Notification.requestPermission = vi.fn(async () => 'granted');
    const getToken = vi.fn(async () => 'token-abc');
    const r = await registerForPush({
      messaging: { getToken },
      vapidKey:  'vk',
    });
    expect(r.ok).toBe(true);
    expect(r.token).toBe('token-abc');
    expect(globalThis.Notification.requestPermission).toHaveBeenCalled();
  });

  it('default → dismissed (user closed popup) → reason:permission_dismissed', async () => {
    _installSupportedEnv('default');
    globalThis.Notification.requestPermission = vi.fn(async () => 'default');
    const r = await registerForPush({
      messaging: { getToken: vi.fn() },
      vapidKey:  'vk',
    });
    expect(r.reason).toBe('permission_dismissed');
  });
});

// ─── Token flow ──────────────────────────────────────────────

describe('registerForPush — token flow', () => {
  it('getToken throws → reason:token_failed (silent)', async () => {
    _installSupportedEnv('granted');
    const r = await registerForPush({
      messaging: { getToken: vi.fn(() => Promise.reject(new Error('FCM unavailable'))) },
      vapidKey:  'vk',
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('token_failed');
  });

  it('getToken returns empty string → reason:no_token', async () => {
    _installSupportedEnv('granted');
    const r = await registerForPush({
      messaging: { getToken: vi.fn(async () => '') },
      vapidKey:  'vk',
    });
    expect(r.reason).toBe('no_token');
  });

  it('getToken returns null → reason:no_token', async () => {
    _installSupportedEnv('granted');
    const r = await registerForPush({
      messaging: { getToken: vi.fn(async () => null) },
      vapidKey:  'vk',
    });
    expect(r.reason).toBe('no_token');
  });
});

// ─── persistToken ────────────────────────────────────────────

describe('registerForPush — persistToken', () => {
  it('calls persistToken with the resolved token', async () => {
    _installSupportedEnv('granted');
    const persistToken = vi.fn(async () => ({ ok: true }));
    await registerForPush({
      messaging: { getToken: vi.fn(async () => 'token-abc') },
      vapidKey:  'vk',
      persistToken,
    });
    expect(persistToken).toHaveBeenCalledWith('token-abc');
  });

  it('persistToken throw → still ok:true (local register works) + reason:persist_failed', async () => {
    _installSupportedEnv('granted');
    const r = await registerForPush({
      messaging: { getToken: vi.fn(async () => 'token-abc') },
      vapidKey:  'vk',
      persistToken: () => Promise.reject(new Error('backend down')),
    });
    expect(r.ok).toBe(true);
    expect(r.token).toBe('token-abc');
    expect(r.reason).toBe('persist_failed');
  });

  it('missing persistToken is fine — token still returned ok', async () => {
    _installSupportedEnv('granted');
    const r = await registerForPush({
      messaging: { getToken: vi.fn(async () => 'token-abc') },
      vapidKey:  'vk',
    });
    expect(r.ok).toBe(true);
    expect(r.token).toBe('token-abc');
  });
});

// ─── Helpers ────────────────────────────────────────────────

describe('helpers', () => {
  it('getCurrentPushPermission returns "unsupported" when Notification is absent', () => {
    _installUnsupportedEnv();
    expect(getCurrentPushPermission()).toBe('unsupported');
  });

  it('isPushCapable returns false when serviceWorker is absent', () => {
    _installUnsupportedEnv();
    expect(isPushCapable()).toBe(false);
  });

  it('isPushCapable returns true when Notification + serviceWorker present', () => {
    _installSupportedEnv('default');
    expect(isPushCapable()).toBe(true);
  });
});

// ─── Robustness ────────────────────────────────────────────

describe('NEVER throws on any path', () => {
  it('null input', async () => {
    await expect(registerForPush(null)).resolves.toBeDefined();
  });

  it('non-object input', async () => {
    await expect(registerForPush('string')).resolves.toBeDefined();
  });

  it('empty input', async () => {
    await expect(registerForPush({})).resolves.toBeDefined();
  });
});
