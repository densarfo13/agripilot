/**
 * src/runtime/knowledgeGraph/RegionNodeService.ts — derives Region
 * nodes + Region→Disease has_risk edges from the per-entry
 * `regions` arrays added in wave-32/33.
 */

import { listDiseases, listPests } from '../../knowledge';
// @ts-ignore — JSON module
import nutrientsCatalog from '../../data/nutrients/nutrients.json';
import {
  NODE_TYPE, EDGE_TYPE,
  type GraphNode, type GraphEdge,
} from './knowledgeGraphContracts';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

const REGION_LABELS: Readonly<Record<string, string>> = Object.freeze({
  ghana:        'Ghana',
  nigeria:      'Nigeria',
  kenya:        'Kenya',
  uganda:       'Uganda',
  tanzania:     'Tanzania',
  south_africa: 'South Africa',
  usa:          'United States',
  cameroon:     'Cameroon',
  mozambique:   'Mozambique',
});

export interface RegionExtract {
  nodes: ReadonlyArray<GraphNode>;
  edges: ReadonlyArray<GraphEdge>;
}

export function extractRegionGraph(): RegionExtract {
  return _safe(() => {
    const regions = new Map<string, GraphNode>();
    const edges: GraphEdge[] = [];

    const _ensureRegion = (slug: string) => {
      if (!regions.has(slug)) {
        regions.set(slug, Object.freeze({
          id:    `region:${slug}`,
          type:  NODE_TYPE.REGION,
          label: REGION_LABELS[slug] || slug,
        }));
      }
    };

    // Nutrient deficiencies carry the most explicit regions array.
    const nutrients = (Array.isArray(nutrientsCatalog) ? nutrientsCatalog : []) as any[];
    for (const n of nutrients) {
      if (!n || !n.id || !Array.isArray(n.regions)) continue;
      for (const r of n.regions) {
        if (typeof r !== 'string') continue;
        _ensureRegion(r);
        edges.push(Object.freeze({
          from: `region:${r}`,
          to:   `nutrient:${n.id}`,
          type: EDGE_TYPE.HAS_RISK,
          weight: 0.5,
        }));
      }
    }

    // Region → Disease/Pest edges derived per entry if a regions
    // field is present (older entries don't carry it).
    const diseases = _safe(() => listDiseases(), []) as any[];
    for (const d of diseases) {
      if (!d || !d.id) continue;
      const arr = (d as any).regions;
      if (!Array.isArray(arr)) continue;
      for (const r of arr) {
        if (typeof r !== 'string') continue;
        _ensureRegion(r);
        edges.push(Object.freeze({
          from: `region:${r}`,
          to:   `disease:${d.id}`,
          type: EDGE_TYPE.HAS_RISK,
          weight: 0.6,
        }));
      }
    }
    const pests = _safe(() => listPests(), []) as any[];
    for (const p of pests) {
      if (!p || !p.id) continue;
      const arr = (p as any).regions;
      if (!Array.isArray(arr)) continue;
      for (const r of arr) {
        if (typeof r !== 'string') continue;
        _ensureRegion(r);
        edges.push(Object.freeze({
          from: `region:${r}`,
          to:   `pest:${p.id}`,
          type: EDGE_TYPE.HAS_RISK,
          weight: 0.6,
        }));
      }
    }

    return Object.freeze({
      nodes: Object.freeze([...regions.values()]),
      edges: Object.freeze(edges),
    });
  }, Object.freeze({
    nodes: Object.freeze([]) as ReadonlyArray<GraphNode>,
    edges: Object.freeze([]) as ReadonlyArray<GraphEdge>,
  }));
}

export const REGION_NODE_SERVICE_VERSION = 'region-node-service-v1';
