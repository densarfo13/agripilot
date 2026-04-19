/**
 * classifyStateCandidates.js — reads the raw context and returns
 * every state type whose conditions are currently met.
 *
 * The caller then feeds the result into pickByPriority to get a
 * single winner. Validation overrides run on top of that winner.
 *
 * Context fields used:
 *   farmerProfile, cropProfile, landProfile, countryCode, month,
 *   weatherNow, cameraTask, recentEvents, offlineState, lastUpdatedAt,
 *   hasCompletedOnboarding, hasActiveCropCycle
 */

import { STATE_TYPES } from './statePriority.js';

const STALE_OFFLINE_THRESHOLD_MS = 6 * 60 * 60 * 1000;  // 6h
const RETURNING_INACTIVE_DAYS    = 3;

const CAMERA_UNCERTAIN = new Set(['unknown_issue', 'low_light', 'blurry']);
const CAMERA_CLEAR     = new Set(['pest_detected', 'disease_detected', 'nutrient_deficiency_detected']);

const LAND_BLOCKERS = new Set([
  'uncleared_land', 'weeds_present', 'wet_soil', 'stones_present', 'unprepared_ridges',
]);

/**
 * classifyStateCandidates — returns an array of candidate
 * stateType strings ordered by the order they were detected.
 * `pickByPriority` reorders by canonical priority afterwards.
 */
export function classifyStateCandidates(ctx = {}) {
  const safe = ctx || {};
  const out = [];

  // ─── camera ─────────────────────────────────────────
  const camType = String(safe.cameraTask?.type || '').toLowerCase();
  if (CAMERA_CLEAR.has(camType) || CAMERA_UNCERTAIN.has(camType)) {
    out.push(STATE_TYPES.CAMERA_ISSUE);
  }

  // ─── stale offline ─────────────────────────────────
  if (safe.offlineState?.isOffline === true) {
    const age = ageMs(safe.lastUpdatedAt);
    if (age != null && age >= STALE_OFFLINE_THRESHOLD_MS) {
      out.push(STATE_TYPES.STALE_OFFLINE);
    }
  }

  // ─── blocked by land ────────────────────────────────
  const blocker = String(safe.landProfile?.blocker || '').toLowerCase();
  if (LAND_BLOCKERS.has(blocker)) {
    out.push(STATE_TYPES.BLOCKED_BY_LAND);
  }
  // A "planting intent but wet soil" situation is also a blocker.
  const stage = String(safe.cropProfile?.stage || '').toLowerCase();
  if (stage === 'planting' && safe.landProfile?.moisture === 'wet') {
    out.push(STATE_TYPES.BLOCKED_BY_LAND);
  }

  // ─── harvest states ─────────────────────────────────
  if (safe.hasJustCompletedHarvest === true) {
    out.push(STATE_TYPES.HARVEST_COMPLETE);
  }
  if (safe.cropProfile?.stage === 'post_harvest'
      || safe.cropProfile?.phase === 'post_harvest') {
    out.push(STATE_TYPES.POST_HARVEST);
  }

  // ─── weather ────────────────────────────────────────
  const rainHigh = safe.weatherNow?.rainRisk === 'high'
    || Number(safe.weatherNow?.rainMmNext24h) >= 25;
  const heatHigh = safe.weatherNow?.heatRisk === 'high'
    || Number(safe.weatherNow?.tempHighC) >= 35;
  if (rainHigh || heatHigh) {
    out.push(STATE_TYPES.WEATHER_SENSITIVE);
  }

  // ─── first use ──────────────────────────────────────
  if (safe.hasCompletedOnboarding !== true || safe.hasActiveCropCycle !== true) {
    out.push(STATE_TYPES.FIRST_USE);
  }

  // ─── returning inactive ─────────────────────────────
  const missedDays = Number(safe.missedDays) || 0;
  if (missedDays >= RETURNING_INACTIVE_DAYS || safe.hasCatchUpState === true) {
    out.push(STATE_TYPES.RETURNING_INACTIVE);
  }

  // ─── active cycle ───────────────────────────────────
  if (safe.hasActiveCropCycle === true && safe.cropProfile?.stage && stage !== 'off_season') {
    out.push(STATE_TYPES.ACTIVE_CYCLE);
  }

  // ─── off-season ─────────────────────────────────────
  if (stage === 'off_season' || safe.cropProfile?.seasonStatus === 'off_season') {
    out.push(STATE_TYPES.OFF_SEASON);
  }

  // ─── always include safe_fallback ──────────────────
  out.push(STATE_TYPES.SAFE_FALLBACK);

  return out;
}

// ─── internals ────────────────────────────────────────────
function ageMs(lastUpdatedAt) {
  if (lastUpdatedAt == null) return null;
  const ts = typeof lastUpdatedAt === 'number'
    ? lastUpdatedAt
    : Date.parse(String(lastUpdatedAt));
  if (!Number.isFinite(ts)) return null;
  return Date.now() - ts;
}

export const _internal = {
  STALE_OFFLINE_THRESHOLD_MS,
  RETURNING_INACTIVE_DAYS,
  CAMERA_UNCERTAIN,
  CAMERA_CLEAR,
  LAND_BLOCKERS,
};
