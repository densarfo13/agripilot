/**
 * src/runtime/knowledgeGraph/TreatmentNodeService.ts — derives
 * Treatment nodes + Disease→Treatment / Pest→Treatment edges
 * from the canonical Knowledge Layer.
 *
 * A Treatment node is a normalized stem of the
 * treatmentOrganic[]/treatmentChemical[] phrases in each disease
 * and pest entry. We dedupe by the first ~30 characters of the
 * phrase so "Apply neem oil…" and "Apply neem oil weekly…" map
 * to a single node.
 */

import { listDiseases, listPests } from '../../knowledge';
import {
  NODE_TYPE, EDGE_TYPE,
  type GraphNode, type GraphEdge,
} from './knowledgeGraphContracts';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

function _normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 50);
}

function _id(phrase: string): string {
  const stem = _normalize(phrase).replace(/[^a-z0-9]+/g, '-')
                                  .replace(/^-+|-+$/g, '');
  return `treatment:${stem.slice(0, 40)}`;
}

export interface TreatmentExtract {
  nodes: ReadonlyArray<GraphNode>;
  edges: ReadonlyArray<GraphEdge>;
}

export function extractTreatmentGraph(): TreatmentExtract {
  return _safe(() => {
    const nodes = new Map<string, GraphNode>();
    const edges: GraphEdge[] = [];

    const _addTreatment = (
      phrase: string,
      kind: 'organic' | 'chemical',
      sourceNode: string,
    ) => {
      if (typeof phrase !== 'string' || !phrase.trim()) return;
      const id = _id(phrase);
      if (!nodes.has(id)) {
        nodes.set(id, Object.freeze({
          id, type: NODE_TYPE.TREATMENT,
          label: phrase.length > 60 ? phrase.slice(0, 57) + '…' : phrase,
          metadata: Object.freeze({ kind }),
        }));
      }
      edges.push(Object.freeze({
        from: sourceNode,
        to:   id,
        type: EDGE_TYPE.TREATED_BY,
        weight: kind === 'organic' ? 0.8 : 0.6,
        metadata: Object.freeze({ kind }),
      }));
    };

    const diseases = _safe(() => listDiseases(), []) as any[];
    if (Array.isArray(diseases)) {
      for (const d of diseases) {
        if (!d || !d.id) continue;
        const source = `disease:${d.id}`;
        for (const ph of (Array.isArray(d.treatmentOrganic) ? d.treatmentOrganic : [])) {
          _addTreatment(ph, 'organic', source);
        }
        for (const ph of (Array.isArray(d.treatmentChemical) ? d.treatmentChemical : [])) {
          _addTreatment(ph, 'chemical', source);
        }
      }
    }
    const pests = _safe(() => listPests(), []) as any[];
    if (Array.isArray(pests)) {
      for (const p of pests) {
        if (!p || !p.id) continue;
        const source = `pest:${p.id}`;
        for (const ph of (Array.isArray(p.treatmentOrganic) ? p.treatmentOrganic : [])) {
          _addTreatment(ph, 'organic', source);
        }
        for (const ph of (Array.isArray(p.treatmentChemical) ? p.treatmentChemical : [])) {
          _addTreatment(ph, 'chemical', source);
        }
      }
    }

    return Object.freeze({
      nodes: Object.freeze([...nodes.values()]),
      edges: Object.freeze(edges),
    });
  }, Object.freeze({
    nodes: Object.freeze([]) as ReadonlyArray<GraphNode>,
    edges: Object.freeze([]) as ReadonlyArray<GraphEdge>,
  }));
}

export const TREATMENT_NODE_SERVICE_VERSION = 'treatment-node-service-v1';
