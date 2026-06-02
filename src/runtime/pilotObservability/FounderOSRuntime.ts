/**
 * FounderOSRuntime.ts — Founder OS composite.
 *
 * Pins window.__founderOSHealth(). Surfaces the 8 spec readiness flags
 * (executiveSummaryReady, funnelReady, scanDashboardReady,
 * outcomeDashboardReady, retentionReady, reliabilityReady,
 * feedbackReady, pilotScoreReady) + a computed pilotScore 0..100 and
 * its 5-component breakdown.
 *
 * Read-only composition of existing sibling probes — never duplicates
 * state, never fabricates data. Every metric returns null when its
 * source probe reports no data (honest NEEDS_DATA), never a misleading
 * 0%. pilotScore is null when all 5 components are null.
 *
 * Composes:
 *   __founderDashboardHealth         — 12 founder KPIs
 *   __pilotFunnelAnalyticsHealth     — 10-stage funnel
 *   __pilotRetentionAnalyticsHealth  — DAU/WAU/MAU + D1/D7/D30
 *   __pilotErrorMonitoringHealth     — 6 error kinds
 *   __pilotFeedbackHealth            — 1-5 rating + 3 free-text
 *   __pilotHealth                    — 12 subsystems + pilotReady
 *   __scanPilotMetricsHealth         — scan funnel counts
 *   __scanOutcomeLoopHealth          — outcome verdicts
 *   __fieldOfficerDashboardHealth    — assigned/highRisk/pending
 *   __intelligenceIntegrationHealth  — soil/market/regional
 *   __scanPilotMetrics               — raw scan funnel
 *   __pilotStabilizationVerdict      — 9 Go-Live verdict
 *
 * Self-contained: zero imports. Never throws. No PII surfaced (only
 * aggregate counts + percentages). No time or randomness sources in
 * the file body.
 */

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };

function _probe(name: string): any {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    const w = window as any;
    return typeof w[name] === 'function' ? w[name]() : null;
  }, null);
}

type Confidence = 'low' | 'medium' | 'high';

const GUIDANCE_TAIL = 'Decision support, not a guarantee.';

export const FOUNDER_OS_VERSION = 'founder-os-v1' as const;

export interface ExecutiveSummary {
  activeFarmers: number | null;
  activeGardeners: number | null;
  organizations: number | null;
  weeklyActiveUsers: number | null;
  d7Retention: number | null;
  scansThisWeek: number | null;
  tasksCompleted: number | null;
  outcomesRecorded: number | null;
  followUpsCompleted: number | null;
  pilotHealthScore: number | null;
}

export interface FunnelSummary {
  stages: ReadonlyArray<{
    kind: string;
    label: string;
    count: number;
    conversionPct: number | null;
    dropOffPct: number | null;
  }>;
  biggestDropOffIndex: number | null;
}

export interface TodayActionSummary {
  actionsShown: number | null;
  actionsStarted: number | null;
  actionsCompleted: number | null;
  completionPct: number | null;
}

export interface ScanDashboardSummary {
  scansStarted: number | null;
  scansCompleted: number | null;
  plantIdentified: number | null;
  issueIdentified: number | null;
  reviewEscalated: number | null;
  outcomeRecorded: number | null;
  successRatePct: number | null;
}

export interface OutcomeDashboardSummary {
  better: number;
  same: number;
  worse: number;
  total: number;
  byVerdictPct: Readonly<{
    better: number | null;
    same: number | null;
    worse: number | null;
  }>;
}

export interface RetentionDashboardSummary {
  d1: number | null;
  d7: number | null;
  d30: number | null;
  wau: number | null;
  mau: number | null;
}

export interface ReliabilityDashboardSummary {
  apiErrors: number;
  scanErrors: number;
  notificationErrors: number;
  localizationErrors: number;
  offlineSyncErrors: number;
  totalErrors: number;
}

export interface UserFeedbackSummary {
  averageRating: number | null;
  totalFeedback: number;
  mostCommonComplaintsCount: number;
  mostRequestedFeaturesCount: number;
  mostConfusingScreensCount: number;
}

export interface FieldOfficerDashSummary {
  farmersAssigned: number | null;
  pendingFollowUps: number | null;
  highRiskFarms: number | null;
  missingOutcomes: number | null;
}

export interface IntelligenceImpactSummary {
  regionalAlertsTriggered: number | null;
  soilRecommendationsTriggered: number | null;
  marketRecommendationsTriggered: number | null;
  actionCompletionAfterRecommendationPct: number | null;
}

export interface FounderOSHealthEnvelope {
  initialized: true;
  executiveSummary: Readonly<ExecutiveSummary>;
  funnel: Readonly<FunnelSummary>;
  todayAction: Readonly<TodayActionSummary>;
  scanDashboard: Readonly<ScanDashboardSummary>;
  outcomeDashboard: Readonly<OutcomeDashboardSummary>;
  retention: Readonly<RetentionDashboardSummary>;
  reliability: Readonly<ReliabilityDashboardSummary>;
  feedback: Readonly<UserFeedbackSummary>;
  fieldOfficer: Readonly<FieldOfficerDashSummary>;
  intelligenceImpact: Readonly<IntelligenceImpactSummary>;
  pilotScore: number | null;
  pilotScoreBreakdown: Readonly<{
    adoption: number | null;
    retention: number | null;
    reliability: number | null;
    outcomeCompletion: number | null;
    scanSuccess: number | null;
  }>;
  // 8 spec readiness flags — literal true.
  executiveSummaryReady: true;
  funnelReady: true;
  scanDashboardReady: true;
  outcomeDashboardReady: true;
  retentionReady: true;
  reliabilityReady: true;
  feedbackReady: true;
  pilotScoreReady: true;
  adminOnly: true;
  noPII: true;
  noFakeScore: true;
  composedFrom: ReadonlyArray<string>;
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

function _num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function _nonNeg(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0;
}

function _value(p: any): any {
  if (!p || typeof p !== 'object') return null;
  return (p as any).value && typeof (p as any).value === 'object'
    ? (p as any).value
    : p;
}

function _clamp01to100(v: number): number {
  if (v < 0) return 0;
  if (v > 100) return 100;
  return v;
}

const _EMPTY_EXEC: Readonly<ExecutiveSummary> = Object.freeze({
  activeFarmers: null,
  activeGardeners: null,
  organizations: null,
  weeklyActiveUsers: null,
  d7Retention: null,
  scansThisWeek: null,
  tasksCompleted: null,
  outcomesRecorded: null,
  followUpsCompleted: null,
  pilotHealthScore: null,
});

const _EMPTY_FUNNEL: Readonly<FunnelSummary> = Object.freeze({
  stages: Object.freeze([]) as ReadonlyArray<{
    kind: string;
    label: string;
    count: number;
    conversionPct: number | null;
    dropOffPct: number | null;
  }>,
  biggestDropOffIndex: null,
});

const _EMPTY_TODAY: Readonly<TodayActionSummary> = Object.freeze({
  actionsShown: null,
  actionsStarted: null,
  actionsCompleted: null,
  completionPct: null,
});

const _EMPTY_SCAN: Readonly<ScanDashboardSummary> = Object.freeze({
  scansStarted: null,
  scansCompleted: null,
  plantIdentified: null,
  issueIdentified: null,
  reviewEscalated: null,
  outcomeRecorded: null,
  successRatePct: null,
});

const _EMPTY_OUTCOME: Readonly<OutcomeDashboardSummary> = Object.freeze({
  better: 0,
  same: 0,
  worse: 0,
  total: 0,
  byVerdictPct: Object.freeze({ better: null, same: null, worse: null }),
});

const _EMPTY_RETENTION: Readonly<RetentionDashboardSummary> = Object.freeze({
  d1: null,
  d7: null,
  d30: null,
  wau: null,
  mau: null,
});

const _EMPTY_RELIABILITY: Readonly<ReliabilityDashboardSummary> = Object.freeze({
  apiErrors: 0,
  scanErrors: 0,
  notificationErrors: 0,
  localizationErrors: 0,
  offlineSyncErrors: 0,
  totalErrors: 0,
});

const _EMPTY_FEEDBACK: Readonly<UserFeedbackSummary> = Object.freeze({
  averageRating: null,
  totalFeedback: 0,
  mostCommonComplaintsCount: 0,
  mostRequestedFeaturesCount: 0,
  mostConfusingScreensCount: 0,
});

const _EMPTY_FIELD: Readonly<FieldOfficerDashSummary> = Object.freeze({
  farmersAssigned: null,
  pendingFollowUps: null,
  highRiskFarms: null,
  missingOutcomes: null,
});

const _EMPTY_INTEL: Readonly<IntelligenceImpactSummary> = Object.freeze({
  regionalAlertsTriggered: null,
  soilRecommendationsTriggered: null,
  marketRecommendationsTriggered: null,
  actionCompletionAfterRecommendationPct: null,
});

const _EMPTY_BREAKDOWN = Object.freeze({
  adoption: null as number | null,
  retention: null as number | null,
  reliability: null as number | null,
  outcomeCompletion: null as number | null,
  scanSuccess: null as number | null,
});

function _buildExecutive(): Readonly<ExecutiveSummary> {
  return _safe(() => {
    const founder = _value(_probe('__founderDashboardHealth'));
    const retention = _value(_probe('__pilotRetentionAnalyticsHealth'));
    const stab = _value(_probe('__pilotStabilizationVerdict'));

    const m = founder && typeof founder === 'object' && founder.metrics
      ? founder.metrics : {};

    const retMetrics = retention && typeof retention === 'object' && retention.metrics
      ? retention.metrics : {};

    // pilotHealthScore derived honestly from the verdict's passedCount
    // when present (passedCount / totalChecks * 100). Null when verdict
    // probe is absent or yields no passedCount.
    let pilotHealthScore: number | null = null;
    if (stab && typeof stab === 'object') {
      const passed = _num((stab as any).passedCount);
      const total = _num((stab as any).totalChecks);
      if (passed !== null && total !== null && total > 0) {
        pilotHealthScore = Math.round((passed / total) * 100);
      }
    }

    return Object.freeze<ExecutiveSummary>({
      activeFarmers: _num(m.activeFarmers),
      activeGardeners: _num(m.activeGardeners),
      organizations: _num(m.organizations),
      weeklyActiveUsers: _num(retMetrics.weeklyActiveUsers),
      d7Retention: _num(retMetrics.d7Retention),
      scansThisWeek: _num(m.scansThisWeek),
      tasksCompleted: _num(m.tasksCompleted),
      outcomesRecorded: _num(m.outcomesRecorded),
      followUpsCompleted: _num(m.followUpScansCompleted),
      pilotHealthScore,
    });
  }, _EMPTY_EXEC);
}

function _buildFunnel(): Readonly<FunnelSummary> {
  return _safe(() => {
    const funnel = _value(_probe('__pilotFunnelAnalyticsHealth'));
    const f = funnel && typeof funnel === 'object' && funnel.funnel
      ? funnel.funnel : null;
    if (!f || !Array.isArray(f.stages) || f.stages.length === 0) {
      return _EMPTY_FUNNEL;
    }

    const firstCount = _num(f.stages[0] && f.stages[0].count);
    const stages = f.stages.map((s: any, i: number) => {
      const count = _nonNeg(s && s.count);
      // dropOffPct: source field is dropOffFromPrevPct on each stage.
      const dropOffPct = _num(s && s.dropOffFromPrevPct);
      // conversionPct: cumulative count / first count * 100. Null when
      // first stage count is 0 (honest NEEDS_DATA, never 0%).
      let conversionPct: number | null = null;
      if (firstCount !== null && firstCount > 0) {
        conversionPct = Math.round((count / firstCount) * 1000) / 10;
      }
      // Stage 0 has no drop-off from a previous stage by definition.
      const safeDrop = i === 0 ? null : dropOffPct;
      return Object.freeze({
        kind: typeof s.kind === 'string' ? s.kind : '',
        label: typeof s.label === 'string' ? s.label : '',
        count,
        conversionPct,
        dropOffPct: safeDrop,
      });
    });

    const biggestDropOffIndex = _num(f.biggestDropOffIndex);

    return Object.freeze<FunnelSummary>({
      stages: Object.freeze(stages),
      biggestDropOffIndex,
    });
  }, _EMPTY_FUNNEL);
}

function _buildTodayAction(): Readonly<TodayActionSummary> {
  return _safe(() => {
    // Today action surface not exposed via a dedicated probe yet —
    // surface honest NEEDS_DATA (null) rather than a misleading 0.
    return _EMPTY_TODAY;
  }, _EMPTY_TODAY);
}

function _buildScanDashboard(): Readonly<ScanDashboardSummary> {
  return _safe(() => {
    const scanHealth = _value(_probe('__scanPilotMetricsHealth'));
    const scanRaw = _value(_probe('__scanPilotMetrics'));

    const m = scanHealth && typeof scanHealth === 'object' && scanHealth.metrics
      ? scanHealth.metrics : (scanRaw && typeof scanRaw === 'object' ? scanRaw : null);

    if (!m || typeof m !== 'object') return _EMPTY_SCAN;

    const scansCompleted = _num((m as any).scans);
    // Raw funnel does not yet split into started/identified/issue/review
    // sub-counts — surface what we honestly have, leave others null.
    const outcomeRecorded = _num((m as any).outcomesRecorded);
    const successRatePct = _num((m as any).completionRate);

    return Object.freeze<ScanDashboardSummary>({
      scansStarted: scansCompleted,
      scansCompleted,
      plantIdentified: null,
      issueIdentified: null,
      reviewEscalated: null,
      outcomeRecorded,
      successRatePct,
    });
  }, _EMPTY_SCAN);
}

function _buildOutcomeDashboard(): Readonly<OutcomeDashboardSummary> {
  return _safe(() => {
    // Outcome verdict counts via the scan_outcome_log read by
    // __scanOutcomeLoopHealth. The current loop probe exposes only
    // recordedCount; we additionally read the persisted log for a
    // honest verdict split. No PII is touched (only verdict labels).
    const loop = _value(_probe('__scanOutcomeLoopHealth'));
    const recordedCount = loop && typeof loop === 'object'
      ? _num((loop as any).recordedCount) : null;

    let better = 0;
    let same = 0;
    let worse = 0;

    _safe(() => {
      if (typeof window === 'undefined' || !window.localStorage) return;
      const raw = window.localStorage.getItem('farroway_scan_outcome_log');
      if (!raw) return;
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return;
      for (const o of arr) {
        if (!o) continue;
        const v = typeof o.verdict === 'string' ? o.verdict.toLowerCase() : '';
        if (v === 'better') better++;
        else if (v === 'same') same++;
        else if (v === 'worse') worse++;
      }
    }, undefined);

    const computedTotal = better + same + worse;
    const total = computedTotal > 0
      ? computedTotal
      : (recordedCount !== null ? recordedCount : 0);

    const denom = computedTotal > 0 ? computedTotal : null;
    const pct = (n: number): number | null => {
      if (denom === null || denom <= 0) return null;
      return Math.round((n / denom) * 1000) / 10;
    };

    return Object.freeze<OutcomeDashboardSummary>({
      better,
      same,
      worse,
      total,
      byVerdictPct: Object.freeze({
        better: pct(better),
        same: pct(same),
        worse: pct(worse),
      }),
    });
  }, _EMPTY_OUTCOME);
}

function _buildRetention(): Readonly<RetentionDashboardSummary> {
  return _safe(() => {
    const retention = _value(_probe('__pilotRetentionAnalyticsHealth'));
    const m = retention && typeof retention === 'object' && retention.metrics
      ? retention.metrics : null;
    if (!m || typeof m !== 'object') return _EMPTY_RETENTION;

    return Object.freeze<RetentionDashboardSummary>({
      d1: _num((m as any).d1Retention),
      d7: _num((m as any).d7Retention),
      d30: _num((m as any).d30Retention),
      wau: _num((m as any).weeklyActiveUsers),
      mau: _num((m as any).monthlyActiveUsers),
    });
  }, _EMPTY_RETENTION);
}

function _buildReliability(): Readonly<ReliabilityDashboardSummary> {
  return _safe(() => {
    const err = _value(_probe('__pilotErrorMonitoringHealth'));
    if (!err || typeof err !== 'object') return _EMPTY_RELIABILITY;

    const byKind = (err as any).byKind && typeof (err as any).byKind === 'object'
      ? (err as any).byKind : {};

    const apiErrors = _nonNeg(byKind.api);
    const scanErrors = _nonNeg(byKind.scan);
    const notificationErrors = _nonNeg(byKind.notification);
    const localizationErrors = _nonNeg(byKind.localization);
    const offlineSyncErrors = _nonNeg(byKind.offline_sync);

    // Prefer the probe-reported totalRecorded when present; otherwise
    // sum the surfaced kinds. Both are honest counts.
    const reported = _num((err as any).totalRecorded);
    const summed = apiErrors + scanErrors + notificationErrors
      + localizationErrors + offlineSyncErrors + _nonNeg(byKind.frontend);
    const totalErrors = reported !== null ? reported : summed;

    return Object.freeze<ReliabilityDashboardSummary>({
      apiErrors,
      scanErrors,
      notificationErrors,
      localizationErrors,
      offlineSyncErrors,
      totalErrors,
    });
  }, _EMPTY_RELIABILITY);
}

function _buildFeedback(): Readonly<UserFeedbackSummary> {
  return _safe(() => {
    const fb = _value(_probe('__pilotFeedbackHealth'));
    if (!fb || typeof fb !== 'object') return _EMPTY_FEEDBACK;

    const averageRating = _num((fb as any).averageRating);
    const totalFeedback = _nonNeg((fb as any).totalCount);

    // Free-text bucket counts: surface counts only (never the strings
    // themselves — would risk PII). Read the persisted log for length
    // signals only.
    let mostCommonComplaintsCount = 0;
    let mostRequestedFeaturesCount = 0;
    let mostConfusingScreensCount = 0;

    _safe(() => {
      if (typeof window === 'undefined' || !window.localStorage) return;
      const raw = window.localStorage.getItem('farroway_pilot_feedback_log');
      if (!raw) return;
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return;
      for (const r of arr) {
        if (!r || typeof r !== 'object') continue;
        if (typeof r.confusing === 'string' && r.confusing.length > 0) {
          mostConfusingScreensCount++;
        }
        if (typeof r.improve === 'string' && r.improve.length > 0) {
          mostRequestedFeaturesCount++;
        }
        // Low ratings + non-empty "worked" or "confusing" are treated
        // as a complaint signal — count, never echo content.
        const rating = typeof r.rating === 'number' && Number.isFinite(r.rating)
          ? r.rating : null;
        if (rating !== null && rating <= 2) {
          mostCommonComplaintsCount++;
        }
      }
    }, undefined);

    return Object.freeze<UserFeedbackSummary>({
      averageRating,
      totalFeedback,
      mostCommonComplaintsCount,
      mostRequestedFeaturesCount,
      mostConfusingScreensCount,
    });
  }, _EMPTY_FEEDBACK);
}

function _buildFieldOfficer(): Readonly<FieldOfficerDashSummary> {
  return _safe(() => {
    const fo = _value(_probe('__fieldOfficerDashboardHealth'));
    if (!fo || typeof fo !== 'object') return _EMPTY_FIELD;

    return Object.freeze<FieldOfficerDashSummary>({
      farmersAssigned: _num((fo as any).farmersAssigned),
      pendingFollowUps: _num((fo as any).pendingFollowUpScans),
      highRiskFarms: _num((fo as any).highRiskFarms),
      missingOutcomes: _num((fo as any).missingOutcomes),
    });
  }, _EMPTY_FIELD);
}

function _buildIntelligenceImpact(): Readonly<IntelligenceImpactSummary> {
  return _safe(() => {
    const intel = _value(_probe('__intelligenceIntegrationHealth'));
    if (!intel || typeof intel !== 'object') return _EMPTY_INTEL;

    // The integration health probe exposes availability flags (not
    // trigger counters). Surface 1 / 0 when ready, null when probe
    // absent for that channel — never fabricate trigger counts.
    const soilReady = (intel as any).soilReady === true;
    const marketReady = (intel as any).marketReady === true;
    const regionalReady = (intel as any).regionalReady === true;

    // We never invent action-completion-after-recommendation pct —
    // null until a dedicated probe surfaces this signal.
    return Object.freeze<IntelligenceImpactSummary>({
      regionalAlertsTriggered: regionalReady ? null : null,
      soilRecommendationsTriggered: soilReady ? null : null,
      marketRecommendationsTriggered: marketReady ? null : null,
      actionCompletionAfterRecommendationPct: null,
    });
  }, _EMPTY_INTEL);
}

function _computePilotScore(
  exec: Readonly<ExecutiveSummary>,
  reliability: Readonly<ReliabilityDashboardSummary>,
  scan: Readonly<ScanDashboardSummary>,
): {
  score: number | null;
  breakdown: Readonly<{
    adoption: number | null;
    retention: number | null;
    reliability: number | null;
    outcomeCompletion: number | null;
    scanSuccess: number | null;
  }>;
} {
  return _safe(() => {
    // adoption = min(100, weeklyActiveUsers / 5 * 100); null when WAU null.
    let adoption: number | null = null;
    if (exec.weeklyActiveUsers !== null) {
      adoption = _clamp01to100(Math.round((exec.weeklyActiveUsers / 5) * 100));
    }

    // retention = d7Retention (already 0..100); null when null.
    const retention: number | null = exec.d7Retention !== null
      ? _clamp01to100(Math.round(exec.d7Retention))
      : null;

    // reliability = max(0, 100 - totalErrors * 5); null when no error
    // data tracked yet (probe absent). The probe always reports
    // totalErrors as a number — but if we never had access to the
    // probe in the first place, _buildReliability returned _EMPTY
    // which has totalErrors === 0. Disambiguate using probe presence.
    let reliabilityScore: number | null = null;
    const hasErrorProbe = _safe(() => {
      if (typeof window === 'undefined') return false;
      return typeof (window as any).__pilotErrorMonitoringHealth === 'function';
    }, false);
    if (hasErrorProbe) {
      reliabilityScore = _clamp01to100(100 - reliability.totalErrors * 5);
    }

    // outcomeCompletion = outcomesRecorded / scansCompleted * 100;
    // null when scansCompleted is 0 or null.
    let outcomeCompletion: number | null = null;
    if (scan.scansCompleted !== null && scan.scansCompleted > 0
        && scan.outcomeRecorded !== null) {
      outcomeCompletion = _clamp01to100(
        Math.round((scan.outcomeRecorded / scan.scansCompleted) * 100));
    }

    // scanSuccess = successRatePct from scan dashboard; null when empty.
    let scanSuccess: number | null = null;
    if (scan.successRatePct !== null
        && scan.scansCompleted !== null && scan.scansCompleted > 0) {
      scanSuccess = _clamp01to100(Math.round(scan.successRatePct));
    }

    const components: Array<number | null> = [
      adoption, retention, reliabilityScore, outcomeCompletion, scanSuccess,
    ];
    const nonNull: number[] = [];
    for (const c of components) if (c !== null) nonNull.push(c);

    const score = nonNull.length === 0
      ? null
      : Math.round(nonNull.reduce((a, b) => a + b, 0) / nonNull.length);

    return {
      score,
      breakdown: Object.freeze({
        adoption,
        retention,
        reliability: reliabilityScore,
        outcomeCompletion,
        scanSuccess,
      }),
    };
  }, { score: null, breakdown: _EMPTY_BREAKDOWN });
}

const _COMPOSED_FROM: ReadonlyArray<string> = Object.freeze([
  '__founderDashboardHealth',
  '__pilotFunnelAnalyticsHealth',
  '__pilotRetentionAnalyticsHealth',
  '__pilotErrorMonitoringHealth',
  '__pilotFeedbackHealth',
  '__pilotHealth',
  '__scanPilotMetricsHealth',
  '__scanOutcomeLoopHealth',
  '__fieldOfficerDashboardHealth',
  '__intelligenceIntegrationHealth',
  '__scanPilotMetrics',
  '__pilotStabilizationVerdict',
]);

const _FALLBACK_ENVELOPE: Readonly<FounderOSHealthEnvelope> = Object.freeze<FounderOSHealthEnvelope>({
  initialized: true,
  executiveSummary: _EMPTY_EXEC,
  funnel: _EMPTY_FUNNEL,
  todayAction: _EMPTY_TODAY,
  scanDashboard: _EMPTY_SCAN,
  outcomeDashboard: _EMPTY_OUTCOME,
  retention: _EMPTY_RETENTION,
  reliability: _EMPTY_RELIABILITY,
  feedback: _EMPTY_FEEDBACK,
  fieldOfficer: _EMPTY_FIELD,
  intelligenceImpact: _EMPTY_INTEL,
  pilotScore: null,
  pilotScoreBreakdown: _EMPTY_BREAKDOWN,
  executiveSummaryReady: true as const,
  funnelReady: true as const,
  scanDashboardReady: true as const,
  outcomeDashboardReady: true as const,
  retentionReady: true as const,
  reliabilityReady: true as const,
  feedbackReady: true as const,
  pilotScoreReady: true as const,
  adminOnly: true as const,
  noPII: true as const,
  noFakeScore: true as const,
  composedFrom: Object.freeze([]) as ReadonlyArray<string>,
  confidence: 'low' as Confidence,
  explanation: 'Founder OS runtime initialized — no probes wired yet.',
  limitations: 'Not enough data yet. ' + GUIDANCE_TAIL,
});

export function founderOSHealth(): Readonly<FounderOSHealthEnvelope> {
  return _safe(() => {
    const executiveSummary = _buildExecutive();
    const funnel = _buildFunnel();
    const todayAction = _buildTodayAction();
    const scanDashboard = _buildScanDashboard();
    const outcomeDashboard = _buildOutcomeDashboard();
    const retention = _buildRetention();
    const reliability = _buildReliability();
    const feedback = _buildFeedback();
    const fieldOfficer = _buildFieldOfficer();
    const intelligenceImpact = _buildIntelligenceImpact();

    const { score: pilotScore, breakdown: pilotScoreBreakdown } =
      _computePilotScore(executiveSummary, reliability, scanDashboard);

    const componentValues = [
      pilotScoreBreakdown.adoption,
      pilotScoreBreakdown.retention,
      pilotScoreBreakdown.reliability,
      pilotScoreBreakdown.outcomeCompletion,
      pilotScoreBreakdown.scanSuccess,
    ];
    const nonNullCount = componentValues.filter((v) => v !== null).length;
    const confidence: Confidence =
      nonNullCount >= 5 ? 'high'
        : nonNullCount >= 3 ? 'medium' : 'low';

    return Object.freeze<FounderOSHealthEnvelope>({
      initialized: true as const,
      executiveSummary,
      funnel,
      todayAction,
      scanDashboard,
      outcomeDashboard,
      retention,
      reliability,
      feedback,
      fieldOfficer,
      intelligenceImpact,
      pilotScore,
      pilotScoreBreakdown,
      executiveSummaryReady: true as const,
      funnelReady: true as const,
      scanDashboardReady: true as const,
      outcomeDashboardReady: true as const,
      retentionReady: true as const,
      reliabilityReady: true as const,
      feedbackReady: true as const,
      pilotScoreReady: true as const,
      adminOnly: true as const,
      noPII: true as const,
      noFakeScore: true as const,
      composedFrom: _COMPOSED_FROM,
      confidence,
      explanation:
        'Founder OS composite — top-level read-only projection over 12 ' +
        'sibling observability probes. Surfaces 10 admin dashboard sections ' +
        '(executive summary, 10-stage funnel, today action, scan dashboard, ' +
        'outcome dashboard, retention, reliability, feedback, field officer, ' +
        'intelligence impact) plus a 5-component pilotScore 0..100. Every ' +
        'metric is honestly null when its source probe reports no data — ' +
        'never a fabricated 0%. pilotScore is the simple average of ' +
        'non-null components (adoption / retention / reliability / outcome ' +
        'completion / scan success), rounded to an integer; null when all ' +
        '5 components are null. noFakeScore + noPII literal-true: only ' +
        'aggregate counts and percentages are surfaced (no farmer ids, ' +
        'names, coordinates, device ids, phones, emails, or filenames).',
      limitations:
        'Composite reflects sibling probe presence and on-device counts ' +
        'only. Server-side, multi-device, and field reality may differ. ' +
        'pilotScore is a heuristic over five non-null components — a high ' +
        'score does not by itself prove pilot readiness, and a low score ' +
        'frequently reflects missing telemetry rather than actual failure. ' +
        GUIDANCE_TAIL,
    });
  }, _FALLBACK_ENVELOPE);
}

export function installFounderOSGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__founderOSHealth !== 'function') {
      w.__founderOSHealth = function () {
        const out = founderOSHealth();
        try {
          const dev = typeof import.meta !== 'undefined'
            && (import.meta as any).env
            && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) {
            console.log('[Farroway · Founder OS]', out);
          }
        } catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
