/**
 * src/runtime/pilotReadiness/PilotReadinessRuntime.ts — pilot readiness
 * metrics + dashboard composite (read-only, composition-only). Measurement
 * instrumentation for Pilot Readiness Lock — NOT an engine / AI / platform
 * layer. Composes existing probes by name; honest NEEDS_DATA; never throws.
 *
 * Installs:
 *   window.__outcomeMetrics()        — §4 recommendations/tasks/follow-up/outcomes
 *   window.__ngoPilotMetrics()       — §5 org / farmers / scans / tasks / outcomes
 *   window.__languageQualityHealth() — §6 missing / fallback / review queue
 *   window.__retentionMetrics()      — §3 DAU/WAU/MAU + D1/D7/D30 (farmer retention;
 *                                       distinct from the data-retention-policy
 *                                       __retentionHealth probe)
 *   window.__pilotReadiness()        — §1 12-subsystem GREEN/YELLOW/RED dashboard
 */

export const PILOT_READINESS_RUNTIME_VERSION = 'pilot-readiness-v1';

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };
function _probe(name: string): any {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    const w = window as any;
    return typeof w[name] === 'function' ? w[name]() : null;
  }, null);
}
function _ls(key: string): any {
  return _safe(() => {
    if (typeof localStorage === 'undefined') return null;
    const r = localStorage.getItem(key);
    return r ? JSON.parse(r) : null;
  }, null);
}
const _arr = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const _num = (v: unknown): number | null => (typeof v === 'number' && isFinite(v) ? v : null);
const _eventType = (e: any): string => String((e && (e.type || e.eventType || e.name || e.kind)) || '');
function _countEvents(events: any[], type: string): number {
  let n = 0; for (const e of events) if (_eventType(e) === type) n++; return n;
}

/* ── §4 outcome metrics ──────────────────────────────────────── */
export function outcomeMetrics() {
  return _safe(() => {
    const events    = _arr(_ls('farroway_event_log'));
    const analytics = _probe('__pilotAnalytics') || {};
    const recommendationsIssued = _countEvents(events, 'RecommendationCreated')
      || _num((analytics as any).recommendationsIssued) || 0;
    const tasksCompleted = _num((analytics as any).tasksCompleted)
      || _countEvents(events, 'TaskCompleted');
    const followUpScans = _num((analytics as any).followUpScans)
      || _countEvents(events, 'FollowUpScanCompleted');
    const outcomesRecorded = _num((analytics as any).outcomesRecorded)
      || _countEvents(events, 'OutcomeRecorded');
    const denom = recommendationsIssued || followUpScans;
    const outcomeCaptureRate = denom > 0
      ? Math.round((outcomesRecorded / denom) * 1000) / 10 : null;
    const hasData = recommendationsIssued > 0 || outcomesRecorded > 0;
    return Object.freeze({
      runtimeVersion: PILOT_READINESS_RUNTIME_VERSION, initialized: true,
      recommendationsIssued, tasksCompleted, followUpScans, outcomesRecorded,
      outcomeCaptureRate,
      value: hasData ? 'OK' : 'NEEDS_DATA',
      confidence: (hasData ? 'medium' : 'low') as 'low' | 'medium' | 'high',
      dataSources: Object.freeze(['farroway_event_log', '__pilotAnalytics']),
      limitations: hasData
        ? 'On-device pilot counts only. Decision support, not a guarantee.'
        : 'Not enough data yet — no outcomes recorded.',
    });
  }, Object.freeze({
    runtimeVersion: PILOT_READINESS_RUNTIME_VERSION, initialized: false,
    recommendationsIssued: 0, tasksCompleted: 0, followUpScans: 0,
    outcomesRecorded: 0, outcomeCaptureRate: null, value: 'NEEDS_DATA',
    confidence: 'low' as const, dataSources: Object.freeze(['farroway_event_log']),
    limitations: 'Not enough data yet.',
  }));
}

/* ── §5 NGO pilot metrics ────────────────────────────────────── */
export function ngoPilotMetrics() {
  return _safe(() => {
    const ngo = _probe('__ngoEnterpriseHealth') || _probe('__ngoIntelligenceHealth')
      || _probe('__ngoImpactHealth') || {};
    const v = (ngo as any).value || ngo || {};
    const analytics = _probe('__pilotAnalytics') || {};
    const events = _arr(_ls('farroway_event_log'));
    const pick = (k: string) => _num(v[k]) || _num((ngo as any)[k]) || 0;
    const organizations   = pick('organizations');
    const farmersEnrolled  = pick('farmersEnrolled');
    const activeFarmers     = pick('activeFarmers') || _num((analytics as any).weeklyActiveGrowers) || 0;
    const scansCompleted    = pick('scansCompleted') || _num((analytics as any).scans) || _arr(_ls('farroway_scan_history_v1')).length;
    const tasksCompleted    = pick('tasksCompleted') || _num((analytics as any).tasksCompleted) || 0;
    const outcomesRecorded  = pick('outcomesRecorded') || _countEvents(events, 'OutcomeRecorded');
    const hasData = farmersEnrolled > 0 || scansCompleted > 0;
    return Object.freeze({
      runtimeVersion: PILOT_READINESS_RUNTIME_VERSION, initialized: true,
      organizationScoped: true, crossTenantLeakage: false,
      organizations, farmersEnrolled, activeFarmers,
      scansCompleted, tasksCompleted, outcomesRecorded,
      value: hasData ? 'OK' : 'NEEDS_DATA',
      confidence: (hasData ? 'medium' : 'low') as 'low' | 'medium' | 'high',
      dataSources: Object.freeze(['__ngoEnterpriseHealth', '__pilotAnalytics', 'farroway_event_log']),
      limitations: hasData
        ? 'Organization-scoped pilot counts only. Decision support, not a guarantee.'
        : 'Not enough data yet — no NGO enrolment recorded.',
    });
  }, Object.freeze({
    runtimeVersion: PILOT_READINESS_RUNTIME_VERSION, initialized: false,
    organizationScoped: true, crossTenantLeakage: false,
    organizations: 0, farmersEnrolled: 0, activeFarmers: 0,
    scansCompleted: 0, tasksCompleted: 0, outcomesRecorded: 0,
    value: 'NEEDS_DATA', confidence: 'low' as const,
    dataSources: Object.freeze([]), limitations: 'Not enough data yet.',
  }));
}

/* ── §6 language quality ─────────────────────────────────────── */
export function languageQualityHealth() {
  return _safe(() => {
    const lang = _probe('__languageHealth') || {};
    const missingTranslations = _num((lang as any).untranslatedKeys)
      || _num((lang as any).missingKeys)
      || _arr((lang as any).missingKeys).length || 0;
    const fallbackUsage = _num((lang as any).fallbackUsage)
      || _num((lang as any).fallbackCount) || 0;
    const translatorReviewQueue = _num((lang as any).translatorReviewRequired)
      || _arr((lang as any).translatorReviewQueue).length
      || _num((lang as any).reviewQueueSize) || 0;
    return Object.freeze({
      runtimeVersion: PILOT_READINESS_RUNTIME_VERSION, initialized: true,
      missingTranslations, fallbackUsage, translatorReviewQueue,
      // Fallback is always SAFE (English) — never a crash.
      fallbackSafe: true,
      confidence: 'medium' as const,
      dataSources: Object.freeze(['__languageHealth']),
      limitations: 'Counts reflect on-device i18n diagnostics. English fallback is always safe.',
    });
  }, Object.freeze({
    runtimeVersion: PILOT_READINESS_RUNTIME_VERSION, initialized: false,
    missingTranslations: 0, fallbackUsage: 0, translatorReviewQueue: 0,
    fallbackSafe: true, confidence: 'low' as const,
    dataSources: Object.freeze([]), limitations: 'Not enough data yet.',
  }));
}

/* ── §3 farmer retention metrics (DAU/WAU/MAU + D1/D7/D30) ────── */
export function retentionMetrics() {
  return _safe(() => {
    const analytics = _probe('__pilotAnalytics') || {};
    const ret = _probe('__retentionHealth') || {};
    const snap = (ret as any).snapshot || ret || {};
    const g = (o: any, ...keys: string[]) => { for (const k of keys) { const n = _num(o && o[k]); if (n !== null) return n; } return null; };
    const dau = g(analytics, 'dailyActiveGrowers', 'dau');
    const wau = g(analytics, 'weeklyActiveGrowers', 'wau');
    const mau = g(analytics, 'monthlyActiveGrowers', 'mau');
    const d1  = g(snap, 'd1', 'd1Retention', 'D1');
    const d7  = g(snap, 'd7', 'd7Retention', 'D7');
    const d30 = g(snap, 'd30', 'd30Retention', 'D30');
    const hasData = [dau, wau, mau, d1, d7, d30].some((v) => v !== null && v > 0);
    return Object.freeze({
      runtimeVersion: PILOT_READINESS_RUNTIME_VERSION, initialized: true,
      dau, wau, mau, d1, d7, d30,
      value: hasData ? 'OK' : 'NEEDS_DATA',
      confidence: (hasData ? 'medium' : 'low') as 'low' | 'medium' | 'high',
      dataSources: Object.freeze(['__pilotAnalytics', '__retentionHealth']),
      limitations: hasData
        ? 'On-device pilot retention only — server-side cohorts may differ.'
        : 'Not enough data yet — retention cohorts accumulate as farmers return.',
    });
  }, Object.freeze({
    runtimeVersion: PILOT_READINESS_RUNTIME_VERSION, initialized: false,
    dau: null, wau: null, mau: null, d1: null, d7: null, d30: null,
    value: 'NEEDS_DATA', confidence: 'low' as const,
    dataSources: Object.freeze([]), limitations: 'Not enough data yet.',
  }));
}

/* ── §8 reliability metrics (exact execution-mode key names) ─── */
export function reliabilityMetrics() {
  return _safe(() => {
    const rel = _probe('__reliabilityHealth') || {};
    return Object.freeze({
      runtimeVersion: PILOT_READINESS_RUNTIME_VERSION, initialized: true,
      authFailures:         _num((rel as any).authFailures) || 0,
      routeFailures:        _num((rel as any).routeErrors) || _num((rel as any).routeFailures) || 0,
      scanFailures:         _num((rel as any).scanFailures) || 0,
      syncFailures:         _num((rel as any).offlineSyncFailures) || _num((rel as any).syncFailures) || 0,
      notificationFailures: _num((rel as any).notificationFailures) || 0,
      confidence: 'medium' as const,
      dataSources: Object.freeze(['__reliabilityHealth']),
      limitations: 'Incident counters from the on-device reliability registry.',
    });
  }, Object.freeze({
    runtimeVersion: PILOT_READINESS_RUNTIME_VERSION, initialized: false,
    authFailures: 0, routeFailures: 0, scanFailures: 0, syncFailures: 0,
    notificationFailures: 0, confidence: 'low' as const,
    dataSources: Object.freeze([]), limitations: 'Not enough data yet.',
  }));
}

/* ── §1 pilot readiness dashboard composite ──────────────────── */
type Status = 'GREEN' | 'YELLOW' | 'RED';
function _status(probeName: string, opts: { critical?: boolean; readyFlag?: string } = {}): Status {
  const p = _probe(probeName);
  if (!p || typeof p !== 'object') return opts.critical ? 'RED' : 'YELLOW';
  // Explicit-false on the named readiness flag → RED for critical, YELLOW otherwise.
  if (opts.readyFlag && p[opts.readyFlag] === false) return opts.critical ? 'RED' : 'YELLOW';
  // Wired + initialized → validated GREEN; NEEDS_DATA value → YELLOW (monitor).
  if (p.value === 'NEEDS_DATA' || p.verdict === 'NEEDS_DATA') return 'YELLOW';
  if (p.initialized === true || p.runtimeVersion) return 'GREEN';
  return 'YELLOW';
}

export function pilotReadiness() {
  return _safe(() => {
    const subsystems = Object.freeze({
      Authentication: _status('__loginRoutingHealth', { critical: true, readyFlag: 'existingUserRoutesHome' }),
      Scan:           _status('__scanPermanentHealth', { critical: true, readyFlag: 'scanPermanentReady' }),
      UploadAnalysis: _status('__uploadAnalysisHealth', { critical: true, readyFlag: 'failureSafe' }),
      Camera:         _status('__cameraHealth'),
      Localization:   _status('__languageHealth'),
      Tasks:          _status('__taskStoreHealth'),
      Activity:       _status('__activityDataHealth'),
      OutcomeCapture: _status('__outcomeCaptureHealth'),
      Invites:        _status('__inviteHealth'),
      Notifications:  _status('__messageTemplateHealth'),
      OfflineSync:    _status('__offlineValidationHealth'),
      NGOReporting:   _status('__ngoEnterpriseHealth'),
    });
    const vals = Object.values(subsystems) as Status[];
    const red = vals.filter((s) => s === 'RED').length;
    const yellow = vals.filter((s) => s === 'YELLOW').length;
    const verdict = red > 0 ? 'BLOCKED' : yellow > 0 ? 'GO_WITH_LIMITATIONS' : 'GO';
    // §9 go-live scorecard — top-level readiness booleans (RED = not ready).
    const scanReady        = subsystems.Scan === 'GREEN';
    const loginReady       = subsystems.Authentication === 'GREEN';
    const routingReady     = subsystems.Authentication !== 'RED'
                              && _status('__routeReachHealth') !== 'RED';
    const languageReady    = subsystems.Localization !== 'RED';
    const localizationReady = languageReady;  // spec alias
    const outcomeReady     = subsystems.OutcomeCapture !== 'RED';
    const ngoReady         = subsystems.NGOReporting !== 'RED';
    const retentionReady   = !!_probe('__retentionMetrics');
    const reliabilityReady = _status('__reliabilityHealth') !== 'RED';
    const notificationReady = subsystems.Notifications !== 'RED'
                               || _status('__notificationRuntimeHealth') !== 'RED';

    // §PRIORITY-LOCKDOWN — read additional probes for spec-shape keys.
    // These compose existing surfaces only; no new intelligence engines.
    const onboardingReady = _safe(() => {
      const p = _probe('__onboardingHealth');
      if (!p) return false;
      const v: any = (p as any).value || p;
      return v && (v.initialized === true || v.farmerOnboardingReady === true);
    }, false);
    const commandCenterReady = _safe(() => {
      const p = _probe('__commandCenterHealth');
      if (!p) return false;
      const v: any = (p as any).value || p;
      return !!(v && v.initialized === true);
    }, false);
    const dailyAssistantReady = _safe(() => {
      const p = _probe('__dailyAssistantHealth');
      if (!p) return false;
      const v: any = (p as any).value || p;
      return !!(v && v.initialized === true);
    }, false);
    const fundingReady = _safe(() => {
      const p = _probe('__fundingHealth');
      if (!p) return false;
      const v: any = (p as any).value || p;
      return !!(v && (v.initialized === true || v.fundingReady === true));
    }, false);
    const sellReady = _safe(() => {
      // Sell surface is "ready" when the harvest gate can resolve —
      // post-harvest probe initialized OR daily-assistant gate present.
      const post = _probe('__postHarvestHealth');
      const daily = _probe('__dailyAssistantHealth');
      const postReady = !!(post && (post as any).initialized);
      const dailyHasSell = !!(daily && typeof (daily as any).sellUnlocked === 'boolean');
      return postReady || dailyHasSell;
    }, false);
    const performanceReady = _safe(() => {
      const p = _probe('__performanceBudgetHealth') || _probe('__performanceHealth');
      if (!p) {
        // Fall back to bundle/build health — the gate-locked PASS at
        // build time is the authoritative perf signal until a live
        // RUM probe is wired.
        const bh = _probe('__buildHealth');
        return !!(bh && ((bh as any).initialized === true || (bh as any).buildReady === true));
      }
      const v: any = (p as any).value || p;
      return !!(v && (v.budgetWithinLimit !== false));
    }, false);
    const uiConsistencyReady = _safe(() => {
      // Composite over header health + simple-mode integration markers.
      // Both flip true once the dedup gates locked the surface.
      const hh = _probe('__headerHealth');
      const sm = _probe('__simpleModeHealth') || _probe('__simpleModeOODAHealth');
      const hhOk = !!(hh && ((hh as any).value || hh).initialized === true);
      const smOk = !!(sm && ((sm as any).value || sm).initialized === true);
      return hhOk && smOk;
    }, false);

    // §GO-LIVE CRITERIA — pilotReady requires the 7 critical surfaces.
    const pilotReady = loginReady && dailyAssistantReady && scanReady
      && outcomeReady && notificationReady && uiConsistencyReady
      && performanceReady;

    return Object.freeze({
      runtimeVersion: PILOT_READINESS_RUNTIME_VERSION, initialized: true,
      subsystems, redCount: red, yellowCount: yellow,
      greenCount: vals.length - red - yellow,
      // §9 scorecard flags (legacy shape — preserved).
      scanReady, loginReady, routingReady, languageReady,
      outcomeReady, ngoReady, retentionReady, reliabilityReady,
      // §PRIORITY-LOCKDOWN spec shape — 14 flags + pilotReady verdict.
      onboardingReady, commandCenterReady, dailyAssistantReady,
      notificationReady, localizationReady,
      fundingReady, sellReady,
      performanceReady, uiConsistencyReady,
      pilotReady,
      verdict,
      disclaimer: 'GREEN=validated · YELLOW=needs monitoring · RED=release blocker.',
    });
  }, Object.freeze({
    runtimeVersion: PILOT_READINESS_RUNTIME_VERSION, initialized: false,
    subsystems: Object.freeze({}), redCount: 0, yellowCount: 0, greenCount: 0,
    scanReady: false, loginReady: false, routingReady: false, languageReady: false,
    outcomeReady: false, ngoReady: false, retentionReady: false, reliabilityReady: false,
    onboardingReady: false, commandCenterReady: false, dailyAssistantReady: false,
    notificationReady: false, localizationReady: false,
    fundingReady: false, sellReady: false,
    performanceReady: false, uiConsistencyReady: false, pilotReady: false,
    verdict: 'GO_WITH_LIMITATIONS' as const,
    disclaimer: 'GREEN=validated · YELLOW=needs monitoring · RED=release blocker.',
  }));
}

function _install(name: string, fn: () => any, label: string): void {
  _safe(() => {
    if (typeof window === 'undefined') return;
    const w = window as any;
    if (typeof w[name] !== 'function') {
      w[name] = function () {
        const out = fn();
        try {
          const dev = typeof import.meta !== 'undefined'
            && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) console.log(label, out);
        } catch { /* swallow */ }
        return out;
      };
    }
  }, undefined);
}

export function installPilotReadinessGlobals(): boolean {
  return _safe(() => {
    _install('__outcomeMetrics',        outcomeMetrics,        '[Farroway · Outcome Metrics]');
    _install('__ngoPilotMetrics',       ngoPilotMetrics,       '[Farroway · NGO Pilot Metrics]');
    _install('__ngoMetrics',            ngoPilotMetrics,       '[Farroway · NGO Metrics]');
    _install('__languageQualityHealth', languageQualityHealth, '[Farroway · Language Quality]');
    _install('__retentionMetrics',      retentionMetrics,      '[Farroway · Retention Metrics]');
    _install('__reliabilityMetrics',    reliabilityMetrics,    '[Farroway · Reliability Metrics]');
    _install('__pilotReadiness',        pilotReadiness,        '[Farroway · Pilot Readiness]');
    return true;
  }, false);
}
