/**
 * scanFallbackPolicy.js — the single, testable rule that decides whether the
 * ScanPage fallback timer is allowed to publish its placeholder result.
 *
 * Why this exists (candidate-handoff repair, req 4):
 *   The fallback timer used to rely ONLY on clearTimeout() to avoid overwriting
 *   a real answer. That is a race: if the real result publishes but the clear is
 *   missed (or the timer already queued its callback), the empty placeholder
 *   (cand=0/0, source=fallback_*_timer — the exact dead-end the farmer saw) can
 *   replace a valid, candidate-bearing result. This makes the precedence
 *   EXPLICIT and hard: a real result ALWAYS wins. The placeholder may publish
 *   ONLY when no real result has been shown, the timer hasn't already fired, and
 *   the user hasn't moved on (stale session).
 *
 * Pure · never throws · no DOM/React coupling so it is unit-testable in isolation.
 *
 * @param {{ realResultShown?: boolean, fallbackShown?: boolean, sessionStale?: boolean }} s
 * @returns {boolean} true → the fallback placeholder may be published.
 */
export function shouldFallbackPublish(s) {
  const st = s || {};
  if (st.realResultShown === true) return false; // a real answer already won — never overwrite it
  if (st.fallbackShown === true)   return false; // the placeholder already fired once
  if (st.sessionStale === true)    return false; // user retook / cancelled / started a new scan
  return true;
}

export default { shouldFallbackPublish };
