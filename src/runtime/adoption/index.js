/**
 * runtime/adoption/index.js — Phase 13 farmer-adoption composite.
 *
 *   import {
 *     farmerAdoption,
 *     installFarmerAdoptionGlobal,
 *     FARMER_ADOPTION_VERSION,
 *   } from 'src/runtime/adoption/index.js';
 *
 * What this is
 * ────────────
 *   Single chokepoint for the Phase 13 sub-engines. Runs them all
 *   and returns one frozen envelope so the UI / QA / wave-8
 *   notifications runtime can introspect adoption state from one
 *   spot:
 *
 *     {
 *       runtimeVersion, generatedAt,
 *       onboarding,           // computeOnboardingScore
 *       firstSevenDays,       // computeFirstSevenDays
 *       referral,             // computeReferralState
 *       weeklyReport,         // composeWeeklyReport
 *       community,            // computeCommunityIntelligence
 *       notifications,        // composeSmartNotifications
 *       retention,            // computeRetentionAnalytics
 *       deferred,             // backend-required items, named
 *     }
 *
 *   Composition-only. No engines mutated; no persistence writes.
 *   The wave-5 single-writer invariant is preserved — engines emit
 *   envelopes only.
 */

import { computeOnboardingScore, ONBOARDING_STEPS } from './onboardingScore.js';
import { computeFirstSevenDays, DAY_MILESTONES }    from './firstSevenDays.js';
import {
  computeReferralState, REFERRAL_BADGES, REWARD_KIND,
} from './referralEngine.js';
import { composeWeeklyReport }   from './weeklyReport.js';
import {
  computeCommunityIntelligence, COMMUNITY_CHALLENGE_KIND,
} from './communityIntelligence.js';
import {
  composeSmartNotifications, NOTIFICATION_KIND, NOTIFICATION_COOLDOWN_MS,
} from './smartNotifications.js';
import {
  computeRetentionAnalytics, RETENTION_DAYS,
} from './retentionAnalytics.js';

export const FARMER_ADOPTION_VERSION = 'farmer-adoption-v1';

const _isObj = (v) => v != null && typeof v === 'object';
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };
const _now   = () => _safe(() => new Date().toISOString(), '');

/**
 * @param {{
 *   now?: number,
 *   farm?: object,
 *   scanHistory?: Array,
 *   taskState?: object,
 *   events?: Array,
 *   sessionLog?: Array,
 *   dailyHealthSnapshots?: Array,
 *   dailyYieldSnapshots?: Array,
 *   referralLog?: Array,
 *   communitySignals?: object,
 *   regionLabel?: string,
 *   riskEnvelope?: object,
 *   weatherForecast?: object,
 *   cropStage?: object,
 *   sentLog?: Array,
 * }} ctx
 */
export function farmerAdoption(ctx) {
  const c = _isObj(ctx) ? ctx : {};

  const onboarding     = _safe(() => computeOnboardingScore(c), null);
  const firstSevenDays = _safe(() => computeFirstSevenDays(c), null);
  const referral       = _safe(() => computeReferralState(c), null);
  const weeklyReport   = _safe(() => composeWeeklyReport(c), null);
  const community      = _safe(() => computeCommunityIntelligence(c), null);
  const notifications  = _safe(() => composeSmartNotifications(c), null);
  const retention      = _safe(() => computeRetentionAnalytics(c), null);

  return Object.freeze({
    runtimeVersion: FARMER_ADOPTION_VERSION,
    generatedAt:    _now(),
    onboarding,
    firstSevenDays,
    referral,
    weeklyReport,
    community,
    notifications,
    retention,
    deferred: Object.freeze({
      referralBackend:    'no backend yet; UI can collect intent but '
                         + 'cannot deliver invites',
      rewardRedemption:   'no entitlements service yet; rewards are '
                         + 'computed locally',
      communityBackend:   'community signals must be injected by caller; '
                         + 'aggregator backend not built',
      pushDelivery:       'notifications runtime (wave-8) handles delivery; '
                         + 'this engine emits candidates only',
      productAnalytics:   'retention is local-diagnostic only; '
                         + 'product analytics ship via existing telemetry',
    }),
  });
}

/**
 * Pin window.__farmerAdoption(ctx) so QA + console can introspect
 * the composite at runtime.
 */
export function installFarmerAdoptionGlobal() {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    if (typeof window.__farmerAdoption === 'function') return true;
    window.__farmerAdoption = function (ctx) {
      const out = farmerAdoption(ctx || {});
      try { console.log('[Farroway · Farmer Adoption]', out); }
      catch { /* swallow */ }
      return out;
    };
    return true;
  }, false);
}

// Re-exports for sub-engine + audit consumers
export {
  computeOnboardingScore, ONBOARDING_STEPS,
  computeFirstSevenDays,  DAY_MILESTONES,
  computeReferralState,   REFERRAL_BADGES, REWARD_KIND,
  composeWeeklyReport,
  computeCommunityIntelligence, COMMUNITY_CHALLENGE_KIND,
  composeSmartNotifications, NOTIFICATION_KIND, NOTIFICATION_COOLDOWN_MS,
  computeRetentionAnalytics, RETENTION_DAYS,
};
