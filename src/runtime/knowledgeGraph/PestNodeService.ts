/**
 * src/runtime/knowledgeGraph/PestNodeService.ts — derives Pest
 * nodes from the canonical Knowledge Layer.
 *
 * Pure composition through `listPests()`.
 */

import { listPests } from '../../knowledge';
import { NODE_TYPE, type GraphNode } from './knowledgeGraphContracts';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

export function listPestNodes(): ReadonlyArray<GraphNode> {
  return _safe(() => {
    const arr = _safe(() => listPests(), []) as any[];
    if (!Array.isArray(arr)) return Object.freeze([]) as ReadonlyArray<GraphNode>;
    const out: GraphNode[] = [];
    for (const p of arr) {
      if (!p || !p.id) continue;
      out.push(Object.freeze({
        id:    `pest:${p.id}`,
        type:  NODE_TYPE.PEST,
        label: String(p.name || p.id),
        metadata: Object.freeze({
          slug: p.id,
          symptomCount: Array.isArray(p.symptoms) ? p.symptoms.length : 0,
        }),
      }));
    }
    return Object.freeze(out);
  }, Object.freeze([]) as ReadonlyArray<GraphNode>);
}

export const PEST_NODE_SERVICE_VERSION = 'pest-node-service-v1';
