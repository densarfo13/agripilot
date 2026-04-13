import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  getCurrentUser,
  loginUser,
  logoutUser,
  registerUser,
  resendVerification,
} from '../lib/api.js';

const AuthContext = createContext(null);

// ─── Offline session cache ──────────────────────────────────
// Stores the last known user object in localStorage so the app can
// restore a valid-looking session even when the network is unavailable.
// The cached user is ONLY used when /me fails (offline/network error).
// On next successful /me call, the cache is refreshed.
const SESSION_CACHE_KEY = 'farroway:session_cache';

function cacheSession(user) {
  try {
    if (user) {
      localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify({ user, cachedAt: Date.now() }));
    } else {
      localStorage.removeItem(SESSION_CACHE_KEY);
    }
  } catch { /* quota exceeded — ignore */ }
}

function getCachedSession() {
  try {
    const raw = localStorage.getItem(SESSION_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Cache valid for up to 30 days (matches refresh token lifetime)
    const MAX_CACHE_AGE = 30 * 24 * 60 * 60 * 1000;
    if (!parsed?.user || !parsed?.cachedAt) return null;
    if (Date.now() - parsed.cachedAt > MAX_CACHE_AGE) {
      localStorage.removeItem(SESSION_CACHE_KEY);
      return null;
    }
    return parsed.user;
  } catch {
    localStorage.removeItem(SESSION_CACHE_KEY);
    return null;
  }
}

function clearSessionCache() {
  try { localStorage.removeItem(SESSION_CACHE_KEY); } catch { /* ignore */ }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  // Track whether current session is from cache (offline) vs verified server
  const [isOfflineSession, setIsOfflineSession] = useState(false);

  async function bootstrap() {
    try {
      const data = await getCurrentUser();
      const serverUser = data.user || null;
      setUser(serverUser);
      setIsOfflineSession(false);
      cacheSession(serverUser);
    } catch (err) {
      // Network error or server unreachable — try offline cache
      const isNetworkError = !err.status || err.message === 'Failed to fetch';
      if (isNetworkError) {
        const cached = getCachedSession();
        if (cached) {
          setUser(cached);
          setIsOfflineSession(true);
          // Re-validate when back online
          const onOnline = () => {
            window.removeEventListener('online', onOnline);
            bootstrap();
          };
          window.addEventListener('online', onOnline);
        } else {
          setUser(null);
          setIsOfflineSession(false);
        }
      } else {
        // Server returned a real error (401, 403, etc.) — session is invalid
        setUser(null);
        setIsOfflineSession(false);
        clearSessionCache();
      }
    } finally {
      setAuthLoading(false);
    }
  }

  useEffect(() => {
    bootstrap();
  }, []);

  async function login(email, password) {
    const data = await loginUser({ email, password });
    const loggedInUser = data.user || null;
    setUser(loggedInUser);
    setIsOfflineSession(false);
    cacheSession(loggedInUser);
    // Remember email for re-login convenience
    try { localStorage.setItem('farroway:last_email', email); } catch { /* ignore */ }
    return data;
  }

  async function register(payload) {
    const data = await registerUser(payload);
    const registeredUser = data.user || null;
    setUser(registeredUser);
    setIsOfflineSession(false);
    cacheSession(registeredUser);
    return data;
  }

  async function logout() {
    await logoutUser().catch(() => {});
    setUser(null);
    setIsOfflineSession(false);
    clearSessionCache();
    try { localStorage.removeItem('farroway:last_email'); } catch { /* ignore */ }
  }

  async function resendEmailVerification() {
    return resendVerification();
  }

  const value = useMemo(
    () => ({
      user,
      authLoading,
      isAuthenticated: !!user,
      isOfflineSession,
      login,
      register,
      logout,
      bootstrap,
      resendEmailVerification,
    }),
    [user, authLoading, isOfflineSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
