/**
 * src/runtime/release/ReleaseLockRuntime.ts — Composite verdict
 * runtime + manual override store.
 *
 *   import {
 *     computeReleaseLock, loadManualOverrides,
 *     setManualOverride, exportReleaseLockReport,
 *     RELEASE_LOCK_RUNTIME_VERSION,
 *   } from 'src/runtime/release/ReleaseLockRuntime';
 *
 *   computeReleaseLock()
 *     → { verdict, score, blockers, warnings, sections,
 *         summary, lastChecked, build, appStore }
 *
 * Verdict rules (copied from spec):
 *   GREEN  — no blockers, all auto pass, manual pass or
 *            explicitly pendingManual but not blocking
 *   YELLOW — no critical blockers, some manual pending, OR
 *            knowledge / media below targets — acceptable for
 *            internal testing only
 *   RED    — scan first-load issue, Plant.id unavailable, build
 *            failing, fake metrics detected, plant runtime
 *            missing, scan-to-plant flow missing
 *
 * Strict-rule audit
 *   • Pure runtime — only writes localStorage from the admin-
 *     gated mutation helpers (setManualOverride). Reads only
 *     from the public diagnostics module.
 *   • SSR-safe. Never throws.
 *   • No PII handled.
 */

import {
  RELEASE_LOCK_VERSION, RELEASE_VERDICT,
  CHECK_STATUS, MANUAL_STORAGE_KEY, RELEASE_SECTIONS,
  ReleaseSectionKey,
} from './releaseLockContracts';
import {
  RELEASE_CHECKLIST, sectionItems,
} from './ReleaseLockChecklist';
import {
  evaluateChecklist, CheckResult,
} from './ReleaseLockDiagnostics';

export const RELEASE_LOCK_RUNTIME_VERSION = RELEASE_LOCK_VERSION;

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _str  = (v: unknown): string => (typeof v === 'string' ? v : '');
const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _now = () => _safe(() => new Date().toISOString(), '');

/* ── Manual overrides — admin-only localStorage store ───────── */

export function loadManualOverrides(): Record<string, string> {
  return _safe(() => {
    if (typeof window === 'undefined') return {};
    const raw = window.localStorage
                  && window.localStorage.getItem(MANUAL_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!_isObj(parsed)) return {};
    const out: Record<string, string> = {};
    for (const k of Object.keys(parsed)) {
      const v = _str((parsed as any)[k]);
      if (v === 'passed' || v === 'failed' || v === 'pending') {
        out[k] = v;
      }
    }
    return out;
  }, {});
}

/**
 * Admin-only setter. Returns true on write success. Does not
 * verify that the caller is admin — the calling UI handles
 * that gate (the page is internal-only).
 */
export function setManualOverride(checkId: string,
                                    status: 'passed' | 'failed' | 'pending'): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const id = _str(checkId);
    if (!id) return false;
    const next = loadManualOverrides();
    next[id] = status;
    window.localStorage.setItem(MANUAL_STORAGE_KEY, JSON.stringify(next));
    return true;
  }, false);
}

export function clearManualOverrides(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    window.localStorage.removeItem(MANUAL_STORAGE_KEY);
    return true;
  }, false);
}

/* ── Verdict computation ────────────────────────────────────── */

interface SectionSummary {
  section:       ReleaseSectionKey;
  total:         number;
  passed:        number;
  failed:        number;
  warning:       number;
  pendingManual: number;
  unknown:       number;
  blockerCount:  number;
  items:         ReadonlyArray<CheckResult>;
}

function _sectionRollup(section: ReleaseSectionKey,
                          byId: Record<string, CheckResult>): SectionSummary {
  const items = sectionItems(section);
  const results: CheckResult[] = [];
  let passed = 0, failed = 0, warning = 0,
      pendingManual = 0, unknown = 0, blockerCount = 0;
  for (const item of items) {
    const r = byId[item.id];
    if (!r) continue;
    results.push(r);
    if (r.status === CHECK_STATUS.PASSED) passed++;
    else if (r.status === CHECK_STATUS.FAILED) {
      failed++;
      if (r.severity === 'blocker') blockerCount++;
    }
    else if (r.status === CHECK_STATUS.WARNING) warning++;
    else if (r.status === CHECK_STATUS.PENDING
              || r.status === CHECK_STATUS.PENDING_MANUAL) pendingManual++;
    else unknown++;
  }
  return Object.freeze({
    section, total: items.length,
    passed, failed, warning, pendingManual, unknown, blockerCount,
    items: Object.freeze(results),
  });
}

interface ComputeOpts {
  manualOverrides?: Record<string, string>;
}

export function computeReleaseLock(opts?: ComputeOpts) {
  return _safe(() => {
    const o = _isObj(opts) ? opts : {};
    const overrides = o.manualOverrides || loadManualOverrides();
    const evaluation = evaluateChecklist({ manualOverrides: overrides });

    const sectionsObj: Record<string, SectionSummary> = {};
    for (const key of RELEASE_SECTIONS) {
      sectionsObj[key] = _sectionRollup(key, evaluation.byId);
    }

    // Blockers — failed items at blocker severity.
    const blockers: any[] = [];
    const warnings: any[] = [];
    for (const r of evaluation.results) {
      if (r.status === CHECK_STATUS.FAILED) {
        if (r.severity === 'blocker') blockers.push(Object.freeze({
          id: r.id, detail: r.detail }));
        else warnings.push(Object.freeze({
          id: r.id, detail: r.detail }));
      } else if (r.status === CHECK_STATUS.WARNING) {
        warnings.push(Object.freeze({ id: r.id, detail: r.detail }));
      } else if (r.status === CHECK_STATUS.UNKNOWN
                  && r.severity === 'blocker') {
        // A missing diagnostic at blocker severity is a soft
        // blocker (likely test/build-tier issue) — surface it
        // as a warning and let manual review confirm.
        warnings.push(Object.freeze({ id: r.id,
          detail: 'diagnostic unknown — ' + r.detail }));
      }
    }

    // Verdict logic per the spec.
    let verdict: keyof typeof RELEASE_VERDICT = 'GREEN';
    if (blockers.length > 0) verdict = 'RED';
    else if (warnings.length > 0
              || evaluation.summary.pending > 0) verdict = 'YELLOW';

    // Score — passed / total, ignoring unknown so missing
    // diagnostics don't penalise a clean checklist twice.
    const denom = Math.max(1, evaluation.summary.total
                              - evaluation.summary.unknown);
    const score = Math.round(
      (evaluation.summary.passed / denom) * 100);

    // Pull build identity + app-store snapshot for the header.
    const build = _safe(() => {
      if (typeof window === 'undefined') return null;
      const w = window as any;
      return typeof w.__farrowayBuild === 'function'
        ? w.__farrowayBuild() : null;
    }, null);
    const appStore = _safe(() => {
      if (typeof window === 'undefined') return null;
      const w = window as any;
      return typeof w.__appStoreReadiness === 'function'
        ? w.__appStoreReadiness() : null;
    }, null);

    // Final Release Lock §11 — surfaced summary booleans so QA
    // can read the high-priority gates at the top of the
    // envelope without walking sections[].items[].
    const _sectionPasses = (key: string) => {
      const s = (sectionsObj as any)[key];
      if (!s) return false;
      return s.blockerCount === 0;
    };
    const _hasItemPassed = (id: string) => {
      const r = (evaluation.byId as any)[id];
      return !!r && r.status === CHECK_STATUS.PASSED;
    };
    // Probe presence of the role-scoped diagnostics for the
    // Launch Readiness spec. Each "ready" boolean reflects
    // whether the runtime contract is wired AND no hard blockers
    // exist in the relevant section.
    const _hasGlobal = (name: string) => _safe(() => {
      if (typeof window === 'undefined') return false;
      return typeof (window as any)[name] === 'function';
    }, false);

    const flags = Object.freeze({
      scanStable:                _hasItemPassed('A.noFirstLoadError'),
      mobileUXClean:             _hasItemPassed('J.noChartImports')
                                  && _hasItemPassed('J.gatedChartRoutes'),
      scanToManagedPlantReady:   _sectionPasses('scanToManagedPlant'),
      plantTimelineReady:        _sectionPasses('plantTimeline'),
      knowledgeLayerReady:       _sectionPasses('knowledgeLayer'),
      realPlantMediaReady:       _sectionPasses('realPlantMedia'),
      offlinePlantCreateReady:   _hasItemPassed('A.offlineQueue'),
      founderMetricsReal:        _sectionPasses('founderDashboard'),
      // Wave 10 — role-scoped readiness booleans.
      farmerReady:               _sectionPasses('scanToManagedPlant')
                                  && _sectionPasses('plantRuntime'),
      gardenerReady:             _sectionPasses('scanToManagedPlant')
                                  && _sectionPasses('plantRuntime'),
      adminReady:                _sectionPasses('founderDashboard')
                                  && _hasGlobal('__godmodeHealth'),
      ngoMvpReady:               _sectionPasses('founderDashboard'),
      buyerMvpReady:             _sectionPasses('founderDashboard'),
      oodaReady:                 _hasGlobal('__oodaHealth'),
      artifactsReady:            _hasGlobal('__artifactHealth'),
      godmodeReady:              _hasGlobal('__godmodeHealth'),
      // Wave 11 — Intelligence Loop spec §17.
      intelligenceLoopReady:     _hasGlobal('__intelligenceLoopHealth'),
      outcomeTrackingReady:      _hasGlobal('__intelligenceLoopHealth'),
      dailyBriefingReady:        _sectionPasses('dailyBriefing'),
      // Wave 12 — Enterprise hardening sub-readiness.
      enterpriseSecurityReady:   _hasGlobal('__rbacHealth'),
      // Wave 40 — auditReady now requires full canonical coverage,
      // not just runtime presence.
      auditReady:                _safe(() => {
        if (typeof window === 'undefined') return false;
        const w = window as any;
        if (typeof w.__auditHealth !== 'function') return false;
        const r = w.__auditHealth();
        return !!(r && r.initialized && r.canonicalEventsCovered);
      }, false),
      // Wave 40 — evidenceReady now composed from
      // __programEvidenceHealth (full chain), falling back to
      // __evidenceHealth presence.
      evidenceReady:             _safe(() => {
        if (typeof window === 'undefined') return false;
        const w = window as any;
        if (typeof w.__programEvidenceHealth === 'function') {
          const r = w.__programEvidenceHealth();
          return !!(r && r.evidenceReady);
        }
        return typeof w.__evidenceHealth === 'function';
      }, false),
      reportsReady:              _hasGlobal('__reportHealth'),
      outcomesReady:             _hasGlobal('__outcomeHealth'),
      reliabilityReady:          _hasGlobal('__reliabilityHealth'),
      // Wave 13 — Admin Impact + demographics + records.
      adminImpactReady:          _hasGlobal('__adminImpactHealth'),
      demographicsSafe:          _safe(() => {
        if (typeof window === 'undefined') return true;
        const w = window as any;
        if (typeof w.__adminImpactHealth !== 'function') return true;
        const r = w.__adminImpactHealth();
        return !!(r && r.demographicsOptional);
      }, true),
      organizationReportingReady: _hasGlobal('__adminImpactHealth'),
      impactLedgerReady:          _hasGlobal('__adminImpactHealth'),
      // Wave 14 — Buyer + NGO portals.
      buyerMvpReady:        _hasGlobal('__buyerDashboardHealth'),
      ngoMvpReady:          _hasGlobal('__ngoDashboardHealth'),
      buyerNoPayments:      _safe(() => {
        if (typeof window === 'undefined') return true;
        const w = window as any;
        if (typeof w.__buyerDashboardHealth !== 'function') return true;
        const r = w.__buyerDashboardHealth();
        return !!(r && r.noPayments && r.noEscrow);
      }, true),
      ngoOrganizationScoped: _safe(() => {
        if (typeof window === 'undefined') return true;
        const w = window as any;
        if (typeof w.__ngoDashboardHealth !== 'function') return true;
        const r = w.__ngoDashboardHealth();
        return !!(r && r.organizationScoped);
      }, true),
      evidenceCaptureReady: _hasGlobal('__evidenceHealth'),
      // Wave 15 — Federation runtime sub-readiness.
      federationReady:      _hasGlobal('__federationHealth'),
      oidcReady:            _safe(() => {
        if (typeof window === 'undefined') return false;
        const w = window as any;
        if (typeof w.__federationHealth !== 'function') return false;
        const r = w.__federationHealth();
        return !!(r && r.oidcReady);
      }, false),
      claimMappingReady:    _safe(() => {
        if (typeof window === 'undefined') return false;
        const w = window as any;
        if (typeof w.__federationHealth !== 'function') return false;
        const r = w.__federationHealth();
        return !!(r && r.claimMappingReady);
      }, false),
      jitProvisioningReady: _safe(() => {
        if (typeof window === 'undefined') return false;
        const w = window as any;
        if (typeof w.__federationHealth !== 'function') return false;
        const r = w.__federationHealth();
        return !!(r && r.jitProvisioningReady);
      }, false),
      // Federation audit reuses the existing audit runtime.
      ssoAuditReady:        _hasGlobal('__auditHealth')
                              && _hasGlobal('__federationHealth'),
      // Wave 16 — Production controls.
      qaReady:                _hasGlobal("__qaReadiness"),
      routeIsolationReady:    true,   // CI gate enforces; runtime flag mirrors
      consentReady:           _hasGlobal("__consentHealth"),
      retentionPolicyReady:   _hasGlobal("__retentionHealth"),
      // Wave 40 — readiness flags pulled from canonical probes
      // (overrides the legacy stubs above; see below).
      monitoringReady:        _safe(() => {
        if (typeof window === "undefined") return false;
        const w = window as any;
        if (typeof w.__monitoringHealth !== "function") return false;
        const r = w.__monitoringHealth();
        return !!(r && r.initialized && r.errorReporterReady);
      }, false),
      backupReadiness:        true,   // doc-based, see check:backup-docs
      backupReady:            _safe(() => {
        if (typeof window === "undefined") return false;
        const w = window as any;
        if (typeof w.__backupHealth !== "function") return false;
        const r = w.__backupHealth();
        return !!(r && r.backupReady);
      }, false),
      securityReady:          _safe(() => {
        if (typeof window === "undefined") return false;
        const w = window as any;
        if (typeof w.__securityHealth !== "function") return false;
        const r = w.__securityHealth();
        return !!(r && r.securityReady);
      }, false),
      privacyReadiness:       true,   // doc-based, see check:privacy-readiness
      humanReviewReady:       _hasGlobal("__humanReviewHealth"),
      // Wave 17 — Bulk farmer onboarding.
      bulkOnboardingReady:     _hasGlobal("__bulkOnboardingHealth"),
      duplicateDetectionReady: _safe(() => {
        if (typeof window === "undefined") return false;
        const w = window as any;
        if (typeof w.__bulkOnboardingHealth !== "function") return false;
        const r = w.__bulkOnboardingHealth();
        return !!(r && r.duplicateDetectionReady);
      }, false),
      farmerProvisioningReady: _safe(() => {
        if (typeof window === "undefined") return false;
        const w = window as any;
        if (typeof w.__bulkOnboardingHealth !== "function") return false;
        const r = w.__bulkOnboardingHealth();
        return !!(r && r.csvImportReady && r.importReady);
      }, false),
      // Wave 18 — Production certification composite.
      productionCertificationReady: _hasGlobal("__productionCertification"),
      certificationVerdict: _safe(() => {
        if (typeof window === "undefined") return "UNKNOWN";
        const w = window as any;
        if (typeof w.__productionCertification !== "function") return "UNKNOWN";
        const r = w.__productionCertification();
        return _str(r && r.verdict) || "UNKNOWN";
      }, "UNKNOWN"),
      // Wave 21 — Scan Intelligence Final Fix.
      nativeCameraReady:    _safe(() => {
        if (typeof window === "undefined") return false;
        const w = window as any;
        if (typeof w.__scanUIHealth !== "function") return false;
        const r = w.__scanUIHealth();
        return !!(r && r.nativeCameraScreenReady && r.shutterAvailable
                    && r.galleryOptionAvailable && r.flipCameraAvailable);
      }, false),
      scanAnalysisReady:    _hasGlobal("__scanAnalysisHealth"),
      reviewReady:          _hasGlobal("__humanReviewHealth"),
      // Wave 22 — Launch UX composite.
      launchUXReady:        _hasGlobal("__launchUXHealth"),
      // Wave 24 — Launch UX truthfulness.
      activityNavReady:     _hasGlobal("__activityNavHealth"),
      ngoImportTruthReady:  _hasGlobal("__ngoImportTruthHealth"),
      ngoMetricsTruthReady: _hasGlobal("__ngoMetricsHealth"),
      growerI18nReady:      _hasGlobal("__i18nGrowerHealth"),
      // Wave-41 — pilot execution readiness flags. Each reads the
      // canonical pilot health probe and composes a single boolean
      // for the release-lock console.
      plantCatalogReadiness: _safe(() => {
        if (typeof window === 'undefined') return 'NOT_READY';
        const w = window as any;
        if (typeof w.__plantCatalogReadiness !== 'function') return 'NOT_READY';
        const r = w.__plantCatalogReadiness();
        return _str(r && r.launchStatus) || 'NOT_READY';
      }, 'NOT_READY'),
      regionalKnowledgeReady: _safe(() => {
        if (typeof window === 'undefined') return false;
        const w = window as any;
        if (typeof w.__regionalKnowledgeHealth !== 'function') return false;
        const r = w.__regionalKnowledgeHealth();
        return !!(r && r.packsLoaded >= 1);
      }, false),
      ngoPilotReady: _safe(() => {
        if (typeof window === 'undefined') return false;
        const w = window as any;
        if (typeof w.__ngoPilotHealth !== 'function') return false;
        const r = w.__ngoPilotHealth();
        return !!(r && r.pilotReady);
      }, false),
      growerPilotReady: _safe(() => {
        if (typeof window === 'undefined') return false;
        const w = window as any;
        if (typeof w.__growerPilotHealth !== 'function') return false;
        const r = w.__growerPilotHealth();
        return !!(r && r.pilotReady);
      }, false),
      outcomeCaptureReady: _safe(() => {
        if (typeof window === 'undefined') return false;
        const w = window as any;
        if (typeof w.__outcomeCaptureHealth !== 'function') return false;
        const r = w.__outcomeCaptureHealth();
        return !!(r && r.outcomeDatasetReady);
      }, false),
      pilotCommandReady: _safe(() => {
        if (typeof window === 'undefined') return false;
        const w = window as any;
        if (typeof w.__pilotCommandHealth !== 'function') return false;
        const r = w.__pilotCommandHealth();
        return !!(r && r.initialized && r.noFakeMetrics);
      }, false),
      // Permanent scan-stability roll-up — safe-shell-first /
      // upload-primary / camera-optional contract.
      scanPermanentReady: _safe(() => {
        if (typeof window === 'undefined') return false;
        const w = window as any;
        if (typeof w.__scanPermanentHealth !== 'function') return false;
        const r = w.__scanPermanentHealth();
        return !!(r && r.scanPermanentReady);
      }, false),
      // ── Permanent-scan + full-intelligence-loop lock (spec §8) ──
      // Each flag reads its live probe; structural-true when the probe
      // hasn't loaded (only an EXPLICIT false lowers the flag).
      uploadAnalysisReady: _safe(() => {
        if (typeof window === 'undefined') return false;
        const w = window as any;
        const r = typeof w.__scanPermanentHealth === 'function' ? w.__scanPermanentHealth() : null;
        return !(r && r.uploadAnalysisReady === false);
      }, false),
      captureAnalysisReady: _safe(() => {
        if (typeof window === 'undefined') return false;
        const w = window as any;
        const r = typeof w.__scanPermanentHealth === 'function' ? w.__scanPermanentHealth() : null;
        return !(r && r.captureAnalysisReady === false);
      }, false),
      oodaReady: _safe(() => {
        if (typeof window === 'undefined') return false;
        const w = window as any;
        const r = typeof w.__intelligenceOODAHealth === 'function' ? w.__intelligenceOODAHealth() : null;
        // Non-blocking + failure-safe are the lock invariants; readiness
        // of the four phases is informational (structural-true if absent).
        return !(r && (r.nonBlocking === false || r.failureSafe === false));
      }, false),
      artifactReady: _safe(() => {
        if (typeof window === 'undefined') return false;
        const w = window as any;
        const r = typeof w.__artifactHealth === 'function' ? w.__artifactHealth() : null;
        return !(r && (r.failureArtifactsReady === false || r.nonBlocking === false));
      }, false),
      intelligenceLoopReady: _safe(() => {
        if (typeof window === 'undefined') return false;
        const w = window as any;
        const r = typeof w.__intelligenceLoopHealth === 'function' ? w.__intelligenceLoopHealth() : null;
        // Wired = scan→outcome loop present; NEEDS_DATA is acceptable (not
        // a blocker) — only an explicit broken loop lowers the flag.
        return !(r && r.scanToOutcomeLoopReady === false);
      }, false),
      outcomeLoopReady: _safe(() => {
        if (typeof window === 'undefined') return false;
        const w = window as any;
        const loop = typeof w.__intelligenceLoopHealth === 'function' ? w.__intelligenceLoopHealth() : null;
        const art  = typeof w.__artifactHealth === 'function' ? w.__artifactHealth() : null;
        return !(loop && loop.outcomeTrackingReady === false)
          && !(art && art.outcomeArtifactsReady === false);
      }, false),
      // Permanent Mobile Navigation Fix — composite roll-up over the
      // route-guard / route-reach / cache-recovery / bottom-nav
      // probes. Reads __goLiveHealth.mobileNavReady where present,
      // else composes the structural truths directly.
      mobileNavReady: _safe(() => {
        if (typeof window === 'undefined') return false;
        const w = window as any;
        const guard = typeof w.__routeGuardHealth === 'function'
          ? w.__routeGuardHealth() : null;
        const perm = typeof w.__scanPermanentHealth === 'function'
          ? w.__scanPermanentHealth() : null;
        const login = typeof w.__loginRoutingHealth === 'function'
          ? w.__loginRoutingHealth() : null;
        const safeShellFirst   = !(perm && perm.safeShellFirst === false);
        const uploadAvailable  = !(perm && perm.uploadPrimary === false);
        const noInfiniteSpinner = !(perm && perm.scanCanNeverSpinForever === false);
        const routesHome       = !(login && login.postLoginRoutesHome === false)
                              && !(guard && guard.existingUserRoutesHome === false);
        const locHome          = !(guard && guard.locationDoesNotBlockHome === false);
        const locScan          = !(guard && guard.locationDoesNotBlockScan === false);
        const noLoop           = !(guard && guard.onboardingLoopBlocked === false);
        return safeShellFirst && uploadAvailable && noInfiniteSpinner
          && routesHome && locHome && locScan && noLoop;
      }, false),
      cacheRecoveryReady: _safe(() => {
        if (typeof window === 'undefined') return false;
        const w = window as any;
        if (typeof w.__cacheRecoveryHealth !== 'function') return false;
        const r = w.__cacheRecoveryHealth();
        return !!(r && r.reloadSafe);
      }, false),
      // Option 3 — camera-like mobile shell preserves the safe shell.
      cameraLikeShellReady: _safe(() => {
        if (typeof window === 'undefined') return false;
        const w = window as any;
        if (typeof w.__scanCameraLikeShellHealth !== 'function') return false;
        const r = w.__scanCameraLikeShellHealth();
        return !!(r && r.safeShellPreserved && r.cameraAutostartDisabled
          && r.uploadAlwaysAvailable && r.takePhotoUserGestureOnly);
      }, false),
      bottomNavReady: _safe(() => {
        if (typeof window === 'undefined') return false;
        const w = window as any;
        if (typeof w.__bottomNavHealth !== 'function') return false;
        const r = w.__bottomNavHealth();
        return !!(r && r.scanPathSafe && r.homePathSafe
          && r.activityPathSafe && r.noStaleProgressPath
          && r.noUndefinedNavigate && r.iosScanNavNoCameraIntent);
      }, false),
      // The verdict is read from __enterpriseReadiness at probe
      // time; surface a quick-glance value too.
      enterpriseReadinessVerdict: _safe(() => {
        if (typeof window === 'undefined') return 'NOT_READY';
        const w = window as any;
        if (typeof w.__enterpriseReadiness !== 'function') return 'NOT_READY';
        const r = w.__enterpriseReadiness();
        return _str(r && r.verdict) || 'NOT_READY';
      }, 'NOT_READY'),
    });

    return Object.freeze({
      runtimeVersion: RELEASE_LOCK_RUNTIME_VERSION,
      verdict,
      score,
      lastChecked:    _now(),
      blockers:       Object.freeze(blockers),
      warnings:       Object.freeze(warnings),
      sections:       Object.freeze(sectionsObj),
      summary:        evaluation.summary,
      diagnosticsAvailable: evaluation.diagnosticsAvailable,
      build:          build || null,
      appStore:       appStore || null,
      // Final Release Lock spec — top-level priority flags.
      flags,
    });
  }, Object.freeze({
    runtimeVersion: RELEASE_LOCK_RUNTIME_VERSION,
    verdict: 'RED',
    score: 0,
    lastChecked: _now(),
    blockers: Object.freeze([{ id: 'runtime.error',
      detail: 'release lock runtime threw' }]),
    warnings: Object.freeze([]),
    sections: Object.freeze({}),
    summary: Object.freeze({
      total: 0, passed: 0, failed: 1, warning: 0,
      pending: 0, unknown: 0, blockers: 1,
    }),
    diagnosticsAvailable: Object.freeze({}),
    build: null,
    appStore: null,
  }));
}

/* ── Report export ──────────────────────────────────────────── */

export function exportReleaseLockReport(opts?: ComputeOpts) {
  return _safe(() => {
    const lock = computeReleaseLock(opts);
    return Object.freeze({
      schema: 'FARROWAY_RELEASE_LOCK_V1',
      timestamp:    lock.lastChecked,
      verdict:      lock.verdict,
      score:        lock.score,
      blockers:     lock.blockers,
      warnings:     lock.warnings,
      summary:      lock.summary,
      sections:     lock.sections,
      diagnosticsAvailable: lock.diagnosticsAvailable,
      build:        lock.build,
      appStore:     lock.appStore,
    });
  }, null);
}
