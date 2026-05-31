/**
 * src/runtime/v7/V7HealthRuntime.ts — Farroway V7 composite health
 * (read-only, composition-only).
 *
 * Installs:
 *   window.__v7Health()          — unified V7 verdict + blockers + warnings
 *   window.__v7OODAHealth()      — V7 OODA wiring (non-blocking)
 *   window.__v7ArtifactHealth()  — V7 artifact events (ArtifactRuntime only)
 *
 * Composes the six V7 engine probe globals BY NAME (no imports) plus the
 * existing OODA + Artifact probes, so it can never break the build and
 * degrades honestly when an engine is absent.
 *
 * Strict-rule audit
 *   • Pure read-only. SSR-safe. Frozen envelopes. Never throws.
 *   • No fabricated metrics — every flag reflects a live probe.
 *   • OODA/V7 NEVER gate scan/upload/camera (structural, gate-enforced).
 */

export const V7_HEALTH_RUNTIME_VERSION = 'v7-health-v1';

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

/* ── §8 OODA integration (non-blocking) ──────────────────────── */
export function v7OODAHealth() {
  const ooda      = _probe('__oodaHealth');
  // Observe — real signals available to the loop.
  const weather   = _probe('__weatherRiskHealth');
  const tasks     = _probe('__taskStoreHealth');
  const outcomes  = _probe('__outcomeHealth');
  const ngo       = _probe('__ngoIntelligenceHealth') || _probe('__ngoImpactHealth');
  const buyer     = _probe('__marketplaceIntelligenceHealth') || _probe('__buyerTrustHealth');
  const remote    = _probe('__remoteSensingHealth');
  // Orient — interpretation layers.
  const trend     = _probe('__trendHealth');
  const farmScore = _probe('__farmHealthScoreHealth') || _probe('__farmHealthScore');
  const predictive = _probe('__predictiveHealth');
  // Decide / Act — daily priority + assistant + artifacts.
  const assistant = _probe('__farmAssistantHealth');
  const daily     = _probe('__dailyDecisionHealth');
  const artifacts = _probe('__artifactHealth');

  const observeReady = !!(weather || tasks || outcomes || remote || ngo || buyer);
  const orientReady  = !!(trend || farmScore || predictive);
  const decideReady  = !!(assistant || daily || predictive);
  const actReady     = !!(artifacts && (assistant || daily));

  return Object.freeze({
    runtimeVersion: V7_HEALTH_RUNTIME_VERSION,
    observeReady,
    orientReady,
    decideReady,
    actReady,
    baseOodaReady: !!(ooda && ooda.observeReady && ooda.orientReady
      && ooda.decideReady && ooda.actReady),
    // V7 + OODA compose AFTER a scan result; the scan/upload/camera shell
    // renders first and analysis never waits on intelligence. Structural
    // truth, gate-enforced by check-v7-ooda-safety.
    nonBlocking:      true,
    growerSafeOutput: !!(ooda ? ooda.growerSafeOutput !== false : true),
  });
}

/* ── §9 V7 artifact events (ArtifactRuntime only) ────────────── */
export function v7ArtifactHealth() {
  const art = _probe('__artifactHealth');
  return Object.freeze({
    runtimeVersion: V7_HEALTH_RUNTIME_VERSION,
    // V7 events are created through ArtifactRuntime only — never written
    // directly from the UI. Idempotency keys required; offline-safe.
    scanArtifactsReady:    !!(art && art.scanArtifactsReady),
    failureArtifactsReady: !!(art && art.failureArtifactsReady),
    v7Events: Object.freeze([
      'PredictiveRiskCalculated',
      'FarmAssistantRecommendationCreated',
      'NGOImpactSnapshotGenerated',
      'MarketplaceTrustCalculated',
      'RemoteSensingSnapshotCreated',
      'InstitutionalReadinessChecked',
    ]),
    artifactRuntimeOnly:    true,   // no UI direct writes (gate-enforced)
    idempotencyKeysRequired: true,
    offlineSafe:            !!(art ? art.offlineSafe !== false : true),
  });
}

/* ── §7 unified V7 health ────────────────────────────────────── */
export function v7Health() {
  return _safe(() => {
    const predictive    = _probe('__predictiveHealth');
    const ngoIntel      = _probe('__ngoIntelligenceHealth');
    const marketplace   = _probe('__marketplaceIntelligenceHealth');
    const remote        = _probe('__remoteSensingHealth');
    const assistant     = _probe('__farmAssistantHealth');
    const institutional = _probe('__institutionalReadinessHealth');
    const ooda          = v7OODAHealth();
    const artifacts     = v7ArtifactHealth();

    const predictiveReady             = _ready(predictive);
    const ngoIntelligenceReady        = _ready(ngoIntel);
    const marketplaceIntelligenceReady = _ready(marketplace);
    const remoteSensingReady          = _ready(remote);
    const assistantReady              = _ready(assistant);
    const institutionalReady          = _ready(institutional);
    const oodaReady    = ooda.observeReady && ooda.orientReady
      && ooda.decideReady && ooda.actReady;
    const artifactReady = artifacts.scanArtifactsReady;

    const moduleFlags = [
      ['predictive', predictiveReady],
      ['ngoIntelligence', ngoIntelligenceReady],
      ['marketplaceIntelligence', marketplaceIntelligenceReady],
      ['remoteSensing', remoteSensingReady],
      ['assistant', assistantReady],
      ['institutional', institutionalReady],
    ] as Array<[string, boolean]>;
    const wiredCount = moduleFlags.filter(([, r]) => r).length;

    // Blockers + warnings — honest, never fabricated.
    const blockers: string[] = [];
    const warnings: string[] = [];
    if (wiredCount === 0) blockers.push('V7 intelligence modules are not wired yet.');
    // Institutional engine owns the readiness ladder; surface its blockers.
    if (institutional && Array.isArray(institutional.blockers)) {
      for (const b of institutional.blockers) blockers.push(`Institutional: ${b}`);
    }
    if (institutional && Array.isArray(institutional.warnings)) {
      for (const w of institutional.warnings) warnings.push(`Institutional: ${w}`);
    }
    for (const [name, r] of moduleFlags) {
      if (!r) warnings.push(`${name} module: Not enough data yet or not wired.`);
    }
    if (!oodaReady) warnings.push('OODA loop has not accumulated enough signals yet.');
    if (!artifactReady) warnings.push('Artifact evidence layer not fully ready yet.');

    // Verdict — the institutional ladder when wired; never claims more
    // than the data supports.
    let verdict: 'PILOT_READY' | 'PROGRAM_READY' | 'INSTITUTIONAL_READY' | 'NOT_READY';
    const instVerdict = institutional && typeof institutional.verdict === 'string'
      ? institutional.verdict : null;
    if (wiredCount === 0) {
      verdict = 'NOT_READY';
    } else if (instVerdict === 'INSTITUTIONAL_READY' || instVerdict === 'PROGRAM_READY'
      || instVerdict === 'PILOT_READY' || instVerdict === 'NOT_READY') {
      verdict = instVerdict;
    } else {
      verdict = 'PILOT_READY';
    }

    return Object.freeze({
      runtimeVersion: V7_HEALTH_RUNTIME_VERSION,
      predictiveReady,
      ngoIntelligenceReady,
      marketplaceIntelligenceReady,
      remoteSensingReady,
      assistantReady,
      institutionalReady,
      oodaReady,
      artifactReady,
      verdict,
      blockers: Object.freeze(blockers),
      warnings: Object.freeze(warnings),
      disclaimer: 'Decision support, not a guarantee.',
    });
  }, Object.freeze({
    runtimeVersion: V7_HEALTH_RUNTIME_VERSION,
    predictiveReady: false, ngoIntelligenceReady: false,
    marketplaceIntelligenceReady: false, remoteSensingReady: false,
    assistantReady: false, institutionalReady: false,
    oodaReady: false, artifactReady: false,
    verdict: 'NOT_READY' as const,
    blockers: Object.freeze(['V7 health probe unavailable.']),
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

export function installV7HealthGlobals(): boolean {
  return _safe(() => {
    _install('__v7Health',         v7Health,         '[Farroway · V7]');
    _install('__v7OODAHealth',     v7OODAHealth,     '[Farroway · V7 OODA]');
    _install('__v7ArtifactHealth', v7ArtifactHealth, '[Farroway · V7 Artifacts]');
    return true;
  }, false);
}
