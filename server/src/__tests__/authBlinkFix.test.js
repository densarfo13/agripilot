/**
 * Auth Blink Fix — source-code enforcement tests.
 *
 * Verifies that the post-login blinking/redirect-loop bug is fixed:
 * 1. Single auth loading gate prevents routing before auth resolves
 * 2. Catch-all sends to /dashboard not / (avoids V1 gate for V2 users)
 * 3. V1 interceptor does not hard-redirect on V2 routes
 * 4. Auth ownership is clear: one gate, one redirect source per layer
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const root = join(import.meta.dirname, '..', '..', '..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf-8');
}

// ═══════════════════════════════════════════════════════════
//  TOP-LEVEL AUTH LOADING GATE
// ═══════════════════════════════════════════════════════════

describe('App.jsx — auth loading gate', () => {
  const src = read('src/App.jsx');

  it('has AuthLoadingGate component', () => {
    expect(src).toContain('function AuthLoadingGate');
  });

  it('AuthLoadingGate reads authLoading from useAuth', () => {
    expect(src).toContain('const { authLoading } = useAuth()');
  });

  it('AuthLoadingGate blocks rendering until auth resolves', () => {
    expect(src).toContain('if (authLoading) return <PageLoader />');
  });

  it('wraps routes with AuthLoadingGate', () => {
    expect(src).toContain('<AuthLoadingGate>');
    expect(src).toContain('</AuthLoadingGate>');
  });

  it('imports useAuth from AuthContext', () => {
    expect(src).toContain('useAuth');
    expect(src).toContain('AuthContext');
  });
});

// ═══════════════════════════════════════════════════════════
//  CATCH-ALL ROUTE → /dashboard (not /)
// ═══════════════════════════════════════════════════════════

describe('Catch-all route', () => {
  const src = read('src/App.jsx');

  it('catch-all sends to /dashboard', () => {
    expect(src).toContain('path="*" element={<Navigate to="/dashboard" replace />}');
  });

  it('does NOT send catch-all to / (would hit V1 gate)', () => {
    // The old pattern: path="*" element={<Navigate to="/" replace />}
    expect(src).not.toContain('path="*" element={<Navigate to="/" replace />}');
  });
});

// ═══════════════════════════════════════════════════════════
//  V1 ProtectedRoute — V2 awareness
// ═══════════════════════════════════════════════════════════

describe('V1 ProtectedRoute — V2 user detection', () => {
  const src = read('src/App.jsx');

  it('checks for V2 session cache before redirecting to login', () => {
    expect(src).toContain('farroway:session_cache');
  });

  it('sends V2 users to /dashboard instead of /login', () => {
    expect(src).toContain("Navigate to=\"/dashboard\" replace");
  });
});

// ═══════════════════════════════════════════════════════════
//  V1 API interceptor — no hard redirect on V2 routes
// ═══════════════════════════════════════════════════════════

describe('V1 API client — 401 handling with V2 cookie refresh', () => {
  const src = read('src/api/client.js');

  it('attempts V2 cookie refresh before hard logout', () => {
    expect(src).toContain('/api/v2/auth/refresh');
    expect(src).toContain('_refreshing');
  });

  it('handles MFA and step-up codes without logout', () => {
    expect(src).toContain('STEP_UP_REQUIRED');
    expect(src).toContain('MFA_SETUP_REQUIRED');
    expect(src).toContain('MFA_CHALLENGE_REQUIRED');
  });

  it('falls back to hard logout when refresh fails', () => {
    const interceptorSection = src.split('interceptors.response')[1] || '';
    expect(interceptorSection).toContain("window.location.href = '/login'");
    expect(interceptorSection).toContain('logout()');
  });
});

// ═══════════════════════════════════════════════════════════
//  AUTH OWNERSHIP — single gate per layer
// ═══════════════════════════════════════════════════════════

describe('Auth ownership — single responsibility', () => {
  it('AuthContext owns auth state (user, authLoading)', () => {
    const src = read('src/context/AuthContext.jsx');
    expect(src).toContain('const [user, setUser] = useState(null)');
    expect(src).toContain('const [authLoading, setAuthLoading] = useState(true)');
    expect(src).toContain('isAuthenticated: !!user');
  });

  it('AuthGuard owns unauthenticated redirect to /login', () => {
    const src = read('src/components/AuthGuard.jsx');
    expect(src).toContain('Navigate to="/login"');
    expect(src).toContain('!isAuthenticated');
  });

  it('Login page owns authenticated redirect to /dashboard (declarative)', () => {
    const src = read('src/pages/Login.jsx');
    expect(src).toContain('<Navigate to={redirectTo} replace />');
    expect(src).toContain('isAuthenticated');
    // No imperative navigate() calls after login
    const handleSubmitSection = src.split('handleSubmit')[1]?.split('return')[0] || '';
    expect(handleSubmitSection).not.toContain("navigate('/')");
    expect(handleSubmitSection).not.toContain("navigate('/dashboard')");
  });

  it('ProfileGuard owns profile-incomplete redirect', () => {
    const src = read('src/components/ProfileGuard.jsx');
    expect(src).toContain('Navigate to="/profile/setup"');
    expect(src).toContain('isProfileComplete');
  });

  it('AuthLoadingGate prevents routing before auth resolves', () => {
    const src = read('src/App.jsx');
    // Gate is above Suspense and Routes
    const gatePos = src.indexOf('<AuthLoadingGate>');
    const routesPos = src.indexOf('<Routes>');
    expect(gatePos).toBeGreaterThan(-1);
    expect(routesPos).toBeGreaterThan(-1);
    expect(gatePos).toBeLessThan(routesPos);
  });
});

// ═══════════════════════════════════════════════════════════
//  COOKIE/TOKEN — session persistence
// ═══════════════════════════════════════════════════════════

describe('Session persistence', () => {
  it('V2 API uses credentials: include (cookies)', () => {
    const src = read('src/lib/api.js');
    expect(src).toContain("credentials: 'include'");
  });

  it('V2 API has 401→refresh token flow', () => {
    const src = read('src/lib/api.js');
    expect(src).toContain('/api/v2/auth/refresh');
    expect(src).toContain('allowRefresh');
  });

  it('AuthContext caches session for offline use', () => {
    const src = read('src/context/AuthContext.jsx');
    expect(src).toContain('cacheSession');
    expect(src).toContain('getCachedSession');
    expect(src).toContain('farroway:session_cache');
  });

  it('AuthContext bootstrap resolves authLoading exactly once', () => {
    const src = read('src/context/AuthContext.jsx');
    // authLoading is set to false in the finally block of bootstrap
    expect(src).toContain('setAuthLoading(false)');
    // bootstrap is called once on mount
    const effectMatch = src.match(/useEffect\(\(\)\s*=>\s*\{\s*bootstrap\(\)/);
    expect(effectMatch).toBeTruthy();
  });

  it('login() sets authLoading false only on successful non-MFA login', () => {
    const src = read('src/context/AuthContext.jsx');
    const loginFn = src.split('async function login')[1]?.split('async function')[0] || '';
    // login() returns early (without setAuthLoading) for MFA challenge,
    // but clears authLoading on successful direct login
    expect(loginFn).toContain('mfaChallengeRequired');
    expect(loginFn).toContain('setAuthLoading(false)');
  });
});

// ═══════════════════════════════════════════════════════════
//  NO DUPLICATE REDIRECTS
// ═══════════════════════════════════════════════════════════

describe('No duplicate redirect patterns', () => {
  it('Login page uses declarative Navigate (not imperative navigate)', () => {
    const src = read('src/pages/Login.jsx');
    // Gate 2 uses <Navigate> component, not navigate() call
    expect(src).toContain('<Navigate to={redirectTo} replace />');
  });

  it('ProfileContext resets state synchronously during render (not in useEffect)', () => {
    const src = read('src/context/ProfileContext.jsx');
    // The sync reset pattern — happens during render, not after
    expect(src).toContain('if (isAuthenticated !== prevAuth)');
    expect(src).toContain('setInitialized(false)');
    expect(src).toContain('setProfile(null)');
  });

  it('ProfileGuard shows loading while profile initializes', () => {
    const src = read('src/components/ProfileGuard.jsx');
    expect(src).toContain('!initialized || (loading && !profile)');
  });
});
