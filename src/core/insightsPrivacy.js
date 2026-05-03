/**
 * insightsPrivacy.js — user-facing controls for the Global
 * Insights Layer (data moat §8).
 *
 * Two responsibilities:
 *   1. Read / write the `helpImproveRecommendations` flag.
 *      Default: enabled. localStorage key:
 *      `farroway:helpImproveRecommendations`.
 *   2. Provide the spec's `clearLocalActivityData()` entry point
 *      — wipes the moat's local activity stores AND drops the
 *      insight sync cursor + any cached remote insights.
 *
 * Storage keys touched by `clearLocalActivityData()`
 * ──────────────────────────────────────────────────
 *   • farroway_events                        (eventStore log)
 *   • farroway_health_feedback              (outcome feedback)
 *   • farroway_streak_count
 *   • farroway_last_completed_date
 *   • farroway_last_home_open_date
 *   • farroway_user_memory                   (derived rollup)
 *   • farroway_last_scan_issue
 *   • farroway:insights:cursor               (sync cursor)
 *   • farroway:insights:pending              (failed-sync deltas)
 *   • farroway:insights:cache:*              (24h fetch cache)
 *
 * This function does NOT touch:
 *   • Auth / session keys (farroway_token, farroway_user,
 *     farroway:session_cache, farroway:last_email)
 *   • The active language / region
 *   • Onboarding flags
 *   • The active farm or garden row
 *
 * The split mirrors `clearFarrowayActivityData()` in
 * `src/core/analytics.js` (which this calls into) so the moat
 * has ONE definition of "what counts as activity data" — we
 * just extend it with the insight sync slots that didn't exist
 * when that helper was written.
 */

import { clearFarrowayActivityData } from './analytics.js';
import { clearPendingDeltas } from './localInsightSync.js';
import { clearInsightsCache } from './globalInsightsClient.js';

const PRIVACY_KEY = 'farroway:helpImproveRecommendations';

/**
 * Read the current opt-in state. Default true (per spec §8).
 */
export function isInsightsOptIn() {
  try {
    if (typeof localStorage === 'undefined') return true;
    const raw = localStorage.getItem(PRIVACY_KEY);
    if (raw == null) return true;
    return raw !== 'false';
  } catch { return true; }
}

/**
 * Set the opt-in state. When opting OUT we proactively drop
 * any pending sync deltas + cached remote insights so the user
 * sees an immediate effect.
 *
 * @param {boolean} value
 */
export function setInsightsOptIn(value) {
  const next = !!value;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(PRIVACY_KEY, next ? 'true' : 'false');
    }
  } catch { /* ignore */ }
  if (!next) {
    try { clearPendingDeltas(); } catch { /* ignore */ }
    try { clearInsightsCache(); } catch { /* ignore */ }
  }
  // Broadcast so live components (Settings panel, plan card)
  // can react without polling.
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('farroway:insightsOptInChange', { detail: next }));
    }
  } catch { /* ignore */ }
  return next;
}

/**
 * Spec §8 entry point. Wipes all local activity + insight
 * scratch slots without touching auth / language / onboarding.
 * Returns `{ removed: number, optedOut: boolean }` so a settings
 * panel can show a small confirmation toast.
 */
export function clearLocalActivityData() {
  let removed = 0;
  try { removed = clearFarrowayActivityData() || 0; } catch { /* ignore */ }
  // The two helpers below remove the insight-specific slots.
  // They're separate from clearFarrowayActivityData because
  // the data-moat layer already shipped before the global
  // insights sync slots existed.
  try { clearPendingDeltas(); } catch { /* ignore */ }
  try { clearInsightsCache(); } catch { /* ignore */ }
  return { removed, optedOut: !isInsightsOptIn() };
}
