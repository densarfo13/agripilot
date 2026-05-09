/**
 * optimization — lightweight ranking + outcome adjustment loop.
 *
 * SPEC §5 + §14
 *   • Adjusts the relative ranking of candidate actions based on
 *     past outcomes recorded in feedbackLoop.js.
 *   • Allowed adjustments: task priority, recommendation timing,
 *     notification frequency, scan follow-up timing, funding
 *     match ordering, buyer match ranking.
 *   • FORBIDDEN (spec §14): auto-deleting listings, auto-blocking
 *     users, auto-changing prices, auto-contacting buyers, auto-
 *     applying treatments, auto-submitting funding applications.
 *
 *   Every "automated" adjustment in this module is a RANK ADJUST
 *   — never a write that affects another entity. The render
 *   layer always asks for human confirmation before any
 *   irreversible action.
 *
 * SAFETY
 *   • Pure read of feedbackLoop counts. No writes from this file.
 *   • Clamps every multiplier so a runaway count can't push a
 *     score outside [0, 1].
 */

import { OUTCOME_EVENT } from './intelligenceTypes.js';
import { countRecent } from './feedbackLoop.js';

// ─── Tuning constants ────────────────────────────────────────────
const WINDOW_MS_WEEK = 7 * 24 * 60 * 60 * 1000;
const IGNORE_PENALTY = 0.08;   // each recent ignore subtracts up to 0.08
const USE_BOOST      = 0.05;   // each recent use adds up to 0.05
const MAX_PENALTY    = 0.30;
const MAX_BOOST      = 0.20;

function _clamp01(n) {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

/**
 * Apply outcome-based rank adjustment to a base score in [0,1].
 * Engine consumers call this AFTER scoreRecommendation() and
 * BEFORE the final ordering, so a candidate the user has
 * repeatedly ignored sinks naturally without ever being deleted.
 *
 * @param {number} baseScore  - 0..1 from scoring.js
 * @param {object} [opts]
 * @param {string} [opts.actionType]  - matched against OUTCOME_EVENT codes
 * @param {string} [opts.candidateId] - opt — narrows the ignore/use count
 * @returns {{ score: number, adjustment: number, reason: string }}
 */
export function applyOutcomeAdjustment(baseScore, opts = {}) {
  const base = _clamp01(Number(baseScore));

  // The two outcome types we care about for ranking are the
  // generic "used / ignored" pair. We don't drill into the
  // candidateId for the v1 — a global ignore count is a
  // good-enough signal that the user doesn't want this nudge
  // right now.
  const ignored = countRecent(OUTCOME_EVENT.RECOMMENDATION_IGNORED, WINDOW_MS_WEEK);
  const used    = countRecent(OUTCOME_EVENT.RECOMMENDATION_USED,    WINDOW_MS_WEEK);

  const penalty = Math.min(MAX_PENALTY, ignored * IGNORE_PENALTY);
  const boost   = Math.min(MAX_BOOST,   used    * USE_BOOST);

  const adjustment = boost - penalty;
  const score      = _clamp01(base + adjustment);

  return Object.freeze({
    score,
    adjustment,
    reason: `ignored=${ignored} used=${used}`,
  });
}

/**
 * Allow-list check for spec §14. Returns true when the supplied
 * adjustment is something the optimizer is permitted to do
 * automatically (rank changes, timing nudges); false when it
 * needs explicit human confirmation (deletes, sends, payments).
 *
 * Render code can call this as a guard:
 *   if (!isOptimizationAllowed('auto_publish')) askConfirmation();
 */
export const ALLOWED_AUTO_ADJUSTMENTS = Object.freeze(new Set([
  'rank_task',
  'rank_recommendation',
  'reschedule_notification',
  'reschedule_scan_followup',
  'rank_funding_match',
  'rank_buyer_match',
]));

export const FORBIDDEN_AUTO_ADJUSTMENTS = Object.freeze(new Set([
  'delete_listing',
  'block_user',
  'change_price',
  'contact_buyer',
  'apply_treatment',
  'submit_funding_application',
  'send_message',
  'transfer_funds',
]));

export function isOptimizationAllowed(adjustmentType) {
  return ALLOWED_AUTO_ADJUSTMENTS.has(String(adjustmentType));
}

export function isOptimizationForbidden(adjustmentType) {
  return FORBIDDEN_AUTO_ADJUSTMENTS.has(String(adjustmentType));
}

const _module = {
  applyOutcomeAdjustment,
  isOptimizationAllowed,
  isOptimizationForbidden,
  ALLOWED_AUTO_ADJUSTMENTS,
  FORBIDDEN_AUTO_ADJUSTMENTS,
};
export default _module;
