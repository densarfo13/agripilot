/**
 * scanGuidanceResolver.ts — the SINGLE source of truth for whether a scan
 * result is a low-confidence terminal state owned by ScanGuidanceCard.
 *
 * Why this exists (P1 dedup):
 *   IntelligentScanResult rendered the "Clearer photo needed" guidance card
 *   whenever evaluateScanTrust().allowPlantCreation === false (i.e. confidence
 *   < TRUST_CONFIDENCE_THRESHOLD_PCT = 70), while ScanPage suppressed the legacy
 *   AddPlantConfirmationCard only when confidencePct < 40. A result in [40, 70)
 *   therefore rendered BOTH cards. Routing BOTH surfaces through this one
 *   resolver guarantees exactly one terminal card at the composition level.
 *
 * Pure · SSR-safe · never throws. Works off REAL fields only; never fabricates.
 */

import { evaluateScanTrust } from './ScanTrustGate';
import { evaluatePhotoQuality } from '../scanQuality/PhotoQualityEngine';

const _obj = (v: unknown): v is Record<string, any> => v != null && typeof v === 'object';
const _low = (v: unknown): string => (typeof v === 'string' ? v.toLowerCase() : '');

// Mirrors IntelligentScanResult's _shouldShowNeedsReview — the explicit
// "needs review" signals the server can stamp on a result.
function _needsReview(r: Record<string, any>): boolean {
  if (r.suppressed === true) return true;
  if (['needs_review', 'low_confidence', 'uncertain'].includes(_low(r.status))) return true;
  if (['low', 'needs_review'].includes(_low(r.confidenceTone))) return true;
  return false;
}

export interface ScanGuidanceResolution {
  /** true → ScanGuidanceCard owns the surface; the legacy card must be suppressed. */
  showGuidance: boolean;
  trustBlocked: boolean;
  needsReview: boolean;
  trust: any;
  photoQuality: any;
}

export function resolveScanGuidance(result: unknown): ScanGuidanceResolution {
  const r = _obj(result) ? result : {};
  let photoQuality: any = null;
  try {
    photoQuality = evaluatePhotoQuality({ imageQuality: r.imageQuality, objectType: r.objectType });
  } catch { photoQuality = null; }
  let trust: any = null;
  try {
    trust = evaluateScanTrust({
      confidencePct: r.confidencePct,
      confidence: r.confidence,
      topCandidates: r.topCandidates,
      plantName: r.plantName,
      issueType: r.issueType,
      status: r.status,
      nextAction: r.nextAction || (r.mythosDecision && r.mythosDecision.nextAction),
      hasPhoto: !!(r.imageUrl || r.scanId),
      photoQuality,
    });
  } catch { trust = null; }
  const trustBlocked = !!(trust && !trust.allowPlantCreation);
  const needsReview = _needsReview(r);
  return Object.freeze({
    showGuidance: trustBlocked || needsReview,
    trustBlocked,
    needsReview,
    trust,
    photoQuality,
  });
}

export default resolveScanGuidance;
