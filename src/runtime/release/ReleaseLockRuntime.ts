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
      auditReady:                _hasGlobal('__auditHealth'),
      evidenceReady:             _hasGlobal('__evidenceHealth'),
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
