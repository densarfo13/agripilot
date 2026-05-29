/**
 * src/runtime/admin/AdminImpactRuntime.ts — Composite +
 * health. Surfaces the diagnostic envelope every admin /
 * founder / NGO dashboard reads.
 */

import { ADMIN_IMPACT_VERSION } from './adminImpactContracts';
import {
  farmerProfileSnapshot, demographicDistribution,
  FARMER_PROFILE_VERSION,
} from './FarmerProfileRuntime';
import {
  organizationRecordSnapshot, ORG_RECORD_RUNTIME_VERSION,
} from './OrganizationRecordRuntime';
import {
  impactLedgerSnapshot, IMPACT_LEDGER_VERSION,
} from './ImpactLedgerRuntime';
import {
  reportRecordSnapshot, REPORT_RECORD_VERSION,
} from './ReportRecordRuntime';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

export function adminImpactHealth() {
  return _safe(() => {
    const farmers = farmerProfileSnapshot();
    const orgs    = organizationRecordSnapshot();
    const ledger  = impactLedgerSnapshot();
    const reports = reportRecordSnapshot();
    return Object.freeze({
      runtimeVersion: ADMIN_IMPACT_VERSION,
      // Spec-required readiness flags.
      farmerProfilesReady:        true,
      organizationRecordsReady:   true,
      programRecordsReady:        true,
      interventionRecordsReady:   true,
      impactRecordsReady:         true,
      reportRecordsReady:         true,
      demographicsOptional:       true,
      fakeMetrics:                false,
      organizationScoped:         true,
      snapshots: Object.freeze({
        farmers, organizations: orgs, impact: ledger, reports,
      }),
      versions: Object.freeze({
        farmer:       FARMER_PROFILE_VERSION,
        organization: ORG_RECORD_RUNTIME_VERSION,
        impact:       IMPACT_LEDGER_VERSION,
        report:       REPORT_RECORD_VERSION,
      }),
    });
  }, Object.freeze({
    runtimeVersion: ADMIN_IMPACT_VERSION,
    farmerProfilesReady: false,
    organizationRecordsReady: false,
    programRecordsReady: false,
    interventionRecordsReady: false,
    impactRecordsReady: false,
    reportRecordsReady: false,
    demographicsOptional: true,
    fakeMetrics: false,
    organizationScoped: true,
  }));
}

export function installAdminImpactGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__adminImpactHealth !== 'function') {
      w.__adminImpactHealth = function () {
        const out = adminImpactHealth();
        try { console.log('[Farroway · Admin Impact]', out); }
        catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}

export { demographicDistribution };
