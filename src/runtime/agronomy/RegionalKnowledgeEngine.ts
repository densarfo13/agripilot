/**
 * RegionalKnowledgeEngine.ts — spec-canonical facade. The real regional
 * knowledge surface lives at src/runtime/knowledge/RegionalKnowledgeRuntime
 * (already shipped with 4 regional packs). This facade reads
 * __regionalKnowledgeHealth and surfaces "is regional advice available for
 * this crop in this region?" without duplicating any data.
 */

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };

export const REGIONAL_KNOWLEDGE_ENGINE_VERSION = 'regional-knowledge-engine-v1' as const;

export interface RegionalAvailability {
  available: boolean;
  packs: ReadonlyArray<string>;
  reason: string;
  confidence: 'low' | 'medium' | 'high';
  limitations: string;
}

const EMPTY: Readonly<RegionalAvailability> = Object.freeze({
  available: false,
  packs: Object.freeze([]) as ReadonlyArray<string>,
  reason: 'no regional probe',
  confidence: 'low',
  limitations: 'No regional probe available — recommendations fall back to general guidance. Decision support, not a guarantee.',
});

export function regionalAvailability(_cropKey?: string, _locationLabel?: string): Readonly<RegionalAvailability> {
  return _safe(() => {
    if (typeof window === 'undefined') return EMPTY;
    const w = window as any;
    const probe = typeof w.__regionalKnowledgeHealth === 'function' ? w.__regionalKnowledgeHealth() : null;
    if (!probe) return EMPTY;
    const packs: string[] = [];
    const v = (probe as any).value || probe;
    if (Array.isArray((v as any).regionalPacks)) {
      for (const p of (v as any).regionalPacks) {
        if (typeof p === 'string') packs.push(p);
        else if (p && typeof p.key === 'string') packs.push(p.key);
      }
    }
    return Object.freeze<RegionalAvailability>({
      available: packs.length > 0 || (probe as any).initialized === true,
      packs: Object.freeze(packs) as ReadonlyArray<string>,
      reason: packs.length > 0 ? 'regional_pack_loaded' : 'general_fallback',
      confidence: ((probe as any).confidence as 'low' | 'medium' | 'high') || 'medium',
      limitations: 'Regional advice may be limited to the loaded packs; general fallback applied otherwise. Decision support, not a guarantee.',
    });
  }, EMPTY);
}
