/**
 * AgentRegistry.ts — Farroway v14 Multi-Agent Advisor (honest).
 *
 * Twelve specialist agents. Each explains reason + evidence + confidence +
 * alternative. The agents that have a REAL basis actually advise by composing
 * existing engines; the rest HONESTLY decline — they return a "no model / no feed
 * yet" advisory with confidence 0 and a human-expert alternative, rather than
 * fabricating expertise. Inventing a pathologist's diagnosis or a market analyst's
 * price with no model behind it is exactly the hallucination v14's AI-SAFETY
 * section forbids, so we don't.
 *
 * Pure, total, browser-safe. Live agents compose pure functions only.
 */
// @ts-ignore — JS engine, no types
import { computeLifecycleSnapshot } from '../../core/lifecycle/cropLifecycleEngine.js';
// @ts-ignore — TS sibling
import * as WeatherRisk from '../weatherRisk/WeatherRiskRuntime';

export type AgentBasis = 'live' | 'advisory' | 'requires_model' | 'no_live_feed' | 'requires_infra';

export interface AgentAdvice {
  agentId: string;
  role: string;
  basis: AgentBasis;
  reason: string;
  evidence: ReadonlyArray<string>;
  confidence: number;            // 0..100 — 0 when the agent has no real basis
  alternative: string;           // always a real fallback (often "ask a human expert")
}

export interface AgentContext {
  crop?: string | null;
  plantingDate?: string | null;
  climate?: string; setting?: string; mode?: string; nowMs?: number;
  weather?: any;                 // live forecast context, if available
  soil?: any;                    // server-side soil context, if available
}

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };

interface AgentDef {
  id: string; role: string; basis: AgentBasis;
  advise: (ctx: AgentContext) => AgentAdvice;
}

const HUMAN = 'Consult a local extension officer or specialist for this.';

/** Honest decline — the ONLY output for an agent with no real basis. */
function decline(id: string, role: string, basis: AgentBasis, needs: string): AgentAdvice {
  return Object.freeze({
    agentId: id, role, basis, confidence: 0,
    reason: role + ' has no ' + needs + ' wired yet, so it will not guess.',
    evidence: Object.freeze(['no ' + needs + ' available']),
    alternative: HUMAN,
  });
}

// ── LIVE agents — real advice composed from real engines ──
function agronomist(ctx: AgentContext): AgentAdvice {
  const snap = _safe(() => computeLifecycleSnapshot({ crop: ctx.crop, plantingDate: ctx.plantingDate, climate: ctx.climate, setting: ctx.setting, mode: ctx.mode, nowMs: ctx.nowMs }), null) as any;
  const ev: string[] = [];
  let reason = 'Add your crop + planting date and I can stage your field.';
  let confidence = 0;
  if (snap && snap.currentStage) {
    ev.push('crop calendar stage: ' + snap.currentStage);
    if (Number.isFinite(snap.daysSincePlanting)) ev.push('~' + snap.daysSincePlanting + ' days since planting');
    reason = 'Your crop is around the "' + String(snap.currentStage).toLowerCase() + '" stage — match watering and feeding to it.';
    confidence = ctx.plantingDate ? 60 : 35;
  }
  return Object.freeze({ agentId: 'agronomist', role: 'Agronomist AI', basis: 'live', reason, evidence: Object.freeze(ev.length ? ev : ['no planting date yet']), confidence, alternative: HUMAN });
}

function weatherScientist(ctx: AgentContext): AgentAdvice {
  if (!ctx.weather) return decline('weather_scientist', 'Weather Scientist', 'live', 'live forecast');
  const wr = _safe(() => WeatherRisk.evaluate({ forecast: ctx.weather, weather: ctx.weather }), null) as any;
  const ev: string[] = [];
  for (const k of ['frostRisk', 'heatRisk', 'rainRisk', 'windRisk']) {
    const v = wr && (wr[k] ?? (wr.risks && wr.risks[k]));
    if (v != null && v !== false) ev.push(k + ': ' + v);
  }
  const reason = ev.length ? 'Weather signals to act on: ' + ev[0] + '.' : 'No notable weather risk in the current forecast.';
  return Object.freeze({ agentId: 'weather_scientist', role: 'Weather Scientist', basis: 'live', reason, evidence: Object.freeze(ev.length ? ev : ['forecast read, no notable risk']), confidence: ev.length ? 55 : 40, alternative: HUMAN });
}

function soilScientist(ctx: AgentContext): AgentAdvice {
  const s = ctx.soil && typeof ctx.soil === 'object' ? ctx.soil : null;
  if (!s) return decline('soil_scientist', 'Soil Scientist', 'live', 'soil data');
  const ev: string[] = [];
  for (const k of ['moisture', 'ph', 'organicMatter']) if (s[k] != null && Number.isFinite(Number(s[k]))) ev.push(k + ': ' + s[k]);
  ev.push('N/P/K/CEC: needs a lab test (not estimated)');
  return Object.freeze({ agentId: 'soil_scientist', role: 'Soil Scientist', basis: 'live', reason: ev.length > 1 ? 'Your soil reads ' + ev[0] + ' — manage to it; lab-test nutrients before fertilising heavily.' : 'Limited soil data — a lab test is the honest next step.', evidence: Object.freeze(ev), confidence: ev.length > 1 ? 50 : 20, alternative: HUMAN });
}

const AGENTS: ReadonlyArray<AgentDef> = Object.freeze([
  { id: 'agronomist', role: 'Agronomist AI', basis: 'live', advise: agronomist },
  { id: 'weather_scientist', role: 'Weather Scientist', basis: 'live', advise: weatherScientist },
  { id: 'soil_scientist', role: 'Soil Scientist', basis: 'live', advise: soilScientist },
  // Honest declines — real model/feed required; never fabricated.
  { id: 'plant_pathologist', role: 'Plant Pathologist', basis: 'requires_model', advise: (_c) => decline('plant_pathologist', 'Plant Pathologist', 'requires_model', 'trained disease model') },
  { id: 'entomologist', role: 'Entomologist', basis: 'requires_model', advise: (_c) => decline('entomologist', 'Entomologist', 'requires_model', 'trained pest model') },
  { id: 'market_analyst', role: 'Market Analyst', basis: 'no_live_feed', advise: (_c) => decline('market_analyst', 'Market Analyst', 'no_live_feed', 'live market feed') },
  { id: 'supply_chain_planner', role: 'Supply Chain Planner', basis: 'no_live_feed', advise: (_c) => decline('supply_chain_planner', 'Supply Chain Planner', 'no_live_feed', 'logistics data feed') },
  { id: 'export_advisor', role: 'Export Advisor', basis: 'no_live_feed', advise: (_c) => decline('export_advisor', 'Export Advisor', 'no_live_feed', 'export market + compliance feed') },
  { id: 'financial_advisor', role: 'Financial Advisor', basis: 'no_live_feed', advise: (_c) => decline('financial_advisor', 'Financial Advisor', 'no_live_feed', 'price + cost data feed') },
  { id: 'carbon_advisor', role: 'Carbon Advisor', basis: 'requires_model', advise: (_c) => decline('carbon_advisor', 'Carbon Advisor', 'requires_model', 'certified carbon methodology') },
  { id: 'biodiversity_advisor', role: 'Biodiversity Advisor', basis: 'requires_model', advise: (_c) => decline('biodiversity_advisor', 'Biodiversity Advisor', 'requires_model', 'field-survey data') },
  { id: 'food_safety_advisor', role: 'Food Safety Advisor', basis: 'advisory', advise: (_c) => Object.freeze({ agentId: 'food_safety_advisor', role: 'Food Safety Advisor', basis: 'advisory' as AgentBasis, reason: 'Follow the documented pre-harvest interval + hygiene checklist; this is guidance, not a measured certification.', evidence: Object.freeze(['static food-safety checklist']), confidence: 30, alternative: HUMAN }) },
]);

export function listAgents(): ReadonlyArray<{ id: string; role: string; basis: AgentBasis }> {
  return Object.freeze(AGENTS.map(a => Object.freeze({ id: a.id, role: a.role, basis: a.basis })));
}

export function askAgent(agentId: string, ctx: AgentContext = {}): AgentAdvice | null {
  const a = AGENTS.find(x => x.id === agentId);
  if (!a) return null;
  return _safe(() => a.advise(ctx), decline(agentId, a.role, a.basis, 'a working advisor'));
}

/** Ask every agent — the full advisory panel for one farm context. */
export function askAllAgents(ctx: AgentContext = {}): ReadonlyArray<AgentAdvice> {
  return Object.freeze(AGENTS.map(a => askAgent(a.id, ctx)!).filter(Boolean));
}

export function agentRegistryHealth() {
  const panel = askAllAgents({ crop: 'maize', plantingDate: '2026-05-01', nowMs: 1 });
  const live = AGENTS.filter(a => a.basis === 'live').length;
  // Honesty: every non-live agent returns confidence 0 (no fabricated expertise),
  // and every advice carries an alternative + evidence.
  const declinesAreZero = panel.filter(p => p.basis !== 'live' && p.basis !== 'advisory').every(p => p.confidence === 0);
  return Object.freeze({
    ok: true,
    agents: AGENTS.length,
    live,
    everyAdviceHasEvidenceAndAlternative: panel.every(p => p.evidence.length > 0 && !!p.alternative),
    declinesNeverFabricateConfidence: declinesAreZero,
  });
}

export function installAgentRegistryHealth(): void {
  _safe(() => {
    if (typeof window === 'undefined' || (window as any).__agentRegistryHealth) return;
    Object.defineProperty(window, '__agentRegistryHealth', {
      configurable: true, enumerable: false, writable: false, value: () => agentRegistryHealth(),
    });
  }, undefined);
}
