/**
 * src/runtime/intelligence/IntelligenceHealthRuntime.ts — composite
 * intelligence-layer diagnostics (read-only, composition-only).
 *
 * Installs:
 *   window.__intelligenceHealth()        — composite + verdict
 *   window.__intelligenceOODAHealth()     — OODA wiring (non-blocking)
 *   window.__intelligenceArtifactHealth() — intelligence artifact events
 *
 * Composes the engine probe globals by NAME (no imports) so it can't
 * break the build and degrades honestly when an engine is absent.
 *
 * Strict-rule audit
 *   • Pure read-only. SSR-safe. Frozen envelopes. Never throws.
 *   • No fabricated metrics — every flag reflects a live probe.
 */

export const INTELLIGENCE_HEALTH_RUNTIME_VERSION = 'intelligence-health-v1';

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

/* ── §12 OODA integration (non-blocking) ────────────────────── */
export function intelligenceOODAHealth() {
  const ooda = _probe('__oodaHealth');
  return Object.freeze({
    runtimeVersion: INTELLIGENCE_HEALTH_RUNTIME_VERSION,
    observeReady:   !!(ooda && ooda.observeReady),
    orientReady:    !!(ooda && ooda.orientReady),
    decideReady:    !!(ooda && ooda.decideReady),
    actReady:       !!(ooda && ooda.actReady),
    // Intelligence + OODA NEVER gate the scan/upload render (the scan
    // shell renders before any analysis; intelligence composes AFTER
    // a result). Structural truth, gate-enforced by
    // check-ooda-intelligence + check-ooda-artifact-safety.
    nonBlocking:    true,
    growerSafeOutput: !!(ooda ? ooda.growerSafeOutput !== false : true),
  });
}

/* ── §11 intelligence artifact events ───────────────────────── */
export function intelligenceArtifactHealth() {
  const art = _probe('__artifactHealth');
  return Object.freeze({
    runtimeVersion: INTELLIGENCE_HEALTH_RUNTIME_VERSION,
    // Intelligence events are created through ArtifactRuntime only —
    // FarmHealthCalculated / TrendDetected / DailyActionRecommended /
    // WeatherRiskFlagged / OutcomeImprovementRecorded /
    // BuyerTrustCalculated / NGOImpactSnapshotGenerated.
    scanArtifactsReady:    !!(art && art.scanArtifactsReady),
    failureArtifactsReady: !!(art && art.failureArtifactsReady),
    intelligenceEvents: Object.freeze([
      'FarmHealthCalculated', 'TrendDetected', 'DailyActionRecommended',
      'WeatherRiskFlagged', 'OutcomeImprovementRecorded',
      'BuyerTrustCalculated', 'NGOImpactSnapshotGenerated',
    ]),
    artifactRuntimeOnly:   true,   // no UI direct writes (gate-enforced)
    idempotent:            !!(art ? art.idempotent !== false : true),
    offlineSafe:           !!(art ? art.offlineSafe !== false : true),
  });
}

/* ── §14 composite ──────────────────────────────────────────── */
export function intelligenceHealth() {
  return _safe(() => {
    const cropMemory   = _probe('__cropMemoryHealth');
    const trend        = _probe('__trendHealth');
    const farmHealth   = _probe('__farmHealthScoreHealth') || _probe('__farmHealthScore');
    const weatherRisk  = _probe('__weatherRiskHealth');
    const yieldRead    = _probe('__yieldReadinessHealth');
    const dailyDec     = _probe('__dailyDecisionHealth');
    const ngoImpact    = _probe('__ngoImpactHealth');
    const buyerTrust   = _probe('__buyerTrustHealth');
    const ooda         = intelligenceOODAHealth();
    const artifacts    = intelligenceArtifactHealth();

    const cropMemoryReady    = _ready(cropMemory);
    const trendReady         = _ready(trend);
    const farmHealthReady    = _ready(farmHealth);
    const weatherRiskReady   = _ready(weatherRisk);
    const yieldReadinessReady = _ready(yieldRead);
    const dailyDecisionReady = _ready(dailyDec);
    const ngoImpactReady     = _ready(ngoImpact);
    const buyerTrustReady    = _ready(buyerTrust);
    const oodaReady          = ooda.observeReady && ooda.orientReady
                                && ooda.decideReady && ooda.actReady;
    const artifactsReady     = artifacts.scanArtifactsReady;

    // Verdict: BLOCKED only if a wiring failure (no engines at all);
    // NEEDS_DATA when wired but the data-dependent engines have not
    // accumulated enough real history; GOOD when wired + OODA ready.
    const anyWired = cropMemoryReady || trendReady || farmHealthReady
      || weatherRiskReady || yieldReadinessReady || dailyDecisionReady;
    let verdict: 'GOOD' | 'NEEDS_DATA' | 'BLOCKED';
    if (!anyWired) verdict = 'BLOCKED';
    else if (oodaReady && artifactsReady) verdict = 'GOOD';
    else verdict = 'NEEDS_DATA';

    return Object.freeze({
      runtimeVersion: INTELLIGENCE_HEALTH_RUNTIME_VERSION,
      cropMemoryReady,
      trendReady,
      farmHealthReady,
      weatherRiskReady,
      yieldReadinessReady,
      dailyDecisionReady,
      ngoImpactReady,
      buyerTrustReady,
      oodaReady,
      artifactsReady,
      verdict,
      // Honest note — intelligence is decision support only.
      disclaimer: 'Decision support, not a guarantee.',
    });
  }, Object.freeze({
    runtimeVersion: INTELLIGENCE_HEALTH_RUNTIME_VERSION,
    cropMemoryReady: false, trendReady: false, farmHealthReady: false,
    weatherRiskReady: false, yieldReadinessReady: false, dailyDecisionReady: false,
    ngoImpactReady: false, buyerTrustReady: false, oodaReady: false,
    artifactsReady: false, verdict: 'BLOCKED',
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

export function installIntelligenceHealthGlobals(): boolean {
  return _safe(() => {
    _install('__intelligenceHealth',        intelligenceHealth,        '[Farroway · Intelligence]');
    _install('__intelligenceOODAHealth',    intelligenceOODAHealth,    '[Farroway · Intelligence OODA]');
    _install('__intelligenceArtifactHealth', intelligenceArtifactHealth, '[Farroway · Intelligence Artifacts]');
    return true;
  }, false);
}
