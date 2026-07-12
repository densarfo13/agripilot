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
import {
  TRUST_CONFIDENCE_THRESHOLD_PCT,
  PROVISIONAL_CONFIDENCE_THRESHOLD_PCT,
  UNKNOWN_PLANT_TOKENS,
} from './ScanTrustContracts';

const _obj = (v: unknown): v is Record<string, any> => v != null && typeof v === 'object';
const _low = (v: unknown): string => (typeof v === 'string' ? v.toLowerCase() : '');
const _arr = (v: unknown): any[] => (Array.isArray(v) ? v : []);

// Maps the SERVER-owned identification band (from resolveIdentificationState.js,
// stamped on result.identificationState) to this client state enum. When present,
// the client renders it directly — it never re-derives the confidence thresholds.
const SERVER_STATE_MAP: Record<string, ScanResultState> = {
  CONFIRMED:      'IDENTIFIED_CONFIRMED',
  PROVISIONAL:    'IDENTIFIED_PROVISIONAL',
  LOW_CONFIDENCE: 'LOW_IDENTIFICATION_CONFIDENCE',
  NOT_A_PLANT:    'NOT_A_PLANT',
  PROVIDER_ERROR: 'PROVIDER_ERROR',
};

// Accept confidence as 0-100 (pct) OR 0-1 (frac); normalize to pct. Returns
// null when no numeric confidence is present (never invents 0).
function _confPct(r: Record<string, any>): number | null {
  const p = r.confidencePct;
  if (typeof p === 'number' && Number.isFinite(p)) return p;
  const c = r.confidence;
  if (typeof c === 'number' && Number.isFinite(c)) return c <= 1 ? c * 100 : c;
  return null;
}

// Mirrors IntelligentScanResult's _shouldShowNeedsReview — the explicit
// "needs review" signals the server can stamp on a result.
function _needsReview(r: Record<string, any>): boolean {
  if (r.suppressed === true) return true;
  if (['needs_review', 'low_confidence', 'uncertain'].includes(_low(r.status))) return true;
  if (['low', 'needs_review'].includes(_low(r.confidenceTone))) return true;
  return false;
}

// The top identification candidate's display name (never fabricated).
function _topName(r: Record<string, any>): string {
  const top = _arr(r.topCandidates)[0] || {};
  const n = String(top.commonName || top.name || top.scientificName || r.plantName || '').trim();
  return UNKNOWN_PLANT_TOKENS.includes(n.toLowerCase()) ? '' : n;
}

/**
 * The six evidence-backed scan states (spec §2 + §5). Each maps to a DISTINCT
 * farmer message so "clearer photo needed" is shown ONLY for a measured image
 * problem — never for a valid image the provider simply couldn't confidently
 * name.
 */
export type ScanResultState =
  | 'IDENTIFIED_CONFIRMED'         // conf ≥ trusted threshold — real headline + disease analysis
  | 'IDENTIFIED_PROVISIONAL'       // plausible candidate in [provisional, trusted) — ask to confirm
  | 'LOW_IDENTIFICATION_CONFIDENCE'// valid image + provider response, no candidate meets provisional
  | 'LOW_IMAGE_QUALITY'            // measured blur/exposure/framing failure
  | 'NOT_A_PLANT'                  // provider says insufficient plant probability
  | 'PROVIDER_ERROR';              // auth/quota/timeout/schema failure, no usable candidates

export interface ScanGuidanceResolution {
  /** The discrete evidence-backed state (spec §2). */
  state: ScanResultState;
  /** Resolved identification confidence (0..100) or null when none present. */
  confidencePct: number | null;
  /** true → the low-confidence / image / error guidance card owns the surface. */
  showGuidance: boolean;
  /** true → the provisional "is this X?" confirm card owns the surface. */
  showProvisional: boolean;
  /** Provisional candidate to confirm (only when showProvisional). */
  provisional: { plantName: string; scientificName: string; confidencePct: number } | null;
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

  const conf = _confPct(r);
  const topName = _topName(r);
  const hasCandidates = _arr(r.topCandidates).length > 0 || !!topName;
  const photoFailed = !!(photoQuality && photoQuality.failed);
  const needsReview = _needsReview(r);
  // A configured provider that FAILED (401/403/429/5xx/timeout) — the server
  // stamps serviceUnavailable / providerError. Distinct from "no candidates".
  const providerError = r.serviceUnavailable === true
    || _low(r.status) === 'provider_error'
    || _low(r.status) === 'service_unavailable';
  // NOT_A_PLANT only on an EXPLICIT signal (isPlant probability or a not_plant
  // flag) — never inferred from a low score, so we don't mislabel a real plant.
  const isPlantProb = typeof r.isPlant === 'number' ? r.isPlant
    : (typeof r.isPlantProbability === 'number' ? r.isPlantProbability : null);
  const notPlant = r.notPlant === true
    || _low(r.objectType) === 'not_plant'
    || (isPlantProb != null && isPlantProb < 0.3);

  // The server stamps the canonical identification band (env-tunable, decided
  // once in resolveIdentificationState.js). The client CONSUMES it and must NOT
  // recompute thresholds. A client-MEASURED image failure still wins (the server
  // cannot see the photo), but the identification band itself is the server's.
  const serverState = SERVER_STATE_MAP[String(r.identificationState || '').toUpperCase()];

  // ── State machine — most-specific evidence first ────────────────
  let state: ScanResultState;
  if (photoFailed) {
    state = 'LOW_IMAGE_QUALITY';
  } else if (serverState) {
    // Consume the server-owned decision verbatim (no threshold re-derivation).
    state = serverState;
  } else if (providerError && !hasCandidates) {
    state = 'PROVIDER_ERROR';
  } else if (notPlant) {
    state = 'NOT_A_PLANT';
  } else if (!hasCandidates) {
    // Valid image, no measured quality failure, but the provider returned
    // nothing to name → low identification confidence (NOT a photo problem).
    state = 'LOW_IDENTIFICATION_CONFIDENCE';
  } else if (needsReview) {
    // Server explicitly stamped the result "not trusted" (needs_review /
    // uncertain). That is a human-review signal, never an auto-provisional —
    // route it to the guidance surface (Ask an Agronomist).
    state = 'LOW_IDENTIFICATION_CONFIDENCE';
  } else if (conf != null && conf >= TRUST_CONFIDENCE_THRESHOLD_PCT) {
    state = 'IDENTIFIED_CONFIRMED';
  } else if (conf != null && conf >= PROVISIONAL_CONFIDENCE_THRESHOLD_PCT) {
    state = 'IDENTIFIED_PROVISIONAL';
  } else {
    state = 'LOW_IDENTIFICATION_CONFIDENCE';
  }

  const showProvisional = state === 'IDENTIFIED_PROVISIONAL';
  // Guidance card owns the low-confidence / image / error family — NOT the
  // confirmed result and NOT the provisional confirm prompt.
  const showGuidance = state === 'LOW_IMAGE_QUALITY'
    || state === 'LOW_IDENTIFICATION_CONFIDENCE'
    || state === 'NOT_A_PLANT'
    || state === 'PROVIDER_ERROR';
  const trustBlocked = !!(trust && !trust.allowPlantCreation);
  const provisional = showProvisional
    ? Object.freeze({
        plantName: topName,
        scientificName: String((_arr(r.topCandidates)[0] || {}).scientificName || r.scientificName || ''),
        confidencePct: conf == null ? 0 : Math.round(conf),
      })
    : null;

  return Object.freeze({
    state,
    confidencePct: conf == null ? null : Math.round(conf),
    showGuidance,
    showProvisional,
    provisional,
    trustBlocked,
    needsReview,
    trust,
    photoQuality,
  });
}

export default resolveScanGuidance;
