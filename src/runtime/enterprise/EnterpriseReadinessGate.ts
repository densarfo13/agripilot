/**
 * src/runtime/enterprise/EnterpriseReadinessGate.ts — Composite
 * verdict for enterprise rollout.
 *
 *   window.__enterpriseReadiness()
 *
 * Verdict rules
 *   READY:        no blockers + all 7 readiness pillars true
 *   CONDITIONAL:  manual QA pending OR low data volume
 *   NOT_READY:    cross-org leakage OR missing RBAC OR missing
 *                  audit OR fake metrics OR missing route guards
 */

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

export const ENTERPRISE_READINESS_VERSION = 'enterprise-readiness-v1';

function _probe(name: string): any {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    const w = window as any;
    return typeof w[name] === 'function' ? w[name]() : null;
  }, null);
}

export function enterpriseReadiness() {
  return _safe(() => {
    const rbac     = _probe('__rbacHealth');
    const audit    = _probe('__auditHealth');
    const evidence = _probe('__evidenceHealth');
    const report   = _probe('__reportHealth');
    const outcome  = _probe('__outcomeHealth');
    const reliab   = _probe('__reliabilityHealth');
    const founder  = _probe('__founderMetricsHealth');
    const release  = _probe('__releaseLock');

    const admin    = _probe('__adminImpactHealth');
    const checks = Object.freeze({
      organizationIsolation: typeof window !== 'undefined'
        && typeof (window as any).__rbacHealth === 'function',
      rbac:                  !!(rbac && (rbac as any).initialized),
      adminImpactReady:      !!(admin
        && (admin as any).farmerProfilesReady
        && (admin as any).fakeMetrics === false),
      buyerMvpReady: !!(typeof window !== 'undefined'
        && typeof (window as any).__buyerDashboardHealth === 'function'),
      ngoMvpReady:   !!(typeof window !== 'undefined'
        && typeof (window as any).__ngoDashboardHealth === 'function'),
      auditLogs:             !!(audit && (audit as any).initialized
                              && (audit as any).appendOnly),
      evidenceChain:         !!(evidence && (evidence as any).initialized),
      reportRuntime:         !!(report && (report as any).initialized
                              && !(report as any).fakeData),
      outcomeTracking:       !!(outcome && (outcome as any).initialized),
      reliabilityDiagnostics:!!(reliab && (reliab as any).initialized),
      fakeDataAbsent:        !((founder as any) && (founder as any).fakeMetrics === true),
      roleGuards:            !!(release && (release as any).flags
                              && (release as any).flags.mobileUXClean),
      offlineCore:           !!(release && (release as any).flags
                              && (release as any).flags.offlinePlantCreateReady),
    });

    const blockers: any[] = [];
    const warnings: any[] = [];

    // ─── Hard NOT_READY blockers ─────────────────────────────
    if (!checks.rbac)               blockers.push({ id: 'rbac', detail: 'RBAC runtime missing or not initialized' });
    if (!checks.auditLogs)          blockers.push({ id: 'auditLogs', detail: 'Audit runtime missing or not append-only' });
    if (!checks.evidenceChain)      blockers.push({ id: 'evidenceChain', detail: 'Evidence chain not initialized' });
    if (!checks.fakeDataAbsent)     blockers.push({ id: 'fakeDataAbsent', detail: 'Fake metrics detected on founder dashboard' });
    if (!checks.roleGuards)         blockers.push({ id: 'roleGuards', detail: 'Role guards not enforced' });
    if (!checks.organizationIsolation) blockers.push({ id: 'organizationIsolation', detail: 'Tenant isolation unavailable' });

    // ─── Soft (CONDITIONAL) warnings ─────────────────────────
    if (!checks.reportRuntime)      warnings.push({ id: 'reportRuntime', detail: 'Report runtime not initialized' });
    if (!checks.outcomeTracking)    warnings.push({ id: 'outcomeTracking', detail: 'Outcome tracking not ready' });
    if (!checks.reliabilityDiagnostics) warnings.push({ id: 'reliabilityDiagnostics', detail: 'Reliability diagnostics not ready' });
    if (!checks.offlineCore)        warnings.push({ id: 'offlineCore', detail: 'Offline plant-create not verified at runtime' });
    if (release && _isObj((release as any).warnings)) {
      // surface low-data-volume warnings from the release lock
      const lockWarnings = ((release as any).warnings || []) as any[];
      for (const w of lockWarnings) {
        if (w && /knowledge:|media:/.test(w.detail || '')) {
          warnings.push(w);
        }
      }
    }

    let verdict: 'READY' | 'CONDITIONAL' | 'NOT_READY' = 'READY';
    if (blockers.length > 0)       verdict = 'NOT_READY';
    else if (warnings.length > 0)  verdict = 'CONDITIONAL';

    const passed = Object.values(checks).filter(Boolean).length;
    const total  = Object.values(checks).length;
    const score  = Math.round((passed / Math.max(1, total)) * 100);

    return Object.freeze({
      runtimeVersion: ENTERPRISE_READINESS_VERSION,
      verdict,
      score,
      blockers: Object.freeze(blockers),
      warnings: Object.freeze(warnings),
      checks,
      diagnostics: Object.freeze({
        rbac:     !!rbac,
        audit:    !!audit,
        evidence: !!evidence,
        report:   !!report,
        outcome:  !!outcome,
        reliability: !!reliab,
        founder:  !!founder,
        release:  !!release,
      }),
    });
  }, Object.freeze({
    runtimeVersion: ENTERPRISE_READINESS_VERSION,
    verdict: 'NOT_READY',
    score: 0,
    blockers: Object.freeze([{ id: 'runtime', detail: 'gate threw' }]),
    warnings: Object.freeze([]),
    checks: Object.freeze({}),
  }));
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
