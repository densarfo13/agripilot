/**
 * authReturnToStorage.test.js — contract for the
 * sessionStorage-backed intended-destination memory.
 *
 * Covers:
 *   • safe/unsafe path classification
 *   • save / peek / consume / clear round-trip
 *   • open-redirect protection (absolute URLs, protocol-relative)
 *   • auth-surface blacklist
 *   • degrades when sessionStorage is unavailable
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  isSafeReturnPath,
  saveReturnTo, peekReturnTo, consumeReturnTo, clearReturnTo,
} from '../../../src/core/auth/returnToStorage.js';

function installSessionStorage() {
  const store = new Map();
  const fake = {
    getItem:    (k) => store.has(k) ? store.get(k) : null,
    setItem:    (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear:      () => store.clear(),
    key:        (i) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size; },
  };
  globalThis.window = { sessionStorage: fake };
  return store;
}

describe('isSafeReturnPath — open-redirect defense', () => {
  it('accepts in-app relative paths', () => {
    expect(isSafeReturnPath('/admin/users')).toBe(true);
    expect(isSafeReturnPath('/dashboard')).toBe(true);
    expect(isSafeReturnPath('/admin/security?tab=requests')).toBe(true);
  });

  it('rejects absolute URLs', () => {
    expect(isSafeReturnPath('https://evil.com/admin')).toBe(false);
    expect(isSafeReturnPath('http://attacker.example')).toBe(false);
  });

  it('rejects protocol-relative URLs', () => {
    expect(isSafeReturnPath('//evil.com')).toBe(false);
    expect(isSafeReturnPath('//attacker/admin')).toBe(false);
  });

  it('rejects backslash-containing paths', () => {
    expect(isSafeReturnPath('/admin\\path')).toBe(false);
  });

  it('rejects empty / non-string inputs', () => {
    expect(isSafeReturnPath('')).toBe(false);
    expect(isSafeReturnPath(null)).toBe(false);
    expect(isSafeReturnPath(undefined)).toBe(false);
    expect(isSafeReturnPath(123)).toBe(false);
  });

  it('rejects auth-surface paths', () => {
    expect(isSafeReturnPath('/login')).toBe(false);
    expect(isSafeReturnPath('/register')).toBe(false);
    expect(isSafeReturnPath('/verify-email')).toBe(false);
    expect(isSafeReturnPath('/reset-password')).toBe(false);
    expect(isSafeReturnPath('/forgot-password')).toBe(false);
    expect(isSafeReturnPath('/farmer-welcome')).toBe(false);
  });

  it('ignores query/hash when checking auth-surface blacklist', () => {
    expect(isSafeReturnPath('/login?next=/admin')).toBe(false);
    expect(isSafeReturnPath('/register#signup')).toBe(false);
  });
});

describe('save / peek / consume / clear round-trip', () => {
  beforeEach(() => installSessionStorage());
  afterEach(() => { delete globalThis.window; });

  it('saves then peeks the same path', () => {
    expect(saveReturnTo('/admin/users')).toBe(true);
    expect(peekReturnTo()).toBe('/admin/users');
    // peek does not clear.
    expect(peekReturnTo()).toBe('/admin/users');
  });

  it('consume returns the path and clears it', () => {
    saveReturnTo('/admin/security');
    expect(consumeReturnTo()).toBe('/admin/security');
    expect(peekReturnTo()).toBeNull();
  });

  it('clear wipes without returning', () => {
    saveReturnTo('/admin/analytics');
    clearReturnTo();
    expect(peekReturnTo()).toBeNull();
  });

  it('refuses to save unsafe paths', () => {
    expect(saveReturnTo('https://evil.com')).toBe(false);
    expect(peekReturnTo()).toBeNull();
    expect(saveReturnTo('/login')).toBe(false);
    expect(peekReturnTo()).toBeNull();
  });

  it('peek returns null when stored value later fails validation', () => {
    // Simulate a corrupted value written directly.
    window.sessionStorage.setItem('farroway.auth.returnTo.v1', 'https://attacker');
    expect(peekReturnTo()).toBeNull();
  });

  it('consume returns null when nothing is stored', () => {
    expect(consumeReturnTo()).toBeNull();
  });
});

describe('degrades cleanly without sessionStorage', () => {
  beforeEach(() => { globalThis.window = {}; /* no sessionStorage */ });
  afterEach(() => { delete globalThis.window; });

  it('save returns false', () => {
    expect(saveReturnTo('/admin/users')).toBe(false);
  });
  it('peek returns null', () => {
    expect(peekReturnTo()).toBeNull();
  });
  it('consume returns null', () => {
    expect(consumeReturnTo()).toBeNull();
  });
  it('clear does not throw', () => {
    expect(() => clearReturnTo()).not.toThrow();
  });
});

describe('degrades cleanly with no window (SSR)', () => {
  beforeEach(() => { delete globalThis.window; });

  it('save returns false', () => {
    expect(saveReturnTo('/admin/users')).toBe(false);
  });
  it('peek returns null', () => {
    expect(peekReturnTo()).toBeNull();
  });
});
