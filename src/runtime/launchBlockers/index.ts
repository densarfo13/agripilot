/**
 * src/runtime/launchBlockers/index.ts — Wave 26 launch-blocker
 * barrel + composite boot install.
 *
 *   import { installLaunchBlockerGlobals }
 *     from 'src/runtime/launchBlockers';
 *
 *   installLaunchBlockerGlobals();
 *
 * What this is
 * ────────────
 *   One call wires the six wave-26 critical-blocker diagnostic
 *   probes (C-1…C-6) plus the composite __goLiveHealth() verdict
 *   onto window. Boot owner: src/App.jsx.
 *
 * Strict-rule audit
 *   • Pure composition. No engine logic in this file.
 *   • SSR-safe. Never throws.
 */

import {
  onboardingGuardHealth, installOnboardingGuardGlobal,
  isOnboardingValid,
  ONBOARDING_GUARD_RUNTIME_VERSION,
} from './OnboardingGuardRuntime';
import {
  taskStoreHealth, installTaskStoreHealthGlobal,
  TASK_STORE_HEALTH_RUNTIME_VERSION,
} from './TaskStoreHealthRuntime';
import {
  activityDataHealth, installActivityDataHealthGlobal,
  migrateActivityKey, getCanonicalActivityEvents,
  ACTIVITY_DATA_HEALTH_RUNTIME_VERSION,
} from './ActivityDataHealthRuntime';
import {
  scanResultHealth, installScanResultHealthGlobal,
  shouldRenderIntelligentResult,
  SCAN_RESULT_HEALTH_RUNTIME_VERSION,
} from './ScanResultHealthRuntime';
import {
  scanCtaHealth, installScanCtaHealthGlobal,
  SCAN_CTA_HEALTH_RUNTIME_VERSION,
} from './ScanCtaHealthRuntime';
import {
  syncHealth, installSyncHealthGlobal,
  SYNC_HEALTH_RUNTIME_VERSION,
} from './SyncHealthRuntime';
import {
  goLiveHealth, installGoLiveHealthGlobal,
  GO_LIVE_HEALTH_RUNTIME_VERSION,
} from './GoLiveHealthRuntime';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

/**
 * Wave-26 — augment __releaseLock() so it surfaces the six new
 * launch-blocker readiness flags + forces verdict RED when any
 * blocker fails. Mirrors the pattern already used in
 * src/runtime/release/index.ts where __appStoreReadiness is wrapped
 * to inject releaseLockVerdict. Idempotent.
 *
 * Final Gap Closure Pack (post-wave-26) — additionally surfaces six
 * pilot-readiness flags drawn from the new runtime suite:
 *   outcomeTrackingReady / feedbackReady / retentionReady /
 *   fieldOfficerReady / buyerTrustReady / knowledgeCoverageReady
 * All flags are read from their respective __*Health globals
 * that the Gap-Closure Pack installs at boot. Missing globals
 * surface as `false` rather than crashing.
 */
function _readGlobalFlag(name: string, key: string): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w[name] !== 'function') return false;
    const out = w[name]();
    return !!(out && out[key]);
  }, false);
}

function _extendReleaseLockWithBlockers(): void {
  _safe(() => {
    if (typeof window === 'undefined') return;
    const w = window as any;
    if (typeof w.__releaseLock !== 'function') return;
    if (w.__releaseLock.__waveTwentySixExtended) return;
    const prior = w.__releaseLock;
    const wrapped: any = function () {
      const base = _safe(() => prior(), {} as any) || {};
      const live = _safe(() => goLiveHealth(), null as any);
      const checks = live && live.checks ? live.checks : {};
      // Final Gap Closure Pack — six pilot-readiness flags
      const outcomeTrackingReady   = _readGlobalFlag('__outcomeHealth',    'outcomeTrackingReady');
      const feedbackReady          = _readGlobalFlag('__feedbackHealth',   'feedbackReady');
      const retentionReady         = _readGlobalFlag('__retentionHealth',  'retentionReady');
      const fieldOfficerReady      = _readGlobalFlag('__fieldOfficerHealth','fieldOfficerReady');
      const buyerTrustReady        = _readGlobalFlag('__buyerTrustHealth', 'buyerTrustReady');
      const knowledgeCoverageReady = _readGlobalFlag('__knowledgeHealth',  'knowledgeCoverageReady');
      const next: any = { ...(base || {}),
        onboardingGuardReady: !!checks.c1_onboardingGuard,
        taskStoreReady:       !!checks.c2_taskStore,
        activityKeyReady:     !!checks.c3_activityKey,
        scanResultReady:      !!checks.c4_scanResult,
        scanCtaReady:         !!checks.c5_scanCta,
        syncReady:            !!checks.c6_sync,
        // Gap Closure Pack flags
        outcomeTrackingReady,
        feedbackReady,
        retentionReady,
        fieldOfficerReady,
        buyerTrustReady,
        knowledgeCoverageReady,
        goLiveVerdict:        live && live.verdict ? live.verdict : 'NO_GO',
      };
      // Any wave-26 blocker failure → force RELEASE LOCK to RED.
      if (!live || live.verdict === 'NO_GO') {
        next.verdict = 'RED';
        const reasons: string[] = Array.isArray((base as any).blockers)
          ? [...(base as any).blockers] : [];
        if (live && Array.isArray(live.blockers)) {
          for (const b of live.blockers) {
            if (!reasons.includes(b)) reasons.push(b);
          }
        }
        next.blockers = Object.freeze(reasons);
      }
      try {
        return Object.freeze(next);
      } catch { return next; }
    };
    wrapped.__waveTwentySixExtended = true;
    w.__releaseLock = wrapped;
  }, undefined as any);
}

/**
 * One-shot composite install. Each child install is fault-isolated
 * so a single failure never blocks the rest. Idempotent.
 */
export function installLaunchBlockerGlobals(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    try { installOnboardingGuardGlobal(); } catch { /* swallow */ }
    try { installTaskStoreHealthGlobal(); } catch { /* swallow */ }
    try { installActivityDataHealthGlobal(); } catch { /* swallow */ }
    try { installScanResultHealthGlobal(); } catch { /* swallow */ }
    try { installScanCtaHealthGlobal(); } catch { /* swallow */ }
    try { installSyncHealthGlobal(); } catch { /* swallow */ }
    // Go-live composite is installed LAST so it can read the other
    // five probes when called.
    try { installGoLiveHealthGlobal(); } catch { /* swallow */ }
    // Wave-26 release-lock augmentation — runs after the boot
    // ReleaseLock install (App.jsx wires installReleaseLockGlobal
    // BEFORE installLaunchBlockerGlobals), so __releaseLock is
    // already pinned and ready to wrap.
    try { _extendReleaseLockWithBlockers(); } catch { /* swallow */ }
    return true;
  }, false);
}

export {
  // C-1
  onboardingGuardHealth, installOnboardingGuardGlobal,
  isOnboardingValid, ONBOARDING_GUARD_RUNTIME_VERSION,
  // C-2
  taskStoreHealth, installTaskStoreHealthGlobal,
  TASK_STORE_HEALTH_RUNTIME_VERSION,
  // C-3
  activityDataHealth, installActivityDataHealthGlobal,
  migrateActivityKey, getCanonicalActivityEvents,
  ACTIVITY_DATA_HEALTH_RUNTIME_VERSION,
  // C-4
  scanResultHealth, installScanResultHealthGlobal,
  shouldRenderIntelligentResult,
  SCAN_RESULT_HEALTH_RUNTIME_VERSION,
  // C-5
  scanCtaHealth, installScanCtaHealthGlobal,
  SCAN_CTA_HEALTH_RUNTIME_VERSION,
  // C-6
  syncHealth, installSyncHealthGlobal,
  SYNC_HEALTH_RUNTIME_VERSION,
  // Composite
  goLiveHealth, installGoLiveHealthGlobal,
  GO_LIVE_HEALTH_RUNTIME_VERSION,
};
