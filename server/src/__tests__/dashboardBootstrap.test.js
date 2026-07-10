/**
 * dashboardBootstrap.test.js — locks the hardened dashboard
 * bootstrap sequence that replaced the infinite-loading effect.
 *
 *   1. Reusable runBootstrap() wrapped in useCallback
 *   2. Retry button wired to handleBootstrapRetry
 *   3. Hard 10 s safety-net timer forces loading=false
 *   4. Per-request 8 s AbortController timeout
 *   5. [BOOT] logs at every step of the sequence
 *   6. 401 / 403 → logout + redirect with session_expired reason
 *   7. 404 → setShowOnboarding(true), no hang + no error card
 *   8. Non-fetch failures still land in the catch + console.error
 *   9. finally always clears loading
 *  10. API response shape normalised (farmer / profile / raw payload)
 *  11. useEffect dep array is [] (mount-only, no loop)
 *  12. Retry button calls runBootstrap (not window.location.reload)
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function readFile(rel) {
  return fs.readFileSync(path.join(process.cwd(), '..', rel), 'utf8');
}
const SRC = readFile('src/pages/FarmerDashboardPage.jsx');

// ─── Reusable bootstrap function ───────────────────────────────
describe('runBootstrap — reusable async fn', () => {
  it('is wrapped in useCallback with a stable dep array', () => {
    expect(SRC).toMatch(/const runBootstrap = useCallback\(async \(\) =>/);
    expect(SRC).toMatch(/\[navigate, fetchProfiles, fetchReferral, trackEvent, user, _fromCache\]/);
  });

  it('sets loading=true + clears error on every invocation', () => {
    // These two lines must appear at the top of the function body.
    const block = SRC.match(/const runBootstrap = useCallback\([\s\S]*?clearTimeout\(requestTimeout\);/);
    expect(block).not.toBeNull();
    expect(block[0]).toMatch(/setLoading\(true\)/);
    expect(block[0]).toMatch(/setProfileError\(''\)/);
  });
});

// ─── Retry button wiring ───────────────────────────────────────
describe('retry button', () => {
  it('handleBootstrapRetry calls runBootstrap', () => {
    expect(SRC).toMatch(/const handleBootstrapRetry = useCallback\(/);
    // Note (May 2026): the verbose `console.log('[BOOT] retry requested')`
    // log was removed by the production-console-cleanup commit
    // (see consoleFilter.js denylist for `[BOOT] `). The handler
    // structure stays; only the noisy log is gone.
    expect(SRC).toMatch(/runBootstrap\(\)/);
  });

  it('error-card Refresh button calls handleBootstrapRetry (not window.location.reload)', () => {
    expect(SRC).toMatch(/data-testid="farmer-account-refresh"/);
    expect(SRC).toMatch(/onClick=\{handleBootstrapRetry\}/);
    // The old window.location.reload path must be gone from this button.
    const refreshBlock = SRC.match(/data-testid="farmer-account-refresh"[\s\S]{0,400}/);
    expect(refreshBlock[0]).not.toContain('window.location.reload');
  });
});

// ─── Safety nets ───────────────────────────────────────────────
describe('timeout safety nets', () => {
  it('per-request 8 s AbortController drives the axios signal', () => {
    expect(SRC).toMatch(/const controller = new AbortController\(\)/);
    expect(SRC).toMatch(/setTimeout\(\(\) => controller\.abort\(\), 8000\)/);
    expect(SRC).toMatch(/signal: controller\.signal/);
  });

  it('hard 10 s deadline forces loading=false even if finally is skipped', () => {
    // Note (May 2026): the verbose `hard-deadline hit at 10s`
    // log inside the timer body was removed by the production
    // console-cleanup commit. The 10 s timer + setLoading(false)
    // contract still applies — that's what we assert here.
    expect(SRC).toMatch(/setTimeout\(\(\) => \{[\s\S]*?setLoading\(false\)[\s\S]*?\}, 10000\)/);
  });

  it('unmount cleanup aborts in-flight request + clears the deadline', () => {
    expect(SRC).toMatch(/return \(\) => \{[\s\S]*aliveRef\.current = false[\s\S]*bootCtrlRef\.current\.abort[\s\S]*clearTimeout\(bootDeadlineRef\.current\)/);
  });
});

// ─── Verbose [BOOT] step logs — REMOVED in production cleanup ──
// The dashboard bootstrap used to console.log `[BOOT] starting…`,
// `[BOOT] session ok`, etc. at every step. The production console
// cleanup commit (see consoleFilter.js denylist for `[BOOT] `)
// removed those because they were polluting the QA console for
// every page load. The bootstrap LOGIC the original logs were
// observing is asserted by the other describe blocks above —
// useCallback wiring, abort controller, hard 10 s deadline,
// 401/403/404 routing, finally clears loading. That's what we
// pin now. The verbose logs are not coming back.
describe('[BOOT] step logs — production cleanup contract', () => {
  it('FarmerDashboardPage no longer emits verbose [BOOT] step logs', () => {
    // The denylist in consoleFilter.js suppresses any line
    // starting with `[BOOT] ` in production. The matching
    // change at the source is the removal of the console.log
    // calls themselves; we pin that here so anyone tempted to
    // reintroduce them sees the explicit decision.
    expect(SRC).not.toMatch(/console\.log\(['"]?\[BOOT\] starting dashboard bootstrap/);
    expect(SRC).not.toMatch(/console\.log\(['"]?\[BOOT\] session ok/);
    expect(SRC).not.toMatch(/console\.log\(['"]?\[BOOT\] dashboard ready/);
  });
});

// ─── Error routing ─────────────────────────────────────────────
describe('error routing', () => {
  it('401 / 403 → logout + navigate to /login with session_expired', () => {
    expect(SRC).toMatch(/status === 401 \|\| status === 403/);
    expect(SRC).toMatch(/useAuthStore\.getState\(\)\.logout\?\.\(\)/);
    expect(SRC).toMatch(/navigate\('\/login'[\s\S]*reason: 'session_expired'/);
  });

  it('404 → setShowOnboarding(true) (no hang, no error card)', () => {
    expect(SRC).toMatch(/status === 404/);
    // Note (May 2026): the verbose `[BOOT] farmer missing —
    // routing to onboarding` log was removed by the production
    // console-cleanup commit. The 404 → setShowOnboarding(true)
    // routing is still in place — that's the LOGIC we lock here.
    expect(SRC).toMatch(/setShowOnboarding\(true\)/);
  });

  it('generic + timeout failures set a distinct profileError', () => {
    expect(SRC).toMatch(/request timed out\. Please refresh or login again/i);
    expect(SRC).toMatch(/Unable to load account\. Please refresh or login again/);
  });
});

// ─── finally always clears loading ─────────────────────────────
describe('loading always clears', () => {
  it('finally block sets setLoading(false) guarded by aliveRef', () => {
    expect(SRC).toMatch(/\}\s*finally\s*\{[\s\S]*?if \(aliveRef\.current\) setLoading\(false\)/);
  });
});

// ─── Response shape normalisation ──────────────────────────────
describe('response shape normalisation', () => {
  it('accepts payload.farmer / payload.profile / raw payload', () => {
    expect(SRC).toMatch(/farmer = \(payload && \(payload\.farmer \|\| payload\.profile\)\) \|\| payload \|\| null/);
  });

  it('farms list handles array / { data } / empty', () => {
    expect(SRC).toMatch(/Array\.isArray\(profiles\)[\s\S]*profiles\.data[\s\S]*\[\]/);
  });
});

// ─── Mount-only effect ─────────────────────────────────────────
describe('useEffect dep array', () => {
  it('the bootstrap effect is mount-only (no loop)', () => {
    expect(SRC).toMatch(/useEffect\(\(\) => \{[\s\S]*?aliveRef\.current = true[\s\S]*?runBootstrap\(\)[\s\S]*?\}, \[\]\)/);
  });
});

// ─── API call correctness ──────────────────────────────────────
describe('uses shared api client against the v1 route', () => {
  it('imports the shared client from src/api/client.js', () => {
    expect(SRC).toMatch(/import api from '\.\.\/runtime\/apiRuntime\.js'/);
  });
  it('calls /auth/farmer-profile with the abort signal', () => {
    expect(SRC).toMatch(/api\.get\('\/auth\/farmer-profile', \{ signal: controller\.signal \}\)/);
  });
});
