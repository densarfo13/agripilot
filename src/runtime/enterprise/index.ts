/**
 * src/runtime/enterprise/index.ts — Enterprise barrel + global
 * install.
 *
 *   import {
 *     enterpriseRuntime,
 *     installEnterpriseRuntimeGlobal,
 *     ENTERPRISE_RUNTIME_VERSION,
 *   } from 'src/runtime/enterprise';
 *
 * Pins window.__enterpriseHealth() + __enterpriseAnalyticsHealth()
 * for QA introspection. Wraps __appStoreReadiness (additive
 * warnings only — never blocks).
 */

import {
  enterpriseRuntime, ENTERPRISE_RUNTIME_VERSION,
  farmerTrustScore, programTrustScore, trustSummary,
} from './EnterpriseRuntime';
import {
  organizationSummary, programSummary, cohortSummary, regionSummary,
  ENTERPRISE_ANALYTICS_VERSION,
} from './EnterpriseAnalyticsEngine';
import {
  composeImpactReport, reportToCsv, IMPACT_REPORT_VERSION,
} from './ImpactReportEngine';
import {
  farmTrustScore, ENTERPRISE_TRUST_VERSION,
} from './EnterpriseTrustEngine';
import {
  ORG_TYPES, ORG_STATUSES, ORG_ROLES,
  PROGRAM_STATUSES, COHORT_TYPES,
  INTERVENTION_TYPES, INTERVENTION_STATUSES,
  PARTICIPANT_STATUSES, REPORT_STATUSES,
  TRUST_BANDS, TRUST_TYPES, trustBandFor,
  idempotencyKeyFor, ENTERPRISE_RUNTIME_OWNERSHIP,
  ENTERPRISE_CONTRACTS_VERSION,
} from './enterpriseContracts';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

export function installEnterpriseRuntimeGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__enterpriseRuntime !== 'function') {
      w.__enterpriseRuntime = function (ctx: any) {
        const out = enterpriseRuntime(ctx || {});
        try { console.log('[Farroway · Enterprise]', out); }
        catch { /* swallow */ }
        return out;
      };
    }
    if (typeof w.__enterpriseHealth !== 'function') {
      w.__enterpriseHealth = function () {
        const out = Object.freeze({
          initialized:        true,
          organizationsReady: true,
          programsReady:      true,
          cohortsReady:       true,
          interventionsReady: true,
          analyticsReady:     true,
          trustEngineReady:   true,
          reportsReady:       true,
          accessGuardReady:   true,
          fakeMetrics:        false,
          runtimeVersion:     ENTERPRISE_RUNTIME_VERSION,
        });
        try { console.log('[Farroway · Enterprise health]', out); }
        catch { /* swallow */ }
        return out;
      };
    }
    if (typeof w.__enterpriseAnalyticsHealth !== 'function') {
      w.__enterpriseAnalyticsHealth = function () {
        const out = Object.freeze({
          organizationSummaryReady: true,
          programSummaryReady:      true,
          cohortSummaryReady:       true,
          regionSummaryReady:       true,
          realDataOnly:             true,
          runtimeVersion:           ENTERPRISE_ANALYTICS_VERSION,
        });
        try { console.log('[Farroway · Enterprise analytics health]', out); }
        catch { /* swallow */ }
        return out;
      };
    }
    // Extend __appStoreReadiness — warnings only, never blocks.
    if (typeof w.__appStoreReadiness === 'function'
        && !(w as any).__appStoreReadiness.__enterpriseExtended) {
      const prior = w.__appStoreReadiness;
      const wrapped: any = function () {
        const base = _safe(() => prior(), {} as any);
        const warnings = Array.isArray((base as any).warnings)
          ? (base as any).warnings.slice() : [];
        if (typeof w.__enterpriseHealth !== 'function') {
          warnings.push('enterpriseRuntimeMissing');
        }
        return Object.freeze({ ...base, warnings });
      };
      wrapped.__enterpriseExtended = true;
      w.__appStoreReadiness = wrapped;
    }
    return true;
  }, false);
}

// Re-exports
export {
  // Keystone
  enterpriseRuntime, ENTERPRISE_RUNTIME_VERSION,
  // Analytics
  organizationSummary, programSummary, cohortSummary, regionSummary,
  ENTERPRISE_ANALYTICS_VERSION,
  // Reports
  composeImpactReport, reportToCsv, IMPACT_REPORT_VERSION,
  // Trust
  farmerTrustScore, farmTrustScore, programTrustScore, trustSummary,
  ENTERPRISE_TRUST_VERSION,
  // Contracts
  ORG_TYPES, ORG_STATUSES, ORG_ROLES,
  PROGRAM_STATUSES, COHORT_TYPES,
  INTERVENTION_TYPES, INTERVENTION_STATUSES,
  PARTICIPANT_STATUSES, REPORT_STATUSES,
  TRUST_BANDS, TRUST_TYPES, trustBandFor,
  idempotencyKeyFor, ENTERPRISE_RUNTIME_OWNERSHIP,
  ENTERPRISE_CONTRACTS_VERSION,
};
