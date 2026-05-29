/**
 * src/runtime/release/index.ts — Farroway Release Lock v1
 * barrel + boot install.
 *
 *   import {
 *     computeReleaseLock, installReleaseLockGlobal,
 *     RELEASE_LOCK_VERSION,
 *   } from 'src/runtime/release';
 *
 *   window.__releaseLock()  // pinned after boot
 *
 * What this is
 * ────────────
 *   Single import surface for the release lock. Auto-wires
 *   window.__releaseLock() so QA + admins can call from the
 *   production console.
 *
 * Strict-rule audit
 *   • Composition over the contracts + checklist + diagnostics
 *     + runtime modules. No direct engine logic here.
 *   • SSR-safe. Never throws.
 */

import {
  computeReleaseLock, loadManualOverrides, setManualOverride,
  clearManualOverrides, exportReleaseLockReport,
  RELEASE_LOCK_RUNTIME_VERSION,
} from './ReleaseLockRuntime';
import {
  RELEASE_LOCK_VERSION, RELEASE_VERDICT, CHECK_STATUS,
  SEVERITY, CHECK_KIND, RELEASE_SECTIONS,
  MANUAL_CHECK_IDS, KNOWLEDGE_TARGETS, MEDIA_TARGETS,
  MANUAL_STORAGE_KEY, INTERNAL_FLAG_KEY,
} from './releaseLockContracts';
import {
  RELEASE_CHECKLIST, sectionItems, CHECKLIST_VERSION,
} from './ReleaseLockChecklist';
import {
  evaluateChecklist, DIAGNOSTICS_VERSION,
} from './ReleaseLockDiagnostics';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

/**
 * Pin __releaseLock() onto window so QA / admins can check the
 * verdict + sections from the production console.
 */
export function installReleaseLockGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__releaseLock !== 'function') {
      w.__releaseLock = function () {
        const out = computeReleaseLock();
        try { console.log('[Farroway · Release Lock]', out); }
        catch { /* swallow */ }
        return out;
      };
    }
    if (typeof w.__releaseLockReport !== 'function') {
      w.__releaseLockReport = function () {
        const report = exportReleaseLockReport();
        try { console.log('[Farroway · Release Lock Report]', report); }
        catch { /* swallow */ }
        return report;
      };
    }
    // Wave-9 — extend __appStoreReadiness with releaseLockVerdict.
    // RED blocks the App Store, YELLOW allows internal TestFlight,
    // GREEN allows external TestFlight / App Store packaging.
    if (typeof w.__appStoreReadiness === 'function'
        && !(w as any).__appStoreReadiness.__releaseLockExtended) {
      const prior = w.__appStoreReadiness;
      const wrapped: any = function () {
        const base = _safe(() => prior(), {});
        const lock = _safe(() => computeReleaseLock(), null);
        const verdict = lock && lock.verdict;
        const next: any = { ...(base || {}),
          releaseLockVerdict: verdict,
          releaseLockScore:    lock && lock.score,
          releaseLockBlockers: lock && lock.blockers,
        };
        if (verdict === 'RED') {
          next.blockedReason = 'release_lock_RED';
        }
        return Object.freeze(next);
      };
      wrapped.__releaseLockExtended = true;
      w.__appStoreReadiness = wrapped;
    }
    return true;
  }, false);
}

// ─── Re-exports ────────────────────────────────────────────────
export {
  // Contracts
  RELEASE_LOCK_VERSION, RELEASE_VERDICT, CHECK_STATUS, SEVERITY,
  CHECK_KIND, RELEASE_SECTIONS, MANUAL_CHECK_IDS,
  KNOWLEDGE_TARGETS, MEDIA_TARGETS,
  MANUAL_STORAGE_KEY, INTERNAL_FLAG_KEY,
  // Checklist
  RELEASE_CHECKLIST, sectionItems, CHECKLIST_VERSION,
  // Diagnostics
  evaluateChecklist, DIAGNOSTICS_VERSION,
  // Runtime
  computeReleaseLock, loadManualOverrides, setManualOverride,
  clearManualOverrides, exportReleaseLockReport,
  RELEASE_LOCK_RUNTIME_VERSION,
};
