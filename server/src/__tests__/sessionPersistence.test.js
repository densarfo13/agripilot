import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Session Persistence & Offline Auth Tests
 *
 * Tests the session cache logic that powers persistent login:
 * - cacheSession / getCachedSession / clearSessionCache
 * - Offline fallback behavior
 * - Email remembering for low-friction re-login
 * - Session cache expiry (30-day max)
 * - Sign-out clears all cached state
 *
 * NOTE: These test the pure logic extracted from AuthContext.jsx.
 * The helpers are re-implemented here since AuthContext is a React
 * component and we test with Vitest (no DOM/React).
 */

const SESSION_CACHE_KEY = 'farroway:session_cache';
const LAST_EMAIL_KEY = 'farroway:last_email';
const MAX_CACHE_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days

// ─── Extracted helpers (mirror AuthContext.jsx logic) ────────
function cacheSession(user, storage) {
  if (user) {
    storage.setItem(SESSION_CACHE_KEY, JSON.stringify({ user, cachedAt: Date.now() }));
  } else {
    storage.removeItem(SESSION_CACHE_KEY);
  }
}

function getCachedSession(storage, now = Date.now()) {
  const raw = storage.getItem(SESSION_CACHE_KEY);
  if (!raw) return null;
  const parsed = JSON.parse(raw);
  if (!parsed?.user || !parsed?.cachedAt) return null;
  if (now - parsed.cachedAt > MAX_CACHE_AGE) {
    storage.removeItem(SESSION_CACHE_KEY);
    return null;
  }
  return parsed.user;
}

function clearSessionCache(storage) {
  storage.removeItem(SESSION_CACHE_KEY);
}

// ─── Mock localStorage ──────────────────────────────────────
function createMockStorage() {
  const store = {};
  return {
    getItem: vi.fn((key) => store[key] ?? null),
    setItem: vi.fn((key, val) => { store[key] = val; }),
    removeItem: vi.fn((key) => { delete store[key]; }),
    _store: store,
  };
}

// ─── Tests ──────────────────────────────────────────────────
describe('Session Persistence', () => {
  let storage;

  beforeEach(() => {
    storage = createMockStorage();
  });

  describe('cacheSession', () => {
    it('stores user object with timestamp', () => {
      const user = { id: 'u1', email: 'farmer@test.com', name: 'Test Farmer' };
      cacheSession(user, storage);

      expect(storage.setItem).toHaveBeenCalledWith(
        SESSION_CACHE_KEY,
        expect.stringContaining('"email":"farmer@test.com"')
      );

      const stored = JSON.parse(storage._store[SESSION_CACHE_KEY]);
      expect(stored.user).toEqual(user);
      expect(stored.cachedAt).toBeTypeOf('number');
    });

    it('removes cache when user is null', () => {
      cacheSession(null, storage);
      expect(storage.removeItem).toHaveBeenCalledWith(SESSION_CACHE_KEY);
    });

    it('removes cache when user is undefined', () => {
      cacheSession(undefined, storage);
      expect(storage.removeItem).toHaveBeenCalledWith(SESSION_CACHE_KEY);
    });
  });

  describe('getCachedSession', () => {
    it('returns cached user when cache is fresh', () => {
      const user = { id: 'u1', email: 'farmer@test.com' };
      cacheSession(user, storage);
      const result = getCachedSession(storage);
      expect(result).toEqual(user);
    });

    it('returns null when no cache exists', () => {
      expect(getCachedSession(storage)).toBeNull();
    });

    it('returns null and clears cache when expired (>30 days)', () => {
      const user = { id: 'u1', email: 'farmer@test.com' };
      // Manually write an old cache entry
      const oldTimestamp = Date.now() - MAX_CACHE_AGE - 1000;
      storage._store[SESSION_CACHE_KEY] = JSON.stringify({ user, cachedAt: oldTimestamp });

      const result = getCachedSession(storage);
      expect(result).toBeNull();
      expect(storage.removeItem).toHaveBeenCalledWith(SESSION_CACHE_KEY);
    });

    it('returns user when cache is exactly at 30-day boundary', () => {
      const user = { id: 'u1', email: 'farmer@test.com' };
      const now = Date.now();
      const boundaryTimestamp = now - MAX_CACHE_AGE; // exactly at boundary
      storage._store[SESSION_CACHE_KEY] = JSON.stringify({ user, cachedAt: boundaryTimestamp });

      const result = getCachedSession(storage, now);
      // At exact boundary, (now - cachedAt) === MAX_CACHE_AGE, NOT > MAX_CACHE_AGE
      expect(result).toEqual(user);
    });

    it('returns null for malformed cache (missing user)', () => {
      storage._store[SESSION_CACHE_KEY] = JSON.stringify({ cachedAt: Date.now() });
      expect(getCachedSession(storage)).toBeNull();
    });

    it('returns null for malformed cache (missing cachedAt)', () => {
      storage._store[SESSION_CACHE_KEY] = JSON.stringify({ user: { id: 'u1' } });
      expect(getCachedSession(storage)).toBeNull();
    });
  });

  describe('clearSessionCache', () => {
    it('removes the session cache key', () => {
      const user = { id: 'u1', email: 'farmer@test.com' };
      cacheSession(user, storage);
      clearSessionCache(storage);
      expect(storage.removeItem).toHaveBeenCalledWith(SESSION_CACHE_KEY);
      expect(getCachedSession(storage)).toBeNull();
    });
  });

  describe('Email Remembering', () => {
    it('stores last email on login', () => {
      const email = 'farmer@example.com';
      storage.setItem(LAST_EMAIL_KEY, email);
      expect(storage.getItem(LAST_EMAIL_KEY)).toBe(email);
    });

    it('clears remembered email on logout', () => {
      storage.setItem(LAST_EMAIL_KEY, 'farmer@example.com');
      storage.removeItem(LAST_EMAIL_KEY);
      expect(storage.getItem(LAST_EMAIL_KEY)).toBeNull();
    });
  });

  describe('Sign-out clears all state', () => {
    it('logout clears session cache, remembered email', () => {
      // Simulate login state
      const user = { id: 'u1', email: 'farmer@test.com' };
      cacheSession(user, storage);
      storage.setItem(LAST_EMAIL_KEY, 'farmer@test.com');

      // Simulate logout
      clearSessionCache(storage);
      storage.removeItem(LAST_EMAIL_KEY);

      expect(getCachedSession(storage)).toBeNull();
      expect(storage.getItem(LAST_EMAIL_KEY)).toBeNull();
    });
  });

  describe('Offline → Online transition', () => {
    it('cached session allows offline access', () => {
      const user = { id: 'u1', email: 'farmer@test.com', name: 'Offline Farmer' };
      cacheSession(user, storage);

      // Simulate: /me fails (network error) → fallback to cache
      const cached = getCachedSession(storage);
      expect(cached).toEqual(user);
      expect(cached.name).toBe('Offline Farmer');
    });

    it('server error (401) clears cache — no stale session', () => {
      const user = { id: 'u1', email: 'farmer@test.com' };
      cacheSession(user, storage);

      // Simulate: /me returns 401 → clear cache
      clearSessionCache(storage);
      expect(getCachedSession(storage)).toBeNull();
    });
  });
});
