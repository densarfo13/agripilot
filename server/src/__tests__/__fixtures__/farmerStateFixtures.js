/**
 * farmerStateFixtures.js — reusable scenario-based fixtures for
 * the behavioral / confidence / trust test packs.
 *
 * Each fixture is a small plain object that contributes a few
 * fields to the farmer-state engine's context. Tests compose
 * them via `composeFixtures(a, b, c, ...)` which does a shallow
 * spread at the top level and a deep merge on the specific
 * nested objects the engine reads (landProfile, cropProfile,
 * weatherNow, offlineState, cameraTask).
 *
 * Keep fixtures small. Don't add end-to-end scenarios here —
 * those belong in the test files that compose the fixtures.
 */

const HOUR = 60 * 60 * 1000;
const DAY  = 24 * HOUR;

// ─── Connection / freshness ──────────────────────────────
export const freshOnline = () => ({
  offlineState: { isOffline: false },
  lastUpdatedAt: Date.now(),
});

export const staleOffline = () => ({
  offlineState: { isOffline: true },
  lastUpdatedAt: Date.now() - 24 * HOUR,
});

export const freshOffline = () => ({
  offlineState: { isOffline: true },
  lastUpdatedAt: Date.now() - 10 * 60 * 1000, // 10 min
});

// ─── Canonical farmer profiles ──────────────────────────
// India — rice, monsoon region, planting window
export const indiaRiceFarmer = () => ({
  countryCode: 'IN',
  cropProfile: { stage: 'planting', name: 'rice' },
  landProfile: { moisture: 'wet', cleared: true },
  weatherNow:  { rainRisk: 'high', rainMmNext24h: 30 },
  hasCompletedOnboarding: true,
  hasActiveCropCycle: true,
  primaryTaskId: 't-plant-rice',
});

// Ghana — maize, tropical manual region, mid-cycle
export const ghanaMaizeFarmer = () => ({
  countryCode: 'GH',
  cropProfile: { stage: 'growing', name: 'maize' },
  landProfile: { moisture: 'dry', cleared: true },
  weatherNow:  { rainRisk: 'low', heatRisk: 'low' },
  hasCompletedOnboarding: true,
  hasActiveCropCycle: true,
  primaryTaskId: 't-scout-maize',
});

// USA — corn, temperate mechanized region, early season
export const usaCornFarmer = () => ({
  countryCode: 'US',
  cropProfile: { stage: 'planting', name: 'corn' },
  landProfile: { moisture: 'dry', cleared: true },
  weatherNow:  { rainRisk: 'low', heatRisk: 'low' },
  hasCompletedOnboarding: true,
  hasActiveCropCycle: true,
  primaryTaskId: 't-plant-corn',
});

// ─── Land conditions ────────────────────────────────────
export const unclearedLand = () => ({
  landProfile: {
    cleared: false,
    blocker: 'uncleared_land',
    source:  'question',
  },
});

export const wetSoilLand = () => ({
  landProfile: {
    moisture: 'wet',
    blocker:  'wet_soil',
    source:   'question',
    cleared:  true,
  },
});

export const poorDrainageLand = () => ({
  landProfile: {
    moisture: 'wet',
    blocker:  'wet_soil',
    drainage: 'poor',
    source:   'question',
    cleared:  true,
  },
});

export const photoOnlyLand = () => ({
  landProfile: {
    blocker:  'wet_soil',
    source:   'photo',
    moisture: 'wet',
  },
});

export const tidyLand = () => ({
  landProfile: {
    cleared: true, moisture: 'dry',
    source:  'question',
  },
});

// ─── Camera states ──────────────────────────────────────
export const cameraKnownIssue = () => ({
  cameraTask: { type: 'pest_detected', detail: 'aphid' },
});

export const cameraUnknownIssue = () => ({
  cameraTask: { type: 'unknown_issue' },
});

export const cameraBlurry = () => ({
  cameraTask: { type: 'blurry' },
});

// ─── Harvest + cycle ────────────────────────────────────
export const completedHarvest = () => ({
  hasJustCompletedHarvest: true,
  cropProfile: { stage: 'harvest', name: 'maize' },
  landProfile: { cleared: true, moisture: 'dry' },
});

export const postHarvestUncleared = () => ({
  cropProfile: { stage: 'post_harvest', name: 'maize' },
  landProfile: { cleared: false, blocker: 'uncleared_land' },
});

// ─── Behavioral ─────────────────────────────────────────
export const returningInactive = () => ({
  missedDays: 5,
  hasCompletedOnboarding: true,
  hasActiveCropCycle: true,
});

export const returningLongInactive = () => ({
  missedDays: 14,
  hasCompletedOnboarding: true,
  hasActiveCropCycle: true,
});

export const recentUndoHeavy = () => ({
  recentEvents: [
    { type: 'harvest_reopened', timestamp: Date.now() - 1 * HOUR },
    { type: 'state_reopened',   timestamp: Date.now() - 2 * HOUR },
    { type: 'task_reopened',    timestamp: Date.now() - 3 * HOUR },
  ],
});

// ─── Weather ────────────────────────────────────────────
export const heatWave = () => ({
  weatherNow: { heatRisk: 'high', tempHighC: 38, rainRisk: 'low' },
});

export const rainIncoming = () => ({
  weatherNow: { rainRisk: 'high', rainMmNext24h: 35 },
});

// ─── First use / onboarding gaps ────────────────────────
export const newUser = () => ({
  hasCompletedOnboarding: false,
  hasActiveCropCycle: false,
});

export const partialProfile = () => ({
  hasCompletedOnboarding: true,
  hasActiveCropCycle: true,
  cropProfile: null,     // missing despite active cycle flag
});

// ─── Compose helper ─────────────────────────────────────
const NESTED_KEYS = [
  'landProfile', 'cropProfile', 'weatherNow',
  'offlineState', 'cameraTask',
];

/**
 * composeFixtures(...parts) — deep-merges nested config objects
 * so stacked fixtures don't blow away each other's
 * landProfile / cropProfile / weatherNow fields.
 */
export function composeFixtures(...parts) {
  const out = {};
  for (const part of parts) {
    if (!part) continue;
    for (const [k, v] of Object.entries(part)) {
      if (NESTED_KEYS.includes(k) && out[k] && v && typeof v === 'object' && !Array.isArray(v)) {
        out[k] = { ...out[k], ...v };
      } else {
        out[k] = v;
      }
    }
  }
  return out;
}
