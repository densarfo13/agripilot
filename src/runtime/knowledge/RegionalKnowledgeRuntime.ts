/**
 * src/runtime/knowledge/RegionalKnowledgeRuntime.ts — wave-41
 * read-only probe over the four regional knowledge packs.
 *
 *   window.__regionalKnowledgeHealth()
 *
 * What this attests
 * ─────────────────
 *   • ghanaReady     — pack imports cleanly + > 0 crops AND every
 *                      crop reference resolves to a real plantId
 *                      OR is listed in `missingReferences` so the
 *                      caller knows what's missing.
 *   • nigeriaReady / kenyaReady / usaGardenReady — same rule per
 *                      region.
 *   • packsLoaded    — count of packs that parsed successfully.
 *   • missingReferences — array of `{region, plantId, kind:'crop'}`
 *                         rows for IDs not present in the canonical
 *                         plant libraries. Honest gap report.
 *
 * Strict-rule audit
 *   • Pure read-only probe. SSR-safe. Frozen envelope. Never throws.
 *   • Static JSON imports — packs ship in the bundle.
 *   • No new content fabricated.
 */

import ghanaPack    from '../../knowledge/packs/ghanaPriorityPack.json';
import nigeriaPack  from '../../knowledge/packs/nigeriaPriorityPack.json';
import kenyaPack    from '../../knowledge/packs/kenyaPriorityPack.json';
import usaGardenPack from '../../knowledge/packs/usaGardenPack.json';

import { VEGETABLE_LIBRARY }  from '../plants/media/libraries/vegetableLibrary';
import { FRUIT_LIBRARY }      from '../plants/media/libraries/fruitLibrary';
import { HERB_LIBRARY }       from '../plants/media/libraries/herbLibrary';
import { CROP_LIBRARY }       from '../plants/media/libraries/cropLibrary';
import { HOUSEPLANT_LIBRARY } from '../plants/media/libraries/houseplantLibrary';
import { FLOWER_LIBRARY }     from '../plants/media/libraries/flowerLibrary';

export const REGIONAL_KNOWLEDGE_RUNTIME_VERSION = 'regional-knowledge-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

function _allPlantIds(): Set<string> {
  return _safe(() => {
    const set = new Set<string>();
    const libs: any[][] = [
      VEGETABLE_LIBRARY as any[], FRUIT_LIBRARY as any[],
      HERB_LIBRARY as any[],      CROP_LIBRARY as any[],
      HOUSEPLANT_LIBRARY as any[], FLOWER_LIBRARY as any[],
    ];
    for (const lib of libs) {
      if (!Array.isArray(lib)) continue;
      for (const row of lib) {
        if (row && typeof row.plantId === 'string') set.add(row.plantId);
      }
    }
    return set;
  }, new Set<string>());
}

interface PackShape {
  region:                   string;
  crops:                    ReadonlyArray<string>;
  commonDiseases:           ReadonlyArray<string>;
  commonPests:              ReadonlyArray<string>;
  seasonalNotes:            ReadonlyArray<string>;
  farmerFriendlyGuidance:   ReadonlyArray<string>;
}

interface MissingRef {
  region:   string;
  plantId:  string;
  kind:     'crop';
}

function _packValid(p: any): p is PackShape {
  return !!(p
    && typeof p === 'object'
    && typeof p.region === 'string'
    && Array.isArray(p.crops)
    && Array.isArray(p.commonDiseases)
    && Array.isArray(p.commonPests));
}

function _resolvePack(
  pack: any,
  knownIds: Set<string>,
  missing: MissingRef[],
): { ready: boolean; cropsHit: number; cropsTotal: number } {
  return _safe(() => {
    if (!_packValid(pack)) return { ready: false, cropsHit: 0, cropsTotal: 0 };
    let hit = 0;
    for (const id of pack.crops) {
      if (typeof id !== 'string') continue;
      if (knownIds.has(id)) hit++;
      else missing.push({ region: pack.region, plantId: id, kind: 'crop' });
    }
    const total = pack.crops.length;
    // Ready iff pack parses + at least one canonical crop resolves.
    // The missingReferences array still surfaces the gap honestly.
    const ready = total > 0 && hit > 0;
    return { ready, cropsHit: hit, cropsTotal: total };
  }, { ready: false, cropsHit: 0, cropsTotal: 0 });
}

export interface RegionalKnowledgeHealth {
  runtimeVersion:           string;
  initialized:              boolean;
  ghanaReady:               boolean;
  nigeriaReady:             boolean;
  kenyaReady:               boolean;
  usaGardenReady:           boolean;
  packsLoaded:              number;
  totalPacks:               number;
  missingReferences:        ReadonlyArray<MissingRef>;
  /** Per-region coverage stats for QA drill-down. */
  coverage: Readonly<{
    ghana:     Readonly<{ hit: number; total: number }>;
    nigeria:   Readonly<{ hit: number; total: number }>;
    kenya:     Readonly<{ hit: number; total: number }>;
    usaGarden: Readonly<{ hit: number; total: number }>;
  }>;
}

export function regionalKnowledgeHealth(): RegionalKnowledgeHealth {
  return _safe(() => {
    const knownIds = _allPlantIds();
    const missing: MissingRef[] = [];

    const ghana    = _resolvePack(ghanaPack,    knownIds, missing);
    const nigeria  = _resolvePack(nigeriaPack,  knownIds, missing);
    const kenya    = _resolvePack(kenyaPack,    knownIds, missing);
    const usaGarden = _resolvePack(usaGardenPack, knownIds, missing);

    const packsLoaded =
        (ghana.ready    ? 1 : 0)
      + (nigeria.ready  ? 1 : 0)
      + (kenya.ready    ? 1 : 0)
      + (usaGarden.ready ? 1 : 0);

    return Object.freeze({
      runtimeVersion:    REGIONAL_KNOWLEDGE_RUNTIME_VERSION,
      initialized:       true,
      ghanaReady:        ghana.ready,
      nigeriaReady:      nigeria.ready,
      kenyaReady:        kenya.ready,
      usaGardenReady:    usaGarden.ready,
      packsLoaded,
      totalPacks:        4,
      missingReferences: Object.freeze([...missing]),
      coverage: Object.freeze({
        ghana:     Object.freeze({ hit: ghana.cropsHit,    total: ghana.cropsTotal }),
        nigeria:   Object.freeze({ hit: nigeria.cropsHit,  total: nigeria.cropsTotal }),
        kenya:     Object.freeze({ hit: kenya.cropsHit,    total: kenya.cropsTotal }),
        usaGarden: Object.freeze({ hit: usaGarden.cropsHit, total: usaGarden.cropsTotal }),
      }),
    });
  }, Object.freeze({
    runtimeVersion:    REGIONAL_KNOWLEDGE_RUNTIME_VERSION,
    initialized:       false,
    ghanaReady:        false,
    nigeriaReady:      false,
    kenyaReady:        false,
    usaGardenReady:    false,
    packsLoaded:       0,
    totalPacks:        4,
    missingReferences: Object.freeze([]),
    coverage: Object.freeze({
      ghana:     Object.freeze({ hit: 0, total: 0 }),
      nigeria:   Object.freeze({ hit: 0, total: 0 }),
      kenya:     Object.freeze({ hit: 0, total: 0 }),
      usaGarden: Object.freeze({ hit: 0, total: 0 }),
    }),
  }));
}

export function installRegionalKnowledgeGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__regionalKnowledgeHealth !== 'function') {
      w.__regionalKnowledgeHealth = function () {
        const out = regionalKnowledgeHealth();
        try { console.log('[Farroway · Regional Knowledge]', out); }
        catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
