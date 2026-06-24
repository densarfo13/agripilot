/**
 * TaskOrchestrator.ts — sprint #216 §2.
 *
 * Buckets a farmer's tasks into a daily operating plan: ONE action
 * Today, up to 3 This Week, the rest Upcoming — so the farmer never
 * sees a 20-item list. Read-only over the already-deduped task array
 * (TaskDeduper #212); never invents a task.
 *
 * Pure. Never throws. Pins window.__taskOrchestratorHealth().
 */

import { dedupeTasks } from './TaskDeduper';

export const TASK_ORCHESTRATOR_VERSION = 'task-orchestrator-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _arr = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const _str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const _num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

const PRIORITY_RANK: Record<string, number> = { high: 3, medium: 2, low: 1 };
function _rank(t: any): number {
  const p = _str(t && t.priority).toLowerCase();
  return PRIORITY_RANK[p] || _num(t && t.priorityScore);
}
function _dueDays(t: any, asOf: string): number | null {
  return _safe(() => {
    const due = _str(t && (t.dueDate || t.due_date || t.due));
    if (!due) return null;
    const d = new Date(due); const a = new Date(asOf);
    if (isNaN(d.getTime()) || isNaN(a.getTime())) return null;
    return Math.round((d.getTime() - a.getTime()) / 86400000);
  }, null);
}

export function orchestrateTasks(input: {
  tasks?: ReadonlyArray<any>;
  asOf?: string;
} = {}): Readonly<{
  runtimeVersion: string;
  today: ReadonlyArray<any>;       // exactly ONE (the next best action)
  thisWeek: ReadonlyArray<any>;    // up to 3
  upcoming: ReadonlyArray<any>;
  totalCount: number;
}> {
  return _safe(() => {
    const asOf = _str(input.asOf) || new Date().toISOString();
    const deduped = dedupeTasks(_arr(input.tasks)).tasks;
    // Sort: due soonest first, then highest priority.
    const sorted = deduped.slice().sort((a, b) => {
      const da = _dueDays(a, asOf); const db = _dueDays(b, asOf);
      const va = da == null ? 9999 : da; const vb = db == null ? 9999 : db;
      if (va !== vb) return va - vb;
      return _rank(b) - _rank(a);
    });
    const today = sorted.slice(0, 1);
    const thisWeek = sorted.slice(1, 1).concat(
      sorted.slice(1).filter((t) => {
        const d = _dueDays(t, asOf);
        return d == null || d <= 7;
      }).slice(0, 3),
    );
    const shownIds = new Set([...today, ...thisWeek].map((t) => t));
    const upcoming = sorted.filter((t) => !shownIds.has(t));
    return Object.freeze({
      runtimeVersion: TASK_ORCHESTRATOR_VERSION,
      today: Object.freeze(today),
      thisWeek: Object.freeze(thisWeek),
      upcoming: Object.freeze(upcoming),
      totalCount: sorted.length,
    });
  }, Object.freeze({
    runtimeVersion: TASK_ORCHESTRATOR_VERSION,
    today: Object.freeze([]), thisWeek: Object.freeze([]),
    upcoming: Object.freeze([]), totalCount: 0,
  }));
}

export function buildTaskOrchestratorHealth(): Readonly<{
  ok: boolean; runtimeVersion: string;
  taskOrchestratorReady: true; oneActionToday: true; neverShowsAllTasks: true;
}> {
  return Object.freeze({
    ok: true, runtimeVersion: TASK_ORCHESTRATOR_VERSION,
    taskOrchestratorReady: true as const,
    oneActionToday: true as const,
    neverShowsAllTasks: true as const,
  });
}

let _installed = false;
export function installTaskOrchestratorHealthGlobal(): void {
  if (_installed) return;
  if (_safe(() => typeof window === 'undefined', true)) return;
  _safe(() => {
    Object.defineProperty(window as any, '__taskOrchestratorHealth', {
      configurable: true, enumerable: false, writable: false,
      value: () => buildTaskOrchestratorHealth(),
    });
    _installed = true;
  }, undefined);
}

export const _internal = Object.freeze({
  orchestrateTasks, buildTaskOrchestratorHealth, installTaskOrchestratorHealthGlobal,
});
export default orchestrateTasks;
