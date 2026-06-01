/**
 * CommandCenterSelectors.ts — pure selectors that pages consume.
 *
 * Pages MUST consume these instead of probing upstream globals
 * directly. Every selector reads the latest aggregate snapshot via
 * aggregateCommandCenter() so callers see one consistent view.
 *
 * Self-contained: no React, no DOM, no localStorage. Frozen returns.
 */

import { aggregateCommandCenter } from './CommandCenterAggregator';
import type {
  CommandCenterState, TodayAction, NextAction, RiskOut, HealthOut,
  MarketOut, FundingMatch, SellReadinessOut, LatestOutcome, LatestScan,
  ProgressOut,
} from './CommandCenterContracts';

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };

/** Fresh snapshot — used internally by every selector. */
function _state(): Readonly<CommandCenterState> {
  return _safe(() => aggregateCommandCenter().state, null as any);
}

/** Top-line "what is the farmer growing" — for headers + voice prompts. */
export function selectCrop(): string {
  return _safe(() => _state()?.crop || '', '');
}
export function selectCropStage(): string {
  return _safe(() => _state()?.cropStage || '', '');
}

/** Farm health — band + numeric + label. */
export function selectFarmHealth(): Readonly<HealthOut> {
  return _safe(() => _state()?.farmHealth, Object.freeze({
    score: null, band: 'unknown' as const, label: 'Not enough data yet',
  }));
}

/** Overall risk + per-spec explanation/source attribution. */
export function selectRiskLevel(): Readonly<RiskOut> {
  return _safe(() => _state()?.riskLevel, Object.freeze({
    level: 'unknown' as const, explanation: 'init', source: 'init',
  }));
}

/** Days remaining until harvest, or null when not enough data. */
export function selectDaysToHarvest(): number | null {
  return _safe(() => _state()?.daysToHarvest ?? null, null);
}

/** Today's action — Home + Tasks + morning notification render the same. */
export function selectTodayAction(): Readonly<TodayAction> {
  return _safe(() => _state()?.todayAction, Object.freeze({
    id: null, title: '', why: '', estimatedTime: '',
    scanRelevant: false, source: 'init',
  }));
}

/** Why the action matters — drives copy on Home + Tasks. */
export function selectWhy(): string {
  return _safe(() => _state()?.why || '', '');
}

/** Estimated time string — drives copy on Home + Tasks. */
export function selectEstimatedTime(): string {
  return _safe(() => _state()?.estimatedTime || '', '');
}

/** What's next in the chain — drives Tasks "Next" and progress copy. */
export function selectNextAction(): Readonly<NextAction> {
  return _safe(() => _state()?.nextAction, Object.freeze({
    id: null, title: '', why: '', estimatedTime: '', source: 'init',
  }));
}

/** Market demand level + selling window — drives Sell + Notifications. */
export function selectMarketDemand(): Readonly<MarketOut> {
  return _safe(() => _state()?.marketDemand, Object.freeze({
    level: 'unknown' as const, recommendedSellingWindow: 'Not enough data yet',
    source: 'init',
  }));
}

/** Top funding matches — drives Funding "Top Matches" tile. */
export function selectFundingMatches(): ReadonlyArray<FundingMatch> {
  return _safe(() => _state()?.fundingMatches || [],
    Object.freeze([]) as ReadonlyArray<FundingMatch>);
}

/** Sell readiness — drives Sell branch (List vs Prepare Draft). */
export function selectSellReadiness(): Readonly<SellReadinessOut> {
  return _safe(() => _state()?.sellReadiness,
    Object.freeze({ unlocked: false, reason: 'init' }));
}

/** Latest recorded outcome — drives Activity timeline. */
export function selectLatestOutcome(): Readonly<LatestOutcome> {
  return _safe(() => _state()?.latestOutcome,
    Object.freeze({ kind: null, recordedAt: null, summary: 'init' }));
}

/** Latest scan + its risk-delta — drives Activity + Scan after-state. */
export function selectLatestScan(): Readonly<LatestScan> {
  return _safe(() => _state()?.latestScan,
    Object.freeze({ scanId: null, recordedAt: null, summary: 'init', riskDelta: 'init' }));
}

/** Progress snapshot — drives Tasks progress bar + Weekly review header. */
export function selectProgress(): Readonly<ProgressOut> {
  return _safe(() => _state()?.progress,
    Object.freeze({ completed: 0, total: 10, percent: 0, stepLabel: 'init' }));
}

/** §SPEC — composite Home/MyFarm "Farm Status" projection. */
export interface FarmStatusProjection {
  crop: string;
  stage: string;
  health: Readonly<HealthOut>;
  risk: Readonly<RiskOut>;
  daysToHarvest: number | null;
  harvestWindow: string;
}
export function selectFarmStatus(): Readonly<FarmStatusProjection> {
  return _safe(() => {
    const s = _state();
    if (!s) throw new Error('no state');
    const window = s.daysToHarvest === null ? 'Not enough data yet'
      : s.daysToHarvest === 0 ? 'Ready to harvest'
      : s.daysToHarvest <= 14 ? `~${s.daysToHarvest} days`
      : `~${s.daysToHarvest} days`;
    return Object.freeze({
      crop: s.crop, stage: s.cropStage, health: s.farmHealth,
      risk: s.riskLevel, daysToHarvest: s.daysToHarvest, harvestWindow: window,
    });
  }, Object.freeze({
    crop: '', stage: '',
    health: Object.freeze({ score: null, band: 'unknown' as const, label: 'Not enough data yet' }),
    risk: Object.freeze({ level: 'unknown' as const, explanation: 'init', source: 'init' }),
    daysToHarvest: null, harvestWindow: 'Not enough data yet',
  }));
}

/** §SPEC NOTIFICATION morning notification — same source as Home action. */
export interface MorningNotificationProjection {
  ready: boolean;
  greeting: string;
  todayLine: string;
  timeLine: string;
  action: Readonly<TodayAction>;
}
export function selectMorningNotification(firstName?: string | null): Readonly<MorningNotificationProjection> {
  return _safe(() => {
    const action = selectTodayAction();
    const ready = !!action.id && !!action.title;
    const safeName = (firstName && typeof firstName === 'string' && firstName.trim())
      ? firstName.trim() : '';
    const greeting = safeName ? `Good morning ${safeName}.` : 'Good morning.';
    const todayLine = ready
      ? `Today: ${action.title}`
      : 'Today: Check in on your plants.';
    const timeLine = ready && action.estimatedTime
      ? `Time: ${action.estimatedTime}.`
      : 'Time: A few minutes.';
    return Object.freeze({ ready, greeting, todayLine, timeLine, action });
  }, Object.freeze({
    ready: false,
    greeting: 'Good morning.',
    todayLine: 'Today: Check in on your plants.',
    timeLine: 'Time: A few minutes.',
    action: Object.freeze({
      id: null, title: '', why: '', estimatedTime: '',
      scanRelevant: false, source: 'init',
    }),
  }));
}

/** §SPEC FUNDING — top matches filtered + projected. */
export function selectFundingTopMatches(limit = 3): ReadonlyArray<FundingMatch> {
  return _safe(() => {
    const all = selectFundingMatches();
    const sliced = all.slice(0, Math.max(1, Math.min(limit, 10)));
    return Object.freeze(sliced) as ReadonlyArray<FundingMatch>;
  }, Object.freeze([]) as ReadonlyArray<FundingMatch>);
}
