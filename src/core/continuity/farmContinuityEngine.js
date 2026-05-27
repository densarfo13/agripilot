/**
 * farmContinuityEngine.js — single source of truth for cross-screen
 * continuity reading FROM activeFarm only.
 *
 *   import { buildFarmContinuity }
 *     from 'src/core/continuity/farmContinuityEngine.js';
 *
 *   const v = buildFarmContinuity(activeFarm, { locale });
 *
 *   v = {
 *     continuityInsight,  — single calm "what's happening" line
 *     oneBestAction,      — single primary action
 *     reason,             — why this action
 *     followUp,           — what to monitor next
 *     localizedCropName,  — direct passthrough (already normalized)
 *     locationDisplay,    — direct passthrough (already normalized)
 *     engineVersion: 'farm-continuity-v1', generatedAt,
 *   }
 *
 * What this is
 * ────────────
 *   The single composer EVERY surface reads from. Replaces the
 *   scattered screen-specific continuity logic each page had been
 *   evolving on its own.
 *
 *   Inputs: activeFarm ONLY. No localStorage reads here, no
 *   onboarding drafts, no scan-specific crop state — those have
 *   all been normalised into activeFarm by farmContextStore.
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws. SSR-safe.
 *   • Every visible string is `{key, fallback, params}`.
 *   • No raw probabilities, no AI wording.
 */

const ENGINE_VERSION = 'farm-continuity-v1';

const _isObj = (v) => v != null && typeof v === 'object';
const _str   = (v) => (typeof v === 'string' ? v : '');
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };

// ─── Sub-builders ────────────────────────────────────────────

function _continuityInsightFor(farm) {
  // Stage signals
  const stage = _str(farm.lifecycleStage || farm.stage).toLowerCase();
  const crop = _str(farm.localizedCropName) || _str(farm.cropId);
  if (stage === 'harvest') {
    return Object.freeze({
      key:      'farmContinuity.insight.harvest',
      fallback: 'Your {crop} is at harvest stage.',
      params:   { crop: crop || 'crop' },
    });
  }
  if (stage === 'flowering' || stage === 'fruiting') {
    return Object.freeze({
      key:      'farmContinuity.insight.activeStage',
      fallback: 'Your {crop} is in an active growth stage.',
      params:   { crop: crop || 'crop', stage },
    });
  }
  if (stage === 'land_prep' || stage === 'planting' || stage === 'germination') {
    return Object.freeze({
      key:      'farmContinuity.insight.earlyStage',
      fallback: 'Your {crop} journey is just getting started.',
      params:   { crop: crop || 'crop' },
    });
  }
  if (crop) {
    return Object.freeze({
      key:      'farmContinuity.insight.cropStarted',
      fallback: '{crop} care journey started.',
      params:   { crop },
    });
  }
  return null;
}

function _oneBestActionFor(farm) {
  const crop = _str(farm.localizedCropName) || _str(farm.cropId);
  // If no scans yet, the calm prompt is to start tracking.
  const scans = Array.isArray(farm.scanHistory) ? farm.scanHistory : [];
  if (scans.length === 0 && crop) {
    return Object.freeze({
      key:      'farmContinuity.action.firstScan',
      fallback: 'Scan {crop} leaves to start health tracking.',
      params:   { crop },
    });
  }
  // Default operational nudge.
  return Object.freeze({
    key:      'farmContinuity.action.walkField',
    fallback: 'Walk your field and check crop health.',
  });
}

function _reasonFor(farm) {
  const scans = Array.isArray(farm.scanHistory) ? farm.scanHistory : [];
  if (scans.length === 0) {
    return Object.freeze({
      key:      'farmContinuity.reason.firstScan',
      fallback: 'Your first scan establishes the baseline for everything that follows.',
    });
  }
  return Object.freeze({
    key:      'farmContinuity.reason.routine',
    fallback: 'A quick daily check keeps small problems from becoming big ones.',
  });
}

function _followUpFor(farm) {
  const scans = Array.isArray(farm.scanHistory) ? farm.scanHistory : [];
  if (scans.length === 0) return null;
  return Object.freeze({
    key:      'farmContinuity.followUp.rescan',
    fallback: 'Re-scan any plant that looked off in the next few days.',
  });
}

// ─── Public ──────────────────────────────────────────────────

/**
 * Compose the cross-screen continuity envelope from activeFarm.
 * Always returns an envelope.
 *
 * @param {object} activeFarm — output of getActiveFarm()
 * @param {object} [opts]     — { locale }
 */
export function buildFarmContinuity(activeFarm, opts) {
  return _safe(() => {
    if (!_isObj(activeFarm)) return _emptyEnvelope();
    const o = _isObj(opts) ? opts : {};
    const locale = _str(o.locale) || null;

    return Object.freeze({
      engineVersion:     ENGINE_VERSION,
      continuityInsight: _continuityInsightFor(activeFarm),
      oneBestAction:     _oneBestActionFor(activeFarm),
      reason:            _reasonFor(activeFarm),
      followUp:          _followUpFor(activeFarm),
      localizedCropName: _str(activeFarm.localizedCropName) || null,
      locationDisplay:   _str(activeFarm.location) || null,
      locale,
      generatedAt:       Date.now(),
    });
  }, _emptyEnvelope());
}

function _emptyEnvelope() {
  return Object.freeze({
    engineVersion:     ENGINE_VERSION,
    continuityInsight: null,
    oneBestAction: Object.freeze({
      key:      'farmContinuity.action.walkField',
      fallback: 'Walk your field and check crop health.',
    }),
    reason: Object.freeze({
      key:      'farmContinuity.reason.routine',
      fallback: 'A quick daily check keeps small problems from becoming big ones.',
    }),
    followUp:          null,
    localizedCropName: null,
    locationDisplay:   null,
    locale:            null,
    generatedAt:       Date.now(),
  });
}

export const _internal = Object.freeze({
  _continuityInsightFor, _oneBestActionFor, _reasonFor, _followUpFor,
  ENGINE_VERSION,
});

const _module = { buildFarmContinuity, _internal };
export default _module;
