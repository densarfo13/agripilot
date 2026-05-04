/**
 * smartTaskEngine.js — combine candidate generation + ML scoring
 * to pick the best task for today.
 *
 *   import { getBestTask } from './lib/smartTaskEngine.js';
 *
 *   const { bestTask, candidates } = getBestTask({
 *     userType:    'backyard',
 *     crop:        'tomato',
 *     cropStage:   'flowering',
 *     region:      'Ashanti',
 *     weather:     { rainChance: 70 },
 *     userHistory: { missedYesterday: true },
 *   });
 *
 *   // bestTask is the highest-scoring task — always present.
 *   // candidates is the full ranked list (descending score).
 *
 * Architecture
 *   1. taskCandidates.generateTaskCandidates(input) returns the
 *      safe candidate list (4 entries, all crop-care).
 *   2. mlTaskScoring.scoreTaskCandidate ranks each candidate
 *      against the same input + optional userHistory.
 *   3. Sort by score descending; bestTask = first.
 *   4. Every returned task carries source='rules-plus-ml-score-v1'
 *      so consumers can confirm the path that fired.
 *
 * Strict-rule audit
 *   • Pure function. Never throws. Same input always produces
 *     the same ranking.
 *   • Always returns a non-null bestTask — even on empty input
 *     (the candidate list is hard-coded; the soil-moisture
 *     watering task is always at minimum a default).
 *   • Stable ordering: ties break in candidate-list order.
 */

import { generateTaskCandidates } from './taskCandidates.js';
import { scoreTaskCandidate }     from './mlTaskScoring.js';

const SOURCE_TAG = 'rules-plus-ml-score-v1';

export function getBestTask(input) {
  const o = (input && typeof input === 'object') ? input : {};
  const candidates = generateTaskCandidates(o);

  const scored = candidates.map((task, idx) => ({
    ...task,
    score:  scoreTaskCandidate({ ...o, task }),
    source: SOURCE_TAG,
    // _idx preserved purely as a stable tie-breaker so the sort
    // below is deterministic.
    _idx:   idx,
  }));

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a._idx - b._idx;
  });

  // Strip the internal index before returning.
  const cleaned = scored.map(({ _idx, ...rest }) => rest);

  return {
    bestTask:   cleaned[0],
    candidates: cleaned,
  };
}

export const _internal = Object.freeze({ SOURCE_TAG });

export default getBestTask;
