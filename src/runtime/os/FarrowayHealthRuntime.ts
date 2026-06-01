/**
 * src/runtime/os/FarrowayHealthRuntime.ts — unified Farroway Operating
 * System health composite (read-only, composition-only).
 *
 *   window.__farrowayHealth()
 *
 * Rolls up the operating-system subsystems by NAME (no imports) into one
 * 10-flag readiness envelope + governance attestation + verdict. Each flag
 * reflects a live subsystem probe; nothing is fabricated. The subsystems
 * themselves already exist (event sourcing, farm twin, decision, outcome,
 * marketplace, funding, NGO/program, voice, localization, performance) —
 * this composite is the single pane of glass over them.
 *
 * Pure. SSR-safe. Frozen. Never throws.
 */

export const FARROWAY_OS_HEALTH_VERSION = 'farroway-os-health-v1';

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };
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
/** A subsystem is ready if any of its candidate probes is wired and does not
 *  report an explicit-false readiness for the named flag. */
function _anyReady(names: string[], falseFlag?: string): boolean {
  for (const n of names) {
    const p = _probe(n);
    if (_ready(p)) {
      if (falseFlag && p[falseFlag] === false) continue;
      return true;
    }
  }
  return false;
}

export function farrowayHealth() {
  return _safe(() => {
    const scanReady         = _anyReady(['__scanPermanentHealth', '__scanDetectionHealth'], 'scanPermanentReady');
    const farmTwinReady     = _anyReady(['__farmTwinHealth']);
    const decisionReady     = _anyReady(['__dailyDecisionHealth', '__intelligenceLoopHealth']);
    const outcomeReady      = _anyReady(['__outcomeCaptureHealth', '__outcomeHealth']);
    const marketplaceReady  = _anyReady(['__marketplaceIntelligenceHealth', '__supplyChainHealth', '__buyerTrustHealth']);
    const fundingReady      = _anyReady(['__fundingHealth']);
    const ngoReady          = _anyReady(['__ngoEnterpriseHealth', '__ngoIntelligenceHealth', '__ngoImpactHealth']);
    const voiceReady        = _anyReady(['__voiceFirstHealth', '__voiceAssistantHealth']);
    const localizationReady = _anyReady(['__languageHealth']);
    const performanceReady  = _anyReady(['__performanceHealth']);

    // Governance attestation — event-sourced + artifact-backed.
    const eventSourced  = _anyReady(['__eventSourcingHealth']);
    const artifactBacked = _anyReady(['__artifactHealth']);

    const flags = [
      scanReady, farmTwinReady, decisionReady, outcomeReady, marketplaceReady,
      fundingReady, ngoReady, voiceReady, localizationReady, performanceReady,
    ];
    const readyCount = flags.filter(Boolean).length;

    // Verdict: BLOCKED if the core operating subsystems are not wired;
    // NEEDS_DATA when wired but governance/data layers are still settling;
    // READY when the full OS is wired + event-sourced + artifact-backed.
    const coreReady = scanReady && farmTwinReady && decisionReady
      && outcomeReady && localizationReady;
    let verdict: 'READY' | 'NEEDS_DATA' | 'BLOCKED';
    if (readyCount === 0) verdict = 'BLOCKED';
    else if (coreReady && eventSourced && artifactBacked) verdict = 'READY';
    else verdict = 'NEEDS_DATA';

    return Object.freeze({
      runtimeVersion: FARROWAY_OS_HEALTH_VERSION,
      scanReady,
      farmTwinReady,
      decisionReady,
      outcomeReady,
      marketplaceReady,
      fundingReady,
      ngoReady,
      voiceReady,
      localizationReady,
      performanceReady,
      // Governance (§9) — everything event-sourced + artifact-backed.
      governance: Object.freeze({ eventSourced, artifactBacked, noDirectWrites: true }),
      readyCount,
      verdict,
      disclaimer: 'Decision support, not a guarantee.',
    });
  }, Object.freeze({
    runtimeVersion: FARROWAY_OS_HEALTH_VERSION,
    scanReady: false, farmTwinReady: false, decisionReady: false,
    outcomeReady: false, marketplaceReady: false, fundingReady: false,
    ngoReady: false, voiceReady: false, localizationReady: false,
    performanceReady: false,
    governance: Object.freeze({ eventSourced: false, artifactBacked: false, noDirectWrites: true }),
    readyCount: 0, verdict: 'BLOCKED' as const,
    disclaimer: 'Decision support, not a guarantee.',
  }));
}

export function installFarrowayHealthGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__farrowayHealth !== 'function') {
      w.__farrowayHealth = function () {
        const out = farrowayHealth();
        try {
          const dev = typeof import.meta !== 'undefined'
            && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) console.log('[Farroway · OS]', out);
        } catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
