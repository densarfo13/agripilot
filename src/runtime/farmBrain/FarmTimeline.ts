/**
 * FarmTimeline.ts — sprint #209, spec "Farm Timeline".
 *
 * Read-only view that orders the events a farm has actually produced
 * into a timeline. It composes the existing event stream (pilot
 * analytics events + scan/task/outcome history) — it does NOT create
 * a new event store and never fabricates an entry. Empty in → empty
 * out (the caller shows onboarding guidance).
 *
 * Pure. SSR-safe. Never throws. Frozen returns. No Date.now() — the
 * caller supplies timestamps (events already carry `at`).
 */

export const FARM_TIMELINE_VERSION = 'farm-timeline-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const _arr = (v: unknown): any[] => (Array.isArray(v) ? v : []);

// The 9 tracked timeline kinds + a human label each.
export const TIMELINE_KINDS = Object.freeze({
  farm_created:        'Farm created',
  crop_added:          'Crop added',
  planting_date_added: 'Planting date added',
  scan_completed:      'Scan completed',
  issue_detected:      'Issue detected',
  task_completed:      'Task completed',
  outcome_recorded:    'Outcome recorded',
  weather_alert:       'Weather alert',
  health_score_changed:'Health score changed',
} as const);
export type TimelineKind = keyof typeof TIMELINE_KINDS;

// Map raw pilot-analytics event names → timeline kinds. Unmapped
// events are dropped (the timeline only shows the 9 tracked kinds).
const EVENT_TO_KIND: Readonly<Record<string, TimelineKind>> = Object.freeze({
  farm_created: 'farm_created',
  crop_added: 'crop_added',
  plant_added: 'crop_added',
  scan_completed: 'scan_completed',
  scan_unknown_result: 'issue_detected',
  task_completed: 'task_completed',
  outcome_recorded: 'outcome_recorded',
});

export interface TimelineEntry {
  kind:  TimelineKind;
  label: string;
  at:    string;          // ISO — passed through, never minted here
  detail: string | null;
}

/**
 * Build the timeline. Accepts already-typed entries ({kind, at}) AND
 * raw pilot events ({type, at}); maps + merges + sorts newest-first.
 */
export function buildFarmTimeline(input: {
  entries?: ReadonlyArray<{ kind?: string; at?: string; detail?: string }>;
  pilotEvents?: ReadonlyArray<{ type?: string; at?: string; ts?: string }>;
} = {}): Readonly<{
  runtimeVersion: string;
  entries: ReadonlyArray<Readonly<TimelineEntry>>;
  count: number;
  active: boolean;
}> {
  return _safe(() => {
    const out: TimelineEntry[] = [];

    for (const e of _arr(input.entries)) {
      const kind = _str(e.kind) as TimelineKind;
      if (kind in TIMELINE_KINDS) {
        out.push({
          kind,
          label: (TIMELINE_KINDS as Record<string, string>)[kind],
          at: _str(e.at),
          detail: _str(e.detail) || null,
        });
      }
    }
    for (const ev of _arr(input.pilotEvents)) {
      const mapped = EVENT_TO_KIND[_str(ev.type)];
      if (mapped) {
        out.push({
          kind: mapped,
          label: (TIMELINE_KINDS as Record<string, string>)[mapped],
          at: _str(ev.at) || _str(ev.ts),
          detail: null,
        });
      }
    }

    // Newest first; entries without a timestamp sink to the end.
    out.sort((a, b) => {
      if (!a.at) return 1;
      if (!b.at) return -1;
      return a.at < b.at ? 1 : (a.at > b.at ? -1 : 0);
    });

    const entries = out.slice(0, 50).map((e) => Object.freeze(e));
    return Object.freeze({
      runtimeVersion: FARM_TIMELINE_VERSION,
      entries: Object.freeze(entries),
      count: entries.length,
      active: entries.length > 0,
    });
  }, Object.freeze({
    runtimeVersion: FARM_TIMELINE_VERSION,
    entries: Object.freeze([]),
    count: 0,
    active: false,
  }));
}

export const _internal = Object.freeze({ buildFarmTimeline, TIMELINE_KINDS });
export default buildFarmTimeline;
