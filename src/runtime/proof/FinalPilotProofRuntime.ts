/**
 * FinalPilotProofRuntime.ts — the composite pilot-proof scorecard.
 *
 *   window.__finalPilotProofHealth()  // pinned after boot
 *   window.__recordProofRun(name, source, note)  // QA marks a REAL manual test
 *
 * Reads the 10 individual proof probes by name (never imports them) and folds
 * their honest PASS / NEEDS_TEST / FAIL (or NEEDS_DATA for data readiness)
 * into one verdict. It NEVER fakes a green: a probe that has not been proven
 * stays NEEDS_TEST and the verdict reflects that.
 *
 * __recordProofRun is the ONLY way a human turns a NEEDS_TEST manual proof
 * (invite delivery, offline sync, persistence write/read) into PASS — it
 * records, in localStorage 'farroway_proof_runs', that a real test was run,
 * with a source + timestamp. The individual proof runtimes read that store.
 * Recording is a real human action with a real source — not a fake pass.
 *
 * Self-contained: zero imports, SSR-safe, never throws, frozen envelopes.
 *
 * > Decision support, not a guarantee.
 */

// ── helpers (verbatim pattern) ────────────────────────────────────────────
const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };
function _probe(name: string): any {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    const w = window as any;
    return typeof w[name] === 'function' ? w[name]() : null;
  }, null);
}
type Confidence = 'low' | 'medium' | 'high';
const GUIDANCE_TAIL = 'Decision support, not a guarantee.';
const PROOF_RUNS_KEY = 'farroway_proof_runs';

export const FINAL_PILOT_PROOF_VERSION = 'final-pilot-proof-v1' as const;

type ProofStatus = 'PASS' | 'FAIL' | 'NEEDS_TEST' | 'NEEDS_DATA' | 'UNKNOWN';
type Verdict = 'GO' | 'GO_WITH_LIMITATIONS' | 'BLOCKED';

/** Read a probe's proofStatus (or status for data readiness). */
function _status(probeName: string, field: 'proofStatus' | 'status'): ProofStatus {
  return _safe(() => {
    const p = _probe(probeName);
    if (!p) return 'UNKNOWN';
    const v = p[field];
    return (typeof v === 'string' ? v : 'UNKNOWN') as ProofStatus;
  }, 'UNKNOWN');
}

/** Data readiness counts as satisfied when the dataset reaches a usable tier. */
function _dataReadinessSatisfied(s: ProofStatus): boolean {
  return s === 'PILOT_READY' as any || s === 'PROGRAM_READY' as any;
}

export interface FinalPilotProofEnvelope {
  runtimeVersion: typeof FINAL_PILOT_PROOF_VERSION;
  dailyPlan: ProofStatus;
  scanToTask: ProofStatus;
  postHarvest: ProofStatus;
  outcome: ProofStatus;
  dataReadiness: ProofStatus;
  translationReview: ProofStatus;
  persistence: ProofStatus;
  invites: ProofStatus;
  offlineSync: ProofStatus;
  onboarding: ProofStatus;
  score: number;            // count of proven (PASS / data-satisfied) out of 10
  scoreLabel: string;       // e.g. "4/10 proven"
  verdict: Verdict;
  blockers: string[];
  needsTest: string[];
  recordProofRunReady: boolean;
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

export function finalPilotProofHealth(): Readonly<FinalPilotProofEnvelope> {
  return _safe(
    () => {
      const dailyPlan         = _status('__dailyPlanProofHealth', 'proofStatus');
      const scanToTask        = _status('__scanToTaskProofHealth', 'proofStatus');
      const postHarvest       = _status('__postHarvestProofHealth', 'proofStatus');
      const outcome           = _status('__outcomeProofHealth', 'proofStatus');
      const dataReadiness     = _status('__dataReadinessHealth', 'status');
      const translationReview = _status('__translationReviewHealth', 'proofStatus');
      const persistence       = _status('__persistenceProofHealth', 'proofStatus');
      const invites           = _status('__inviteProofHealth', 'proofStatus');
      const offlineSync       = _status('__offlineSyncProofHealth', 'proofStatus');
      const onboarding        = _status('__onboardingProofHealth', 'proofStatus');

      const proven = (s: ProofStatus) => s === 'PASS';
      const items: Array<[string, ProofStatus, boolean]> = [
        ['dailyPlan', dailyPlan, proven(dailyPlan)],
        ['scanToTask', scanToTask, proven(scanToTask)],
        ['postHarvest', postHarvest, proven(postHarvest)],
        ['outcome', outcome, proven(outcome)],
        ['dataReadiness', dataReadiness, _dataReadinessSatisfied(dataReadiness)],
        ['translationReview', translationReview, proven(translationReview)],
        ['persistence', persistence, proven(persistence)],
        ['invites', invites, proven(invites)],
        ['offlineSync', offlineSync, proven(offlineSync)],
        ['onboarding', onboarding, proven(onboarding)],
      ];

      const score = items.reduce((n, [, , ok]) => n + (ok ? 1 : 0), 0);

      // Critical FAIL conditions → BLOCKED.
      const blockers: string[] = [];
      if (dailyPlan === 'FAIL')   blockers.push('daily_plan_FAIL');
      if (scanToTask === 'FAIL')  blockers.push('scan_to_task_FAIL'); // upload analysis broken
      if (persistence === 'FAIL') blockers.push('persistence_FAIL');  // in-memory in production
      if (onboarding === 'FAIL')  blockers.push('onboarding_FAIL');   // location loop / GPS required

      const needsTest = items
        .filter(([, s]) => s === 'NEEDS_TEST' || s === 'NEEDS_DATA' || s === 'UNKNOWN')
        .map(([k]) => k);

      // Verdict.
      const corePass =
        dailyPlan === 'PASS' && scanToTask === 'PASS' &&
        persistence === 'PASS' && onboarding === 'PASS';
      let verdict: Verdict;
      if (blockers.length > 0) verdict = 'BLOCKED';
      else if (corePass && needsTest.length === 0) verdict = 'GO';
      else verdict = 'GO_WITH_LIMITATIONS';

      const confidence: Confidence = verdict === 'GO' ? 'high' : verdict === 'BLOCKED' ? 'medium' : 'low';

      return Object.freeze({
        runtimeVersion: FINAL_PILOT_PROOF_VERSION,
        dailyPlan, scanToTask, postHarvest, outcome, dataReadiness,
        translationReview, persistence, invites, offlineSync, onboarding,
        score,
        scoreLabel: `${score}/10 proven`,
        verdict,
        blockers: Object.freeze(blockers) as string[],
        needsTest: Object.freeze(needsTest) as string[],
        recordProofRunReady: typeof window !== 'undefined' && !!(window as any).localStorage,
        confidence,
        explanation:
          verdict === 'GO'
            ? 'All core proofs (daily plan, scan-to-task, persistence, onboarding) are proven with real evidence and no proof is outstanding.'
            : verdict === 'BLOCKED'
              ? `A core proof failed: ${blockers.join(', ')}. Fix before pilot.`
              : 'Architecture is wired; some proofs still need a real end-to-end test or real pilot data before they can pass.',
        limitations:
          'Each status reflects only real evidence (event log, stores, recorded proof runs, or honest probe attestation). ' +
          'NEEDS_TEST means a real workflow has not been run yet — not that it is broken. ' + GUIDANCE_TAIL,
      }) as FinalPilotProofEnvelope;
    },
    Object.freeze({
      runtimeVersion: FINAL_PILOT_PROOF_VERSION,
      dailyPlan: 'UNKNOWN', scanToTask: 'UNKNOWN', postHarvest: 'UNKNOWN', outcome: 'UNKNOWN',
      dataReadiness: 'UNKNOWN', translationReview: 'UNKNOWN', persistence: 'UNKNOWN',
      invites: 'UNKNOWN', offlineSync: 'UNKNOWN', onboarding: 'UNKNOWN',
      score: 0, scoreLabel: '0/10 proven', verdict: 'GO_WITH_LIMITATIONS',
      blockers: Object.freeze([]) as string[], needsTest: Object.freeze([]) as string[],
      recordProofRunReady: false, confidence: 'low',
      explanation: 'Proof probes not available yet.',
      limitations: 'Not enough data yet. ' + GUIDANCE_TAIL,
    }) as FinalPilotProofEnvelope,
  );
}

/**
 * Record that a REAL manual proof test was run. Writes to
 * localStorage 'farroway_proof_runs' under `name` with a source + timestamp.
 * The individual proof runtimes read this store; this is how a human turns a
 * NEEDS_TEST manual proof into PASS — honestly, never automatically.
 *
 *   __recordProofRun('invite_email', 'qa:jane', 'sent + received in inbox')
 */
export function recordProofRun(name: string, source: string, note?: string): boolean {
  return _safe(() => {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    if (!name || typeof name !== 'string') return false;
    if (!source || typeof source !== 'string') return false; // a source is REQUIRED — no anonymous pass
    const raw = window.localStorage.getItem(PROOF_RUNS_KEY);
    const store = _safe(() => { const p = JSON.parse(raw as string); return (p && typeof p === 'object') ? p : {}; }, {} as any);
    store[name] = { ranAt: Date.now(), result: 'PASS', source, note: note || null };
    window.localStorage.setItem(PROOF_RUNS_KEY, JSON.stringify(store));
    return true;
  }, false);
}

// ── installer ──────────────────────────────────────────────────────────────
export function installFinalPilotProofGlobals(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__finalPilotProofHealth !== 'function') {
      w.__finalPilotProofHealth = function () {
        const out = finalPilotProofHealth();
        try {
          const dev = typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) console.log('[Farroway · Final Pilot Proof]', out);
        } catch { /* swallow */ }
        return out;
      };
    }
    if (typeof w.__recordProofRun !== 'function') {
      w.__recordProofRun = function (name: string, source: string, note?: string) {
        return recordProofRun(name, source, note);
      };
    }
    return true;
  }, false);
}
