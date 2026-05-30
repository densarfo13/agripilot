/**
 * src/runtime/knowledgeGraph/PlantNodeService.ts — derives Plant
 * nodes from the existing PLANT_KNOWLEDGE catalog.
 *
 * Pure composition. Never imports React.
 */

// @ts-ignore — JS module
import { PLANT_KNOWLEDGE } from '../../data/plants/knowledge.js';
import { NODE_TYPE, type GraphNode } from './knowledgeGraphContracts';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

/**
 * listPlantNodes — frozen list of every plant in PLANT_KNOWLEDGE.
 * Each node carries minimal metadata (category, regions when
 * present in the wave-34 schema).
 */
export function listPlantNodes(): ReadonlyArray<GraphNode> {
  return _safe(() => {
    if (!PLANT_KNOWLEDGE || typeof PLANT_KNOWLEDGE !== 'object') {
      return Object.freeze([]) as ReadonlyArray<GraphNode>;
    }
    const out: GraphNode[] = [];
    for (const key of Object.keys(PLANT_KNOWLEDGE)) {
      const entry = (PLANT_KNOWLEDGE as any)[key];
      if (!entry || typeof entry !== 'object') continue;
      out.push(Object.freeze({
        id:    `plant:${key}`,
        type:  NODE_TYPE.PLANT,
        label: String(entry.scientificName || key),
        metadata: Object.freeze({
          slug:     key,
          category: entry.category || null,
          regions:  Array.isArray(entry.regions) ? entry.regions : null,
        }),
      }));
    }
    return Object.freeze(out);
  }, Object.freeze([]) as ReadonlyArray<GraphNode>);
}

/** Look up a single plant node by slug (without 'plant:' prefix). */
export function findPlantNode(slug: string): GraphNode | null {
  return _safe(() => {
    if (!PLANT_KNOWLEDGE || typeof PLANT_KNOWLEDGE !== 'object') return null;
    const entry = (PLANT_KNOWLEDGE as any)[slug];
    if (!entry) return null;
    return Object.freeze({
      id:    `plant:${slug}`,
      type:  NODE_TYPE.PLANT,
      label: String(entry.scientificName || slug),
      metadata: Object.freeze({
        slug,
        category: entry.category || null,
        regions:  Array.isArray(entry.regions) ? entry.regions : null,
      }),
    });
  }, null);
}

export const PLANT_NODE_SERVICE_VERSION = 'plant-node-service-v1';
