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
  SESSION_EXPIRED_EVENT,
} from '../lib/api.js';
import { withBootstrapTimeout } from '../utils/withBootstrapTimeout.js';
import { logActivity } from '../services/activityLogger.js';
import { clearSessionState } from '../lib/auth/clearSessionState.js';
import { startInactivityWatcher } from '../lib/auth/inactivityWatcher.js';
import {
  isExplicitLogout, markExplicitLogout, clearExplicitLogout,
} from '../utils/explicitLogout.js';
// Sentry user-tagging — non-PII only (id + role + country code).
// No-ops when VITE_SENTRY_DSN isn't set.
import { setSentryUser, clearSentryUser } from '../lib/sentry.js';

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

// ─── Canonical auth state machine ──────────────────────────────
// Four states; every transition emits a single [AUTH_STATE] log
// in dev so the state graph is visible in DevTools without
// inspecting React internals.
//
//   loading        — bootstrap in flight (initial mount + post-
//                    logout transient).
//   authenticated  — server confirmed user OR cached offline
//                    session valid.
//   expired        — refresh failed; auth state cleared; redirect
//                    to /login pending. Components that render off
//                    `user` MUST treat this as unauthenticated.
//   anonymous      — no session, no cache, never logged in (or
//                    explicit logout completed).
export const AUTH_STATE = Object.freeze({
  LOADING:       'loading',
  AUTHENTICATED: 'authenticated',
  EXPIRED:       'expired',
  ANONYMOUS:     'anonymous',
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  // Track whether current session is from cache (offline) vs verified server
  const [isOfflineSession, setIsOfflineSession] = useState(false);
  // Explicit 'expired' marker — flipped to true when api.js
  // dispatches SESSION_EXPIRED_EVENT. The redirect-to-/login
  // effect resets this back to false once the user is at /login.
  const [sessionExpired, setSessionExpired] = useState(false);

  // ─── Session-expired listener (auth refresh stability §1) ───
  // api.js dispatches SESSION_EXPIRED_EVENT exactly once per
  // dead-state transition. We respond by:
  //   1. Logging the state change ([AUTH_CLEARED]).
  //   2. Clearing the React user state immediately so any
  //      component reading `user` stops rendering logged-in UI
  //      (prevents Home from rendering fallback content with
  //      stale auth — §5).
  //   3. Clearing the localStorage session cache so isLoggedIn()
  //      reflects reality.
  //   4. Flipping sessionExpired=true so the derived authState
  //      surfaces EXPIRED and the redirect effect can act.
  //   5. Marking the explicit-logout flag so the next bootstrap
  //      doesn't try to repair the dead session.
  // The window-level redirect happens in a separate effect so
  // SSR / test environments without window don't crash here.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onExpired = () => {
      try {
        // eslint-disable-next-line no-console
        if (import.meta.env.DEV) {
          console.log('[AUTH_CLEARED]', { reason: 'refresh_failed' });
        }
      } catch { /* swallow */ }
      try { setUser(null); } catch { /* swallow */ }
      try { setIsOfflineSession(false); } catch { /* swallow */ }
      try { clearSessionCache(); } catch { /* swallow */ }
      try { localStorage.removeItem('farroway_token'); } catch { /* swallow */ }
      try { localStorage.removeItem('farroway_user'); } catch { /* swallow */ }
      try { markExplicitLogout(); } catch { /* swallow */ }
      setSessionExpired(true);
    };
    try { window.addEventListener(SESSION_EXPIRED_EVENT, onExpired); }
    catch { /* swallow */ }
    return () => {
      try { window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired); }
      catch { /* swallow */ }
    };
  }, []);

  // Redirect-to-/login effect — fires once when sessionExpired
  // flips true, AND only when we are NOT already at /login (so a
  // session that expires while the user is already on /login
  // doesn't trigger a redundant navigation).
  useEffect(() => {
    if (!sessionExpired) return;
    if (typeof window === 'undefined' || !window.location) return;
    try {
      if (window.location.pathname !== '/login') {
        window.location.replace('/login');
      }
    } catch { /* swallow */ }
  }, [sessionExpired]);

  // Derived canonical authState. Computed each render — no
  // useState shadow copy that could drift out of sync with the
  // underlying inputs.
  const authState = (() => {
    if (sessionExpired) return AUTH_STATE.EXPIRED;
    if (authLoading)    return AUTH_STATE.LOADING;
    if (user)           return AUTH_STATE.AUTHENTICATED;
    return AUTH_STATE.ANONYMOUS;
  })();

  // [AUTH_STATE] transition log — dev only, fires once per
  // change so the state graph is greppable in DevTools.
  useEffect(() => {
    try {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.log('[AUTH_STATE]', authState);
      }
    } catch { /* swallow */ }
  }, [authState]);

  // Mirror the resolved auth user into the Sentry session tag.
  // Non-PII fields only (id, role, country); see src/lib/sentry.js
  // for the privacy contract. The hook handles every login /
  // logout / restore path because it just observes `user` rather
  // than wrapping each setUser call site.
  useEffect(() => {
    try {
      if (user && user.id != null) {
        setSentryUser({
          id:      user.id,
          role:    user.userType || user.role || null,
          country: user.country  || user.countryCode || null,
        });
      } else {
        clearSentryUser();
      }
    } catch { /* never throw from a side-effect */ }
  }, [user]);

  async function bootstrap() {
    const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV;
    if (isDev) console.log('[AUTH] Bootstrap start');

    // ─── Step -1: Explicit-logout short-circuit ─────────────
    // If the farmer just hit Logout, every downstream repair
    // path (repairSession, repairExperience, cached-profile
    // restore, /me validation) must be skipped — otherwise the
    // app reads the still-cached farm + onboarding flag and
    // sends the farmer right back into the dashboard.
    //
    // The flag is cleared on successful login (see `login`,
    // `completeMfaChallenge`, `verifyPhoneOtp`, `register`).
    // Bootstrap finishes here with no user, no offline session,
    // authLoading=false so the route guard renders /login.
    try {
      if (isExplicitLogout()) {
        if (isDev) console.log('[AUTH] Explicit-logout flag set — skipping repair / restore');
        setUser(null);
        setIsOfflineSession(false);
        setAuthLoading(false);
        return;
      }
    } catch { /* never propagate */ }

    // ─── Step 0a: Self-heal stale localStorage state ─────────
    // Non-destructive repair pass for the spec-canonical session
    // keys (farroway_user, _user_profile, _farms, _active_farm,
    // _onboarding_completed). Lazy-imported so a corrupted
    // repair module can never break boot.
    try {
      const { repairSession } = await import('../utils/repairSession.js');
      const actions = repairSession();
      if (isDev && actions && actions.length) {
        console.log('[AUTH] repairSession applied:', actions);
      }
    } catch (err) {
      if (isDev) console.warn('[AUTH] repairSession unavailable:', err && err.message);
    }

    // Multi-role architecture migration: single boot-time
    // entry that runs the legacy-farms migration (idempotent,
    // sentinel-guarded) → repairExperience → repairLandSizeBase
    // in order. Each step bails on the explicit-logout flag so
    // the chain is a no-op after Logout. Lazy-imported so a
    // problem in any step can never break boot.
    try {
      const { repairActiveContext } = await import('../utils/repairActiveContext.js');
      const ctxActions = await repairActiveContext();
      if (isDev && ctxActions && ctxActions.length) {
        console.log('[AUTH] repairActiveContext applied:', ctxActions);
      }
    } catch (err) {
      if (isDev) console.warn('[AUTH] repairActiveContext unavailable:', err && err.message);
    }

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
    // Capped at 3 seconds — if the server is offline or slow, skip and
    // let /me handle the retry so boot never hangs past 6 seconds total.
    if (cached) {
      if (isDev) console.log('[AUTH] Pre-flight refresh (have cached session)');
      await withBootstrapTimeout(refreshSession(), 3000, null, 'refreshSession');
    }

    // ─── Step 2: Validate with /me ───────────────────────────
    // 5-second cap — the finally block below always sets authLoading=false
    // so even a completely unresponsive server releases the auth gate.
    try {
      const data = await withBootstrapTimeout(getCurrentUser(), 5000, null, 'getCurrentUser');
      // withBootstrapTimeout resolves with null on timeout — treat as network error.
      if (!data) throw Object.assign(new Error('Failed to fetch'), { status: 0 });
      const serverUser = data.user || null;
      if (isDev) console.log('[AUTH] /me success, role:', serverUser?.role);
      setUser(serverUser);
      setIsOfflineSession(false);
      cacheSession(serverUser);
    } catch (err) {
      if (isDev) console.warn('[AUTH] /me failed:', err?.status, err?.message);

      const errStatus  = err?.status  ?? 0;
      const errMessage = err?.message ?? '';
      const isNetworkError = !errStatus || errMessage === 'Failed to fetch';
      const isAuthError    = errStatus === 401 || errStatus === 403;

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
        if (isDev) console.log('[AUTH] Session invalid (', errStatus, ') — logging out');
        setUser(null);
        setIsOfflineSession(false);
        clearSessionCache();
      } else {
        // Server error (500, etc.) — NOT a session problem.
        // Keep cached user alive; don't kick farmer to login for transient errors.
        if (isDev) console.log('[AUTH] Server error (', errStatus, ') — keeping cached session');
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

  // Build Full Frontend Architecture §3 — mirror the auth
  // user's role into localStorage[`farroway_active_role`] on
  // every user change. This is the slot `core/userType.js`
  // reads to resolve the 'ngo' user type for institutional
  // accounts (super_admin / institutional_admin / ngo / staff
  // / field_officer). Without this bridge, the 'ngo' resolution
  // path never fires because the slot was only present in the
  // logout-cleanup list — never written.
  //
  // Wrapped in try/catch so SSR / locked-storage failures
  // never block auth flow. Cleared (alongside the rest of the
  // session cache) by the existing logout cleanup.
  useEffect(() => {
    try {
      if (typeof localStorage === 'undefined') return;
      const role = String((user && user.role) || '').trim().toLowerCase();
      if (role) {
        localStorage.setItem('farroway_active_role', role);
      } else if (user === null) {
        // Cleared on explicit logout — leave the value intact
        // when `user` is just undefined-during-bootstrap so a
        // page refresh mid-bootstrap doesn't drop the role.
        localStorage.removeItem('farroway_active_role');
      }
    } catch { /* swallow */ }
  }, [user]);

  // ─── Cross-tab session sync (go-live audit fix) ────────────
  // localStorage `storage` events fire in OTHER tabs when a key
  // is mutated, so listening for changes to the session-cache
  // key + the legacy V1 token gives us a clean signal that
  // "the user logged in/out somewhere else." We keep the logic
  // narrow:
  //   • Cache CLEARED (newValue null) AND we currently have a
  //     user → drop local state immediately so the UI flips to
  //     logged-out. We do NOT call logoutUser() — the other tab
  //     already hit the server.
  //   • Cache POPULATED (newValue present) AND we have no user →
  //     re-bootstrap so the new session is picked up without a
  //     reload.
  // Anything else (same-value writes, unrelated keys) is ignored.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onStorage = (ev) => {
      try {
        if (!ev || ev.storageArea !== window.localStorage) return;
        const key = ev.key;
        if (key !== SESSION_CACHE_KEY && key !== 'farroway_token') return;

        const cleared = ev.newValue == null;
        if (cleared && user) {
          // Another tab logged out — mirror it here.
          try { setUser(null); setIsOfflineSession(false); }
          catch { /* swallow */ }
        } else if (!cleared && !user) {
          // Another tab logged in — pick up the session.
          try { bootstrap(); } catch { /* swallow */ }
        }
      } catch { /* never propagate */ }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [user]);

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
    // Successful login — clear the explicit-logout flag so future
    // bootstraps run repair / restore normally.
    try { clearExplicitLogout(); } catch { /* swallow */ }
    // Login already verified the session — clear authLoading so
    // AuthLoadingGate opens immediately without waiting for bootstrap's /me call.
    setAuthLoading(false);
    cacheSession(loggedInUser);
    // Remember email for re-login convenience
    try { localStorage.setItem('farroway:last_email', email); } catch { /* ignore */ }
    logActivity('login', { method: 'email' }, { userId: loggedInUser?.id });
    return data;
  }

  async function completeMfaChallenge(mfaToken, code) {
    const data = await verifyMfaCodeApi({ mfaToken, code });
    const loggedInUser = data.user || null;
    setUser(loggedInUser);
    setIsOfflineSession(false);
    try { clearExplicitLogout(); } catch { /* swallow */ }
    setAuthLoading(false);
    cacheSession(loggedInUser);
    return data;
  }

  async function register(payload) {
    const data = await registerUser(payload);
    const registeredUser = data.user || null;
    setUser(registeredUser);
    setIsOfflineSession(false);
    try { clearExplicitLogout(); } catch { /* swallow */ }
    cacheSession(registeredUser);
    // Track registration for admin analytics
    logActivity('user_registered', { method: 'email' }, { userId: registeredUser?.id });
    return data;
  }

  async function logout(reason) {
    const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV;
    if (isDev) console.log('[AUTH] Logout, reason:', reason || 'explicit');

    // Final logout-loop fix §1: flip the explicit-logout flag
    // BEFORE any async work so a race (e.g. a tab refresh hitting
    // bootstrap before the cleanup completes) still short-circuits
    // through the new bootstrap guard.
    try { markExplicitLogout(); } catch { /* swallow */ }

    // Final logout-loop fix §1: clear the session pointers the
    // spec calls out so repair logic on next bootstrap (after the
    // farmer signs back in and the explicit-logout flag is
    // cleared) starts from a clean slate. We DELIBERATELY leave
    // the data stores alone (farroway.farms / farroway_gardens /
    // scan history / feedback / language) — logout removes the
    // session, not the user's data.
    try {
      if (typeof localStorage !== 'undefined') {
        const SESSION_POINTERS = [
          'farroway_user',
          'farroway_current_user',
          'farroway_session',
          'farroway_active_role',
          'farroway_active_experience',
          'farroway_active_farm_id',
          'farroway_active_garden_id',
          'farroway_active_farm',
          'farroway_active_garden',
          'farroway_onboarding_completed',
          'farroway_user_profile',
        ];
        for (const k of SESSION_POINTERS) {
          try { localStorage.removeItem(k); } catch { /* swallow */ }
        }
      }
    } catch { /* never propagate */ }

    // Fire-and-forget the server-side session drop so a slow / dead
    // network never makes the logout button feel broken. Any failure
    // here doesn't matter: local state has already been wiped below
    // and the cookie will be invalidated by the next login attempt
    // anyway (or never, if the user just walks away).
    try { logoutUser().catch(() => {}); } catch { /* never throw */ }
    // Clear React state IMMEDIATELY so the UI flips to logged-out
    // before any async work — no 30s hang, no shared-device leak.
    try { setUser(null); setIsOfflineSession(false); clearSessionCache(); }
    catch (err) {
      if (isDev) console.warn('[AUTH] state-clear threw:', err && err.message);
    }

    // ── CURATED RESET (Apr 2026 onboarding-loop hotfix) ─────────
    // Previous version called `localStorage.clear()` which wiped
    // the onboarding-done flag, language preference, and farm
    // record alongside the auth tokens. Net effect: every logout
    // sent the user back through the setup screen on next login -
    // the redirect-loop the user reported.
    //
    // We now route through `clearSessionState` (a curated allow-
    // list that targets auth + session-context keys only) and
    // sessionStorage stays a hard clear since none of the
    // onboarding signals live there.
    try {
      const { clearSessionState } = await import('../lib/auth/clearSessionState.js');
      const result = await clearSessionState();
      if (isDev && result && result.errors && result.errors.length) {
        console.warn('[AUTH] clearSessionState errors:', result.errors);
      }
    } catch (err) {
      if (isDev) console.warn('[AUTH] clearSessionState import/call threw:', err && err.message);
    }

    // Belt-and-braces — also run the curated sweep in case any
    // future surface is added there but not here. Non-fatal.
    try { await clearSessionState(); } catch { /* already hard-cleared above */ }

    // Force a hard navigation to /login (replace, not push) so any
    // in-memory state outside React (module-level caches, open
    // WebSockets) starts from zero AND the URL bar shows the
    // post-logout target. The explicit-logout flag set above keeps
    // the boot pass on /login even if a stray navigation tried to
    // forward to /home.
    try {
      if (typeof window !== 'undefined') {
        window.location.replace('/login');
      }
    } catch { /* ignore — best-effort */ }
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
    try { clearExplicitLogout(); } catch { /* swallow */ }
    setAuthLoading(false);
    cacheSession(loggedInUser);
    logActivity('login', { method: 'phone_otp' }, { userId: loggedInUser?.id });
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

  // Inactivity auto-logout — STAFF / NGO / agent roles only.
  //
  // Farmers explicitly stay logged in. The product contract is
  // "log in once, stay logged in" — a 10-minute kiosk timeout
  // is the wrong UX for someone whose only device is the
  // farm phone they leave on a charger overnight. The
  // long-lived refresh cookie (1 year, server/lib/cookies.js)
  // backs this up so even a farmer who doesn't open the app
  // for months stays signed in.
  //
  // For institutional roles (super_admin, institutional_admin,
  // reviewer, field_officer, agent, investor_viewer) we KEEP
  // the 10-min idle-logout because those accounts often run
  // on shared NGO kiosks where farmer A could walk away from
  // an open admin session and farmer B stumble onto it.
  useEffect(() => {
    if (!user) return undefined;
    if (user.isOfflineOnly) return undefined;     // offline session never times out
    const role = String(user.role || '').toLowerCase();
    const FARMER_LIKE = role === 'farmer' || role === '' || role === 'guest';
    if (FARMER_LIKE) return undefined;            // farmers never time out
    const stop = startInactivityWatcher({
      onTimeout: () => { logout('inactivity').catch(() => {}); },
      timeoutMs: 10 * 60 * 1000,
      enabled:   true,
    });
    return stop;
  }, [user]);

  const value = useMemo(
    () => ({
      user,
      authLoading,
      isAuthenticated: !!user && !sessionExpired,
      isOfflineSession,
      // Canonical state machine — see AUTH_STATE constants above.
      // Consumers that want to render based on the four canonical
      // states (loading / authenticated / expired / anonymous)
      // should read this instead of deriving from `user` +
      // `authLoading` themselves. Home and other guarded surfaces
      // can check authState === AUTH_STATE.EXPIRED to short-
      // circuit fallback content rendering during the redirect
      // window.
      authState,
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
    [user, authLoading, isOfflineSession, sessionExpired, authState],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

/**
 * useAuthOrNull — non-throwing variant for surfaces that may
 * render outside the AuthProvider tree (e.g. ExperienceFallback
 * during pre-auth render). Same fix as `useProfileOrNull`:
 * NEVER wrap a hook in try/catch — that desyncs React's internal
 * hook counter and surfaces as the minified error #310 on the
 * NEXT render. Use `useContext` directly so the call is always
 * the same number of hooks regardless of provider presence.
 */
export function useAuthOrNull() {
  return useContext(AuthContext);
}
