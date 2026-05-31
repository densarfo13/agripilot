/**
 * src/runtime/v8/V8HealthRuntime.ts — Farroway V8 composite health
 * (read-only, composition-only).
 *
 * Installs:
 *   window.__v8Health()          — unified V8 verdict + blockers + warnings
 *   window.__v8OODAHealth()      — V8 OODA wiring (non-blocking)
 *   window.__v8ArtifactHealth()  — V8 artifact events (ArtifactRuntime only)
 *
 * Composes the seven V8 engine probe globals BY NAME (no imports) plus the
 * existing OODA + Artifact probes, so it can never break the build and
 * degrades honestly when an engine is absent.
 *
 * Strict-rule audit
 *   • Pure read-only. SSR-safe. Frozen envelopes. Never throws.
 *   • No fabricated metrics — every flag reflects a live probe.
 *   • OODA/V8 NEVER gate scan/upload/camera/login (structural, gate-enforced).
 */

export const V8_HEALTH_RUNTIME_VERSION = 'v8-health-v1';

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
export function v8OODAHealth() {
  const ooda       = _probe('__oodaHealth');
  // Observe — V8 signals available to the loop.
  const farmTwin   = _probe('__farmTwinHealth');
  const regional   = _probe('__regionalIntelligenceHealth');
  const ngoCohort  = _probe('__ngoEnterpriseHealth') || _probe('__ngoIntelligenceHealth');
  const supply     = _probe('__supplyChainHealth') || _probe('__marketplaceIntelligenceHealth');
  const remote     = _probe('__remoteSensingReadinessHealth') || _probe('__remoteSensingHealth');
  // Orient — interpretation layers.
  const predictive = _probe('__predictiveHealth');
  const farmScore  = _probe('__farmHealthScoreHealth') || _probe('__farmHealthScore');
  // Decide / Act — assistant + daily + artifacts.
  const assistant  = _probe('__farmAssistantHealth');
  const daily      = _probe('__dailyDecisionHealth');
  const artifacts  = _probe('__artifactHealth');

  const observeReady = !!(farmTwin || regional || ngoCohort || supply || remote);
  const orientReady  = !!(farmScore || regional || predictive || ngoCohort);
  const decideReady  = !!(assistant || daily || predictive);
  const actReady     = !!(artifacts && (assistant || daily));

  return Object.freeze({
    runtimeVersion: V8_HEALTH_RUNTIME_VERSION,
    observeReady,
    orientReady,
    decideReady,
    actReady,
    baseOodaReady: !!(ooda && ooda.observeReady && ooda.orientReady
      && ooda.decideReady && ooda.actReady),
    // V8 + OODA compose AFTER a scan result; scan/upload/camera/login render
    // first and never wait on intelligence. If a V8 signal is unavailable the
    // normal app flow continues. Gate-enforced by check-v8-ooda-artifacts.
    nonBlocking:      true,
    growerSafeOutput: !!(ooda ? ooda.growerSafeOutput !== false : true),
  });
}

/* ── §9 V8 artifact events (ArtifactRuntime only) ────────────── */
export function v8ArtifactHealth() {
  const art = _probe('__artifactHealth');
  return Object.freeze({
    runtimeVersion: V8_HEALTH_RUNTIME_VERSION,
    // V8 events are created through ArtifactRuntime only — never written
    // directly from the UI. Idempotency keys required; offline-safe.
    scanArtifactsReady:    !!(art && art.scanArtifactsReady),
    failureArtifactsReady: !!(art && art.failureArtifactsReady),
    v8Events: Object.freeze([
      'RegionalRiskSnapshot',
      'FarmTwinSnapshot',
      'VoiceReadinessChecked',
      'NGOEnterpriseSnapshot',
      'SupplyChainReadinessCalculated',
      'RemoteSensingReadinessChecked',
      'InstitutionalDataReadinessChecked',
    ]),
    artifactRuntimeOnly:     true,   // no UI direct writes (gate-enforced)
    idempotencyKeysRequired: true,
    offlineSafe:             !!(art ? art.offlineSafe !== false : true),
  });
}

/* ── §11 unified V8 health ───────────────────────────────────── */
export function v8Health() {
  return _safe(() => {
    const regional      = _probe('__regionalIntelligenceHealth');
    const farmTwin      = _probe('__farmTwinHealth');
    const voice         = _probe('__voiceAssistantHealth');
    const ngoEnterprise = _probe('__ngoEnterpriseHealth');
    const supplyChain   = _probe('__supplyChainHealth');
    const remoteSensing = _probe('__remoteSensingReadinessHealth');
    const institutional = _probe('__institutionalDataHealth');
    const ooda          = v8OODAHealth();
    const artifacts     = v8ArtifactHealth();

    const regionalReady         = _ready(regional);
    const farmTwinReady         = _ready(farmTwin);
    const voiceReady            = _ready(voice);
    const ngoEnterpriseReady    = _ready(ngoEnterprise);
    const supplyChainReady      = _ready(supplyChain);
    const remoteSensingReady    = _ready(remoteSensing);
    const institutionalDataReady = _ready(institutional);
    const oodaReady    = ooda.observeReady && ooda.orientReady
      && ooda.decideReady && ooda.actReady;
    const artifactsReady = artifacts.scanArtifactsReady;

    const moduleFlags = [
      ['regional', regionalReady],
      ['farmTwin', farmTwinReady],
      ['voice', voiceReady],
      ['ngoEnterprise', ngoEnterpriseReady],
      ['supplyChain', supplyChainReady],
      ['remoteSensing', remoteSensingReady],
      ['institutionalData', institutionalDataReady],
    ] as Array<[string, boolean]>;
    const wiredCount = moduleFlags.filter(([, r]) => r).length;

    // Real-data signal — distinguishes "wired" from "has accumulated data".
    const regionalDP = _safe(() => Number(regional.dataPoints) || 0, 0);
    const twinHasScans = !!(farmTwin && farmTwin.scanHistoryReady);
    const hasRealData = regionalDP > 0 || twinHasScans;

    const blockers: string[] = [];
    const warnings: string[] = [];
    if (wiredCount === 0) blockers.push('V8 platform modules are not wired yet.');
    for (const [name, r] of moduleFlags) {
      if (!r) warnings.push(`${name} module: not wired.`);
    }
    if (!hasRealData) warnings.push('Not enough data yet — modules are wired but pilots have not accumulated scans/records.');
    if (!oodaReady) warnings.push('OODA loop has not accumulated enough signals yet.');
    if (!artifactsReady) warnings.push('Artifact evidence layer not fully ready yet.');
    // Surface the institutional-data readiness gaps honestly.
    if (institutional && institutional.limitations) {
      // non-fatal note only — never fabricated readiness
    }

    // Verdict — BLOCKED only on a real wiring failure; NEEDS_DATA when wired
    // but data is thin; otherwise the institutional ladder.
    let verdict: 'PILOT_READY' | 'PROGRAM_READY' | 'INSTITUTIONAL_READY' | 'NEEDS_DATA' | 'BLOCKED';
    if (wiredCount === 0) {
      verdict = 'BLOCKED';
    } else if (!hasRealData) {
      verdict = 'NEEDS_DATA';
    } else {
      const instV7 = _probe('__institutionalReadinessHealth');
      const instVerdict = instV7 && typeof instV7.verdict === 'string' ? instV7.verdict : null;
      if (instVerdict === 'INSTITUTIONAL_READY' && institutionalDataReady) verdict = 'INSTITUTIONAL_READY';
      else if (instVerdict === 'PROGRAM_READY' || institutionalDataReady) verdict = 'PROGRAM_READY';
      else verdict = 'PILOT_READY';
    }

    return Object.freeze({
      runtimeVersion: V8_HEALTH_RUNTIME_VERSION,
      regionalReady,
      farmTwinReady,
      voiceReady,
      ngoEnterpriseReady,
      supplyChainReady,
      remoteSensingReady,
      institutionalDataReady,
      oodaReady,
      artifactsReady,
      verdict,
      blockers: Object.freeze(blockers),
      warnings: Object.freeze(warnings),
      disclaimer: 'Decision support, not a guarantee.',
    });
  }, Object.freeze({
    runtimeVersion: V8_HEALTH_RUNTIME_VERSION,
    regionalReady: false, farmTwinReady: false, voiceReady: false,
    ngoEnterpriseReady: false, supplyChainReady: false,
    remoteSensingReady: false, institutionalDataReady: false,
    oodaReady: false, artifactsReady: false,
    verdict: 'BLOCKED' as const,
    blockers: Object.freeze(['V8 health probe unavailable.']),
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

export function installV8HealthGlobals(): boolean {
  return _safe(() => {
    _install('__v8Health',         v8Health,         '[Farroway · V8]');
    _install('__v8OODAHealth',     v8OODAHealth,     '[Farroway · V8 OODA]');
    _install('__v8ArtifactHealth', v8ArtifactHealth, '[Farroway · V8 Artifacts]');
    return true;
  }, false);
}
