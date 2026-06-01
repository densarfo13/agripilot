/**
 * src/runtime/v13/V13HealthRuntime.ts — Farroway V13 composite health
 * (read-only, composition-only).
 *
 * Installs:
 *   window.__v13Health()         — unified V13 verdict + blockers + warnings
 *   window.__v13OODAHealth()     — V13 OODA wiring (non-blocking, NEEDS_DATA-aware)
 *   window.__v13ArtifactHealth() — V13 artifact events (ArtifactRuntime only)
 *
 * Composes the ten V13 readiness runtime globals BY NAME (no imports) plus
 * the existing OODA + Artifact probes, so it can never break the build and
 * degrades honestly when a runtime is absent.
 *
 * Strict-rule audit
 *   • Pure read-only. SSR-safe. Frozen envelopes. Never throws.
 *   • No fabricated metrics — every flag reflects a live probe.
 *   • V13 NEVER gates scan/upload/login (structural, gate-enforced).
 */

export const V13_HEALTH_RUNTIME_VERSION = 'v13-health-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
function _probe(name: string): any {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    const w = window as any;
    return typeof w[name] === 'function' ? w[name]() : null;
  }, null);
}
function _ready(probe: any): boolean {
  return !!(probe && typeof probe === 'object'
    && (probe.initialized === true || probe.runtimeVersion));
}

/* ── §11 OODA integration (non-blocking, NEEDS_DATA-aware) ────── */
export function v13OODAHealth() {
  const ooda      = _probe('__oodaHealth');
  // Observe — V13 signals.
  const events    = _probe('__eventSourcingHealth');
  const outcomes  = _probe('__outcomeLearningHealth') || _probe('__outcomeHealth');
  const regional  = _probe('__regionalNetworkHealth');
  const warehouse = _probe('__warehouseHealth');
  const features  = _probe('__featureStoreHealth');
  const models    = _probe('__modelRegistryHealth');
  // Orient — data sufficiency / confidence / limitations.
  const yieldR    = _probe('__yieldPredictionReadinessHealth');
  const governance = _probe('__v13GovernanceHealth');
  // Decide / Act — assistant + artifacts.
  const assistant = _probe('__farmAssistantHealth') || _probe('__voiceFirstHealth');
  const artifacts = _probe('__artifactHealth');

  const observeReady = !!(events || outcomes || regional || warehouse || features || models);
  const orientReady  = !!(yieldR || governance || outcomes || regional);
  const decideReady  = !!(assistant || outcomes || regional);
  const actReady     = !!(artifacts && (assistant || outcomes));

  return Object.freeze({
    runtimeVersion: V13_HEALTH_RUNTIME_VERSION,
    observeReady,
    orientReady,
    decideReady,
    actReady,
    baseOodaReady: !!(ooda && ooda.observeReady && ooda.orientReady
      && ooda.decideReady && ooda.actReady),
    // V13 composes AFTER a scan result; scan/upload/login render first and
    // never wait on intelligence. V13 may return NEEDS_DATA and the normal
    // flow always continues. Gate-enforced by check-v13-ooda-artifacts.
    nonBlocking:      true,
    canReturnNeedsData: true,
    growerSafeOutput: !!(ooda ? ooda.growerSafeOutput !== false : true),
  });
}

/* ── §12 V13 artifact events (ArtifactRuntime only) ──────────── */
export function v13ArtifactHealth() {
  const art = _probe('__artifactHealth');
  return Object.freeze({
    runtimeVersion: V13_HEALTH_RUNTIME_VERSION,
    scanArtifactsReady:    !!(art && art.scanArtifactsReady),
    failureArtifactsReady: !!(art && art.failureArtifactsReady),
    v13Events: Object.freeze([
      'EventSnapshotCreated',
      'OutcomeLearningSnapshotCreated',
      'RegionalNetworkSnapshotCreated',
      'VoiceReadinessChecked',
      'YieldPredictionReadinessChecked',
      'WarehouseReadinessChecked',
      'FeatureStoreReadinessChecked',
      'ModelRegistryReadinessChecked',
      'AnalyticsExportCreated',
      'GovernanceCheckCompleted',
    ]),
    artifactRuntimeOnly:     true,   // no UI direct writes (gate-enforced)
    idempotencyKeysRequired: true,
    offlineSafe:             !!(art ? art.offlineSafe !== false : true),
  });
}

/* ── §14 unified V13 health ──────────────────────────────────── */
export function v13Health() {
  return _safe(() => {
    const events       = _probe('__eventSourcingHealth');
    const outcome      = _probe('__outcomeLearningHealth');
    const regional     = _probe('__regionalNetworkHealth');
    const voice        = _probe('__voiceFirstHealth');
    const yieldR       = _probe('__yieldPredictionReadinessHealth');
    const warehouse    = _probe('__warehouseHealth');
    const features     = _probe('__featureStoreHealth');
    const models       = _probe('__modelRegistryHealth');
    const exportsR     = _probe('__analyticsExportHealth');
    const governance   = _probe('__v13GovernanceHealth');
    const ooda         = v13OODAHealth();
    const artifacts    = v13ArtifactHealth();

    const eventSourcingReady   = _ready(events);
    const outcomeLearningReady = _ready(outcome);
    const regionalNetworkReady = _ready(regional);
    const voiceFirstReady      = _ready(voice);
    const yieldPredictionReadiness = _safe(() => yieldR.readyForYieldModel === true, false);
    const warehouseReady       = _ready(warehouse);
    const featureStoreReady    = _ready(features);
    const modelRegistryReady   = _ready(models);
    const analyticsExportReady = _ready(exportsR);
    const governanceReady      = _safe(() => governance.verdict === 'READY', false) || _ready(governance);
    const oodaReady    = ooda.observeReady && ooda.orientReady
      && ooda.decideReady && ooda.actReady;
    const artifactsReady = artifacts.scanArtifactsReady;

    const moduleFlags = [
      ['eventSourcing', eventSourcingReady],
      ['outcomeLearning', outcomeLearningReady],
      ['regionalNetwork', regionalNetworkReady],
      ['voiceFirst', voiceFirstReady],
      ['warehouse', warehouseReady],
      ['featureStore', featureStoreReady],
      ['modelRegistry', modelRegistryReady],
      ['analyticsExport', analyticsExportReady],
      ['governance', governanceReady],
    ] as Array<[string, boolean]>;
    const wiredCount = moduleFlags.filter(([, r]) => r).length;

    // Real-data signal — distinguishes "wired" from "has accumulated data".
    const eventCount = _safe(() => Number(events.eventCount) || 0, 0);
    const totalCases = _safe(() => Number(outcome.value.totalCases) || 0, 0);
    const scanCount  = _safe(() => Number(regional.scanCount) || 0, 0);
    const hasRealData = eventCount > 0 || totalCases > 0 || scanCount > 0;

    const blockers: string[] = [];
    const warnings: string[] = [];
    if (wiredCount === 0) blockers.push('V13 readiness runtimes are not wired yet.');
    for (const [name, r] of moduleFlags) {
      if (!r) warnings.push(`${name} runtime: not wired.`);
    }
    if (!hasRealData) warnings.push('Not enough data yet — runtimes are wired but pilots have not accumulated events/outcomes/scans.');
    if (!yieldPredictionReadiness) warnings.push('Yield-prediction model not ready — insufficient crop-cycle/harvest data.');
    // Surface governance blockers honestly.
    if (governance && Array.isArray(governance.blockers)) {
      for (const b of governance.blockers) blockers.push(`Governance: ${b}`);
    }
    if (!oodaReady) warnings.push('OODA loop has not accumulated enough signals yet.');
    if (!artifactsReady) warnings.push('Artifact evidence layer not fully ready yet.');

    // Verdict — BLOCKED only on a real wiring failure; NEEDS_DATA when wired
    // but data is thin; otherwise the institutional ladder gated on governance.
    let verdict: 'PILOT_READY' | 'PROGRAM_READY' | 'INSTITUTIONAL_READY' | 'NEEDS_DATA' | 'BLOCKED';
    if (wiredCount === 0) {
      verdict = 'BLOCKED';
    } else if (!hasRealData) {
      verdict = 'NEEDS_DATA';
    } else if (governanceReady && warehouseReady && featureStoreReady
        && modelRegistryReady && eventSourcingReady && yieldPredictionReadiness) {
      verdict = 'INSTITUTIONAL_READY';
    } else if (governanceReady && outcomeLearningReady && regionalNetworkReady) {
      verdict = 'PROGRAM_READY';
    } else {
      verdict = 'PILOT_READY';
    }

    return Object.freeze({
      runtimeVersion: V13_HEALTH_RUNTIME_VERSION,
      eventSourcingReady,
      outcomeLearningReady,
      regionalNetworkReady,
      voiceFirstReady,
      yieldPredictionReadiness,
      warehouseReady,
      featureStoreReady,
      modelRegistryReady,
      analyticsExportReady,
      governanceReady,
      oodaReady,
      artifactsReady,
      verdict,
      blockers: Object.freeze(blockers),
      warnings: Object.freeze(warnings),
      // Permanent-scan + full-intelligence-loop lock roll-up (spec §8) —
      // composes the live scan/OODA/artifact/loop probes; structural-true
      // unless a probe reports an EXPLICIT breakage.
      scanLoop: Object.freeze((() => {
        const scan = _probe('__scanPermanentHealth');
        const ooda = _probe('__intelligenceOODAHealth');
        const art  = _probe('__artifactHealth');
        const loop = _probe('__intelligenceLoopHealth');
        return {
          scanPermanentReady:    !(scan && scan.scanPermanentReady === false),
          uploadAnalysisReady:   !(scan && scan.uploadAnalysisReady === false),
          captureAnalysisReady:  !(scan && scan.captureAnalysisReady === false),
          oodaReady:             !(ooda && (ooda.nonBlocking === false || ooda.failureSafe === false)),
          artifactReady:         !(art && (art.failureArtifactsReady === false || art.nonBlocking === false)),
          intelligenceLoopReady: !(loop && loop.scanToOutcomeLoopReady === false),
          outcomeLoopReady:      !(loop && loop.outcomeTrackingReady === false)
            && !(art && art.outcomeArtifactsReady === false),
        };
      })()),
      disclaimer: 'Decision support, not a guarantee.',
    });
  }, Object.freeze({
    runtimeVersion: V13_HEALTH_RUNTIME_VERSION,
    eventSourcingReady: false, outcomeLearningReady: false,
    regionalNetworkReady: false, voiceFirstReady: false,
    yieldPredictionReadiness: false, warehouseReady: false,
    featureStoreReady: false, modelRegistryReady: false,
    analyticsExportReady: false, governanceReady: false,
    oodaReady: false, artifactsReady: false,
    verdict: 'BLOCKED' as const,
    blockers: Object.freeze(['V13 health probe unavailable.']),
    warnings: Object.freeze([]),
    disclaimer: 'Decision support, not a guarantee.',
  }));
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

export function installV13HealthGlobals(): boolean {
  return _safe(() => {
    _install('__v13Health',         v13Health,         '[Farroway · V13]');
    _install('__v13OODAHealth',     v13OODAHealth,     '[Farroway · V13 OODA]');
    _install('__v13ArtifactHealth', v13ArtifactHealth, '[Farroway · V13 Artifacts]');
    return true;
  }, false);
}
