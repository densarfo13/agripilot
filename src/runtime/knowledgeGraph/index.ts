/**
 * src/runtime/knowledgeGraph/index.ts — barrel.
 */

export {
  snapshot, diseasesForPlant, pestsForPlant,
  recordOutcomeEdge, findPlantNode,
  knowledgeGraphHealth, installKnowledgeGraphGlobal,
} from './KnowledgeGraphRuntime';

export {
  listPlantNodes, PLANT_NODE_SERVICE_VERSION,
} from './PlantNodeService';

export {
  listDiseaseNodes, DISEASE_NODE_SERVICE_VERSION,
} from './DiseaseNodeService';

export {
  listPestNodes, PEST_NODE_SERVICE_VERSION,
} from './PestNodeService';

export {
  extractTreatmentGraph, TREATMENT_NODE_SERVICE_VERSION,
  type TreatmentExtract,
} from './TreatmentNodeService';

export {
  extractRegionGraph, REGION_NODE_SERVICE_VERSION,
  type RegionExtract,
} from './RegionNodeService';

export {
  extractOutcomeGraph,
  OUTCOME_EDGE_SERVICE_VERSION,
} from './OutcomeEdgeService';

export {
  KNOWLEDGE_GRAPH_RUNTIME_VERSION,
  NODE_TYPE, EDGE_TYPE,
  OUTCOME_EDGE_STORAGE_KEY, OUTCOME_EDGE_CAP,
  type NodeTypeValue, type EdgeTypeValue,
  type GraphNode, type GraphEdge, type GraphQueryResult,
  type KnowledgeGraphHealth,
} from './knowledgeGraphContracts';
