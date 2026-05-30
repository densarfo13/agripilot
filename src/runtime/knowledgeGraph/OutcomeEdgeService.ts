/**
 * src/runtime/knowledgeGraph/OutcomeEdgeService.ts — records
 * Outcome edges (Task → Outcome) so the graph learns from
 * scan-task-outcome cycles. Composes the existing outcomeComparison
 * runtime's history; never duplicates the source of truth.
 */

import {
  OUTCOME_EDGE_STORAGE_KEY, OUTCOME_EDGE_CAP,
  EDGE_TYPE, NODE_TYPE,
  type GraphNode, type GraphEdge,
} from './knowledgeGraphContracts';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

function _hasLocal(): boolean {
  return _safe(() => typeof localStorage !== 'undefined'
                     && !!localStorage, false);
}

interface PersistedEdge {
  taskId:    string;
  outcomeId: string;
  status:    string;
  timestamp: string;
}

function _read(): PersistedEdge[] {
  return _safe(() => {
    if (!_hasLocal()) return [];
    const raw = localStorage.getItem(OUTCOME_EDGE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  }, []);
}

function _write(list: PersistedEdge[]): boolean {
  return _safe(() => {
    if (!_hasLocal()) return false;
    const trimmed = list.length > OUTCOME_EDGE_CAP
      ? list.slice(list.length - OUTCOME_EDGE_CAP) : list;
    localStorage.setItem(OUTCOME_EDGE_STORAGE_KEY, JSON.stringify(trimmed));
    return true;
  }, false);
}

/**
 * recordOutcomeEdge — call when a task completion has an
 * associated follow-up scan with an outcome status. Pure write;
 * no engine side effects.
 */
export function recordOutcomeEdge(
  taskId: string,
  outcomeId: string,
  status: string,
  isoTimestamp: string,
): boolean {
  return _safe(() => {
    if (!taskId || !outcomeId) return false;
    const list = _read();
    const key = `${taskId}:${outcomeId}`;
    const dedup = list.filter((e) => `${e.taskId}:${e.outcomeId}` !== key);
    dedup.push({
      taskId, outcomeId,
      status: typeof status === 'string' ? status : 'unknown',
      timestamp: isoTimestamp || '',
    });
    return _write(dedup);
  }, false);
}

/** Materialize all stored outcome edges + their endpoint nodes. */
export function extractOutcomeGraph(): {
  nodes: ReadonlyArray<GraphNode>;
  edges: ReadonlyArray<GraphEdge>;
} {
  return _safe(() => {
    const persisted = _read();
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const seenNodes = new Set<string>();

    for (const e of persisted) {
      const taskNodeId = `task:${e.taskId}`;
      const outcomeNodeId = `outcome:${e.outcomeId}`;
      if (!seenNodes.has(taskNodeId)) {
        nodes.push(Object.freeze({
          id: taskNodeId, type: NODE_TYPE.TASK, label: e.taskId,
        }));
        seenNodes.add(taskNodeId);
      }
      if (!seenNodes.has(outcomeNodeId)) {
        nodes.push(Object.freeze({
          id: outcomeNodeId, type: NODE_TYPE.OUTCOME, label: e.outcomeId,
          metadata: Object.freeze({ status: e.status }),
        }));
        seenNodes.add(outcomeNodeId);
      }
      edges.push(Object.freeze({
        from: taskNodeId,
        to:   outcomeNodeId,
        type: EDGE_TYPE.LEADS_TO,
        weight: e.status === 'improved' ? 0.9
              : e.status === 'unchanged' ? 0.5
              : e.status === 'worsened' ? 0.2
              : 0.3,
        metadata: Object.freeze({
          status: e.status,
          timestamp: e.timestamp,
        }),
      }));
    }

    return Object.freeze({
      nodes: Object.freeze(nodes),
      edges: Object.freeze(edges),
    });
  }, Object.freeze({
    nodes: Object.freeze([]) as ReadonlyArray<GraphNode>,
    edges: Object.freeze([]) as ReadonlyArray<GraphEdge>,
  }));
}

export const OUTCOME_EDGE_SERVICE_VERSION = 'outcome-edge-service-v1';
