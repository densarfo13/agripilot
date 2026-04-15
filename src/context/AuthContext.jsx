import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  getCurrentUser,
  loginUser,
  logoutUser,
  registerUser,
  resendVerification,
  refreshSession,
  verifyMfaCode as verifyMfaCodeApi,
  requestPhoneOtp as requestPhoneOtpApi,
  verifyPhoneOtp as verifyPhoneOtpApi,
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
    const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV;
    if (isDev) console.log('[AUTH] Bootstrap start');

    // ─── Step 0: Instant restore from cache ──────────────────
    // Show cached user immediately so the UI doesn't flash login.
    // The actual server validation happens below and corrects if stale.
    const cached = getCachedSession();
    if (cached) {
      if (isDev) console.log('[AUTH] Instant restore from cache, role:', cached.role);
      setUser(cached);
      setIsOfflineSession(true); // will flip to false once server confirms
    }

    // ─── Step 1: Proactive refresh ───────────────────────────
    // The access_token cookie expires after 15 min (browser deletes it).
    // Call /refresh first to ensure a fresh access token exists before /me.
    if (cached) {
      if (isDev) console.log('[AUTH] Pre-flight refresh (have cached session)');
      await refreshSession(); // best-effort; /me retry handles failure
    }

    // ─── Step 2: Validate with /me ───────────────────────────
    try {
      const data = await getCurrentUser();
      const serverUser = data.user || null;
      if (isDev) console.log('[AUTH] /me success, role:', serverUser?.role);
      setUser(serverUser);
      setIsOfflineSession(false);
      cacheSession(serverUser);
    } catch (err) {
      if (isDev) console.warn('[AUTH] /me failed:', err.status, err.message);

      const isNetworkError = !err.status || err.message === 'Failed to fetch';
      const isAuthError = err.status === 401 || err.status === 403;

      if (isNetworkError) {
        // Offline — keep cached user, re-validate when online
        if (isDev) console.log('[AUTH] Offline — keeping cached session');
        if (cached) {
          setUser(cached);
          setIsOfflineSession(true);
          const onOnline = () => {
            window.removeEventListener('online', onOnline);
            bootstrap();
          };
          window.addEventListener('online', onOnline);
        } else {
          setUser(null);
          setIsOfflineSession(false);
        }
      } else if (isAuthError) {
        // 401/403 after refresh attempt = session truly dead
        if (isDev) console.log('[AUTH] Session invalid (', err.status, ') — logging out');
        setUser(null);
        setIsOfflineSession(false);
        clearSessionCache();
      } else {
        // Server error (500, etc.) — NOT a session problem.
        // Keep cached user alive; don't kick farmer to login for transient errors.
        if (isDev) console.log('[AUTH] Server error (', err.status, ') — keeping cached session');
        if (cached) {
          setUser(cached);
          setIsOfflineSession(true);
          // Retry after a delay
          setTimeout(() => bootstrap(), 30000);
        } else {
          setUser(null);
          setIsOfflineSession(false);
        }
      }
    } finally {
      if (isDev) console.log('[AUTH] Bootstrap complete, authLoading → false');
      setAuthLoading(false);
    }
  }

  useEffect(() => {
    bootstrap();
  }, []);

  async function login(email, password) {
    const data = await loginUser({ email, password });

    // MFA challenge required — don't set user yet, caller handles step 2
    if (data.mfaChallengeRequired) {
      try { localStorage.setItem('farroway:last_email', email); } catch { /* ignore */ }
      return data;
    }

    const loggedInUser = data.user || null;
    setUser(loggedInUser);
    setIsOfflineSession(false);
    // Login already verified the session — clear authLoading so
    // AuthLoadingGate opens immediately without waiting for bootstrap's /me call.
    setAuthLoading(false);
    cacheSession(loggedInUser);
    // Remember email for re-login convenience
    try { localStorage.setItem('farroway:last_email', email); } catch { /* ignore */ }
    return data;
  }

  async function completeMfaChallenge(mfaToken, code) {
    const data = await verifyMfaCodeApi({ mfaToken, code });
    const loggedInUser = data.user || null;
    setUser(loggedInUser);
    setIsOfflineSession(false);
    setAuthLoading(false);
    cacheSession(loggedInUser);
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

  async function logout(reason) {
    const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV;
    if (isDev) console.log('[AUTH] Logout, reason:', reason || 'explicit');
    await logoutUser().catch(() => {});
    setUser(null);
    setIsOfflineSession(false);
    clearSessionCache();
    try { localStorage.removeItem('farroway:last_email'); } catch { /* ignore */ }
  }

  async function resendEmailVerification() {
    return resendVerification();
  }

  // ─── Phone + OTP login ─────────────────────────────────────
  async function requestPhoneOtp(phone) {
    return requestPhoneOtpApi(phone);
  }

  async function verifyPhoneOtp(phone, code) {
    const data = await verifyPhoneOtpApi(phone, code);
    const loggedInUser = data.user || null;
    setUser(loggedInUser);
    setIsOfflineSession(false);
    setAuthLoading(false);
    cacheSession(loggedInUser);
    return data;
  }

  // ─── Offline entry ─────────────────────────────────────────
  // Allows farmers to start using the app immediately without network.
  // Creates a minimal offline session so the UI renders in Home mode.
  function continueOffline() {
    const cached = getCachedSession();
    if (cached) {
      // Restore last known session
      setUser(cached);
      setIsOfflineSession(true);
    } else {
      // No prior session — create minimal offline farmer identity
      const offlineUser = {
        id: 'offline_' + Date.now(),
        role: 'farmer',
        fullName: '',
        isOfflineOnly: true,
      };
      setUser(offlineUser);
      setIsOfflineSession(true);
      // Don't cache offline-only users — they need real auth later
    }
    setAuthLoading(false);
  }

  const value = useMemo(
    () => ({
      user,
      authLoading,
      isAuthenticated: !!user,
      isOfflineSession,
      login,
      completeMfaChallenge,
      register,
      logout,
      bootstrap,
      resendEmailVerification,
      requestPhoneOtp,
      verifyPhoneOtp,
      continueOffline,
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
