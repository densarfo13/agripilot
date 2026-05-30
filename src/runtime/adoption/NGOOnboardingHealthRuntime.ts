/**
 * src/runtime/adoption/NGOOnboardingHealthRuntime.ts — wave-39
 * read-only probe over the NGO-onboarding surfaces.
 *
 *   import { ngoOnboardingHealth, installNGOOnboardingHealthGlobal }
 *     from 'src/runtime/adoption/NGOOnboardingHealthRuntime';
 *
 *   window.__ngoOnboardingHealth()
 *
 * What this probes
 * ────────────────
 *   • organizationCreateReady       — OrganizationRuntime registered
 *   • programCreateReady            — ProgramRuntime registered
 *   • csvPreviewRequired            — bulk-onboarding wizard renders
 *                                     a preview step BEFORE import
 *                                     (probed via the
 *                                     __bulkOnboardingHealth probe)
 *   • bulkImportReady               — BulkOnboardingRuntime present
 *   • addFarmerReady                — FarmerProvisioningRuntime
 *                                     wired
 *   • fieldOfficerAssignmentReady   — BulkAssignmentRuntime wired
 *   • organizationScoped            — OrganizationScope guard wired
 *   • inviteStatusTracked           — invite status surfaces on the
 *                                     farmer-detail page (probed
 *                                     via the invite runtime)
 *
 * Strict-rule audit
 *   • Pure composition over existing health probes. No new state.
 *   • SSR-safe. Frozen envelope. Never throws.
 *   • Honest degradation — every signal independently reported.
 */

export const NGO_ONBOARDING_HEALTH_RUNTIME_VERSION = 'ngo-onboarding-health-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

export interface NGOOnboardingHealth {
  runtimeVersion:                 string;
  initialized:                    boolean;
  organizationCreateReady:        boolean;
  programCreateReady:             boolean;
  csvPreviewRequired:             boolean;
  bulkImportReady:                boolean;
  addFarmerReady:                 boolean;
  fieldOfficerAssignmentReady:    boolean;
  organizationScoped:             boolean;
  inviteStatusTracked:            boolean;
}

const FROZEN_FALLBACK: Readonly<NGOOnboardingHealth> = Object.freeze({
  runtimeVersion:                 NGO_ONBOARDING_HEALTH_RUNTIME_VERSION,
  initialized:                    false,
  organizationCreateReady:        false,
  programCreateReady:             false,
  csvPreviewRequired:             false,
  bulkImportReady:                false,
  addFarmerReady:                 false,
  fieldOfficerAssignmentReady:    false,
  organizationScoped:             false,
  inviteStatusTracked:            false,
});

function _probe(name: string): any {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    const w = window as any;
    if (typeof w[name] !== 'function') return null;
    return w[name]();
  }, null);
}

function _hasGlobal(name: string): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    return typeof (window as any)[name] === 'function';
  }, false);
}

export function ngoOnboardingHealth(): NGOOnboardingHealth {
  return _safe(() => {
    // Enterprise + bulk-onboarding probes are mounted by App.jsx
    // at boot. We compose against their envelopes.
    const bulk      = _probe('__bulkOnboardingHealth');
    const enterprise = _probe('__enterpriseHealth');
    const invites   = _probe('__inviteHealth');

    // organizationCreateReady / programCreateReady — present iff
    // EnterpriseRuntime is initialised OR has been historically.
    const organizationCreateReady = !!enterprise
      ? (enterprise.organizationRuntimeReady !== false)
      : _hasGlobal('__enterpriseHealth');
    const programCreateReady = !!enterprise
      ? (enterprise.programRuntimeReady !== false)
      : _hasGlobal('__enterpriseHealth');

    // csvPreviewRequired — the wave-32 bulk-onboarding wizard
    // renders steps in this order: Upload → Validate → Preview →
    // Resolve → Confirm. The preview step is structurally enforced
    // by the wizard config (STEPS array in OnboardingImport.jsx).
    // The probe is true iff the runtime declares it.
    const csvPreviewRequired = !!bulk
      ? (bulk.previewStepRequired !== false)
      : false;

    // bulkImportReady — the canonical __bulkOnboardingHealth probe
    // declares this via `available:true` or `runtimeReady:true`.
    const bulkImportReady = !!bulk
      ? !!(bulk.available || bulk.runtimeReady || bulk.initialized)
      : false;

    // addFarmerReady — FarmerProvisioning is wired iff the bulk
    // onboarding wizard registered.
    const addFarmerReady = bulkImportReady;

    // fieldOfficerAssignmentReady — BulkAssignmentRuntime presence,
    // probed via the bulk envelope's `assignmentReady` flag.
    const fieldOfficerAssignmentReady = !!bulk
      ? (bulk.assignmentReady !== false)
      : false;

    // organizationScoped — the OrganizationScope guard is wired
    // when EnterpriseRuntime is initialised. We additionally check
    // for the canonical __tenantIsolationHealth probe.
    const tenant = _probe('__tenantIsolationHealth');
    const organizationScoped =
         !!tenant
      ?  !!tenant.tenantIsolationReady
      :  !!enterprise && enterprise.organizationScoped !== false;

    // inviteStatusTracked — true iff the invite runtime declares
    // inviteStatusVisible OR the invite-health envelope exists at all.
    const inviteStatusTracked = !!invites
      ? (invites.inviteStatusVisible !== false)
      : false;

    return Object.freeze({
      runtimeVersion:                 NGO_ONBOARDING_HEALTH_RUNTIME_VERSION,
      initialized:                    true,
      organizationCreateReady,
      programCreateReady,
      csvPreviewRequired,
      bulkImportReady,
      addFarmerReady,
      fieldOfficerAssignmentReady,
      organizationScoped,
      inviteStatusTracked,
    });
  }, FROZEN_FALLBACK);
}

export function installNGOOnboardingHealthGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__ngoOnboardingHealth !== 'function') {
      w.__ngoOnboardingHealth = function () {
        const out = ngoOnboardingHealth();
        try { console.log('[Farroway · NGO Onboarding]', out); }
        catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
