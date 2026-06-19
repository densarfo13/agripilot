/**
 * TaskDeduper.ts — sprint #212 §4.
 *
 * Removes duplicate tasks before render. Two tasks collide when they
 * share (taskType, farmId, cropId, dueDate, sourceEngine). On a
 * collision the HIGHEST-priority task wins; user-authored notes are
 * preserved by merging the kept task's note with any duplicate's note.
 *
 * Pure. Never throws. Stable order (first occurrence position kept).
 * Pins window.__taskDedupHealth().
 */

export const TASK_DEDUPER_VERSION = 'task-deduper-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const _num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

const PRIORITY_RANK: Record<string, number> = { high: 3, medium: 2, low: 1 };
function _priorityOf(t: any): number {
  const p = _str(t && t.priority).toLowerCase();
  if (p in PRIORITY_RANK) return PRIORITY_RANK[p];
  return _num(t && t.priorityScore);
}

function _dedupKey(t: any): string {
  // taskType / farmId / cropId / dueDate / sourceEngine. Fall back to
  // titleKey/title when taskType is absent so default seeded tasks
  // (e.g. "Care for your plants") still collapse.
  const type = _str(t && (t.taskType || t.type)) || _str(t && (t.titleKey || t.title));
  return [
    type,
    _str(t && (t.farmId || t.farm_id)),
    _str(t && (t.cropId || t.crop_id)),
    _str(t && (t.dueDate || t.due_date || t.due)),
    _str(t && (t.sourceEngine || t.source)),
  ].join('|');
}

function _mergeNote(keep: any, drop: any): any {
  const kn = _str(keep && keep.note);
  const dn = _str(drop && drop.note);
  if (dn && dn !== kn) {
    return { ...keep, note: kn ? (kn + ' ' + dn) : dn };
  }
  return keep;
}

export function dedupeTasks<T = any>(tasks: ReadonlyArray<T> | null | undefined): {
  tasks: T[]; suppressed: number;
} {
  return _safe(() => {
    const list = Array.isArray(tasks) ? tasks : [];
    const byKey = new Map<string, { task: any; index: number }>();
    const order: string[] = [];
    let suppressed = 0;
    for (let i = 0; i < list.length; i++) {
      const t: any = list[i];
      const k = _dedupKey(t);
      const existing = byKey.get(k);
      if (!existing) {
        byKey.set(k, { task: t, index: i });
        order.push(k);
      } else {
        suppressed++;
        // Keep higher priority; preserve user note either way.
        if (_priorityOf(t) > _priorityOf(existing.task)) {
          byKey.set(k, { task: _mergeNote(t, existing.task), index: existing.index });
        } else {
          byKey.set(k, { task: _mergeNote(existing.task, t), index: existing.index });
        }
      }
    }
    return { tasks: order.map((k) => byKey.get(k)!.task) as T[], suppressed };
  }, { tasks: Array.isArray(tasks) ? (tasks as T[]).slice() : [], suppressed: 0 });
}

export function buildTaskDedupHealth(): Readonly<{
  ok: boolean; runtimeVersion: string; taskDedupReady: true;
  dedupKeys: ReadonlyArray<string>;
}> {
  return Object.freeze({
    ok: true, runtimeVersion: TASK_DEDUPER_VERSION, taskDedupReady: true as const,
    dedupKeys: Object.freeze(['taskType', 'farmId', 'cropId', 'dueDate', 'sourceEngine']),
  });
}

let _installed = false;
export function installTaskDedupHealthGlobal(): void {
  if (_installed) return;
  if (_safe(() => typeof window === 'undefined', true)) return;
  _safe(() => {
    Object.defineProperty(window as any, '__taskDedupHealth', {
      configurable: true, enumerable: false, writable: false,
      value: () => buildTaskDedupHealth(),
    });
    _installed = true;
  }, undefined);
}

export const _internal = Object.freeze({
  dedupeTasks, buildTaskDedupHealth, installTaskDedupHealthGlobal,
});
export default dedupeTasks;
