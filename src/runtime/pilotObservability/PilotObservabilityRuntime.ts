/**
 * src/runtime/pilotObservability/PilotObservabilityRuntime.ts —
 * wave-38 read-only observability composite for pilot rollout.
 *
 * No new architecture. Composes existing real-data sources:
 *   • readStoredEvents()          — retention event stream
 *   • listOutcomes()              — outcome records
 *   • __retentionHealth.metrics   — D1/D7/D30 + return rate
 *   • __ngoPilotHealth            — NGO surfaces
 *   • __ngoOnboardingHealth       — org + program flags
 *   • __inviteHealth              — invite providers + activation
 *   • __scanResultHealth          — scan single-card readiness
 *   • __scanCtaHealth             — scan CTA readiness
 *
 * Globals installed
 *   window.__activationHealth()
 *   window.__adoptionFunnel()
 *   window.__scanSuccessMetrics()
 *   window.__pilotAlerts()
 *   window.__pilotHealth()         — composite {adoption/retention/ngo/scan/observability}
 *   window.__ngoCommandHealth()    — NGO command center envelope
 *
 * Honest contract (gate-enforced)
 *   • No hardcoded adoption counts.
 *   • Empty → EMPTY_STATE string, never fake numbers.
 *   • Numeric fields are `null` when source is unavailable.
 *   • All metrics derive from listOutcomes() and readStoredEvents().
 */

import { listOutcomes } from '../outcomes/OutcomeRuntime';
import { OUTCOME_STATUS } from '../outcomes/outcomeContracts';
import { readStoredEvents, readFirstVisit } from '../retention/RetentionRuntime';
import { RETENTION_EVENT } from '../retention/retentionContracts';

export const PILOT_OBSERVABILITY_RUNTIME_VERSION = 'pilot-observability-v1';
export const EMPTY_STATE = 'Not enough data yet';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _DAY_MS = 24 * 60 * 60 * 1000;

function _probe(name: string): any {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    const w = window as any;
    return typeof w[name] === 'function' ? w[name]() : null;
  }, null);
}
function _ms(iso: string | null | undefined): number {
  return _safe(() => new Date(iso || '').getTime(), NaN);
}
function _pct(num: number, denom: number): number | null {
  if (!Number.isFinite(num) || !Number.isFinite(denom)) return null;
  if (denom <= 0) return null;
  return Math.max(0, Math.min(100, Math.round((num / denom) * 100)));
}

/* ═════════════════════════════════════════════════════════════
   1. ACTIVATION HEALTH
   Real counts derived from retention events + outcome records +
   existing onboarding probes.
   ═════════════════════════════════════════════════════════════ */

export interface ActivationHealth {
  runtimeVersion:         string;
  initialized:            boolean;
  accountsCreated:        number | null;
  profilesCompleted:      number | null;
  farmsCreated:           number | null;
  plantsAdded:            number | null;
  firstScanCompleted:     number | null;
  firstTaskCompleted:     number | null;
  emptyState:             string;
}

const FROZEN_ACTIVATION_FALLBACK: Readonly<ActivationHealth> = Object.freeze({
  runtimeVersion:     PILOT_OBSERVABILITY_RUNTIME_VERSION,
  initialized:        false,
  accountsCreated:    null,
  profilesCompleted:  null,
  farmsCreated:       null,
  plantsAdded:        null,
  firstScanCompleted: null,
  firstTaskCompleted: null,
  emptyState:         EMPTY_STATE,
});

export function activationHealth(): ActivationHealth {
  return _safe(() => {
    const events = readStoredEvents();
    const eventsArr = Array.isArray(events) ? events : null;
    if (!eventsArr) return FROZEN_ACTIVATION_FALLBACK;

    let scans = 0, plantsAdded = 0, tasksCompleted = 0, appOpens = 0;
    for (const e of eventsArr) {
      if (!e) continue;
      if (e.t === RETENTION_EVENT.SCAN) scans++;
      if (e.t === RETENTION_EVENT.PLANT_CREATED) plantsAdded++;
      if (e.t === RETENTION_EVENT.TASK_COMPLETED) tasksCompleted++;
      if (e.t === RETENTION_EVENT.APP_OPEN) appOpens++;
    }

    // accountsCreated — local proxy: presence of firstVisit anchor
    // implies one account on this device. The server-side audit
    // count is more authoritative when wired; this is the honest
    // local view.
    const firstVisit = readFirstVisit();
    const accountsCreated = firstVisit ? 1 : 0;

    // profilesCompleted — proxy: onboarding-health says
    // forcedEnterpriseSetup === false AND demographicsOptional
    // honors a saved profile.
    const onboarding = _probe('__onboardingHealth');
    const profilesCompleted = onboarding && onboarding.initialized
      ? (onboarding.forcedEnterpriseSetup === false ? accountsCreated : 0)
      : null;

    // farmsCreated — proxy: plantsAdded > 0 implies a farm/garden
    // context exists; we don't have a separate "farm_created"
    // retention event today. Report plantsAdded > 0 as 1, else 0.
    const farmsCreated = plantsAdded > 0 ? 1 : 0;

    // First-scan + first-task — boolean encoded as 0/1.
    const firstScanCompleted   = scans > 0 ? 1 : 0;
    const firstTaskCompleted   = tasksCompleted > 0 ? 1 : 0;

    const total = accountsCreated + plantsAdded + scans + tasksCompleted;
    return Object.freeze({
      runtimeVersion:     PILOT_OBSERVABILITY_RUNTIME_VERSION,
      initialized:        true,
      accountsCreated,
      profilesCompleted,
      farmsCreated,
      plantsAdded,
      firstScanCompleted,
      firstTaskCompleted,
      emptyState:         total === 0 ? EMPTY_STATE : '',
    });
  }, FROZEN_ACTIVATION_FALLBACK);
}

/* ═════════════════════════════════════════════════════════════
   2. ADOPTION FUNNEL with drop-off %
   Stage list: Signup → Farm Created → Plant Added → First Scan
              → First Task → First Completion → Follow-Up Scan
   Each stage exposes count + drop-off-from-previous percentage.
   ═════════════════════════════════════════════════════════════ */

export interface FunnelStage {
  stage:           string;
  count:           number | null;
  dropoffPercent:  number | null;  // % lost vs previous stage
}

export interface AdoptionFunnel {
  runtimeVersion:  string;
  initialized:     boolean;
  stages:          ReadonlyArray<FunnelStage>;
  emptyState:      string;
}

export function adoptionFunnel(): AdoptionFunnel {
  return _safe(() => {
    const events = readStoredEvents() || [];
    const outcomes = listOutcomes() || [];

    let scans = 0, plantsAdded = 0, tasksCompleted = 0;
    for (const e of events) {
      if (!e) continue;
      if (e.t === RETENTION_EVENT.SCAN) scans++;
      if (e.t === RETENTION_EVENT.PLANT_CREATED) plantsAdded++;
      if (e.t === RETENTION_EVENT.TASK_COMPLETED) tasksCompleted++;
    }
    const firstVisit = readFirstVisit() ? 1 : 0;
    let followUps = 0;
    for (const r of outcomes) {
      if (Array.isArray(r.scanIds) && r.scanIds.length >= 2) followUps++;
    }
    // First completion — same as tasksCompleted > 0 for the local
    // device; we surface the raw count.
    const firstCompletion = tasksCompleted;

    const stageCounts = [
      { stage: 'Signup',         count: firstVisit },
      { stage: 'Farm Created',   count: plantsAdded > 0 ? 1 : 0 },
      { stage: 'Plant Added',    count: plantsAdded },
      { stage: 'First Scan',     count: scans },
      { stage: 'First Task',     count: tasksCompleted },
      { stage: 'First Completion', count: firstCompletion },
      { stage: 'Follow-Up Scan', count: followUps },
    ];
    const stages: FunnelStage[] = [];
    let prev: number | null = null;
    let hasAny = false;
    for (const s of stageCounts) {
      const c = s.count;
      if (c > 0) hasAny = true;
      const drop = (prev == null || prev === 0)
        ? null
        : Math.max(0, Math.min(100, Math.round(((prev - c) / prev) * 100)));
      stages.push({ stage: s.stage, count: c, dropoffPercent: drop });
      prev = c;
    }
    return Object.freeze({
      runtimeVersion: PILOT_OBSERVABILITY_RUNTIME_VERSION,
      initialized:    true,
      stages:         Object.freeze(stages.map(Object.freeze)),
      emptyState:     hasAny ? '' : EMPTY_STATE,
    });
  }, Object.freeze({
    runtimeVersion: PILOT_OBSERVABILITY_RUNTIME_VERSION,
    initialized:    false,
    stages:         Object.freeze([]),
    emptyState:     EMPTY_STATE,
  }));
}

/* ═════════════════════════════════════════════════════════════
   3. SCAN SUCCESS METRICS
   Real-data: scan events as denominator; outcomes as the success
   signal. Failures/timeouts surfaced from monitoring probe when
   available, else null (honest gap).
   ═════════════════════════════════════════════════════════════ */

export interface ScanSuccessMetrics {
  runtimeVersion:        string;
  initialized:           boolean;
  totalScans:            number | null;
  successfulScans:       number | null;
  failedScans:           number | null;
  timeouts:              number | null;
  unknownPlants:         number | null;
  lowConfidenceDetections: number | null;
  successRate:           number | null;
  emptyState:            string;
}

export function scanSuccessMetrics(): ScanSuccessMetrics {
  return _safe(() => {
    const events = readStoredEvents();
    const eventsArr = Array.isArray(events) ? events : null;
    if (!eventsArr) {
      return Object.freeze({
        runtimeVersion:          PILOT_OBSERVABILITY_RUNTIME_VERSION,
        initialized:             false,
        totalScans:              null,
        successfulScans:         null,
        failedScans:             null,
        timeouts:                null,
        unknownPlants:           null,
        lowConfidenceDetections: null,
        successRate:             null,
        emptyState:              EMPTY_STATE,
      });
    }
    let totalScans = 0;
    for (const e of eventsArr) {
      if (e && e.t === RETENTION_EVENT.SCAN) totalScans++;
    }
    // successfulScans — outcome records with the same plantId
    // exist (proxy: outcomes/2 since each outcome has ≥ 1 scan).
    const outcomes = listOutcomes() || [];
    const successfulScans = Math.min(totalScans, outcomes.length);

    // failedScans / timeouts / unknownPlants / lowConfidence —
    // these only flow from a server-side monitoring source. Read
    // from __monitoringHealth.snapshot when wired; otherwise null.
    const monitoring = _probe('__monitoringHealth');
    let failedScans: number | null = null;
    let timeouts: number | null = null;
    let unknownPlants: number | null = null;
    let lowConfidenceDetections: number | null = null;
    if (monitoring && monitoring.snapshot && monitoring.snapshot.scanFailures) {
      const s = monitoring.snapshot.scanFailures;
      if (typeof s.failed === 'number') failedScans = s.failed;
      if (typeof s.timeout === 'number') timeouts = s.timeout;
      if (typeof s.unknown === 'number') unknownPlants = s.unknown;
      if (typeof s.lowConfidence === 'number') lowConfidenceDetections = s.lowConfidence;
    }

    const successRate = _pct(successfulScans, totalScans);

    return Object.freeze({
      runtimeVersion:          PILOT_OBSERVABILITY_RUNTIME_VERSION,
      initialized:             true,
      totalScans,
      successfulScans,
      failedScans,
      timeouts,
      unknownPlants,
      lowConfidenceDetections,
      successRate,
      emptyState:              totalScans === 0 ? EMPTY_STATE : '',
    });
  }, Object.freeze({
    runtimeVersion:          PILOT_OBSERVABILITY_RUNTIME_VERSION,
    initialized:             false,
    totalScans:              null,
    successfulScans:         null,
    failedScans:             null,
    timeouts:                null,
    unknownPlants:           null,
    lowConfidenceDetections: null,
    successRate:             null,
    emptyState:              EMPTY_STATE,
  }));
}

/* ═════════════════════════════════════════════════════════════
   4. PILOT ALERTS
   Honest signals — fired only when a real threshold is crossed
   on real data. Never fabricates an alert.
   ═════════════════════════════════════════════════════════════ */

export type PilotAlertSeverity = 'INFO' | 'WARN' | 'CRITICAL';

export interface PilotAlert {
  id:        string;
  severity:  PilotAlertSeverity;
  message:   string;
  source:    string;
}

export interface PilotAlerts {
  runtimeVersion: string;
  initialized:    boolean;
  alerts:         ReadonlyArray<PilotAlert>;
  total:          number;
  emptyState:     string;
}

export function pilotAlerts(): PilotAlerts {
  return _safe(() => {
    const alerts: PilotAlert[] = [];

    // High failed scans — only when monitoring reports them.
    const scan = scanSuccessMetrics();
    if (scan.totalScans != null && scan.totalScans >= 5
        && scan.failedScans != null
        && scan.totalScans > 0
        && (scan.failedScans / scan.totalScans) > 0.20) {
      alerts.push({
        id: 'high_failed_scans',
        severity: 'WARN',
        message: `${scan.failedScans} of ${scan.totalScans} scans failed (>20%)`,
        source: 'scanSuccessMetrics',
      });
    }

    // High invite failures — composed from __inviteHealth.
    const invites = _probe('__inviteHealth');
    if (invites && invites.initialized) {
      if (invites.emailProviderConfigured === false
          && invites.smsProviderConfigured === false) {
        alerts.push({
          id: 'invite_providers_unconfigured',
          severity: 'WARN',
          message: 'Both email and SMS providers are unconfigured',
          source: 'inviteHealth',
        });
      }
      if (invites.fakeDelivery === true) {
        alerts.push({
          id: 'fake_invite_delivery',
          severity: 'CRITICAL',
          message: 'Fake delivery detected — must never be true in production',
          source: 'inviteHealth',
        });
      }
    }

    // Low task completion — outcomes show many scans but few tasks.
    const events = readStoredEvents() || [];
    let scans30 = 0, tasks30 = 0;
    const nowMs = Date.now();
    for (const e of events) {
      const ms = _ms(e.iso);
      if (!Number.isFinite(ms) || (nowMs - ms) > 30 * _DAY_MS) continue;
      if (e.t === RETENTION_EVENT.SCAN) scans30++;
      if (e.t === RETENTION_EVENT.TASK_COMPLETED) tasks30++;
    }
    if (scans30 >= 10 && (tasks30 / Math.max(1, scans30)) < 0.20) {
      alerts.push({
        id: 'low_task_completion',
        severity: 'WARN',
        message: `Only ${tasks30} task(s) completed across ${scans30} scans in 30d`,
        source: 'retention.tasks30d',
      });
    }

    // Low follow-up rate.
    const outcomes = listOutcomes() || [];
    let withFollowUp = 0;
    for (const r of outcomes) {
      if (Array.isArray(r.scanIds) && r.scanIds.length >= 2) withFollowUp++;
    }
    if (outcomes.length >= 5
        && (withFollowUp / outcomes.length) < 0.20) {
      alerts.push({
        id: 'low_follow_up_rate',
        severity: 'WARN',
        message: `Only ${withFollowUp} of ${outcomes.length} outcomes have follow-up scans`,
        source: 'outcomes.followUpRate',
      });
    }

    return Object.freeze({
      runtimeVersion: PILOT_OBSERVABILITY_RUNTIME_VERSION,
      initialized:    true,
      alerts:         Object.freeze(alerts.map(Object.freeze)),
      total:          alerts.length,
      emptyState:     alerts.length === 0 ? EMPTY_STATE : '',
    });
  }, Object.freeze({
    runtimeVersion: PILOT_OBSERVABILITY_RUNTIME_VERSION,
    initialized:    false,
    alerts:         Object.freeze([]),
    total:          0,
    emptyState:     EMPTY_STATE,
  }));
}

/* ═════════════════════════════════════════════════════════════
   5. NGO COMMAND HEALTH
   Composes existing __ngoOnboardingHealth + __ngoPilotHealth
   + __inviteHealth. Surfaces org/program/field-officer/farmer
   /invite counts. NEVER fabricates a number.
   ═════════════════════════════════════════════════════════════ */

export interface NGOCommandHealth {
  runtimeVersion:        string;
  initialized:           boolean;
  organizations:         number | null;
  programs:              number | null;
  fieldOfficers:         number | null;
  farmers:               number | null;
  invitesSent:           number | null;
  invitesAccepted:       number | null;
  emptyState:            string;
}

export function ngoCommandHealth(): NGOCommandHealth {
  return _safe(() => {
    // Compose the existing probes — each may carry typed counts
    // when wired to the server-side audit summary. We read only,
    // never invent.
    const ngoOn = _probe('__ngoOnboardingHealth');
    const ngoPilot = _probe('__ngoPilotHealth');
    const invites = _probe('__inviteHealth');
    const auditH  = _probe('__auditHealth');

    // Each numeric is null unless a real probe surfaces it.
    const organizations = _safe(() => {
      if (ngoPilot && typeof ngoPilot.organizationsCount === 'number') {
        return ngoPilot.organizationsCount;
      }
      return null;
    }, null);
    const programs = _safe(() => {
      if (ngoPilot && typeof ngoPilot.programsCount === 'number') {
        return ngoPilot.programsCount;
      }
      return null;
    }, null);
    const fieldOfficers = _safe(() => {
      if (ngoPilot && typeof ngoPilot.fieldOfficersCount === 'number') {
        return ngoPilot.fieldOfficersCount;
      }
      return null;
    }, null);
    const farmers = _safe(() => {
      if (ngoPilot && typeof ngoPilot.farmersCount === 'number') {
        return ngoPilot.farmersCount;
      }
      return null;
    }, null);
    const invitesSent = _safe(() => {
      if (invites && typeof invites.invitesSent === 'number') {
        return invites.invitesSent;
      }
      if (auditH && Array.isArray(auditH.eventCoverage)) {
        const row = auditH.eventCoverage.find(
          (e: any) => e && e.action === 'invite_sent');
        if (row && typeof row.count === 'number') return row.count;
      }
      return null;
    }, null);
    const invitesAccepted = _safe(() => {
      if (invites && typeof invites.invitesAccepted === 'number') {
        return invites.invitesAccepted;
      }
      if (auditH && Array.isArray(auditH.eventCoverage)) {
        const row = auditH.eventCoverage.find(
          (e: any) => e && e.action === 'invite_accepted');
        if (row && typeof row.count === 'number') return row.count;
      }
      return null;
    }, null);

    const allNull = [organizations, programs, fieldOfficers, farmers,
                     invitesSent, invitesAccepted]
      .every((v) => v == null);

    return Object.freeze({
      runtimeVersion:  PILOT_OBSERVABILITY_RUNTIME_VERSION,
      initialized:     true,
      organizations,
      programs,
      fieldOfficers,
      farmers,
      invitesSent,
      invitesAccepted,
      // Surface upstream readiness flags for the UI footer.
      onboardingReady: !!(ngoOn && ngoOn.initialized),
      pilotReady:      !!(ngoPilot && ngoPilot.pilotReady),
      emptyState:      allNull ? EMPTY_STATE : '',
    } as any);
  }, Object.freeze({
    runtimeVersion:  PILOT_OBSERVABILITY_RUNTIME_VERSION,
    initialized:     false,
    organizations:   null,
    programs:        null,
    fieldOfficers:   null,
    farmers:         null,
    invitesSent:     null,
    invitesAccepted: null,
    emptyState:      EMPTY_STATE,
  }));
}

/* ═════════════════════════════════════════════════════════════
   6. COMPOSITE PILOT HEALTH
   Wave-38 envelope shape:
     {adoptionReady, retentionReady, ngoReady, scanReady,
      observabilityReady}
   ═════════════════════════════════════════════════════════════ */

export interface PilotHealth {
  runtimeVersion:       string;
  initialized:          boolean;
  adoptionReady:        boolean;
  retentionReady:       boolean;
  ngoReady:             boolean;
  scanReady:            boolean;
  observabilityReady:   boolean;
}

export function pilotHealth(): PilotHealth {
  return _safe(() => {
    const act = activationHealth();
    const ret = _probe('__retentionHealth');
    const ngo = ngoCommandHealth();
    const scan = scanSuccessMetrics();

    // adoptionReady — activation probe initialised AND at least
    // one stage has data. We never claim adoption from no data.
    const funnel = adoptionFunnel();
    const adoptionReady =
         !!act
      && act.initialized === true
      && Array.isArray(funnel.stages)
      && funnel.stages.some((s) => (s.count || 0) > 0);

    const retentionReady =
         !!ret
      && ret.retentionReady === true
      && ret.initialized !== false;
    const ngoReady =
         !!ngo
      && ngo.initialized === true;
    const scanReady =
         !!scan
      && scan.initialized === true;
    const observabilityReady =
         !!act && !!ret && !!ngo && !!scan;

    return Object.freeze({
      runtimeVersion:      PILOT_OBSERVABILITY_RUNTIME_VERSION,
      initialized:         true,
      adoptionReady,
      retentionReady,
      ngoReady,
      scanReady,
      observabilityReady,
    });
  }, Object.freeze({
    runtimeVersion:      PILOT_OBSERVABILITY_RUNTIME_VERSION,
    initialized:         false,
    adoptionReady:       false,
    retentionReady:      false,
    ngoReady:            false,
    scanReady:           false,
    observabilityReady:  false,
  }));
}

/* ═════════════════════════════════════════════════════════════
   GLOBAL INSTALLERS
   ═════════════════════════════════════════════════════════════ */

function _pin(name: string, fn: () => any) {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w[name] !== 'function') {
      w[name] = function () {
        const out = fn();
        try { console.log(`[Farroway · Pilot Observability] ${name}`, out); }
        catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}

export function installPilotObservabilityGlobals(): boolean {
  let ok = true;
  ok = _pin('__activationHealth',     activationHealth)     && ok;
  ok = _pin('__adoptionFunnel',       adoptionFunnel)       && ok;
  ok = _pin('__scanSuccessMetrics',   scanSuccessMetrics)   && ok;
  ok = _pin('__pilotAlerts',          pilotAlerts)          && ok;
  ok = _pin('__ngoCommandHealth',     ngoCommandHealth)     && ok;
  ok = _pin('__pilotHealth',          pilotHealth)          && ok;
  return ok;
}
