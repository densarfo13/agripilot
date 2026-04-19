/**
 * stateConfidence.js — scores how certain the app should sound
 * given the currently resolved state.
 *
 *   scoreStateConfidence(ctx) → { level, score, reasons[] }
 *
 * Scoring uses the same boring style as taskConfidence.js:
 *   • start at 50
 *   • add/subtract per signal
 *   • ≥75 HIGH, ≥45 MEDIUM, <45 LOW
 *
 * The numeric score NEVER leaks to the farmer — the wording
 * adapter uses only `level`. The score is kept in the object so
 * tests can lock the contribution of each rule.
 *
 * Signals (rule-based, bounded):
 *   • explicit land signals (uncleared, weeds, wet soil) → +confidence
 *   • crop stage resolved and matches context → +confidence
 *   • stale offline data → big drop
 *   • conflicting land/weather/stage → big drop
 *   • camera unknown/low-light → drop
 *   • camera clear finding → boost
 *   • recent correction/undo → drop for certainty-sensitive states
 *   • missing upstream data → drop
 */

const HIGH_THRESHOLD   = 75;
const MEDIUM_THRESHOLD = 45;

const CERTAINTY_SENSITIVE = new Set([
  'harvest_complete', 'post_harvest',
  'blocked_by_land', 'field_reset',
]);

const CAMERA_CLEAR     = new Set(['pest_detected', 'disease_detected', 'nutrient_deficiency_detected']);
const CAMERA_UNCERTAIN = new Set(['unknown_issue', 'low_light', 'blurry']);

const LAND_BLOCKERS = new Set([
  'uncleared_land', 'weeds_present', 'wet_soil', 'stones_present', 'unprepared_ridges',
]);

const RECENT_CORRECTION_TYPES = new Set([
  'state_reopened', 'state_undone', 'harvest_reopened', 'task_reopened',
]);

export function scoreStateConfidence(ctx = {}) {
  const safe = ctx || {};
  let score = 50;
  const reasons = [];

  const stateType = String(safe.stateType || '').toLowerCase();

  // ─── LAND SIGNAL QUALITY ──────────────────────────
  const land = safe.landProfile || null;
  if (land) {
    const blocker = String(land.blocker || '').toLowerCase();
    if (LAND_BLOCKERS.has(blocker)) {
      const src = String(land.source || '').toLowerCase();
      if (src === 'question' || !src) { score += 20; reasons.push('land_blocker_explicit'); }
      else if (src === 'photo')       { score += 12; reasons.push('land_blocker_photo'); }
    }
    if (land.moisture === 'wet')   { score += 8;  reasons.push('wet_soil_signal'); }
    if (land.cleared === false)    { score += 6;  reasons.push('uncleared_signal'); }
    if (land.moisture === 'unknown' || land.moisture === undefined) {
      score -= 8; reasons.push('land_moisture_missing');
    }
  } else {
    score -= 10; reasons.push('land_profile_missing');
  }

  // ─── CROP STAGE RESOLUTION ────────────────────────
  const stage = String(safe.cropProfile?.stage || '').toLowerCase();
  if (stage && stage !== 'unknown') {
    score += 10; reasons.push('stage_resolved');
  } else {
    score -= 10; reasons.push('stage_missing');
  }

  // ─── WEATHER / CONFLICT ───────────────────────────
  // Weather only matters for states that actually depend on it.
  // A completed harvest doesn't need a forecast to feel confident.
  const weatherSensitiveStates = new Set([
    'active_cycle', 'weather_sensitive', 'blocked_by_land', 'first_use',
  ]);
  const weather = safe.weatherNow || null;
  if (!weather && weatherSensitiveStates.has(stateType)) {
    score -= 8; reasons.push('weather_missing');
  } else if (weather) {
    // conflict: planting intent + wet land + no rain risk = contradiction
    const rainHigh = weather.rainRisk === 'high' || Number(weather.rainMmNext24h) >= 25;
    if (stage === 'planting' && land?.moisture === 'wet' && !rainHigh) {
      score -= 25; reasons.push('conflict_planting_vs_wet_soil');
    }
    if (stateType === 'weather_sensitive' && (rainHigh
      || weather.heatRisk === 'high' || Number(weather.tempHighC) >= 35)) {
      score += 12; reasons.push('weather_signal_strong');
    }
  }

  // ─── CAMERA SIGNAL QUALITY ────────────────────────
  const camType = String(safe.cameraTask?.type || '').toLowerCase();
  if (camType) {
    if (CAMERA_CLEAR.has(camType))          { score += 15; reasons.push('camera_clear'); }
    else if (CAMERA_UNCERTAIN.has(camType)) { score -= 18; reasons.push('camera_uncertain'); }
  }

  // ─── STALE OFFLINE ────────────────────────────────
  const offlineAndStale = safe.offlineState?.isOffline === true
    && ageMs(safe.lastUpdatedAt) > 6 * 60 * 60 * 1000;
  if (stateType === 'stale_offline' || offlineAndStale) {
    score -= 25; reasons.push('stale_offline');
  }

  // ─── RECENT CORRECTIONS / UNDO ────────────────────
  const recentEvents = Array.isArray(safe.recentEvents) ? safe.recentEvents : [];
  const corrections = recentEvents.filter((e) => RECENT_CORRECTION_TYPES.has(String(e?.type || '')));
  if (corrections.length > 0 && CERTAINTY_SENSITIVE.has(stateType)) {
    score -= Math.min(25, 10 + corrections.length * 5);
    reasons.push('recent_corrections');
  }

  // ─── MISSING UPSTREAM DATA ────────────────────────
  if (!safe.cropProfile && !safe.landProfile && !safe.weatherNow) {
    score -= 15; reasons.push('upstream_data_sparse');
  }

  // ─── CONFLICT: post_harvest but land uncleared ────
  if (stateType === 'post_harvest' && land?.cleared === false) {
    score -= 15; reasons.push('conflict_post_harvest_uncleared');
  }

  // ─── USER-REPORTED CORROBORATION ──────────────────
  // If the farmer themselves reported the event, that's a
  // stronger corroborating signal than anything we could infer
  // from sensors or weather.
  if (safe.hasJustCompletedHarvest === true
      && (stateType === 'harvest_complete' || stateType === 'post_harvest')) {
    score += 15; reasons.push('user_reported_harvest_complete');
  }
  if (safe.hasCompletedOnboarding === true && safe.hasActiveCropCycle === true) {
    score += 5; reasons.push('user_profile_complete');
  }

  // Clamp and classify.
  score = Math.max(0, Math.min(100, score));
  const level = score >= HIGH_THRESHOLD ? 'high'
              : score >= MEDIUM_THRESHOLD ? 'medium'
              : 'low';

  return { level, score, reasons };
}

function ageMs(lastUpdatedAt) {
  if (lastUpdatedAt == null) return Infinity;
  const ts = typeof lastUpdatedAt === 'number'
    ? lastUpdatedAt
    : Date.parse(String(lastUpdatedAt));
  if (!Number.isFinite(ts)) return Infinity;
  return Date.now() - ts;
}

export const _internal = {
  HIGH_THRESHOLD, MEDIUM_THRESHOLD, CERTAINTY_SENSITIVE,
  CAMERA_CLEAR, CAMERA_UNCERTAIN, LAND_BLOCKERS, RECENT_CORRECTION_TYPES,
};
