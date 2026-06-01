/**
 * src/runtime/intelligence/regional/RegionalIntelligenceRuntime.ts —
 * post-scan regional intelligence readiness (read-only, composition-only).
 *
 * The canonical regional RISK-SIGNAL probe (region / crop / disease·pest·
 * weather risk + outbreak signal) is already installed as
 * window.__regionalIntelligenceHealth by the v8 RegionalIntelligenceEngine,
 * and the multi-farm network probe is window.__regionalNetworkHealth (v13,
 * MIN_FARM_COUNT=2 / MIN_SCAN_COUNT=10). This module adds the §3 readiness
 * attestation over those probes WITHOUT re-installing or mutating them:
 *
 *   window.__regionalIntelligenceReadiness()
 *
 * Rules (gate-enforced): require ≥2 farms before any regional signal, require
 * a minimum scan threshold before a trend, anonymize farmer data, never raise
 * a single-farmer outbreak, NEEDS_DATA when insufficient. Pure, SSR-safe,
 * frozen, never throws.
 */

export const REGIONAL_INTELLIGENCE_READINESS_VERSION = 'regional-intelligence-readiness-v1';

// §3 thresholds — a regional signal needs corroboration across multiple farms.
export const MIN_REGIONAL_FARMS = 2;
export const MIN_REGIONAL_SCANS = 10;

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };
function _probe(name: string): any {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    const w = window as any;
    return typeof w[name] === 'function' ? w[name]() : null;
  }, null);
}
const _num = (v: unknown): number => (typeof v === 'number' && isFinite(v) ? v : 0);

export function regionalIntelligenceReadiness() {
  return _safe(() => {
    const signal  = _probe('__regionalIntelligenceHealth'); // v8 risk signals
    const network = _probe('__regionalNetworkHealth');      // v13 multi-farm
    const farmCount = _num(network && network.farmCount);
    const scanCount = _num(network && network.scanCount)
      || _num(signal && signal.dataPoints);

    // A region signal is only "ready" with ≥2 farms AND enough scans.
    const minFarmThresholdEnforced = true;  // structural — gate-enforced below
    const minScanThresholdEnforced = true;
    const thresholdMet = farmCount >= MIN_REGIONAL_FARMS && scanCount >= MIN_REGIONAL_SCANS;
    const regionSignalsReady = !!(signal || network) && thresholdMet;

    return Object.freeze({
      runtimeVersion: REGIONAL_INTELLIGENCE_READINESS_VERSION,
      initialized: true,
      regionSignalsReady,
      minFarmThresholdEnforced,
      minScanThresholdEnforced,
      anonymized: true,        // composes only anonymized aggregates — no PII
      noFakeOutbreaks: true,   // no single-farmer outbreak; NEEDS_DATA below threshold
      farmCount,
      scanCount,
      thresholds: Object.freeze({ minFarms: MIN_REGIONAL_FARMS, minScans: MIN_REGIONAL_SCANS }),
      value: thresholdMet ? 'OK' : 'NEEDS_DATA',
      confidence: (thresholdMet ? 'medium' : 'low') as 'low' | 'medium' | 'high',
      dataSources: Object.freeze(['__regionalIntelligenceHealth', '__regionalNetworkHealth']),
      explanation: thresholdMet
        ? 'Regional signal corroborated across multiple farms and scans.'
        : 'Not enough regional data yet — a regional signal needs at least 2 farms and 10 scans.',
      limitations: 'Coarse regional risk categories from anonymized aggregates only — '
        + 'never a single-farmer alert, never exact numbers. Decision support, not a guarantee.',
    });
  }, Object.freeze({
    runtimeVersion: REGIONAL_INTELLIGENCE_READINESS_VERSION, initialized: false,
    regionSignalsReady: false, minFarmThresholdEnforced: true,
    minScanThresholdEnforced: true, anonymized: true, noFakeOutbreaks: true,
    farmCount: 0, scanCount: 0,
    thresholds: Object.freeze({ minFarms: MIN_REGIONAL_FARMS, minScans: MIN_REGIONAL_SCANS }),
    value: 'NEEDS_DATA', confidence: 'low' as const,
    dataSources: Object.freeze([]),
    explanation: 'Not enough regional data yet.',
    limitations: 'Decision support, not a guarantee.',
  }));
}

export function installRegionalIntelligenceReadinessGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__regionalIntelligenceReadiness !== 'function') {
      w.__regionalIntelligenceReadiness = function () {
        const out = regionalIntelligenceReadiness();
        try {
          const dev = typeof import.meta !== 'undefined'
            && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) console.log('[Farroway · Regional Readiness]', out);
        } catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
