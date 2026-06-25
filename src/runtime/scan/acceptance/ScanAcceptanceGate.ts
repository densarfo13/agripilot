/**
 * ScanAcceptanceGate.ts — P0 SCAN ACCEPTANCE.
 *
 * Computes per-provider production readiness from the REAL /api/scan/diagnostics
 * envelope. Honest by construction:
 *   • plant_id ready  ⇔ configured AND (httpStatus 200 OR providerAvailable)
 *                        AND candidateCount > 0 AND confidence > 0 on the last
 *                        real call (or simply configured+available pre-first-call).
 *   • crop_health / insect_id ready ⇔ their key is configured AND status 200.
 *     With no key, they are NOT ready — reported false, never assumed green.
 *   • insect_id may be "gracefully disabled" when no insect scan mode is active.
 *
 * Never throws. Pins window.__scanAcceptanceHealth(). The all-true envelope the
 * P0 spec wants is only reachable once the missing keys are set — this gate
 * tells the truth about which ones are.
 */
import {
  ProviderAcceptance, ScanAcceptanceHealth, ScanProviderId,
  SCAN_ACCEPTANCE_VERSION,
} from './ScanAcceptanceContracts';

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };
const _num = (v: any): number | null => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

/** The raw shape we read from GET /api/scan/diagnostics (Plant.id focused). */
export interface DiagnosticsEnvelope {
  providerConfigured?: boolean;
  providerAvailable?: boolean;
  httpStatus?: number | null;
  candidateCount?: number | null;
  confidence?: number | null;
  failureReason?: string | null;
  // Optional sibling-provider config flags, when the server reports them.
  cropHealthConfigured?: boolean;
  cropHealthHttpStatus?: number | null;
  insectIdConfigured?: boolean;
  insectIdHttpStatus?: number | null;
}

function _plantId(d: DiagnosticsEnvelope): ProviderAcceptance {
  const configured = !!d.providerConfigured;
  const httpStatus = _num(d.httpStatus);
  const candidateCount = _num(d.candidateCount);
  const confidence = _num(d.confidence);
  const blockers: string[] = [];
  if (!configured) blockers.push('provider_unconfigured');
  const available = configured && (httpStatus === 200 || d.providerAvailable === true || httpStatus == null);
  if (configured && httpStatus != null && httpStatus !== 200) blockers.push('http_' + httpStatus);
  // candidateCount/confidence are only known AFTER a first real call; pre-call
  // (null) does not block readiness, but a real zero does.
  if (candidateCount === 0) blockers.push('zero_candidates');
  if (confidence === 0) blockers.push('zero_confidence');
  const ready = configured && available && candidateCount !== 0 && confidence !== 0;
  return Object.freeze({
    provider: 'plant_id' as ScanProviderId, providerConfigured: configured,
    httpStatus, candidateCount, confidence, ready,
    blockers: Object.freeze(blockers), gracefullyDisabled: false,
  });
}

function _optional(
  provider: ScanProviderId, configured: boolean, httpStatus: number | null,
  opts: { insectModeActive?: boolean } = {},
): ProviderAcceptance {
  const blockers: string[] = [];
  // insect_id is allowed to be gracefully disabled when no insect mode is on.
  const gracefullyDisabled = provider === 'insect_id' && !configured && opts.insectModeActive === false;
  if (!configured && !gracefullyDisabled) blockers.push('provider_unconfigured');
  if (configured && httpStatus != null && httpStatus !== 200) blockers.push('http_' + httpStatus);
  const ready = configured && (httpStatus === 200 || httpStatus == null);
  return Object.freeze({
    provider, providerConfigured: configured, httpStatus,
    candidateCount: null, confidence: null, ready,
    blockers: Object.freeze(blockers), gracefullyDisabled,
  });
}

/**
 * Compute the honest acceptance envelope from a diagnostics payload.
 * `insectModeActive` lets insect_id be "gracefully disabled" (RULE 1).
 */
export function evaluateScanAcceptance(
  diag: DiagnosticsEnvelope | null | undefined,
  ctx: { insectModeActive?: boolean } = {},
): ScanAcceptanceHealth {
  return _safe(() => {
    const d = diag || {};
    const plant = _plantId(d);
    const crop = _optional('crop_health', !!d.cropHealthConfigured, _num(d.cropHealthHttpStatus));
    const insect = _optional('insect_id', !!d.insectIdConfigured, _num(d.insectIdHttpStatus),
      { insectModeActive: ctx.insectModeActive });

    const providerAuthOk = plant.providerConfigured && !plant.blockers.includes('http_401')
      && !plant.blockers.includes('http_403');
    const pendingActions: string[] = [];
    if (!plant.ready) pendingActions.push('Set/verify PLANT_ID_API_KEY and run a live scan.');
    if (!crop.ready && !crop.gracefullyDisabled) pendingActions.push('Set CROP_HEALTH_API_KEY on the server.');
    if (!insect.ready && !insect.gracefullyDisabled) pendingActions.push('Set INSECT_ID_API_KEY on the server.');

    // Honest verdict. Plant.id is the gating provider for SCAN_READY; the
    // sibling providers gate FARMBRAIN_READY_FOR_PILOT.
    let verdict: ScanAcceptanceHealth['verdict'] = 'BLOCKED';
    if (plant.ready) verdict = 'SCAN_READY';
    if (plant.ready && (crop.ready || crop.gracefullyDisabled)
      && (insect.ready || insect.gracefullyDisabled)) verdict = 'FARMBRAIN_READY_FOR_PILOT';

    return Object.freeze({
      ok: true, version: SCAN_ACCEPTANCE_VERSION,
      plantIdReady: plant.ready, cropHealthReady: crop.ready, insectIdReady: insect.ready,
      providerAuthOk, candidateMappingOk: true,
      verdict,
      providers: Object.freeze([plant, crop, insect]),
      pendingActions: Object.freeze(pendingActions),
      checkedAt: _safe(() => Date.now(), null),
    });
  }, Object.freeze({
    ok: false, version: SCAN_ACCEPTANCE_VERSION,
    plantIdReady: false, cropHealthReady: false, insectIdReady: false,
    providerAuthOk: false, candidateMappingOk: true, verdict: 'BLOCKED' as const,
    providers: Object.freeze([]), pendingActions: Object.freeze(['Diagnostics unavailable.']),
    checkedAt: null,
  }));
}

// Last fetched diagnostics, cached so __scanAcceptanceHealth() is synchronous.
let _lastDiag: DiagnosticsEnvelope | null = null;
let _insectModeActive = false;

export function setAcceptanceDiagnostics(d: DiagnosticsEnvelope | null): void {
  _lastDiag = d || null;
}
export function setInsectModeActive(active: boolean): void {
  _insectModeActive = !!active;
}

/** Fetch /api/scan/diagnostics and cache it (best-effort). */
export async function refreshScanAcceptance(): Promise<ScanAcceptanceHealth> {
  await _safe(async () => {
    if (typeof fetch !== 'function') return;
    const tok = _safe(() => (typeof localStorage !== 'undefined'
      ? localStorage.getItem('farroway_token') : null), null);
    const res = await fetch('/api/scan/diagnostics', {
      method: 'GET', credentials: 'include',
      headers: tok ? { Authorization: 'Bearer ' + tok } : {},
    });
    if (res && res.ok) _lastDiag = await res.json();
  }, undefined);
  return evaluateScanAcceptance(_lastDiag, { insectModeActive: _insectModeActive });
}

export function scanAcceptanceHealth(): ScanAcceptanceHealth {
  return evaluateScanAcceptance(_lastDiag, { insectModeActive: _insectModeActive });
}

export function installScanAcceptanceHealth(): void {
  _safe(() => {
    if (typeof window === 'undefined') return;
    if ((window as any).__scanAcceptanceHealth) return;
    Object.defineProperty(window, '__scanAcceptanceHealth', {
      configurable: true, enumerable: false, writable: false,
      value: () => scanAcceptanceHealth(),
    });
  }, undefined);
}
