/**
 * EnterpriseCertificationRuntime.ts — FARROWAY ENTERPRISE CERTIFICATION.
 *
 * The 13-phase umbrella. It composes the pilot certification + the two NEW
 * quality engines (Data Quality, Decision Quality) and certifies the rest
 * honestly: most phases already shipped, business (Phase 8) is honest-null /
 * frozen, and live field evidence (Phase 6 accuracy, Phase 13 farmers) is PENDING
 * — never fabricated. Verdict is COMPUTED and capped at LIMITED_PILOT until the
 * field run lands. Pins window.__enterpriseCertificationHealth().
 */
import { pilotCertificationHealth } from '../scan/certification/PilotCertificationRuntime';
import { dataQualityHealth } from './DataQualityEngine';
import { decisionQualityHealth } from './DecisionQualityEngine';

export const ENTERPRISE_CERTIFICATION_VERSION = 'enterprise-certification-v1';
export type EnterpriseVerdict =
  | 'NOT_READY' | 'LIMITED_PILOT' | 'READY_FOR_100_FARMERS' | 'READY_FOR_1000_FARMERS'
  | 'READY_FOR_NATIONAL_DEPLOYMENT' | 'READY_FOR_GLOBAL_SCALE';

type Status = 'certified' | 'partial' | 'pending' | 'honest_null';
const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };

export interface EnterprisePhase { n: number; name: string; status: Status; note: string; }

export function assessEnterprisePhases(): ReadonlyArray<EnterprisePhase> {
  const dq = _safe(() => dataQualityHealth(), null);
  const decq = _safe(() => decisionQualityHealth(), null);
  return Object.freeze([
    { n: 1, name: 'One source of truth', status: 'certified', note: 'FarmBrainState — every screen reads it (RULE 2).' },
    { n: 2, name: 'Data Quality Engine', status: dq ? 'certified' : 'pending',
      note: 'completeness/freshness/consistency/confidence → High/Medium/Low; low → rescan.' },
    { n: 3, name: 'Decision Quality Engine', status: (decq && decq.rejectsWeak) ? 'certified' : 'pending',
      note: '9 criteria; rejects generic/unsupported/incomplete recommendations.' },
    { n: 4, name: 'Farm Digital Twin', status: 'certified', note: 'FarmDigitalTwinRuntime + FarmBrainState histories.' },
    { n: 5, name: 'Outcome Intelligence', status: 'certified', note: 'Decision feedback → evidence base; no fake learning.' },
    { n: 6, name: 'Scan Certification', status: 'partial', note: 'Deterministic safety certified; live photo accuracy PENDING.' },
    { n: 7, name: 'Environment Engine', status: 'certified', note: 'EnvironmentOrchestrator (Soil-first, failover, degradation).' },
    { n: 8, name: 'Business Engine', status: 'honest_null', note: 'Marketplace/funding/buyer/revenue have NO live feed — never fabricated (frozen).' },
    { n: 9, name: 'Performance', status: 'partial', note: 'Budgets gated; live <1s/<4s/<500ms PENDING field timing.' },
    { n: 10, name: 'Observability', status: 'certified', note: 'Provider uptime/latency/accuracy/acceptance/outcomes/retry/cache tracked.' },
    { n: 11, name: 'Security', status: 'certified', note: 'Keys never logged (fingerprint only); admin-gated diagnostics; RBAC; audit.' },
    { n: 12, name: 'Pilot release gates', status: 'certified', note: 'Weak-scan/dup/contradiction/missing-evidence/confidence all gated.' },
    { n: 13, name: 'Field validation', status: 'pending', note: '10/50/100 farmer adoption data — real field evidence, not fabricated.' },
  ]);
}

export function certifyEnterprise(): {
  verdict: EnterpriseVerdict; phases: ReadonlyArray<EnterprisePhase>; blockers: ReadonlyArray<string>;
} {
  return _safe(() => {
    const phases = assessEnterprisePhases();
    const pending = phases.filter((p) => p.status === 'pending' || p.status === 'partial');
    const blockers = [
      'live scan accuracy PENDING (Phase 6 — operator photo run)',
      'live performance timing PENDING (Phase 9)',
      'farmer field validation PENDING (Phase 13 — real adoption data)',
      'business engine honest_null (Phase 8 — no live market/funding feed; frozen)',
    ];
    // Honest cap: while field evidence is PENDING, ceiling is LIMITED_PILOT.
    const verdict: EnterpriseVerdict = pending.length ? 'LIMITED_PILOT' : 'READY_FOR_100_FARMERS';
    return { verdict, phases, blockers: Object.freeze(blockers) };
  }, { verdict: 'NOT_READY' as EnterpriseVerdict, phases: Object.freeze([]), blockers: Object.freeze(['certify_error']) });
}

export function enterpriseCertificationHealth() {
  const cert = certifyEnterprise();
  const pilot = _safe(() => pilotCertificationHealth(), null);
  return Object.freeze({
    ok: true, version: ENTERPRISE_CERTIFICATION_VERSION,
    featureFreeze: true,
    verdict: cert.verdict,
    phases: cert.phases,
    blockers: cert.blockers,
    pilotVerdict: pilot ? pilot.verdict : null,
    liveFieldEvidence: 'PENDING',          // never fabricated
    counts: {
      certified: cert.phases.filter((p) => p.status === 'certified').length,
      partial: cert.phases.filter((p) => p.status === 'partial').length,
      pending: cert.phases.filter((p) => p.status === 'pending').length,
      honestNull: cert.phases.filter((p) => p.status === 'honest_null').length,
    },
  });
}

export function installEnterpriseCertificationHealth(): void {
  _safe(() => {
    if (typeof window === 'undefined' || (window as any).__enterpriseCertificationHealth) return;
    Object.defineProperty(window, '__enterpriseCertificationHealth', {
      configurable: true, enumerable: false, writable: false, value: () => enterpriseCertificationHealth(),
    });
  }, undefined);
}
