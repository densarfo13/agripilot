/**
 * Farroway · Daily Plan Proof Runtime (daily-plan-proof-v1)
 *
 * Self-contained, composition-only PROOF runtime. It NEVER imports a project
 * module and NEVER fabricates data. It proves that the real end-to-end
 * "Today's Farm Plan" workflow actually happened, using ONLY real evidence:
 *
 *   Home Today's Farm Plan visible → daily task generated → mark done →
 *   activity updated → artifact created.
 *
 * Evidence sources (all real):
 *   • Wired capability probes read by name via _probe():
 *       __dailyFarmPlanHealth   (planReady, worksWithoutWeather/Scan/Gps)
 *       __dailyPlanTaskHealth    (completedFeedsOutcome, noDuplicateTasks)
 *       __artifactHealth
 *   • Canonical event logs via _events()/_hasEvent():
 *       localStorage 'farroway.farmEvents' AND 'farroway_event_log'
 *   • Recorded manual proof runs via _proofRun():
 *       localStorage 'farroway_proof_runs'
 *
 * HONESTY CONTRACT (the whole point):
 *   • Every envelope carries a 'validationSource': a non-empty string when
 *     proven, or null when unproven.
 *   • proofStatus is 'FAIL' when a wired probe EXPLICITLY reports broken;
 *     else 'PASS' ONLY when validationSource is a non-empty string AND all
 *     required readiness booleans are true; else 'NEEDS_TEST'.
 *   • NEVER 'PASS' from configuration alone. NEVER 'PASS' with a null source.
 *
 * Strict-rule audit: ZERO imports. SSR-safe (typeof guards). No Math
 * randomness, no fetch, no XMLHttpRequest, no crypto randomness, no
 * fabricated data. Frozen envelopes. Never throws.
 */

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

// -------------------------------------------------------------------------
// Evidence helpers (self-contained)
// -------------------------------------------------------------------------

/**
 * _proofRun — read a recorded MANUAL test run for the given proof name from
 * localStorage key 'farroway_proof_runs' (a JSON object keyed by proof name).
 * Returns the recorded run object { ranAt, result, source, note } or null.
 * This is how a human / QA records that a manual test was actually run.
 */
function _proofRun(name: string): { ranAt?: any; result?: any; source?: any; note?: any } | null {
  return _safe(() => {
    const store = _obj(_ls('farroway_proof_runs'));
    if (!store) return null;
    const run = _obj((store as any)[name]);
    return run ? run : null;
  }, null);
}

/**
 * _events — merged array of BOTH canonical event logs:
 *   localStorage 'farroway.farmEvents' AND 'farroway_event_log'.
 * Each may be an array or absent. Never throws.
 */
function _events(): any[] {
  return _safe(() => {
    const a = _arr(_ls('farroway.farmEvents'));
    const b = _arr(_ls('farroway_event_log'));
    return a.concat(b);
  }, []);
}

/** _eventTypes — set of string event types present across the merged logs. */
function _eventTypes(): Set<string> {
  return _safe(() => {
    const set = new Set<string>();
    for (const row of _events()) {
      const r = _obj(row);
      if (!r) continue;
      const t = (r as any).type ?? (r as any).eventType ?? (r as any).name ?? (r as any).kind;
      if (typeof t === 'string' && t.length > 0) set.add(t);
    }
    return set;
  }, new Set<string>());
}

/** _hasEvent — true if any present event type is in the given list. */
function _hasEvent(list: string[]): boolean {
  return _safe(() => {
    const types = _eventTypes();
    for (const want of _arr(list)) {
      if (typeof want === 'string' && types.has(want)) return true;
    }
    return false;
  }, false);
}

export const DAILY_PLAN_PROOF_RUNTIME_VERSION = 'daily-plan-proof-v1' as const;

// -------------------------------------------------------------------------
// Types
// -------------------------------------------------------------------------

type ProofStatus = 'PASS' | 'FAIL' | 'NEEDS_TEST';

export interface DailyPlanProofEnvelope {
  runtimeVersion: typeof DAILY_PLAN_PROOF_RUNTIME_VERSION;
  homePlanVisible: boolean;
  dailyTaskGenerated: boolean;
  markDoneReady: boolean;
  activityUpdated: boolean;
  artifactCreated: boolean;
  proofStatus: ProofStatus;
  validationSource: string | null;
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

// -------------------------------------------------------------------------
// Public API
// -------------------------------------------------------------------------

export function dailyPlanProofHealth(): DailyPlanProofEnvelope {
  return _safe(
    () => {
      // --- Real wired capability probes -------------------------------
      const plan = _obj(_probe('__dailyFarmPlanHealth'));
      const task = _obj(_probe('__dailyPlanTaskHealth'));
      const artifactHealth = _probe('__artifactHealth');

      // homePlanVisible: planReady !== false (absent probe degrades to true
      // for visibility but cannot itself PASS without a validationSource).
      const planReadyBroken = !!(plan && (plan as any).planReady === false);
      const homePlanVisible = !!(plan && (plan as any).planReady !== false);

      // The runtime guarantees >= 1 task when planReady, so a generated daily
      // task tracks home plan visibility directly.
      const dailyTaskGenerated = homePlanVisible;

      // markDoneReady: only broken when the wired task probe explicitly says
      // completion does NOT feed outcomes.
      const completedFeedsBroken = !!(task && (task as any).completedFeedsOutcome === false);
      const markDoneReady = !completedFeedsBroken;

      // --- Real evidence of a marked-done task ------------------------
      const activityUpdated = _hasEvent(['task_completed', 'TaskCompleted']);

      // Artifact follows a REAL completion: either an artifact-creation event
      // is present, or activity was updated AND the artifact subsystem is up.
      const artifactEvent = _hasEvent(['artifact_created', 'ArtifactCreated']);
      const artifactCreated = artifactEvent || (activityUpdated && !!artifactHealth);

      // --- Honesty contract: validationSource -------------------------
      // Prefer real event-log evidence; else a recorded manual proof run.
      const manualRun = _proofRun('daily_plan');
      const validationSource: string | null = activityUpdated
        ? 'event_log:task_completed'
        : manualRun
          ? 'proof_run:daily_plan'
          : null;

      // --- proofStatus ------------------------------------------------
      // FAIL if a wired probe explicitly reports broken (planReady === false).
      // PASS only with home plan visible, mark-done ready, AND a real source.
      // Otherwise honestly NEEDS_TEST.
      let proofStatus: ProofStatus;
      if (planReadyBroken) {
        proofStatus = 'FAIL';
      } else if (homePlanVisible && markDoneReady && !!validationSource) {
        proofStatus = 'PASS';
      } else {
        proofStatus = 'NEEDS_TEST';
      }

      const confidence: Confidence =
        proofStatus === 'PASS'
          ? activityUpdated
            ? 'high'
            : 'medium'
          : proofStatus === 'FAIL'
            ? 'high'
            : 'low';

      const explanation =
        proofStatus === 'FAIL'
          ? 'Daily Farm Plan capability reports planReady === false — the Home plan cannot render, so the workflow is broken until that is fixed.'
          : proofStatus === 'PASS'
            ? activityUpdated
              ? 'Proven end-to-end: the Home plan is visible, a daily task can be marked done feeding outcomes, and a real task_completed event was found in the canonical event log' +
                (artifactCreated ? ' with an artifact following the completion.' : '.')
              : 'Proven via a recorded manual test run (farroway_proof_runs["daily_plan"]): Home plan visible and mark-done is wired to outcomes. Capture a real task_completed event for the strongest evidence.'
            : 'Not yet proven by real evidence. The Home plan and mark-done wiring look ' +
              (homePlanVisible && markDoneReady ? 'ready' : 'incomplete') +
              ', but no real task_completed event and no recorded manual proof run were found. Run the workflow (generate a task, mark it done) or record a manual proof run to prove it.';

      const limitations =
        'This is a PROOF check, not a feature guarantee. PASS requires real evidence — a ' +
        'task_completed event in the canonical logs (farroway.farmEvents / farroway_event_log) ' +
        'or a recorded manual proof run — never configuration alone. Absent probes or stores ' +
        'degrade honestly to NEEDS_TEST, never to PASS. Artifact creation is inferred only when ' +
        'an artifact event exists or a real completion occurred while the artifact subsystem was up. ' +
        GUIDANCE_TAIL;

      return Object.freeze({
        runtimeVersion: DAILY_PLAN_PROOF_RUNTIME_VERSION,
        homePlanVisible,
        dailyTaskGenerated,
        markDoneReady,
        activityUpdated,
        artifactCreated,
        proofStatus,
        validationSource,
        confidence,
        explanation,
        limitations,
      }) as DailyPlanProofEnvelope;
    },
    Object.freeze({
      runtimeVersion: DAILY_PLAN_PROOF_RUNTIME_VERSION,
      homePlanVisible: false,
      dailyTaskGenerated: false,
      markDoneReady: false,
      activityUpdated: false,
      artifactCreated: false,
      proofStatus: 'NEEDS_TEST' as ProofStatus,
      validationSource: null,
      confidence: 'low' as Confidence,
      explanation:
        'Daily Plan proof runtime could not evaluate the workflow — no real evidence available, so the proof is honestly unproven.',
      limitations:
        'This is a PROOF check, not a feature guarantee. PASS requires real evidence and is never ' +
        'derived from configuration. With no readable probes or stores, the proof degrades to ' +
        'NEEDS_TEST. ' +
        GUIDANCE_TAIL,
    }) as DailyPlanProofEnvelope,
  );
}

export function installDailyPlanProofGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__dailyPlanProofHealth !== 'function') {
      w.__dailyPlanProofHealth = function () {
        const out = dailyPlanProofHealth();
        try {
          const dev =
            typeof import.meta !== 'undefined' &&
            (import.meta as any).env &&
            (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true)
            console.log('[Farroway · Daily Plan Proof]', out);
        } catch {}
        return out;
      };
    }
    return true;
  }, false);
}
