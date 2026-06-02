/**
 * UserAssistedIdentificationRuntime.ts — §PHASE 4.
 *
 * When best-candidate confidence is below 75%, the page should ask
 * the farmer "What are you scanning?" with 6 category options. This
 * runtime re-ranks the existing candidate list against the user's
 * answer — never invents a candidate, only reweights the ones
 * already produced by MultiPassIdentificationRuntime.
 */

import type {
  IdentificationCandidate, UserAssistReRankInput, ScanCategory,
} from './ScanAccuracyContracts';

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };

/** Per-category canonical-key prior table. Only keys we know are
 *  meaningfully tagged — everything else carries weight 1.0
 *  (i.e. no re-rank effect). Values express "how strongly does this
 *  key match this category", 0..2. */
const CATEGORY_PRIORS: Readonly<Record<ScanCategory, Readonly<Record<string, number>>>> = Object.freeze({
  crop: Object.freeze({
    onion: 1.5, maize: 1.5, tomato: 1.4, pepper: 1.4, cassava: 1.5,
    rice: 1.5, beans: 1.4, sorghum: 1.5, millet: 1.5, yam: 1.5,
    okra: 1.4, groundnut: 1.4, cowpea: 1.4, soybean: 1.4,
  }),
  flower: Object.freeze({
    rose: 1.6, sunflower: 1.6, marigold: 1.5, hibiscus: 1.5,
  }),
  tree: Object.freeze({
    mango: 1.5, citrus: 1.5, banana: 1.4, plantain: 1.4, papaya: 1.5,
    cocoa: 1.5, coffee: 1.5, palm: 1.4,
  }),
  vegetable: Object.freeze({
    tomato: 1.5, onion: 1.4, pepper: 1.4, okra: 1.5,
    eggplant: 1.5, cabbage: 1.5, lettuce: 1.5, carrot: 1.5,
    cucumber: 1.4, garlic: 1.4, leek: 1.4, chive: 1.3,
  }),
  fruit: Object.freeze({
    mango: 1.6, banana: 1.5, plantain: 1.4, papaya: 1.6,
    pineapple: 1.6, citrus: 1.5, watermelon: 1.5,
  }),
  unknown: Object.freeze({}),
});

export function reRankCandidatesByCategory(input: Readonly<UserAssistReRankInput>)
  : ReadonlyArray<IdentificationCandidate> {
  return _safe(() => {
    if (!input || !Array.isArray(input.candidates) || input.candidates.length === 0) {
      return Object.freeze([]) as ReadonlyArray<IdentificationCandidate>;
    }
    const cat: ScanCategory = (input.scanCategory && CATEGORY_PRIORS[input.scanCategory])
      ? input.scanCategory : 'unknown';
    const priors = CATEGORY_PRIORS[cat];
    const reranked: IdentificationCandidate[] = input.candidates.map((c) => {
      const w = priors[c.key] !== undefined ? priors[c.key] : 1.0;
      // Re-rank cap: a prior can lift a candidate's confidence up to
      // 100%, but can never lift an unrelated candidate above its
      // pre-existing ceiling. We multiply the existing confidence by w
      // and clamp to [0, 100].
      const next = Math.max(0, Math.min(100, Math.round(c.confidencePct * w)));
      return { ...c, confidencePct: next };
    });
    reranked.sort((a, b) => b.confidencePct - a.confidencePct);
    return Object.freeze(reranked) as ReadonlyArray<IdentificationCandidate>;
  }, input.candidates);
}

/** Threshold below which the user-assist UI should be shown. */
export const USER_ASSIST_CONFIDENCE_THRESHOLD = 75;

export function shouldRequestUserAssist(candidates: ReadonlyArray<IdentificationCandidate>)
  : boolean {
  return _safe(() => {
    if (!Array.isArray(candidates) || candidates.length === 0) return true;
    return candidates[0].confidencePct < USER_ASSIST_CONFIDENCE_THRESHOLD;
  }, true);
}

export function candidateRankingReady(): boolean { return true; }
