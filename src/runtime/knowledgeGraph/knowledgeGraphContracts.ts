/**
 * src/runtime/knowledgeGraph/knowledgeGraphContracts.ts — frozen
 * types for the Agricultural Knowledge Graph runtime.
 *
 * Strict-rule audit
 *   • Pure data declarations only.
 *   • No React / DOM types.
 *   • No PII handled.
 *   • The graph is INVISIBLE to growers — UI never renders nodes
 *     or edges directly. Used by IntelligenceLoopRuntime to
 *     improve recommendations.
 */

export const KNOWLEDGE_GRAPH_RUNTIME_VERSION = 'knowledge-graph-v1';

export const NODE_TYPE = Object.freeze({
  PLANT:            'plant',
  DISEASE:          'disease',
  PEST:             'pest',
  TREATMENT:        'treatment',
  TASK:             'task',
  REGION:           'region',
  WEATHER_COND:     'weather_condition',
  GROWTH_STAGE:     'growth_stage',
  OUTCOME:          'outcome',
  PROGRAM:          'program',
  BUYER_SIGNAL:     'buyer_signal',
} as const);

export type NodeTypeValue =
  typeof NODE_TYPE[keyof typeof NODE_TYPE];

export const EDGE_TYPE = Object.freeze({
  SUSCEPTIBLE_TO:    'susceptible_to',     // Plant → Disease
  AFFECTED_BY:       'affected_by',        // Plant → Pest
  TREATED_BY:        'treated_by',         // Disease/Pest → Treatment
  CREATES:           'creates',            // Treatment → Task
  LEADS_TO:          'leads_to',           // Task → Outcome
  HAS_RISK:          'has_risk',           // Region → Disease
  INCREASES_RISK:    'increases_risk',     // Weather → Disease
  DETECTED:          'detected',           // Scan → Disease
  PRODUCED:          'produced',           // Recommendation → Task
  COMPLETED:         'completed',          // Task → Outcome
} as const);

export type EdgeTypeValue =
  typeof EDGE_TYPE[keyof typeof EDGE_TYPE];

export interface GraphNode {
  id:       string;          // composite: '{type}:{slug}'
  type:     NodeTypeValue;
  label:    string;
  metadata?: Record<string, unknown>;
}

export interface GraphEdge {
  from:    string;
  to:      string;
  type:    EdgeTypeValue;
  weight?: number;            // 0-1; how strong the relationship
  metadata?: Record<string, unknown>;
}

export interface GraphQueryResult {
  nodes:   ReadonlyArray<GraphNode>;
  edges:   ReadonlyArray<GraphEdge>;
}

export interface KnowledgeGraphHealth {
  runtimeVersion:        string;
  initialized:           boolean;
  plantNodesReady:       boolean;
  diseaseNodesReady:     boolean;
  pestNodesReady:        boolean;
  treatmentEdgesReady:   boolean;
  outcomeEdgesReady:     boolean;
  invisibleToGrowers:    boolean;
  totalNodes:            number;
  totalEdges:            number;
}

export const OUTCOME_EDGE_STORAGE_KEY = 'farroway.knowledgeGraph.outcomeEdges';
export const OUTCOME_EDGE_CAP = 500;
