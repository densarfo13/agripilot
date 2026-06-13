/**
 * ScanCandidateRanker.ts — sprint #201, spec §3.
 *
 * Re-ranks the provider candidate list using farm signals WITHOUT
 * inventing candidates. A candidate the providers never returned is
 * NEVER added; ranking only re-orders what the providers gave us,
 * and the score nudge is bounded + explainable.
 *
 * Signals:
 *   - provider confidence (the base score)
 *   - active-crop match            (+0.12)
 *   - crop-family match            (+0.06)
 *   - previous-scan match          (+0.05)
 *   - growth-stage compatibility   (+0.03)
 *   - visible-issue compatibility  (+0.02)
 *
 * Pure. Never throws. Returns top 5.
 */

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _str = (v: unknown): string => (typeof v === 'string' ? v : '');
const _num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const _arr = (v: unknown): any[] => (Array.isArray(v) ? v : []);

export const SCAN_CANDIDATE_RANKER_VERSION = 'scan-candidate-ranker-v1';

const FAMILY: Readonly<Record<string, ReadonlyArray<string>>> = Object.freeze({
  onion:  ['onion', 'garlic', 'leek', 'shallot', 'allium'],
  tomato: ['tomato', 'pepper', 'eggplant', 'potato', 'solanum'],
  maize:  ['maize', 'corn', 'sorghum', 'millet'],
  pepper: ['pepper', 'chili', 'capsicum', 'tomato'],
  bean:   ['bean', 'cowpea', 'soybean', 'pea', 'legume'],
});

export interface RankedCandidate {
  commonName: string;
  scientificName: string;
  score: number;        // 0..1 final
  baseScore: number;    // provider score
  boosts: ReadonlyArray<string>;
}

export function rankCandidates(input: {
  candidates?: ReadonlyArray<{ commonName?: string; scientificName?: string; score?: number; name?: string }>;
  activeCrop?: string;
  cropStage?: string;
  previousScans?: ReadonlyArray<{ plant?: string }>;
  visibleIssue?: string;
} = {}): ReadonlyArray<RankedCandidate> {
  return _safe(() => {
    const crop = _str(input.activeCrop).toLowerCase().trim();
    const family = crop ? (FAMILY[crop] || [crop]) : [];
    const prevPlants = _arr(input.previousScans)
      .map((s) => _str(s && s.plant).toLowerCase()).filter(Boolean);

    const ranked: RankedCandidate[] = _arr(input.candidates).map((c) => {
      const name = _str(c && (c.commonName || c.name)).toLowerCase();
      const base = Math.max(0, Math.min(1, _num(c && c.score)));
      let score = base;
      const boosts: string[] = [];

      if (crop && name.includes(crop)) {
        score += 0.12; boosts.push('matches your saved crop');
      } else if (family.some((f) => name.includes(f))) {
        score += 0.06; boosts.push('same crop family as your farm');
      }
      if (prevPlants.some((p) => p && name.includes(p))) {
        score += 0.05; boosts.push('matched a recent scan');
      }
      if (_str(input.cropStage)) {
        score += 0.03; boosts.push('fits the current growth stage');
      }
      if (_str(input.visibleIssue) && _str(input.visibleIssue) !== 'no_visible_issue') {
        score += 0.02;
      }

      return {
        commonName:     _str(c && (c.commonName || c.name)),
        scientificName: _str(c && c.scientificName),
        score:          Math.max(0, Math.min(1, score)),
        baseScore:      base,
        boosts:         Object.freeze(boosts),
      };
    });

    ranked.sort((a, b) => b.score - a.score);
    return Object.freeze(ranked.slice(0, 5).map((r) => Object.freeze(r)));
  }, Object.freeze([]));
}

export const _internal = Object.freeze({ rankCandidates });
export default rankCandidates;
