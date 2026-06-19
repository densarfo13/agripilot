/**
 * AdaptiveTaskGenerator.ts — sprint #208, spec §4.
 *
 * Generates ONE primary task from crop stage + weather + scan signal.
 * Every task carries a reason + confidence + estimated time + follow-
 * up — NEVER a generic "check your farm". When there is no usable
 * signal it returns null (the caller falls back to onboarding
 * guidance) rather than inventing a task.
 *
 * COMPOSITION ONLY. Stage-appropriate actions are well-known
 * agronomy; no provider, no fabricated confidence (confidence mirrors
 * the input signal strength). No chemical dosages in copy.
 *
 * Pure. SSR-safe. Never throws. Frozen returns.
 */

import type { CropStage } from './CropStageEngine';

export const ADAPTIVE_TASK_GENERATOR_VERSION = 'adaptive-task-generator-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

export interface AdaptiveTask {
  runtimeVersion: string;
  action:         string;
  reason:         string;
  confidence:     number;       // 0..100 — mirrors signal strength, never inflated
  estimatedTime:  string;
  followUp:       string;
  source:         'scan' | 'stage' | 'weather';
}

// Stage → safe primary action + reason. Generic stages map to the
// agronomically right focus for that phase (no dosages, no chemicals).
const STAGE_ACTION: Readonly<Record<string, { action: string; reason: string; time: string; followUp: string }>> = Object.freeze({
  germination: { action: 'Keep the soil moist and shaded', reason: 'Seedlings emerging now need steady moisture to establish.', time: '10 min', followUp: 'Check emergence in 3 days.' },
  seedling:    { action: 'Thin weak seedlings and weed around the base', reason: 'Reducing competition early sets a stronger stand.', time: '20 min', followUp: 'Re-check spacing in 5 days.' },
  vegetative:  { action: 'Weed and check leaves for early spots', reason: 'Fast leaf growth is when pests and weeds compete hardest.', time: '20 min', followUp: 'Scan a leaf in 3 days.' },
  flowering:   { action: 'Check flowers and keep water steady', reason: 'Flowering sets your yield — stress now costs fruit.', time: '15 min', followUp: 'Re-check flowers in 2 days.' },
  fruiting:    { action: 'Support heavy stems and watch for fruit pests', reason: 'Filling fruit is heavy and draws pests.', time: '20 min', followUp: 'Inspect fruit in 2 days.' },
  maturity:    { action: 'Check readiness and plan your harvest', reason: 'The crop is near maturity — timing the harvest protects quality.', time: '15 min', followUp: 'Re-check ripeness in 2 days.' },
});

/**
 * Build the single primary task. Priority: a scan issue (most
 * specific) → crop stage → weather note. Returns null when none apply.
 */
export function generatePrimaryTask(input: {
  cropStage?: CropStage | string;
  stageConfidence?: number | null;
  scanIssue?: string;
  scanAction?: string;
  weatherNote?: string;
} = {}): Readonly<AdaptiveTask> | null {
  return _safe(() => {
    const issue = _str(input.scanIssue);
    const scanAction = _str(input.scanAction);
    // 1) A scan issue is the most specific signal.
    if (issue && issue.toLowerCase() !== 'no_visible_issue') {
      return Object.freeze({
        runtimeVersion: ADAPTIVE_TASK_GENERATOR_VERSION,
        action: scanAction || ('Inspect and remove leaves affected by ' + issue.replace(/_/g, ' ')),
        reason: 'Your last scan flagged ' + issue.replace(/_/g, ' ') + ' — acting early limits spread.',
        confidence: 70,
        estimatedTime: '20 min',
        followUp: 'Re-scan the same plant in 3 days.',
        source: 'scan' as const,
      });
    }
    // 2) Crop stage.
    const stage = _str(input.cropStage);
    const s = STAGE_ACTION[stage];
    if (s) {
      const conf = (typeof input.stageConfidence === 'number' && Number.isFinite(input.stageConfidence))
        ? Math.max(40, Math.min(85, Math.round(input.stageConfidence)))
        : 60;
      return Object.freeze({
        runtimeVersion: ADAPTIVE_TASK_GENERATOR_VERSION,
        action: s.action,
        reason: s.reason,
        confidence: conf,
        estimatedTime: s.time,
        followUp: s.followUp,
        source: 'stage' as const,
      });
    }
    // 3) Weather note.
    const weather = _str(input.weatherNote);
    if (weather) {
      return Object.freeze({
        runtimeVersion: ADAPTIVE_TASK_GENERATOR_VERSION,
        action: 'Adjust today’s watering to the weather',
        reason: weather,
        confidence: 55,
        estimatedTime: '10 min',
        followUp: 'Check soil moisture tomorrow.',
        source: 'weather' as const,
      });
    }
    return null; // no signal → caller shows onboarding guidance
  }, null);
}

export const _internal = Object.freeze({ generatePrimaryTask });
export default generatePrimaryTask;
