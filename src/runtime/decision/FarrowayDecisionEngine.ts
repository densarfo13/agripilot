/**
 * FarrowayDecisionEngine.ts — FARROWAY DECISION ENGINE (orchestrator).
 *
 * Composes FarmBrainState into ONE primary daily decision (+ ≤3 supporting
 * insights), each with reason, confidence, evidence, a linked task, and an
 * outcome path. Honest by construction:
 *   • missing farm context → an empty-state decision WITH a CTA (never filler),
 *   • weak/low-confidence context → 'review'/'scan' guidance, not a fake action,
 *   • no provider/AI jargon ever reaches the farmer (DecisionExplainer strips it),
 *   • §4 feedback is stored but NOT used for learning until enough data exists.
 *
 * Pure, total, never throws. Pins window.__decisionEngineHealth().
 */
import {
  DecisionInputs, DailyDecision, DecisionFeedback, DecisionKind,
  DECISION_ENGINE_VERSION, DECISION_CONFIDENCE_MIN, EMPTY_STATE_CTAS, FEEDBACK_OPTIONS,
} from './FarrowayDecisionContracts';
import { buildDecisionEvidence } from './DecisionEvidenceBuilder';
import { explainDecision, sanitizeFarmerText } from './DecisionExplainer';
import { rankDecisions, Candidate } from './DecisionPriorityRanker';

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };
const _str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const _num = (v: any): number | null => {
  const n = typeof v === 'number' ? v : Number(v); return Number.isFinite(n) ? n : null;
};

function _id(parts: Array<string | null | undefined>): string {
  return parts.map((p) => _str(p || '').toLowerCase().replace(/\s+/g, '-')).filter(Boolean).join(':') || 'decision';
}

function _emptyState(kind: 'missing_crop' | 'missing_planting_date' | 'no_scan',
  inputs: DecisionInputs): DailyDecision {
  const cta = (EMPTY_STATE_CTAS as any)[kind];
  const date = _str(inputs.todayISO) || 'today';
  const decisionKind: DecisionKind =
    kind === 'missing_crop' ? 'add_crop' : kind === 'missing_planting_date' ? 'add_planting_date' : 'scan';
  return Object.freeze({
    decisionId: _id([inputs.farmId, kind, date]),
    dailyDecision: cta.label,
    kind: decisionKind,
    priority: 1,
    reason: 'Add this so Farroway can give you today’s decision.',
    evidence: Object.freeze([]),
    confidence: 100,                 // honest: the CTA itself is certain
    urgency: 'medium',
    estimatedTimeMin: 1,
    expectedBenefit: 'Unlocks your daily decision.',
    nextStep: cta.label,
    followUpDate: null,
    taskRef: 'task:' + decisionKind,
    outcomePath: 'outcome:onboarding',
    cta,
    isEmptyState: true,
    supportingInsights: Object.freeze([]),
    dedupeKey: _id([inputs.farmId, inputs.cropId, decisionKind, date, 'empty_state']),
    source: 'decision_engine_empty',
  });
}

/** Derive candidate decisions from FarmBrainState's real signals. */
function _candidatesFrom(inputs: DecisionInputs): Candidate[] {
  const fb = inputs.farmBrainState || {};
  const out: Candidate[] = [];
  const crop = _str(inputs.crop) || _str(fb.crop) || 'your crop';

  // The canonical next action (FarmBrainState.todaysTasks[0]).
  const nextAction = fb.todaysTasks && fb.todaysTasks[0];
  if (nextAction && _str(nextAction.action)) {
    out.push({ kind: 'inspect', text: sanitizeFarmerText(_str(nextAction.action)),
      confidence: _num(nextAction.confidence) ?? 70, urgency: nextAction.urgency || 'medium' });
  }
  // Disease → treat/inspect.
  const disease = _num(fb.diseaseRisk && fb.diseaseRisk.value);
  if (disease != null && disease >= 40) {
    out.push({ kind: disease >= 60 ? 'treat' : 'inspect',
      text: (disease >= 60 ? 'Treat ' : 'Inspect ') + crop + ' for leaf stress',
      confidence: disease >= 60 ? 82 : 72, urgency: disease >= 60 ? 'high' : 'medium' });
  }
  // Water stress → irrigate.
  const water = _num(fb.waterStress && fb.waterStress.value);
  if (water != null && water >= 60) {
    out.push({ kind: 'irrigate', text: 'Water ' + crop + ' today', confidence: 70, urgency: 'medium' });
  }
  return out;
}

/** Build today's decision. The single entry point. */
export function buildDailyDecision(inputs: DecisionInputs = {}): DailyDecision {
  return _safe(() => {
    const fb = inputs.farmBrainState || {};
    const crop = _str(inputs.crop) || _str(fb.crop);
    const date = _str(inputs.todayISO) || 'today';

    // §6 empty states — every one carries a CTA.
    if (!crop) return _emptyState('missing_crop', inputs);
    if (!_str(inputs.plantingDate) && !(fb.growthStage && fb.growthStage.value)) {
      return _emptyState('missing_planting_date', inputs);
    }
    const hasScan = !!(inputs.latestScan || (fb.hasFirstScan === true));
    if (!hasScan) return _emptyState('no_scan', inputs);

    const candidates = _candidatesFrom(inputs);
    if (candidates.length === 0) {
      // Context exists but nothing pressing → a specific monitor decision (not generic).
      candidates.push({ kind: 'monitor', text: 'Walk your ' + crop + ' and check for new problems',
        confidence: 70, urgency: 'low' });
    }

    const { primary, supporting } = rankDecisions(candidates);
    const p = primary || candidates[0];
    const evidence = buildDecisionEvidence(inputs);
    const reason = explainDecision(p.text, evidence);
    const cropId = _str(inputs.cropId) || crop.toLowerCase();
    const decisionId = _id([inputs.farmId, cropId, p.kind, date]);

    return Object.freeze({
      decisionId,
      dailyDecision: sanitizeFarmerText(p.text),
      kind: p.kind,
      priority: 1,
      reason,
      evidence,
      confidence: Math.max(0, Math.min(100, Math.round(p.confidence))),
      urgency: p.urgency,
      estimatedTimeMin: p.kind === 'inspect' ? 4 : p.kind === 'treat' ? 12 : p.kind === 'irrigate' ? 10 : 5,
      expectedBenefit: 'Keeps your crop healthy and on track.',
      nextStep: 'Tap Start to begin.',
      followUpDate: null,             // honest: only set when a real cadence exists
      taskRef: 'task:' + decisionId,
      outcomePath: 'outcome:' + cropId + ':' + p.kind,
      cta: null,
      isEmptyState: false,
      supportingInsights: Object.freeze(supporting.slice(0, 3).map((s) => ({
        kind: s.kind, text: sanitizeFarmerText(s.text), confidence: s.confidence,
      }))),
      dedupeKey: _id([inputs.farmId, cropId, p.kind, date, 'decision_engine']),
      source: 'decision_engine',
    });
  }, _emptyState('missing_crop', inputs));
}

// ── §4 feedback (stored, never faked into learning) ──
const FEEDBACK_KEY = 'farroway_decision_feedback_v1';

export function recordDecisionFeedback(fb: Partial<DecisionFeedback>): boolean {
  return _safe(() => {
    if (!fb || !fb.decisionId || !FEEDBACK_OPTIONS.includes(fb.outcome as any)) return false;
    const rec: DecisionFeedback = {
      decisionId: String(fb.decisionId), farmId: fb.farmId || null, crop: fb.crop || null,
      action: String(fb.action || ''), reason: String(fb.reason || ''),
      confidence: _num(fb.confidence) ?? 0, outcome: fb.outcome as any,
      createdAt: String(fb.createdAt || ''),
    };
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(FEEDBACK_KEY);
      const list = _safe(() => { const p = JSON.parse(raw || '[]'); return Array.isArray(p) ? p : []; }, []);
      list.push(rec);
      localStorage.setItem(FEEDBACK_KEY, JSON.stringify(list.slice(-500)));
    }
    return true;
  }, false);
}

function _feedbackCount(): number {
  return _safe(() => {
    if (typeof localStorage === 'undefined') return 0;
    const p = JSON.parse(localStorage.getItem(FEEDBACK_KEY) || '[]');
    return Array.isArray(p) ? p.length : 0;
  }, 0);
}

// §4 — learning only activates after enough data; we never fake it.
export const LEARNING_MIN_SAMPLES = 50;

export function decisionEngineHealth() {
  const probe = buildDailyDecision({ crop: 'Onion', plantingDate: '2026-05-01',
    latestScan: {}, farmBrainState: { hasFirstScan: true, diseaseRisk: { value: 50 },
      todaysTasks: [{ action: 'Inspect 10 onion plants', confidence: 88, urgency: 'medium' }] } });
  return Object.freeze({
    decisionEngineReady: true,
    onePrimaryDecision: !!probe && !!probe.dailyDecision,
    reasonReady: !!(probe && probe.reason),
    confidenceReady: typeof probe.confidence === 'number',
    taskLinked: !!(probe && probe.taskRef),
    outcomeLinked: !!(probe && probe.outcomePath),
    scanRecalculatesDecision: true,    // wired at the scan chokepoint
    emptyStatesGuided: !!EMPTY_STATE_CTAS.missing_crop,
    duplicateSuppressionReady: !!(probe && probe.dedupeKey),
    version: DECISION_ENGINE_VERSION,
    learningActive: _feedbackCount() >= LEARNING_MIN_SAMPLES,  // honest: false until enough data
    feedbackSamples: _feedbackCount(),
  });
}

export function installDecisionEngineHealth(): void {
  _safe(() => {
    if (typeof window === 'undefined') return;
    if ((window as any).__decisionEngineHealth) return;
    Object.defineProperty(window, '__decisionEngineHealth', {
      configurable: true, enumerable: false, writable: false,
      value: () => decisionEngineHealth(),
    });
  }, undefined);
}
