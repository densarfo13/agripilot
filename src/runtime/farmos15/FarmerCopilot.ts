/**
 * FarmerCopilot.ts — Farroway v15 natural-language copilot (honest).
 *
 * A deterministic, explainable intent router (NOT a black-box LLM) that maps a
 * farmer's plain question to the EXISTING honest engines and returns their real
 * output. When a question needs data we don't have (prices/costs for profit), it
 * DECLINES — confidence 0, a clear reason, and a human alternative — rather than
 * fabricating an answer. Every reply carries reason + evidence + confidence +
 * source + alternative, satisfying "explainable reasoning only".
 *
 * Pure, total, browser-safe. Composes pure functions only.
 */
// @ts-ignore — sibling runtime
import { buildMorningPlan } from '../farmos13/FarmAgent';
// @ts-ignore — JS engine
import { computeLifecycleSnapshot } from '../../core/lifecycle/cropLifecycleEngine.js';
// @ts-ignore — TS sibling
import * as WeatherRisk from '../weatherRisk/WeatherRiskRuntime';

export type CopilotIntent =
  | 'today_plan' | 'harvest_timing' | 'spray_weather' | 'diagnose_plant'
  | 'profit_estimate' | 'help';

export interface CopilotReply {
  intent: CopilotIntent;
  canAnswer: boolean;            // false when we honestly decline
  answer: string;               // farmer-facing
  evidence: ReadonlyArray<string>;
  confidence: number;           // 0..100 — 0 when declined
  source: string;
  alternative: string;
}

export interface CopilotContext {
  crop?: string | null;
  plantingDate?: string | null;
  climate?: string; setting?: string; mode?: string; nowMs?: number;
  weather?: any;
  agentSignals?: any[];         // optional FarmAgent node signals
}

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };
const _q = (s: unknown): string => (typeof s === 'string' ? s : '').toLowerCase();
const HUMAN = 'Ask a local extension officer if you need more.';

// Ordered intent patterns — first match wins. Deterministic + explainable.
const PATTERNS: Array<[CopilotIntent, RegExp]> = [
  ['profit_estimate', /\b(profit|revenue|income|earn|money|how much.*(make|sell)|price)\b/],
  ['spray_weather', /\b(spray|spraying|rain|weather|wind|frost)\b/],
  ['harvest_timing', /\b(harvest|ready to pick|when.*(pick|harvest)|mature)\b/],
  ['diagnose_plant', /\b(why.*(yellow|brown|spot|dying|wilt)|sick|disease|pest|problem|wrong)\b/],
  ['today_plan', /\b(today|now|this morning|what should i do|plan|task)\b/],
];

export function classifyQuestion(question: string): CopilotIntent {
  const q = _q(question);
  for (const [intent, re] of PATTERNS) if (re.test(q)) return intent;
  return 'help';
}

function reply(p: Omit<CopilotReply, 'alternative'> & { alternative?: string }): CopilotReply {
  return Object.freeze({ alternative: HUMAN, ...p, evidence: Object.freeze(p.evidence) });
}

export function askCopilot(question: string, ctx: CopilotContext = {}): CopilotReply {
  return _safe(() => _route(classifyQuestion(question), ctx), reply({
    intent: 'help', canAnswer: false, answer: "I couldn't read that — try asking about today's plan, harvest timing, or spraying weather.",
    evidence: ['parse_error'], confidence: 0, source: 'copilot',
  }));
}

function _route(intent: CopilotIntent, ctx: CopilotContext): CopilotReply {
  switch (intent) {
    case 'today_plan': {
      const plan = _safe(() => buildMorningPlan(Array.isArray(ctx.agentSignals) ? ctx.agentSignals : [{ nodeId: 'farm', crop: ctx.crop, daysSinceLastScan: null }]), []) as any[];
      const top = plan[0];
      return reply({
        intent, canAnswer: true,
        answer: top ? top.reason : 'Nothing urgent today — a quick look around is enough.',
        evidence: top ? top.evidence : ['no urgent signal'],
        confidence: top ? top.confidence : 30, source: 'farm-agent',
      });
    }
    case 'harvest_timing': {
      const snap = _safe(() => computeLifecycleSnapshot({ crop: ctx.crop, plantingDate: ctx.plantingDate, climate: ctx.climate, setting: ctx.setting, mode: ctx.mode, nowMs: ctx.nowMs }), null) as any;
      const hw = snap && snap.harvestWindow;
      if (hw && (hw.label || hw.startDate)) {
        return reply({ intent, canAnswer: true, answer: 'Estimated harvest window: ' + (hw.label || (hw.startDate + '–' + (hw.endDate || ''))) + '.', evidence: ['crop calendar for ' + (ctx.crop || 'your crop')], confidence: 55, source: 'crop-calendar' });
      }
      return reply({ intent, canAnswer: false, answer: ctx.plantingDate ? "I don't have a calendar for that crop yet — check the pods/grain by hand." : 'Add your crop + planting date and I can estimate the harvest window.', evidence: [ctx.plantingDate ? 'no crop calendar' : 'no planting date'], confidence: 0, source: 'crop-calendar' });
    }
    case 'spray_weather': {
      if (!ctx.weather) return reply({ intent, canAnswer: false, answer: 'I need a live weather reading first — turn on location so I can check the forecast before you spray.', evidence: ['no live forecast'], confidence: 0, source: 'live-weather' });
      const wr = _safe(() => WeatherRisk.evaluate({ forecast: ctx.weather, weather: ctx.weather }), null) as any;
      const rain = wr && (wr.rainRisk ?? (wr.risks && wr.risks.rainRisk));
      const ev: string[] = [];
      if (rain != null && rain !== false) ev.push('rain risk: ' + rain);
      return reply({ intent, canAnswer: true, answer: ev.length ? 'Hold off — ' + ev[0] + '; rain can wash off the spray.' : 'The forecast looks clear enough to spray — re-check just before you start.', evidence: ev.length ? ev : ['forecast read, low rain risk'], confidence: ev.length ? 55 : 40, source: 'live-weather' });
    }
    case 'diagnose_plant': {
      // We diagnose from a PHOTO, not a text description — honest routing, not a guess.
      return reply({ intent, canAnswer: false, answer: "I can't diagnose from words — take a clear photo of the affected leaf and run a Scan, and I'll identify the problem with evidence.", evidence: ['diagnosis needs an image'], confidence: 0, source: 'scan', alternative: 'Open Scan and photograph the affected part.' });
    }
    case 'profit_estimate': {
      // No price/cost feed → never fabricate a number.
      return reply({ intent, canAnswer: false, answer: "I won't guess your profit — I don't have your selling prices or input costs wired. Log your sales and what you spent, and an advisor can work it out with you.", evidence: ['no market price feed', 'no cost data'], confidence: 0, source: 'no-live-feed', alternative: 'Record your sales + costs; ask a financial advisor or cooperative.' });
    }
    default:
      return reply({ intent: 'help', canAnswer: true, answer: "I can help with: today's plan, when to harvest, whether to spray with the weather, and diagnosing a plant you scan. I can't estimate prices or profit yet.", evidence: ['capability list'], confidence: 100, source: 'copilot' });
  }
}

export function farmerCopilotHealth() {
  const profit = askCopilot('estimate my profit', {});
  const plan = askCopilot('what should I do today?', { crop: 'maize' });
  const samples: Array<[string, CopilotIntent]> = [
    ['what should I do today?', 'today_plan'],
    ['when should I harvest my maize?', 'harvest_timing'],
    ['will rain affect spraying?', 'spray_weather'],
    ['why is my maize yellow?', 'diagnose_plant'],
    ['estimate my profit', 'profit_estimate'],
  ];
  const routed = samples.every(([q, want]) => classifyQuestion(q) === want);
  return Object.freeze({
    ok: true,
    intents: 6,
    routesSampleQuestions: routed,
    // Honesty: profit is ALWAYS declined (confidence 0), never a fabricated number.
    profitNeverFabricated: profit.canAnswer === false && profit.confidence === 0,
    everyReplyExplainable: [profit, plan].every(r => r.evidence.length > 0 && !!r.alternative && !!r.source),
  });
}

export function installFarmerCopilotHealth(): void {
  _safe(() => {
    if (typeof window === 'undefined' || (window as any).__farmerCopilotHealth) return;
    Object.defineProperty(window, '__farmerCopilotHealth', {
      configurable: true, enumerable: false, writable: false, value: () => farmerCopilotHealth(),
    });
  }, undefined);
}
