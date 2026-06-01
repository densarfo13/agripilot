/**
 * CommandCenterAggregator.ts — reads every upstream probe (no direct
 * computation of farm state) and assembles a frozen CommandCenterState.
 *
 * Inputs (per spec):
 *   DailyAssistantRuntime, OutcomeRuntime, AgronomyRuntime, ScanRuntime,
 *   FundingRuntime, SellRuntime, NotificationRuntime,
 *   MarketIntelligenceRuntime, SoilIntelligenceRuntime,
 *   RegionalIntelligenceRuntime.
 *
 * Pure: never throws, never writes localStorage, never mutates window.
 * Returns a frozen aggregate or honest defaults.
 */

import type {
  CommandCenterState, TodayAction, NextAction, RiskOut, HealthOut,
  MarketOut, FundingMatch, SellReadinessOut, LatestOutcome, LatestScan,
  ProgressOut, RiskLevel, MarketDemand, HealthBand, Confidence,
} from './CommandCenterContracts';
import { GUIDANCE_TAIL } from './CommandCenterContracts';

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };

function _probe(name: string): any {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    const w = window as any;
    return typeof w[name] === 'function' ? w[name]() : null;
  }, null);
}

function _extract(probe: any, ...keys: string[]): any {
  if (!probe) return undefined;
  const v = probe.value || probe;
  for (const k of keys) {
    if (v && v[k] !== undefined && v[k] !== null) return v[k];
  }
  return undefined;
}

function _healthBand(score: number | null): HealthBand {
  if (typeof score !== 'number' || !isFinite(score)) return 'unknown';
  if (score >= 75) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}

/** Sources actually read this turn — surfaced for traceability. */
export interface AggregatorResult {
  state: Readonly<CommandCenterState>;
  composedFrom: ReadonlyArray<string>;
  readinessFlags: Readonly<{
    cropReady: boolean;
    stageReady: boolean;
    healthReady: boolean;
    riskReady: boolean;
    actionReady: boolean;
    harvestReady: boolean;
    fundingReady: boolean;
    marketReady: boolean;
    sellReady: boolean;
    notificationReady: boolean;
  }>;
}

export function aggregateCommandCenter(): Readonly<AggregatorResult> {
  return _safe(() => {
    // ─── Read every upstream probe ────────────────────────────────────
    const dailyAssistant = _probe('__dailyAssistantHealth');
    const taskChain = _probe('__taskChainHealth');
    const taskProgress = _probe('__taskChainProgressHealth');
    const outcome = _probe('__outcomeHealth');
    const outcomeLearning = _probe('__outcomeLearningLoopHealth');
    const agronomy = _probe('__agronomyHealth');
    const scan = _probe('__scanIntelligenceHealth')
      || _probe('__scanPermanentHealth')
      || _probe('__scanStartupHealth');
    const funding = _probe('__fundingHealth');
    const sellProbe = _probe('__sellHealth') || _probe('__postHarvestHealth');
    const notification = _probe('__notificationRuntimeHealth')
      || _probe('__notificationSchedulerHealth')
      || _probe('__notificationTemplateHealth');
    const market = _probe('__marketIntelligenceCompositeHealth')
      || _probe('__marketplaceIntelligenceHealth');
    const soil = _probe('__soilIntelligenceHealth');
    const regional = _probe('__regionalIntelligenceFieldHealth')
      || _probe('__regionalIntelligenceHealth');
    const farmRisk = _probe('__farmRiskHealth');
    const farmHealth = _probe('__farmHealthScoreHealth');
    const lifecycle = _probe('__cropLifecycleHealth');
    const growTime = _probe('__growTimeframeHealth');

    const composed: string[] = [];
    const trace = (name: string, p: any) => { if (p) composed.push(name); };
    trace('__dailyAssistantHealth', dailyAssistant);
    trace('__taskChainHealth', taskChain);
    trace('__taskChainProgressHealth', taskProgress);
    trace('__outcomeHealth', outcome);
    trace('__outcomeLearningLoopHealth', outcomeLearning);
    trace('__agronomyHealth', agronomy);
    trace('__scanIntelligenceHealth', scan);
    trace('__fundingHealth', funding);
    trace('__postHarvestHealth', sellProbe);
    trace('__notificationRuntimeHealth', notification);
    trace('__marketIntelligenceCompositeHealth', market);
    trace('__soilIntelligenceHealth', soil);
    trace('__regionalIntelligenceFieldHealth', regional);
    trace('__farmRiskHealth', farmRisk);
    trace('__farmHealthScoreHealth', farmHealth);
    trace('__cropLifecycleHealth', lifecycle);
    trace('__growTimeframeHealth', growTime);

    // ─── crop ─────────────────────────────────────────────────────────
    const crop: string = _safe(() => {
      const fromChain = _extract(taskChain, 'cropKey');
      if (typeof fromChain === 'string' && fromChain) return fromChain;
      const t = taskChain ? ((taskChain as any).value || taskChain).activeTask : null;
      if (t && typeof t.cropKey === 'string' && t.cropKey) return t.cropKey;
      const fromAgronomy = _extract(agronomy, 'activeCrop', 'crop');
      if (typeof fromAgronomy === 'string' && fromAgronomy) return fromAgronomy;
      return '';
    }, '');

    // ─── cropStage ────────────────────────────────────────────────────
    const cropStage: string = _safe(() => {
      const fromLifecycle = _extract(lifecycle, 'currentStage', 'stage');
      if (typeof fromLifecycle === 'string' && fromLifecycle) return fromLifecycle;
      const fromAgronomy = _extract(agronomy, 'currentStage', 'stage');
      if (typeof fromAgronomy === 'string' && fromAgronomy) return fromAgronomy;
      return '';
    }, '');

    // ─── farmHealth ───────────────────────────────────────────────────
    const farmHealthOut: HealthOut = _safe(() => {
      const score = _safe(() => {
        if (!farmHealth) return null;
        const v: any = (farmHealth as any).value || farmHealth;
        for (const c of [v.score, v.farmHealthScore, v.healthScore, v.value]) {
          if (typeof c === 'number' && isFinite(c)) return c;
        }
        return null;
      }, null);
      const band = _healthBand(score);
      const label = band === 'high' ? 'Healthy'
        : band === 'medium' ? 'Watching'
        : band === 'low' ? 'Needs attention' : 'Not enough data yet';
      return Object.freeze({ score, band, label });
    }, Object.freeze({ score: null, band: 'unknown' as HealthBand, label: 'Not enough data yet' }));

    // ─── riskLevel ────────────────────────────────────────────────────
    const riskLevelOut: RiskOut = _safe(() => {
      if (!farmRisk) return Object.freeze({
        level: 'unknown' as RiskLevel,
        explanation: 'No farm-risk probe yet.',
        source: 'none',
      });
      const v: any = (farmRisk as any).value || farmRisk;
      return Object.freeze({
        level: (typeof v.overallRiskLevel === 'string' ? v.overallRiskLevel : 'unknown') as RiskLevel,
        explanation: typeof v.overallExplanation === 'string'
          ? v.overallExplanation : 'No risk explanation yet.',
        source: '__farmRiskHealth',
      });
    }, Object.freeze({ level: 'unknown' as RiskLevel, explanation: 'risk probe threw', source: 'none' }));

    // ─── todayAction / nextAction ─────────────────────────────────────
    const todayAction: TodayAction = _safe(() => {
      const t = taskChain ? ((taskChain as any).value || taskChain).activeTask : null;
      if (!t) return Object.freeze({
        id: null, title: '', why: '', estimatedTime: '',
        scanRelevant: false, source: 'none',
      });
      return Object.freeze({
        id: typeof t.id === 'string' ? t.id : null,
        title: typeof t.titleDefault === 'string' ? t.titleDefault
          : typeof t.title === 'string' ? t.title : '',
        why: typeof t.why === 'string' ? t.why
          : typeof t.explanation === 'string' ? t.explanation : '',
        estimatedTime: typeof t.estimatedTime === 'string' ? t.estimatedTime : '',
        scanRelevant: !!t.scanRelevant,
        source: '__taskChainHealth',
      });
    }, Object.freeze({ id: null, title: '', why: '', estimatedTime: '', scanRelevant: false, source: 'none' }));

    const nextAction: NextAction = _safe(() => {
      const u = taskChain ? ((taskChain as any).value || taskChain).upcomingTask : null;
      if (!u) return Object.freeze({
        id: null, title: '', why: '', estimatedTime: '', source: 'none',
      });
      return Object.freeze({
        id: typeof u.id === 'string' ? u.id : null,
        title: typeof u.titleDefault === 'string' ? u.titleDefault
          : typeof u.title === 'string' ? u.title : '',
        why: typeof u.why === 'string' ? u.why : '',
        estimatedTime: typeof u.estimatedTime === 'string' ? u.estimatedTime : '',
        source: '__taskChainHealth',
      });
    }, Object.freeze({ id: null, title: '', why: '', estimatedTime: '', source: 'none' }));

    // ─── daysToHarvest ────────────────────────────────────────────────
    const daysToHarvest: number | null = _safe(() => {
      const a = _extract(growTime, 'daysToHarvest', 'daysRemaining');
      if (typeof a === 'number' && isFinite(a) && a >= 0) return Math.round(a);
      const b = _extract(lifecycle, 'daysToHarvest', 'daysRemaining');
      if (typeof b === 'number' && isFinite(b) && b >= 0) return Math.round(b);
      const c = _extract(agronomy, 'daysToHarvest');
      if (typeof c === 'number' && isFinite(c) && c >= 0) return Math.round(c);
      return null;
    }, null);

    // ─── marketDemand ─────────────────────────────────────────────────
    const marketDemand: MarketOut = _safe(() => {
      if (!market) return Object.freeze({
        level: 'unknown' as MarketDemand,
        recommendedSellingWindow: 'Not enough data yet',
        source: 'none',
      });
      const v: any = (market as any).value || market;
      const level: MarketDemand = typeof v.marketDemand === 'string'
        && ['low', 'medium', 'high'].indexOf(v.marketDemand) >= 0
        ? (v.marketDemand as MarketDemand) : 'unknown';
      return Object.freeze({
        level,
        recommendedSellingWindow: typeof v.recommendedSellingWindow === 'string'
          ? v.recommendedSellingWindow : 'Not enough data yet',
        source: '__marketIntelligenceCompositeHealth',
      });
    }, Object.freeze({
      level: 'unknown' as MarketDemand,
      recommendedSellingWindow: 'Not enough data yet',
      source: 'none',
    }));

    // ─── fundingMatches ────────────────────────────────────────────────
    const fundingMatches: ReadonlyArray<FundingMatch> = _safe(() => {
      if (!funding) return Object.freeze([]) as ReadonlyArray<FundingMatch>;
      const v: any = (funding as any).value || funding;
      const raw: any[] = Array.isArray(v.topMatches) ? v.topMatches
        : Array.isArray(v.matches) ? v.matches : [];
      const out: FundingMatch[] = [];
      for (const m of raw) {
        if (!m || typeof m !== 'object') continue;
        out.push(Object.freeze({
          matched: !!(m.matched || m.eligible || true),
          label: typeof m.label === 'string' ? m.label
            : typeof m.title === 'string' ? m.title : 'Funding match',
          reason: typeof m.reason === 'string' ? m.reason
            : typeof m.why === 'string' ? m.why : 'Match available.',
          source: '__fundingHealth',
        }));
        if (out.length >= 5) break;
      }
      // Fall back to a single aggregate entry if probe only exposes summary.
      if (out.length === 0 && v.matched === true) {
        out.push(Object.freeze({
          matched: true,
          label: typeof v.matchLabel === 'string' ? v.matchLabel : 'Match available',
          reason: typeof v.matchReason === 'string' ? v.matchReason
            : 'Funding program matches your farm profile.',
          source: '__fundingHealth',
        }));
      }
      return Object.freeze(out) as ReadonlyArray<FundingMatch>;
    }, Object.freeze([]) as ReadonlyArray<FundingMatch>);

    // ─── sellReadiness ────────────────────────────────────────────────
    const sellReadiness: SellReadinessOut = _safe(() => {
      const unlocked = _safe(() => {
        if (dailyAssistant) {
          const v: any = (dailyAssistant as any).value || dailyAssistant;
          if (v.sellUnlocked === true) return true;
        }
        if (sellProbe) {
          const v: any = (sellProbe as any).value || sellProbe;
          if (v.harvestReady === true || v.sellReady === true) return true;
        }
        return false;
      }, false);
      const reason = unlocked
        ? 'Harvest is ready or post-harvest signals say it is time to sell.'
        : 'Sell unlocks after harvest. Keep growing.';
      return Object.freeze({ unlocked, reason });
    }, Object.freeze({ unlocked: false, reason: 'sell aggregator threw' }));

    // ─── latestOutcome ────────────────────────────────────────────────
    const latestOutcome: LatestOutcome = _safe(() => {
      if (!outcome && !outcomeLearning) return Object.freeze({
        kind: null, recordedAt: null, summary: 'No outcomes recorded yet.',
      });
      const v: any = outcome ? ((outcome as any).value || outcome)
        : ((outcomeLearning as any).value || outcomeLearning);
      const kind = typeof v.lastOutcomeKind === 'string' ? v.lastOutcomeKind
        : typeof v.latestKind === 'string' ? v.latestKind : null;
      return Object.freeze({
        kind,
        recordedAt: typeof v.lastRecordedAt === 'string' ? v.lastRecordedAt
          : typeof v.latestAt === 'string' ? v.latestAt : null,
        summary: typeof v.lastOutcomeSummary === 'string' ? v.lastOutcomeSummary
          : 'Outcome surface ready.',
      });
    }, Object.freeze({ kind: null, recordedAt: null, summary: 'outcome aggregator threw' }));

    // ─── latestScan ────────────────────────────────────────────────────
    const latestScan: LatestScan = _safe(() => {
      if (!scan) return Object.freeze({
        scanId: null, recordedAt: null, summary: 'No scans yet.',
        riskDelta: 'No change',
      });
      const v: any = (scan as any).value || scan;
      return Object.freeze({
        scanId: typeof v.lastScanId === 'string' ? v.lastScanId : null,
        recordedAt: typeof v.lastScanAt === 'string' ? v.lastScanAt : null,
        summary: typeof v.lastScanSummary === 'string' ? v.lastScanSummary
          : 'Scan surface ready.',
        riskDelta: typeof v.riskDelta === 'string' ? v.riskDelta : 'No change',
      });
    }, Object.freeze({ scanId: null, recordedAt: null, summary: 'scan aggregator threw', riskDelta: 'unknown' }));

    // ─── progress ──────────────────────────────────────────────────────
    const progress: ProgressOut = _safe(() => {
      const v: any = taskProgress ? ((taskProgress as any).value || taskProgress) : null;
      const completed = (v && typeof v.completed === 'number') ? v.completed : 0;
      const total = (v && typeof v.total === 'number') ? v.total : 10;
      const percent = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;
      const stepLabel = `Step ${Math.min(completed + 1, total)} of ${total}`;
      return Object.freeze({ completed, total, percent, stepLabel });
    }, Object.freeze({ completed: 0, total: 10, percent: 0, stepLabel: 'Step 1 of 10' }));

    // ─── readiness flags ───────────────────────────────────────────────
    const cropReady = !!crop;
    const stageReady = !!cropStage;
    const healthReady = farmHealthOut.score !== null;
    const riskReady = riskLevelOut.level !== 'unknown';
    const actionReady = !!todayAction.id && !!todayAction.title;
    const harvestReady = typeof daysToHarvest === 'number';
    const fundingReady = !!funding;
    const marketReady = marketDemand.level !== 'unknown';
    const sellReady = sellReadiness.unlocked;
    const notificationReady = !!notification;

    const integratedCount = [cropReady, stageReady, healthReady, riskReady, actionReady,
      harvestReady, fundingReady, marketReady, sellReady, notificationReady].filter(Boolean).length;
    const confidence: Confidence = integratedCount >= 7 ? 'high'
      : integratedCount >= 3 ? 'medium' : 'low';

    const state: Readonly<CommandCenterState> = Object.freeze({
      crop, cropStage, farmHealth: farmHealthOut, riskLevel: riskLevelOut,
      daysToHarvest, todayAction, why: todayAction.why,
      estimatedTime: todayAction.estimatedTime, nextAction,
      marketDemand, fundingMatches, sellReadiness, latestOutcome, latestScan,
      progress, confidence,
      limitations:
        'Per-field "Not enough data yet" reflects genuine missing data, never silent fallback. ' +
        GUIDANCE_TAIL,
    });

    return Object.freeze<AggregatorResult>({
      state,
      composedFrom: Object.freeze(composed) as ReadonlyArray<string>,
      readinessFlags: Object.freeze({
        cropReady, stageReady, healthReady, riskReady, actionReady,
        harvestReady, fundingReady, marketReady, sellReady, notificationReady,
      }),
    });
  }, Object.freeze<AggregatorResult>({
    state: Object.freeze({
      crop: '', cropStage: '',
      farmHealth: Object.freeze({ score: null, band: 'unknown' as HealthBand, label: 'Not enough data yet' }),
      riskLevel: Object.freeze({ level: 'unknown' as RiskLevel, explanation: 'init', source: 'init' }),
      daysToHarvest: null,
      todayAction: Object.freeze({ id: null, title: '', why: '', estimatedTime: '', scanRelevant: false, source: 'init' }),
      why: '', estimatedTime: '',
      nextAction: Object.freeze({ id: null, title: '', why: '', estimatedTime: '', source: 'init' }),
      marketDemand: Object.freeze({ level: 'unknown' as MarketDemand, recommendedSellingWindow: 'Not enough data yet', source: 'init' }),
      fundingMatches: Object.freeze([]) as ReadonlyArray<FundingMatch>,
      sellReadiness: Object.freeze({ unlocked: false, reason: 'init' }),
      latestOutcome: Object.freeze({ kind: null, recordedAt: null, summary: 'init' }),
      latestScan: Object.freeze({ scanId: null, recordedAt: null, summary: 'init', riskDelta: 'init' }),
      progress: Object.freeze({ completed: 0, total: 10, percent: 0, stepLabel: 'init' }),
      confidence: 'low' as Confidence,
      limitations: 'Aggregator threw. ' + GUIDANCE_TAIL,
    }),
    composedFrom: Object.freeze([]) as ReadonlyArray<string>,
    readinessFlags: Object.freeze({
      cropReady: false, stageReady: false, healthReady: false, riskReady: false,
      actionReady: false, harvestReady: false, fundingReady: false,
      marketReady: false, sellReady: false, notificationReady: false,
    }),
  }));
}
