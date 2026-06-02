/**
 * UnknownHandlingRuntime.ts — §PHASE 7.
 *
 * Replaces the legacy alarmist label with "Needs Identification" + a
 * candidate list + user options. Hard rule (spec): the legacy unknown
 * label must NEVER be shown when candidates exist.
 *
 * Pure: takes a MultiPassResult, returns a frozen UnknownHandling
 * description that the page renders as-is. Never invents candidates.
 */

import type {
  MultiPassResult, UnknownHandling, IdentificationCandidate,
} from './ScanAccuracyContracts';
import { GUIDANCE_TAIL } from './ScanAccuracyContracts';

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };

export const NEEDS_IDENTIFICATION_LABEL = 'Needs Identification';

/** Confidence threshold above which we treat the scan as identified
 *  rather than "Needs Identification". */
const IDENTIFIED_THRESHOLD = 50;

export function buildUnknownHandling(result: Readonly<MultiPassResult> | null)
  : Readonly<UnknownHandling> {
  return _safe(() => {
    const candidates = (result && Array.isArray(result.candidates))
      ? result.candidates : [];
    const best = candidates.length > 0 ? candidates[0] : null;

    // Identified — caller should NOT show "Needs Identification" UI.
    if (best && best.confidencePct >= IDENTIFIED_THRESHOLD) {
      return Object.freeze<UnknownHandling>({
        showAsUnknown: false,
        displayLabel: best.label,
        candidatesShown: Object.freeze(candidates.slice(0, 5)) as ReadonlyArray<IdentificationCandidate>,
        userOptions: Object.freeze([]) as ReadonlyArray<'choose' | 'save_for_review' | 'retake_photo'>,
        limitations: 'Identification within confidence threshold. ' + GUIDANCE_TAIL,
      });
    }

    // Show "Needs Identification" with whatever candidates we have.
    return Object.freeze<UnknownHandling>({
      showAsUnknown: true,
      displayLabel: NEEDS_IDENTIFICATION_LABEL,
      candidatesShown: Object.freeze(candidates.slice(0, 3)) as ReadonlyArray<IdentificationCandidate>,
      userOptions: Object.freeze(
        candidates.length > 0
          ? ['choose', 'save_for_review', 'retake_photo']
          : ['save_for_review', 'retake_photo'],
      ) as ReadonlyArray<'choose' | 'save_for_review' | 'retake_photo'>,
      limitations:
        'Confidence below threshold; user input requested to confirm or save for review. '
        + GUIDANCE_TAIL,
    });
  }, Object.freeze<UnknownHandling>({
    showAsUnknown: true,
    displayLabel: NEEDS_IDENTIFICATION_LABEL,
    candidatesShown: Object.freeze([]) as ReadonlyArray<IdentificationCandidate>,
    userOptions: Object.freeze(['save_for_review', 'retake_photo']) as ReadonlyArray<'save_for_review' | 'retake_photo'>,
    limitations: 'Unknown handling runtime threw. ' + GUIDANCE_TAIL,
  }));
}

export function unknownHandlingReady(): boolean { return true; }

/** Hard contract — the spec rule "Unknown Plant shown while
 *  candidates exist" must never be true. This helper returns true
 *  ONLY when no candidates exist; pages MUST call this before showing
 *  any "Unknown" / "Needs Identification" UI. */
export function isHonestUnknown(result: Readonly<MultiPassResult> | null): boolean {
  return _safe(() => {
    if (!result) return true;
    return !Array.isArray(result.candidates) || result.candidates.length === 0;
  }, true);
}
