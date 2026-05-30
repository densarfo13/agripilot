/**
 * src/runtime/knowledgeGraph/KnowledgeGraphRuntime.ts — top-level
 * facade for the Agricultural Knowledge Graph runtime.
 *
 * Composes: PlantNodeService + DiseaseNodeService + PestNodeService
 *         + TreatmentNodeService + RegionNodeService
 *         + OutcomeEdgeService
 *
 * Derives Plant→Disease (susceptible_to) and Plant→Pest
 * (affected_by) edges from the existing PLANT_KNOWLEDGE
 * commonDiseases/commonPests arrays.
 *
 * Strict-rule audit
 *   • NEVER imports React or DOM.
 *   • NEVER exposed in grower navigation (CI gate enforces).
 *   • Pure runtime. Never throws.
 *   • Frozen envelopes.
 *   • Single window global: __knowledgeGraphHealth.
 */

// @ts-ignore — JS module
import { PLANT_KNOWLEDGE } from '../../data/plants/knowledge.js';
import {
  KNOWLEDGE_GRAPH_RUNTIME_VERSION,
  EDGE_TYPE, NODE_TYPE,
  type GraphNode, type GraphEdge,
  type GraphQueryResult, type KnowledgeGraphHealth,
} from './knowledgeGraphContracts';
import { listPlantNodes, findPlantNode }   from './PlantNodeService';
import { listDiseaseNodes }                from './DiseaseNodeService';
import { listPestNodes }                   from './PestNodeService';
import { extractTreatmentGraph }           from './TreatmentNodeService';
import { extractRegionGraph }              from './RegionNodeService';
import {
  extractOutcomeGraph, recordOutcomeEdge,
} from './OutcomeEdgeService';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

// ─── Derived edges from PLANT_KNOWLEDGE arrays ────────────────────

function _plantDiseaseEdges(): ReadonlyArray<GraphEdge> {
  return _safe(() => {
    if (!PLANT_KNOWLEDGE || typeof PLANT_KNOWLEDGE !== 'object') {
      return Object.freeze([]) as ReadonlyArray<GraphEdge>;
    }
    const edges: GraphEdge[] = [];
    for (const slug of Object.keys(PLANT_KNOWLEDGE)) {
      const entry = (PLANT_KNOWLEDGE as any)[slug];
      const ds = Array.isArray(entry?.commonDiseases) ? entry.commonDiseases : [];
      for (const d of ds) {
        if (typeof d !== 'string') continue;
        edges.push(Object.freeze({
          from: `plant:${slug}`,
          to:   `disease:${d}`,
          type: EDGE_TYPE.SUSCEPTIBLE_TO,
          weight: 0.7,
        }));
      }
    }
    return Object.freeze(edges);
  }, Object.freeze([]) as ReadonlyArray<GraphEdge>);
}

function _plantPestEdges(): ReadonlyArray<GraphEdge> {
  return _safe(() => {
    if (!PLANT_KNOWLEDGE || typeof PLANT_KNOWLEDGE !== 'object') {
      return Object.freeze([]) as ReadonlyArray<GraphEdge>;
    }
    const edges: GraphEdge[] = [];
    for (const slug of Object.keys(PLANT_KNOWLEDGE)) {
      const entry = (PLANT_KNOWLEDGE as any)[slug];
      const ps = Array.isArray(entry?.commonPests) ? entry.commonPests : [];
      for (const p of ps) {
        if (typeof p !== 'string') continue;
        edges.push(Object.freeze({
          from: `plant:${slug}`,
          to:   `pest:${p}`,
          type: EDGE_TYPE.AFFECTED_BY,
          weight: 0.7,
        }));
      }
    }
    return Object.freeze(edges);
  }, Object.freeze([]) as ReadonlyArray<GraphEdge>);
}

// ─── Public queries ───────────────────────────────────────────────

// Wave-37 risk-fix #5 — Memoize the snapshot. The plant /
// disease / pest / treatment / region nodes + their derived
// edges are derived from static catalogs (PLANT_KNOWLEDGE +
// canonical Knowledge Layer + nutrients.json). Only the outcome
// edges grow over time via recordOutcomeEdge(). So we cache the
// static portion at first call and only re-extract outcome edges.
// Reduces __knowledgeGraphHealth() cost from O(plants+diseases+
// pests+treatments+regions+outcomes) on every probe to O(outcomes).
let _staticCache: {
  staticNodes: ReadonlyArray<GraphNode>;
  staticEdges: ReadonlyArray<GraphEdge>;
} | null = null;

function _buildStaticCache() {
  return _safe(() => {
    const plantNodes   = listPlantNodes();
    const diseaseNodes = listDiseaseNodes();
    const pestNodes    = listPestNodes();
    const treatments   = extractTreatmentGraph();
    const regions      = extractRegionGraph();

    const staticNodes: GraphNode[] = [
      ...plantNodes, ...diseaseNodes, ...pestNodes,
      ...treatments.nodes, ...regions.nodes,
    ];
    const staticEdges: GraphEdge[] = [
      ..._plantDiseaseEdges(),
      ..._plantPestEdges(),
      ...treatments.edges,
      ...regions.edges,
    ];
    return Object.freeze({
      staticNodes: Object.freeze(staticNodes),
      staticEdges: Object.freeze(staticEdges),
    });
  }, Object.freeze({
    staticNodes: Object.freeze([]) as ReadonlyArray<GraphNode>,
    staticEdges: Object.freeze([]) as ReadonlyArray<GraphEdge>,
  }));
}

/** Snapshot the entire graph (plants + diseases + pests + treatments + regions + outcomes). */
export function snapshot(): GraphQueryResult {
  return _safe(() => {
    if (!_staticCache) _staticCache = _buildStaticCache();
    const outcomes = extractOutcomeGraph();    // dynamic — re-read

    return Object.freeze({
      nodes: Object.freeze([
        ..._staticCache.staticNodes,
        ...outcomes.nodes,
      ]),
      edges: Object.freeze([
        ..._staticCache.staticEdges,
        ...outcomes.edges,
      ]),
    });
  }, Object.freeze({
    nodes: Object.freeze([]) as ReadonlyArray<GraphNode>,
    edges: Object.freeze([]) as ReadonlyArray<GraphEdge>,
  }));
}

/**
 * Diseases known to affect a given plant (composes plant→disease
 * edges + disease nodes).
 */
export function diseasesForPlant(plantSlug: string): ReadonlyArray<GraphNode> {
  return _safe(() => {
    const slug = String(plantSlug || '').toLowerCase();
    if (!slug) return Object.freeze([]) as ReadonlyArray<GraphNode>;
    const edges = _plantDiseaseEdges()
      .filter((e) => e.from === `plant:${slug}`);
    const diseaseIds = new Set(edges.map((e) => e.to));
    return Object.freeze(
      listDiseaseNodes().filter((n) => diseaseIds.has(n.id))
    );
  }, Object.freeze([]) as ReadonlyArray<GraphNode>);
}

/** Pests known to affect a given plant. */
export function pestsForPlant(plantSlug: string): ReadonlyArray<GraphNode> {
  return _safe(() => {
    const slug = String(plantSlug || '').toLowerCase();
    if (!slug) return Object.freeze([]) as ReadonlyArray<GraphNode>;
    const edges = _plantPestEdges()
      .filter((e) => e.from === `plant:${slug}`);
    const pestIds = new Set(edges.map((e) => e.to));
    return Object.freeze(
      listPestNodes().filter((n) => pestIds.has(n.id))
    );
  }, Object.freeze([]) as ReadonlyArray<GraphNode>);
}

// Re-export the outcome-edge writer so callers don't need a
// second import path.
export { recordOutcomeEdge, findPlantNode };

// ─── Diagnostic envelope ──────────────────────────────────────────

export function knowledgeGraphHealth(): KnowledgeGraphHealth {
  return _safe(() => {
    const snap = snapshot();
    return Object.freeze({
      runtimeVersion:        KNOWLEDGE_GRAPH_RUNTIME_VERSION,
      initialized:           true,
      plantNodesReady:       snap.nodes.some((n) => n.type === NODE_TYPE.PLANT),
      diseaseNodesReady:     snap.nodes.some((n) => n.type === NODE_TYPE.DISEASE),
      pestNodesReady:        snap.nodes.some((n) => n.type === NODE_TYPE.PEST),
      treatmentEdgesReady:   snap.edges.some((e) => e.type === EDGE_TYPE.TREATED_BY),
      outcomeEdgesReady:     true,    // ready to accept writes; may be empty
      invisibleToGrowers:    true,
      totalNodes:            snap.nodes.length,
      totalEdges:            snap.edges.length,
    });
  }, Object.freeze({
    runtimeVersion:        KNOWLEDGE_GRAPH_RUNTIME_VERSION,
    initialized:           false,
    plantNodesReady:       false,
    diseaseNodesReady:     false,
    pestNodesReady:        false,
    treatmentEdgesReady:   false,
    outcomeEdgesReady:     false,
    invisibleToGrowers:    true,
    totalNodes:            0,
    totalEdges:            0,
  }));
}

export function installKnowledgeGraphGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__knowledgeGraphHealth !== 'function') {
      w.__knowledgeGraphHealth = function () {
        const out = knowledgeGraphHealth();
        try { console.log('[Farroway · Knowledge Graph]', out); }
        catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
