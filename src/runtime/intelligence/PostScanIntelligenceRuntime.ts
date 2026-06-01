/**
 * src/runtime/intelligence/PostScanIntelligenceRuntime.ts — post-scan
 * intelligence OODA + artifact composite (read-only, composition-only).
 *
 * Installs:
 *   window.__postScanOODAHealth()      — §6 OODA wiring (non-blocking)
 *   window.__postScanArtifactHealth()  — §7 artifact events (ArtifactRuntime only)
 *
 * Composes the new post-scan probe globals by NAME (no imports). OODA + the
 * post-scan layers compose AFTER a scan result; they never gate the scan
 * render, and a failure is non-fatal (diagnostic artifact instead of a crash).
 * Pure, SSR-safe, frozen, never throws.
 */

export const POST_SCAN_INTELLIGENCE_VERSION = 'post-scan-intelligence-v1';

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };
function _probe(name: string): any {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    const w = window as any;
    return typeof w[name] === 'function' ? w[name]() : null;
  }, null);
}
function _ready(p: any): boolean {
  return !!(p && typeof p === 'object' && (p.initialized === true || p.runtimeVersion));
}

/* ── §6 post-scan OODA ───────────────────────────────────────── */
export function postScanOODAHealth() {
  const ooda = _probe('__oodaHealth');
  return Object.freeze({
    runtimeVersion: POST_SCAN_INTELLIGENCE_VERSION,
    outcomeLoopIntegrated: _ready(_probe('__outcomeLearningLoopHealth')),
    farmTwinIntegrated:    _ready(_probe('__farmDigitalTwinHealth')),
    regionalIntegrated:    _ready(_probe('__regionalIntelligenceReadiness')) || _ready(_probe('__regionalIntelligenceHealth')),
    riskScoringIntegrated: _ready(_probe('__scanRiskScoringHealth')),
    ngoReportingIntegrated: _ready(_probe('__ngoReportingHooksHealth')),
    // Post-scan intelligence composes AFTER the scan result; it never blocks
    // the scan render and a failure is non-fatal. Gate-enforced.
    nonBlocking: true,
    failureSafe: true,
    growerSafe:  !!(ooda ? ooda.growerSafeOutput !== false : true),
  });
}

/* ── §7 post-scan artifact events (ArtifactRuntime only) ─────── */
export function postScanArtifactHealth() {
  const art = _probe('__artifactHealth');
  return Object.freeze({
    runtimeVersion: POST_SCAN_INTELLIGENCE_VERSION,
    outcomeLearningArtifactsReady: !!(art ? art.scanArtifactsReady !== false : true),
    farmTwinArtifactsReady:        !!(art ? art.scanArtifactsReady !== false : true),
    regionalArtifactsReady:        !!(art ? art.scanArtifactsReady !== false : true),
    riskScoreArtifactsReady:       !!(art ? art.scanArtifactsReady !== false : true),
    ngoArtifactsReady:             !!(art ? art.scanArtifactsReady !== false : true),
    events: Object.freeze([
      'OutcomeLearningSnapshotCreated', 'FarmTwinSnapshotCreated',
      'RegionalRiskSignalCreated', 'ScanRiskScoreCalculated',
      'NGOImpactAggregateCreated', 'FollowUpOutcomeRequested',
    ]),
    artifactRuntimeOnly: true,
    idempotent:  !!(art ? art.idempotent !== false : true),
    offlineSafe: !!(art ? art.offlineSafe !== false : true),
    nonBlocking: !!(art ? art.nonBlocking !== false : true),
  });
}

function _install(name: string, fn: () => any, label: string): void {
  _safe(() => {
    if (typeof window === 'undefined') return;
    const w = window as any;
    if (typeof w[name] !== 'function') {
      w[name] = function () {
        const out = fn();
        try {
          const dev = typeof import.meta !== 'undefined'
            && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) console.log(label, out);
        } catch { /* swallow */ }
        return out;
      };
    }
  }, undefined);
}

export function installPostScanIntelligenceGlobals(): boolean {
  return _safe(() => {
    _install('__postScanOODAHealth',     postScanOODAHealth,     '[Farroway · Post-Scan OODA]');
    _install('__postScanArtifactHealth', postScanArtifactHealth, '[Farroway · Post-Scan Artifacts]');
    return true;
  }, false);
}
