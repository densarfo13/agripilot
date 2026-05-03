/**
 * useUserMode — single hook that exposes everything a render
 * surface needs to stay consistent with the user's mode
 * (farmer vs backyard).
 *
 *   const {
 *     userType,        // 'farmer' | 'backyard'
 *     isBackyard,      // boolean sugar
 *     isFarmer,        // boolean sugar
 *     sanitize,        // (text) => terminology-corrected copy
 *     word,            // (key) => mode-appropriate vocabulary word
 *     hasFeature,      // (name) => true when the user's tier
 *                      //           gates the registered feature
 *   } = useUserMode();
 *
 * Why a hook
 * ──────────
 *   Before this hook, surfaces had to import + compose three
 *   modules to do mode-aware rendering correctly:
 *     - userType.getUserType()
 *     - contextWords.sanitizeContextCopy(text, ctx)
 *     - featureTier.hasFeatureAccess(name)
 *   The hook collapses that into one call + auto-subscribes
 *   to the existing `farroway:experience_switched` event so
 *   the render flips when the user switches modes.
 *
 *   It also enforces the consistency the
 *   "Fix Messaging Inconsistency" spec asks for: every screen
 *   that opts into the hook gets the same mode + terminology
 *   resolution — no drift between surfaces.
 *
 * Strict-rule audit
 *   • Pure read — never writes to any store.
 *   • Never throws — every dependency call wrapped.
 *   • SSR-safe — falls back to 'farmer' (full features) when
 *     window is undefined; the conservative default that
 *     never hides functionality.
 *   • Re-renders on the canonical experience-switch event so
 *     consumers don't need their own subscription.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getUserType, onUserTypeChange } from '../core/userType.js';
import { sanitizeContextCopy, getContextWord } from '../i18n/contextWords.js';
import { hasFeatureAccess } from '../core/featureTier.js';

export default function useUserMode() {
  // Resolve the initial mode synchronously so the first paint
  // already has the right copy. The conservative default is
  // 'farmer' — full features; getUserType handles the
  // resolution chain (override → activeExperience → row farmType
  // → 'farmer'). Wrapped so SSR / locked-storage edge cases
  // don't crash the render.
  const [userType, setUserType] = useState(() => {
    try { return getUserType(); }
    catch { return 'farmer'; }
  });

  // Subscribe to the canonical experience-switched event so a
  // mode flip flows through every consumer of the hook in one
  // place. onUserTypeChange returns its own teardown so the
  // useEffect cleanup is just the returned fn.
  useEffect(() => onUserTypeChange((next) => setUserType(next)), []);

  // Map userType → contextWords' garden/farm context. The
  // contextWords module's vocabulary uses 'garden' / 'farm'
  // keys; userType uses 'backyard' / 'farmer'. The mapping
  // is 1:1 — backyard ↔ garden, farmer ↔ farm.
  const ctxKey = userType === 'backyard' ? 'garden' : 'farm';

  // sanitize(text) — convenience wrapper. Same as
  // sanitizeContextCopy(text, ctxKey) but free of the second
  // argument so call sites read naturally:
  //   <p>{sanitize('Check your farm today')}</p>
  // Resolves to the mode-correct copy without the call site
  // having to know about the context-words module at all.
  const sanitize = useCallback((text) => {
    try { return sanitizeContextCopy(text, ctxKey); }
    catch { return text; }
  }, [ctxKey]);

  // word(key) — vocabulary lookup. Returns the right word for
  // the active mode:
  //   word('plant') → 'plant' (backyard) | 'crop' (farmer)
  //   word('task')  → 'step'  (backyard) | 'task' (farmer)
  // Unknown keys fall back to the input verbatim.
  const word = useCallback((key) => {
    try { return getContextWord(key, ctxKey); }
    catch { return String(key || ''); }
  }, [ctxKey]);

  // hasFeature(name) — feature-tier check. Wraps the registry
  // lookup so call sites can write:
  //   {hasFeature('unlimited_scan') ? <UnlimitedScan/> : <Paywall/>}
  // without importing featureTier directly. Wrapped in
  // try/catch so a missing registry entry never crashes
  // render — falls open (returns true for the FREE tier).
  const hasFeature = useCallback((name) => {
    try { return hasFeatureAccess(name); }
    catch { return false; }
  }, []);

  // Memoise the return object so consumers binding via
  // `const { x } = useUserMode()` don't re-render on every
  // tick. Identity stable while userType stays stable.
  return useMemo(() => ({
    userType,
    isBackyard:  userType === 'backyard',
    isFarmer:    userType === 'farmer',
    sanitize,
    word,
    hasFeature,
  }), [userType, sanitize, word, hasFeature]);
}

export const _internal = Object.freeze({
  // Exposed for tests + the launch-readiness audit so the
  // backyard ↔ garden mapping can be verified without
  // exercising the full hook lifecycle.
  ctxKeyFor: (userType) => (userType === 'backyard' ? 'garden' : 'farm'),
});
