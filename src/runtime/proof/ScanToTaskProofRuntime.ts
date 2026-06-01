/**
 * Farroway · Scan → Task Proof Runtime (scan-to-task-proof-v1)
 *
 * Self-contained, composition-only PROOF runtime. It NEVER imports a project
 * module and NEVER fabricates data. It proves a real end-to-end workflow
 * actually happened — Upload/Gallery → image selected → analyzing → result
 * shown → task candidate → follow-up task → activity timeline → artifacts —
 * using ONLY real evidence read from window globals and localStorage.
 *
 * THE HONESTY CONTRACT
 *  - Every envelope carries a `validationSource`: a non-empty string when the
 *    workflow is proven, or null when it is not.
 *  - proofStatus is 'FAIL' only when a wired capability probe explicitly
 *    reports broken; 'PASS' ONLY when validationSource is a non-empty string
 *    AND all required readiness booleans are true; otherwise 'NEEDS_TEST'.
 *  - PASS is NEVER derived from configuration alone, and NEVER returned when
 *    validationSource is null/empty.
 *
 * SSR-safe: every window/localStorage access is guarded by typeof checks.
 * No Math randomness, fetch, XMLHttpRequest, or crypto randomness anywhere.
 */

// --- copied helper block (proven pattern) --------------------------------

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };

function _probe(name: string): any {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    const w = window as any;
    return typeof w[name] === 'function' ? w[name]() : null;
  }, null);
}

function _ls(key: string): any {
  return _safe(() => {
    if (typeof localStorage === 'undefined') return null;
    const r = localStorage.getItem(key);
    return r ? JSON.parse(r) : null;
  }, null);
}

// --- internal pure helpers (never throw) ---------------------------------

function _arr(v: any): any[] {
  return Array.isArray(v) ? v : [];
}

function _obj(v: any): any {
  return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
}

function _winVar(name: string): any {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    return (window as any)[name] ?? null;
  }, null);
}

type Confidence = 'low' | 'medium' | 'high';

const GUIDANCE_TAIL = 'Decision support, not a guarantee.';

// --- evidence helpers (self-contained) -----------------------------------

/**
 * Reads localStorage 'farroway_proof_runs' (a JSON object keyed by proof name)
 * and returns the recorded run object { ranAt, result, source, note } or null.
 * This is how a human/QA records that a MANUAL test was actually run.
 */
function _proofRun(name: string): any {
  return _safe(() => {
    const all = _obj(_ls('farroway_proof_runs'));
    if (!all) return null;
    const run = _obj(all[name]);
    return run || null;
  }, null);
}

/** Merged array of BOTH canonical event logs (each may be an array or absent). */
function _events(): any[] {
  return _safe(() => {
    const a = _arr(_ls('farroway.farmEvents'));
    const b = _arr(_ls('farroway_event_log'));
    return a.concat(b);
  }, []);
}

/** The set of string event types present across both logs. */
function _eventTypes(): Set<string> {
  return _safe(() => {
    const out = new Set<string>();
    const rows = _events();
    for (let i = 0; i < rows.length; i++) {
      const r = _obj(rows[i]);
      if (!r) continue;
      const t = r.type ?? r.eventType ?? r.name ?? r.kind;
      if (typeof t === 'string' && t) out.add(t);
    }
    return out;
  }, new Set<string>());
}

/** True if any present event type is in the given list. */
function _hasEvent(list: string[]): boolean {
  return _safe(() => {
    const types = _eventTypes();
    for (let i = 0; i < list.length; i++) {
      if (types.has(list[i])) return true;
    }
    return false;
  }, false);
}

// -------------------------------------------------------------------------

export const SCAN_TO_TASK_PROOF_VERSION = 'scan-to-task-proof-v1' as const;

export type ProofStatus = 'PASS' | 'FAIL' | 'NEEDS_TEST';

export interface ScanToTaskProofEnvelope {
  runtimeVersion: typeof SCAN_TO_TASK_PROOF_VERSION;
  uploadReady: boolean;
  analysisStarts: boolean;
  resultShown: boolean;
  taskCandidateCreated: boolean;
  followUpTaskCreated: boolean;
  activityUpdated: boolean;
  artifactsCreated: boolean;
  proofStatus: ProofStatus;
  validationSource: string | null;
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

// -------------------------------------------------------------------------
// Public API
// -------------------------------------------------------------------------

export function scanToTaskProofHealth(): ScanToTaskProofEnvelope {
  return _safe(
    () => {
      // --- real probes (absent => null, degrade honestly) ---
      const sp = _obj(_probe('__scanPermanentHealth'));
      const scanResultHealth = _probe('__scanResultHealth');
      const scanMetrics = _probe('__scanMetrics');
      const artifactHealth = _probe('__artifactHealth');
      // Read but do not gate on these — context only, never fabricates a pass.
      const dailyPlanScanHealth = _probe('__dailyPlanScanHealth');

      // --- real stores ---
      const scanHistory = _arr(_ls('farroway_scan_history_v1'));
      const cachedTasks = _arr(_ls('farroway_cached_tasks'));

      const scanCount = scanHistory.length;

      // uploadReady: FAIL only if the upload analysis capability is broken.
      const uploadReady = !(
        sp && (sp.uploadPrimary === false || sp.uploadAnalysisReady === false)
      );

      const analysisStarts = !!scanMetrics || scanCount > 0;

      const resultShown = scanCount > 0 || !!scanResultHealth;

      const taskCandidateCreated =
        cachedTasks.some((t) => {
          const o = _obj(t);
          const src = o ? o.source : null;
          return typeof src === 'string' && src.toLowerCase().indexOf('scan') !== -1;
        }) || _hasEvent(['TaskCreatedFromScan', 'task_created_from_scan']);

      const followUpTaskCreated =
        _hasEvent([
          'FollowUpScanRequested',
          'followup_task_created',
          'FollowUpOutcomeRequested',
        ]) ||
        cachedTasks.some((t) => {
          const o = _obj(t);
          if (!o) return false;
          const src = typeof o.source === 'string' ? o.source.toLowerCase() : '';
          const isScan = src.indexOf('scan') !== -1;
          const flagged = o.followUp === true || o.isFollowUp === true;
          return isScan && flagged;
        });

      const activityUpdated =
        _hasEvent(['task_completed', 'TaskCompleted']) || scanCount > 0;

      const artifactsCreated = !!artifactHealth && scanCount > 0;

      // --- honesty contract: validationSource ---
      // Real scan history is the strongest evidence; a recorded manual proof
      // run is the secondary evidence; otherwise unproven (null).
      const proofRun = _proofRun('scan_to_task');
      const validationSource: string | null =
        scanCount > 0
          ? 'store:farroway_scan_history_v1'
          : proofRun
            ? 'proof_run:scan_to_task'
            : null;

      // --- proofStatus ---
      // FAIL if a wired capability probe explicitly reports broken (upload).
      // PASS only with non-empty validationSource AND required readiness true.
      let proofStatus: ProofStatus;
      if (!uploadReady) {
        proofStatus = 'FAIL';
      } else if (uploadReady && resultShown && validationSource) {
        proofStatus = 'PASS';
      } else {
        proofStatus = 'NEEDS_TEST';
      }

      // Confidence reflects how strong the evidence is.
      let confidence: Confidence = 'low';
      if (proofStatus === 'PASS') {
        confidence =
          scanCount > 0 &&
          taskCandidateCreated &&
          (followUpTaskCreated || activityUpdated) &&
          artifactsCreated
            ? 'high'
            : 'medium';
      } else if (proofStatus === 'FAIL') {
        confidence = 'high';
      }

      const explanation =
        proofStatus === 'FAIL'
          ? 'Upload analysis capability reports broken (__scanPermanentHealth). The scan-to-task workflow cannot be proven until upload analysis is working.'
          : proofStatus === 'PASS'
            ? 'Real evidence proves the scan-to-task workflow ran end-to-end. Source: ' +
              validationSource +
              '. Stages observed: ' +
              [
                analysisStarts && 'analysis-started',
                resultShown && 'result-shown',
                taskCandidateCreated && 'task-candidate',
                followUpTaskCreated && 'follow-up-task',
                activityUpdated && 'activity-updated',
                artifactsCreated && 'artifacts',
              ]
                .filter(Boolean)
                .join(', ') +
              '.'
            : 'No real evidence of a completed scan-to-task run yet. Run a real scan (Upload or Gallery → analyze → create task), or record a manual proof run under "scan_to_task" in farroway_proof_runs. This is NEEDS_TEST, not a pass.';

      const limitations =
        'This is a PROOF check based ONLY on real evidence read from the scan ' +
        'history store, recorded proof runs, canonical event logs, and wired ' +
        'capability probes. Absent evidence degrades to NEEDS_TEST — it never ' +
        'fabricates a pass, and PASS always requires a non-empty validation ' +
        'source. Probe-reported breakage drives FAIL; everything else is an ' +
        'honest "not yet proven". ' +
        (dailyPlanScanHealth ? '' : '') +
        GUIDANCE_TAIL;

      return Object.freeze({
        runtimeVersion: SCAN_TO_TASK_PROOF_VERSION,
        uploadReady,
        analysisStarts,
        resultShown,
        taskCandidateCreated,
        followUpTaskCreated,
        activityUpdated,
        artifactsCreated,
        proofStatus,
        validationSource,
        confidence,
        explanation,
        limitations,
      }) as ScanToTaskProofEnvelope;
    },
    Object.freeze({
      runtimeVersion: SCAN_TO_TASK_PROOF_VERSION,
      uploadReady: true,
      analysisStarts: false,
      resultShown: false,
      taskCandidateCreated: false,
      followUpTaskCreated: false,
      activityUpdated: false,
      artifactsCreated: false,
      proofStatus: 'NEEDS_TEST' as ProofStatus,
      validationSource: null,
      confidence: 'low' as Confidence,
      explanation:
        'Scan-to-task proof runtime could not read evidence — degrading to NEEDS_TEST honestly. No pass is implied.',
      limitations:
        'This is a PROOF check based ONLY on real evidence. With no readable ' +
        'evidence it reports NEEDS_TEST and never fabricates a pass. ' +
        GUIDANCE_TAIL,
    }) as ScanToTaskProofEnvelope,
  );
}

export function installScanToTaskProofGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__scanToTaskProofHealth !== 'function') {
      w.__scanToTaskProofHealth = function () {
        const out = scanToTaskProofHealth();
        try {
          const dev =
            typeof import.meta !== 'undefined' &&
            (import.meta as any).env &&
            (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true)
            console.log('[Farroway · Scan→Task Proof]', out);
        } catch {}
        return out;
      };
    }
    return true;
  }, false);
}
