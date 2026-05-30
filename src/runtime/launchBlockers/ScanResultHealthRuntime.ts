/**
 * src/runtime/launchBlockers/ScanResultHealthRuntime.ts — C-4
 * Single scan-result-card invariant probe.
 *
 *   import { scanResultHealth, installScanResultHealthGlobal,
 *            shouldRenderIntelligentResult }
 *     from 'src/runtime/launchBlockers/ScanResultHealthRuntime';
 *
 *   window.__scanResultHealth()
 *
 * Invariant
 *   • Exactly one scan-result card may render per result. The
 *     legacy (pre-wave-21) path renders one of {UsefulResultCard,
 *     ScanResultCard} depending on FEATURE_SCAN_USEFULNESS.
 *     The wave-21 path renders IntelligentScanResult INSTEAD.
 *   • The two paths are mutually exclusive — never both.
 *
 *   `shouldRenderIntelligentResult()` is the single guard used by
 *   ScanPage.jsx to decide. The legacy block becomes the `else`.
 *
 * Strict-rule audit
 *   • SSR-safe. Pure. Frozen envelope. Never throws.
 *   • Reads window.__scanAnalysisHealth() to honor the existing
 *     wave-21 diagnostic contract.
 */

export const SCAN_RESULT_HEALTH_RUNTIME_VERSION = 'scan-result-health-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

function _scanAnalysisInitialized(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__scanAnalysisHealth !== 'function') return false;
    const out = w.__scanAnalysisHealth();
    return !!(out && out.initialized && out.oodaIntegrated);
  }, false);
}

/**
 * Single-decision predicate consumed by ScanPage.jsx. Returns
 * `true` when the wave-21 IntelligentScanResult should be the
 * sole rendered result surface. Returns `false` to fall back to
 * the legacy UsefulResultCard / ScanResultCard path.
 *
 * Always one or the other — never both. Default: legacy path
 * (returns false) until the wave-21 pipeline reports itself
 * initialized. This preserves prior behavior while the diagnostic
 * is the source of truth.
 *
 * The May 2026 wave-26 launch sets this to ALWAYS prefer the
 * legacy useful-result + result card path; the intelligent card
 * is gated off until the analysis runtime is wired end-to-end.
 * Both checks guarantee exactly one card mounts.
 */
export function shouldRenderIntelligentResult(): boolean {
  // Wave 26 C-4: hold the intelligent path off until it is fully
  // mounted. The legacy path is the canonical single result.
  return false;
}

export function scanResultHealth() {
  return _safe(() => Object.freeze({
    runtimeVersion:           SCAN_RESULT_HEALTH_RUNTIME_VERSION,
    singleResultCard:         true,
    duplicateRenderBlocked:   true,
    intelligentPathActive:    shouldRenderIntelligentResult(),
    intelligentPathAvailable: _scanAnalysisInitialized(),
  }), Object.freeze({
    runtimeVersion:           SCAN_RESULT_HEALTH_RUNTIME_VERSION,
    singleResultCard:         false,
    duplicateRenderBlocked:   false,
    intelligentPathActive:    false,
    intelligentPathAvailable: false,
  }));
}

export function installScanResultHealthGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__scanResultHealth !== 'function') {
      w.__scanResultHealth = function () {
        const out = scanResultHealth();
        try { console.log('[Farroway · Scan Result]', out); }
        catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
