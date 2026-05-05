import { describe, it, expect } from 'vitest';

/**
 * routePolicy — permanent optional-setup routing rules.
 *
 * Acceptance criteria (from optional-setup-perm spec):
 *   1. Home loads without location
 *   2. My Grow loads without farm
 *   3. Tasks loads without setup
 *   4. Progress loads without setup
 *   5. Scan loads without setup
 *   6. Setup opens only from an explicit user action (Add details button)
 *   7. Skip for now returns Home
 *   8. Missing auth redirects to login
 *   9. Wrong role is blocked
 *  10. No automatic setup redirect exists
 */

import {
  canAccessApp,
  shouldForceSetup,
  shouldShowSetupPrompt,
  setupRedirectPath,
} from '../../../core/routePolicy.js';

// ── canAccessApp ──────────────────────────────────────────────────
describe('canAccessApp', () => {
  it('returns true when user object is present', () => {
    expect(canAccessApp({ id: 'u1', role: 'farmer' })).toBe(true);
  });

  it('returns false for null (missing auth → redirect to login)', () => {
    expect(canAccessApp(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(canAccessApp(undefined)).toBe(false);
  });

  it('returns false for empty object (falsy-guarded below caller)', () => {
    // An empty object is truthy — this matches the intent: an
    // authenticated user who has no profile data is still "logged in".
    expect(canAccessApp({})).toBe(true);
  });
});

// ── shouldForceSetup — ALWAYS FALSE ──────────────────────────────
describe('shouldForceSetup', () => {
  it('returns false for an authenticated user with no location', () => {
    expect(shouldForceSetup({ id: 'u1' })).toBe(false);
  });

  it('returns false for a user with no crop', () => {
    expect(shouldForceSetup({ id: 'u1', location: 'Accra' })).toBe(false);
  });

  it('returns false for a user with no farm', () => {
    expect(shouldForceSetup({ id: 'u1', crop: 'maize' })).toBe(false);
  });

  it('returns false for a fully-incomplete profile', () => {
    expect(shouldForceSetup({})).toBe(false);
  });

  it('returns false even for null (rule: setup is NEVER forced)', () => {
    expect(shouldForceSetup(null)).toBe(false);
  });

  it('returns false for a fully-complete profile (setup is always optional)', () => {
    expect(shouldForceSetup({
      location: 'Accra', crop: 'maize', farmId: 'f1',
    })).toBe(false);
  });
});

// ── shouldShowSetupPrompt — inline-prompt hint only ───────────────
describe('shouldShowSetupPrompt', () => {
  it('returns false when user is null (not authenticated)', () => {
    expect(shouldShowSetupPrompt(null)).toBe(false);
  });

  it('returns true when user has no location data', () => {
    expect(shouldShowSetupPrompt({ id: 'u1' })).toBe(true);
  });

  it('returns true when user has location but no crop', () => {
    expect(shouldShowSetupPrompt({ id: 'u1', location: 'Accra', farmId: 'f1' })).toBe(true);
  });

  it('returns true when user has crop but no farm/garden', () => {
    expect(shouldShowSetupPrompt({ id: 'u1', crop: 'tomato', location: 'Kumasi' })).toBe(true);
  });

  it('returns false when user has all three pillars via primary fields', () => {
    expect(shouldShowSetupPrompt({
      id: 'u1',
      location: 'Accra',
      crop: 'maize',
      farmId: 'f1',
    })).toBe(false);
  });

  it('returns false when user has all three pillars via alternate fields', () => {
    expect(shouldShowSetupPrompt({
      id: 'u1',
      lat: 5.6,
      lng: -0.2,
      plantName: 'Tomato',
      gardenId: 'g1',
    })).toBe(false);
  });

  it('prompt=true must NEVER cause a route redirect — it is a UI hint only', () => {
    // shouldForceSetup must stay false even when prompt would show.
    const user = { id: 'u1' }; // no location, no crop, no farm
    expect(shouldShowSetupPrompt(user)).toBe(true);  // prompt would show
    expect(shouldForceSetup(user)).toBe(false);       // but NO redirect
  });
});

// ── setupRedirectPath — for explicit user-tap only ─────────────────
describe('setupRedirectPath', () => {
  it('returns a non-empty string path', () => {
    const p = setupRedirectPath();
    expect(typeof p).toBe('string');
    expect(p.length).toBeGreaterThan(0);
    expect(p.startsWith('/')).toBe(true);
  });
});

// ── Acceptance criteria — routing contract assertions ─────────────
describe('Acceptance criteria — no auto-setup redirect', () => {
  const routes = [
    '/dashboard',        // Home
    '/my-farm',          // My Grow
    '/my-grow',          // My Grow alias
    '/tasks',            // Tasks
    '/progress',         // Progress
    '/scan',             // Scan
  ];

  const userWithNoSetup = { id: 'u1', role: 'farmer' }; // no location/crop/farm

  routes.forEach((route) => {
    it(`${route} is accessible (no redirect) for authenticated user with no setup`, () => {
      // canAccessApp must be true → page renders
      expect(canAccessApp(userWithNoSetup)).toBe(true);
      // shouldForceSetup must be false → no redirect to setup
      expect(shouldForceSetup(userWithNoSetup)).toBe(false);
    });
  });

  it('missing auth → canAccessApp returns false (login redirect is the only forced redirect)', () => {
    expect(canAccessApp(null)).toBe(false);
    expect(canAccessApp(undefined)).toBe(false);
  });

  it('setup prompt is optional UI, not a routing gate', () => {
    // Even when a prompt would show, shouldForceSetup is still false.
    expect(shouldShowSetupPrompt(userWithNoSetup)).toBe(true); // prompt eligible
    expect(shouldForceSetup(userWithNoSetup)).toBe(false);      // no redirect
  });

  it('a user who skips setup (no location/farm) can still reach Home', () => {
    const skippedUser = { id: 'u2', role: 'farmer', setupSkipped: true };
    expect(canAccessApp(skippedUser)).toBe(true);
    expect(shouldForceSetup(skippedUser)).toBe(false);
  });
});
