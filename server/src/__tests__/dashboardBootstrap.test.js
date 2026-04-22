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
  return fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
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
  it('handleBootstrapRetry logs + calls runBootstrap', () => {
    expect(SRC).toMatch(/const handleBootstrapRetry = useCallback\(/);
    expect(SRC).toMatch(/console\.log\('\[BOOT\] retry requested'\)/);
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
    expect(SRC).toMatch(/setTimeout\(\(\) => \{[\s\S]*?hard-deadline hit at 10s[\s\S]*?setLoading\(false\)[\s\S]*?\}, 10000\)/);
  });

  it('unmount cleanup aborts in-flight request + clears the deadline', () => {
    expect(SRC).toMatch(/return \(\) => \{[\s\S]*aliveRef\.current = false[\s\S]*bootCtrlRef\.current\.abort[\s\S]*clearTimeout\(bootDeadlineRef\.current\)/);
  });
});

// ─── [BOOT] logs at every step ─────────────────────────────────
describe('[BOOT] step logs', () => {
  const REQUIRED_LOGS = [
    '[BOOT] starting dashboard bootstrap',
    '[BOOT] session ok',
    '[BOOT] no session',
    '[BOOT] user ok',
    '[BOOT] user missing',
    '[BOOT] farmer loaded',
    '[BOOT] farmer missing',
    '[BOOT] farms loaded',
    '[BOOT] dashboard ready',
    '[BOOT] bootstrap failed',
  ];

  for (const line of REQUIRED_LOGS) {
    it(`emits "${line}"`, () => {
      expect(SRC).toContain(line);
    });
  }
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
    expect(SRC).toMatch(/\[BOOT\] farmer missing — routing to onboarding/);
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
    expect(SRC).toMatch(/import api from '\.\.\/api\/client\.js'/);
  });
  it('calls /auth/farmer-profile with the abort signal', () => {
    expect(SRC).toMatch(/api\.get\('\/auth\/farmer-profile', \{ signal: controller\.signal \}\)/);
  });
});
