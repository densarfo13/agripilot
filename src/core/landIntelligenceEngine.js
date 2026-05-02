/**
 * landIntelligenceEngine.js — turn land facts (size + location +
 * crop + weather) into context that drives tasks, scan
 * interpretation, and recommendations.
 *
 *   import { landIntelligenceEngine } from '../core/landIntelligenceEngine.js';
 *   const ctx = landIntelligenceEngine({
 *     sizeSqFt, displayUnit, country, region,
 *     cropName, plantName, activeExperience, weather,
 *   });
 *   ctx.scaleType        // 'small' | 'medium' | 'large' | 'commercial'
 *   ctx.riskProfile      // ['fungal_risk', 'heat_stress', ...]
 *   ctx.recommendedTaskType
 *   ctx.scanContextAdjustment
 *   ctx.suggestedActions
 *
 * Strict-rule audit
 *   * Pure function. No I/O. No React. Never throws — every input
 *     branch is wrapped + falls through to safe defaults.
 *   * Coexists with `hybridScanEngine.js` (image+weather+experience
 *     refinement) and `dailyIntelligenceEngine.js` (task generator).
 *     This module sits ABOVE both — it provides the LAND-context
 *     layer they each consume.
 *   * Spec §2 thresholds locked: <10k sqft = small, <10ac = medium,
 *     <100ac = large, ≥100ac = commercial. Garden experience
 *     always reports 'small' regardless of size.
 *   * Offline-safe: missing weather → empty risk profile; missing
 *     size → 'small' default; missing experience → 'farm' tier
 *     (the more conservative default).
 */

// ── Scale classification (spec §2) ────────────────────────────
//
// One acre = 43,560 sq ft. Thresholds expressed in sq ft so the
// caller passes the canonical landSizeSqFt directly.
const ACRE_SQFT       = 43_560;
const SMALL_MAX_SQFT  = 10_000;            // backyard / kitchen plot
const MEDIUM_MAX_SQFT = 10  * ACRE_SQFT;   // 435,600 — smallholder
const LARGE_MAX_SQFT  = 100 * ACRE_SQFT;   // 4,356,000 — small commercial

const SCALE = Object.freeze({
  SMALL:      'small',
  MEDIUM:     'medium',
  LARGE:      'large',
  COMMERCIAL: 'commercial',
});

/**
 * getScaleType(sizeSqFt, activeExperience) → spec §2.
 *
 * Garden experience always reports 'small' — the size value
 * (often a S/M/L category, not a number) is irrelevant for a
 * backyard plot's task / scan adaptation.
 */
export function getScaleType(sizeSqFt, activeExperience) {
  const exp = String(activeExperience || '').toLowerCase();
  if (exp === 'garden' || exp === 'backyard') return SCALE.SMALL;

  const n = Number(sizeSqFt);
  if (!Number.isFinite(n) || n <= 0) return SCALE.SMALL;
  if (n <  SMALL_MAX_SQFT)  return SCALE.SMALL;
  if (n <  MEDIUM_MAX_SQFT) return SCALE.MEDIUM;
  if (n <  LARGE_MAX_SQFT)  return SCALE.LARGE;
  return SCALE.COMMERCIAL;
}

// ── Recommended task type (spec §3) ───────────────────────────
//
// Lookup table — tasks change shape with scale. The adapter
// returns short labels so the daily-task surface can localise
// via i18n keys. Each label is short, action-framed, and
// safe (no chemistry, no exact dosing).
const TASKS_BY_SCALE = Object.freeze({
  [SCALE.SMALL]: [
    'Check your plant leaves',
    'Water if soil is dry',
  ],
  [SCALE.MEDIUM]: [
    'Check multiple areas of your farm',
    'Monitor irrigation',
  ],
  [SCALE.LARGE]: [
    'Scout crop rows systematically',
    'Check for spread across sections',
  ],
  [SCALE.COMMERCIAL]: [
    'Scout crop rows systematically',
    'Check for spread across sections',
  ],
});

export function getTasksByScale(scaleType) {
  return (TASKS_BY_SCALE[scaleType] || TASKS_BY_SCALE[SCALE.SMALL]).slice();
}

// ── Weather / region risk profile (spec §4) ───────────────────
//
// Pure derivation. Weather can be missing entirely (offline
// boot, denied geolocation) — risk profile is then [].
const RISK = Object.freeze({
  FUNGAL_RISK:  'fungal_risk',
  HEAT_STRESS:  'heat_stress',
  WATER_STRESS: 'water_stress',
  COLD_STRESS:  'cold_stress',
});

export function getRiskProfile(weather /* , region */) {
  const out = [];
  if (!weather || typeof weather !== 'object') return out;

  const humidity   = Number(weather.humidity ?? weather.relativeHumidity);
  const temperatureC = Number(weather.temperatureC ?? weather.tempC ?? weather.temp ?? weather.temperature);
  const rainMm     = Number(weather.rainMm ?? weather.precipitationMm ?? weather.rain);
  const recentRain = Boolean(weather.recentRain ?? weather.rainedRecently);

  if (Number.isFinite(humidity)   && humidity   > 70)              out.push(RISK.FUNGAL_RISK);
  if (Number.isFinite(temperatureC) && temperatureC > 30)          out.push(RISK.HEAT_STRESS);
  if (recentRain || (Number.isFinite(rainMm) && rainMm >= 5))      out.push(RISK.WATER_STRESS);
  if (Number.isFinite(temperatureC) && temperatureC <= 5)          out.push(RISK.COLD_STRESS);

  return out;
}

// ── Scan context adjustment (spec §5) ─────────────────────────
//
// Returns ADDITIONAL actions to append to a scan result based on
// the active scale. The caller (hybridScanEngine + ScanPage)
// merges these into `recommendedActions` after the existing
// garden/farm action tables.
const SCAN_ADJUST_BY_SCALE = Object.freeze({
  [SCALE.SMALL]:      ['Remove affected leaves'],
  [SCALE.MEDIUM]:     ['Check the rest of the plot for similar signs'],
  [SCALE.LARGE]:      ['Check nearby crop rows'],
  [SCALE.COMMERCIAL]: ['Check nearby crop rows', 'Record affected field area'],
});

export function getScanContextAdjustment(scaleType) {
  return (SCAN_ADJUST_BY_SCALE[scaleType] || SCAN_ADJUST_BY_SCALE[SCALE.SMALL]).slice();
}

/**
 * adjustScanResult(scanResult, scaleType) — non-mutating
 * helper. Returns a NEW scan-result object with the scale-
 * specific actions appended (deduped against existing).
 */
export function adjustScanResult(scanResult, scaleType) {
  if (!scanResult || typeof scanResult !== 'object') return scanResult;
  const adjustments = getScanContextAdjustment(scaleType);
  const existing = Array.isArray(scanResult.recommendedActions)
    ? scanResult.recommendedActions.slice()
    : (Array.isArray(scanResult.actions) ? scanResult.actions.slice() : []);
  const seen = new Set(existing.map((s) => String(s || '').trim().toLowerCase()));
  for (const add of adjustments) {
    const k = String(add || '').trim().toLowerCase();
    if (k && !seen.has(k)) {
      existing.push(add);
      seen.add(k);
    }
  }
  return { ...scanResult, recommendedActions: existing };
}

// ── Action enrichment (spec §6) ───────────────────────────────
//
// Combines scale + risk profile into a flat list of safe
// actions the caller can either replace OR append to its
// existing recommendation set.
const RISK_ACTIONS = Object.freeze({
  [RISK.FUNGAL_RISK]:  'Avoid wetting leaves',
  [RISK.HEAT_STRESS]:  'Check soil moisture',
  [RISK.WATER_STRESS]: 'Hold off on watering for 24 hours',
  [RISK.COLD_STRESS]:  'Cover sensitive plants tonight or move pots indoors',
});

export function enrichActions(scaleType, riskProfile) {
  const out = [];
  const seen = new Set();
  const safeProfile = Array.isArray(riskProfile) ? riskProfile : [];
  for (const r of safeProfile) {
    const action = RISK_ACTIONS[r];
    if (!action) continue;
    const k = action.toLowerCase();
    if (seen.has(k)) continue;
    out.push(action);
    seen.add(k);
  }
  if (scaleType === SCALE.LARGE || scaleType === SCALE.COMMERCIAL) {
    if (!seen.has('monitor spread across field sections')) {
      out.push('Monitor spread across field sections');
    }
  }
  return out;
}

// ── Recommended task type (spec §3 + §7) ──────────────────────
//
// Single label the daily-task surface can read to decide which
// task generator to favour: 'home_garden' vs 'small_farm' vs
// 'commercial_farm'. Mirrors the existing taxonomy in
// `farmTypeBehavior.js` so consumers don't need a new switch.
function _recommendedTaskType(scaleType) {
  if (scaleType === SCALE.SMALL)      return 'home_garden';
  if (scaleType === SCALE.MEDIUM)     return 'small_farm';
  return 'commercial_farm';
}

// ── Public entry (spec §1) ────────────────────────────────────
/**
 * landIntelligenceEngine(input) → land-context bundle.
 *
 * @param {object} input
 * @param {number} [input.sizeSqFt]
 * @param {string} [input.displayUnit]
 * @param {string} [input.country]
 * @param {string} [input.region]
 * @param {string} [input.cropName]
 * @param {string} [input.plantName]
 * @param {string} [input.activeExperience]   'garden' | 'farm'
 * @param {object} [input.weather]            { temperatureC, humidity, rainMm, recentRain, ... }
 * @returns {{
 *   scaleType: string,
 *   riskProfile: string[],
 *   recommendedTaskType: string,
 *   scanContextAdjustment: string[],
 *   suggestedActions: string[],
 *   meta: { sizeSqFt, country, region, crop, experience }
 * }}
 */
export function landIntelligenceEngine(input = {}) {
  const safe = (input && typeof input === 'object') ? input : {};

  const scaleType    = getScaleType(safe.sizeSqFt, safe.activeExperience);
  const riskProfile  = getRiskProfile(safe.weather, safe.region);
  const taskActions  = getTasksByScale(scaleType);
  const enriched     = enrichActions(scaleType, riskProfile);
  const scanAdjust   = getScanContextAdjustment(scaleType);

  // suggestedActions = task actions + risk-driven enrichment,
  // deduped by case-insensitive equality.
  const seen = new Set();
  const suggestedActions = [];
  for (const a of [...taskActions, ...enriched]) {
    const k = String(a || '').trim().toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    suggestedActions.push(a);
  }

  return {
    scaleType,
    riskProfile,
    recommendedTaskType:    _recommendedTaskType(scaleType),
    scanContextAdjustment:  scanAdjust,
    suggestedActions,
    meta: {
      sizeSqFt:   Number.isFinite(Number(safe.sizeSqFt)) ? Number(safe.sizeSqFt) : null,
      country:    safe.country    || null,
      region:     safe.region     || null,
      crop:       safe.cropName   || safe.plantName || null,
      experience: String(safe.activeExperience || '').toLowerCase() || null,
    },
  };
}

export const SCALE_TYPES = SCALE;
export const RISK_TYPES  = RISK;
export const _internal = Object.freeze({
  ACRE_SQFT, SMALL_MAX_SQFT, MEDIUM_MAX_SQFT, LARGE_MAX_SQFT,
  TASKS_BY_SCALE, SCAN_ADJUST_BY_SCALE, RISK_ACTIONS,
  _recommendedTaskType,
});

export default landIntelligenceEngine;
