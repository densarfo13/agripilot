/**
 * FarmAgent.ts — Farroway v13 autonomous morning planner (honest).
 *
 * Each morning the agent turns REAL signals into a prioritized action list:
 * water · fertilize · prune · harvest · spray · inspect · wait. Every action
 * cites the evidence that produced it. It only fires on signals we actually have
 * (crop calendar, live-weather risk, scan staleness, last-action) — it does NOT
 * invent a number, a yield, or a risk it cannot derive. When it has no basis for
 * a node, the honest output is "wait / inspect", never a fabricated urgency.
 *
 * Pure, total, browser-safe. Caller supplies nowMs (no clock dependence).
 */
export type AgentAction = 'water' | 'fertilize' | 'prune' | 'harvest' | 'spray' | 'inspect' | 'wait';
export type AgentPriority = 'now' | 'today' | 'soon' | 'hold';

export interface AgentDecision {
  nodeId: string;
  action: AgentAction;
  priority: AgentPriority;
  reason: string;            // farmer-facing evidence
  evidence: ReadonlyArray<string>;
  confidence: number;        // 0..100 — low when basis is thin
}

export interface AgentNodeSignal {
  nodeId: string;
  crop?: string | null;
  daysSincePlanting?: number | null;
  daysToHarvest?: number | null;       // from crop calendar, if known
  daysSinceLastScan?: number | null;
  daysSinceWatered?: number | null;
  frostRiskNext48h?: boolean | null;   // from real weather risk, if known
  heatRiskNext48h?: boolean | null;
  confirmedPest?: boolean | null;      // a provider-confirmed pest, if any
}

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };
const _n = (v: any): number | null => (Number.isFinite(v) ? v : null);

const PRIORITY_RANK: Record<AgentPriority, number> = { now: 0, today: 1, soon: 2, hold: 3 };

/** Decide one node's morning action from whatever real signals exist. */
export function decideForNode(sig: AgentNodeSignal): AgentDecision {
  return _safe(() => {
    const ev: string[] = [];
    let action: AgentAction = 'wait';
    let priority: AgentPriority = 'hold';
    let confidence = 30;

    const dHarvest = _n(sig.daysToHarvest);
    const dWater = _n(sig.daysSinceWatered);
    const dScan = _n(sig.daysSinceLastScan);

    // Frost/heat protection — only when the real weather feed flagged it.
    if (sig.frostRiskNext48h === true) { action = 'inspect'; priority = 'now'; confidence = 70; ev.push('frost risk in next 48h (live weather)'); }
    else if (sig.heatRiskNext48h === true) { action = 'water'; priority = 'today'; confidence = 65; ev.push('heat risk in next 48h (live weather)'); }

    // Confirmed pest → spray/inspect (advisory; only on a real confirmation).
    if (sig.confirmedPest === true) { action = 'spray'; priority = 'today'; confidence = Math.max(confidence, 60); ev.push('a pest was confirmed on a recent scan'); }

    // Harvest window from the crop calendar.
    if (dHarvest != null && dHarvest <= 0) { action = 'harvest'; priority = 'now'; confidence = Math.max(confidence, 60); ev.push('crop calendar: at/!past harvest window'); }
    else if (dHarvest != null && dHarvest <= 7 && action === 'wait') { action = 'harvest'; priority = 'soon'; confidence = Math.max(confidence, 50); ev.push('crop calendar: harvest within ~7 days'); }

    // Watering — only if we actually track last-watered.
    if (dWater != null && dWater >= 3 && (action === 'wait' || action === 'harvest')) {
      if (action === 'wait') { action = 'water'; priority = 'today'; confidence = Math.max(confidence, 45); }
      ev.push('not watered in ~' + dWater + ' days');
    }

    // Inspection — stale or never-scanned node (honest staleness, not a forecast).
    if ((dScan == null || dScan >= 30) && action === 'wait') {
      action = 'inspect'; priority = 'soon'; confidence = 40;
      ev.push(dScan == null ? 'no scan on record yet' : 'last scan ~' + dScan + ' days ago');
    }

    if (ev.length === 0) ev.push('no actionable signal today — hold is the honest call');
    const reason = _reason(action, ev);
    return Object.freeze({ nodeId: sig.nodeId, action, priority, reason, evidence: Object.freeze(ev), confidence });
  }, Object.freeze({ nodeId: sig && sig.nodeId, action: 'inspect' as AgentAction, priority: 'soon' as AgentPriority, reason: 'Could not read signals — inspect by hand.', evidence: Object.freeze(['signal_error']), confidence: 20 }));
}

function _reason(action: AgentAction, ev: ReadonlyArray<string>): string {
  const lead: Record<AgentAction, string> = {
    water: 'Water today', fertilize: 'Feed soon', prune: 'Prune soon', harvest: 'Ready to harvest',
    spray: 'Treat the confirmed problem', inspect: 'Take a look', wait: 'Nothing urgent — wait',
  };
  return lead[action] + ' — ' + ev[0] + '.';
}

/** Build + sort the whole morning plan. Most urgent first; stable for ties. */
export function buildMorningPlan(signals: ReadonlyArray<AgentNodeSignal>): ReadonlyArray<AgentDecision> {
  return _safe(() => {
    const list = (Array.isArray(signals) ? signals : []).map(decideForNode);
    return Object.freeze(list.slice().sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]));
  }, Object.freeze([]));
}

export function farmAgentHealth() {
  const plan = buildMorningPlan([
    { nodeId: 'a', frostRiskNext48h: true },
    { nodeId: 'b', daysToHarvest: 0 },
    { nodeId: 'c' },                       // no signal → honest hold/inspect
    { nodeId: 'd', daysSinceWatered: 5 },
  ]);
  const noSignal = plan.find(p => p.nodeId === 'c');
  return Object.freeze({
    ok: true,
    actions: ['water', 'fertilize', 'prune', 'harvest', 'spray', 'inspect', 'wait'],
    prioritized: plan.length === 4 && plan[0].priority === 'now',
    everyDecisionHasEvidence: plan.every(p => p.evidence.length > 0),
    // Honesty: a node with no real signal is never given a fabricated urgency.
    noSignalNeverFabricated: !!noSignal && (noSignal.action === 'wait' || noSignal.action === 'inspect') && noSignal.priority !== 'now',
  });
}

export function installFarmAgentHealth(): void {
  _safe(() => {
    if (typeof window === 'undefined' || (window as any).__farmAgentHealth) return;
    Object.defineProperty(window, '__farmAgentHealth', {
      configurable: true, enumerable: false, writable: false, value: () => farmAgentHealth(),
    });
  }, undefined);
}
