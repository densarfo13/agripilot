/**
 * FarmBrainRuntimeV2.ts — FARM_BRAIN_RUNTIME_V2.
 *
 * Every scan result passes through FarmBrain, which produces ONE canonical
 * decision envelope:
 *   { riskScore, confidenceScore, diseaseLikelihood, growthStage,
 *     nextAction, followUpTask }
 *
 * This is COMPOSITION, not new ML — it derives each field from the scan
 * envelope the engine already built plus the existing CropStage engine.
 * Honest nulls everywhere: when a signal is absent we return null, never a
 * fabricated score. Pure + frozen + never throws.
 *
 * Wired as the single chokepoint in scanDetectionEngine.analyzeScan so
 * there is NO bypass path — both the API result and the rule fallback are
 * returned through it.
 */
import { inferCropStage } from './CropStageEngine';

export const FARM_BRAIN_RUNTIME_V2_VERSION = 'farm-brain-runtime-v2';

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };
const _num = (v: unknown): number | null =>
  (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _str = (v: unknown): string | null => {
  const s = (v == null ? '' : String(v)).trim();
  return s ? s : null;
};
const _clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

const _HEALTHY = /healthy|no[_\s-]?issue|looks?\s+good|no\s+disease/i;
const _UNIDENTIFIED = /unclear|unknown|needs?\s+(confirmation|review|identification)/i;

export interface FarmBrainV2Envelope {
  version: string;
  riskScore: number | null;          // 0..100
  confidenceScore: number | null;    // 0..100
  diseaseLikelihood: number | null;  // 0..100
  growthStage: string | null;
  nextAction: string | null;
  followUpTask: Readonly<{ title: string; dueDate: string | null }> | null;
  trace: Readonly<{ inputs: string[]; notes: string }>;
}

function _confidenceScore(r: any): number | null {
  const pct = _num(r.confidencePct);
  if (pct != null) return _clamp(pct);
  const band = _str(r.confidence);
  if (band === 'high') return 85;
  if (band === 'medium') return 55;
  if (band === 'low') return 25;
  return null;
}

function _severityWeight(r: any): number {
  const sev = (_str(r.severity) || _str(r.urgency) || '').toLowerCase();
  if (sev === 'high' || sev === 'urgent') return 1.0;
  if (sev === 'medium') return 0.7;
  if (sev === 'low') return 0.45;
  return 0.6; // unknown severity → neutral
}

function _diseaseLikelihood(r: any, confidenceScore: number | null, inputs: string[]): number | null {
  // 1. Explicit disease-candidate score from the provider.
  const dc = Array.isArray(r.diseaseCandidates) ? r.diseaseCandidates[0] : null;
  const score = dc ? _num(dc.score) : null;
  if (score != null) { inputs.push('diseaseScore'); return _clamp(score <= 1 ? score * 100 : score); }
  const issue = _str(r.possibleIssue) || '';
  if (_HEALTHY.test(issue)) { inputs.push('healthy'); return 5; }
  if (!issue || _UNIDENTIFIED.test(issue)) return null; // honest: nothing identified
  // 2. Named issue but no provider score → use the ID confidence as a
  //    documented proxy (the model's confidence in the named issue).
  if (confidenceScore != null) { inputs.push('namedIssue+confidence'); return confidenceScore; }
  return null;
}

function _growthStage(r: any, ctx: any, inputs: string[]): string | null {
  const gs = r.growthStage;
  const fromResult = _str(gs && typeof gs === 'object' ? gs.stage : gs);
  if (fromResult && !/unknown/i.test(fromResult)) { inputs.push('result.growthStage'); return fromResult; }
  // Derive from crop + planting date when both are known (rare in pilot).
  const crop = _str((ctx && (ctx.cropName || ctx.crop)) || r.cropName || r.plantName);
  const planting = _str(ctx && (ctx.plantingDate || ctx.plantedAt));
  if (crop && planting) {
    const inferred = _safe(() => inferCropStage({ crop, plantingDate: planting } as any), null) as any;
    const stage = inferred && _str(inferred.stage);
    if (stage && !/unknown/i.test(stage)) { inputs.push('inferCropStage'); return stage; }
  }
  return null;
}

function _nextAction(r: any, inputs: string[]): string | null {
  const fromMythos = _str(r.mythosDecision && r.mythosDecision.nextAction);
  if (fromMythos) { inputs.push('mythos.nextAction'); return fromMythos; }
  const fromRec = Array.isArray(r.recommendedActions) ? _str(r.recommendedActions[0]) : null;
  if (fromRec) { inputs.push('recommendedActions'); return fromRec; }
  const fromTask = Array.isArray(r.suggestedTasks) && r.suggestedTasks[0]
    ? _str(r.suggestedTasks[0].title) : null;
  if (fromTask) { inputs.push('suggestedTasks'); return fromTask; }
  return null;
}

function _followUpTask(r: any, inputs: string[]): { title: string; dueDate: string | null } | null {
  const md = r.mythosDecision;
  if (md) {
    const title = _str(md.followUp) || _str(md.followUpTask && md.followUpTask.title);
    const dueDate = _str(md.followUpDate);
    if (title) { inputs.push('mythos.followUp'); return Object.freeze({ title, dueDate }); }
  }
  const tasks = Array.isArray(r.suggestedTasks) ? r.suggestedTasks : [];
  const fu = tasks.find((t: any) => t && (t.isFollowUp || /follow|again/i.test(String(t.title || ''))));
  if (fu && _str(fu.title)) {
    inputs.push('suggestedTasks.followUp');
    return Object.freeze({ title: _str(fu.title) as string, dueDate: _str(fu.dueAt) || _str(fu.dueDate) });
  }
  return null;
}

/** Run FarmBrain V2 over a scan result. Pure, frozen, never throws. */
export function runFarmBrainV2(scanResult: any, context: any = {}): Readonly<FarmBrainV2Envelope> {
  return _safe<Readonly<FarmBrainV2Envelope>>(() => {
    const r = (scanResult && typeof scanResult === 'object') ? scanResult : {};
    const ctx = (context && typeof context === 'object') ? context : {};
    const inputs: string[] = [];

    const confidenceScore = _confidenceScore(r);
    if (confidenceScore != null) inputs.push('confidence');
    const diseaseLikelihood = _diseaseLikelihood(r, confidenceScore, inputs);
    const sevW = _severityWeight(r);
    const riskScore = diseaseLikelihood != null ? _clamp(diseaseLikelihood * sevW) : null;
    const growthStage = _growthStage(r, ctx, inputs);
    const nextAction = _nextAction(r, inputs);
    const followUpTask = _followUpTask(r, inputs);

    return Object.freeze({
      version: FARM_BRAIN_RUNTIME_V2_VERSION,
      riskScore,
      confidenceScore,
      diseaseLikelihood,
      growthStage,
      nextAction,
      followUpTask,
      trace: Object.freeze({
        inputs: Object.freeze(inputs.slice()) as unknown as string[],
        notes: 'Composition over scan envelope + CropStage; honest nulls, no fabrication.',
      }),
    });
  }, Object.freeze({
    version: FARM_BRAIN_RUNTIME_V2_VERSION,
    riskScore: null, confidenceScore: null, diseaseLikelihood: null,
    growthStage: null, nextAction: null, followUpTask: null,
    trace: Object.freeze({ inputs: [], notes: 'fallback' }),
  }));
}

export const _internal = Object.freeze({ _confidenceScore, _diseaseLikelihood, _severityWeight });
export default runFarmBrainV2;
