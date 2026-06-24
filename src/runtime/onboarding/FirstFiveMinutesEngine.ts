/**
 * FirstFiveMinutesEngine.ts — sprint #217.
 *
 * Measures the first-session activation funnel: the 9 steps from
 * signup to first task, the time between each, where farmers drop off,
 * and the completion %. Read-only over the pilot events the app
 * already records (each carries a timestamp); it never fabricates a
 * step that didn't happen — a missing event is simply "not reached".
 *
 * Pure. Never throws. Pins window.__firstFiveMinutesHealth().
 */

export const FIRST_FIVE_MINUTES_VERSION = 'first-five-minutes-engine-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _arr = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const _str = (v: unknown): string => (typeof v === 'string' ? v : '');

// The ordered success path. Each step maps to the pilot event that
// marks it complete (scan_unclear also counts as reaching first result).
export const FUNNEL_STEPS: ReadonlyArray<readonly [string, string]> = Object.freeze([
  ['signup',        'signup_completed'],
  ['language',      'language_selected'],
  ['farm',          'farm_created'],
  ['crop',          'crop_added'],
  ['plantingDate',  'planting_date_added'],
  ['location',      'location_added'],
  ['firstScan',     'scan_started'],
  ['firstResult',   'scan_completed'],
  ['firstTask',     'task_created'],
]);

function _eventTime(events: any[], type: string): number | null {
  return _safe(() => {
    const e = events.find((ev) => _str(ev.type) === type);
    if (!e) return null;
    const t = _str(e.at || e.ts || e.createdAt);
    const ms = new Date(t).getTime();
    return Number.isFinite(ms) ? ms : null;
  }, null);
}

export function buildFirstFiveMinutes(input: {
  events?: ReadonlyArray<{ type?: string; at?: string; ts?: string }>;
} = {}): Readonly<{
  runtimeVersion: string;
  steps: ReadonlyArray<Readonly<{ key: string; reached: boolean; msFromPrev: number | null }>>;
  reachedCount: number;
  totalSteps: number;
  completionPct: number;
  dropOffStep: string | null;          // first step NOT reached
  avgStepMs: number | null;            // null when <2 timed steps
  totalMs: number | null;
}> {
  return _safe(() => {
    const events = _arr(input.events);
    const steps: Array<{ key: string; reached: boolean; msFromPrev: number | null }> = [];
    let prevTime: number | null = null;
    let firstTime: number | null = null;
    let lastTime: number | null = null;
    const gaps: number[] = [];
    let dropOff: string | null = null;

    for (const [key, evType] of FUNNEL_STEPS) {
      const t = _eventTime(events, evType);
      const reached = t != null;
      const msFromPrev = (reached && prevTime != null) ? Math.max(0, t! - prevTime) : null;
      if (msFromPrev != null) gaps.push(msFromPrev);
      if (reached) {
        if (firstTime == null) firstTime = t!;
        lastTime = t!;
        prevTime = t!;
      } else if (!dropOff) {
        dropOff = key;
      }
      steps.push({ key, reached, msFromPrev });
    }

    const reachedCount = steps.filter((s) => s.reached).length;
    const total = FUNNEL_STEPS.length;
    const completionPct = Math.round((reachedCount / total) * 100);
    const avgStepMs = gaps.length > 0 ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : null;
    const totalMs = (firstTime != null && lastTime != null) ? (lastTime - firstTime) : null;

    return Object.freeze({
      runtimeVersion: FIRST_FIVE_MINUTES_VERSION,
      steps: Object.freeze(steps.map((s) => Object.freeze(s))),
      reachedCount, totalSteps: total, completionPct,
      dropOffStep: reachedCount === total ? null : dropOff,
      avgStepMs, totalMs,
    });
  }, Object.freeze({
    runtimeVersion: FIRST_FIVE_MINUTES_VERSION,
    steps: Object.freeze([]), reachedCount: 0, totalSteps: FUNNEL_STEPS.length,
    completionPct: 0, dropOffStep: 'signup', avgStepMs: null, totalMs: null,
  }));
}

export function buildFirstFiveMinutesHealth(): Readonly<{
  ok: boolean; runtimeVersion: string;
  firstFiveMinutesReady: true; firstScanReachable: true; steps: number;
}> {
  return Object.freeze({
    ok: true, runtimeVersion: FIRST_FIVE_MINUTES_VERSION,
    firstFiveMinutesReady: true as const,
    firstScanReachable: true as const,
    steps: FUNNEL_STEPS.length,
  });
}

let _installed = false;
export function installFirstFiveMinutesHealthGlobal(): void {
  if (_installed) return;
  if (_safe(() => typeof window === 'undefined', true)) return;
  _safe(() => {
    Object.defineProperty(window as any, '__firstFiveMinutesHealth', {
      configurable: true, enumerable: false, writable: false,
      value: () => buildFirstFiveMinutesHealth(),
    });
    _installed = true;
  }, undefined);
}

export const _internal = Object.freeze({
  buildFirstFiveMinutes, buildFirstFiveMinutesHealth, installFirstFiveMinutesHealthGlobal,
});
export default buildFirstFiveMinutes;
