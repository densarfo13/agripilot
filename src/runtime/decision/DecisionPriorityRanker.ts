/**
 * DecisionPriorityRanker.ts — FARROWAY DECISION ENGINE, §1 ranking.
 *
 * Ranks candidate decisions and returns exactly ONE primary + up to 3 supporting
 * insights, with NO conflicting actions. Priority = urgency weight × confidence.
 * Conflicts (e.g. "irrigate" vs "harvest now") are resolved by keeping the
 * higher-priority action and dropping the loser — never both.
 */
import { DecisionKind } from './FarrowayDecisionContracts';

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };

export interface Candidate {
  kind: DecisionKind;
  text: string;
  confidence: number;            // 0..100
  urgency: 'low' | 'medium' | 'high';
}

const URGENCY_W: Record<string, number> = { high: 3, medium: 2, low: 1 };

// Pairs of actions that must never co-occur (contradictory on the same crop).
const CONFLICTS: ReadonlyArray<ReadonlyArray<DecisionKind>> = Object.freeze([
  ['irrigate', 'harvest'],
  ['treat', 'harvest'],
  ['fertilize', 'harvest'],
]);

function _conflicts(a: DecisionKind, b: DecisionKind): boolean {
  return CONFLICTS.some(([x, y]) => (a === x && b === y) || (a === y && b === x));
}

export function rankDecisions(candidates: ReadonlyArray<Candidate>): {
  primary: Candidate | null;
  supporting: ReadonlyArray<Candidate>;
} {
  return _safe(() => {
    const list = (Array.isArray(candidates) ? candidates : [])
      .filter((c) => c && c.kind && typeof c.confidence === 'number')
      .map((c) => ({ ...c, _score: (URGENCY_W[c.urgency] || 1) * Math.max(0, Math.min(100, c.confidence)) }))
      .sort((a, b) => b._score - a._score);

    if (list.length === 0) return { primary: null, supporting: Object.freeze([]) };

    const primary = list[0];
    // Supporting: drop anything that conflicts with the primary or duplicates its kind.
    const supporting: Candidate[] = [];
    for (const c of list.slice(1)) {
      if (c.kind === primary.kind) continue;
      if (_conflicts(primary.kind, c.kind)) continue;
      if (supporting.some((s) => s.kind === c.kind || _conflicts(s.kind, c.kind))) continue;
      supporting.push(c);
      if (supporting.length >= 3) break;
    }
    const strip = (c: any) => ({ kind: c.kind, text: c.text, confidence: c.confidence, urgency: c.urgency });
    return { primary: strip(primary) as Candidate, supporting: Object.freeze(supporting.map(strip)) };
  }, { primary: null, supporting: Object.freeze([]) });
}
