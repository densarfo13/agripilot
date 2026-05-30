/**
 * src/runtime/knowledgeGraph/DiseaseNodeService.ts — derives
 * Disease nodes from the canonical Knowledge Layer.
 *
 * Pure composition through `listDiseases()` — same layer-purity
 * rule the wave-33 knowledgeContent runtime obeys.
 */

import { listDiseases } from '../../knowledge';
import { NODE_TYPE, type GraphNode } from './knowledgeGraphContracts';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

export function listDiseaseNodes(): ReadonlyArray<GraphNode> {
  return _safe(() => {
    const arr = _safe(() => listDiseases(), []) as any[];
    if (!Array.isArray(arr)) return Object.freeze([]) as ReadonlyArray<GraphNode>;
    const out: GraphNode[] = [];
    for (const d of arr) {
      if (!d || !d.id) continue;
      out.push(Object.freeze({
        id:    `disease:${d.id}`,
        type:  NODE_TYPE.DISEASE,
        label: String(d.name || d.id),
        metadata: Object.freeze({
          slug: d.id,
          symptomCount: Array.isArray(d.symptoms) ? d.symptoms.length : 0,
        }),
      }));
    }
    return Object.freeze(out);
  }, Object.freeze([]) as ReadonlyArray<GraphNode>);
}

export const DISEASE_NODE_SERVICE_VERSION = 'disease-node-service-v1';
