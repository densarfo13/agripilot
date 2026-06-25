/**
 * ScanProviderConsensus.ts — MULTI-PROVIDER SCAN ADAPTERS §6.
 *
 * Merges the per-provider results (plant identity + crop.health + insect + mushroom)
 * into ONE farmer-facing diagnosis, under strict rules:
 *   • no provider finding below 70% confidence drives an action task (→ review),
 *   • no disease/treatment is shown if crop.health returned NO_RESULT/unsupported,
 *   • NO mushroom edible/safe claim is ever produced,
 *   • the result ALWAYS carries a confidence + a reason.
 *
 * Pure, total, never throws. Provider failures degrade gracefully (a missing
 * health check shows "Health check unavailable", the scan still works).
 */
import {
  ProviderResult, PROVIDER_CONFIDENCE_MIN,
} from '../providers/ProviderContracts';
import { readCropHealth } from '../providers/CropHealthProvider';
import { readMushroom, MUSHROOM_NEVER_EAT } from '../providers/MushroomProvider';

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };
const _str = (v: any): string => (typeof v === 'string' ? v : '');
const _num = (v: any): number => { const n = typeof v === 'number' ? v : Number(v); return Number.isFinite(n) ? n : 0; };

export interface ScanConsensus {
  plantIdentity: string | null;
  health: string | null;            // disease OR "No clear issue detected" OR null
  pest: string | null;
  mushroomWarning: string | null;
  confidence: number;               // 0..100 overall
  reason: string;                   // always present
  recommendedAction: string | null; // null when below the action floor
  toReviewQueue: boolean;
  healthCheckAvailable: boolean;    // false → "Health check unavailable" (§5/§8)
  providers: ReadonlyArray<{ provider: string; status: string; confidence: number }>;
}

/**
 * Build the consensus from the server scan result (which carries cropHealth +
 * mushroom + the plant identity + pest envelopes).
 */
export function buildScanConsensus(scanResult: any = {}): ScanConsensus {
  return _safe(() => {
    const r = (scanResult && typeof scanResult === 'object') ? scanResult : {};
    const crop: ProviderResult = readCropHealth(r);
    const mush: ProviderResult = readMushroom(r);

    // Plant identity + confidence from the existing FarmBrain/scan envelope.
    const fb = r.farmBrain || {};
    const plantIdentity = _str(r.cropName || r.plantName) || null;
    const plantConfidence = _num(fb.confidenceScore ?? r.confidencePct
      ?? (typeof r.confidence === 'number' && r.confidence <= 1 ? r.confidence * 100 : r.confidence));

    // Pest from the existing insect envelope.
    const pestEnv = r.pest || {};
    const pest = (pestEnv && pestEnv.ok && _str(pestEnv.pest)) ? _str(pestEnv.pest) : null;
    const pestConfidence = _num(pestEnv.confidencePct);

    // Health ONLY when crop.health actually returned a result (§6).
    const cropReady = crop.status === 'READY';
    const health = cropReady
      ? (_str(crop.findings.disease) || _str(crop.findings.health) || 'No clear issue detected')
      : null;
    const healthCheckAvailable = crop.status === 'READY' || crop.status === 'NO_RESULT';

    // Mushroom: NEVER a safe/edible claim — only the warning.
    const mushroomWarning = (mush.status === 'READY' && _str(mush.findings.species))
      ? MUSHROOM_NEVER_EAT : null;

    // Overall confidence = the strongest relevant signal.
    const confidence = Math.max(plantConfidence, cropReady ? crop.confidence : 0, pestConfidence);

    // Action only above the 70% floor AND from a real provider finding (§6).
    const hasActionableFinding = (cropReady && crop.confidence >= PROVIDER_CONFIDENCE_MIN && _str(crop.findings.disease))
      || (pest && pestConfidence >= PROVIDER_CONFIDENCE_MIN)
      || (!!plantIdentity && plantConfidence >= PROVIDER_CONFIDENCE_MIN);
    const recommendedAction = hasActionableFinding
      ? (crop.recommendations[0] || _str(fb.nextAction) || 'Review the recommended steps.')
      : null;
    const toReviewQueue = !hasActionableFinding;

    const reason = hasActionableFinding
      ? 'Based on a confident scan reading.'
      : (confidence > 0 ? 'Not confident enough yet — saved for review.' : 'Scan unclear — please retake.');

    return Object.freeze({
      plantIdentity, health, pest, mushroomWarning,
      confidence: Math.max(0, Math.min(100, Math.round(confidence))),
      reason, recommendedAction, toReviewQueue, healthCheckAvailable,
      providers: Object.freeze([
        { provider: 'crop.health', status: crop.status, confidence: crop.confidence },
        { provider: 'mushroom.id', status: mush.status, confidence: mush.confidence },
      ]),
    });
  }, Object.freeze({
    plantIdentity: null, health: null, pest: null, mushroomWarning: null,
    confidence: 0, reason: 'Scan unclear — please retake.', recommendedAction: null,
    toReviewQueue: true, healthCheckAvailable: false, providers: Object.freeze([]),
  }));
}

let _stats = { built: 0, toReview: 0 };
export function recordConsensus(c: ScanConsensus): void {
  _safe(() => { _stats.built += 1; if (c.toReviewQueue) _stats.toReview += 1; }, undefined);
}
export function scanConsensusHealth() {
  return Object.freeze({
    ok: true, version: 'scan-provider-consensus-v1',
    confidenceMin: PROVIDER_CONFIDENCE_MIN,
    neverMushroomSafeClaim: true,
    noDiseaseWithoutResult: true,
    built: _stats.built, toReview: _stats.toReview,
  });
}
export function installScanConsensusHealth(): void {
  _safe(() => {
    if (typeof window === 'undefined') return;
    if ((window as any).__scanConsensusHealth) return;
    Object.defineProperty(window, '__scanConsensusHealth', {
      configurable: true, enumerable: false, writable: false,
      value: () => scanConsensusHealth(),
    });
  }, undefined);
}
