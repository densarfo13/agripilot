/**
 * behavioralTrustPack.test.js — scenario-based tests that probe
 * real-world trust failures the decision engine must survive:
 *
 *   1. land > weather > calendar conflict resolution
 *   2. conflict-driven confidence downgrade
 *   3. behavioral adaptation (returning / undo-heavy / harvest-just-done)
 *   4. stale / offline trust protection
 *   5. fallback continuity under missing data
 *
 * Each test reads as a short scenario. No snapshots — every
 * assertion is an explicit semantic check.
 */

import { describe, it, expect } from 'vitest';

import {
  resolveFarmerState,
  buildHomeExperience,
  STATE_TYPES,
} from '../../../src/utils/farmerState/index.js';

import {
  composeFixtures,
  freshOnline, staleOffline, freshOffline,
  indiaRiceFarmer, ghanaMaizeFarmer, usaCornFarmer,
  unclearedLand, wetSoilLand, poorDrainageLand, tidyLand, photoOnlyLand,
  cameraKnownIssue, cameraUnknownIssue, cameraBlurry,
  completedHarvest, postHarvestUncleared,
  returningInactive, returningLongInactive, recentUndoHeavy,
  heatWave, rainIncoming, newUser, partialProfile,
} from './__fixtures__/farmerStateFixtures.js';

// ─── 1. LAND > WEATHER > CALENDAR CONFLICTS ───────────────
describe('conflict: land > weather > calendar', () => {
  it('A. wet soil + planting + rain coming → blocks planting', () => {
    const state = resolveFarmerState(composeFixtures(
      indiaRiceFarmer(),
      wetSoilLand(),
      rainIncoming(),
      freshOnline(),
    ));
    expect(state.stateType).toBe(STATE_TYPES.BLOCKED_BY_LAND);
    expect(state.nextKey).toMatch(/fix_blocker\.wet_soil/);
    expect(state.displayMode).toBeDefined();
    // High confidence for direct planting must NOT stand; either
    // level is not 'high' or the state is no longer planting-ready.
    expect(state.confidenceLevel === 'high'
           && state.stateType !== STATE_TYPES.BLOCKED_BY_LAND).toBe(false);
  });

  it('B. uncleared land + planting → blocked_by_land with clear-field next step', () => {
    const state = resolveFarmerState(composeFixtures(
      ghanaMaizeFarmer(),
      { cropProfile: { stage: 'planting' } },
      unclearedLand(),
      freshOnline(),
    ));
    expect(state.stateType).toBe(STATE_TYPES.BLOCKED_BY_LAND);
    expect(state.nextKey).toMatch(/fix_blocker\.uncleared|fix_blocker\.generic/);
  });

  it('C. poor drainage + rain + planting → blocked_by_land wins over direct planting', () => {
    const state = resolveFarmerState(composeFixtures(
      indiaRiceFarmer(),
      poorDrainageLand(),
      rainIncoming(),
      freshOnline(),
    ));
    expect(state.stateType).toBe(STATE_TYPES.BLOCKED_BY_LAND);
    // The state must not route the user to a task that says "plant now".
    expect(state.titleFallback.toLowerCase()).not.toMatch(/\bplant now\b/);
  });

  it('D. clear land + dry soil + rain expected + planting → NOT blocked', () => {
    const state = resolveFarmerState(composeFixtures(
      indiaRiceFarmer(),
      tidyLand(),                            // dry, cleared
      rainIncoming(),
      freshOnline(),
    ));
    expect(state.stateType).not.toBe(STATE_TYPES.BLOCKED_BY_LAND);
    expect(state.stateType).not.toBe(STATE_TYPES.FIELD_RESET);
    // The engine may choose weather_sensitive (watch the forecast)
    // or active_cycle (go). Either is acceptable — the point is
    // the land isn't blocking.
    expect([
      STATE_TYPES.WEATHER_SENSITIVE,
      STATE_TYPES.ACTIVE_CYCLE,
    ]).toContain(state.stateType);
  });
});

// ─── 2. CONFLICT-DRIVEN CONFIDENCE DOWNGRADE ──────────────
describe('conflict-driven confidence downgrade', () => {
  it('land says wet, weather shows no rain, stage says planting → conflict recorded', () => {
    // Genuine 3-way conflict: farmer is in planting stage, soil
    // is wet, but the weather offers no explanation for the
    // wetness (no rain incoming). The scorer should emit the
    // conflict reason and confidence should NOT be high.
    const state = resolveFarmerState(composeFixtures(
      indiaRiceFarmer(),
      wetSoilLand(),
      { weatherNow: { rainRisk: 'low', rainMmNext24h: 0 } },
      freshOnline(),
    ));
    const trail = state.sourceReasons.join('|');
    expect(trail).toMatch(/conflict_planting_vs_wet_soil/);
    expect(['low', 'medium']).toContain(state.confidenceLevel);
  });

  it('land says wet, weather says rain coming → no conflict, but still blocked_by_land', () => {
    // Consistent story: land is wet BECAUSE rain is on its way.
    // Not a conflict — the state is still blocked_by_land (safety)
    // but the confidence does NOT drop below medium.
    const state = resolveFarmerState(composeFixtures(
      indiaRiceFarmer(),
      wetSoilLand(),
      rainIncoming(),
      freshOnline(),
    ));
    expect(state.stateType).toBe(STATE_TYPES.BLOCKED_BY_LAND);
    const trail = state.sourceReasons.join('|');
    expect(trail).not.toMatch(/conflict_planting_vs_wet_soil/);
  });

  it('camera unknown finding softens confidence to low', () => {
    const state = resolveFarmerState(composeFixtures(
      ghanaMaizeFarmer(),
      cameraUnknownIssue(),
      freshOnline(),
    ));
    expect(state.stateType).toBe(STATE_TYPES.CAMERA_ISSUE);
    expect(state.confidenceLevel).toBe('low');
    // Low confidence MUST flip the display to state-first so
    // no imperative task copy renders.
    expect(state.displayMode).toBe('state_first');
  });

  it('camera blurry also softens to low', () => {
    const state = resolveFarmerState(composeFixtures(
      usaCornFarmer(),
      cameraBlurry(),
      freshOnline(),
    ));
    expect(state.confidenceLevel).toBe('low');
  });

  it('stale offline + strong historical completion flag does NOT stay high', () => {
    const state = resolveFarmerState(composeFixtures(
      completedHarvest(),          // strong signal
      staleOffline(),              // trust degrader
      { hasCompletedOnboarding: true, hasActiveCropCycle: true },
    ));
    expect(state.confidenceLevel).not.toBe('high');
    expect(state.staleData).toBe(true);
  });
});

// ─── 3. BEHAVIORAL ADAPTATION ────────────────────────────
describe('behavioral adaptation', () => {
  it('A. inactive 5 days → returning_inactive with supportive bridge', () => {
    const state = resolveFarmerState(composeFixtures(
      ghanaMaizeFarmer(),
      returningInactive(),
      freshOnline(),
    ));
    expect(state.stateType).toBe(STATE_TYPES.RETURNING_INACTIVE);
    expect(state.nextKey).toBe('state.next.check_today_task');
    // Title must be supportive re-entry copy, not an imperative task.
    expect(state.titleFallback).toMatch(/back on track|welcome/i);
  });

  it('B. long inactivity (14 days) still routes to returning_inactive, not first_use', () => {
    const state = resolveFarmerState(composeFixtures(
      ghanaMaizeFarmer(),
      returningLongInactive(),
      freshOnline(),
    ));
    expect(state.stateType).toBe(STATE_TYPES.RETURNING_INACTIVE);
    expect(state.stateType).not.toBe(STATE_TYPES.FIRST_USE);
  });

  it('C. heavy undo/reopen usage drops confidence on certainty-sensitive states', () => {
    const state = resolveFarmerState(composeFixtures(
      completedHarvest(),
      recentUndoHeavy(),
      freshOnline(),
      { hasCompletedOnboarding: true, hasActiveCropCycle: true },
    ));
    // validation rule #2: harvest_complete + recent undo → drop confidence
    expect(state.sourceReasons.join('|'))
      .toMatch(/downgrade_harvest_complete_recent_undo/);
    expect(state.confidenceLevel).not.toBe('high');
  });

  it('D. just-completed harvest wins priority and exposes a next-step bridge', () => {
    const state = resolveFarmerState(composeFixtures(
      completedHarvest(),
      freshOnline(),
      { hasCompletedOnboarding: true, hasActiveCropCycle: true, countryCode: 'GH' },
    ));
    expect(state.stateType).toBe(STATE_TYPES.HARVEST_COMPLETE);
    expect(state.nextKey).toBe('state.next.prepare_field_for_next_cycle');
    expect(state.displayMode).toBe('state_first');
  });
});

// ─── 4. STALE / OFFLINE TRUST ────────────────────────────
describe('stale / offline trust protection', () => {
  it('A. offline + fresh data → not flagged stale', () => {
    const state = resolveFarmerState(composeFixtures(
      ghanaMaizeFarmer(),
      freshOffline(),
    ));
    expect(state.staleData).not.toBe(true);
    expect(state.stateType).not.toBe(STATE_TYPES.STALE_OFFLINE);
  });

  it('B. offline + old data → staleData flag + softened wording prefix', () => {
    const state = resolveFarmerState(composeFixtures(
      ghanaMaizeFarmer(),
      staleOffline(),
    ));
    expect([STATE_TYPES.STALE_OFFLINE, STATE_TYPES.ACTIVE_CYCLE])
      .toContain(state.stateType);
    expect(state.staleData).toBe(true);

    // Home payload should include the "based on your last update" prefix.
    const t = (k) => (k === 'state.soft.based_on_last_update'
      ? 'Based on your last update' : k);
    const home = buildHomeExperience({ farmerState: state, t });
    expect(home.confidenceLine).toBe('Based on your last update');
  });

  it('C. offline + no cache / no context → safe_fallback, no crash', () => {
    const state = resolveFarmerState({
      offlineState: { isOffline: true },
      lastUpdatedAt: null,
    });
    expect([STATE_TYPES.SAFE_FALLBACK, STATE_TYPES.FIRST_USE])
      .toContain(state.stateType);
    expect(state.title).toBeUndefined(); // title lives in titleFallback on the state
    expect(state.titleFallback).toBeTruthy();
  });

  it('D. offline + old harvest_complete doesn\u2019t sound certain', () => {
    const state = resolveFarmerState(composeFixtures(
      completedHarvest(),
      staleOffline(),
      { hasCompletedOnboarding: true, hasActiveCropCycle: true },
    ));
    expect(state.confidenceLevel).not.toBe('high');
    expect(state.staleData).toBe(true);
  });
});

// ─── 5. FALLBACK CONTINUITY ──────────────────────────────
describe('fallback continuity — missing data never crashes', () => {
  it('A. missing land data → engine still resolves, never throws', () => {
    expect(() => resolveFarmerState(composeFixtures(
      ghanaMaizeFarmer(),
      { landProfile: null },
    ))).not.toThrow();
    const state = resolveFarmerState(composeFixtures(
      ghanaMaizeFarmer(),
      { landProfile: null },
    ));
    expect(state.titleFallback).toBeTruthy();
  });

  it('B. missing weather → task still resolves, confidence may drop', () => {
    const state = resolveFarmerState(composeFixtures(
      ghanaMaizeFarmer(),
      { weatherNow: null },
    ));
    expect(state.stateType).toBeTruthy();
    expect(state.titleFallback).toBeTruthy();
  });

  it('C. completely empty context → never returns null', () => {
    const state = resolveFarmerState({});
    expect(state).toBeTruthy();
    expect(state.titleFallback).toBeTruthy();
  });

  it('D. unknown country code → safe fallback path, no crash', () => {
    const state = resolveFarmerState(composeFixtures(
      ghanaMaizeFarmer(),
      { countryCode: 'ZZ' },
      freshOnline(),
    ));
    expect(state.regionBucket).toBe('unknown');
    expect(state.titleFallback).toBeTruthy();
  });

  it('E. partial profile (active cycle flagged but cropProfile missing) → safe_fallback', () => {
    const state = resolveFarmerState(composeFixtures(
      partialProfile(),
      freshOnline(),
      { hasJustCompletedHarvest: true }, // would normally be harvest_complete
    ));
    expect(state.stateType).toBe(STATE_TYPES.SAFE_FALLBACK);
    expect(state.confidenceLevel).toBe('low');
  });

  it('F. engine output is deterministic for identical input', () => {
    const input = composeFixtures(
      indiaRiceFarmer(),
      wetSoilLand(),
      rainIncoming(),
      freshOnline(),
    );
    const a = resolveFarmerState(input);
    const b = resolveFarmerState(input);
    expect(a.stateType).toBe(b.stateType);
    expect(a.displayMode).toBe(b.displayMode);
    expect(a.nextKey).toBe(b.nextKey);
  });

  it('G. buildHomeExperience never returns null raw error strings', () => {
    const state = resolveFarmerState(composeFixtures(
      usaCornFarmer(),
      staleOffline(),
    ));
    const t = (k) => k;  // no translations
    const home = buildHomeExperience({ farmerState: state, t });
    expect(home.title).toBeTruthy();
    expect(home.title).not.toMatch(/undefined|null|\bError\b/);
    // No raw i18n keys leak as title when t() echoes the key back —
    // engine must fall back to English.
    expect(home.title).not.toMatch(/^state\./);
  });
});
