/**
 * FarrowayDecisionContracts.ts — FARROWAY DECISION ENGINE.
 *
 * One connected daily decision system. Every farmer opens Farroway and learns:
 * what changed, what matters, what to do first, why, and what happens next.
 *
 * The engine COMPOSES FarmBrainState (the single source of truth) into ONE
 * primary daily decision. It never fabricates: when farm context is missing it
 * returns an honest empty-state decision with a CTA, never generic filler.
 */
export const DECISION_ENGINE_VERSION = 'farroway-decision-engine-v1';
export const DECISION_CONFIDENCE_MIN = 70;

/** Inputs — all optional; the engine degrades honestly. */
export interface DecisionInputs {
  farmBrainState?: any;                 // the canonical state (primary input)
  latestScan?: any;                     // most recent scan result
  cropStage?: string | null;
  weather?: any;                        // forecast + impact
  taskHistory?: ReadonlyArray<any>;
  outcomeHistory?: ReadonlyArray<any>;
  location?: any;
  marketSignal?: any | null;            // honest_null when no feed
  fundingSignal?: any | null;           // honest_null when no feed
  crop?: string | null;
  cropId?: string | null;
  farmId?: string | null;
  plantingDate?: string | null;
  todayISO?: string | null;            // caller-stamped "today"
}

export type DecisionKind =
  | 'inspect' | 'treat' | 'irrigate' | 'fertilize' | 'harvest'
  | 'scan' | 'add_crop' | 'add_planting_date' | 'review' | 'monitor';

/** A single supporting insight (max 3 alongside the primary decision). */
export interface SupportingInsight {
  kind: DecisionKind;
  text: string;
  confidence: number;
}

/** The §1 output shape. */
export interface DailyDecision {
  decisionId: string;
  dailyDecision: string;                // "Inspect 10 onion plants."
  kind: DecisionKind;
  priority: number;                     // 1 = highest
  reason: string;                       // farmer-facing, no jargon
  evidence: ReadonlyArray<string>;      // ✓ clear evidence lines (no provider names)
  confidence: number;                   // 0..100
  urgency: 'low' | 'medium' | 'high';
  estimatedTimeMin: number | null;
  expectedBenefit: string;
  nextStep: string;
  followUpDate: string | null;          // ISO date or null
  // Linkage (§1): every decision links to a task + an outcome path.
  taskRef: string;                      // task id/key this decision creates/links
  outcomePath: string;                  // the outcome this task rolls up to
  // Honest empty-state CTA (§6) — present only when farm context is missing.
  cta: { label: string; action: string } | null;
  isEmptyState: boolean;
  supportingInsights: ReadonlyArray<SupportingInsight>;
  // §7 dedupe key: farmId|cropId|decisionType|date|source.
  dedupeKey: string;
  source: string;
}

/** §4 feedback record. Stored; NOT used for learning until enough data. */
export interface DecisionFeedback {
  decisionId: string;
  farmId: string | null;
  crop: string | null;
  action: string;
  reason: string;
  confidence: number;
  outcome: 'better' | 'same' | 'worse' | 'not_sure';
  createdAt: string;
}

export const FEEDBACK_OPTIONS = Object.freeze(['better', 'same', 'worse', 'not_sure']);

/** Empty-state CTAs (§6) — every one carries a next action. */
export const EMPTY_STATE_CTAS = Object.freeze({
  missing_crop: { label: 'Add your crop to get today’s decision.', action: 'add_crop' },
  missing_planting_date: { label: 'Add planting date to estimate crop stage.', action: 'add_planting_date' },
  no_scan: { label: 'Run your first scan to improve crop health guidance.', action: 'scan' },
});
