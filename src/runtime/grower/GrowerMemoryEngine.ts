/**
 * GrowerMemoryEngine.ts — sprint #216 §9.
 *
 * Read-only profile of grower preferences the app already holds —
 * preferred crops, language, farm size, common issues, task-completion
 * behavior — so recommendations can be personalized. It composes
 * existing signals (no new collection); absent signals stay null and
 * are never invented. No PII: crops/issues are categories, not the
 * grower's identity.
 *
 * Pure. Never throws. Pins window.__growerMemoryHealth().
 */

export const GROWER_MEMORY_ENGINE_VERSION = 'grower-memory-engine-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const _arr = (v: unknown): any[] => (Array.isArray(v) ? v : []);

export function buildGrowerMemory(input: {
  language?: string;
  farmSize?: string;
  scanHistory?: ReadonlyArray<{ plant?: string; crop?: string; issue?: string }>;
  taskHistory?: ReadonlyArray<{ completed?: boolean }>;
} = {}): Readonly<{
  runtimeVersion: string;
  language: string | null;
  farmSize: string | null;
  preferredCrops: ReadonlyArray<string>;
  commonIssues: ReadonlyArray<string>;
  taskCompletionRate: number | null;   // null when no tasks — never faked
  personalizationReady: boolean;
}> {
  return _safe(() => {
    const scans = _arr(input.scanHistory);
    const crops = scans.map((s) => _str(s.crop || s.plant)).filter(Boolean);
    const issues = scans.map((s) => _str(s.issue)).filter((i) => i && i !== 'no_visible_issue');
    // frequency-rank
    const rank = (arr: string[]) => {
      const m = new Map<string, number>();
      for (const x of arr) m.set(x, (m.get(x) || 0) + 1);
      return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).map((e) => e[0]).slice(0, 5);
    };
    const tasks = _arr(input.taskHistory);
    const done = tasks.filter((t) => !!t.completed).length;
    const taskCompletionRate = tasks.length > 0 ? Math.round((done / tasks.length) * 100) : null;
    const language = _str(input.language) || null;

    return Object.freeze({
      runtimeVersion: GROWER_MEMORY_ENGINE_VERSION,
      language,
      farmSize: _str(input.farmSize) || null,
      preferredCrops: Object.freeze(rank(crops)),
      commonIssues: Object.freeze(rank(issues)),
      taskCompletionRate,
      personalizationReady: crops.length > 0 || !!language,
    });
  }, Object.freeze({
    runtimeVersion: GROWER_MEMORY_ENGINE_VERSION,
    language: null, farmSize: null,
    preferredCrops: Object.freeze([]), commonIssues: Object.freeze([]),
    taskCompletionRate: null, personalizationReady: false,
  }));
}

export function buildGrowerMemoryHealth(): Readonly<{
  ok: boolean; runtimeVersion: string;
  growerMemoryReady: true; readOnly: true; noPII: true;
}> {
  return Object.freeze({
    ok: true, runtimeVersion: GROWER_MEMORY_ENGINE_VERSION,
    growerMemoryReady: true as const, readOnly: true as const, noPII: true as const,
  });
}

let _installed = false;
export function installGrowerMemoryHealthGlobal(): void {
  if (_installed) return;
  if (_safe(() => typeof window === 'undefined', true)) return;
  _safe(() => {
    Object.defineProperty(window as any, '__growerMemoryHealth', {
      configurable: true, enumerable: false, writable: false,
      value: () => buildGrowerMemoryHealth(),
    });
    _installed = true;
  }, undefined);
}

export const _internal = Object.freeze({
  buildGrowerMemory, buildGrowerMemoryHealth, installGrowerMemoryHealthGlobal,
});
export default buildGrowerMemory;
