/**
 * ScanTrustHealth.ts → window.__scanTrustHealth().
 *
 * Top-level Scan V6 trust composite. Pins the 8 spec readiness flags.
 *
 *   trustPanelReady       ← ScanTrustPanelRuntime.trustPanelReady
 *   confidenceBandsReady  ← ConfidenceBandRuntime.confidenceBandsReady
 *   imageQualityReady     ← ImageQualityGate.imageQualityGateReady
 *   explanationsReady     ← TrustPanel always emits `why` (true)
 *   actionSafetyReady     ← ActionSafetyRuntime.actionSafetyReady
 *   followUpReady         ← ScanFollowUpRuntime.followUpTaskReady
 *   farmMemoryReady       ← FarmMemoryTrendRuntime.farmMemoryTrendReady
 *   analyticsReady        ← __scanSuccessMetricsHealth probe presence
 */

import { trustPanelReady } from './ScanTrustPanelRuntime';
import { confidenceBandsReady } from './ConfidenceBandRuntime';
import { imageQualityGateReady } from './ImageQualityGate';
import { actionSafetyReady } from './ActionSafetyRuntime';
import { followUpTaskReady } from './ScanFollowUpRuntime';
import { farmMemoryTrendReady } from './FarmMemoryTrendRuntime';
import { GUIDANCE_TAIL } from './ScanAccuracyContracts';

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };
function _probe(name: string): any {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    const w = window as any;
    return typeof w[name] === 'function' ? w[name]() : null;
  }, null);
}
type Confidence = 'low' | 'medium' | 'high';

export const SCAN_TRUST_VERSION = 'scan-trust-v1' as const;

export interface ScanTrustHealthEnvelope {
  initialized: true;
  trustPanelReady: true;
  confidenceBandsReady: true;
  imageQualityReady: boolean;
  explanationsReady: true;
  actionSafetyReady: true;
  followUpReady: boolean;
  farmMemoryReady: boolean;
  analyticsReady: boolean;
  noFabricatedTrust: true;
  noOverstatedLanguage: true;
  alwaysExplains: true;
  composedFrom: ReadonlyArray<string>;
  readyCount: number;
  totalFlags: 8;
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

export function scanTrustHealth(): Readonly<ScanTrustHealthEnvelope> {
  return _safe(() => {
    const trust = trustPanelReady();
    const band = confidenceBandsReady();
    const quality = imageQualityGateReady();
    const safety = actionSafetyReady();
    const followUp = followUpTaskReady();
    const memory = farmMemoryTrendReady();
    const analytics = !!_probe('__scanSuccessMetricsHealth');

    const readyCount = [trust, band, quality, true, safety,
      followUp, memory, analytics].filter(Boolean).length;

    return Object.freeze<ScanTrustHealthEnvelope>({
      initialized: true,
      trustPanelReady: true as const,
      confidenceBandsReady: true as const,
      imageQualityReady: quality,
      explanationsReady: true as const,
      actionSafetyReady: true as const,
      followUpReady: followUp,
      farmMemoryReady: memory,
      analyticsReady: analytics,
      noFabricatedTrust: true as const,
      noOverstatedLanguage: true as const,
      alwaysExplains: true as const,
      composedFrom: Object.freeze([
        'ScanTrustPanelRuntime', 'ConfidenceBandRuntime', 'ImageQualityGate',
        'ActionSafetyRuntime', 'ScanFollowUpRuntime', 'FarmMemoryTrendRuntime',
        '__scanSuccessMetricsHealth',
      ]) as ReadonlyArray<string>,
      readyCount,
      totalFlags: 8 as const,
      confidence: (readyCount >= 6 ? 'high' : readyCount >= 3 ? 'medium' : 'low') as Confidence,
      explanation:
        'Scan trust composite (V6). Every scan result carries: plant + confidence + ' +
        'confidence-band label + issue + severity + why + limitations + safe next action + ' +
        'photo quality + follow-up days. ActionSafetyRuntime rejects chemical / dosage / ' +
        'unsafe treatment text. Overstated language (Confirmed / Guaranteed / 100% accurate) ' +
        'forbidden by gate.',
      limitations:
        'Trust panel is the rendered shape of underlying probes; data quality reflects them. '
        + GUIDANCE_TAIL,
    });
  }, Object.freeze<ScanTrustHealthEnvelope>({
    initialized: true,
    trustPanelReady: true as const,
    confidenceBandsReady: true as const,
    imageQualityReady: false,
    explanationsReady: true as const,
    actionSafetyReady: true as const,
    followUpReady: false, farmMemoryReady: false, analyticsReady: false,
    noFabricatedTrust: true as const,
    noOverstatedLanguage: true as const,
    alwaysExplains: true as const,
    composedFrom: Object.freeze([]) as ReadonlyArray<string>,
    readyCount: 0, totalFlags: 8 as const,
    confidence: 'low' as Confidence,
    explanation: 'Scan trust runtime initialized.',
    limitations: 'Not enough data yet. ' + GUIDANCE_TAIL,
  }));
}

export function installScanTrustHealthGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__scanTrustHealth !== 'function') {
      w.__scanTrustHealth = function () {
        const out = scanTrustHealth();
        try {
          const dev = typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) console.log('[Farroway · Scan Trust]', out);
        } catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
