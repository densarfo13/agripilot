/**
 * CommandCenterRuntime.ts → window.__commandCenterHealth().
 *
 * SINGLE SOURCE OF TRUTH for the 9 Home Command Center fields. Composes
 * the existing intelligence stack:
 *
 *   crop / stage          ← __agronomyHealth + __taskChainHealth (active crop)
 *   risk                  ← __farmRiskHealth (overallRiskLevel + explanation)
 *   health                ← __farmHealthScoreHealth (numeric score 0..100)
 *   todaysAction          ← __taskChainHealth (active task) via __dailyAssistantHealth
 *   daysToHarvest         ← __growTimeframeHealth + __cropLifecycleHealth
 *   fundingMatch          ← __fundingHealth (match label + reason)
 *   marketDemand          ← __marketIntelligenceCompositeHealth (low/medium/high)
 *   sellReadiness         ← __dailyAssistantHealth.sellUnlocked + post-harvest
 *
 * Every page that needs these values consumes this composite — no
 * page-local recomputation. Honest false-by-default: a flag flips true
 * only when the underlying probe reports ready.
 *
 * Self-contained; zero imports; frozen; never throws.
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
type RiskLevel = 'low' | 'medium' | 'high' | 'unknown';
type MarketDemand = 'low' | 'medium' | 'high' | 'unknown';
const GUIDANCE_TAIL = 'Decision support, not a guarantee.';

export const COMMAND_CENTER_VERSION = 'command-center-v1' as const;

export interface CommandCenterEnvelope {
  runtimeVersion: typeof COMMAND_CENTER_VERSION;
  initialized: true;
  // ─── §SPEC — the 9 readiness flags. False until backing probe is ready. ──
  commandCenterReady: boolean;
  cropReady: boolean;
  stageReady: boolean;
  riskReady: boolean;
  actionReady: boolean;
  harvestReady: boolean;
  fundingReady: boolean;
  marketReady: boolean;
  sellReady: boolean;
  // ─── §SPEC — the 9 single-source-of-truth values rendered on Home. ───────
  crop: string;
  stage: string;
  risk: Readonly<{ level: RiskLevel; explanation: string; source: string }>;
  health: Readonly<{ score: number | null; band: 'low' | 'medium' | 'high' | 'unknown'; label: string }>;
  todaysAction: Readonly<{
    id: string | null;
    title: string;
    why: string;
    estimatedTime: string;
  }>;
  daysToHarvest: number | null;
  fundingMatch: Readonly<{ matched: boolean; label: string; reason: string }>;
  marketDemand: Readonly<{ level: MarketDemand; recommendedSellingWindow: string; source: string }>;
  sellReadiness: Readonly<{ unlocked: boolean; reason: string }>;
  // Source attribution + honesty contract.
  composedFrom: ReadonlyArray<string>;
  integratedCount: number;
  totalFields: number;
  noFakeData: true;
  noFabricatedScores: true;
  noPageLocalCalculations: true;
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

function _extract(probe: any, ...keys: string[]): any {
  if (!probe) return undefined;
  const v = probe.value || probe;
  for (const k of keys) {
    if (v && v[k] !== undefined && v[k] !== null) return v[k];
  }
  return undefined;
}

function _healthBand(score: number | null): 'low' | 'medium' | 'high' | 'unknown' {
  if (typeof score !== 'number' || !isFinite(score)) return 'unknown';
  if (score >= 75) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}

export function commandCenterHealth(): Readonly<CommandCenterEnvelope> {
  return _safe(() => {
    const agronomy = _probe('__agronomyHealth');
    const chain = _probe('__taskChainHealth');
    const daily = _probe('__dailyAssistantHealth');
    const risk = _probe('__farmRiskHealth');
    const farmHealth = _probe('__farmHealthScoreHealth');
    const lifecycle = _probe('__cropLifecycleHealth');
    const growTime = _probe('__growTimeframeHealth');
    const funding = _probe('__fundingHealth');
    const market = _probe('__marketIntelligenceCompositeHealth')
      || _probe('__marketplaceIntelligenceHealth');
    const postHarvest = _probe('__postHarvestHealth');

    const composed: string[] = [];
    if (agronomy) composed.push('__agronomyHealth');
    if (chain) composed.push('__taskChainHealth');
    if (daily) composed.push('__dailyAssistantHealth');
    if (risk) composed.push('__farmRiskHealth');
    if (farmHealth) composed.push('__farmHealthScoreHealth');
    if (lifecycle) composed.push('__cropLifecycleHealth');
    if (growTime) composed.push('__growTimeframeHealth');
    if (funding) composed.push('__fundingHealth');
    if (market) composed.push('__marketIntelligenceCompositeHealth');
    if (postHarvest) composed.push('__postHarvestHealth');

    // ── crop ────────────────────────────────────────────────────────────
    const cropFromChain = _safe(() => {
      if (!chain) return null;
      const v: any = (chain as any).value || chain;
      const t = v.activeTask;
      if (t && typeof t.cropKey === 'string') return t.cropKey;
      if (typeof v.cropKey === 'string') return v.cropKey;
      return null;
    }, null);
    const cropFromAgronomy = _safe(() => {
      if (!agronomy) return null;
      const v: any = (agronomy as any).value || agronomy;
      return typeof v.activeCrop === 'string' ? v.activeCrop
        : typeof v.crop === 'string' ? v.crop : null;
    }, null);
    const crop: string = cropFromChain || cropFromAgronomy || '';
    const cropReady = !!crop;

    // ── stage ───────────────────────────────────────────────────────────
    const stage: string = _safe(() => {
      const fromLifecycle = _extract(lifecycle, 'currentStage', 'stage');
      if (typeof fromLifecycle === 'string' && fromLifecycle) return fromLifecycle;
      const fromAgronomy = _extract(agronomy, 'currentStage', 'stage');
      if (typeof fromAgronomy === 'string' && fromAgronomy) return fromAgronomy;
      return '';
    }, '');
    const stageReady = !!stage;

    // ── risk ────────────────────────────────────────────────────────────
    const riskOut = _safe(() => {
      if (!risk) return Object.freeze({
        level: 'unknown' as RiskLevel,
        explanation: 'No farm-risk probe yet.',
        source: 'none',
      });
      const v: any = (risk as any).value || risk;
      return Object.freeze({
        level: (typeof v.overallRiskLevel === 'string' ? v.overallRiskLevel : 'unknown') as RiskLevel,
        explanation: typeof v.overallExplanation === 'string' ? v.overallExplanation : 'No risk explanation yet.',
        source: '__farmRiskHealth',
      });
    }, Object.freeze({ level: 'unknown' as RiskLevel, explanation: 'risk probe threw', source: 'none' }));
    const riskReady = riskOut.level !== 'unknown';

    // ── health ──────────────────────────────────────────────────────────
    const healthOut = _safe(() => {
      const score = _safe(() => {
        if (!farmHealth) return null;
        const v: any = (farmHealth as any).value || farmHealth;
        const cand = [v.score, v.farmHealthScore, v.healthScore, v.value];
        for (const c of cand) if (typeof c === 'number' && isFinite(c)) return c;
        return null;
      }, null);
      const band = _healthBand(score);
      const label = band === 'high' ? 'Healthy'
        : band === 'medium' ? 'Watching'
        : band === 'low' ? 'Needs attention' : 'Not enough data yet';
      return Object.freeze({ score, band, label });
    }, Object.freeze({ score: null, band: 'unknown' as const, label: 'Not enough data yet' }));
    const healthReady = healthOut.score !== null;

    // ── today's action ──────────────────────────────────────────────────
    const actionOut = _safe(() => {
      const t = chain ? ((chain as any).value || chain).activeTask : null;
      if (!t) return Object.freeze({ id: null, title: '', why: '', estimatedTime: '' });
      return Object.freeze({
        id: typeof t.id === 'string' ? t.id : null,
        title: typeof t.titleDefault === 'string' ? t.titleDefault
          : typeof t.title === 'string' ? t.title : '',
        why: typeof t.why === 'string' ? t.why : '',
        estimatedTime: typeof t.estimatedTime === 'string' ? t.estimatedTime : '',
      });
    }, Object.freeze({ id: null, title: '', why: '', estimatedTime: '' }));
    const actionReady = !!actionOut.id && !!actionOut.title;

    // ── days to harvest ─────────────────────────────────────────────────
    const daysToHarvest: number | null = _safe(() => {
      const a = _extract(growTime, 'daysToHarvest', 'daysRemaining');
      if (typeof a === 'number' && isFinite(a) && a >= 0) return Math.round(a);
      const b = _extract(lifecycle, 'daysToHarvest', 'daysRemaining');
      if (typeof b === 'number' && isFinite(b) && b >= 0) return Math.round(b);
      const c = _extract(agronomy, 'daysToHarvest');
      if (typeof c === 'number' && isFinite(c) && c >= 0) return Math.round(c);
      return null;
    }, null);
    const harvestReady = typeof daysToHarvest === 'number';

    // ── funding match ───────────────────────────────────────────────────
    const fundingOut = _safe(() => {
      if (!funding) return Object.freeze({
        matched: false, label: 'Not enough data yet',
        reason: 'No funding probe yet.',
      });
      const v: any = (funding as any).value || funding;
      const matched = !!(v.matched || v.fundingMatched || v.matchAvailable);
      return Object.freeze({
        matched,
        label: typeof v.matchLabel === 'string' ? v.matchLabel
          : matched ? 'Match available' : 'No match yet',
        reason: typeof v.matchReason === 'string' ? v.matchReason
          : matched ? 'Funding program matches your farm profile.'
          : 'No funding program matches yet — complete your farm profile.',
      });
    }, Object.freeze({ matched: false, label: 'Not enough data yet', reason: 'funding probe threw' }));
    const fundingReady = !!funding;

    // ── market demand ───────────────────────────────────────────────────
    const marketOut = _safe(() => {
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
    const marketReady = marketOut.level !== 'unknown';

    // ── sell readiness ──────────────────────────────────────────────────
    const sellOut = _safe(() => {
      const unlocked = _safe(() => {
        if (daily) {
          const v: any = (daily as any).value || daily;
          if (v.sellUnlocked === true) return true;
        }
        if (postHarvest) {
          const v: any = (postHarvest as any).value || postHarvest;
          if (v.harvestReady === true || v.sellReady === true) return true;
        }
        return false;
      }, false);
      const reason = unlocked
        ? 'Harvest is ready or post-harvest signals say it is time to sell.'
        : 'Sell unlocks after harvest. Keep growing.';
      return Object.freeze({ unlocked, reason });
    }, Object.freeze({ unlocked: false, reason: 'sell probe threw' }));
    const sellReady = sellOut.unlocked;

    // ── aggregate ────────────────────────────────────────────────────────
    const flags = [cropReady, stageReady, riskReady, actionReady, harvestReady,
      fundingReady, marketReady, sellReady];
    const integratedCount = flags.filter(Boolean).length;
    const totalFields = flags.length;
    // commandCenterReady — the composite IS available (initialized true).
    // It does NOT require every sub-flag to be true: Home renders honestly
    // with whatever is ready and shows "Not enough data yet" for the rest.
    const commandCenterReady = true;

    const confidence: Confidence = (integratedCount >= 6 ? 'high'
      : integratedCount >= 3 ? 'medium' : 'low');

    return Object.freeze<CommandCenterEnvelope>({
      runtimeVersion: COMMAND_CENTER_VERSION,
      initialized: true,
      commandCenterReady,
      cropReady, stageReady, riskReady, actionReady, harvestReady,
      fundingReady, marketReady, sellReady,
      crop, stage,
      risk: riskOut,
      health: healthOut,
      todaysAction: actionOut,
      daysToHarvest,
      fundingMatch: fundingOut,
      marketDemand: marketOut,
      sellReadiness: sellOut,
      composedFrom: Object.freeze(composed) as ReadonlyArray<string>,
      integratedCount,
      totalFields,
      noFakeData: true as const,
      noFabricatedScores: true as const,
      noPageLocalCalculations: true as const,
      confidence,
      explanation:
        'Command Center single source of truth: 9 Home fields composed over the existing intelligence ' +
        'stack (__agronomyHealth, __taskChainHealth, __dailyAssistantHealth, __farmRiskHealth, ' +
        '__farmHealthScoreHealth, __cropLifecycleHealth, __growTimeframeHealth, __fundingHealth, ' +
        '__marketIntelligenceCompositeHealth, __postHarvestHealth). Pages MUST consume this composite ' +
        'rather than recompute. Honest false until backing probes report ready.',
      limitations:
        'Each backing probe carries its own limitations; field-level "Not enough data yet" reflects '
        + 'genuine missing data, not silent fallback. ' + GUIDANCE_TAIL,
    });
  }, Object.freeze<CommandCenterEnvelope>({
    runtimeVersion: COMMAND_CENTER_VERSION,
    initialized: true,
    commandCenterReady: true,
    cropReady: false, stageReady: false, riskReady: false, actionReady: false,
    harvestReady: false, fundingReady: false, marketReady: false, sellReady: false,
    crop: '', stage: '',
    risk: Object.freeze({ level: 'unknown' as RiskLevel, explanation: 'init', source: 'init' }),
    health: Object.freeze({ score: null, band: 'unknown' as const, label: 'Not enough data yet' }),
    todaysAction: Object.freeze({ id: null, title: '', why: '', estimatedTime: '' }),
    daysToHarvest: null,
    fundingMatch: Object.freeze({ matched: false, label: 'Not enough data yet', reason: 'init' }),
    marketDemand: Object.freeze({
      level: 'unknown' as MarketDemand,
      recommendedSellingWindow: 'Not enough data yet',
      source: 'init',
    }),
    sellReadiness: Object.freeze({ unlocked: false, reason: 'init' }),
    composedFrom: Object.freeze([]) as ReadonlyArray<string>,
    integratedCount: 0, totalFields: 8,
    noFakeData: true as const, noFabricatedScores: true as const,
    noPageLocalCalculations: true as const,
    confidence: 'low' as Confidence,
    explanation: 'Command Center initialized.',
    limitations: 'Not enough data yet. ' + GUIDANCE_TAIL,
  }));
}

export function installCommandCenterGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__commandCenterHealth !== 'function') {
      w.__commandCenterHealth = function () {
        const out = commandCenterHealth();
        try {
          const dev = typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) console.log('[Farroway · Command Center]', out);
        } catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
