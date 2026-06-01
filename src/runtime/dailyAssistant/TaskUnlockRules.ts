/**
 * TaskUnlockRules.ts — pure unlock logic for the daily-assistant task chain.
 * NO window global. NO install fn. ZERO imports. Pure functions only.
 *
 * Given a chain + completed/skipped sets + farm context, returns the single
 * "active" task and projects status onto every task. Never fabricates
 * completion. Never throws.
 */

// Self-contained safe helper.
const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };

export const TASK_UNLOCK_RULES_VERSION = 'task-unlock-rules-v1' as const;

// Duplicated from DailyAssistantContracts to keep this file self-contained
// (zero imports). Kept in sync by the gates.
interface AssistantTaskLike {
  id: string;
  stage: string;
  status?: string;
  requiresData?: ReadonlyArray<string>;
  scanRelevant?: boolean;
}

export interface UnlockContext {
  hasCrop: boolean;
  hasPlantingDate: boolean;
  landPrepDone: boolean;
  harvestReady: boolean;
  scanFollowUpPending: boolean;
}

/** Defensive accessor for requiresData — always returns a frozen array. */
export function requiresData(task: any): ReadonlyArray<string> {
  return _safe(() => {
    if (!task || typeof task !== 'object') return Object.freeze([]) as ReadonlyArray<string>;
    const r = (task as any).requiresData;
    return Array.isArray(r) ? Object.freeze(r.slice()) as ReadonlyArray<string>
      : Object.freeze([]) as ReadonlyArray<string>;
  }, Object.freeze([]) as ReadonlyArray<string>);
}

/**
 * Force-override rules per the spec:
 *  • !hasCrop → forced active = 'assist_pick_crop'
 *  • !hasPlantingDate && hasCrop → next active = 'assist_add_planting_date'
 *  • !landPrepDone (after crop + planting date) → 'assist_prepare_ground'
 *  • scanFollowUpPending → return the scan_followup-stage task before harvest
 *  • harvestReady → unlock harvest / sell
 *
 * Returns the FIRST task in chain order that satisfies the active rule,
 * skipping ones already completed/skipped. Returns null when all done.
 */
export function nextActiveTask(
  chain: ReadonlyArray<AssistantTaskLike>,
  completedIds: ReadonlySet<string>,
  skippedIds: ReadonlySet<string>,
  ctx: UnlockContext,
): AssistantTaskLike | null {
  return _safe(() => {
    if (!Array.isArray(chain) || chain.length === 0) return null;
    const notDone = (t: AssistantTaskLike) =>
      !completedIds.has(t.id) && !skippedIds.has(t.id);

    // Override 1 — missing crop forces Pick crop active.
    if (!ctx.hasCrop) {
      const t = chain.find((x) => x.id === 'assist_pick_crop' && notDone(x));
      if (t) return t;
    }
    // Override 2 — missing planting date but has crop.
    if (ctx.hasCrop && !ctx.hasPlantingDate) {
      const t = chain.find((x) => x.id === 'assist_add_planting_date' && notDone(x));
      if (t) return t;
    }
    // Override 3 — land prep not done (and prereqs satisfied).
    if (ctx.hasCrop && ctx.hasPlantingDate && !ctx.landPrepDone) {
      const t = chain.find((x) => x.id === 'assist_prepare_ground' && notDone(x));
      if (t) return t;
    }
    // Override 4 — scan follow-up injected before harvest when pending.
    if (ctx.scanFollowUpPending) {
      const t = chain.find((x) => x.stage === 'scan_followup' && notDone(x));
      if (t) return t;
    }
    // Override 5 — harvestReady unlocks harvest / sell ahead of late chain items.
    if (ctx.harvestReady) {
      const harvest = chain.find((x) => x.id === 'assist_harvest' && notDone(x));
      if (harvest) return harvest;
      const sell = chain.find((x) => x.id === 'assist_sell_produce' && notDone(x));
      if (sell) return sell;
    }
    // Default: first chain item not yet completed/skipped.
    for (const t of chain) {
      if (notDone(t)) return t;
    }
    return null;
  }, null);
}

/**
 * Project status onto every task in the chain: each gets one of
 * completed / skipped / active / upcoming / locked. Exactly ONE 'active'.
 * Returns a frozen array.
 */
export function computeUnlockState(
  chain: ReadonlyArray<AssistantTaskLike>,
  completedIds: ReadonlySet<string>,
  skippedIds: ReadonlySet<string>,
  ctx: UnlockContext,
): ReadonlyArray<AssistantTaskLike> {
  return _safe(() => {
    const active = nextActiveTask(chain, completedIds, skippedIds, ctx);
    let upcomingSeen = false;
    const out = chain.map((t) => {
      let status: string;
      if (completedIds.has(t.id)) status = 'completed';
      else if (skippedIds.has(t.id)) status = 'skipped';
      else if (active && t.id === active.id) status = 'active';
      else if (!active) status = 'locked';
      else if (!upcomingSeen) { status = 'upcoming'; upcomingSeen = true; }
      else status = 'locked';
      return Object.freeze({ ...t, status });
    });
    return Object.freeze(out) as ReadonlyArray<AssistantTaskLike>;
  }, Object.freeze([]) as ReadonlyArray<AssistantTaskLike>);
}
