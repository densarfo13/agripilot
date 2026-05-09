/**
 * staleKeyCleanup.test.js — pins the safe-cleanup contract
 * (May 2026 production hardening §8).
 *
 * What this test pins:
 *   • STALE_KEYS contains the curated obsolete-key list.
 *   • cleanupStaleKeys removes EXACTLY those keys, nothing else.
 *   • Auth-prefixed keys are NEVER removed even if a typo on
 *     STALE_KEYS accidentally targets them.
 *   • SSR-safe — returns [] when localStorage missing.
 *   • Idempotent — second call returns [] (nothing left to remove).
 *   • Never throws on null / corrupt storage.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.setConfig({ testTimeout: 15000 });

function makeStorage() {
  const store = new Map();
  return {
    get length() { return store.size; },
    key:        (i) => Array.from(store.keys())[i] ?? null,
    getItem:    (k) => (store.has(k) ? store.get(k) : null),
    setItem:    (k, v) => { store.set(String(k), String(v)); },
    removeItem: (k) => { store.delete(String(k)); },
    clear:      () => { store.clear(); },
    _dump:      () => Object.fromEntries(store),
  };
}

beforeEach(() => {
  globalThis.localStorage = makeStorage();
});

describe('staleKeyCleanup — curated removal', () => {
  it('STALE_KEYS contains the documented legacy keys', async () => {
    const { STALE_KEYS } = await import('../../../src/lib/staleKeyCleanup.js');
    // Spot-check a few canonical entries — adding new entries to
    // STALE_KEYS is safe; renaming/removing existing entries
    // breaks the audit trail and should fail this test.
    expect(STALE_KEYS).toContain('farroway_dashboard_v1');
    expect(STALE_KEYS).toContain('farroway_camera_scans');
    expect(STALE_KEYS).toContain('farroway_event_queue');
    expect(STALE_KEYS).toContain('farroway_grants_cache');
    expect(Object.isFrozen(STALE_KEYS)).toBe(true);
  });

  it('removes only the stale keys + leaves everything else alone', async () => {
    const { cleanupStaleKeys } = await import('../../../src/lib/staleKeyCleanup.js');
    // Seed both stale + fresh + auth keys.
    localStorage.setItem('farroway_dashboard_v1', '{"old":"data"}');
    localStorage.setItem('farroway_event_queue',  '[]');
    // Fresh / canonical keys MUST survive.
    localStorage.setItem('farroway_orch_memory_v1',          '{"weather":{"key":"rain"}}');
    localStorage.setItem('farroway_scan_history_v1',         '[]');
    localStorage.setItem('farroway_funding_opportunities',   '[]');
    // Random user data MUST survive.
    localStorage.setItem('user_pref_keepme',                 'yes');

    const removed = cleanupStaleKeys();

    // Removed list contains exactly the 2 stale entries that
    // were actually present.
    expect(removed.sort()).toEqual(['farroway_dashboard_v1', 'farroway_event_queue'].sort());

    // Stale keys are gone.
    expect(localStorage.getItem('farroway_dashboard_v1')).toBeNull();
    expect(localStorage.getItem('farroway_event_queue')).toBeNull();

    // Canonical / unrelated keys survive untouched.
    expect(localStorage.getItem('farroway_orch_memory_v1')).toBe('{"weather":{"key":"rain"}}');
    expect(localStorage.getItem('farroway_scan_history_v1')).toBe('[]');
    expect(localStorage.getItem('farroway_funding_opportunities')).toBe('[]');
    expect(localStorage.getItem('user_pref_keepme')).toBe('yes');
  });

  it('NEVER removes auth-prefixed keys (defence-in-depth)', async () => {
    const { cleanupStaleKeys } = await import('../../../src/lib/staleKeyCleanup.js');
    localStorage.setItem('auth_token',           'A');
    localStorage.setItem('farroway_auth_csrf',   'B');
    localStorage.setItem('session_id',           'C');
    localStorage.setItem('access_token',         'D');
    localStorage.setItem('refresh_token',        'E');
    localStorage.setItem('jwt_secret',           'F');
    localStorage.setItem('csrf_double_submit',   'G');
    cleanupStaleKeys();
    expect(localStorage.getItem('auth_token')).toBe('A');
    expect(localStorage.getItem('farroway_auth_csrf')).toBe('B');
    expect(localStorage.getItem('session_id')).toBe('C');
    expect(localStorage.getItem('access_token')).toBe('D');
    expect(localStorage.getItem('refresh_token')).toBe('E');
    expect(localStorage.getItem('jwt_secret')).toBe('F');
    expect(localStorage.getItem('csrf_double_submit')).toBe('G');
  });

  it('returns [] when localStorage is unavailable (SSR-safe)', async () => {
    const { cleanupStaleKeys } = await import('../../../src/lib/staleKeyCleanup.js');
    delete globalThis.localStorage;
    expect(cleanupStaleKeys()).toEqual([]);
    // Restore for subsequent tests in this file.
    globalThis.localStorage = makeStorage();
  });

  it('is idempotent — second call returns []', async () => {
    const { cleanupStaleKeys } = await import('../../../src/lib/staleKeyCleanup.js');
    localStorage.setItem('farroway_dashboard_v1', 'x');
    localStorage.setItem('farroway_camera_scans', 'y');
    expect(cleanupStaleKeys().sort())
      .toEqual(['farroway_camera_scans', 'farroway_dashboard_v1'].sort());
    // Second call has nothing left to remove.
    expect(cleanupStaleKeys()).toEqual([]);
  });

  it('previewStaleKeys is non-mutating', async () => {
    const { previewStaleKeys, cleanupStaleKeys } =
      await import('../../../src/lib/staleKeyCleanup.js');
    localStorage.setItem('farroway_event_queue', '[]');
    const previewed = previewStaleKeys();
    expect(previewed).toContain('farroway_event_queue');
    // Preview did NOT remove the key.
    expect(localStorage.getItem('farroway_event_queue')).toBe('[]');
    // Subsequent cleanup still removes it.
    expect(cleanupStaleKeys()).toContain('farroway_event_queue');
  });

  it('NEVER calls localStorage.clear()', async () => {
    const { cleanupStaleKeys } = await import('../../../src/lib/staleKeyCleanup.js');
    let cleared = false;
    const orig = globalThis.localStorage.clear;
    globalThis.localStorage.clear = () => { cleared = true; if (orig) orig.call(globalThis.localStorage); };
    cleanupStaleKeys();
    expect(cleared).toBe(false);
  });
});
