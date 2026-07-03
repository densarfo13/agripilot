/**
 * ScanRecoveryChain — the automatic recovery pipeline (self-healing scan).
 *
 * The farmer presses Scan ONCE. This engine drives every recovery transition
 * automatically: validate → repair → primary provider → (retry if transient) →
 * secondary engine → offline queue → needs-review. It emits farmer-facing progress
 * messages at each hop and resolves the outcome via resolveScanTerminalState, so the
 * chain can never dead-end — the worst case is SAVED_FOR_RETRY / QUEUED_FOR_REVIEW
 * with the photo kept.
 *
 * Build Once: stages are INJECTED (the existing image validation, HEIC repair,
 * withScanRetry-wrapped provider call, hybridScanEngine secondary, enqueueOfflineScan).
 * This file orchestrates; it does not reimplement or refactor any of them, and it does
 * NOT fabricate providers or a local ML model — if a stage isn't supplied, the chain
 * honestly skips to the next recovery.
 *
 * Bounded + never throws: each stage is awaited inside a guard; a stage that throws
 * counts as a failure of that stage, not a crash of the chain.
 */
import { resolveScanTerminalState } from './resolveScanTerminalState.js';
import type { ScanTerminalResult } from './resolveScanTerminalState.js';
import { isRetriableScanFailure } from '../../core/scan/scanRetryEngine.js';

export interface ScanStageOutcome {
  ok?: boolean;
  failureReason?: string | null;
  httpStatus?: number | null;
  serviceUnavailable?: boolean;
  candidateCount?: number;
  confidenceTone?: string | null;
  confidencePct?: number | null;
  hasHealthIssue?: boolean;
  imageQuality?: string | null;
  result?: unknown;            // the normalized scan result on success
}

type Stage = (input: unknown) => Promise<ScanStageOutcome | null> | ScanStageOutcome | null;

export interface RecoveryStages {
  validate?: Stage;   // image validation (existing assertValidScanInput / photo quality)
  repair?: Stage;     // image repair (existing HEIC→JPEG normalize / compress)
  primary: Stage;     // provider call (already withScanRetry-wrapped)
  secondary?: Stage;  // hybridScanEngine / local heuristic classifier (honest, no fake ML)
  queue?: Stage;      // enqueueOfflineScan — background retry, photo kept
}

export interface RecoveryProgress { key: string; message: string; }

// Phase 6 reassurance copy — calm, honest, no technical wording.
export const PROGRESS: Record<string, RecoveryProgress> = Object.freeze({
  checking:  { key: 'scan.progress.checking',  message: "We're checking your photo…" },
  improving: { key: 'scan.progress.improving', message: 'Improving image quality…' },
  second:    { key: 'scan.progress.second',    message: 'Double-checking with another expert…' },
  almost:    { key: 'scan.progress.almost',    message: "We're almost done…" },
});

export interface RecoveryRunResult {
  terminal: ScanTerminalResult;
  stagesTried: string[];
  result: unknown | null;
}

const _safe = async (stage: Stage | undefined, input: unknown, name: string): Promise<ScanStageOutcome | null> => {
  if (typeof stage !== 'function') return null;
  try { return (await stage(input)) || null; }
  catch (e: any) {
    return { ok: false, failureReason: name + '_threw:' + String(e && e.message ? e.message : e).slice(0, 80) };
  }
};

const _success = (o: ScanStageOutcome | null): boolean => {
  if (!o || o.ok !== true) return false;
  const t = resolveScanTerminalState(o);
  return t.state === 'SUCCESS_IDENTIFIED' || t.state === 'SUCCESS_HEALTH_ISSUE' || t.state === 'LOW_CONFIDENCE';
};

/**
 * Run the automatic recovery chain. onProgress receives the reassurance messages in
 * order as the chain advances. Total: always returns a terminal result.
 */
export async function runScanRecoveryChain(
  input: unknown,
  stages: RecoveryStages,
  onProgress?: (p: RecoveryProgress) => void,
): Promise<RecoveryRunResult> {
  const tried: string[] = [];
  const emit = (p: RecoveryProgress) => { try { if (onProgress) onProgress(p); } catch { /* never throw */ } };
  const finish = (o: ScanStageOutcome | null, extra?: Partial<ScanStageOutcome>): RecoveryRunResult => ({
    terminal: resolveScanTerminalState({ ...(o || {}), ...(extra || {}) }),
    stagesTried: tried,
    result: (o && o.ok === true && (o as any).result != null) ? (o as any).result : null,
  });

  emit(PROGRESS.checking);

  // 1. Validate — a bad image is a terminal BAD_IMAGE (retake beats wasting provider credits).
  tried.push('validate');
  const v = await _safe(stages.validate, input, 'validate');
  if (v && v.ok === false && (v.imageQuality || '').length > 0) return finish(v);

  // 2. Repair — best-effort; failure here never blocks the chain.
  tried.push('repair');
  emit(PROGRESS.improving);
  const repaired = await _safe(stages.repair, input, 'repair');
  const workingInput = (repaired && repaired.ok === true && (repaired as any).result != null)
    ? (repaired as any).result : input;

  // 3. Primary provider (already retry-wrapped upstream for transient failures).
  tried.push('primary');
  let primary = await _safe(stages.primary, workingInput, 'primary');
  if (_success(primary)) return finish(primary);

  // 3b. One extra automatic retry only when the failure is transient.
  if (primary && isRetriableScanFailure(String(primary.failureReason || ''))) {
    tried.push('primary_retry');
    emit(PROGRESS.almost);
    primary = await _safe(stages.primary, workingInput, 'primary_retry');
    if (_success(primary)) return finish(primary);
  }

  // 4. Secondary engine (hybrid/heuristic — honest, never fabricated ML).
  tried.push('secondary');
  emit(PROGRESS.second);
  const secondary = await _safe(stages.secondary, workingInput, 'secondary');
  if (_success(secondary)) return finish(secondary);

  // 5. Queue for background retry — photo kept; never a dead-end.
  tried.push('queue');
  emit(PROGRESS.almost);
  const queued = await _safe(stages.queue, workingInput, 'queue');
  if (queued && queued.ok === true) return finish({ ok: false, queuedForRetry: true } as any);

  // 6. Ultimate fallback — saved for review (terminal machine guarantees a named state).
  return finish({ ok: false, reviewRequested: true, failureReason: (primary && primary.failureReason) || 'all_stages_failed' } as any);
}

export default runScanRecoveryChain;
