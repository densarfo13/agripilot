/**
 * src/knowledge/plants/PlantKnowledgeService.ts — Farroway
 * Knowledge Layer · canonical source of truth for plant facts.
 *
 *   import {
 *     lookupPlantKnowledge, listPlantKnowledge,
 *     searchPlantKnowledge, listPlantKnowledgeByCategory,
 *     companionsFor, pollinatorIntelligenceFor,
 *     PLANT_KNOWLEDGE_SERVICE_VERSION,
 *   } from 'src/knowledge/plants/PlantKnowledgeService';
 *
 *   lookupPlantKnowledge('rose')
 *     → {
 *         id, commonName, scientificName, category, subtype,
 *         images[], growthStages[], careGuide,
 *         companionPlants[], commonDiseases[], commonPests[],
 *         pollinatorValue, bloomMonths[],
 *         waterNeed, sunlightNeed, soilNeed,
 *       }
 *
 * What this is
 * ────────────
 *   The single read API every runtime calls when it needs plant
 *   knowledge. Composes:
 *     • src/data/plants/index.js     — identity + bloom season +
 *       sun/water + companion / avoid
 *     • src/data/plants/knowledge.js — growth stages, careGuide,
 *       commonDiseases/Pests, images, subtype/soil enrichments
 *
 *   No engine reads the underlying data modules directly any more
 *   — they go through this service. The CI gate enforces it.
 *
 * Strict-rule audit
 *   • Pure read-only over the underlying catalogs.
 *   • Never throws. SSR-safe.
 *   • All returned arrays/objects frozen.
 *   • No PII handled.
 */

import {
  PLANT_DB, findPlant, plantsByType, searchPlants,
} from '../../data/plants/index.js';
import {
  PLANT_KNOWLEDGE, GROWTH_STAGE_TEMPLATES, findPlantKnowledge,
} from '../../data/plants/knowledge.js';

export const PLANT_KNOWLEDGE_SERVICE_VERSION =
  'plant-knowledge-service-v1';

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _arr   = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const _str   = (v: unknown): string => (typeof v === 'string' ? v : '');
const _num   = (v: unknown): number | null =>
  (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _safe  = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

/**
 * Map free-text bloom seasons in the catalog to month numbers
 * 1-12 (northern-hemisphere reference). Plants in the
 * southern hemisphere can be flagged via the future
 * regionTags pipeline; the engine returns N-hemisphere by
 * default which the daily briefing already handles.
 */
const SEASON_MONTHS: Record<string, number[]> = Object.freeze({
  spring: [3, 4, 5],
  summer: [6, 7, 8],
  autumn: [9, 10, 11],
  fall:   [9, 10, 11],   // US alias
  winter: [12, 1, 2],
  'year-round': [1,2,3,4,5,6,7,8,9,10,11,12],
});

function _bloomMonthsFor(catalog: any): number[] {
  return _safe(() => {
    const seasons = _arr(catalog && catalog.bloomSeason).map(_str);
    const months = new Set<number>();
    for (const s of seasons) {
      const list = SEASON_MONTHS[s.toLowerCase()] || [];
      for (const m of list) months.add(m);
    }
    return Array.from(months).sort((a, b) => a - b);
  }, []);
}

/**
 * Soil need — derive from catalog + careGuide.soil when present.
 * Falls back to a sensible category default.
 */
const SOIL_DEFAULTS: Record<string, string> = Object.freeze({
  flower:     'well-draining loam',
  vegetable:  'rich well-draining soil',
  fruit:      'deep well-draining loam',
  herb:       'light well-draining soil',
  houseplant: 'standard houseplant potting mix',
  crop:       'fertile well-draining loam',
  tree:       'deep well-draining loam',
  shrub:      'well-draining loam',
});

const WATER_NORMALISE: Record<string, string> = Object.freeze({
  low: 'low', medium: 'medium', high: 'high',
  drought: 'low', moderate: 'medium', heavy: 'high',
});

const SUN_NORMALISE: Record<string, string> = Object.freeze({
  full: 'full', part: 'part', shade: 'shade',
  partial: 'part', 'partial-shade': 'part',
  'full-sun': 'full', 'full sun': 'full',
});

export interface PlantEntry {
  id:              string;
  commonName:      string;
  scientificName:  string;
  category:        string;
  subtype:         string;
  images:          ReadonlyArray<string>;
  growthStages:    ReadonlyArray<any>;
  careGuide:       Readonly<Record<string, string>>;
  companionPlants: ReadonlyArray<string>;
  avoidPlants:     ReadonlyArray<string>;
  commonDiseases:  ReadonlyArray<string>;
  commonPests:     ReadonlyArray<string>;
  pollinatorValue: number | null;
  attracts:        ReadonlyArray<string>;
  bloomMonths:     ReadonlyArray<number>;
  waterNeed:       string;
  sunlightNeed:    string;
  soilNeed:        string;
}

/**
 * Compose the canonical PlantEntry for a plant id. Returns null
 * when neither catalog nor knowledge has a row.
 */
export function lookupPlantKnowledge(id: string): PlantEntry | null {
  return _safe(() => {
    const slug = _str(id).toLowerCase();
    if (!slug) return null;
    const base = findPlant(slug);
    const know = findPlantKnowledge(slug);
    if (!base && !know) return null;

    const category = _str(base && (base as any).type);
    const stages = (know && _arr((know as any).growthStages).length > 0)
      ? (know as any).growthStages
      : ((GROWTH_STAGE_TEMPLATES as any)[category] || []);

    const careGuide = (know && (know as any).careGuide)
      ? (know as any).careGuide
      : {};

    const waterRaw = _str(base && (base as any).waterNeeds || (base as any).water);
    const sunRaw   = _str(base && (base as any).sunlight   || (base as any).sun);

    return Object.freeze({
      id:              slug,
      commonName:      _str(base && ((base as any).commonName || (base as any).name)),
      scientificName:  _str(base && (base as any).scientificName),
      category,
      subtype:         _str(base && (base as any).family),
      images:          Object.freeze(_arr(know && (know as any).images).map(_str)),
      growthStages:    Object.freeze(stages.slice()),
      careGuide:       Object.freeze({ ...careGuide }),
      companionPlants: Object.freeze(_arr(base && (base as any).companionPlants).map(_str)),
      avoidPlants:     Object.freeze(_arr(base && (base as any).avoidPlants).map(_str)),
      commonDiseases:  Object.freeze(_arr(know && (know as any).commonDiseases).map(_str)),
      commonPests:     Object.freeze(_arr(know && (know as any).commonPests).map(_str)),
      pollinatorValue: _num(base && (base as any).pollinatorValue),
      attracts:        Object.freeze(_arr(base && (base as any).attracts).map(_str)),
      bloomMonths:     Object.freeze(_bloomMonthsFor(base)),
      waterNeed:       WATER_NORMALISE[waterRaw.toLowerCase()] || waterRaw,
      sunlightNeed:    SUN_NORMALISE[sunRaw.toLowerCase()]   || sunRaw,
      soilNeed:        _str(careGuide && (careGuide as any).soil)
                         || SOIL_DEFAULTS[category]
                         || 'well-draining soil',
    });
  }, null);
}

export function listPlantKnowledge(): ReadonlyArray<PlantEntry> {
  return _safe(() => {
    const seen = new Set<string>();
    const out: PlantEntry[] = [];
    for (const p of _arr(PLANT_DB)) {
      const id = _str(p && (p as any).id).toLowerCase();
      if (!id || seen.has(id)) continue;
      const k = lookupPlantKnowledge(id);
      if (k) { out.push(k); seen.add(id); }
    }
    // Include knowledge-only entries that aren't in PLANT_DB.
    for (const id of Object.keys(PLANT_KNOWLEDGE)) {
      if (seen.has(id)) continue;
      const k = lookupPlantKnowledge(id);
      if (k) { out.push(k); seen.add(id); }
    }
    return Object.freeze(out);
  }, Object.freeze([] as PlantEntry[]));
}

export function listPlantKnowledgeByCategory(category: string):
    ReadonlyArray<PlantEntry> {
  return _safe(() => {
    const c = _str(category).toLowerCase();
    if (!c) return Object.freeze([] as PlantEntry[]);
    const pool = plantsByType(c);
    const out: PlantEntry[] = [];
    for (const p of _arr(pool)) {
      const k = lookupPlantKnowledge(_str((p as any).id));
      if (k) out.push(k);
    }
    return Object.freeze(out);
  }, Object.freeze([] as PlantEntry[]));
}

export function searchPlantKnowledge(query: string,
                                       options?: { limit?: number;
                                                    category?: string }) {
  return _safe(() => {
    const matches = searchPlants(query, options as any);
    const out: PlantEntry[] = [];
    for (const p of _arr(matches)) {
      const k = lookupPlantKnowledge(_str((p as any).id));
      if (k) out.push(k);
    }
    return Object.freeze(out);
  }, Object.freeze([] as PlantEntry[]));
}

/**
 * Companion intelligence — returns the recommended good +
 * avoid lists for a plant, enriched with the companion's
 * commonName when available.
 */
export function companionsFor(id: string) {
  return _safe(() => {
    const k = lookupPlantKnowledge(id);
    if (!k) return Object.freeze({
      runtimeVersion: PLANT_KNOWLEDGE_SERVICE_VERSION,
      ok: false, reason: 'plant_not_in_knowledge',
      good: Object.freeze([]), avoid: Object.freeze([]),
    });
    const _enrich = (slug: string) => {
      const c = lookupPlantKnowledge(slug);
      return Object.freeze({
        id: slug,
        commonName: c ? c.commonName : slug,
        category:   c ? c.category   : '',
      });
    };
    return Object.freeze({
      runtimeVersion: PLANT_KNOWLEDGE_SERVICE_VERSION,
      ok: true, reason: '',
      plantId: k.id,
      good:  Object.freeze(_arr(k.companionPlants).map(_enrich)),
      avoid: Object.freeze(_arr(k.avoidPlants).map(_enrich)),
    });
  }, Object.freeze({
    runtimeVersion: PLANT_KNOWLEDGE_SERVICE_VERSION,
    ok: false, reason: 'error',
    good: Object.freeze([]), avoid: Object.freeze([]),
  }));
}

/**
 * Pollinator intelligence — returns the score (0-10) and the
 * list of pollinators this plant attracts. Used by daily
 * briefing + plant profile.
 */
export function pollinatorIntelligenceFor(id: string) {
  return _safe(() => {
    const k = lookupPlantKnowledge(id);
    if (!k) return Object.freeze({
      runtimeVersion: PLANT_KNOWLEDGE_SERVICE_VERSION,
      ok: false, reason: 'plant_not_in_knowledge',
      score: null, attracts: Object.freeze([]),
    });
    const score = k.pollinatorValue;
    return Object.freeze({
      runtimeVersion: PLANT_KNOWLEDGE_SERVICE_VERSION,
      ok: true, reason: '',
      plantId:   k.id,
      score:     score,
      band:      score == null ? 'unknown'
                  : score >= 8 ? 'high'
                  : score >= 5 ? 'medium' : 'low',
      attracts:  k.attracts,
      bloomMonths: k.bloomMonths,
    });
  }, Object.freeze({
    runtimeVersion: PLANT_KNOWLEDGE_SERVICE_VERSION,
    ok: false, reason: 'error',
    score: null, attracts: Object.freeze([]),
  }));
}

export function plantKnowledgeSummary() {
  return _safe(() => {
    const all = listPlantKnowledge();
    const byCat: Record<string, number> = {};
    for (const e of all) {
      const c = e.category || 'unknown';
      byCat[c] = (byCat[c] || 0) + 1;
    }
    return Object.freeze({
      runtimeVersion: PLANT_KNOWLEDGE_SERVICE_VERSION,
      total:          all.length,
      byCategory:     Object.freeze(byCat),
    });
  }, Object.freeze({
    runtimeVersion: PLANT_KNOWLEDGE_SERVICE_VERSION,
    total: 0, byCategory: Object.freeze({}),
  }));
}
