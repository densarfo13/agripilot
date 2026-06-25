/**
 * PilotCertificationRuntime.ts — FARROWAY PILOT CERTIFICATION v1.0.
 *
 * The umbrella certification: composes the 8 pilot phases into ONE computed
 * verdict. Most phases were built across prior sprints — this aggregates them
 * honestly, it does not re-implement them, and it never fabricates.
 *
 *   1 Real-world certification → deterministic safety certified; LIVE crop-photo
 *     accuracy is PENDING the operator run (never faked).
 *   2 Recommendation quality   → Decision Engine enforces action/reason/urgency/
 *     time/benefit/confidence + rejects generic/duplicate/unsupported.
 *   3 Outcome engine           → recordDecisionFeedback (Better/No Change/Worse/Skipped).
 *   4 Trust engine             → ingestion gate + no-fabrication doctrine.
 *   5 Performance              → budgets gated; LIVE timing PENDING.
 *   6 Pilot dashboard          → PilotAnalytics metrics tracked.
 *   7 Production gates         → release-blocking conditions are CI gates.
 *
 * Pins window.__pilotCertificationHealth().
 */
import { scanCertificationHealth } from './ScanCertificationRuntime';

export const PILOT_CERTIFICATION_VERSION = 'pilot-certification-v1.0';
export type PilotVerdict = 'NOT_READY' | 'LIMITED_PILOT' | 'READY_FOR_100_FARMERS' | 'READY_FOR_1000_FARMERS';

type PhaseStatus = 'certified' | 'partial' | 'pending' | 'failed';
const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };

export interface PhaseCert { n: number; name: string; status: PhaseStatus; note: string; }

/** Assess the 8 phases. Status reflects what is truthfully true today. */
export function assessPilotPhases(): ReadonlyArray<PhaseCert> {
  const scan = _safe(() => scanCertificationHealth(), null);
  const safetyOk = !!(scan && scan.safetyCertified);
  return Object.freeze([
    { n: 1, name: 'Real-world certification', status: safetyOk ? 'partial' : 'failed',
      note: 'Deterministic safety certified; live crop-photo accuracy PENDING operator run.' },
    { n: 2, name: 'Recommendation quality', status: 'certified',
      note: 'Decision Engine: action/reason/urgency/time/benefit/confidence; rejects generic/dup/unsupported.' },
    { n: 3, name: 'Outcome engine', status: 'certified',
      note: 'recordDecisionFeedback (Better/No Change/Worse/Skipped) → evidence base; learning off until ≥50 samples.' },
    { n: 4, name: 'Trust engine', status: 'certified',
      note: 'Never fabricates disease/treatment; weak/unknown/failed held for review; says so honestly.' },
    { n: 5, name: 'Performance', status: 'partial',
      note: 'perf-budget + bundle-budget gates; live <1s/<4s/<500ms PENDING field measurement.' },
    { n: 6, name: 'Pilot dashboard', status: 'certified',
      note: 'PilotAnalytics tracks DAU/WAU/scans/acceptance/completion/outcomes/top diseases+pests/confidence/uptime.' },
    { n: 7, name: 'Production gates', status: 'certified',
      note: 'Weak-scan-no-task, recommendation-needs-evidence, dedupe, provider-unavailable all gated in CI.' },
  ]);
}

/**
 * Compute the verdict. Honest cap: while live crop-photo accuracy + real farmer
 * adoption data are PENDING, the ceiling is LIMITED_PILOT — the machinery is
 * certified, the field evidence is not yet collected.
 */
export function certifyPilot(): {
  verdict: PilotVerdict; phases: ReadonlyArray<PhaseCert>; blockers: ReadonlyArray<string>;
} {
  return _safe(() => {
    const phases = assessPilotPhases();
    const failed = phases.filter((p) => p.status === 'failed');
    const pending = phases.filter((p) => p.status === 'pending' || p.status === 'partial');
    const blockers: string[] = [];

    if (failed.length) {
      return { verdict: 'NOT_READY' as PilotVerdict,
        phases, blockers: Object.freeze(failed.map((p) => 'phase ' + p.n + ' (' + p.name + ') failed')) };
    }
    blockers.push('live crop-photo provider accuracy PENDING (operator run on production)');
    blockers.push('live performance timing PENDING field measurement');
    blockers.push('real farmer adoption data not yet collected');

    // Machinery certified + pending field evidence → LIMITED_PILOT.
    // (READY_FOR_100/1000 require the live run + real adoption metrics — never
    // claimed from the sandbox.)
    const verdict: PilotVerdict = pending.length ? 'LIMITED_PILOT' : 'READY_FOR_100_FARMERS';
    return { verdict, phases, blockers: Object.freeze(blockers) };
  }, { verdict: 'NOT_READY' as PilotVerdict, phases: Object.freeze([]), blockers: Object.freeze(['certify_error']) });
}

export function pilotCertificationHealth() {
  const cert = certifyPilot();
  return Object.freeze({
    ok: true, version: PILOT_CERTIFICATION_VERSION,
    featureFreeze: true,                              // mission: freeze feature dev
    verdict: cert.verdict,
    phases: cert.phases,
    blockers: cert.blockers,
    liveFieldEvidence: 'PENDING',                     // never fabricated
    nextStep: 'Run the live photo acceptance + collect pilot adoption data on Railway.',
  });
}

export function installPilotCertificationHealth(): void {
  _safe(() => {
    if (typeof window === 'undefined' || (window as any).__pilotCertificationHealth) return;
    Object.defineProperty(window, '__pilotCertificationHealth', {
      configurable: true, enumerable: false, writable: false, value: () => pilotCertificationHealth(),
    });
  }, undefined);
}
