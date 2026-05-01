/**
 * insightActionStamp.js — bridges an insight tap on the Home
 * digest to the page the user lands on.
 *
 * Spec coverage (Long-term moat — controlled rollout §4)
 *   • action_after_insight tracking
 *
 * Flow
 *   1. InsightsDigest writes a session-scoped stamp on tap:
 *        { insightId, insightKind, actionKind, stampedAt, window }
 *   2. The receiving page (`/sell`, `/buy`) calls
 *      `consumeInsightActionStamp({ route })` on mount.
 *   3. If the stamp is fresh (within `window` ms), we fire
 *      `action_after_insight` and clear the stamp so a later
 *      unrelated visit doesn't re-trigger.
 *   4. If the stamp is stale, we just clear it silently.
 *
 * Drop-off attribution
 *   The analytics dashboard compares `insight_view` and
 *   `action_after_insight` counts: gap = drop-off. `insight_click`
 *   without a matching `action_after_insight` for the same
 *   `insightId` = confusion (user tapped but didn't follow
 *   through, or the page failed to mount).
 *
 * Strict-rule audit
 *   • Pure read + clear; never throws.
 *   • Uses sessionStorage so a reload doesn't double-fire.
 *   • Idempotent — repeated calls after the first are no-ops.
 */

import { trackEvent } from '../analytics/analyticsStore.js';

const STAMP_KEY = 'farroway_insight_action_pending';

function _safeRead() {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    const raw = sessionStorage.getItem(STAMP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch { return null; }
}

function _safeClear() {
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(STAMP_KEY);
    }
  } catch { /* swallow */ }
}

/**
 * @param {object} ctx
 * @param {string} ctx.route   route the receiver mounted at
 *                              ('/sell' | '/buy' | …)
 */
export function consumeInsightActionStamp({ route } = {}) {
  const stamp = _safeRead();
  if (!stamp) return null;
  _safeClear();
  const stampedAt = Number(stamp.stampedAt);
  const window = Number(stamp.window) || 60_000;
  if (!Number.isFinite(stampedAt)) return null;
  if (Date.now() - stampedAt > window) return null;
  try {
    trackEvent('action_after_insight', {
      insightId:   stamp.insightId   || null,
      insightKind: stamp.insightKind || null,
      actionKind:  stamp.actionKind  || null,
      route:       route || null,
      latencyMs:   Date.now() - stampedAt,
    });
  } catch { /* swallow */ }
  return stamp;
}

export default { consumeInsightActionStamp };
