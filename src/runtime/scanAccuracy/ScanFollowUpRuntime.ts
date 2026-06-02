/**
 * ScanFollowUpRuntime.ts — §PHASE 6.
 *
 * EVERY scan must generate a follow-up task. Pure function: given the
 * scan outcome (image quality, identification, disease) it returns
 * exactly one FollowUpTask. No fake intelligence — task category is
 * derived honestly from what the pipeline actually produced.
 *
 *   quality 'poor'                          → 'photo'   (retake)
 *   identification NEEDS_CONFIGURATION       → 'review'  (save for review)
 *   disease severity 'high'                  → 'inspect' (urgent)
 *   disease severity 'medium'                → 'inspect' (soon)
 *   disease severity 'low' / 'unknown'       → 'moisture' (routine)
 */

import type {
  FollowUpTask, ImageQualityReport, MultiPassResult, DiseaseAnalysis,
} from './ScanAccuracyContracts';
import { GUIDANCE_TAIL } from './ScanAccuracyContracts';

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };

export interface FollowUpInput {
  quality: Readonly<ImageQualityReport> | null;
  identification: Readonly<MultiPassResult> | null;
  disease: Readonly<DiseaseAnalysis> | null;
  plantKey?: string | null;
}

function _id(prefix: string): string {
  // No Date.now()/Math.random() — deterministic-enough id from prefix
  // plus a probe of high-res perf time when available.
  try {
    const t = (typeof performance !== 'undefined' && performance.now)
      ? Math.round(performance.now()) : 0;
    return `${prefix}_${t}`;
  } catch { return prefix; }
}

export function buildFollowUpTask(input: Readonly<FollowUpInput>): Readonly<FollowUpTask> {
  return _safe(() => {
    const q = input && input.quality;
    const id = input && input.identification;
    const dz = input && input.disease;
    const plant = (input && typeof input.plantKey === 'string' && input.plantKey)
      ? input.plantKey : 'your crop';

    // Priority 1 — poor image → retake photo.
    if (q && q.verdict === 'poor') {
      return Object.freeze<FollowUpTask>({
        id: _id('followup_retake'),
        title: 'Retake the photo',
        why: 'The image was too blurry, dark, or shadowed for a confident scan.',
        whenLabel: 'now',
        estimatedTime: '1 minute',
        category: 'photo',
        limitations:
          'Pipeline blocked identification on quality grounds. ' + GUIDANCE_TAIL,
      });
    }

    // Priority 2 — needs identification → save for review.
    if (!id || id.status === 'NEEDS_CONFIGURATION' || id.candidates.length === 0
        || id.bestConfidencePct < 50) {
      return Object.freeze<FollowUpTask>({
        id: _id('followup_review'),
        title: 'Save scan for review',
        why: 'We could not confidently identify the plant — save it for review or retake.',
        whenLabel: 'today',
        estimatedTime: '1 minute',
        category: 'review',
        limitations:
          'Identification confidence below threshold; outcome saved for manual review. '
          + GUIDANCE_TAIL,
      });
    }

    // Priority 3 — high-severity disease → urgent inspect.
    if (dz && dz.plantIdentifiedFirst && dz.severity === 'high') {
      return Object.freeze<FollowUpTask>({
        id: _id('followup_inspect_urgent'),
        title: `Inspect ${plant} leaves today`,
        why: dz.whatToCheck || 'High-severity signal — early action matters.',
        whenLabel: 'today',
        estimatedTime: '5 minutes',
        category: 'inspect',
        limitations:
          'Disease severity is a model estimate — confirm visually before acting. '
          + GUIDANCE_TAIL,
      });
    }

    // Priority 4 — medium-severity disease → inspect tomorrow.
    if (dz && dz.plantIdentifiedFirst && dz.severity === 'medium') {
      return Object.freeze<FollowUpTask>({
        id: _id('followup_inspect_soon'),
        title: `Inspect ${plant} leaves tomorrow`,
        why: dz.whatToCheck || 'Moderate signal — keep watching.',
        whenLabel: 'tomorrow',
        estimatedTime: '5 minutes',
        category: 'inspect',
        limitations:
          'Decision support — recheck in 24h. ' + GUIDANCE_TAIL,
      });
    }

    // Priority 5 — routine moisture check + retake in 3 days.
    return Object.freeze<FollowUpTask>({
      id: _id('followup_moisture'),
      title: `Check moisture and retake photo of ${plant} in 3 days`,
      why: 'No urgent finding — keep an eye on watering and trend.',
      whenLabel: '3 days',
      estimatedTime: '3 minutes',
      category: 'moisture',
      limitations:
        'Routine check — escalate if symptoms appear sooner. ' + GUIDANCE_TAIL,
    });
  }, Object.freeze<FollowUpTask>({
    id: 'followup_fallback',
    title: 'Check on your plant',
    why: 'Routine care.',
    whenLabel: 'today',
    estimatedTime: '2 minutes',
    category: 'inspect',
    limitations: 'Follow-up runtime threw — generic fallback. ' + GUIDANCE_TAIL,
  }));
}

export function followUpTaskReady(): boolean { return true; }
