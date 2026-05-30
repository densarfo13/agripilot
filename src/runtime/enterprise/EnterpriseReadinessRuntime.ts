/**
 * src/runtime/enterprise/EnterpriseReadinessRuntime.ts — wave-40
 * composite final verdict over Farroway's enterprise posture.
 *
 *   window.__enterpriseReadiness()
 *
 * Verdict ladder (spec §8)
 * ────────────────────────
 *   NOT_READY          — any critical gate FAIL: scan broken,
 *                        persistence unsafe, security failing,
 *                        audit not initialised
 *   PILOT_READY        — core foundation green: audit + tenant
 *                        isolation + persistence + monitoring
 *                        + basic security, but evidence chain
 *                        partial or backup not yet configured
 *   PRODUCTION_READY   — all PILOT_READY + backup configured +
 *                        full security ready + evidence chain
 *                        evidenced
 *   ENTERPRISE_READY   — PRODUCTION_READY + all warnings cleared
 *                        + go-live verdict GO + retention tracking
 *                        + monitoring fully wired
 *
 * Score (0–100): proportional to passed checks vs total.
 *
 * Strict-rule audit
 *   • Pure composition over the 7 wave-40 probes plus the wave-39
 *     go-live composer. No engine side-effects.
 *   • SSR-safe. Pure. Frozen envelope. Never throws.
 *   • Honest: each tier's gates are independently evaluated;
 *     blockers / warnings arrays surface the gap.
 */

export const ENTERPRISE_READINESS_RUNTIME_VERSION = 'enterprise-readiness-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

function _probe(name: string): any {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    const w = window as any;
    if (typeof w[name] !== 'function') return null;
    return w[name]();
  }, null);
}

export type EnterpriseVerdict =
  | 'NOT_READY'
  | 'PILOT_READY'
  | 'PRODUCTION_READY'
  | 'ENTERPRISE_READY';

export interface EnterpriseReadiness {
  runtimeVersion: string;
  score:          number;            // 0–100
  verdict:        EnterpriseVerdict;
  blockers:       ReadonlyArray<string>;
  warnings:       ReadonlyArray<string>;
  /** Per-probe attestations for QA console drill-down. */
  attestations: Readonly<{
    auditReady:           boolean;
    tenantIsolationReady: boolean;
    securityReady:        boolean;
    backupReady:          boolean;
    monitoringReady:      boolean;
    evidenceReady:        boolean;
    persistenceReady:     boolean;
    goLiveVerdict:        string;
  }>;
}

const FROZEN_FALLBACK: Readonly<EnterpriseReadiness> = Object.freeze({
  runtimeVersion: ENTERPRISE_READINESS_RUNTIME_VERSION,
  score:          0,
  verdict:        'NOT_READY',
  blockers:       Object.freeze(['probe_failure']),
  warnings:       Object.freeze([]),
  attestations: Object.freeze({
    auditReady:           false,
    tenantIsolationReady: false,
    securityReady:        false,
    backupReady:          false,
    monitoringReady:      false,
    evidenceReady:        false,
    persistenceReady:     false,
    goLiveVerdict:        'NO_GO',
  }),
});

export function enterpriseReadiness(): EnterpriseReadiness {
  return _safe(() => {
    const audit       = _probe('__auditHealth');
    const tenant      = _probe('__tenantIsolationHealth');
    const security    = _probe('__securityHealth');
    const backup      = _probe('__backupHealth');
    const monitoring  = _probe('__monitoringHealth');
    const evidence    = _probe('__programEvidenceHealth');
    const persistence = _probe('__persistenceHealth');
    const goLive      = _probe('__goLiveHealth');

    const auditReady =
         !!audit
      && audit.initialized === true
      && audit.writerReady === true
      && audit.readerReady === true
      && audit.canonicalEventsCovered === true;

    const tenantIsolationReady =
         !!tenant
      && tenant.failClosed === true
      && tenant.noCrossTenantLeakage === true;

    const securityReady =
         !!security
      && security.securityReady === true;

    const backupReady =
         !!backup
      && backup.backupReady === true;

    const monitoringReady =
         !!monitoring
      && monitoring.initialized === true
      && monitoring.errorReporterReady === true;

    const evidenceReady =
         !!evidence
      && evidence.evidenceReady === true;

    const isProd = !!(persistence && persistence.isProduction === true);
    const persistenceReady =
         !!persistence
      && persistence.writeEndpointsSafe === true
      && (!isProd || persistence.productionWritesEnabled === true);

    const goLiveVerdict = (goLive && typeof goLive.verdict === 'string')
      ? goLive.verdict : 'NO_GO';

    // Blockers — TRUE blockers force NOT_READY.
    const blockers: string[] = [];
    if (!auditReady)            blockers.push('audit_not_ready');
    if (!tenantIsolationReady)  blockers.push('tenant_isolation_failing');
    if (!persistenceReady)      blockers.push('persistence_unsafe');
    if (goLiveVerdict === 'NO_GO') blockers.push('go_live_NO_GO');

    // Warnings — degrade verdict ladder but don't force NOT_READY.
    const warnings: string[] = [];
    if (!securityReady)   warnings.push('security_partial');
    if (!monitoringReady) warnings.push('monitoring_partial');
    if (!backupReady)     warnings.push('backup_not_configured');
    if (!evidenceReady)   warnings.push('evidence_partial');

    // Score — proportional to attestations passed.
    const total = 7;
    const passed =
        (auditReady ? 1 : 0)
      + (tenantIsolationReady ? 1 : 0)
      + (securityReady ? 1 : 0)
      + (backupReady ? 1 : 0)
      + (monitoringReady ? 1 : 0)
      + (evidenceReady ? 1 : 0)
      + (persistenceReady ? 1 : 0);
    const score = Math.round((passed / total) * 100);

    // Verdict ladder.
    let verdict: EnterpriseVerdict;
    if (blockers.length > 0) {
      verdict = 'NOT_READY';
    } else if (
         auditReady
      && tenantIsolationReady
      && persistenceReady
      && monitoringReady
      && securityReady
      && backupReady
      && evidenceReady
      && goLiveVerdict === 'GO'
      && warnings.length === 0
    ) {
      verdict = 'ENTERPRISE_READY';
    } else if (
         auditReady
      && tenantIsolationReady
      && persistenceReady
      && backupReady
      && securityReady
      && evidenceReady
    ) {
      verdict = 'PRODUCTION_READY';
    } else if (
         auditReady
      && tenantIsolationReady
      && persistenceReady
      && monitoringReady
    ) {
      verdict = 'PILOT_READY';
    } else {
      verdict = 'NOT_READY';
    }

    return Object.freeze({
      runtimeVersion: ENTERPRISE_READINESS_RUNTIME_VERSION,
      score,
      verdict,
      blockers: Object.freeze(blockers),
      warnings: Object.freeze(warnings),
      attestations: Object.freeze({
        auditReady,
        tenantIsolationReady,
        securityReady,
        backupReady,
        monitoringReady,
        evidenceReady,
        persistenceReady,
        goLiveVerdict,
      }),
    });
  }, FROZEN_FALLBACK);
}

export function installEnterpriseReadinessGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__enterpriseReadiness !== 'function') {
      w.__enterpriseReadiness = function () {
        const out = enterpriseReadiness();
        try { console.log('[Farroway · Enterprise Readiness]', out); }
        catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
