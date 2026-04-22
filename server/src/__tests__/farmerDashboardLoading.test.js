/**
 * farmerDashboardLoading.test.js — locks the fix for the
 * "Loading your account status" infinite-loading bug on the
 * farmer dashboard.
 *
 *   1. Account fetch is wrapped in try/catch with setLoading(false)
 *      in a finally block — every path stops loading
 *   2. AbortController with an 8 s timeout so a stalled request
 *      can't pin the spinner
 *   3. 401 / 403 → clear session via authStore.logout + redirect
 *      to /login with reason=session_expired
 *   4. console.error("ACCOUNT LOAD ERROR:", err) fires on every
 *      caught failure
 *   5. Fallback UI renders when profileError is set + profile is
 *      null — with the spec-mandated copy + Refresh + Login CTAs
 *   6. useEffect dependency array is empty (no loop)
 *   7. API call uses the shared api client (src/api/client.js)
 *      against the correct v1 path
 *   8. Render branch only shows "loadingAccount" text while
 *      loading === true (not when loading=false + profile=null)
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function readFile(rel) {
  return fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
}

const SRC = readFile('src/pages/FarmerDashboardPage.jsx');

// ─── try/catch + finally guard ────────────────────────────────
describe('FarmerDashboardPage — account load never hangs', () => {
  it('wraps the farmer-profile fetch in try/catch', () => {
    // Modern async IIFE with try + catch + finally.
    expect(SRC).toMatch(/await api\.get\('\/auth\/farmer-profile'/);
    expect(SRC).toMatch(/\}\s*catch\s*\(err\)\s*\{[\s\S]*console\.error\('ACCOUNT LOAD ERROR:', err\)/);
    expect(SRC).toMatch(/\}\s*finally\s*\{[\s\S]*if \(alive\) setLoading\(false\)/);
  });

  it('logs "ACCOUNT LOAD ERROR:" to the console on every failure path', () => {
    // Count occurrences — at least one for profile fetch, one for
    // fetchProfiles backup path.
    const occurrences = (SRC.match(/console\.error\('ACCOUNT LOAD ERROR:'/g) || []).length;
    expect(occurrences).toBeGreaterThanOrEqual(2);
  });
});

// ─── Timeout protection ────────────────────────────────────────
describe('FarmerDashboardPage — 8 s timeout protection', () => {
  it('uses an AbortController + setTimeout(8000) to cancel stalled requests', () => {
    expect(SRC).toMatch(/new AbortController\(\)/);
    expect(SRC).toMatch(/setTimeout\(\(\) => controller\.abort\(\), 8000\)/);
    expect(SRC).toMatch(/api\.get\('\/auth\/farmer-profile', \{ signal: controller\.signal \}\)/);
  });

  it('surfaces a timeout-specific message when the request aborts', () => {
    expect(SRC).toMatch(/aborted/);
    expect(SRC).toMatch(/request timed out\. Please refresh or login again/i);
  });

  it('clears the timeout + aborts on unmount cleanup', () => {
    expect(SRC).toMatch(/return \(\) => \{[\s\S]*clearTimeout\(timeoutId\)[\s\S]*controller\.abort\(\)/);
  });
});

// ─── 401 / 403 → clear + redirect ──────────────────────────────
describe('FarmerDashboardPage — session-expiry redirect', () => {
  it('clears the auth store on 401/403', () => {
    expect(SRC).toMatch(/status === 401 \|\| status === 403/);
    expect(SRC).toMatch(/useAuthStore\.getState\(\)\.logout\?\.\(\)/);
    expect(SRC).toMatch(/localStorage\.removeItem\('farroway:farmerProfile'\)/);
  });

  it('redirects to /login with reason=session_expired', () => {
    expect(SRC).toMatch(/navigate\('\/login'[\s\S]*reason: 'session_expired'/);
  });
});

// ─── Fallback UI copy + CTAs ───────────────────────────────────
describe('FarmerDashboardPage — error fallback UI', () => {
  it('shows spec-mandated "Unable to load account" copy when both offline + cache + user fallbacks miss', () => {
    expect(SRC).toMatch(/'Unable to load account\. Please refresh or login again\.'/);
  });

  it('renders a distinct error block with Refresh + Login buttons', () => {
    expect(SRC).toMatch(/data-testid="farmer-account-error"/);
    expect(SRC).toMatch(/data-testid="farmer-account-refresh"/);
    expect(SRC).toMatch(/data-testid="farmer-account-login"/);
  });

  it('Refresh button reloads the page', () => {
    expect(SRC).toMatch(/onClick=\{\(\) => window\.location\.reload\(\)\}/);
  });

  it('Login button clears auth + redirects to /login', () => {
    // In JSX the onClick is declared before data-testid; just
    // verify the logout + /login + session_expired triple appears
    // inside the same button block as the login data-testid.
    const m = SRC.match(/onClick=\{\(\) => \{[\s\S]*?useAuthStore\.getState\(\)\.logout[\s\S]*?navigate\('\/login'[\s\S]*?session_expired[\s\S]*?\}\}[\s\S]*?data-testid="farmer-account-login"/);
    expect(m, 'expected login button handler to clear auth + redirect').not.toBeNull();
  });
});

// ─── Render branch honours loading / error / profile distinctly ─
describe('FarmerDashboardPage — render branch is correct', () => {
  it('only shows "Loading your account status" text while loading=true', () => {
    // New branching: `profile ? (full dashboard) : loading ? (loading) : profileError ? (error) : (empty)`
    expect(SRC).toMatch(/\) : loading \? \([\s\S]*home\.loadingAccount/);
  });

  it('shows the error block when profileError is set after loading finishes', () => {
    expect(SRC).toMatch(/\) : profileError \? \(/);
  });

  it('has a fallback empty-state branch so the render never dead-ends', () => {
    expect(SRC).toMatch(/data-testid="farmer-account-empty"/);
  });
});

// ─── Effect dep array is empty — no loop ───────────────────────
describe('FarmerDashboardPage — useEffect does not loop', () => {
  it('the account-load useEffect uses an empty dep array (mount-only)', () => {
    // The mount-only effect ends with `}, []);` right after the
    // eslint-disable-next-line comment for the exhaustive-deps rule.
    expect(SRC).toMatch(/eslint-disable-next-line react-hooks\/exhaustive-deps[\s\S]*?\}, \[\]\);/);
    // And there's a human-readable "never loop" comment nearby.
    expect(SRC).toMatch(/never loop/);
  });
});

// ─── API correctness ───────────────────────────────────────────
describe('FarmerDashboardPage — uses the shared api client', () => {
  it('imports the shared client from src/api/client.js', () => {
    expect(SRC).toMatch(/import api from '\.\.\/api\/client\.js'/);
  });

  it('calls the correct v1 endpoint', () => {
    expect(SRC).toMatch(/api\.get\('\/auth\/farmer-profile'/);
  });
});
