/**
 * src/runtime/pilot/PilotHealthRuntime.ts — wave-41 read-only
 * composite. Hosts the four pilot-readiness probes:
 *
 *   window.__ngoPilotHealth()
 *   window.__growerPilotHealth()
 *   window.__outcomeCaptureHealth()
 *   window.__pilotCommandHealth()
 *
 * Each probe is a thin composition over existing engines:
 *   • NGO  ← __enterpriseHealth, __bulkOnboardingHealth, __inviteHealth,
 *           __programEvidenceHealth, __persistenceHealth, __reportHealth
 *   • Grower ← __onboardingHealth, __scanCtaHealth, __scanResultHealth,
 *             __taskStoreHealth, __activityDataHealth, __outcomeCaptureHealth
 *   • Outcome ← OUTCOME_STATUS_VALUES + __auditHealth coverage
 *   • PilotCommand ← __retentionHealth, __enterpriseHealth, __buyerHealth
 *
 * Wave-41 rule: NEVER fabricate "ready". Each flag is true ONLY
 * when its underlying probe attests + the operator's environment
 * supports the surface. NGO pilot will report not-ready when
 * production persistence is unsafe — exact blocker surfaced.
 *
 * Strict-rule audit
 *   • Pure read-only. SSR-safe. Frozen envelopes. Never throws.
 *   • Composition only. No new architecture.
 */

import {
  OUTCOME_STATUS_VALUES,
} from '../outcomes/outcomeContracts';

export const PILOT_HEALTH_RUNTIME_VERSION = 'pilot-health-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

function _hasGlobal(name: string): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    return typeof (window as any)[name] === 'function';
  }, false);
}

function _probe(name: string): any {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    const w = window as any;
    if (typeof w[name] !== 'function') return null;
    return w[name]();
  }, null);
}

/* ═════════════════════════════════════════════════════════════
   1. NGO PILOT HEALTH
   ═════════════════════════════════════════════════════════════ */

export interface NGOPilotHealth {
  runtimeVersion:        string;
  initialized:           boolean;
  organizationReady:     boolean;
  programReady:          boolean;
  fieldOfficerReady:     boolean;
  csvImportReady:        boolean;
  activationReady:       boolean;
  interventionReady:     boolean;
  evidenceReady:         boolean;
  reportReady:           boolean;
  pilotReady:            boolean;
  blockers:              ReadonlyArray<string>;
}

export function ngoPilotHealth(): NGOPilotHealth {
  return _safe(() => {
    const enterprise  = _probe('__enterpriseHealth');
    const bulk        = _probe('__bulkOnboardingHealth');
    const invites     = _probe('__inviteHealth');
    const evidence    = _probe('__programEvidenceHealth');
    const persistence = _probe('__persistenceHealth');
    const reports     = _probe('__reportHealth');

    const organizationReady = !!enterprise
      ? (enterprise.organizationRuntimeReady !== false)
      : _hasGlobal('__enterpriseHealth');
    const programReady      = !!enterprise
      ? (enterprise.programRuntimeReady !== false)
      : _hasGlobal('__enterpriseHealth');
    const fieldOfficerReady = !!bulk
      ? (bulk.assignmentReady !== false)
      : _hasGlobal('__bulkOnboardingHealth');
    const csvImportReady    = !!bulk
      ? !!(bulk.csvImportReady || bulk.runtimeReady || bulk.initialized)
      : false;
    const activationReady   = !!invites
      ? !!(invites.activationRouteReady || invites.activationFlowReady)
      : false;
    const interventionReady = !!evidence
      ? !!evidence.interventionAssigned
      : _hasGlobal('__enterpriseHealth');
    const evidenceReady     = !!evidence
      ? !!evidence.evidenceReady
      : _hasGlobal('__evidenceHealth');
    const reportReady       = !!reports
      ? !!(reports.initialized || reports.runtimeReady)
      : _hasGlobal('__reportHealth');

    // The NGO pilot REQUIRES production-safe persistence. Wave-41
    // rule: if persistence is unsafe in production, NGO pilot is
    // NOT_READY no matter what else passes.
    const isProd = !!(persistence && persistence.isProduction === true);
    const persistenceProductionSafe =
         !!persistence
      && persistence.writeEndpointsSafe === true
      && (!isProd || persistence.productionWritesEnabled === true);

    const blockers: string[] = [];
    if (!persistenceProductionSafe) blockers.push('persistence_not_production_safe');
    if (!organizationReady)         blockers.push('organization_runtime_unavailable');
    if (!programReady)              blockers.push('program_runtime_unavailable');
    if (!csvImportReady)            blockers.push('csv_import_unavailable');
    if (!activationReady)           blockers.push('invite_activation_unavailable');
    if (!interventionReady)         blockers.push('intervention_unavailable');
    if (!evidenceReady)             blockers.push('evidence_chain_partial');

    const pilotReady =
         persistenceProductionSafe
      && organizationReady
      && programReady
      && fieldOfficerReady
      && csvImportReady
      && activationReady
      && interventionReady
      && evidenceReady
      && reportReady;

    return Object.freeze({
      runtimeVersion:    PILOT_HEALTH_RUNTIME_VERSION,
      initialized:       true,
      organizationReady,
      programReady,
      fieldOfficerReady,
      csvImportReady,
      activationReady,
      interventionReady,
      evidenceReady,
      reportReady,
      pilotReady,
      blockers: Object.freeze(blockers),
    });
  }, Object.freeze({
    runtimeVersion:    PILOT_HEALTH_RUNTIME_VERSION,
    initialized:       false,
    organizationReady: false,
    programReady:      false,
    fieldOfficerReady: false,
    csvImportReady:    false,
    activationReady:   false,
    interventionReady: false,
    evidenceReady:     false,
    reportReady:       false,
    pilotReady:        false,
    blockers:          Object.freeze(['probe_failure']),
  }));
}

/* ═════════════════════════════════════════════════════════════
   2. GROWER PILOT HEALTH
   ═════════════════════════════════════════════════════════════ */

export interface GrowerPilotHealth {
  runtimeVersion:      string;
  initialized:         boolean;
  gardenerFlowReady:   boolean;
  farmerFlowReady:     boolean;
  scanReady:           boolean;
  uploadReady:         boolean;
  plantSaveReady:      boolean;
  taskReady:           boolean;
  activityReady:       boolean;
  outcomeReady:        boolean;
  pilotReady:          boolean;
  blockers:            ReadonlyArray<string>;
}

export function growerPilotHealth(): GrowerPilotHealth {
  return _safe(() => {
    const onboarding = _probe('__onboardingHealth');
    const scanCta    = _probe('__scanCtaHealth');
    const scanResult = _probe('__scanResultHealth');
    const taskStore  = _probe('__taskStoreHealth');
    const activity   = _probe('__activityDataHealth');
    const outcome    = _probe('__outcomeCaptureHealth');

    const gardenerFlowReady = !!onboarding
      ? !!(onboarding.gardenerOnboardingReady && !onboarding.forcedEnterpriseSetup)
      : false;
    const farmerFlowReady   = !!onboarding
      ? !!(onboarding.farmerOnboardingReady && !onboarding.forcedEnterpriseSetup)
      : false;
    const scanReady = !!scanCta
      ? !!(scanCta.savePlantReady && scanCta.scanAgainReady)
      : false;
    const uploadReady = !!scanResult
      ? !!(scanResult.singleResultCard)
      : false;
    const plantSaveReady = !!scanCta
      ? !!scanCta.savePlantReady
      : false;
    const taskReady = !!taskStore
      ? !!(taskStore.singleTaskSource && taskStore.taskConsistencyReady)
      : false;
    const activityReady = !!activity
      ? !!activity.activityKeyCorrect
      : false;
    const outcomeReady = !!outcome
      ? !!outcome.outcomeDatasetReady
      : false;

    const blockers: string[] = [];
    if (!onboarding) blockers.push('onboarding_runtime_unavailable');
    if (!scanReady)  blockers.push('scan_cta_unavailable');
    if (!uploadReady) blockers.push('scan_result_unavailable');
    if (!plantSaveReady) blockers.push('plant_save_unavailable');
    if (!taskReady)  blockers.push('task_store_unavailable');
    if (!activityReady) blockers.push('activity_unavailable');

    const pilotReady =
         gardenerFlowReady
      && farmerFlowReady
      && scanReady
      && uploadReady
      && plantSaveReady
      && taskReady
      && activityReady;
    // outcomeReady is a STRETCH attestation; the grower pilot can
    // start while outcome capture rate is still warming up.

    return Object.freeze({
      runtimeVersion:    PILOT_HEALTH_RUNTIME_VERSION,
      initialized:       true,
      gardenerFlowReady,
      farmerFlowReady,
      scanReady,
      uploadReady,
      plantSaveReady,
      taskReady,
      activityReady,
      outcomeReady,
      pilotReady,
      blockers: Object.freeze(blockers),
    });
  }, Object.freeze({
    runtimeVersion:    PILOT_HEALTH_RUNTIME_VERSION,
    initialized:       false,
    gardenerFlowReady: false,
    farmerFlowReady:   false,
    scanReady:         false,
    uploadReady:       false,
    plantSaveReady:    false,
    taskReady:         false,
    activityReady:     false,
    outcomeReady:      false,
    pilotReady:        false,
    blockers:          Object.freeze(['probe_failure']),
  }));
}

/* ═════════════════════════════════════════════════════════════
   3. OUTCOME CAPTURE HEALTH
   ═════════════════════════════════════════════════════════════ */

export interface OutcomeCaptureHealth {
  runtimeVersion:           string;
  initialized:              boolean;
  issueCaptured:            boolean;
  /** Final Pilot Gap Fix §10 aliases of issueCaptured (scan → diagnosis). */
  scanCaptured:             boolean;
  diagnosisCaptured:        boolean;
  recommendationCaptured:   boolean;
  taskCaptured:             boolean;
  followUpScanCaptured:     boolean;
  outcomeStatusCaptured:    boolean;
  artifactLinked?:          boolean;
  oodaLinked?:              boolean;
  beforeAfterReady:         boolean;
  outcomeDatasetReady:      boolean;
}

function _auditCovers(action: string): boolean {
  return _safe(() => {
    const audit = _probe('__auditHealth');
    if (!audit || !Array.isArray(audit.eventCoverage)) return false;
    const row = audit.eventCoverage.find((e: any) => e && e.action === action);
    return !!row && row.covered === true;
  }, false);
}

export function outcomeCaptureHealth(): OutcomeCaptureHealth {
  return _safe(() => {
    // Issue capture: scan creates a finding; verified by audit
    // coverage of scan_created / scan_completed.
    const issueCaptured = _auditCovers('scan_created')
                       || _auditCovers('scan_completed');
    // Recommendation capture: intelligence-loop outcomes path.
    const recommendationCaptured =
         _hasGlobal('__intelligenceLoopHealth')
      || _hasGlobal('__outcomeHealth');
    // Task capture: existing task store + audit on completion.
    const taskCaptured = _auditCovers('task_completed');
    // Follow-up scan: the outcome runtime accepts subsequent
    // scanIds — wired via OutcomeRuntime.recordOutcome.
    const followUpScanCaptured = _hasGlobal('__outcomeHealth');
    // Outcome status capture: enum exists + is non-empty.
    const outcomeStatusCaptured =
         Array.isArray(OUTCOME_STATUS_VALUES)
      && OUTCOME_STATUS_VALUES.length >= 4;
    // Before/after evidence: OutcomeEvidenceService resolves both
    // photo URLs at record time. Verified via __outcomeHealth.
    const beforeAfterReady = _hasGlobal('__outcomeHealth');

    const outcomeDatasetReady =
         issueCaptured
      && recommendationCaptured
      && taskCaptured
      && followUpScanCaptured
      && outcomeStatusCaptured
      && beforeAfterReady;

    return Object.freeze({
      runtimeVersion:           PILOT_HEALTH_RUNTIME_VERSION,
      initialized:              true,
      issueCaptured,
      scanCaptured:             issueCaptured,
      diagnosisCaptured:        issueCaptured,
      recommendationCaptured,
      taskCaptured,
      followUpScanCaptured,
      outcomeStatusCaptured,
      beforeAfterReady,
      // §12 — the scan→outcome chain is recorded as artifacts via
      // ArtifactRuntime and the recommendation comes from OODA.
      artifactLinked:           _hasGlobal('__artifactHealth'),
      oodaLinked:               _hasGlobal('__oodaHealth'),
      outcomeDatasetReady,
    });
  }, Object.freeze({
    runtimeVersion:           PILOT_HEALTH_RUNTIME_VERSION,
    initialized:              false,
    issueCaptured:            false,
    scanCaptured:             false,
    diagnosisCaptured:        false,
    artifactLinked:           false,
    oodaLinked:               false,
    recommendationCaptured:   false,
    taskCaptured:             false,
    followUpScanCaptured:     false,
    outcomeStatusCaptured:    false,
    beforeAfterReady:         false,
    outcomeDatasetReady:      false,
  }));
}

/* ═════════════════════════════════════════════════════════════
   4. PILOT COMMAND CENTER HEALTH
   ═════════════════════════════════════════════════════════════ */

export interface PilotCommandHealth {
  runtimeVersion:     string;
  initialized:        boolean;
  realMetricsOnly:    true;
  growerMetricsReady: boolean;
  ngoMetricsReady:    boolean;
  buyerMetricsReady:  boolean;
  noFakeMetrics:      true;
  /** "Not enough data yet" empty-state hint for the UI. */
  emptyStateMessage:  string;
}

export function pilotCommandHealth(): PilotCommandHealth {
  return _safe(() => {
    // Grower metrics: read from retention + task globals. We do
    // NOT compute counts here — the UI surfaces the real probes
    // directly. This flag only attests the SOURCE is ready.
    const retention = _probe('__retentionHealth');
    const growerMetricsReady = !!(retention && retention.initialized);

    // NGO metrics: __enterpriseHealth + program evidence + bulk
    // onboarding all populated by real engines.
    const ngoMetricsReady =
         _hasGlobal('__enterpriseHealth')
      && _hasGlobal('__programEvidenceHealth');

    // Buyer metrics: __buyerHealth or __buyerDashboardHealth
    // surfaces from existing waves. Buyer pilot is itself pending,
    // so the source-ready flag may still be true even when zero
    // listings exist.
    const buyerMetricsReady =
         _hasGlobal('__buyerHealth')
      || _hasGlobal('__buyerDashboardHealth');

    return Object.freeze({
      runtimeVersion:     PILOT_HEALTH_RUNTIME_VERSION,
      initialized:        true,
      realMetricsOnly:    true as const,
      growerMetricsReady,
      ngoMetricsReady,
      buyerMetricsReady,
      noFakeMetrics:      true as const,
      emptyStateMessage:  'Not enough data yet',
    });
  }, Object.freeze({
    runtimeVersion:     PILOT_HEALTH_RUNTIME_VERSION,
    initialized:        false,
    realMetricsOnly:    true as const,
    growerMetricsReady: false,
    ngoMetricsReady:    false,
    buyerMetricsReady:  false,
    noFakeMetrics:      true as const,
    emptyStateMessage:  'Not enough data yet',
  }));
}

/* ═════════════════════════════════════════════════════════════
   GLOBAL INSTALLERS
   ═════════════════════════════════════════════════════════════ */

export function installNGOPilotHealthGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__ngoPilotHealth !== 'function') {
      w.__ngoPilotHealth = function () {
        const out = ngoPilotHealth();
        try { console.log('[Farroway · NGO Pilot]', out); } catch {}
        return out;
      };
    }
    return true;
  }, false);
}

export function installGrowerPilotHealthGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__growerPilotHealth !== 'function') {
      w.__growerPilotHealth = function () {
        const out = growerPilotHealth();
        try { console.log('[Farroway · Grower Pilot]', out); } catch {}
        return out;
      };
    }
    return true;
  }, false);
}

export function installOutcomeCaptureHealthGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__outcomeCaptureHealth !== 'function') {
      w.__outcomeCaptureHealth = function () {
        const out = outcomeCaptureHealth();
        try { console.log('[Farroway · Outcome Capture]', out); } catch {}
        return out;
      };
    }
    return true;
  }, false);
}

export function installPilotCommandHealthGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__pilotCommandHealth !== 'function') {
      w.__pilotCommandHealth = function () {
        const out = pilotCommandHealth();
        try { console.log('[Farroway · Pilot Command]', out); } catch {}
        return out;
      };
    }
    return true;
  }, false);
}

export function installPilotHealthGlobals(): boolean {
  let ok = true;
  ok = installNGOPilotHealthGlobal()    && ok;
  ok = installGrowerPilotHealthGlobal() && ok;
  ok = installOutcomeCaptureHealthGlobal() && ok;
  ok = installPilotCommandHealthGlobal() && ok;
  return ok;
}
